import type { SourceKind } from './types'

// Mirrors preload's HistoryEntry — kept as a separate renderer-owned copy
// rather than importing across the process boundary, since the renderer's
// tsconfig root doesn't include src/preload.
export interface HistoryEntry {
  url: string
  visitedAt: number
}

export interface SourceSnapshot {
  kind: SourceKind
  addressInput: string
  navigatedUrl: string | null
}

// Everything about a tab that's worth restoring across a restart. Loaded
// *images* are deliberately not included — their pixel data isn't
// persisted (no file path is kept around to reload from), so a tab
// restores back to "in Image mode, please choose a file again" rather
// than silently losing/duplicating multi-MB data URIs on every save.
export interface TabSnapshot {
  id: string
  title: string
  pinned: boolean
  left: SourceSnapshot
  right: SourceSnapshot
  fitToWindow: boolean
  size: { width: number; height: number }
  activePreset: string | null
  syncScroll: boolean
  scrollSensitivity: number
  zoomSync: boolean
  mode: 'slider' | 'diff'
}

export interface WorkspaceFile {
  tabs: TabSnapshot[]
  activeTabId: string
}

const emptySource: SourceSnapshot = { kind: 'url', addressInput: '', navigatedUrl: null }

let idCounter = 0
export function createTabId(): string {
  idCounter += 1
  return `tab-${Date.now()}-${idCounter}`
}

export function createEmptyTab(): TabSnapshot {
  return {
    id: createTabId(),
    title: 'New workspace',
    pinned: false,
    left: { ...emptySource },
    right: { ...emptySource },
    fitToWindow: true,
    size: { width: 1440, height: 900 },
    activePreset: null,
    syncScroll: true,
    scrollSensitivity: 0.5,
    zoomSync: true,
    mode: 'slider'
  }
}

// A short, recognizable label for the tab strip — the hostname of
// whichever side has something loaded, or a generic placeholder for a
// tab that's still empty.
export function titleFor(left: SourceSnapshot, right: SourceSnapshot): string {
  const label = (s: SourceSnapshot): string | null => {
    if (s.kind === 'image') return 'Image'
    if (!s.navigatedUrl) return null
    try {
      return new URL(s.navigatedUrl).hostname.replace(/^www\./, '')
    } catch {
      return s.navigatedUrl
    }
  }
  const l = label(left)
  const r = label(right)
  if (l && r) return l === r ? l : `${l} vs ${r}`
  return l ?? r ?? 'New workspace'
}
