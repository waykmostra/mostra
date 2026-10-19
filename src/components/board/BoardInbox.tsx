'use client'

import { useState } from 'react'
import { ChevronDown, Inbox } from 'lucide-react'
import BoardItemCard from './BoardItemCard'
import type { BoardItemView } from '@/lib/board'

/**
 * « À trier » : ce qui a été noté sans être encore mis en page. Visible de
 * l'admin seul. Chaque note se range dans une section via « Ranger dans… ».
 */
export default function BoardInbox({ items }: { items: BoardItemView[] }) {
  const [open, setOpen] = useState(true)
  if (items.length === 0) return null

  return (
    <section className="rounded-lg border border-dashed border-soon/50 bg-soon/[0.04] p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left">
        <Inbox className="h-4 w-4 text-soon" strokeWidth={1.75} />
        <span className="font-display text-[14.5px] text-ink">À trier</span>
        <span className="mono-label tnum text-soon">{items.length}</span>
        <span className="ml-2 text-[12px] text-faint">Visible de toi seul — range chaque note dans une section.</span>
        <ChevronDown className={`ml-auto h-4 w-4 text-faint transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="surface p-3">
              <BoardItemCard item={item} sectionId={null} siblingIds={[]} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
