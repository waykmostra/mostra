'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Loader2,
  Save,
  Play,
  Send,
  CheckCircle,
  FileText,
  MessageSquare,
  Table2,
  AlignLeft,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatRelative } from '@/lib/utils/dates'
import ScriptTableView from '@/components/project/script/ScriptTableView'
import ScriptSummaryView from '@/components/project/script/ScriptSummaryView'
import { saveScript } from '@/app/projects/script-actions'
import { addComment, toggleResolveComment } from '@/app/projects/comment-actions'
import {
  startSubPhase,
  sendSubPhaseToReview,
  approveSubPhase,
} from '@/app/projects/sub-phase-actions'
import {
  useRealtimeBlockComments,
  type BlockComment,
} from '@/lib/hooks/useRealtimeBlockComments'
import { hasAnyContent, type EditorRow } from '@/lib/scriptTable'
import type { PhaseStatus, UserRole, ScriptColumn, ScriptCategory, ScriptBeat } from '@/lib/types'

// ── Props ─────────────────────────────────────────────────────────

interface ScriptEditorProps {
  scriptId: string
  subPhaseId: string
  subPhaseStatus: PhaseStatus
  userRole: UserRole
  canStart: boolean
  initialColumns: ScriptColumn[]
  initialCategories: ScriptCategory[]
  initialBeats: ScriptBeat[]
  initialRows: EditorRow[]
  projectId?: string
  phaseId?: string
  initialComments?: BlockComment[]
}

// ── Helpers ───────────────────────────────────────────────────────

/** Aperçu d'une ligne (narration en priorité) pour titrer le panneau de commentaires. */
function rowPreview(row: EditorRow, columns: ScriptColumn[]): string {
  const vo = columns.filter((c) => c.tag === 'voixoff')
  for (const c of [...vo, ...columns]) {
    const v = (row.cells?.[c.id] || '').trim()
    if (v) return v.length > 70 ? `${v.slice(0, 70)}…` : v
  }
  return 'Ligne sans texte'
}

// ── AdminRowCommentDock ───────────────────────────────────────────
// Panneau de commentaires d'UNE ligne, ancré sous le tableau (évite tout
// clipping dans le scroll horizontal). Réutilise les actions commentaires.

function AdminRowCommentDock({
  row,
  rowTitle,
  blockColor,
  projectId,
  phaseId,
  subPhaseId,
  allComments,
  onClose,
}: {
  row: EditorRow
  rowTitle: string
  blockColor: string
  projectId: string
  phaseId: string
  subPhaseId: string
  allComments: BlockComment[]
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const blockComments = allComments.filter((c) => c.block_id === row.id)

  async function handleSubmit() {
    if (!text.trim() || !row.id) return
    setSending(true)
    const result = await addComment({
      projectId,
      phaseId,
      subPhaseId,
      blockId: row.id,
      content: text.trim(),
    })
    setSending(false)
    if (!result.success) toast.error((result as { error: string }).error)
    else {
      toast.success('Commentaire ajouté')
      setText('')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  async function handleResolve(commentId: string) {
    const result = await toggleResolveComment(commentId)
    if (!result.success) toast.error((result as { error: string }).error)
  }

  return (
    <div
      className="rounded-2xl border bg-[#0e0e0e] overflow-hidden"
      style={{ borderColor: `${blockColor}40` }}
    >
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b"
        style={{ borderColor: `${blockColor}22`, background: `${blockColor}10` }}
      >
        <MessageSquare className="h-3.5 w-3.5" style={{ color: blockColor }} />
        <span className="text-xs font-medium text-white truncate flex-1">
          Commentaires · <span className="text-[#999999]">{rowTitle}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          className="h-6 w-6 grid place-items-center rounded text-[#666666] hover:text-white hover:bg-[#1a1a1a]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-4 py-3 space-y-3">
        {blockComments.length > 0 && (
          <div className="space-y-3">
            {blockComments.map((c) => {
              const authorName = c.author?.full_name ?? 'Utilisateur'
              const initials = authorName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
              return (
                <div key={c.id} className={`flex gap-3 ${c.is_resolved ? 'opacity-40' : ''}`}>
                  <div className="w-6 h-6 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden">
                    {c.author?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.author.avatar_url} alt={authorName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[9px] text-[#666666] font-medium">{initials}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-[11px] font-medium text-white">{authorName}</span>
                      <span className="text-[10px] text-[#444444]">{formatRelative(c.created_at)}</span>
                      {c.is_resolved && (
                        <span className="text-[10px] text-[#00D76B] bg-[#00D76B]/10 px-1.5 py-0.5 rounded-full border border-[#00D76B]/20">
                          Résolu
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#999999] leading-relaxed">{c.content}</p>
                  </div>
                  {!c.is_resolved && (
                    <button
                      type="button"
                      onClick={() => handleResolve(c.id)}
                      className="text-[#333333] hover:text-[#00D76B] transition-colors flex-shrink-0 mt-0.5"
                      title="Marquer comme résolu"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Commentaire interne… (Ctrl+Entrée pour envoyer)"
            rows={2}
            className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white placeholder-[#444444] focus:outline-none focus:border-[#444444] resize-none leading-relaxed"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!text.trim() || sending}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#00D76B]/10 border border-[#00D76B]/20 text-[#00D76B] text-[11px] font-medium hover:bg-[#00D76B]/20 transition-colors disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Envoyer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ScriptEditor ──────────────────────────────────────────────────

export default function ScriptEditor({
  scriptId,
  subPhaseId,
  subPhaseStatus,
  userRole,
  canStart,
  initialColumns,
  initialCategories,
  initialBeats,
  initialRows,
  projectId,
  phaseId,
  initialComments = [],
}: ScriptEditorProps) {
  const isAdmin = userRole === 'admin'
  const canAct = isAdmin
  const readOnly =
    subPhaseStatus === 'in_review' || subPhaseStatus === 'completed' || subPhaseStatus === 'approved'

  const [columns, setColumns] = useState<ScriptColumn[]>(initialColumns)
  const [categories, setCategories] = useState<ScriptCategory[]>(initialCategories)
  const [rows, setRows] = useState<EditorRow[]>(initialRows)
  const [beats, setBeats] = useState<ScriptBeat[]>(initialBeats)
  const [view, setView] = useState<'table' | 'summary'>('summary')
  const [openRowKey, setOpenRowKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [transitioning, setTransitioning] = useState<'start' | 'review' | 'approve' | null>(null)

  const allComments = useRealtimeBlockComments(projectId ?? '', subPhaseId, initialComments)
  const unresolvedTotal = projectId
    ? allComments.filter((c) => !c.is_resolved && c.block_id !== null).length
    : 0

  // Dernière version éditée, lue par la sauvegarde (évite les closures périmées).
  const stateRef = useRef({ columns, categories, beats, rows })
  useEffect(() => {
    stateRef.current = { columns, categories, beats, rows }
  }, [columns, categories, beats, rows])

  const savingRef = useRef(false) // verrou : pas de saves concurrentes
  const dirtyRef = useRef(false) // des changements sont arrivés pendant une save
  const persistRef = useRef<(() => Promise<boolean>) | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)

  /** Sauvegarde le script (layout + lignes). Sérialisée ; réapplique les id créés. */
  const persist = useCallback(async (): Promise<boolean> => {
    if (savingRef.current) {
      dirtyRef.current = true // une save tourne déjà → on resauvera juste après
      return true
    }
    savingRef.current = true
    setSaving(true)

    const s = stateRef.current
    const result = await saveScript(scriptId, {
      columns: s.columns,
      categories: s.categories,
      beats: s.beats,
      rows: s.rows.map((r) => ({ _key: r._key, id: r.id, categoryId: r.categoryId, cells: r.cells })),
    })

    if (result.success && Object.keys(result.idMap).length) {
      const idMap = result.idMap
      // Synchrone (pour une resave immédiate sans double-insert) + état React (UI/commentaires).
      stateRef.current = {
        ...stateRef.current,
        rows: stateRef.current.rows.map((r) => (idMap[r._key] ? { ...r, id: idMap[r._key] } : r)),
      }
      setRows((prev) => prev.map((r) => (idMap[r._key] ? { ...r, id: idMap[r._key] } : r)))
    }

    savingRef.current = false
    setSaving(false)

    if (!result.success) {
      toast.error((result as { error: string }).error)
      return false
    }
    setLastSavedAt(Date.now())

    if (dirtyRef.current) {
      dirtyRef.current = false
      void persistRef.current?.() // resauve les changements survenus pendant la save
    }
    return true
  }, [scriptId])
  useEffect(() => {
    persistRef.current = persist
  }, [persist])

  // Auto-save débouncé tant que la sous-phase est éditable (in_progress, admin).
  const autoSaveOn = canAct && subPhaseStatus === 'in_progress'
  const autoSaveMounted = useRef(false)
  useEffect(() => {
    if (!autoSaveOn) return
    if (!autoSaveMounted.current) {
      autoSaveMounted.current = true // pas de save au montage initial
      return
    }
    const t = setTimeout(() => void persist(), 1200)
    return () => clearTimeout(t)
  }, [columns, categories, beats, rows, autoSaveOn, persist])

  async function handleSave() {
    const ok = await persist()
    if (ok) toast.success('Script sauvegardé')
  }

  async function handleTransition(action: 'start' | 'review' | 'approve') {
    setTransitioning(action)
    // Envoi en review : on SAUVEGARDE d'abord (sinon le brouillon non sauvé est perdu).
    if (action === 'review') {
      const ok = await persist()
      if (!ok) {
        setTransitioning(null)
        return
      }
    }
    const result =
      action === 'start'
        ? await startSubPhase(subPhaseId)
        : action === 'review'
          ? await sendSubPhaseToReview(subPhaseId)
          : await approveSubPhase(subPhaseId)
    setTransitioning(null)
    if (!result.success) toast.error((result as { error: string }).error)
  }

  const btnBase =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  const busy = saving || transitioning !== null
  const empty = !hasAnyContent(rows)

  const openRow = openRowKey ? rows.find((r) => r._key === openRowKey) ?? null : null
  const openRowColor = (() => {
    if (!openRow) return '#00D76B'
    const cat = categories.find((c) => c.id === openRow.categoryId)
    return cat?.color ?? '#00D76B'
  })()

  const canComment = !!(projectId && phaseId)

  /** Bouton commentaire d'une ligne (partagé tableau + résumé). */
  const rowCommentNode = (row: EditorRow) => {
    if (!row.id) {
      return (
        <span title="Sauvegarde le brouillon pour commenter cette ligne" className="text-[#333333]">
          <MessageSquare className="h-4 w-4" />
        </span>
      )
    }
    const rc = allComments.filter((c) => c.block_id === row.id)
    const unresolved = rc.filter((c) => !c.is_resolved).length
    const active = openRowKey === row._key
    return (
      <button
        type="button"
        onClick={() => setOpenRowKey(active ? null : row._key)}
        title="Commentaires de la ligne"
        className={`relative h-7 w-7 grid place-items-center rounded-lg transition-colors ${active ? 'bg-[#1f1f1f] text-white' : 'text-[#555555] hover:text-white hover:bg-[#1a1a1a]'}`}
      >
        <MessageSquare className="h-4 w-4" />
        {unresolved > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 rounded-full bg-[#F59E0B] text-[9px] font-bold text-black grid place-items-center">
            {unresolved}
          </span>
        )}
      </button>
    )
  }

  // ── État « pending » ─────────────────────────────────────────────
  if (subPhaseStatus === 'pending') {
    return (
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-10 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center mx-auto">
          <FileText className="h-5 w-5 text-[#333333]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Éditeur de script</p>
          <p className="text-xs text-[#555555] mt-1 max-w-xs mx-auto">
            Démarrez cette sous-phase pour commencer à rédiger le script de la vidéo.
          </p>
        </div>
        {canAct && canStart && (
          <button
            type="button"
            onClick={() => handleTransition('start')}
            disabled={busy}
            className={`${btnBase} bg-[#00D76B]/10 border border-[#00D76B]/20 text-[#00D76B] hover:bg-[#00D76B]/20 mx-auto`}
          >
            {transitioning === 'start' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Démarrer le script
          </button>
        )}
      </div>
    )
  }

  // ── Éditeur ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {subPhaseStatus === 'in_review' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/20">
              <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
              <span className="text-xs text-[#F59E0B]">En attente de validation client</span>
            </div>
          )}
          {(subPhaseStatus === 'completed' || subPhaseStatus === 'approved') && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#00D76B]/10 border border-[#00D76B]/20">
              <CheckCircle className="h-3.5 w-3.5 text-[#00D76B]" />
              <span className="text-xs text-[#00D76B]">Script approuvé</span>
            </div>
          )}
          {unresolvedTotal > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/20">
              <MessageSquare className="h-3 w-3 text-[#F59E0B]" />
              <span className="text-xs text-[#F59E0B]">
                {unresolvedTotal} commentaire{unresolvedTotal > 1 ? 's' : ''} client
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {subPhaseStatus === 'in_progress' && canAct && (
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className={`${btnBase} border border-[#2a2a2a] text-[#a0a0a0] hover:text-white hover:border-[#444444]`}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Sauvegarder le brouillon
            </button>
          )}
          {subPhaseStatus === 'in_progress' && canAct && (
            <button
              type="button"
              onClick={() => handleTransition('review')}
              disabled={busy || empty}
              title={empty ? 'Remplis au moins une ligne' : undefined}
              className={`${btnBase} bg-[#00D76B]/10 border border-[#00D76B]/20 text-[#00D76B] hover:bg-[#00D76B]/20`}
            >
              {transitioning === 'review' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Envoyer en review
            </button>
          )}
          {subPhaseStatus === 'in_review' && isAdmin && (
            <button
              type="button"
              onClick={() => handleTransition('approve')}
              disabled={busy}
              className={`${btnBase} bg-[#22C55E]/10 border border-[#22C55E]/20 text-[#22C55E] hover:bg-[#22C55E]/20`}
            >
              {transitioning === 'approve' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5" />
              )}
              Approuver
            </button>
          )}
        </div>
      </div>

      {/* Bascule Résumé / Tableau */}
      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#111111] border border-[#2a2a2a]">
        <button
          type="button"
          onClick={() => setView('summary')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${view === 'summary' ? 'bg-[#1f1f1f] text-white' : 'text-[#666666] hover:text-white'}`}
        >
          <AlignLeft className="h-3.5 w-3.5" /> Résumé
        </button>
        <button
          type="button"
          onClick={() => setView('table')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${view === 'table' ? 'bg-[#1f1f1f] text-white' : 'text-[#666666] hover:text-white'}`}
        >
          <Table2 className="h-3.5 w-3.5" /> Tableau
        </button>
      </div>

      {/* Corps */}
      {view === 'table' ? (
        <ScriptTableView
          columns={columns}
          categories={categories}
          rows={rows}
          readOnly={readOnly}
          onColumns={setColumns}
          onRows={setRows}
          onCategories={setCategories}
          renderRowComments={canComment ? rowCommentNode : undefined}
        />
      ) : (
        <ScriptSummaryView
          columns={columns}
          categories={categories}
          rows={rows}
          beats={beats}
          onBeatsChange={readOnly ? undefined : setBeats}
          renderRowComment={canComment ? rowCommentNode : undefined}
          rowHasComments={(row) => !!row.id && allComments.some((c) => c.block_id === row.id)}
        />
      )}

      {/* Panneau commentaires de la ligne ouverte (sous la vue active) */}
      {openRow && openRow.id && projectId && phaseId && (
        <AdminRowCommentDock
          row={openRow}
          rowTitle={rowPreview(openRow, columns)}
          blockColor={openRowColor}
          projectId={projectId}
          phaseId={phaseId}
          subPhaseId={subPhaseId}
          allComments={allComments}
          onClose={() => setOpenRowKey(null)}
        />
      )}

      {subPhaseStatus === 'in_progress' && !readOnly && (
        <p className="text-[11px] text-[#333333] text-center">
          {saving
            ? 'Enregistrement…'
            : lastSavedAt
              ? 'Brouillon enregistré automatiquement ✓'
              : 'Enregistrement automatique activé — tes modifications sont sauvegardées en continu.'}
        </p>
      )}
    </div>
  )
}
