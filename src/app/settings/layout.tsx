import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/auth'
import AppSidebar from '@/components/dashboard/AppSidebar'
import AppTopbar from '@/components/dashboard/AppTopbar'
import { Toaster } from 'sonner'
import SettingsNav from './SettingsNav'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AppSidebar />
      <AppTopbar />
      <main className="md:ml-[var(--rail-w)] min-h-screen pt-14">
        <div className="w-full px-4 sm:px-6 lg:px-10 py-8">
          <SettingsNav />
          {children}
        </div>
      </main>
      <Toaster
        theme="light"
        position="top-right"
        toastOptions={{
          style: { background: '#ffffff', border: '1px solid #d4d4d9', color: '#171718' },
        }}
      />
    </div>
  )
}
