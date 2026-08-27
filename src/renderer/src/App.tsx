import { useEffect, useRef, useState } from 'react'
import TopBar from './components/TopBar'
import OverlayCompare from './components/OverlayCompare'
import TabBar from './components/TabBar'
import { createEmptyTab, type TabSnapshot, type WorkspaceFile } from './workspace'

function isWorkspaceFile(value: unknown): value is WorkspaceFile {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as WorkspaceFile).tabs) &&
    (value as WorkspaceFile).tabs.length > 0
  )
}

export default function App(): JSX.Element {
  const [tabs, setTabs] = useState<TabSnapshot[] | null>(null)
  const [activeTabId, setActiveTabId] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    window.api.workspace.load().then((raw) => {
      if (isWorkspaceFile(raw)) {
        setTabs(raw.tabs)
        setActiveTabId(raw.tabs.some((t) => t.id === raw.activeTabId) ? raw.activeTabId : raw.tabs[0].id)
      } else {
        const tab = createEmptyTab()
        setTabs([tab])
        setActiveTabId(tab.id)
      }
    })
  }, [])

  function persist(nextTabs: TabSnapshot[], nextActiveId: string): void {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      window.api.workspace.save({ tabs: nextTabs, activeTabId: nextActiveId })
    }, 400)
  }

  function updateTab(id: string, patch: Partial<TabSnapshot>): void {
    setTabs((prev) => {
      if (!prev) return prev
      const next = prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
      persist(next, activeTabId)
      return next
    })
  }

  function addTab(): void {
    const tab = createEmptyTab()
    setTabs((prev) => {
      const next = [...(prev ?? []), tab]
      persist(next, tab.id)
      return next
    })
    setActiveTabId(tab.id)
  }

  function closeTab(id: string): void {
    setTabs((prev) => {
      if (!prev) return prev
      const remaining = prev.filter((t) => t.id !== id)
      // Always keep at least one tab open — closing the last one starts a
      // fresh workspace instead of leaving nothing to show.
      const finalTabs = remaining.length > 0 ? remaining : [createEmptyTab()]
      let nextActiveId = activeTabId
      if (id === activeTabId) {
        const closedIndex = prev.findIndex((t) => t.id === id)
        const fallback = finalTabs[Math.min(closedIndex, finalTabs.length - 1)] ?? finalTabs[0]
        nextActiveId = fallback.id
        setActiveTabId(nextActiveId)
      }
      persist(finalTabs, nextActiveId)
      return finalTabs
    })
  }

  function togglePin(id: string): void {
    setTabs((prev) => {
      if (!prev) return prev
      const next = prev.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t))
      persist(next, activeTabId)
      return next
    })
  }

  function selectTab(id: string): void {
    setActiveTabId(id)
    if (tabs) persist(tabs, id)
  }

  if (!tabs) {
    return (
      <>
        <TopBar />
        <div className="app" />
      </>
    )
  }

  return (
    <>
      <TopBar />
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelect={selectTab}
        onAdd={addTab}
        onClose={closeTab}
        onTogglePin={togglePin}
      />
      <div className="app">
        {tabs.map((tab) => (
          // Every tab's OverlayCompare stays mounted at all times — only
          // the active one is visible (`display: contents` doesn't add a
          // box, so it behaves as if it weren't there when active) — so
          // switching tabs is instant and never re-navigates or drops a
          // loaded page's scroll/session state, the same way background
          // browser tabs stay alive.
          <div key={tab.id} style={{ display: tab.id === activeTabId ? 'contents' : 'none' }}>
            <OverlayCompare initial={tab} onChange={(patch) => updateTab(tab.id, patch)} />
          </div>
        ))}
      </div>
    </>
  )
}
