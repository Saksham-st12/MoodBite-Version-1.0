// pages/about.js
import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

export default function AboutPage() {
    const { user, signOut } = useAuth();
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    return (
        <div className="min-h-screen w-full bg-black text-white relative overflow-x-hidden selection:bg-indigo-500/30 selection:text-white">
            <Head>
                <title>About - MoodBite.ai</title>
                <meta name="description" content="Architecture, taxonomy, and methodology behind MoodBite.ai." />
            </Head>

            {/* Ambient Background Glows */}
            <div className="fixed inset-0 w-full h-full -z-10 bg-gradient-to-br from-gray-950 via-slate-950 to-black pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-indigo-600/10 rounded-full blur-[130px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-purple-600/10 rounded-full blur-[130px]" />
            </div>

            {/* Header Navigation */}
            <nav className="fixed top-0 left-0 w-full p-4 sm:p-6 z-50 flex justify-between items-center bg-black/40 backdrop-blur-md border-b border-white/10">
                <div className="flex items-center space-x-3">
                    {/* Profile Icon Dropdown */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsProfileOpen(!isProfileOpen)}
                            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 flex items-center justify-center text-white transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                            title="Profile & Menu"
                        >
                            {user?.email ? (
                                <span className="font-bold text-sm bg-gradient-to-r from-purple-400 to-indigo-300 bg-clip-text text-transparent">
                                    {user.email.charAt(0).toUpperCase()}
                                </span>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            )}
                        </button>

                        <AnimatePresence>
                            {isProfileOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setIsProfileOpen(false)}
                                    />
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: -5 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: -5 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute left-0 mt-2 w-64 rounded-2xl bg-gray-900/95 border border-white/15 shadow-2xl backdrop-blur-xl p-2 z-50 text-xs divide-y divide-white/10"
                                    >
                                        <div className="p-2.5">
                                            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Account</p>
                                            <p className="text-sm font-semibold text-white truncate mt-0.5">
                                                {user ? (user.user_metadata?.full_name || user.email) : 'Guest Explorer'}
                                            </p>
                                            <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                                {user ? 'Authenticated' : 'Guest Mode'}
                                            </span>
                                        </div>

                                        <div className="py-1">
                                            <Link
                                                href="/"
                                                onClick={() => setIsProfileOpen(false)}
                                                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                                            >
                                                <span>🏠</span>
                                                <span>Home</span>
                                            </Link>
                                            <Link
                                                href="/about"
                                                onClick={() => setIsProfileOpen(false)}
                                                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-white font-medium bg-white/10"
                                            >
                                                <span>ℹ️</span>
                                                <span>About MoodBite</span>
                                            </Link>
                                            <a
                                                href="https://github.com/Saksham-st12/MoodBite-Version-1.0"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                                            >
                                                <span>📜</span>
                                                <span>GitHub Repository</span>
                                            </a>
                                        </div>

                                        <div className="pt-1">
                                            {user ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        signOut();
                                                        setIsProfileOpen(false);
                                                    }}
                                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors text-left font-medium"
                                                >
                                                    <span>🚪</span>
                                                    <span>Sign Out</span>
                                                </button>
                                            ) : (
                                                <Link
                                                    href="/login"
                                                    onClick={() => setIsProfileOpen(false)}
                                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-indigo-300 hover:text-indigo-200 hover:bg-indigo-500/10 transition-colors font-medium"
                                                >
                                                    <span>🔑</span>
                                                    <span>Sign In / Login</span>
                                                </Link>
                                            )}
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>

                    <Link href="/" className="cursor-pointer">
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-white/90 to-white/70 hover:to-white transition-all">
                            MoodBite.Ai
                        </h1>
                    </Link>
                    <div className="hidden sm:inline-flex text-[11px] text-white/60 border border-white/15 px-2.5 py-0.5 rounded-full backdrop-blur-md bg-white/5 font-mono">
                        v1.0
                    </div>
                </div>

                <div className="flex items-center space-x-2 sm:space-x-4 bg-white/5 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-full text-xs sm:text-sm">
                    <Link href="/" className="text-white/60 hover:text-white transition-colors px-2 py-1">
                        Home
                    </Link>
                    <Link href="/about" className="text-white font-semibold bg-white/10 px-3 py-1 rounded-full">
                        About
                    </Link>
                </div>
            </nav>

            {/* Main Content Container */}
            <main className="relative z-10 pt-28 sm:pt-36 pb-20 px-4 sm:px-6 max-w-4xl mx-auto space-y-16">
                
                {/* Hero Section */}
                <section className="text-center space-y-6">
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight">
                            Understanding <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300">MoodBite.Ai</span>
                        </h2>
                        <p className="text-sm sm:text-base md:text-lg text-gray-300 leading-relaxed max-w-2xl mx-auto mt-4 font-light">
                            MoodBite AI is an intelligent culinary assistant engineered to pair natural human emotion and available kitchen ingredients with culturally authentic Indian cooking. Built with a deterministic model hierarchy, RoBERTa GoEmotions inference, and strict dietary keyword verification.
                        </p>
                    </motion.div>

                    {/* Disclaimer Banner */}
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 sm:p-5 max-w-2xl mx-auto flex items-start text-left gap-3.5 shadow-lg backdrop-blur-md">
                        <span className="text-2xl flex-shrink-0">⚠️</span>
                        <div>
                            <h4 className="text-amber-300 font-bold text-xs sm:text-sm uppercase tracking-wide">
                                Engineering & Culinary Scope Disclaimer
                            </h4>
                            <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                                MoodBite analyzes linguistic affective patterns and pantry ingredients to recommend comforting food styles (flavor, warmth, and texture). It is an exploratory culinary engine, not a clinical diagnostic tool or psychological therapy.
                            </p>
                        </div>
                    </div>
                </section>

                {/* System Architecture Diagram */}
                <section className="space-y-6">
                    <div className="flex items-center space-x-3 border-b border-white/10 pb-4">
                        <span className="text-2xl">🛠️</span>
                        <h3 className="text-xl sm:text-2xl font-light text-white tracking-wide">System Architecture & Processing Pipeline</h3>
                    </div>

                    <div className="relative p-5 sm:p-7 bg-white/[0.04] border border-white/10 rounded-3xl backdrop-blur-xl overflow-hidden shadow-2xl">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center text-center">
                            
                            {/* Step 1 */}
                            <div className="bg-black/50 p-4 rounded-2xl border border-white/10 space-y-1">
                                <div className="text-[10px] text-gray-400 uppercase font-semibold">1. Input Layer</div>
                                <div className="font-mono text-xs text-purple-300 break-words">&quot;I feel exhausted after work&quot;</div>
                                <div className="text-[10px] text-gray-500">+ Kitchen Pantry</div>
                            </div>

                            <div className="text-gray-500 text-lg hidden md:block">→</div>

                            {/* Step 2 */}
                            <div className="bg-indigo-950/30 p-4 rounded-2xl border border-indigo-500/30 space-y-1">
                                <div className="text-[10px] text-indigo-300 uppercase font-bold">2. Emotion Classifier</div>
                                <div className="text-xs font-semibold text-white">RoBERTa GoEmotions</div>
                                <div className="text-[10px] text-gray-400">Mapped to 9 Culinary Moods</div>
                            </div>

                            <div className="text-gray-500 text-lg hidden md:block">→</div>

                            {/* Step 3 */}
                            <div className="bg-purple-950/30 p-4 rounded-2xl border border-purple-500/30 space-y-1">
                                <div className="text-[10px] text-purple-300 uppercase font-bold">3. Reasoning Engine</div>
                                <div className="text-xs font-semibold text-white">Gemini 3.5 Flash Lite</div>
                                <div className="text-[10px] text-gray-400">Secondary & Claude Fallback</div>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
                                <span>🛡️</span>
                                <span>Deterministic Post-Processing: Meat-keyword heuristic elimination + pantry occurrence validation</span>
                            </span>
                            <span className="text-[11px] text-gray-500 font-mono">Total Deadline Budget: 12.0s</span>
                        </div>
                    </div>
                </section>

                {/* Verified Test Cases Table */}
                <section className="space-y-6">
                    <div className="flex items-center space-x-3 border-b border-white/10 pb-4">
                        <span className="text-2xl">🧪</span>
                        <h3 className="text-xl sm:text-2xl font-light text-white tracking-wide">Validated Emotion to Culinary Mood Pairs</h3>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md shadow-xl">
                        <table className="w-full text-left border-collapse text-xs sm:text-sm">
                            <thead>
                                <tr className="border-b border-white/10 text-[11px] text-gray-400 uppercase tracking-wider bg-white/5">
                                    <th className="py-3 px-4">User Prompt</th>
                                    <th className="py-3 px-4">Detected Emotion</th>
                                    <th className="py-3 px-4">Food Mood</th>
                                    <th className="py-3 px-4">Sample Pairing</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                <tr className="hover:bg-white/5 transition-colors">
                                    <td className="py-3 px-4 text-gray-300">&quot;I am really angry that my flight was cancelled.&quot;</td>
                                    <td className="py-3 px-4 text-rose-300 font-semibold">Anger</td>
                                    <td className="py-3 px-4 text-yellow-300 font-medium">Calming</td>
                                    <td className="py-3 px-4 text-emerald-300">Cooling Jeera Pulao & Mint Raita</td>
                                </tr>
                                <tr className="hover:bg-white/5 transition-colors">
                                    <td className="py-3 px-4 text-gray-300">&quot;I have an important interview tomorrow morning.&quot;</td>
                                    <td className="py-3 px-4 text-amber-300 font-semibold">Fear / Stress</td>
                                    <td className="py-3 px-4 text-yellow-300 font-medium">Grounding</td>
                                    <td className="py-3 px-4 text-emerald-300">Warm Moong Dal Khichdi</td>
                                </tr>
                                <tr className="hover:bg-white/5 transition-colors">
                                    <td className="py-3 px-4 text-gray-300">&quot;I won the college coding hackathon!&quot;</td>
                                    <td className="py-3 px-4 text-emerald-300 font-semibold">Joy / Excitement</td>
                                    <td className="py-3 px-4 text-yellow-300 font-medium">Joyful / Energized</td>
                                    <td className="py-3 px-4 text-emerald-300">Aromatic Vegetable Dum Biryani</td>
                                </tr>
                                <tr className="hover:bg-white/5 transition-colors">
                                    <td className="py-3 px-4 text-gray-300">&quot;Feeling heartbroken and lonely today.&quot;</td>
                                    <td className="py-3 px-4 text-blue-300 font-semibold">Sadness</td>
                                    <td className="py-3 px-4 text-yellow-300 font-medium">Comforting</td>
                                    <td className="py-3 px-4 text-emerald-300">Home-style Dal Tadka & Phulkas</td>
                                </tr>
                                <tr className="hover:bg-white/5 transition-colors">
                                    <td className="py-3 px-4 text-gray-300">&quot;I am so tired and drained after exams.&quot;</td>
                                    <td className="py-3 px-4 text-purple-300 font-semibold">Tiredness (Keyword)</td>
                                    <td className="py-3 px-4 text-yellow-300 font-medium">Restorative</td>
                                    <td className="py-3 px-4 text-emerald-300">Quick 15-min Lemon Poha</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Project Details & Author Section */}
                <section className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-purple-950/20 via-indigo-950/20 to-black border border-white/10 space-y-4 shadow-xl">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <span>🎓</span>
                        <span>Project Information & Credits</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                        <strong>MoodBite AI</strong> is developed as a final year capstone project by <strong>Saksham Tiwari</strong> (<a href="https://github.com/Saksham-st12" target="_blank" rel="noopener noreferrer" className="text-purple-300 underline hover:text-white">@Saksham-st12</a>). The project explores affective computing, prompt engineering injection safety, deterministic dietary validation, and multimodal computer vision.
                    </p>
                    <div className="pt-2 flex flex-wrap gap-3">
                        <a
                            href="https://github.com/Saksham-st12/MoodBite-Version-1.0"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all shadow-md"
                        >
                            <span>⭐</span>
                            <span>View Source Code on GitHub</span>
                        </a>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white transition-all shadow-md"
                        >
                            <span>👨‍🍳</span>
                            <span>Try MoodBite Now</span>
                        </Link>
                    </div>
                </section>

                {/* Footer */}
                <footer className="w-full pt-8 pb-4 text-center text-gray-500 text-xs tracking-wider border-t border-white/10">
                    <div className="flex justify-center flex-col sm:flex-row items-center gap-2">
                        <span>© 2026 MoodBite.Ai Project.</span>
                        <span className="hidden sm:block">•</span>
                        <span>Built by Saksham Tiwari</span>
                        <span className="hidden sm:block">•</span>
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
            </main>
        </div>
    );
}
