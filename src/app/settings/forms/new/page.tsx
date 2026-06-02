import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getCurrentProfile } from '@/lib/auth'
import FormBuilder from '@/components/settings/FormBuilder'

export const metadata = { title: 'Nouveau template — MOSTRA' }

export default async function NewFormTemplatePage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/settings/forms"
          className="inline-flex items-center gap-1 text-xs text-[#555555] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour aux templates
        </Link>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-white">Nouveau template de formulaire</h2>
        <p className="text-xs text-[#555555] mt-0.5">
          Définissez les questions qui seront posées au client lors du brief.
        </p>
      </div>

      <FormBuilder />
    </div>
  )
}
