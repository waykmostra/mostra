'use client'

import { useState } from 'react'
import { Building2, Users } from 'lucide-react'
import CompaniesCrmView from './CompaniesCrmView'
import ClientsView from './ClientsView'
import type { ClientWithStats, CompanyWithStats } from '@/lib/types'

interface Props {
  companies: CompanyWithStats[]
  clients: ClientWithStats[]
}

export default function CrmView({ companies, clients }: Props) {
  const [tab, setTab] = useState<'companies' | 'contacts'>('companies')

  return (
    <div className="space-y-5">
      {/* Toggle Sociétés / Contacts */}
      <div className="inline-flex bg-surface border border-line rounded-lg p-0.5">
        <button
          type="button"
          onClick={() => setTab('companies')}
          className={`
            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
            ${tab === 'companies' ? 'bg-surface-3 text-ink' : 'text-faint hover:text-ink'}
          `}
        >
          <Building2 className="h-3.5 w-3.5" />
          Sociétés
        </button>
        <button
          type="button"
          onClick={() => setTab('contacts')}
          className={`
            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
            ${tab === 'contacts' ? 'bg-surface-3 text-ink' : 'text-faint hover:text-ink'}
          `}
        >
          <Users className="h-3.5 w-3.5" />
          Contacts
        </button>
      </div>

      {tab === 'companies' ? (
        <CompaniesCrmView initialCompanies={companies} />
      ) : (
        <ClientsView initialClients={clients} />
      )}
    </div>
  )
}
