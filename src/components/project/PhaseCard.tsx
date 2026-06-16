'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Brain,
  Palette,
  Film,
  MonitorPlay,
  Music,
  FileText,
  Lock,
  Eye,
  Upload,
  Send,
  Play,
  CheckCircle,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Loader2,
  X,
  Trash2,
  ClipboardList,
  Image as ImageIcon,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import StatusBadge from '@/components/shared/StatusBadge'
import FileUpload from '@/components/project/FileUpload'
import FileVersionHistory from '@/components/project/FileVersionHistory'
import { formatDate } from '@/lib/utils/dates'
import { startPhase, sendToReview, completePhase, unapprovePhase, deleteProjectPhase } from '@/app/projects/phase-actions'
import {
  startSubPhase,
  sendSubPhaseToReview,
  approveSubPhase,
  unapproveSubPhase,
} from '@/app/projects/sub-phase-actions'
import type { PhaseFile, PhaseStatus, ProjectPhase, SubPhase, UserRole } from '@/lib/types'

// ── Icônes par slug ───────────────────────────────────────────────

const PHASE_ICONS: Record<string, LucideIcon> = {
  // Nouveau pipeline
  analyse:   Brain,
  design:    Palette,
  audio:     Music,
  animation: Film,
  rendu:     MonitorPlay,
  // Étapes composables (migration 027 / part C)
  formulaire: ClipboardList,
  style:      ImageIcon,
  storyboard: LayoutGrid,
  video:      Film,
  // Ancien pipeline (rétro-compat)
  script: FileText,
  render: MonitorPlay,
}

// ── Props ─────────────────────────────────────────────────────────

interface PhaseCardProps {
  phase: ProjectPhase
  projectId: string
  isLast?: boolean
  canStart: boolean
  files: PhaseFile[]
  subPhases: SubPhase[]
  userRole: UserRole
}

type LoadingAction = 'start' | 'review' | 'complete' | 'unapprove' | null

// ── Composant principal ───────────────────────────────────────────

export default function PhaseCard({
  phase,
  projectId,
  isLast = false,
  canStart,
  files,
  subPhases,
  userRole,
}: PhaseCardProps) {
  const [loading, setLoading] = useState<LoadingAction>(null)
  const [confirmUnapprovePhase, setConfirmUnapprovePhase] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [subPhasesOpen, setSubPhasesOpen] = useState(
    // Auto-expand si phase active ou au moins une sous-phase active
    phase.status === 'in_progress' ||
      phase.status === 'in_review' ||
      subPhases.some((sp) => sp.status !== 'pending'),
  )
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isAdmin = userRole === 'admin'
  const canAct = userRole === 'admin'
  const isDone = phase.status === 'completed' || phase.status === 'approved'
  const isActive = phase.status === 'in_progress' || phase.status === 'in_review'
  const Icon = PHASE_ICONS[phase.slug] ?? FileText
  const hasSubPhases = subPhases.length > 0

  async function handle(action: NonNullable<LoadingAction>) {
    setLoading(action)
    let result
    if (action === 'start') result = await startPhase(phase.id)
    else if (action === 'review') result = await sendToReview(phase.id)
    else if (action === 'unapprove') result = await unapprovePhase(phase.id)
    else result = await completePhase(phase.id)
    setLoading(null)
    setConfirmUnapprovePhase(false)
    if (!result.success) toast.error(result.error)
  }

  async function handleDelete() {
    setDeleting(true)
    const result = await deleteProjectPhase(phase.id)
    setDeleting(false)
    if (!result.success) {
      toast.error(result.error)
      setConfirmDelete(false)
    }
  }

  return (
    <>
      <div className="relative flex gap-4">
        {/* Connecteur vertical */}
        {!isLast && (
          <div
            className="absolute left-[19px] top-[40px] bottom-[-12px] w-px"
            style={{ background: isDone ? '#00D76B' : '#2a2a2a' }}
          />
        )}

        {/* Icône circulaire */}
        <div
          className={`
            relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors
            ${
              isDone
                ? 'bg-[#00D76B]/10 border-[#00D76B]'
                : isActive
                  ? 'bg-[#1a1a1a] border-[#00D76B]'
                  : 'bg-[#111111] border-[#2a2a2a]'
            }
          `}
        >
          <Icon className={`h-4 w-4 ${isDone || isActive ? 'text-[#00D76B]' : 'text-[#444444]'}`} />
        </div>

        {/* Contenu */}
        <div
          className={`
            flex-1 mb-3 p-4 rounded-xl border transition-colors
            ${isActive ? 'bg-[#1a1a1a] border-[#3a3a3a]' : 'bg-[#111111] border-[#2a2a2a]'}
          `}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              {/* Nom + toggle sous-phases */}
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-medium text-white">{phase.name}</h3>
                {hasSubPhases && (
                  <button
                    type="button"
                    onClick={() => setSubPhasesOpen((v) => !v)}
                    className="flex items-center gap-0.5 text-[#444444] hover:text-[#00D76B] transition-colors"
                    title={subPhasesOpen ? 'Réduire' : 'Voir les sous-phases'}
                  >
                    {subPhasesOpen ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    <span className="text-[10px]">{subPhases.length}</span>
                  </button>
                )}
              </div>
              {phase.started_at && (
                <p className="text-xs text-[#666666] mt-0.5">
                  Démarré le {formatDate(phase.started_at)}
                </p>
              )}
              {phase.completed_at && (
                <p className="text-xs text-[#666666] mt-0.5">
                  Terminé le {formatDate(phase.completed_at)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <StatusBadge status={phase.status} />
              {isAdmin && (
                confirmDelete ? (
                  <span className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="px-2 py-1 rounded text-[10px] font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      {deleting ? '…' : 'Supprimer l’étape'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2 py-1 rounded text-[10px] text-[#888888] hover:text-white transition-colors"
                    >
                      Annuler
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    title="Supprimer cette étape"
                    aria-label="Supprimer cette étape"
                    className="w-6 h-6 flex items-center justify-center rounded-md text-[#555555] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )
              )}
            </div>
          </div>

          {/* ── Sous-phases (si présentes et développées) ── */}
          {hasSubPhases && subPhasesOpen && (
            <SubPhaseList
              subPhases={subPhases}
              projectId={projectId}
              phaseId={phase.id}
              phaseStatus={phase.status}
              canStart={canStart}
              canAct={canAct}
              isAdmin={isAdmin}
            />
          )}

          {/* Actions : comportement différent selon présence ou non de sous-phases */}
          {!hasSubPhases ? (
            /* Phases sans sous-phases (Animation, Rendu) → workflow fichiers complet */
            <PhaseActions
              status={phase.status}
              canStart={canStart}
              canAct={canAct}
              isAdmin={isAdmin}
              fileCount={files.length}
              loading={loading}
              confirmUnapprove={confirmUnapprovePhase}
              viewHref={`/projects/${projectId}/phases/${phase.id}/view`}
              onStart={() => handle('start')}
              onUpload={() => setUploadOpen(true)}
              onReview={() => handle('review')}
              onComplete={() => handle('complete')}
              onUnapproveRequest={() => setConfirmUnapprovePhase(true)}
              onUnapproveConfirm={() => handle('unapprove')}
            />
          ) : (
            /* Phases avec sous-phases → seul "Démarrer" est visible au niveau phase (si pending)
               Les sous-phases gèrent Review/Approve individuellement */
            phase.status === 'pending' && canAct && canStart ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#00D76B]/10 border border-[#00D76B]/20 text-[#00D76B] hover:bg-[#00D76B]/20 transition-colors disabled:opacity-40"
                disabled={!!loading}
                onClick={() => handle('start')}
              >
                {loading === 'start' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Démarrer la phase
              </button>
            ) : null
          )}

          {/* Historique des fichiers (seulement pour phases sans sous-phases) */}
          {!hasSubPhases && <FileVersionHistory files={files} />}
        </div>
      </div>

      {/* Modal d'upload */}
      {uploadOpen && (
        <UploadModal
          phaseId={phase.id}
          projectId={projectId}
          phaseSlug={phase.slug}
          phaseName={phase.name}
          onClose={() => setUploadOpen(false)}
        />
      )}
    </>
  )
}

// ── Liste des sous-phases avec actions ───────────────────────────

type SpLoading = Record<string, 'start' | 'review' | 'approve' | 'unapprove' | null>

interface SubPhaseListProps {
  subPhases: SubPhase[]
  projectId: string
  phaseId: string
  phaseStatus: PhaseStatus
  canStart: boolean   // la phase elle-même est démarrable (prev phase ok)
  canAct: boolean
  isAdmin: boolean
}

function SubPhaseList({
  subPhases,
  projectId,
  phaseId,
  phaseStatus,
  canStart,
  canAct,
  isAdmin,
}: SubPhaseListProps) {
  const [spLoading, setSpLoading] = useState<SpLoading>({})
  // 2-click confirm: stores the spId awaiting unapprove confirmation
  const [confirmUnapprove, setConfirmUnapprove] = useState<string | null>(null)

  async function handleSp(
    spId: string,
    action: 'start' | 'review' | 'approve' | 'unapprove',
  ) {
    setSpLoading((prev) => ({ ...prev, [spId]: action }))
    let result: { success: boolean; error?: string }
    if (action === 'start') result = await startSubPhase(spId)
    else if (action === 'review') result = await sendSubPhaseToReview(spId)
    else if (action === 'approve') result = await approveSubPhase(spId)
    else result = await unapproveSubPhase(spId)
    setSpLoading((prev) => ({ ...prev, [spId]: null }))
    setConfirmUnapprove(null)
    if (!result.success && 'error' in result) toast.error(result.error as string)
  }

  const btnBase =
    'inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  const btnGhost = `${btnBase} border border-[#2a2a2a] text-[#666666] hover:text-white hover:border-[#444444]`
  const btnGreen = `${btnBase} bg-[#00D76B]/10 border border-[#00D76B]/20 text-[#00D76B] hover:bg-[#00D76B]/20`
  const btnAmber = `${btnBase} bg-[#22C55E]/10 border border-[#22C55E]/20 text-[#22C55E] hover:bg-[#22C55E]/20`
  const btnRed = `${btnBase} bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20`

  return (
    <div className="mb-3 space-y-1.5 pl-1">
      <p className="text-[10px] text-[#444444] uppercase tracking-widest mb-2">Sous-phases</p>
      {subPhases.map((sp, i) => {
        const busy = !!spLoading[sp.id]
        const spHref = `/projects/${projectId}/phases/${phaseId}/sub/${sp.id}`

        // Startable si : user peut agir + phase démarrable + la sp précédente est done (ou c'est la première)
        const prevDone =
          i === 0 ||
          subPhases[i - 1].status === 'completed' ||
          subPhases[i - 1].status === 'approved'
        // Autoriser start même si la phase parente est encore pending (startSubPhase l'auto-démarre)
        const canStartSp = canAct && canStart && prevDone && sp.status === 'pending'
        const canReview = canAct && sp.status === 'in_progress'
        const canApproveSp = isAdmin && sp.status === 'in_review'
        const canUnapproveSp = isAdmin && (sp.status === 'completed' || sp.status === 'approved' || sp.status === 'in_review')
        const canView = sp.status !== 'pending'

        return (
          <div
            key={sp.id}
            className={`
              flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 px-3 py-2 rounded-lg border
              ${
                sp.status === 'in_progress' || sp.status === 'in_review'
                  ? 'bg-[#0a0a0a] border-[#2a2a2a]'
                  : 'bg-[#0d0d0d] border-[#1e1e1e]'
              }
            `}
          >
            {/* Nom + indicateur */}
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor:
                    sp.status === 'completed' || sp.status === 'approved'
                      ? '#22C55E'
                      : sp.status === 'in_review'
                        ? '#F59E0B'
                        : sp.status === 'in_progress'
                          ? '#00D76B'
                          : '#333333',
                }}
              />
              {canView ? (
                <Link
                  href={spHref}
                  className="text-xs truncate text-[#a0a0a0] hover:text-white transition-colors"
                >
                  {sp.name}
                </Link>
              ) : (
                <span className="text-xs truncate text-[#a0a0a0]">{sp.name}</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap sm:flex-shrink-0">
              <StatusBadge status={sp.status} className="text-[10px]" />

              {/* Voir — toujours visible dès que la sp n'est pas pending */}
              {canView && (
                <Link href={spHref} className={btnGhost}>
                  <Eye className="h-3 w-3" />
                  Voir
                </Link>
              )}

              {canStartSp && (
                <button
                  type="button"
                  className={btnGreen}
                  disabled={busy}
                  onClick={() => handleSp(sp.id, 'start')}
                >
                  {spLoading[sp.id] === 'start' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                  Démarrer
                </button>
              )}

              {canReview && (
                <button
                  type="button"
                  className={btnGhost}
                  disabled={busy}
                  onClick={() => handleSp(sp.id, 'review')}
                >
                  {spLoading[sp.id] === 'review' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  Review
                </button>
              )}

              {canApproveSp && (
                <button
                  type="button"
                  className={btnAmber}
                  disabled={busy}
                  onClick={() => handleSp(sp.id, 'approve')}
                >
                  {spLoading[sp.id] === 'approve' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCircle className="h-3 w-3" />
                  )}
                  Approuver
                </button>
              )}

              {/* Désapprouver — 2-click confirm */}
              {canUnapproveSp && (
                confirmUnapprove === sp.id ? (
                  <button
                    type="button"
                    className={btnRed}
                    disabled={busy}
                    onClick={() => handleSp(sp.id, 'unapprove')}
                  >
                    {spLoading[sp.id] === 'unapprove' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3 w-3" />
                    )}
                    Confirmer ?
                  </button>
                ) : (
                  <button
                    type="button"
                    className={btnGhost}
                    disabled={busy}
                    onClick={() => setConfirmUnapprove(sp.id)}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Désapprouver
                  </button>
                )
              )}

              {!canStartSp && sp.status === 'pending' && (
                <Lock className="h-3 w-3 text-[#333333]" />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Boutons d'action ──────────────────────────────────────────────

interface PhaseActionsProps {
  status: PhaseStatus
  canStart: boolean
  canAct: boolean
  isAdmin: boolean
  fileCount: number
  loading: LoadingAction
  confirmUnapprove: boolean
  viewHref: string
  onStart: () => void
  onUpload: () => void
  onReview: () => void
  onComplete: () => void
  onUnapproveRequest: () => void
  onUnapproveConfirm: () => void
}

function PhaseActions({
  status,
  canStart,
  canAct,
  isAdmin,
  fileCount,
  loading,
  confirmUnapprove,
  viewHref,
  onStart,
  onUpload,
  onReview,
  onComplete,
  onUnapproveRequest,
  onUnapproveConfirm,
}: PhaseActionsProps) {
  const btnBase =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  const btnGhost = `${btnBase} border border-[#2a2a2a] text-[#a0a0a0] hover:text-white hover:border-[#444444]`
  const btnPrimary = `${btnBase} bg-[#00D76B]/10 border border-[#00D76B]/20 text-[#00D76B] hover:bg-[#00D76B]/20`
  const btnGreen = `${btnBase} bg-[#22C55E]/10 border border-[#22C55E]/20 text-[#22C55E] hover:bg-[#22C55E]/20`
  const btnRed = `${btnBase} bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20`

  const busy = loading !== null

  // Pending ─────────────────────────────────────────────────────────
  if (status === 'pending') {
    if (!canAct || !canStart) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-[#444444]">
          <Lock className="h-3.5 w-3.5" />
          <span>En attente</span>
        </div>
      )
    }
    return (
      <button type="button" className={btnPrimary} disabled={busy} onClick={onStart}>
        {loading === 'start' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
        Démarrer
      </button>
    )
  }

  // In Progress ──────────────────────────────────────────────────────
  if (status === 'in_progress') {
    if (!canAct) return null
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {fileCount > 0 && (
          <Link href={viewHref} className={btnGhost}>
            <Eye className="h-3.5 w-3.5" />
            Voir fichiers
          </Link>
        )}
        <button type="button" className={btnGhost} disabled={busy} onClick={onUpload}>
          <Upload className="h-3.5 w-3.5" />
          Upload
        </button>
        <button
          type="button"
          className={btnPrimary}
          disabled={busy || fileCount === 0}
          title={fileCount === 0 ? 'Uploadez au moins un fichier' : undefined}
          onClick={onReview}
        >
          {loading === 'review' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Envoyer en review
        </button>
      </div>
    )
  }

  // In Review ────────────────────────────────────────────────────────
  if (status === 'in_review') {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <Link href={viewHref} className={btnGhost}>
          <Eye className="h-3.5 w-3.5" />
          Voir
        </Link>
        {isAdmin ? (
          <>
            <button type="button" className={btnGreen} disabled={busy} onClick={onComplete}>
              {loading === 'complete' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5" />
              )}
              Approuver
            </button>
            {confirmUnapprove ? (
              <button type="button" className={btnRed} disabled={busy} onClick={onUnapproveConfirm}>
                {loading === 'unapprove' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                Confirmer la désapprobation ?
              </button>
            ) : (
              <button type="button" className={btnGhost} disabled={busy} onClick={onUnapproveRequest}>
                <RotateCcw className="h-3.5 w-3.5" />
                Désapprouver
              </button>
            )}
          </>
        ) : (
          <span className="text-xs text-[#F59E0B]">En attente d&apos;approbation client</span>
        )}
      </div>
    )
  }

  // Completed / Approved ─────────────────────────────────────────────
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Link href={viewHref} className={btnGhost}>
        <Eye className="h-3.5 w-3.5" />
        Voir
      </Link>
      {isAdmin && (
        confirmUnapprove ? (
          <button
            type="button"
            className={btnRed}
            disabled={busy}
            onClick={onUnapproveConfirm}
          >
            {loading === 'unapprove' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            Confirmer la désapprobation ?
          </button>
        ) : (
          <button
            type="button"
            className={btnGhost}
            disabled={busy}
            onClick={onUnapproveRequest}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Désapprouver
          </button>
        )
      )}
    </div>
  )
}

// ── Modal d'upload ────────────────────────────────────────────────

interface UploadModalProps {
  phaseId: string
  projectId: string
  phaseSlug: string
  phaseName: string
  onClose: () => void
}

function UploadModal({ phaseId, projectId, phaseSlug, phaseName, onClose }: UploadModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Panneau */}
      <div className="relative z-10 w-full max-w-md bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold text-white">Upload un fichier</h3>
            <p className="text-xs text-[#666666] mt-0.5">{phaseName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full border border-[#2a2a2a] text-[#666666] hover:text-white hover:border-[#444444] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Zone d'upload */}
        <FileUpload
          phaseId={phaseId}
          projectId={projectId}
          phaseSlug={phaseSlug}
          onComplete={onClose}
        />
      </div>
    </div>
  )
}
