import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import Sidebar from "@/app/components/Sidebar"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <div className="app-layout">
      <Sidebar userEmail={user.email ?? "User"} userName={user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "User"} avatarUrl={user.user_metadata?.avatar_url} />
      <main className="app-main">
        {children}
      </main>
    </div>
  )
}
