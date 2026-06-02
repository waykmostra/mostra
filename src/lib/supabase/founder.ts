import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type {
  Client,
  Competitor,
  ContentIdea,
  DailyWorkflowItem,
  DailyWorkflowTask,
  Objective,
  ObjectiveMetric,
  ObjectiveWithProgress,
  WeeklyKpi,
} from '@/lib/types'

type Sb = SupabaseClient<Database>

// ============================================================================
// Lectures du Cockpit Founder (migration 022). Toutes les fonctions dégradent
// en douceur (renvoient des valeurs vides) si les tables n'existent pas encore.
// ============================================================================

// ── Helpers dates (locales) ─────────────────────────────────────────────────

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

export function todayISO(): string {
  return isoDate(new Date())
}

/** Lundi de la semaine d'une date donnée (00:00 local). */
export function mondayOf(d: Date): Date {
  const day = d.getDay() // 0 dim … 6 sam
  const diff = day === 0 ? -6 : 1 - day
  const m = new Date(d)
  m.setHours(0, 0, 0, 0)
  m.setDate(m.getDate() + diff)
  return m
}

/** true si created/updated tombe dans le mois courant (heure locale). */
function inCurrentMonth(iso: string | null): boolean {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

// ── 1. Daily Workflow ───────────────────────────────────────────────────────

/** Tâches actives + état "fait aujourd'hui". */
export async function getDailyWorkflow(supabase: Sb): Promise<DailyWorkflowItem[]> {
  const { data: rawTasks, error } = await supabase
    .from('daily_workflow_tasks')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  if (error) return []
  const tasks = (rawTasks as DailyWorkflowTask[] | null) ?? []
  if (tasks.length === 0) return []

  const today = todayISO()
  const { data: rawLog } = await supabase
    .from('daily_workflow_log')
    .select('task_id')
    .eq('done_on', today)

  const doneSet = new Set(
    ((rawLog as { task_id: string }[] | null) ?? []).map((l) => l.task_id),
  )

  return tasks.map((t) => ({ ...t, done_today: doneSet.has(t.id) }))
}

/** Toutes les tâches (actives ou non) pour l'édition en réglages. */
export async function getAllWorkflowTasks(supabase: Sb): Promise<DailyWorkflowTask[]> {
  const { data, error } = await supabase
    .from('daily_workflow_tasks')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) return []
  return (data as DailyWorkflowTask[] | null) ?? []
}

/**
 * Streak = nb de jours consécutifs (finissant aujourd'hui ou hier) à 100 %.
 * Un jour est "complet" si le nb de tâches cochées ce jour ≥ nb de tâches
 * actives aujourd'hui. La journée en cours ne casse pas le streak tant qu'elle
 * n'est pas terminée.
 */
export async function getWorkflowStreak(supabase: Sb, activeCount: number): Promise<number> {
  if (activeCount <= 0) return 0

  const since = new Date()
  since.setDate(since.getDate() - 90)

  const { data: rawLog, error } = await supabase
    .from('daily_workflow_log')
    .select('task_id, done_on')
    .gte('done_on', isoDate(since))

  if (error) return 0
  const log = (rawLog as { task_id: string; done_on: string }[] | null) ?? []

  // Compte de tâches distinctes cochées par jour.
  const perDay = new Map<string, Set<string>>()
  for (const l of log) {
    const set = perDay.get(l.done_on) ?? new Set<string>()
    set.add(l.task_id)
    perDay.set(l.done_on, set)
  }
  const isComplete = (day: string) => (perDay.get(day)?.size ?? 0) >= activeCount

  // Point de départ : aujourd'hui si complet, sinon hier.
  const cursor = new Date()
  if (!isComplete(isoDate(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
  }

  let streak = 0
  // Sécurité : borne à 90 itérations.
  for (let i = 0; i < 90; i++) {
    if (isComplete(isoDate(cursor))) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

// ── 2. Objectifs ────────────────────────────────────────────────────────────

/** CA encaissé le mois courant (somme des projets payés ce mois-ci). */
async function getRevenueThisMonth(supabase: Sb): Promise<number> {
  const { data } = await supabase
    .from('projects')
    .select('value_eur, paid_at')
    .not('paid_at', 'is', null)

  const rows = (data as { value_eur: number | null; paid_at: string | null }[] | null) ?? []
  return rows
    .filter((r) => inCurrentMonth(r.paid_at))
    .reduce((sum, r) => sum + (r.value_eur ?? 0), 0)
}

/** Nouvelles fiches CRM créées ce mois-ci. */
async function getNewLeadsThisMonth(supabase: Sb): Promise<number> {
  const { data } = await supabase.from('clients').select('created_at')
  const rows = (data as { created_at: string }[] | null) ?? []
  return rows.filter((r) => inCurrentMonth(r.created_at)).length
}

/** Prospects au stade "call booké". */
async function getCallsBooked(supabase: Sb): Promise<number> {
  const { count } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('pipeline_stage', 'call_booke')
  return count ?? 0
}

/** Objectifs + valeur courante résolue (manuelle ou calculée). */
export async function getObjectivesWithProgress(supabase: Sb): Promise<ObjectiveWithProgress[]> {
  const { data, error } = await supabase
    .from('objectives')
    .select('*')
    .order('is_priority', { ascending: false })
    .order('deadline', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) return []
  const objectives = (data as Objective[] | null) ?? []
  if (objectives.length === 0) return []

  // Calcule uniquement les agrégats nécessaires.
  const metrics = new Set<ObjectiveMetric>(objectives.map((o) => o.metric))
  const [revenue, leads, calls] = await Promise.all([
    metrics.has('revenue_month') ? getRevenueThisMonth(supabase) : Promise.resolve(0),
    metrics.has('new_leads_month') ? getNewLeadsThisMonth(supabase) : Promise.resolve(0),
    metrics.has('calls_booked') ? getCallsBooked(supabase) : Promise.resolve(0),
  ])

  const resolve = (o: Objective): number => {
    switch (o.metric) {
      case 'revenue_month':   return revenue
      case 'new_leads_month': return leads
      case 'calls_booked':    return calls
      default:                return o.manual_value
    }
  }

  return objectives.map((o) => ({ ...o, current_value: resolve(o) }))
}

// ── 3. KPIs hebdo ───────────────────────────────────────────────────────────

export interface WeeklyKpiData {
  /** Les 8 dernières semaines (ordre chronologique croissant). */
  weeks: WeeklyKpi[]
  /** Ligne de la semaine courante (ou null si pas encore saisie). */
  current: WeeklyKpi | null
  /** Lundi de la semaine courante (YYYY-MM-DD). */
  currentWeekStart: string
  /** CA signé cette semaine (auto, depuis Finance/CRM). */
  autoCaSigned: number
  /** Deals signés cette semaine (auto, depuis CRM). */
  autoDeals: number
}

export async function getWeeklyKpiData(supabase: Sb): Promise<WeeklyKpiData> {
  const monday = mondayOf(new Date())
  const currentWeekStart = isoDate(monday)
  const nextMonday = new Date(monday)
  nextMonday.setDate(nextMonday.getDate() + 7)

  const { data, error } = await supabase
    .from('weekly_kpis')
    .select('*')
    .order('week_start', { ascending: false })
    .limit(8)

  const rows = error ? [] : ((data as WeeklyKpi[] | null) ?? [])
  const current = rows.find((r) => r.week_start === currentWeekStart) ?? null
  const weeks = [...rows].sort((a, b) => a.week_start.localeCompare(b.week_start))

  // Auto : deals signés cette semaine = clients passés "signe" cette semaine.
  const { data: rawSigned } = await supabase
    .from('clients')
    .select('id, updated_at')
    .eq('pipeline_stage', 'signe')

  const signed = ((rawSigned as { id: string; updated_at: string }[] | null) ?? []).filter((c) => {
    const u = new Date(c.updated_at)
    return u >= monday && u < nextMonday
  })
  const signedIds = signed.map((c) => c.id)

  let autoCaSigned = 0
  if (signedIds.length > 0) {
    const { data: rawProj } = await supabase
      .from('projects')
      .select('value_eur, client_id')
      .in('client_id', signedIds)
    autoCaSigned = ((rawProj as { value_eur: number | null }[] | null) ?? []).reduce(
      (sum, p) => sum + (p.value_eur ?? 0),
      0,
    )
  }

  return {
    weeks,
    current,
    currentWeekStart,
    autoCaSigned,
    autoDeals: signed.length,
  }
}

// ── 4. Veille concurrentielle ───────────────────────────────────────────────

export async function getCompetitors(supabase: Sb): Promise<Competitor[]> {
  const { data, error } = await supabase
    .from('competitors')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) return []
  return (data as Competitor[] | null) ?? []
}

// ── 5. Inbox idées ──────────────────────────────────────────────────────────

export async function getContentIdeas(supabase: Sb): Promise<ContentIdea[]> {
  const { data, error } = await supabase
    .from('content_ideas')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return []
  return (data as ContentIdea[] | null) ?? []
}

// ── 6. Pipeline (prospects chauds) ──────────────────────────────────────────

/** Prospects de la zone "chaude" (vue Pipeline) : repondu / call_booke / proposition. */
export async function getPipelineProspects(supabase: Sb): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .in('pipeline_stage', ['repondu', 'call_booke', 'proposition'])
    .order('updated_at', { ascending: false })

  if (error) return []
  return (data as Client[] | null) ?? []
}

/** Prospects dont la relance est due aujourd'hui ou en retard (dashboard). */
export async function getProspectsDueToday(supabase: Sb): Promise<Client[]> {
  const today = todayISO()
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .in('pipeline_stage', ['froid', 'contacte', 'a_relancer'])
    .not('next_follow_up_on', 'is', null)
    .lte('next_follow_up_on', today)
    .order('next_follow_up_on', { ascending: true })

  if (error) return []
  return (data as Client[] | null) ?? []
}

// ── 7. Dashboard (agrégat) ──────────────────────────────────────────────────

export interface FounderDashboardData {
  workflow: { items: DailyWorkflowItem[]; done: number; total: number; streak: number }
  priorityObjective: ObjectiveWithProgress | null
  prospectsDueToday: Client[]
  veille: { staleDays: number | null; isStale: boolean; count: number }
}

const STALE_DAYS = 7

export async function getFounderDashboard(supabase: Sb): Promise<FounderDashboardData> {
  const [items, objectives, due, competitors] = await Promise.all([
    getDailyWorkflow(supabase),
    getObjectivesWithProgress(supabase),
    getProspectsDueToday(supabase),
    getCompetitors(supabase),
  ])

  const total = items.length
  const done = items.filter((i) => i.done_today).length
  const streak = await getWorkflowStreak(supabase, total)

  const priorityObjective =
    objectives.find((o) => o.is_priority) ?? objectives[0] ?? null

  // Veille : ancienneté de la dernière mise à jour.
  let staleDays: number | null = null
  if (competitors.length > 0) {
    const last = new Date(competitors[0].updated_at) // déjà triés desc
    staleDays = Math.floor((Date.now() - last.getTime()) / 86_400_000)
  }
  const isStale = competitors.length === 0 || (staleDays !== null && staleDays > STALE_DAYS)

  return {
    workflow: { items, done, total, streak },
    priorityObjective,
    prospectsDueToday: due,
    veille: { staleDays, isStale, count: competitors.length },
  }
}
