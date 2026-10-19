/**
 * Lecture du Cadrage d'un projet (migration 037).
 *
 * Le Cadrage est une grille « bento » : des colonnes (largeur sur 12), des
 * sections empilées dans chaque colonne, et des éléments dans chaque section.
 * Les éléments sans section forment « À trier », la boîte de réception de
 * l'admin — jamais renvoyée au client.
 *
 * Ce module ne fait aucune vérification d'accès : l'appelant passe un client
 * Supabase déjà autorisé (requireAdmin / requireProjectAccess, ou le client
 * admin après résolution du share_token).
 */

import type { createAdminClient } from '@/lib/supabase/admin'
import type { createClient } from '@/lib/supabase/server'
import type {
  BoardColumn,
  BoardItem,
  BoardItemKind,
  BoardSection,
  Json,
} from '@/lib/types'

type Client = ReturnType<typeof createClient> | ReturnType<typeof createAdminClient>

export const BOARD_BUCKET = 'project-files'
const SIGNED_URL_TTL = 3600

/** Élément prêt à afficher : les fichiers portent une URL signée (bucket privé). */
export interface BoardItemView extends Omit<BoardItem, 'content'> {
  content: Record<string, Json | undefined>
  /** URL signée (1 h) pour image / video / file, sinon null. */
  url: string | null
}

export interface BoardSectionView extends BoardSection {
  items: BoardItemView[]
}

export interface BoardColumnView extends BoardColumn {
  sections: BoardSectionView[]
}

export interface BoardView {
  columns: BoardColumnView[]
  /** « À trier » — vide (et non chargé) côté client. */
  inbox: BoardItemView[]
}

const FILE_KINDS: BoardItemKind[] = ['image', 'video', 'file']

export function isFileKind(kind: BoardItemKind): boolean {
  return FILE_KINDS.includes(kind)
}

async function withSignedUrls(storageClient: Client, items: BoardItem[]): Promise<BoardItemView[]> {
  const paths = items
    .filter((i) => isFileKind(i.kind))
    .map((i) => (i.content as { storage_path?: string } | null)?.storage_path)
    .filter((p): p is string => !!p)

  const urlByPath = new Map<string, string>()
  if (paths.length > 0) {
    const { data } = await storageClient.storage
      .from(BOARD_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL)
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) urlByPath.set(row.path, row.signedUrl)
    }
  }

  return items.map((i) => {
    const content = (i.content ?? {}) as Record<string, Json | undefined>
    const path = typeof content.storage_path === 'string' ? content.storage_path : null
    return { ...i, content, url: path ? urlByPath.get(path) ?? null : null }
  })
}

/**
 * Charge la grille complète d'un projet.
 * `withInbox` : à n'activer que pour l'admin.
 * `storageClient` : client utilisé pour signer les URLs (le client admin côté
 * lien public, où l'anonyme n'a pas accès au Storage).
 */
export async function loadBoard(
  client: Client,
  projectId: string,
  { withInbox, storageClient }: { withInbox: boolean; storageClient?: Client },
): Promise<BoardView> {
  const [{ data: rawColumns }, { data: rawSections }, { data: rawItems }] = await Promise.all([
    client
      .from('board_columns')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true }),
    client
      .from('board_sections')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true }),
    (() => {
      const q = client
        .from('board_items')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      // Défense en profondeur : la RLS masque déjà « À trier » au client, mais
      // le lien public lit via le client admin.
      return withInbox ? q : q.not('section_id', 'is', null)
    })(),
  ])

  const columns = (rawColumns as BoardColumn[] | null) ?? []
  const sections = (rawSections as BoardSection[] | null) ?? []
  const items = await withSignedUrls(storageClient ?? client, (rawItems as BoardItem[] | null) ?? [])

  const itemsBySection = new Map<string, BoardItemView[]>()
  const inbox: BoardItemView[] = []
  for (const item of items) {
    if (item.section_id) {
      const list = itemsBySection.get(item.section_id) ?? []
      list.push(item)
      itemsBySection.set(item.section_id, list)
    } else if (withInbox) {
      inbox.push(item)
    }
  }

  const sectionsByColumn = new Map<string, BoardSectionView[]>()
  for (const s of sections) {
    const list = sectionsByColumn.get(s.column_id) ?? []
    list.push({ ...s, items: itemsBySection.get(s.id) ?? [] })
    sectionsByColumn.set(s.column_id, list)
  }

  return {
    columns: columns.map((c) => ({ ...c, sections: sectionsByColumn.get(c.id) ?? [] })),
    // Les notes les plus récentes en premier : c'est une boîte de réception.
    inbox: inbox.reverse(),
  }
}
