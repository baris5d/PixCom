import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'
import { registerUpdater, setUpdaterWindow, checkForUpdatesNow } from './updater'
import { loadSettings, saveSettings, type AppSettings } from './settings'
import { deleteCustomTheme, listCustomThemes, openThemesFolder, saveCustomTheme } from './themes'

// Electron's default UA includes an "Electron/x.y.z" token that some
// bot-protection services (Akamai, Cloudflare, etc.) block outright.
// Spoofing a plain desktop Chrome UA lets embedded <webview> panels load
// sites that would otherwise time out or get challenged.
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    // No native title bar at all — the renderer draws its own top bar
    // (see TopBar.tsx) so it can match the app's own glass styling instead
    // of looking like a bolted-on OS chrome strip.
    frame: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      webviewTag: true
    }
  })

  const notifyMaximizedChanged = (): void => {
    mainWindow.webContents.send('window:maximized-changed', mainWindow.isMaximized())
  }
  mainWindow.on('maximize', notifyMaximizedChanged)
  mainWindow.on('unmaximize', notifyMaximizedChanged)

  setUpdaterWindow(mainWindow)

  // Defense in depth: guests created by our own renderer via <webview> are
  // trusted, but keep them isolated and force the spoofed UA regardless of
  // what the renderer passed. Point preload at our own controlled script
  // (ignoring whatever the renderer requested) instead of stripping it
  // entirely — it only exposes a narrow sendToHost bridge for the element
  // inspector, never Node/Electron APIs to the guest page itself.
  mainWindow.webContents.on('will-attach-webview', (_event, webPreferences, params) => {
    webPreferences.preload = join(__dirname, '../preload/guest.mjs')
    webPreferences.sandbox = false
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    params.useragent = BROWSER_USER_AGENT
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Registered once (not per-window) since ipcMain.handle only allows a single
// handler per channel — a second createWindow() call (e.g. re-activating on
// macOS after every window was closed) would otherwise throw. Each call
// targets whichever window the event's sender belongs to.
function registerWindowControlHandlers(): void {
  const windowOf = (event: { sender: Electron.WebContents }): BrowserWindow | null =>
    BrowserWindow.fromWebContents(event.sender)

  ipcMain.on('window:minimize', (event) => windowOf(event)?.minimize())
  ipcMain.on('window:toggle-maximize', (event) => {
    const win = windowOf(event)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on('window:close', (event) => windowOf(event)?.close())
  ipcMain.handle('window:is-maximized', (event) => windowOf(event)?.isMaximized() ?? false)
  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.on('shell:open-external', (_event, url: string) => {
    if (url.startsWith('https://')) shell.openExternal(url)
  })
}

function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', () => loadSettings())
  ipcMain.on('settings:set', (_event, settings: AppSettings) => {
    const wasOff = !loadSettings().autoUpdateCheck
    saveSettings(settings)
    // Flipping the setting on mid-session shouldn't require an app
    // restart before the first check happens.
    if (wasOff && settings.autoUpdateCheck) checkForUpdatesNow()
  })
}

function registerThemeHandlers(): void {
  ipcMain.handle('themes:list-custom', () => listCustomThemes())
  ipcMain.handle('themes:save-custom', (_event, name: string, colors: Record<string, string>) =>
    saveCustomTheme(name, colors)
  )
  ipcMain.on('themes:delete-custom', (_event, id: string) => deleteCustomTheme(id))
  ipcMain.on('themes:open-folder', () => openThemesFolder())
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.pixcom.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  registerWindowControlHandlers()
  registerSettingsHandlers()
  registerThemeHandlers()
  registerUpdater()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
