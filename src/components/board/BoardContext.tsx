'use client'

import { createContext, useCallback, useContext, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { BoardComment } from '@/lib/board'

export interface SectionOption {
  id: string
  label: string
}

interface BoardContextValue {
  projectId: string
  /** Admin : compose la grille. Client : lecture seule. */
  editable: boolean
  /** Connecté et rattaché au projet (ou admin) : peut commenter. */
  canComment: boolean
  comments: BoardComment[]
  /** Destinations possibles pour « Ranger dans… » (admin). */
  sectionOptions: SectionOption[]
}

const BoardCtx = createContext<BoardContextValue | null>(null)

export function BoardProvider({ value, children }: { value: BoardContextValue; children: React.ReactNode }) {
  return <BoardCtx.Provider value={value}>{children}</BoardCtx.Provider>
}

export function useBoard(): BoardContextValue {
  const ctx = useContext(BoardCtx)
  if (!ctx) throw new Error('useBoard doit être utilisé dans <BoardProvider>')
  return ctx
}

type Result = { success: true } | { success: false; error: string }

/**
 * Lance une action serveur du Cadrage : toast en cas d'erreur, puis rafraîchit
 * la page pour relire la grille depuis la base (source de vérité unique).
 */
export function useBoardAction() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const run = useCallback(
    (action: () => Promise<Result>, success?: string) =>
      new Promise<boolean>((resolve) => {
        startTransition(async () => {
          let res: Result | undefined
          try {
            res = await action()
          } catch (err) {
            res = { success: false, error: err instanceof Error ? err.message : 'Erreur inattendue' }
          }
          // Une action qui échoue côté réseau peut ne rien renvoyer.
          if (!res) res = { success: false, error: 'Le serveur n’a pas répondu' }
          if (!res.success) {
            toast.error(res.error)
            resolve(false)
            return
          }
          if (success) toast.success(success)
          router.refresh()
          resolve(true)
        })
      }),
    [router],
  )

  return { run, isPending }
}
