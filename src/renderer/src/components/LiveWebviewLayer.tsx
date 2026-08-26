import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from 'react'
import type { ElectronWebViewElement } from '../webview'

export interface LiveWebviewHandle {
  navigate(url: string): void
  reload(): void
  goBack(): void
  goForward(): void
  scrollBy(dx: number, dy: number): void
  capturePage(): Promise<{ dataUrl: string; width: number; height: number }>
}

export interface NavState {
  canGoBack: boolean
  canGoForward: boolean
  url: string | null
}

interface Props {
  style?: CSSProperties
  onLoadingChange?: (loading: boolean) => void
  onNavStateChange?: (state: NavState) => void
  onError?: (message: string | null) => void
}

const LiveWebviewLayer = forwardRef<LiveWebviewHandle, Props>(function LiveWebviewLayer(
  { style, onLoadingChange, onNavStateChange, onError },
  ref
) {
  const webviewRef = useRef<ElectronWebViewElement>(null)
  const mountedSrcRef = useRef<string | null>(null)
  const [mountTick, setMountTick] = useState(0)

  useImperativeHandle(ref, () => ({
    navigate(url: string) {
      onError?.(null)
      if (webviewRef.current) {
        try {
          webviewRef.current.loadURL(url)
        } catch {
          // guest not attached yet — ignore.
        }
      } else {
        mountedSrcRef.current = url
        setMountTick((n) => n + 1)
      }
    },
    reload() {
      try {
        webviewRef.current?.reload()
      } catch {
        /* not attached yet */
      }
    },
    goBack() {
      try {
        webviewRef.current?.goBack()
      } catch {
        /* not attached yet */
      }
    },
    goForward() {
      try {
        webviewRef.current?.goForward()
      } catch {
        /* not attached yet */
      }
    },
    scrollBy(dx: number, dy: number) {
      webviewRef.current?.executeJavaScript(`window.scrollBy(${dx}, ${dy})`).catch(() => {})
    },
    async capturePage() {
      const webview = webviewRef.current
      if (!webview) throw new Error('Page is not loaded yet')
      const image = await webview.capturePage()
      const { width, height } = image.getSize()
      return { dataUrl: image.toDataURL(), width, height }
    }
  }))

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    const updateNavState = (): void => {
      try {
        onNavStateChange?.({
          canGoBack: webview.canGoBack(),
          canGoForward: webview.canGoForward(),
          url: webview.getURL()
        })
      } catch {
        onNavStateChange?.({ canGoBack: false, canGoForward: false, url: null })
      }
    }
    const handleStart = (): void => {
      onLoadingChange?.(true)
      onError?.(null)
    }
    const handleStop = (): void => {
      onLoadingChange?.(false)
      updateNavState()
    }
    const handleFail = (e: Event): void => {
      const event = e as unknown as { errorCode: number; errorDescription: string; isMainFrame: boolean }
      if (!event.isMainFrame || event.errorCode === -3) return // -3 = ERR_ABORTED
      onLoadingChange?.(false)
      onError?.(`${event.errorDescription} (${event.errorCode})`)
    }

    webview.addEventListener('did-start-loading', handleStart)
    webview.addEventListener('did-stop-loading', handleStop)
    webview.addEventListener('did-fail-load', handleFail)
    webview.addEventListener('did-navigate', updateNavState)
    webview.addEventListener('did-navigate-in-page', updateNavState)
    return () => {
      webview.removeEventListener('did-start-loading', handleStart)
      webview.removeEventListener('did-stop-loading', handleStop)
      webview.removeEventListener('did-fail-load', handleFail)
      webview.removeEventListener('did-navigate', updateNavState)
      webview.removeEventListener('did-navigate-in-page', updateNavState)
    }
  }, [mountTick, onLoadingChange, onNavStateChange, onError])

  if (!mountedSrcRef.current) return null

  return (
    <webview
      ref={webviewRef}
      src={mountedSrcRef.current}
      partition="persist:pixelcompare-browse"
      className="webview-layer"
      style={style}
    />
  )
})

export default LiveWebviewLayer
