// lib/emotion.js
// Dedicated emotion analysis module: RoBERTa GoEmotions inference, Ekman mapping, and culinary mood taxonomy

const HF_ROBERTA_URL = "https://router.huggingface.co/hf-inference/models/SamLowe/roberta-base-go_emotions";

/**
 * Standard Ekman 6-basic-emotion grouping for Google GoEmotions (Demszky et al., 2020)
 */
export const EKMAN_MAPPING = {
    anger: ['anger', 'annoyance', 'disapproval'],
    disgust: ['disgust'],
    fear: ['fear', 'nervousness'],
    joy: ['joy', 'amusement', 'approval', 'excitement', 'gratitude', 'love', 'optimism', 'relief', 'pride', 'admiration', 'caring'],
    sadness: ['sadness', 'disappointment', 'embarrassment', 'grief', 'remorse'],
    surprise: ['surprise', 'curiosity', 'realization', 'confusion'],
    neutral: ['neutral']
};

/**
 * Documented Deterministic Mapping: 28 GoEmotions labels -> 8 Culinary Mood Categories
 * Translates affective NLP states into food-relevant culinary therapeutic profiles.
 */
export const GO_EMOTIONS_TO_CULINARY_MOOD = {
    // Joyful / Celebratory: Festive, sharing dishes, aromatic biryani/sweets
    admiration: 'joyful',
    approval: 'joyful',
    gratitude: 'joyful',
    pride: 'joyful',

    // Energized: High-protein, vibrant, citrusy, zesty
    amusement: 'energized',
    excitement: 'energized',
    joy: 'energized',
    love: 'energized',
    optimism: 'energized',

    // Calming: Cooling herbs, mint, curd, mild non-pungent spicing (anti-inflammatory)
    anger: 'calming',
    annoyance: 'calming',
    disapproval: 'calming',
    disgust: 'calming',

    // Grounding: Warm, slow-cooked, root vegetables, khichdi, whole grains
    fear: 'grounding',
    nervousness: 'grounding',

    // Comforting: Soul-food, warm broths, dal tadka, soft rotis, gentle stews
    sadness: 'comforting',
    disappointment: 'comforting',
    grief: 'comforting',
    remorse: 'comforting',
    embarrassment: 'comforting',

    // Adventurous: Bold chaats, tangy street foods, complex masalas
    curiosity: 'adventurous',
    surprise: 'adventurous',
    realization: 'adventurous',
    confusion: 'adventurous',

    // Craving: Rich, savory, deeply indulgent traditional dishes
    desire: 'craving',

    // Balanced: Wholesome thali, simple seasonal sabzi, homestyle meal
    caring: 'balanced',
    relief: 'balanced',
    neutral: 'balanced'
};

/**
 * Maps raw GoEmotions emotion string to its Ekman root.
 * @param {string} rawEmotion 
 * @returns {string} Ekman category (joy, anger, fear, sadness, surprise, disgust, neutral)
 */
export function getEkmanGroup(rawEmotion) {
    if (!rawEmotion) return 'neutral';
    const lower = rawEmotion.toLowerCase();
    for (const [group, emotions] of Object.entries(EKMAN_MAPPING)) {
        if (emotions.includes(lower)) return group;
    }
    return 'neutral';
}

/**
 * Maps raw GoEmotions emotion string to a culinary mood category.
 * @param {string} rawEmotion 
 * @returns {string} Culinary mood category
 */
export function mapGoEmotionToCulinaryMood(rawEmotion) {
    if (!rawEmotion) return 'balanced';
    const lower = rawEmotion.toLowerCase().trim();
    return GO_EMOTIONS_TO_CULINARY_MOOD[lower] || 'balanced';
}

/**
 * Calls Hugging Face RoBERTa GoEmotions endpoint with a strict abort timeout.
 * @param {string} text - User prompt
 * @param {number} [timeoutMs=1500] - Abort timeout in milliseconds
 * @returns {Promise<{ label: string|null, score: number|null, status: 'ok'|'timeout'|'error'|'unconfigured' }>}
 */
export async function getMood(text, timeoutMs = 1500) {
    const token = process.env.HUGGING_FACE_API_TOKEN?.trim();
    if (!token) {
        return { label: null, score: null, status: 'unconfigured' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(HF_ROBERTA_URL, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            method: 'POST',
            body: JSON.stringify({ inputs: text }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            return { label: null, score: null, status: 'error' };
        }

        const data = await response.json();
        if (Array.isArray(data) && Array.isArray(data[0]) && data[0][0]?.label) {
            const topPrediction = data[0][0];
            return {
                label: topPrediction.label.toLowerCase(),
                score: Number(topPrediction.score?.toFixed(4)) || null,
                status: 'ok'
            };
        }
        return { label: null, score: null, status: 'error' };
    } catch (err) {
        clearTimeout(timeoutId);
        const isTimeout = err.name === 'AbortError';
        return {
            label: null,
            score: null,
            status: isTimeout ? 'timeout' : 'error'
        };
    }
}
