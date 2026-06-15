'use client'

import { useState, useTransition } from 'react'
import { Copy, Check, KeyRound, UserPlus, Loader2, RotateCcw, AlertCircle, CheckCircle2, Clock, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { formatRelative, formatDate } from '@/lib/utils/dates'
import type { ClientAccess } from '@/lib/supabase/access'
import { createAccountForClient, regenerateSetupLink } from '../actions'

interface AccountSectionProps {
  clientId: string
  hasAccount: boolean
  hasEmail: boolean
  access: ClientAccess
}

export default function AccountSection({ clientId, hasAccount, hasEmail, access }: AccountSectionProps) {
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
        toast.success('Nouveau lien généré — valide 30 jours.')
      } else {
        toast.error(result.error)
      }
    })
  }

  async function handleCopy() {
    if (!setupUrl) return
    await navigator.clipboard.writeText(setupUrl)
    setCopied(true)
    toast.success('Lien copié !')
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
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#00D76B] text-white hover:bg-[#00C061] transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Créer le compte
        </button>
      </div>
    )
  }

  // Compte existe — tracker + régénération (toujours disponible)
  return (
    <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#00D76B]" />
            Compte client
          </h3>
          <p className="text-xs text-[#666666] mt-1">
            Suivi de l&apos;accès du client. Régénère un lien quand tu veux (valide 30 jours, à usage unique).
          </p>
        </div>

        <button
          type="button"
          onClick={handleRegenerate}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#00D76B]/10 border border-[#00D76B]/30 text-[#00D76B] hover:bg-[#00D76B]/20 transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          {setupUrl ? 'Régénérer' : 'Générer un lien'}
        </button>
      </div>

      {/* Tracker : connexion + état du lien */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <ConnectionStat lastSignInAt={access.lastSignInAt} />
        <LinkStat link={access.link} justGenerated={!!setupUrl} />
      </div>

      {/* Lien fraîchement généré */}
      {setupUrl && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 bg-[#0d0d0d] border border-[#222222] rounded-lg px-3 py-2">
            <code className="text-xs text-[#00D76B] flex-1 truncate font-mono">{setupUrl}</code>
            <button
              type="button"
              onClick={handleCopy}
              className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-[#1a1a1a] border border-[#2a2a2a] text-white hover:bg-[#222222] transition-colors"
            >
              {copied ? (
                <><Check className="h-3.5 w-3.5 text-[#22C55E]" />Copié</>
              ) : (
                <><Copy className="h-3.5 w-3.5" />Copier</>
              )}
            </button>
          </div>
          <p className="text-[11px] text-[#555555]">
            Envoie ce lien au client. Il pourra définir son mot de passe et se connecter.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Cartes de statut ──────────────────────────────────────────────────────────

function StatBox({
  color,
  icon: Icon,
  label,
  value,
  sub,
}: {
  color: string
  icon: typeof LogIn
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-lg border border-[#1f1f1f] bg-[#0e0e0e] px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5" style={{ color }} />
        <span className="text-[10px] uppercase tracking-wider text-[#666666]">{label}</span>
      </div>
      <p className="text-sm font-medium" style={{ color }}>{value}</p>
      {sub && <p className="text-[11px] text-[#555555] mt-0.5">{sub}</p>}
    </div>
  )
}

function ConnectionStat({ lastSignInAt }: { lastSignInAt: string | null }) {
  if (lastSignInAt) {
    return (
      <StatBox
        color="#22C55E"
        icon={LogIn}
        label="Connexion"
        value="Déjà connecté"
        sub={`Dernière ${formatRelative(lastSignInAt)} (${formatDate(lastSignInAt)})`}
      />
    )
  }
  return (
    <StatBox color="#888888" icon={LogIn} label="Connexion" value="Jamais connecté" sub="Le client ne s'est pas encore connecté." />
  )
}

function LinkStat({ link, justGenerated }: { link: ClientAccess['link']; justGenerated: boolean }) {
  // Un lien vient d'être généré dans cette session → forcément actif.
  const state = justGenerated ? 'active' : link.state

  if (state === 'active') {
    return (
      <StatBox
        color="#3B82F6"
        icon={Clock}
        label="Lien set-password"
        value="Actif"
        sub={link.expiresAt && !justGenerated ? `Expire le ${formatDate(link.expiresAt)}` : 'Valide 30 jours, non encore utilisé.'}
      />
    )
  }
  if (state === 'used') {
    return (
      <StatBox
        color="#22C55E"
        icon={CheckCircle2}
        label="Lien set-password"
        value="Utilisé ✓"
        sub={link.usedAt ? `Mot de passe défini ${formatRelative(link.usedAt)}` : 'Mot de passe défini.'}
      />
    )
  }
  if (state === 'expired') {
    return (
      <StatBox
        color="#F59E0B"
        icon={Clock}
        label="Lien set-password"
        value="Expiré"
        sub={`Expiré le ${link.expiresAt ? formatDate(link.expiresAt) : '—'} · régénère-en un.`}
      />
    )
  }
  return (
    <StatBox color="#888888" icon={Clock} label="Lien set-password" value="Aucun lien" sub="Génère un lien à envoyer au client." />
  )
}
