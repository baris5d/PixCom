export interface ChangelogEntry {
  version: string
  date: string
  highlights: string[]
}

// Newest first. Add one entry per release here (and update
// CHANGELOG.md to match) — this is what the in-app "What's new" notice
// and the About tab read from.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.4.0',
    date: '2026-08-27',
    highlights: [
      'Tabs: run several comparisons at once as workspaces, pin the ones you revisit often',
      'Every tab is restored automatically when you reopen the app — URLs, device size, zoom, all of it',
      'Navigation history — a dropdown on each address bar to jump back to any visited URL',
      'Canvas zoom & pan: Ctrl/Cmd + scroll (or pinch) to zoom into either or both pages, then drag to pan around',
      'The app UI itself no longer behaves like a selectable webpage'
    ]
  },
  {
    version: '0.3.0',
    date: '2026-08-27',
    highlights: [
      '22 built-in themes to pick from, plus support for your own custom JSON themes',
      'Redesigned compare toolbar: cleaner source panels, a swap button between them, and the scroll/mode/view controls combined into one row',
      'Fixed low-contrast text and hard-to-see borders across every built-in theme',
      'Smaller, clearer back/forward/reload icons and softer shadows throughout'
    ]
  }
]

// Entries strictly newer than `previousVersion` — CHANGELOG is stored
// newest-first in release order, so this is a simple index slice rather
// than a semver comparison. Falls back to just the latest entry if
// `previousVersion` predates anything in the list (e.g. an install that
// updated from a version before changelog tracking existed).
export function entriesSince(previousVersion: string | null): ChangelogEntry[] {
  if (previousVersion === null) return []
  const idx = CHANGELOG.findIndex((entry) => entry.version === previousVersion)
  if (idx === -1) return CHANGELOG.slice(0, 1)
  return CHANGELOG.slice(0, idx)
}
