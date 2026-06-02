'use client'

import { useState, useTransition } from 'react'
import { Copy, Check, RefreshCw, Link as LinkIcon } from 'lucide-react'
import { toast } from 'sonner'
import { regenerateShareToken } from '@/app/projects/actions'

interface ShareTokenManagerProps {
  projectId: string
  shareToken: string | null
  /** Base URL de l'app, ex: https://mostra.app */
  appUrl: string
}

export default function ShareTokenManager({
  projectId,
  shareToken: initialToken,
  appUrl,
}: ShareTokenManagerProps) {
  const [token, setToken] = useState<string | null>(initialToken)
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()

  const fullUrl = token ? `${appUrl}/client/${token}` : null

  async function handleCopy() {
    if (!fullUrl) return
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      toast.success('Lien copié !')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Impossible de copier')
    }
  }

  function handleRegenerate() {
    if (!confirm('Régénérer un nouveau lien ? L\'ancien sera invalidé.')) return
    startTransition(async () => {
      const result = await regenerateShareToken(projectId)
      if (result.success) {
        setToken(result.token)
        toast.success('Lien régénéré')
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <section className="rounded-xl border border-[#2a2a2a] bg-[#111111] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <LinkIcon className="h-3.5 w-3.5 text-[#666666]" />
        <h3 className="text-[10px] font-semibold tracking-widest text-[#444444] uppercase">
          Lien client
        </h3>
      </div>

      {fullUrl ? (
        <>
          <div className="rounded-lg bg-[#0a0a0a] border border-[#1e1e1e] px-3 py-2">
            <p className="text-[11px] text-[#a0a0a0] font-mono break-all">{fullUrl}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-[#1a1a1a] border border-[#2a2a2a] text-white hover:bg-[#222222] transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copié' : 'Copier'}
            </button>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={pending}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-[#2a2a2a] text-[#a0a0a0] hover:text-white hover:border-[#444444] transition-colors disabled:opacity-60"
              title="Régénérer le lien"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={pending}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-[#1a1a1a] border border-[#2a2a2a] text-white hover:bg-[#222222] transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} />
          Générer un lien client
        </button>
      )}
    </section>
  )
}
