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
// - /pay/{token} : lien direct de paiement d'une demande (Stripe Checkout)
const PUBLIC_PREFIXES = ['/client/', '/setup-password/', '/pay/']

// Routes réservées à l'admin (Kylian).
// Un client connecté qui tente d'y accéder est redirigé vers /client/dashboard.
const ADMIN_PREFIXES = ['/dashboard', '/projects', '/settings', '/clients', '/team']

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

// Liens clients (migration 039) : nouveau format « société-code ».
const CLIENT_TOKEN_RE = /-[a-z2-7]{4}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Un lien client à l'ancien format (`/client/<vieux token>/…`) ou une étape
 * par son id (`/client/<token>/phases/<uuid>`) → URL au nouveau format, ou
 * null s'il n'y a rien à rediriger. `resolve_client_link` (SECURITY DEFINER)
 * ne renvoie que le token courant et le slug d'étape. Avant la migration 039,
 * la fonction n'existe pas : on ne redirige rien et l'ancien lien sert tel quel.
 */
async function legacyClientRedirect(
  supabase: SupabaseClient<Database>,
  pathname: string,
): Promise<string | null> {
  const parts = pathname.split('/') // ['', 'client', token, ...rest]
  const token = parts[2]
  if (!token || token === 'dashboard') return null
  const rest = parts.slice(3)
  const phaseId = rest[0] === 'phases' && rest.length === 2 && UUID_RE.test(rest[1]) ? rest[1] : null
  if (CLIENT_TOKEN_RE.test(token) && !phaseId) return null

  // Appel de méthode (garde `this`) ; la fonction SQL n'est pas dans les types générés.
  const client = supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: { token: string; phase_slug: string | null } | null; error: unknown }>
  }
  let data: { token: string; phase_slug: string | null } | null = null
  try {
    const res = await client.rpc('resolve_client_link', { p_token: token, p_phase_id: phaseId })
    if (res.error) return null
    data = res.data
  } catch {
    return null // jamais bloquer une page pour une redirection
  }
  if (!data?.token) return null

  const tail = phaseId && data.phase_slug ? [data.phase_slug] : rest
  const next = ['', 'client', data.token, ...tail].join('/')
  return next === pathname ? null : next
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { supabaseResponse, user, supabase } = await updateSession(request)

  // Anciens liens clients déjà envoyés → nouveau format (308, garde la query).
  if (pathname.startsWith('/client/')) {
    const target = await legacyClientRedirect(supabase, pathname)
    if (target) {
      const url = request.nextUrl.clone()
      url.pathname = target
      return NextResponse.redirect(url, 308)
    }
  }

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
  // Le webhook Stripe échappe au middleware : il s'authentifie par sa signature
  // et doit recevoir le corps brut, sans session ni redirection.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
