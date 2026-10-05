// components/RecipeChoicesCard.js
import React from 'react';
import { motion } from 'framer-motion';
import DishFeedback from './DishFeedback';

export default function RecipeChoicesCard({ response, onSelectRecipe }) {
    const { 
        predictedMood, 
        culinaryMood,
        detectedEmotion,
        emotionScore,
        choices = [], 
        summary, 
        dietaryType, 
        hasUserIngredients,
        ignoredIngredients = [],
        source 
    } = response;

    const foodMood = culinaryMood || predictedMood || 'balanced';
    const showEmotion = detectedEmotion && detectedEmotion !== foodMood;

    // Determine whether user supplied ingredients
    const hasIngredients = Boolean(hasUserIngredients) || choices.some(c => typeof c.ingredientMatchCount === 'number' && c.ingredientMatchCount > 0);

    const defaultSummary = hasIngredients
        ? `Here are ${choices.length || 4} chef-crafted dishes tailored to your ingredients and mood:`
        : `Here are ${choices.length || 4} comforting dishes tailored to your ${foodMood} food mood:`;

    const displaySummary = (!hasIngredients && summary)
        ? summary
            .replace(/with (your|available|these) ingredients/gi, 'for your mood')
            .replace(/using (your|available|these) ingredients/gi, 'tailored to your mood')
            .replace(/tailored to your ingredients and mood/gi, 'tailored to your mood')
        : (summary || defaultSummary);

    return (
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full max-w-2xl space-y-4 shadow-2xl backdrop-blur-xl">
            {/* Header: Emotion Journey & Culinary Mood */}
            <div className="pb-3 border-b border-white/10 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                    {showEmotion && (
                        <>
                            <span className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-400 font-semibold">
                                Detected emotion
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 capitalize">
                                {detectedEmotion}{emotionScore ? ` (${Math.round(emotionScore * 100)}%)` : ''}
                            </span>
                            <span className="text-xs text-gray-500">→</span>
                        </>
                    )}

                    <span className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-400 font-semibold">
                        Food mood
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 capitalize">
                        {foodMood}
                    </span>

                    {source && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10 ml-auto hidden sm:inline-block">
                            {source}
                        </span>
                    )}
                </div>

                <p className="text-xs sm:text-sm text-gray-200 font-medium leading-relaxed">
                    {displaySummary}
                </p>

                {ignoredIngredients.length > 0 && (
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-2">
                        <span>⚠️</span>
                        <span>Skipped non-veg items in Veg mode: <strong>{ignoredIngredients.join(', ')}</strong>. Switch to Non-Veg to utilize them.</span>
                    </div>
                )}
            </div>

            {/* Recipe Choices Grid */}
            <div className="grid grid-cols-1 gap-3 pt-1">
                {choices.map((choice, index) => {
                    const isVeg = (choice.dietaryType || dietaryType || 'veg').toLowerCase() === 'veg';
                    return (
                        <motion.div
                            key={choice.id || index}
                            className="bg-black/40 border border-white/10 rounded-2xl p-4 sm:p-5 hover:border-purple-500/40 hover:bg-white/[0.06] transition-all duration-300 group flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.07, duration: 0.3 }}
                        >
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {/* Veg / Non-Veg Indicator */}
                                    <span
                                        className={`w-3.5 h-3.5 border-2 flex items-center justify-center rounded-[3px] p-[1px] bg-black/80 ${
                                            isVeg ? 'border-green-500' : 'border-red-500'
                                        }`}
                                        title={isVeg ? "Vegetarian" : "Non-Vegetarian"}
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full ${isVeg ? 'bg-green-500' : 'bg-red-500'}`} />
                                    </span>

                                    <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                                        {choice.name}
                                    </h3>

                                    {/* Badges: Cook Time & Difficulty */}
                                    {choice.cookTime && (
                                        <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md bg-white/5 text-gray-300 border border-white/10 flex items-center gap-1 font-mono">
                                            ⏱️ {choice.cookTime}
                                        </span>
                                    )}
                                    {choice.difficulty && (
                                        <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md bg-purple-950/40 text-purple-300 border border-purple-800/40">
                                            {choice.difficulty}
                                        </span>
                                    )}

                                    {/* Ingredient Match Badge */}
                                    {typeof choice.ingredientMatchCount === 'number' && choice.ingredientMatchCount > 0 && (
                                        <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 flex items-center gap-1">
                                            🎯 Matched {choice.ingredientMatchCount} item{choice.ingredientMatchCount > 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>

                                <p className="text-xs sm:text-sm text-gray-300 leading-relaxed font-light">
                                    {choice.description}
                                </p>

                                {choice.matchReason && (
                                    <p className="text-[11px] text-emerald-400/90 font-medium flex items-start gap-1">
                                        <span>✨</span>
                                        <span>{choice.matchReason}</span>
                                    </p>
                                )}
                            </div>

                            {/* Actions: Like / Dislike Feedback + Cook This Button */}
                            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2.5 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-500 hidden sm:inline-block">Rate</span>
                                    <DishFeedback
                                        dishName={choice.name}
                                        culinaryMood={foodMood}
                                        dietaryType={choice.dietaryType || dietaryType}
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => onSelectRecipe(choice)}
                                    className="w-auto px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-purple-600/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer flex-shrink-0"
                                >
                                    <span>Cook This</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
