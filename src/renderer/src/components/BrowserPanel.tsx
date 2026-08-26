import { useEffect, useRef, useState } from 'react'
import type { ElectronWebViewElement } from '../webview'
import type { LoadedSource } from '../types'
import { SIZE_PRESETS, normalizeUrl } from '../presets'

interface Props {
  onCaptured: (source: LoadedSource) => void
}

export default function BrowserPanel({ onCaptured }: Props): JSX.Element {
  const webviewRef = useRef<ElectronWebViewElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [addressInput, setAddressInput] = useState('')
  const [currentUrl, setCurrentUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const [activePreset, setActivePreset] = useState<string>(SIZE_PRESETS[4].label)
  const [size, setSize] = useState({ width: SIZE_PRESETS[4].width, height: SIZE_PRESETS[4].height })

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    const handleStart = (): void => {
      setLoading(true)
      setLoadError(null)
    }
    const handleStop = (): void => setLoading(false)
    const handleFail = (e: Event): void => {
      const event = e as unknown as { errorCode: number; errorDescription: string; isMainFrame: boolean }
      if (!event.isMainFrame || event.errorCode === -3) return // -3 = ERR_ABORTED, e.g. cancelled navigation
      setLoading(false)
      setLoadError(`${event.errorDescription} (${event.errorCode})`)
    }

    webview.addEventListener('did-start-loading', handleStart)
    webview.addEventListener('did-stop-loading', handleStop)
    webview.addEventListener('did-fail-load', handleFail)
    return () => {
      webview.removeEventListener('did-start-loading', handleStart)
      webview.removeEventListener('did-stop-loading', handleStop)
      webview.removeEventListener('did-fail-load', handleFail)
    }
  }, [currentUrl])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width: Math.round(width), height: Math.round(height) })
      setActivePreset('Custom')
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  function navigate(target: string): void {
    const url = normalizeUrl(target)
    setAddressInput(url)
    setCurrentUrl(url)
    setLoadError(null)
  }

  function applyPreset(preset: (typeof SIZE_PRESETS)[number]): void {
    setActivePreset(preset.label)
    setSize({ width: preset.width, height: preset.height })
  }

  async function handleCapture(): Promise<void> {
    const webview = webviewRef.current
    if (!webview || !currentUrl) return
    setCaptureError(null)
    try {
      const image = await webview.capturePage()
      const { width, height } = image.getSize()
      onCaptured({ kind: 'url', dataUrl: image.toDataURL(), width, height, label: currentUrl })
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : 'Failed to capture the page')
    }
  }

  return (
    <div className="browser-panel">
      <div className="address-bar">
        <button
          className="nav-btn"
          disabled={!webviewRef.current?.canGoBack()}
          onClick={() => webviewRef.current?.goBack()}
        >
          ←
        </button>
        <button
          className="nav-btn"
          disabled={!webviewRef.current?.canGoForward()}
          onClick={() => webviewRef.current?.goForward()}
        >
          →
        </button>
        <button className="nav-btn" disabled={!currentUrl} onClick={() => webviewRef.current?.reload()}>
          ⟳
        </button>
        <input
          type="text"
          className="address-input"
          value={addressInput}
          placeholder="example.com or localhost:3000"
          onChange={(e) => setAddressInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && addressInput.trim()) navigate(addressInput)
          }}
        />
        <button className="go-btn" disabled={!addressInput.trim()} onClick={() => navigate(addressInput)}>
          Go
        </button>
      </div>

      {loadError && <p className="error">Failed to load: {loadError}</p>}

      <div className="browser-stage-wrapper">
        <div className="browser-stage" ref={containerRef} style={{ width: size.width, height: size.height }}>
          {currentUrl ? (
            <webview
              ref={webviewRef}
              src={currentUrl}
              partition="persist:pixelcompare-browse"
              className="webview"
            />
          ) : (
            <div className="browser-placeholder">Enter a URL above to start browsing</div>
          )}
          {loading && <div className="loading-bar" />}
        </div>
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

      {captureError && <p className="error">{captureError}</p>}

      <button className="capture-btn" disabled={!currentUrl} onClick={handleCapture}>
        Capture for comparison
      </button>
    </div>
  )
}
