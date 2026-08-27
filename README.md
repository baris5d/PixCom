# PixCom

Electron desktop app for comparing a website, image, or (later) Figma frame against
another source, with a draggable before/after slider, a pixel match percentage, and
a live element inspector.

## Sources supported

- Website URL, browsed live (address bar, back/forward/reload, works with
  `localhost:PORT` for local dev servers) — both sides are rendered stacked directly
  on top of each other, at a shared responsive size or a freely resized viewport, and
  the slider clips the live pages themselves (not a screenshot).
- Local image file (PNG/JPG/GIF/WEBP), stacked the same way as a website.

Any combination works: URL vs URL, URL vs image, image vs image. Figma support can be
added later as a third source kind. Scrolling the stage scrolls both live pages in
lockstep, so alignment holds as you scroll down a long page.

The embedded browser spoofs a plain desktop Chrome user agent (Electron's default UA
includes an `Electron/x.y.z` token that some bot-protection services block outright).

## Running the app

Requires Node.js and npm.

```bash
npm install
npm run dev
```

This starts the Vite dev server and launches the Electron window with hot reload for
renderer code (React/CSS). Changes to the **main process** (`src/main/`) or **either
preload script** (`src/preload/`) are not hot-reloaded — quit the app and run
`npm run dev` again to pick those up.

Quit the app from the topbar's close button, or `Ctrl+C`/`Cmd+C` in the terminal
running `npm run dev`.

## Usage

**Loading a page or image.** For each side, either type a URL (bare hosts like
`localhost:3000` are normalized automatically) and hit Go/Enter, or switch to "Image"
and pick a file. The ⇒ / ⇐ button next to each address bar copies that URL to the
other side, for quickly loading the same page on both.

**Sizing the stage.** "Fit to window" (the default) grows the compare area to fill
the available window space as you resize it. Picking a device preset (Mobile,
Tablet, Desktop, …) instead pins the stage to that exact pixel size for
device-accurate comparison; if the preset is larger than the window, it's
automatically scaled down to fit (shown as "zoomed to N%") and rescales live as the
window resizes.

**Comparing visually.** Drag the slider to reveal one source over the other;
scroll/wheel to move both pages together ("Together") or independently
("Independently") — the sensitivity slider controls how fast wheel scrolling pans.
"Swap" flips which side is on the left/right without re-navigating either page.
"Interact (click/hover)" passes clicks and hovers straight through to the pages
instead of the slider, for testing interactive states side by side.

**Element inspector.** Switch "Pages" to "Inspect elements", then click any element
on either page. A floating panel (draggable anywhere, never clipped by the slider)
shows:
- **Structure** — the element's own attributes plus an expandable tree of its
  descendants (it only drills inward from what you clicked, never climbs toward
  `<html>`).
- **Styles** — actual matched CSS rules from the page's stylesheets (selector,
  source, declarations), plus its inline style.
- **Computed** — the full computed style table, filterable by property name.

Both sides can be inspected independently at the same time (two panels, one per
side).

**Comparing one element.** With one element picked on each side, "Compare selected
elements" crops just those two regions and runs the same pixel diff as the full-page
comparison, shown in a small popup — useful when only one component is under test
rather than the whole page.

**Full-page match %.** "Calculate match %" captures both sides at their current
scroll position and runs a pixel-diff (via `pixelmatch`); the result is shown as a
badge. ("Diff overlay" — visually highlighting mismatched pixels on the stage — is
currently disabled.)

## Build

```bash
npm run build   # bundles main/preload/renderer
npm run dist     # packages an installable app via electron-builder
```

## How the match % is computed

Both images are decoded, scaled to the smaller of their two widths, and cropped to
their common height so they're the same pixel dimensions. `pixelmatch` then flags
pixels that differ beyond a perceptual threshold (skipping likely anti-aliasing
noise); the match percentage is `100 - (differing pixels / total pixels) * 100`. The
per-element comparison runs the exact same algorithm, just on a cropped region
instead of the full capture.
