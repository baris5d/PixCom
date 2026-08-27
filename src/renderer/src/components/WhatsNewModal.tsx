import type { ChangelogEntry } from '../changelog'

interface Props {
  currentVersion: string
  entries: ChangelogEntry[]
  onClose: () => void
}

export default function WhatsNewModal({ currentVersion, entries, onClose }: Props): JSX.Element {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card whats-new-card" onClick={(e) => e.stopPropagation()}>
        <h3>What's new in v{currentVersion}</h3>
        {entries.map((entry) => (
          <div key={entry.version} className="whats-new-entry">
            {entries.length > 1 && <p className="whats-new-version">v{entry.version}</p>}
            <ul className="whats-new-list">
              {entry.highlights.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
        <div className="modal-actions">
          <button className="modal-btn-primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
