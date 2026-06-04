'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Loader2, Check, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import AutoGrowTextarea from '@/components/shared/AutoGrowTextarea'
import type { DataColumn, DataColumnType, DataNumberFormat, DataEntry, DataSet, DataValue } from '@/lib/types'
import { COLUMN_TYPE_META, NUMBER_FORMAT_META, SET_COLORS, categoryColor, displayCell, numberUnit } from './dataMeta'
import DataCharts from './DataCharts'
import {
  renameSet,
  recolorSet,
  deleteSet,
  addColumn,
  updateColumn,
  deleteColumn,
  addEntry,
  updateEntry,
  deleteEntry,
} from './actions'

const field =
  'w-full bg-[#1a1a1a] border border-[#333333] rounded-md px-3 py-2 text-sm text-white placeholder-[#444444] focus:outline-none focus:border-[#555555]'

const COLUMN_TYPES: DataColumnType[] = ['number', 'category', 'text']

export default function DataSetClient({
  set,
  columns,
  entries,
}: {
  set: DataSet
  columns: DataColumn[]
  entries: DataEntry[]
}) {
  const router = useRouter()
  const refresh = () => router.refresh()
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)

  return (
    <div className="space-y-6 max-w-5xl">
      <Link href="/founder/data" className="inline-flex items-center gap-1.5 text-xs text-[#666666] hover:text-white transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        Data
      </Link>

      <SetHeader set={set} onChanged={refresh} />

      <ColumnsBar columns={columns} setId={set.id} onChanged={refresh} />

      {columns.length === 0 ? (
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-10 flex flex-col items-center gap-2">
          <p className="text-sm text-[#666666] text-center">
            Ajoute une première colonne (Nombre, Catégorie ou Texte) pour commencer à saisir des données.
          </p>
        </div>
      ) : (
        <>
          {editingEntryId === null && <EntryForm key="add" setId={set.id} columns={columns} onDone={refresh} />}

          <EntriesTable
            columns={columns}
            entries={entries}
            setId={set.id}
            editingId={editingEntryId}
            setEditingId={setEditingEntryId}
            onChanged={refresh}
          />

          <DataCharts columns={columns} entries={entries} accent={set.color} />
        </>
      )}
    </div>
  )
}

// ── En-tête de la base ────────────────────────────────────────────────────────

function SetHeader({ set, onChanged }: { set: DataSet; onChanged: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(set.name)
  const [showColors, setShowColors] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function saveName() {
    const clean = name.trim()
    if (!clean) return toast.error('Le nom de la base est requis.')
    if (clean === set.name) { setEditing(false); return }
    startTransition(async () => {
      const res = await renameSet(set.id, clean)
      if (!res.success) { toast.error(res.error); return }
      setEditing(false)
      onChanged()
    })
  }

  function pickColor(c: string) {
    setShowColors(false)
    startTransition(async () => {
      const res = await recolorSet(set.id, c)
      if (!res.success) { toast.error(res.error); return }
      onChanged()
    })
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteSet(set.id)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Base supprimée')
      router.push('/founder/data')
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); saveName() }
                if (e.key === 'Escape') { setName(set.name); setEditing(false) }
              }}
              className={`${field} max-w-sm`}
            />
            <button onClick={saveName} disabled={isPending} className="w-8 h-8 flex items-center justify-center rounded-md text-[#00D76B] hover:bg-[#00D76B]/10">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </button>
            <button onClick={() => { setName(set.name); setEditing(false) }} className="w-8 h-8 flex items-center justify-center rounded-md text-[#888888] hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button onClick={() => setShowColors((v) => !v)} className="flex items-center gap-2.5" title="Changer la couleur">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: set.color }} />
            <h1 className="text-xl font-bold text-white">{set.name}</h1>
          </button>
        )}

        {!editing && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => { setName(set.name); setEditing(true) }} aria-label="Renommer" className="w-7 h-7 flex items-center justify-center rounded-md text-[#555555] hover:text-white hover:bg-[#1a1a1a] transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {confirmDelete ? (
              <span className="inline-flex items-center gap-1">
                <button onClick={remove} disabled={isPending} className="px-2 py-1 rounded text-[10px] font-medium bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20">
                  {isPending ? '…' : 'Supprimer la base'}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 rounded text-[10px] text-[#888888] hover:text-white">Annuler</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDelete(true)} aria-label="Supprimer la base" className="w-7 h-7 flex items-center justify-center rounded-md text-[#555555] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {showColors && !editing && (
        <div className="flex items-center gap-1.5 pl-1">
          {SET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => pickColor(c)}
              aria-label={`Couleur ${c}`}
              className="w-5 h-5 rounded-full transition-transform hover:scale-110"
              style={{ backgroundColor: c, outline: set.color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Barre des colonnes ────────────────────────────────────────────────────────

function ColumnsBar({ columns, setId, onChanged }: { columns: DataColumn[]; setId: string; onChanged: () => void }) {
  // null = fermé · 'new' = ajout · DataColumn = édition d'une colonne existante
  const [editing, setEditing] = useState<DataColumn | 'new' | null>(null)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {columns.map((col) => (
          <ColumnChip key={col.id} col={col} setId={setId} onEdit={() => setEditing(col)} onChanged={onChanged} />
        ))}
        <button
          onClick={() => setEditing((e) => (e === 'new' ? null : 'new'))}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-dashed border-[#2a2a2a] text-[#666666] hover:text-white hover:border-[#3a3a3a] transition-colors"
        >
          <Plus className="h-3 w-3" />
          Colonne
        </button>
      </div>

      {editing !== null && (
        <ColumnForm
          key={editing === 'new' ? 'new' : editing.id}
          setId={setId}
          column={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onChanged={onChanged}
        />
      )}
    </div>
  )
}

function ColumnChip({
  col,
  setId,
  onEdit,
  onChanged,
}: {
  col: DataColumn
  setId: string
  onEdit: () => void
  onChanged: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState(false)
  const meta = COLUMN_TYPE_META[col.type]
  const unit = col.type === 'number' ? numberUnit(col) : ''

  function remove() {
    startTransition(async () => {
      const res = await deleteColumn(col.id, setId)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Colonne supprimée')
      onChanged()
    })
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs bg-[#141414] border border-[#262626]">
      <span className="font-medium text-white">{col.name}</span>
      <span className="text-[9px] font-medium px-1 py-0.5 rounded" style={{ color: meta.color, backgroundColor: `${meta.color}1a` }}>
        {meta.label}{unit ? ` ${unit}` : ''}
      </span>
      {confirm ? (
        <>
          <button onClick={remove} disabled={isPending} className="text-[#EF4444] hover:opacity-80 text-[10px] font-medium">{isPending ? '…' : 'Oui'}</button>
          <button onClick={() => setConfirm(false)} className="text-[#888888] hover:text-white text-[10px]">Non</button>
        </>
      ) : (
        <>
          <button onClick={onEdit} aria-label="Éditer la colonne" className="text-[#555555] hover:text-white transition-colors">
            <Pencil className="h-3 w-3" />
          </button>
          <button onClick={() => setConfirm(true)} aria-label="Supprimer la colonne" className="text-[#555555] hover:text-[#EF4444] transition-colors">
            <X className="h-3 w-3" />
          </button>
        </>
      )}
    </span>
  )
}

function ColumnForm({
  setId,
  column,
  onClose,
  onChanged,
}: {
  setId: string
  column?: DataColumn
  onClose: () => void
  onChanged: () => void
}) {
  const isEdit = !!column
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(column?.name ?? '')
  const [type, setType] = useState<DataColumnType>(column?.type ?? 'number')
  const [optionsText, setOptionsText] = useState((column?.options ?? []).join(', '))
  const [numberFormat, setNumberFormat] = useState<DataNumberFormat>(column?.number_format ?? 'raw')
  const [numberMax, setNumberMax] = useState(column?.number_max != null ? String(column.number_max) : '5')

  function submit() {
    const clean = name.trim()
    if (!clean) return toast.error('Le nom de la colonne est requis.')

    const options =
      type === 'category' ? optionsText.split(',').map((o) => o.trim()).filter(Boolean) : undefined
    if (type === 'category' && (!options || options.length === 0)) {
      return toast.error('Ajoute au moins un choix (séparés par des virgules).')
    }

    const fmt = type === 'number' ? numberFormat : undefined
    const max = fmt === 'rating' ? Number(numberMax) : undefined
    if (fmt === 'rating' && (!max || max <= 0)) {
      return toast.error('Indique le maximum de la note (ex. 5).')
    }

    startTransition(async () => {
      const res = isEdit
        ? await updateColumn(column!.id, setId, { name: clean, options, numberFormat: fmt, numberMax: max })
        : await addColumn(setId, clean, type, options, fmt, max)
      if (!res.success) { toast.error(res.error); return }
      toast.success(isEdit ? 'Colonne modifiée ✓' : 'Colonne ajoutée ✓')
      onClose()
      onChanged()
    })
  }

  return (
    <div className="bg-[#0e0e0e] border border-[#1f1f1f] rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1">Nom</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && type !== 'category') { e.preventDefault(); submit() } }}
            placeholder="ex. Score, Canal, Message"
            className={field}
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1">
            Type {isEdit && <span className="text-[#444444] normal-case tracking-normal">(non modifiable)</span>}
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as DataColumnType)}
            disabled={isEdit}
            className={`${field} cursor-pointer ${isEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {COLUMN_TYPES.map((t) => (
              <option key={t} value={t}>{COLUMN_TYPE_META[t].label}</option>
            ))}
          </select>
        </div>
      </div>

      {type === 'number' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1">Format</label>
            <select
              value={numberFormat}
              onChange={(e) => setNumberFormat(e.target.value as DataNumberFormat)}
              className={`${field} cursor-pointer`}
            >
              {(Object.keys(NUMBER_FORMAT_META) as DataNumberFormat[]).map((f) => (
                <option key={f} value={f}>{NUMBER_FORMAT_META[f].label}</option>
              ))}
            </select>
          </div>
          {numberFormat === 'rating' && (
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1">Sur combien ? (max)</label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={numberMax}
                onChange={(e) => setNumberMax(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
                placeholder="5"
                className={field}
              />
            </div>
          )}
        </div>
      )}

      {type === 'category' && (
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1">Choix (séparés par des virgules)</label>
          <input
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
            placeholder="ex. réussi, échoué, sans réponse"
            className={field}
          />
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-[#888888] hover:text-white transition-colors">Annuler</button>
        <button onClick={submit} disabled={isPending} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#00D76B] text-black hover:bg-[#00c560] transition-colors disabled:opacity-50">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {isEdit ? 'Enregistrer' : 'Ajouter la colonne'}
        </button>
      </div>
    </div>
  )
}

// ── Formulaire d'entrée (ajout / édition) ─────────────────────────────────────

function EntryForm({
  setId,
  columns,
  entry,
  onDone,
  onCancel,
}: {
  setId: string
  columns: DataColumn[]
  entry?: DataEntry
  onDone: () => void
  onCancel?: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [values, setValues] = useState<Record<string, DataValue>>(() => (entry ? { ...entry.values } : {}))

  function setVal(colId: string, v: DataValue) {
    setValues((prev) => ({ ...prev, [colId]: v }))
  }

  function submit() {
    const hasValue = Object.values(values).some((v) => v !== '' && v != null)
    if (!hasValue) return toast.error('Remplis au moins un champ.')
    startTransition(async () => {
      const res = entry ? await updateEntry(entry.id, setId, values) : await addEntry(setId, values)
      if (!res.success) { toast.error(res.error); return }
      toast.success(entry ? 'Entrée modifiée ✓' : 'Entrée ajoutée ✓')
      if (!entry) setValues({})
      onDone()
      if (entry && onCancel) onCancel()
    })
  }

  return (
    <div className="bg-[#0e0e0e] border border-[#1f1f1f] rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {columns.map((col) => (
          <FieldInput key={col.id} col={col} value={values[col.id] ?? ''} onChange={(v) => setVal(col.id, v)} />
        ))}
      </div>
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs text-[#888888] hover:text-white transition-colors">Annuler</button>
        )}
        <button onClick={submit} disabled={isPending} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#00D76B] text-black hover:bg-[#00c560] transition-colors disabled:opacity-50">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : entry ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {entry ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>
    </div>
  )
}

function FieldInput({ col, value, onChange }: { col: DataColumn; value: DataValue; onChange: (v: DataValue) => void }) {
  const label = (
    <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1">{col.name}</label>
  )

  if (col.type === 'number') {
    if (col.number_format === 'fraction') {
      return (
        <div>
          {label}
          <input
            type="text"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="ex. 1/5"
            className={field}
          />
        </div>
      )
    }
    return (
      <div>
        {label}
        <input
          type="number"
          inputMode="decimal"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="0"
          className={field}
        />
      </div>
    )
  }

  if (col.type === 'category') {
    return (
      <div>
        {label}
        <select value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} className={`${field} cursor-pointer`}>
          <option value="">—</option>
          {(col.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className="sm:col-span-2">
      {label}
      <AutoGrowTextarea
        value={(value as string) ?? ''}
        minRows={1}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…"
        className={field}
      />
    </div>
  )
}

// ── Table des entrées ─────────────────────────────────────────────────────────

function EntriesTable({
  columns,
  entries,
  setId,
  editingId,
  setEditingId,
  onChanged,
}: {
  columns: DataColumn[]
  entries: DataEntry[]
  setId: string
  editingId: string | null
  setEditingId: (id: string | null) => void
  onChanged: () => void
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-[#555555] italic px-1">Aucune entrée. Ajoute la première ci-dessus.</p>
  }

  return (
    <div className="overflow-x-auto border border-[#1f1f1f] rounded-xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1f1f1f] bg-[#0e0e0e]">
            {columns.map((col) => (
              <th key={col.id} className="text-left px-3 py-2 text-[11px] uppercase tracking-wider text-[#666666] font-medium whitespace-nowrap">{col.name}</th>
            ))}
            <th className="w-16" />
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) =>
            editingId === entry.id ? (
              <tr key={entry.id}>
                <td colSpan={columns.length + 1} className="p-2 bg-[#0a0a0a]">
                  <EntryForm setId={setId} columns={columns} entry={entry} onDone={onChanged} onCancel={() => setEditingId(null)} />
                </td>
              </tr>
            ) : (
              <EntryRow
                key={entry.id}
                entry={entry}
                columns={columns}
                setId={setId}
                onEdit={() => setEditingId(entry.id)}
                onChanged={onChanged}
              />
            ),
          )}
        </tbody>
      </table>
    </div>
  )
}

function EntryRow({
  entry,
  columns,
  setId,
  onEdit,
  onChanged,
}: {
  entry: DataEntry
  columns: DataColumn[]
  setId: string
  onEdit: () => void
  onChanged: () => void
}) {
  const [isPending, startTransition] = useTransition()

  function remove() {
    startTransition(async () => {
      const res = await deleteEntry(entry.id, setId)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Entrée supprimée')
      onChanged()
    })
  }

  return (
    <tr className="border-b border-[#161616] last:border-0 hover:bg-[#0e0e0e] group">
      {columns.map((col) => (
        <td key={col.id} className="px-3 py-2 align-top">{renderCell(col, entry.values[col.id])}</td>
      ))}
      <td className="px-2 py-2">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} aria-label="Modifier" className="w-7 h-7 flex items-center justify-center rounded-md text-[#555555] hover:text-white hover:bg-[#1a1a1a] transition-colors">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={remove} disabled={isPending} aria-label="Supprimer" className="w-7 h-7 flex items-center justify-center rounded-md text-[#555555] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

function renderCell(col: DataColumn, value: DataValue) {
  if (value == null || value === '') return <span className="text-[#3a3a3a]">—</span>

  if (col.type === 'number') {
    return <span className="tabular-nums text-[#dddddd] whitespace-nowrap">{displayCell(col, value)}</span>
  }

  if (col.type === 'category') {
    const c = categoryColor(String(value), col.options)
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium whitespace-nowrap" style={{ color: c, backgroundColor: `${c}1a` }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c }} />
        {String(value)}
      </span>
    )
  }

  return <span className="text-[#cccccc] whitespace-pre-wrap break-words block max-w-[360px]">{String(value)}</span>
}
