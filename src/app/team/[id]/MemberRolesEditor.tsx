'use client'

import { useState, useTransition } from 'react'
import { Briefcase, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { setMemberRoles } from '../actions'
import type { TeamRole } from '@/lib/types'

interface Props {
  memberId: string
  allRoles: TeamRole[]
  initialRoleIds: string[]
}

export default function MemberRolesEditor({ memberId, allRoles, initialRoleIds }: Props) {
  const [selected, setSelected] = useState<string[]>(initialRoleIds)
  const [isPending, startTransition] = useTransition()

  function toggle(roleId: string) {
    const next = selected.includes(roleId)
      ? selected.filter((id) => id !== roleId)
      : [...selected, roleId]

    const prev = selected
    setSelected(next)

    startTransition(async () => {
      const result = await setMemberRoles(memberId, next)
      if (!result.success) {
        setSelected(prev)
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="bg-surface border border-line rounded-xl p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-faint uppercase tracking-widest flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5" />
          Métiers
        </h2>
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-faint" />}
      </div>

      {allRoles.length === 0 ? (
        <p className="text-sm text-faint italic">
          Aucun métier défini. Ajoute-en depuis l&apos;annuaire (bouton « Métiers »).
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {allRoles.map((r) => {
            const active = selected.includes(r.id)
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => toggle(r.id)}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-60"
                style={{
                  color: active ? r.color : 'rgb(var(--c-text-dim))',
                  backgroundColor: active ? `${r.color}1a` : 'transparent',
                  borderColor: active ? `${r.color}55` : 'rgb(var(--c-border))',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: r.color }} />
                {r.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
