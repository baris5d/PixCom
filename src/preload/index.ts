import { contextBridge, ipcRenderer } from 'electron'

export interface SourceResult {
  dataUrl: string
  width: number
  height: number
  label: string
}

export interface DiffResult {
  matchPercent: number
  diffPixels: number
  totalPixels: number
  diffDataUrl: string
  width: number
  height: number
}

export interface AppSettings {
  autoUpdateCheck: boolean
  themeId: string
}

export interface CustomThemeFile {
  id: string
  name: string
  colors: Record<string, string>
}

const api = {
  platform: process.platform,

  getVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version'),

  openExternal: (url: string): void => ipcRenderer.send('shell:open-external', url),

  pickImage: (): Promise<SourceResult | null> => ipcRenderer.invoke('pick-image'),

  diffImages: (args: { leftDataUrl: string; rightDataUrl: string }): Promise<DiffResult> =>
    ipcRenderer.invoke('diff-images', args),

  window: {
    minimize: (): void => ipcRenderer.send('window:minimize'),
    toggleMaximize: (): void => ipcRenderer.send('window:toggle-maximize'),
    close: (): void => ipcRenderer.send('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:is-maximized'),
    onMaximizedChanged: (callback: (maximized: boolean) => void): (() => void) => {
      const listener = (_event: unknown, maximized: boolean): void => callback(maximized)
      ipcRenderer.on('window:maximized-changed', listener)
      return () => ipcRenderer.removeListener('window:maximized-changed', listener)
    }
  },

  updater: {
    install: (): void => ipcRenderer.send('updater:install'),
    onAvailable: (callback: (version: string) => void): (() => void) => {
      const listener = (_event: unknown, version: string): void => callback(version)
      ipcRenderer.on('updater:available', listener)
      return () => ipcRenderer.removeListener('updater:available', listener)
    },
    onProgress: (callback: (percent: number) => void): (() => void) => {
      const listener = (_event: unknown, percent: number): void => callback(percent)
      ipcRenderer.on('updater:progress', listener)
      return () => ipcRenderer.removeListener('updater:progress', listener)
    },
    onError: (callback: (message: string) => void): (() => void) => {
      const listener = (_event: unknown, message: string): void => callback(message)
      ipcRenderer.on('updater:error', listener)
      return () => ipcRenderer.removeListener('updater:error', listener)
    }
  },

  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    set: (settings: AppSettings): void => ipcRenderer.send('settings:set', settings)
  },

  themes: {
    listCustom: (): Promise<CustomThemeFile[]> => ipcRenderer.invoke('themes:list-custom'),
    saveCustom: (name: string, colors: Record<string, string>): Promise<string> =>
      ipcRenderer.invoke('themes:save-custom', name, colors),
    deleteCustom: (id: string): void => ipcRenderer.send('themes:delete-custom', id),
    openFolder: (): void => ipcRenderer.send('themes:open-folder')
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
