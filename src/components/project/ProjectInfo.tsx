import { Mail, Phone, MessageCircle, Calendar, Building2 } from 'lucide-react'
import { formatDate } from '@/lib/utils/dates'
import ProjectClientsManager from './ProjectClientsManager'
import AssignPMButton from './AssignPMButton'
import type { Client, ContactMethod, Profile, Project, UserRole } from '@/lib/types'

interface ClientOption {
  /** clients.id (CRM) */
  id: string
  contactName: string
  companyName: string | null
  email: string | null
}

interface PMOption {
  userId: string
  fullName: string
  email: string
  role: UserRole
}

const CONTACT_ICONS: Record<ContactMethod, typeof Mail> = {
  email: Mail,
  phone: Phone,
  whatsapp: MessageCircle,
}

const CONTACT_LABELS: Record<ContactMethod, string> = {
  email: 'Email',
  phone: 'Téléphone',
  whatsapp: 'WhatsApp',
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-widest text-faint uppercase mb-1.5">
      {children}
    </p>
  )
}

interface ProjectInfoProps {
  project: Project
  /** Fiche CRM PRINCIPALE (projects.client_id) ; NULL si non rattaché. */
  client: Client | null
  /** Tous les clients du projet (principal + additionnels, migration 031). */
  clients?: Client[]
  projectManager: Profile | null
  isAdmin?: boolean
  availableClients?: ClientOption[]
  availablePMs?: PMOption[]
}

export default function ProjectInfo({
  project,
  client,
  clients = [],
  projectManager,
  isAdmin = false,
  availableClients = [],
  availablePMs = [],
}: ProjectInfoProps) {
  const progressColor =
    project.progress >= 75
      ? 'text-[#22C55E]'
      : project.progress >= 40
        ? 'text-[#F59E0B]'
        : 'text-[#EF4444]'

  return (
    <div className="bg-surface border border-line rounded-xl p-5 space-y-5">
      {/* Progression */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-faint">Progression</p>
          <p className={`text-2xl font-bold tabular-nums ${progressColor}`}>{project.progress}%</p>
        </div>
        {/* Mini arc visuel */}
        <div className="relative w-12 h-12 flex-shrink-0">
          <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
            <circle cx="24" cy="24" r="19" fill="none" stroke="rgb(var(--c-border))" strokeWidth="4" />
            <circle
              cx="24"
              cy="24"
              r="19"
              fill="none"
              stroke="rgb(var(--c-brand))"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 19}`}
              strokeDashoffset={`${2 * Math.PI * 19 * (1 - project.progress / 100)}`}
              className="transition-all duration-500"
            />
          </svg>
        </div>
      </div>

      <div className="h-px bg-surface-2" />

      {/* Client(s) */}
      <div>
        <SectionLabel>{clients.length > 1 ? 'Clients' : 'Client'}</SectionLabel>
        {isAdmin ? (
          <ProjectClientsManager
            projectId={project.id}
            clients={clients
              .map((c) => ({
                id: c.id,
                displayName: c.company_name || c.contact_name,
                subtitle: c.company_name ? c.contact_name : c.email,
                isPrimary: c.id === project.client_id,
                hasAccount: !!c.profile_id,
              }))
              .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))}
            availableClients={availableClients}
          />
        ) : client ? (
          <>
            <p className="text-sm text-ink font-medium">
              {client.company_name || client.contact_name}
            </p>
            {client.company_name && (
              <p className="text-xs text-dim mt-0.5 flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {client.contact_name}
              </p>
            )}
            {client.email && (
              <p className="text-xs text-faint mt-0.5">{client.email}</p>
            )}
          </>
        ) : (
          <p className="text-sm text-faint italic">Aucun client assigné</p>
        )}
      </div>

      <div className="h-px bg-surface-2" />

      {/* Project Manager */}
      <div>
        <SectionLabel>Project Manager</SectionLabel>
        {projectManager ? (
          <div>
            <p className="text-sm text-ink font-medium">{projectManager.full_name}</p>
            <div className="flex items-center gap-1.5 mt-1">
              {(() => {
                const Icon = CONTACT_ICONS[projectManager.contact_method]
                return (
                  <>
                    <Icon className="h-3 w-3 text-faint" />
                    <span className="text-xs text-faint">
                      {CONTACT_LABELS[projectManager.contact_method]}
                    </span>
                  </>
                )
              })()}
            </div>
          </div>
        ) : (
          <p className="text-sm text-faint italic">Non assigné</p>
        )}
        {isAdmin && (
          <AssignPMButton
            projectId={project.id}
            currentPMId={project.project_manager_id}
            members={availablePMs}
          />
        )}
      </div>

      <div className="h-px bg-surface-2" />

      {/* Date de création */}
      <div>
        <SectionLabel>Créé le</SectionLabel>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-faint" />
          <p className="text-sm text-dim">{formatDate(project.created_at)}</p>
        </div>
      </div>

      {/* Share token (lien client) */}
      {project.share_token && (
        <>
          <div className="h-px bg-surface-2" />
          <div>
            <SectionLabel>Lien client</SectionLabel>
            <p className="text-xs text-faint font-mono break-all">
              /client/{project.share_token}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
