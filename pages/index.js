// pages/index.js (Final and Complete)
import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import BotResponseCard from '../components/BotResponseCard';
import RecipeChoicesCard from '../components/RecipeChoicesCard';
import RecipeDetailCard from '../components/RecipeDetailCard';
import TypingIndicator from '../components/TypingIndicator';
import InputOverlay from '../components/InputOverlay';
import Textarea from 'react-textarea-autosize';
import Loader from '../components/Loader';

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

    useEffect(() => {
        const timer = setTimeout(() => { setIsAppLoading(false); }, 3800);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);
    
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
        window.speechSynthesis.speak(utterance);
    };

    const handleImageUpload = (event) => {
        const files = Array.from(event.target.files);
        if (!files || files.length === 0) return;
        const newPreviews = files.map(file => ({
            id: `${file.name}-${Date.now()}`, file,
            previewUrl: URL.createObjectURL(file), status: 'uploading', ingredients: []
        }));
        setFilePreviews(prev => [...prev, ...newPreviews]);
        newPreviews.forEach(preview => {
            fetch('/api/identifyIngredients', {
                method: 'POST', headers: { 'Content-Type': preview.file.type }, body: preview.file,
            })
            .then(res => { if (!res.ok) throw new Error('Analysis failed'); return res.json(); })
            .then(data => {
                setIngredients(prev => [...new Set([...prev, ...data.ingredients])]);
                setFilePreviews(prev => prev.map(p => p.id === preview.id ? { ...p, status: 'success', ingredients: data.ingredients } : p));
            })
            .catch(err => {
                console.error(err);
                setFilePreviews(prev => prev.map(p => p.id === preview.id ? { ...p, status: 'error' } : p));
            });
        });
    };
    
    const handleChatSubmit = async (e, textOverride = null, ingredientsOverride = null) => {
        if (e) e.preventDefault();
        const activeIngredients = ingredientsOverride || ingredients;
        let textToSubmit = textOverride || textInput;
        if (!textToSubmit.trim()) {
            if (activeIngredients && activeIngredients.length > 0) {
                textToSubmit = `I have ${activeIngredients.join(', ')}. What delicious dishes can I cook?`;
            } else {
                return;
            }
        }
        const userMessage = { 
            role: 'user', 
            content: textToSubmit,
            ingredients: activeIngredients && activeIngredients.length > 0 ? [...activeIngredients] : []
        };
        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        setTextInput('');
        setFilePreviews([]);
        try {
            const response = await fetch('/api/suggestFood', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    text: textToSubmit, 
                    ingredients: activeIngredients, 
                    dietaryPreference 
                }),
            });
            const data = await response.json();
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
            const errorContent = {
                predictedMood: "Error", suggestedFood: "Request Failed",
                reason: "Sorry, the AI assistant failed to respond. Please try again.",
                confidenceScore: 0
            };
            const errorMessage = { role: 'bot', content: errorContent };
            setMessages(prev => [...prev, errorMessage]);
            speak(errorContent.reason);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectRecipe = async (recipe) => {
        const userMsg = { role: 'user', content: `I'd like to cook ${recipe.name}! Show me the complete making process.` };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const response = await fetch('/api/getRecipeDetails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dishName: recipe.name,
                    ingredients,
                    dietaryPreference: recipe.dietaryType || dietaryPreference
                }),
            });

            const data = await response.json();
            const botMessage = { role: 'bot', content: { ...data, type: 'recipe_detail' } };
            setMessages(prev => [...prev, botMessage]);
            speak(`Here is the complete recipe and cooking guide for ${data.dishName}.`);
        } catch (error) {
            console.error("Error fetching recipe details:", error);
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
                    ingredientsList: (ingredients || []).map(item => ({ item, amount: "As needed" })),
                    instructions: [
                        "Step 1: Prep and chop your ingredients.",
                        "Step 2: Heat pan with oil/ghee and temper with aromatic spices.",
                        "Step 3: Sauté and simmer gently until fully cooked.",
                        "Step 4: Garnish and serve hot."
                    ],
                    chefTips: "Simmer gently to lock in natural moisture and flavors.",
                    emotionalTherapy: "Warm comfort food stimulates mood-elevating neurotransmitters."
                }
            };
            setMessages(prev => [...prev, fallbackMessage]);
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
            setFilePreviews([]);
            recognitionRef.current.start();
        }
    };

    const handleInterrupt = () => {
        if (assistantState === 'speaking') {
            window.speechSynthesis.cancel();
            setAssistantState('idle');
        }
    };
    
    const removePreview = (idToRemove) => {
        setFilePreviews(prev => prev.filter(p => p.id !== idToRemove));
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

    return (
        <div className="w-full h-screen bg-black flex flex-col text-white" onClick={handleInterrupt}>
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] -z-10"></div>
            
            <header className="relative z-20 p-4 border-b border-gray-700/50 text-center backdrop-blur-sm flex-shrink-0">
                <h1 className="text-2xl font-bold tracking-wider">MOODBITE AI</h1>
                <p className="text-xs text-gray-400 mt-1">Final Year Project By Saksham</p>
            </header>
            
            {/* Top-Right Veg / Non-Veg Switch */}
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
                    >
                        <span className="w-3.5 h-3.5 border-2 border-red-500 rounded-[2px] flex items-center justify-center p-[1px] bg-black/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        </span>
                        <span>Non-Veg</span>
                    </button>
                </div>
            </div>
            
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
                        ) : msg.content?.choices && msg.content?.choices.length > 0 ? (
                            <RecipeChoicesCard response={msg.content} onSelectRecipe={handleSelectRecipe} />
                        ) : (
                            <BotResponseCard response={msg.content} />
                        )}
                    </div>
                ))}
                {isLoading && <TypingIndicator />}
                <div ref={chatEndRef} />
            </main>
            
            <footer className="relative z-20 w-full max-w-3xl mx-auto p-2 sm:p-4 sm:pt-2" onClick={e => e.stopPropagation()}>
                {/* Active Ingredients Tag Bar */}
                {ingredients.length > 0 && (
                    <div className="bg-gray-900/90 border border-purple-500/40 rounded-xl p-2.5 mb-2 backdrop-blur-md shadow-md flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-purple-300 font-semibold flex items-center gap-1.5">
                                <span className="text-sm">🥘</span>
                                <span>Pantry Ingredients ({ingredients.length})</span>
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleManualEntryClick}
                                    className="text-purple-400 hover:text-purple-200 text-[11px] font-medium underline transition-colors"
                                >
                                    + Edit / Add More
                                </button>
                                <span className="text-gray-600">|</span>
                                <button
                                    type="button"
                                    onClick={() => setIngredients([])}
                                    className="text-gray-400 hover:text-red-400 text-[11px] font-medium transition-colors"
                                >
                                    Clear All
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

                <AnimatePresence>
                    {filePreviews.length > 0 && (
                        <motion.div 
                            className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mb-2"
                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                            {filePreviews.map(p => (
                                <motion.div key={p.id} className="relative aspect-square rounded-lg overflow-hidden group" layout>
                                    <img src={p.previewUrl} className="w-full h-full object-cover" alt="Ingredient preview" />
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                        {p.status === 'uploading' && <div className="w-5 h-5 border-t-2 border-white rounded-full animate-spin"></div>}
                                        {p.status === 'success' && <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                                        {p.status === 'error' && <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>}
                                    </div>
                                    {p.status === 'success' && p.ingredients.length > 0 && (
                                        <div className="absolute bottom-0 left-0 w-full p-1 bg-black/70 text-center"><p className="text-white text-[10px] truncate">{p.ingredients.join(', ')}</p></div>
                                    )}
                                    <button onClick={() => removePreview(p.id)} className="absolute top-0.5 right-0.5 bg-black/50 rounded-full p-0 text-white leading-none hidden group-hover:block">&times;</button>
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
                        <input id="image-upload-input" type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
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
                        className="flex-grow bg-transparent text-white placeholder-gray-400 focus:outline-none px-2 py-1.5 resize-none"
                        placeholder={
                            assistantState === 'listening' 
                                ? "Listening..." 
                                : ingredients.length > 0 
                                    ? "Ask what to cook with these, or share your mood..." 
                                    : "Tell me how you're feeling or add ingredients..."
                        }
                        disabled={isLoading}
                        maxRows={5}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(e); } }}
                    />
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        <button type="button" onClick={handleVoiceClick} className={`p-2 rounded-full hover:bg-gray-700 transition-colors ${assistantState === 'listening' ? 'bg-red-600 hover:bg-red-700' : ''}`} title="Voice input">
                            {assistantState === 'listening' 
                                ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                : <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z"/><path d="M5.5 11.5a5.5 5.5 0 0011 0h-1.5a4 4 0 01-8 0H5.5z"/><path d="M3 10a1 1 0 001 1v1a7 7 0 0014 0v-1a1 1 0 10-2 0v1a5 5 0 01-10 0v-1a1 1 0 00-1-1z"/></svg>
                            }
                        </button>
                        <button type="submit" className="flex-shrink-0 px-3 sm:px-4 py-2 text-sm font-semibold rounded-full bg-purple-600 text-white hover:bg-purple-700 transition-colors">
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