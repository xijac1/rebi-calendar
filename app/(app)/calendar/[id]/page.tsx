import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import CalendarView from "../CalendarView"

export type TaskRow = {
  id: string
  title: string
  subject: string | null
  duration_minutes: number | null
  scheduled_date: string | null
  completed: boolean
  calendar_id?: string | null
}

export type DayOffRow = {
  date: string
}

export type CalendarRow = {
  id: string
  name: string
  description: string | null
  start_date: string | null
  due_date: string | null
  color_theme: string | null
}

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: calendar } = await supabase
    .from("calendars")
    .select("id, name, description, start_date, due_date, color_theme")
    .eq("id", id)
    .single()

  if (!calendar) notFound()

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, subject, duration_minutes, scheduled_date, completed, calendar_id")
    .eq("calendar_id", id)
    .order("scheduled_date", { ascending: true })

  const { data: daysOff } = await supabase
    .from("calendar_days_off")
    .select("date")
    .eq("calendar_id", id)

  return (
    <CalendarView
      calendar={calendar as CalendarRow}
      initialTasks={(tasks as TaskRow[]) ?? []}
      initialDaysOff={(daysOff as DayOffRow[]) ?? []}
    />
  )
}
