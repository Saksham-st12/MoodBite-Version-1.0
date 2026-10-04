// evaluate.js
// Emotion Recognition Benchmark for MoodBite AI
// Evaluates RoBERTa GoEmotions directly (lib/emotion.js) using Demszky et al. (2020) Ekman mapping
// Fixed per review:
// 1. Direct model evaluation (isolates NLP classifier from LLM/keywords)
// 2. 50+ benchmark test sentences across all Ekman categories
// 3. Errors/timeouts are counted in n (never dropped, no inflated accuracy)
// 4. Reports sample size n, Wilson 95% confidence intervals, and per-class precision/recall/F1 with support

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { getMood, getEkmanGroup, EKMAN_MAPPING } = require('./lib/emotion');

const BENCHMARK_DATASET = [
    // --- JOY (joy, excitement, gratitude, love, optimism, relief, pride, admiration, amusement, approval, caring) ---
    { text: "I'm so thrilled, our team finally won the championship!", true_emotion: "excitement", true_ekman: "joy" },
    { text: "I really appreciate all the hard work you did to help me today.", true_emotion: "gratitude", true_ekman: "joy" },
    { text: "This dessert is so delicious, I absolutely love it!", true_emotion: "love", true_ekman: "joy" },
    { text: "I'm feeling really happy and cheerful this afternoon.", true_emotion: "joy", true_ekman: "joy" },
    { text: "You did an incredible job presenting to the client, brilliant work!", true_emotion: "admiration", true_ekman: "joy" },
    { text: "Things are definitely going to get much better starting next week.", true_emotion: "optimism", true_ekman: "joy" },
    { text: "I am so relieved that the stressful final exam is over.", true_emotion: "relief", true_ekman: "joy" },
    { text: "I am so proud of what my little sister accomplished.", true_emotion: "pride", true_ekman: "joy" },
    { text: "That stand-up comedian had me laughing non-stop, hilarious!", true_emotion: "amusement", true_ekman: "joy" },
    { text: "I agree with your suggestion, that sounds like a great plan.", true_emotion: "approval", true_ekman: "joy" },
    { text: "Please take care of yourself and get some warm rest.", true_emotion: "caring", true_ekman: "joy" },
    { text: "I just got promoted at work and I could not be happier!", true_emotion: "joy", true_ekman: "joy" },
    { text: "Thank you so much for always supporting me through tough times.", true_emotion: "gratitude", true_ekman: "joy" },
    { text: "We are so hyped for our vacation to Goa this weekend!", true_emotion: "excitement", true_ekman: "joy" },

    // --- SADNESS (sadness, disappointment, grief, remorse, embarrassment) ---
    { text: "I feel so lonely and down today, nothing seems right.", true_emotion: "sadness", true_ekman: "sadness" },
    { text: "I am really disappointed that they cancelled the festival.", true_emotion: "disappointment", true_ekman: "sadness" },
    { text: "My childhood pet passed away last night and I cannot stop crying.", true_emotion: "grief", true_ekman: "sadness" },
    { text: "I feel terrible for yelling at my friend, I deeply regret it.", true_emotion: "remorse", true_ekman: "sadness" },
    { text: "I tripped and dropped my plate in front of everyone, so mortified.", true_emotion: "embarrassment", true_ekman: "sadness" },
    { text: "It breaks my heart to see everything turn out like this.", true_emotion: "sadness", true_ekman: "sadness" },
    { text: "I worked so hard on this submission but the grade was such a let-down.", true_emotion: "disappointment", true_ekman: "sadness" },
    { text: "I wish I hadn't said those hurtful words yesterday.", true_emotion: "remorse", true_ekman: "sadness" },

    // --- ANGER (anger, annoyance, disapproval) ---
    { text: "I am furious that someone scratched my car and drove off!", true_emotion: "anger", true_ekman: "anger" },
    { text: "The noisy construction outside my window is getting on my nerves.", true_emotion: "annoyance", true_ekman: "anger" },
    { text: "I strongly disagree with how this unfair rule was enforced.", true_emotion: "disapproval", true_ekman: "anger" },
    { text: "My laptop crashed and wiped out three hours of unsaved work!", true_emotion: "anger", true_ekman: "anger" },
    { text: "People who cut the line without waiting are so irritating.", true_emotion: "annoyance", true_ekman: "anger" },
    { text: "This kind of irresponsible behavior is completely unacceptable.", true_emotion: "disapproval", true_ekman: "anger" },
    { text: "I am so sick and tired of these constant delays and lies.", true_emotion: "anger", true_ekman: "anger" },
    { text: "The endless spam calls every morning drive me crazy.", true_emotion: "annoyance", true_ekman: "anger" },

    // --- FEAR (fear, nervousness) ---
    { text: "I'm terrified of walking alone in this dark alley at night.", true_emotion: "fear", true_ekman: "fear" },
    { text: "I have my big interview tomorrow and my hands won't stop shaking.", true_emotion: "nervousness", true_ekman: "fear" },
    { text: "The sudden loud bang outside frightened everyone in the room.", true_emotion: "fear", true_ekman: "fear" },
    { text: "I feel so jittery and anxious waiting for the test results.", true_emotion: "nervousness", true_ekman: "fear" },
    { text: "I'm really scared of what might happen if things go wrong.", true_emotion: "fear", true_ekman: "fear" },
    { text: "Standing on stage in front of 500 people gives me butterflies.", true_emotion: "nervousness", true_ekman: "fear" },

    // --- SURPRISE (surprise, curiosity, realization, confusion) ---
    { text: "Whoa, I was definitely not expecting to see you here today!", true_emotion: "surprise", true_ekman: "surprise" },
    { text: "I wonder how they manage to bake bread that stays soft for days.", true_emotion: "curiosity", true_ekman: "surprise" },
    { text: "Oh wait, I just realized that today is actually Sunday!", true_emotion: "realization", true_ekman: "surprise" },
    { text: "I have no idea what these contradictory instructions are asking for.", true_emotion: "confusion", true_ekman: "surprise" },
    { text: "What an unexpected and delightful plot twist at the end!", true_emotion: "surprise", true_ekman: "surprise" },
    { text: "How does the machine learning model actually converge here?", true_emotion: "curiosity", true_ekman: "surprise" },
    { text: "Wait, did they just announce a complete sudden redesign?", true_emotion: "surprise", true_ekman: "surprise" },

    // --- DISGUST (disgust) ---
    { text: "This spoiled milk smells absolutely foul and revolting.", true_emotion: "disgust", true_ekman: "disgust" },
    { text: "The unsanitary conditions in that kitchen completely grossed me out.", true_emotion: "disgust", true_ekman: "disgust" },
    { text: "Finding a cockroach in my food ruined my entire appetite.", true_emotion: "disgust", true_ekman: "disgust" },

    // --- NEUTRAL (neutral) ---
    { text: "The meeting is scheduled for 3 PM in conference room B.", true_emotion: "neutral", true_ekman: "neutral" },
    { text: "I took the metro to commute to the office today.", true_emotion: "neutral", true_ekman: "neutral" },
    { text: "The grocery store closes at 9 PM on weekdays.", true_emotion: "neutral", true_ekman: "neutral" },
    { text: "The package was delivered to the front porch this morning.", true_emotion: "neutral", true_ekman: "neutral" },
    { text: "I had plain rice and lentils for lunch yesterday.", true_emotion: "neutral", true_ekman: "neutral" },
    { text: "Today is Thursday and tomorrow is Friday.", true_emotion: "neutral", true_ekman: "neutral" }
];

function calculateWilsonInterval(successes, total) {
    if (total === 0) return { lower: 0, upper: 0 };
    const p = successes / total;
    const z = 1.96; // 95% CI
    const z2 = z * z;
    const denominator = 1 + z2 / total;
    const center = p + z2 / (2 * total);
    const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);
    const lower = Math.max(0, (center - margin) / denominator);
    const upper = Math.min(1, (center + margin) / denominator);
    return {
        lower: Number((lower * 100).toFixed(1)),
        upper: Number((upper * 100).toFixed(1))
    };
}

async function runBenchmark() {
    const total = BENCHMARK_DATASET.length;
    console.log(`\n======================================================`);
    console.log(`📊 MoodBite Emotion Recognition Benchmark (Demszky et al., 2020)`);
    console.log(`Evaluates: Standalone RoBERTa-GoEmotions classifier (lib/emotion.js)`);
    console.log(`Sample size (n): ${total}`);
    console.log(`Note: Errors, 429s, and timeouts are counted in total n (never dropped).`);
    console.log(`======================================================\n`);

    const results = [];
    let errorCount = 0;
    let strictCorrect = 0;
    let ekmanCorrect = 0;

    // Process sequentially to respect Hugging Face free-tier rate limits
    for (let i = 0; i < total; i++) {
        const item = BENCHMARK_DATASET[i];
        process.stdout.write(`[${i + 1}/${total}] Testing: "${item.text.substring(0, 32)}..." `);

        const prediction = await getMood(item.text, 3500);

        if (prediction.status !== 'ok' || !prediction.label) {
            errorCount++;
            results.push({
                ...item,
                pred_emotion: 'error',
                pred_ekman: 'error',
                score: 0,
                status: prediction.status
            });
            console.log(`❌ [${prediction.status.toUpperCase()}]`);
        } else {
            const predEmotion = prediction.label;
            const predEkman = getEkmanGroup(predEmotion);
            const isStrictMatch = predEmotion === item.true_emotion;
            const isEkmanMatch = predEkman === item.true_ekman;

            if (isStrictMatch) strictCorrect++;
            if (isEkmanMatch) ekmanCorrect++;

            results.push({
                ...item,
                pred_emotion: predEmotion,
                pred_ekman: predEkman,
                score: prediction.score,
                status: 'ok'
            });

            const tag = isEkmanMatch ? (isStrictMatch ? '✅ Exact' : '✔️ Ekman') : '❌';
            console.log(`${tag} -> Pred: ${predEmotion} [${predEkman}] (True: ${item.true_emotion})`);
        }

        // Small pause between requests to prevent HF 429s
        await new Promise(r => setTimeout(r, 200));
    }

    // 1. Overall Accuracy Metrics
    const strictAcc = (strictCorrect / total) * 100;
    const ekmanAcc = (ekmanCorrect / total) * 100;
    const strictCI = calculateWilsonInterval(strictCorrect, total);
    const ekmanCI = calculateWilsonInterval(ekmanCorrect, total);

    console.log(`\n======================================================`);
    console.log(`📈 Summary Evaluation Metrics (Total n = ${total})`);
    console.log(`======================================================`);
    console.log(`Total Samples Tested (n) : ${total}`);
    console.log(`Errors / Timeouts Count  : ${errorCount} (${((errorCount / total) * 100).toFixed(1)}%)`);
    console.log(`Strict 28-Emotion Match  : ${strictAcc.toFixed(1)}% (95% CI: ${strictCI.lower}% - ${strictCI.upper}%)`);
    console.log(`Ekman 6+1 Emotion Match  : ${ekmanAcc.toFixed(1)}% (95% CI: ${ekmanCI.lower}% - ${ekmanCI.upper}%)`);

    // 2. Per-Ekman Category Metrics (Precision, Recall, F1)
    const ekmanClasses = Object.keys(EKMAN_MAPPING);
    const ekmanReport = {};

    ekmanClasses.forEach(category => {
        let tp = 0;
        let fp = 0;
        let fn = 0;

        results.forEach(r => {
            if (r.pred_ekman === category && r.true_ekman === category) tp++;
            if (r.pred_ekman === category && r.true_ekman !== category) fp++;
            if (r.pred_ekman !== category && r.true_ekman === category) fn++;
        });

        const support = tp + fn;
        const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
        const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
        const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

        ekmanReport[category] = {
            'Precision': precision.toFixed(2),
            'Recall': recall.toFixed(2),
            'F1-Score': f1.toFixed(2),
            'Support (n)': support
        };
    });

    console.log(`\n======================================================`);
    console.log(`📑 Per-Class Breakdown (Ekman 6+1 Taxonomy - Demszky et al., 2020)`);
    console.log(`======================================================`);
    console.table(ekmanReport);
    console.log(`Note: Evaluated strictly using getMood() in lib/emotion.js without keyword overrides or LLM inference.\n`);
}

runBenchmark().catch(err => {
    console.error("Evaluation script encountered fatal error:", err);
    process.exit(1);
});