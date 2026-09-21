/**
 * Fichier de script portable — le format d'échange entre Mostra Compagnon et
 * Mostra App. Même contrat que `src/lib/scriptFile.js` côté Compagnon : un
 * `.mostrascript` est du JSON UTF-8 qui transporte sections, colonnes, lignes
 * et beats.
 *
 *   { format: "mostra.script", version: 1, app, exportedAt,
 *     script: { name, columns, categories, rows: [{ id, categoryId, cells }], beats } }
 *
 * Les ids n'ont de sens qu'à l'intérieur d'un fichier (une ligne pointe vers sa
 * colonne et sa catégorie par id) : on les garde tels quels à l'import.
 */

import { categoryColor, makeCategory, makeColumn } from '@/lib/scriptTable'
import type { ColumnTag, ScriptBeat, ScriptCategory, ScriptColumn } from '@/lib/types'

export const SCRIPT_FILE_FORMAT = 'mostra.script'
export const SCRIPT_FILE_EXT = 'mostrascript'

const TAGS: ColumnTag[] = ['texte', 'section', 'intention', 'voixoff', 'visuals', 'sfx']

export interface ImportedScript {
  name: string
  columns: ScriptColumn[]
  categories: ScriptCategory[]
  beats: ScriptBeat[]
  rows: { categoryId: string; cells: Record<string, string> }[]
}

type Loose = Record<string, unknown>
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)

/**
 * Relit un fichier exporté. Lève une erreur au message affichable tel quel
 * quand le fichier n'est pas un script Mostra. Un fichier d'une version future
 * est lu au mieux plutôt que refusé : le format ne fait qu'ajouter des clés.
 */
export function parseScriptFile(text: string): ImportedScript {
  let data: Loose
  try {
    data = JSON.parse(text) as Loose
  } catch {
    throw new Error('Ce fichier n’est pas un script Mostra (JSON illisible).')
  }
  if (!data || data.format !== SCRIPT_FILE_FORMAT) {
    throw new Error('Ce fichier n’est pas un script Mostra.')
  }
  const s = (data.script ?? {}) as Loose

  const rawColumns = Array.isArray(s.columns) ? (s.columns as Loose[]) : []
  const columns: ScriptColumn[] = rawColumns.length
    ? rawColumns.map((c) => {
        const tag = TAGS.includes(c.tag as ColumnTag) ? (c.tag as ColumnTag) : 'texte'
        const base = makeColumn(str(c.title), tag)
        return {
          ...base,
          id: str(c.id, base.id),
          ...(typeof c.width === 'number' ? { width: c.width } : {}),
          ...(c.collapsed === true ? { collapsed: true } : {}),
        } as ScriptColumn
      })
    : [makeColumn('Narration', 'voixoff')]

  const rawCategories = Array.isArray(s.categories) ? (s.categories as Loose[]) : []
  const categories: ScriptCategory[] = rawCategories.length
    ? rawCategories.map((c, i) => {
        const base = makeCategory(str(c.name, 'Section'), str(c.color) || categoryColor(i))
        return { ...base, id: str(c.id, base.id) }
      })
    : [makeCategory('Section 1', categoryColor(0))]

  const validCats = new Set(categories.map((c) => c.id))
  const validCols = new Set(columns.map((c) => c.id))

  const rows = (Array.isArray(s.rows) ? (s.rows as Loose[]) : []).map((r) => {
    const cells: Record<string, string> = {}
    for (const [colId, value] of Object.entries((r.cells ?? {}) as Loose)) {
      if (validCols.has(colId) && typeof value === 'string') cells[colId] = value
    }
    // Une ligne qui pointe vers une section absente du fichier rejoint la
    // première au lieu de disparaître.
    const categoryId = validCats.has(str(r.categoryId)) ? str(r.categoryId) : categories[0].id
    return { categoryId, cells }
  })

  const beats: ScriptBeat[] = (Array.isArray(s.beats) ? (s.beats as Loose[]) : []).map((b, i) => ({
    id: str(b.id, `beat_import_${i}`),
    title: str(b.title),
    note: str(b.note),
  }))

  return {
    name: str(s.name).trim() || 'Script importé',
    columns,
    categories,
    beats,
    rows: rows.length ? rows : [{ categoryId: categories[0].id, cells: {} }],
  }
}

/** Ajoute un paramètre à un chemin qui en porte peut-être déjà (`?sub=…`). */
export function withParam(path: string, key: string, value: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(value)}`
}
