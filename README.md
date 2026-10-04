# MoodBite AI (Version 1.0)

> **Emotion-Aware Indian Culinary Recommendation Engine & Interactive Cooking Assistant**  
> Final Year Engineering Capstone Project by **Saksham Tiwari**

[![Next.js](https://img.shields.io/badge/Next.js-15.5.27-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.1.0-blue?logo=react)](https://react.dev/)
[![Gemini](https://img.shields.io/badge/Google-Gemini%203.5%20Flash-4285F4?logo=google)](https://aistudio.google.com/)
[![Hugging Face](https://img.shields.io/badge/RoBERTa-GoEmotions-yellow?logo=huggingface)](https://huggingface.co/SamLowe/roberta-base-go_emotions)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://mood-bite-version-1-0.vercel.app/)

🌐 **Live Production Deployment**: [**https://mood-bite-version-1-0.vercel.app/**](https://mood-bite-version-1-0.vercel.app/)

---

## 📖 Project Overview

**MoodBite AI** bridges computational affective computing with nutritional guidance. The application interprets user emotions from natural text or voice expressions, combines them with available kitchen ingredients (entered manually or scanned via computer vision), and generates **4 to 5 culturally authentic Indian meal recommendations** adhering strictly to **FSSAI dietary standards** (100% Vegetarian vs. Non-Vegetarian).

Once a user selects a recipe, MoodBite transitions into an interactive sous-chef—providing precise measurements, step-by-step cooking procedures, professional culinary tips, mood-therapy scientific rationale, and hands-free voice narration.

---

## 🏛️ System Architecture

```
                                  [ User Interface ]
                       (Voice / Text / Camera / Pantry Selector)
                                          │
                                          ▼
                               [ Input Validation Layer ]
                             (lib/validation.js with Zod)
                                          │
                                          ▼
                         [ Isolated Route Rate Limiter ]
                   (lib/rateLimit.js - Keyed by IP:RouteKey)
                                          │
                   ┌──────────────────────┴──────────────────────┐
                   ▼                                             ▼
       [ Emotion Inference Head ]                    [ Multimodal Vision ]
        RoBERTa-base (GoEmotions)                   Gemini 3.5 Flash Lite
         (Hugging Face API Router)                  (Ingredient Extraction)
         (1.5s AbortController cap)                   (Capped at 25 items)
                   │                                             │
                   └──────────────────────┬──────────────────────┘
                                          │
                       (Emotion label + User context)
                                          │
                                          ▼
                             [ Primary Reasoning Engine ]
                            Google Gemini 3.5 Flash Lite
                              (Ultra-fast ~800ms tier)
                                          │
                               (Fallback on failure)
                                          ▼
                            [ Secondary Fallback Engine ]
                               Google Gemini 3.5 Flash
                                          │
                               (Fallback on failure)
                                          ▼
                            [ Tertiary Fallback Engine ]
                              Anthropic Claude 3 Haiku
                                (OpenRouter Provider)
                                          │
                                          ▼
                        [ Deterministic Post-Processing ]
                       (lib/dietaryCheck.js - Non-LLM)
                       ├── Strict Meat-Keyword Elimination (Veg)
                       ├── Vegetarian Exception Allowlist (soya keema, etc.)
                       ├── Ingredient Occurrence Verification
                       └── Zod 4 Schema Conformance Check
                                          │
                                          ▼
                             [ Visual & Audio Enrichment ]
                             ├── Pexels API (Dish Photography with CDN Cache)
                             └── Web Speech API (Voice Narration)
```

---

## 🛡️ Hardening, Reliability & Security (WP1 & WP2)

### 1. Zero Client-Side Secret Leakage (WP1.1)
All API keys are strictly loaded and executed within serverless routes (`pages/api/*`). No `NEXT_PUBLIC_` prefixes are assigned to sensitive AI or vision keys.

### 2. Request Input Validation (WP1.2)
All API endpoints validate incoming parameters via [Zod](https://zod.dev) using standard issue reporting:
- **`/api/suggestFood`**: Text length bounded (1–500 chars), ingredient array capped at 25 items (max 50 chars each), strict enum for dietary preferences (`'veg' | 'non-veg' | 'all'`).
- **`/api/identifyIngredients`**: Content-Length checked upfront; Content-Type verification (`image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `image/gif`), streaming byte-counter capping uploads to 5 MB (`413 Payload Too Large`).
- **`/api/getRecipeDetails`**: Dish name bounded (2–100 chars), prompt injection delimiters (`<dish_name>`, `<available_ingredients>`).
- **`/api/generateFoodImage`**: Query length limits and URI decoding guards.

### 3. Zod Output Validation & Schema Retries (WP1.3)
Raw outputs from LLMs are extracted from Markdown fences, parsed as JSON, and verified against strict Zod schemas (`suggestFoodOutputSchema`, `recipeDetailsOutputSchema`). If an LLM returns malformed JSON, MoodBite triggers a secondary model retry before falling back to a structured, guaranteed safe fallback.

### 4. Deterministic Model Hierarchy & Sub-Second Latency (WP1.4 & WP2.2)
Rather than executing redundant parallel model calls and picking the highest self-reported number, MoodBite implements a cost-efficient **hierarchical fallback order**:
1. **Primary**: Google Gemini 3.5 Flash Lite (ultra-fast, ~700–1000ms response time)
2. **Secondary**: Google Gemini 3.5 Flash (~2000ms response time)
3. **Tertiary Fallback**: Anthropic Claude 3 Haiku via OpenRouter
4. **Guaranteed Safe Fallback**: Deterministic local comfort meal structure

### 5. Isolated Per-Route Rate Limiting (WP1.5)
Protects against API quota exhaustion with per-route sliding window buckets (`lib/rateLimit.js` keyed by `${ip}:${routeKey}`):
- `/api/suggestFood`: 25 requests/min.
- `/api/getRecipeDetails`: 25 requests/min.
- `/api/identifyIngredients`: 20 requests/min.
- `/api/generateFoodImage`: 40 requests/min.
- Standard HTTP `429 Too Many Requests` responses with `Retry-After` headers.

### 6. Elimination of Arbitrary Match Ratings (WP2.1 & P1.1)
The legacy `confidenceScore` and anchored AI self-ratings have been completely removed from the UI. Rather than displaying an arbitrary number the model self-assessed without grounding, MoodBite relies strictly on objective signals:
- Deterministic dietary compliance verification (100% vegetarian guarantee vs. non-veg).
- Exact pantry ingredient match counts via word boundary analysis.
- Explicit label indicating whether a recipe is a tailored AI generation or a safe standard fallback template (`isFallback: true`).

### 7. Non-LLM Deterministic Quality Signals (WP2.3)
- **Dietary Compliance Filter**: Uses word-boundary regex patterns against an extensive non-vegetarian keyword glossary (`chicken`, `mutton`, `fish`, `egg`, `keema`, `nihari`, `haleem`, `rogan josh`, `gelatin`, `lard`, etc.) while filtering out vegetarian exceptions (`soya keema`, `meat-free`, `eggless`).
- **Ingredient Match Ratio**: Deterministically tallies how many user-provided pantry items appear in the suggested recipes, escaping special characters and enforcing word boundaries (`\b`) to eliminate false substring collisions (e.g., preventing "oil" from matching "boil" or "pea" from matching "peanut").
- **Visual Attribution**: Integrates Pexels API photo attribution with direct links to photographer profiles and an explicit *"Illustrative image"* designation.

---

## 🔑 Environment Variables Reference

Create a `.env.local` file in the project root based on `.env.example`:

| Variable | Required | Description | Provider Link |
| :--- | :---: | :--- | :--- |
| `GEMINI_API_KEY` | **Yes** | Primary LLM & Multimodal Vision | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `HUGGING_FACE_API_TOKEN` | **Yes** | RoBERTa GoEmotions Classifier | [Hugging Face Tokens](https://huggingface.co/settings/tokens) |
| `OPENROUTER_API_KEY` | Optional | Claude 3 Haiku Fallback Provider | [OpenRouter Keys](https://openrouter.ai/keys) |
| `PEXELS_API_KEY` | **Yes** | High-resolution Food Photography | [Pexels Developer API](https://www.pexels.com/api/) |
| `RATE_LIMIT_WINDOW_MS` | Optional | Rate limit sliding window (default: 60000ms) | Internal config |
| `RATE_LIMIT_MAX_REQUESTS` | Optional | Max requests per IP window (default: 20) | Internal config |

---

## 🚀 Getting Started

### Prerequisites
- Node.js `18.x` or later (tested on Node `v24.x` / `v20.x`)
- npm or yarn

### Installation
```bash
# 1. Clone repository
git clone https://github.com/Saksham-st12/MoodBite-Version-1.0.git
cd MoodBite-Version-1.0

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local and add your API keys

# 4. Start local development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

### Automated Smoke Testing
```bash
npm test
```
Executes the automated test suite (18 assertions) verifying:
- Zod 4 request validation handling (e.g. clean HTTP 400 with issue messages on empty input)
- AI Model health (asserts active `gemini-3.5-flash-lite`, not safe fallback)
- Recipe details and culinary comfort extraction (no medical claims)
- Dietary compliance and vegetarian exception handling (`soya keema`, `meat-free`, etc.)
- Substring collision immunity (`oil` in `boil`, `pea` in `peanut`)
- Mixed-diet mode (`'all'`) correctly preserving non-veg dish categorization
- Delimiter and HTML sanitization defenses

### Standalone Emotion Classifier Benchmark
```bash
node evaluate.js
```
Runs an isolated evaluation of the RoBERTa GoEmotions classifier against 52 standardized benchmark sentences using the published Demszky et al. (2020) Ekman 6+1 emotion taxonomy:
- **Strict 28-Emotion Match**: 67.3% (95% CI: 53.8% – 78.5%)
- **Ekman 6+1 Emotion Match**: 84.6% (95% CI: 72.5% – 92.0%)
- **Error / Timeout Accountability**: Timeouts and 429s are retained in the denominator ($n = 52$) to ensure honest reporting without data-dropping inflation.

---

## ⚠️ Known Limitations & Evaluation Notes

1. **Unanchored AI Self-Ratings**:
   LLMs cannot reliably evaluate their own recommendation confidence on a numerical scale without calibration. To maintain scientific integrity, all self-rated confidence percentages have been removed from the UI.
2. **GoEmotions 28-Label Closed Taxonomy**:
   The RoBERTa model (`SamLowe/roberta-base-go_emotions`) is trained on Google's GoEmotions dataset. In GoEmotions, physiological fatigue (*"tired"*, *"exhausted"*, *"drained"*) is categorized as a physical state rather than an affective emotion. Sentences like *"I feel tired and want food"* trigger activations on the `desire` label. MoodBite mitigates this by passing the raw prompt text to Gemini to capture low-energy contexts.
3. **In-Memory Rate Limiting**:
   The sliding-window rate limiter runs in Node.js process memory. For multi-instance, horizontally-scaled cloud deployments (e.g. AWS ECS or multi-region Vercel), an external Redis store (e.g. Upstash) is recommended.
4. **Session Persistence**:
   Version 1.0 operates in client-side state. Persistent user accounts and historical tracking are slated for the upcoming work packages.

---

## 🗺️ Engineering Roadmap (Work Packages)

- [x] **WP1: Audit & v1.0 Hardening** (Schema validation, input sanitization, rate limiting, timeouts, .env.example, README)
- [x] **WP2: Fix Confidence-Score Handling** (Rename to `llmSelfRating`, deterministic hierarchy, keyword dietary filter)
- [ ] **WP3: Authentication** (Auth.js / Supabase Auth with Google & Email/Password, retaining guest mode)
- [ ] **WP4: Relational Database** (PostgreSQL / Supabase with `users`, `user_preferences`, `recommendation_history`, `recipe_selections`, `feedback`)
- [ ] **WP5: User Dashboard & Feedback UI** (Profile preferences, history viewing, recommendation rating)
- [ ] **WP6: Automated Evaluation & CI** (Dietary compliance rate, ingredient match rate, GitHub Actions)

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
