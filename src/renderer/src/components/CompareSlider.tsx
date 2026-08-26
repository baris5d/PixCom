import { useRef, useState } from 'react'
import type { LoadedSource } from '../types'

interface Props {
  left: LoadedSource
  right: LoadedSource
  diffDataUrl: string | null
  mode: 'slider' | 'diff'
}

export default function CompareSlider({ left, right, diffDataUrl, mode }: Props): JSX.Element {
  const [percent, setPercent] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const aspect = left.width / left.height

  function updateFromClientX(clientX: number): void {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const raw = ((clientX - rect.left) / rect.width) * 100
    setPercent(Math.min(100, Math.max(0, raw)))
  }

  function handlePointerDown(e: React.PointerEvent): void {
    dragging.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    updateFromClientX(e.clientX)
  }

  function handlePointerMove(e: React.PointerEvent): void {
    if (!dragging.current) return
    updateFromClientX(e.clientX)
  }

  function handlePointerUp(): void {
    dragging.current = false
  }

  if (mode === 'diff' && diffDataUrl) {
    return (
      <div className="compare-stage" ref={containerRef} style={{ aspectRatio: aspect }}>
        <img src={diffDataUrl} alt="Difference" className="layer" draggable={false} />
      </div>
    )
  }

  return (
    <div
      className="compare-stage slider-mode"
      ref={containerRef}
      style={{ aspectRatio: aspect }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <img src={left.dataUrl} alt="Left" className="layer" draggable={false} />
      <div className="layer clip" style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }}>
        <img src={right.dataUrl} alt="Right" className="layer" draggable={false} />
      </div>
      <div className="slider-line" style={{ left: `${percent}%` }}>
        <div className="slider-handle" />
      </div>
    </div>
  )
}
