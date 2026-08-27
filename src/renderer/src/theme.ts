import type { Theme, ThemeColors } from './types'

// Auto-discovers every JSON file in ./themes at build time — adding a new
// built-in theme is just dropping a file there, no import list to update.
const modules = import.meta.glob('./themes/*.json', { eager: true }) as Record<
  string,
  { name: string; colors: ThemeColors }
>

export const BUILTIN_THEMES: Theme[] = Object.entries(modules)
  .map(([path, mod]) => {
    const id = path.match(/\/([^/]+)\.json$/)?.[1] ?? path
    return { id, name: mod.name, colors: mod.colors }
  })
  .sort((a, b) => a.name.localeCompare(b.name))

export const DEFAULT_THEME_ID = 'dark'

const CSS_VAR_NAMES: Record<keyof ThemeColors, string> = {
  bgGradient: '--theme-bg-gradient',
  textPrimary: '--theme-text-primary',
  textSecondary: '--theme-text-secondary',
  textMuted: '--theme-text-muted',
  textBright: '--theme-text-bright',
  surfaceBg: '--theme-surface-bg',
  surfaceBorder: '--theme-surface-border',
  surfaceStrongBg: '--theme-surface-strong-bg',
  inputBg: '--theme-input-bg',
  inputBorder: '--theme-input-border',
  overlayScrim: '--theme-overlay-scrim',
  hoverBg: '--theme-hover-bg',
  divider: '--theme-divider',
  accentBg: '--theme-accent-bg',
  accentBorder: '--theme-accent-border',
  accentText: '--theme-accent-text',
  accentSolid: '--theme-accent-solid',
  successBg: '--theme-success-bg',
  successBorder: '--theme-success-border',
  successText: '--theme-success-text',
  dangerBg: '--theme-danger-bg',
  dangerText: '--theme-danger-text',
  buttonBg: '--theme-button-bg',
  buttonBorder: '--theme-button-border',
  buttonHoverBg: '--theme-button-hover-bg',
  sliderColor: '--theme-slider-color',
  sliderHandle: '--theme-slider-handle'
}

export const THEME_COLOR_KEYS = Object.keys(CSS_VAR_NAMES) as Array<keyof ThemeColors>

export function applyTheme(colors: ThemeColors): void {
  const root = document.documentElement.style
  for (const key of THEME_COLOR_KEYS) {
    const value = colors[key]
    if (typeof value === 'string' && value.length > 0) {
      root.setProperty(CSS_VAR_NAMES[key], value)
    }
  }
}

export function findTheme(themes: Theme[], id: string): Theme | undefined {
  return themes.find((t) => t.id === id)
}
