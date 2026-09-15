import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type {
  ActivityLog,
  Client,
  ClientInteraction,
  ClientWithStats,
  Comment,
  Company,
  CompanyWithStats,
  Expense,
  ExpenseWithProject,
  PaymentStatus,
  PhaseFile,
  PhaseTemplate,
  Profile,
  Project,
  ProjectPhase,
  ProjectSummary,
  Revenue,
  RevenueEntry,
  RevenueWithClient,
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
  /** Client CRM PRINCIPAL (projects.client_id) ; NULL si non rattaché. */
  client: Client | null
  /** Tous les clients du projet (principal + additionnels, migration 031). */
  clients: Client[]
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

  const [phasesRes, projectClientsRes, pmRes, commentsRes, activityRes] = await Promise.all([
    supabase
      .from('project_phases')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true }),
    supabase.from('project_clients').select('client_id').eq('project_id', projectId),
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

  // 3. Clients CRM (principal + additionnels) + PM + Profile auth du principal
  const linkIds = ((projectClientsRes.data as { client_id: string }[] | null) ?? []).map(
    (l) => l.client_id,
  )
  const clientIds = Array.from(
    new Set([...(project.client_id ? [project.client_id] : []), ...linkIds]),
  )
  let clients: Client[] = []
  if (clientIds.length > 0) {
    const { data: rawClients } = await supabase.from('clients').select('*').in('id', clientIds)
    clients = (rawClients as Client[] | null) ?? []
  }
  const client = clients.find((c) => c.id === project.client_id) ?? null
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
    clients,
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

/** Revenus libres (table `revenues`, migration 032) + nom du client rattaché. */
export async function getManualRevenues(supabase: Sb): Promise<RevenueWithClient[]> {
  const { data: rawRevenues } = await supabase
    .from('revenues')
    .select('*')
    .order('received_on', { ascending: false })

  const revenues = (rawRevenues as Revenue[] | null) ?? []
  if (revenues.length === 0) return []

  const clientIds = [...new Set(revenues.map((r) => r.client_id).filter(Boolean) as string[])]
  const nameMap = new Map<string, string>()
  if (clientIds.length > 0) {
    const { data: rawClients } = await supabase
      .from('clients')
      .select('id, contact_name, company_name')
      .in('id', clientIds)
    ;(rawClients as Pick<Client, 'id' | 'contact_name' | 'company_name'>[] | null)?.forEach((c) =>
      nameMap.set(c.id, c.company_name || c.contact_name),
    )
  }

  return revenues.map((r) => ({
    ...r,
    client_name: r.client_id ? (nameMap.get(r.client_id) ?? null) : null,
  }))
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
  /** Revenus dérivés des projets valorisés (lecture seule). */
  revenues: RevenueEntry[]
  /** Revenus libres saisis à la main (migration 032). */
  manualRevenues: RevenueWithClient[]
}

export async function getFinanceData(supabase: Sb): Promise<FinanceData> {
  const [expenses, subscriptions, revenues, manualRevenues] = await Promise.all([
    getExpenses(supabase),
    getSubscriptions(supabase),
    getRevenueEntries(supabase),
    getManualRevenues(supabase),
  ])
  return { expenses, subscriptions, revenues, manualRevenues }
}

// ─────────────────────────────────────────────────────────────────
// Sociétés (migration 033) — regroupement de clients
// ─────────────────────────────────────────────────────────────────

/** Liste légère des sociétés (pour les sélecteurs). */
export async function getAllCompanies(supabase: Sb): Promise<Company[]> {
  const { data } = await supabase.from('companies').select('*').order('name', { ascending: true })
  return (data as Company[] | null) ?? []
}

/** Sociétés + stats (contacts, projets, CA encaissé cumulé) pour la liste. */
export async function getCompaniesWithStats(supabase: Sb): Promise<CompanyWithStats[]> {
  const { data: rawCompanies } = await supabase
    .from('companies')
    .select('*')
    .order('name', { ascending: true })
  const companies = (rawCompanies as Company[] | null) ?? []
  if (companies.length === 0) return []

  const { data: rawClients } = await supabase.from('clients').select('id, company_id')
  const clients = (rawClients as { id: string; company_id: string | null }[] | null) ?? []

  const clientCountByCompany = new Map<string, number>()
  const companyByClient = new Map<string, string>()
  for (const c of clients) {
    if (!c.company_id) continue
    clientCountByCompany.set(c.company_id, (clientCountByCompany.get(c.company_id) ?? 0) + 1)
    companyByClient.set(c.id, c.company_id)
  }

  const allClientIds = [...companyByClient.keys()]
  const projectCountByCompany = new Map<string, number>()
  const revenueByCompany = new Map<string, number>()

  if (allClientIds.length > 0) {
    const { data: rawProjects } = await supabase
      .from('projects')
      .select('client_id, value_eur, payment_status')
      .in('client_id', allClientIds)
    for (const p of (rawProjects as {
      client_id: string | null
      value_eur: number | null
      payment_status: PaymentStatus
    }[] | null) ?? []) {
      if (!p.client_id) continue
      const companyId = companyByClient.get(p.client_id)
      if (!companyId) continue
      projectCountByCompany.set(companyId, (projectCountByCompany.get(companyId) ?? 0) + 1)
      if (p.payment_status === 'paid' && p.value_eur) {
        revenueByCompany.set(companyId, (revenueByCompany.get(companyId) ?? 0) + p.value_eur)
      }
    }
  }

  return companies.map((co) => ({
    ...co,
    client_count: clientCountByCompany.get(co.id) ?? 0,
    project_count: projectCountByCompany.get(co.id) ?? 0,
    total_revenue: revenueByCompany.get(co.id) ?? 0,
  }))
}

export interface CompanyProjectRow {
  id: string
  name: string
  status: string
  value_eur: number | null
  payment_status: PaymentStatus
  client_id: string | null
  updated_at: string
}

export interface CompanyDetailData {
  company: Company
  clients: ClientWithStats[]
  projects: CompanyProjectRow[]
  totalRevenue: number
}

export async function getCompanyDetail(supabase: Sb, id: string): Promise<CompanyDetailData | null> {
  const { data: rawCompany } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  const company = rawCompany as Company | null
  if (!company) return null

  const { data: rawClients } = await supabase
    .from('clients')
    .select('*')
    .eq('company_id', id)
    .order('contact_name', { ascending: true })
  const clientRows = (rawClients as Client[] | null) ?? []
  const clientIds = clientRows.map((c) => c.id)

  let projects: CompanyProjectRow[] = []
  const activeByClient = new Map<string, number>()
  const totalByClient = new Map<string, number>()
  const lastNameByClient = new Map<string, string>()
  let totalRevenue = 0

  if (clientIds.length > 0) {
    const { data: rawProjects } = await supabase
      .from('projects')
      .select('id, name, status, value_eur, payment_status, client_id, updated_at')
      .in('client_id', clientIds)
      .order('updated_at', { ascending: false })
    projects = (rawProjects as CompanyProjectRow[] | null) ?? []
    for (const p of projects) {
      if (p.client_id) {
        totalByClient.set(p.client_id, (totalByClient.get(p.client_id) ?? 0) + 1)
        if (p.status === 'active') {
          activeByClient.set(p.client_id, (activeByClient.get(p.client_id) ?? 0) + 1)
        }
        if (!lastNameByClient.has(p.client_id)) lastNameByClient.set(p.client_id, p.name)
      }
      if (p.payment_status === 'paid' && p.value_eur) totalRevenue += p.value_eur
    }
  }

  const clients: ClientWithStats[] = clientRows.map((c) => ({
    ...c,
    active_projects: activeByClient.get(c.id) ?? 0,
    total_projects: totalByClient.get(c.id) ?? 0,
    last_project_name: lastNameByClient.get(c.id) ?? null,
  }))

  return { company, clients, projects, totalRevenue }
}
