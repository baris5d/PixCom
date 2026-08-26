import type { NativeImage } from 'electron'
import type { DetailedHTMLProps, HTMLAttributes } from 'react'

export interface ElectronWebViewElement extends HTMLElement {
  src: string
  reload(): void
  goBack(): void
  goForward(): void
  canGoBack(): boolean
  canGoForward(): boolean
  getURL(): string
  loadURL(url: string): Promise<void>
  stop(): void
  capturePage(rect?: { x: number; y: number; width: number; height: number }): Promise<NativeImage>
}

type WebViewAttributes = DetailedHTMLProps<HTMLAttributes<ElectronWebViewElement>, ElectronWebViewElement> & {
  src?: string
  partition?: string
  useragent?: string
  allowpopups?: string
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: WebViewAttributes
    }
  }
}
