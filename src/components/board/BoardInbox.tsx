'use client'

import { useState } from 'react'
import { ChevronDown, Inbox } from 'lucide-react'
import { moveBoardItem } from '@/app/projects/board-actions'
import BoardItemCard, { BOARD_ITEM_MIME } from './BoardItemCard'
import { useBoardAction } from './BoardContext'
import type { BoardItemView } from '@/lib/board'

/**
 * « À trier » : ce qui a été noté sans être encore mis en page. Visible de
 * l'admin seul. Chaque note se glisse dans une section (ou via « Ranger dans… »),
 * et un élément peut y être renvoyé en le déposant ici.
 */
export default function BoardInbox({ items }: { items: BoardItemView[] }) {
  const { run } = useBoardAction()
  const [open, setOpen] = useState(true)
  const [dropActive, setDropActive] = useState(false)
  if (items.length === 0) return null

  const ids = items.map((i) => i.id)

  return (
    <section
      className={`rounded-lg border border-dashed p-4 transition-colors ${
        dropActive ? 'border-soon bg-soon/[0.09]' : 'border-soon/50 bg-soon/[0.04]'
      }`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(BOARD_ITEM_MIME)) return
        e.preventDefault()
        setDropActive(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropActive(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDropActive(false)
        const itemId = e.dataTransfer.getData(BOARD_ITEM_MIME)
        if (itemId && !ids.includes(itemId)) void run(() => moveBoardItem(itemId, null))
      }}
    >
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left">
        <Inbox className="h-4 w-4 text-soon" strokeWidth={1.75} />
        <span className="font-display text-[14.5px] text-ink">À trier</span>
        <span className="mono-label tnum text-soon">{items.length}</span>
        <span className="ml-2 hidden text-[12px] text-faint sm:inline">
          Visible de toi seul — glisse chaque note dans une section.
        </span>
        <ChevronDown className={`ml-auto h-4 w-4 text-faint transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="surface p-3">
              <BoardItemCard item={item} sectionId={null} siblingIds={[]} dragWhole />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
