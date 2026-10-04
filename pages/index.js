// pages/index.js (Hardened UI, Robust Error Handling, Canvas Resizing & Supabase Auth)
import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import BotResponseCard from '../components/BotResponseCard';
import RecipeChoicesCard from '../components/RecipeChoicesCard';
import RecipeDetailCard from '../components/RecipeDetailCard';
import TypingIndicator from '../components/TypingIndicator';
import InputOverlay from '../components/InputOverlay';
import Textarea from 'react-textarea-autosize';
import Loader from '../components/Loader';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';

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
        err.retryAfter = Number(res.headers.get('Retry-After')) || null;
        throw err;
    }
    return data;
}

/**
 * Resizes an image file on an HTML5 canvas before upload to ensure it is under 5MB and quick to process (P0.3)
 */
function resizeImageOnCanvas(file, maxDimension = 1024, quality = 0.85) {
    return new Promise((resolve) => {
        // If image is already small (< 1.5MB), avoid extra work
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
    const [dietaryPreference, setDietaryPreference] = useState('veg'); // 'veg' | 'non-veg'
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
    const { user, session, signOut } = useAuth();

    // Splash Screen: Displayed once per browser session (P1)
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

    const handleSkipLoader = () => {
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('moodbite_splash_seen', 'true');
        }
        setIsAppLoading(false);
    };

    // Auto-scroll chat to latest message
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
        // Prioritize natural speech voices if available in Chrome/Edge
        const voice = voices.current.find(v => v.lang === currentLang && v.name.includes('Google'));
        if (voice) utterance.voice = voice;
        utterance.onend = () => setAssistantState('idle');
        utterance.onerror = () => setAssistantState('idle');
        window.speechSynthesis.speak(utterance);
    };

    // Client-side image upload with canvas resizing and URL revocation (P0.3)
    const handleImageUpload = async (event) => {
        const files = Array.from(event.target.files);
        // Reset file input value so re-selecting the same file fires onChange cleanly
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (!files || files.length === 0) return;

        const newPreviews = files.map(file => ({
            id: `${file.name}-${Date.now()}-${Math.random()}`,
            file,
            previewUrl: URL.createObjectURL(file),
            status: 'uploading',
            ingredients: [],
            errorMessage: null
        }));

        setFilePreviews(prev => [...prev, ...newPreviews]);

        for (const preview of newPreviews) {
            try {
                // Resize image to ensure it is bounded (< 1024px, < 5MB)
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
                // Deduplicate and cap to 25 ingredients
                setIngredients(prev => [...new Set([...prev, ...extracted])].slice(0, 25));
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
    
    // Chat Submit with HTTP Error Guarding and Friendly Feedback (P0.2)
    const handleChatSubmit = async (e, textOverride = null, ingredientsOverride = null) => {
        if (e) e.preventDefault();
        const activeIngredients = (ingredientsOverride || ingredients).slice(0, 25);
        let textToSubmit = (textOverride || textInput).trim();
        if (!textToSubmit) {
            if (activeIngredients && activeIngredients.length > 0) {
                textToSubmit = `I have ${activeIngredients.join(', ')}. What delicious dishes can I cook?`;
            } else {
                return;
            }
        }

        // Bounded length guard (max 500 chars)
        if (textToSubmit.length > 500) {
            textToSubmit = textToSubmit.slice(0, 500);
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

            if (data.choices && data.choices.length > 0) {
                const narration = (activeIngredients && activeIngredients.length > 0)
                    ? `Here are ${data.choices.length} dishes you can make with your ingredients. Pick one to see the full recipe!`
                    : `Here are ${data.choices.length} comforting dishes tailored to your mood. Pick one to see the full recipe!`;
                speak(narration);
            } else if (data.suggestedFood) {
                speak(`${data.suggestedFood}. ${data.reason}`);
            }
        } catch (error) {
            console.error("suggestFood API error:", error);
            let friendlyError = "Sorry, the AI assistant encountered an error. Please try again.";
            let errorTitle = "Request Notice";

            if (error.status === 429) {
                const waitSecs = error.retryAfter ? `${error.retryAfter} seconds` : 'a few moments';
                friendlyError = `Rate limit reached. Please wait ${waitSecs} before requesting another recommendation.`;
                errorTitle = "Rate Limit Notice";
            } else if (error.status === 400) {
                friendlyError = `Invalid request: ${error.message}`;
            } else if (error.status === 504) {
                friendlyError = "The AI service timed out. Please try again shortly.";
            } else if (error.message) {
                friendlyError = error.message;
            }

            const errorContent = {
                type: 'error',
                title: errorTitle,
                message: friendlyError,
                predictedMood: "Notice",
                suggestedFood: "Request Notice",
                reason: friendlyError
            };
            const errorMessage = { role: 'bot', content: errorContent };
            setMessages(prev => [...prev, errorMessage]);
            speak(friendlyError);
        } finally {
            setIsLoading(false);
        }
    };

    // Recipe Selection with HTTP Error Guarding & Explicit Fallbacks (P0.2)
    const handleSelectRecipe = async (recipe) => {
        const userMsg = { role: 'user', content: `I'd like to cook ${recipe.name}! Show me the complete making process.` };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const data = await postJson('/api/getRecipeDetails', {
                dishName: recipe.name,
                ingredients,
                dietaryPreference,
                dishDietaryType: recipe.dietaryType
            }, session?.access_token);

            const botMessage = { role: 'bot', content: { ...data, type: 'recipe_detail' } };
            setMessages(prev => [...prev, botMessage]);
            speak(`Here is the complete recipe and cooking guide for ${data.dishName}.`);
        } catch (error) {
            console.error("Error fetching recipe details:", error);
            let noticeText = `Could not generate the specific culinary recipe for "${recipe.name}" right now. Here is a basic preparation template.`;
            if (error.status === 429) {
                noticeText = "Rate limit reached. Serving a standard preparation template for this dish.";
            }

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
            speak(`Here is a preparation template for ${recipe.name}.`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVoiceClick = (e) => {
        e.stopPropagation();
        if (!recognitionRef.current) return;
        if (assistantState === 'listening') {
            recognitionRef.current.stop();
        } else {
            setTextInput('');
            clearAllPreviews();
            recognitionRef.current.start();
        }
    };

    const handleInterrupt = () => {
        if (assistantState === 'speaking') {
            window.speechSynthesis.cancel();
            setAssistantState('idle');
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
        const capped = (newIngredients || []).slice(0, 25);
        setIngredients(capped);
        setInputMode(null);
        if (shouldTriggerSearch && capped.length > 0) {
            handleChatSubmit(null, `What dishes can I cook with ${capped.join(', ')}?`, capped);
        }
    };

    if (isAppLoading) {
        return <Loader onSkip={handleSkipLoader} />;
    }

    return (
        <div className="w-full h-screen bg-black flex flex-col text-white" onClick={handleInterrupt}>
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] -z-10"></div>
            
            {/* Header Navigation Bar with Auth Status */}
            <header className="relative z-20 px-4 py-3 border-b border-gray-700/50 backdrop-blur-sm flex items-center justify-between flex-shrink-0">
                <div className="w-20 hidden sm:block"></div>
                <div className="text-center">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-wider">MOODBITE AI</h1>
                    <p className="text-[11px] text-gray-400">Final Year Project By Saksham</p>
                </div>
                <div className="flex items-center gap-2">
                    {user ? (
                        <div className="flex items-center gap-2 bg-gray-900/90 border border-gray-700/80 px-2.5 py-1 rounded-full text-xs shadow-md">
                            <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-[11px]">
                                {user.email?.charAt(0).toUpperCase() || 'U'}
                            </span>
                            <span className="hidden md:inline text-gray-300 max-w-[120px] truncate text-[11px]">
                                {user.user_metadata?.full_name || user.email}
                            </span>
                            <button
                                type="button"
                                onClick={signOut}
                                className="text-gray-400 hover:text-red-400 text-[11px] ml-1 transition"
                                title="Sign out"
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        <Link
                            href="/login"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition shadow-sm shadow-purple-600/30"
                        >
                            <span>👤</span>
                            <span>Sign In</span>
                        </Link>
                    )}
                </div>
            </header>
            
            {/* Top Veg / Non-Veg Indicator Switch */}
            <div className="relative z-20 w-full max-w-4xl mx-auto px-4 pt-3 pb-1 flex justify-end flex-shrink-0">
                <div className="inline-flex items-center bg-gray-900/90 border border-gray-700/80 p-1 rounded-full backdrop-blur-md shadow-lg">
                    <button
                        type="button"
                        onClick={() => setDietaryPreference('veg')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${
                            dietaryPreference === 'veg'
                                ? 'bg-green-600 text-white shadow-[0_0_12px_rgba(34,197,94,0.4)] ring-1 ring-green-400'
                                : 'text-gray-400 hover:text-green-400'
                        }`}
                        title="Vegetarian indicator"
                    >
                        <span className="w-3.5 h-3.5 border-2 border-green-500 rounded-[2px] flex items-center justify-center p-[1px] bg-black/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        </span>
                        <span>Veg</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setDietaryPreference('non-veg')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${
                            dietaryPreference === 'non-veg'
                                ? 'bg-red-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)] ring-1 ring-red-400'
                                : 'text-gray-400 hover:text-red-400'
                        }`}
                        title="Non-Vegetarian indicator"
                    >
                        <span className="w-3.5 h-3.5 border-2 border-red-500 rounded-[2px] flex items-center justify-center p-[1px] bg-black/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        </span>
                        <span>Non-Veg</span>
                    </button>
                </div>
            </div>
            
            {/* Conversation Feed */}
            <main className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'user' ? (
                            <div className="max-w-lg p-3 rounded-2xl bg-blue-600 shadow-lg text-white">
                                <p className="text-sm leading-relaxed">{msg.content}</p>
                                {msg.ingredients && msg.ingredients.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-blue-400/40 flex flex-wrap gap-1 items-center">
                                        <span className="text-[11px] text-blue-200 font-semibold">Kitchen items:</span>
                                        {msg.ingredients.map((ing, i) => (
                                            <span key={i} className="text-[10px] bg-blue-800/90 px-2 py-0.5 rounded-full border border-blue-400/30 capitalize">
                                                {ing}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : msg.content?.type === 'recipe_detail' ? (
                            <RecipeDetailCard recipe={msg.content} />
                        ) : msg.content?.type === 'error' ? (
                            <div className="bg-red-950/80 border border-red-500/60 rounded-2xl p-4 max-w-lg text-red-200 text-xs shadow-xl space-y-1.5 backdrop-blur-md">
                                <div className="flex items-center gap-2 font-bold text-red-300 text-sm">
                                    <span>⚠️</span>
                                    <span>{msg.content.title || "Request Notice"}</span>
                                </div>
                                <p className="leading-relaxed">{msg.content.reason || msg.content.message}</p>
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
            </main>

            {/* Input Bar & Controls */}
            <footer className="p-4 w-full max-w-4xl mx-auto flex-shrink-0">
                {ingredients.length > 0 && (
                    <div className="mb-2 p-2 bg-gray-900/90 border border-gray-700/80 rounded-xl backdrop-blur-md">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-purple-300 font-semibold flex items-center gap-1">
                                <span>🛒 Kitchen Pantry:</span>
                                <span className="text-gray-400 font-normal">({ingredients.length}/25)</span>
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleManualEntryClick}
                                    className="text-[11px] text-purple-400 hover:text-purple-300 underline"
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIngredients([])}
                                    className="text-[11px] text-gray-400 hover:text-red-400 transition-colors"
                                >
                                    Clear all
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                            {ingredients.map((ing, idx) => (
                                <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-purple-950/80 border border-purple-500/40 text-purple-200 shadow-sm"
                                >
                                    <span className="capitalize">{ing}</span>
                                    <button
                                        type="button"
                                        onClick={() => setIngredients(prev => prev.filter((_, i) => i !== idx))}
                                        className="text-purple-400 hover:text-white ml-0.5 font-bold leading-none p-0.5"
                                        title={`Remove ${ing}`}
                                    >
                                        &times;
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Photo Previews */}
                <AnimatePresence>
                    {filePreviews.length > 0 && (
                        <motion.div 
                            className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mb-2"
                            initial={{ opacity: 0, height: 0 }} 
                            animate={{ opacity: 1, height: 'auto' }} 
                            exit={{ opacity: 0, height: 0 }}
                        >
                            {filePreviews.map(p => (
                                <motion.div key={p.id} className="relative aspect-square rounded-lg overflow-hidden group border border-gray-700/60" layout>
                                    <img src={p.previewUrl} className="w-full h-full object-cover" alt="Ingredient preview" />
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                        {p.status === 'uploading' && <div className="w-5 h-5 border-t-2 border-white rounded-full animate-spin"></div>}
                                        {p.status === 'success' && <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                                        {p.status === 'error' && (
                                            <div className="text-center p-1" title={p.errorMessage || 'Failed'}>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400 mx-auto" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                                                <span className="text-[9px] text-red-300 block truncate max-w-[60px]">{p.errorMessage || 'Failed'}</span>
                                            </div>
                                        )}
                                    </div>
                                    {p.status === 'success' && p.ingredients.length > 0 && (
                                        <div className="absolute bottom-0 left-0 w-full p-0.5 bg-black/80 text-center">
                                            <p className="text-white text-[9px] truncate">{p.ingredients.join(', ')}</p>
                                        </div>
                                    )}
                                    <button 
                                        type="button"
                                        onClick={() => removePreview(p.id)} 
                                        className="absolute top-0.5 right-0.5 bg-black/70 hover:bg-black rounded-full w-4 h-4 flex items-center justify-center text-white text-xs font-bold leading-none"
                                        title="Remove photo"
                                    >
                                        &times;
                                    </button>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handleChatSubmit} className="bg-gray-800/80 backdrop-blur-sm border border-gray-600/50 rounded-full p-2 flex items-center gap-2 shadow-lg">
                    <div className="flex-shrink-0 flex items-center gap-1 sm:gap-2">
                       <label htmlFor="image-upload-input" className="p-2 rounded-full hover:bg-gray-700 cursor-pointer transition-colors" title="Upload ingredient images">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a3 3 0 006 0V7a1 1 0 112 0v4a5 5 0 01-10 0V7a3 3 0 013-3z" clipRule="evenodd" /></svg>
                        </label>
                        <input 
                            ref={fileInputRef}
                            id="image-upload-input" 
                            type="file" 
                            accept="image/*" 
                            multiple 
                            onChange={handleImageUpload} 
                            className="hidden" 
                        />
                        <button 
                            type="button" 
                            onClick={handleManualEntryClick} 
                            className={`relative p-2 rounded-full cursor-pointer transition-all ${
                                ingredients.length > 0 
                                    ? 'bg-purple-900/70 text-purple-300 ring-1 ring-purple-500' 
                                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                            }`}
                            title="Write or add ingredients manually"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                                <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                            </svg>
                            {ingredients.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow">
                                    {ingredients.length}
                                </span>
                            )}
                        </button>
                    </div>

                    <Textarea
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        maxLength={500}
                        className="flex-grow bg-transparent text-white placeholder-gray-400 focus:outline-none px-2 py-1.5 resize-none"
                        placeholder={
                            assistantState === 'listening' 
                                ? "Listening..." 
                                : ingredients.length > 0 
                                    ? "Ask what to cook with these, or share your mood..." 
                                    : "Tell me how you're feeling or add ingredients (max 500 chars)..."
                        }
                        disabled={isLoading}
                        maxRows={5}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(e); } }}
                    />

                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        <button 
                            type="button" 
                            onClick={handleVoiceClick} 
                            className={`p-2 rounded-full hover:bg-gray-700 transition-colors ${assistantState === 'listening' ? 'bg-red-600 hover:bg-red-700 animate-pulse' : ''}`} 
                            title="Voice input"
                        >
                            {assistantState === 'listening' 
                                ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                : <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z"/><path d="M5.5 11.5a5.5 5.5 0 0011 0h-1.5a4 4 0 01-8 0H5.5z"/><path d="M3 10a1 1 0 001 1v1a7 7 0 0014 0v-1a1 1 0 10-2 0v1a5 5 0 01-10 0v-1a1 1 0 00-1-1z"/></svg>
                            }
                        </button>
                        <button 
                            type="submit" 
                            className="flex-shrink-0 px-3 sm:px-4 py-2 text-sm font-semibold rounded-full bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                        >
                            <span className="hidden sm:inline">Send</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:hidden" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.428A1 1 0 009.5 16.571V11.5a1 1 0 011-1h.043c.248 0 .45.223.497.472l.5 2.5a1 1 0 001.953.054l1.328-5.313a1 1 0 00-.5-1.157l-7-3.5z" /></svg>
                        </button>
                    </div>
                </form>
            </footer>

            {/* Viewport-level Ingredient Input Overlay */}
            {inputMode === 'ingredients' && (
                <InputOverlay
                    initialIngredients={ingredients}
                    onSubmit={handleOverlaySubmit}
                    onClose={() => setInputMode(null)}
                />
            )}
        </div>
    );
}