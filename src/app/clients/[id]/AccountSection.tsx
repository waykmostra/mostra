'use client'

import { useState, useTransition } from 'react'
import { Copy, Check, KeyRound, UserPlus, Loader2, RotateCcw, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { createAccountForClient, regenerateSetupLink } from '../actions'

interface AccountSectionProps {
  clientId: string
  hasAccount: boolean
  hasEmail: boolean
}

export default function AccountSection({ clientId, hasAccount, hasEmail }: AccountSectionProps) {
  const [setupUrl, setSetupUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [account, setAccount] = useState(hasAccount)
  const [isPending, startTransition] = useTransition()

  function handleCreateAccount() {
    if (!hasEmail) {
      toast.error("Renseigne l'email du client d'abord.")
      return
    }
    startTransition(async () => {
      const result = await createAccountForClient(clientId)
      if (result.success) {
        setSetupUrl(result.setupUrl)
        setAccount(true)
        toast.success('Compte créé. Copie le lien et envoie-le au client.')
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleRegenerate() {
    startTransition(async () => {
      const result = await regenerateSetupLink(clientId)
      if (result.success) {
        setSetupUrl(result.setupUrl)
        toast.success('Nouveau lien généré.')
      } else {
        toast.error(result.error)
      }
    })
  }

  async function handleCopy() {
    if (!setupUrl) return
    await navigator.clipboard.writeText(setupUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Pas de compte ET pas d'email
  if (!account && !hasEmail) {
    return (
      <div className="bg-[#1a1206] border border-[#F59E0B]/20 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-[#F59E0B] mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-white">Compte client indisponible</p>
          <p className="text-xs text-[#888888] mt-0.5">
            Ajoute un email à la fiche pour pouvoir créer un compte connectable.
          </p>
        </div>
      </div>
    )
  }

  // Pas de compte — propose la création
  if (!account) {
    return (
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#00D76B]" />
            Compte client
          </h3>
          <p className="text-xs text-[#666666] mt-1">
            Crée le compte auth pour générer un lien set-password à transmettre au client.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreateAccount}
          disabled={isPending}
          className="
            inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
            bg-[#00D76B] text-white hover:bg-[#00C061] transition-colors
            disabled:opacity-50
          "
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Créer le compte
        </button>
      </div>
    )
  }

  // Compte existe — affiche éventuellement le setupUrl + bouton régénération
  return (
    <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#00D76B]" />
            Compte client
          </h3>
          <p className="text-xs text-[#666666] mt-1">
            {setupUrl
              ? 'Lien à transmettre au client. Le lien est à usage unique et expire dans 7 jours.'
              : 'Compte connectable. Régénère un lien set-password si nécessaire.'}
          </p>
        </div>

        {!setupUrl && (
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={isPending}
            className="
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-[#1a1a1a] border border-[#2a2a2a] text-white hover:bg-[#222222]
              transition-colors disabled:opacity-50
            "
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            Nouveau lien
          </button>
        )}
      </div>

      {setupUrl && (
        <div className="flex items-center gap-2 bg-[#0d0d0d] border border-[#222222] rounded-lg px-3 py-2">
          <code className="text-xs text-[#00D76B] flex-1 truncate font-mono">{setupUrl}</code>
          <button
            type="button"
            onClick={handleCopy}
            className="
              flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium
              bg-[#1a1a1a] border border-[#2a2a2a] text-white hover:bg-[#222222]
              transition-colors
            "
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-[#22C55E]" />
                Copié
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copier
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
