import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// The shape of a saved workspace (tabs + which one was active) is owned
// entirely by the renderer — main just persists whatever JSON-serializable
// blob it's handed and hands the same blob back, unparsed beyond JSON
// itself, so the tab/session shape can evolve without touching main.
export type WorkspaceSnapshot = unknown

function workspacePath(): string {
  return join(app.getPath('userData'), 'workspace.json')
}

export function loadWorkspace(): WorkspaceSnapshot | null {
  try {
    const raw = readFileSync(workspacePath(), 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveWorkspace(snapshot: WorkspaceSnapshot): void {
  writeFileSync(workspacePath(), JSON.stringify(snapshot), 'utf8')
}
