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
        <h2 className="text-sm font-semibold text-white">Paramètres généraux</h2>
        <p className="text-xs text-[#555555] mt-0.5">
          App privée Mostra — aucune configuration globale à régler ici pour le moment.
        </p>
      </div>

      <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-5 space-y-2">
        <p className="text-xs uppercase tracking-widest text-[#666666] font-semibold">
          Compte connecté
        </p>
        <p className="text-sm text-white">{profile.full_name}</p>
        <p className="text-xs text-[#555555]">{profile.email}</p>
      </div>
    </div>
  )
}
