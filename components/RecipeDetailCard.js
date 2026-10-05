// components/RecipeDetailCard.js
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import DishFeedback from './DishFeedback';

const ImagePlaceholder = () => (
    <div className="w-full h-48 sm:h-60 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 animate-pulse">
        <div className="flex flex-col items-center gap-2">
            <div className="w-7 h-7 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-gray-400">Loading authentic dish photo...</span>
        </div>
    </div>
);

export default function RecipeDetailCard({ recipe }) {
    const {
        dishName,
        dietaryType = 'veg',
        prepTime,
        cookTime,
        totalTime,
        servings,
        difficulty,
        ingredientsList = [],
        instructions = [],
        chefTips,
        culinaryComfort,
        isFallback,
        fallbackNotice,
        ingredientMatch
    } = recipe;

    const [imageData, setImageData] = useState(null);
    const [imageLoading, setImageLoading] = useState(true);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [completedSteps, setCompletedSteps] = useState({});

    const isVeg = (dietaryType || 'veg').toLowerCase() === 'veg';

    useEffect(() => {
        if (dishName) {
            setImageLoading(true);
            fetch(`/api/generateFoodImage?foodName=${encodeURIComponent(dishName)}`)
                .then(res => res.ok ? res.json() : Promise.reject("Image not found"))
                .then(data => {
                    if (data.imageUrl) {
                        setImageData({
                            imageUrl: data.imageUrl,
                            photographer: data.photographer || 'Pexels Contributor',
                            photographerUrl: data.photographerUrl || 'https://www.pexels.com'
                        });
                    }
                    setImageLoading(false);
                })
                .catch(err => {
                    console.error("Error fetching recipe image:", err);
                    setImageLoading(false);
                });
        }
    }, [dishName]);

    const handleSpeakSteps = () => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;

        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            return;
        }

        const stepsText = instructions.join('. ');
        const fullSpeech = `Here is how to make ${dishName}. ${stepsText}. Chef tip: ${chefTips || ''}`;

        const utterance = new SpeechSynthesisUtterance(fullSpeech);
        utterance.lang = 'en-IN';
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        setIsSpeaking(true);
        window.speechSynthesis.speak(utterance);
    };

    const toggleStep = (index) => {
        setCompletedSteps(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    return (
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full max-w-2xl space-y-5 shadow-2xl backdrop-blur-xl">
            {/* Fallback Notice Banner */}
            {isFallback && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-200">
                    <span className="text-base flex-shrink-0">⚠️</span>
                    <div>
                        <span className="font-bold text-amber-300">Basic Recipe Guide: </span>
                        <span>{fallbackNotice || "Couldn't generate the specific recipe steps for this dish right now. Here is a basic preparation guide."}</span>
                    </div>
                </div>
            )}

            {/* Dish Photo */}
            {imageLoading && <ImagePlaceholder />}
            {imageData?.imageUrl && !imageLoading && (
                <div className="space-y-1.5">
                    <div className="relative rounded-2xl overflow-hidden shadow-xl border border-white/10 max-h-64 sm:max-h-72">
                        <img
                            src={imageData.imageUrl}
                            alt={dishName}
                            className="w-full h-48 sm:h-64 object-cover hover:scale-105 transition-transform duration-500"
                            onError={() => setImageData(null)}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>
                        
                        {/* Floating Header on Image */}
                        <div className="absolute bottom-3.5 left-3.5 right-3.5 flex items-end justify-between gap-2">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold text-white drop-shadow-md">
                                    {dishName}
                                </h2>
                                <p className="text-[11px] text-gray-300 font-light mt-0.5">
                                    Authentic Indian Recipe
                                </p>
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 shadow-md flex-shrink-0 ${
                                isVeg
                                    ? 'bg-green-950/80 border-green-500/60 text-green-300'
                                    : 'bg-red-950/80 border-red-500/60 text-red-300'
                            }`}>
                                <span className={`w-2 h-2 rounded-full ${isVeg ? 'bg-green-400' : 'bg-red-400'}`} />
                                {isVeg ? 'Veg' : 'Non-Veg'}
                            </span>
                        </div>
                    </div>
                    
                    {/* Pexels attribution */}
                    <div className="text-[10px] text-gray-500 flex justify-between items-center px-1">
                        <span className="italic">Illustrative photo</span>
                        {imageData.photographer && (
                            <span>
                                Photo by{' '}
                                <a
                                    href={imageData.photographerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline hover:text-gray-300"
                                >
                                    {imageData.photographer}
                                </a>{' '}
                                on Pexels
                            </span>
                        )}
                    </div>
                </div>
            )}

            {!imageData?.imageUrl && !imageLoading && (
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h2 className="text-xl sm:text-2xl font-bold text-white">{dishName}</h2>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                        isVeg ? 'bg-green-950/80 border-green-500/60 text-green-300' : 'bg-red-950/80 border-red-500/60 text-red-300'
                    }`}>
                        <span className={`w-2 h-2 rounded-full ${isVeg ? 'bg-green-400' : 'bg-red-400'}`} />
                        {isVeg ? 'Veg' : 'Non-Veg'}
                    </span>
                </div>
            )}

            {/* Rating Bar */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-gray-300">
                <span className="text-[11px] sm:text-xs">How do you like this recipe?</span>
                <DishFeedback dishName={dishName} dietaryType={dietaryType} size="sm" />
            </div>

            {/* Pantry match indicator */}
            {ingredientMatch && ingredientMatch.matchedIngredients?.length > 0 && (
                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-200">
                    <span className="flex items-center gap-1.5 font-medium">
                        <span>🥗 Matched pantry items:</span>
                        <span className="text-white font-semibold">{ingredientMatch.matchedIngredients.join(', ')}</span>
                    </span>
                    <span className="bg-emerald-900/60 px-2 py-0.5 rounded-full font-bold text-[11px] text-emerald-300 border border-emerald-700/60">
                        {ingredientMatch.matchCount} matched
                    </span>
                </div>
            )}

            {/* Quick Meta Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="bg-black/40 p-2.5 rounded-xl border border-white/10">
                    <p className="text-[10px] uppercase text-gray-400 font-semibold">Prep Time</p>
                    <p className="text-xs font-bold text-gray-200 mt-0.5 font-mono">{prepTime || '10 mins'}</p>
                </div>
                <div className="bg-black/40 p-2.5 rounded-xl border border-white/10">
                    <p className="text-[10px] uppercase text-gray-400 font-semibold">Cook Time</p>
                    <p className="text-xs font-bold text-gray-200 mt-0.5 font-mono">{cookTime || '20 mins'}</p>
                </div>
                <div className="bg-black/40 p-2.5 rounded-xl border border-white/10">
                    <p className="text-[10px] uppercase text-gray-400 font-semibold">Servings</p>
                    <p className="text-xs font-bold text-gray-200 mt-0.5">{servings || '2 people'}</p>
                </div>
                <div className="bg-black/40 p-2.5 rounded-xl border border-white/10">
                    <p className="text-[10px] uppercase text-gray-400 font-semibold">Difficulty</p>
                    <p className="text-xs font-bold text-purple-400 mt-0.5">{difficulty || 'Easy'}</p>
                </div>
            </div>

            {/* Ingredients Section */}
            {ingredientsList.length > 0 && (
                <div className="space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                        <span>🛒 Required Ingredients</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {ingredientsList.map((ing, i) => (
                            <div key={i} className="flex items-center justify-between text-xs bg-black/30 p-2.5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                <span className="font-medium text-gray-200 capitalize">{ing.item}</span>
                                <span className="text-gray-400 font-mono text-[11px]">{ing.amount}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Step-by-Step Instructions */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                        <span>🍳 Step-by-Step Cooking Guide</span>
                    </h3>
                    <button
                        type="button"
                        onClick={handleSpeakSteps}
                        className={`text-xs px-3 py-1 rounded-full font-medium transition-all flex items-center gap-1.5 border ${
                            isSpeaking
                                ? 'bg-red-600/80 border-red-500 text-white animate-pulse'
                                : 'bg-white/5 border-white/10 text-purple-300 hover:bg-white/10'
                        }`}
                        title="Listen to the cooking steps"
                    >
                        <span>{isSpeaking ? '⏹️ Stop Voice' : '🔊 Listen to Steps'}</span>
                    </button>
                </div>

                <div className="space-y-2">
                    {instructions.map((step, idx) => {
                        const isDone = completedSteps[idx];
                        return (
                            <div
                                key={idx}
                                onClick={() => toggleStep(idx)}
                                className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                                    isDone
                                        ? 'bg-emerald-950/20 border-emerald-500/30 opacity-70'
                                        : 'bg-black/40 border-white/10 hover:border-white/20'
                                }`}
                            >
                                <button
                                    type="button"
                                    className={`flex-shrink-0 w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center transition-all ${
                                        isDone
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-purple-600/80 text-white'
                                    }`}
                                >
                                    {isDone ? '✓' : idx + 1}
                                </button>
                                <p className={`text-xs sm:text-sm leading-relaxed pt-0.5 ${
                                    isDone ? 'line-through text-gray-400' : 'text-gray-200'
                                }`}>
                                    {step.replace(/^Step\s*\d+:\s*/i, '')}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Chef's Pro Tip */}
            {chefTips && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-200 shadow-md">
                    <span className="text-base flex-shrink-0">💡</span>
                    <div>
                        <span className="font-bold text-amber-300">Chef&apos;s Pro Tip: </span>
                        <span>{chefTips}</span>
                    </div>
                </div>
            )}

            {/* Culinary Comfort & Mood Note */}
            {(culinaryComfort || recipe.moodNote) && (
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-indigo-200">
                    <span className="text-base flex-shrink-0">🌿</span>
                    <div>
                        <span className="font-bold text-indigo-300">Culinary Pairing Rationale: </span>
                        <span>{culinaryComfort || recipe.moodNote}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
