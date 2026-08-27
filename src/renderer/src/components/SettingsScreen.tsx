import { useState } from 'react'

type Tab = 'general' | 'about'

interface Props {
  version: string | null
  autoUpdateCheck: boolean
  onToggleAutoUpdateCheck: () => void
  onClose: () => void
}

const REPO_URL = 'https://github.com/baris5d/PixCom'

// A VS Code–style settings screen: a category sidebar on the left, content
// on the right, instead of a single small confirmation dialog. Only tabs
// with something real behind them exist so far (General: the one actual
// setting; About: app info) — Theme/Colors will get their own tab once
// there's an actual theming system to back them.
export default function SettingsScreen({ version, autoUpdateCheck, onToggleAutoUpdateCheck, onClose }: Props): JSX.Element {
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
