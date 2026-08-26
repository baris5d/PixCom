import { useCallback, useRef, useState, type CSSProperties, type RefObject } from 'react'
import LiveWebviewLayer, { type LiveWebviewHandle, type NavState } from './LiveWebviewLayer'
import { SIZE_PRESETS, normalizeUrl } from '../presets'
import type { LoadedSource, SourceKind } from '../types'

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

  const [activePreset, setActivePreset] = useState<string>(SIZE_PRESETS[4].label)
  const [size, setSize] = useState({ width: SIZE_PRESETS[4].width, height: SIZE_PRESETS[4].height })
  const [percent, setPercent] = useState(50)
  const [syncScroll, setSyncScroll] = useState(true)
  const [scrollSensitivity, setScrollSensitivity] = useState(0.5)
  const [swapped, setSwapped] = useState(false)
  const [interactMode, setInteractMode] = useState(false)
  const [mode, setMode] = useState<'slider' | 'diff'>('slider')
  const [diffing, setDiffing] = useState(false)
  const [matchPercent, setMatchPercent] = useState<number | null>(null)
  const [diffDataUrl, setDiffDataUrl] = useState<string | null>(null)
  const [diffError, setDiffError] = useState<string | null>(null)

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
  // to the slider position). Swapping flips which loaded side plays which
  // role, without touching the address bars or re-navigating anything.
  const baseSide: Side = swapped ? 'right' : 'left'
  const clippedSide: Side = swapped ? 'left' : 'right'

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
    setSize({ width: preset.width, height: preset.height })
  }

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

  function renderSideBar(side: Side, state: SideState): JSX.Element {
    const ref = side === 'left' ? leftRef : rightRef
    return (
      <div className="overlay-sidebar">
        <span className="sidebar-title">{side === 'left' ? 'Left' : 'Right'}</span>
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

        {state.kind === 'url' ? (
          <div className="address-bar">
            <button className="nav-btn" disabled={!state.navState.canGoBack} onClick={() => ref.current?.goBack()}>
              ←
            </button>
            <button
              className="nav-btn"
              disabled={!state.navState.canGoForward}
              onClick={() => ref.current?.goForward()}
            >
              →
            </button>
            <button className="nav-btn" disabled={!state.navigatedUrl} onClick={() => ref.current?.reload()}>
              ⟳
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
      />
    )
  }

  return (
    <div className="overlay-compare">
      <div className="overlay-sidebars">
        {renderSideBar('left', left)}
        {renderSideBar('right', right)}
      </div>

      <div className="size-toolbar">
        {SIZE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            className={activePreset === preset.label ? 'active' : ''}
            onClick={() => applyPreset(preset)}
          >
            {preset.label}
          </button>
        ))}
        <span className="size-readout">
          {size.width}×{size.height}
        </span>
      </div>

      <div className="size-toolbar">
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

        <div className="toolbar-group">
          <span className="toolbar-label">Pages</span>
          <div className="mode-toggle">
            <button className={!interactMode ? 'active' : ''} onClick={() => setInteractMode(false)}>
              Compare
            </button>
            <button className={interactMode ? 'active' : ''} onClick={() => setInteractMode(true)}>
              Interact (click/hover)
            </button>
          </div>
        </div>

        <div className="toolbar-group">
          <span className="toolbar-label">View</span>
          <div className="mode-toggle">
            <button className={mode === 'slider' ? 'active' : ''} onClick={() => setMode('slider')}>
              Slider
            </button>
            <button
              className={mode === 'diff' ? 'active' : ''}
              onClick={() => setMode('diff')}
              disabled={!diffDataUrl}
            >
              Diff overlay
            </button>
          </div>
        </div>

        <button className="swap-btn" onClick={() => setSwapped((s) => !s)} title="Swap left/right positions">
          ⇄ Swap
        </button>

        <button className="run-diff" disabled={!bothReady || diffing} onClick={runDiff}>
          {diffing ? 'Comparing…' : 'Calculate match %'}
        </button>
        {matchPercent !== null && <span className="match-badge">{matchPercent.toFixed(2)}% match</span>}
      </div>

      {diffError && <p className="error">{diffError}</p>}

      <div className="overlay-stage-wrapper" ref={containerRef}>
        <div className="overlay-stage" ref={stageRef} style={{ width: size.width, height: size.height }}>
          {renderLayer('left')}
          {renderLayer('right')}

          {mode === 'diff' && diffDataUrl && (
            <img src={diffDataUrl} alt="Difference" className="webview-layer diff-layer" />
          )}

          {!bothReady && (
            <div className="overlay-placeholder">Load a website or image on both sides to start comparing</div>
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
              pointerEvents: interactMode ? 'none' : 'auto',
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
    </div>
  )
}
