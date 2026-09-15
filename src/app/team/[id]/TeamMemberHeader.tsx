'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { updateMemberAvailability } from '../actions'
import { AVAILABILITY_META, AVAILABILITY_ORDER } from '../teamMeta'
import type { TeamAvailability, TeamMember, TeamRole } from '@/lib/types'

interface Props {
  member: Pick<TeamMember, 'id' | 'contact_name' | 'availability' | 'portfolio_url'>
  roles: TeamRole[]
}

export default function TeamMemberHeader({ member, roles }: Props) {
  const [availability, setAvailability] = useState<TeamAvailability>(member.availability)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const current = AVAILABILITY_META[availability]

  function change(next: TeamAvailability) {
    if (next === availability) {
      setOpen(false)
      return
    }
    const prev = availability
    setAvailability(next)
    setOpen(false)
    startTransition(async () => {
      const result = await updateMemberAvailability(member.id, next)
      if (!result.success) {
        setAvailability(prev)
        toast.error(result.error)
      } else {
        toast.success(`Disponibilité → ${AVAILABILITY_META[next].label}`)
      }
    })
  }

  return (
    <div className="bg-surface border border-line rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-brand">
              {member.contact_name[0]?.toUpperCase() ?? '?'}
            </span>
          </div>

          {/* Identité + dispo */}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-ink truncate">{member.contact_name}</h1>

            {roles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {roles.map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                    style={{ color: r.color, backgroundColor: `${r.color}1a` }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: r.color }} />
                    {r.name}
                  </span>
                ))}
              </div>
            )}

            {/* Dispo éditable */}
            <div className="relative inline-block mt-2.5">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                disabled={isPending}
                className="
                  inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border
                  hover:brightness-110 transition-all disabled:opacity-50
                "
                style={{
                  color: current.color,
                  backgroundColor: current.bg,
                  borderColor: `${current.color}40`,
                }}
              >
                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: current.color }} />
                )}
                {current.label}
                <ChevronDown className="h-3 w-3" />
              </button>

              {open && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 z-20 bg-surface-2 border border-line rounded-lg overflow-hidden min-w-[160px] shadow-xl">
                    {AVAILABILITY_ORDER.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => change(a)}
                        className={`
                          flex items-center gap-2 w-full px-3 py-2 text-xs text-left
                          hover:bg-surface-3 transition-colors
                          ${a === availability ? 'bg-surface-2' : ''}
                        `}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: AVAILABILITY_META[a].color }}
                        />
                        <span className="text-ink">{AVAILABILITY_META[a].label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Portfolio */}
        {member.portfolio_url && (
          <a
            href={member.portfolio_url.startsWith('http') ? member.portfolio_url : `https://${member.portfolio_url}`}
            target="_blank"
            rel="noreferrer"
            className="
              inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0
              bg-surface-2 border border-line text-ink hover:bg-surface-3 transition-colors
            "
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Portfolio
          </a>
        )}
      </div>
    </div>
  )
}
