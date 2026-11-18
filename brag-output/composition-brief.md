# Hyperframes Composition Brief: Pulse

## Objective
Create a short launch-style brag video for Pulse, a Kiro Crew dashboard app.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080 at 30 fps
- Duration: 23.5 s

## Source Material
- Project root: `/home/vikasagr/github/kirocrew-app-crew-pulse`
- Primary files read: `README.md`, `app.json`, `ui/i18n/en.json`, `ui/src/CrewHomePage.tsx`, `ui/src/NeedsYou.tsx`, `ui/src/styles.ts`, `assets/hero-light.png`, `assets/icon.png`, and the provided page render `crew-pulse-desktop-light.png` (fictional mock data)
- Product name: Pulse
- Tagline / strongest claim: "Mission control for your crew on one page" and "Answer questions and approve tool calls without opening each session."
- Key UI or visual moment to recreate: the stat strip (four tiles) and a "Needs you" question card with its option list and Send answer button
- Copy that must appear verbatim:
  - Pulse
  - What your crew is doing, what is waiting on you, and what is coming up.
  - Active now / Needs you / Scheduled / Today
  - What each agent is doing
  - Needs you
  - Only your explicit submission sends an answer or approval.
  - Send answer
  - Answer questions and approve tool calls without opening each session.
  - Pulse. Mission control for your crew on one page.
  - All systems running

## Creative Direction
- Tone preset: polished
- Creative direction: quiet premium product film, the page speaks in its own copy
- Interpretation: five scenes but polished pacing: long holds, soft 0.6 s crossfades, no bounce, no slides, titles land and stay still. Motion lives in the pan and the cursor.
- Angle: You run a dozen agent sessions, bots and crons and nothing told you which were busy, which were waiting on you, what runs next or what today cost. Pulse is that one page, and the question waiting on you gets answered right there.
- Hook: dark ground, "Sessions. Subagents. Bots. Crons." then "Which one is waiting on you?"
- Outro / punchline: Pulse icon (monoline pulse line in ivory) + "Pulse", "Pulse. Mission control for your crew on one page.", green dot "All systems running"
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign
  - Any live or real data (only the fictional mock render)

## Visual Identity
- Background: #ffffff (light scenes), #19161d (hook and outro)
- Text: #000000 on light, #ffffff on dark, muted #5e5966
- Accent: #8e48ff, tint #f0e8fc, light #d6bbff; Needs you chip #f6f3e5 / #443600; OK green #008543; border #e6e3ea
- Display font: Inter (bundled; nearest to the dashboard grotesk)
- Body font: Inter
- Visual references from the project: `assets/img/crew-pulse-desktop-light.png`, `assets/img/hero-light.png`, `assets/img/icon.svg` (copied into the composition)

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Hook — 3.82 s — two lines on dark, held
2. Reveal — 4.92 s — title, subtitle, four stat tiles on the beat grid
3. The page — 5.99 s — slow vertical pan over the real render, two caption pills
4. Answer from the page — 4.93 s — Needs you card, cursor picks Lakeside Lodge, Send answer on the 17.47 s cue
5. Outro — 3.84 s — icon, wordmark, tagline, All systems running

## Audio
- Audio role: steady clean bed with sparse professional accents
- Audio arc: fade in under the hook, tick with the tiles, two clicks on the card, land on the wordmark, fade out
- Music: `assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`
- Music treatment: volume 0.32, fade in 0.6 s, fade out 1.5 s to the end
- Music cue guidance: bundled preset `/home/vikasagr/.kiro/skills/brag/assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json` (109.96 BPM). Lock 8.74 (scene 3 start), 17.47 (Send answer click), 19.66 (wordmark). Tiles on 5.34, 6.00, 6.56, 7.09.
- Audio-reactive treatment: subtle; per-scene peak bass from `extract-audio-data.py` (media-use skill) modulates the glow behind the hook lines and the wordmark, 3 to 5%. If numpy is unavailable, document and skip.
- Audio-coupled moments:
  - Scene 2 tiles — beat reveal with a soft drop each
  - Scene 4 clicks — click_003 at the option click and the Send answer click, bong_001 under the fill
  - Scene 5 wordmark — impactSoft_medium_001
- SFX selection guidance: low HF-risk files only, 0.5 to 0.7 volume, aligned to the start of each motion
- SFX analysis guidance: `/home/vikasagr/.kiro/skills/brag/assets/sfx/sfx-analysis.md`
- Exact SFX choice: Hyperframes chooses filenames, timestamps, density and volume based on the implemented animation.
- Audio files: copy the chosen music and SFX into `brag-output/composition/assets/`

## Hyperframes Instructions
Follow the `hyperframes` contract (`references/format.md`, `references/motion.md`, `references/look.md`), `hyperframes-registry`, `media-use` and `hyperframes-cli`. This is the /brag workflow: no storyline step, no SPEC.md, no REVIEW.md; `check` is the gate.

Requirements:
- Show at least one real UI element: the page render pan (scene 3) and the recreated tiles and card (scenes 2 and 4).
- Keep all text readable: labels settle at least 0.8 s, sentences 0.3 s per word, last line 2 s or more.
- Keep the video at 23.5 s.
- Include the music and SFX layer as planned.
- Beat locks within ±0.15 s on strong cues, tile entrances within ±0.10 s of the beat grid.
- Audio-reactive glow only on brand elements, never waveforms.
- Local assets only. `npx hyperframes check` with zero errors before render. Local render only.
