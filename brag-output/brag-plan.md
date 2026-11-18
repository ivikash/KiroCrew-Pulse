# Brag Plan: Pulse

## What is this app?
Pulse is a Kiro Crew dashboard app that puts the whole crew on one page: which agents are running, what is waiting on you, what is scheduled next and what today has cost, with question cards you can answer and tool calls you can approve without opening each session.

## Planning rubric (Step 1)
1. **What is the app?** Mission control for a Kiro Crew on one page (README, app.json description).
2. **Most impressive claim?** "Answer questions and approve tool calls without opening each session." and "Reads the same gateway lists the dashboard pages read, so it never disagrees with them." (app.json highlights).
3. **Visual hook?** The four stat tiles (Active now / Needs you / Scheduled / Today) with the Kiro purple numbers, and the agent board with its activity tracks.
4. **What to show from the actual UI?** The real page render (fictional mock data): stat strip, "What each agent is doing" board, "Needs you" cards, right column (Tokens spent, Upcoming, Bots), footer "All systems running".
5. **Shortest satisfying video?** ~23 s. Hook, tiles, one slow pan over the real page, one answered question card, outro.
6. **Tone?** User asked for `polished`. Direction: quiet premium product film, restraint, long holds, soft crossfades.
7. **Audio?** Steady clean bed (vol-12), 3 to 4 soft SFX matched to the tiles, the two clicks and the final wordmark. Subtle audio-reactive glow only.
8. **Share caption?** "Introducing Pulse: mission control for your Kiro Crew on one page. See which agents are running, what is waiting on you, what runs next and what today cost, then answer and approve from the page."
9. **User flow worth showing?** Open Pulse → scan the tiles and the agent board → a "Needs you" card: pick an option, press Send answer → the card settles as answered, and the footer still says All systems running.

## The angle
You run a dozen agent sessions, bots and crons, and until now nothing told you which of them were busy, which were waiting on you, what runs next or what today cost. Pulse is that one page, and it is not a read-only report: the question waiting on you is answered right there. The video plays it straight: a quiet question on a dark ground, then the page itself answers it in its own words and its own purple.

## Hook (first 2-3 seconds)
Dark ground (#19161d). Two lines in light, generous type:
"Sessions. Subagents. Bots. Crons."
"Which one is waiting on you?"
No motion after they land. The music starts under the first line.

## Key moments (the middle)
- The four stat tiles arriving one by one on the beat, in the app's own labels and mock numbers: **Active now 4**, **Needs you 5**, **Scheduled 5**, **Today $8.38**, under the page title "Pulse" and its subtitle "What your crew is doing, what is waiting on you, and what is coming up."
- A slow vertical pan over the real page (light theme): from the stat strip across "What each agent is doing" with its Needs you / Running chips and activity tracks, down into the "Needs you" cards. Two quiet captions name the sections.
- A "Needs you" card recreated in HTML from the page: "Team offsite planning", "Which venue for the offsite?", a cursor picks "Lakeside Lodge" and presses **Send answer**. The button fills, the card is done.

## Outro / punchline
The Pulse icon and wordmark, then "Pulse. Mission control for your crew on one page." and the footer line with its green dot: "All systems running". Hold.

## User flow worth showing
Entry: the page opens on the tiles. Key action: a question card waiting under Needs you gets an option picked and Send answer pressed. Result: the answer is sent from the page, no session opened, and the footer reads All systems running.

## Tone
- Preset: polished
- Creative direction: quiet premium product film, the page speaks in its own copy
- Interpretation: few scenes, long holds, soft 0.6 s crossfades, Inter at light-to-medium weight with generous tracking, one accent colour, no bounce, no slides. Pace comes from the pan and the cursor, never from flashing text.

## Format: landscape — 1920x1080, 30 fps
## Duration: 23.5 s

## Visual identity (from the project)
- Background (light): #ffffff. Dark ground for the hook and outro: #19161d (the dark theme's page ground).
- Accent: #8e48ff (the 12h pill and the tile numbers). Accent tint: #f0e8fc (Running chip). Accent light: #d6bbff.
- Text: #000000 headings on light, #ffffff on dark. Muted: #5e5966.
- Needs you chip: #f6f3e5 on #443600 text. OK green: #008543. Card border: #e6e3ea.
- Display font: Inter (nearest bundled family to the dashboard's grotesk)
- Body font: Inter
- Strongest visual element: the stat strip and the agent board with purple activity tracks; the Needs you card with its option list and Send answer button.
- Type floor: tile labels and the card's Open session link at 28 px or above (the check's phone-readable floor).
- Source renders (fictional mock data): `composition/assets/img/crew-pulse-desktop-light.png` (3120x2930, 2x), `composition/assets/img/hero-light.png`, `composition/assets/img/icon.svg` (the app icon, pulse line redrawn in ivory for the dark ground).

## Share copy (draft)
Introducing Pulse: mission control for your Kiro Crew on one page. See which agents are running, what is waiting on you, what runs next and what today cost, then answer questions and approve tool calls from the page.

## Audio direction
- Role: steady clean bed with sparse professional accents
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (109.96 BPM, steady and clean, the polished pick)
- Music treatment: start at 0 at 0.32, fade in 0.6 s, fade out over the last 1.5 s under the wordmark
- Music cue guidance: preset read from `<skill-dir>/assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json`. Strong cues to lock: 8.74 s (pan scene starts), 17.47 s (Send answer click), 19.66 s (wordmark lands). Beat grid for the tiles: 5.34, 6.00, 6.56, 7.09 (every beat, labels are 2 words and all stay on screen).
- Audio-reactive treatment: subtle; the purple glow behind the hook lines and the wordmark breathes with the bed's bass, 3 to 5% at most. No waveform or equalizer visuals.
- SFX posture: sparse, motion-matched, low high-frequency risk only (impactSoft_medium, drop, click_003, bong_001)
- Audio-coupled moments: tiles arriving on the beat, the two cursor clicks, the wordmark landing
- Restraint rule: no SFX on text entrances, no sound on the pan, nothing above 0.7

## Storyboard

### Scene 1 — Hook — 3.82 s (0.00 to 3.82)
Dark ground #19161d with a faint purple radial glow low in the frame. Line 1 "Sessions. Subagents. Bots. Crons." blurs in word by word at 0.56 s. Line 2 "Which one is waiting on you?" blurs in at 1.64 s in a lighter weight. Both hold dead still until the crossfade.
Sequential/interaction: yes, two lines, one after the other, both held to the end (line 2 settles for 2 s)
Audio intent: the bed starts quietly, the question hangs
Audio-coupled idea: none (text entrances stay silent)
Music: steady bed, fade in
Transition mood: soft → Scene 2

### Scene 2 — Reveal — 4.92 s (3.82 to 8.74)
White ground. "Pulse" title at 4.39 s (beat) with the subtitle "What your crew is doing, what is waiting on you, and what is coming up." under it. Then the four stat tiles, recreated in HTML with the page's labels, numbers and detail lines, arrive one by one at 5.34, 6.00, 6.56, 7.09 (beat grid): ACTIVE NOW 4 "2 sessions, 1 subagent, and 1 workflow", NEEDS YOU 5 "3 questions and 2 approvals · 2 suggestions", SCHEDULED 5 "Next: Weekly sync doc rollover in 1h · 1 failing · 1 paused", TODAY $8.38 "Today: 9 sessions · 184 messages · 612K tokens · $8.38". All four hold until the crossfade.
Sequential/interaction: yes, 4 tiles one by one on consecutive beats, each held on screen after arrival
Audio intent: the page assembling itself
Audio-coupled idea: a soft drop on each tile arrival
Music: steady bed
Transition mood: soft → Scene 3

### Scene 3 — The page — 5.99 s (8.74 to 14.73)
Full-bleed render of the real page (light theme, fictional data), fit to width, panning slowly from the stat strip down through "What each agent is doing" (Needs you and Running chips, activity tracks, Open session links) into the "Needs you" cards. A small caption pill, bottom left: "What each agent is doing" from 9.29 to 11.46 s, then "Needs you" from 12.02 to 14.73 s.
Sequential/interaction: none, one continuous pan
Audio intent: let the bed carry, nothing else
Audio-coupled idea: none
Music: steady bed
Transition mood: soft → Scene 4

### Scene 4 — Answer from the page — 4.93 s (14.73 to 19.66)
White ground. The "Team offsite planning" Needs-you card recreated in HTML at a readable size: header with "Open session", the note "Only your explicit submission sends an answer or approval.", the question "Which venue for the offsite?", options "Rooftop at the Marina", "Lakeside Lodge", "Let the team vote", "Or type a custom answer...", and the "Send answer" button. A cursor enters, moves to "Lakeside Lodge", clicks at 15.84 s (the option takes the accent border and tint), moves to "Send answer" and clicks at 17.47 s (beat-locked, strong cue); the button fills purple and the card settles. Caption left of the card: "Answer questions and approve tool calls without opening each session." (app.json), on screen from 15.0 s.
Sequential/interaction: yes, simulated cursor: move, click option, move, click Send answer
Audio intent: two clean clicks, the second one is the payoff
Audio-coupled idea: click_003 on both clicks, a soft bong under the Send answer fill
Music: steady bed
Transition mood: soft → Scene 5

### Scene 5 — Outro — 3.84 s (19.66 to 23.50)
Dark ground #19161d. The Pulse icon (the app's monoline pulse line, drawn in ivory on the dark ground) and the wordmark "Pulse" land at 19.66 s (beat-locked). "Pulse. Mission control for your crew on one page." at 20.19 s. Footer line at 20.75 s: green dot, "All systems running". Everything holds to the end; the music fades out from 22.0 s.
Sequential/interaction: yes, wordmark, tagline, footer line, each held to the end
Audio intent: land and rest
Audio-coupled idea: impactSoft_medium on the wordmark landing
Music: steady bed, fade out
Transition mood: hold to end

**Music mood for this video:** steady, clean, upbeat-restrained
**Audio summary:** the bed fades in under the question, the tiles tick in on its beat, two clicks answer the card on a strong cue, and the wordmark lands on the last strong cue as the music fades.

## Privacy note
Every number, name and title on screen comes from the fictional mock dataset in the provided renders (Issue triage: flaky checkout tests, Team offsite planning, Status Bot, $8.38 and so on). No live gateway data, no real sessions, no real people.
