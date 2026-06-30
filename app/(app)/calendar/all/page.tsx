import { createClient } from "@/utils/supabase/server"
import CalendarView from "../CalendarView"

export default async function AllCalendarsPage() {
  const supabase = await createClient()

  const { data: calendars } = await supabase
    .from("calendars")
    .select("id, name, description, start_date, due_date, color_theme")

  const ids = (calendars ?? []).map(c => c.id)

  const { data: tasks } = ids.length
    ? await supabase
        .from("tasks")
        .select("id, title, subject, duration_minutes, scheduled_date, completed, calendar_id")
        .in("calendar_id", ids)
        .order("scheduled_date", { ascending: true })
    : { data: [] }

  return (
    <CalendarView
      calendar={{ id: "all", name: "View All", description: null, start_date: null, due_date: null, color_theme: null }}
      initialTasks={(tasks ?? []).map(t => ({
        id: t.id,
        title: t.title,
        subject: t.subject,
        duration_minutes: t.duration_minutes,
        scheduled_date: t.scheduled_date,
        completed: t.completed,
        calendar_id: t.calendar_id,
      }))}
      initialDaysOff={[]}
      allCalendars={calendars ?? []}
    />
  )
}
