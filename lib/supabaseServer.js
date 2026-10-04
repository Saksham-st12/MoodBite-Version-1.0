// lib/supabaseServer.js
// Server-side helper to optionally verify authenticated user from Authorization Bearer token (WP3 & WP4)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

/**
 * Extracts and verifies the authenticated user from the request Authorization header.
 * Returns null if the request is from an unauthenticated guest or if Supabase is unconfigured.
 * @param {import('next').NextApiRequest} req
 * @returns {Promise<{ user: object|null, token: string|null, error: any|null }>}
 */
export async function getAuthenticatedUser(req) {
    if (!supabaseUrl || !supabaseAnonKey || !supabaseUrl.startsWith('https://')) {
        return { user: null, token: null, error: null };
    }

    const authHeader = req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { user: null, token: null, error: null };
    }

    const token = authHeader.split(' ')[1]?.trim();
    if (!token) {
        return { user: null, token: null, error: null };
    }

    try {
        const client = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false }
        });
        const { data: { user }, error } = await client.auth.getUser(token);
        if (error || !user) {
            return { user: null, token: null, error };
        }
        return { user, token, client, error: null };
    } catch (err) {
        console.warn("Server auth verification failed:", err.message);
        return { user: null, token: null, client: null, error: err };
    }
}

/**
 * Creates an authenticated Supabase client for a specific user token.
 * Enforces PostgreSQL Row Level Security (RLS) policies.
 */
export function getAuthenticatedClient(token) {
    if (!supabaseUrl || !supabaseAnonKey || !token) return null;
    return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: {
                Authorization: `Bearer ${token}`
            }
        },
        auth: { persistSession: false }
    });
}

/**
 * Reads user dietary preferences from user_preferences table or user_metadata.
 * @param {object} user 
 * @param {string} token 
 * @returns {Promise<object|null>}
 */
export async function getUserPreferences(user, token) {
    if (!user || !token) return null;
    try {
        const client = getAuthenticatedClient(token);
        if (!client) return null;

        // Try reading from user_preferences table
        const { data, error } = await client
            .from('user_preferences')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

        if (error) {
            // Table may not exist yet in local development; fall back to user_metadata
            return user.user_metadata?.preferences || null;
        }
        return data || user.user_metadata?.preferences || null;
    } catch (err) {
        return user.user_metadata?.preferences || null;
    }
}

/**
 * Saves recommendation history to Supabase database.
 * AFFECTIVE PRIVACY GUARANTEE: Never persists raw user free-text or emotional disclosures.
 * Only records structured culinary attributes: culinaryMood, suggestedFood, dietaryType.
 * @param {object} params
 */
export async function saveRecommendationHistory({ user, token, culinaryMood, suggestedFood, dietaryType, choicesCount }) {
    if (!user || !token) return;
    try {
        const client = getAuthenticatedClient(token);
        if (!client) return;

        // Non-blocking write to recommendation_history table
        await client
            .from('recommendation_history')
            .insert({
                user_id: user.id,
                culinary_mood: culinaryMood,
                suggested_food: suggestedFood,
                dietary_type: dietaryType,
                choices_count: choicesCount || 1,
                created_at: new Date().toISOString()
            })
            .catch(() => {});
    } catch (err) {
        // Silent catch so database latency never fails recommendation responses
    }
}
