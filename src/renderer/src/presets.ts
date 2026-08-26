export interface SizePreset {
  label: string
  width: number
  height: number
}

export const SIZE_PRESETS: SizePreset[] = [
  { label: 'Mobile S', width: 375, height: 667 },
  { label: 'Mobile L', width: 414, height: 896 },
  { label: 'Tablet', width: 768, height: 1024 },
  { label: 'Laptop', width: 1366, height: 768 },
  { label: 'Desktop', width: 1440, height: 900 },
  { label: 'Desktop HD', width: 1920, height: 1080 }
]

/** Mimics a browser address bar: adds a scheme if the user typed a bare host. */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/.*)?$/i.test(trimmed)) return `http://${trimmed}`
  return `https://${trimmed}`
}
