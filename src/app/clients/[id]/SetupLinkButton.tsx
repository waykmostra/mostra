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
    <section className="rounded-xl border border-[#2a2a2a] bg-[#111111] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="h-3.5 w-3.5 text-[#666666]" />
        <h3 className="text-sm font-semibold text-white">Lien set-password</h3>
      </div>
      <p className="text-xs text-[#666666]">
        Génère un lien à envoyer au client pour qu&apos;il définisse son mot de passe. Valide 7
        jours.
      </p>

      {url && (
        <div className="rounded-lg bg-[#0a0a0a] border border-[#1e1e1e] px-3 py-2">
          <p className="text-[11px] text-[#a0a0a0] font-mono break-all">{url}</p>
        </div>
      )}

      <div className="flex items-center gap-2">
        {url && (
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-[#1a1a1a] border border-[#2a2a2a] text-white hover:bg-[#222222] transition-colors"
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
              ? 'border border-[#2a2a2a] text-[#a0a0a0] hover:text-white hover:border-[#444444]'
              : 'bg-[#00D76B] text-white hover:bg-[#00C061]'
          } transition-colors disabled:opacity-60`}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} />
          {url ? 'Régénérer' : 'Générer un lien'}
        </button>
      </div>
    </section>
  )
}
