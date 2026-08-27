export type SourceKind = 'url' | 'image'

export interface InspectTreeNode {
  tag: string
  id: string | null
  classes: string
  childCount: number
  children: InspectTreeNode[]
  truncated?: boolean
  moreChildren?: number
}

export interface InspectMatchedRule {
  selector: string
  source: string
  decls: [string, string][]
}

export interface InspectSelection {
  label: string
  tag: string
  id: string | null
  classes: string
  attributes: [string, string][]
  size: { width: number; height: number }
  position: { x: number; y: number }
  tree: InspectTreeNode
  matchedRules: InspectMatchedRule[]
  skippedStylesheets: number
  computed: [string, string][]
}

export interface LoadedSource {
  kind: SourceKind
  dataUrl: string
  width: number
  height: number
  label: string
}
