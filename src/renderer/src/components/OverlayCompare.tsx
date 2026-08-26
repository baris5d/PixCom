import { useCallback, useRef, useState } from 'react'
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
  const [swapped, setSwapped] = useState(false)
  const [interactMode, setInteractMode] = useState(false)
  const [mode, setMode] = useState<'slider' | 'diff'>('slider')
  const [diffing, setDiffing] = useState(false)
  const [matchPercent, setMatchPercent] = useState<number | null>(null)
  const [diffDataUrl, setDiffDataUrl] = useState<string | null>(null)
  const [diffError, setDiffError] = useState<string | null>(null)

  const stageRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

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

  function updatePercentFromClientX(clientX: number): void {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    const raw = ((clientX - rect.left) / rect.width) * 100
    setPercent(Math.min(100, Math.max(0, raw)))
  }

  function handlePointerDown(e: React.PointerEvent): void {
    dragging.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    updatePercentFromClientX(e.clientX)
  }
  function handlePointerMove(e: React.PointerEvent): void {
    if (dragging.current) updatePercentFromClientX(e.clientX)
  }
  function handlePointerUp(): void {
    dragging.current = false
  }

  function handleWheel(e: React.WheelEvent): void {
    e.preventDefault()
    if (syncScroll) {
      leftRef.current?.scrollBy(e.deltaX, e.deltaY)
      rightRef.current?.scrollBy(e.deltaX, e.deltaY)
      return
    }
    // Independent mode: scroll whichever side is visually showing under the
    // cursor. The clipped layer covers [0, percent]% of the stage (clipped
    // from the left edge); the base layer shows through past that.
    const rect = stageRef.current?.getBoundingClientRect()
    const pointerPercent = rect ? ((e.clientX - rect.left) / rect.width) * 100 : 0
    const target = pointerPercent < percent ? refOf(clippedSide) : refOf(baseSide)
    target.current?.scrollBy(e.deltaX, e.deltaY)
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

  const bothReady =
    (left.kind === 'url' ? !!left.navigatedUrl : !!left.image) &&
    (right.kind === 'url' ? !!right.navigatedUrl : !!right.image)

  function renderLayer(side: Side): JSX.Element {
    const state = stateOf(side)
    const ref = refOf(side)
    if (state.kind === 'image' && state.image) {
      return <img src={state.image.dataUrl} alt={side} className="webview-layer" draggable={false} />
    }
    return (
      <LiveWebviewLayer
        ref={ref}
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
          {renderLayer(baseSide)}

          {mode === 'slider' ? (
            <div className="clip-wrapper" style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }}>
              {renderLayer(clippedSide)}
            </div>
          ) : (
            <>
              <div className="clip-wrapper" style={{ clipPath: 'inset(0 0 0 0)', visibility: 'hidden' }}>
                {renderLayer(clippedSide)}
              </div>
              {diffDataUrl && <img src={diffDataUrl} alt="Difference" className="webview-layer diff-layer" />}
            </>
          )}

          {!bothReady && (
            <div className="overlay-placeholder">Load a website or image on both sides to start comparing</div>
          )}

          <div
            className="interaction-layer"
            style={{ pointerEvents: interactMode ? 'none' : 'auto' }}
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
