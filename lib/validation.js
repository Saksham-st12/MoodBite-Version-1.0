// lib/validation.js
// Zod schemas for validating request inputs (WP1.2) and LLM outputs (WP1.3)
import { z } from 'zod';

// ==========================================
// 1. Request Input Schemas (WP1.2)
// Compatible with Zod 3 and Zod 4 (.issues)
// ==========================================

export const suggestFoodInputSchema = z.object({
    text: z.string({
        message: 'Text prompt describing your mood or ingredients is required.'
    })
    .trim()
    .min(1, 'Input text cannot be empty.')
    .max(500, 'Input text must not exceed 500 characters.'),
    
    ingredients: z.array(
        z.string().trim().min(1, 'Ingredient cannot be empty.').max(50, 'Ingredient name too long.')
    )
    .max(25, 'Maximum 25 ingredients allowed.')
    .optional()
    .default([]),
    
    dietaryPreference: z.enum(['veg', 'non-veg', 'all'], {
        message: 'Dietary preference must be "veg", "non-veg", or "all".'
    })
    .optional()
    .default('veg')
});

export const getRecipeDetailsInputSchema = z.object({
    dishName: z.string({
        message: 'dishName is required.'
    })
    .trim()
    .min(2, 'Dish name must be at least 2 characters.')
    .max(100, 'Dish name must not exceed 100 characters.'),
    
    ingredients: z.array(
        z.string().trim().max(50)
    )
    .max(25)
    .optional()
    .default([]),
    
    mood: z.string().trim().max(50).optional().default('neutral'),
    
    dietaryPreference: z.enum(['veg', 'non-veg', 'all']).optional().default('veg'),
    
    dishDietaryType: z.enum(['veg', 'non-veg']).optional()
});

export const generateFoodImageInputSchema = z.object({
    foodName: z.string({
        message: 'foodName query parameter is required.'
    })
    .trim()
    .min(2, 'foodName must be at least 2 characters.')
    .max(100, 'foodName must not exceed 100 characters.')
});

export const ALLOWED_IMAGE_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif'
];

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// ==========================================
// 2. LLM Output Schemas (WP1.3 & WP2.1)
// ==========================================

const recipeChoiceSchema = z.object({
    id: z.coerce.string().default('1'),
    name: z.string().min(1),
    description: z.string().min(1),
    cookTime: z.string().default('20 mins'),
    difficulty: z.string().default('Medium'),
    dietaryType: z.enum(['veg', 'non-veg']).default('veg'),
    matchReason: z.string().default('Culinary pairing tailored to your preferences.')
});

export const suggestFoodOutputSchema = z.object({
    predictedMood: z.string().min(1),
    culinaryMood: z.string().optional(),
    detectedEmotion: z.string().nullable().optional(),
    emotionScore: z.number().nullable().optional(),
    dietaryType: z.enum(['veg', 'non-veg']).default('veg'),
    summary: z.string().optional().default(''),
    suggestedFood: z.string().min(1),
    reason: z.string().min(1),
    choices: z.array(recipeChoiceSchema).min(1).max(6).default([])
});

const ingredientItemSchema = z.object({
    item: z.string().min(1),
    amount: z.string().default('As needed'),
    isPantryItem: z.boolean().optional().default(true)
});

export const recipeDetailsOutputSchema = z.object({
    dishName: z.string().min(1),
    dietaryType: z.enum(['veg', 'non-veg']).default('veg'),
    prepTime: z.string().default('10 mins'),
    cookTime: z.string().default('20 mins'),
    totalTime: z.string().optional().default('30 mins'),
    servings: z.string().default('2 servings'),
    difficulty: z.string().default('Easy'),
    ingredientsList: z.array(ingredientItemSchema).min(1).default([]),
    instructions: z.array(z.string().min(1)).min(1).default([]),
    chefTips: z.string().default('Simmer gently to lock in aromatic flavors.'),
    culinaryComfort: z.string().default('Comfort food prepared with balanced, wholesome ingredients.'),
    isFallback: z.boolean().optional().default(false),
    fallbackNotice: z.string().optional(),
    ingredientMatch: z.object({
        matchCount: z.number(),
        matchRatio: z.number(),
        matchedIngredients: z.array(z.string())
    }).nullable().optional()
});
