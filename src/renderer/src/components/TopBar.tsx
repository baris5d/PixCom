import { useEffect, useState } from 'react'

// The window is frameless (see main/index.ts) so this bar is the *only*
// title bar there is — it owns the drag region and the window controls,
// styled to match the rest of the app instead of looking like native OS
// chrome bolted on top of it.
export default function TopBar(): JSX.Element {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    window.api.window.isMaximized().then(setMaximized)
    return window.api.window.onMaximizedChanged(setMaximized)
  }, [])

  return (
    <div className="topbar">
      <div className="topbar-drag">
        <span className="topbar-title">PixCom</span>
        <span className="topbar-subtitle">Load a website or image on each side, then drag the slider to check the match.</span>
      </div>
      <div className="topbar-controls">
        <button
          className="topbar-btn"
          onClick={() => window.api.window.minimize()}
          title="Minimize"
          aria-label="Minimize"
        >
          <svg viewBox="0 0 10 10" width="10" height="10">
            <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
          </svg>
        </button>
        <button
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
        <button
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
      </div>
    </div>
  )
}
