import { Mail, Phone, MessageCircle } from 'lucide-react'
import type { Profile } from '@/lib/types'

interface ContactManagerProps {
  projectManager: Profile | null
}

export default function ContactManager({ projectManager }: ContactManagerProps) {
  if (!projectManager) {
    return (
      <div className="surface px-5 py-4">
        <p className="text-[13px] text-faint">Aucun responsable assigné pour l’instant.</p>
      </div>
    )
  }

  const { full_name, email, phone, contact_method, avatar_url } = projectManager

  // Construit l'URL de contact selon la méthode préférée du PM
  function getContactHref(): string {
    if (contact_method === 'whatsapp' && phone) {
      const digits = phone.replace(/\D/g, '')
      return `https://wa.me/${digits}`
    }
    if (contact_method === 'phone' && phone) {
      return `tel:${phone}`
    }
    return `mailto:${email}`
  }

  function getContactLabel(): string {
    if (contact_method === 'whatsapp') return 'Écrire sur WhatsApp'
    if (contact_method === 'phone') return 'Appeler'
    return 'Envoyer un email'
  }

  const contactHref = getContactHref()
  const contactLabel = getContactLabel()
  const initials = full_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="surface p-5">
      <p className="mono-label text-faint">Votre interlocuteur</p>

      <div className="mt-4 flex items-center gap-3">
        {avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar_url}
            alt={full_name}
            className="h-12 w-12 flex-shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brand/15">
            <span className="text-[15px] font-semibold text-brand-text">{initials}</span>
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium text-ink">{full_name}</p>
          <p className="text-[12.5px] text-faint">Responsable du projet</p>
        </div>
      </div>

      <p className="mt-4 flex items-center gap-2 text-[13px] text-dim">
        <ContactIcon method={contact_method} className="h-4 w-4 flex-shrink-0 text-faint" />
        <span className="truncate">{contact_method === 'email' ? email : (phone ?? email)}</span>
      </p>

      <a
        href={contactHref}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-brand mt-4 w-full"
      >
        <ContactIcon method={contact_method} className="h-4 w-4" />
        {contactLabel}
      </a>
    </div>
  )
}

// ── Icône de contact ──────────────────────────────────────────────

function ContactIcon({
  method,
  className = 'h-3.5 w-3.5',
}: {
  method: Profile['contact_method']
  className?: string
}) {
  switch (method) {
    case 'whatsapp':
      return <MessageCircle className={className} />
    case 'phone':
      return <Phone className={className} />
    default:
      return <Mail className={className} />
  }
}
