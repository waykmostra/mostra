import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/auth'
import FounderSidebar from '@/components/founder/FounderSidebar'
import FounderCommandBar from '@/components/founder/FounderCommandBar'
import { ProspectDrawerProvider } from '@/components/founder/ProspectDrawer'
import AdminHeader from '@/components/dashboard/AdminHeader'
import { Toaster } from 'sonner'

// Espace Founder : cockpit commercial & pilotage. Réservé à l'admin (Tarik).
export default async function FounderLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  return (
    <ProspectDrawerProvider>
    <div className="min-h-screen bg-[#0a0a0a]">
      <FounderSidebar />
      <AdminHeader />
      <FounderCommandBar />

      {/* Main content — offset par la sidebar + header fixe */}
      <main className="md:ml-[180px] min-h-screen pt-14">
        <div className="px-4 md:px-8 py-8">{children}</div>
      </main>

      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          style: {
            background: '#111111',
            border: '1px solid #2a2a2a',
            color: '#ffffff',
          },
        }}
      />
    </div>
    </ProspectDrawerProvider>
  )
}
