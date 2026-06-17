/**
 * Logique du script en TABLEAU (repris du Mostra Compagnon, adapté à l'app).
 *
 * Modèle :
 *   • Colonnes taguées (texte / section / intention / voixoff=Narration / visuals / sfx).
 *     Seules les colonnes `voixoff` (non repliées) sont comptées en mots.
 *   • Catégories (Hook, Corps, CTA…) = groupes de lignes, colorées.
 *   • Lignes = une cellule par colonne. En base, chaque ligne est un phase_blocks
 *     (type `script_section`, content = ScriptRowContent) → son id ancre les commentaires.
 *
 * Le layout (colonnes/catégories/beats) vit sur la ligne `scripts` ; les lignes
 * vivent dans `phase_blocks`. `ensureTableModel` reconstitue le modèle d'édition
 * et migre l'ancien format « cartes » à la volée.
 */

import type {
  ColumnTag,
  ScriptColumn,
  ScriptCategory,
  ScriptBeat,
  ScriptRowContent,
} from '@/lib/types'

// ── Génération d'ids (stable, sans dépendance externe) ──────────────────────

let _seq = 0
function rid(prefix: string): string {
  _seq += 1
  return `${prefix}_${Date.now().toString(36)}_${_seq}_${Math.random().toString(36).slice(2, 5)}`
}
export const newColId = () => rid('col')
export const newCatId = () => rid('cat')
export const newBeatId = () => rid('beat')
export const newRowKey = () => rid('row')

// ── Tags de colonnes ────────────────────────────────────────────────────────

export interface ColumnTagInfo {
  id: ColumnTag
  label: string
  color: string
  counted: boolean
}

/** Le tag `voixoff` garde son id interne (compat) ; son libellé visible est « Narration ». */
export const COLUMN_TAGS: ColumnTagInfo[] = [
  { id: 'texte', label: 'Texte', color: '#9ca3af', counted: false },
  { id: 'section', label: 'Section', color: '#3B82F6', counted: false },
  { id: 'intention', label: 'Intention', color: '#A855F7', counted: false },
  { id: 'voixoff', label: 'Narration', color: '#00D76B', counted: true },
  { id: 'visuals', label: 'Visuals', color: '#06B6D4', counted: false },
  { id: 'sfx', label: 'SFX', color: '#F59E0B', counted: false },
]

export const tagInfo = (id: ColumnTag): ColumnTagInfo =>
  COLUMN_TAGS.find((t) => t.id === id) ?? COLUMN_TAGS[0]

// ── Couleurs de catégories ──────────────────────────────────────────────────

export const CATEGORY_COLORS = [
  '#00D76B', '#3B82F6', '#F59E0B', '#EF4444', '#A855F7', '#06B6D4', '#EC4899', '#9ca3af',
]
export const categoryColor = (i: number): string =>
  CATEGORY_COLORS[((i % CATEGORY_COLORS.length) + CATEGORY_COLORS.length) % CATEGORY_COLORS.length]

// ── Fabriques ───────────────────────────────────────────────────────────────

export const makeColumn = (title = '', tag: ColumnTag = 'texte'): ScriptColumn => ({
  id: newColId(),
  title,
  tag,
})
export const makeCategory = (name = 'Catégorie', color?: string): ScriptCategory => ({
  id: newCatId(),
  name,
  ...(color ? { color } : {}),
})
export const makeBeat = (title = 'Intention'): ScriptBeat => ({
  id: newBeatId(),
  title,
  note: '',
})

// ── Modèle d'édition ────────────────────────────────────────────────────────

/** Une ligne côté éditeur : `id` = phase_blocks.id (null tant que non sauvegardée). */
export interface EditorRow {
  /** Clé React stable (= id si en base, sinon clé temporaire). */
  _key: string
  /** phase_blocks.id — null tant que la ligne n'est pas en base (commentaires impossibles). */
  id: string | null
  categoryId: string
  cells: Record<string, string>
}

export interface TableModel {
  columns: ScriptColumn[]
  categories: ScriptCategory[]
  beats: ScriptBeat[]
  rows: EditorRow[]
}

/** Bloc tel que lu en base (content non typé : ancien ou nouveau format). */
export interface RawBlock {
  id: string
  content: unknown
  sort_order: number
}

export const makeRow = (categoryId: string, cells: Record<string, string> = {}): EditorRow => {
  const key = newRowKey()
  return { _key: key, id: null, categoryId, cells }
}

/** Layout par défaut d'un script neuf (utilisé à la création). */
export function defaultLayout(): { columns: ScriptColumn[]; categories: ScriptCategory[]; beats: ScriptBeat[] } {
  return {
    columns: [
      makeColumn('Narration', 'voixoff'),
      makeColumn('Visuals', 'visuals'),
      makeColumn('Intention', 'intention'),
    ],
    categories: [makeCategory('Hook', categoryColor(0))],
    beats: [],
  }
}

// ── Comptage de mots ────────────────────────────────────────────────────────

export function countWords(text: string | undefined | null): number {
  if (!text) return 0
  const trimmed = String(text).trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

const narrationCols = (columns: ScriptColumn[]): ScriptColumn[] =>
  columns.filter((c) => c.tag === 'voixoff' && !c.collapsed)

/** Total de mots = colonnes Narration (non repliées) sur toutes les lignes. */
export function tableWordCount(columns: ScriptColumn[], rows: EditorRow[]): number {
  const cols = narrationCols(columns)
  if (!cols.length) return 0
  let total = 0
  for (const row of rows) for (const c of cols) total += countWords(row.cells?.[c.id])
  return total
}

/** Mots de narration au sein d'une catégorie. */
export function categoryWordCount(columns: ScriptColumn[], rows: EditorRow[], categoryId: string): number {
  const cols = narrationCols(columns)
  let total = 0
  for (const row of rows) {
    if (row.categoryId !== categoryId) continue
    for (const c of cols) total += countWords(row.cells?.[c.id])
  }
  return total
}

// ── Migration / normalisation ───────────────────────────────────────────────

function isLegacyContent(c: unknown): c is { title?: string; content?: string; vo?: string; description?: string; color?: string } {
  return !!c && typeof c === 'object' && !('cells' in (c as Record<string, unknown>))
}

function inferTag(label: string): ColumnTag {
  const l = (label || '').toLowerCase()
  if (/(voix|voice|\bvo\b|narration)/.test(l)) return 'voixoff'
  if (/(intention|inten|idée|idee)/.test(l)) return 'intention'
  if (/(sfx|son|sound|bruit|audio|musique)/.test(l)) return 'sfx'
  if (/(visual|image|plan|cadre)/.test(l)) return 'visuals'
  if (/(section|partie|séquence|sequence)/.test(l)) return 'section'
  return 'texte'
}

/**
 * Reconstitue le modèle d'édition à partir du layout (ligne `scripts`) et des
 * blocs (`phase_blocks`). Migre l'ancien format « cartes » à la volée.
 *
 * - Layout présent (colonnes non vides) → on lit les lignes au nouveau format.
 * - Sinon, et des blocs existent → on dérive un tableau depuis l'ancien format
 *   (1 catégorie par titre de carte ; colonnes Narration / Texte / Intention).
 * - Sinon (script neuf vide) → tableau de départ.
 *
 * Les id de bloc sont préservés (= ancre des commentaires).
 */
export function ensureTableModel(
  layout: { columns?: ScriptColumn[] | null; categories?: ScriptCategory[] | null; beats?: ScriptBeat[] | null },
  blocks: RawBlock[],
): TableModel {
  const sorted = [...blocks].sort((a, b) => a.sort_order - b.sort_order)
  const beats = layout.beats ?? []

  // Cas 1 — layout déjà au format tableau.
  if (layout.columns && layout.columns.length > 0) {
    const columns = layout.columns
    let categories = layout.categories ?? []
    if (categories.length === 0) categories = [makeCategory('Catégorie 1', categoryColor(0))]
    const firstCatId = categories[0].id
    const catIds = new Set(categories.map((c) => c.id))

    const rows: EditorRow[] = sorted.map((b) => {
      const c = (b.content ?? {}) as Partial<ScriptRowContent>
      const categoryId = c.categoryId && catIds.has(c.categoryId) ? c.categoryId : firstCatId
      const cells = (c.cells && typeof c.cells === 'object' ? c.cells : {}) as Record<string, string>
      return { _key: b.id, id: b.id, categoryId, cells }
    })
    if (rows.length === 0) rows.push(makeRow(firstCatId))
    return { columns, categories, beats, rows }
  }

  // Cas 3 — script neuf, aucun bloc.
  if (sorted.length === 0) {
    const base = defaultLayout()
    return { ...base, beats, rows: [makeRow(base.categories[0].id)] }
  }

  // Cas 2 — migration de l'ancien format « cartes ».
  const colNarration = makeColumn('Narration', 'voixoff')
  const colTexte = makeColumn('Texte', 'texte')
  const colIntention = makeColumn('Intention', 'intention')
  const columns = [colNarration, colTexte, colIntention]

  const categories: ScriptCategory[] = []
  const catByTitle = new Map<string, ScriptCategory>()
  const rows: EditorRow[] = []

  for (const b of sorted) {
    const legacy = isLegacyContent(b.content) ? b.content : {}
    const title = (legacy.title || '').trim() || 'Section'
    const key = title.toLowerCase()
    let cat = catByTitle.get(key)
    if (!cat) {
      cat = makeCategory(title, categoryColor(categories.length))
      catByTitle.set(key, cat)
      categories.push(cat)
    }
    rows.push({
      _key: b.id,
      id: b.id,
      categoryId: cat.id,
      cells: {
        [colNarration.id]: legacy.vo || '',
        [colTexte.id]: legacy.content || '',
        [colIntention.id]: legacy.description || '',
      },
    })
  }

  if (categories.length === 0) categories.push(makeCategory('Catégorie 1', categoryColor(0)))
  return { columns, categories, beats, rows }
}

/** Sérialise une ligne d'édition vers le `content` d'un phase_blocks. */
export function rowContent(row: EditorRow): ScriptRowContent {
  return { categoryId: row.categoryId, cells: row.cells }
}

/** Y a-t-il du texte saisi dans au moins une cellule ? */
export function hasAnyContent(rows: EditorRow[]): boolean {
  return rows.some((r) => Object.values(r.cells || {}).some((v) => (v || '').trim()))
}
