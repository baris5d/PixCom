import { useState } from 'react'
import SourcePicker from './components/SourcePicker'
import CompareSlider from './components/CompareSlider'
import type { LoadedSource } from './types'

export default function App(): JSX.Element {
  const [left, setLeft] = useState<LoadedSource | null>(null)
  const [right, setRight] = useState<LoadedSource | null>(null)
  const [mode, setMode] = useState<'slider' | 'diff'>('slider')
  const [diffing, setDiffing] = useState(false)
  const [matchPercent, setMatchPercent] = useState<number | null>(null)
  const [diffDataUrl, setDiffDataUrl] = useState<string | null>(null)
  const [diffError, setDiffError] = useState<string | null>(null)

  const canCompare = left !== null && right !== null

  async function runDiff(): Promise<void> {
    if (!left || !right) return
    setDiffing(true)
    setDiffError(null)
    try {
      const result = await window.api.diffImages({
        leftDataUrl: left.dataUrl,
        rightDataUrl: right.dataUrl
      })
      setMatchPercent(result.matchPercent)
      setDiffDataUrl(result.diffDataUrl)
    } catch (err) {
      setDiffError(err instanceof Error ? err.message : 'Failed to compute diff')
    } finally {
      setDiffing(false)
    }
  }

  function handleLoaded(side: 'left' | 'right', source: LoadedSource): void {
    setMatchPercent(null)
    setDiffDataUrl(null)
    if (side === 'left') setLeft(source)
    else setRight(source)
  }

  return (
    <div className="app">
      <header>
        <h1>Pixel Compare</h1>
        <p className="subtitle">Overlay a website, image, or design side-by-side and drag to check the match.</p>
      </header>

      <div className="pickers">
        <SourcePicker title="Left / Design" source={left} onLoaded={(s) => handleLoaded('left', s)} />
        <SourcePicker title="Right / Implementation" source={right} onLoaded={(s) => handleLoaded('right', s)} />
      </div>

      {canCompare && (
        <section className="compare-section">
          <div className="toolbar">
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
            <button className="run-diff" disabled={diffing} onClick={runDiff}>
              {diffing ? 'Comparing…' : 'Calculate match %'}
            </button>
            {matchPercent !== null && (
              <span className="match-badge">{matchPercent.toFixed(2)}% match</span>
            )}
          </div>

          {diffError && <p className="error">{diffError}</p>}

          <CompareSlider left={left!} right={right!} diffDataUrl={diffDataUrl} mode={mode} />
        </section>
      )}
    </div>
  )
}
