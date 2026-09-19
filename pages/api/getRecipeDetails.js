// pages/api/getRecipeDetails.js
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function callGemini(prompt) {
    const models = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.7-flash"];
    for (const modelName of models) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { temperature: 0.7 } });
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            const jsonString = responseText.replace(/```json|```/g, '').trim();
            return JSON.parse(jsonString);
        } catch (error) {
            console.warn(`Gemini (${modelName}) warning in getRecipeDetails:`, error.message);
        }
    }
    return null;
}

async function callOpenRouter(prompt) {
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` },
            body: JSON.stringify({ model: "anthropic/claude-3-haiku", messages: [{ "role": "user", "content": prompt }] })
        });
        if (!response.ok) throw new Error(`OpenRouter API failed`);
        const result = await response.json();
        return JSON.parse(result.choices[0].message.content.replace(/```json|```/g, '').trim());
    } catch (error) {
        console.error("OpenRouter API failed in getRecipeDetails:", error.message);
        return null;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { dishName, ingredients, mood, dietaryPreference } = req.body;
    if (!dishName) {
        return res.status(400).json({ message: 'dishName is required.' });
    }

    try {
        const dietaryConstraint = dietaryPreference === 'non-veg'
            ? 'Ensure this recipe is authentically NON-VEGETARIAN.'
            : 'Ensure this recipe is strictly 100% VEGETARIAN (no meat, eggs, fish).';

        const prompt = `You are an expert Indian culinary chef and food therapist. Provide a complete, step-by-step verified cooking guide for the dish: "${dishName}".
User's emotional state: "${mood || 'neutral'}".
User's available pantry ingredients: [${(ingredients || []).join(', ')}].
${dietaryConstraint}

Respond ONLY with a valid JSON object matching this exact structure:
{
  "dishName": "${dishName}",
  "dietaryType": "${dietaryPreference === 'non-veg' ? 'non-veg' : 'veg'}",
  "prepTime": "e.g. 10 mins",
  "cookTime": "e.g. 20 mins",
  "totalTime": "e.g. 30 mins",
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
  "chefTips": "Pro chef secret to maximize taste and texture...",
  "emotionalTherapy": "A short 1-2 sentence scientific or comfort note on why this warm dish soothes their current mood."
}`;

        // Run Gemini with fallback to Claude
        let recipeData = await callGemini(prompt);
        if (!recipeData) {
            recipeData = await callOpenRouter(prompt);
        }

        if (!recipeData) {
            throw new Error("Failed to generate recipe details from AI.");
        }

        res.status(200).json(recipeData);

    } catch (e) {
        console.error("Error in getRecipeDetails:", e);
        res.status(500).json({
            dishName: dishName,
            dietaryType: dietaryPreference || 'veg',
            prepTime: "10 mins",
            cookTime: "15 mins",
            totalTime: "25 mins",
            servings: "2 servings",
            difficulty: "Easy",
            ingredientsList: (ingredients || []).map(item => ({ item, amount: "As needed", isPantryItem: true })),
            instructions: [
                "Step 1: Prepare and chop all your fresh ingredients.",
                "Step 2: Heat oil or butter in a pan over medium heat and temper with whole spices.",
                "Step 3: Sauté aromatics and combine with your main ingredients.",
                "Step 4: Season to taste and simmer gently until thoroughly cooked.",
                "Step 5: Garnish and serve immediately with bread or rice."
            ],
            chefTips: "Always temper spices in warm oil first to unlock their aromatic essential oils.",
            emotionalTherapy: "Warm, freshly prepared home-cooked meals provide grounding comfort and elevate endorphins."
        });
    }
}
