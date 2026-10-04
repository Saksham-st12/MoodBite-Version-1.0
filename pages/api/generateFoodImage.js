// pages/api/generateFoodImage.js (Hardened with rate limiting, input validation & timeout)
import { generateFoodImageInputSchema } from '../../lib/validation';
import { applyRateLimit } from '../../lib/rateLimit';

const PEXELS_TIMEOUT_MS = 8000;

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: 'Method Not Allowed. Use GET.' });
    }

    // WP1.5: Isolated Per-Route Rate Limiting (Keyed by IP + routeKey)
    if (applyRateLimit(req, res, { routeKey: 'generateFoodImage', maxRequests: 40, windowMs: 60000 })) {
        return;
    }

    // WP1.2 & Zod 4 compatibility: Input Validation
    const validationResult = generateFoodImageInputSchema.safeParse(req.query);
    if (!validationResult.success) {
        return res.status(400).json({
            error: 'Invalid input',
            details: (validationResult.error.issues || validationResult.error.errors || []).map(e => e.message)
        });
    }

    const { foodName } = validationResult.data;
    const apiKey = process.env.PEXELS_API_KEY?.trim();

    if (!apiKey) {
        return res.status(503).json({ error: 'Image service unconfigured. Missing PEXELS_API_KEY.' });
    }

    const query = `${foodName} indian food`;
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PEXELS_TIMEOUT_MS);

    try {
        const pexelsResponse = await fetch(url, {
            headers: { Authorization: apiKey },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!pexelsResponse.ok) {
            throw new Error(`Pexels API HTTP ${pexelsResponse.status}`);
        }

        const result = await pexelsResponse.json();

        if (!result.photos || result.photos.length === 0) {
            return res.status(404).json({ error: 'No image found for this dish.' });
        }

        const imageUrl = result.photos[0].src?.large || result.photos[0].src?.medium;
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
        return res.status(200).json({ imageUrl });

    } catch (error) {
        clearTimeout(timeoutId);
        const isTimeout = error.name === 'AbortError';
        console.error(`Pexels image search error (${isTimeout ? 'Timeout' : 'Network/API'}):`, error.message);
        return res.status(isTimeout ? 504 : 500).json({
            error: isTimeout ? 'Image search timed out.' : 'Failed to retrieve food image.'
        });
    }
}