import { useState } from 'react'
import type { LoadedSource, SourceKind } from '../types'

interface Props {
  title: string
  source: LoadedSource | null
  onLoaded: (source: LoadedSource) => void
}

export default function SourcePicker({ title, source, onLoaded }: Props): JSX.Element {
  const [kind, setKind] = useState<SourceKind>('url')
  const [url, setUrl] = useState('https://')
  const [viewportWidth, setViewportWidth] = useState(1440)
  const [fullPage, setFullPage] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCaptureUrl(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.captureUrl({ url, viewportWidth, fullPage })
      onLoaded({ kind: 'url', ...result })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to capture URL')
    } finally {
      setLoading(false)
    }
  }

  async function handlePickImage(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.pickImage()
      if (result) onLoaded({ kind: 'image', ...result })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load image')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="source-picker">
      <h3>{title}</h3>

      <div className="kind-toggle">
        <button className={kind === 'url' ? 'active' : ''} onClick={() => setKind('url')}>
          Website
        </button>
        <button className={kind === 'image' ? 'active' : ''} onClick={() => setKind('image')}>
          Image
        </button>
      </div>

      {kind === 'url' ? (
        <div className="url-form">
          <input
            type="text"
            value={url}
            placeholder="https://example.com"
            onChange={(e) => setUrl(e.target.value)}
          />
          <div className="row">
            <label>
              Viewport width
              <input
                type="number"
                value={viewportWidth}
                min={320}
                max={3840}
                onChange={(e) => setViewportWidth(Number(e.target.value))}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={fullPage}
                onChange={(e) => setFullPage(e.target.checked)}
              />
              Full page
            </label>
          </div>
          <button disabled={loading} onClick={handleCaptureUrl}>
            {loading ? 'Capturing…' : 'Capture'}
          </button>
        </div>
      ) : (
        <div className="image-form">
          <button disabled={loading} onClick={handlePickImage}>
            {loading ? 'Loading…' : 'Choose image…'}
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {source && (
        <p className="source-meta">
          {source.label} · {source.width}×{source.height}
        </p>
      )}
    </div>
  )
}
