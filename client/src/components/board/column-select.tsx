/**
 * ColumnSelect — move a card to another column straight from the table and
 * list views (the board view already supports drag & drop). Renders a small
 * select bound to the card's current column; picking another one moves the
 * card to the end of that column.
 *
 * Click propagation is stopped on the trigger so the control can live inside
 * clickable rows (table rows, list rows) without opening the card dialog.
 */

import { ArrowRightLeft } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { Column, Item } from "@/lib/types"

export function ColumnSelect({
  columns,
  item,
  onMoveItem,
  compact = false,
  className,
}: {
  columns: Column[]
  item: Item
  onMoveItem: (item: Item, columnId: string) => void
  /** Compact variant for dense list rows: transparent trigger with icon. */
  compact?: boolean
  className?: string
}) {
  return (
    <Select
      value={item.columnId}
      onValueChange={(v) => {
        if (v && v !== item.columnId) onMoveItem(item, v)
      }}
    >
      <SelectTrigger
        size="sm"
        onClick={(e) => e.stopPropagation()}
        aria-label="Move to column"
        className={cn(
          "h-6 gap-1 text-xs",
          compact ? "border-transparent bg-transparent px-1.5 text-muted-foreground hover:bg-muted" : "text-foreground",
          className
        )}
      >
        {compact ? <ArrowRightLeft className="size-3 shrink-0" aria-hidden="true" /> : null}
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        {columns.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}