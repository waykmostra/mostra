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
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-2">
          <Logo variant="full" className="h-10" />
          <p className="text-sm text-faint">Production Management</p>
        </div>

        {/* Card */}
        <div className="bg-surface-2 border border-line rounded-xl p-8">
          {isInvalid ? (
            <>
              <h1 className="text-xl font-semibold text-ink mb-1">Lien invalide</h1>
              <p className="text-sm text-dim mb-6">
                Ce lien a expiré ou a déjà été utilisé. Demande à ton interlocuteur Mostra de te
                générer un nouveau lien.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-lg text-sm font-medium border border-line text-dim hover:text-ink hover:border-line-strong transition-colors"
              >
                Aller à la connexion
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-ink mb-1">
                Définis ton mot de passe
              </h1>
              <p className="text-sm text-dim mb-6">
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
