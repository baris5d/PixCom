# Pixel Compare

Electron desktop app for comparing a website, image, or (later) Figma frame against
another source, with a draggable before/after slider and a pixel match percentage.

## Sources supported

- Website URL, browsed live (address bar, back/forward/reload, works with
  `localhost:PORT` for local dev servers) — both sides are rendered stacked directly
  on top of each other, at a shared responsive size preset or a freely resized
  viewport, and the slider clips the live pages themselves (not a screenshot).
- Local image file (PNG/JPG/GIF/WEBP), stacked the same way as a website.

Any combination works: URL vs URL, URL vs image, image vs image. Figma support can be
added later as a third source kind. Scrolling the stage scrolls both live pages in
lockstep, so alignment holds as you scroll down a long page.

The embedded browser spoofs a plain desktop Chrome user agent (Electron's default UA
includes an `Electron/x.y.z` token that some bot-protection services block outright).

## Usage

```bash
npm install
npm run dev
```

For each side: type a URL (or `localhost:3000`) and hit Go, or switch to "Image" and
pick a file. Pick a size preset or drag the stage's resize handle — both sides always
share one size so they line up. Drag the slider to reveal the right source over the
left one; scroll with the mouse wheel to move both pages together. Click "Calculate
match %" to capture both sides at their current scroll position and run a pixel-diff
(via `pixelmatch`), then switch to "Diff overlay" to see mismatched pixels highlighted.

## Build

```bash
npm run build   # bundles main/preload/renderer
npm run dist     # packages an installable app via electron-builder
```

## How the match % is computed

Both images are decoded, scaled to the smaller of their two widths, and cropped to
their common height so they're the same pixel dimensions. `pixelmatch` then flags
pixels that differ beyond a perceptual threshold; the match percentage is
`100 - (differing pixels / total pixels) * 100`.
