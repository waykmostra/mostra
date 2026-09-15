'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Search,
  ChevronDown,
  Settings2,
  Mail,
  Languages,
  Filter,
  X,
  UserRound,
} from 'lucide-react'
import { AVAILABILITY_META } from './teamMeta'
import RolesManager from './RolesManager'
import type { TeamAvailability, TeamMemberWithRoles, TeamRole } from '@/lib/types'

// Nb de cartes visibles quand une section est repliée (réutilise le repli du CRM).
const COLLAPSED_COUNT = 6

// Clé spéciale pour la section des intervenants sans métier.
const NO_ROLE = '__none__'

interface TeamViewProps {
  initialMembers: TeamMemberWithRoles[]
  initialRoles: TeamRole[]
}

export default function TeamView({ initialMembers, initialRoles }: TeamViewProps) {
  const [members, setMembers] = useState<TeamMemberWithRoles[]>(initialMembers)
  const [roles, setRoles] = useState<TeamRole[]>(initialRoles)
  const [search, setSearch] = useState('')
  const [availFilter, setAvailFilter] = useState<TeamAvailability | 'all'>('all')
  const [manageOpen, setManageOpen] = useState(false)

  // ── Filtres ──
  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (availFilter !== 'all' && m.availability !== availFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const hay = [
          m.contact_name,
          m.email,
          m.languages,
          m.notes,
          ...(m.tags ?? []),
          ...m.roles.map((r) => r.name),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [members, search, availFilter])

  // ── Groupage par métier (un membre multi-métier apparaît dans chaque section) ──
  const sections = useMemo(() => {
    const list = roles.map((role) => ({
      role,
      members: filtered.filter((m) => m.roles.some((r) => r.id === role.id)),
    }))
    const orphans = filtered.filter((m) => m.roles.length === 0)
    return { list, orphans }
  }, [roles, filtered])

  const isFiltering = search.trim() !== '' || availFilter !== 'all'
  const activeFilters = (search ? 1 : 0) + (availFilter !== 'all' ? 1 : 0)

  // ── Sync local après gestion des métiers (évite un refetch) ──
  function handleRoleCreated(role: TeamRole) {
    setRoles((prev) => [...prev, role].sort((a, b) => a.sort_order - b.sort_order))
  }
  function handleRoleUpdated(id: string, patch: { name?: string; color?: string }) {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setMembers((prev) =>
      prev.map((m) => ({
        ...m,
        roles: m.roles.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      })),
    )
  }
  function handleRoleDeleted(id: string) {
    setRoles((prev) => prev.filter((r) => r.id !== id))
    setMembers((prev) =>
      prev.map((m) => ({ ...m, roles: m.roles.filter((r) => r.id !== id) })),
    )
  }

  const hasMembers = members.length > 0

  return (
    <div className="space-y-5">
      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Chercher un nom, un métier, une langue…"
            className="
              w-full pl-9 pr-3 py-2 rounded-lg text-sm
              bg-surface border border-line text-ink
              placeholder-faint
              focus:outline-none focus:border-line-strong
            "
          />
        </div>

        {/* Availability filter */}
        <select
          value={availFilter}
          onChange={(e) => setAvailFilter(e.target.value as TeamAvailability | 'all')}
          className="
            px-3 py-2 rounded-lg text-sm
            bg-surface border border-line text-ink
            focus:outline-none focus:border-line-strong
            cursor-pointer
          "
        >
          <option value="all">Toutes dispos</option>
          {(Object.keys(AVAILABILITY_META) as TeamAvailability[]).map((a) => (
            <option key={a} value={a}>
              {AVAILABILITY_META[a].label}
            </option>
          ))}
        </select>

        {/* Reset */}
        {activeFilters > 0 && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setAvailFilter('all')
            }}
            className="
              inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs
              bg-surface-2 border border-line text-dim hover:text-ink
              transition-colors
            "
          >
            <X className="h-3 w-3" />
            Réinitialiser ({activeFilters})
          </button>
        )}

        <div className="flex-1" />

        {/* Manage métiers */}
        <button
          type="button"
          onClick={() => setManageOpen(true)}
          className="
            inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm
            bg-surface border border-line text-dim hover:text-ink hover:border-line-strong
            transition-colors
          "
        >
          <Settings2 className="h-4 w-4" />
          Métiers
        </button>
      </div>

      {/* ── Empty state global ───────────────────────────────────── */}
      {!hasMembers && (
        <div className="bg-surface border border-line rounded-xl p-10 flex flex-col items-center gap-3">
          <UserRound className="h-8 w-8 text-[rgb(var(--c-border))]" />
          <p className="text-sm text-faint">Aucun intervenant pour le moment.</p>
          <Link
            href="/team/new"
            className="text-xs text-brand hover:underline"
          >
            Ajouter le premier intervenant
          </Link>
        </div>
      )}

      {/* ── Aucun résultat (filtres) ─────────────────────────────── */}
      {hasMembers && filtered.length === 0 && (
        <div className="bg-surface border border-line rounded-xl p-10 flex flex-col items-center gap-3">
          <Filter className="h-8 w-8 text-[rgb(var(--c-border))]" />
          <p className="text-sm text-faint">Aucun intervenant ne correspond à ces filtres.</p>
        </div>
      )}

      {/* ── Sections par métier ──────────────────────────────────── */}
      {hasMembers && filtered.length > 0 && (
        <div className="space-y-4">
          {sections.list.map(({ role, members: roleMembers }) => {
            // On masque une section vide seulement quand on filtre.
            if (roleMembers.length === 0 && isFiltering) return null
            return (
              <RoleSection
                key={role.id}
                id={role.id}
                label={role.name}
                color={role.color}
                members={roleMembers}
              />
            )
          })}

          {/* Sans métier */}
          {sections.orphans.length > 0 && (
            <RoleSection
              key={NO_ROLE}
              id={NO_ROLE}
              label="Sans métier"
              color="#64748B"
              members={sections.orphans}
            />
          )}
        </div>
      )}

      {/* ── Modal gestion des métiers ────────────────────────────── */}
      {manageOpen && (
        <RolesManager
          roles={roles}
          onClose={() => setManageOpen(false)}
          onCreated={handleRoleCreated}
          onUpdated={handleRoleUpdated}
          onDeleted={handleRoleDeleted}
        />
      )}
    </div>
  )
}

// ─── Section repliable (un métier) ──────────────────────────────

function RoleSection({
  label,
  color,
  members,
}: {
  id: string
  label: string
  color: string
  members: TeamMemberWithRoles[]
}) {
  const [expanded, setExpanded] = useState(false)

  const hasOverflow = members.length > COLLAPSED_COUNT
  const visible = expanded ? members : members.slice(0, COLLAPSED_COUNT)
  const hiddenCount = members.length - visible.length

  return (
    <section className="rounded-xl border border-line bg-surface">
      {/* Header — cliquable pour replier / déplier */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 border-b border-line flex items-center justify-between hover:bg-white/[0.02] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-sm font-semibold text-ink">{label}</span>
          <span
            className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded ml-1"
            style={{ color, backgroundColor: `${color}15` }}
          >
            {members.length}
          </span>
        </div>
        {hasOverflow && (
          <ChevronDown
            className={`h-4 w-4 text-faint transition-transform ${expanded ? '' : '-rotate-90'}`}
          />
        )}
      </button>

      {/* Grille de cartes */}
      <div className="p-3">
        {members.length === 0 ? (
          <p className="text-[11px] text-faint text-center py-6 italic">
            Aucun intervenant dans ce métier.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visible.map((m) => (
                <MemberCard key={m.id} member={m} />
              ))}
            </div>
            {!expanded && hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="mt-3 w-full text-[11px] text-faint hover:text-ink py-1.5 rounded-md hover:bg-surface-2 transition-colors"
              >
                voir les {hiddenCount} autres
              </button>
            )}
          </>
        )}
      </div>
    </section>
  )
}

// ─── Carte membre ───────────────────────────────────────────────

function MemberCard({ member }: { member: TeamMemberWithRoles }) {
  const avail = AVAILABILITY_META[member.availability]
  const hasRate = member.daily_rate_eur !== null || member.project_rate_eur !== null

  return (
    <Link
      href={`/team/${member.id}`}
      className="
        group rounded-lg border bg-surface-2 border-line hover:border-line-strong
        transition-colors p-3.5 flex flex-col gap-3
      "
    >
      {/* Header carte */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-brand">
              {member.contact_name[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink truncate group-hover:text-brand transition-colors">
              {member.contact_name}
            </p>
            {member.roles.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {member.roles.map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium"
                    style={{ color: r.color, backgroundColor: `${r.color}1a` }}
                  >
                    {r.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pastille dispo */}
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border flex-shrink-0"
          style={{ color: avail.color, backgroundColor: avail.bg, borderColor: `${avail.color}40` }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: avail.color }} />
          {avail.label}
        </span>
      </div>

      {/* Détails */}
      <div className="space-y-1">
        {member.email && (
          <p className="text-[11px] text-faint truncate flex items-center gap-1.5">
            <Mail className="h-3 w-3 flex-shrink-0" />
            {member.email}
          </p>
        )}
        {member.languages && (
          <p className="text-[11px] text-faint truncate flex items-center gap-1.5">
            <Languages className="h-3 w-3 flex-shrink-0" />
            {member.languages}
          </p>
        )}
        {hasRate && (
          <p className="text-[11px] text-dim tabular-nums flex items-center gap-2">
            {member.daily_rate_eur !== null && (
              <span>{member.daily_rate_eur.toLocaleString('fr-FR')} €/j</span>
            )}
            {member.project_rate_eur !== null && (
              <span className="text-faint">
                {member.daily_rate_eur !== null && '· '}
                {member.project_rate_eur.toLocaleString('fr-FR')} €/projet
              </span>
            )}
          </p>
        )}
      </div>

      {/* Tags */}
      {member.tags && member.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {member.tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] text-dim bg-surface-3 border border-line"
            >
              {t}
            </span>
          ))}
          {member.tags.length > 4 && (
            <span className="text-[9px] text-faint">+{member.tags.length - 4}</span>
          )}
        </div>
      )}
    </Link>
  )
}
