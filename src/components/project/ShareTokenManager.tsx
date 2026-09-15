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
    <section className="rounded-xl border border-line bg-surface p-4 space-y-3">
      <div className="flex items-center gap-2">
        <LinkIcon className="h-3.5 w-3.5 text-faint" />
        <h3 className="text-[10px] font-semibold tracking-widest text-faint uppercase">
          Lien client
        </h3>
      </div>

      {fullUrl ? (
        <>
          <div className="rounded-lg bg-canvas border border-line px-3 py-2">
            <p className="text-[11px] text-dim font-mono break-all">{fullUrl}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-surface-2 border border-line text-ink hover:bg-surface-3 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copié' : 'Copier'}
            </button>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={pending}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-line text-dim hover:text-ink hover:border-line-strong transition-colors disabled:opacity-60"
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
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-surface-2 border border-line text-ink hover:bg-surface-3 transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} />
          Générer un lien client
        </button>
      )}
    </section>
  )
}
