import { useEffect, useState } from 'react'
import { applyTheme, THEME_COLOR_KEYS } from '../theme'
import type { Theme, ThemeColors } from '../types'

type Tab = 'general' | 'theme' | 'about'

interface Props {
  version: string | null
  autoUpdateCheck: boolean
  onToggleAutoUpdateCheck: () => void
  themes: Theme[]
  themeId: string
  onSelectTheme: (id: string) => void
  onSaveCustomTheme: (name: string, colors: ThemeColors) => void
  onDeleteCustomTheme: (id: string) => void
  onClose: () => void
}

const REPO_URL = 'https://github.com/baris5d/PixCom'

const FIELD_LABELS: Record<keyof ThemeColors, string> = {
  bgGradient: 'Background gradient',
  textPrimary: 'Primary text',
  textSecondary: 'Secondary text',
  textMuted: 'Muted text',
  textBright: 'Bright text',
  surfaceBg: 'Panel background',
  surfaceBorder: 'Panel border',
  surfaceStrongBg: 'Modal background',
  inputBg: 'Input background',
  inputBorder: 'Input border',
  overlayScrim: 'Modal backdrop',
  hoverBg: 'Hover background',
  divider: 'Divider',
  accentBg: 'Accent background',
  accentBorder: 'Accent border',
  accentText: 'Accent text',
  accentSolid: 'Accent (solid)',
  successBg: 'Success background',
  successBorder: 'Success border',
  successText: 'Success text',
  dangerBg: 'Danger background',
  dangerText: 'Danger text',
  buttonBg: 'Button background',
  buttonBorder: 'Button border',
  buttonHoverBg: 'Button hover',
  sliderColor: 'Slider line',
  sliderHandle: 'Slider handle'
}

// A VS Code–style settings screen: a category sidebar on the left, content
// on the right, instead of a single small confirmation dialog.
export default function SettingsScreen({
  version,
  autoUpdateCheck,
  onToggleAutoUpdateCheck,
  themes,
  themeId,
  onSelectTheme,
  onSaveCustomTheme,
  onDeleteCustomTheme,
  onClose
}: Props): JSX.Element {
  const [tab, setTab] = useState<Tab>('general')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-screen" onClick={(e) => e.stopPropagation()}>
        <div className="settings-screen-header">
          <h3>Settings</h3>
          <button className="modal-close-btn" onClick={onClose} title="Close" aria-label="Close">
            ×
          </button>
        </div>
        <div className="settings-screen-body">
          <div className="settings-sidebar">
            <button className={tab === 'general' ? 'active' : ''} onClick={() => setTab('general')}>
              General
            </button>
            <button className={tab === 'theme' ? 'active' : ''} onClick={() => setTab('theme')}>
              Theme
            </button>
            <button className={tab === 'about' ? 'active' : ''} onClick={() => setTab('about')}>
              About
            </button>
          </div>
          <div className="settings-content">
            {tab === 'general' && (
              <>
                <h4>Updates</h4>
                <label className="settings-row">
                  <input type="checkbox" checked={autoUpdateCheck} onChange={onToggleAutoUpdateCheck} />
                  Automatically check for updates
                </label>
                <p className="settings-hint">
                  Checks for a newer version on launch and shows an update prompt if one's found. Turning this off
                  never checks automatically — you can still update manually from a downloaded installer.
                </p>
              </>
            )}
            {tab === 'theme' && (
              <ThemeTab
                themes={themes}
                themeId={themeId}
                onSelectTheme={onSelectTheme}
                onSaveCustomTheme={onSaveCustomTheme}
                onDeleteCustomTheme={onDeleteCustomTheme}
              />
            )}
            {tab === 'about' && (
              <>
                <h4>PixCom</h4>
                <p className="settings-hint">
                  {version ? `Version ${version}` : 'Version unknown'} — compares a website, image, or Figma frame
                  against another with a pixel-perfect slider overlay.
                </p>
                <button className="settings-link" onClick={() => window.api.openExternal(REPO_URL)}>
                  {REPO_URL.replace('https://', '')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ThemeTab({
  themes,
  themeId,
  onSelectTheme,
  onSaveCustomTheme,
  onDeleteCustomTheme
}: {
  themes: Theme[]
  themeId: string
  onSelectTheme: (id: string) => void
  onSaveCustomTheme: (name: string, colors: ThemeColors) => void
  onDeleteCustomTheme: (id: string) => void
}): JSX.Element {
  const activeTheme = themes.find((t) => t.id === themeId) ?? themes[0]
  const [draft, setDraft] = useState<ThemeColors>(activeTheme.colors)
  const [newName, setNewName] = useState('')
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Editing is scoped to "customize the currently selected theme" — picking
  // a different theme from the list resets the draft to that theme's colors.
  useEffect(() => {
    setDraft(activeTheme.colors)
    setExportMessage(null)
  }, [activeTheme])

  function updateField(key: keyof ThemeColors, value: string): void {
    const next = { ...draft, [key]: value }
    setDraft(next)
    applyTheme(next) // live preview as you edit
  }

  const gradientParts = parseGradientParts(draft.bgGradient)

  function updateGradientPart(key: keyof GradientParts, value: string): void {
    updateField('bgGradient', composeGradient({ ...gradientParts, [key]: value }))
  }

  function handleSave(): void {
    if (!newName.trim()) return
    onSaveCustomTheme(newName.trim(), draft)
    setNewName('')
  }

  async function handleExport(): Promise<void> {
    const path = await window.api.themes.export(
      newName.trim() || activeTheme.name,
      draft as unknown as Record<string, string>
    )
    setExportMessage(path ? `Saved to ${path}` : null)
  }

  return (
    <>
      <h4>Theme</h4>
      <div className="theme-picker-row">
        <div className="theme-dropdown">
          <button className="theme-dropdown-trigger" onClick={() => setDropdownOpen((o) => !o)}>
            <ThemeSwatch colors={activeTheme.colors} />
            <span className="theme-dropdown-label">
              {activeTheme.name}
              {activeTheme.custom ? ' (custom)' : ''}
            </span>
            <span className="theme-dropdown-chevron">{dropdownOpen ? '▴' : '▾'}</span>
          </button>
          {dropdownOpen && (
            <>
              <div className="theme-dropdown-scrim" onClick={() => setDropdownOpen(false)} />
              <div className="theme-dropdown-list">
                {themes.map((t) => (
                  <button
                    key={t.id}
                    className={`theme-dropdown-item${t.id === themeId ? ' active' : ''}`}
                    onClick={() => {
                      onSelectTheme(t.id)
                      setDropdownOpen(false)
                    }}
                  >
                    <ThemeSwatch colors={t.colors} />
                    {t.name}
                    {t.custom ? ' (custom)' : ''}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {activeTheme.custom && (
          <>
            <button
              className="settings-link"
              onClick={() => window.api.themes.revealCustom(activeTheme.id)}
              title="Reveal this theme's JSON file"
            >
              Reveal file
            </button>
            <button
              className="theme-delete-btn"
              title={`Delete "${activeTheme.name}"`}
              aria-label={`Delete ${activeTheme.name}`}
              onClick={() => onDeleteCustomTheme(activeTheme.id)}
            >
              ×
            </button>
          </>
        )}
      </div>

      <h4 style={{ marginTop: 14 }}>Customize</h4>
      <p className="settings-hint" style={{ marginBottom: 8 }}>
        Changes preview live. Give it a name and save it as your own theme, or export it to a file to share.
      </p>

      <div className="theme-fields-panel">
        <div className="theme-fields">
          {THEME_COLOR_KEYS.filter((k) => k !== 'bgGradient').map((key) => (
            <ColorField key={key} label={FIELD_LABELS[key]} value={draft[key]} onChange={(v) => updateField(key, v)} />
          ))}
        </div>

        <label className="theme-field-label" style={{ marginTop: 12, display: 'block' }}>
          {FIELD_LABELS.bgGradient}
        </label>
        <div className="theme-fields" style={{ marginTop: 4 }}>
          <ColorField
            label="Gradient tint 1"
            value={gradientParts.tint1}
            onChange={(v) => updateGradientPart('tint1', v)}
          />
          <ColorField
            label="Gradient tint 2"
            value={gradientParts.tint2}
            onChange={(v) => updateGradientPart('tint2', v)}
          />
          <ColorField
            label="Gradient stop 1"
            value={gradientParts.stop1}
            onChange={(v) => updateGradientPart('stop1', v)}
          />
          <ColorField
            label="Gradient stop 2"
            value={gradientParts.stop2}
            onChange={(v) => updateGradientPart('stop2', v)}
          />
          <ColorField
            label="Gradient stop 3"
            value={gradientParts.stop3}
            onChange={(v) => updateGradientPart('stop3', v)}
          />
        </div>
      </div>

      <div className="modal-actions" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <button className="settings-link" onClick={() => window.api.themes.openFolder()}>
          Open themes folder
        </button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {exportMessage && <span className="settings-hint" style={{ margin: 0 }}>{exportMessage}</span>}
          <input
            className="theme-name-input"
            placeholder="Theme name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <button onClick={handleExport} title="Save this theme to a file you choose">
            Export…
          </button>
          <button className="modal-btn-primary" disabled={!newName.trim()} onClick={handleSave}>
            Save as new theme
          </button>
        </div>
      </div>
    </>
  )
}

// Most tokens are hex or rgba(...) strings — split into a native color
// swatch (hex only) plus an opacity slider when there's an alpha channel,
// instead of asking the user to write CSS by hand.
function parseColor(value: string): { hex: string; alpha: number | null } {
  const rgbaMatch = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/)
  if (rgbaMatch) {
    const [, r, g, b, a] = rgbaMatch
    const hex =
      '#' +
      [r, g, b]
        .map((n) => Math.max(0, Math.min(255, parseInt(n, 10))).toString(16).padStart(2, '0'))
        .join('')
    return { hex, alpha: a !== undefined ? parseFloat(a) : 1 }
  }
  if (/^#[0-9a-fA-F]{6}$/.test(value.trim())) return { hex: value.trim(), alpha: null }
  return { hex: '#888888', alpha: null }
}

interface GradientParts {
  tint1: string
  tint2: string
  stop1: string
  stop2: string
  stop3: string
}

const DEFAULT_GRADIENT_PARTS: GradientParts = {
  tint1: 'rgba(120, 140, 200, 0.1)',
  tint2: 'rgba(90, 160, 170, 0.08)',
  stop1: '#1a1c23',
  stop2: '#1e2028',
  stop3: '#191b21'
}

// Every built-in theme's gradient follows the same two-radial-tint +
// three-stop-linear shape — pull those five colors back out of the CSS
// string so they can be edited as color fields instead of raw text.
function parseGradientParts(value: string): GradientParts {
  const tints = value.match(/rgba?\([^)]*\)/g) ?? []
  const stops = value.match(/#[0-9a-fA-F]{6}/g) ?? []
  return {
    tint1: tints[0] ?? DEFAULT_GRADIENT_PARTS.tint1,
    tint2: tints[1] ?? DEFAULT_GRADIENT_PARTS.tint2,
    stop1: stops[0] ?? DEFAULT_GRADIENT_PARTS.stop1,
    stop2: stops[1] ?? DEFAULT_GRADIENT_PARTS.stop2,
    stop3: stops[2] ?? DEFAULT_GRADIENT_PARTS.stop3
  }
}

function composeGradient(parts: GradientParts): string {
  return `radial-gradient(circle at 15% 10%, ${parts.tint1}, transparent 55%), radial-gradient(circle at 85% 15%, ${parts.tint2}, transparent 55%), linear-gradient(165deg, ${parts.stop1} 0%, ${parts.stop2} 45%, ${parts.stop3} 100%)`
}

function composeColor(hex: string, alpha: number | null): string {
  if (alpha === null) return hex
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 100) / 100})`
}

function ThemeSwatch({ colors }: { colors: ThemeColors }): JSX.Element {
  return (
    <span className="theme-swatch">
      <span style={{ background: colors.accentSolid }} />
      <span style={{ background: colors.successText }} />
      <span style={{ background: colors.dangerText }} />
      <span style={{ background: colors.textPrimary }} />
    </span>
  )
}

function ColorField({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (value: string) => void
}): JSX.Element {
  const { hex, alpha } = parseColor(value)
  return (
    <div className="theme-field">
      <input
        type="color"
        className="theme-field-swatch"
        value={hex}
        onChange={(e) => onChange(composeColor(e.target.value, alpha))}
      />
      <span className="theme-field-label">{label}</span>
      {alpha !== null && (
        <input
          type="range"
          className="theme-field-alpha"
          min={0}
          max={1}
          step={0.01}
          value={alpha}
          onChange={(e) => onChange(composeColor(hex, parseFloat(e.target.value)))}
          title={`Opacity: ${Math.round(alpha * 100)}%`}
        />
      )}
    </div>
  )
}
