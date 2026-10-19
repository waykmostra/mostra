'use client'

import { useState } from 'react'
import { Loader2, NotebookPen } from 'lucide-react'
import { addBoardLink, addBoardText } from '@/app/projects/board-actions'
import { useBoardAction } from './BoardContext'

/** Un lien seul (avec ou sans https) devient une référence, le reste une note. */
function looksLikeUrl(text: string): boolean {
  return /^(https?:\/\/\S+|www\.\S+|[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?)$/i.test(text)
}

/**
 * « Noter » : capter en deux secondes une référence, une décision ou une idée
 * dite en call. Tout atterrit dans « À trier », visible de l'admin seul.
 * Utilisable hors du Cadrage (vue projet) : n'exige pas de BoardProvider.
 */
export default function QuickNote({ projectId, compact = false }: { projectId: string; compact?: boolean }) {
  const { run, isPending } = useBoardAction()
  const [draft, setDraft] = useState('')

  async function submit() {
    const text = draft.trim()
    if (!text) return
    const ok = await run(
      () => (looksLikeUrl(text) ? addBoardLink(projectId, null, { url: text }) : addBoardText(projectId, null, text)),
      'Noté dans « À trier » ✓',
    )
    if (ok) setDraft('')
  }

  return (
    <div className={`surface flex items-start gap-2.5 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
      <NotebookPen className="mt-2 h-4 w-4 flex-shrink-0 text-faint" strokeWidth={1.75} />
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            void submit()
          }
        }}
        rows={1}
        placeholder="Noter une référence, une décision, une idée… (Entrée pour envoyer)"
        className="min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-[14px] text-ink outline-none placeholder:text-faint"
      />
      <button type="button" onClick={() => void submit()} disabled={isPending || !draft.trim()} className="btn-primary min-h-[34px] px-3 text-[12.5px]">
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Noter'}
      </button>
    </div>
  )
}
