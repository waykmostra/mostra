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
import { createCompany } from '../companies/actions'
import CompanyCombobox, { type CompanyChoice } from '../CompanyCombobox'

// ── Zod schema ───────────────────────────────────────────────────
// Un contact = une personne. Le site web vit sur la société ; la source et le
// statut ne servent plus (le statut se lit aux projets en cours).

const schema = z.object({
  contactName: z.string().min(1, 'Le nom du contact est requis').max(100, 'Trop long'),
  email: z
    .string()
    .max(150)
    .optional()
    .refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), 'Email invalide'),
  phone: z.string().max(30, 'Numéro trop long').optional(),
  notes: z.string().max(2000).optional(),
})

type FormValues = z.infer<typeof schema>

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

// ── Composant ────────────────────────────────────────────────────

interface Props {
  companies: { id: string; name: string }[]
  /** Arrivée depuis une fiche société : elle est présélectionnée et on y revient. */
  initialCompanyId?: string
}

export default function NewClientForm({ companies, initialCompanyId }: Props) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const initialCompany = companies.find((c) => c.id === initialCompanyId)
  const [company, setCompany] = useState<CompanyChoice>(
    initialCompany ? { id: initialCompany.id, name: initialCompany.name } : { id: null, name: '' },
  )
  const backHref = initialCompany ? `/clients/companies/${initialCompany.id}` : '/clients'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: FormValues) {
    setServerError(null)

    // Société tapée mais inexistante : on la crée d'abord (renvoie l'existante
    // si le nom est déjà pris, à la casse près).
    let companyId = company.id ?? undefined
    if (!companyId && company.name) {
      const created = await createCompany({ name: company.name })
      if (!created.success) {
        setServerError(created.error)
        return
      }
      companyId = created.companyId
    }

    const result = await createClient({
      companyId,
      contactName: values.contactName,
      email: values.email || undefined,
      phone: values.phone || undefined,
      notes: values.notes || undefined,
    })

    if (!result.success) {
      setServerError(result.error)
      return
    }

    toast.success(`Contact « ${values.contactName} » créé`)
    router.push(initialCompany ? backHref : `/clients/${result.clientId}`)
    router.refresh()
  }

  return (
    <div className="max-w-xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-faint hover:text-ink transition-colors mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          {initialCompany ? `Retour à ${initialCompany.name}` : 'Retour aux clients'}
        </Link>
        <h1 className="text-xl font-semibold text-ink">Nouveau contact</h1>
        <p className="text-sm text-faint mt-0.5">
          Une personne, rattachée à sa société. Son accès client se génère ensuite depuis sa fiche.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        {/* ── Société ── */}
        <div>
          <Label htmlFor="company">Société</Label>
          <CompanyCombobox
            companies={companies}
            value={company}
            onChange={setCompany}
            disabled={isSubmitting}
            inputClassName={inputClass}
          />
        </div>

        {/* ── Contact ── */}
        <div>
          <Label htmlFor="contactName">
            Nom du contact <span className="text-brand">*</span>
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
            href={backHref}
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
            Créer le contact
          </button>
        </div>
      </form>
    </div>
  )
}
