export type SourceKind = 'url' | 'image'

export interface ThemeColors {
  bgGradient: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  textBright: string
  surfaceBg: string
  surfaceBorder: string
  surfaceStrongBg: string
  inputBg: string
  inputBorder: string
  overlayScrim: string
  hoverBg: string
  divider: string
  accentBg: string
  accentBorder: string
  accentText: string
  accentSolid: string
  successBg: string
  successBorder: string
  successText: string
  dangerBg: string
  dangerText: string
  buttonBg: string
  buttonBorder: string
  buttonHoverBg: string
  sliderColor: string
  sliderHandle: string
}

export interface Theme {
  id: string
  name: string
  colors: ThemeColors
  /** Present for user-created themes loaded from userData/themes — lets the
   *  UI offer "delete" only for those, never for built-ins. */
  custom?: boolean
}

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
