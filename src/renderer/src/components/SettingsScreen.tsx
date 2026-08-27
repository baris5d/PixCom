import { useEffect, useState } from 'react'
import { applyTheme } from '../theme'
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
  const [json, setJson] = useState(() => JSON.stringify(activeTheme.colors, null, 2))
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [savingAs, setSavingAs] = useState(false)
  const [newName, setNewName] = useState('')

  // Editing is scoped to "customize the currently selected theme" — picking
  // a different theme from the list resets the draft to that theme's colors.
  useEffect(() => {
    setJson(JSON.stringify(activeTheme.colors, null, 2))
    setJsonError(null)
  }, [activeTheme])

  function parseDraft(): ThemeColors | null {
    try {
      const parsed = JSON.parse(json)
      if (typeof parsed !== 'object' || parsed === null) throw new Error('Not an object')
      setJsonError(null)
      return parsed as ThemeColors
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON')
      return null
    }
  }

  function handlePreview(): void {
    // Apply without saving, so you can see the effect before committing to
    // a name — switching to another theme in the list discards it.
    const colors = parseDraft()
    if (colors) applyTheme(colors)
  }

  function handleConfirmSaveAs(): void {
    const colors = parseDraft()
    if (!colors || !newName.trim()) return
    onSaveCustomTheme(newName.trim(), colors)
    setSavingAs(false)
    setNewName('')
  }

  return (
    <>
      <h4>Theme</h4>
      <div className="theme-list">
        {themes.map((t) => (
          <div key={t.id} className={`theme-list-item${t.id === themeId ? ' active' : ''}`}>
            <button className="theme-list-btn" onClick={() => onSelectTheme(t.id)}>
              <span className="theme-swatch">
                <span style={{ background: t.colors.accentSolid }} />
                <span style={{ background: t.colors.successText }} />
                <span style={{ background: t.colors.dangerText }} />
                <span style={{ background: t.colors.textPrimary }} />
              </span>
              {t.name}
            </button>
            {t.custom && (
              <button
                className="theme-delete-btn"
                title={`Delete "${t.name}"`}
                aria-label={`Delete ${t.name}`}
                onClick={() => onDeleteCustomTheme(t.id)}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <h4 style={{ marginTop: 20 }}>Customize</h4>
      <p className="settings-hint">
        Edit any value below (colors, gradients, anything valid CSS) and save it as a new theme. Themes are plain
        JSON — you (or anyone) can also drop files with this same shape straight into the themes folder.
      </p>
      <textarea className="theme-json-editor" value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
      {jsonError && <p className="error">{jsonError}</p>}
      <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
        <button className="settings-link" onClick={() => window.api.themes.openFolder()}>
          Open themes folder
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handlePreview}>Preview</button>
          {savingAs ? (
            <>
              <input
                className="theme-name-input"
                autoFocus
                placeholder="Theme name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmSaveAs()}
              />
              <button className="modal-btn-primary" disabled={!newName.trim()} onClick={handleConfirmSaveAs}>
                Save
              </button>
            </>
          ) : (
            <button className="modal-btn-primary" onClick={() => setSavingAs(true)}>
              Save as new theme…
            </button>
          )}
        </div>
      </div>
    </>
  )
}
