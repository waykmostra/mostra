'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText,
  ChevronDown,
  Loader2,
  RotateCcw,
  Check,
  CheckCircle,
  Clock,
  Send,
  AlertTriangle,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  applyFormTemplate,
  resetForm,
  saveAdminAnswer,
  addFormQuestion,
  updateFormQuestion,
  deleteFormQuestion,
} from '@/app/projects/form-actions'
import {
  startSubPhase,
  approveSubPhase,
} from '@/app/projects/sub-phase-actions'
import type { FormTemplate, FormQuestionContent, PhaseStatus, QuestionType } from '@/lib/types'
import { parseCheckboxAnswer, serializeCheckboxAnswer } from '@/lib/utils/form-answers'

// ── Types ─────────────────────────────────────────────────────────

interface FormBlock {
  id: string
  content: FormQuestionContent
  sort_order: number
}

interface FormSubPhaseAdminProps {
  subPhaseId: string
  subPhaseStatus: PhaseStatus
  canStart: boolean
  blocks: FormBlock[]
  templates: FormTemplate[]
  projectId: string
  phaseId: string
}

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'text', label: 'Texte court' },
  { value: 'textarea', label: 'Texte long' },
  { value: 'number', label: 'Nombre' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Choix (liste)' },
  { value: 'radio', label: 'Choix unique' },
  { value: 'checkbox', label: 'Choix multiple' },
]

// ── AdminAnswerField ───────────────────────────────────────────────
// Champ éditable par l'admin pour remplir une réponse

function AdminAnswerField({
  block,
  onSave,
}: {
  block: FormBlock
  onSave: (blockId: string, answer: string) => Promise<void>
}) {
  const [value, setValue] = useState(block.content.answer ?? '')
  const [saving, setSaving] = useState(false)

  async function handleBlur() {
    const trimmed = value.trim()
    if (trimmed === (block.content.answer ?? '')) return
    setSaving(true)
    await onSave(block.id, trimmed)
    setSaving(false)
  }

  const isLong = block.content.type === 'textarea'
  const hasAnswer = value.trim() !== ''

  // ── Checkbox: multi-select UI ──────────────────────────────────────
  if (block.content.type === 'checkbox') {
    const selectedValues = parseCheckboxAnswer(value)
    const hasAnySelected = selectedValues.length > 0

    function handleCheckboxToggle(opt: string) {
      const next = selectedValues.includes(opt)
        ? selectedValues.filter((v) => v !== opt)
        : [...selectedValues, opt]
      const serialized = serializeCheckboxAnswer(next)
      setValue(serialized)
      void (async () => {
        setSaving(true)
        await onSave(block.id, serialized)
        setSaving(false)
      })()
    }

    return (
      <div className="space-y-1.5">
        <div className="flex items-start gap-2">
          <p className="text-xs font-medium text-dim flex-1">
            {block.content.label}
            {block.content.required && <span className="text-red-400 ml-1">*</span>}
          </p>
          {hasAnySelected && !saving && (
            <CheckCircle className="h-3.5 w-3.5 text-brand flex-shrink-0 mt-0.5" />
          )}
          {saving && <Loader2 className="h-3.5 w-3.5 text-faint animate-spin flex-shrink-0 mt-0.5" />}
        </div>
        {block.content.helpText && (
          <p className="text-[11px] text-faint">{block.content.helpText}</p>
        )}
        <div className="space-y-2">
          {(block.content.options ?? []).map((opt) => {
            const checked = selectedValues.includes(opt)
            return (
              <label
                key={opt}
                className="flex items-center gap-3 cursor-pointer group"
                onClick={() => handleCheckboxToggle(opt)}
              >
                <div
                  className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    checked
                      ? 'border-brand bg-brand'
                      : 'border-line group-hover:border-[rgb(var(--c-text-faint))]'
                  }`}
                >
                  {checked && <Check className="h-2.5 w-2.5 text-black" strokeWidth={3} />}
                </div>
                <span className="text-sm text-dim">{opt}</span>
              </label>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Texte / textarea : champ éditable ─────────────────────────────
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2">
        <p className="text-xs font-medium text-dim flex-1">
          {block.content.label}
          {block.content.required && <span className="text-red-400 ml-1">*</span>}
        </p>
        {hasAnswer && !saving && (
          <CheckCircle className="h-3.5 w-3.5 text-brand flex-shrink-0 mt-0.5" />
        )}
        {saving && <Loader2 className="h-3.5 w-3.5 text-faint animate-spin flex-shrink-0 mt-0.5" />}
      </div>
      {block.content.helpText && (
        <p className="text-[11px] text-faint">{block.content.helpText}</p>
      )}
      {isLong ? (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          rows={3}
          placeholder="Répondre au nom du client…"
          className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder-[rgb(var(--c-border-strong))] focus:outline-none focus:border-line-strong resize-none leading-relaxed transition-colors"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          placeholder="Répondre au nom du client…"
          className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder-[rgb(var(--c-border-strong))] focus:outline-none focus:border-line-strong transition-colors"
        />
      )}
    </div>
  )
}

// ── QuestionEditRow ────────────────────────────────────────────────

function QuestionEditRow({
  block,
  index,
  onDelete,
}: {
  block: FormBlock
  index: number
  onDelete: (id: string) => void
}) {
  const [label, setLabel] = useState(block.content.label)
  const [helpText, setHelpText] = useState(block.content.helpText ?? '')
  const [type, setType] = useState<QuestionType>(block.content.type)
  const [required, setRequired] = useState(block.content.required)
  const [deleting, setDeleting] = useState(false)

  async function handleFieldBlur(
    field: 'label' | 'helpText' | 'type' | 'required',
    val: string | boolean,
  ) {
    if (field === 'label' && (val as string) === block.content.label) return
    if (field === 'helpText' && (val as string) === (block.content.helpText ?? '')) return
    if (field === 'type' && (val as string) === block.content.type) return
    if (field === 'required' && (val as boolean) === block.content.required) return

    const patch: Partial<Pick<FormQuestionContent, 'label' | 'type' | 'helpText' | 'required'>> = {}
    if (field === 'label') patch.label = val as string
    if (field === 'helpText') patch.helpText = val as string
    if (field === 'type') patch.type = val as QuestionType
    if (field === 'required') patch.required = val as boolean

    await updateFormQuestion(block.id, patch)
  }

  async function handleDelete() {
    setDeleting(true)
    onDelete(block.id)
    const result = await deleteFormQuestion(block.id)
    if (!result.success) toast.error((result as { error: string }).error)
    setDeleting(false)
  }

  return (
    <div className="bg-surface border border-line rounded-xl p-3 space-y-2.5">
      {/* Header: index + delete */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-faint font-mono w-4">{index + 1}</span>
        {/* Type */}
        <select
          value={type}
          onChange={(e) => {
            const newType = e.target.value as QuestionType
            setType(newType)
            handleFieldBlur('type', newType)
          }}
          className="flex-1 bg-canvas border border-line rounded-lg px-2 py-1 text-[11px] text-dim focus:outline-none focus:border-line-strong transition-colors"
        >
          {QUESTION_TYPES.map((qt) => (
            <option key={qt.value} value={qt.value}>{qt.label}</option>
          ))}
        </select>
        {/* Required */}
        <label className="flex items-center gap-1 text-[11px] text-faint cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => {
              setRequired(e.target.checked)
              handleFieldBlur('required', e.target.checked)
            }}
            className="w-3 h-3 accent-[rgb(var(--c-brand))]"
          />
          Requis
        </label>
        {/* Delete */}
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="p-1 rounded text-faint hover:text-[#EF4444] transition-colors disabled:opacity-40 flex-shrink-0"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Label */}
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={(e) => handleFieldBlur('label', e.target.value.trim())}
        placeholder="Question…"
        className="w-full bg-canvas border border-line rounded-lg px-2.5 py-1.5 text-xs text-ink placeholder-[rgb(var(--c-border-strong))] focus:outline-none focus:border-brand/50 transition-colors"
      />

      {/* Help text */}
      <input
        type="text"
        value={helpText}
        onChange={(e) => setHelpText(e.target.value)}
        onBlur={(e) => handleFieldBlur('helpText', e.target.value.trim())}
        placeholder="Description optionnelle…"
        className="w-full bg-canvas border border-line rounded-lg px-2.5 py-1.5 text-[11px] text-faint placeholder-[rgb(var(--c-border))] focus:outline-none focus:border-line-strong transition-colors"
      />
    </div>
  )
}

// ── AnswerDisplay (read-only) ──────────────────────────────────────

function AnswerDisplay({ block }: { block: FormBlock }) {
  const { content } = block

  // ── Checkbox: list display ─────────────────────────────────────────
  if (content.type === 'checkbox') {
    const selected = parseCheckboxAnswer(content.answer)
    const hasSelections = selected.length > 0

    return (
      <div className="space-y-1.5">
        <div className="flex items-start gap-2">
          <p className="text-xs font-medium text-dim flex-1">
            {content.label}
            {content.required && <span className="text-red-400 ml-1">*</span>}
          </p>
          {hasSelections && (
            <CheckCircle className="h-3.5 w-3.5 text-brand flex-shrink-0 mt-0.5" />
          )}
        </div>
        {content.helpText && (
          <p className="text-[11px] text-faint">{content.helpText}</p>
        )}
        <div
          className={`rounded-lg px-3 py-2.5 text-sm ${
            hasSelections
              ? 'bg-surface border border-line'
              : 'bg-surface border border-dashed border-line text-faint italic'
          }`}
        >
          {hasSelections ? (
            <ul className="space-y-1">
              {selected.map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-ink">
                  <span className="text-brand flex-shrink-0">•</span>
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            'Aucune réponse'
          )}
        </div>
      </div>
    )
  }

  // ── Autres types : affichage texte brut ───────────────────────────
  const hasAnswer = content.answer !== null && content.answer !== ''

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2">
        <p className="text-xs font-medium text-dim flex-1">
          {content.label}
          {content.required && <span className="text-red-400 ml-1">*</span>}
        </p>
        {hasAnswer && (
          <CheckCircle className="h-3.5 w-3.5 text-brand flex-shrink-0 mt-0.5" />
        )}
      </div>
      {content.helpText && (
        <p className="text-[11px] text-faint">{content.helpText}</p>
      )}
      <div
        className={`rounded-lg px-3 py-2.5 text-sm ${
          hasAnswer
            ? 'bg-surface border border-line text-ink'
            : 'bg-surface border border-dashed border-line text-faint italic'
        }`}
      >
        {hasAnswer ? (
          <span className="whitespace-pre-wrap">{content.answer}</span>
        ) : (
          'Pas de réponse'
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────

export default function FormSubPhaseAdmin({
  subPhaseId,
  subPhaseStatus,
  canStart,
  blocks: initialBlocks,
  templates,
  projectId,
  phaseId,
}: FormSubPhaseAdminProps) {
  const router = useRouter()
  const [blocks, setBlocks] = useState<FormBlock[]>(initialBlocks)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    templates[0]?.id ?? '',
  )
  const [applying, setApplying] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [starting, setStarting] = useState(false)
  const [approving, setApproving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [addingQuestion, setAddingQuestion] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<QuestionType>('text')

  const hasBlocks = blocks.length > 0
  const answeredCount = blocks.filter(
    (b) => b.content.answer !== null && b.content.answer !== '',
  ).length

  const canFillAnswers =
    subPhaseStatus === 'pending' || subPhaseStatus === 'in_progress'
  const canEditQuestions = subPhaseStatus === 'pending'

  // ── Apply template ──────────────────────────────────────────────
  async function handleApply() {
    if (!selectedTemplateId) {
      toast.error('Sélectionnez un template')
      return
    }
    setApplying(true)
    const result = await applyFormTemplate(subPhaseId, selectedTemplateId)
    setApplying(false)
    if (!result.success) {
      toast.error((result as { error: string }).error)
    } else {
      toast.success('Template appliqué')
      router.refresh()
    }
  }

  // ── Reset ───────────────────────────────────────────────────────
  async function handleReset() {
    if (!confirm('Réinitialiser le formulaire ? Les réponses du client seront perdues.')) return
    setResetting(true)
    const result = await resetForm(subPhaseId)
    setResetting(false)
    if (!result.success) {
      toast.error((result as { error: string }).error)
    } else {
      toast.success('Formulaire réinitialisé')
      router.refresh()
    }
  }

  // ── Send to client ──────────────────────────────────────────────
  async function handleSendToClient() {
    setStarting(true)
    const result = await startSubPhase(subPhaseId)
    setStarting(false)
    if (!result.success) toast.error((result as { error: string }).error)
    else toast.success('Formulaire envoyé au client')
  }

  // ── Approve ─────────────────────────────────────────────────────
  async function handleApprove() {
    setApproving(true)
    const result = await approveSubPhase(subPhaseId)
    setApproving(false)
    if (!result.success) toast.error((result as { error: string }).error)
    else toast.success('Formulaire approuvé')
  }

  // ── Admin saves an answer ───────────────────────────────────────
  async function handleSaveAnswer(blockId: string, answer: string) {
    const result = await saveAdminAnswer(blockId, answer)
    if (!result.success) toast.error((result as { error: string }).error)
    // Update local state optimistically
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId ? { ...b, content: { ...b.content, answer } } : b,
      ),
    )
  }

  // ── Add question ────────────────────────────────────────────────
  async function handleAddQuestion() {
    if (!newLabel.trim()) {
      toast.error('La question ne peut pas être vide')
      return
    }
    setAddingQuestion(true)
    const result = await addFormQuestion(subPhaseId, {
      label: newLabel.trim(),
      type: newType,
      helpText: '',
      required: false,
    })
    setAddingQuestion(false)
    if (!result.success) {
      toast.error((result as { error: string }).error)
    } else {
      // Add to local state
      const newBlock: FormBlock = {
        id: result.blockId!,
        content: {
          label: newLabel.trim(),
          type: newType,
          helpText: '',
          required: false,
          answer: null,
        },
        sort_order: blocks.length + 1,
      }
      setBlocks((prev) => [...prev, newBlock])
      setNewLabel('')
      setNewType('text')
      toast.success('Question ajoutée')
    }
  }

  // ── Delete question ─────────────────────────────────────────────
  function handleDeleteQuestion(blockId: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId))
  }

  // ── No template applied ─────────────────────────────────────────
  if (!hasBlocks) {
    return (
      <div className="space-y-4">
        <div className="bg-surface border border-line rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-faint" />
            <p className="text-sm font-medium text-ink">Appliquer un template</p>
          </div>

          {templates.length === 0 ? (
            <div className="text-center py-6 space-y-2">
              <p className="text-sm text-faint">Aucun template de formulaire disponible.</p>
              <a
                href="/settings/forms/new"
                className="text-xs text-brand hover:underline"
              >
                Créer un template →
              </a>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs text-faint mb-1.5">Template</label>
                <div className="relative">
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-full appearance-none bg-surface border border-line rounded-xl px-3 py-2.5 text-sm text-ink pr-8 focus:outline-none focus:border-brand/50 transition-colors"
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.is_default ? ' (par défaut)' : ''}
                        {' — '}
                        {t.questions.length} question{t.questions.length !== 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
                </div>
              </div>

              <button
                type="button"
                onClick={handleApply}
                disabled={applying || !selectedTemplateId}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-black text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {applying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Appliquer ce template
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Template applied — show form state ──────────────────────────
  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="bg-surface border border-line rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {subPhaseStatus === 'pending' && (
            <>
              <div className="w-2 h-2 rounded-full bg-[rgb(var(--c-text-faint))]" />
              <span className="text-sm text-faint">
                Template appliqué — pas encore envoyé au client
              </span>
            </>
          )}
          {subPhaseStatus === 'in_progress' && (
            <>
              <div className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
              <span className="text-sm text-[#F59E0B]">
                En attente de réponse — {answeredCount}/{blocks.length} questions remplies
              </span>
            </>
          )}
          {subPhaseStatus === 'in_review' && (
            <>
              <div className="w-2 h-2 rounded-full bg-[#3B82F6]" />
              <span className="text-sm text-[#3B82F6]">
                Formulaire soumis — {answeredCount}/{blocks.length} réponses
              </span>
            </>
          )}
          {(subPhaseStatus === 'completed' || subPhaseStatus === 'approved') && (
            <>
              <div className="w-2 h-2 rounded-full bg-brand" />
              <span className="text-sm text-brand">Formulaire approuvé</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Edit questions toggle — only when pending */}
          {canEditQuestions && (
            <button
              type="button"
              onClick={() => setEditMode((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                editMode
                  ? 'bg-brand/10 border-brand/30 text-brand'
                  : 'border-line text-faint hover:text-ink hover:border-line-strong'
              }`}
            >
              <Pencil className="h-3.5 w-3.5" />
              {editMode ? 'Terminer' : 'Modifier les questions'}
            </button>
          )}

          {/* Send to client — only when pending + hasBlocks + canStart */}
          {subPhaseStatus === 'pending' && canStart && (
            <button
              type="button"
              onClick={handleSendToClient}
              disabled={starting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand/10 border border-brand/30 text-brand text-xs font-medium hover:bg-brand/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {starting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Envoyer au client
            </button>
          )}

          {/* Approve */}
          {subPhaseStatus === 'in_review' && (
            <button
              type="button"
              onClick={handleApprove}
              disabled={approving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] text-xs font-medium hover:bg-[#22C55E]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {approving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5" />
              )}
              Approuver
            </button>
          )}

          {/* Reset */}
          {subPhaseStatus !== 'completed' && subPhaseStatus !== 'approved' && (
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-faint text-xs hover:text-ink hover:border-line-strong transition-colors disabled:opacity-50"
            >
              {resetting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
              Changer de template
            </button>
          )}
        </div>
      </div>

      {/* Pending — can't send yet */}
      {subPhaseStatus === 'pending' && !canStart && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/20">
          <AlertTriangle className="h-3.5 w-3.5 text-[#F59E0B] flex-shrink-0" />
          <p className="text-xs text-[#F59E0B]">
            La sous-phase précédente doit être terminée avant de pouvoir envoyer ce formulaire.
          </p>
        </div>
      )}

      {/* ── Edit mode: question editor ── */}
      {editMode && canEditQuestions ? (
        <div className="space-y-2">
          <p className="text-[10px] text-faint uppercase tracking-widest font-medium px-1">
            Modifier les questions
          </p>

          {blocks.map((block, i) => (
            <QuestionEditRow
              key={block.id}
              block={block}
              index={i}
              onDelete={handleDeleteQuestion}
            />
          ))}

          {/* Add new question */}
          <div className="bg-surface border border-dashed border-line rounded-xl p-3 space-y-2">
            <p className="text-[10px] text-faint uppercase tracking-widest">Nouvelle question</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddQuestion() }}
                placeholder="Texte de la question…"
                className="flex-1 bg-canvas border border-line rounded-lg px-2.5 py-1.5 text-xs text-ink placeholder-[rgb(var(--c-border-strong))] focus:outline-none focus:border-brand/50 transition-colors"
              />
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as QuestionType)}
                className="bg-canvas border border-line rounded-lg px-2 py-1.5 text-[11px] text-dim focus:outline-none focus:border-line-strong transition-colors"
              >
                {QUESTION_TYPES.map((qt) => (
                  <option key={qt.value} value={qt.value}>{qt.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddQuestion}
                disabled={addingQuestion || !newLabel.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand/10 border border-brand/20 text-brand text-xs font-medium hover:bg-brand/20 transition-colors disabled:opacity-40"
              >
                {addingQuestion ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Ajouter
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ── Normal mode: questions with admin fill ── */
        <div className="bg-surface border border-line rounded-2xl divide-y divide-line">
          {blocks.map((block, i) => (
            <div key={block.id} className="px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] text-faint font-mono">{i + 1}</span>
              </div>

              {/* Admin can fill answers when pending or in_progress */}
              {canFillAnswers ? (
                <AdminAnswerField block={block} onSave={handleSaveAnswer} />
              ) : (
                <AnswerDisplay block={block} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Waiting for review hint */}
      {subPhaseStatus === 'in_progress' && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface border border-line">
          <Clock className="h-3.5 w-3.5 text-faint flex-shrink-0" />
          <p className="text-xs text-faint">
            Le client peut remplir et soumettre le formulaire depuis son espace.
            Les réponses ci-dessus sont éditables par l&apos;admin.
          </p>
        </div>
      )}
    </div>
  )
}
