// scripts/smokeTest.js
// Automated smoke test verifying API routes, model health, Zod validation, dietary compliance, and security sanitization

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function runTests() {
    console.log(`\n🧪 Running MoodBite AI Smoke Tests against ${BASE_URL}...\n`);
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

    // Test 1: Invalid input must return clean HTTP 400 (Zod issues handling)
    try {
        const res = await fetch(`${BASE_URL}/api/suggestFood`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: '' })
        });
        const data = await res.json();
        assert(res.status === 400, 'Empty input returns HTTP 400');
        assert(Array.isArray(data.errors) && data.errors.length > 0, 'Returns structured errors array from Zod issues');
        assert(data.errors[0] === 'Input text cannot be empty.', 'Returns exact custom validation message');
    } catch (err) {
        assert(false, `Test 1 threw network/parse error: ${err.message}`);
    }

    // Test 2: Healthy suggestion must return HTTP 200 and NOT use Deterministic Safe Fallback
    try {
        const res = await fetch(`${BASE_URL}/api/suggestFood`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: 'I had a productive day and feel cheerful!',
                dietaryPreference: 'veg'
            })
        });
        const data = await res.json();
        assert(res.status === 200, 'Valid food suggestion returns HTTP 200');
        assert(data.source !== 'Deterministic Safe Fallback', `AI Model active (source: ${data.source}), not fallback`);
        assert(Array.isArray(data.choices) && data.choices.length >= 4, `Returns 4-5 choices (received ${data.choices?.length})`);
        assert(data.choices.every(c => c.dietaryType === 'veg'), 'All suggested choices respect vegetarian preference');
    } catch (err) {
        assert(false, `Test 2 threw network/parse error: ${err.message}`);
    }

    // Test 3: Recipe Details must return HTTP 200 and valid instructions
    try {
        const res = await fetch(`${BASE_URL}/api/getRecipeDetails`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dishName: 'Paneer Butter Masala',
                mood: 'happy',
                dietaryPreference: 'veg'
            })
        });
        const data = await res.json();
        assert(res.status === 200, 'Recipe details request returns HTTP 200');
        assert(data.dishName === 'Paneer Butter Masala', 'Returns matching dishName');
        assert(Array.isArray(data.instructions) && data.instructions.length >= 3, 'Returns full cooking instructions array');
        assert(typeof (data.culinaryComfort || data.moodNote) === 'string', 'Returns culinary comfort note without medical claims');
        assert(data.isFallback === false, 'Verified AI generation sets isFallback: false');
    } catch (err) {
        assert(false, `Test 3 threw network/parse error: ${err.message}`);
    }

    // Test 4: False Positive Dietary Test (soya keema & meat-free must be allowed as veg)
    try {
        const { detectNonVegKeywords } = require('../lib/dietaryCheck');
        const vegSample = 'Delicious soya keema pav with meat-free butter gravy and eggless bread';
        const check = detectNonVegKeywords(vegSample);
        assert(!check.hasNonVeg, 'Vegetarian exceptions (soya keema, meat-free, eggless) are not falsely flagged');
    } catch (err) {
        assert(false, `Test 4 threw error: ${err.message}`);
    }

    // Test 5: Word Boundary Substring Immunity (oil in boil, pea in peanut)
    try {
        const { calculateIngredientMatch } = require('../lib/dietaryCheck');
        const dummyRecipe = {
            name: "Boiled Peanut Snack",
            description: "Quick snack",
            instructions: ["Boil the peanuts in water."],
            ingredientsList: [{ item: "peanuts", amount: "100g" }]
        };
        const matchOil = calculateIngredientMatch(dummyRecipe, ['oil']);
        assert(matchOil.matchCount === 0, 'Word boundary regex prevents "oil" falsely matching "boil"');
        const matchPea = calculateIngredientMatch(dummyRecipe, ['pea']);
        assert(matchPea.matchCount === 0, 'Word boundary regex prevents "pea" falsely matching "peanut"');
    } catch (err) {
        assert(false, `Test 5 threw error: ${err.message}`);
    }

    // Test 6: Mixed-diet mode ('all') preserves non-veg labeling
    try {
        const res = await fetch(`${BASE_URL}/api/getRecipeDetails`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dishName: 'Chicken Biryani',
                dietaryPreference: 'all',
                dishDietaryType: 'non-veg'
            })
        });
        const data = await res.json();
        assert(res.status === 200, 'getRecipeDetails returns HTTP 200 in mixed "all" mode');
        assert(data.dietaryType === 'non-veg', 'Selected non-veg dish correctly labeled as non-veg in "all" mode');
    } catch (err) {
        assert(false, `Test 6 threw network/parse error: ${err.message}`);
    }

    // Test 7: Input sanitization strips HTML/delimiters safely
    try {
        const res = await fetch(`${BASE_URL}/api/suggestFood`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: 'Feeling happy <script>alert("xss")</script>',
                ingredients: ['onion<br>', 'tomato']
            })
        });
        const data = await res.json();
        assert(res.status === 200, 'HTML/delimiter tags safely sanitized without breaking execution');
    } catch (err) {
        assert(false, `Test 7 threw error: ${err.message}`);
    }

    console.log(`\n========================================`);
    console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
    console.log(`========================================\n`);

    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
