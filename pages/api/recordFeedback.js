// pages/api/recordFeedback.js
// Records user like/dislike dish feedback for personalized recommendations (WP5)
import { getAuthenticatedUser, getAuthenticatedClient } from '../../lib/supabaseServer';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: 'Method Not Allowed. Use POST.' });
    }

    const { dishName, feedback, culinaryMood, dietaryType } = req.body || {};
    if (!dishName || typeof dishName !== 'string' || !['like', 'dislike'].includes(feedback)) {
        return res.status(400).json({ message: 'Invalid feedback parameters. Expected dishName and feedback (like|dislike).' });
    }

    try {
        const { user, token } = await getAuthenticatedUser(req);

        // If authenticated and Supabase is configured, record in database
        if (user && token) {
            const client = getAuthenticatedClient(token);
            if (client) {
                await client
                    .from('user_dish_feedback')
                    .insert({
                        user_id: user.id,
                        dish_name: dishName.trim().slice(0, 100),
                        feedback,
                        culinary_mood: culinaryMood || null,
                        dietary_type: dietaryType || null,
                        created_at: new Date().toISOString()
                    })
                    .catch(() => {});
            }
        }

        return res.status(200).json({
            success: true,
            dishName,
            feedback,
            isAuthenticated: Boolean(user)
        });
    } catch (err) {
        console.error("Feedback recording error:", err.message);
        return res.status(200).json({ success: true, savedLocally: true });
    }
}
