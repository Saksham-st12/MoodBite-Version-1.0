-- db/schema.sql
-- MoodBite AI PostgreSQL Schema (Supabase)
-- Enforces Row Level Security (RLS) and affective privacy guarantees.

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- Table 1: recommendation_history
-- Records recommendation interactions while maintaining affective privacy:
-- Raw user prompts and sensitive emotional disclosures are NEVER persisted.
-- Only structured culinary attributes (food mood, top choice, diet) are saved.
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.recommendation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    culinary_mood TEXT NOT NULL,
    suggested_food TEXT NOT NULL,
    dietary_type TEXT NOT NULL CHECK (dietary_type IN ('veg', 'non-veg')),
    choices_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_recommendation_history_user_id 
    ON public.recommendation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_history_created_at 
    ON public.recommendation_history(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.recommendation_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recommendation_history:
-- Authenticated users can only read their own recommendations
CREATE POLICY "Users can view their own recommendations"
    ON public.recommendation_history
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Authenticated users can insert their own recommendation logs
CREATE POLICY "Users can insert their own recommendations"
    ON public.recommendation_history
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- ====================================================================
-- Table 2: user_preferences
-- Stores user dietary preferences and optional kitchen defaults
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    dietary_preference TEXT NOT NULL DEFAULT 'veg' CHECK (dietary_preference IN ('veg', 'non-veg', 'all')),
    allergies TEXT[] DEFAULT '{}',
    favorite_cuisines TEXT[] DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index on user_id
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id 
    ON public.user_preferences(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_preferences:
-- Users can read their own preferences
CREATE POLICY "Users can view their own preferences"
    ON public.user_preferences
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert their own preferences"
    ON public.user_preferences
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update their own preferences"
    ON public.user_preferences
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
