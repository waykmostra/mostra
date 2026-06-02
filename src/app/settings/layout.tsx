import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/auth'
import Sidebar from '@/components/dashboard/Sidebar'
import AdminHeader from '@/components/dashboard/AdminHeader'
import { Toaster } from 'sonner'
import SettingsNav from './SettingsNav'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <AdminHeader />

      <main className="md:ml-[180px] min-h-screen pt-14">
        <div className="px-4 md:px-8 py-8">
          <SettingsNav />
          {children}
        </div>
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
  )
}
