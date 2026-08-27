import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export interface AppSettings {
  autoUpdateCheck: boolean
  themeId: string
  // Version this install last showed a "What's new" notice for. Absent
  // entirely on a fresh install (never seen any notice) — that's distinct
  // from "seen everything up to some version", so it isn't in the defaults.
  lastSeenVersion?: string
}

const DEFAULT_SETTINGS: AppSettings = { autoUpdateCheck: true, themeId: 'dark' }

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): AppSettings {
  try {
    const raw = readFileSync(settingsPath(), 'utf8')
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

// Callers (e.g. the renderer's settings.set) only know about the fields
// they themselves manage and send the shape they know in full — merge
// onto what's already on disk so a save from one part of the app doesn't
// silently erase a field only another part of main knows about (like
// lastSeenVersion below).
export function saveSettings(settings: Partial<AppSettings>): void {
  const merged = { ...loadSettings(), ...settings }
  writeFileSync(settingsPath(), JSON.stringify(merged), 'utf8')
}
