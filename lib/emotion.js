// lib/emotion.js
// Emotion analysis module: RoBERTa GoEmotions inference, Ekman grouping, and a heuristic culinary-mood taxonomy.
//
// IMPORTANT (for documentation and viva):
//  - The GoEmotions classifier is a pretrained model; it is NOT trained or fine-tuned in this project.
//  - The GoEmotions -> culinary-mood table below is an author-defined design heuristic.
//    It is not empirically validated and makes no medical or psychological claim.

const HF_ROBERTA_URL = "https://router.huggingface.co/hf-inference/models/SamLowe/roberta-base-go_emotions";

/**
 * Ekman 6-basic-emotion grouping for GoEmotions (Demszky et al., 2020), plus neutral.
 * Verify against the official ekman_mapping.json in the GoEmotions repository before citing it.
 */
export const EKMAN_MAPPING = {
    anger: ['anger', 'annoyance', 'disapproval'],
    disgust: ['disgust'],
    fear: ['fear', 'nervousness'],
    joy: ['joy', 'amusement', 'approval', 'excitement', 'gratitude', 'love', 'optimism', 'relief', 'pride', 'admiration', 'desire', 'caring'],
    sadness: ['sadness', 'disappointment', 'embarrassment', 'grief', 'remorse'],
    surprise: ['surprise', 'curiosity', 'realization', 'confusion'],
    neutral: ['neutral']
};

/**
 * The nine culinary moods used by MoodBite. 'restorative' is selected by the tiredness keyword rule,
 * not by the classifier (GoEmotions has no fatigue label).
 */
export const CULINARY_MOODS = [
    'joyful', 'energized', 'calming', 'grounding', 'comforting',
    'adventurous', 'craving', 'balanced', 'restorative'
];

// Alias for backwards compatibility across existing imports
export const CULINARY_MOOD_CATEGORIES = CULINARY_MOODS;

/**
 * Heuristic mapping: 28 GoEmotions labels -> culinary mood categories.
 * Author-defined design choice (not validated).
 */
export const GO_EMOTIONS_TO_CULINARY_MOOD = {
    admiration: 'joyful',
    approval: 'joyful',
    gratitude: 'joyful',
    pride: 'joyful',

    amusement: 'energized',
    excitement: 'energized',
    joy: 'energized',
    love: 'energized',
    optimism: 'energized',

    anger: 'calming',
    annoyance: 'calming',
    disapproval: 'calming',
    disgust: 'calming',

    fear: 'grounding',
    nervousness: 'grounding',

    sadness: 'comforting',
    disappointment: 'comforting',
    grief: 'comforting',
    remorse: 'comforting',
    embarrassment: 'comforting',

    curiosity: 'adventurous',
    surprise: 'adventurous',
    realization: 'adventurous',
    confusion: 'adventurous',

    desire: 'craving',

    caring: 'balanced',
    relief: 'balanced',
    neutral: 'balanced',

    tired: 'restorative'
};

/**
 * Cooking-style hint passed to the recipe generator for each culinary mood.
 * These describe food style only (no health or mood-treatment claims).
 */
export const CULINARY_MOOD_GUIDANCE = {
    joyful: 'festive, shareable dishes',
    energized: 'vibrant, protein-rich or zesty dishes',
    calming: 'mild dishes with gentle spicing and cooling sides such as curd or mint',
    grounding: 'warm, simple, slow-cooked dishes such as khichdi or root-vegetable sabzi',
    comforting: 'soft, warm, familiar home-style dishes such as dal with rice or rotis',
    adventurous: 'bold, tangy, street-food style dishes',
    craving: 'rich, savoury, indulgent traditional dishes',
    balanced: 'wholesome everyday home-style meals',
    restorative: 'light, simple dishes that cook quickly with little effort'
};

/**
 * Maps a raw GoEmotions label to its Ekman root group.
 * @param {string} rawEmotion
 * @returns {string} anger | disgust | fear | joy | sadness | surprise | neutral
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
 * Maps a raw GoEmotions label to a culinary mood.
 * @param {string} rawEmotion
 * @returns {string} one of CULINARY_MOODS
 */
export function mapGoEmotionToCulinaryMood(rawEmotion) {
    if (!rawEmotion) return 'balanced';
    const lower = rawEmotion.toLowerCase().trim();
    return GO_EMOTIONS_TO_CULINARY_MOOD[lower] || 'balanced';
}

const TIRED_WORDS = '(?:tired|exhausted|exhausting|sleepy|fatigued|fatigue|drained|worn out|burnt out|burned out|low on energy)';
const TIRED_REGEX = new RegExp(`\\b${TIRED_WORDS}\\b`, 'i');
const NEGATED_TIRED_REGEX = new RegExp(
    `\\b(?:not|isn't|aren't|wasn't|don't|doesn't|never|no longer|hardly)\\s+(?:\\w+\\s+){0,2}${TIRED_WORDS}\\b`,
    'i'
);

/**
 * Keyword rule for physical tiredness (GoEmotions has no fatigue label).
 * Uses word boundaries so "retired" or "attired" do not match, and skips simple negations.
 * @param {string} text
 * @returns {boolean}
 */
export function mentionsTiredness(text) {
    if (!text || typeof text !== 'string') return false;
    if (NEGATED_TIRED_REGEX.test(text)) return false;
    return TIRED_REGEX.test(text);
}

/**
 * Calls the Hugging Face RoBERTa GoEmotions endpoint with a strict abort timeout.
 * The score is the classifier's output probability for its top label; it is not an accuracy estimate.
 * @param {string} text - User prompt
 * @param {number} [timeoutMs=1500] - Abort timeout in milliseconds
 * @returns {Promise<{ label: string|null, score: number|null, top: Array<{label: string, score: number|null}>, status: 'ok'|'timeout'|'error'|'unconfigured' }>}
 */
export async function getMood(text, timeoutMs = 1500) {
    const token = process.env.HUGGING_FACE_API_TOKEN?.trim();
    if (!token) {
        return { label: null, score: null, top: [], status: 'unconfigured' };
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
            return { label: null, score: null, top: [], status: 'error' };
        }

        const data = await response.json();
        if (Array.isArray(data) && Array.isArray(data[0]) && data[0].length > 0 && data[0][0]?.label) {
            // Sort defensively by score so we never depend on the API's ordering
            const ranked = [...data[0]].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
            const top = ranked.slice(0, 3).map(p => ({
                label: String(p.label).toLowerCase(),
                score: typeof p.score === 'number' ? Number(p.score.toFixed(4)) : null
            }));
            return {
                label: top[0].label,
                score: top[0].score,
                top,
                status: 'ok'
            };
        }
        return { label: null, score: null, top: [], status: 'error' };
    } catch (err) {
        clearTimeout(timeoutId);
        const isTimeout = err.name === 'AbortError';
        return {
            label: null,
            score: null,
            top: [],
            status: isTimeout ? 'timeout' : 'error'
        };
    }
}
