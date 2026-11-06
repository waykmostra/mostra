import 'server-only'
import { randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// Partage d'un contenu de Mostra Compagnon (Outils > Contenu)
// ============================================================
// Le Compagnon envoie une copie du script d'un contenu ; elle est servie en
// lecture seule sur /s/{token}, le temps choisi (24 h à 30 jours), pour lire
// le script sur un téléphone. Aucune table : chaque partage est un fichier JSON
// du bucket privé `content-shares`, lu et écrit uniquement côté serveur
// (service role). Seul l'auteur d'un partage peut le mettre à jour ou le couper.

export const SHARE_BUCKET = 'content-shares'
export const SHARE_DAYS_DEFAULT = 7
export const SHARE_DAYS_MAX = 30

/** Nœud TipTap (JSON de l'éditeur du Compagnon). */
export type DocNode = {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  content?: DocNode[]
}

export type ContentShare = {
  v: 1
  token: string
  owner: string
  itemId: string
  title: string
  platform: string | null
  plannedDate: string | null
  doc: DocNode | null
  createdAt: string
  updatedAt: string
  expiresAt: string
}

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

/** « Mon hook LinkedIn ! » → « mon-hook-linkedin-k3x9qa ». */
export function newShareToken(title: string): string {
  let slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  // Au plus ~36 caractères, coupé entre deux mots.
  if (slug.length > 36) slug = slug.slice(0, 37).replace(/-[^-]*$/, '') || slug.slice(0, 36)
  const bytes = randomBytes(6)
  const code = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
  return slug ? `${slug}-${code}` : `script-${code}`
}

export const TOKEN_RE = /^[a-z0-9-]{6,64}$/

const path = (token: string) => `${token}.json`

/**
 * Client service role dont aucune requête ne passe par le cache de données de
 * Next (sinon une copie modifiée, coupée ou expirée resterait servie).
 */
export function shareAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  })
}

let bucketReady = false
async function ensureBucket() {
  if (bucketReady) return
  const admin = shareAdmin()
  const { error } = await admin.storage.getBucket(SHARE_BUCKET)
  if (error) {
    const { error: createError } = await admin.storage.createBucket(SHARE_BUCKET, { public: false })
    if (createError && !/already exists/i.test(createError.message)) throw createError
  }
  bucketReady = true
}

export async function readShare(token: string): Promise<ContentShare | null> {
  if (!TOKEN_RE.test(token)) return null
  const admin = shareAdmin()
  const { data, error } = await admin.storage.from(SHARE_BUCKET).download(path(token))
  if (error || !data) return null
  try {
    const share = JSON.parse(await data.text()) as ContentShare
    return share?.token === token ? share : null
  } catch {
    return null
  }
}

export async function writeShare(share: ContentShare): Promise<void> {
  await ensureBucket()
  const admin = shareAdmin()
  const body = new Blob([JSON.stringify(share)], { type: 'application/json' })
  const { error } = await admin.storage
    .from(SHARE_BUCKET)
    .upload(path(share.token), body, { upsert: true, contentType: 'application/json', cacheControl: '0' })
  if (error) throw error
}

export async function deleteShare(token: string): Promise<void> {
  const admin = shareAdmin()
  await admin.storage.from(SHARE_BUCKET).remove([path(token)])
}

export const isExpired = (share: ContentShare) => Date.parse(share.expiresAt) <= Date.now()
