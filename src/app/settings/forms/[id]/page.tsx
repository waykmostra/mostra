import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/supabase/helpers'
import { getCurrentProfile } from '@/lib/auth'
import FormBuilder from '@/components/settings/FormBuilder'
import DeleteTemplateButton from '@/components/settings/DeleteTemplateButton'
import type { FormTemplate } from '@/lib/types'

interface EditFormTemplatePageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: EditFormTemplatePageProps) {
  const supabase = createClient()
  const { data } = await supabase
    .from('form_templates')
    .select('name')
    .eq('id', params.id)
    .maybeSingle()
  const name = (data as { name: string } | null)?.name ?? 'Template'
  return { title: `${name} — MOSTRA` }
}

export default async function EditFormTemplatePage({ params }: EditFormTemplatePageProps) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const { data: rawTpl } = await db(supabase)
    .from('form_templates')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!rawTpl) notFound()
  const tpl = rawTpl as FormTemplate

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

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-white">{tpl.name}</h2>
          <p className="text-xs text-[#555555] mt-0.5">
            Modifiez les questions et les paramètres de ce template.
          </p>
        </div>
      </div>

      <FormBuilder
        templateId={tpl.id}
        initialName={tpl.name}
        initialDescription={tpl.description ?? ''}
        initialQuestions={tpl.questions}
      />

      {/* Danger zone */}
      <div className="border border-red-500/20 rounded-2xl p-5 space-y-3">
        <p className="text-xs font-semibold text-red-400 uppercase tracking-widest">
          Zone dangereuse
        </p>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white">Supprimer ce template</p>
            <p className="text-xs text-[#555555] mt-0.5">
              Cette action est irréversible. Le template sera définitivement supprimé.
            </p>
          </div>
          <DeleteTemplateButton templateId={tpl.id} />
        </div>
      </div>
    </div>
  )
}
