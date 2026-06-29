import { createClient } from "@/utils/supabase/server"
import DashboardContent from "./DashboardContent"

export type CalendarRow = {
  id: string
  name: string
  start_date: string | null
  due_date: string | null
  created_at: string | null
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: calendars } = await supabase
    .from("calendars")
    .select("id, name, start_date, due_date, created_at")
    .order("created_at", { ascending: false })

  return (
    <DashboardContent
      initialCalendars={(calendars as CalendarRow[]) ?? []}
    />
  )
}
