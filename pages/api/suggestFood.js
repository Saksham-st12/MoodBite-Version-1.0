// pages/api/suggestFood.js (Using Gemini Flash)
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function getMood(userInput) {
    const emotionResponse = await fetch(
        "https://router.huggingface.co/hf-inference/models/SamLowe/roberta-base-go_emotions",
        {
            headers: { Authorization: `Bearer ${process.env.HUGGING_FACE_API_TOKEN}`, 'Content-Type': 'application/json' },
            method: "POST",
            body: JSON.stringify({ inputs: userInput }),
        }
    );
    if (!emotionResponse.ok) throw new Error("Hugging Face classifier failed.");
    const emotions = await emotionResponse.json();
    return emotions[0][0].label;
}

async function callGemini(prompt) {
    const models = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.7-flash"];
    for (const modelName of models) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { temperature: 0.8 } });
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            const jsonString = responseText.replace(/```json|```/g, '').trim();
            return JSON.parse(jsonString);
        } catch (error) {
            console.warn(`Gemini (${modelName}) warning:`, error.message);
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
        if (!response.ok) { const errorBody = await response.json(); throw new Error(`OpenRouter API failed: ${JSON.stringify(errorBody)}`); }
        const result = await response.json();
        return JSON.parse(result.choices[0].message.content);
    } catch (error) {
        console.error("OpenRouter API failed:", error.message);
        return null;
    }
}

export default async function handler(req, res) {
    const { text: userInput, ingredients, dietaryPreference } = req.body;
    if (!userInput) return res.status(400).json({ message: 'User input is required.' });

    try {
        const predictedMood = await getMood(userInput);
        const varietyInstruction = `CRITICAL INSTRUCTION: You MUST suggest a different and creative dish each time. Do not repeat previous suggestions. For positive moods like 'joy' or 'excitement', prioritize suggesting a savory celebratory meal.`;
        
        let dietaryInstruction = "";
        if (dietaryPreference === 'veg') {
            dietaryInstruction = `CRITICAL DIETARY INSTRUCTION: The user strictly requires a VEGETARIAN dish. You MUST ONLY suggest a 100% vegetarian Indian meal (plant-based, paneer, lentils, dairy, or vegetables). Absolutely NO meat, chicken, mutton, fish, seafood, or eggs. Set the "dietaryType" key to "veg".`;
        } else if (dietaryPreference === 'non-veg') {
            dietaryInstruction = `CRITICAL DIETARY INSTRUCTION: The user strictly requires a NON-VEGETARIAN dish. You MUST suggest an authentic Indian non-vegetarian meal (chicken, mutton, fish, prawn/seafood, or egg-based dish). Absolutely DO NOT suggest a pure vegetarian dish. Set the "dietaryType" key to "non-veg".`;
        } else {
            dietaryInstruction = `DIETARY INSTRUCTION: The user has no strict preference (can be vegetarian or non-vegetarian). Set the "dietaryType" key accurately to either "veg" or "non-veg" depending on what you suggest.`;
        }

        const keysInstruction = `Respond ONLY with a JSON object with these exact keys: "predictedMood", "dietaryType", "summary", "suggestedFood", "reason", "confidenceScore", "choices". "predictedMood" should be "${predictedMood}". "dietaryType" must be either "veg" or "non-veg". "confidenceScore" must be an INTEGER between 80 and 95. "choices" must be an ARRAY of 4 to 5 distinct dish objects. Each choice object MUST have: "id" (string "1" to "5"), "name" (exact dish name), "description" (1-2 sentence appetizing description), "cookTime" (e.g. "15 mins", "25 mins"), "difficulty" ("Easy" | "Medium" | "Quick"), "dietaryType" ("veg" | "non-veg"), "matchReason" (how it uses their ingredients or helps their mood). Set "suggestedFood" to choices[0].name and "reason" to choices[0].description.`;

        let prompt;
        if (ingredients && ingredients.length > 0) {
            prompt = `The user is feeling: "${predictedMood}". The user has these available ingredients: [${ingredients.join(', ')}]. User input: "${userInput}". Based on this mood and these available ingredients, suggest 4 to 5 distinct, creative Indian meals they can cook. ${dietaryInstruction} ${varietyInstruction} ${keysInstruction}`;
        } else {
            prompt = `The user is feeling: "${predictedMood}". User input: "${userInput}". If the user mentioned any ingredients, prioritize them. Suggest 4 to 5 distinct, creative and appropriate Indian meals for this mood. ${dietaryInstruction} ${varietyInstruction} ${keysInstruction}`;
        }

        console.log("Starting 2-way AI competition between Gemini and OpenRouter...");
        const [geminiResult, openRouterResult] = await Promise.allSettled([
            callGemini(prompt),
            callOpenRouter(prompt)
        ]);

        const successfulResponses = [];
        if (geminiResult.status === 'fulfilled' && geminiResult.value) {
            successfulResponses.push({ ...geminiResult.value, source: 'Gemini' });
        }
        if (openRouterResult.status === 'fulfilled' && openRouterResult.value) {
            successfulResponses.push({ ...openRouterResult.value, source: 'Claude 3 Haiku' });
        }

        if (successfulResponses.length === 0) {
            throw new Error("All AI models failed to provide a valid response.");
        }

        successfulResponses.sort((a, b) => b.confidenceScore - a.confidenceScore);
        const winner = successfulResponses[0];
        
        console.log(`Competition finished. Winner is ${winner.source} with score ${winner.confidenceScore}`);
        
        const finalDietaryType = winner.dietaryType || (dietaryPreference === 'non-veg' ? 'non-veg' : 'veg');
        const finalResponse = { ...winner, predictedMood: predictedMood, dietaryType: finalDietaryType };
        res.status(200).json(finalResponse);

    } catch (e) {
        console.error("----------- DETAILED ERROR -----------", e);
        res.status(500).json({
            predictedMood: "Error",
            suggestedFood: "Request Failed",
            dietaryType: dietaryPreference === 'non-veg' ? 'non-veg' : 'veg',
            reason: "Sorry, the AI assistants failed to respond. Please try again in a moment.",
            confidenceScore: 0
        });
    }
}