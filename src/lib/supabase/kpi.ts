import type { SupabaseClient } from '@supabase/supabase-js'

type Sb = SupabaseClient<any, any, any>

// KPIs hebdo du dashboard — 100 % automatiques, calculés depuis les projets,
// les clients et la finance. Remplace l'ancien module « founder » (supprimé
// avec l'espace Founder) : plus de table weekly_kpis, plus de notion de
// prospect / pipeline commercial.

function mondayOf(d: Date): Date {
  const date = new Date(d)
  const day = (date.getDay() + 6) % 7 // lundi = 0
  date.setDate(date.getDate() - day)
  date.setHours(0, 0, 0, 0)
  return date
}

export interface WeeklyKpiData {
  /** Lundi de la semaine courante (YYYY-MM-DD). */
  currentWeekStart: string
  /** Clients passés « actif » cette semaine. */
  autoNewClients: number
  /** Projets livrés (terminés) cette semaine. */
  autoProjectsDelivered: number
  /** Projets actifs en cours (instantané). */
  autoActiveProjects: number
  /** CA encaissé cette semaine (projets payés + revenus libres). */
  autoCaCollected: number
}

export async function getWeeklyKpiData(supabase: Sb): Promise<WeeklyKpiData> {
  const monday = mondayOf(new Date())
  const nextMonday = new Date(monday)
  nextMonday.setDate(nextMonday.getDate() + 7)

  const inWeek = (iso: string | null): boolean => {
    if (!iso) return false
    const d = new Date(iso)
    return d >= monday && d < nextMonday
  }

  const { data: rawClients } = await supabase.from('clients').select('status, updated_at')
  const clients = (rawClients as { status: string; updated_at: string }[] | null) ?? []
  const autoNewClients = clients.filter(
    (c) => c.status === 'active' && inWeek(c.updated_at),
  ).length

  const { data: rawProjects } = await supabase
    .from('projects')
    .select('id, status, updated_at, value_eur, paid_at')
  const projects =
    (rawProjects as {
      id: string
      status: string
      updated_at: string
      value_eur: number | null
      paid_at: string | null
    }[] | null) ?? []

  const autoProjectsDelivered = projects.filter(
    (p) => p.status === 'completed' && inWeek(p.updated_at),
  ).length
  const autoActiveProjects = projects.filter((p) => p.status === 'active').length

  // Les paiements Stripe ont leur propre revenu (table revenues) : le projet
  // ne compte que le reste réglé hors Stripe, pour ne rien compter deux fois.
  const { data: rawStripe } = await supabase.from('payment_requests').select('project_id, amount_cents').eq('status', 'paid')
  const stripePaid = new Map<string, number>()
  for (const r of (rawStripe as { project_id: string; amount_cents: number }[] | null) ?? []) {
    stripePaid.set(r.project_id, (stripePaid.get(r.project_id) ?? 0) + r.amount_cents / 100)
  }

  let autoCaCollected = projects
    .filter((p) => inWeek(p.paid_at))
    .reduce((s, p) => s + Math.max(0, (p.value_eur ?? 0) - (stripePaid.get(p.id) ?? 0)), 0)

  // + revenus libres encaissés cette semaine (table revenues, migration 032)
  const { data: rawRev } = await supabase.from('revenues').select('amount_eur, received_on')
  for (const r of (rawRev as { amount_eur: number; received_on: string }[] | null) ?? []) {
    if (inWeek(r.received_on)) autoCaCollected += r.amount_eur
  }

  return {
    currentWeekStart: monday.toISOString().slice(0, 10),
    autoNewClients,
    autoProjectsDelivered,
    autoActiveProjects,
    autoCaCollected,
  }
}
