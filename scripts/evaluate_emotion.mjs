// scripts/evaluate_emotion.mjs
// Evaluates the pretrained GoEmotions classifier (SamLowe/roberta-base-go_emotions) used by MoodBite.
//
// Run from the project root (Node 20.19+ / 22.7+ / Node 24):
//   node --env-file=.env.local scripts/evaluate_emotion.mjs
//
// What this measures: the CLASSIFIER ALONE (not the recommendation text), at the Ekman level
// (anger, disgust, fear, joy, sadness, surprise, neutral), using lib/emotion.js exactly as the app does.
// Requests that fail or time out are COUNTED (as wrong), never silently dropped.
// The dataset is a small, single-annotator starter set: report n and the confidence interval with every number.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { getMood, getEkmanGroup, mapGoEmotionToCulinaryMood, mentionsTiredness } from '../lib/emotion.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLASSES = ['anger', 'disgust', 'fear', 'joy', 'sadness', 'surprise', 'neutral'];
const UNAVAILABLE = 'unavailable';

// Cases for the tiredness keyword rule: [text, expected]
const TIREDNESS_CASES = [
    ["I'm so tired today", true],
    ["I am exhausted after work", true],
    ["feeling sleepy and drained", true],
    ["totally worn out", true],
    ["I'm retired and happy", false],
    ["She was attired in silk", false],
    ["I'm not tired at all", false],
    ["I don't feel tired", false],
    ["I never get tired of dal", false],
    ["I feel great", false]
];

/** Wilson score interval for a proportion (95% by default). */
export function wilsonInterval(successes, n, z = 1.96) {
    if (n === 0) return { low: 0, high: 0 };
    const p = successes / n;
    const denom = 1 + (z * z) / n;
    const centre = (p + (z * z) / (2 * n)) / denom;
    const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
    return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

/**
 * @param {string[]} yTrue gold labels
 * @param {string[]} yPred predicted labels ('unavailable' when the classifier gave no answer)
 */
export function computeMetrics(yTrue, yPred, classes = CLASSES) {
    const n = yTrue.length;
    let correct = 0;
    let answered = 0;
    let correctAnswered = 0;

    const confusion = {};
    for (const t of classes) {
        confusion[t] = {};
        for (const p of [...classes, UNAVAILABLE]) confusion[t][p] = 0;
    }

    for (let i = 0; i < n; i++) {
        const t = yTrue[i];
        const p = classes.includes(yPred[i]) ? yPred[i] : UNAVAILABLE;
        confusion[t][p] += 1;
        if (p !== UNAVAILABLE) {
            answered += 1;
            if (p === t) correctAnswered += 1;
        }
        if (p === t) correct += 1;
    }

    const perClass = {};
    let f1Sum = 0;
    for (const c of classes) {
        const tp = confusion[c][c];
        const support = Object.values(confusion[c]).reduce((a, b) => a + b, 0);
        const predictedAsC = classes.reduce((sum, t) => sum + confusion[t][c], 0);
        const precision = predictedAsC === 0 ? 0 : tp / predictedAsC;
        const recall = support === 0 ? 0 : tp / support;
        const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
        perClass[c] = { precision, recall, f1, support };
        f1Sum += f1;
    }

    return {
        n,
        answered,
        coverage: n === 0 ? 0 : answered / n,
        accuracyAll: n === 0 ? 0 : correct / n, // failures count as wrong
        accuracyAllCI: wilsonInterval(correct, n),
        accuracyAnswered: answered === 0 ? 0 : correctAnswered / answered,
        macroF1: f1Sum / classes.length,
        perClass,
        confusion
    };
}

async function classifyWithRetry(text, attempts = 2, timeoutMs = 8000) {
    let last = { label: null, score: null, status: 'error' };
    for (let i = 0; i < attempts; i++) {
        last = await getMood(text, timeoutMs); // longer timeout than the app: a cold start is not a model error
        if (last.status === 'ok') return last;
        if (last.status === 'unconfigured') return last;
    }
    return last;
}

async function mapWithConcurrency(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;
    async function worker() {
        while (next < items.length) {
            const idx = next++;
            results[idx] = await fn(items[idx], idx);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}

const pct = (x) => `${(x * 100).toFixed(1)}%`;

async function main() {
    if (!process.env.HUGGING_FACE_API_TOKEN) {
        console.error('HUGGING_FACE_API_TOKEN is not set. Run: node --env-file=.env.local scripts/evaluate_emotion.mjs');
        process.exit(1);
    }

    const dataset = JSON.parse(await readFile(path.join(__dirname, '..', 'data', 'emotion_testset.json'), 'utf-8'));
    const items = dataset.items;
    console.log(`Evaluating ${items.length} sentences (Ekman-level, ${CLASSES.length} classes)...`);

    const outputs = await mapWithConcurrency(items, 4, async (item) => {
        const r = await classifyWithRetry(item.text);
        const rawLabel = r.label;
        const predicted = r.status === 'ok' ? getEkmanGroup(rawLabel) : UNAVAILABLE;
        return { text: item.text, gold: item.ekman, rawLabel, score: r.score, status: r.status, predicted };
    });

    const yTrue = outputs.map(o => o.gold);
    const yPred = outputs.map(o => o.predicted);
    const m = computeMetrics(yTrue, yPred);

    const failures = outputs.filter(o => o.status !== 'ok');
    console.log(`\nSentences: ${m.n} | answered: ${m.answered} (coverage ${pct(m.coverage)}) | failed/timeouts: ${failures.length}`);
    console.log(`Accuracy (failures counted as wrong): ${pct(m.accuracyAll)}  95% CI [${pct(m.accuracyAllCI.low)}, ${pct(m.accuracyAllCI.high)}]`);
    console.log(`Accuracy (answered only):             ${pct(m.accuracyAnswered)}`);
    console.log(`Macro-F1 (7 classes):                 ${m.macroF1.toFixed(3)}`);

    console.log('\nPer-class results:');
    console.table(Object.fromEntries(Object.entries(m.perClass).map(([c, v]) => [c, {
        precision: v.precision.toFixed(2), recall: v.recall.toFixed(2), f1: v.f1.toFixed(2), support: v.support
    }])));

    console.log('Confusion matrix (rows = gold, columns = predicted):');
    console.table(m.confusion);

    const wrong = outputs.filter(o => o.predicted !== o.gold);
    if (wrong.length) {
        console.log(`\nMisclassified or unavailable (${wrong.length}):`);
        for (const w of wrong) {
            console.log(`- [${w.gold} -> ${w.predicted}${w.rawLabel ? ` (${w.rawLabel}, ${w.score})` : ''}] ${w.text}`);
        }
    }

    // Tiredness keyword rule
    const tiredResults = TIREDNESS_CASES.map(([text, expected]) => ({ text, expected, got: mentionsTiredness(text) }));
    const tiredCorrect = tiredResults.filter(r => r.expected === r.got).length;
    console.log(`\nTiredness keyword rule: ${tiredCorrect}/${tiredResults.length} cases correct`);
    for (const r of tiredResults.filter(r => r.expected !== r.got)) console.log(`- FAIL: "${r.text}" expected ${r.expected}, got ${r.got}`);

    // Culinary mood distribution produced from the classifier's raw labels (design heuristic, not an accuracy measure)
    const moodCounts = {};
    for (const o of outputs.filter(o => o.rawLabel)) {
        const mood = mapGoEmotionToCulinaryMood(o.rawLabel);
        moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    }
    console.log('\nCulinary mood distribution (heuristic mapping applied to raw labels):', moodCounts);

    const outDir = path.join(__dirname, 'results');
    await mkdir(outDir, { recursive: true });
    const outFile = path.join(outDir, `emotion_eval_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    await writeFile(outFile, JSON.stringify({
        runAt: new Date().toISOString(),
        model: 'SamLowe/roberta-base-go_emotions',
        level: 'ekman',
        datasetMeta: dataset.meta,
        metrics: m,
        tiredness: { correct: tiredCorrect, total: tiredResults.length },
        outputs
    }, null, 2));
    console.log(`\nSaved: ${path.relative(process.cwd(), outFile)}`);
}

// Run only when executed directly (so computeMetrics can be imported in tests)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((err) => { console.error(err); process.exit(1); });
}
