'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { createProject } from '../actions'
import type { AdminOption, ClientOption } from '@/lib/supabase/queries'

// ── Zod schema ──────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(100, 'Nom trop long'),
  description: z.string().max(500, 'Description trop longue').optional(),
  clientId: z.string().optional(),
  projectManagerId: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

// ── Sous-composants ──────────────────────────────────────────────

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

// ── Props ────────────────────────────────────────────────────────

interface Props {
  clients: ClientOption[]
  admins: AdminOption[]
}

// ── Composant principal ──────────────────────────────────────────

export default function NewProjectForm({ clients, admins }: Props) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    const result = await createProject({
      name: values.name,
      description: values.description,
      crmClientId: values.clientId || null,
      projectManagerId: values.projectManagerId || null,
    })

    if ('error' in result) {
      setServerError(result.error)
      return
    }

    toast.success(`Projet "${result.data.name}" créé !`)
    router.push(`/projects/${result.data.id}`)
    router.refresh()
  }

  return (
    <div className="max-w-xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-[#666666] hover:text-white transition-colors mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          Retour
        </Link>
        <h1 className="text-xl font-semibold text-white">Nouveau projet</h1>
        <p className="text-sm text-[#666666] mt-0.5">
          Remplissez les informations pour démarrer un nouveau projet.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        {/* ── Nom du projet ── */}
        <div>
          <Label htmlFor="name">
            Nom du projet <span className="text-[#00D76B]">*</span>
          </Label>
          <input
            id="name"
            type="text"
            placeholder="ex. TechVision Brand Film 2024"
            {...register('name')}
            className={inputClass}
            disabled={isSubmitting}
          />
          <FieldError message={errors.name?.message} />
        </div>

        {/* ── Description ── */}
        <div>
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            rows={3}
            placeholder="Contexte, objectifs, format... (optionnel)"
            {...register('description')}
            className={`${inputClass} resize-none`}
            disabled={isSubmitting}
          />
          <FieldError message={errors.description?.message} />
        </div>

        {/* ── Client ── */}
        <div>
          <Label htmlFor="clientId">Client</Label>
          <select
            id="clientId"
            {...register('clientId')}
            className={selectClass}
            disabled={isSubmitting}
            defaultValue=""
          >
            <option value="">Aucun client</option>
            {clients.map((c) => {
              const display = c.companyName ? `${c.companyName} — ${c.contactName}` : c.contactName
              return (
                <option key={c.id} value={c.id}>
                  {display}
                  {c.email ? ` (${c.email})` : ''}
                </option>
              )
            })}
          </select>
          <p className="text-xs text-[#666666] mt-1.5">
            Pour ajouter un nouveau client,{' '}
            <Link href="/clients/new" className="text-[#00D76B] hover:underline">
              créez-le ici
            </Link>{' '}
            avant.
          </p>
        </div>

        {/* ── Admin assigné (PM) ── */}
        <div>
          <Label htmlFor="projectManagerId">Admin assigné</Label>
          <select
            id="projectManagerId"
            {...register('projectManagerId')}
            className={selectClass}
            disabled={isSubmitting}
            defaultValue=""
          >
            <option value="">Non assigné</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.fullName}
              </option>
            ))}
          </select>
        </div>

        {/* ── Erreur serveur ── */}
        {serverError && (
          <div className="rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 px-4 py-3">
            <p className="text-sm text-[#EF4444]">{serverError}</p>
          </div>
        )}

        {/* ── Séparateur + boutons ── */}
        <div className="flex items-center gap-3 pt-2">
          <Link
            href="/dashboard"
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
            Créer le projet
          </button>
        </div>
      </form>
    </div>
  )
}
