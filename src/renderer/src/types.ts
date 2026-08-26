export type SourceKind = 'url' | 'image'

export interface LoadedSource {
  kind: SourceKind
  dataUrl: string
  width: number
  height: number
  label: string
}
