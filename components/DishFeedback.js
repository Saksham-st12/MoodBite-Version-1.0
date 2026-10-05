// components/DishFeedback.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DishFeedback({ dishName, culinaryMood, dietaryType, size = 'sm' }) {
    const [rating, setRating] = useState(null); // 'like' | 'dislike' | null
    const [toastMessage, setToastMessage] = useState('');

    useEffect(() => {
        if (!dishName || typeof window === 'undefined') return;
        try {
            const stored = JSON.parse(localStorage.getItem('moodbite_dish_ratings') || '{}');
            if (stored[dishName]) {
                setRating(stored[dishName]);
            }
        } catch (_) {}
    }, [dishName]);

    const handleRate = async (type) => {
        const newRating = rating === type ? null : type;
        setRating(newRating);

        // Save locally
        if (typeof window !== 'undefined') {
            try {
                const stored = JSON.parse(localStorage.getItem('moodbite_dish_ratings') || '{}');
                if (newRating) {
                    stored[dishName] = newRating;
                    setToastMessage(newRating === 'like' ? 'Saved to preferences 👍' : 'Noted, we will avoid this 👎');
                } else {
                    delete stored[dishName];
                    setToastMessage('Rating removed');
                }
                localStorage.setItem('moodbite_dish_ratings', JSON.stringify(stored));
                setTimeout(() => setToastMessage(''), 2200);
            } catch (_) {}
        }

        // Post to server non-blockingly
        if (newRating) {
            fetch('/api/recordFeedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dishName, feedback: newRating, culinaryMood, dietaryType })
            }).catch(() => {});
        }
    };

    return (
        <div className="relative inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <motion.button
                type="button"
                whileTap={{ scale: 0.85 }}
                onClick={() => handleRate('like')}
                className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
                    rating === 'like'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-400 hover:text-white'
                }`}
                title="I like this dish"
            >
                <span className="text-xs sm:text-sm leading-none">👍</span>
            </motion.button>

            <motion.button
                type="button"
                whileTap={{ scale: 0.85 }}
                onClick={() => handleRate('dislike')}
                className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
                    rating === 'dislike'
                        ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-400 hover:text-white'
                }`}
                title="I don't like this dish"
            >
                <span className="text-xs sm:text-sm leading-none">👎</span>
            </motion.button>

            <AnimatePresence>
                {toastMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-md bg-gray-950/90 border border-white/15 text-[10px] text-gray-200 shadow-xl pointer-events-none z-30 backdrop-blur-md"
                    >
                        {toastMessage}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
