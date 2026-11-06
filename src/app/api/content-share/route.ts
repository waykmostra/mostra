import { NextResponse } from 'next/server'
import {
  type ContentShare,
  type DocNode,
  SHARE_DAYS_DEFAULT,
  SHARE_DAYS_MAX,
  TOKEN_RE,
  deleteShare,
  shareAdmin,
  newShareToken,
  readShare,
  writeShare,
} from '@/lib/content-share'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Liens de partage des contenus de Mostra Compagnon (lecture sur /s/{token}).
 *
 * Appelé par le Compagnon (app Electron, autre origine) : pas de cookie de
 * session, l'utilisateur s'authentifie par son jeton Supabase
 * (`Authorization: Bearer …`). Le middleware laisse donc passer cette route.
 *
 *   POST   { itemId, title, platform, plannedDate, doc, token?, days? }
 *          → crée le lien (ou met à jour la copie de `token`) ; `days` relance
 *            la durée, sinon l'échéance reste la même.
 *   DELETE { token } → coupe le lien.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
}

const MAX_BODY = 600_000 // ~600 Ko : un script, jamais des fichiers

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS })
}

function appUrl(request: Request) {
  const env = process.env.NEXT_PUBLIC_APP_URL
  if (env) return (env.startsWith('http') ? env : `https://${env}`).replace(/\/+$/, '')
  return new URL(request.url).origin
}

async function authUser(request: Request) {
  const auth = request.headers.get('authorization') || ''
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!jwt) return null
  const { data, error } = await shareAdmin().auth.getUser(jwt)
  return error ? null : data.user
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const text = await request.text()
  if (text.length > MAX_BODY) return null
  try {
    const body = JSON.parse(text)
    return body && typeof body === 'object' ? body : null
  } catch {
    return null
  }
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : null)

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(request: Request) {
  const user = await authUser(request)
  if (!user) return json({ error: 'Connecte-toi au Compagnon pour partager.' }, 401)

  const body = await readBody(request)
  if (!body) return json({ error: 'Contenu trop lourd ou illisible.' }, 400)
  const itemId = str(body.itemId, 120)
  if (!itemId) return json({ error: 'Contenu introuvable.' }, 400)

  const now = new Date()
  const days = typeof body.days === 'number' ? Math.min(SHARE_DAYS_MAX, Math.max(1, Math.round(body.days))) : null
  const until = (d: number) => new Date(now.getTime() + d * 86_400_000).toISOString()

  let previous: ContentShare | null = null
  const askedToken = str(body.token, 64)
  if (askedToken) {
    previous = TOKEN_RE.test(askedToken) ? await readShare(askedToken) : null
    if (previous && previous.owner !== user.id) return json({ error: 'Ce lien appartient à quelqu’un d’autre.' }, 403)
  }

  const title = str(body.title, 300)?.trim() || ''
  const doc = body.doc && typeof body.doc === 'object' ? (body.doc as DocNode) : null
  const share: ContentShare = {
    v: 1,
    // Un lien coupé ou expiré qu'on relance garde son adresse.
    token: askedToken && TOKEN_RE.test(askedToken) ? askedToken : newShareToken(title),
    owner: user.id,
    itemId,
    title,
    platform: str(body.platform, 60),
    plannedDate: str(body.plannedDate, 10),
    doc,
    createdAt: previous?.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: days || !previous ? until(days || SHARE_DAYS_DEFAULT) : previous.expiresAt,
  }

  try {
    await writeShare(share)
  } catch {
    return json({ error: 'Le lien n’a pas pu être enregistré. Réessaie.' }, 500)
  }
  return json({ token: share.token, url: `${appUrl(request)}/s/${share.token}`, expiresAt: share.expiresAt })
}

export async function DELETE(request: Request) {
  const user = await authUser(request)
  if (!user) return json({ error: 'Connecte-toi au Compagnon pour gérer ce lien.' }, 401)
  const body = await readBody(request)
  const token = str(body?.token, 64)
  if (!token || !TOKEN_RE.test(token)) return json({ ok: true })
  const share = await readShare(token)
  if (share && share.owner !== user.id) return json({ error: 'Ce lien appartient à quelqu’un d’autre.' }, 403)
  if (share) await deleteShare(token)
  return json({ ok: true })
}
