// components/BotResponseCard.js
import { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

const ImagePlaceholder = () => (
    <div className="w-full h-48 bg-gray-800 rounded-lg flex items-center justify-center">
        <div className="w-8 h-8 border-t-2 border-gray-500 rounded-full animate-spin"></div>
    </div>
);

export default function BotResponseCard({ response }) {
    const { predictedMood, suggestedFood, reason, confidenceScore, source, dietaryType } = response;
    const [isExpanded, setIsExpanded] = useState(false);
    const [imageUrl, setImageUrl] = useState(null);
    const [imageLoading, setImageLoading] = useState(true);

    const count = useMotionValue(0);
    const rounded = useTransform(count, latest => Math.round(latest));
    const targetScore = confidenceScore < 2 ? confidenceScore * 100 : confidenceScore;

    useEffect(() => {
        const controls = animate(count, targetScore, { duration: 2, ease: "easeOut" });
        if (suggestedFood && !suggestedFood.toLowerCase().includes("failed") && !suggestedFood.toLowerCase().includes("error")) {
            setImageLoading(true);
            fetch(`/api/generateFoodImage?foodName=${encodeURIComponent(suggestedFood)}`)
                .then(res => res.ok ? res.json() : Promise.reject("Image not found"))
                .then(data => data.imageUrl ? setImageUrl(data.imageUrl) : setImageLoading(false))
                .catch(err => { console.error(err); setImageLoading(false); });
        } else {
            setImageLoading(false);
        }
        return () => controls.stop();
    }, [suggestedFood, count, targetScore]);

    return (
        <div className="bg-gray-700 rounded-lg p-4 w-full max-w-lg space-y-4">
            {imageLoading && <ImagePlaceholder />}
            {imageUrl && (
                <img src={imageUrl} alt={suggestedFood} className="w-full h-48 object-cover rounded-lg"
                    onLoad={() => setImageLoading(false)}
                    onError={() => { setImageLoading(false); setImageUrl(null); }}
                />
            )}
            <div>
                <p className="text-xs text-gray-400">Detected Mood</p>
                <p className="text-lg font-semibold text-yellow-400">{predictedMood}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-center sm:text-left">
                    <div className="flex items-center gap-2 mb-1 justify-center sm:justify-start">
                        <p className="text-xs text-gray-400">Suggestion</p>
                        {dietaryType && (
                            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                dietaryType.toLowerCase() === 'veg' 
                                    ? 'border-green-500/50 bg-green-950/40 text-green-300' 
                                    : 'border-red-500/50 bg-red-950/40 text-red-300'
                            }`}>
                                <span className={`w-3 h-3 border flex items-center justify-center rounded-[2px] p-[1px] ${
                                    dietaryType.toLowerCase() === 'veg' ? 'border-green-500' : 'border-red-500'
                                }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                        dietaryType.toLowerCase() === 'veg' ? 'bg-green-500' : 'bg-red-500'
                                    }`} />
                                </span>
                                {dietaryType.toLowerCase() === 'veg' ? 'Veg' : 'Non-Veg'}
                            </div>
                        )}
                    </div>
                    <p className="text-2xl font-bold">{suggestedFood}</p>
                </div>
                <div className="text-center bg-gray-900/50 p-2 rounded-lg">
                     <p className="text-xs text-gray-400">Confidence</p>
                     <motion.p className="text-3xl font-mono font-bold text-green-400">{rounded}</motion.p>
                </div>
            </div>
            <div>
                <p className="text-xs text-gray-400 mb-1">Reason</p>
                <motion.p className={`text-sm text-gray-300 overflow-hidden`} animate={{ height: isExpanded ? 'auto' : '40px' }} >{reason}</motion.p>
                <button onClick={() => setIsExpanded(!isExpanded)} className="text-xs text-blue-400 hover:underline mt-1">{isExpanded ? 'Show Less' : 'Show More...'}</button>
            </div>
            {source && (
                <div className="text-right text-xs text-gray-500 pt-2 border-t border-gray-600/50">
                    Powered by: {source}
                </div>
            )}
        </div>
    );
}