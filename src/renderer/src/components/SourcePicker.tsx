import { useState } from 'react'
import type { LoadedSource, SourceKind } from '../types'
import BrowserPanel from './BrowserPanel'

interface Props {
  title: string
  source: LoadedSource | null
  onLoaded: (source: LoadedSource) => void
}

export default function SourcePicker({ title, source, onLoaded }: Props): JSX.Element {
  const [kind, setKind] = useState<SourceKind>('url')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        <BrowserPanel onCaptured={onLoaded} />
      ) : (
        <div className="image-form">
          <button disabled={loading} onClick={handlePickImage}>
            {loading ? 'Loading…' : 'Choose image…'}
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      )}

      {source && (
        <p className="source-meta">
          {source.label} · {source.width}×{source.height}
        </p>
      )}
    </div>
  )
}
