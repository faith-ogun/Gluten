# Glüten — Demo Animations

Remotion compositions for the cutaway animations in the demo video.
Each `<Composition>` produces an MP4 you can drop into iMovie / Final Cut /
Resolve alongside the screen recording and voice-over.

The cue points are in `kaggle/demo-script.md` — every `[ANIM: ...]` block
in the script maps to one composition here.

## What's here

| Composition | Duration | What it shows |
|---|---|---|
| `OneInOne` | 6.0s (180f @ 30fps) | "1 in 100" prevalence + "70%" undiagnosed counter. Catassi/Her.ie sources. |
| `DiagnosticBias` | 6.0s (180f) | Two-bar chart: tTG-IgA sensitivity for White vs Black patients with the "gap" annotation. PMC11308727 citation. |
| `ResearchVoid` | 6.0s (180f) | Three horizontal bars: 32,725 total CD papers vs 3,400 European vs 274 African. <1% callout. |
| `DualEntry` | 5.5s (165f) | Screen + Twin mode cards feeding into the central six-layer engine. Subcaption: powered by Gemma 4. |
| `SixLayers` | 6.0s (180f) | Six labelled chips fan out around the Glüten "Glü" mark. Each chip carries its dataset name. |
| `ConfidenceFlag` | 6.0s (180f) | Per-layer confidence bars (4 high, 2 near-zero) for an African-female-28 profile. The equity reveal. |
| `IBDColEpiPivot` | 6.5s (195f) | Side-by-side: Cambridge DSA-locked duodenum vs IBDColEpi CC0 colon, with the literal Pettersen quote on a ribbon. |
| `HundredTwins` | 6.0s (180f) | 10x10 grid. Gold Twin #1 (Glüten), 99 grey silhouettes (sampled labels: Lupus, T1D, MS, Hashimoto, IBD...). EU VHT caption. |
| `FinalCard` | 5.5s (165f) | Wordmark + "Your body. Your data. Your twin." + standards row + gluten.app pill. |

Resolution: 1920×1080. Colours mirror `web/src/app/globals.css` (cream `#FAF7F2`,
wheat `#D4A843`, wheat-deep `#B8902F`, charcoal `#1A1712`, alert `#C94432`,
safe `#3D8B5E`).

Fonts: DM Serif Display + DM Sans + JetBrains Mono. Same stack as the live
landing page. The cutaways and the live UI read as one continuous identity.

## Run it

```bash
cd animations
npm install
npm start
```

Opens **Remotion Studio** at `http://localhost:3000`. Scrub any composition,
edit the `.tsx` file, the preview updates on save.

## Render to MP4

```bash
npm run render:one          # → out/one-in-one.mp4
npm run render:bias         # → out/diagnostic-bias.mp4
npm run render:entry        # → out/dual-entry.mp4
npm run render:layers       # → out/six-layers.mp4
npm run render:confidence   # → out/confidence-flag.mp4
npm run render:pivot        # → out/ibdcolepi-pivot.mp4
npm run render:void         # → out/research-void.mp4
npm run render:hundred      # → out/hundred-twins.mp4
npm run render:final        # → out/final.mp4
npm run render:all          # all nine, in script order
```

First render builds Chromium for off-screen rendering (~30s). Subsequent
renders are fast.

## File map

```
animations/
├── package.json            Remotion + React deps
├── tsconfig.json           TS config
├── remotion.config.ts      MP4 output preferences
├── README.md               This file
├── examples/               Previous-project Remotion project, kept for reference
└── src/
    ├── index.ts            Remotion entry — registers the root
    ├── Root.tsx            Lists every <Composition>
    ├── theme.ts            Glüten brand tokens (mirrors globals.css)
    ├── OneInOne.tsx        "1 in 100" + "70%" opener
    ├── DiagnosticBias.tsx  tTG-IgA bias chart
    ├── ResearchVoid.tsx    PubMed literature distribution
    ├── DualEntry.tsx       Screen + Twin → engine pipeline
    ├── SixLayers.tsx       Six-layer fan-out
    ├── ConfidenceFlag.tsx  Per-layer confidence reveal
    ├── IBDColEpiPivot.tsx  Duodenum-locked → colon-transferable with quote
    ├── HundredTwins.tsx    Twin #1 of 100 grid
    └── FinalCard.tsx       Closing card
```

## Pacing in the timeline

The script (`kaggle/demo-script.md`) is the source of truth for what plays
when. As a rough guide, the heavier animations (`IBDColEpiPivot`,
`ConfidenceFlag`, `HundredTwins`) are the cinematic beats — let them hold
the screen for their full duration without the VO crowding them.

The lighter ones (`OneInOne`, `DualEntry`, `FinalCard`) can crossfade
into the next clip earlier if the timeline runs long.

## Editing

Every composition is a single React component. Animations use Remotion's
`useCurrentFrame()`, `interpolate()`, and `spring()`. The "Beats" comment
block at the top of each component lists what happens at which frame —
edit those numbers to retime.

To add a new card, copy any of the simpler files (e.g. `OneInOne.tsx`),
rename the component, and register it in `Root.tsx`.

## Why Remotion (and not Keynote/Canva)?

- Animations live in git, diff cleanly, render the same every time.
- Frame-accurate timing without nudging keyframes by hand.
- Theme is one file (`theme.ts`) — re-skin in one edit, not nine passes.
- The whole project survives losing the working file.
- Free for individuals (their licence covers this use case).
