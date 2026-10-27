'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import ScriptTableView from '@/components/project/script/ScriptTableView'
import ScriptSummaryView from '@/components/project/script/ScriptSummaryView'
import ScriptCommentRail, { RowCommentThread, type RowThread } from '@/components/project/script/ScriptCommentRail'
import { saveScript } from '@/app/projects/script-actions'
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
import type { PhaseStatus, UserRole, ScriptColumn, ScriptCategory, ScriptBeat, ColumnTag } from '@/lib/types'

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

// ── Cases d'affichage (vue Résumé) ────────────────────────────────

/** Libellés des cases : le vocabulaire de Kylian, pas celui des tags. */
const TAG_TOGGLE_LABEL: Record<ColumnTag, string> = {
  voixoff: 'Voix',
  visuals: 'Visuels',
  intention: 'Intentions',
  sfx: 'SFX',
  section: 'Sections',
  texte: 'Texte',
}

/** Ordre des cases : du texte principal aux annotations. */
const TOGGLE_ORDER: ColumnTag[] = ['voixoff', 'visuals', 'intention', 'sfx', 'section', 'texte']

const DISPLAY_KEY = 'mostra.script.display'

function readDisplay(): { hiddenTags: ColumnTag[]; showBeats: boolean } {
  try {
    const raw = window.localStorage.getItem(DISPLAY_KEY)
    if (raw) {
      const v = JSON.parse(raw) as { hiddenTags?: ColumnTag[]; showBeats?: boolean }
      return { hiddenTags: Array.isArray(v.hiddenTags) ? v.hiddenTags : [], showBeats: v.showBeats !== false }
    }
  } catch {
    // stockage indisponible (navigation privée…) : réglages par défaut
  }
  return { hiddenTags: [], showBeats: true }
}

function DisplayToggle({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={`inline-flex h-8 items-center gap-2 rounded-lg px-2.5 text-[12.5px] font-medium transition-colors ${
        checked ? 'bg-surface text-ink shadow-[var(--hairline),var(--e1)]' : 'text-faint hover:text-ink'
      }`}
    >
      <span
        className={`grid h-3.5 w-3.5 place-items-center rounded-[4px] border transition-colors ${
          checked ? 'border-brand bg-brand text-[#052e16]' : 'border-line-strong'
        }`}
      >
        {checked && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
      </span>
      {label}
    </button>
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
  // Le tableau d'abord : c'est là qu'on écrit. Le résumé sert à relire.
  const [view, setView] = useState<'table' | 'summary'>('table')
  const [hiddenTags, setHiddenTags] = useState<ColumnTag[]>([])
  const [showBeats, setShowBeats] = useState(true)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const d = readDisplay()
    setHiddenTags(d.hiddenTags)
    setShowBeats(d.showBeats)
  }, [])

  function saveDisplay(next: { hiddenTags: ColumnTag[]; showBeats: boolean }) {
    try {
      window.localStorage.setItem(DISPLAY_KEY, JSON.stringify(next))
    } catch {
      // pas grave : le réglage tiendra le temps de la page
    }
  }

  function toggleTag(tag: ColumnTag) {
    const next = hiddenTags.includes(tag) ? hiddenTags.filter((t) => t !== tag) : [...hiddenTags, tag]
    setHiddenTags(next)
    saveDisplay({ hiddenTags: next, showBeats })
  }

  function toggleBeats() {
    setShowBeats(!showBeats)
    saveDisplay({ hiddenTags, showBeats: !showBeats })
  }
  const [openRowKey, setOpenRowKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
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
    // try/finally : une action qui échoue côté serveur ne laisse jamais le
    // bouton tourner à l'infini.
    try {
      const result =
        action === 'start'
          ? await startSubPhase(subPhaseId)
          : action === 'review'
            ? await sendSubPhaseToReview(subPhaseId)
            : await approveSubPhase(subPhaseId)
      if (!result.success) toast.error((result as { error: string }).error)
      else router.refresh()
    } catch {
      toast.error('L’action n’a pas abouti. Recharge la page et réessaie.')
    } finally {
      setTransitioning(null)
    }
  }

  const btnBase =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  const busy = saving || transitioning !== null
  const empty = !hasAnyContent(rows)

  const canComment = !!(projectId && phaseId)

  // Fils affichés dans la colonne : ceux qui ont un commentaire ouvert, plus
  // la ligne qu'on est en train de commenter.
  const threads: RowThread[] = useMemo(() => {
    if (!canComment) return []
    return rows
      .filter((r) => r.id)
      .map((r) => ({ row: r, title: rowPreview(r, columns), comments: allComments.filter((c) => c.block_id === r.id) }))
      .filter((t) => t.row._key === openRowKey || t.comments.some((c) => !c.is_resolved))
  }, [canComment, rows, columns, allComments, openRowKey])
  const openThread = threads.find((t) => t.row._key === openRowKey) ?? null

  // Types de ligne présents dans ce script.
  const presentTags = TOGGLE_ORDER.filter((id) => columns.some((c) => c.tag === id))
  const layoutKey = `${view}|${rows.length}|${hiddenTags.join(',')}|${showBeats}`

  /** Bouton commentaire d'une ligne (partagé tableau + résumé). */
  const rowCommentNode = (row: EditorRow) => {
    if (!row.id) {
      return (
        <span title="Sauvegarde le brouillon pour commenter cette ligne" className="text-faint">
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
        className={`relative h-7 w-7 grid place-items-center rounded-lg transition-colors ${active ? 'bg-[rgb(var(--c-border))] text-ink' : 'text-faint hover:text-ink hover:bg-surface-2'}`}
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
      <div className="bg-surface border border-line rounded-2xl p-10 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-surface-2 border border-line flex items-center justify-center mx-auto">
          <FileText className="h-5 w-5 text-faint" />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">Éditeur de script</p>
          <p className="text-xs text-faint mt-1 max-w-xs mx-auto">
            Démarrez cette sous-phase pour commencer à rédiger le script de la vidéo.
          </p>
        </div>
        {canAct && canStart && (
          <button
            type="button"
            onClick={() => handleTransition('start')}
            disabled={busy}
            className={`${btnBase} bg-brand/10 border border-brand/20 text-brand hover:bg-brand/20 mx-auto`}
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
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand/10 border border-brand/20">
              <CheckCircle className="h-3.5 w-3.5 text-brand" />
              <span className="text-xs text-brand">Script approuvé</span>
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
              className={`${btnBase} border border-line text-dim hover:text-ink hover:border-line-strong`}
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
              className={`${btnBase} bg-brand/10 border border-brand/20 text-brand hover:bg-brand/20`}
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

      {/* Bascule Tableau / Résumé + cases d'affichage du résumé */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface border border-line">
          <button
            type="button"
            onClick={() => setView('table')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${view === 'table' ? 'bg-[rgb(var(--c-border))] text-ink' : 'text-faint hover:text-ink'}`}
          >
            <Table2 className="h-3.5 w-3.5" /> Tableau
          </button>
          <button
            type="button"
            onClick={() => setView('summary')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${view === 'summary' ? 'bg-[rgb(var(--c-border))] text-ink' : 'text-faint hover:text-ink'}`}
          >
            <AlignLeft className="h-3.5 w-3.5" /> Résumé
          </button>
        </div>

        {view === 'summary' && (
          <div
            role="group"
            aria-label="Afficher dans le résumé"
            className="inline-flex flex-wrap items-center gap-0.5 rounded-xl border border-line bg-surface-2/60 p-1"
          >
            {presentTags.map((tag) => (
              <DisplayToggle
                key={tag}
                label={TAG_TOGGLE_LABEL[tag]}
                checked={!hiddenTags.includes(tag)}
                onToggle={() => toggleTag(tag)}
              />
            ))}
            <DisplayToggle label="Rythme" checked={showBeats} onToggle={toggleBeats} />
          </div>
        )}
      </div>

      {/* Corps : le script, et à droite la colonne de commentaires (≥ xl) */}
      <div
        ref={bodyRef}
        className={canComment ? 'xl:grid xl:grid-cols-[minmax(0,1fr)_288px] xl:items-start xl:gap-5' : undefined}
      >
        <div className="min-w-0">
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
              activeRowKey={openRowKey}
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
              hiddenTags={hiddenTags}
              showBeats={showBeats}
              activeRowKey={openRowKey}
            />
          )}
        </div>

        {canComment && projectId && phaseId && (
          <aside className="hidden xl:block" aria-label="Commentaires du script">
            <ScriptCommentRail
              containerRef={bodyRef}
              threads={threads}
              activeRowKey={openRowKey}
              projectId={projectId}
              phaseId={phaseId}
              subPhaseId={subPhaseId}
              onActivate={setOpenRowKey}
              onClose={() => setOpenRowKey(null)}
              layoutKey={layoutKey}
            />
          </aside>
        )}
      </div>

      {/* Sans place pour la colonne : le fil flotte à droite (en bas sur mobile) */}
      {openThread && projectId && phaseId && (
        <div className="fixed inset-x-3 bottom-3 z-40 max-h-[70vh] overflow-y-auto md:inset-x-auto md:bottom-auto md:right-5 md:top-24 md:w-80 xl:hidden">
          <RowCommentThread
            thread={openThread}
            active
            projectId={projectId}
            phaseId={phaseId}
            subPhaseId={subPhaseId}
            onActivate={() => {}}
            onClose={() => setOpenRowKey(null)}
          />
        </div>
      )}

      {subPhaseStatus === 'in_progress' && !readOnly && (
        <p className="text-[11px] text-faint text-center">
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
