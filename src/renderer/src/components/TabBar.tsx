import { titleFor, type TabSnapshot } from '../workspace'

interface Props {
  tabs: TabSnapshot[]
  activeTabId: string
  onSelect: (id: string) => void
  onAdd: () => void
  onClose: (id: string) => void
  onTogglePin: (id: string) => void
}

// Pinned tabs sort first (their own relative order preserved), same as
// browser tab strips — the "you always know where these are" convenience
// is the whole point of pinning.
export default function TabBar({ tabs, activeTabId, onSelect, onAdd, onClose, onTogglePin }: Props): JSX.Element {
  const ordered = [...tabs.filter((t) => t.pinned), ...tabs.filter((t) => !t.pinned)]

  return (
    <div className="tab-bar">
      <div className="tab-list">
        {ordered.map((tab) => {
          const title = titleFor(tab.left, tab.right) || tab.title
          const active = tab.id === activeTabId
          return (
            <div
              key={tab.id}
              className={`tab-chip${active ? ' active' : ''}${tab.pinned ? ' pinned' : ''}`}
              onClick={() => onSelect(tab.id)}
              title={title}
            >
              <button
                className="tab-pin-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onTogglePin(tab.id)
                }}
                title={tab.pinned ? 'Unpin tab' : 'Pin tab'}
                aria-label={tab.pinned ? 'Unpin tab' : 'Pin tab'}
              >
                <svg viewBox="0 0 16 16" width="11" height="11" fill={tab.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.3">
                  <path d="M6 2.5 H10 L9.3 6.5 L11.5 8.8 H4.5 L6.7 6.5 Z" strokeLinejoin="round" />
                  <line x1="8" y1="8.8" x2="8" y2="13.2" strokeLinecap="round" />
                </svg>
              </button>
              {!tab.pinned && <span className="tab-title">{title}</span>}
              {!tab.pinned && (
                <button
                  className="tab-close-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    onClose(tab.id)
                  }}
                  title="Close tab"
                  aria-label="Close tab"
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
        <button className="tab-add-btn" onClick={onAdd} title="New workspace tab" aria-label="New workspace tab">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M8 3 V13 M3 8 H13" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
