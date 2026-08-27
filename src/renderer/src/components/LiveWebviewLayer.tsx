import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from 'react'
import type { ElectronWebViewElement } from '../webview'
import { INSPECT_ENABLE_SCRIPT, INSPECT_DISABLE_SCRIPT } from '../inspectScript'
import type { InspectSelection } from '../types'

export interface LiveWebviewHandle {
  navigate(url: string): void
  reload(): void
  goBack(): void
  goForward(): void
  scrollBy(dx: number, dy: number): void
  capturePage(rect?: {
    x: number
    y: number
    width: number
    height: number
  }): Promise<{ dataUrl: string; width: number; height: number }>
  setInspectMode(enabled: boolean): void
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
  onInspectSelect?: (selection: InspectSelection) => void
}

// `executeJavaScript` (like most other webview methods) throws
// *synchronously* — not as a rejected promise — when the guest hasn't
// reported `dom-ready` yet. Callers can't rely on `.catch()` alone.
function safeExecuteJavaScript(webview: ElectronWebViewElement | null, code: string): void {
  if (!webview) return
  try {
    webview.executeJavaScript(code)?.catch(() => {})
  } catch {
    /* guest not attached yet — the next did-stop-loading re-applies inspect mode if needed */
  }
}

const LiveWebviewLayer = forwardRef<LiveWebviewHandle, Props>(function LiveWebviewLayer(
  { style, onLoadingChange, onNavStateChange, onError, onInspectSelect },
  ref
) {
  const webviewRef = useRef<ElectronWebViewElement>(null)
  const mountedSrcRef = useRef<string | null>(null)
  const inspectRef = useRef(false)
  // A navigation requested before the guest has reported `dom-ready` (e.g. a
  // second URL entered right after the first, before its guest process has
  // finished attaching) can't call `loadURL` yet — Electron throws/rejects
  // with "The WebView must be attached to the DOM and the dom-ready event
  // emitted...". Stash it here and flush it once `dom-ready` fires instead
  // of silently dropping it.
  const pendingUrlRef = useRef<string | null>(null)
  const [mountTick, setMountTick] = useState(0)

  useImperativeHandle(ref, () => ({
    navigate(url: string) {
      onError?.(null)
      const webview = webviewRef.current
      if (!webview) {
        mountedSrcRef.current = url
        setMountTick((n) => n + 1)
        return
      }
      pendingUrlRef.current = null
      try {
        Promise.resolve(webview.loadURL(url)).catch(() => {
          pendingUrlRef.current = url
        })
      } catch {
        pendingUrlRef.current = url
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
      safeExecuteJavaScript(webviewRef.current, `window.scrollBy(${dx}, ${dy})`)
    },
    async capturePage(rect) {
      const webview = webviewRef.current
      if (!webview) throw new Error('Page is not loaded yet')
      const image = await webview.capturePage(rect)
      const { width, height } = image.getSize()
      return { dataUrl: image.toDataURL(), width, height }
    },
    setInspectMode(enabled: boolean) {
      inspectRef.current = enabled
      safeExecuteJavaScript(webviewRef.current, enabled ? INSPECT_ENABLE_SCRIPT : INSPECT_DISABLE_SCRIPT)
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
      if (inspectRef.current) safeExecuteJavaScript(webview, INSPECT_ENABLE_SCRIPT)
    }
    const handleFail = (e: Event): void => {
      const event = e as unknown as { errorCode: number; errorDescription: string; isMainFrame: boolean }
      if (!event.isMainFrame || event.errorCode === -3) return // -3 = ERR_ABORTED
      onLoadingChange?.(false)
      onError?.(`${event.errorDescription} (${event.errorCode})`)
    }
    const handleDomReady = (): void => {
      const pending = pendingUrlRef.current
      if (!pending) return
      pendingUrlRef.current = null
      webview.loadURL(pending).catch(() => {})
    }
    const handleIpcMessage = (e: Event): void => {
      const event = e as unknown as { channel: string; args: unknown[] }
      if (event.channel === 'pc-inspect-select') {
        onInspectSelect?.(event.args[0] as InspectSelection)
      }
    }

    webview.addEventListener('did-start-loading', handleStart)
    webview.addEventListener('did-stop-loading', handleStop)
    webview.addEventListener('did-fail-load', handleFail)
    webview.addEventListener('did-navigate', updateNavState)
    webview.addEventListener('did-navigate-in-page', updateNavState)
    webview.addEventListener('dom-ready', handleDomReady)
    webview.addEventListener('ipc-message', handleIpcMessage)
    return () => {
      webview.removeEventListener('did-start-loading', handleStart)
      webview.removeEventListener('did-stop-loading', handleStop)
      webview.removeEventListener('did-fail-load', handleFail)
      webview.removeEventListener('did-navigate', updateNavState)
      webview.removeEventListener('did-navigate-in-page', updateNavState)
      webview.removeEventListener('dom-ready', handleDomReady)
      webview.removeEventListener('ipc-message', handleIpcMessage)
    }
  }, [mountTick, onLoadingChange, onNavStateChange, onError, onInspectSelect])

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
