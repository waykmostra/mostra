'use client'

import { useState, useTransition } from 'react'
import { KeyRound, Copy, Check, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { regenerateSetupLink } from '../actions'

interface SetupLinkButtonProps {
  /** ID dans la table CRM `clients` (pas le profile auth). */
  clientId: string
}

export default function SetupLinkButton({ clientId }: SetupLinkButtonProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleGenerate() {
    if (url && !confirm('Régénérer un nouveau lien ? L\'ancien sera invalidé.')) return
    startTransition(async () => {
      const result = await regenerateSetupLink(clientId)
      if (result.success) {
        setUrl(result.setupUrl)
        toast.success('Lien régénéré')
      } else {
        toast.error(result.error)
      }
    })
  }

  async function handleCopy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Lien copié !')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Impossible de copier')
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-4 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="h-3.5 w-3.5 text-faint" />
        <h3 className="text-sm font-semibold text-ink">Lien set-password</h3>
      </div>
      <p className="text-xs text-faint">
        Génère un lien à envoyer au client pour qu&apos;il définisse son mot de passe. Valide 7
        jours.
      </p>

      {url && (
        <div className="rounded-lg bg-canvas border border-line px-3 py-2">
          <p className="text-[11px] text-dim font-mono break-all">{url}</p>
        </div>
      )}

      <div className="flex items-center gap-2">
        {url && (
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-surface-2 border border-line text-ink hover:bg-surface-3 transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copié' : 'Copier'}
          </button>
        )}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={pending}
          className={`${url ? '' : 'flex-1'} flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
            url
              ? 'border border-line text-dim hover:text-ink hover:border-line-strong'
              : 'bg-brand text-ink hover:bg-brand'
          } transition-colors disabled:opacity-60`}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} />
          {url ? 'Régénérer' : 'Générer un lien'}
        </button>
      </div>
    </section>
  )
}
