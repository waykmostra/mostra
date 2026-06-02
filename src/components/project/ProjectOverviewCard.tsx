'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Building2,
  Activity,
  CalendarClock,
  Euro,
  CreditCard,
  UserCircle,
  FileText,
  Receipt,
  Pencil,
  Check,
  X,
  Loader2,
  ExternalLink,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils/dates'
import { updateProjectMeta, type UpdateProjectMetaInput } from '@/app/projects/actions'
import type { Client, PaymentStatus, PhaseStatus, Profile, Project, ProjectPhase } from '@/lib/types'

// ─── Meta ───────────────────────────────────────────────────────

const PAYMENT_META: Record<PaymentStatus, { label: string; color: string }> = {
  pending:  { label: 'En attente', color: '#6B7280' },
  invoiced: { label: 'Facturé',    color: '#3B82F6' },
  partial:  { label: 'Partiel',    color: '#F59E0B' },
  paid:     { label: 'Payé',       color: '#22C55E' },
  overdue:  { label: 'En retard',  color: '#EF4444' },
}

const PHASE_STATUS_META: Record<PhaseStatus, { label: string; color: string }> = {
  pending:     { label: 'En attente',  color: '#6B7280' },
  in_progress: { label: 'En cours',    color: '#3B82F6' },
  in_review:   { label: 'En révision', color: '#F59E0B' },
  approved:    { label: 'Approuvé',    color: '#22C55E' },
  completed:   { label: 'Terminé',     color: '#22C55E' },
}

function computeCurrentStep(phases: ProjectPhase[]): { label: string; sub: string; color: string } {
  if (phases.length === 0) return { label: 'Aucune phase', sub: '', color: '#6B7280' }
  const active = phases.find((p) => p.status === 'in_progress' || p.status === 'in_review')
  if (active) {
    const meta = PHASE_STATUS_META[active.status]
    return { label: active.name, sub: meta.label, color: meta.color }
  }
  const pending = phases.find((p) => p.status === 'pending')
  if (pending) return { label: pending.name, sub: 'À venir', color: '#6B7280' }
  return { label: 'Production terminée', sub: '', color: '#22C55E' }
}

function deadlineBadge(deadline: string | null): { label: string; color: string } | null {
  if (!deadline) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(deadline)
  d.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000)
  if (diff < 0) return { label: `Retard ${Math.abs(diff)} j`, color: '#EF4444' }
  if (diff === 0) return { label: "Aujourd'hui", color: '#EF4444' }
  if (diff <= 7) return { label: `J-${diff}`, color: '#F59E0B' }
  return { label: `J-${diff}`, color: '#22C55E' }
}

// ─── Cell shell ─────────────────────────────────────────────────

function CellShell({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg px-3 py-2.5 group min-w-0">
      <p className="text-[10px] uppercase tracking-widest text-[#444444] font-medium mb-1.5 flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      {children}
    </div>
  )
}

// ─── Inline editable cell (date / number / text) ────────────────

function InlineEditCell({
  icon,
  label,
  display,
  inputType,
  rawValue,
  placeholder,
  onSave,
}: {
  icon: React.ReactNode
  label: string
  display: React.ReactNode
  inputType: 'date' | 'number' | 'text'
  rawValue: string
  placeholder?: string
  onSave: (raw: string) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(rawValue)
  const [isPending, startTransition] = useTransition()

  function open() {
    setDraft(rawValue)
    setEditing(true)
  }

  function save() {
    startTransition(async () => {
      const ok = await onSave(draft)
      if (ok) setEditing(false)
    })
  }

  return (
    <CellShell icon={icon} label={label}>
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            type={inputType}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') setEditing(false)
            }}
            placeholder={placeholder}
            autoFocus
            disabled={isPending}
            step={inputType === 'number' ? '0.01' : undefined}
            min={inputType === 'number' ? '0' : undefined}
            className="
              flex-1 min-w-0 bg-[#1a1a1a] border border-[#333333] rounded px-1.5 py-1
              text-xs text-white focus:outline-none focus:border-[#555555]
              disabled:opacity-50 [color-scheme:dark]
            "
          />
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="p-1 rounded text-[#22C55E] hover:bg-[#22C55E]/10 transition-colors flex-shrink-0"
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={isPending}
            className="p-1 rounded text-[#666666] hover:bg-[#222222] transition-colors flex-shrink-0"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">{display}</div>
          <button
            type="button"
            onClick={open}
            className="
              opacity-0 group-hover:opacity-100 transition-opacity
              p-1 rounded text-[#444444] hover:text-white hover:bg-[#222222] flex-shrink-0
            "
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      )}
    </CellShell>
  )
}

// ─── Main card ──────────────────────────────────────────────────

interface ProjectOverviewCardProps {
  project: Project
  client: Client | null
  projectManager: Profile | null
  phases: ProjectPhase[]
}

export default function ProjectOverviewCard({
  project,
  client,
  projectManager,
  phases,
}: ProjectOverviewCardProps) {
  const [meta, setMeta] = useState({
    deadline: project.deadline ?? null,
    value_eur: project.value_eur ?? null,
    // Fallback 'pending' si la migration 019 n'est pas encore appliquée (colonne absente).
    payment_status: project.payment_status ?? 'pending',
    quote_url: project.quote_url ?? null,
    invoice_url: project.invoice_url ?? null,
  })

  const step = computeCurrentStep(phases)
  const dl = deadlineBadge(meta.deadline)
  const pay = PAYMENT_META[meta.payment_status] ?? PAYMENT_META.pending

  async function persist(
    patch: UpdateProjectMetaInput,
    optimistic: Partial<typeof meta>,
  ): Promise<boolean> {
    const prev = meta
    setMeta((m) => ({ ...m, ...optimistic }))
    const res = await updateProjectMeta(project.id, patch)
    if (!res.success) {
      setMeta(prev)
      toast.error(res.error)
      return false
    }
    return true
  }

  return (
    <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Vue d&apos;ensemble</h2>
        <span className="text-[10px] text-[#444444] uppercase tracking-widest">360°</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Client */}
        <CellShell icon={<Building2 className="h-3.5 w-3.5" />} label="Client">
          {client ? (
            <Link
              href={`/clients/${client.id}`}
              className="flex items-center gap-1 text-sm text-white hover:text-[#00D76B] transition-colors group/link"
            >
              <span className="truncate">{client.company_name || client.contact_name}</span>
              <ChevronRight className="h-3 w-3 flex-shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" />
            </Link>
          ) : (
            <p className="text-sm text-[#555555] italic">Non rattaché</p>
          )}
        </CellShell>

        {/* Étape actuelle */}
        <CellShell icon={<Activity className="h-3.5 w-3.5" />} label="Étape actuelle">
          <div className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: step.color }}
            />
            <span className="text-sm text-white truncate">{step.label}</span>
          </div>
          <p className="text-[10px] mt-0.5 tabular-nums" style={{ color: step.color }}>
            {step.sub ? `${step.sub} · ` : ''}
            {project.progress}%
          </p>
        </CellShell>

        {/* Deadline */}
        <InlineEditCell
          icon={<CalendarClock className="h-3.5 w-3.5" />}
          label="Deadline"
          inputType="date"
          rawValue={meta.deadline ?? ''}
          onSave={(raw) => persist({ deadline: raw || null }, { deadline: raw || null })}
          display={
            meta.deadline ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-white">{formatDate(meta.deadline)}</span>
                {dl && (
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border whitespace-nowrap"
                    style={{
                      color: dl.color,
                      backgroundColor: `${dl.color}1a`,
                      borderColor: `${dl.color}33`,
                    }}
                  >
                    {dl.label}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#555555] italic">—</p>
            )
          }
        />

        {/* Paiement */}
        <CellShell icon={<CreditCard className="h-3.5 w-3.5" />} label="Paiement">
          <div className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: pay.color }}
            />
            <select
              value={meta.payment_status}
              onChange={(e) =>
                persist(
                  { payment_status: e.target.value as PaymentStatus },
                  { payment_status: e.target.value as PaymentStatus },
                )
              }
              className="bg-transparent text-sm focus:outline-none cursor-pointer -ml-0.5"
              style={{ color: pay.color }}
            >
              {Object.entries(PAYMENT_META).map(([k, m]) => (
                <option key={k} value={k} className="bg-[#1a1a1a] text-white">
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </CellShell>

        {/* Valeur */}
        <InlineEditCell
          icon={<Euro className="h-3.5 w-3.5" />}
          label="Valeur"
          inputType="number"
          placeholder="0"
          rawValue={meta.value_eur != null ? String(meta.value_eur) : ''}
          onSave={(raw) => {
            const trimmed = raw.trim()
            const num = trimmed === '' ? null : Number(trimmed)
            if (num !== null && (Number.isNaN(num) || num < 0)) {
              toast.error('Valeur invalide.')
              return Promise.resolve(false)
            }
            return persist({ value_eur: num }, { value_eur: num })
          }}
          display={
            meta.value_eur != null ? (
              <p className="text-sm text-white tabular-nums font-medium">
                {meta.value_eur.toLocaleString('fr-FR')} €
              </p>
            ) : (
              <p className="text-sm text-[#555555] italic">—</p>
            )
          }
        />

        {/* Assigné à (PM) */}
        <CellShell icon={<UserCircle className="h-3.5 w-3.5" />} label="Assigné à">
          {projectManager ? (
            <p className="text-sm text-white truncate">{projectManager.full_name}</p>
          ) : (
            <p className="text-sm text-[#555555] italic">Non assigné</p>
          )}
        </CellShell>

        {/* Devis */}
        <InlineEditCell
          icon={<FileText className="h-3.5 w-3.5" />}
          label="Devis"
          inputType="text"
          placeholder="https://…"
          rawValue={meta.quote_url ?? ''}
          onSave={(raw) => persist({ quote_url: raw || null }, { quote_url: raw || null })}
          display={
            meta.quote_url ? (
              <a
                href={meta.quote_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-[#00D76B] hover:underline truncate"
              >
                Voir le devis
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
            ) : (
              <p className="text-sm text-[#555555] italic">—</p>
            )
          }
        />

        {/* Facture */}
        <InlineEditCell
          icon={<Receipt className="h-3.5 w-3.5" />}
          label="Facture"
          inputType="text"
          placeholder="https://…"
          rawValue={meta.invoice_url ?? ''}
          onSave={(raw) => persist({ invoice_url: raw || null }, { invoice_url: raw || null })}
          display={
            meta.invoice_url ? (
              <a
                href={meta.invoice_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-[#00D76B] hover:underline truncate"
              >
                Voir la facture
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
            ) : (
              <p className="text-sm text-[#555555] italic">—</p>
            )
          }
        />
      </div>
    </div>
  )
}
