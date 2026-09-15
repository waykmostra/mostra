'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { setupPassword } from './actions'

interface SetPasswordFormProps {
  token: string
}

export default function SetPasswordForm({ token }: SetPasswordFormProps) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!password) {
      setError('Le mot de passe est requis.')
      return
    }
    setPending(true)
    const result = await setupPassword(token, password)
    setPending(false)
    if (result.success) {
      toast.success('Mot de passe défini. Tu peux te connecter.')
      router.push('/login')
      router.refresh()
    } else {
      setError(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-dim mb-1.5"
        >
          Nouveau mot de passe
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={pending}
          className="
            w-full px-3 py-2.5 rounded-lg text-sm
            bg-surface border border-line text-ink placeholder:text-faint
            outline-none transition-colors
            focus:border-brand focus:ring-1 focus:ring-brand/30
            disabled:opacity-50
          "
        />
      </div>

      {error && (
        <div className="rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 px-4 py-3">
          <p className="text-sm text-[#EF4444]">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="
          w-full py-2.5 px-4 rounded-lg text-sm font-medium
          bg-brand text-ink
          hover:bg-brand active:bg-brand
          transition-colors disabled:opacity-60 disabled:cursor-not-allowed
          flex items-center justify-center gap-2
        "
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Activer mon compte
      </button>
    </form>
  )
}
