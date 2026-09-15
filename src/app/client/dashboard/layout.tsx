import ClientTopbar from '@/components/client/ClientTopbar'

export default function ClientDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ClientTopbar />
      <main className="min-h-screen pt-14">{children}</main>
    </>
  )
}
