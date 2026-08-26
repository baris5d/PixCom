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
  captureUrl: (args: { url: string; viewportWidth: number; fullPage: boolean }): Promise<SourceResult> =>
    ipcRenderer.invoke('capture-url', args),

  pickImage: (): Promise<SourceResult | null> => ipcRenderer.invoke('pick-image'),

  diffImages: (args: { leftDataUrl: string; rightDataUrl: string }): Promise<DiffResult> =>
    ipcRenderer.invoke('diff-images', args)
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
