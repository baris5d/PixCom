import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import LiveWebviewLayer, { type LiveWebviewHandle, type NavState } from './LiveWebviewLayer'
import InspectPanel from './InspectPanel'
import { SIZE_PRESETS, normalizeUrl } from '../presets'
import { titleFor, type HistoryEntry, type SourceSnapshot, type TabSnapshot } from '../workspace'
import type { InspectSelection, LoadedSource, SourceKind } from '../types'

interface SideState {
  kind: SourceKind
  addressInput: string
  navigatedUrl: string | null
  navState: NavState
  loading: boolean
  loadError: string | null
  image: LoadedSource | null
}

function sideStateFrom(s: SourceSnapshot): SideState {
  return {
    kind: s.kind,
    addressInput: s.addressInput,
    navigatedUrl: s.navigatedUrl,
    navState: { canGoBack: false, canGoForward: false, url: null },
    loading: false,
    loadError: null,
    image: null
  }
}

type Side = 'left' | 'right'

interface Props {
  initial: TabSnapshot
  onChange: (patch: Partial<TabSnapshot>) => void
}

export default function OverlayCompare({ initial, onChange }: Props): JSX.Element {
  const [left, setLeft] = useState<SideState>(() => sideStateFrom(initial.left))
  const [right, setRight] = useState<SideState>(() => sideStateFrom(initial.right))
  const leftRef = useRef<LiveWebviewHandle>(null)
  const rightRef = useRef<LiveWebviewHandle>(null)

  const [activePreset, setActivePreset] = useState<string | null>(initial.activePreset)
  const [size, setSize] = useState(initial.size)
  const [fitToWindow, setFitToWindow] = useState(initial.fitToWindow)
  const [zoom, setZoom] = useState(1)
  const [percent, setPercent] = useState(50)
  const [syncScroll, setSyncScroll] = useState(initial.syncScroll)
  const [scrollSensitivity, setScrollSensitivity] = useState(initial.scrollSensitivity)
  const [swapped, setSwapped] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyOpenFor, setHistoryOpenFor] = useState<Side | null>(null)
  // Manual "canvas" zoom — a visual scale on top of whatever the stage's
  // own fit/preset sizing already is, like pinch-zooming a page in a
  // desktop browser. Independent of `zoom` above, which is the auto-fit
  // scale for device-size presets.
  const [zoomSync, setZoomSync] = useState(initial.zoomSync)
  const [canvasZoom, setCanvasZoom] = useState<Record<Side, number>>({ left: 1, right: 1 })
  const [canvasPan, setCanvasPan] = useState<Record<Side, { x: number; y: number }>>({
    left: { x: 0, y: 0 },
    right: { x: 0, y: 0 }
  })
  const [pageMode, setPageMode] = useState<'compare' | 'interact' | 'inspect'>('compare')
  const [inspected, setInspected] = useState<Record<Side, InspectSelection | null>>({ left: null, right: null })
  const [mode, setMode] = useState<'slider' | 'diff'>(initial.mode)
  const [diffing, setDiffing] = useState(false)
  const [matchPercent, setMatchPercent] = useState<number | null>(null)
  const [diffDataUrl, setDiffDataUrl] = useState<string | null>(null)
  const [diffError, setDiffError] = useState<string | null>(null)
  const [elementDiffing, setElementDiffing] = useState(false)
  const [elementDiff, setElementDiff] = useState<{ matchPercent: number; diffDataUrl: string } | null>(null)
  const [elementDiffError, setElementDiffError] = useState<string | null>(null)

  const stageRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragMode = useRef<'slider' | 'pan' | null>(null)
  const [activeDrag, setActiveDrag] = useState<'slider' | 'pan' | null>(null)
  const panLast = useRef<{ x: number; y: number } | null>(null)
  const panSides = useRef<Side[]>([])

  const setSide = (side: Side, patch: Partial<SideState>): void => {
    const setter = side === 'left' ? setLeft : setRight
    setter((prev) => ({ ...prev, ...patch }))
  }
  const stateOf = (side: Side): SideState => (side === 'left' ? left : right)
  const refOf = (side: Side): typeof leftRef => (side === 'left' ? leftRef : rightRef)

  // The stage always renders a "base" layer (fully visible, shows through
  // past the slider) and a "clipped" layer (revealed from the left edge up
  // to the slider position — i.e. the visually-left portion of the stage).
  // So the left data-side plays the clipped role and the right data-side
  // plays the base role by default; swapping flips which loaded side plays
  // which role, without touching the address bars or re-navigating anything.
  const baseSide: Side = swapped ? 'left' : 'right'
  const clippedSide: Side = swapped ? 'right' : 'left'

  const handleLoadingChange = useCallback(
    (side: Side) => (loading: boolean) => setSide(side, { loading }),
    []
  )
  const handleNavStateChange = useCallback(
    (side: Side) => (navState: NavState) => setSide(side, { navState }),
    []
  )
  const handleError = useCallback(
    (side: Side) => (loadError: string | null) => setSide(side, { loadError }),
    []
  )
  const handleInspectSelect = useCallback(
    (side: Side) => (data: InspectSelection) => setInspected((prev) => ({ ...prev, [side]: data })),
    []
  )

  function navigate(side: Side, target: string): void {
    const url = normalizeUrl(target)
    setSide(side, { addressInput: url, navigatedUrl: url })
    ;(side === 'left' ? leftRef : rightRef).current?.navigate(url)
    window.api.history.add(url).then(setHistory)
  }

  async function handlePickImage(side: Side): Promise<void> {
    const result = await window.api.pickImage()
    if (result) setSide(side, { image: { kind: 'image', ...result } })
  }

  function applyPreset(preset: (typeof SIZE_PRESETS)[number]): void {
    setActivePreset(preset.label)
    setFitToWindow(false)
    setSize({ width: preset.width, height: preset.height })
  }

  // Fixed device sizes are pinned to real pixel dimensions, so a preset
  // larger than the current window would otherwise get clipped. Scale the
  // whole stage down to fit whenever the window (or the chosen preset) is
  // bigger than the available space, and keep it in sync as either changes.
  useEffect(() => {
    if (fitToWindow) {
      setZoom(1)
      return
    }
    const container = containerRef.current
    if (!container) return
    const recompute = (): void => {
      const rect = container.getBoundingClientRect()
      const fit = Math.min(1, (rect.width - 8) / size.width, (rect.height - 8) / size.height)
      setZoom(Number.isFinite(fit) && fit > 0 ? fit : 1)
    }
    recompute()
    const observer = new ResizeObserver(recompute)
    observer.observe(container)
    return () => observer.disconnect()
  }, [fitToWindow, size.width, size.height])

  // Restore whichever page(s) this tab had loaded last session — runs once
  // on mount, using the `initial` prop's value as it was when the tab was
  // created, not the live state (which by then only reflects the address
  // bar text, not an actual navigated webview).
  useEffect(() => {
    if (initial.left.kind === 'url' && initial.left.navigatedUrl) {
      leftRef.current?.navigate(initial.left.navigatedUrl)
    }
    if (initial.right.kind === 'url' && initial.right.navigatedUrl) {
      rightRef.current?.navigate(initial.right.navigatedUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    window.api.history.list().then(setHistory)
  }, [])

  // Reports a snapshot back up to whatever owns this tab (App.tsx), which
  // persists it to disk — debounced so rapid typing/dragging doesn't
  // trigger a disk write per keystroke. onChange is read through a ref so
  // a new function identity from the parent each render doesn't restart
  // the debounce timer.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const timer = setTimeout(() => {
      onChangeRef.current({
        title: titleFor(left, right),
        left: { kind: left.kind, addressInput: left.addressInput, navigatedUrl: left.navigatedUrl },
        right: { kind: right.kind, addressInput: right.addressInput, navigatedUrl: right.navigatedUrl },
        fitToWindow,
        size,
        activePreset,
        syncScroll,
        scrollSensitivity,
        zoomSync,
        mode
      })
    }, 500)
    return () => clearTimeout(timer)
  }, [
    left.kind,
    left.addressInput,
    left.navigatedUrl,
    right.kind,
    right.addressInput,
    right.navigatedUrl,
    fitToWindow,
    size,
    activePreset,
    syncScroll,
    scrollSensitivity,
    zoomSync,
    mode
  ])

  // Re-applied whenever a side (re)navigates too, since a fresh page load
  // wipes whatever the previously-injected inspector script had set up.
  useEffect(() => {
    const on = pageMode === 'inspect'
    leftRef.current?.setInspectMode(on)
    rightRef.current?.setInspectMode(on)
    if (!on) {
      setInspected({ left: null, right: null })
      setElementDiff(null)
      setElementDiffError(null)
    }
  }, [pageMode, left.navigatedUrl, right.navigatedUrl])

  const SLIDER_GRAB_PERCENT = 4 // how close to the line counts as "grabbing" it

  function updatePercentFromClientX(clientX: number): void {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    const raw = ((clientX - rect.left) / rect.width) * 100
    setPercent(Math.min(100, Math.max(0, raw)))
  }

  // Whichever side(s) a pointer event at this x position should act on,
  // given whether the relevant feature (scroll or zoom) is synced across
  // both sides. The clipped layer is visible in [0, percent]% of the
  // stage; the base layer shows through past that.
  function resolveSides(clientX: number, synced: boolean): Side[] {
    if (synced) return ['left', 'right']
    const rect = stageRef.current?.getBoundingClientRect()
    const pointerPercent = rect ? ((clientX - rect.left) / rect.width) * 100 : 0
    return [pointerPercent < percent ? clippedSide : baseSide]
  }

  function scrollTargetsAt(clientX: number): Array<RefObject<LiveWebviewHandle>> {
    return resolveSides(clientX, syncScroll).map(refOf)
  }

  const MIN_CANVAS_ZOOM = 1
  const MAX_CANVAS_ZOOM = 5

  // Content is scaled around its own center, so the furthest it can pan in
  // either axis before leaving a gap at the opposite edge is half of
  // however much bigger than the stage it now is.
  function clampPan(pan: { x: number; y: number }, z: number, rect: { width: number; height: number }): {
    x: number
    y: number
  } {
    const maxX = (rect.width * (z - 1)) / 2
    const maxY = (rect.height * (z - 1)) / 2
    return { x: Math.min(maxX, Math.max(-maxX, pan.x)), y: Math.min(maxY, Math.max(-maxY, pan.y)) }
  }

  function applyZoom(factor: number, sides: Side[]): void {
    const rect = stageRef.current?.getBoundingClientRect()
    setCanvasZoom((prev) => {
      const next = { ...prev }
      for (const side of sides) {
        next[side] = Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, prev[side] * factor))
      }
      return next
    })
    setCanvasPan((prev) => {
      const next = { ...prev }
      for (const side of sides) {
        const z = Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, canvasZoom[side] * factor))
        next[side] = z <= MIN_CANVAS_ZOOM || !rect ? { x: 0, y: 0 } : clampPan(prev[side], z, rect)
      }
      return next
    })
  }

  function resetZoom(): void {
    setCanvasZoom({ left: 1, right: 1 })
    setCanvasPan({ left: { x: 0, y: 0 }, right: { x: 0, y: 0 } })
  }

  // The slider sets an absolute level (unlike the multiplicative +/-
  // buttons and ctrl+scroll/pinch), so it needs its own setter rather than
  // reusing applyZoom's `factor` shape.
  function setZoomAbsolute(value: number, sides: Side[]): void {
    const rect = stageRef.current?.getBoundingClientRect()
    const z = Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, value))
    setCanvasZoom((prev) => {
      const next = { ...prev }
      for (const side of sides) next[side] = z
      return next
    })
    setCanvasPan((prev) => {
      const next = { ...prev }
      for (const side of sides) next[side] = z <= MIN_CANVAS_ZOOM || !rect ? { x: 0, y: 0 } : clampPan(prev[side], z, rect)
      return next
    })
  }

  const zoomIsDefault = canvasZoom.left === 1 && canvasZoom.right === 1

  function handlePointerDown(e: React.PointerEvent): void {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const rect = stageRef.current?.getBoundingClientRect()
    const pointerPercent = rect ? ((e.clientX - rect.left) / rect.width) * 100 : 0
    const grabbingSlider = mode === 'slider' && Math.abs(pointerPercent - percent) <= SLIDER_GRAB_PERCENT

    if (grabbingSlider) {
      dragMode.current = 'slider'
      setActiveDrag('slider')
      updatePercentFromClientX(e.clientX)
    } else {
      dragMode.current = 'pan'
      setActiveDrag('pan')
      panLast.current = { x: e.clientX, y: e.clientY }
      panSides.current = resolveSides(e.clientX, syncScroll)
    }
  }
  function handlePointerMove(e: React.PointerEvent): void {
    if (dragMode.current === 'slider') {
      updatePercentFromClientX(e.clientX)
    } else if (dragMode.current === 'pan' && panLast.current) {
      const dx = e.clientX - panLast.current.x
      const dy = e.clientY - panLast.current.y
      panLast.current = { x: e.clientX, y: e.clientY }
      const rect = stageRef.current?.getBoundingClientRect()
      for (const side of panSides.current) {
        if (canvasZoom[side] > 1) {
          // Zoomed in: this is a grab-to-pan of the zoomed canvas itself —
          // content follows the pointer directly.
          setCanvasPan((prev) => {
            const raw = { x: prev[side].x + dx, y: prev[side].y + dy }
            return { ...prev, [side]: rect ? clampPan(raw, canvasZoom[side], rect) : raw }
          })
        } else {
          // Not zoomed: existing behavior — scroll the loaded page itself.
          // scrollBy's semantics are the opposite of a transform-based pan,
          // so the sign flips here (content still follows the pointer).
          refOf(side).current?.scrollBy(-dx, -dy)
        }
      }
    }
  }
  function handlePointerUp(): void {
    dragMode.current = null
    setActiveDrag(null)
    panLast.current = null
    panSides.current = []
  }

  function handleWheel(e: React.WheelEvent): void {
    e.preventDefault()
    // A trackpad pinch reaches the page as a ctrl+wheel event in Chromium
    // (same as a real Ctrl+scroll) — treat either that or Cmd/Ctrl+scroll
    // as "canvas" zoom, like zooming a page in a desktop browser.
    if (e.ctrlKey || e.metaKey) {
      const factor = Math.exp(-e.deltaY * 0.01)
      applyZoom(factor, resolveSides(e.clientX, zoomSync))
      return
    }
    const targets = resolveSides(e.clientX, syncScroll)
    const rect = stageRef.current?.getBoundingClientRect()
    for (const side of targets) {
      if (canvasZoom[side] > 1) {
        setCanvasPan((prev) => {
          const raw = {
            x: prev[side].x - e.deltaX * scrollSensitivity,
            y: prev[side].y - e.deltaY * scrollSensitivity
          }
          return { ...prev, [side]: rect ? clampPan(raw, canvasZoom[side], rect) : raw }
        })
      } else {
        refOf(side).current?.scrollBy(e.deltaX * scrollSensitivity, e.deltaY * scrollSensitivity)
      }
    }
  }

  async function captureSide(side: Side): Promise<LoadedSource> {
    const state = side === 'left' ? left : right
    if (state.kind === 'image') {
      if (!state.image) throw new Error(`${side} side has no image loaded`)
      return state.image
    }
    const handle = (side === 'left' ? leftRef : rightRef).current
    if (!handle) throw new Error(`${side} side has no page loaded`)
    const { dataUrl, width, height } = await handle.capturePage()
    return { kind: 'url', dataUrl, width, height, label: state.navigatedUrl ?? '' }
  }

  async function runDiff(): Promise<void> {
    setDiffing(true)
    setDiffError(null)
    try {
      const [leftSource, rightSource] = await Promise.all([captureSide('left'), captureSide('right')])
      const result = await window.api.diffImages({
        leftDataUrl: leftSource.dataUrl,
        rightDataUrl: rightSource.dataUrl
      })
      setMatchPercent(result.matchPercent)
      setDiffDataUrl(result.diffDataUrl)
    } catch (err) {
      setDiffError(err instanceof Error ? err.message : 'Failed to compute diff')
    } finally {
      setDiffing(false)
    }
  }

  // Same pixel diff as the full-page one, but cropped to just the two
  // elements picked in Inspect mode — useful when only one component is
  // being checked instead of the whole page.
  async function runElementDiff(): Promise<void> {
    const { left: leftSel, right: rightSel } = inspected
    if (!leftSel || !rightSel) return
    setElementDiffing(true)
    setElementDiffError(null)
    try {
      const [leftShot, rightShot] = await Promise.all([
        leftRef.current!.capturePage({
          x: leftSel.position.x,
          y: leftSel.position.y,
          width: leftSel.size.width,
          height: leftSel.size.height
        }),
        rightRef.current!.capturePage({
          x: rightSel.position.x,
          y: rightSel.position.y,
          width: rightSel.size.width,
          height: rightSel.size.height
        })
      ])
      const result = await window.api.diffImages({
        leftDataUrl: leftShot.dataUrl,
        rightDataUrl: rightShot.dataUrl
      })
      setElementDiff({ matchPercent: result.matchPercent, diffDataUrl: result.diffDataUrl })
    } catch (err) {
      setElementDiffError(err instanceof Error ? err.message : 'Failed to compare elements')
    } finally {
      setElementDiffing(false)
    }
  }

  function renderSideBar(side: Side, state: SideState): JSX.Element {
    const ref = side === 'left' ? leftRef : rightRef
    return (
      <div className="overlay-sidebar">
        <div className="sidebar-header">
          <span className="sidebar-title">{side === 'left' ? 'Source A' : 'Source B'}</span>
          <div className="kind-toggle">
            <button
              className={state.kind === 'url' ? 'active' : ''}
              onClick={() => setSide(side, { kind: 'url' })}
            >
              Website
            </button>
            <button
              className={state.kind === 'image' ? 'active' : ''}
              onClick={() => setSide(side, { kind: 'image' })}
            >
              Image
            </button>
          </div>
        </div>

        {state.kind === 'url' ? (
          <div className="address-bar">
            <button
              className="nav-btn"
              disabled={!state.navState.canGoBack}
              onClick={() => ref.current?.goBack()}
              title="Back"
              aria-label="Back"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M10 3 L5 8 L10 13" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              className="nav-btn"
              disabled={!state.navState.canGoForward}
              onClick={() => ref.current?.goForward()}
              title="Forward"
              aria-label="Forward"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M6 3 L11 8 L6 13" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              className="nav-btn"
              disabled={!state.navigatedUrl}
              onClick={() => ref.current?.reload()}
              title="Reload"
              aria-label="Reload"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path
                  d="M13 8a5 5 0 1 1-1.6-3.68"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M13 2.8 V5.5 H10.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <input
              type="text"
              className="address-input"
              value={state.addressInput}
              placeholder="example.com or localhost:3000"
              onChange={(e) => setSide(side, { addressInput: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && state.addressInput.trim()) navigate(side, state.addressInput)
              }}
            />
            <button
              className="go-btn"
              disabled={!state.addressInput.trim()}
              onClick={() => navigate(side, state.addressInput)}
            >
              Go
            </button>
            <div className="history-dropdown">
              <button
                className="nav-btn"
                onClick={() => setHistoryOpenFor(historyOpenFor === side ? null : side)}
                title="History"
                aria-label="History"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6.3" />
                  <path d="M8 4.8 V8 L10.3 9.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {historyOpenFor === side && (
                <>
                  <div className="theme-dropdown-scrim" onClick={() => setHistoryOpenFor(null)} />
                  <div className="history-dropdown-list">
                    {history.length === 0 && <div className="history-empty">No history yet</div>}
                    {history.map((entry) => (
                      <button
                        key={entry.url}
                        className="history-dropdown-item"
                        onClick={() => {
                          navigate(side, entry.url)
                          setHistoryOpenFor(null)
                        }}
                        title={entry.url}
                      >
                        {entry.url}
                      </button>
                    ))}
                    {history.length > 0 && (
                      <button
                        className="history-dropdown-clear"
                        onClick={() => {
                          window.api.history.clear()
                          setHistory([])
                        }}
                      >
                        Clear history
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="image-form">
            <button onClick={() => handlePickImage(side)}>Choose image…</button>
            {state.image && (
              <span className="source-meta">
                {state.image.label} · {state.image.width}×{state.image.height}
              </span>
            )}
          </div>
        )}

        {state.loadError && <p className="error">Failed to load: {state.loadError}</p>}
      </div>
    )
  }

  function labelFor(side: Side): string {
    const state = stateOf(side)
    if (state.kind === 'image') return state.image?.label ?? 'No image loaded'
    return state.navigatedUrl ?? 'Not loaded'
  }

  const bothReady =
    (left.kind === 'url' ? !!left.navigatedUrl : !!left.image) &&
    (right.kind === 'url' ? !!right.navigatedUrl : !!right.image)

  // Each side is always rendered in the same stable slot (same component
  // identity/key), so a page's navigation session survives a swap. Only the
  // clip-path/z-index — which visual role it plays — changes with `swapped`.
  //
  // The slider's clip-path and the manual canvas zoom/pan live on two
  // separate nested elements on purpose: clip-path is computed in the
  // element's own untransformed box, so if it sat on the *same* element as
  // the zoom transform, zooming one side would drag the slider's reveal
  // boundary along with it instead of leaving it fixed at `percent`% of
  // the stage.
  function renderLayer(side: Side): JSX.Element {
    const state = stateOf(side)
    const isClippedRole = side === clippedSide
    const outerStyle: CSSProperties = {
      zIndex: isClippedRole ? 2 : 1,
      clipPath: mode === 'slider' && isClippedRole ? `inset(0 ${100 - percent}% 0 0)` : undefined
    }
    const z = canvasZoom[side]
    const pan = canvasPan[side]
    const innerStyle: CSSProperties = {
      transform: z !== 1 || pan.x !== 0 || pan.y !== 0 ? `translate(${pan.x}px, ${pan.y}px) scale(${z})` : undefined,
      transformOrigin: 'center'
    }
    const content =
      state.kind === 'image' && state.image ? (
        <img key={side} src={state.image.dataUrl} alt={side} className="webview-layer" style={innerStyle} draggable={false} />
      ) : (
        <LiveWebviewLayer
          key={side}
          ref={refOf(side)}
          style={innerStyle}
          onLoadingChange={handleLoadingChange(side)}
          onNavStateChange={handleNavStateChange(side)}
          onError={handleError(side)}
          onInspectSelect={handleInspectSelect(side)}
        />
      )
    return (
      <div className="layer-clip-wrapper" style={outerStyle}>
        {content}
      </div>
    )
  }

  return (
    <div className="overlay-compare">
      <div className="overlay-sidebars">
        {renderSideBar('left', left)}
        <button
          className="swap-sides-btn"
          onClick={() => setSwapped((s) => !s)}
          title="Swap left/right positions"
          aria-label="Swap left/right positions"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 5.5 H13 M10 2.5 L13 5.5 L10 8.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 10.5 H3 M6 7.5 L3 10.5 L6 13.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {renderSideBar('right', right)}
      </div>

      <div className="size-toolbar">
        <button className={fitToWindow ? 'active' : ''} onClick={() => setFitToWindow(true)}>
          Fit to window
        </button>
        <span className="toolbar-divider" />
        {SIZE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            className={!fitToWindow && activePreset === preset.label ? 'active' : ''}
            onClick={() => applyPreset(preset)}
          >
            {preset.label}
          </button>
        ))}
        {!fitToWindow && (
          <span className="size-readout">
            {size.width}×{size.height}
            {zoom < 0.999 && ` · zoomed to ${Math.round(zoom * 100)}%`}
          </span>
        )}
      </div>

      <div className="size-toolbar controls-row">
        <div className="toolbar-start">
          <div className="toolbar-group">
            <span className="toolbar-label">Scroll</span>
            <div className="mode-toggle">
              <button className={syncScroll ? 'active' : ''} onClick={() => setSyncScroll(true)}>
                Together
              </button>
              <button className={!syncScroll ? 'active' : ''} onClick={() => setSyncScroll(false)}>
                Independently
              </button>
            </div>
            <input
              type="range"
              className="sensitivity-slider"
              min={0.1}
              max={2}
              step={0.1}
              value={scrollSensitivity}
              onChange={(e) => setScrollSensitivity(Number(e.target.value))}
              title="Scroll sensitivity"
            />
            <span className="size-readout">{scrollSensitivity.toFixed(1)}x</span>
          </div>

          <span className="toolbar-divider" />

          <div className="toolbar-group">
            <span className="toolbar-label">Zoom</span>
            <div className="mode-toggle">
              <button className={zoomSync ? 'active' : ''} onClick={() => setZoomSync(true)}>
                Together
              </button>
              <button className={!zoomSync ? 'active' : ''} onClick={() => setZoomSync(false)}>
                Independently
              </button>
            </div>
            {zoomSync ? (
              <>
                <button
                  className="nav-btn"
                  onClick={() => applyZoom(1 / 1.25, ['left', 'right'])}
                  disabled={zoomIsDefault}
                  title="Zoom out"
                  aria-label="Zoom out"
                >
                  −
                </button>
                <input
                  type="range"
                  className="sensitivity-slider"
                  min={MIN_CANVAS_ZOOM * 100}
                  max={MAX_CANVAS_ZOOM * 100}
                  step={5}
                  value={canvasZoom.left * 100}
                  onChange={(e) => setZoomAbsolute(Number(e.target.value) / 100, ['left', 'right'])}
                  title="Zoom level"
                />
                <span className="size-readout">{Math.round(canvasZoom.left * 100)}%</span>
                <button
                  className="nav-btn"
                  onClick={() => applyZoom(1.25, ['left', 'right'])}
                  disabled={canvasZoom.left >= MAX_CANVAS_ZOOM}
                  title="Zoom in"
                  aria-label="Zoom in"
                >
                  +
                </button>
              </>
            ) : (
              <>
                <span className="size-readout">A</span>
                <input
                  type="range"
                  className="sensitivity-slider"
                  min={MIN_CANVAS_ZOOM * 100}
                  max={MAX_CANVAS_ZOOM * 100}
                  step={5}
                  value={canvasZoom.left * 100}
                  onChange={(e) => setZoomAbsolute(Number(e.target.value) / 100, ['left'])}
                  title="Zoom level — Source A"
                />
                <span className="size-readout">{Math.round(canvasZoom.left * 100)}%</span>
                <span className="size-readout">B</span>
                <input
                  type="range"
                  className="sensitivity-slider"
                  min={MIN_CANVAS_ZOOM * 100}
                  max={MAX_CANVAS_ZOOM * 100}
                  step={5}
                  value={canvasZoom.right * 100}
                  onChange={(e) => setZoomAbsolute(Number(e.target.value) / 100, ['right'])}
                  title="Zoom level — Source B"
                />
                <span className="size-readout">{Math.round(canvasZoom.right * 100)}%</span>
              </>
            )}
            <button
              className="nav-btn"
              onClick={resetZoom}
              disabled={zoomIsDefault}
              title="Reset zoom"
              aria-label="Reset zoom"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M13 8a5 5 0 1 1-1.6-3.68" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13 2.8 V5.5 H10.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <span className="toolbar-divider" />

          <div className="toolbar-group">
            <span className="toolbar-label">Mode</span>
            <div className="mode-toggle">
              <button className={pageMode === 'compare' ? 'active' : ''} onClick={() => setPageMode('compare')}>
                Compare
              </button>
              <button className={pageMode === 'interact' ? 'active' : ''} onClick={() => setPageMode('interact')}>
                Interact (click/hover)
              </button>
              <button
                className={pageMode === 'inspect' ? 'active' : ''}
                onClick={() => setPageMode('inspect')}
                title="Click an element on either page to see its structure and CSS"
              >
                Inspect elements
              </button>
            </div>
            {pageMode === 'inspect' && (
              <button
                className="compare-elements-btn"
                disabled={!inspected.left || !inspected.right || elementDiffing}
                onClick={runElementDiff}
                title="Pick one element on each side, then compare just those two regions"
              >
                {elementDiffing ? 'Comparing…' : 'Compare selected elements'}
              </button>
            )}
          </div>

          <span className="toolbar-divider" />

          <div className="toolbar-group">
            <span className="toolbar-label">View</span>
            <div className="mode-toggle">
              <button className={mode === 'slider' ? 'active' : ''} onClick={() => setMode('slider')}>
                Slider
              </button>
              <button className={mode === 'diff' ? 'active' : ''} disabled title="Temporarily disabled">
                Diff overlay
              </button>
            </div>
          </div>
        </div>

        <div className="toolbar-end">
          <button className="run-diff" disabled={!bothReady || diffing} onClick={runDiff}>
            {diffing ? 'Comparing…' : 'Calculate match %'}
          </button>
          {matchPercent !== null && <span className="match-badge">{matchPercent.toFixed(2)}% match</span>}
        </div>
      </div>

      {diffError && <p className="error">{diffError}</p>}

      <div className="overlay-stage-wrapper" ref={containerRef}>
        <div
          className={`overlay-stage${fitToWindow ? ' fit' : ''}`}
          ref={stageRef}
          style={
            fitToWindow
              ? undefined
              : { width: size.width, height: size.height, transform: `scale(${zoom})`, transformOrigin: 'center' }
          }
        >
          {renderLayer('left')}
          {renderLayer('right')}

          {mode === 'diff' && diffDataUrl && (
            <img src={diffDataUrl} alt="Difference" className="webview-layer diff-layer" />
          )}

          {!bothReady && (
            <div className="overlay-placeholder">
              <span className="overlay-placeholder-chip">Load a website or image on both sides to start comparing</span>
            </div>
          )}

          {bothReady && (
            <>
              <div className="corner-label corner-label-left" title={labelFor(clippedSide)}>
                {labelFor(clippedSide)}
              </div>
              <div className="corner-label corner-label-right" title={labelFor(baseSide)}>
                {labelFor(baseSide)}
              </div>
            </>
          )}

          <div
            className="interaction-layer"
            style={{
              pointerEvents: pageMode !== 'compare' ? 'none' : 'auto',
              cursor: activeDrag === 'slider' ? 'ew-resize' : activeDrag === 'pan' ? 'grabbing' : 'grab'
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
          >
            {mode === 'slider' && (
              <div className="slider-line" style={{ left: `${percent}%` }}>
                <div className="slider-handle" />
              </div>
            )}
          </div>
        </div>
      </div>

      {pageMode === 'inspect' && inspected.left && (
        <InspectPanel
          key="left"
          selection={inspected.left}
          side="left"
          defaultCorner="left"
          onClose={() => setInspected((prev) => ({ ...prev, left: null }))}
        />
      )}
      {pageMode === 'inspect' && inspected.right && (
        <InspectPanel
          key="right"
          selection={inspected.right}
          side="right"
          defaultCorner="right"
          onClose={() => setInspected((prev) => ({ ...prev, right: null }))}
        />
      )}

      {pageMode === 'inspect' && (elementDiff || elementDiffError) && (
        <div className="element-diff-popup">
          <div className="element-diff-header">
            <span>{elementDiff ? `Element match: ${elementDiff.matchPercent.toFixed(2)}%` : 'Compare failed'}</span>
            <button
              className="inspect-panel-close"
              onClick={() => {
                setElementDiff(null)
                setElementDiffError(null)
              }}
              title="Close"
            >
              ×
            </button>
          </div>
          <div className="element-diff-body">
            {elementDiff ? (
              <img src={elementDiff.diffDataUrl} alt="Element diff" className="element-diff-image" />
            ) : (
              <p className="error">{elementDiffError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
