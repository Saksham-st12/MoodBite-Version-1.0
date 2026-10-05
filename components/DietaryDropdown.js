// components/DietaryDropdown.js
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DietaryDropdown({ dietaryPreference, onSelect }) {
    const [isOpen, setIsOpen] = useState(false);

    const options = [
        { id: 'veg', label: 'Vegetarian', badge: 'Veg', icon: '🥬', color: 'green', desc: '100% plant & dairy based' },
        { id: 'non-veg', label: 'Non-Vegetarian', badge: 'Non-Veg', icon: '🍗', color: 'red', desc: 'Chicken, mutton, fish, egg' },
        { id: 'all', label: 'Any / Flexible', badge: 'Any', icon: '🍲', color: 'blue', desc: 'Both veg & non-veg dishes' },
    ];

    const current = options.find(o => o.id === dietaryPreference) || options[0];

    return (
        <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
                    current.id === 'veg'
                        ? 'bg-green-950/60 border-green-500/40 text-green-300 hover:bg-green-950/80 hover:border-green-400'
                        : current.id === 'non-veg'
                        ? 'bg-red-950/60 border-red-500/40 text-red-300 hover:bg-red-950/80 hover:border-red-400'
                        : 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300 hover:bg-indigo-950/80 hover:border-indigo-400'
                }`}
                title="Select Dietary Preference"
            >
                <span className="leading-none text-xs sm:text-sm">{current.icon}</span>
                <span className="text-[11px] sm:text-xs font-medium">{current.badge}</span>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-3 w-3 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-30"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -6 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -6 }}
                            transition={{ duration: 0.15 }}
                            className="absolute bottom-full mb-2 left-0 sm:left-auto sm:right-0 w-52 sm:w-56 rounded-2xl bg-gray-950/95 border border-white/15 shadow-2xl backdrop-blur-xl p-1.5 z-40 text-xs"
                        >
                            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-white/10 mb-1">
                                Dietary Filter
                            </div>
                            <div className="space-y-0.5">
                                {options.map(opt => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => {
                                            onSelect(opt.id);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all ${
                                            dietaryPreference === opt.id
                                                ? 'bg-white/10 text-white font-semibold'
                                                : 'text-gray-300 hover:text-white hover:bg-white/5'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-base leading-none">{opt.icon}</span>
                                            <div>
                                                <p className="text-xs leading-none">{opt.label}</p>
                                                <p className="text-[10px] text-gray-400 mt-0.5 leading-none">{opt.desc}</p>
                                            </div>
                                        </div>
                                        {dietaryPreference === opt.id && (
                                            <span className="text-xs text-purple-400 font-bold">✓</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
