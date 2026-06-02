'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'

export type ActionResult = { success: true } | { success: false; error: string }

// ── updateAppSettings ────────────────────────────────────────────
// (Plus de notion d'agence — paramètres globaux Mostra)
// Pour l'instant, l'app n'a pas de table settings dédiée. Si besoin
// d'ajouter des paramètres globaux, créer une table `app_settings`.

export async function updateAppSettings(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  void formData
  // Placeholder — à implémenter selon les besoins
  revalidatePath('/settings')
  return { success: true }
}
