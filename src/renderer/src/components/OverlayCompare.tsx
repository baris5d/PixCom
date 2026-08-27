import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import LiveWebviewLayer, { type LiveWebviewHandle, type NavState } from './LiveWebviewLayer'
import InspectPanel from './InspectPanel'
import { SIZE_PRESETS, normalizeUrl } from '../presets'
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

const initialSide: SideState = {
  kind: 'url',
  addressInput: '',
  navigatedUrl: null,
  navState: { canGoBack: false, canGoForward: false, url: null },
  loading: false,
  loadError: null,
  image: null
}

type Side = 'left' | 'right'

export default function OverlayCompare(): JSX.Element {
  const [left, setLeft] = useState<SideState>(initialSide)
  const [right, setRight] = useState<SideState>(initialSide)
  const leftRef = useRef<LiveWebviewHandle>(null)
  const rightRef = useRef<LiveWebviewHandle>(null)

  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [size, setSize] = useState({ width: SIZE_PRESETS[4].width, height: SIZE_PRESETS[4].height })
  const [fitToWindow, setFitToWindow] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [percent, setPercent] = useState(50)
  const [syncScroll, setSyncScroll] = useState(true)
  const [scrollSensitivity, setScrollSensitivity] = useState(0.5)
  const [swapped, setSwapped] = useState(false)
  const [pageMode, setPageMode] = useState<'compare' | 'interact' | 'inspect'>('compare')
  const [inspected, setInspected] = useState<Record<Side, InspectSelection | null>>({ left: null, right: null })
  const [mode, setMode] = useState<'slider' | 'diff'>('slider')
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
  const panTargets = useRef<Array<RefObject<LiveWebviewHandle>>>([])

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

  // Whichever side(s) should scroll for a pointer event at this x position,
  // given the current sync-scroll setting. The clipped layer is visible in
  // [0, percent]% of the stage; the base layer shows through past that.
  function scrollTargetsAt(clientX: number): Array<RefObject<LiveWebviewHandle>> {
    if (syncScroll) return [leftRef, rightRef]
    const rect = stageRef.current?.getBoundingClientRect()
    const pointerPercent = rect ? ((clientX - rect.left) / rect.width) * 100 : 0
    return [pointerPercent < percent ? refOf(clippedSide) : refOf(baseSide)]
  }

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
      panTargets.current = scrollTargetsAt(e.clientX)
    }
  }
  function handlePointerMove(e: React.PointerEvent): void {
    if (dragMode.current === 'slider') {
      updatePercentFromClientX(e.clientX)
    } else if (dragMode.current === 'pan' && panLast.current) {
      const dx = e.clientX - panLast.current.x
      const dy = e.clientY - panLast.current.y
      panLast.current = { x: e.clientX, y: e.clientY }
      // Grab-to-pan: content follows the pointer, so it scrolls opposite
      // the pointer's movement.
      for (const target of panTargets.current) target.current?.scrollBy(-dx, -dy)
    }
  }
  function handlePointerUp(): void {
    dragMode.current = null
    setActiveDrag(null)
    panLast.current = null
    panTargets.current = []
  }

  function handleWheel(e: React.WheelEvent): void {
    e.preventDefault()
    const targets = scrollTargetsAt(e.clientX)
    for (const target of targets) {
      target.current?.scrollBy(e.deltaX * scrollSensitivity, e.deltaY * scrollSensitivity)
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
  function renderLayer(side: Side): JSX.Element {
    const state = stateOf(side)
    const isClippedRole = side === clippedSide
    const style: CSSProperties = {
      zIndex: isClippedRole ? 2 : 1,
      clipPath: mode === 'slider' && isClippedRole ? `inset(0 ${100 - percent}% 0 0)` : undefined
    }
    if (state.kind === 'image' && state.image) {
      return <img key={side} src={state.image.dataUrl} alt={side} className="webview-layer" style={style} draggable={false} />
    }
    return (
      <LiveWebviewLayer
        key={side}
        ref={refOf(side)}
        style={style}
        onLoadingChange={handleLoadingChange(side)}
        onNavStateChange={handleNavStateChange(side)}
        onError={handleError(side)}
        onInspectSelect={handleInspectSelect(side)}
      />
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
