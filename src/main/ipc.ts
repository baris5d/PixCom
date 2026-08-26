import { dialog, ipcMain } from 'electron'
import { readFile } from 'fs/promises'
import { Jimp } from 'jimp'
import { captureUrl } from './capture'
import { diffImages } from './diff'

export interface SourceResult {
  dataUrl: string
  width: number
  height: number
  label: string
}

function extToMime(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    default:
      return 'image/png'
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle(
    'capture-url',
    async (_event, args: { url: string; viewportWidth: number; fullPage: boolean }) => {
      const result = await captureUrl(args)
      return { ...result, label: args.url } satisfies SourceResult
    }
  )

  ipcMain.handle('pick-image', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }]
    })
    if (canceled || filePaths.length === 0) return null

    const filePath = filePaths[0]
    const buffer = await readFile(filePath)
    const image = await Jimp.read(buffer)
    const mime = extToMime(filePath)
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`

    return {
      dataUrl,
      width: image.bitmap.width,
      height: image.bitmap.height,
      label: filePath.split('/').pop() ?? filePath
    } satisfies SourceResult
  })

  ipcMain.handle(
    'diff-images',
    async (_event, args: { leftDataUrl: string; rightDataUrl: string }) => {
      return diffImages(args.leftDataUrl, args.rightDataUrl)
    }
  )
}
