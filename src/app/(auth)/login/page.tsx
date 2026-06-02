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
      <h1 className="text-xl font-semibold text-white mb-1">Connexion</h1>
      <p className="text-sm text-[#a0a0a0] mb-6">Accédez à votre espace de production.</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[#a0a0a0] mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="vous@agence.io"
            {...register('email')}
            className="
              w-full px-3 py-2.5 rounded-lg text-sm
              bg-[#111111] border text-white placeholder:text-[#444444]
              outline-none transition-colors
              focus:border-[#00D76B] focus:ring-1 focus:ring-[#00D76B]/30
              disabled:opacity-50
              border-[#2a2a2a]
            "
            disabled={isSubmitting}
          />
          {errors.email && <p className="mt-1.5 text-xs text-[#EF4444]">{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-[#a0a0a0] mb-1.5">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            {...register('password')}
            className="
              w-full px-3 py-2.5 rounded-lg text-sm
              bg-[#111111] border text-white placeholder:text-[#444444]
              outline-none transition-colors
              focus:border-[#00D76B] focus:ring-1 focus:ring-[#00D76B]/30
              disabled:opacity-50
              border-[#2a2a2a]
            "
            disabled={isSubmitting}
          />
          {errors.password && (
            <p className="mt-1.5 text-xs text-[#EF4444]">{errors.password.message}</p>
          )}
        </div>

        {/* Server error */}
        {serverError && (
          <div className="rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 px-4 py-3">
            <p className="text-sm text-[#EF4444]">{serverError}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="
            w-full py-2.5 px-4 rounded-lg text-sm font-medium
            bg-[#00D76B] text-white
            hover:bg-[#00C061] active:bg-[#009E50]
            transition-colors disabled:opacity-60 disabled:cursor-not-allowed
            flex items-center justify-center gap-2
          "
        >
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
