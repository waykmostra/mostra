import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import Logo from '@/components/shared/Logo'
import SetPasswordForm from './SetPasswordForm'
import type { PasswordSetupToken } from '@/lib/types'

interface PageProps {
  params: { token: string }
}

export const metadata = {
  title: 'Définir mon mot de passe — MOSTRA',
}

export default async function SetupPasswordPage({ params }: PageProps) {
  const admin = createAdminClient()

  const { data: rawToken } = await admin
    .from('password_setup_tokens')
    .select('id, user_id, token, used_at, expires_at, created_at')
    .eq('token', params.token)
    .maybeSingle()

  const tokenRow = rawToken as PasswordSetupToken | null

  const isInvalid =
    !tokenRow || tokenRow.used_at !== null || new Date(tokenRow.expires_at) < new Date()

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-2">
          <Logo variant="full" color="white" className="h-10" />
          <p className="text-sm text-[#666666]">Production Management</p>
        </div>

        {/* Card */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-8">
          {isInvalid ? (
            <>
              <h1 className="text-xl font-semibold text-white mb-1">Lien invalide</h1>
              <p className="text-sm text-[#a0a0a0] mb-6">
                Ce lien a expiré ou a déjà été utilisé. Demande à ton interlocuteur Mostra de te
                générer un nouveau lien.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-lg text-sm font-medium border border-[#2a2a2a] text-[#a0a0a0] hover:text-white hover:border-[#444444] transition-colors"
              >
                Aller à la connexion
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-white mb-1">
                Définis ton mot de passe
              </h1>
              <p className="text-sm text-[#a0a0a0] mb-6">
                Choisis un mot de passe pour activer ton compte client Mostra.
              </p>
              <SetPasswordForm token={params.token} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
