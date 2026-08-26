# Pixel Compare

Electron desktop app for comparing a website, image, or (later) Figma frame against
another source, with a draggable before/after slider and a pixel match percentage.

## Sources supported

- Website URL (rendered in an offscreen window at a chosen viewport width, optionally
  capturing the full scrollable page)
- Local image file (PNG/JPG/GIF/WEBP)

Any combination works: URL vs URL, URL vs image, image vs image. Figma support can be
added later as a third source kind alongside `url` and `image`.

## Usage

```bash
npm install
npm run dev
```

Load a source on each side, then drag the slider over the stage to reveal the right
source over the left one and check alignment. Click "Calculate match %" to run a
pixel-diff (via `pixelmatch`) and see an overlay highlighting mismatched pixels.

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
