import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import type { InspectMatchedRule, InspectSelection, InspectTreeNode } from '../types'

type Tab = 'structure' | 'styles' | 'computed'

interface Props {
  selection: InspectSelection
  side: 'left' | 'right'
  /** Which corner this panel starts docked in before the user drags it —
   *  keeps the left- and right-side panels from opening stacked on each
   *  other, since both sides can be inspected independently at once. */
  defaultCorner: 'left' | 'right'
  onClose: () => void
}

// Floating, freely-draggable panel rendered in the HOST document — never
// inside the inspected page — so it always sits on top of both compare
// layers and is never clipped by the compare slider's clip-path.
export default function InspectPanel({ selection, side, defaultCorner, onClose }: Props): JSX.Element {
  const [tab, setTab] = useState<Tab>('structure')
  const [filter, setFilter] = useState('')
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{ x: number; y: number; startLeft: number; startTop: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTab('structure')
    setFilter('')
  }, [selection])

  function handleHeaderPointerDown(e: ReactPointerEvent): void {
    if ((e.target as HTMLElement).closest('button, input')) return
    const panel = panelRef.current
    if (!panel) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const rect = panel.getBoundingClientRect()
    dragRef.current = { x: e.clientX, y: e.clientY, startLeft: rect.left, startTop: rect.top }
  }
  function handleHeaderPointerMove(e: ReactPointerEvent): void {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.x
    const dy = e.clientY - dragRef.current.y
    setPos({ x: dragRef.current.startLeft + dx, y: dragRef.current.startTop + dy })
  }
  function handleHeaderPointerUp(): void {
    dragRef.current = null
  }

  const style: CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : defaultCorner === 'left'
      ? { left: 20, right: 'auto' }
      : {}

  return (
    <div className="inspect-panel" ref={panelRef} style={style}>
      <div
        className="inspect-panel-header"
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
      >
        <span className="inspect-panel-title">
          <span className={`inspect-side-badge inspect-side-${side}`}>{side}</span>
          {selection.label || selection.tag}
        </span>
        <button className="inspect-panel-close" onClick={onClose} title="Close">
          ×
        </button>
      </div>

      <div className="inspect-panel-tabs">
        <button className={tab === 'structure' ? 'active' : ''} onClick={() => setTab('structure')}>
          Structure
        </button>
        <button className={tab === 'styles' ? 'active' : ''} onClick={() => setTab('styles')}>
          Styles
        </button>
        <button className={tab === 'computed' ? 'active' : ''} onClick={() => setTab('computed')}>
          Computed
        </button>
      </div>

      {(tab === 'computed' || tab === 'styles') && (
        <input
          className="inspect-filter"
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      )}

      <div className="inspect-panel-body">
        {tab === 'structure' && <StructureTab selection={selection} />}
        {tab === 'styles' && (
          <StylesTab rules={selection.matchedRules} skipped={selection.skippedStylesheets} filter={filter} />
        )}
        {tab === 'computed' && <ComputedTab entries={selection.computed} filter={filter} />}
      </div>
    </div>
  )
}

function StructureTab({ selection }: { selection: InspectSelection }): JSX.Element {
  return (
    <div>
      <Row label="Tag" value={selection.tag} />
      {selection.id && <Row label="ID" value={selection.id} />}
      {selection.classes && <Row label="Classes" value={selection.classes} />}
      <Row label="Size" value={`${selection.size.width} × ${selection.size.height}`} />
      <Row label="Position" value={`x:${selection.position.x} y:${selection.position.y}`} />
      {selection.attributes.map(([name, value]) => (
        <Row key={name} label={name} value={value} />
      ))}
      <div className="inspect-section-label">Children ({selection.tree.childCount})</div>
      <TreeChildren node={selection.tree} depth={1} />
    </div>
  )
}

// Renders only the DESCENDANTS of the selected element (never its
// ancestors) — the tree starts at what you clicked and drills inward.
function TreeChildren({ node, depth }: { node: InspectTreeNode; depth: number }): JSX.Element {
  if (node.children.length === 0) return <div className="inspect-empty">No children</div>
  return (
    <div>
      {node.children.map((child, i) => (
        <TreeNode key={i} node={child} depth={depth} />
      ))}
      {node.moreChildren ? <div className="inspect-more">+{node.moreChildren} more</div> : null}
    </div>
  )
}

function TreeNode({ node, depth }: { node: InspectTreeNode; depth: number }): JSX.Element {
  const [expanded, setExpanded] = useState(depth <= 1)
  const label =
    node.tag +
    (node.id ? '#' + node.id : '') +
    (node.classes ? '.' + node.classes.split(/\s+/).filter(Boolean).join('.') : '')
  const hasChildren = node.children.length > 0

  return (
    <div className="inspect-tree-node">
      <div
        className="inspect-tree-row"
        style={{ paddingLeft: (depth - 1) * 14 }}
        onClick={() => hasChildren && setExpanded((e) => !e)}
      >
        {hasChildren ? (
          <span className="inspect-tree-caret">{expanded ? '▾' : '▸'}</span>
        ) : (
          <span className="inspect-tree-caret-spacer" />
        )}
        <span className="inspect-tree-label">{label}</span>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child, i) => (
            <TreeNode key={i} node={child} depth={depth + 1} />
          ))}
          {node.moreChildren ? (
            <div className="inspect-more" style={{ paddingLeft: depth * 14 }}>
              +{node.moreChildren} more
            </div>
          ) : null}
          {node.truncated ? (
            <div className="inspect-more" style={{ paddingLeft: depth * 14 }}>
              …truncated
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function StylesTab({
  rules,
  skipped,
  filter
}: {
  rules: InspectMatchedRule[]
  skipped: number
  filter: string
}): JSX.Element {
  const f = filter.toLowerCase().trim()
  const filtered = f
    ? rules.filter(
        (r) => r.selector.toLowerCase().includes(f) || r.decls.some(([prop]) => prop.toLowerCase().includes(f))
      )
    : rules

  if (rules.length === 0) return <div className="inspect-empty">No matched CSS rules</div>

  return (
    <div>
      {filtered.map((rule, i) => (
        <div key={i} className="inspect-rule">
          <div className="inspect-rule-head">
            <span className="inspect-rule-selector">{rule.selector}</span>
            <span className="inspect-rule-source">{rule.source}</span>
          </div>
          {rule.decls.map(([prop, value]) => (
            <Row key={prop} label={prop} value={value} />
          ))}
        </div>
      ))}
      {skipped > 0 && <div className="inspect-note">{skipped} stylesheet(s) skipped (cross-origin)</div>}
    </div>
  )
}

function ComputedTab({ entries, filter }: { entries: [string, string][]; filter: string }): JSX.Element {
  const f = filter.toLowerCase().trim()
  const filtered = f ? entries.filter(([name]) => name.toLowerCase().includes(f)) : entries
  return (
    <div>
      {filtered.map(([name, value]) => (
        <Row key={name} label={name} value={value} />
      ))}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="inspect-row">
      <span className="inspect-row-label">{label}</span>
      <span className="inspect-row-value">{value}</span>
    </div>
  )
}
