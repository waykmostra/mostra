import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Paramètres — MOSTRA',
  description: "Paramètres de l'application.",
}

export default async function SettingsPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-ink">Paramètres généraux</h2>
        <p className="text-xs text-faint mt-0.5">
          App privée Mostra — aucune configuration globale à régler ici pour le moment.
        </p>
      </div>

      <div className="bg-surface border border-line rounded-xl p-5 space-y-2">
        <p className="text-xs uppercase tracking-widest text-faint font-semibold">
          Compte connecté
        </p>
        <p className="text-sm text-ink">{profile.full_name}</p>
        <p className="text-xs text-faint">{profile.email}</p>
      </div>
    </div>
  )
}
