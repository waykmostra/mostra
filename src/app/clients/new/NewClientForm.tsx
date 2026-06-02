'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '../actions'
import type { ClientSource, ClientStatus } from '@/lib/types'

// ── Zod schema ───────────────────────────────────────────────────

const sourceValues = [
  'instagram',
  'linkedin',
  'word_of_mouth',
  'website',
  'referral',
  'cold_outreach',
  'other',
] as const

const statusValues = ['cold', 'interest', 'warm', 'active', 'former', 'lost'] as const

const schema = z.object({
  companyName: z.string().max(100, 'Trop long').optional(),
  contactName: z.string().min(1, 'Le nom du contact est requis').max(100, 'Trop long'),
  email: z
    .string()
    .max(150)
    .optional()
    .refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), 'Email invalide'),
  phone: z.string().max(30, 'Numéro trop long').optional(),
  website: z.string().max(200).optional(),
  source: z.enum(sourceValues),
  status: z.enum(statusValues),
  notes: z.string().max(2000).optional(),
})

type FormValues = z.infer<typeof schema>

const SOURCE_LABELS: Record<ClientSource, string> = {
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  word_of_mouth: 'Bouche à oreille',
  website: 'Site web',
  referral: 'Recommandation',
  cold_outreach: 'Démarchage à froid',
  other: 'Autre',
}

const STATUS_LABELS: Record<ClientStatus, string> = {
  cold: 'Froid',
  interest: 'Intérêt',
  warm: 'Chaud',
  active: 'Actif',
  former: 'Ancien',
  lost: 'Perdu',
}

// ── Helpers UI ───────────────────────────────────────────────────

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-[#a0a0a0] mb-1.5">
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
  bg-[#111111] border border-[#2a2a2a] text-white placeholder:text-[#444444]
  outline-none transition-colors
  focus:border-[#00D76B] focus:ring-1 focus:ring-[#00D76B]/30
  disabled:opacity-50
`

const selectClass = `
  w-full px-3 py-2.5 rounded-lg text-sm
  bg-[#111111] border border-[#2a2a2a] text-white
  outline-none transition-colors
  focus:border-[#00D76B] focus:ring-1 focus:ring-[#00D76B]/30
  disabled:opacity-50
`

// ── Composant ────────────────────────────────────────────────────

export default function NewClientForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { source: 'other', status: 'interest' },
  })

  async function onSubmit(values: FormValues) {
    setServerError(null)

    const result = await createClient({
      companyName: values.companyName || undefined,
      contactName: values.contactName,
      email: values.email || undefined,
      phone: values.phone || undefined,
      website: values.website || undefined,
      source: values.source as ClientSource,
      status: values.status as ClientStatus,
      notes: values.notes || undefined,
    })

    if (!result.success) {
      setServerError(result.error)
      return
    }

    toast.success(`Client "${values.companyName || values.contactName}" créé !`)
    router.push(`/clients/${result.clientId}`)
    router.refresh()
  }

  return (
    <div className="max-w-xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-sm text-[#666666] hover:text-white transition-colors mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          Retour aux clients
        </Link>
        <h1 className="text-xl font-semibold text-white">Nouveau client</h1>
        <p className="text-sm text-[#666666] mt-0.5">
          Crée une fiche CRM. Le compte connectable sera généré plus tard depuis la fiche client.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        {/* ── Société ── */}
        <div>
          <Label htmlFor="companyName">Société</Label>
          <input
            id="companyName"
            type="text"
            placeholder="ex. Acme Inc."
            {...register('companyName')}
            className={inputClass}
            disabled={isSubmitting}
          />
          <FieldError message={errors.companyName?.message} />
        </div>

        {/* ── Contact ── */}
        <div>
          <Label htmlFor="contactName">
            Nom du contact <span className="text-[#00D76B]">*</span>
          </Label>
          <input
            id="contactName"
            type="text"
            placeholder="ex. Marie Dupont"
            {...register('contactName')}
            className={inputClass}
            disabled={isSubmitting}
          />
          <FieldError message={errors.contactName?.message} />
        </div>

        {/* ── Email ── */}
        <div>
          <Label htmlFor="email">Email</Label>
          <input
            id="email"
            type="email"
            placeholder="client@entreprise.com"
            {...register('email')}
            className={inputClass}
            disabled={isSubmitting}
          />
          <FieldError message={errors.email?.message} />
        </div>

        {/* ── Téléphone ── */}
        <div>
          <Label htmlFor="phone">Téléphone</Label>
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

        {/* ── Site web ── */}
        <div>
          <Label htmlFor="website">Site web</Label>
          <input
            id="website"
            type="text"
            placeholder="https://exemple.com"
            {...register('website')}
            className={inputClass}
            disabled={isSubmitting}
          />
          <FieldError message={errors.website?.message} />
        </div>

        {/* ── Source ── */}
        <div>
          <Label htmlFor="source">Source</Label>
          <select
            id="source"
            {...register('source')}
            className={selectClass}
            disabled={isSubmitting}
          >
            {sourceValues.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
          <FieldError message={errors.source?.message} />
        </div>

        {/* ── Statut ── */}
        <div>
          <Label htmlFor="status">Statut</Label>
          <select
            id="status"
            {...register('status')}
            className={selectClass}
            disabled={isSubmitting}
          >
            {statusValues.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <FieldError message={errors.status?.message} />
        </div>

        {/* ── Notes ── */}
        <div>
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            rows={4}
            placeholder="Contexte, attentes, historique…"
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
            href="/clients"
            className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-center
              border border-[#2a2a2a] text-[#a0a0a0] hover:text-white hover:border-[#444444]
              transition-colors"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium
              bg-[#00D76B] text-white hover:bg-[#00C061] active:bg-[#009E50]
              transition-colors disabled:opacity-60 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Créer le client
          </button>
        </div>
      </form>
    </div>
  )
}
