# Building, packaging, and releasing

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
**Windows** installers in parallel and publishes them to the same GitHub Release. A
follow-up cleanup job removes any stray duplicate release electron-builder's retry
logic occasionally leaves behind for the same tag.

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

Add a matching entry to `CHANGELOG.md` **and** `src/renderer/src/changelog.ts` before
tagging — the latter drives the in-app "What's new" notice shown after an update.

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
