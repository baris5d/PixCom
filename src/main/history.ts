import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// One shared history across both sides and every tab, same as a browser's
// history isn't scoped per-tab either.
export interface HistoryEntry {
  url: string
  visitedAt: number
}

const MAX_ENTRIES = 200

function historyPath(): string {
  return join(app.getPath('userData'), 'history.json')
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = readFileSync(historyPath(), 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Re-visiting a URL moves it back to the front instead of leaving a stale
// duplicate behind, same as most browsers' history.
export function addHistoryEntry(url: string): HistoryEntry[] {
  const trimmed = url.trim()
  if (!trimmed) return loadHistory()
  const existing = loadHistory().filter((e) => e.url !== trimmed)
  const next = [{ url: trimmed, visitedAt: Date.now() }, ...existing].slice(0, MAX_ENTRIES)
  writeFileSync(historyPath(), JSON.stringify(next), 'utf8')
  return next
}

export function clearHistory(): void {
  if (existsSync(historyPath())) writeFileSync(historyPath(), JSON.stringify([]), 'utf8')
}
