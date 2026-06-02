'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'
import { FormTemplateSchema } from './schemas'

export type FormActionResult = { success: true; id?: string } | { success: false; error: string }

// ── createFormTemplate ────────────────────────────────────────────

export async function createFormTemplate(data: unknown): Promise<FormActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  const parsed = FormTemplateSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Données invalides' }

  const { name, description, questions } = parsed.data

  const { data: row, error } = await db(supabase)
    .from('form_templates')
    .insert({
      name,
      description: description || null,
      questions,
      is_default: false,
    })
    .select('id')
    .single()

  if (error || !row) return { success: false, error: error?.message ?? 'Erreur inconnue' }

  revalidatePath('/settings/forms')
  return { success: true, id: (row as { id: string }).id }
}

// ── updateFormTemplate ────────────────────────────────────────────

export async function updateFormTemplate(id: string, data: unknown): Promise<FormActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  const parsed = FormTemplateSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Données invalides' }

  const { name, description, questions } = parsed.data

  const { error } = await db(supabase)
    .from('form_templates')
    .update({ name, description: description || null, questions })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/forms')
  revalidatePath(`/settings/forms/${id}`)
  return { success: true }
}

// ── deleteFormTemplate ────────────────────────────────────────────

export async function deleteFormTemplate(id: string): Promise<FormActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  const { error } = await db(supabase).from('form_templates').delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/forms')
  return { success: true }
}

// ── duplicateFormTemplate ─────────────────────────────────────────

export async function duplicateFormTemplate(id: string): Promise<FormActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  const { data: rawTpl } = await supabase
    .from('form_templates')
    .select('name, description, questions')
    .eq('id', id)
    .maybeSingle()

  if (!rawTpl) return { success: false, error: 'Template introuvable' }
  const tpl = rawTpl as { name: string; description: string | null; questions: unknown[] }

  const { data: row, error } = await db(supabase)
    .from('form_templates')
    .insert({
      name: `${tpl.name} (copie)`,
      description: tpl.description,
      questions: tpl.questions,
      is_default: false,
    })
    .select('id')
    .single()

  if (error || !row) return { success: false, error: error?.message ?? 'Erreur inconnue' }

  revalidatePath('/settings/forms')
  return { success: true, id: (row as { id: string }).id }
}

// ── setDefaultFormTemplate ────────────────────────────────────────

export async function setDefaultFormTemplate(id: string): Promise<FormActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  await db(supabase)
    .from('form_templates')
    .update({ is_default: false })
    .neq('id', '00000000-0000-0000-0000-000000000000')

  const { error } = await db(supabase)
    .from('form_templates')
    .update({ is_default: true })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/forms')
  return { success: true }
}
