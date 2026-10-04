// pages/login.js
// Supabase Authentication Page for MoodBite AI (WP3)
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
    const router = useRouter();
    const { user, isConfigured, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, loading: authLoading } = useAuth();

    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        // Clear messages when switching tabs
        setErrorMsg('');
        setSuccessMsg('');
    }, [isSignUp]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');
        setLoading(true);

        try {
            if (isSignUp) {
                if (password.length < 6) {
                    throw new Error("Password must be at least 6 characters long.");
                }
                const data = await signUpWithEmail(email, password, fullName);
                if (data?.user && !data?.session) {
                    setSuccessMsg("Account created! Check your email inbox to confirm your account before signing in.");
                } else {
                    setSuccessMsg("Account created and signed in successfully! Redirecting...");
                    setTimeout(() => router.push('/'), 1200);
                }
            } else {
                await signInWithEmail(email, password);
                setSuccessMsg("Signed in successfully! Redirecting...");
                setTimeout(() => router.push('/'), 1000);
            }
        } catch (err) {
            console.error("Auth error:", err);
            setErrorMsg(err.message || "Authentication failed. Please check your credentials.");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setErrorMsg('');
        setLoading(true);
        try {
            await signInWithGoogle();
        } catch (err) {
            console.error("Google Auth error:", err);
            setErrorMsg(err.message || "Failed to initiate Google sign-in.");
            setLoading(false);
        }
    };

    const handleContinueAsGuest = () => {
        router.push('/');
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col justify-between relative overflow-hidden selection:bg-purple-500 selection:text-white">
            <Head>
                <title>{isSignUp ? "Create Account" : "Sign In"} | MoodBite AI</title>
                <meta name="description" content="Sign in to MoodBite AI for personalized emotion-aware culinary recommendations." />
            </Head>

            {/* Ambient Background Gradient */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.35),rgba(0,0,0,0))] pointer-events-none -z-10" />

            {/* Navigation Header */}
            <header className="p-4 sm:p-6 flex items-center justify-between max-w-5xl mx-auto w-full z-10">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors py-1.5 px-3 rounded-lg hover:bg-gray-800/60"
                >
                    <span>←</span>
                    <span>Back to Assistant</span>
                </Link>

                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs text-gray-400 font-mono">Supabase Auth</span>
                </div>
            </header>

            {/* Main Auth Container */}
            <main className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10">
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="w-full max-w-md bg-gray-900/90 border border-gray-800/80 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl relative"
                >
                    {/* Brand Heading */}
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/30 text-2xl mb-3 shadow-inner">
                            🍲
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-white">
                            {user ? "Your Profile" : (isSignUp ? "Join MoodBite AI" : "Welcome Back")}
                        </h1>
                        <p className="text-xs sm:text-sm text-gray-400 mt-1">
                            {user
                                ? `Logged in as ${user.email}`
                                : "Sign in to save your taste preferences and get personalized recipes."}
                        </p>
                    </div>

                    {/* Supabase Unconfigured Warning Notice */}
                    {!isConfigured && (
                        <div className="mb-5 bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 text-xs text-amber-200 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-amber-300">
                                <span>⚙️</span>
                                <span>Supabase Not Yet Configured</span>
                            </div>
                            <p className="text-amber-200/90 leading-relaxed text-[11px]">
                                Add <code className="bg-black/50 px-1 py-0.5 rounded text-amber-300">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="bg-black/50 px-1 py-0.5 rounded text-amber-300">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your <code className="bg-black/50 px-1 py-0.5 rounded text-amber-300">.env.local</code> to enable live authentication.
                            </p>
                        </div>
                    )}

                    {/* Already Authenticated State */}
                    {user ? (
                        <div className="space-y-4">
                            <div className="bg-gray-800/70 border border-gray-700/60 rounded-xl p-4 text-center space-y-2">
                                <div className="w-12 h-12 rounded-full bg-purple-600 text-white font-bold text-lg flex items-center justify-center mx-auto shadow-md">
                                    {user.email?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <p className="font-semibold text-white text-sm">{user.user_metadata?.full_name || 'Chef Explorer'}</p>
                                <p className="text-xs text-gray-400 font-mono">{user.email}</p>
                            </div>

                            <button
                                type="button"
                                onClick={() => router.push('/')}
                                className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2"
                            >
                                <span>Continue to MoodBite AI</span>
                                <span>→</span>
                            </button>

                            <button
                                type="button"
                                onClick={signOut}
                                className="w-full py-2 px-4 bg-gray-800/80 hover:bg-gray-800 text-gray-300 hover:text-white text-xs font-medium rounded-xl border border-gray-700/50 transition"
                            >
                                Sign Out
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Tab Switcher */}
                            <div className="flex bg-gray-950/80 p-1 rounded-xl border border-gray-800/80 mb-5">
                                <button
                                    type="button"
                                    onClick={() => setIsSignUp(false)}
                                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                        !isSignUp
                                            ? 'bg-purple-600 text-white shadow-md'
                                            : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    Sign In
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsSignUp(true)}
                                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                        isSignUp
                                            ? 'bg-purple-600 text-white shadow-md'
                                            : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    Create Account
                                </button>
                            </div>

                            {/* Notifications */}
                            <AnimatePresence>
                                {errorMsg && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mb-4 p-3 bg-red-950/60 border border-red-500/50 rounded-xl text-xs text-red-200 flex items-start gap-2"
                                    >
                                        <span className="flex-shrink-0">⚠️</span>
                                        <span>{errorMsg}</span>
                                    </motion.div>
                                )}

                                {successMsg && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mb-4 p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-xs text-emerald-200 flex items-start gap-2"
                                    >
                                        <span className="flex-shrink-0">✅</span>
                                        <span>{successMsg}</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Credentials Form */}
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {isSignUp && (
                                    <div>
                                        <label className="block text-xs font-medium text-gray-300 mb-1">
                                            Your Name
                                        </label>
                                        <input
                                            type="text"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            placeholder="Chef Saksham"
                                            className="w-full px-3.5 py-2.5 bg-gray-950/90 border border-gray-700/80 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-medium text-gray-300 mb-1">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        className="w-full px-3.5 py-2.5 bg-gray-950/90 border border-gray-700/80 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                                    />
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-xs font-medium text-gray-300">
                                            Password
                                        </label>
                                        {isSignUp && (
                                            <span className="text-[10px] text-gray-400">Min 6 characters</span>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full px-3.5 py-2.5 bg-gray-950/90 border border-gray-700/80 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-200 transition"
                                        >
                                            {showPassword ? "Hide" : "Show"}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || authLoading}
                                    className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800/60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 mt-2"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        <span>{isSignUp ? "Create My Account" : "Sign In with Email"}</span>
                                    )}
                                </button>
                            </form>

                            {/* Divider */}
                            <div className="relative my-5">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-800" />
                                </div>
                                <div className="relative flex justify-center text-[11px] uppercase">
                                    <span className="bg-gray-900 px-2 text-gray-500 font-semibold tracking-wider">
                                        Or Continue With
                                    </span>
                                </div>
                            </div>

                            {/* Google OAuth Button */}
                            <button
                                type="button"
                                onClick={handleGoogleSignIn}
                                disabled={loading || authLoading}
                                className="w-full py-2.5 px-4 bg-gray-800/90 hover:bg-gray-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl border border-gray-700/70 transition flex items-center justify-center gap-2 shadow-sm"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                </svg>
                                <span>Continue with Google</span>
                            </button>

                            {/* Continue as Guest */}
                            <div className="mt-4 pt-4 border-t border-gray-800/80 text-center">
                                <button
                                    type="button"
                                    onClick={handleContinueAsGuest}
                                    className="text-xs text-gray-400 hover:text-purple-300 transition-colors font-medium"
                                >
                                    Skip for now &bull; <span className="underline">Continue as Guest</span>
                                </button>
                            </div>
                        </>
                    )}
                </motion.div>
            </main>

            {/* Footer */}
            <footer className="p-4 text-center text-[11px] text-gray-500 z-10">
                <span>MoodBite AI &bull; Secure Authentication powered by Supabase</span>
            </footer>
        </div>
    );
}
