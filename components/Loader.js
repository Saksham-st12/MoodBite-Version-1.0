// components/Loader.js (New Animated Splash Screen)
import { motion } from 'framer-motion';
import { NextjsLogo, GeminiLogo, HuggingFaceLogo, PexelsLogo } from './TechLogos';

const techStack = [
    { name: "NEXT.JS", Logo: NextjsLogo },
    { name: "GOOGLE GEMINI", Logo: GeminiLogo },
    { name: "HUGGING FACE", Logo: HuggingFaceLogo },
    { name: "PEXELS API", Logo: PexelsLogo },
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.3, // Each child animates 0.3s after the previous one
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.5,
            ease: 'easeOut',
        },
    },
};

export default function Loader({ onSkip }) {
    return (
        <div className="relative w-full h-screen bg-black flex flex-col items-center justify-center">
            {onSkip && (
                <button
                    type="button"
                    onClick={onSkip}
                    className="absolute top-6 right-6 px-3.5 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-900/60 hover:bg-gray-800 border border-gray-800 hover:border-gray-600 rounded-full transition-all duration-200 cursor-pointer"
                >
                    Skip ➔
                </button>
            )}
            <motion.div
                className="flex flex-col space-y-6"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {techStack.map((tech, index) => (
                    <motion.div
                        key={tech.name}
                        className={`flex items-center gap-4 ${index % 2 !== 0 ? 'flex-row-reverse' : ''}`}
                        variants={itemVariants}
                    >
                        <tech.Logo />
                        <div className="overflow-hidden">
                            <motion.h1
                                className="text-4xl sm:text-5xl font-bold tracking-wider text-white/90"
                                initial={{ y: "100%" }}
                                animate={{ y: 0 }}
                                transition={{ delay: index * 0.3 + 0.2, duration: 0.5, ease: "easeOut" }}
                            >
                                {tech.name}
                            </motion.h1>
                        </div>
                    </motion.div>
                ))}
                
                <motion.p
                    className="text-xs text-gray-500 tracking-widest uppercase text-center pt-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.6, duration: 0.5 }}
                >
                    Initializing MoodBite AI...
                </motion.p>
            </motion.div>
        </div>
    );
}