import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CheckCircle2, ExternalLink, FileText, Lock, Receipt } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate } from '@/lib/utils/dates'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { EmptyState } from '@/components/shared/EmptyState'
import PayButton from '@/components/payments/PayButton'
import PaymentStatusPill from '@/components/payments/PaymentStatusPill'
import { confirmFromReturn, formatEur } from '@/lib/payments'
import type { PaymentRequest, PaymentStatus, Project } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Paiement — MOSTRA' }

const PAYMENT_LABEL: Record<PaymentStatus, { label: string; tone: string }> = {
  pending: { label: 'En attente de facturation', tone: 'bg-surface-3 text-dim' },
  invoiced: { label: 'Facturé', tone: 'bg-soon/15 text-soon' },
  partial: { label: 'Partiellement réglé', tone: 'bg-soon/15 text-soon' },
  paid: { label: 'Réglé', tone: 'bg-brand/15 text-brand-text' },
  overdue: { label: 'En retard', tone: 'bg-late/15 text-late' },
}

export default async function ClientPaymentPage({
  params,
  searchParams,
}: {
  params: { token: string }
  searchParams: { paiement?: string; session_id?: string }
}) {
  const admin = createAdminClient()

  const { data: rawProject } = await admin
    .from('projects')
    .select('id, name, value_eur, payment_status, quote_url, invoice_url, paid_at, deadline')
    .eq('share_token', params.token)
    .maybeSingle()

  const project = rawProject as Pick<
    Project,
    | 'id'
    | 'name'
    | 'value_eur'
    | 'payment_status'
    | 'quote_url'
    | 'invoice_url'
    | 'paid_at'
    | 'deadline'
  > | null
  if (!project) notFound()

  // Retour de Stripe : on relit la session côté serveur avant d'afficher l'état
  // (le webhook peut arriver après le client).
  if (searchParams.paiement === 'ok') {
    await confirmFromReturn(searchParams.session_id, { projectId: project.id })
  }

  const { data: rawRequests } = await admin
    .from('payment_requests')
    .select('id, label, amount_cents, status, pay_token, paid_at')
    .eq('project_id', project.id)
    .neq('status', 'canceled')
    .order('created_at', { ascending: true })
  const requests =
    (rawRequests as Pick<PaymentRequest, 'id' | 'label' | 'amount_cents' | 'status' | 'pay_token' | 'paid_at'>[] | null) ?? []

  // Statut relu après une éventuelle confirmation.
  const { data: fresh } = await admin
    .from('projects')
    .select('payment_status, paid_at')
    .eq('id', project.id)
    .maybeSingle()
  if (fresh) Object.assign(project, fresh)

  const status = project.payment_status ?? 'pending'
  const { label, tone } = PAYMENT_LABEL[status]
  const hasDocuments = Boolean(project.quote_url || project.invoice_url)
  const hasAnything = hasDocuments || project.value_eur !== null || requests.length > 0

  return (
    <div className="max-w-[900px] space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: project.name, href: `/client/${params.token}` },
            { label: 'Paiement' },
          ]}
        />
        <h1 className="mt-3 text-[1.625rem] leading-tight text-ink">Paiement</h1>
      </div>

      {searchParams.paiement === 'ok' && (
        <div className="flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/10 px-5 py-4">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-brand-text" />
          <p className="text-[14px] text-ink">Merci, votre paiement a bien été reçu.</p>
        </div>
      )}
      {searchParams.paiement === 'annule' && (
        <div className="rounded-xl border border-line bg-surface-2 px-5 py-4 text-[14px] text-dim">
          Paiement annulé : rien n’a été débité. Vous pouvez réessayer quand vous le souhaitez.
        </div>
      )}

      {requests.length > 0 && (
        <section>
          <h2 className="mono-label mb-3 text-faint">À régler</h2>
          <div className="surface divide-y divide-line">
            {requests.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-medium text-ink">{r.label}</p>
                  <p className="tnum mt-0.5 text-[13px] text-dim">
                    {formatEur(r.amount_cents)}
                    {r.paid_at && ` · réglé le ${formatDate(r.paid_at)}`}
                  </p>
                </div>
                {r.status === 'open' ? (
                  <PayButton payToken={r.pay_token} returnTo="portal" label={`Payer ${formatEur(r.amount_cents)}`} />
                ) : (
                  <PaymentStatusPill status={r.status} />
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-faint">
            <Lock className="h-3 w-3" /> Paiement sécurisé par Stripe. Mostra ne voit jamais vos données bancaires.
          </p>
        </section>
      )}

      {!hasAnything ? (
        <div className="surface">
          <EmptyState
            icon={Receipt}
            title="Rien à régler pour l’instant"
            description="Le montant et les documents de facturation apparaîtront ici dès qu’ils seront émis."
          />
        </div>
      ) : (
        <>
          <div className="surface flex flex-col divide-y divide-line sm:flex-row sm:divide-x sm:divide-y-0">
            <div className="flex-1 px-5 py-4">
              <p className="mono-label text-faint">Montant</p>
              <p className="font-display tnum mt-2.5 text-[2rem] leading-none text-ink">
                {project.value_eur !== null
                  ? project.value_eur.toLocaleString('fr-FR', {
                      style: 'currency',
                      currency: 'EUR',
                      maximumFractionDigits: 0,
                    })
                  : '—'}
              </p>
            </div>

            <div className="flex-1 px-5 py-4">
              <p className="mono-label text-faint">Statut</p>
              <p className="mt-3">
                <span className={`mono-label inline-flex rounded-full px-2.5 py-1 ${tone}`}>
                  {label}
                </span>
              </p>
            </div>

            <div className="flex-1 px-5 py-4">
              <p className="mono-label text-faint">{project.paid_at ? 'Réglé le' : 'Échéance'}</p>
              <p className="tnum mt-3 text-[15px] text-ink">
                {project.paid_at
                  ? formatDate(project.paid_at)
                  : project.deadline
                    ? formatDate(project.deadline)
                    : '—'}
              </p>
            </div>
          </div>

          {hasDocuments && (
            <section>
              <h2 className="mono-label mb-3 text-faint">Documents</h2>
              <div className="surface divide-y divide-line">
                {project.quote_url && (
                  <DocumentRow href={project.quote_url} icon={FileText} label="Devis" />
                )}
                {project.invoice_url && (
                  <DocumentRow href={project.invoice_url} icon={Receipt} label="Facture" />
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function DocumentRow({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: typeof FileText
  label: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 px-5 py-4 transition-colors duration-[160ms] hover:bg-surface-2"
    >
      <Icon className="h-[18px] w-[18px] flex-shrink-0 text-faint" strokeWidth={1.75} />
      <span className="flex-1 text-[14px] font-medium text-ink">{label}</span>
      <ExternalLink className="h-4 w-4 flex-shrink-0 text-faint transition-colors group-hover:text-ink" />
    </a>
  )
}
