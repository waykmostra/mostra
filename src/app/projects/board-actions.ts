'use server'

/**
 * Actions du Cadrage (migration 037) — réservées à l'admin.
 * Le client lit et commente ; il ne compose jamais la grille.
 *
 * Chaque action vérifie que les objets touchés appartiennent au même projet
 * (une section ne peut pas être déplacée dans la colonne d'un autre projet).
 */

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/supabase/helpers'
import { BOARD_BUCKET, isFileKind } from '@/lib/board'
import type {
  BoardColumn,
  BoardItem,
  BoardItemKind,
  BoardLinkContent,
  BoardSection,
  BoardSectionType,
} from '@/lib/types'

export type BoardActionResult = { success: true } | { success: false; error: string }
export type BoardCreateResult = { success: true; id: string } | { success: false; error: string }

type ServerClient = ReturnType<typeof createClient>

const SECTION_TYPES: BoardSectionType[] = ['media', 'text', 'documents']
const MAX_FILE_SIZE = 500 * 1024 * 1024

function revalidateBoard(projectId: string) {
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/cadrage`)
}

/** Prochain sort_order d'une liste (max + 1). */
async function nextOrder(
  supabase: ServerClient,
  table: 'board_columns' | 'board_sections' | 'board_items',
  column: 'project_id' | 'column_id' | 'section_id',
  value: string,
): Promise<number> {
  const { data } = await supabase
    .from(table)
    .select('sort_order')
    .eq(column, value)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  return ((data as { sort_order: number } | null)?.sort_order ?? 0) + 1
}

// ── Colonnes ──────────────────────────────────────────────────────

export async function addBoardColumn(projectId: string, width = 6): Promise<BoardCreateResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  const sort_order = await nextOrder(supabase, 'board_columns', 'project_id', projectId)
  const { data, error } = await db(supabase)
    .from('board_columns')
    .insert({ project_id: projectId, width: clampWidth(width), sort_order })
    .select('id')
    .single()
  if (error || !data) return { success: false, error: error?.message ?? 'Colonne non créée' }

  revalidateBoard(projectId)
  return { success: true, id: (data as { id: string }).id }
}

export async function updateBoardColumnWidth(columnId: string, width: number): Promise<BoardActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  const { data, error } = await db(supabase)
    .from('board_columns')
    .update({ width: clampWidth(width) })
    .eq('id', columnId)
    .select('project_id')
    .single()
  if (error || !data) return { success: false, error: error?.message ?? 'Colonne introuvable' }

  revalidateBoard((data as { project_id: string }).project_id)
  return { success: true }
}

/**
 * Fixe plusieurs largeurs d'un coup : déplacer la frontière entre deux
 * colonnes grandit l'une et réduit l'autre (les largeurs sont des poids).
 */
export async function setBoardColumnWidths(
  projectId: string,
  widths: { id: string; width: number }[],
): Promise<BoardActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  const { data } = await supabase.from('board_columns').select('id').eq('project_id', projectId)
  const owned = new Set(((data as { id: string }[] | null) ?? []).map((c) => c.id))
  if (widths.some((w) => !owned.has(w.id))) return { success: false, error: 'Colonne étrangère au projet' }

  const results = await Promise.all(
    widths.map((w) => db(supabase).from('board_columns').update({ width: clampWidth(w.width) }).eq('id', w.id)),
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) return { success: false, error: failed.error.message }

  revalidateBoard(projectId)
  return { success: true }
}

/** Supprime une colonne. Ses sections partent avec ; leurs éléments retombent dans « À trier ». */
export async function deleteBoardColumn(columnId: string): Promise<BoardActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  const { data, error } = await supabase
    .from('board_columns')
    .delete()
    .eq('id', columnId)
    .select('project_id')
    .single()
  if (error || !data) return { success: false, error: error?.message ?? 'Colonne introuvable' }

  revalidateBoard((data as { project_id: string }).project_id)
  return { success: true }
}

export async function reorderBoardColumns(projectId: string, orderedIds: string[]): Promise<BoardActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  const { data } = await supabase.from('board_columns').select('id').eq('project_id', projectId)
  const owned = new Set(((data as { id: string }[] | null) ?? []).map((c) => c.id))
  if (orderedIds.some((id) => !owned.has(id))) return { success: false, error: 'Colonne étrangère au projet' }

  const results = await Promise.all(
    orderedIds.map((id, idx) =>
      db(supabase).from('board_columns').update({ sort_order: idx + 1 }).eq('id', id),
    ),
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) return { success: false, error: failed.error.message }

  revalidateBoard(projectId)
  return { success: true }
}

/**
 * Pose une première mise en page sur un Cadrage vide : de quoi démarrer le R3
 * sans partir d'une page blanche. Tout reste modifiable ensuite.
 */
export async function seedBoardTemplate(projectId: string): Promise<BoardActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  const { count } = await supabase
    .from('board_columns')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
  if ((count ?? 0) > 0) return { success: false, error: 'Le Cadrage a déjà une mise en page' }

  const layout: { width: number; sections: { type: BoardSectionType; title: string }[] }[] = [
    {
      width: 8,
      sections: [
        { type: 'text', title: 'Objectif et message clé' },
        { type: 'media', title: 'Références visuelles' },
      ],
    },
    {
      width: 4,
      sections: [
        { type: 'text', title: 'Décisions' },
        { type: 'documents', title: 'Liens et documents' },
      ],
    },
  ]

  for (const [ci, col] of layout.entries()) {
    const { data: rawCol, error } = await db(supabase)
      .from('board_columns')
      .insert({ project_id: projectId, width: col.width, sort_order: ci + 1 })
      .select('id')
      .single()
    if (error || !rawCol) return { success: false, error: error?.message ?? 'Colonne non créée' }
    const columnId = (rawCol as { id: string }).id

    const { error: secErr } = await db(supabase)
      .from('board_sections')
      .insert(
        col.sections.map((s, si) => ({
          project_id: projectId,
          column_id: columnId,
          type: s.type,
          title: s.title,
          sort_order: si + 1,
        })),
      )
    if (secErr) return { success: false, error: secErr.message }
  }

  revalidateBoard(projectId)
  return { success: true }
}

// ── Sections ──────────────────────────────────────────────────────

export async function addBoardSection(
  columnId: string,
  type: BoardSectionType,
  title?: string,
): Promise<BoardCreateResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  if (!SECTION_TYPES.includes(type)) return { success: false, error: 'Type de section invalide' }

  const { data: rawCol } = await supabase
    .from('board_columns')
    .select('id, project_id')
    .eq('id', columnId)
    .maybeSingle()
  const col = rawCol as Pick<BoardColumn, 'id' | 'project_id'> | null
  if (!col) return { success: false, error: 'Colonne introuvable' }

  const sort_order = await nextOrder(supabase, 'board_sections', 'column_id', columnId)
  const { data, error } = await db(supabase)
    .from('board_sections')
    .insert({
      project_id: col.project_id,
      column_id: columnId,
      type,
      title: title?.trim() || null,
      sort_order,
    })
    .select('id')
    .single()
  if (error || !data) return { success: false, error: error?.message ?? 'Section non créée' }

  revalidateBoard(col.project_id)
  return { success: true, id: (data as { id: string }).id }
}

export async function updateBoardSection(
  sectionId: string,
  patch: { title?: string | null; height?: number | null },
): Promise<BoardActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  const update: Record<string, unknown> = {}
  if (patch.title !== undefined) update.title = patch.title?.trim() || null
  if (patch.height !== undefined) {
    update.height = patch.height === null ? null : Math.min(2000, Math.max(80, Math.round(patch.height)))
  }

  const { data, error } = await db(supabase)
    .from('board_sections')
    .update(update)
    .eq('id', sectionId)
    .select('project_id')
    .single()
  if (error || !data) return { success: false, error: error?.message ?? 'Section introuvable' }

  revalidateBoard((data as { project_id: string }).project_id)
  return { success: true }
}

/** Supprime une section. Ses éléments retombent dans « À trier » (rien n'est perdu). */
export async function deleteBoardSection(sectionId: string): Promise<BoardActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  const { data, error } = await supabase
    .from('board_sections')
    .delete()
    .eq('id', sectionId)
    .select('project_id')
    .single()
  if (error || !data) return { success: false, error: error?.message ?? 'Section introuvable' }

  revalidateBoard((data as { project_id: string }).project_id)
  return { success: true }
}

/**
 * Range les sections d'une colonne dans l'ordre donné. Sert aussi au
 * déplacement d'une section vers une autre colonne (elle y est rattachée).
 */
export async function arrangeBoardSections(columnId: string, orderedIds: string[]): Promise<BoardActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  const { data: rawCol } = await supabase
    .from('board_columns')
    .select('id, project_id')
    .eq('id', columnId)
    .maybeSingle()
  const col = rawCol as Pick<BoardColumn, 'id' | 'project_id'> | null
  if (!col) return { success: false, error: 'Colonne introuvable' }

  if (orderedIds.length > 0) {
    const { data } = await supabase.from('board_sections').select('id, project_id').in('id', orderedIds)
    const rows = (data as Pick<BoardSection, 'id' | 'project_id'>[] | null) ?? []
    if (rows.length !== orderedIds.length || rows.some((r) => r.project_id !== col.project_id)) {
      return { success: false, error: 'Section étrangère au projet' }
    }
  }

  const results = await Promise.all(
    orderedIds.map((id, idx) =>
      db(supabase).from('board_sections').update({ column_id: columnId, sort_order: idx + 1 }).eq('id', id),
    ),
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) return { success: false, error: failed.error.message }

  revalidateBoard(col.project_id)
  return { success: true }
}

// ── Éléments ──────────────────────────────────────────────────────

/** Vérifie qu'une section (ou « À trier » si null) appartient bien au projet. */
async function assertSectionInProject(
  supabase: ServerClient,
  projectId: string,
  sectionId: string | null,
): Promise<string | null> {
  if (!sectionId) return null
  const { data } = await supabase.from('board_sections').select('project_id').eq('id', sectionId).maybeSingle()
  const row = data as { project_id: string } | null
  if (!row) return 'Section introuvable'
  if (row.project_id !== projectId) return 'Section étrangère au projet'
  return null
}

/**
 * Ajoute un bloc de texte. `sectionId` null = « À trier » (le bouton Noter).
 */
export async function addBoardText(
  projectId: string,
  sectionId: string | null,
  text: string,
): Promise<BoardCreateResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase, user } = auth

  const bad = await assertSectionInProject(supabase, projectId, sectionId)
  if (bad) return { success: false, error: bad }

  return insertItem(supabase, user.id, projectId, sectionId, 'text', { text })
}

/** Ajoute un lien ou une référence. `sectionId` null = « À trier ». */
export async function addBoardLink(
  projectId: string,
  sectionId: string | null,
  link: BoardLinkContent,
): Promise<BoardCreateResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase, user } = auth

  const url = normalizeUrl(link.url)
  if (!url) return { success: false, error: 'Lien invalide' }

  const bad = await assertSectionInProject(supabase, projectId, sectionId)
  if (bad) return { success: false, error: bad }

  return insertItem(supabase, user.id, projectId, sectionId, 'link', {
    url,
    title: link.title?.trim() || undefined,
    note: link.note?.trim() || undefined,
  })
}

/**
 * Upload d'un fichier (FormData : projectId, sectionId?, file, caption?).
 * Le type d'élément se déduit du MIME : image, vidéo ou fichier.
 */
export async function uploadBoardFile(formData: FormData): Promise<BoardCreateResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase, user } = auth

  const projectId = formData.get('projectId') as string | null
  const sectionId = (formData.get('sectionId') as string | null) || null
  const caption = ((formData.get('caption') as string | null) ?? '').trim()
  const file = formData.get('file') as File | null

  if (!projectId) return { success: false, error: 'Projet manquant' }
  if (!file || file.size === 0) return { success: false, error: 'Fichier requis' }
  if (file.size > MAX_FILE_SIZE) return { success: false, error: 'Fichier trop lourd — 500 MB maximum' }

  const bad = await assertSectionInProject(supabase, projectId, sectionId)
  if (bad) return { success: false, error: bad }

  const kind: BoardItemKind = file.type.startsWith('image/')
    ? 'image'
    : file.type.startsWith('video/')
      ? 'video'
      : 'file'

  const admin = createAdminClient()
  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const storagePath = `${projectId}/cadrage/${crypto.randomUUID()}.${ext}`

  const { error: uploadErr } = await admin.storage
    .from(BOARD_BUCKET)
    .upload(storagePath, await file.arrayBuffer(), {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
  if (uploadErr) return { success: false, error: `Upload échoué : ${uploadErr.message}` }

  const res = await insertItem(supabase, user.id, projectId, sectionId, kind, {
    storage_path: storagePath,
    file_name: file.name,
    ...(caption ? { caption } : {}),
  })
  // Pas d'élément → pas de fichier orphelin dans le bucket.
  if (!res.success) await admin.storage.from(BOARD_BUCKET).remove([storagePath])
  return res
}

/** Modifie le contenu d'un élément (texte, légende, titre/note d'un lien). */
export async function updateBoardItem(
  itemId: string,
  patch: { text?: string; caption?: string; title?: string; note?: string; url?: string; w?: number },
): Promise<BoardActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  const { data: raw } = await supabase.from('board_items').select('*').eq('id', itemId).maybeSingle()
  const item = raw as BoardItem | null
  if (!item) return { success: false, error: 'Élément introuvable' }

  const content = { ...((item.content ?? {}) as Record<string, unknown>) }
  if (item.kind === 'text' && patch.text !== undefined) content.text = patch.text
  if (isFileKind(item.kind) && patch.caption !== undefined) content.caption = patch.caption.trim() || undefined
  // Largeur d'un média dans sa section, sur une base de 6 (voir BoardMediaGrid).
  if (patch.w !== undefined) content.w = Math.min(6, Math.max(1, Math.round(patch.w)))
  if (item.kind === 'link') {
    if (patch.url !== undefined) {
      const url = normalizeUrl(patch.url)
      if (!url) return { success: false, error: 'Lien invalide' }
      content.url = url
    }
    if (patch.title !== undefined) content.title = patch.title.trim() || undefined
    if (patch.note !== undefined) content.note = patch.note.trim() || undefined
  }

  const { error } = await db(supabase).from('board_items').update({ content }).eq('id', itemId)
  if (error) return { success: false, error: error.message }

  revalidateBoard(item.project_id)
  return { success: true }
}

export async function deleteBoardItem(itemId: string): Promise<BoardActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  const { data: raw } = await supabase.from('board_items').select('*').eq('id', itemId).maybeSingle()
  const item = raw as BoardItem | null
  if (!item) return { success: false, error: 'Élément introuvable' }

  const { error } = await supabase.from('board_items').delete().eq('id', itemId)
  if (error) return { success: false, error: error.message }

  const path = (item.content as { storage_path?: string } | null)?.storage_path
  if (isFileKind(item.kind) && path) {
    await createAdminClient().storage.from(BOARD_BUCKET).remove([path])
  }

  revalidateBoard(item.project_id)
  return { success: true }
}

/**
 * Range les éléments d'une section (ou de « À trier » si null) dans l'ordre
 * donné. Sert aussi à sortir une note de « À trier » pour la mettre en page.
 */
export async function arrangeBoardItems(
  projectId: string,
  sectionId: string | null,
  orderedIds: string[],
): Promise<BoardActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  const bad = await assertSectionInProject(supabase, projectId, sectionId)
  if (bad) return { success: false, error: bad }

  if (orderedIds.length > 0) {
    const { data } = await supabase.from('board_items').select('id, project_id').in('id', orderedIds)
    const rows = (data as Pick<BoardItem, 'id' | 'project_id'>[] | null) ?? []
    if (rows.length !== orderedIds.length || rows.some((r) => r.project_id !== projectId)) {
      return { success: false, error: 'Élément étranger au projet' }
    }
  }

  const results = await Promise.all(
    orderedIds.map((id, idx) =>
      db(supabase).from('board_items').update({ section_id: sectionId, sort_order: idx + 1 }).eq('id', id),
    ),
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) return { success: false, error: failed.error.message }

  revalidateBoard(projectId)
  return { success: true }
}

/** Range un élément en fin de section (ou le renvoie dans « À trier » si null). */
export async function moveBoardItem(itemId: string, sectionId: string | null): Promise<BoardActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  const { data: raw } = await supabase.from('board_items').select('id, project_id').eq('id', itemId).maybeSingle()
  const item = raw as Pick<BoardItem, 'id' | 'project_id'> | null
  if (!item) return { success: false, error: 'Élément introuvable' }

  const bad = await assertSectionInProject(supabase, item.project_id, sectionId)
  if (bad) return { success: false, error: bad }

  const sort_order = sectionId ? await nextOrder(supabase, 'board_items', 'section_id', sectionId) : 0
  const { error } = await db(supabase)
    .from('board_items')
    .update({ section_id: sectionId, sort_order })
    .eq('id', itemId)
  if (error) return { success: false, error: error.message }

  revalidateBoard(item.project_id)
  return { success: true }
}

// ── Utilitaires ───────────────────────────────────────────────────

async function insertItem(
  supabase: ServerClient,
  userId: string,
  projectId: string,
  sectionId: string | null,
  kind: BoardItemKind,
  content: Record<string, unknown>,
): Promise<BoardCreateResult> {
  // « À trier » est trié par date : pas besoin d'ordre explicite.
  const sort_order = sectionId ? await nextOrder(supabase, 'board_items', 'section_id', sectionId) : 0

  const { data, error } = await db(supabase)
    .from('board_items')
    .insert({ project_id: projectId, section_id: sectionId, kind, content, sort_order, created_by: userId })
    .select('id')
    .single()
  if (error || !data) return { success: false, error: error?.message ?? 'Élément non créé' }

  revalidateBoard(projectId)
  return { success: true, id: (data as { id: string }).id }
}

function clampWidth(width: number): number {
  return Math.min(12, Math.max(1, Math.round(width)))
}

/** Accepte « exemple.com » comme « https://exemple.com ». Refuse tout sauf http(s). */
function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}
