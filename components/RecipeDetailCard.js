// components/RecipeDetailCard.js
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const ImagePlaceholder = () => (
    <div className="w-full h-52 bg-gray-900/80 rounded-xl flex items-center justify-center border border-gray-700/50">
        <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-gray-400">Loading delicious dish photo...</span>
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
        emotionalTherapy
    } = recipe;

    const [imageUrl, setImageUrl] = useState(null);
    const [imageLoading, setImageLoading] = useState(true);
    const [isSpeaking, setIsSpeaking] = useState(false);

    const isVeg = dietaryType.toLowerCase() === 'veg';

    useEffect(() => {
        if (dishName) {
            setImageLoading(true);
            fetch(`/api/generateFoodImage?foodName=${encodeURIComponent(dishName)}`)
                .then(res => res.ok ? res.json() : Promise.reject("Image not found"))
                .then(data => {
                    if (data.imageUrl) setImageUrl(data.imageUrl);
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

    return (
        <div className="bg-gray-800/95 border border-purple-500/30 rounded-2xl p-4 sm:p-6 w-full max-w-2xl space-y-5 shadow-2xl backdrop-blur-md">
            {/* Dish Photo */}
            {imageLoading && <ImagePlaceholder />}
            {imageUrl && !imageLoading && (
                <div className="relative rounded-xl overflow-hidden shadow-lg border border-gray-700/60 max-h-56">
                    <img
                        src={imageUrl}
                        alt={dishName}
                        className="w-full h-52 sm:h-56 object-cover hover:scale-105 transition-transform duration-500"
                        onError={() => setImageUrl(null)}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                    
                    {/* Floating Title on Image */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                        <h2 className="text-xl sm:text-2xl font-extrabold text-white drop-shadow-md">
                            {dishName}
                        </h2>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 shadow-md ${
                            isVeg
                                ? 'bg-green-950/80 border-green-500 text-green-300'
                                : 'bg-red-950/80 border-red-500 text-red-300'
                        }`}>
                            <span className={`w-2.5 h-2.5 rounded-full ${isVeg ? 'bg-green-400' : 'bg-red-400'}`} />
                            {isVeg ? 'Veg' : 'Non-Veg'}
                        </span>
                    </div>
                </div>
            )}

            {!imageUrl && !imageLoading && (
                <div className="flex items-center justify-between border-b border-gray-700/60 pb-3">
                    <h2 className="text-2xl font-extrabold text-white">{dishName}</h2>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                        isVeg ? 'bg-green-950/80 border-green-500 text-green-300' : 'bg-red-950/80 border-red-500 text-red-300'
                    }`}>
                        <span className={`w-2.5 h-2.5 rounded-full ${isVeg ? 'bg-green-400' : 'bg-red-400'}`} />
                        {isVeg ? 'Veg' : 'Non-Veg'}
                    </span>
                </div>
            )}

            {/* Quick Meta Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="bg-gray-900/80 p-2 rounded-lg border border-gray-700/50">
                    <p className="text-[10px] uppercase text-gray-400 font-semibold">Prep Time</p>
                    <p className="text-xs font-bold text-gray-200 mt-0.5">{prepTime || '10 mins'}</p>
                </div>
                <div className="bg-gray-900/80 p-2 rounded-lg border border-gray-700/50">
                    <p className="text-[10px] uppercase text-gray-400 font-semibold">Cook Time</p>
                    <p className="text-xs font-bold text-gray-200 mt-0.5">{cookTime || '20 mins'}</p>
                </div>
                <div className="bg-gray-900/80 p-2 rounded-lg border border-gray-700/50">
                    <p className="text-[10px] uppercase text-gray-400 font-semibold">Servings</p>
                    <p className="text-xs font-bold text-gray-200 mt-0.5">{servings || '2 people'}</p>
                </div>
                <div className="bg-gray-900/80 p-2 rounded-lg border border-gray-700/50">
                    <p className="text-[10px] uppercase text-gray-400 font-semibold">Difficulty</p>
                    <p className="text-xs font-bold text-purple-400 mt-0.5">{difficulty || 'Easy'}</p>
                </div>
            </div>

            {/* Ingredients Section */}
            {ingredientsList.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                        <span>🛒 Required Ingredients & Measurements</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {ingredientsList.map((ing, i) => (
                            <div key={i} className="flex items-center justify-between text-xs bg-gray-900/60 p-2 rounded-lg border border-gray-800">
                                <span className="font-medium text-gray-200">{ing.item}</span>
                                <span className="text-gray-400 font-mono text-[11px]">{ing.amount}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Step-by-Step Instructions */}
            <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                        <span>🍳 Step-by-Step Cooking Guide</span>
                    </h3>
                    <button
                        type="button"
                        onClick={handleSpeakSteps}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all flex items-center gap-1.5 border ${
                            isSpeaking
                                ? 'bg-red-600 border-red-500 text-white animate-pulse'
                                : 'bg-gray-900 border-gray-700 text-purple-300 hover:bg-gray-800'
                        }`}
                        title="Listen to the cooking steps"
                    >
                        <span>{isSpeaking ? '⏹️ Stop Voice' : '🔊 Listen to Steps'}</span>
                    </button>
                </div>

                <div className="space-y-2">
                    {instructions.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-3 bg-gray-900/70 p-3 rounded-xl border border-gray-800/80 hover:border-gray-700 transition-colors">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center shadow-md">
                                {idx + 1}
                            </span>
                            <p className="text-xs sm:text-sm text-gray-200 leading-relaxed pt-0.5">
                                {step.replace(/^Step\s*\d+:\s*/i, '')}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chef's Pro Tip */}
            {chefTips && (
                <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-200">
                    <span className="text-base flex-shrink-0">💡</span>
                    <div>
                        <span className="font-bold text-amber-300">Chef&apos;s Secret: </span>
                        <span>{chefTips}</span>
                    </div>
                </div>
            )}

            {/* Culinary Comfort & Mood Note */}
            {(recipe.culinaryComfort || recipe.moodNote || recipe.emotionalTherapy) && (
                <div className="bg-blue-950/30 border border-blue-500/40 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-200">
                    <span className="text-base flex-shrink-0">🌿</span>
                    <div>
                        <span className="font-bold text-blue-300">Culinary Comfort: </span>
                        <span>{recipe.culinaryComfort || recipe.moodNote || recipe.emotionalTherapy}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
