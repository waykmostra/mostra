import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, FileText, Star, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/supabase/helpers'
import { getCurrentProfile } from '@/lib/auth'
import FormTemplateActions from '@/components/settings/FormTemplateActions'
import type { FormTemplate } from '@/lib/types'

export default async function FormsSettingsPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const { data: rawTemplates } = await db(supabase)
    .from('form_templates')
    .select('*')
    .order('created_at', { ascending: false })

  const templates: FormTemplate[] = (rawTemplates ?? []) as FormTemplate[]

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Templates de formulaires</h2>
          <p className="text-xs text-[#555555] mt-0.5">
            Créez des formulaires de brief réutilisables pour vos projets.
          </p>
        </div>
        <Link
          href="/settings/forms/new"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#00D76B] text-black text-xs font-semibold hover:bg-[#00D76B]/90 transition-colors flex-shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Nouveau template
        </Link>
      </div>

      {/* Empty state */}
      {templates.length === 0 && (
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center mx-auto">
            <FileText className="h-5 w-5 text-[#333333]" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Aucun template</p>
            <p className="text-xs text-[#555555] mt-1">
              Créez votre premier template de formulaire de brief.
            </p>
          </div>
          <Link
            href="/settings/forms/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00D76B] text-black text-xs font-semibold hover:bg-[#00D76B]/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Créer un template
          </Link>
        </div>
      )}

      {/* Template list */}
      {templates.length > 0 && (
        <div className="space-y-2">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="group bg-[#111111] border border-[#2a2a2a] rounded-xl px-4 py-3.5 flex items-center gap-4 hover:border-[#333333] transition-colors"
            >
              {/* Icon */}
              <div className="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0">
                <FileText className="h-4 w-4 text-[#555555]" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white truncate">{tpl.name}</span>
                  {tpl.is_default && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-[#F59E0B] border border-[#F59E0B]/30 bg-[#F59E0B]/10 rounded px-1.5 py-0.5 flex-shrink-0">
                      <Star className="h-2.5 w-2.5" />
                      Par défaut
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {tpl.description && (
                    <span className="text-xs text-[#444444] truncate">{tpl.description}</span>
                  )}
                  <span className="text-xs text-[#333333] flex-shrink-0">
                    {tpl.questions.length} question{tpl.questions.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-[#333333] flex-shrink-0">
                    Modifié le {formatDate(tpl.updated_at)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link
                  href={`/settings/forms/${tpl.id}`}
                  className="p-1.5 rounded-lg text-[#444444] hover:text-white hover:bg-[#1a1a1a] transition-colors"
                  title="Modifier"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Link>
                <FormTemplateActions templateId={tpl.id} isDefault={tpl.is_default} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
