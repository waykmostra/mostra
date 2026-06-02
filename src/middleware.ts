import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { updateSession } from '@/lib/supabase/middleware'
import type { Database } from '@/lib/types/database'

// ============================================================
// MOSTRA — Middleware (2 rôles : admin + client)
// ============================================================

// Routes accessibles sans authentification.
const PUBLIC_ROUTES = ['/login']

// Préfixes publics — accessibles sans auth.
// - /client/{token} : accès projet par token public (lecture seule sans login)
// - /setup-password/{token} : flow initial pour définir le mot de passe
const PUBLIC_PREFIXES = ['/client/', '/setup-password/']

// Routes réservées à l'admin (Tarik).
// Un client connecté qui tente d'y accéder est redirigé vers /client/dashboard.
const ADMIN_PREFIXES = ['/dashboard', '/projects', '/settings', '/clients']

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

async function getIsAdmin(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle()
  return (data as { is_admin: boolean } | null)?.is_admin ?? false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { supabaseResponse, user, supabase } = await updateSession(request)

  // Utilisateur non authentifié sur une route protégée → /login
  if (!user && !isPublicRoute(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // Utilisateur authentifié sur /login → dashboard selon rôle
  if (user && pathname === '/login') {
    const isAdmin = await getIsAdmin(supabase, user.id)
    const url = request.nextUrl.clone()
    url.pathname = isAdmin ? '/dashboard' : '/client/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // Protection des routes admin : un client connecté est redirigé.
  if (user && ADMIN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const isAdmin = await getIsAdmin(supabase, user.id)
    if (!isAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = '/client/dashboard'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
