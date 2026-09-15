'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Plus,
  Trash2,
  Copy,
  Loader2,
  ChevronDown,
  ChevronRight,
  Eye,
  Hash,
  Calendar,
  AlignLeft,
  List,
  CircleDot,
  CheckSquare,
  Type,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { createFormTemplate, updateFormTemplate } from '@/app/settings/forms/actions'
import type { FormQuestion, QuestionType } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────

interface QuestionRow extends FormQuestion {
  _key: string
  _expanded: boolean
}

interface FormBuilderProps {
  templateId?: string
  initialName?: string
  initialDescription?: string
  initialQuestions?: FormQuestion[]
}

// ── Constants ─────────────────────────────────────────────────────

const QUESTION_TYPES: { value: QuestionType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'text', label: 'Texte court', icon: Type },
  { value: 'textarea', label: 'Texte long', icon: AlignLeft },
  { value: 'select', label: 'Liste déroulante', icon: List },
  { value: 'radio', label: 'Choix unique', icon: CircleDot },
  { value: 'checkbox', label: 'Choix multiple', icon: CheckSquare },
  { value: 'number', label: 'Nombre', icon: Hash },
  { value: 'date', label: 'Date', icon: Calendar },
]

let _uid = 0
function uid() {
  return `q_${Date.now()}_${++_uid}`
}

function makeQuestion(): QuestionRow {
  return {
    _key: uid(),
    id: uid(),
    label: '',
    type: 'text',
    required: false,
    options: [],
    placeholder: '',
    helpText: '',
    _expanded: true,
  }
}

function toRow(q: FormQuestion): QuestionRow {
  return { ...q, _key: q.id, _expanded: false }
}

// ── SortableQuestionItem ──────────────────────────────────────────

function SortableQuestionItem({
  row,
  index,
  onUpdate,
  onDuplicate,
  onRemove,
  onToggle,
}: {
  row: QuestionRow
  index: number
  onUpdate: (key: string, patch: Partial<QuestionRow>) => void
  onDuplicate: (key: string) => void
  onRemove: (key: string) => void
  onToggle: (key: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row._key,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const typeInfo = QUESTION_TYPES.find((t) => t.value === row.type)
  const TypeIcon = typeInfo?.icon ?? Type
  const hasOptions = row.type === 'select' || row.type === 'radio' || row.type === 'checkbox'

  function addOption() {
    onUpdate(row._key, { options: [...(row.options ?? []), ''] })
  }

  function updateOption(i: number, value: string) {
    const opts = [...(row.options ?? [])]
    opts[i] = value
    onUpdate(row._key, { options: opts })
  }

  function removeOption(i: number) {
    const opts = [...(row.options ?? [])]
    opts.splice(i, 1)
    onUpdate(row._key, { options: opts })
  }

  return (
    <div ref={setNodeRef} style={style} className="group">
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        {/* ── Row header ── */}
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            type="button"
            className="text-faint hover:text-faint cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <span className="text-[10px] text-faint font-mono w-5 flex-shrink-0">{index + 1}</span>

          <TypeIcon className="h-3.5 w-3.5 text-faint flex-shrink-0" />

          <span className="flex-1 text-sm text-ink truncate min-w-0">
            {row.label || <span className="text-faint italic">Sans titre</span>}
          </span>

          {row.required && (
            <span className="text-[10px] text-[#F59E0B] border border-[#F59E0B]/30 bg-[#F59E0B]/10 rounded px-1.5 py-0.5 flex-shrink-0">
              Requis
            </span>
          )}

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onDuplicate(row._key)}
              className="p-1 text-faint hover:text-ink transition-colors rounded"
              title="Dupliquer"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onRemove(row._key)}
              className="p-1 text-faint hover:text-red-400 transition-colors rounded"
              title="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => onToggle(row._key)}
            className="p-1 text-faint hover:text-ink transition-colors rounded flex-shrink-0"
          >
            {row._expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* ── Expanded form ── */}
        {row._expanded && (
          <div className="border-t border-line px-4 py-4 space-y-3">
            {/* Label */}
            <div>
              <label className="block text-xs text-faint mb-1">
                Libellé <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={row.label}
                onChange={(e) => onUpdate(row._key, { label: e.target.value })}
                placeholder="Ex: Quels sont les objectifs de cette vidéo ?"
                className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder-[rgb(var(--c-border-strong))] focus:outline-none focus:border-brand/50 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Type */}
              <div>
                <label className="block text-xs text-faint mb-1">Type de champ</label>
                <select
                  value={row.type}
                  onChange={(e) =>
                    onUpdate(row._key, { type: e.target.value as QuestionType, options: [] })
                  }
                  className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand/50 transition-colors appearance-none"
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Required toggle */}
              <div className="flex flex-col">
                <label className="block text-xs text-faint mb-1">Obligatoire</label>
                <button
                  type="button"
                  onClick={() => onUpdate(row._key, { required: !row.required })}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    row.required
                      ? 'bg-brand/10 border-brand/30 text-brand'
                      : 'bg-surface border-line text-faint'
                  }`}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center flex-shrink-0 ${
                      row.required ? 'border-brand bg-brand' : 'border-line-strong'
                    }`}
                  >
                    {row.required && (
                      <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 10 10">
                        <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  {row.required ? 'Oui' : 'Non'}
                </button>
              </div>
            </div>

            {/* Placeholder */}
            <div>
              <label className="block text-xs text-faint mb-1">Placeholder (optionnel)</label>
              <input
                type="text"
                value={row.placeholder ?? ''}
                onChange={(e) => onUpdate(row._key, { placeholder: e.target.value })}
                placeholder="Texte d'aide dans le champ…"
                className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder-[rgb(var(--c-border-strong))] focus:outline-none focus:border-brand/50 transition-colors"
              />
            </div>

            {/* Help text */}
            <div>
              <label className="block text-xs text-faint mb-1">Texte d&apos;aide (optionnel)</label>
              <input
                type="text"
                value={row.helpText ?? ''}
                onChange={(e) => onUpdate(row._key, { helpText: e.target.value })}
                placeholder="Description supplémentaire visible sous le champ…"
                className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder-[rgb(var(--c-border-strong))] focus:outline-none focus:border-brand/50 transition-colors"
              />
            </div>

            {/* Options for select / radio */}
            {hasOptions && (
              <div>
                <label className="block text-xs text-faint mb-2">Options</label>
                <div className="space-y-2">
                  {(row.options ?? []).map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-shrink-0 text-faint">
                        {row.type === 'radio' ? (
                          <CircleDot className="h-3.5 w-3.5" />
                        ) : row.type === 'checkbox' ? (
                          <CheckSquare className="h-3.5 w-3.5" />
                        ) : (
                          <List className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => updateOption(i, e.target.value)}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 bg-surface border border-line rounded-lg px-3 py-1.5 text-sm text-ink placeholder-[rgb(var(--c-border-strong))] focus:outline-none focus:border-brand/50 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => removeOption(i)}
                        className="p-1 text-faint hover:text-red-400 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addOption}
                    className="text-xs text-faint hover:text-brand transition-colors flex items-center gap-1 mt-1"
                  >
                    <Plus className="h-3 w-3" />
                    Ajouter une option
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Preview ───────────────────────────────────────────────────────

function FormPreview({ name, questions }: { name: string; questions: QuestionRow[] }) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-6 space-y-5">
      <div className="pb-3 border-b border-line">
        <p className="text-[10px] text-brand uppercase tracking-widest mb-1">Aperçu client</p>
        <h3 className="text-sm font-semibold text-ink">{name || 'Nom du formulaire'}</h3>
      </div>

      {questions.length === 0 && (
        <p className="text-xs text-faint text-center py-6 italic">
          Ajoutez des questions pour voir l&apos;aperçu
        </p>
      )}

      {questions.map((q, i) => (
        <div key={q._key} className="space-y-1.5">
          <label className="block text-xs font-medium text-dim">
            {q.label || <span className="text-faint italic">Question {i + 1}</span>}
            {q.required && <span className="text-red-400 ml-1">*</span>}
          </label>

          {q.helpText && <p className="text-[11px] text-faint">{q.helpText}</p>}

          {q.type === 'text' && (
            <input
              readOnly
              placeholder={q.placeholder || ''}
              className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-xs text-faint placeholder-[rgb(var(--c-border-strong))] cursor-default"
            />
          )}

          {q.type === 'textarea' && (
            <textarea
              readOnly
              rows={3}
              placeholder={q.placeholder || ''}
              className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-xs text-faint placeholder-[rgb(var(--c-border-strong))] cursor-default resize-none"
            />
          )}

          {q.type === 'number' && (
            <input
              readOnly
              type="number"
              placeholder={q.placeholder || '0'}
              className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-xs text-faint placeholder-[rgb(var(--c-border-strong))] cursor-default"
            />
          )}

          {q.type === 'date' && (
            <input
              readOnly
              type="date"
              className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-xs text-faint cursor-default"
            />
          )}

          {q.type === 'select' && (
            <select
              disabled
              className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-xs text-faint cursor-default appearance-none"
            >
              <option value="">{q.placeholder || 'Choisir une option…'}</option>
              {(q.options ?? []).map((opt, j) => (
                <option key={j} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          )}

          {q.type === 'radio' && (
            <div className="space-y-1.5">
              {(q.options ?? []).length === 0 && (
                <p className="text-[11px] text-faint italic">Aucune option définie</p>
              )}
              {(q.options ?? []).map((opt, j) => (
                <label key={j} className="flex items-center gap-2 cursor-default">
                  <div className="w-3.5 h-3.5 rounded-full border border-line bg-surface flex-shrink-0" />
                  <span className="text-xs text-faint">{opt}</span>
                </label>
              ))}
            </div>
          )}

          {q.type === 'checkbox' && (
            <div className="space-y-1.5">
              {(q.options ?? []).length === 0 && (
                <p className="text-[11px] text-faint italic">Aucune option définie</p>
              )}
              {(q.options ?? []).map((opt, j) => (
                <label key={j} className="flex items-center gap-2 cursor-default">
                  <div className="w-3.5 h-3.5 rounded-sm border border-line bg-surface flex-shrink-0" />
                  <span className="text-xs text-faint">{opt}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── FormBuilder ───────────────────────────────────────────────────

export default function FormBuilder({
  templateId,
  initialName = '',
  initialDescription = '',
  initialQuestions = [],
}: FormBuilderProps) {
  const router = useRouter()

  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [questions, setQuestions] = useState<QuestionRow[]>(() =>
    initialQuestions.map(toRow),
  )
  const [showPreview, setShowPreview] = useState(true)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setQuestions((prev) => {
      const oldIdx = prev.findIndex((q) => q._key === active.id)
      const newIdx = prev.findIndex((q) => q._key === over.id)
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  const updateQuestion = useCallback((key: string, patch: Partial<QuestionRow>) => {
    setQuestions((prev) => prev.map((q) => (q._key === key ? { ...q, ...patch } : q)))
  }, [])

  const duplicateQuestion = useCallback((key: string) => {
    setQuestions((prev) => {
      const idx = prev.findIndex((q) => q._key === key)
      if (idx === -1) return prev
      const source = prev[idx]
      const newId = uid()
      const copy: QuestionRow = { ...source, _key: newId, id: newId, _expanded: true }
      const next = [...prev]
      next.splice(idx + 1, 0, copy)
      return next
    })
  }, [])

  const removeQuestion = useCallback((key: string) => {
    setQuestions((prev) => prev.filter((q) => q._key !== key))
  }, [])

  const toggleQuestion = useCallback((key: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q._key === key ? { ...q, _expanded: !q._expanded } : q)),
    )
  }, [])

  function addQuestion() {
    setQuestions((prev) => [...prev, makeQuestion()])
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error('Le nom du template est requis')
      return
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      questions: questions.map(({ _key, _expanded, ...q }) => q),
    }

    setSaving(true)
    const result = templateId
      ? await updateFormTemplate(templateId, payload)
      : await createFormTemplate(payload)
    setSaving(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success(templateId ? 'Template mis à jour' : 'Template créé')
    router.push('/settings/forms')
  }

  return (
    <div className="space-y-6">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
              showPreview
                ? 'bg-brand/10 border-brand/30 text-brand'
                : 'bg-surface border-line text-faint hover:text-ink'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Aperçu
          </button>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-black text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {templateId ? 'Sauvegarder' : 'Créer le template'}
        </button>
      </div>

      <div className={`grid gap-6 ${showPreview ? 'lg:grid-cols-[1fr_380px]' : ''}`}>
        {/* ── Left: editor ── */}
        <div className="space-y-4">
          {/* Metadata */}
          <div className="bg-surface border border-line rounded-2xl p-5 space-y-4">
            <div>
              <label className="block text-xs text-faint mb-1.5">
                Nom du template <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Brief vidéo classique"
                className="w-full bg-surface border border-line rounded-lg px-3 py-2.5 text-sm text-ink placeholder-[rgb(var(--c-border-strong))] focus:outline-none focus:border-brand/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-faint mb-1.5">Description (optionnelle)</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="À quoi sert ce formulaire ?"
                className="w-full bg-surface border border-line rounded-lg px-3 py-2.5 text-sm text-ink placeholder-[rgb(var(--c-border-strong))] focus:outline-none focus:border-brand/50 transition-colors resize-none"
              />
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-faint font-medium">
                Questions{' '}
                <span className="text-faint">({questions.length})</span>
              </p>
              <p className="text-[10px] text-faint">Glisser pour réordonner</p>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={questions.map((q) => q._key)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {questions.map((q, i) => (
                    <SortableQuestionItem
                      key={q._key}
                      row={q}
                      index={i}
                      onUpdate={updateQuestion}
                      onDuplicate={duplicateQuestion}
                      onRemove={removeQuestion}
                      onToggle={toggleQuestion}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <button
              type="button"
              onClick={addQuestion}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-line text-sm text-faint hover:text-brand hover:border-brand/40 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Ajouter une question
            </button>
          </div>
        </div>

        {/* ── Right: preview ── */}
        {showPreview && (
          <div className="hidden lg:block">
            <div className="sticky top-6">
              <FormPreview name={name} questions={questions} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
