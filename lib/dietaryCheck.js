// lib/dietaryCheck.js
// Deterministic non-LLM checks for dietary compliance and ingredient match signals (WP2.3)

export const NON_VEG_KEYWORDS = [
    'chicken', 'mutton', 'lamb', 'beef', 'pork', 'fish', 'prawn', 'prawns',
    'shrimp', 'shrimps', 'crab', 'seafood', 'bacon', 'keema', 'gosht',
    'murgh', 'machli', 'meat', 'ham', 'sausage', 'duck', 'turkey',
    'calamari', 'squid', 'anchovy', 'tuna', 'salmon', 'lobster', 'pork belly'
];

// Egg keywords handled specifically to avoid false positives on 'eggplant'
export const EGG_REGEX = /\b(egg|eggs|omelet|omelette|anda|ande)\b/i;

/**
 * Checks if a string contains any non-vegetarian keywords using word boundary matching.
 * @param {string} text 
 * @returns {{ hasNonVeg: boolean, matchedKeyword: string|null }}
 */
export function detectNonVegKeywords(text) {
    if (!text || typeof text !== 'string') return { hasNonVeg: false, matchedKeyword: null };

    const lower = text.toLowerCase();

    for (const kw of NON_VEG_KEYWORDS) {
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        if (regex.test(lower)) {
            return { hasNonVeg: true, matchedKeyword: kw };
        }
    }

    if (EGG_REGEX.test(lower)) {
        return { hasNonVeg: true, matchedKeyword: 'egg' };
    }

    return { hasNonVeg: false, matchedKeyword: null };
}

/**
 * Verifies that a recipe or choice adheres strictly to the user's dietary constraint.
 * @param {object} item - Recipe choice or full recipe details
 * @param {'veg'|'non-veg'|'all'} dietaryPreference
 * @returns {{ isCompliant: boolean, reason: string|null }}
 */
export function verifyDietaryCompliance(item, dietaryPreference) {
    if (!dietaryPreference || dietaryPreference === 'all') {
        return { isCompliant: true, reason: null };
    }

    const searchableText = [
        item.name || item.dishName || '',
        item.description || '',
        Array.isArray(item.instructions) ? item.instructions.join(' ') : '',
        Array.isArray(item.ingredientsList) 
            ? item.ingredientsList.map(i => (typeof i === 'string' ? i : i.item || '')).join(' ') 
            : ''
    ].join(' ');

    const { hasNonVeg, matchedKeyword } = detectNonVegKeywords(searchableText);

    if (dietaryPreference === 'veg') {
        if (hasNonVeg) {
            return {
                isCompliant: false,
                reason: `Vegetarian rule violated: contained non-veg keyword "${matchedKeyword}".`
            };
        }
        return { isCompliant: true, reason: null };
    }

    if (dietaryPreference === 'non-veg') {
        if (!hasNonVeg) {
            return {
                isCompliant: false,
                reason: `Non-vegetarian rule warning: did not contain identified meat/poultry/seafood keywords.`
            };
        }
        return { isCompliant: true, reason: null };
    }

    return { isCompliant: true, reason: null };
}

/**
 * Computes deterministic ingredient match score against user-listed pantry items.
 * @param {object} item - Recipe or choice
 * @param {string[]} userIngredients - Ingredients provided by the user
 * @returns {{ matchCount: number, matchRatio: number, matchedIngredients: string[] }}
 */
export function calculateIngredientMatch(item, userIngredients = []) {
    if (!Array.isArray(userIngredients) || userIngredients.length === 0) {
        return { matchCount: 0, matchRatio: 1, matchedIngredients: [] };
    }

    const searchableText = [
        item.name || item.dishName || '',
        item.description || '',
        Array.isArray(item.instructions) ? item.instructions.join(' ') : '',
        Array.isArray(item.ingredientsList) 
            ? item.ingredientsList.map(i => (typeof i === 'string' ? i : i.item || '')).join(' ') 
            : ''
    ].join(' ').toLowerCase();

    const matchedIngredients = [];

    for (const ing of userIngredients) {
        const cleanIng = ing.trim().toLowerCase();
        if (cleanIng.length > 1 && searchableText.includes(cleanIng)) {
            matchedIngredients.push(cleanIng);
        }
    }

    const matchCount = matchedIngredients.length;
    const matchRatio = matchCount / userIngredients.length;

    return { matchCount, matchRatio, matchedIngredients };
}
