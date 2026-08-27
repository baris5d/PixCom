import darkTheme from './themes/dark.json'
import lightTheme from './themes/light.json'
import nightOwlTheme from './themes/night-owl.json'
import draculaTheme from './themes/dracula.json'
import type { Theme, ThemeColors } from './types'

export const BUILTIN_THEMES: Theme[] = [
  { id: 'dark', name: darkTheme.name, colors: darkTheme.colors as ThemeColors },
  { id: 'light', name: lightTheme.name, colors: lightTheme.colors as ThemeColors },
  { id: 'night-owl', name: nightOwlTheme.name, colors: nightOwlTheme.colors as ThemeColors },
  { id: 'dracula', name: draculaTheme.name, colors: draculaTheme.colors as ThemeColors }
]

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

export function applyTheme(colors: ThemeColors): void {
  const root = document.documentElement.style
  for (const key of Object.keys(CSS_VAR_NAMES) as Array<keyof ThemeColors>) {
    const value = colors[key]
    if (typeof value === 'string' && value.length > 0) {
      root.setProperty(CSS_VAR_NAMES[key], value)
    }
  }
}

export function findTheme(themes: Theme[], id: string): Theme | undefined {
  return themes.find((t) => t.id === id)
}
