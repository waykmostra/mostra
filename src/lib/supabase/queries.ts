import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type {
  ActivityLog,
  Client,
  ClientInteraction,
  ClientWithStats,
  Comment,
  Expense,
  ExpenseWithProject,
  PaymentStatus,
  PhaseFile,
  PhaseTemplate,
  Profile,
  Project,
  ProjectPhase,
  ProjectSummary,
  RevenueEntry,
  SubPhase,
  Subscription,
} from '@/lib/types'

type Sb = SupabaseClient<Database>

// ─────────────────────────────────────────────────────────────────
// Stats dashboard
// ─────────────────────────────────────────────────────────────────

export async function getProjectStats(
  supabase: Sb,
  options?: { projectManagerId?: string },
) {
  let query = supabase.from('projects').select('*')
  if (options?.projectManagerId) {
    query = query.eq('project_manager_id', options.projectManagerId)
  }
  const { data, error } = await query

  if (error || !data) return { total: 0, active: 0, completed: 0 }

  const projects = data as Project[]
  return {
    total:     projects.length,
    active:    projects.filter((p) => p.status === 'active').length,
    completed: projects.filter((p) => p.status === 'completed').length,
  }
}

// ─────────────────────────────────────────────────────────────────
// Liste des projets (dashboard admin)
// ─────────────────────────────────────────────────────────────────

type ProjectRow = Project & {
  project_phases: ProjectPhase[]
}

export async function getProjects(
  supabase: Sb,
  options?: { projectManagerId?: string },
): Promise<ProjectSummary[]> {
  let query = supabase
    .from('projects')
    .select('*, project_phases(*)')
    .order('updated_at', { ascending: false })

  if (options?.projectManagerId) {
    query = query.eq('project_manager_id', options.projectManagerId)
  }

  const { data: rawProjects, error } = await query
  if (error || !rawProjects) return []

  const projects = rawProjects as unknown as ProjectRow[]

  // Fetch clients (CRM) liés
  const clientIds = [...new Set(
    projects.map((p) => p.client_id).filter(Boolean) as string[],
  )]

  const clientMap = new Map<string, Pick<Client, 'id' | 'contact_name' | 'company_name'>>()
  if (clientIds.length > 0) {
    const { data: rawClients } = await supabase
      .from('clients')
      .select('id, contact_name, company_name')
      .in('id', clientIds)

    const clients = rawClients as Pick<Client, 'id' | 'contact_name' | 'company_name'>[] | null
    clients?.forEach((c) => clientMap.set(c.id, c))
  }

  return projects.map((project) => {
    const phases = [...project.project_phases].sort(
      (a, b) => a.sort_order - b.sort_order,
    )

    const currentPhase =
      phases.find((ph) => ph.status !== 'completed' && ph.status !== 'approved') ??
      phases[phases.length - 1] ??
      null

    const client = project.client_id ? (clientMap.get(project.client_id) ?? null) : null

    return {
      id: project.id,
      name: project.name,
      status: project.status,
      progress: project.progress,
      current_phase: currentPhase,
      client,
      deadline: project.deadline,
      value_eur: project.value_eur,
      // Fallback 'pending' si migration 019 pas encore appliquée.
      payment_status: project.payment_status ?? 'pending',
      paid_at: project.paid_at ?? null,
      updated_at: project.updated_at,
    }
  })
}

// ─────────────────────────────────────────────────────────────────
// Sélecteurs pour dropdowns
// ─────────────────────────────────────────────────────────────────

export interface AdminOption {
  id: string
  fullName: string
  email: string
  avatarUrl: string | null
}

export interface ClientOption {
  id: string                      // clients.id (CRM)
  contactName: string
  companyName: string | null
  email: string | null
  hasAccount: boolean             // true si profile_id non null
}

/** Liste de tous les admins (pour assigner un PM à un projet). */
export async function getAllAdmins(supabase: Sb): Promise<AdminOption[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .eq('is_admin', true)
    .order('full_name', { ascending: true })

  return ((data as Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url'>[] | null) ?? []).map(
    (p) => ({
      id: p.id,
      fullName: p.full_name,
      email: p.email,
      avatarUrl: p.avatar_url,
    }),
  )
}

/**
 * Liste de tous les clients CRM (pour le dropdown de création de projet).
 * Inclut prospects (sans compte) et clients actifs.
 */
export async function getAllClients(supabase: Sb): Promise<ClientOption[]> {
  const { data } = await supabase
    .from('clients')
    .select('id, contact_name, company_name, email, profile_id')
    .order('contact_name', { ascending: true })

  return ((data as (Pick<Client, 'id' | 'contact_name' | 'company_name' | 'email' | 'profile_id'>)[] | null) ?? []).map(
    (c) => ({
      id: c.id,
      contactName: c.contact_name,
      companyName: c.company_name,
      email: c.email,
      hasAccount: c.profile_id !== null,
    }),
  )
}

// ─────────────────────────────────────────────────────────────────
// Phase templates (globaux Mostra)
// ─────────────────────────────────────────────────────────────────

export async function getPhaseTemplates(supabase: Sb): Promise<PhaseTemplate[]> {
  const { data } = await supabase
    .from('phase_templates')
    .select('*')
    .order('sort_order', { ascending: true })

  return (data as PhaseTemplate[] | null) ?? []
}

// ─────────────────────────────────────────────────────────────────
// Détail complet d'un projet (page admin)
// ─────────────────────────────────────────────────────────────────

export interface CommentWithDetails extends Comment {
  author: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null
  phase_name: string | null
}

export interface ActivityWithUser extends ActivityLog {
  user: Pick<Profile, 'id' | 'full_name'> | null
}

export interface ProjectDetailData {
  project: Project
  /** Client CRM (table clients) ; NULL si projet non rattaché à un client. */
  client: Client | null
  /** Profile auth du client si un compte a été créé (clients.profile_id). */
  clientProfile: Profile | null
  projectManager: Profile | null
  phases: ProjectPhase[]
  subPhasesByPhase: Record<string, SubPhase[]>
  filesByPhase: Record<string, PhaseFile[]>
  comments: CommentWithDetails[]
  activity: ActivityWithUser[]
}

export async function getProjectDetail(
  supabase: Sb,
  projectId: string,
): Promise<ProjectDetailData | null> {
  // 1. Project
  const { data: rawProject } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle()

  const project = rawProject as Project | null
  if (!project) return null

  // 2. Phases + Client CRM + PM + Commentaires + Activity en parallèle
  const pmIds = project.project_manager_id ? [project.project_manager_id] : []

  const [phasesRes, clientRes, pmRes, commentsRes, activityRes] = await Promise.all([
    supabase
      .from('project_phases')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true }),
    project.client_id
      ? supabase.from('clients').select('*').eq('id', project.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    pmIds.length > 0
      ? supabase.from('profiles').select('*').in('id', pmIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from('comments')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
      .limit(100),
    supabase
      .from('activity_logs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(15),
  ])

  const phases = (phasesRes.data as ProjectPhase[] | null) ?? []

  // 2b. Sous-phases + fichiers en parallèle (dépendent de phases.length)
  const subPhasesByPhase: Record<string, SubPhase[]> = {}
  const filesByPhase: Record<string, PhaseFile[]> = {}

  if (phases.length > 0) {
    const phaseIds = phases.map((p) => p.id)
    const [subPhasesRes, filesRes] = await Promise.all([
      supabase
        .from('sub_phases')
        .select('*')
        .in('phase_id', phaseIds)
        .order('sort_order', { ascending: true }),
      supabase
        .from('phase_files')
        .select('*')
        .in('phase_id', phaseIds)
        .order('version', { ascending: false }),
    ])

    ;(subPhasesRes.data as SubPhase[] | null)?.forEach((sp) => {
      if (!subPhasesByPhase[sp.phase_id]) subPhasesByPhase[sp.phase_id] = []
      subPhasesByPhase[sp.phase_id].push(sp)
    })
    ;(filesRes.data as PhaseFile[] | null)?.forEach((f) => {
      if (!filesByPhase[f.phase_id]) filesByPhase[f.phase_id] = []
      filesByPhase[f.phase_id].push(f)
    })
  }

  // 3. Client CRM + PM + Profile auth du client (si compte créé)
  const client = (clientRes.data as Client | null) ?? null
  const pmList = (pmRes.data as Profile[] | null) ?? []
  const projectManager = project.project_manager_id
    ? (pmList.find((p) => p.id === project.project_manager_id) ?? null)
    : null

  // Profile du client (si lié) — pour avoir l'avatar_url et l'email pour les comments
  let clientProfile: Profile | null = null
  if (client?.profile_id) {
    const { data: rawClientProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', client.profile_id)
      .maybeSingle()
    clientProfile = rawClientProfile as Profile | null
  }

  // Map des profils connus (PM + client si compte) pour résoudre les auteurs/acteurs
  const profileMap = new Map<string, Profile>()
  if (projectManager) profileMap.set(projectManager.id, projectManager)
  if (clientProfile) profileMap.set(clientProfile.id, clientProfile)

  // 4. Commentaires + auteurs
  const phaseNameMap = new Map(phases.map((ph) => [ph.id, ph.name]))
  const comments = (commentsRes.data as Comment[] | null) ?? []

  // 5. Activity
  const activity = (activityRes.data as ActivityLog[] | null) ?? []

  // 6. Auteurs (comments + activity) — une seule query pour tous les profils manquants
  const authorIds = [...new Set(comments.map((c) => c.user_id).filter(Boolean))]
  const actorIds = [...new Set(activity.map((a) => a.user_id).filter(Boolean) as string[])]
  const allMissingIds = [...new Set([...authorIds, ...actorIds])].filter(
    (id) => !profileMap.has(id),
  )

  const authorMap = new Map<string, Pick<Profile, 'id' | 'full_name' | 'avatar_url'>>()
  const actorMap = new Map<string, Pick<Profile, 'id' | 'full_name'>>()

  if (allMissingIds.length > 0) {
    const { data: rawMissing } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', allMissingIds)
    ;(rawMissing as Pick<Profile, 'id' | 'full_name' | 'avatar_url'>[] | null)?.forEach((p) => {
      if (authorIds.includes(p.id)) authorMap.set(p.id, p)
      if (actorIds.includes(p.id)) actorMap.set(p.id, { id: p.id, full_name: p.full_name })
    })
  }

  // Les profils déjà dans profileMap (client/PM) servent aussi pour authors/actors
  for (const id of authorIds) {
    if (!authorMap.has(id) && profileMap.has(id)) {
      const p = profileMap.get(id)!
      authorMap.set(id, { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url })
    }
  }

  const getActor = (id: string | null) =>
    id ? (profileMap.get(id) ?? actorMap.get(id) ?? null) : null

  return {
    project,
    client,
    clientProfile,
    projectManager,
    phases,
    subPhasesByPhase,
    filesByPhase,
    comments: comments.map((c) => ({
      ...c,
      author:     authorMap.get(c.user_id) ?? null,
      phase_name: c.phase_id ? (phaseNameMap.get(c.phase_id) ?? null) : null,
    })),
    activity: activity.map((a) => ({
      ...a,
      user: getActor(a.user_id),
    })),
  }
}

// ─────────────────────────────────────────────────────────────────
// CRM Clients
// ─────────────────────────────────────────────────────────────────

/** Liste des clients CRM + stats projets (pour la page /clients). */
export async function getClientsWithStats(supabase: Sb): Promise<ClientWithStats[]> {
  const { data: rawClients } = await supabase
    .from('clients')
    .select('*')
    .order('updated_at', { ascending: false })

  const clients = (rawClients as Client[] | null) ?? []
  if (clients.length === 0) return []

  // Stats projets
  const clientIds = clients.map((c) => c.id)
  const { data: rawProjects } = await supabase
    .from('projects')
    .select('id, name, status, client_id, updated_at')
    .in('client_id', clientIds)
    .order('updated_at', { ascending: false })

  const projects = (rawProjects as {
    id: string
    name: string
    status: string
    client_id: string
    updated_at: string
  }[] | null) ?? []

  const byClient = new Map<string, { active: number; total: number; lastName: string | null }>()
  projects.forEach((p) => {
    const entry = byClient.get(p.client_id) ?? { active: 0, total: 0, lastName: null }
    entry.total += 1
    if (p.status === 'active') entry.active += 1
    if (!entry.lastName) entry.lastName = p.name
    byClient.set(p.client_id, entry)
  })

  return clients.map((c) => {
    const stats = byClient.get(c.id)
    return {
      ...c,
      active_projects: stats?.active ?? 0,
      total_projects:  stats?.total  ?? 0,
      last_project_name: stats?.lastName ?? null,
    }
  })
}

/**
 * Prospects de la zone "froide" (vue Prospection) : pipeline_stage ∈
 * froid / contacte / a_relancer. Triés par date de relance (la plus proche
 * d'abord, NULL en dernier), puis par dernière activité.
 * Renvoie [] si la migration 021 n'est pas encore appliquée (dégradation douce).
 */
export async function getProspects(supabase: Sb): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .in('pipeline_stage', ['froid', 'contacte', 'a_relancer'])
    .order('next_follow_up_on', { ascending: true, nullsFirst: false })
    .order('updated_at', { ascending: false })

  if (error) return []
  return (data as Client[] | null) ?? []
}

/** Détail d'un client CRM + projets liés + interactions. */
export interface ClientDetailData {
  client: Client
  projects: {
    id: string
    name: string
    status: string
    progress: number
    deadline: string | null
    value_eur: number | null
    updated_at: string
  }[]
  interactions: ClientInteraction[]
}

export async function getClientDetail(
  supabase: Sb,
  clientId: string,
): Promise<ClientDetailData | null> {
  const { data: rawClient } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .maybeSingle()

  const client = rawClient as Client | null
  if (!client) return null

  const [projectsRes, interactionsRes] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, status, progress, deadline, value_eur, updated_at')
      .eq('client_id', clientId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('client_interactions')
      .select('*')
      .eq('client_id', clientId)
      .order('occurred_at', { ascending: false })
      .limit(50),
  ])

  return {
    client,
    projects: (projectsRes.data as ClientDetailData['projects'] | null) ?? [],
    interactions: (interactionsRes.data as ClientInteraction[] | null) ?? [],
  }
}

// ─────────────────────────────────────────────────────────────────
// Finance / Cashflow (migration 020)
// ─────────────────────────────────────────────────────────────────
// NB : ces lectures nécessitent la migration 020. Si les tables/colonnes
// n'existent pas encore, Supabase renvoie une erreur (pas d'exception) et
// on retombe sur des tableaux vides → la page Finance s'affiche vide.

/** Dépenses ponctuelles + nom du projet rattaché (le cas échéant). */
export async function getExpenses(supabase: Sb): Promise<ExpenseWithProject[]> {
  const { data: rawExpenses } = await supabase
    .from('expenses')
    .select('*')
    .order('incurred_on', { ascending: false })

  const expenses = (rawExpenses as Expense[] | null) ?? []
  if (expenses.length === 0) return []

  // Résoudre le nom des projets rattachés
  const projectIds = [...new Set(expenses.map((e) => e.project_id).filter(Boolean) as string[])]
  const nameMap = new Map<string, string>()
  if (projectIds.length > 0) {
    const { data: rawProjects } = await supabase
      .from('projects')
      .select('id, name')
      .in('id', projectIds)
    ;(rawProjects as { id: string; name: string }[] | null)?.forEach((p) =>
      nameMap.set(p.id, p.name),
    )
  }

  return expenses.map((e) => ({
    ...e,
    project_name: e.project_id ? (nameMap.get(e.project_id) ?? null) : null,
  }))
}

/** Abonnements récurrents (actifs d'abord, puis par montant décroissant). */
export async function getSubscriptions(supabase: Sb): Promise<Subscription[]> {
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .order('active', { ascending: false })
    .order('amount_eur', { ascending: false })
  return (data as Subscription[] | null) ?? []
}

/** Revenus dérivés des projets valorisés (lecture seule, pas de table dédiée). */
export async function getRevenueEntries(supabase: Sb): Promise<RevenueEntry[]> {
  const { data: rawProjects } = await supabase
    .from('projects')
    .select('id, name, client_id, value_eur, paid_at, payment_status')
    .not('value_eur', 'is', null)
    .gt('value_eur', 0)

  const projects = (rawProjects as {
    id: string
    name: string
    client_id: string | null
    value_eur: number | null
    paid_at: string | null
    payment_status: PaymentStatus
  }[] | null) ?? []

  if (projects.length === 0) return []

  // Résoudre le nom des clients CRM liés
  const clientIds = [...new Set(projects.map((p) => p.client_id).filter(Boolean) as string[])]
  const clientMap = new Map<string, string>()
  if (clientIds.length > 0) {
    const { data: rawClients } = await supabase
      .from('clients')
      .select('id, contact_name, company_name')
      .in('id', clientIds)
    ;(rawClients as Pick<Client, 'id' | 'contact_name' | 'company_name'>[] | null)?.forEach((c) =>
      clientMap.set(c.id, c.company_name || c.contact_name),
    )
  }

  return projects
    .map((p) => ({
      id: p.id,
      name: p.name,
      client_name: p.client_id ? (clientMap.get(p.client_id) ?? null) : null,
      value_eur: p.value_eur ?? 0,
      paid_at: p.paid_at ?? null,
      payment_status: p.payment_status ?? 'pending',
    }))
    // Payés récents d'abord, puis le reste ; date d'encaissement décroissante.
    .sort((a, b) => {
      if (a.paid_at && b.paid_at) return b.paid_at.localeCompare(a.paid_at)
      if (a.paid_at) return -1
      if (b.paid_at) return 1
      return b.value_eur - a.value_eur
    })
}

/** Données Finance complètes (1 appel pour la page /finance). */
export interface FinanceData {
  expenses: ExpenseWithProject[]
  subscriptions: Subscription[]
  revenues: RevenueEntry[]
}

export async function getFinanceData(supabase: Sb): Promise<FinanceData> {
  const [expenses, subscriptions, revenues] = await Promise.all([
    getExpenses(supabase),
    getSubscriptions(supabase),
    getRevenueEntries(supabase),
  ])
  return { expenses, subscriptions, revenues }
}
