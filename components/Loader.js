// components/Loader.js (Clean, Minimalist Splash Screen)
import { motion } from 'framer-motion';

const techBadges = [
    { label: "Next.js", role: "Framework", tag: "React 19" },
    { label: "Google Gemini", role: "Reasoning & Vision", tag: "3.5 Flash Lite" },
    { label: "RoBERTa GoEmotions", role: "Emotion NLP Head", tag: "Hugging Face" },
    { label: "Supabase", role: "Auth & Database", tag: "PostgreSQL" }
];

export default function Loader({ onSkip }) {
    return (
        <div className="relative w-full h-screen bg-black flex flex-col items-center justify-center p-4">
            {onSkip && (
                <button
                    type="button"
                    onClick={onSkip}
                    className="absolute top-6 right-6 px-3.5 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-900/60 hover:bg-gray-800 border border-gray-800 hover:border-gray-600 rounded-full transition-all duration-200 cursor-pointer"
                >
                    Skip ➔
                </button>
            )}

            <div className="w-full max-w-sm space-y-5 text-center">
                {/* Brand Logo & Name */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="space-y-1.5"
                >
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 mx-auto flex items-center justify-center text-2xl shadow-xl shadow-purple-600/30">
                        🍲
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-wider text-white">
                        MOODBITE AI
                    </h1>
                    <p className="text-xs text-gray-400">
                        Emotion-Aware Indian Culinary Assistant
                    </p>
                </motion.div>

                {/* Architecture Pipeline Stack */}
                <motion.div
                    className="grid grid-cols-2 gap-2 pt-2 text-left"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                >
                    {techBadges.map((tech) => (
                        <div
                            key={tech.label}
                            className="bg-gray-900/80 border border-gray-800 p-2.5 rounded-xl space-y-0.5"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-white">{tech.label}</span>
                            </div>
                            <p className="text-[10px] text-gray-400">{tech.role}</p>
                            <span className="inline-block text-[9px] font-mono text-purple-300 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/40">
                                {tech.tag}
                            </span>
                        </div>
                    ))}
                </motion.div>

                {/* Progress bar */}
                <motion.div
                    className="pt-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                >
                    <div className="w-48 h-1 bg-gray-800 rounded-full mx-auto overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 2.5, ease: "easeInOut" }}
                        />
                    </div>
                    <p className="text-[10px] text-gray-500 pt-2 tracking-wide uppercase">
                        Initializing models...
                    </p>
                </motion.div>
            </div>
        </div>
    );
}