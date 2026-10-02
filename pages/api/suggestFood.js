// pages/api/suggestFood.js
// Hardened with Zod validation, deterministic model hierarchy, rate limiting, and dietary verification (WP1 & WP2)
import { GoogleGenerativeAI } from '@google/generative-ai';
import { suggestFoodInputSchema, suggestFoodOutputSchema } from '../../lib/validation';
import { applyRateLimit } from '../../lib/rateLimit';
import { verifyDietaryCompliance, calculateIngredientMatch } from '../../lib/dietaryCheck';

const HF_ROBERTA_URL = "https://router.huggingface.co/hf-inference/models/SamLowe/roberta-base-go_emotions";
const AI_TIMEOUT_MS = 10000;

// Safe JSON parser from LLM markdown code blocks
function parseJsonFromMarkdown(text) {
    if (!text || typeof text !== 'string') return null;
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    try {
        return JSON.parse(cleaned);
    } catch {
        // Attempt to extract the first balanced JSON object if extra text exists
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

// Emotion classification via RoBERTa GoEmotions with timeout and graceful fallback
async function getMood(userInput) {
    const token = process.env.HUGGING_FACE_API_TOKEN?.trim();
    if (!token) {
        console.warn("HUGGING_FACE_API_TOKEN is missing. Defaulting mood to 'neutral'.");
        return 'neutral';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
        const response = await fetch(HF_ROBERTA_URL, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            method: 'POST',
            body: JSON.stringify({ inputs: userInput }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn(`HuggingFace emotion API returned HTTP ${response.status}`);
            return 'neutral';
        }

        const data = await response.json();
        if (Array.isArray(data) && Array.isArray(data[0]) && data[0][0]?.label) {
            return data[0][0].label;
        }
        return 'neutral';
    } catch (err) {
        clearTimeout(timeoutId);
        console.warn('RoBERTa emotion classifier error/timeout:', err.message);
        return 'neutral';
    }
}

// Primary Model: Google Gemini
async function callGeminiWithTimeout(prompt, modelName = "gemini-3.5-flash") {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return null;

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { temperature: 0.7 }
        });

        const generatePromise = model.generateContent(prompt);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Gemini (${modelName}) timed out`)), AI_TIMEOUT_MS);
        });

        const result = await Promise.race([generatePromise, timeoutPromise]);
        const text = result.response.text();
        return parseJsonFromMarkdown(text);
    } catch (err) {
        console.warn(`Gemini (${modelName}) failed:`, err.message);
        return null;
    }
}

// Fallback Model: Anthropic Claude 3 Haiku via OpenRouter
async function callClaudeWithTimeout(prompt) {
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
        console.warn("Claude fallback via OpenRouter failed:", err.message);
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
    const validationResult = suggestFoodInputSchema.safeParse(req.body);
    if (!validationResult.success) {
        return res.status(400).json({
            message: 'Invalid request input.',
            errors: validationResult.error.errors.map(e => e.message)
        });
    }

    const { text: userInput, ingredients, dietaryPreference } = validationResult.data;

    try {
        // Step 1: Detect Emotion
        const predictedMood = await getMood(userInput);

        // Step 2: Build Strict Prompt Instructions
        let dietaryInstruction = "";
        if (dietaryPreference === 'veg') {
            dietaryInstruction = `CRITICAL DIETARY INSTRUCTION: The user strictly requires a VEGETARIAN dish. You MUST ONLY suggest 100% vegetarian Indian meals (plant-based, paneer, lentils, dairy, vegetables). Absolutely NO meat, chicken, mutton, fish, seafood, or eggs. Set "dietaryType" to "veg".`;
        } else if (dietaryPreference === 'non-veg') {
            dietaryInstruction = `CRITICAL DIETARY INSTRUCTION: The user strictly requires a NON-VEGETARIAN dish. You MUST suggest authentic Indian non-vegetarian meals (chicken, mutton, fish, prawn, or egg-based dish). Absolutely DO NOT suggest a pure vegetarian dish. Set "dietaryType" to "non-veg".`;
        } else {
            dietaryInstruction = `DIETARY INSTRUCTION: The user has no strict preference (can be vegetarian or non-vegetarian). Set "dietaryType" accurately to either "veg" or "non-veg".`;
        }

        const hasIngredients = Array.isArray(ingredients) && ingredients.length > 0;

        // WP2.1: Renamed from confidenceScore to llmSelfRating in system prompt
        const summaryGuidance = hasIngredients
            ? `"Here are 4 dishes you can cook using your available ingredients to lift your ${predictedMood} mood"`
            : `"Here are 4 comforting Indian dishes to match and soothe your ${predictedMood} mood"`;

        const matchReasonGuidance = hasIngredients
            ? `How it utilizes their available ingredients to elevate their mood`
            : `Scientific or culinary rationale on why this dish soothes their ${predictedMood} mood`;

        const schemaInstruction = `Respond ONLY with a valid JSON object matching these exact keys:
{
  "predictedMood": "${predictedMood}",
  "dietaryType": "${dietaryPreference === 'non-veg' ? 'non-veg' : 'veg'}",
  "summary": ${JSON.stringify(summaryGuidance)},
  "suggestedFood": "Exact name of top choice",
  "reason": "1-2 sentence appetizing reason",
  "llmSelfRating": 88,
  "choices": [
    {
      "id": "1",
      "name": "Exact Dish Name",
      "description": "Appetizing description",
      "cookTime": "20 mins",
      "difficulty": "Easy",
      "dietaryType": "${dietaryPreference === 'non-veg' ? 'non-veg' : 'veg'}",
      "matchReason": "${matchReasonGuidance}"
    }
  ]
}
Note: "llmSelfRating" must be an integer between 80 and 95. "choices" must contain 4 to 5 distinct Indian dishes.`;

        let prompt;
        if (hasIngredients) {
            prompt = `The user is feeling: "${predictedMood}". The user has these available ingredients in their kitchen: [${ingredients.join(', ')}]. User input: "${userInput}". Based on this mood and these available ingredients, suggest 4 to 5 distinct, creative Indian meals they can cook. ${dietaryInstruction} ${schemaInstruction}`;
        } else {
            prompt = `The user is feeling: "${predictedMood}". User input: "${userInput}". CRITICAL INSTRUCTION: The user provided NO kitchen ingredients (this is a pure mood-based request). Do NOT mention 'your ingredients' or 'pantry ingredients' anywhere in the summary, descriptions, or matchReason. Suggest 4 to 5 distinct, culturally authentic Indian comfort dishes specifically tailored to soothe, comfort, or elevate someone feeling "${predictedMood}". ${dietaryInstruction} ${schemaInstruction}`;
        }

        // WP2.2: Documented Deterministic Model Hierarchy
        // Rule: 1. Try Primary (Gemini 3.5 Flash) -> 2. Try Secondary (Gemini Flash Lite) -> 3. Fallback (Claude Haiku)
        let rawCandidate = null;
        let selectedSource = 'Gemini 3.5 Flash';

        // 1. Primary: Gemini 3.5 Flash
        rawCandidate = await callGeminiWithTimeout(prompt, 'gemini-3.5-flash');

        // 2. Retry with Gemini 3.5 Flash Lite if primary failed
        if (!rawCandidate) {
            console.log("Gemini primary failed. Retrying with gemini-3.5-flash-lite...");
            rawCandidate = await callGeminiWithTimeout(prompt, 'gemini-3.5-flash-lite');
            selectedSource = 'Gemini 3.5 Flash Lite';
        }

        // 3. Fallback: Claude 3 Haiku via OpenRouter
        if (!rawCandidate) {
            console.log("Gemini family failed. Falling back to Claude 3 Haiku...");
            rawCandidate = await callClaudeWithTimeout(prompt);
            selectedSource = 'Claude 3 Haiku';
        }

        // WP1.3: Validate LLM output against Zod schema
        let validatedOutput = null;
        if (rawCandidate) {
            const parseResult = suggestFoodOutputSchema.safeParse(rawCandidate);
            if (parseResult.success) {
                validatedOutput = parseResult.data;
            } else {
                console.warn("LLM returned malformed schema:", parseResult.error.format());
            }
        }

        // WP2.3: Deterministic checks (Dietary Compliance & Ingredient Occurrence)
        if (validatedOutput) {
            // Verify dietary compliance for each choice
            if (dietaryPreference !== 'all') {
                validatedOutput.choices = validatedOutput.choices.filter(choice => {
                    const check = verifyDietaryCompliance(choice, dietaryPreference);
                    if (!check.isCompliant) {
                        console.warn(`Filtering out non-compliant choice: "${choice.name}":`, check.reason);
                        return false;
                    }
                    return true;
                });
            }

            // Calculate deterministic ingredient matches
            if (ingredients && ingredients.length > 0) {
                validatedOutput.choices = validatedOutput.choices.map(choice => {
                    const matchStats = calculateIngredientMatch(choice, ingredients);
                    return {
                        ...choice,
                        ingredientMatchCount: matchStats.matchCount,
                        ingredientMatchRatio: Number(matchStats.matchRatio.toFixed(2))
                    };
                });
            }

            // If all choices were filtered out due to dietary violations, invalidate to trigger safe fallback
            if (validatedOutput.choices.length === 0) {
                console.warn("All choices failed dietary compliance check. Reverting to safe fallback.");
                validatedOutput = null;
            }
        }

        // If models failed or output failed validation, use graceful structured fallback
        if (!validatedOutput) {
            console.log("Using guaranteed structured fallback response.");
            const fallbackDish = dietaryPreference === 'non-veg'
                ? { name: "Comforting Murgh Khichdi", desc: "A nourishing, fragrant chicken and rice broth with gentle spices.", time: "25 mins" }
                : { name: "Moong Dal Comfort Khichdi", desc: "A soothing, protein-rich lentil and rice pot with golden cumin ghee.", time: "20 mins" };

            validatedOutput = {
                predictedMood: predictedMood || "tired",
                dietaryType: dietaryPreference === 'non-veg' ? 'non-veg' : 'veg',
                summary: hasIngredients
                    ? "Here are comforting dishes you can make using your available ingredients."
                    : `Here are comforting dishes formulated to soothe and elevate your ${predictedMood} mood.`,
                suggestedFood: fallbackDish.name,
                reason: fallbackDish.desc,
                llmSelfRating: 85,
                confidenceScore: 85,
                choices: [
                    {
                        id: "1",
                        name: fallbackDish.name,
                        description: fallbackDish.desc,
                        cookTime: fallbackDish.time,
                        difficulty: "Easy",
                        dietaryType: dietaryPreference === 'non-veg' ? 'non-veg' : 'veg',
                        matchReason: `Soothing comfort meal designed to comfort your ${predictedMood} mood.`
                    },
                    {
                        id: "2",
                        name: dietaryPreference === 'non-veg' ? "Quick Egg Bhurji Roll" : "Paneer Capsicum Tawa Stir-Fry",
                        description: "Quick high-protein meal ready in minutes.",
                        cookTime: "15 mins",
                        difficulty: "Quick",
                        dietaryType: dietaryPreference === 'non-veg' ? 'non-veg' : 'veg',
                        matchReason: "Requires minimal effort while providing deep satiety."
                    }
                ]
            };
            selectedSource = 'Deterministic Safe Fallback';
        }

        // Clean up any hallucinated ingredient mentions when no ingredients were provided
        if (!hasIngredients) {
            if (validatedOutput.summary) {
                validatedOutput.summary = validatedOutput.summary
                    .replace(/with (your|available|these) ingredients/gi, 'for your mood')
                    .replace(/using (your|available|these) ingredients/gi, 'tailored to your mood')
                    .replace(/tailored to your ingredients and mood/gi, 'tailored to your mood');
            }
            validatedOutput.choices = validatedOutput.choices.map(choice => ({
                ...choice,
                matchReason: (choice.matchReason || '')
                    .replace(/with (your|available|these) ingredients/gi, 'for your mood')
                    .replace(/using (your|available|these) ingredients/gi, 'to elevate your mood')
                    .replace(/uses your pantry ingredients/gi, 'matches your emotional state')
            }));
        }

        validatedOutput.hasUserIngredients = hasIngredients;

        // Ensure top suggestion matches top choice
        if (validatedOutput.choices.length > 0) {
            validatedOutput.suggestedFood = validatedOutput.choices[0].name;
            validatedOutput.reason = validatedOutput.choices[0].description;
        }

        return res.status(200).json({
            ...validatedOutput,
            source: selectedSource
        });

    } catch (error) {
        console.error("Critical error in /api/suggestFood:", error);
        return res.status(500).json({
            predictedMood: "Error",
            suggestedFood: "Request Failed",
            dietaryType: dietaryPreference === 'non-veg' ? 'non-veg' : 'veg',
            reason: "The AI recommendation service is temporarily unavailable. Please try again in a few moments.",
            llmSelfRating: 0,
            confidenceScore: 0,
            choices: []
        });
    }
}