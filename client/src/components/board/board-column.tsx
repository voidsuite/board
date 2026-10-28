/**
 * BoardColumn — one kanban column: header with count/WIP + menu, the card
 * list (native HTML5 drag & drop with an insertion line), and an inline
 * "add card" composer.
 */

import * as React from "react"
import { CheckIcon, Gauge, MoreHorizontal, MoveLeft, MoveRight, Pencil, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenu, ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuSeparator,
  ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { ItemCard, PRIORITY_LABELS } from "@/components/board/item-card"
import { cn } from "@/lib/utils"
import type { Column, Item, ItemPriority, Label } from "@/lib/types"

export interface DragState {
  itemId: string
  fromColumnId: string
  sourceIndex: number
}

const PRIORITIES: ItemPriority[] = ["none", "low", "medium", "high", "urgent"]

export function BoardColumn({
  column,
  columns,
  labels,
  items,
  wipVisible,
  dragState,
  onDropCard,
  onItemDragStart,
  onOpen,
  onAddCard,
  onDeleteColumn,
  onDeleteItem,
  onMoveItem,
  onSetPriority,
  onToggleLabel,
  onMoveColumn,
  onMenuAction,
  dragDisabled = false,
}: {
  column: Column
  /** Every column on the board (for the card "move to column" submenu). */
  columns: Column[]
  /** Every label on the board (for the card "labels" submenu). */
  labels: Label[]
  items: Item[]
  wipVisible: boolean
  dragState: DragState | null
  onDropCard: (itemId: string, columnId: string, index: number) => void
  onItemDragStart: (item: Item, columnId: string) => void
  onOpen: (item: Item) => void
  onAddCard: (columnId: string, title: string) => Promise<void>
  onDeleteColumn: (column: Column) => void
  onDeleteItem: (item: Item) => void
  onMoveItem: (item: Item, columnId: string) => void
  onSetPriority: (item: Item, priority: ItemPriority) => void
  onToggleLabel: (item: Item, labelId: string) => void
  onMoveColumn: (column: Column, direction: "left" | "right") => void
  onMenuAction: (action: "rename" | "wip" | "clear-wip", column: Column) => void
  /** True when filters are active — cards are not draggable then. */
  dragDisabled?: boolean
}) {
  const [dragOver, setDragOver] = React.useState(false)
  const [dropIndex, setDropIndex] = React.useState<number | null>(null)
  const [composing, setComposing] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const listRef = React.useRef<HTMLDivElement>(null)

  const isSource = dragState?.fromColumnId === column.id
  const isFirstColumn = columns[0]?.id === column.id
  const isLastColumn = columns[columns.length - 1]?.id === column.id

  const computeDropIndex = (clientY: number): number => {
    const el = listRef.current
    if (!el) return items.length
    const rect = el.getBoundingClientRect()
    const y = clientY - rect.top
    if (items.length === 0) return 0
    const ratio = Math.min(1, Math.max(0, y / rect.height))
    return Math.round(ratio * items.length)
  }

  const onDragOver = (e: React.DragEvent) => {
    if (!dragState) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    const index = computeDropIndex(e.clientY)
    setDragOver(true)
    setDropIndex(index)
  }

  const onDragLeave = (e: React.DragEvent) => {
    if (!listRef.current?.contains(e.relatedTarget as Node)) {
      setDragOver(false)
      setDropIndex(null)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    if (!dragState) return
    e.preventDefault()
    const id = e.dataTransfer.getData("text/plain") || dragState.itemId
    const index = dropIndex ?? items.length
    setDragOver(false)
    setDropIndex(null)
    onDropCard(id, column.id, index)
  }

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const title = draft.trim()
    if (!title || busy) return
    setBusy(true)
    try {
      await onAddCard(column.id, title)
      setDraft("")
      setComposing(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <section
            data-slot="vb-column"
            className={cn(
              "vb-column w-72 shrink-0 rounded-xl border border-border bg-muted/40",
              isSource && dragState && "opacity-90",
              dragOver && "vb-drag-over border-primary/60 bg-primary/5"
            )}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
      {/* Header */}
      <header className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm font-semibold">{column.name}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="rounded-md bg-muted px-1.5 py-0.5">{items.length}</span>
            {column.wipLimit !== null && wipVisible ? (
              <span className={cn("rounded-md px-1.5 py-0.5", items.length > column.wipLimit ? "bg-destructive/10 text-destructive" : "bg-muted")}>
                / {column.wipLimit}
              </span>
            ) : null}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-xs" className="size-6 shrink-0 text-muted-foreground" aria-label={`Menu for ${column.name}`}>
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => setComposing(true)}>
              <Plus className="size-4" />
              Add a card
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onMenuAction("rename", column)}>
              <Pencil className="size-4" />
              Rename column
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onMenuAction("wip", column)}>
              <Gauge className="size-4" />
              {column.wipLimit !== null ? "Change WIP limit" : "Set WIP limit"}
            </DropdownMenuItem>
            {column.wipLimit !== null ? (
              <DropdownMenuItem onSelect={() => onMenuAction("clear-wip", column)}>
                Remove WIP limit
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <MoveLeft className="size-4 text-muted-foreground" aria-hidden="true" />
                Move column
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem disabled={isFirstColumn} onSelect={() => onMoveColumn(column, "left")}>
                  <MoveLeft className="size-4" />
                  Move left
                </DropdownMenuItem>
                <DropdownMenuItem disabled={isLastColumn} onSelect={() => onMoveColumn(column, "right")}>
                  <MoveRight className="size-4" />
                  Move right
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onDeleteColumn(column)}>
              <Trash2 className="size-4" />
              Delete column
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Cards */}
      <div ref={listRef} className="vb-column-list px-2 pb-2">
        {items.length === 0 ? (
          <div
            className={cn(
              "flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground",
              dragOver && "border-primary/50 text-primary"
            )}
          >
            {dragOver ? "Release to drop" : "No cards"}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, i) => (
              <React.Fragment key={item.id}>
                {dropIndex === i && dragOver ? <DropLine /> : null}
                <ContextMenu>
                  <ContextMenuTrigger
                    render={
                      <ItemCard
                        item={item}
                        onOpen={onOpen}
                        dragDisabled={dragDisabled}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", item.id)
                          e.dataTransfer.effectAllowed = "move"
                          onItemDragStart(item, column.id)
                        }}
                        onDragEnd={() => {
                          setDragOver(false)
                          setDropIndex(null)
                        }}
                      />
                    }
                  />
                  <ContextMenuContent className="w-48">
                    <ContextMenuItem onSelect={() => onOpen(item)}>
                      Open card
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuSub>
                      <ContextMenuSubTrigger>Move to column</ContextMenuSubTrigger>
                      <ContextMenuSubContent className="max-h-64">
                        {columns.map((col) => (
                          <ContextMenuItem key={col.id} disabled={col.id === item.columnId} onSelect={() => onMoveItem(item, col.id)}>
                            {col.id === item.columnId ? <CheckIcon className="size-4" /> : null}
                            {col.name}
                          </ContextMenuItem>
                        ))}
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                    <ContextMenuSub>
                      <ContextMenuSubTrigger>Set priority</ContextMenuSubTrigger>
                      <ContextMenuSubContent className="max-h-64">
                        {PRIORITIES.map((p) => (
                          <ContextMenuItem key={p} disabled={p === item.priority} onSelect={() => onSetPriority(item, p)}>
                            {p === item.priority ? <CheckIcon className="size-4" /> : null}
                            {PRIORITY_LABELS[p]}
                          </ContextMenuItem>
                        ))}
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                    {labels.length > 0 ? (
                      <ContextMenuSub>
                        <ContextMenuSubTrigger>Labels</ContextMenuSubTrigger>
                        <ContextMenuSubContent className="max-h-64">
                          {labels.map((l) => (
                            <ContextMenuCheckboxItem
                              key={l.id}
                              checked={item.labels.some((x) => x.id === l.id)}
                              onCheckedChange={() => onToggleLabel(item, l.id)}
                            >
                              <span className="size-2.5 shrink-0 rounded-full" style={{ background: l.color }} aria-hidden="true" />
                              <span className="truncate">{l.name}</span>
                            </ContextMenuCheckboxItem>
                          ))}
                        </ContextMenuSubContent>
                      </ContextMenuSub>
                    ) : null}
                    <ContextMenuSeparator />
                    <ContextMenuItem variant="destructive" onSelect={() => onDeleteItem(item)}>
                      <Trash2 className="size-4" />
                      Delete card
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </React.Fragment>
            ))}
            {dropIndex === items.length && dragOver ? <DropLine /> : null}
          </div>
        )}
      </div>

      {/* Composer */}
      <footer className="px-2 pb-2">
        {composing ? (
          <form onSubmit={submit} className="space-y-1.5 rounded-lg border border-border bg-card p-2">
            <textarea
              autoFocus
              value={draft}
              rows={2}
              maxLength={500}
              placeholder="Card title…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setComposing(false)
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void submit()
                }
              }}
              className="w-full resize-none rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center gap-1.5">
              <Button type="submit" size="xs" disabled={!draft.trim() || busy}>Add card</Button>
              <Button type="button" variant="ghost" size="icon-xs" className="size-6 text-muted-foreground" aria-label="Cancel"
                onClick={() => { setComposing(false); setDraft("") }}>
                <X className="size-3.5" />
              </Button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add a card
          </button>
        )}
      </footer>
          </section>
        }
      />
      <ContextMenuContent className="w-48">
        <ContextMenuItem onSelect={() => setComposing(true)}>
          <Plus className="size-4" />
          Add a card
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => onMenuAction("rename", column)}>
          <Pencil className="size-4" />
          Rename column
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onMenuAction("wip", column)}>
          <Gauge className="size-4" />
          {column.wipLimit !== null ? "Change WIP limit" : "Set WIP limit"}
        </ContextMenuItem>
        {column.wipLimit !== null ? (
          <ContextMenuItem onSelect={() => onMenuAction("clear-wip", column)}>
            Remove WIP limit
          </ContextMenuItem>
        ) : null}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <MoveLeft className="size-4 text-muted-foreground" aria-hidden="true" />
            Move column
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem disabled={isFirstColumn} onSelect={() => onMoveColumn(column, "left")}>
              <MoveLeft className="size-4" />
              Move left
            </ContextMenuItem>
            <ContextMenuItem disabled={isLastColumn} onSelect={() => onMoveColumn(column, "right")}>
              <MoveRight className="size-4" />
              Move right
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={() => onDeleteColumn(column)}>
          <Trash2 className="size-4" />
          Delete column
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function DropLine() {
  return <div className="h-0.5 rounded-full bg-primary/80" aria-hidden="true" />
}