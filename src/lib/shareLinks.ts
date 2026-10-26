import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

// ============================================================
// Liens clients « société + code » (migration 039)
// ============================================================
//   /client/monmiroir-7k2q            → vue d'ensemble
//   /client/monmiroir-7k2q/animation  → étape (slug de project_phases)
//   /client/monmiroir-lancement-7k2q  → société avec plusieurs projets actifs
// Le code (4 caractères base32) est dans tous les liens. Même règle de slug
// que `mostra_slug()` côté SQL : minuscules, sans accents ni séparateurs.

/** Nouveau format : se termine par « -» + 4 caractères base32. */
export const CLIENT_TOKEN_RE = /-[a-z2-7]{4}$/

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567'

export function slugCompact(input: string | null | undefined, maxLen = 30): string {
  return (input ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, maxLen)
}

export function shortCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  return Array.from(bytes, (b) => BASE32[b % 32]).join('')
}

/**
 * Token de partage d'un projet : société (companies.name > clients.company_name
 * > nom du projet) + nom du projet si la société a déjà un autre projet actif +
 * code court. `admin` = client service role (lecture CRM).
 */
export async function buildClientToken(
  admin: SupabaseClient<Database>,
  input: { projectName: string; crmClientId: string | null; projectId?: string },
): Promise<string> {
  let company: string | null = null
  const siblings: string[] = []

  if (input.crmClientId) {
    const { data: rawClient } = await admin
      .from('clients')
      .select('company_name, company_id')
      .eq('id', input.crmClientId)
      .maybeSingle()
    const client = rawClient as { company_name: string | null; company_id: string | null } | null

    let clientIds = [input.crmClientId]
    if (client?.company_id) {
      const { data: rawCompany } = await admin.from('companies').select('name').eq('id', client.company_id).maybeSingle()
      company = (rawCompany as { name: string } | null)?.name ?? null
      const { data: rawMates } = await admin.from('clients').select('id').eq('company_id', client.company_id)
      clientIds = ((rawMates as { id: string }[] | null) ?? []).map((c) => c.id)
    }
    company = company ?? client?.company_name ?? null

    const { data: rawProjects } = await admin
      .from('projects')
      .select('id')
      .in('client_id', clientIds)
      .eq('status', 'active')
    for (const p of (rawProjects as { id: string }[] | null) ?? []) if (p.id !== input.projectId) siblings.push(p.id)
  }

  const companySlug = slugCompact(company) || slugCompact(input.projectName) || 'projet'
  const projectSlug = slugCompact(input.projectName, 24)
  const middle = siblings.length > 0 && projectSlug && projectSlug !== companySlug ? `-${projectSlug}` : ''
  return `${companySlug}${middle}-${shortCode()}`
}

/** Lien d'une étape : /client/<token>/<slug de l'étape>. */
export function clientPhasePath(token: string, phaseSlug: string): string {
  return `/client/${token}/${phaseSlug}`
}
