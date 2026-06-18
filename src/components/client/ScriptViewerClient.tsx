'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowLeft,
  LogIn,
  MessageSquare,
  CheckCircle,
  RotateCcw,
  Send,
  Loader2,
  ThumbsUp,
  Table2,
  AlignLeft,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatRelative } from '@/lib/utils/dates'
import ScriptTableView from '@/components/project/script/ScriptTableView'
import ScriptSummaryView from '@/components/project/script/ScriptSummaryView'
import { type EditorRow } from '@/lib/scriptTable'
import type { PhaseStatus, ScriptColumn, ScriptCategory, ScriptBeat } from '@/lib/types'
import type { BlockComment } from '@/lib/hooks/useRealtimeBlockComments'
import {
  addBlockComment,
  approveScriptSubPhase,
  requestScriptRevisions,
  resolveBlockComment,
  fetchSubPhaseComments,
  selectScript,
} from '@/app/client/script-actions'

interface ScriptViewerClientProps {
  token: string
  projectId: string
  subPhaseId: string
  status: PhaseStatus
  columns: ScriptColumn[]
  categories: ScriptCategory[]
  beats: ScriptBeat[]
  rows: EditorRow[]
  initialComments: BlockComment[]
  clientId: string | null
  isAuthenticated: boolean
  scriptId?: string
  multiScript?: boolean
  isSelected?: boolean
  backHref?: string
  scriptTitle?: string
}

// ── Helpers ───────────────────────────────────────────────────────

function rowPreview(row: EditorRow, columns: ScriptColumn[]): string {
  const vo = columns.filter((c) => c.tag === 'voixoff')
  for (const c of [...vo, ...columns]) {
    const v = (row.cells?.[c.id] || '').trim()
    if (v) return v.length > 70 ? `${v.slice(0, 70)}…` : v
  }
  return 'Ligne sans texte'
}

// ── ClientRowCommentDock ──────────────────────────────────────────

function ClientRowCommentDock({
  row,
  rowTitle,
  blockColor,
  comments,
  clientId,
  canComment,
  onAdd,
  onResolve,
  onClose,
}: {
  row: EditorRow
  rowTitle: string
  blockColor: string
  comments: BlockComment[]
  clientId: string | null
  canComment: boolean
  onAdd: (blockId: string, content: string) => Promise<void>
  onResolve: (commentId: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const blockComments = comments.filter((c) => c.block_id === row.id)

  async function handleSubmit() {
    if (!text.trim() || !row.id) return
    setSending(true)
    await onAdd(row.id, text.trim())
    setText('')
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="rounded-2xl border bg-[#0e0e0e] overflow-hidden" style={{ borderColor: `${blockColor}40` }}>
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
              const authorName = c.author?.full_name ?? 'Client'
              const initials = authorName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
              const canResolve = !!clientId && c.user_id === clientId
              return (
                <div key={c.id} className={`flex gap-3 ${c.is_resolved ? 'opacity-40' : ''}`}>
                  <div className="w-7 h-7 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden">
                    {c.author?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.author.avatar_url} alt={authorName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-[#666666] font-medium">{initials}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-medium text-white">{authorName}</span>
                      <span className="text-[10px] text-[#444444]">{formatRelative(c.created_at)}</span>
                      {c.is_resolved && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-[#00D76B] bg-[#00D76B]/10 px-1.5 py-0.5 rounded-full border border-[#00D76B]/20">
                          <CheckCircle className="h-2.5 w-2.5" />
                          Résolu
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#999999] leading-relaxed">{c.content}</p>
                  </div>
                  {canResolve && !c.is_resolved && (
                    <button
                      type="button"
                      onClick={() => onResolve(c.id)}
                      className="text-[#333333] hover:text-[#00D76B] transition-colors flex-shrink-0 mt-1"
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

        {canComment ? (
          <div className="space-y-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Votre commentaire… (Ctrl+Entrée pour envoyer)"
              rows={3}
              className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-xs text-white placeholder-[#444444] focus:outline-none focus:border-[#444444] resize-none leading-relaxed"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!text.trim() || sending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00D76B]/10 border border-[#00D76B]/20 text-[#00D76B] text-xs font-medium hover:bg-[#00D76B]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Envoyer
            </button>
          </div>
        ) : blockComments.length === 0 ? (
          <p className="text-[11px] text-[#444444]">Connectez-vous pour commenter cette ligne.</p>
        ) : null}
      </div>
    </div>
  )
}

// ── ScriptViewerClient ────────────────────────────────────────────

export default function ScriptViewerClient({
  token,
  projectId: _projectId,
  subPhaseId,
  status,
  columns,
  categories,
  beats,
  rows,
  initialComments,
  clientId,
  isAuthenticated,
  scriptId,
  multiScript = false,
  isSelected = false,
  backHref,
  scriptTitle,
}: ScriptViewerClientProps) {
  const [comments, setComments] = useState<BlockComment[]>(initialComments)
  const [view, setView] = useState<'table' | 'summary'>('summary')
  const [openRowKey, setOpenRowKey] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const fresh = await fetchSubPhaseComments(token, subPhaseId)
    setComments(fresh)
  }, [token, subPhaseId])

  // Poll toutes les 10s (le viewer anonyme ne peut pas s'abonner au realtime).
  useEffect(() => {
    const id = setInterval(refresh, 10_000)
    return () => clearInterval(id)
  }, [refresh])

  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(status === 'completed' || status === 'approved')
  const [showRevisionForm, setShowRevisionForm] = useState(false)
  const [revisionText, setRevisionText] = useState('')
  const [requestingRevision, setRequestingRevision] = useState(false)

  const isApproved = approved || status === 'completed' || status === 'approved'
  const unresolvedTotal = comments.filter((c) => !c.is_resolved && c.block_id !== null).length

  const openRow = openRowKey ? rows.find((r) => r._key === openRowKey) ?? null : null
  const openRowColor = (() => {
    if (!openRow) return '#00D76B'
    const cat = categories.find((c) => c.id === openRow.categoryId)
    return cat?.color ?? '#00D76B'
  })()

  /** Bouton commentaire d'une ligne (partagé tableau + résumé). */
  const rowCommentNode = (row: EditorRow) => {
    if (!row.id) return null
    const rc = comments.filter((c) => c.block_id === row.id)
    if (rc.length === 0 && !isAuthenticated) return null
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

  async function handleAddComment(blockId: string, content: string) {
    const result = await addBlockComment(token, blockId, content)
    if (!result.success) {
      toast.error((result as { error: string }).error)
    } else {
      toast.success('Commentaire ajouté')
      await refresh()
    }
  }

  async function handleResolve(commentId: string) {
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, is_resolved: !c.is_resolved } : c)))
    const result = await resolveBlockComment(token, commentId)
    if (!result.success) {
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, is_resolved: !c.is_resolved } : c)))
      toast.error((result as { error: string }).error)
    }
  }

  async function handleApprove() {
    const msg = multiScript
      ? 'Choisir ce script comme version finale ? Cela le valide.'
      : 'Approuver définitivement ce script ?'
    if (!confirm(msg)) return
    setApproving(true)
    const result =
      multiScript && scriptId
        ? await selectScript(token, scriptId)
        : await approveScriptSubPhase(token, subPhaseId)
    setApproving(false)
    if (!result.success) {
      toast.error((result as { error: string }).error)
    } else {
      toast.success(multiScript ? 'Script choisi ✓' : 'Script approuvé — merci !')
      setApproved(true)
    }
  }

  async function handleRequestRevision() {
    if (!revisionText.trim()) {
      toast.error('Précisez les modifications souhaitées')
      return
    }
    setRequestingRevision(true)
    const result = await requestScriptRevisions(token, subPhaseId, revisionText)
    setRequestingRevision(false)
    if (!result.success) {
      toast.error((result as { error: string }).error)
    } else {
      toast.success("Demande envoyée à l'équipe")
      setShowRevisionForm(false)
      setRevisionText('')
    }
  }

  return (
    <div className="space-y-4">
      {/* En-tête multi-scripts */}
      {multiScript && backHref && (
        <div className="flex items-center justify-between gap-2">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs text-[#666666] hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Tous les scripts
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            {scriptTitle && <span className="text-xs font-medium text-white truncate">{scriptTitle}</span>}
            {isSelected && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#00D76B] flex-shrink-0">
                <CheckCircle className="h-3 w-3" /> Choisi
              </span>
            )}
          </div>
        </div>
      )}

      {/* Auth gate */}
      {!isApproved && status === 'in_review' && !isAuthenticated && (
        <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-[#F59E0B] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">Connectez-vous pour valider</p>
              <p className="text-xs text-[#666666] mt-0.5">
                Vous devez être connecté pour valider, commenter ou modifier cette phase.
              </p>
            </div>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-black hover:bg-white/90 transition-colors"
          >
            <LogIn className="h-4 w-4" />
            Se connecter
          </Link>
        </div>
      )}

      {/* Panneau d'approbation */}
      {!isApproved && status === 'in_review' && isAuthenticated && (
        <div className="bg-[#111111] border border-[#F59E0B]/25 rounded-2xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center flex-shrink-0">
              <ThumbsUp className="h-4 w-4 text-[#F59E0B]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Script en attente de validation</p>
              <p className="text-xs text-[#666666] mt-0.5 leading-relaxed">
                Relisez attentivement le tableau (ou le résumé). Vous pouvez commenter chaque ligne
                via l&apos;icône à droite, ou demander des modifications globales.
              </p>
            </div>
          </div>

          {!showRevisionForm ? (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00D76B]/10 border border-[#00D76B]/25 text-[#00D76B] text-sm font-medium hover:bg-[#00D76B]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {multiScript ? 'Choisir ce script' : 'Approuver le script'}
              </button>
              <button
                type="button"
                onClick={() => setShowRevisionForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#2a2a2a] text-[#888888] text-sm hover:text-white hover:border-[#444444] transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                Demander des modifications
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[#666666]">
                Décrivez les modifications souhaitées — l&apos;équipe en sera notifiée.
              </p>
              <textarea
                autoFocus
                value={revisionText}
                onChange={(e) => setRevisionText(e.target.value)}
                placeholder="Ex: Le hook n'est pas assez percutant, la partie CTA manque de clarté…"
                rows={4}
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#444444] focus:outline-none focus:border-[#444444] resize-none leading-relaxed"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRequestRevision}
                  disabled={requestingRevision || !revisionText.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[#F59E0B] text-sm font-medium hover:bg-[#F59E0B]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {requestingRevision ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Envoyer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRevisionForm(false)
                    setRevisionText('')
                  }}
                  className="text-xs text-[#444444] hover:text-white transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bandeau approuvé */}
      {isApproved && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#00D76B]/10 border border-[#00D76B]/20">
          <CheckCircle className="h-4 w-4 text-[#00D76B] flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#00D76B]">Script approuvé</p>
            <p className="text-[11px] text-[#00D76B]/60">La production peut commencer.</p>
          </div>
        </div>
      )}

      {/* Compteur de commentaires non résolus */}
      {unresolvedTotal > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20">
          <MessageSquare className="h-3.5 w-3.5 text-[#F59E0B] flex-shrink-0" />
          <span className="text-xs text-[#F59E0B]">
            {unresolvedTotal} commentaire{unresolvedTotal > 1 ? 's' : ''} non résolu
            {unresolvedTotal > 1 ? 's' : ''}
          </span>
        </div>
      )}

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
      {rows.length === 0 ? (
        <div className="text-center py-10 text-[#444444] text-sm">Aucune ligne dans ce script.</div>
      ) : (
        <>
          {view === 'table' ? (
            <ScriptTableView
              columns={columns}
              categories={categories}
              rows={rows}
              readOnly
              renderRowComments={rowCommentNode}
            />
          ) : (
            <ScriptSummaryView
              columns={columns}
              categories={categories}
              rows={rows}
              beats={beats}
              renderRowComment={rowCommentNode}
              rowHasComments={(row) => !!row.id && comments.some((c) => c.block_id === row.id)}
            />
          )}

          {openRow && openRow.id && (
            <ClientRowCommentDock
              row={openRow}
              rowTitle={rowPreview(openRow, columns)}
              blockColor={openRowColor}
              comments={comments}
              clientId={clientId}
              canComment={isAuthenticated}
              onAdd={handleAddComment}
              onResolve={handleResolve}
              onClose={() => setOpenRowKey(null)}
            />
          )}
        </>
      )}
    </div>
  )
}
