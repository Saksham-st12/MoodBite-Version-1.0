// pages/api/getRecipeDetails.js
// Hardened with Zod validation, timeouts, rate limiting, and dietary verification (WP1 & WP2)
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getRecipeDetailsInputSchema, recipeDetailsOutputSchema } from '../../lib/validation';
import { applyRateLimit } from '../../lib/rateLimit';
import { verifyDietaryCompliance } from '../../lib/dietaryCheck';

const AI_TIMEOUT_MS = 8000;

function parseJsonFromMarkdown(text) {
    if (!text || typeof text !== 'string') return null;
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    try {
        return JSON.parse(cleaned);
    } catch {
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start !== -1 && end > start) {
            try {
                return JSON.parse(cleaned.substring(start, end + 1));
            } catch {
                return null;
            }
        }
        return null;
    }
}

async function callGeminiRecipe(prompt, modelName = "gemini-3.5-flash-lite") {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return null;

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { temperature: 0.6 }
        });

        const generatePromise = model.generateContent(prompt);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Gemini recipe (${modelName}) timed out`)), AI_TIMEOUT_MS);
        });

        const result = await Promise.race([generatePromise, timeoutPromise]);
        const text = result.response.text();
        return parseJsonFromMarkdown(text);
    } catch (err) {
        console.warn(`Gemini recipe (${modelName}) error:`, err.message);
        return null;
    }
}

async function callClaudeRecipe(prompt) {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "anthropic/claude-3-haiku",
                messages: [{ role: "user", content: prompt }]
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) return null;
        const result = await response.json();
        const content = result.choices?.[0]?.message?.content;
        return parseJsonFromMarkdown(content);
    } catch (err) {
        clearTimeout(timeoutId);
        console.warn("Claude recipe fallback failed:", err.message);
        return null;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: 'Method Not Allowed. Use POST.' });
    }

    // WP1.5: Rate Limiting
    if (applyRateLimit(req, res, { maxRequests: 25, windowMs: 60000 })) {
        return;
    }

    // WP1.2: Validate Request Inputs
    const validationResult = getRecipeDetailsInputSchema.safeParse(req.body);
    if (!validationResult.success) {
        return res.status(400).json({
            message: 'Invalid request input.',
            errors: validationResult.error.errors.map(e => e.message)
        });
    }

    const { dishName, ingredients, mood, dietaryPreference } = validationResult.data;

    try {
        const dietaryConstraint = dietaryPreference === 'non-veg'
            ? 'Ensure this recipe is authentically NON-VEGETARIAN with poultry/meat/fish/eggs.'
            : 'Ensure this recipe is strictly 100% VEGETARIAN (absolutely no meat, chicken, mutton, fish, or eggs).';

        const prompt = `You are an expert Indian culinary chef and food therapist. Provide a verified, step-by-step cooking guide for: "${dishName}".
User's emotional state: "${mood}".
User's available ingredients: [${(ingredients || []).join(', ')}].
${dietaryConstraint}

Respond ONLY with a valid JSON object matching this exact schema:
{
  "dishName": "${dishName}",
  "dietaryType": "${dietaryPreference === 'non-veg' ? 'non-veg' : 'veg'}",
  "prepTime": "10 mins",
  "cookTime": "20 mins",
  "totalTime": "30 mins",
  "servings": "2 servings",
  "difficulty": "Easy",
  "ingredientsList": [
    { "item": "Ingredient Name", "amount": "e.g. 200g / 1 tsp", "isPantryItem": true }
  ],
  "instructions": [
    "Step 1: Description of preparation...",
    "Step 2: Description of cooking...",
    "Step 3: Description of simmering..."
  ],
  "chefTips": "Pro chef secret to maximize taste...",
  "emotionalTherapy": "1-2 sentence scientific or comfort note on why this dish soothes their mood."
}`;

        // WP1.4: Primary (Gemini 3.5 Flash Lite) -> Secondary (Gemini 3.5 Flash) -> Fallback (Claude)
        let rawRecipe = await callGeminiRecipe(prompt, 'gemini-3.5-flash-lite');

        if (!rawRecipe) {
            console.log("Gemini Flash Lite failed. Trying gemini-3.5-flash...");
            rawRecipe = await callGeminiRecipe(prompt, 'gemini-3.5-flash');
        }

        if (!rawRecipe) {
            console.log("Gemini recipe family failed. Falling back to Claude Haiku...");
            rawRecipe = await callClaudeRecipe(prompt);
        }

        // WP1.3: Validate output against Zod schema
        let validatedRecipe = null;
        if (rawRecipe) {
            const parsed = recipeDetailsOutputSchema.safeParse(rawRecipe);
            if (parsed.success) {
                validatedRecipe = parsed.data;
            } else {
                console.warn("Recipe details failed Zod schema:", parsed.error.format());
            }
        }

        // WP2.3: Deterministic dietary compliance verification
        if (validatedRecipe && dietaryPreference !== 'all') {
            const compliance = verifyDietaryCompliance(validatedRecipe, dietaryPreference);
            if (!compliance.isCompliant) {
                console.warn("Recipe failed deterministic dietary compliance check:", compliance.reason);
                validatedRecipe = null; // Revert to guaranteed safe fallback
            }
        }

        // Guaranteed fallback if AI models or schema validation failed
        if (!validatedRecipe) {
            console.log("Serving guaranteed safe fallback recipe for:", dishName);
            const isNonVeg = dietaryPreference === 'non-veg';
            validatedRecipe = {
                dishName: dishName,
                dietaryType: isNonVeg ? 'non-veg' : 'veg',
                prepTime: "10 mins",
                cookTime: "20 mins",
                totalTime: "30 mins",
                servings: "2 servings",
                difficulty: "Easy",
                ingredientsList: (ingredients && ingredients.length > 0)
                    ? ingredients.map(item => ({ item, amount: "As needed", isPantryItem: true }))
                    : [
                        { item: isNonVeg ? "Chicken / Eggs" : "Paneer / Mixed Vegetables", amount: "250g", isPantryItem: true },
                        { item: "Onion & Tomato", amount: "1 each, finely chopped", isPantryItem: true },
                        { item: "Ginger-Garlic Paste", amount: "1 tsp", isPantryItem: true },
                        { item: "Cumin & Garam Masala", amount: "1/2 tsp each", isPantryItem: true },
                        { item: "Cooking Oil / Ghee", amount: "1 tbsp", isPantryItem: true }
                    ],
                instructions: [
                    "Step 1: Prep and chop all aromatics and primary ingredients into uniform pieces.",
                    "Step 2: Heat cooking oil or ghee in a heavy-bottomed skillet over medium heat.",
                    "Step 3: Add cumin seeds and sauté ginger-garlic paste with onions until translucent and fragrant.",
                    "Step 4: Add tomatoes, ground spices, and salt; cook until oil begins to separate from the masala.",
                    "Step 5: Add main ingredients and simmer gently on low heat until thoroughly cooked and tender.",
                    "Step 6: Garnish with freshly chopped coriander leaves and serve warm."
                ],
                chefTips: "Always roast whole spices gently before adding liquids to release their essential oils.",
                emotionalTherapy: "Warm comfort food with grounding spices stimulates endorphin release and restores vitality."
            };
        }

        return res.status(200).json(validatedRecipe);

    } catch (error) {
        console.error("Critical error in /api/getRecipeDetails:", error);
        return res.status(500).json({
            message: "Unable to retrieve recipe details at this time. Please try again shortly."
        });
    }
}
