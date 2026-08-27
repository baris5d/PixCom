import { app, dialog, shell } from 'electron'
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'

// Anyone can drop a .json file matching this shape into this folder to add
// their own theme, no rebuild needed — the app just reads whatever's there
// on demand.
export interface CustomThemeFile {
  id: string
  name: string
  colors: Record<string, string>
}

function themesDir(): string {
  const dir = join(app.getPath('userData'), 'themes')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function listCustomThemes(): CustomThemeFile[] {
  const dir = themesDir()
  const themes: CustomThemeFile[] = []
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.json')) continue
    try {
      const raw = readFileSync(join(dir, entry), 'utf8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed.name === 'string' && typeof parsed.colors === 'object') {
        themes.push({ id: entry.replace(/\.json$/, ''), name: parsed.name, colors: parsed.colors })
      }
    } catch {
      // Malformed theme file — skip it rather than fail the whole list.
    }
  }
  return themes
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'theme'
}

export function saveCustomTheme(name: string, colors: Record<string, string>): string {
  const dir = themesDir()
  let id = slugify(name)
  let suffix = 2
  while (existsSync(join(dir, `${id}.json`))) {
    id = `${slugify(name)}-${suffix}`
    suffix += 1
  }
  writeFileSync(join(dir, `${id}.json`), JSON.stringify({ name, colors }, null, 2), 'utf8')
  return id
}

export function deleteCustomTheme(id: string): void {
  const path = join(themesDir(), `${id}.json`)
  if (existsSync(path)) unlinkSync(path)
}

export function openThemesFolder(): void {
  shell.openPath(themesDir())
}

/** Reveals a custom theme's file in Finder/Explorer. No-op for built-in
 *  themes, which don't have a file on disk to point to. */
export function revealCustomTheme(id: string): void {
  const path = join(themesDir(), `${id}.json`)
  if (existsSync(path)) shell.showItemInFolder(path)
}

/** Lets the user save the current draft (built-in or custom, edited or
 *  not) to wherever they choose, e.g. to hand the file to someone else —
 *  independent of the userData themes folder. */
export async function exportTheme(name: string, colors: Record<string, string>): Promise<string | null> {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export theme',
    defaultPath: `${slugify(name)}.json`,
    filters: [{ name: 'Theme', extensions: ['json'] }]
  })
  if (canceled || !filePath) return null
  writeFileSync(filePath, JSON.stringify({ name, colors }, null, 2), 'utf8')
  return filePath
}
