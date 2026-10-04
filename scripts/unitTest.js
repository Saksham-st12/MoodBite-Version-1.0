// scripts/unitTest.js
// Fast, completely offline unit test suite for lib/dietaryCheck.js and lib/emotion.js
// Requires NO network access, NO API keys, and NO running server.

const {
    detectNonVegKeywords,
    verifyDietaryCompliance,
    calculateIngredientMatch
} = require('../lib/dietaryCheck');

// Since lib/emotion.js is an ES module, we import dynamically or via ESM wrapper
async function runUnitTests() {
    console.log('\n🧪 Running MoodBite AI Offline Unit Tests...\n');
    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  ✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${message}`);
            failed++;
        }
    }

    console.log('--- 1. Testing Dietary Compliance & Heuristic Keyword Detection ---');

    // 1.1 Vegetarian exceptions (soya keema, meat-free, eggless, plant-based)
    const vegExceptionSample = 'Soya keema masala with meat-free butter gravy and eggless bread roll';
    const vegCheck = detectNonVegKeywords(vegExceptionSample);
    assert(!vegCheck.hasNonVeg, 'Vegetarian exceptions (soya keema, meat-free, eggless) are not flagged as non-veg');

    // 1.2 Non-veg keywords
    const nonVegSample = 'Chicken biryani with aromatic basmati rice';
    const nonVegCheck = detectNonVegKeywords(nonVegSample);
    assert(nonVegCheck.hasNonVeg && nonVegCheck.matchedKeyword === 'chicken', 'Non-veg keywords (e.g. chicken) are accurately detected');

    // 1.3 Substring boundaries
    const boundaryCheck = detectNonVegKeywords('A plate of boiled chickpeas in oil');
    assert(!boundaryCheck.hasNonVeg, 'Word boundary prevents "oil" or "boiled" falsely matching non-veg keywords');

    // 1.4 Dietary Compliance Verification
    const vegRecipe = {
        name: 'Paneer Makhani',
        description: 'Cottage cheese cubes in rich tomato gravy',
        dietaryType: 'veg',
        ingredientsList: [{ item: 'Paneer' }, { item: 'Tomato' }, { item: 'Butter' }]
    };
    const nonVegRecipe = {
        name: 'Murgh Makhani',
        description: 'Tender chicken pieces in butter sauce',
        dietaryType: 'non-veg',
        ingredientsList: [{ item: 'Chicken' }, { item: 'Tomato' }, { item: 'Butter' }]
    };

    assert(verifyDietaryCompliance(vegRecipe, 'veg').isCompliant, 'Veg recipe is compliant with veg preference');
    assert(!verifyDietaryCompliance(nonVegRecipe, 'veg').isCompliant, 'Non-veg recipe is rejected in veg preference');
    assert(verifyDietaryCompliance(nonVegRecipe, 'non-veg').isCompliant, 'Non-veg recipe is compliant in non-veg preference');
    assert(!verifyDietaryCompliance(vegRecipe, 'non-veg').isCompliant, 'Pure veg recipe is rejected in non-veg preference');

    // 1.5 Ingredient Matching with Substring Immunity
    const potatoRecipe = {
        name: 'Jeera Aloo',
        description: 'Potatoes boiled and seasoned with cumin',
        instructions: ['Boil the potatoes in water', 'Season with cumin seeds and salt'],
        ingredientsList: [{ item: 'potatoes', amount: '300g' }, { item: 'cumin seeds', amount: '1 tsp' }]
    };
    const oilMatch = calculateIngredientMatch(potatoRecipe, ['oil']);
    assert(oilMatch.matchCount === 0, 'calculateIngredientMatch prevents "oil" falsely matching "boiled"');

    const alooMatch = calculateIngredientMatch(potatoRecipe, ['potato', 'cumin']);
    assert(alooMatch.matchCount === 2, 'calculateIngredientMatch successfully matches clean tokens "potato" and "cumin"');

    console.log('\n--- 2. Testing Emotion & Tiredness Taxonomy Modules ---');

    const emotionModule = await import('../lib/emotion.js');
    const {
        mentionsTiredness,
        getEkmanGroup,
        mapGoEmotionToCulinaryMood,
        CULINARY_MOODS,
        CULINARY_MOOD_GUIDANCE
    } = emotionModule;

    // 2.1 Tiredness Keyword Detection
    assert(mentionsTiredness("I'm so tired today"), 'Detects "tired"');
    assert(mentionsTiredness("feeling exhausted and drained"), 'Detects "exhausted" and "drained"');
    assert(mentionsTiredness("sleepy and burnt out"), 'Detects "sleepy" and "burnt out"');

    // 2.2 Tiredness Negation & False Positives
    assert(!mentionsTiredness("I'm not tired at all"), 'Negation: does not match "not tired"');
    assert(!mentionsTiredness("I don't feel tired"), 'Negation: does not match "don\'t feel tired"');
    assert(!mentionsTiredness("I never get tired of home food"), 'Negation: does not match "never get tired"');
    assert(!mentionsTiredness("I am retired and peaceful"), 'Word boundary: does not match "retired"');
    assert(!mentionsTiredness("She was attired in silk"), 'Word boundary: does not match "attired"');

    // 2.3 Ekman Mapping
    assert(getEkmanGroup('joy') === 'joy', 'Ekman: joy -> joy');
    assert(getEkmanGroup('admiration') === 'joy', 'Ekman: admiration -> joy');
    assert(getEkmanGroup('anger') === 'anger', 'Ekman: anger -> anger');
    assert(getEkmanGroup('disapproval') === 'anger', 'Ekman: disapproval -> anger');
    assert(getEkmanGroup('fear') === 'fear', 'Ekman: fear -> fear');
    assert(getEkmanGroup('sadness') === 'sadness', 'Ekman: sadness -> sadness');
    assert(getEkmanGroup('surprise') === 'surprise', 'Ekman: surprise -> surprise');
    assert(getEkmanGroup('neutral') === 'neutral', 'Ekman: neutral -> neutral');

    // 2.4 Culinary Mood Mapping
    assert(mapGoEmotionToCulinaryMood('joy') === 'energized', 'Culinary mood: joy -> energized');
    assert(mapGoEmotionToCulinaryMood('admiration') === 'joyful', 'Culinary mood: admiration -> joyful');
    assert(mapGoEmotionToCulinaryMood('anger') === 'calming', 'Culinary mood: anger -> calming');
    assert(mapGoEmotionToCulinaryMood('fear') === 'grounding', 'Culinary mood: fear -> grounding');
    assert(mapGoEmotionToCulinaryMood('sadness') === 'comforting', 'Culinary mood: sadness -> comforting');
    assert(mapGoEmotionToCulinaryMood('curiosity') === 'adventurous', 'Culinary mood: curiosity -> adventurous');
    assert(mapGoEmotionToCulinaryMood('desire') === 'craving', 'Culinary mood: desire -> craving');
    assert(mapGoEmotionToCulinaryMood('neutral') === 'balanced', 'Culinary mood: neutral -> balanced');
    assert(mapGoEmotionToCulinaryMood('tired') === 'restorative', 'Culinary mood: tired -> restorative');

    // 2.5 Taxonomy Integrity
    assert(CULINARY_MOODS.length === 9, 'Taxonomy includes all 9 culinary mood categories');
    assert(
        CULINARY_MOODS.every(mood => typeof CULINARY_MOOD_GUIDANCE[mood] === 'string' && CULINARY_MOOD_GUIDANCE[mood].length > 0),
        'All 9 culinary moods have defined non-medical cooking style descriptions'
    );

    console.log(`\n========================================`);
    console.log(`Total Unit Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
    console.log(`========================================\n`);

    if (failed > 0) {
        process.exit(1);
    }
}

runUnitTests().catch(err => {
    console.error('Unit tests failed with error:', err);
    process.exit(1);
});
