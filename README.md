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

**Updating.** A packaged build checks GitHub Releases for a newer version on
launch. When one exists, an "Update to vX.Y.Z" button appears in the top bar —
clicking it downloads the update and relaunches the app on the new version, no
further steps needed. (Only applies to installed builds; `npm run dev` never
checks.)

## Build

```bash
npm run build   # bundles main/preload/renderer
npm run dist     # packages an installable app (.dmg/.zip on macOS, .exe on Windows) locally
```

`npm run dist` produces an installer under `dist/` for whichever OS you run it on —
useful for testing packaging locally, but not signed/notarized (see below).

## Distributing to non-technical users

The goal: people who've never touched a terminal can download and run this without
cloning the repo or installing Node. Two pieces make that work — a CI pipeline that
builds signed installers and publishes them to GitHub Releases, and (optionally) a
Homebrew Cask on top of that for people who already use `brew`.

The release workflow (`.github/workflows/release.yml`) builds both **macOS** and
**Windows** installers in parallel and publishes them to the same GitHub Release.

### One-time setup (macOS) — done

The Apple secrets below are already configured on this repo, so macOS builds are
code-signed and notarized — recipients get **no Gatekeeper warning** at all. For
reference, what's set:

| Secret | What it's for |
| --- | --- |
| `CSC_LINK` | Base64 of the Apple **Developer ID Application** certificate (`.p12`) |
| `CSC_KEY_PASSWORD` | The `.p12`'s export password |
| `APPLE_ID` | The Apple ID (email) tied to that certificate |
| `APPLE_APP_SPECIFIC_PASSWORD` | An [app-specific password](https://support.apple.com/en-us/102654) for that Apple ID |
| `APPLE_TEAM_ID` | The Apple Developer Team ID |

### One-time setup (Windows) — optional, not done yet

Windows ships **unsigned** right now, so recipients see a one-time SmartScreen
"unknown publisher" warning (click "More info" → "Run anyway"). Fine for an internal
tool; for a fully clean install, get a code signing certificate (an OV/EV cert from a
CA like DigiCert, Sectigo, SSL.com, or your org's existing one) and add:

| Secret | What it's for |
| --- | --- |
| `WIN_CSC_LINK` | Base64 of the certificate (`.p12`/`.pfx`): `base64 -i cert.pfx \| pbcopy` (or `certutil -encode` on Windows) |
| `WIN_CSC_KEY_PASSWORD` | The certificate's export password |

Then add both under the Windows step's `env:` in `.github/workflows/release.yml`
(left out on purpose until they exist — see the comment there for why).

### Cutting a release

```bash
npm version minor   # or patch/major — bumps package.json and creates a git tag
git push && git push --tags
```

Pushing a `vX.Y.Z` tag triggers `.github/workflows/release.yml`, which builds and
publishes the installer(s) straight to a GitHub Release for that tag (`npm run
release` under the hood — same as `dist` but with `--publish always`).

### What recipients do

Send them the Releases page (`github.com/baris5d/PixCom/releases/latest`):

- **macOS**: download `PixCom-<version>-arm64.dmg`, open it, drag PixCom into
  Applications.
- **Windows**: download `PixCom-<version>-x64.exe` and run it.

No terminal, no Node, no git required.

### Optional: Homebrew Cask

For teams that already use `brew`, a Cask gives them `brew install --cask pixcom` and
`brew upgrade --cask pixcom` instead of manually checking the Releases page. It's not
a replacement for the `.dmg` above — Homebrew itself isn't something non-technical
users typically have installed — just a nicer path for people who do.

A ready-to-copy Cask template lives at `packaging/homebrew/pixcom.rb`. Homebrew taps
must live in their own repo named `homebrew-<tapname>`, so it can't be installed
straight from this repo — see the comment at the top of that file for the one-time
setup, and update its `version`/`sha256` after each release with:

```bash
shasum -a 256 PixCom-<version>-arm64.dmg
```

## How the match % is computed

Both images are decoded, scaled to the smaller of their two widths, and cropped to
their common height so they're the same pixel dimensions. `pixelmatch` then flags
pixels that differ beyond a perceptual threshold (skipping likely anti-aliasing
noise); the match percentage is `100 - (differing pixels / total pixels) * 100`. The
per-element comparison runs the exact same algorithm, just on a cropped region
instead of the full capture.
