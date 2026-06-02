'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Profile, UserRole } from '@/lib/types'

interface AuthState {
  user: User | null
  profile: Profile | null
  role: UserRole | null
  loading: boolean
}

interface UseAuthReturn extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  isAdmin: boolean
  isClient: boolean
}

export function useAuth(): UseAuthReturn {
  const router = useRouter()
  const supabase = createClient()

  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    role: null,
    loading: true,
  })

  const fetchUserData = useCallback(
    async (user: User) => {
      const { data: rawProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      const profile = rawProfile as Profile | null
      const role: UserRole | null = profile ? (profile.is_admin ? 'admin' : 'client') : null

      setState({ user, profile, role, loading: false })
    },
    [supabase],
  )

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        fetchUserData(user)
      } else {
        setState((prev) => ({ ...prev, loading: false }))
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserData(session.user)
      } else {
        setState({ user: null, profile: null, role: null, loading: false })
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchUserData, supabase.auth])

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          return { error: 'Email ou mot de passe incorrect.' }
        }
        return { error: 'Une erreur est survenue. Veuillez réessayer.' }
      }
      return { error: null }
    },
    [supabase],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }, [supabase, router])

  return {
    ...state,
    signIn,
    signOut,
    isAdmin: state.role === 'admin',
    isClient: state.role === 'client',
  }
}
