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

**MoodBite AI** is an intelligent Indian culinary assistant that pairs affective sentiment analysis with kitchen pantry availability. The application interprets user emotions from natural language text or voice expressions, combines them with available kitchen ingredients (entered manually or scanned via computer vision), and generates **4 to 5 culturally authentic Indian meal recommendations** filtered through a deterministic dietary keyword heuristic (Vegetarian vs. Non-Vegetarian).

Once a user selects a recipe, MoodBite transitions into an interactive sous-chef—providing precise measurements, step-by-step cooking procedures, professional culinary tips, culinary style rationales (focusing solely on flavor, warmth, and texture), and hands-free voice narration.

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
                       ├── Meat-Keyword Heuristic Elimination (Veg)
                       ├── Vegetarian Exception Allowlist (soya keema, etc.)
                       ├── Ingredient Occurrence Verification
                       └── Zod Schema Conformance Check
                                          │
                                          ▼
                             [ Visual & Audio Enrichment ]
                             ├── Pexels API (Dish Photography with CDN Cache)
                             └── Web Speech API (Voice Narration)
```

---

## 🛡️ Hardening, Reliability & Security (WP1 & WP2)

### 1. Key Security and Access Architecture (WP1.1 & WP3)
All backend AI and Vision API keys (`GEMINI_API_KEY`, `HUGGING_FACE_API_TOKEN`, `OPENROUTER_API_KEY`, `PEXELS_API_KEY`) are strictly loaded and executed within serverless routes (`pages/api/*`), never exposed to the client. The `NEXT_PUBLIC_SUPABASE_ANON_KEY` is public by design for client-side authentication, and all database tables are protected using Supabase Row Level Security (RLS) policies (`auth.uid() = user_id`). The Supabase service-role key is never exposed.

### 2. Request Input Validation (WP1.2)
All API endpoints validate incoming parameters via [Zod](https://zod.dev) using standard issue reporting:
- **`/api/suggestFood`**: Text length bounded (1–500 chars), ingredient array capped at 25 items (max 50 chars each), strict enum for dietary preferences (`'veg' | 'non-veg' | 'all'`).
- **`/api/identifyIngredients`**: Content-Length checked upfront; Content-Type verification (`image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `image/gif`), streaming byte-counter capping uploads to 5 MB (`413 Payload Too Large`).
- **`/api/getRecipeDetails`**: Dish name bounded (2–100 chars), prompt injection delimiters (`<dish_name>`, `<available_ingredients>`).
- **`/api/generateFoodImage`**: Query length limits and URI decoding guards.

### 3. Zod Output Validation & Schema Retries (WP1.3)
Raw outputs from LLMs are extracted from Markdown fences, parsed as JSON, and verified against strict Zod schemas (`suggestFoodOutputSchema`, `recipeDetailsOutputSchema`). If an LLM returns malformed JSON, MoodBite triggers a secondary model retry before falling back to a structured, guaranteed safe fallback.

### 4. Deterministic Model Hierarchy & Sub-Second Latency (WP1.4 & WP2.2)
Rather than executing redundant parallel model calls and picking an arbitrary score, MoodBite implements a cost-efficient **hierarchical fallback order with a strict 12-second total deadline budget**:
1. **Primary**: Google Gemini 3.5 Flash Lite (ultra-fast, ~700–1000ms response time)
2. **Secondary**: Google Gemini 3.5 Flash (~2000ms response time)
3. **Tertiary Fallback**: Anthropic Claude 3 Haiku via OpenRouter
4. **Guaranteed Safe Fallback**: Deterministic local comfort meal structure (`isFallback: true`)

### 5. Isolated Per-Route Rate Limiting (WP1.5)
Protects against API quota exhaustion with per-route sliding window buckets (`lib/rateLimit.js` keyed by `${ip}:${routeKey}`):
- `/api/suggestFood`: 25 requests/min.
- `/api/getRecipeDetails`: 25 requests/min.
- `/api/identifyIngredients`: 20 requests/min.
- `/api/generateFoodImage`: 40 requests/min.
- Standard HTTP `429 Too Many Requests` responses with `Retry-After` headers and clean client-side feedback.

### 6. Elimination of Arbitrary Match Ratings (WP2.1 & P1.1)
Legacy `confidenceScore` and arbitrary AI self-ratings have been completely removed from both backend schemas and UI cards. MoodBite relies strictly on verifiable signals:
- Deterministic dietary compliance filter.
- Exact pantry ingredient match counts via word boundary analysis.
- Explicit label indicating whether a recipe is an AI generation or a fallback preparation template (`isFallback: true`).

### 7. Non-LLM Deterministic Quality Signals (WP2.3)
- **Dietary Compliance Filter**: Uses word-boundary regex patterns against an extensive non-vegetarian keyword glossary (`chicken`, `mutton`, `fish`, `egg`, `keema`, `nihari`, `haleem`, `rogan josh`, `gelatin`, `lard`, etc.) while filtering out vegetarian exceptions (`soya keema`, `meat-free`, `eggless`).
- **Ingredient Match Ratio**: Deterministically tallies how many user-provided pantry items appear in the suggested recipes, escaping special characters and enforcing word boundaries (`\b`) to eliminate false substring collisions (e.g., preventing "oil" from matching "boil" or "pea" from matching "peanut").
- **Visual Attribution**: Integrates Pexels API photo attribution with direct links to photographer profiles and an explicit *"Illustrative image"* designation.

---

## 🗄️ Supabase Database & Security Setup

MoodBite uses Supabase for user authentication and history persistence while respecting **Affective Privacy** (raw user reflections and emotional disclosures are never stored in the database; only structured food attributes are logged).

### Database Schema & Policies
To set up your database, execute [`db/schema.sql`](db/schema.sql) in your Supabase SQL Editor:

1. **`recommendation_history`**:
   - Stores `user_id`, `culinary_mood`, `suggested_food`, `dietary_type`, `choices_count`, and `created_at`.
   - **RLS Enabled**: Users can only insert and read their own recommendation entries (`auth.uid() = user_id`).
2. **`user_preferences`**:
   - Stores `user_id`, `dietary_preference`, `allergies`, `favorite_cuisines`, and `updated_at`.
   - **RLS Enabled**: Users can read, insert, and update their personal dietary preferences.

---

## 🔑 Environment Variables Reference

Create a `.env.local` file in the project root based on `.env.example`:

| Variable | Required | Description | Provider Link |
| :--- | :---: | :--- | :--- |
| `GEMINI_API_KEY` | **Yes** | Primary LLM & Multimodal Vision | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `HUGGING_FACE_API_TOKEN` | **Yes** | RoBERTa GoEmotions Classifier | [Hugging Face Tokens](https://huggingface.co/settings/tokens) |
| `OPENROUTER_API_KEY` | Optional | Claude 3 Haiku Fallback Provider | [OpenRouter Keys](https://openrouter.ai/keys) |
| `PEXELS_API_KEY` | **Yes** | High-resolution Food Photography | [Pexels Developer API](https://www.pexels.com/api/) |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | Supabase Project URL for Authentication & DB | [Supabase](https://supabase.com) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | Supabase Anon Public Key for Client Auth | [Supabase](https://supabase.com) |
| `RATE_LIMIT_WINDOW_MS` | Optional | Rate limit sliding window (default: 60000ms) | Internal config |
| `RATE_LIMIT_MAX_REQUESTS` | Optional | Max requests per IP window (default: 20) | Internal config |

---

## 🚀 Getting Started

### Prerequisites
- Node.js `18.x` or later (tested on Node `v20.x` / `v24.x`)
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
Executes the full automated smoke test suite (**36 assertions**) against the live dev server verifying:
- Zod 4 request validation handling (e.g. clean HTTP 400 with issue messages on empty input)
- AI Model health (asserts active `gemini-3.5-flash-lite`, not safe fallback)
- Recipe details and culinary comfort extraction (no medical claims)
- Dietary compliance and vegetarian exception handling (`soya keema`, `meat-free`, etc.)
- Substring collision immunity (`oil` in `boil`, `pea` in `peanut`)
- Mixed-diet mode (`'all'`) correctly preserving non-veg dish categorization
- Delimiter and HTML sanitization defenses

### Fast Offline Unit Testing
```bash
npm run test:unit
```
Runs **36 fast offline unit tests** for `lib/dietaryCheck.js` and `lib/emotion.js` without requiring network access, API tokens, or a running server.

---

## 📊 Evaluation & Classifier Benchmarks

MoodBite employs the pretrained `SamLowe/roberta-base-go_emotions` model from Hugging Face for affective inference, mapped to Ekman groups and an author-defined culinary taxonomy.

### Benchmark Suites

```bash
# Run latest 56-sentence evaluation suite with Wilson confidence intervals:
npm run eval:emotion
```

### Evaluation Honesty & Dataset Transparency
When reporting accuracy metrics in academic or engineering reviews, clarity regarding test sets is critical:
- **Set 1 (Legacy 52-sentence set, `evaluate.js`)**:
  - Strict 28-Emotion Match: **67.3%** (95% CI: 53.8% – 78.5%)
  - Ekman 6+1 Emotion Match: **84.6%** (95% CI: 72.5% – 92.0%)
- **Set 2 (Current 56-sentence set, `npm run eval:emotion`)**:
  - Ekman 6+1 Emotion Match: **98.2%** (95% Wilson CI: 90.6% – 99.7%, $n=56$)
  - Macro-F1: **0.982**
  - Tiredness Keyword Rule: **10/10 (100%)**
- **Note on Direct Comparison**:
  Both test sets were created by the project author as single-annotator validation sets. The second set was curated after observing baseline classifier behaviors, which explains the score increase. These two sets should **not** be presented as comparable longitudinal benchmarks. For rigorous empirical claims, evaluation should be run directly against the official GoEmotions test split (5,427 multi-annotated examples).

---

## ⚠️ Known Limitations

1. **Elimination of Arbitrary AI Self-Ratings**:
   LLMs cannot reliably evaluate their own recommendation confidence on an uncalibrated scale. All fake confidence percentages and AI match badges have been eliminated from the UI.
2. **GoEmotions 28-Label Closed Taxonomy**:
   In GoEmotions, physiological fatigue (*"tired"*, *"exhausted"*, *"drained"*) is categorized as a physical state rather than an affective emotion. MoodBite uses a dedicated keyword rule (`mentionsTiredness`) with negation detection to map fatigue to the `'restorative'` culinary mood.
3. **In-Memory Rate Limiting**:
   The sliding-window rate limiter runs in Node.js process memory. For horizontally-scaled multi-region cloud deployments, a distributed store such as Redis/Upstash is recommended.
4. **Affective Privacy & Sensitive Data**:
   Disclosing emotional feelings involves sensitive personal data. By design, MoodBite stores only the detected culinary mood label, ingredients, dietary preference, and selected dish—never raw emotional free-text reflections.

---

## 🗺️ Engineering Roadmap (Work Packages)

- [x] **WP1: Audit & v1.0 Hardening** (Schema validation, input sanitization, rate limiting, timeouts, .env.example, README)
- [x] **WP2: Removal of Fabricated Match Ratings** (Eliminated arbitrary ratings, deterministic hierarchy, keyword dietary filter)
- [x] **WP3: Authentication** (Supabase Auth with Email/Password & Google OAuth, retaining guest mode)
- [x] **WP4: Relational Database Schema** (PostgreSQL / Supabase with `recommendation_history`, `user_preferences`, and RLS policies in `db/schema.sql`)
- [ ] **WP5: User Dashboard & History UI** (Profile preferences, history viewing)
- [x] **WP6: Automated Evaluation & CI** (Offline unit testing, GitHub Actions CI workflow, GoEmotions evaluation suite)

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
