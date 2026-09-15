'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const loginSchema = z.object({
  email: z.string().min(1, "L'email est requis").email('Adresse email invalide'),
  password: z.string().min(1, 'Le mot de passe est requis'),
})

type LoginForm = z.infer<typeof loginSchema>

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/'
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginForm) {
    setServerError(null)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setServerError('Email ou mot de passe incorrect.')
      } else if (error.message.includes('Email not confirmed')) {
        setServerError('Veuillez confirmer votre email avant de vous connecter.')
      } else {
        setServerError('Une erreur est survenue. Veuillez réessayer.')
      }
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  return (
    <>
      <h1 className="text-[1.625rem] leading-tight text-ink">Connexion</h1>
      <p className="text-[13.5px] text-dim mt-1.5 mb-7">Accédez à votre espace de production.</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div>
          <label htmlFor="email" className="mono-label block text-faint mb-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="vous@agence.io"
            {...register('email')}
            className="field disabled:opacity-50"
            disabled={isSubmitting}
          />
          {errors.email && <p className="mt-2 text-[12.5px] text-late">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="mono-label block text-faint mb-2">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            {...register('password')}
            className="field disabled:opacity-50"
            disabled={isSubmitting}
          />
          {errors.password && (
            <p className="mt-2 text-[12.5px] text-late">{errors.password.message}</p>
          )}
        </div>

        {serverError && (
          <p className="text-[13px] text-late" role="alert">
            {serverError}
          </p>
        )}

        <button type="submit" disabled={isSubmitting} className="btn-brand w-full h-11">
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Se connecter
        </button>
      </form>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
