import { Jimp } from 'jimp'
import pixelmatch from 'pixelmatch'

export interface DiffResult {
  matchPercent: number
  diffPixels: number
  totalPixels: number
  diffDataUrl: string
  width: number
  height: number
}

function dataUrlToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.substring(dataUrl.indexOf(',') + 1)
  return Buffer.from(base64, 'base64')
}

/**
 * Compares two images pixel-by-pixel. Images are scaled to the smaller of
 * the two widths (preserving aspect ratio) and cropped to their common
 * height so pixelmatch can operate on equal-sized RGBA buffers.
 */
export async function diffImages(leftDataUrl: string, rightDataUrl: string): Promise<DiffResult> {
  const [left, right] = await Promise.all([
    Jimp.read(dataUrlToBuffer(leftDataUrl)),
    Jimp.read(dataUrlToBuffer(rightDataUrl))
  ])

  const targetWidth = Math.min(left.bitmap.width, right.bitmap.width)

  const leftScaled = left.clone().resize({ w: targetWidth })
  const rightScaled = right.clone().resize({ w: targetWidth })

  const targetHeight = Math.min(leftScaled.bitmap.height, rightScaled.bitmap.height)

  leftScaled.crop({ x: 0, y: 0, w: targetWidth, h: targetHeight })
  rightScaled.crop({ x: 0, y: 0, w: targetWidth, h: targetHeight })

  const diffOutput = Buffer.alloc(targetWidth * targetHeight * 4)

  const diffPixels = pixelmatch(
    new Uint8ClampedArray(leftScaled.bitmap.data),
    new Uint8ClampedArray(rightScaled.bitmap.data),
    diffOutput,
    targetWidth,
    targetHeight,
    { threshold: 0.1, diffMask: false, alpha: 0.6 }
  )

  const diffImage = new Jimp({ width: targetWidth, height: targetHeight, data: diffOutput })
  const diffDataUrl = await diffImage.getBase64('image/png')

  const totalPixels = targetWidth * targetHeight
  const matchPercent = totalPixels === 0 ? 100 : 100 - (diffPixels / totalPixels) * 100

  return {
    matchPercent: Math.round(matchPercent * 100) / 100,
    diffPixels,
    totalPixels,
    diffDataUrl,
    width: targetWidth,
    height: targetHeight
  }
}
