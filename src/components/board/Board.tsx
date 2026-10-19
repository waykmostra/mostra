'use client'

import { BoardProvider, type SectionOption } from './BoardContext'
import BoardGrid from './BoardGrid'
import BoardInbox from './BoardInbox'
import { SECTION_META } from './BoardSectionCard'
import type { BoardComment, BoardView } from '@/lib/board'

interface Props {
  projectId: string
  board: BoardView
  comments: BoardComment[]
  editable: boolean
  canComment: boolean
}

/** Le Cadrage complet : « À trier » (admin) puis la grille. */
export default function Board({ projectId, board, comments, editable, canComment }: Props) {
  const sectionOptions: SectionOption[] = board.columns.flatMap((col, ci) =>
    col.sections.map((s) => ({
      id: s.id,
      label: `${s.title || SECTION_META[s.type].label} · colonne ${ci + 1}`,
    })),
  )

  return (
    <BoardProvider value={{ projectId, editable, canComment, comments, sectionOptions }}>
      <div className="space-y-5">
        {editable && <BoardInbox items={board.inbox} />}
        <BoardGrid columns={board.columns} />
      </div>
    </BoardProvider>
  )
}
