// components/RecipeChoicesCard.js (Updated for WP2.1 & WP2.3)
import React from 'react';
import { motion } from 'framer-motion';

export default function RecipeChoicesCard({ response, onSelectRecipe }) {
    const { 
        predictedMood, 
        choices = [], 
        summary, 
        dietaryType, 
        llmSelfRating, 
        confidenceScore, 
        source 
    } = response;

    const rating = llmSelfRating || confidenceScore || 85;

    return (
        <div className="bg-gray-800/90 border border-gray-700/80 rounded-2xl p-4 sm:p-5 w-full max-w-2xl space-y-4 shadow-xl backdrop-blur-md">
            {/* Header: Detected Mood, Summary & Honest AI Match Rating (WP2.1) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-700/60">
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs uppercase tracking-wider text-gray-400 font-medium">Detected Mood</span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 capitalize">
                            {predictedMood}
                        </span>
                        {source && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-gray-900/60 text-gray-400 border border-gray-700/60">
                                {source}
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-200 mt-1 font-medium">
                        {summary || `Here are ${choices.length || 4} great recipes tailored to your ingredients and mood:`}
                    </p>
                </div>

                {/* WP2.1: Honest AI Match Rating */}
                <div className="flex-shrink-0 flex items-center gap-2 bg-gray-900/70 border border-gray-700/70 rounded-xl px-3 py-1.5 self-start sm:self-center">
                    <div className="text-right">
                        <p className="text-[10px] text-gray-400 font-medium">AI Match Rating</p>
                        <p className="text-[9px] text-gray-500">Self-reported indicator</p>
                    </div>
                    <span className="text-lg font-mono font-bold text-green-400">{rating}%</span>
                </div>
            </div>

            {/* Recipe Choices Grid */}
            <div className="grid grid-cols-1 gap-3 pt-1">
                {choices.map((choice, index) => {
                    const isVeg = (choice.dietaryType || dietaryType || 'veg').toLowerCase() === 'veg';
                    return (
                        <motion.div
                            key={choice.id || index}
                            className="bg-gray-900/80 border border-gray-700/60 rounded-xl p-3.5 sm:p-4 hover:border-purple-500/60 hover:bg-gray-900 transition-all duration-200 group flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.08, duration: 0.3 }}
                        >
                            <div className="flex-1 space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {/* FSSAI Veg / Non-Veg Icon */}
                                    <span className={`w-3.5 h-3.5 border-2 flex items-center justify-center rounded-[2px] p-[1px] bg-black/60 ${
                                        isVeg ? 'border-green-500' : 'border-red-500'
                                    }`} title={isVeg ? "Vegetarian" : "Non-Vegetarian"}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${isVeg ? 'bg-green-500' : 'bg-red-500'}`} />
                                    </span>

                                    <h3 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors">
                                        {choice.name}
                                    </h3>

                                    {/* Badges: Time & Difficulty */}
                                    {choice.cookTime && (
                                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-800 text-gray-300 border border-gray-700/60 flex items-center gap-1">
                                            ⏱️ {choice.cookTime}
                                        </span>
                                    )}
                                    {choice.difficulty && (
                                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-950/40 text-purple-300 border border-purple-800/40">
                                            {choice.difficulty}
                                        </span>
                                    )}

                                    {/* WP2.3: Deterministic Ingredient Match Indicator */}
                                    {typeof choice.ingredientMatchCount === 'number' && choice.ingredientMatchCount > 0 && (
                                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 flex items-center gap-1">
                                            🎯 Matched {choice.ingredientMatchCount} item{choice.ingredientMatchCount > 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>

                                <p className="text-xs text-gray-300 leading-relaxed">
                                    {choice.description}
                                </p>

                                {choice.matchReason && (
                                    <p className="text-[11px] text-green-400/90 font-medium">
                                        ✨ {choice.matchReason}
                                    </p>
                                )}
                            </div>

                            {/* Action Button */}
                            <div className="flex-shrink-0 flex items-center justify-end sm:justify-center">
                                <button
                                    type="button"
                                    onClick={() => onSelectRecipe(choice)}
                                    className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 shadow-md hover:shadow-purple-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
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
