import { useEffect, useState } from 'react'
import SettingsScreen from './SettingsScreen'
import WhatsNewModal from './WhatsNewModal'
import { applyTheme, BUILTIN_THEMES, DEFAULT_THEME_ID, findTheme } from '../theme'
import { entriesSince, type ChangelogEntry } from '../changelog'
import type { Theme, ThemeColors } from '../types'

// The window is frameless (see main/index.ts) so this bar is the *only*
// title bar there is — it owns the drag region and the window controls,
// styled to match the rest of the app instead of looking like native OS
// chrome bolted on top of it.
export default function TopBar(): JSX.Element {
  const [maximized, setMaximized] = useState(false)
  const [version, setVersion] = useState<string | null>(null)
  const [updateVersion, setUpdateVersion] = useState<string | null>(null)
  const [updateProgress, setUpdateProgress] = useState<number | null>(null)
  const [updating, setUpdating] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [modalDismissed, setModalDismissed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [autoUpdateCheck, setAutoUpdateCheck] = useState(true)
  const [themes, setThemes] = useState<Theme[]>(BUILTIN_THEMES)
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID)
  const [whatsNew, setWhatsNew] = useState<{ version: string; entries: ChangelogEntry[] } | null>(null)

  useEffect(() => {
    window.api.window.isMaximized().then(setMaximized)
    return window.api.window.onMaximizedChanged(setMaximized)
  }, [])

  useEffect(() => {
    window.api.getVersion().then(setVersion)
  }, [])

  useEffect(() => {
    window.api.getWhatsNew().then((info) => {
      if (!info.show) return
      const entries = entriesSince(info.previousVersion)
      if (entries.length > 0) setWhatsNew({ version: info.currentVersion, entries })
    })
  }, [])

  useEffect(() => {
    Promise.all([window.api.settings.get(), window.api.themes.listCustom()]).then(([settings, custom]) => {
      setAutoUpdateCheck(settings.autoUpdateCheck)
      const customThemes: Theme[] = custom.map((c) => ({
        id: c.id,
        name: c.name,
        colors: c.colors as unknown as ThemeColors,
        custom: true
      }))
      const combined = [...BUILTIN_THEMES, ...customThemes]
      setThemes(combined)
      const id = settings.themeId || DEFAULT_THEME_ID
      setThemeId(id)
      applyTheme((findTheme(combined, id) ?? BUILTIN_THEMES[0]).colors)
    })
  }, [])

  useEffect(() => {
    const offAvailable = window.api.updater.onAvailable((v) => {
      setUpdateVersion(v)
      setModalDismissed(false)
    })
    const offProgress = window.api.updater.onProgress(setUpdateProgress)
    const offError = window.api.updater.onError((message) => {
      setUpdating(false)
      setUpdateError(message)
    })
    return () => {
      offAvailable()
      offProgress()
      offError()
    }
  }, [])

  function handleUpdateClick(): void {
    setUpdateError(null)
    setUpdating(true)
    window.api.updater.install()
  }

  function toggleAutoUpdateCheck(): void {
    const next = !autoUpdateCheck
    setAutoUpdateCheck(next)
    window.api.settings.set({ autoUpdateCheck: next, themeId })
  }

  function handleSelectTheme(id: string, themeList: Theme[] = themes): void {
    const theme = findTheme(themeList, id)
    if (!theme) return
    setThemeId(id)
    applyTheme(theme.colors)
    window.api.settings.set({ autoUpdateCheck, themeId: id })
  }

  async function handleSaveCustomTheme(name: string, colors: ThemeColors): Promise<void> {
    const id = await window.api.themes.saveCustom(name, colors as unknown as Record<string, string>)
    const newTheme: Theme = { id, name, colors, custom: true }
    const nextThemes = [...themes, newTheme]
    setThemes(nextThemes)
    handleSelectTheme(id, nextThemes)
  }

  function handleDeleteCustomTheme(id: string): void {
    window.api.themes.deleteCustom(id)
    const nextThemes = themes.filter((t) => t.id !== id)
    setThemes(nextThemes)
    if (themeId === id) handleSelectTheme(DEFAULT_THEME_ID, nextThemes)
  }

  // macOS convention: window controls sit at the top-left; everywhere else
  // they sit at the top-right. Rather than fight that with CSS direction
  // tricks, the bar is built as three explicit slots — window controls,
  // the flexible title/drag region, and the update+settings actions —
  // ordered directly so the actions always land on the side opposite the
  // window controls, on either platform.
  const isMac = window.api.platform === 'darwin'

  // The topbar button alone is easy to miss, so a modal grabs attention
  // the moment an update is found. It can be dismissed (still reachable
  // via the small button) unless a download is actively in progress, so
  // the user isn't left wondering whether the app just quit on its own.
  const showUpdateModal = updateVersion !== null && (updating || updateError !== null || !modalDismissed)

  const minimizeBtn = (
    <button
      key="minimize"
      className="topbar-btn"
      onClick={() => window.api.window.minimize()}
      title="Minimize"
      aria-label="Minimize"
    >
      <svg viewBox="0 0 10 10" width="10" height="10">
        <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
      </svg>
    </button>
  )

  const maximizeBtn = (
    <button
      key="maximize"
      className="topbar-btn"
      onClick={() => window.api.window.toggleMaximize()}
      title={maximized ? 'Restore' : 'Maximize'}
      aria-label={maximized ? 'Restore' : 'Maximize'}
    >
      {maximized ? (
        <svg viewBox="0 0 10 10" width="10" height="10">
          <rect x="1.5" y="0" width="7" height="7" fill="none" stroke="currentColor" />
          <rect x="0" y="2" width="7" height="7" fill="none" stroke="currentColor" />
        </svg>
      ) : (
        <svg viewBox="0 0 10 10" width="10" height="10">
          <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" />
        </svg>
      )}
    </button>
  )

  const closeBtn = (
    <button
      key="close"
      className="topbar-btn topbar-btn-close"
      onClick={() => window.api.window.close()}
      title="Close"
      aria-label="Close"
    >
      <svg viewBox="0 0 10 10" width="10" height="10">
        <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" />
        <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" />
      </svg>
    </button>
  )

  const windowControls = (
    <div className="topbar-window-controls">
      {/* macOS traffic-light order is close, minimize, maximize (left to
          right) — the opposite of the Windows/other convention. */}
      {isMac ? (
        <>
          {closeBtn}
          {minimizeBtn}
          {maximizeBtn}
        </>
      ) : (
        <>
          {minimizeBtn}
          {maximizeBtn}
          {closeBtn}
        </>
      )}
    </div>
  )

  const actions = (
    <div className="topbar-actions">
      {updateVersion && (
        <button
          className="topbar-update-btn"
          onClick={handleUpdateClick}
          disabled={updating}
          title={updateError ?? `Update to v${updateVersion} and restart`}
        >
          {updating ? `Updating… ${updateProgress ?? 0}%` : `Update to v${updateVersion}`}
        </button>
      )}
      <button
        className="topbar-btn topbar-settings-btn"
        onClick={() => setSettingsOpen(true)}
        title="Settings"
        aria-label="Settings"
      >
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" fillRule="evenodd">
          {/* Two overlapping gears (big + small), same glyph VS Code uses
              for settings — a single gear kept reading as a sun/aperture
              (theme toggle) icon instead. Verified legible at both large
              size and the actual ~16px render size. */}
          <path d="M6.20,5.10 L6.97,5.17 L7.23,3.69 L9.01,4.30 L8.31,5.62 L9.38,6.42 L9.88,7.01 L11.11,6.15 L11.93,7.84 L10.50,8.28 L10.70,9.60 L10.63,10.37 L12.11,10.63 L11.50,12.41 L10.18,11.71 L9.38,12.78 L8.79,13.28 L9.65,14.51 L7.96,15.33 L7.52,13.90 L6.20,14.10 L5.43,14.03 L5.17,15.51 L3.39,14.90 L4.09,13.58 L3.02,12.78 L2.52,12.19 L1.29,13.05 L0.47,11.36 L1.90,10.92 L1.70,9.60 L1.77,8.83 L0.29,8.57 L0.90,6.79 L2.22,7.49 L3.02,6.42 L3.61,5.92 L2.75,4.69 L4.44,3.87 L4.88,5.30 L6.20,5.10 Z M4.50,9.60 a1.7,1.7 0 1,0 3.40,0 a1.7,1.7 0 1,0 -3.40,0 Z" />
          <path d="M11.60,2.10 L12.26,2.18 L12.51,1.11 L14.02,1.81 L13.35,2.69 L14.11,3.55 L14.38,4.16 L15.43,3.84 L15.57,5.50 L14.48,5.36 L14.11,6.45 L13.71,6.99 L14.52,7.74 L13.15,8.69 L12.72,7.67 L11.60,7.90 L10.94,7.82 L10.69,8.89 L9.18,8.19 L9.85,7.31 L9.09,6.45 L8.82,5.84 L7.77,6.16 L7.63,4.50 L8.72,4.64 L9.09,3.55 L9.49,3.01 L8.68,2.26 L10.05,1.31 L10.48,2.33 L11.60,2.10 Z M10.50,5.00 a1.1,1.1 0 1,0 2.20,0 a1.1,1.1 0 1,0 -2.20,0 Z" />
        </svg>
      </button>
    </div>
  )

  const titleGroup = (
    <div className="topbar-drag">
      <span className="topbar-title">
        PixCom
        {version && <span className="topbar-version">v{version}</span>}
      </span>
      <span className="topbar-subtitle">Load a website or image on each side, then drag the slider to check the match.</span>
    </div>
  )

  return (
    <div className="topbar">
      {isMac ? windowControls : actions}
      {titleGroup}
      {isMac ? actions : windowControls}

      {showUpdateModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Update available</h3>
            <p>
              Version {updateVersion} is ready to install.{' '}
              {updating ? 'Downloading now — the app will restart automatically once it’s done.' : ''}
            </p>
            {updateError && <p className="error">{updateError}</p>}
            <div className="modal-actions">
              {!updating && (
                <button className="modal-btn-secondary" onClick={() => setModalDismissed(true)}>
                  Later
                </button>
              )}
              <button className="modal-btn-primary" onClick={handleUpdateClick} disabled={updating}>
                {updating ? `Updating… ${updateProgress ?? 0}%` : 'Update now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!showUpdateModal && whatsNew && (
        <WhatsNewModal
          currentVersion={whatsNew.version}
          entries={whatsNew.entries}
          onClose={() => setWhatsNew(null)}
        />
      )}

      {settingsOpen && (
        <SettingsScreen
          version={version}
          autoUpdateCheck={autoUpdateCheck}
          onToggleAutoUpdateCheck={toggleAutoUpdateCheck}
          themes={themes}
          themeId={themeId}
          onSelectTheme={handleSelectTheme}
          onSaveCustomTheme={handleSaveCustomTheme}
          onDeleteCustomTheme={handleDeleteCustomTheme}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
