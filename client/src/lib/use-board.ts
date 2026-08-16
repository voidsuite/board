/**
 * useBoard — the board document store.
 *
 * Holds columns/items/workspace in React state, applies optimistic local
 * mutations (mirroring the gateway's reindex semantics) and reconciles with
 * the server responses. Phase 5 wires the realtime socket into applyEvent.
 */

import * as React from "react"
import * as api from "@/lib/api"
import type {
  Board, BoardDocument, Column, Item, Label, WsEvent, Workspace,
} from "@/lib/types"

export interface BoardStore {
  status: "loading" | "ready" | "error"
  error: string | null
  board: Board | null
  workspace: Workspace | null
  columns: Column[]
  labels: Label[]
  getLabel: (id: string) => Label | undefined
  itemsIn: (columnId: string) => Item[]
  item: (id: string) => Item | undefined
  reload: () => void
  // board ops
  createColumn: (name: string) => Promise<void>
  renameColumn: (columnId: string, name: string) => Promise<void>
  setColumnWip: (columnId: string, wipLimit: number | null) => Promise<void>
  deleteColumn: (columnId: string) => Promise<void>
  renameBoard: (name: string) => Promise<void>
  // item ops
  createItem: (columnId: string, title: string) => Promise<void>
  updateItem: (itemId: string, patch: Partial<Pick<Item, "title" | "description" | "priority" | "dueDate" | "coverFileId">>) => Promise<void>
  moveItem: (itemId: string, columnId: string, index: number) => Promise<void>
  deleteItem: (itemId: string) => Promise<void>
  // associations
  createLabel: (name: string, color: string) => Promise<void>
  setItemLabels: (itemId: string, labelIds: string[]) => Promise<void>
  setItemAssignees: (itemId: string, userIds: string[]) => Promise<void>
  addComment: (itemId: string, body: string) => Promise<void>
  addChecklistEntry: (itemId: string, text: string) => Promise<void>
  setChecklistEntry: (itemId: string, entryId: string, text: string, done: boolean) => Promise<void>
  deleteChecklistEntry: (itemId: string, entryId: string) => Promise<void>
  uploadCover: (itemId: string, file: File) => Promise<void>
  // realtime (phase 5)
  applyEvent: (ev: WsEvent) => void
}

export function useBoard(boardId: string): BoardStore {
  const [status, setStatus] = React.useState<BoardStore["status"]>("loading")
  const [error, setError] = React.useState<string | null>(null)
  const [board, setBoard] = React.useState<Board | null>(null)
  const [workspace, setWorkspace] = React.useState<Workspace | null>(null)
  const [columns, setColumns] = React.useState<Column[]>([])
  const [items, setItems] = React.useState<Record<string, Item>>({})

  const reload = React.useCallback(() => {
    setStatus("loading")
    setError(null)
    api
      .getBoardDocument(boardId)
      .then((doc: BoardDocument) => {
        setBoard(doc.board)
        setWorkspace(doc.workspace)
        setColumns(doc.columns)
        setItems(Object.fromEntries(doc.items.map((i) => [i.id, i])))
        setStatus("ready")
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Couldn't load this board")
        setStatus("error")
      })
  }, [boardId])

  React.useEffect(() => {
    reload()
  }, [reload])

  const patchItem = React.useCallback((item: Item) => {
    setItems((prev) => ({ ...prev, [item.id]: item }))
  }, [])

  const itemsIn = React.useCallback(
    (columnId: string): Item[] =>
      Object.values(items)
        .filter((i) => i.columnId === columnId)
        .sort((a, b) => a.position - b.position || a.createdAt - b.createdAt),
    [items]
  )

  const item = React.useCallback((id: string): Item | undefined => items[id], [items])

  // Mirror the gateway's move algorithm exactly (server reindexes the target
  // column) so the optimistic UI and the persisted state stay consistent.
  const moveItem = React.useCallback(
    async (itemId: string, columnId: string, index: number) => {
      const current = items[itemId]
      if (!current) return
      const before = items
      const target = itemsIn(columnId)
        .map((i) => i.id)
        .filter((id) => id !== itemId)
      const at = Math.max(0, Math.min(index, target.length))
      target.splice(at, 0, itemId)
      setItems((prev) => {
        const next = { ...prev }
        target.forEach((id, i) => {
          next[id] = { ...next[id], columnId, position: i }
        })
        return next
      })
      try {
        const moved = await api.moveItem(itemId, columnId, at)
        patchItem(moved)
      } catch (e) {
        setItems(before)
        throw e
      }
    },
    [items, itemsIn, patchItem]
  )

  const updateItem = React.useCallback(
    async (itemId: string, patch: Parameters<BoardStore["updateItem"]>[1]) => {
      try {
        const updated = await api.updateItem(itemId, patch)
        patchItem(updated)
      } catch (e) {
        throw e
      }
    },
    [patchItem]
  )

  const deleteItem = React.useCallback(
    async (itemId: string) => {
      const before = items
      setItems((prev) => {
        const next = { ...prev }
        delete next[itemId]
        return next
      })
      try {
        await api.deleteItem(itemId)
      } catch (e) {
        setItems(before)
        throw e
      }
    },
    [items]
  )

  const createItem = React.useCallback(
    async (columnId: string, title: string) => {
      const created = await api.createItem({ boardId, columnId, title })
      patchItem(created)
    },
    [boardId, patchItem]
  )

  const createColumn = React.useCallback(
    async (name: string) => {
      const column = await api.createColumn(boardId, name)
      setColumns((prev) => [...prev, column])
    },
    [boardId]
  )

  const renameColumn = React.useCallback(
    async (columnId: string, name: string) => {
      const column = await api.renameColumn(columnId, name)
      setColumns((prev) => prev.map((c) => (c.id === column.id ? column : c)))
    },
    []
  )

  const renameBoard = React.useCallback(
    async (name: string) => {
      if (!board) return
      const updated = await api.renameBoard(board.id, name)
      setBoard(updated)
    },
    [board]
  )

  const setColumnWip = React.useCallback(
    async (columnId: string, wipLimit: number | null) => {
      const column = await api.setColumnWipLimit(columnId, wipLimit)
      setColumns((prev) => prev.map((c) => (c.id === column.id ? column : c)))
    },
    []
  )

  const deleteColumn = React.useCallback(
    async (columnId: string) => {
      const beforeColumns = columns
      const beforeItems = items
      setColumns((prev) => prev.filter((c) => c.id !== columnId))
      setItems((prev) => {
        const next = { ...prev }
        for (const i of Object.values(next)) {
          if (i.columnId === columnId) delete next[i.id]
        }
        return next
      })
      try {
        await api.deleteColumn(columnId)
      } catch (e) {
        setColumns(beforeColumns)
        setItems(beforeItems)
        throw e
      }
    },
    [columns, items]
  )

  const createLabel = React.useCallback(
    async (name: string, color: string) => {
      const label = await api.createLabel(boardId, name, color)
      // Keep the label reachable even before an item uses it.
      setLabels((prev) => (prev.some((l) => l.id === label.id) ? prev : [...prev, label]))
    },
    [boardId]
  )

  const setItemLabels = React.useCallback(
    async (itemId: string, labelIds: string[]) => {
      const updated = await api.setItemLabels(itemId, labelIds)
      patchItem(updated)
    },
    [patchItem]
  )

  const setItemAssignees = React.useCallback(
    async (itemId: string, userIds: string[]) => {
      const updated = await api.setItemAssignees(itemId, userIds)
      patchItem(updated)
    },
    [patchItem]
  )

  const addComment = React.useCallback(
    async (itemId: string, body: string) => {
      const updated = await api.addComment(itemId, body)
      patchItem(updated)
    },
    [patchItem]
  )

  const addChecklistEntry = React.useCallback(
    async (itemId: string, text: string) => {
      const updated = await api.addChecklistEntry(itemId, text)
      patchItem(updated)
    },
    [patchItem]
  )

  const setChecklistEntry = React.useCallback(
    async (itemId: string, entryId: string, text: string, done: boolean) => {
      const updated = await api.setChecklistEntry(itemId, entryId, text, done)
      patchItem(updated)
    },
    [patchItem]
  )

  const deleteChecklistEntry = React.useCallback(
    async (itemId: string, entryId: string) => {
      const updated = await api.deleteChecklistEntry(itemId, entryId)
      patchItem(updated)
    },
    [patchItem]
  )

  const uploadCover = React.useCallback(
    async (itemId: string, file: File) => {
      if (!workspace) throw new Error("Workspace not loaded")
      const meta = await api.uploadFile(workspace.id, file)
      const updated = await api.updateItem(itemId, { coverFileId: meta.id })
      patchItem(updated)
    },
    [workspace, patchItem]
  )

  // --- labels registry (union of labels on items + newly created) ---

  const [labels, setLabels] = React.useState<Label[]>([])

  React.useEffect(() => {
    const union = new Map<string, Label>()
    for (const i of Object.values(items)) {
      for (const l of i.labels) union.set(l.id, l)
    }
    setLabels((prev) => {
      const merged = new Map<string, Label>()
      for (const l of prev) merged.set(l.id, l)
      for (const l of union.values()) merged.set(l.id, l)
      return [...merged.values()].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
    })
  }, [items])

  const getLabel = React.useCallback((id: string): Label | undefined => labels.find((l) => l.id === id), [labels])

  // --- realtime reconciliation (phase 5) ---

  const applyEvent = React.useCallback(
    (ev: WsEvent) => {
      const type = ev.type
      if (type === "item.upsert" && ev.item) {
        patchItem(ev.item as Item)
      } else if (type === "item.delete" && ev.itemId) {
        setItems((prev) => {
          const next = { ...prev }
          delete next[ev.itemId as string]
          return next
        })
      } else if (type === "column.upsert" && ev.column) {
        const col = ev.column as Column
        setColumns((prev) => (prev.some((c) => c.id === col.id) ? prev.map((c) => (c.id === col.id ? col : c)) : [...prev, col]))
      } else if (type === "column.delete" && ev.columnId) {
        const cid = ev.columnId as string
        setColumns((prev) => prev.filter((c) => c.id !== cid))
        setItems((prev) => {
          const next = { ...prev }
          for (const i of Object.values(next)) if (i.columnId === cid) delete next[i.id]
          return next
        })
      } else if (type === "label.upsert" && ev.label) {
        const label = ev.label as Label
        setLabels((prev) => (prev.some((l) => l.id === label.id) ? prev.map((l) => (l.id === label.id ? label : l)) : [...prev, label]))
      } else if (type === "board.delete") {
        // The board is gone — surface it to the page.
        setStatus("error")
        setError("This board was deleted.")
      }
    },
    [patchItem]
  )

  return {
    status, error, board, workspace, columns, labels, getLabel, itemsIn, item, reload,
    createColumn, renameColumn, setColumnWip, deleteColumn, renameBoard,
    createItem, updateItem, moveItem, deleteItem,
    createLabel, setItemLabels, setItemAssignees,
    addComment, addChecklistEntry, setChecklistEntry, deleteChecklistEntry,
    uploadCover, applyEvent,
  }
}