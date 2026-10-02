// lib/rateLimit.js
// In-memory sliding-window rate limiter for public Next.js API routes

const ipRequestsMap = new Map();

// Periodic cleanup of expired entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpired(windowMs) {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
    lastCleanup = now;

    for (const [ip, timestamps] of ipRequestsMap.entries()) {
        const validTimestamps = timestamps.filter(t => now - t < windowMs);
        if (validTimestamps.length === 0) {
            ipRequestsMap.delete(ip);
        } else {
            ipRequestsMap.set(ip, validTimestamps);
        }
    }
}

export function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Checks if the incoming request exceeds the rate limit.
 * @param {import('next').NextApiRequest} req 
 * @param {import('next').NextApiResponse} res 
 * @param {object} options 
 * @param {number} [options.maxRequests]
 * @param {number} [options.windowMs]
 * @returns {boolean} true if request was blocked (response already sent), false if allowed.
 */
export function applyRateLimit(req, res, { maxRequests = 20, windowMs = 60000 } = {}) {
    const clientIp = getClientIp(req);
    const now = Date.now();

    cleanupExpired(windowMs);

    const timestamps = (ipRequestsMap.get(clientIp) || []).filter(t => now - t < windowMs);

    if (timestamps.length >= maxRequests) {
        const oldestTimestamp = timestamps[0];
        const retryAfterSeconds = Math.ceil((oldestTimestamp + windowMs - now) / 1000);

        res.setHeader('Retry-After', retryAfterSeconds);
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.status(429).json({
            error: 'Too many requests',
            message: `Rate limit exceeded. Please wait ${retryAfterSeconds} seconds before retrying.`,
            retryAfter: retryAfterSeconds
        });
        return true;
    }

    timestamps.push(now);
    ipRequestsMap.set(clientIp, timestamps);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - timestamps.length);

    return false;
}
