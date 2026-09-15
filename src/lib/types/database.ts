// ============================================================
// MOSTRA — Types TypeScript (basés sur le schema Supabase)
// Ref: supabase/migrations/017_radical_simplification.sql
// ============================================================
// Architecture : 2 rôles (admin/client), pas de multi-agence.
// Pour regénérer auto :
//   npx supabase gen types typescript --local > src/lib/types/database.ts
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// ----------------------------------------------------------
// Enums (valeurs CHECK dans le schema)
// ----------------------------------------------------------

/** Rôle de l'utilisateur. Dérivé de profiles.is_admin (true = 'admin', false = 'client'). */
export type UserRole = 'admin' | 'client'

export type ContactMethod = 'email' | 'whatsapp' | 'phone'

export type ProjectStatus = 'active' | 'completed' | 'archived' | 'on_hold'

/** Statut de paiement d'un projet (P3 — carte 360°). */
export type PaymentStatus = 'pending' | 'invoiced' | 'paid' | 'overdue' | 'partial'

export type PhaseStatus = 'pending' | 'in_progress' | 'in_review' | 'approved' | 'completed'

// ── CRM (migration 018) ───────────────────────────────────────────

// Plus de prospection : un client est soit actif, soit ancien (migration 036).
export type ClientStatus = 'active' | 'former'

export type ClientSource =
  | 'instagram'
  | 'linkedin'
  | 'word_of_mouth'
  | 'website'
  | 'referral'
  | 'cold_outreach'
  | 'other'

export type InteractionType =
  | 'message_sent'
  | 'message_received'
  | 'call'
  | 'meeting'
  | 'note'
  | 'email'

export type ActivityAction =
  | 'file_uploaded'
  | 'file_deleted'
  | 'phase_started'
  | 'phase_completed'
  | 'phase_review'
  | 'phase_approved'
  | 'comment_added'
  | 'status_changed'
  | 'project_created'
  | 'project_archived'
  | 'pm_assigned'

export type BlockType =
  | 'form_question'
  | 'script_section'
  | 'moodboard_image'
  | 'storyboard_shot'
  | 'audio_track'
  | 'design_file'

export type NotificationType =
  | 'comment_added'
  | 'phase_approved'
  | 'revision_requested'
  | 'form_submitted'
  | 'phase_ready'
  | 'file_uploaded'
  | 'project_created'

// ── Finance / Cashflow (migration 020) ────────────────────────────

/** Catégorie de dépense / abonnement (partagée expenses + subscriptions). */
export type FinanceCategory =
  | 'software'
  | 'hardware'
  | 'subcontracting'
  | 'marketing'
  | 'office'
  | 'other'

/** Périodicité d'un abonnement récurrent. */
export type BillingCycle = 'monthly' | 'yearly'

// ----------------------------------------------------------
// Row types (lignes telles que retournées par Supabase)
// ----------------------------------------------------------

export interface Profile {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  phone: string | null
  contact_method: ContactMethod
  /** Si true → admin (Tarik). Si false → client externe. */
  is_admin: boolean
  created_at: string
  updated_at: string
}

export interface PhaseTemplate {
  id: string
  name: string
  slug: string
  icon: string | null
  sort_order: number
  is_default: boolean
  /** Définition des sous-phases par défaut. */
  sub_phases: SubPhaseDefinition[]
  created_at: string
}

export interface Project {
  id: string
  name: string
  description: string | null
  /** Le client CRM (table clients) propriétaire du projet. NULL si non rattaché. */
  client_id: string | null
  /** Admin assigné comme project manager. */
  project_manager_id: string | null
  status: ProjectStatus
  progress: number
  /** Token public pour le lien client (lecture seule sans login). Régénérable. */
  share_token: string | null
  /** Date limite (P1/P3). */
  deadline: string | null
  /** Valeur en euros (P1/P3). */
  value_eur: number | null
  /** Statut de paiement (P3). */
  payment_status: PaymentStatus
  /** Lien vers le devis (PDF, Notion, Drive…) (P3). */
  quote_url: string | null
  /** Lien vers la facture (P3). */
  invoice_url: string | null
  /** Date d'encaissement effectif (P4 — alimente le récap mensuel exact). */
  paid_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Lien N-N projet ↔ clients CRM (migration 031). L'ensemble des clients
 * pouvant consulter/commenter/valider un projet. Le client principal
 * (projects.client_id) y figure toujours.
 */
export interface ProjectClient {
  project_id: string
  client_id: string
  created_at: string
}

// ── CRM Clients ──────────────────────────────────────────────────

export interface Client {
  id: string
  /** Raison sociale (NULL si freelance/particulier). */
  company_name: string | null
  /** Nom du contact principal (toujours requis). */
  contact_name: string
  email: string | null
  phone: string | null
  website: string | null
  /** URL profil prospect (LinkedIn / Instagram / X…), migration 021. */
  profile_url: string | null
  source: ClientSource
  status: ClientStatus
  last_message_sent_at: string | null
  last_reply_at: string | null
  follow_up_pending: boolean
  notes: string | null
  /** Si lié à un compte auth (profiles), c'est ici. NULL = prospect. */
  profile_id: string | null
  /** Société de rattachement (migration 033). NULL = fiche indépendante. */
  company_id: string | null
  created_at: string
  updated_at: string
}

export interface ClientInteraction {
  id: string
  client_id: string
  type: InteractionType
  content: string
  channel: string | null
  occurred_at: string
  created_by: string | null
  created_at: string
}

export interface ProjectPhase {
  id: string
  project_id: string
  phase_template_id: string | null
  name: string
  slug: string
  sort_order: number
  status: PhaseStatus
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface SubPhase {
  id: string
  phase_id: string
  name: string
  slug: string
  sort_order: number
  status: PhaseStatus
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

/** Tag d'une colonne de tableau de script — seul `voixoff` (Narration) est compté. */
export type ColumnTag = 'texte' | 'section' | 'intention' | 'voixoff' | 'visuals' | 'sfx'

/** Une colonne du tableau de script (migration 028). */
export interface ScriptColumn {
  id: string
  title: string
  tag: ColumnTag
  /** Largeur figée en px (sinon la colonne s'étire). */
  width?: number
  /** Colonne repliée (exclue du résumé et du comptage de mots). */
  collapsed?: boolean
}

/** Une catégorie (groupe de lignes : Hook, Corps, CTA…) du tableau (migration 028). */
export interface ScriptCategory {
  id: string
  name: string
  color?: string
}

/** Un repère de rythme/intention affiché dans le résumé, non compté (migration 028). */
export interface ScriptBeat {
  id: string
  title: string
  note: string
}

/** Un script (variante) au sein d'une sous-phase « Script » (migration 027 + 028). */
export interface Script {
  id: string
  sub_phase_id: string
  title: string
  description: string | null
  is_selected: boolean
  sort_order: number
  // ── Layout du tableau (migration 028) ──
  columns: ScriptColumn[]
  categories: ScriptCategory[]
  beats: ScriptBeat[]
  created_at: string
  updated_at: string
}

export interface PhaseBlock {
  id: string
  sub_phase_id: string | null
  phase_id: string | null
  /** Script auquel appartient le bloc (sections de script multi-scripts). */
  script_id: string | null
  type: BlockType
  content: Json
  sort_order: number
  is_approved: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface FormTemplate {
  id: string
  name: string
  description: string | null
  questions: FormQuestion[]
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface PhaseFile {
  id: string
  phase_id: string
  uploaded_by: string
  file_name: string
  file_url: string
  file_type: string | null
  file_size: number | null
  version: number
  is_current: boolean
  created_at: string
}

export interface Comment {
  id: string
  project_id: string
  phase_id: string | null
  sub_phase_id: string | null
  block_id: string | null
  user_id: string
  content: string
  is_resolved: boolean
  parent_id: string | null
  /** Secondes dans la vidéo (Video Review). */
  timecode_seconds: number | null
  /** Version de la vidéo liée au commentaire. */
  video_version: number | null
  created_at: string
  updated_at: string
}

export interface ActivityLog {
  id: string
  project_id: string
  user_id: string | null
  action: ActivityAction
  details: Json | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  project_id: string | null
  type: NotificationType
  title: string
  message: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export interface PasswordSetupToken {
  id: string
  user_id: string
  token: string
  used_at: string | null
  expires_at: string
  created_at: string
}

// ── Finance / Cashflow (migration 020) ────────────────────────────

/** Dépense ponctuelle, optionnellement rattachée à un projet. */
export interface Expense {
  id: string
  label: string
  amount_eur: number
  category: FinanceCategory
  incurred_on: string
  /** Rattache la dépense à un projet (rentabilité projet). NULL sinon. */
  project_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Abonnement récurrent (mensuel / annuel). */
export interface Subscription {
  id: string
  label: string
  amount_eur: number
  billing_cycle: BillingCycle
  category: FinanceCategory
  active: boolean
  started_on: string
  notes: string | null
  created_at: string
  updated_at: string
}

// ----------------------------------------------------------
// Block content types (contenu JSON typé par type de bloc)
// ----------------------------------------------------------

export type QuestionType = 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'number' | 'date'

export interface FormQuestion {
  id: string
  label: string
  type: QuestionType
  required: boolean
  options?: string[]
  placeholder?: string
  helpText?: string
}

export interface FormQuestionContent {
  label: string
  answer: string | null
  required: boolean
  type: QuestionType
  options?: string[]
  placeholder?: string
  helpText?: string
}

/**
 * Ancien format d'une section de script (modèle « cartes », pré-migration 028).
 * Conservé pour la lecture rétro-compatible — l'app le convertit vers le modèle
 * tableau à la volée (voir src/lib/scriptTable.ts).
 */
export interface ScriptSectionContent {
  title: string
  color: string
  content: string
  description?: string
  /** Texte de la voix off (narration) de la section. */
  vo?: string
}

/**
 * Contenu d'une LIGNE du tableau de script (phase_blocks type `script_section`,
 * migration 028). Le layout (colonnes/catégories) vit sur la ligne `scripts`.
 */
export interface ScriptRowContent {
  /** Catégorie (ScriptCategory.id) à laquelle la ligne appartient. */
  categoryId: string
  /** Texte par colonne : { [ScriptColumn.id]: valeur }. */
  cells: Record<string, string>
}

export interface MoodboardImageContent {
  title: string
  image_url: string
  description?: string
  is_selected: boolean
}

export interface StoryboardShotContent {
  shot_number: number
  image_url: string
  description?: string
}

export interface AudioTrackContent {
  title: string
  audio_url: string
  description?: string
  kind: 'vo' | 'music'
  is_selected: boolean
  duration_seconds?: number
}

export interface DesignFileContent {
  file_url: string
  file_name: string
  file_size: number
  mime_type: string
  description?: string
}

export type BlockContentByType = {
  form_question:   FormQuestionContent
  script_section:  ScriptSectionContent
  moodboard_image: MoodboardImageContent
  storyboard_shot: StoryboardShotContent
  audio_track:     AudioTrackContent
  design_file:     DesignFileContent
}

export type TypedPhaseBlock<T extends BlockType> = Omit<PhaseBlock, 'content'> & {
  type: T
  content: BlockContentByType[T]
}

export interface SubPhaseDefinition {
  name: string
  slug: string
  sort_order: number
}

// ----------------------------------------------------------
// Insert types
// ----------------------------------------------------------

export type ProfileInsert = Omit<Profile, 'created_at' | 'updated_at'> & {
  avatar_url?: string | null
  phone?: string | null
  contact_method?: ContactMethod
  is_admin?: boolean
}

export type PhaseTemplateInsert = Omit<PhaseTemplate, 'id' | 'created_at'> & {
  id?: string
  sub_phases?: SubPhaseDefinition[]
}

export type ProjectInsert = Omit<Project, 'id' | 'created_at' | 'updated_at' | 'share_token' | 'deadline' | 'value_eur' | 'payment_status' | 'quote_url' | 'invoice_url' | 'paid_at'> & {
  id?: string
  share_token?: string | null
  deadline?: string | null
  value_eur?: number | null
  payment_status?: PaymentStatus
  quote_url?: string | null
  invoice_url?: string | null
  paid_at?: string | null
}

export type ClientInsert = Omit<Client, 'id' | 'created_at' | 'updated_at' | 'last_message_sent_at' | 'last_reply_at' | 'follow_up_pending' | 'profile_id' | 'notes' | 'company_name' | 'email' | 'phone' | 'website' | 'profile_url' | 'company_id'> & {
  id?: string
  company_name?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  profile_url?: string | null
  notes?: string | null
  follow_up_pending?: boolean
  last_message_sent_at?: string | null
  last_reply_at?: string | null
  profile_id?: string | null
  company_id?: string | null
}

export type ClientUpdate = Partial<Omit<Client, 'id' | 'created_at'>>

export type ClientInteractionInsert = Omit<ClientInteraction, 'id' | 'created_at' | 'occurred_at' | 'channel' | 'created_by'> & {
  id?: string
  occurred_at?: string
  channel?: string | null
  created_by?: string | null
}

export type ProjectPhaseInsert = Omit<ProjectPhase, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  started_at?: string | null
  completed_at?: string | null
}

export type SubPhaseInsert = Omit<SubPhase, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  started_at?: string | null
  completed_at?: string | null
}

export type PhaseBlockInsert = Omit<PhaseBlock, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  is_approved?: boolean
}

export type FormTemplateInsert = Omit<FormTemplate, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  is_default?: boolean
}

export type PhaseFileInsert = Omit<PhaseFile, 'id' | 'created_at'> & {
  id?: string
}

export type CommentInsert = Omit<Comment, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  is_resolved?: boolean
  parent_id?: string | null
  sub_phase_id?: string | null
  block_id?: string | null
  timecode_seconds?: number | null
  video_version?: number | null
}

export type ActivityLogInsert = Omit<ActivityLog, 'id' | 'created_at'> & {
  id?: string
  details?: Json | null
}

export type NotificationInsert = Omit<Notification, 'id' | 'created_at' | 'is_read'> & {
  id?: string
  is_read?: boolean
}

export type PasswordSetupTokenInsert = Omit<PasswordSetupToken, 'id' | 'token' | 'used_at' | 'expires_at' | 'created_at'> & {
  id?: string
  token?: string
  used_at?: string | null
  expires_at?: string
}

export type ExpenseInsert = Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'category' | 'incurred_on' | 'project_id' | 'notes' | 'created_by'> & {
  id?: string
  category?: FinanceCategory
  incurred_on?: string
  project_id?: string | null
  notes?: string | null
  created_by?: string | null
}

export type SubscriptionInsert = Omit<Subscription, 'id' | 'created_at' | 'updated_at' | 'billing_cycle' | 'category' | 'active' | 'started_on' | 'notes'> & {
  id?: string
  billing_cycle?: BillingCycle
  category?: FinanceCategory
  active?: boolean
  started_on?: string
  notes?: string | null
}

// ----------------------------------------------------------
// Update types
// ----------------------------------------------------------

export type ProfileUpdate     = Partial<Omit<Profile, 'id' | 'created_at'>>
export type ProjectUpdate     = Partial<Omit<Project, 'id' | 'created_at'>>
export type ProjectPhaseUpdate = Partial<Omit<ProjectPhase, 'id' | 'created_at'>>
export type SubPhaseUpdate    = Partial<Omit<SubPhase, 'id' | 'created_at'>>
export type PhaseBlockUpdate  = Partial<Omit<PhaseBlock, 'id' | 'created_at'>>
export type FormTemplateUpdate = Partial<Omit<FormTemplate, 'id' | 'created_at'>>
export type PhaseFileUpdate   = Partial<Omit<PhaseFile, 'id' | 'created_at'>>
export type CommentUpdate     = Partial<Omit<Comment, 'id' | 'created_at'>>
export type NotificationUpdate = Partial<Omit<Notification, 'id' | 'user_id' | 'created_at'>>
export type ExpenseUpdate      = Partial<Omit<Expense, 'id' | 'created_at' | 'created_by'>>
export type SubscriptionUpdate = Partial<Omit<Subscription, 'id' | 'created_at'>>

// ----------------------------------------------------------
// Composite types (avec JOINs fréquents)
// ----------------------------------------------------------

export interface ProjectWithPhases extends Project {
  phases: ProjectPhase[]
}

export interface ProjectWithDetails extends Project {
  phases: PhaseWithSubPhases[]
  client: Profile | null
  project_manager: Profile | null
}

export interface PhaseWithSubPhases extends ProjectPhase {
  sub_phases: SubPhaseWithBlocks[]
  files: PhaseFile[]
}

export interface SubPhaseWithBlocks extends SubPhase {
  blocks: PhaseBlock[]
}

export interface SubPhaseWithBlocksAndComments extends SubPhase {
  blocks: PhaseBlockWithComments[]
}

export interface PhaseBlockWithComments extends PhaseBlock {
  comments: CommentWithAuthor[]
}

/** @deprecated Préférer PhaseWithSubPhases */
export interface PhaseWithFiles extends ProjectPhase {
  files: PhaseFile[]
}

/** @deprecated Préférer SubPhaseWithBlocksAndComments */
export interface PhaseWithFilesAndComments extends ProjectPhase {
  files: PhaseFile[]
  comments: CommentWithAuthor[]
}

export interface CommentWithAuthor extends Comment {
  author: Profile
  replies?: CommentWithAuthor[]
}

export interface ActivityLogWithUser extends ActivityLog {
  user: Profile | null
}

export interface ProjectSummary {
  id: string
  name: string
  status: ProjectStatus
  progress: number
  current_phase: ProjectPhase | null
  /** Client CRM lié au projet (NULL si non rattaché). */
  client: Pick<Client, 'id' | 'contact_name' | 'company_name'> | null
  deadline: string | null
  value_eur: number | null
  payment_status: PaymentStatus
  paid_at: string | null
  updated_at: string
}

/** Client + stats agrégées (utilisé sur /clients). */
export interface ClientWithStats extends Client {
  active_projects: number
  total_projects: number
  last_project_name: string | null
}

/** Dépense + nom du projet rattaché (utilisé sur /finance). */
export interface ExpenseWithProject extends Expense {
  project_name: string | null
}

/** Revenu dérivé d'un projet payé (utilisé sur /finance, lecture seule). */
export interface RevenueEntry {
  id: string
  name: string
  client_name: string | null
  value_eur: number
  paid_at: string | null
  payment_status: PaymentStatus
}

// ── Revenus libres / hors-projet (migration 032) ──────────────────

export type RevenueCategory = 'service' | 'retainer' | 'training' | 'affiliate' | 'other'

export interface Revenue {
  id: string
  label: string
  amount_eur: number
  /** Date d'encaissement (alimente le cashflow). */
  received_on: string
  category: RevenueCategory
  /** Client CRM optionnellement rattaché. */
  client_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type RevenueInsert = Omit<
  Revenue,
  | 'id' | 'created_at' | 'updated_at'
  | 'received_on' | 'category' | 'client_id' | 'notes' | 'created_by'
> & {
  id?: string
  received_on?: string
  category?: RevenueCategory
  client_id?: string | null
  notes?: string | null
  created_by?: string | null
}

export type RevenueUpdate = Partial<Omit<Revenue, 'id' | 'created_at'>>

/** Revenu libre + nom du client rattaché (affichage /finance). */
export interface RevenueWithClient extends Revenue {
  client_name: string | null
}

// ── Sociétés : regroupement de clients (migration 033) ────────────

export interface Company {
  id: string
  name: string
  website: string | null
  notes: string | null
  /** Statut CRM (pipeline), comme les clients (migration 034). */
  status: ClientStatus
  created_at: string
  updated_at: string
}

export type CompanyInsert = Omit<Company, 'id' | 'created_at' | 'updated_at' | 'website' | 'notes' | 'status'> & {
  id?: string
  website?: string | null
  notes?: string | null
  status?: ClientStatus
}

export type CompanyUpdate = Partial<Omit<Company, 'id' | 'created_at'>>

/** Société + stats (contacts, projets, CA cumulé) pour la liste et la fiche. */
export interface CompanyWithStats extends Company {
  client_count: number
  project_count: number
  total_revenue: number
}

// ── Équipe : annuaire des intervenants (migration 030) ────────────

/** Disponibilité d'un membre, réglée à la main (pastille vert/bleu/rouge/orange). */
export type TeamAvailability = 'active' | 'occasional' | 'unavailable' | 'on_leave'

/** Métier configurable (motion designer, voix off…). Façon data_sets. */
export interface TeamRole {
  id: string
  name: string
  color: string
  sort_order: number
  created_at: string
  updated_at: string
}

/** Fiche d'un intervenant (freelance). Pas de compte auth — géré par l'admin. */
export interface TeamMember {
  id: string
  contact_name: string
  email: string | null
  phone: string | null
  portfolio_url: string | null
  /** Langues parlées (champ libre « FR, EN »), clé pour les voix off. */
  languages: string | null
  /** Tarifs optionnels (préparent la future marge projet ↔ Finance). */
  daily_rate_eur: number | null
  project_rate_eur: number | null
  availability: TeamAvailability
  /** Spécialités / tags libres. */
  tags: string[] | null
  notes: string | null
  created_at: string
  updated_at: string
}

/** Lien N-N membre ↔ métier. */
export interface TeamMemberRole {
  member_id: string
  role_id: string
}

export type TeamMemberInsert = Omit<
  TeamMember,
  | 'id' | 'created_at' | 'updated_at'
  | 'email' | 'phone' | 'portfolio_url' | 'languages'
  | 'daily_rate_eur' | 'project_rate_eur' | 'tags' | 'notes' | 'availability'
> & {
  id?: string
  email?: string | null
  phone?: string | null
  portfolio_url?: string | null
  languages?: string | null
  daily_rate_eur?: number | null
  project_rate_eur?: number | null
  availability?: TeamAvailability
  tags?: string[] | null
  notes?: string | null
}

export type TeamMemberUpdate = Partial<Omit<TeamMember, 'id' | 'created_at'>>

/** Membre + ses métiers résolus (utilisé par l'annuaire et la fiche). */
export interface TeamMemberWithRoles extends TeamMember {
  roles: TeamRole[]
}

// ----------------------------------------------------------
// Database type (structure Supabase)
// ----------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row:    Profile
        Insert: ProfileInsert
        Update: ProfileUpdate
      }
      phase_templates: {
        Row:    PhaseTemplate
        Insert: PhaseTemplateInsert
        Update: Partial<Omit<PhaseTemplate, 'id' | 'created_at'>>
      }
      projects: {
        Row:    Project
        Insert: ProjectInsert
        Update: ProjectUpdate
      }
      project_clients: {
        Row:    ProjectClient
        Insert: Partial<ProjectClient>
        Update: never
      }
      project_phases: {
        Row:    ProjectPhase
        Insert: ProjectPhaseInsert
        Update: ProjectPhaseUpdate
      }
      sub_phases: {
        Row:    SubPhase
        Insert: SubPhaseInsert
        Update: SubPhaseUpdate
      }
      phase_blocks: {
        Row:    PhaseBlock
        Insert: PhaseBlockInsert
        Update: PhaseBlockUpdate
      }
      scripts: {
        Row:    Script
        Insert: Partial<Script>
        Update: Partial<Script>
      }
      form_templates: {
        Row:    FormTemplate
        Insert: FormTemplateInsert
        Update: FormTemplateUpdate
      }
      phase_files: {
        Row:    PhaseFile
        Insert: PhaseFileInsert
        Update: PhaseFileUpdate
      }
      comments: {
        Row:    Comment
        Insert: CommentInsert
        Update: CommentUpdate
      }
      activity_logs: {
        Row:    ActivityLog
        Insert: ActivityLogInsert
        Update: never
      }
      notifications: {
        Row:    Notification
        Insert: NotificationInsert
        Update: NotificationUpdate
      }
      password_setup_tokens: {
        Row:    PasswordSetupToken
        Insert: PasswordSetupTokenInsert
        Update: never
      }
      clients: {
        Row:    Client
        Insert: ClientInsert
        Update: ClientUpdate
      }
      client_interactions: {
        Row:    ClientInteraction
        Insert: ClientInteractionInsert
        Update: Partial<Omit<ClientInteraction, 'id' | 'created_at' | 'client_id'>>
      }
      expenses: {
        Row:    Expense
        Insert: ExpenseInsert
        Update: ExpenseUpdate
      }
      revenues: {
        Row:    Revenue
        Insert: RevenueInsert
        Update: RevenueUpdate
      }
      companies: {
        Row:    Company
        Insert: CompanyInsert
        Update: CompanyUpdate
      }
      subscriptions: {
        Row:    Subscription
        Insert: SubscriptionInsert
        Update: SubscriptionUpdate
      }
      team_roles: {
        Row:    TeamRole
        Insert: Partial<TeamRole>
        Update: Partial<TeamRole>
      }
      team_members: {
        Row:    TeamMember
        Insert: TeamMemberInsert
        Update: TeamMemberUpdate
      }
      team_member_roles: {
        Row:    TeamMemberRole
        Insert: Partial<TeamMemberRole>
        Update: never
      }
    }
    Functions: {
      is_admin: {
        Args:    Record<string, never>
        Returns: boolean
      }
      is_project_client: {
        Args:    { p_project_id: string }
        Returns: boolean
      }
    }
  }
}
