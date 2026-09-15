import { Download, ExternalLink, FileText, Receipt } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate } from '@/lib/utils/dates'
import { EmptyState } from '@/components/shared/EmptyState'
import type { PhaseFile, Project, ProjectPhase } from '@/lib/types'

interface Props {
  projectId: string
}

function formatSize(bytes: number | null): string | null {
  if (!bytes) return null
  const mb = bytes / 1_048_576
  return mb >= 1 ? `${mb.toFixed(1)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`
}

/**
 * Tous les documents utiles du projet au même endroit : les livrables déposés
 * sur chaque étape, et les pièces de facturation. Les liens sont signés à la
 * volée — le bucket est privé.
 */
export default async function ProjectDocuments({ projectId }: Props) {
  const admin = createAdminClient()

  const { data: rawProject } = await admin
    .from('projects')
    .select('id, quote_url, invoice_url')
    .eq('id', projectId)
    .maybeSingle()
  const project = rawProject as Pick<Project, 'id' | 'quote_url' | 'invoice_url'> | null

  const { data: rawPhases } = await admin
    .from('project_phases')
    .select('id, name, sort_order')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
  const phases = (rawPhases as Pick<ProjectPhase, 'id' | 'name' | 'sort_order'>[] | null) ?? []

  const { data: rawFiles } = phases.length
    ? await admin
        .from('phase_files')
        .select('*')
        .in(
          'phase_id',
          phases.map((p) => p.id),
        )
        .eq('is_current', true)
        .order('version', { ascending: false })
    : { data: null }

  const files = (rawFiles as PhaseFile[] | null) ?? []

  // Une URL signée par fichier — le bucket project-files n'est pas public.
  const signed = await Promise.all(
    files.map(async (f) => {
      const match = f.file_url.match(/\/project-files\/(.+?)(?:\?|$)/)
      const path = match ? match[1] : f.file_url
      const { data } = await admin.storage.from('project-files').createSignedUrl(path, 3600)
      return { file: f, url: data?.signedUrl ?? '' }
    }),
  )

  const byPhase = phases
    .map((phase) => ({
      phase,
      items: signed.filter((s) => s.file.phase_id === phase.id),
    }))
    .filter((g) => g.items.length > 0)

  const billing = [
    project?.quote_url ? { label: 'Devis', href: project.quote_url, icon: FileText } : null,
    project?.invoice_url ? { label: 'Facture', href: project.invoice_url, icon: Receipt } : null,
  ].filter(Boolean) as { label: string; href: string; icon: typeof FileText }[]

  if (byPhase.length === 0 && billing.length === 0) {
    return (
      <div className="surface">
        <EmptyState
          icon={FileText}
          title="Aucun document pour l’instant"
          description="Les livrables déposés sur les étapes et les pièces de facturation apparaîtront ici au fil du projet."
        />
      </div>
    )
  }

  return (
    <div className="space-y-7">
      {byPhase.map(({ phase, items }) => (
        <section key={phase.id}>
          <h2 className="mono-label mb-3 text-faint">{phase.name}</h2>
          <div className="surface divide-y divide-line">
            {items.map(({ file, url }) => {
              const size = formatSize(file.file_size)
              return (
                <a
                  key={file.id}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 px-5 py-3.5 transition-colors duration-[160ms] hover:bg-surface-2"
                >
                  <FileText
                    className="h-[18px] w-[18px] flex-shrink-0 text-faint"
                    strokeWidth={1.75}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-ink">
                      {file.file_name}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] text-faint">
                      Version {file.version} · {formatDate(file.created_at)}
                      {size && ` · ${size}`}
                    </span>
                  </span>
                  <Download className="h-4 w-4 flex-shrink-0 text-faint transition-colors group-hover:text-ink" />
                </a>
              )
            })}
          </div>
        </section>
      ))}

      {billing.length > 0 && (
        <section>
          <h2 className="mono-label mb-3 text-faint">Facturation</h2>
          <div className="surface divide-y divide-line">
            {billing.map(({ label, href, icon: Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 px-5 py-3.5 transition-colors duration-[160ms] hover:bg-surface-2"
              >
                <Icon className="h-[18px] w-[18px] flex-shrink-0 text-faint" strokeWidth={1.75} />
                <span className="flex-1 text-[14px] font-medium text-ink">{label}</span>
                <ExternalLink className="h-4 w-4 flex-shrink-0 text-faint transition-colors group-hover:text-ink" />
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
