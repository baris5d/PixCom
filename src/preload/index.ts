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

const api = {
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
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
