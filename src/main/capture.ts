import { BrowserWindow } from 'electron'

export interface CaptureOptions {
  url: string
  viewportWidth: number
  fullPage: boolean
}

export interface CaptureResult {
  dataUrl: string
  width: number
  height: number
}

const MAX_FULL_PAGE_HEIGHT = 20000

/**
 * Loads a URL in an offscreen window sized to the requested viewport and
 * returns a PNG screenshot. Full-page mode resizes the window to the
 * document's scroll height before capturing so the whole page is included.
 */
export async function captureUrl(options: CaptureOptions): Promise<CaptureResult> {
  const { url, viewportWidth, fullPage } = options

  const win = new BrowserWindow({
    show: false,
    width: viewportWidth,
    height: 900,
    webPreferences: {
      offscreen: false,
      sandbox: true
    }
  })

  try {
    await win.loadURL(url)

    // Let fonts/images settle and any layout-affecting JS run.
    await new Promise((resolve) => setTimeout(resolve, 400))

    if (fullPage) {
      const scrollHeight: number = await win.webContents.executeJavaScript(
        'Math.max(document.body ? document.body.scrollHeight : 0, document.documentElement.scrollHeight)'
      )
      const targetHeight = Math.min(Math.max(scrollHeight, 1), MAX_FULL_PAGE_HEIGHT)
      win.setContentSize(viewportWidth, targetHeight)
      // Resizing can trigger reflow (responsive images, sticky headers) — wait once more.
      await new Promise((resolve) => setTimeout(resolve, 250))
    }

    const image = await win.webContents.capturePage()
    const size = image.getSize()
    return {
      dataUrl: image.toDataURL(),
      width: size.width,
      height: size.height
    }
  } finally {
    win.destroy()
  }
}
