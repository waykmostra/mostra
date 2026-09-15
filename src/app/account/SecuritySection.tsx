'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { changePassword } from './actions'

export default function SecuritySection() {
  const [pending, startTransition] = useTransition()
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const current = fd.get('currentPassword') as string
    const next = fd.get('newPassword') as string
    const confirm = fd.get('confirmPassword') as string

    if (next !== confirm) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }

    startTransition(async () => {
      const result = await changePassword(current, next)
      if (result.success) {
        toast.success(result.message)
        formRef.current?.reset()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <section className="bg-surface border border-line rounded-xl p-6 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-ink">Sécurité</h2>
        <p className="text-xs text-faint mt-0.5">Modifier votre mot de passe</p>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        {/* Current password */}
        <PasswordField
          name="currentPassword"
          label="Mot de passe actuel"
          show={showCurrent}
          onToggle={() => setShowCurrent((v) => !v)}
          required
          autoComplete="current-password"
        />

        {/* New password */}
        <PasswordField
          name="newPassword"
          label="Nouveau mot de passe"
          show={showNew}
          onToggle={() => setShowNew((v) => !v)}
          required
          autoComplete="new-password"
          hint="8 caractères minimum"
        />

        {/* Confirm */}
        <PasswordField
          name="confirmPassword"
          label="Confirmer le nouveau mot de passe"
          show={showConfirm}
          onToggle={() => setShowConfirm((v) => !v)}
          required
          autoComplete="new-password"
        />

        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-black text-sm font-semibold hover:bg-brand disabled:opacity-50 transition-colors"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Changer le mot de passe
        </button>
      </form>
    </section>
  )
}

function PasswordField({
  name,
  label,
  show,
  onToggle,
  required,
  autoComplete,
  hint,
}: {
  name: string
  label: string
  show: boolean
  onToggle: () => void
  required?: boolean
  autoComplete?: string
  hint?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-dim mb-1.5">{label}</label>
      <div className="relative">
        <input
          name={name}
          type={show ? 'text' : 'password'}
          required={required}
          autoComplete={autoComplete}
          minLength={name !== 'currentPassword' ? 8 : undefined}
          className="w-full px-3 py-2.5 pr-10 bg-canvas border border-line rounded-lg text-sm text-ink placeholder-faint focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-dim transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && <p className="text-[11px] text-faint mt-1">{hint}</p>}
    </div>
  )
}
