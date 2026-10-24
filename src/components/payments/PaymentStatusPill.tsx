import type { PaymentRequestStatus } from '@/lib/types'

const STATUS: Record<PaymentRequestStatus, { label: string; tone: string }> = {
  open: { label: 'À régler', tone: 'bg-soon/15 text-soon' },
  paid: { label: 'Réglé', tone: 'bg-brand/15 text-brand-text' },
  canceled: { label: 'Annulé', tone: 'bg-surface-3 text-faint' },
}

export default function PaymentStatusPill({ status }: { status: PaymentRequestStatus }) {
  const { label, tone } = STATUS[status]
  return <span className={`mono-label inline-flex flex-shrink-0 rounded-full px-2.5 py-1 ${tone}`}>{label}</span>
}
