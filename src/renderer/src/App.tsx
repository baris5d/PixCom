import TopBar from './components/TopBar'
import OverlayCompare from './components/OverlayCompare'

export default function App(): JSX.Element {
  return (
    <>
      <TopBar />
      <div className="app">
        <OverlayCompare />
      </div>
    </>
  )
}
