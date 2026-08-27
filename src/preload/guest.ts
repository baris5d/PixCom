import { contextBridge, ipcRenderer } from 'electron'

// Attached to every <webview> guest (see will-attach-webview in main).
// Exposes just enough for the inspector script injected via
// executeJavaScript (which runs in the guest's *main* world) to report
// element data back to the host without ever touching Node/Electron APIs
// itself.
contextBridge.exposeInMainWorld('__pcHost', {
  send: (channel: string, payload: unknown): void => ipcRenderer.sendToHost(channel, payload)
})
