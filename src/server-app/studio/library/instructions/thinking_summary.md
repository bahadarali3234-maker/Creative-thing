# THINKING SUMMARY — rules (for the model AND for the backend builder)

The "Thinking" section shows the user a short, TRUE summary of what you did. It is not decoration.

## Hard rules
1. **Only real events.** Every line must come from: (a) an analysis fact you were given, (b) a tool result, (c) a decision in your plan. If you did not analyse something, you may not say you did.
2. **Name the thing.** Mention the file name / query / style id / size. Generic lines like "Analyzing your request…" or "Creating something amazing" are forbidden.
3. **State the result.** Each analysis line ends with what you learned and what you decided because of it.
4. **No canned text.** Never output a fixed/saved summary. Every summary is built from the current request. Two different requests must never produce the same summary.
5. **Short.** 3-7 steps, each 1-2 sentences, user's language.
6. **Honest about gaps.** If an attachment came without analysis facts: "Received <name>, but couldn't analyse it" — never invent contents.
7. **No private chain-of-thought dump.** Summarise decisions, don't paste raw reasoning.

## Step kinds
`understand` · `analysis` (uploads: image/video/file) · `search` · `edit` (background removal, adjustments) · `decision` (style/layout/palette + why) · `check` (validation) · `result`.

## Analysis wording (images)
"Analysed **photo.jpg** (1200×1600, portrait): subject centred, plain light-grey background, no transparency → good for background removal; dominant colours #2b3a67, #f2c14e."

## Analysis wording (video — contact sheet method)
Take N frames at evenly spaced times (e.g. 12 frames over the clip), tile them into one contact-sheet image with time labels, inspect that single image, then summarise:
"Sampled **clip.mp4** at 12 points (0:00-0:48), merged into one contact sheet: outdoor street scene, one person in red jacket appears from 0:10, camera mostly static, bright daylight → I'll use frame at 0:14 as the subject."
Only claim what the contact sheet / facts support.

## Examples of GOOD vs BAD
BAD: "I analysed your image and created a design." (no name, no result)
BAD: "Thinking about the best approach…" (filler)
GOOD: "Chose Dark Luxury with a centred hero layout because the poster is for a wedding invitation and you gave names + a date; gold on black keeps the 3-level hierarchy readable."
GOOD: "Searched the web for “Hawa Mahal Jaipur sunrise”: 24 results, used the 3rd (1600×1067, wikimedia.org); removed nothing — it is a background plate."
GOOD: "Checked the layout: 7 checks passed; fixed 1 issue (title was 3.1:1 contrast → added a dark plate)."
