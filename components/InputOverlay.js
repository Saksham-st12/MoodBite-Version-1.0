// components/InputOverlay.js
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

const QUICK_SUGGESTIONS = [
    'Paneer', 'Potato (Aloo)', 'Onion', 'Tomato', 'Capsicum',
    'Garlic & Ginger', 'Rice', 'Dal / Lentils', 'Chicken', 'Egg',
    'Spinach (Palak)', 'Green Peas'
];

export default function InputOverlay({ initialIngredients = [], dietaryPreference = 'veg', onSubmit, onClose }) {
    const [ingredientList, setIngredientList] = useState([]);
    const [inputValue, setInputValue] = useState('');

    const displayedSuggestions = dietaryPreference === 'veg'
        ? QUICK_SUGGESTIONS.filter(item => !['Chicken', 'Egg'].includes(item))
        : QUICK_SUGGESTIONS;

    useEffect(() => {
        if (Array.isArray(initialIngredients)) {
            setIngredientList([...initialIngredients]);
        }
    }, [initialIngredients]);

    const addIngredientsFromText = (text) => {
        if (!text || !text.trim()) return ingredientList;
        const newItems = text
            .split(/[\n,]+/)
            .map(item => item.trim().toLowerCase().slice(0, 50))
            .filter(item => item.length > 0);

        const updated = [...new Set([...ingredientList, ...newItems])].slice(0, 25);
        setIngredientList(updated);
        return updated;
    };

    const handleAddClick = (e) => {
        if (e) e.preventDefault();
        if (inputValue.trim()) {
            if (ingredientList.length >= 25) {
                alert("Maximum 25 ingredients allowed.");
                return;
            }
            addIngredientsFromText(inputValue);
            setInputValue('');
        }
    };

    const handleRemoveIngredient = (indexToRemove) => {
        setIngredientList(prev => prev.filter((_, idx) => idx !== indexToRemove));
    };

    const handleQuickAdd = (item) => {
        if (ingredientList.length >= 25) return;
        const normalized = item.toLowerCase().slice(0, 50);
        if (!ingredientList.includes(normalized)) {
            setIngredientList(prev => [...prev, normalized].slice(0, 25));
        }
    };

    const handleSave = (triggerSearch = false) => {
        let finalList = ingredientList;
        if (inputValue.trim()) {
            finalList = addIngredientsFromText(inputValue);
            setInputValue('');
        }
        onSubmit(finalList, triggerSearch);
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 15 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 15 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 260 }}
                    className="relative bg-gray-900 border border-purple-500/50 rounded-2xl p-6 sm:p-7 w-full max-w-lg shadow-2xl text-white my-auto flex flex-col gap-4"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">🥘</span>
                                <h2 className="text-xl font-bold text-white tracking-wide">
                                    Your Kitchen Ingredients
                                </h2>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                                Add what you have in your fridge or pantry. We&apos;ll find 4–5 recipes you can make!
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors text-lg leading-none"
                            title="Close modal"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Active Ingredients Tag Box */}
                    <div className="bg-gray-950/80 border border-gray-800 rounded-xl p-3 min-h-[70px] max-h-36 overflow-y-auto flex flex-wrap gap-1.5 items-start content-start">
                        {ingredientList.length === 0 ? (
                            <p className="text-xs text-gray-500 italic m-auto py-2">
                                No ingredients added yet. Type below or tap quick suggestions.
                            </p>
                        ) : (
                            ingredientList.map((ing, idx) => (
                                <span
                                    key={idx}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-900/70 border border-purple-500/40 text-purple-200 shadow-sm transition-all"
                                >
                                    <span className="capitalize">{ing}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveIngredient(idx)}
                                        className="text-purple-300 hover:text-white hover:bg-purple-800 rounded-full w-4 h-4 inline-flex items-center justify-center font-bold text-xs"
                                        title={`Remove ${ing}`}
                                    >
                                        &times;
                                    </button>
                                </span>
                            ))
                        )}
                    </div>

                    {/* Input Field with Add Button */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddClick();
                                }
                            }}
                            placeholder="e.g. paneer, tomato, capsicum, cumin (press Enter)"
                            maxLength={50}
                            className="flex-1 px-3.5 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={handleAddClick}
                            className="px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-semibold text-xs transition-colors flex items-center gap-1 flex-shrink-0"
                        >
                            <span>+ Add</span>
                        </button>
                    </div>

                    {/* Quick Pantry Staples Suggestions */}
                    <div>
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                            Quick Add Pantry Staples:
                        </span>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                            {displayedSuggestions.map((item) => {
                                const isAdded = ingredientList.includes(item.toLowerCase());
                                return (
                                    <button
                                        key={item}
                                        type="button"
                                        onClick={() => handleQuickAdd(item)}
                                        disabled={isAdded}
                                        className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                                            isAdded
                                                ? 'bg-gray-800/50 border-gray-700 text-gray-500 cursor-default'
                                                : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300 hover:text-white hover:border-purple-500/50'
                                        }`}
                                    >
                                        {isAdded ? `✓ ${item}` : `+ ${item}`}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Modal Footer Controls */}
                    <div className="pt-2 border-t border-gray-800 flex items-center justify-between gap-2 flex-wrap">
                        {ingredientList.length > 0 ? (
                            <button
                                type="button"
                                onClick={() => setIngredientList([])}
                                className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                            >
                                Clear all
                            </button>
                        ) : (
                            <span />
                        )}

                        <div className="flex items-center gap-2 ml-auto">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-xs font-semibold rounded-full text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSave(false)}
                                className="px-4 py-2 text-xs font-semibold rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                            >
                                Save ({ingredientList.length})
                            </button>
                            {ingredientList.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => handleSave(true)}
                                    className="px-4 py-2 text-xs font-semibold rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition-all flex items-center gap-1.5"
                                >
                                    <span>Find Recipes Now</span>
                                    <span>👨‍🍳</span>
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}