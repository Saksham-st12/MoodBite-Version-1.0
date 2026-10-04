// pages/api/identifyIngredients.js (Hardened with MIME validation, size limits, timeouts & rate limiting)
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES } from '../../lib/validation';
import { applyRateLimit } from '../../lib/rateLimit';

const GEMINI_VISION_TIMEOUT_MS = 8000;

export const config = {
    api: {
        bodyParser: false,
    },
};

function bufferToGenerativePart(buffer, mimeType) {
    return {
        inlineData: {
            data: buffer.toString('base64'),
            mimeType,
        },
    };
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: 'Method Not Allowed. Use POST.' });
    }

    // WP1.5: Isolated Per-Route Rate Limiting (Keyed by IP + routeKey)
    if (applyRateLimit(req, res, { routeKey: 'identifyIngredients', maxRequests: 20, windowMs: 60000 })) {
        return;
    }

    // WP1.2: Validate Content-Length upfront before reading stream to avoid dropped connections
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > MAX_IMAGE_SIZE_BYTES) {
        return res.status(413).json({ message: 'Payload too large. Image exceeds 5MB limit.' });
    }

    // WP1.2: Validate Content-Type
    const contentType = (req.headers['content-type'] || '').toLowerCase().split(';')[0].trim();
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(contentType)) {
        return res.status(415).json({
            message: `Unsupported media type "${contentType}". Allowed image types: JPEG, JPG, PNG, WEBP, GIF.`
        });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        return res.status(503).json({ message: 'AI vision service unconfigured. Missing GEMINI_API_KEY.' });
    }

    try {
        // Stream with size limit enforcement (max 5MB)
        const imageBuffer = await new Promise((resolve, reject) => {
            const chunks = [];
            let totalBytes = 0;

            req.on('data', chunk => {
                totalBytes += chunk.length;
                if (totalBytes > MAX_IMAGE_SIZE_BYTES) {
                    const error = new Error('Payload too large. Image exceeds 5MB limit.');
                    error.code = 'LIMIT_FILE_SIZE';
                    req.pause();
                    return reject(error);
                }
                chunks.push(chunk);
            });

            req.on('end', () => resolve(Buffer.concat(chunks)));
            req.on('error', err => reject(err));
        });

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });

        const prompt = "Analyze this image and list only the identifiable raw or prepared food ingredients you see. Exclude bowls, plates, packaging, and utensils. Return the ingredients as a clean, lowercase comma-separated list. Example: 'tomato, garlic, paneer, coriander'.";
        const imagePart = bufferToGenerativePart(imageBuffer, contentType);

        // WP1.4: Timeout handling via Promise.race
        const generatePromise = model.generateContent([prompt, imagePart]);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                const err = new Error('Gemini Vision processing timed out.');
                err.name = 'TimeoutError';
                reject(err);
            }, GEMINI_VISION_TIMEOUT_MS);
        });

        const result = await Promise.race([generatePromise, timeoutPromise]);
        const response = await result.response;
        const text = response.text() || '';

        const rawList = text
            .split(/[\n,]+/)
            .map(item => item.replace(/^[-*•\s]+/, '').replace(/[^a-zA-Z\s-]/g, '').trim().toLowerCase())
            .filter(item => item.length > 1 && item.length <= 40);

        // Deduplicate and cap to 25 items so downstream suggestFood input schema never rejects it
        const ingredients = Array.from(new Set(rawList)).slice(0, 25);

        return res.status(200).json({ ingredients });

    } catch (error) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ message: 'Image exceeds maximum allowed size of 5MB.' });
        }
        if (error.name === 'TimeoutError') {
            return res.status(504).json({ message: 'Image analysis timed out. Please try with a smaller image or enter ingredients manually.' });
        }

        console.error('Ingredient identification error:', error.message);
        return res.status(500).json({ message: 'Failed to identify ingredients from the image. Please try again or type them manually.' });
    }
}