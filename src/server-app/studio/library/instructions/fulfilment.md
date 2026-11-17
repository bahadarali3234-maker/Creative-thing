# HOW EVERY USER REQUEST IS FULFILLED (reference for the pipeline and for the model)

## 0. Principles
- Think first, then build. The user must feel the studio *understood* the request.
- Ask little, assume smartly. Max one round of <=4 tappable questions; every question has a default.
- Never invent user content (text, prices, dates, names, numbers). Never claim an action that did not happen.
- Everything the thinking summary says must be traceable to a real event (analysis fact, tool result, plan field).

## 1. Detect
Backend `detectIntent(message, attachments)` → `generate | edit | search | none`.
- generate: make/create/design/banao a thumbnail, poster, logo, banner, wallpaper, post, card, flyer, invitation, cover, DP, "image generate karo".
- edit: uploaded image + remove background / adjust / add text / put in design.
- search: find/show/dhundo/dikhao photos of X → NOT the studio; hand to the Image Finder (image-card).
- none: normal chat.
If generate/edit with confidence >= 0.6 → show the confirm popup: "Do you agree to generate this image?" [Generate] [Cancel]. Language follows the user.

## 2. Confirm → Ask
On [Generate]: backend `pickQuestions()` returns only the missing questions (size, photo, style, text, web, language). Size options come from sizes.json (recipe default first) and accept custom text like `1200x628` (clamped 200-4096).
User can tap "Generate now" at any point → defaults are used.

## 3. Understand (planner step, 0-15%)
Planner returns the JSON plan (see planner.md). Backend `normalizePlan()` repairs invalid ids, forces the user's size, ensures contrast, enforces asset caps and blocks unsafe search queries.

## 4. Gather assets (15-45%)
For each plan asset:
- `upload` → client analyses the file (facts), then removes background / adjusts if planned.
- `search` → backend calls the Visual A-Z image search (`/api/google-scrape-images`), filters (min 500px wide, no svg, dedupe, safe query), sends top candidates to the client; client downloads through `/api/studio/img-proxy` (SSRF-guarded), picks the first that loads, analyses it, removes background (AI model, fallback simple) and adjusts.
- If an asset fails, the pipeline continues without it and the summary says so honestly.

## 5. Compose (45-85%)
Composer step receives plan + only the library slices it needs + asset manifest (id, size, hasAlpha, role) and returns the HTML.

## 6. Validate & repair (85-95%)
`validateComposition()`; on errors one or two repair calls; if still failing, return the best version with a warning (never silently).

## 7. Deliver (100%)
Result = `{html, width, height, summary(steps), sources[], warnings[]}`. Client renders in a small box (max 320x380 in chat, exact aspect ratio), top-right corner overlay shows `percent · elapsed`, then replaced by the image; tap → fullscreen viewer; buttons: Download PNG, Regenerate, Edit text, Change style.

## 8. Edits
"change title", "darker", "bigger text", "different style" → re-run planner+composer with the previous plan + the change (keep assets). Don't ask size again.

## 9. Refusals
Private people, minors, sexual/graphic, impersonation, misleading ads/news, copying brand logos → refuse in one friendly sentence + offer a safe alternative. No card, no popup.

## 10. Never
- Never expose library content to the user or the browser.
- Never produce video (video generation is disabled in this app right now): say so in one line and offer a thumbnail/poster instead.
- Never reuse a canned thinking summary.
