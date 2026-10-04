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
        return { user, token, error: null };
    } catch (err) {
        console.warn("Server auth verification failed:", err.message);
        return { user: null, token: null, error: err };
    }
}
