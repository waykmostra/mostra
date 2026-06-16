import Link from 'next/link'
import { FileText, ChevronRight, CheckCircle2 } from 'lucide-react'

interface ClientScript {
  id: string
  title: string
  description: string | null
  is_selected: boolean
}

interface ClientScriptsGridProps {
  scripts: ClientScript[]
  sectionCounts: Record<string, number>
  /** URL de la sous-phase ; chaque script s'ouvre via ?s=<id>. */
  basePath: string
}

export default function ClientScriptsGrid({ scripts, sectionCounts, basePath }: ClientScriptsGridProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {scripts.map((s) => {
          const count = sectionCounts[s.id] ?? 0
          return (
            <Link
              key={s.id}
              href={`${basePath}?s=${s.id}`}
              className={`group rounded-2xl border p-4 transition-colors flex flex-col gap-2
                ${s.is_selected ? 'border-[#00D76B]/40 bg-[#00D76B]/5' : 'border-[#1f1f1f] bg-[#111111] hover:border-[#3a3a3a]'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-[#666666] flex-shrink-0" />
                  <p className="text-sm font-semibold text-white truncate group-hover:text-[#00D76B] transition-colors">
                    {s.title}
                  </p>
                </div>
                {s.is_selected && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#00D76B] flex-shrink-0">
                    <CheckCircle2 className="h-3 w-3" />
                    Choisi
                  </span>
                )}
              </div>

              {s.description && <p className="text-xs text-[#888888] line-clamp-2">{s.description}</p>}

              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="text-[10px] text-[#555555]">{count} section{count !== 1 ? 's' : ''}</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-[#888888] group-hover:text-white transition-colors">
                  Lire <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
