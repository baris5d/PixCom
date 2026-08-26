import OverlayCompare from './components/OverlayCompare'

export default function App(): JSX.Element {
  return (
    <div className="app">
      <header>
        <h1>Pixel Compare</h1>
        <p className="subtitle">Load a website or image on each side, then drag the slider to check the match.</p>
      </header>

      <OverlayCompare />
    </div>
  )
}
