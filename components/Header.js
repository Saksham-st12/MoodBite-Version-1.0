// components/Header.js
import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

export default function Header({ onOpenPantry, onResetChat }) {
    const { user, signOut } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <header className="relative z-40 w-full px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between bg-black/40 backdrop-blur-md border-b border-white/10 flex-shrink-0">
            {/* Left: ChatGPT-style Profile Icon & Brand Logo */}
            <div className="flex items-center gap-2.5 sm:gap-3">
                {/* Profile Trigger Button */}
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/5 hover:bg-white/15 border border-white/15 flex items-center justify-center text-white transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                        title="Profile & Menu"
                    >
                        {user?.email ? (
                            <span className="font-bold text-xs sm:text-sm bg-gradient-to-r from-purple-400 to-indigo-300 bg-clip-text text-transparent">
                                {user.email.charAt(0).toUpperCase()}
                            </span>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                        )}
                    </button>

                    {/* ChatGPT-style Dropdown Menu */}
                    <AnimatePresence>
                        {isMenuOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setIsMenuOpen(false)}
                                />
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute left-0 mt-2 w-64 rounded-2xl bg-gray-950/95 border border-white/15 shadow-2xl backdrop-blur-2xl p-2 z-50 text-xs divide-y divide-white/10"
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
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (onResetChat) onResetChat();
                                                setIsMenuOpen(false);
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-colors text-left"
                                        >
                                            <span>🏠</span>
                                            <span>New Chat / Home</span>
                                        </button>

                                        <Link
                                            href="/about"
                                            onClick={() => setIsMenuOpen(false)}
                                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                                        >
                                            <span>ℹ️</span>
                                            <span>About MoodBite</span>
                                        </Link>

                                        {onOpenPantry && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onOpenPantry();
                                                    setIsMenuOpen(false);
                                                }}
                                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-colors text-left"
                                            >
                                                <span>🛒</span>
                                                <span>My Pantry Ingredients</span>
                                            </button>
                                        )}

                                        <a
                                            href="https://github.com/Saksham-st12/MoodBite-Version-1.0"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                                        >
                                            <span>📜</span>
                                            <span>GitHub Project</span>
                                        </a>
                                    </div>

                                    <div className="pt-1">
                                        {user ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    signOut();
                                                    setIsMenuOpen(false);
                                                }}
                                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors text-left font-medium"
                                            >
                                                <span>🚪</span>
                                                <span>Sign Out</span>
                                            </button>
                                        ) : (
                                            <Link
                                                href="/login"
                                                onClick={() => setIsMenuOpen(false)}
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

                {/* Logo and Version Badge */}
                <Link href="/" className="flex items-center gap-2 cursor-pointer group">
                    <span className="text-lg sm:text-2xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-white/90 to-white/70 group-hover:to-white transition-all">
                        MoodBite.Ai
                    </span>
                    <span className="text-[10px] sm:text-xs text-white/50 border border-white/10 px-2 sm:px-2.5 py-0.5 rounded-full backdrop-blur-md bg-white/5 font-mono">
                        v3.0
                    </span>
                </Link>
            </div>

            {/* Right: Pill Navigation Bar */}
            <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden sm:flex items-center space-x-1 sm:space-x-3 bg-white/5 backdrop-blur-md border border-white/10 px-3 sm:px-4 py-1 rounded-full text-xs sm:text-sm">
                    <button
                        type="button"
                        onClick={onResetChat}
                        className="text-white font-medium hover:text-purple-300 transition-colors px-2 py-0.5"
                    >
                        Home
                    </button>
                    <Link
                        href="/about"
                        className="text-white/60 hover:text-white transition-colors px-2 py-0.5"
                    >
                        About
                    </Link>
                </div>

                {/* User quick pill on desktop */}
                {user ? (
                    <div className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full text-xs">
                        <span className="text-gray-300 truncate max-w-[120px]">
                            {user.user_metadata?.full_name || user.email?.split('@')[0]}
                        </span>
                        <button
                            type="button"
                            onClick={signOut}
                            className="text-gray-400 hover:text-red-400 text-xs ml-1"
                            title="Sign out"
                        >
                            ✕
                        </button>
                    </div>
                ) : (
                    <Link
                        href="/login"
                        className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all shadow-sm"
                    >
                        <span>Sign In</span>
                    </Link>
                )}
            </div>
        </header>
    );
}
