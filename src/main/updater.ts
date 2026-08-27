import { app, ipcMain, type BrowserWindow } from 'electron'
// electron-updater is CommonJS; under Node's ESM loader (this project is
// "type": "module") the named export doesn't reliably resolve at runtime
// in a packaged build even though it type-checks and builds fine locally
// — import the default and destructure instead.
import electronUpdater from 'electron-updater'
import { loadSettings } from './settings'
const { autoUpdater } = electronUpdater

// electron-builder already publishes latest.yml/latest-mac.yml alongside
// every GitHub release (see package.json's `publish` config), which is all
// electron-updater needs to check for and fetch updates — no extra server.
let activeWindow: BrowserWindow | null = null

export function setUpdaterWindow(window: BrowserWindow): void {
  activeWindow = window
}

// One-click update: the renderer shows a button once `update-available`
// fires; clicking it downloads the update, and the moment it's fully
// downloaded the app quits and installs it automatically — no second
// "restart now?" step for the user.
export function registerUpdater(): void {
  autoUpdater.autoDownload = false

  autoUpdater.on('update-available', (info) => {
    activeWindow?.webContents.send('updater:available', info.version)
  })
  autoUpdater.on('download-progress', (progress) => {
    activeWindow?.webContents.send('updater:progress', Math.round(progress.percent))
  })
  autoUpdater.on('update-downloaded', () => {
    autoUpdater.quitAndInstall()
  })
  autoUpdater.on('error', (err) => {
    activeWindow?.webContents.send('updater:error', err.message)
  })

  ipcMain.on('updater:install', () => {
    autoUpdater.downloadUpdate().catch((err) => {
      activeWindow?.webContents.send('updater:error', err instanceof Error ? err.message : String(err))
    })
  })

  // Only meaningful for a packaged build — dev runs have no app-update.yml
  // and aren't versioned against a real release anyway. Also respects the
  // "Automatically check for updates" setting (on by default).
  if (app.isPackaged && loadSettings().autoUpdateCheck) {
    autoUpdater.checkForUpdates().catch(() => {
      /* offline, rate-limited, or no releases yet — nothing to surface */
    })
  }
}

// Lets the renderer trigger an update check on demand, independent of the
// startup check — used when the user flips the setting on mid-session.
export function checkForUpdatesNow(): void {
  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch(() => {})
  }
}
