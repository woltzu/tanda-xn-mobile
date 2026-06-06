# video-scripts/

Storyboard-ready scripts for short tutorial videos. Each file is ~60-90
seconds when read at a natural pace (roughly 150-225 spoken words plus
beat pauses for transitions).

Per-file structure:

| Section | What goes here |
| --- | --- |
| **Runtime** | Target seconds + spoken-word budget |
| **Scene N** (one per beat) | Scene visuals, narration, on-screen text/callouts, beat duration |
| **End CTA** | What the closing card should drive the viewer to do next |

Beats are timestamped (0:00-0:08, 0:08-0:20, ...) so an editor can cut
to the script without translating prose into a timeline.

Conventions:

- Voiceover is in **plain quotes**.
- On-screen text (callouts, captions, end card) is in `monospace`.
- App-state references match the production app: "Circles tab",
  "+ button", "Advance Hub", etc. Keep them in sync with copy changes.
- No phrasing should imply guaranteed financial outcomes ("you'll
  always", "guaranteed interest"). Stick to neutral product description.

Files:

1. `creating-a-circle.md`
2. `joining-a-circle.md`
3. `creating-a-goal.md`
4. `requesting-an-advance.md`
5. `understanding-xnscore.md`
