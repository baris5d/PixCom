import { useEffect, useState } from 'react'
import SettingsScreen from './SettingsScreen'

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

  useEffect(() => {
    window.api.window.isMaximized().then(setMaximized)
    return window.api.window.onMaximizedChanged(setMaximized)
  }, [])

  useEffect(() => {
    window.api.getVersion().then(setVersion)
  }, [])

  useEffect(() => {
    window.api.settings.get().then((s) => setAutoUpdateCheck(s.autoUpdateCheck))
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
    window.api.settings.set({ autoUpdateCheck: next })
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
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor">
          {/* Dashed ring reads as gear teeth around a center hole. */}
          <circle cx="8" cy="8" r="6" strokeWidth="2.6" strokeDasharray="2.3 2.3" />
          <circle cx="8" cy="8" r="2.1" strokeWidth="1.4" />
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

      {settingsOpen && (
        <SettingsScreen
          version={version}
          autoUpdateCheck={autoUpdateCheck}
          onToggleAutoUpdateCheck={toggleAutoUpdateCheck}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
