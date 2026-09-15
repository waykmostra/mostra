'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { createTeamMember } from '../actions'
import { AVAILABILITY_META, AVAILABILITY_ORDER } from '../teamMeta'
import type { TeamAvailability, TeamRole } from '@/lib/types'

// ── Zod schema ───────────────────────────────────────────────────

const availabilityValues = AVAILABILITY_ORDER as [TeamAvailability, ...TeamAvailability[]]

const schema = z.object({
  contactName: z.string().min(1, 'Le nom est requis').max(100, 'Trop long'),
  email: z
    .string()
    .max(150)
    .optional()
    .refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), 'Email invalide'),
  phone: z.string().max(30, 'Numéro trop long').optional(),
  portfolioUrl: z.string().max(300).optional(),
  languages: z.string().max(120).optional(),
  dailyRateEur: z.coerce.number().min(0, 'Doit être positif').optional().or(z.literal('')),
  projectRateEur: z.coerce.number().min(0, 'Doit être positif').optional().or(z.literal('')),
  availability: z.enum(availabilityValues),
  tags: z.string().max(300).optional(),
  notes: z.string().max(2000).optional(),
})

type FormValues = z.input<typeof schema>

// ── Helpers UI ───────────────────────────────────────────────────

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-dim mb-1.5">
      {children}
    </label>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 text-xs text-[#EF4444]">{message}</p>
}

const inputClass = `
  w-full px-3 py-2.5 rounded-lg text-sm
  bg-surface border border-line text-ink placeholder:text-faint
  outline-none transition-colors
  focus:border-brand focus:ring-1 focus:ring-brand/30
  disabled:opacity-50
`

const selectClass = `
  w-full px-3 py-2.5 rounded-lg text-sm
  bg-surface border border-line text-ink
  outline-none transition-colors
  focus:border-brand focus:ring-1 focus:ring-brand/30
  disabled:opacity-50
`

// ── Composant ────────────────────────────────────────────────────

export default function NewTeamMemberForm({ roles }: { roles: TeamRole[] }) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { availability: 'active' },
  })

  function toggleRole(id: string) {
    setSelectedRoles((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    )
  }

  async function onSubmit(values: FormValues) {
    setServerError(null)

    const toNum = (v: unknown): number | null => {
      if (v === '' || v === undefined || v === null) return null
      const n = typeof v === 'number' ? v : Number(v)
      return Number.isNaN(n) ? null : n
    }

    const tags = (values.tags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    const result = await createTeamMember({
      contactName: values.contactName,
      email: values.email || undefined,
      phone: values.phone || undefined,
      portfolioUrl: values.portfolioUrl || undefined,
      languages: values.languages || undefined,
      dailyRateEur: toNum(values.dailyRateEur),
      projectRateEur: toNum(values.projectRateEur),
      availability: values.availability as TeamAvailability,
      tags,
      notes: values.notes || undefined,
      roleIds: selectedRoles,
    })

    if (!result.success) {
      setServerError(result.error)
      return
    }

    toast.success(`Intervenant « ${values.contactName} » ajouté !`)
    router.push(`/team/${result.memberId}`)
    router.refresh()
  }

  return (
    <div className="max-w-xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/team"
          className="inline-flex items-center gap-1.5 text-sm text-faint hover:text-ink transition-colors mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          Retour à l&apos;équipe
        </Link>
        <h1 className="text-xl font-semibold text-ink">Nouvel intervenant</h1>
        <p className="text-sm text-faint mt-0.5">
          Ajoute une fiche à ton annuaire. Aucun compte n&apos;est créé — c&apos;est privé.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        {/* ── Nom ── */}
        <div>
          <Label htmlFor="contactName">
            Nom <span className="text-brand">*</span>
          </Label>
          <input
            id="contactName"
            type="text"
            placeholder="ex. Marc Dubois"
            {...register('contactName')}
            className={inputClass}
            disabled={isSubmitting}
          />
          <FieldError message={errors.contactName?.message} />
        </div>

        {/* ── Métiers ── */}
        <div>
          <Label>Métiers</Label>
          {roles.length === 0 ? (
            <p className="text-xs text-faint italic">
              Aucun métier défini. Tu pourras en ajouter depuis l&apos;annuaire (bouton « Métiers »).
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {roles.map((r) => {
                const active = selectedRoles.includes(r.id)
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleRole(r.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                    style={{
                      color: active ? r.color : 'rgb(var(--c-text-dim))',
                      backgroundColor: active ? `${r.color}1a` : 'transparent',
                      borderColor: active ? `${r.color}55` : 'rgb(var(--c-border))',
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: r.color }} />
                    {r.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Email ── */}
        <div>
          <Label htmlFor="email">Email</Label>
          <input
            id="email"
            type="email"
            placeholder="marc@exemple.com"
            {...register('email')}
            className={inputClass}
            disabled={isSubmitting}
          />
          <FieldError message={errors.email?.message} />
        </div>

        {/* ── Téléphone ── */}
        <div>
          <Label htmlFor="phone">Téléphone / WhatsApp</Label>
          <input
            id="phone"
            type="tel"
            placeholder="+33 6 00 00 00 00"
            {...register('phone')}
            className={inputClass}
            disabled={isSubmitting}
          />
          <FieldError message={errors.phone?.message} />
        </div>

        {/* ── Portfolio ── */}
        <div>
          <Label htmlFor="portfolioUrl">Portfolio / lien</Label>
          <input
            id="portfolioUrl"
            type="text"
            placeholder="Behance, Instagram, démo VO…"
            {...register('portfolioUrl')}
            className={inputClass}
            disabled={isSubmitting}
          />
          <FieldError message={errors.portfolioUrl?.message} />
        </div>

        {/* ── Langues ── */}
        <div>
          <Label htmlFor="languages">Langues</Label>
          <input
            id="languages"
            type="text"
            placeholder="ex. FR, EN"
            {...register('languages')}
            className={inputClass}
            disabled={isSubmitting}
          />
          <FieldError message={errors.languages?.message} />
        </div>

        {/* ── Tarifs ── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="dailyRateEur">Tarif €/jour</Label>
            <input
              id="dailyRateEur"
              type="number"
              min={0}
              step="any"
              placeholder="ex. 400"
              {...register('dailyRateEur')}
              className={inputClass}
              disabled={isSubmitting}
            />
            <FieldError message={errors.dailyRateEur?.message as string | undefined} />
          </div>
          <div>
            <Label htmlFor="projectRateEur">Tarif €/projet</Label>
            <input
              id="projectRateEur"
              type="number"
              min={0}
              step="any"
              placeholder="ex. 1500"
              {...register('projectRateEur')}
              className={inputClass}
              disabled={isSubmitting}
            />
            <FieldError message={errors.projectRateEur?.message as string | undefined} />
          </div>
        </div>

        {/* ── Disponibilité ── */}
        <div>
          <Label htmlFor="availability">Disponibilité</Label>
          <select
            id="availability"
            {...register('availability')}
            className={selectClass}
            disabled={isSubmitting}
          >
            {AVAILABILITY_ORDER.map((a) => (
              <option key={a} value={a}>
                {AVAILABILITY_META[a].label}
              </option>
            ))}
          </select>
        </div>

        {/* ── Tags ── */}
        <div>
          <Label htmlFor="tags">Spécialités / tags</Label>
          <input
            id="tags"
            type="text"
            placeholder="séparés par des virgules : 2D, After Effects, corporate"
            {...register('tags')}
            className={inputClass}
            disabled={isSubmitting}
          />
          <FieldError message={errors.tags?.message} />
        </div>

        {/* ── Notes ── */}
        <div>
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            rows={3}
            placeholder="Contexte, style, dispo particulière…"
            {...register('notes')}
            className={`${inputClass} resize-none`}
            disabled={isSubmitting}
          />
          <FieldError message={errors.notes?.message} />
        </div>

        {/* ── Erreur serveur ── */}
        {serverError && (
          <div className="rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 px-4 py-3">
            <p className="text-sm text-[#EF4444]">{serverError}</p>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex items-center gap-3 pt-2">
          <Link
            href="/team"
            className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-center
              border border-line text-dim hover:text-ink hover:border-line-strong
              transition-colors"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium
              bg-brand text-ink hover:bg-brand active:bg-brand
              transition-colors disabled:opacity-60 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Ajouter l&apos;intervenant
          </button>
        </div>
      </form>
    </div>
  )
}
