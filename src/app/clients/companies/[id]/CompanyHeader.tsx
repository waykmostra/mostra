'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Globe, Pencil, Check, X, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { updateCompany, deleteCompany } from '../actions'
import type { Company } from '@/lib/types'

export default function CompanyHeader({ company: initial }: { company: Company }) {
  const router = useRouter()
  const [company, setCompany] = useState(initial)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(initial.name)
  const [website, setWebsite] = useState(initial.website ?? '')
  const [notes, setNotes] = useState(initial.notes ?? '')
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()

  function save() {
    const clean = name.trim()
    if (!clean) {
      toast.error('Le nom ne peut pas être vide.')
      return
    }
    startTransition(async () => {
      const res = await updateCompany(company.id, {
        name: clean,
        website: website.trim() || null,
        notes: notes.trim() || null,
      })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      setCompany((c) => ({ ...c, name: clean, website: website.trim() || null, notes: notes.trim() || null }))
      setEditing(false)
      toast.success('Société mise à jour')
      router.refresh()
    })
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteCompany(company.id)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Société supprimée')
      router.push('/clients/companies')
      router.refresh()
    })
  }

  const websiteHref = company.website
    ? company.website.startsWith('http')
      ? company.website
      : `https://${company.website}`
    : null

  return (
    <div className="bg-surface border border-line rounded-xl p-6">
      {editing ? (
        <div className="space-y-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom de la société"
            className="w-full bg-surface-2 border border-line-strong rounded-lg px-3 py-2 text-lg font-bold text-ink focus:outline-none focus:border-[rgb(var(--c-text-faint))]"
          />
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="Site web"
            className="w-full bg-surface-2 border border-line-strong rounded-lg px-3 py-2 text-sm text-ink placeholder-faint focus:outline-none focus:border-[rgb(var(--c-text-faint))]"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Notes (optionnel)"
            className="w-full bg-surface-2 border border-line-strong rounded-lg px-3 py-2 text-sm text-ink placeholder-faint focus:outline-none focus:border-[rgb(var(--c-text-faint))] resize-none"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setName(company.name)
                setWebsite(company.website ?? '')
                setNotes(company.notes ?? '')
                setEditing(false)
              }}
              disabled={isPending}
              className="px-3 py-1.5 rounded-lg text-xs text-dim hover:text-ink hover:bg-surface-2 transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand text-ink hover:bg-brand transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Enregistrer
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-7 w-7 text-brand" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-ink truncate">{company.name}</h1>
              {websiteHref && (
                <a
                  href={websiteHref}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-faint hover:text-brand transition-colors flex items-center gap-1 mt-0.5"
                >
                  <Globe className="h-3 w-3" />
                  {company.website}
                </a>
              )}
              {company.notes && (
                <p className="text-sm text-dim mt-1.5 whitespace-pre-wrap">{company.notes}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-line text-dim hover:text-ink hover:border-line-strong transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Modifier
            </button>
            {confirming ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={remove}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs border border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20 transition-colors disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Confirmer
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="p-2 rounded-lg text-faint hover:text-ink hover:bg-surface-2 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                title="Supprimer la société"
                className="p-2 rounded-lg border border-line text-faint hover:text-[#EF4444] hover:border-[#EF4444]/30 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
