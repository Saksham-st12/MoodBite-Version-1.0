// pages/index.js (Modern Minimalist Dark UI, Profile Menu, In-Chat Veg/Non-Veg Dropdown, Mobile & Laptop Optimized)
import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { AnimatePresence, motion } from 'framer-motion';
import Header from '../components/Header';
import DietaryDropdown from '../components/DietaryDropdown';
import BotResponseCard from '../components/BotResponseCard';
import RecipeChoicesCard from '../components/RecipeChoicesCard';
import RecipeDetailCard from '../components/RecipeDetailCard';
import TypingIndicator from '../components/TypingIndicator';
import InputOverlay from '../components/InputOverlay';
import Textarea from 'react-textarea-autosize';
import Loader from '../components/Loader';
import { useAuth } from '../context/AuthContext';

const MAX_INGREDIENTS = 25;
const MAX_TEXT_LENGTH = 500;

// Prompt inspiration suggestions for quick one-click input
const SUGGESTED_PROMPTS = [
    { text: "Feeling exhausted after work, need something quick", mood: "Tired" },
    { text: "Celebration time! Craving something festive", mood: "Joyful" },
    { text: "Stressed about exams, need warm comfort food", mood: "Calming" },
    { text: "Cold rainy evening, want soothing home-style dal", mood: "Comforting" }
];

/**
 * Robust JSON POST helper that captures HTTP status and Retry-After headers (P0.2)
 */
async function postJson(url, body, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const errorText = data.message ||
            (Array.isArray(data.errors) ? data.errors.join(' ') : null) ||
            (Array.isArray(data.details) ? data.details.join(' ') : null) ||
            'Request failed';
        const err = new Error(errorText);
        err.status = res.status;
        err.details = data.errors || data.details || [];
        err.retryAfter = Number(res.headers.get('Retry-After')) || data.retryAfter || null;
        throw err;
    }
    return data;
}

// Say what went wrong and provide actionable user feedback
function friendlyError(err) {
    const status = err?.status;
    if (status === 429) {
        const wait = err.retryAfter ? `${err.retryAfter} seconds` : 'a minute';
        return `Too many requests. Wait ${wait}, then try again.`;
    }
    if (status === 400) {
        const detail = Array.isArray(err.details) && err.details.length ? ` ${err.details[0]}` : (err.message ? ` ${err.message}` : '');
        return `The request was not accepted.${detail} Shorten your message or remove some ingredients, then try again.`;
    }
    if (status === 413) return 'This photo is larger than 5 MB. Choose a smaller photo.';
    if (status === 415) return 'This file type is not supported. Use a JPEG, PNG, WEBP or GIF photo.';
    if (status === 504) return 'The request timed out. Try again, or type the ingredients instead.';
    if (status >= 500) return 'The service is not responding. Try again in a moment.';
    return err?.message || 'Could not reach MoodBite. Check your internet connection and try again.';
}

/**
 * Resizes an image file on an HTML5 canvas before upload to ensure it is under 5MB and quick to process (P0.3)
 */
function resizeImageOnCanvas(file, maxDimension = 1024, quality = 0.85) {
    return new Promise((resolve) => {
        if (file.size < 1.5 * 1024 * 1024) {
            return resolve(file);
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width <= maxDimension && height <= maxDimension) {
                    return resolve(file);
                }
                if (width > height) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                } else {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            const cleanName = (file.name || 'ingredient').replace(/\.[^/.]+$/, "") + ".jpg";
                            const resized = new File([blob], cleanName, { type: 'image/jpeg' });
                            resolve(resized);
                        } else {
                            resolve(file);
                        }
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = () => resolve(file);
            img.src = e.target.result;
        };
        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
    });
}

export default function HomePage() {
    const [isAppLoading, setIsAppLoading] = useState(true);
    const [ingredients, setIngredients] = useState([]);
    const [dietaryPreference, setDietaryPreference] = useState('veg'); // 'veg' | 'non-veg' | 'all'
    const [currentCulinaryMood, setCurrentCulinaryMood] = useState('balanced');
    const [messages, setMessages] = useState([]); 
    const [textInput, setTextInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [assistantState, setAssistantState] = useState('idle');
    const [currentLang, setCurrentLang] = useState('en-IN');
    const [filePreviews, setFilePreviews] = useState([]);
    const [inputMode, setInputMode] = useState(null);
    const recognitionRef = useRef(null);
    const voices = useRef([]);
    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const { session } = useAuth();

    // Splash Screen: Displayed once per browser session
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const hasSeen = sessionStorage.getItem('moodbite_splash_seen');
            if (hasSeen) {
                setIsAppLoading(false);
                return;
            }
        }
        const timer = setTimeout(() => {
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('moodbite_splash_seen', 'true');
            }
            setIsAppLoading(false);
        }, 3200);
        return () => clearTimeout(timer);
    }, []);

    // Auto-scroll chat to latest message
    useEffect(() => {
        if (messages.length > 0) {
            chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isLoading]);
    
    // Web Speech API Voice Recognition & Synthesis
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (window.speechSynthesis) {
            const loadVoices = () => { voices.current = window.speechSynthesis.getVoices(); };
            window.speechSynthesis.onvoiceschanged = loadVoices;
            loadVoices();
        }
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = currentLang;
        recognition.onresult = (event) => {
            let interim_transcript = '', final_transcript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) final_transcript += event.results[i][0].transcript;
                else interim_transcript += event.results[i][0].transcript;
            }
            setTextInput(final_transcript + interim_transcript);
        };
        recognition.onerror = (event) => console.error("Speech recognition error:", event.error);
        recognition.onstart = () => setAssistantState('listening');
        recognition.onend = () => setAssistantState('idle');
        recognitionRef.current = recognition;
    }, [currentLang]);
    
    const speak = (text) => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        setAssistantState('speaking');
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = currentLang;
        const voice = voices.current.find(v => v.lang === currentLang && v.name.includes('Google'));
        if (voice) utterance.voice = voice;
        utterance.onend = () => setAssistantState('idle');
        utterance.onerror = () => setAssistantState('idle');
        window.speechSynthesis.speak(utterance);
    };

    const handleVoiceClick = (e) => {
        e.stopPropagation();
        if (!recognitionRef.current) return;
        if (assistantState === 'listening') {
            recognitionRef.current.stop();
        } else {
            setTextInput('');
            recognitionRef.current.start();
        }
    };

    const handleInterrupt = () => {
        if (assistantState === 'speaking') {
            window.speechSynthesis.cancel();
            setAssistantState('idle');
        }
    };

    // Image Upload & Vision Ingredient Identification
    const handleImageUpload = async (event) => {
        const files = Array.from(event.target.files);
        if (!files || files.length === 0) return;

        const newPreviews = files.map(file => ({
            id: `${file.name}-${Date.now()}-${Math.random()}`,
            file,
            previewUrl: URL.createObjectURL(file),
            status: 'uploading',
            ingredients: []
        }));

        setFilePreviews(prev => [...prev, ...newPreviews]);

        for (const preview of newPreviews) {
            try {
                const processedFile = await resizeImageOnCanvas(preview.file);
                const response = await fetch('/api/identifyIngredients', {
                    method: 'POST',
                    headers: { 'Content-Type': processedFile.type || 'image/jpeg' },
                    body: processedFile,
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.message || 'Image analysis failed');
                }
                const extracted = Array.isArray(data.ingredients) ? data.ingredients : [];
                setIngredients(prev => [...new Set([...prev, ...extracted])].slice(0, MAX_INGREDIENTS));
                setFilePreviews(prev => prev.map(p => p.id === preview.id ? { ...p, status: 'success', ingredients: extracted } : p));
            } catch (err) {
                console.error("Ingredient identification error:", err);
                setFilePreviews(prev => prev.map(p => p.id === preview.id ? { ...p, status: 'error', errorMessage: err.message || 'Analysis failed' } : p));
            }
        }
    };

    const removePreview = (idToRemove) => {
        setFilePreviews(prev => {
            const target = prev.find(p => p.id === idToRemove);
            if (target?.previewUrl) {
                try { URL.revokeObjectURL(target.previewUrl); } catch (_) {}
            }
            return prev.filter(p => p.id !== idToRemove);
        });
    };

    const clearAllPreviews = () => {
        filePreviews.forEach(p => {
            if (p.previewUrl) {
                try { URL.revokeObjectURL(p.previewUrl); } catch (_) {}
            }
        });
        setFilePreviews([]);
    };
    
    // Chat Submit
    const handleChatSubmit = async (e, textOverride = null, ingredientsOverride = null) => {
        if (e) e.preventDefault();
        const activeIngredients = (ingredientsOverride || ingredients).slice(0, MAX_INGREDIENTS);
        let textToSubmit = (textOverride || textInput).trim();
        if (!textToSubmit) {
            if (activeIngredients && activeIngredients.length > 0) {
                textToSubmit = `I have ${activeIngredients.join(', ')}. What delicious dishes can I cook?`;
            } else {
                return;
            }
        }

        if (textToSubmit.length > MAX_TEXT_LENGTH) {
            textToSubmit = textToSubmit.slice(0, MAX_TEXT_LENGTH);
        }

        const userMessage = { 
            role: 'user', 
            content: textToSubmit,
            ingredients: activeIngredients && activeIngredients.length > 0 ? [...activeIngredients] : []
        };
        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        setTextInput('');
        clearAllPreviews();

        try {
            const data = await postJson('/api/suggestFood', {
                text: textToSubmit,
                ingredients: activeIngredients,
                dietaryPreference
            }, session?.access_token);

            const botMessage = { role: 'bot', content: data };
            setMessages(prev => [...prev, botMessage]);

            if (data.culinaryMood || data.predictedMood) {
                setCurrentCulinaryMood(data.culinaryMood || data.predictedMood);
            }

            if (data.choices && data.choices.length > 0) {
                const narration = (activeIngredients && activeIngredients.length > 0)
                    ? `Here are ${data.choices.length} dishes you can make with your ingredients. Pick one to see the full recipe!`
                    : `Here are ${data.choices.length} comforting dishes tailored to your food mood. Pick one to see the full recipe!`;
                speak(narration);
            } else if (data.suggestedFood) {
                speak(`${data.suggestedFood}. ${data.reason}`);
            }
        } catch (error) {
            console.error("suggestFood API error:", error);
            const errReason = friendlyError(error);
            const errorTitle = error.status === 429 ? "Rate Limit Notice" : "Request Notice";

            const errorContent = {
                type: 'error',
                title: errorTitle,
                message: errReason,
                predictedMood: "Notice",
                suggestedFood: "Request Notice",
                reason: errReason
            };
            const errorMessage = { role: 'bot', content: errorContent };
            setMessages(prev => [...prev, errorMessage]);
            speak(errReason);
        } finally {
            setIsLoading(false);
        }
    };

    // Recipe Selection
    const handleSelectRecipe = async (recipe) => {
        const userMsg = { role: 'user', content: `I'd like to cook ${recipe.name}! Show me the complete making process.` };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const data = await postJson('/api/getRecipeDetails', {
                dishName: recipe.name,
                ingredients,
                dietaryPreference,
                dishDietaryType: recipe.dietaryType,
                mood: currentCulinaryMood || recipe.culinaryMood || 'comforting'
            }, session?.access_token);

            const botMessage = { role: 'bot', content: { ...data, type: 'recipe_detail' } };
            setMessages(prev => [...prev, botMessage]);
            speak(`Here is the complete recipe and cooking guide for ${data.dishName}.`);
        } catch (error) {
            console.error("Error fetching recipe details:", error);
            if (error.status === 429 || error.status === 400) {
                const errReason = friendlyError(error);
                const errorContent = {
                    type: 'error',
                    title: error.status === 429 ? "Rate Limit Reached" : "Request Notice",
                    message: errReason,
                    reason: errReason
                };
                setMessages(prev => [...prev, { role: 'bot', content: errorContent }]);
                speak(errReason);
                return;
            }

            let noticeText = `Could not generate the specific culinary recipe for "${recipe.name}" right now. Here is a basic preparation template.`;

            const fallbackMessage = {
                role: 'bot',
                content: {
                    type: 'recipe_detail',
                    dishName: recipe.name,
                    dietaryType: recipe.dietaryType || dietaryPreference,
                    prepTime: "10 mins",
                    cookTime: "20 mins",
                    servings: "2 servings",
                    difficulty: "Easy",
                    isFallback: true,
                    fallbackNotice: noticeText,
                    ingredientsList: (ingredients || []).map(item => ({ item, amount: "As needed" })),
                    instructions: [
                        "Step 1: Prep and chop your aromatics and primary ingredients into uniform pieces.",
                        "Step 2: Heat cooking oil or ghee in a heavy-bottomed skillet over medium heat.",
                        "Step 3: Add cumin seeds and sauté ginger-garlic paste with onions until fragrant.",
                        "Step 4: Add tomatoes, ground spices, and salt; cook until oil begins to separate.",
                        "Step 5: Add main ingredients and simmer gently on low heat until thoroughly cooked.",
                        "Step 6: Garnish with freshly chopped coriander leaves and serve warm."
                    ],
                    chefTips: "Always roast whole spices gently before adding liquids to release their essential oils.",
                    culinaryComfort: "Warm, nourishing comfort food prepared with balancing culinary spices."
                }
            };
            setMessages(prev => [...prev, fallbackMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleManualEntryClick = () => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        setAssistantState('idle');
        setInputMode('ingredients');
    };

    const handleOverlaySubmit = (newIngredients, shouldTriggerSearch = false) => {
        setIngredients(newIngredients);
        setInputMode(null);
        if (shouldTriggerSearch && newIngredients && newIngredients.length > 0) {
            handleChatSubmit(null, `What dishes can I cook with ${newIngredients.join(', ')}?`, newIngredients);
        }
    };

    if (isAppLoading) {
        return <Loader onSkip={() => setIsAppLoading(false)} />;
    }

    const hasMessages = messages.length > 0;

    return (
        <div className="w-full h-screen bg-black flex flex-col text-white relative overflow-hidden font-sans selection:bg-indigo-500/30 selection:text-white" onClick={handleInterrupt}>
            <Head>
                <title>MoodBite.ai - Emotion-Aware Indian Culinary Assistant</title>
                <meta name="description" content="Discover authentic Indian recipes tailored to your mood and available kitchen ingredients." />
            </Head>

            {/* Ambient Background Glows */}
            <div className="fixed inset-0 w-full h-full -z-10 bg-gradient-to-br from-gray-950 via-slate-950 to-black pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-indigo-600/10 rounded-full blur-[130px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-purple-600/10 rounded-full blur-[130px]" />
            </div>
            
            {/* Top Navigation Header Bar */}
            <Header
                onOpenPantry={() => setInputMode('ingredients')}
                onResetChat={() => setMessages([])}
            />

            {/* Conversation Feed OR Center Hero */}
            <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 flex flex-col">
                {!hasMessages ? (
                    // Centered Hero Layout (Matches moodbiteai.vercel.app aesthetic)
                    <div className="flex-1 flex flex-col items-center justify-center max-w-2xl w-full mx-auto space-y-6 sm:space-y-8 my-auto">
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="text-center space-y-2"
                        >
                            <h2 className="text-4xl sm:text-5xl md:text-6xl font-extralight tracking-tight text-white">
                                How are you <span className="font-serif italic text-white/90">feeling</span>?
                            </h2>
                            <p className="text-xs sm:text-sm text-gray-400 font-light max-w-md mx-auto">
                                Share your mood or scan your fridge. We&apos;ll craft authentic Indian recipes to match.
                            </p>
                        </motion.div>

                        {/* Input Box Card in Hero State */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1, duration: 0.4 }}
                            className="w-full space-y-3"
                        >
                            {/* Active Kitchen Ingredients Banner */}
                            {ingredients.length > 0 && (
                                <div className="p-3 bg-white/[0.04] border border-white/10 rounded-2xl backdrop-blur-xl">
                                    <div className="flex items-center justify-between mb-1.5 text-xs">
                                        <span className="text-purple-300 font-semibold flex items-center gap-1.5">
                                            <span>🛒 Pantry Staples</span>
                                            <span className="text-gray-400 font-normal">({ingredients.length}/{MAX_INGREDIENTS})</span>
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={handleManualEntryClick}
                                                className="text-purple-400 hover:text-purple-300 underline text-[11px]"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIngredients([])}
                                                className="text-gray-400 hover:text-rose-400 text-[11px]"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                                        {ingredients.map((ing, idx) => (
                                            <span
                                                key={idx}
                                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-purple-950/60 border border-purple-500/30 text-purple-200"
                                            >
                                                <span className="capitalize">{ing}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setIngredients(prev => prev.filter((_, i) => i !== idx))}
                                                    className="text-purple-400 hover:text-white font-bold text-xs"
                                                >
                                                    &times;
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Photo Upload Previews */}
                            {filePreviews.length > 0 && (
                                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 p-2 bg-white/[0.03] border border-white/10 rounded-2xl">
                                    {filePreviews.map(p => (
                                        <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden border border-white/10">
                                            <img src={p.previewUrl} className="w-full h-full object-cover" alt="Preview" />
                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                {p.status === 'uploading' && <div className="w-5 h-5 border-t-2 border-white rounded-full animate-spin" />}
                                                {p.status === 'success' && <span className="text-emerald-400 font-bold text-xs">✓</span>}
                                                {p.status === 'error' && <span className="text-rose-400 font-bold text-xs">✕</span>}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removePreview(p.id)}
                                                className="absolute top-1 right-1 bg-black/80 hover:bg-black rounded-full w-4 h-4 text-white text-[10px] font-bold flex items-center justify-center"
                                            >
                                                &times;
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* The Modern Chat Input Card */}
                            <form
                                onSubmit={handleChatSubmit}
                                className="relative flex flex-col border border-white/20 rounded-3xl bg-[rgba(255,255,255,0.06)] backdrop-blur-xl shadow-2xl overflow-visible transition-all duration-300 focus-within:border-purple-500/50 focus-within:ring-2 focus-within:ring-purple-500/20"
                            >
                                <Textarea
                                    value={textInput}
                                    onChange={(e) => setTextInput(e.target.value)}
                                    maxLength={MAX_TEXT_LENGTH}
                                    className="w-full bg-transparent text-white placeholder-gray-400 focus:outline-none px-5 sm:px-6 py-4 sm:py-5 resize-none text-base sm:text-lg min-h-[70px] sm:min-h-[85px]"
                                    placeholder={
                                        assistantState === 'listening'
                                            ? "Listening to your voice..."
                                            : ingredients.length > 0
                                                ? "Ask what to cook with these, or describe your mood..."
                                                : "Tell me how you're feeling..."
                                    }
                                    disabled={isLoading}
                                    maxRows={6}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleChatSubmit(e);
                                        }
                                    }}
                                />

                                {/* Bottom Toolbar */}
                                <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-t border-white/10 bg-white/[0.03]">
                                    <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                        {/* Image Upload Button */}
                                        <label
                                            htmlFor="hero-image-upload"
                                            className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer transition-colors"
                                            title="Scan Fridge / Upload Image"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                                <circle cx="8.5" cy="8.5" r="1.5" />
                                                <polyline points="21 15 16 10 5 21" />
                                            </svg>
                                        </label>
                                        <input
                                            ref={fileInputRef}
                                            id="hero-image-upload"
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={handleImageUpload}
                                            className="hidden"
                                        />

                                        {/* Pantry Staples Button */}
                                        <button
                                            type="button"
                                            onClick={handleManualEntryClick}
                                            className={`relative p-2 rounded-full transition-colors ${
                                                ingredients.length > 0 ? 'text-purple-300 bg-purple-950/60' : 'text-gray-400 hover:bg-white/10 hover:text-white'
                                            }`}
                                            title="Add Pantry Ingredients"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                <circle cx="12" cy="7" r="4" />
                                            </svg>
                                            {ingredients.length > 0 && (
                                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                                                    {ingredients.length}
                                                </span>
                                            )}
                                        </button>

                                        {/* Microphone Voice Button */}
                                        <button
                                            type="button"
                                            onClick={handleVoiceClick}
                                            className={`p-2 rounded-full transition-colors ${
                                                assistantState === 'listening'
                                                    ? 'bg-rose-600 text-white animate-pulse'
                                                    : 'text-gray-400 hover:bg-white/10 hover:text-white'
                                            }`}
                                            title="Voice Input"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                                <line x1="12" y1="19" x2="12" y2="23" />
                                                <line x1="8" y1="23" x2="16" y2="23" />
                                            </svg>
                                        </button>

                                        {/* Veg / Non-Veg Dropdown in Chat Layout */}
                                        <DietaryDropdown
                                            dietaryPreference={dietaryPreference}
                                            onSelect={setDietaryPreference}
                                        />
                                    </div>

                                    {/* Send Button */}
                                    <button
                                        type="submit"
                                        disabled={isLoading || (!textInput.trim() && ingredients.length === 0)}
                                        className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-purple-600/30 hover:shadow-purple-600/50 transition-all transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                        title="Send message"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="22" y1="2" x2="11" y2="13" />
                                            <polygon points="22 2 15 22 11 13 2 9" />
                                        </svg>
                                    </button>
                                </div>
                            </form>

                            {/* Prompt Inspiration Chips */}
                            <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center pt-2">
                                {SUGGESTED_PROMPTS.map((p, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleChatSubmit(null, p.text)}
                                        className="text-[11px] sm:text-xs px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 text-gray-300 hover:text-white transition-all backdrop-blur-sm"
                                    >
                                        <span>{p.text}</span>
                                    </button>
                                ))}
                            </div>
                        </motion.div>

                        {/* Footer in Hero State */}
                        <div className="w-full pt-4">
                            <footer className="w-full text-center text-gray-500 text-[11px] sm:text-xs tracking-wider">
                                <div className="flex justify-center flex-col sm:flex-row items-center gap-1.5">
                                    <span>© 2026 MoodBite.Ai Project.</span>
                                    <span className="hidden sm:inline">•</span>
                                    <a
                                        href="https://github.com/Saksham-st12/MoodBite-Version-1.0"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:text-gray-300 transition-colors underline"
                                    >
                                        github.com/Saksham-st12
                                    </a>
                                </div>
                            </footer>
                        </div>
                    </div>
                ) : (
                    // Conversation Feed Layout (When messages exist)
                    <div className="w-full max-w-2xl sm:max-w-3xl mx-auto space-y-5 pb-36">
                        {messages.map((msg, index) => (
                            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'user' ? (
                                    <div className="max-w-lg p-3.5 sm:p-4 rounded-3xl bg-indigo-600/90 text-white shadow-xl backdrop-blur-md">
                                        <p className="text-xs sm:text-sm leading-relaxed">{msg.content}</p>
                                        {msg.ingredients && msg.ingredients.length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-indigo-400/40 flex flex-wrap gap-1 items-center">
                                                <span className="text-[10px] text-indigo-200 font-semibold">Ingredients:</span>
                                                {msg.ingredients.map((ing, i) => (
                                                    <span key={i} className="text-[10px] bg-indigo-800/90 px-2 py-0.5 rounded-full border border-indigo-400/30 capitalize">
                                                        {ing}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : msg.content?.type === 'recipe_detail' ? (
                                    <RecipeDetailCard recipe={msg.content} />
                                ) : msg.content?.type === 'error' ? (
                                    <div className="bg-rose-950/80 border border-rose-500/50 rounded-2xl p-4 max-w-lg text-rose-200 text-xs shadow-xl space-y-1.5 backdrop-blur-md">
                                        <div className="flex items-center gap-2 font-bold text-rose-300 text-sm">
                                            <span>⚠️</span>
                                            <span>{msg.content.title || "Request Notice"}</span>
                                        </div>
                                        <p className="leading-relaxed">{msg.content.reason || msg.content.message}</p>
                                    </div>
                                ) : (msg.content?.type === 'conversational' || msg.content?.isGreeting || msg.content?.isUnfamiliar) ? (
                                    <div className="bg-white/[0.05] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-5 max-w-lg space-y-3.5 shadow-2xl backdrop-blur-xl">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-sm shadow-md">
                                                🍲
                                            </div>
                                            <div>
                                                <h4 className="text-xs sm:text-sm font-semibold text-white">MoodBite Culinary Assistant</h4>
                                                <p className="text-[10px] text-gray-400">Mood & Ingredient Matcher</p>
                                            </div>
                                        </div>
                                        <p className="text-xs sm:text-sm text-gray-200 leading-relaxed font-light">
                                            {msg.content.message || msg.content.greeting}
                                        </p>
                                        {Array.isArray(msg.content.suggestedPrompts) && msg.content.suggestedPrompts.length > 0 && (
                                            <div className="space-y-1.5 pt-2 border-t border-white/10">
                                                <p className="text-[10px] uppercase font-bold tracking-wider text-purple-300">
                                                    Try asking:
                                                </p>
                                                <div className="flex flex-col gap-1.5">
                                                    {msg.content.suggestedPrompts.map((promptText, idx) => (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => handleChatSubmit(null, promptText)}
                                                            className="text-left text-xs px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/5 hover:border-purple-500/30 transition-all flex items-center justify-between group"
                                                        >
                                                            <span>&ldquo;{promptText}&rdquo;</span>
                                                            <span className="text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : msg.content?.choices && msg.content?.choices.length > 0 ? (
                                    <RecipeChoicesCard response={msg.content} onSelectRecipe={handleSelectRecipe} />
                                ) : (
                                    <BotResponseCard response={msg.content} />
                                )}
                            </div>
                        ))}
                        
                        {isLoading && (
                            <div className="flex justify-start">
                                <TypingIndicator />
                            </div>
                        )}
                        
                        <div ref={chatEndRef} />
                    </div>
                )}
            </main>

            {/* Bottom Anchored Input Bar (When in active chat mode) */}
            {hasMessages && (
                <footer className="fixed bottom-0 left-0 w-full p-3 sm:p-4 bg-gradient-to-t from-black via-black/90 to-transparent z-30">
                    <div className="w-full max-w-2xl sm:max-w-3xl mx-auto space-y-2">
                        {/* Ingredients Tag Bar */}
                        {ingredients.length > 0 && (
                            <div className="p-2 bg-gray-950/90 border border-white/10 rounded-2xl backdrop-blur-xl flex items-center justify-between text-xs">
                                <span className="text-purple-300 text-[11px] truncate">
                                    🛒 Pantry ({ingredients.length}): {ingredients.slice(0, 3).join(', ')}{ingredients.length > 3 ? '...' : ''}
                                </span>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        type="button"
                                        onClick={handleManualEntryClick}
                                        className="text-purple-400 hover:text-purple-300 underline text-[11px]"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIngredients([])}
                                        className="text-gray-400 hover:text-rose-400 text-[11px]"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        )}

                        <form
                            onSubmit={handleChatSubmit}
                            className="relative flex flex-col border border-white/20 rounded-3xl bg-[rgba(255,255,255,0.08)] backdrop-blur-xl shadow-2xl overflow-visible focus-within:border-purple-500/50"
                        >
                            <Textarea
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                maxLength={MAX_TEXT_LENGTH}
                                className="w-full bg-transparent text-white placeholder-gray-400 focus:outline-none px-4 sm:px-5 py-3 sm:py-3.5 resize-none text-sm sm:text-base min-h-[50px]"
                                placeholder={
                                    assistantState === 'listening'
                                        ? "Listening..."
                                        : "Reply with your mood or ingredients..."
                                }
                                disabled={isLoading}
                                maxRows={4}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleChatSubmit(e);
                                    }
                                }}
                            />

                            <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-t border-white/10 bg-white/[0.02]">
                                <div className="flex items-center gap-1 sm:gap-2">
                                    <label
                                        htmlFor="chat-image-upload"
                                        className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer transition-colors"
                                        title="Scan Fridge"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                            <circle cx="8.5" cy="8.5" r="1.5" />
                                            <polyline points="21 15 16 10 5 21" />
                                        </svg>
                                    </label>
                                    <input
                                        id="chat-image-upload"
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleImageUpload}
                                        className="hidden"
                                    />

                                    <button
                                        type="button"
                                        onClick={handleManualEntryClick}
                                        className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
                                        title="Pantry"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                            <circle cx="12" cy="7" r="4" />
                                        </svg>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleVoiceClick}
                                        className={`p-1.5 sm:p-2 rounded-full ${assistantState === 'listening' ? 'bg-rose-600 text-white animate-pulse' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
                                        title="Voice Input"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                        </svg>
                                    </button>

                                    {/* In-Chat Veg/Non-Veg Dropdown */}
                                    <DietaryDropdown
                                        dietaryPreference={dietaryPreference}
                                        onSelect={setDietaryPreference}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading || (!textInput.trim() && ingredients.length === 0)}
                                    className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md active:scale-95 disabled:opacity-40"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="22" y1="2" x2="11" y2="13" />
                                        <polygon points="22 2 15 22 11 13 2 9" />
                                    </svg>
                                </button>
                            </div>
                        </form>
                    </div>
                </footer>
            )}

            {/* Viewport-level Ingredient Input Overlay */}
            {inputMode === 'ingredients' && (
                <InputOverlay
                    initialIngredients={ingredients}
                    dietaryPreference={dietaryPreference}
                    onSubmit={handleOverlaySubmit}
                    onClose={() => setInputMode(null)}
                />
            )}
        </div>
    );
}