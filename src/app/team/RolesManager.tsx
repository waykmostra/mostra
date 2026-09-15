'use client'

import { useState, useTransition } from 'react'
import { X, Plus, Trash2, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createRole, updateRole, deleteRole } from './actions'
import { ROLE_COLORS } from './teamMeta'
import type { TeamRole } from '@/lib/types'

interface RolesManagerProps {
  roles: TeamRole[]
  onClose: () => void
  onCreated: (role: TeamRole) => void
  onUpdated: (id: string, patch: { name?: string; color?: string }) => void
  onDeleted: (id: string) => void
}

export default function RolesManager({
  roles,
  onClose,
  onCreated,
  onUpdated,
  onDeleted,
}: RolesManagerProps) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(ROLE_COLORS[0])
  const [isPending, startTransition] = useTransition()

  function handleCreate() {
    const name = newName.trim()
    if (!name) {
      toast.error('Donne un nom au métier.')
      return
    }
    startTransition(async () => {
      const result = await createRole(name, newColor)
      if (result.success) {
        onCreated({
          id: result.roleId,
          name,
          color: newColor,
          sort_order: roles.length,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        setNewName('')
        toast.success(`Métier « ${name} » ajouté`)
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-surface border border-line rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div>
            <h2 className="text-sm font-semibold text-ink">Métiers</h2>
            <p className="text-[11px] text-faint mt-0.5">
              Ajoute, renomme ou supprime les métiers de ton équipe.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-faint hover:text-ink hover:bg-surface-2 transition-colors"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Liste */}
        <div className="max-h-[50vh] overflow-y-auto px-5 py-4 space-y-2">
          {roles.length === 0 ? (
            <p className="text-xs text-faint italic text-center py-4">
              Aucun métier. Ajoute-en un ci-dessous.
            </p>
          ) : (
            roles.map((role) => (
              <RoleRow
                key={role.id}
                role={role}
                disabled={isPending}
                onUpdated={onUpdated}
                onDeleted={onDeleted}
              />
            ))
          )}
        </div>

        {/* Ajout */}
        <div className="px-5 py-4 border-t border-line space-y-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {ROLE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className={`w-5 h-5 rounded-full transition-transform ${
                  newColor === c ? 'ring-2 ring-white/60 scale-110' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Couleur ${c}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
              }}
              placeholder="ex. Illustrateur, UI designer…"
              disabled={isPending}
              className="
                flex-1 px-3 py-2 rounded-lg text-sm
                bg-surface border border-line text-ink placeholder-faint
                focus:outline-none focus:border-line-strong disabled:opacity-50
              "
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={isPending}
              className="
                inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
                bg-brand text-ink hover:bg-brand transition-colors
                disabled:opacity-50
              "
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Ajouter
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Ligne métier (rename inline + recolor + delete) ────────────

function RoleRow({
  role,
  disabled,
  onUpdated,
  onDeleted,
}: {
  role: TeamRole
  disabled: boolean
  onUpdated: (id: string, patch: { name?: string; color?: string }) => void
  onDeleted: (id: string) => void
}) {
  const [name, setName] = useState(role.name)
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()

  function commitName() {
    const clean = name.trim()
    if (!clean || clean === role.name) {
      setName(role.name)
      return
    }
    startTransition(async () => {
      const result = await updateRole(role.id, { name: clean })
      if (result.success) {
        onUpdated(role.id, { name: clean })
      } else {
        setName(role.name)
        toast.error(result.error)
      }
    })
  }

  function changeColor(color: string) {
    startTransition(async () => {
      const result = await updateRole(role.id, { color })
      if (result.success) onUpdated(role.id, { color })
      else toast.error(result.error)
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteRole(role.id)
      if (result.success) {
        onDeleted(role.id)
        toast.success(`Métier « ${role.name} » supprimé`)
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="flex items-center gap-2 bg-surface border border-line rounded-lg px-2.5 py-2">
      {/* Couleur (popover simple) */}
      <div className="relative group flex-shrink-0">
        <span
          className="block w-3.5 h-3.5 rounded-full cursor-pointer"
          style={{ backgroundColor: role.color }}
        />
        <div className="absolute left-0 top-full mt-1 z-10 hidden group-hover:flex flex-wrap gap-1 p-1.5 bg-surface-2 border border-line rounded-lg w-32 shadow-xl">
          {ROLE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => changeColor(c)}
              className="w-4 h-4 rounded-full hover:scale-110 transition-transform"
              style={{ backgroundColor: c }}
              aria-label={`Couleur ${c}`}
            />
          ))}
        </div>
      </div>

      {/* Nom éditable */}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') setName(role.name)
        }}
        disabled={disabled || isPending}
        className="
          flex-1 min-w-0 bg-transparent text-sm text-ink
          focus:outline-none focus:bg-surface-2 rounded px-1.5 py-1 -mx-1.5
          disabled:opacity-50
        "
      />

      {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-faint" />}

      {/* Delete (confirm en 2 temps) */}
      {confirming ? (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="p-1 rounded text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
            aria-label="Confirmer la suppression"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={isPending}
            className="p-1 rounded text-faint hover:bg-surface-3 transition-colors"
            aria-label="Annuler"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={disabled || isPending}
          className="p-1 rounded text-faint hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors flex-shrink-0 disabled:opacity-50"
          aria-label="Supprimer le métier"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
