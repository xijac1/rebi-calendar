"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import type { TaskRow, DayOffRow, CalendarRow } from "./[id]/page"
import type { Task, TasksByDate, SubjectTag } from "./views/helpers"
import {
  dateKey, dateFromKey, formatDateLabel, isSameDate,
  parseDurationToMinutes, formatMinutes, getWeekStart,
  MONTH_NAMES, SHORT_MONTHS, DAYS, tagLabel,
} from "./views/helpers"
import MonthlyView from "./views/MonthlyView"
import DayView from "./views/DayView"

const THEMES: Record<string, { accent: string; accentBg: string; progressStart: string; progressEnd: string; label: string }> = {
  rose:    { accent: "#dd0426", accentBg: "#2f0505", progressStart: "#a855f7", progressEnd: "#f97316", label: "Rose" },
  blue:    { accent: "#3b82f6", accentBg: "#0a1e3d", progressStart: "#6366f1", progressEnd: "#06b6d4", label: "Blue" },
  green:   { accent: "#22c55e", accentBg: "#052e16", progressStart: "#10b981", progressEnd: "#84cc16", label: "Green" },
  purple:  { accent: "#a855f7", accentBg: "#1e1b4b", progressStart: "#d946ef", progressEnd: "#f97316", label: "Purple" },
  amber:   { accent: "#f59e0b", accentBg: "#2a1f04", progressStart: "#f97316", progressEnd: "#eab308", label: "Amber" },
  cyan:    { accent: "#06b6d4", accentBg: "#042f3d", progressStart: "#0891b2", progressEnd: "#06b6d4", label: "Cyan" },
}

type CalendarInfo = { id: string; name: string; color_theme: string | null }
type RebalanceView = "clean" | "detailed" | "compact"
type ViewMode = "weekly" | "daily" | "monthly"

type PlannedTask = Task & {
  originalDate: string
  minutes: number
}

type DayLoad = {
  key: string
  minutes: number
  tasks: PlannedTask[]
}

type RebalancePlan =
  | { error: string }
  | {
      unfinished: PlannedTask[]
      studyDays: string[]
      dayLoads: DayLoad[]
      totalMinutes: number
      maxDayMinutes: number
    }

function getUnfinishedTasks(tasks: TasksByDate) {
  return Object.entries(tasks).sort(([a],[b])=>a.localeCompare(b))
    .flatMap(([key,dayTasks]) =>
      dayTasks.filter(t=>!t.done).map(t=>({...t,originalDate:key,minutes:parseDurationToMinutes(t.time)})))
}

function buildBalancedPlan(tasks: TasksByDate, startKey: string, examKey: string, daysOff: Set<string>): RebalancePlan {
  const unfinished = getUnfinishedTasks(tasks)
  const invalid = unfinished.filter(t=>!t.minutes)
  const getEligibleStudyDays = (startKey: string, examKey: string, daysOff: Set<string>) => {
    const start = dateFromKey(startKey), exam = dateFromKey(examKey)
    const dates: string[] = []
    for (const day = new Date(start); day<=exam; day.setDate(day.getDate()+1)) {
      const k = dateKey(day)
      if (!daysOff.has(k)) dates.push(k)
    }
    return dates
  }
  const studyDays = getEligibleStudyDays(startKey,examKey,daysOff)
  if (!studyDays.length) return {error:"No study days are available between the selected dates."}
  if (invalid.length) return {error:"Every unfinished task needs a valid duration before rebalancing."}
  const dayLoads: DayLoad[] = studyDays.map(k=>({key:k,minutes:0,tasks:[]}))

  const ordered = unfinished.filter(t => t.order != null).map(t => ({...t, minutes: t.minutes as number})).sort((a, b) => (a.order as number) - (b.order as number))
  const unordered = unfinished.filter(t => t.order == null).map(t => ({...t, minutes: t.minutes as number}))

  // Phase 1: Assign ordered tasks using center-of-mass distribution.
  // Each task is placed at the day closest to its midpoint in the cumulative
  // time timeline, which naturally spreads tasks evenly across study days
  // while preserving their sequential order.
  if (ordered.length > 0) {
    const totalMinutes = ordered.reduce((s, t) => s + t.minutes, 0)
    let cumMinutes = 0
    let prevDayIdx = 0
    for (const task of ordered) {
      const center = cumMinutes + task.minutes / 2
      cumMinutes += task.minutes
      const proportion = center / totalMinutes
      let dayIdx = Math.floor(proportion * dayLoads.length)
      dayIdx = Math.min(Math.max(dayIdx, prevDayIdx), dayLoads.length - 1)
      dayLoads[dayIdx].tasks.push(task)
      dayLoads[dayIdx].minutes += task.minutes
      prevDayIdx = dayIdx
    }
    // Fill completely empty days by shifting the earliest task from the next
    // occupied day forward, preserving order.
    for (let i = 0; i < dayLoads.length - 1; i++) {
      if (dayLoads[i].tasks.length === 0) {
        let next = i + 1
        while (next < dayLoads.length && dayLoads[next].tasks.length === 0) next++
        if (next < dayLoads.length) {
          const task = dayLoads[next].tasks.shift()!
          dayLoads[next].minutes -= task.minutes
          dayLoads[i].tasks.push(task)
          dayLoads[i].minutes += task.minutes
        }
      }
    }
  }

  // Phase 2: Assign unordered tasks greedily to the least-loaded day
  ;[...unordered]
    .sort((a,b)=>b.minutes-a.minutes||a.originalDate.localeCompare(b.originalDate))
    .forEach(task=>{ dayLoads.sort((a,b)=>a.minutes-b.minutes||a.key.localeCompare(b.key)); dayLoads[0].tasks.push(task); dayLoads[0].minutes+=task.minutes })

  dayLoads.sort((a,b)=>a.key.localeCompare(b.key))
  const totalMinutes = unfinished.reduce((s,t)=>s+(t.minutes||0),0)
  const maxDayMinutes = Math.max(0,...dayLoads.map(d=>d.minutes))
  return {unfinished:unfinished.map(t=>({...t,minutes:t.minutes as number})),studyDays,dayLoads,totalMinutes,maxDayMinutes}
}

export default function CalendarView({
  calendar,
  initialTasks,
  initialDaysOff,
  allCalendars,
  initialUserSettings,
}: {
  calendar: CalendarRow
  initialTasks: TaskRow[]
  initialDaysOff: DayOffRow[]
  allCalendars?: CalendarInfo[]
  initialUserSettings?: { card_style?: string | null; color_theme?: string | null; progress_mode?: string | null } | null
}) {
  const supabase = createClient()
  const router = useRouter()
  const [calLookup] = useState(() => {
    const map = new Map<string, CalendarInfo>()
    if (allCalendars) allCalendars.forEach(c => map.set(c.id, c))
    return map
  })
  const [tasks, setTasks] = useState<TasksByDate>(() => {
    const lookup = new Map<string, CalendarInfo>()
    if (allCalendars) allCalendars.forEach(c => lookup.set(c.id, c))
    const grouped: TasksByDate = {}
    initialTasks.forEach((t) => {
      const key = t.scheduled_date || "unscheduled"
      if (!grouped[key]) grouped[key] = []
      const cal = t.calendar_id ? lookup.get(t.calendar_id) : undefined
      const calTheme = cal ? THEMES[cal.color_theme || "rose"] : undefined
      grouped[key].push({
        id: t.id,
        name: t.title,
        tag: (t.subject as SubjectTag) || "",
        time: t.duration_minutes ? formatMinutes(t.duration_minutes) : "",
        done: t.completed,
        calendarId: t.calendar_id || undefined,
        calendarName: cal?.name,
        calendarColor: calTheme?.accent,
        start: t.start_time || undefined,
        order: t.order ?? undefined,
      })
    })
    return grouped
  })

  const [daysOff, setDaysOff] = useState<Set<string>>(() => new Set(initialDaysOff.map((d) => d.date)))
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("weekly")
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()))
  const [addingToDay, setAddingToDay] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<{ dayKey: string; task: Task } | null>(null)
  const [taskName, setTaskName] = useState("")
  const [taskTag, setTaskTag] = useState<SubjectTag>("")
  const [taskTime, setTaskTime] = useState("")
  const [taskStart, setTaskStart] = useState("09:00")
  const [dayOffInput, setDayOffInput] = useState("")
  const [rebalanceOpen, setRebalanceOpen] = useState(false)
  const [rebalanceStartDate, setRebalanceStartDate] = useState(calendar.start_date || dateKey(new Date()))
  const [rebalanceExamDate, setRebalanceExamDate] = useState(calendar.due_date || dateKey(new Date()))
  const [selectedRebalanceView, setSelectedRebalanceView] = useState<RebalanceView>((initialUserSettings?.card_style as RebalanceView) || "detailed")
  const [cardStyleOpen, setCardStyleOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toast, setToast] = useState("")
  const [bulkAddOpen, setBulkAddOpen] = useState(false)
  const [bulkPool, setBulkPool] = useState<{ name: string; tag: SubjectTag; minutes: number; description?: string; order?: number }[]>([])
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [bulkFormName, setBulkFormName] = useState("")
  const [bulkFormTag, setBulkFormTag] = useState<SubjectTag>("")
  const [bulkFormTime, setBulkFormTime] = useState("")
  const [bulkStartDate, setBulkStartDate] = useState(dateKey(new Date()))
  const [bulkEndDate, setBulkEndDate] = useState(calendar.due_date || dateKey(new Date()))
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [aiInputText, setAiInputText] = useState("")
  const [aiInstructions, setAiInstructions] = useState("")
  const [aiModel, setAiModel] = useState("llama-3.3-70b-versatile")
  const [aiLoading, setAiLoading] = useState(false)
  const [calendarName, setCalendarName] = useState(calendar.name)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState("")

  const isViewAll = calendar.id === "all"
  const [progressMode, setProgressMode] = useState<"current_view" | "show_all">(
    (isViewAll ? initialUserSettings?.progress_mode : calendar.progress_mode) as "current_view" | "show_all" || "show_all"
  )
  const [colorTheme, setColorTheme] = useState(
    isViewAll ? (initialUserSettings?.color_theme || "rose") : (calendar.color_theme || "rose")
  )
  const theme = THEMES[colorTheme] || THEMES.rose
  const themeVars = {
    "--today-bg": theme.accentBg,
    "--today-border": theme.accent,
    "--cal-accent": theme.accent,
    "--cal-accent-bg": theme.accentBg,
    "--cal-progress-start": theme.progressStart,
    "--cal-progress-end": theme.progressEnd,
  } as React.CSSProperties
  const today = useMemo(() => new Date(), [])

  const days = useMemo(() => Array.from({length:7},(_,i)=>{const d=new Date(currentWeekStart);d.setDate(d.getDate()+i);return d}),[currentWeekStart])

  const weekNum = useMemo(() => {
    const start = dateFromKey(calendar.start_date || dateKey(new Date()))
    const diff = Math.floor((currentWeekStart.getTime()-start.getTime())/(7*86400000))
    return Math.max(1,diff+1)
  },[currentWeekStart, calendar.start_date])

  const rebalancePlan = useMemo(() => {
    if (!rebalanceStartDate||!rebalanceExamDate||dateFromKey(rebalanceStartDate)>dateFromKey(rebalanceExamDate)) return null
    return buildBalancedPlan(tasks,rebalanceStartDate,rebalanceExamDate,daysOff)
  },[daysOff,rebalanceExamDate,rebalanceStartDate,tasks])

  function showToast(msg: string) { setToast(msg) }

  async function saveUserSettings(update: { card_style?: string; color_theme?: string; progress_mode?: string }) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: existing } = await supabase
      .from("user_settings")
      .select("card_style, color_theme, progress_mode")
      .eq("user_id", user.id)
      .maybeSingle()
    await supabase.from("user_settings").upsert({
      user_id: user.id,
      card_style: update.card_style ?? existing?.card_style ?? "detailed",
      color_theme: update.color_theme ?? existing?.color_theme ?? "rose",
      progress_mode: update.progress_mode ?? existing?.progress_mode ?? "show_all",
    }, { onConflict: "user_id" })
  }

  async function saveCalendarTitle() {
    const name = titleDraft.trim()
    if (!name || name === calendarName) { setEditingTitle(false); return }
    const { error } = await supabase.from("calendars").update({ name }).eq("id", calendar.id)
    if (error) { showToast("Failed to save title"); return }
    setCalendarName(name)
    setEditingTitle(false)
    showToast("Title updated")
  }

  function startEditingTitle() {
    setTitleDraft(calendarName)
    setEditingTitle(true)
  }

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(()=>setToast(""),2200)
    return ()=>window.clearTimeout(t)
  },[toast])

  useEffect(() => {
    function closeOnEscape(e: KeyboardEvent) {
      if (e.key==="Escape") { setAddingToDay(null); setEditingTask(null); setSettingsOpen(false); setRebalanceOpen(false) }
    }
    document.addEventListener("keydown",closeOnEscape)
    return ()=>document.removeEventListener("keydown",closeOnEscape)
  },[])

  async function addTaskToDb(dayKey: string, title: string, subject: SubjectTag, durationMinutes: number) {
    const { data, error } = await supabase.from("tasks").insert({
      calendar_id: calendar.id,
      title,
      subject: subject || null,
      duration_minutes: durationMinutes,
      scheduled_date: dayKey,
      completed: false,
      start_time: taskStart || null,
    }).select("id").single()
    if (error) return null
    const taskId = data.id
    const timeStr = formatMinutes(durationMinutes)
    setTasks(prev => ({
      ...prev,
      [dayKey]: [...(prev[dayKey]||[]), { id: taskId, name: title, tag: subject, time: timeStr, start: taskStart, done: false }]
    }))
  }

  async function toggleTaskDone(dayKey: string, taskId: string, currentDone: boolean) {
    await supabase.from("tasks").update({ completed: !currentDone }).eq("id", taskId)
    setTasks(prev => ({
      ...prev,
      [dayKey]: (prev[dayKey]||[]).map(t => t.id===taskId ? {...t, done: !t.done} : t)
    }))
  }

  async function addDayOffToDb(date: string) {
    await supabase.from("calendar_days_off").insert({ calendar_id: calendar.id, date })
    setDaysOff(prev => new Set(prev).add(date))
  }

  async function removeDayOffFromDb(date: string) {
    await supabase.from("calendar_days_off").delete().eq("calendar_id", calendar.id).eq("date", date)
    setDaysOff(prev => { const n = new Set(prev); n.delete(date); return n })
  }

  function openRebalanceModal() {
    setRebalanceStartDate(calendar.start_date || dateKey(new Date()))
    setRebalanceExamDate(calendar.due_date || dateKey(new Date()))
    setRebalanceOpen(true)
  }

  async function applyRebalance() {
    if (!rebalanceStartDate||!rebalanceExamDate||dateFromKey(rebalanceStartDate)>dateFromKey(rebalanceExamDate)) {
      showToast("Choose a valid date range"); return
    }
    const plan = buildBalancedPlan(tasks, rebalanceStartDate, rebalanceExamDate, daysOff)
    if ("error" in plan) { showToast(plan.error); return }
    if (!plan.unfinished.length) { showToast("No unfinished tasks to rebalance"); setTimeout(()=>setRebalanceOpen(false), 2200); return }

    const updates: { id: string; scheduled_date: string }[] = []
    plan.dayLoads.forEach(day => {
      day.tasks.forEach(task => {
        updates.push({ id: task.id, scheduled_date: day.key })
      })
    })

    setLoading(true)
    for (const u of updates) {
      await supabase.from("tasks").update({ scheduled_date: u.scheduled_date }).eq("id", u.id)
    }
    if (rebalanceStartDate !== calendar.start_date || rebalanceExamDate !== calendar.due_date) {
      await supabase.from("calendars").update({
        start_date: rebalanceStartDate,
        due_date: rebalanceExamDate,
      }).eq("id", calendar.id)
    }
    setLoading(false)

    setTasks(prev => {
      const next: TasksByDate = {}
      Object.entries(prev).forEach(([key, dayTasks]) => {
        const completed = dayTasks.filter(t => t.done)
        if (completed.length) next[key] = completed
      })
      plan.dayLoads.forEach(day => {
        if (!day.tasks.length) return
        next[day.key] = next[day.key] || []
        day.tasks.forEach(({originalDate, minutes, ...task}) => {
          next[day.key].push(task)
        })
      })
      return next
    })
    setCurrentWeekStart(getWeekStart(dateFromKey(rebalanceStartDate)))
    setRebalanceOpen(false)
    showToast(`Rebalanced ${plan.unfinished.length} tasks`)
  }

  function openModal(dayKey: string) {
    setEditingTask(null); setAddingToDay(dayKey); setTaskName(""); setTaskTag(""); setTaskTime(""); setTaskStart("09:00")
  }

  function openEditModal(dayKey: string, task: Task) {
    setAddingToDay(null); setEditingTask({ dayKey, task }); setTaskName(task.name); setTaskTag(task.tag); setTaskTime(task.time); setTaskStart(task.start || "09:00")
  }

  async function saveTask() {
    const name = taskName.trim(), time = taskTime.trim()
    const dayKey = editingTask ? editingTask.dayKey : addingToDay
    if (!dayKey||!name) return
    const mins = parseDurationToMinutes(time)
    if (!mins) { showToast("Enter a valid duration like 1h or 25min"); return }

    if (editingTask) {
      await supabase.from("tasks").update({ title: name, subject: taskTag || null, duration_minutes: mins, start_time: taskStart || null }).eq("id", editingTask.task.id)
      const timeStr = formatMinutes(mins)
      setTasks(prev => ({
        ...prev,
        [editingTask.dayKey]: (prev[editingTask.dayKey]||[]).map(t => t.id===editingTask.task.id ? {...t, name, tag: taskTag, time: timeStr, start: taskStart} : t)
      }))
      setEditingTask(null)
      showToast("Task updated")
    } else {
      await addTaskToDb(dayKey, name, taskTag, mins)
      setAddingToDay(null)
      showToast("Task added")
    }
  }

  function toggleTask(dayKey: string, id: string) {
    const task = tasks[dayKey]?.find(t => t.id === id)
    if (!task) return
    toggleTaskDone(dayKey, id, task.done)
  }

  async function deleteTask(dayKey: string, id: string) {
    await supabase.from("tasks").delete().eq("id", id)
    setTasks(prev => {
      const next = { ...prev }
      next[dayKey] = (next[dayKey] || []).filter(t => t.id !== id)
      if (next[dayKey].length === 0) delete next[dayKey]
      return next
    })
  }

  async function applyBulkAdd() {
    const items = bulkPool
    if (!items.length) { showToast("No tasks to add"); return }
    const plan = distributeBulkItems(items, bulkStartDate, bulkEndDate, daysOff)
    if (!plan) { showToast("No available study days in the date range"); return }
    setLoading(true)
    const results = await Promise.all(plan.flatMap(day =>
      day.items.map(item =>
        supabase.from("tasks").insert({
          calendar_id: calendar.id, title: item.name,
          subject: item.tag || null, duration_minutes: item.minutes,
          scheduled_date: day.key, completed: false,
          description: item.description || null,
          "order": item.order ?? null,
        }).select("id, title, subject, duration_minutes, scheduled_date, completed, \"order\"").single()
      )
    ))
    const errors = results.filter(r => r.error)
    if (errors.length) { showToast("Error adding some tasks"); setLoading(false); return }
    setTasks(prev => {
      const next = { ...prev }
      const seen = new Set(Object.values(next).flat().map(t => t.id))
      results.forEach(r => {
        if (!r.data || seen.has(r.data.id)) return
        seen.add(r.data.id)
        const t = r.data
        const k = t.scheduled_date || "unscheduled"
        if (!next[k]) next[k] = []
        next[k].push({ id: t.id, name: t.title, tag: (t.subject as SubjectTag) || "", time: formatMinutes(t.duration_minutes), done: t.completed, order: t.order ?? undefined })
      })
      return next
    })
    setLoading(false); setBulkAddOpen(false); setBulkPool([])
    showToast(`Added ${items.length} tasks`)
  }

  function handleAddTask() {
    const now = new Date()
    openModal(dateKey(now))
  }

  function handleEditTask(dayKey: string, task: Task) {
    openEditModal(dayKey, task)
  }

  async function generateTasksWithAI() {
    const apiKey = localStorage.getItem("groq_api_key")
    if (!apiKey) { showToast("Set your API key in Settings first"); return }

    const text = aiInputText.trim()
    if (!text) { showToast("Enter some text or goal to generate tasks from"); return }

    setAiLoading(true)
    const prompt = `You are an intelligent personal productivity assistant. Assume the user has obtained what they are describing and needs it broken down into tasks to now begin doing it.
Content / Goal:
${text.substring(0, 15000)}

${aiInstructions.trim() ? `Additional Instructions: ${aiInstructions.trim()}` : ""}
Core Instruction:
Accurately infer what the user actually wants to achieve. 
- If they mention a book, story, or text (e.g. "the odyssey book", "atomic habits", "1984"), assume they want to READ and study it. Do NOT create tasks for buying, downloading, or acquiring the book unless explicitly asked.
- If they mention a skill or topic, create learning + practice tasks.
- If they mention a project, break it into execution steps.
- Avoid literal but wrong interpretations.

Task Rules:
- Create practical, bite-sized tasks (most between 20-150 minutes).
- Assign logical order (1, 2, 3...).
- Automatically determine the best type/subject for each task.


Return ONLY a valid JSON object with a "tasks" array with this structure:
{
  "tasks": [
    {
      "order": number,
      "name": "Clean task title without number",
      "type": "Category or type of this task",
      "description": "Short description",
      "estimated_minutes": number
    }
  ]
}`

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: aiModel,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 4000,
          response_format: { type: "json_object" },
        }),
      })

      if (!res.ok) {
        if (res.status === 429) showToast("Rate limit hit. Please wait a moment.")
        else showToast("API Error: " + res.status)
        setAiLoading(false)
        return
      }

      const data = await res.json()
      const raw = data.choices[0].message.content
      const parsed = JSON.parse(raw)
      const tasks = parsed.tasks || parsed

      if (Array.isArray(tasks) && tasks.length > 0) {
        tasks.forEach((t: { name: string; type?: string; estimated_minutes?: number; description?: string; order?: number }) => {
          if (t.name) {
            setBulkPool(p => [...p, {
              name: t.name.trim(),
              tag: (t.type || "") as SubjectTag,
              minutes: t.estimated_minutes || 60,
              description: t.description || "",
              order: t.order ?? undefined,
            }])
          }
        })
        showToast(`Generated ${tasks.length} tasks`)
        setAiInputText("")
        setAiInstructions("")
        setAiPanelOpen(false)
      } else {
        showToast("No tasks returned")
      }
    } catch (e: unknown) {
      showToast("Request failed: " + (e instanceof Error ? e.message : String(e)))
    }
    setAiLoading(false)
  }

  function distributeBulkItems(items: { name: string; tag: SubjectTag; minutes: number; description?: string; order?: number }[], startKey: string, endKey: string, daysOff: Set<string>) {
    const start = dateFromKey(startKey), end = dateFromKey(endKey)
    const studyDays: string[] = []
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const k = dateKey(d)
      if (!daysOff.has(k)) studyDays.push(k)
    }
    if (!studyDays.length) return null
    const dayLoads: { key: string; minutes: number; items: { name: string; tag: SubjectTag; minutes: number; description?: string; order?: number }[] }[] = studyDays.map(k => ({ key: k, minutes: 0, items: [] }))

    const ordered = items.filter(i => i.order != null).sort((a, b) => (a.order as number) - (b.order as number))
    const unordered = items.filter(i => i.order == null)

    // Phase 1: Ordered items using center-of-mass distribution (same as rebalance)
    if (ordered.length > 0) {
      const totalMinutes = ordered.reduce((s, i) => s + i.minutes, 0)
      let cumMinutes = 0
      let prevDayIdx = 0
      for (const item of ordered) {
        const center = cumMinutes + item.minutes / 2
        cumMinutes += item.minutes
        const proportion = center / totalMinutes
        let dayIdx = Math.floor(proportion * dayLoads.length)
        dayIdx = Math.min(Math.max(dayIdx, prevDayIdx), dayLoads.length - 1)
        dayLoads[dayIdx].items.push(item)
        dayLoads[dayIdx].minutes += item.minutes
        prevDayIdx = dayIdx
      }
      for (let i = 0; i < dayLoads.length - 1; i++) {
        if (dayLoads[i].items.length === 0) {
          let next = i + 1
          while (next < dayLoads.length && dayLoads[next].items.length === 0) next++
          if (next < dayLoads.length) {
            const item = dayLoads[next].items.shift()!
            dayLoads[next].minutes -= item.minutes
            dayLoads[i].items.push(item)
            dayLoads[i].minutes += item.minutes
          }
        }
      }
    }

    // Phase 2: Unordered items greedily to the least-loaded day (same as rebalance)
    ;[...unordered]
      .sort((a,b) => b.minutes - a.minutes || a.name.localeCompare(b.name))
      .forEach(item => {
        dayLoads.sort((a, b) => a.minutes - b.minutes || a.key.localeCompare(b.key))
        dayLoads[0].items.push(item)
        dayLoads[0].minutes += item.minutes
      })

    return dayLoads.filter(d => d.items.length > 0).sort((a, b) => a.key.localeCompare(b.key))
  }

  const weekStats = useMemo(() => {
    const dayKeys = days.map(d => dateKey(d))
    const all = dayKeys.flatMap(k => tasks[k] || [])
    const total = all.length
    const done = all.filter(t => t.done).length
    const totalMins = all.filter(t => !t.done).reduce((s, t) => s + (parseDurationToMinutes(t.time) || 0), 0)
    const pct = total ? Math.round((done / total) * 100) : 0
    return { total, done, totalMins, pct }
  }, [days, tasks])

  const allTasksStats = useMemo(() => {
    const all = Object.values(tasks).flat()
    const total = all.length
    const done = all.filter(t => t.done).length
    const totalMins = all.filter(t => !t.done).reduce((s, t) => s + (parseDurationToMinutes(t.time) || 0), 0)
    const pct = total ? Math.round((done / total) * 100) : 0
    return { total, done, totalMins, pct }
  }, [tasks])

  const rebalanceButton = (
    <button className="btn rebalance-btn" onClick={openRebalanceModal} type="button">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
      Rebalance
    </button>
  )

  return (
    <div className="schedule-app" style={themeVars}>
      <div className="persistent-topbar">
        <div className="persistent-title">
          {editingTitle ? (
            <div className="title-edit-group">
              <input
                className="title-input"
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveCalendarTitle(); if (e.key === "Escape") setEditingTitle(false) }}
                autoFocus
              />
              <button className="title-btn title-btn-check" onClick={saveCalendarTitle} type="button" aria-label="Save title">&#10003;</button>
              <button className="title-btn title-btn-x" onClick={() => setEditingTitle(false)} type="button" aria-label="Cancel">&#10005;</button>
            </div>
          ) : (
            <span className="title-display" onClick={startEditingTitle} title="Click to edit">{calendarName}</span>
          )}
        </div>
        <div className="persistent-actions">
          <select className="view-select" value={viewMode} onChange={e => setViewMode(e.target.value as ViewMode)}>
            <option value="weekly">Weekly View</option>
            <option value="daily">Daily View</option>
            <option value="monthly">Monthly View</option>
          </select>
          <button className="btn" onClick={() => setSettingsOpen(true)} type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Settings
            </button>
        </div>
      </div>

      <div className="cal-body">
        {viewMode === "weekly" && (
          <div className="view-wrapper">
            <div className="topbar">
              <div className="topbar-left">
                <span className={`day-big${isSameDate(currentWeekStart, getWeekStart(today)) ? " today" : ""}`}>{MONTH_NAMES[currentWeekStart.getMonth()]}</span>
                <div className="day-meta">
                  <span className="day-weekday">{currentWeekStart.getFullYear()}</span>
                </div>
              </div>
              <div className="topbar-center">
                <button className="nav-btn" onClick={()=>setCurrentWeekStart(p=>{const n=new Date(p);n.setDate(n.getDate()-7);return n})} type="button">&lt;</button>
                <button className="today-btn" onClick={()=>setCurrentWeekStart(getWeekStart(new Date()))} type="button">Today</button>
                <button className="nav-btn" onClick={()=>setCurrentWeekStart(p=>{const n=new Date(p);n.setDate(n.getDate()+7);return n})} type="button">&gt;</button>
                {!isViewAll && (
                  <button className="btn" onClick={openRebalanceModal} type="button">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                    Rebalance
                  </button>
                )}
              </div>
              <div className="day-stats">
                {(() => {
                  const s = progressMode === "show_all" ? allTasksStats : weekStats
                  return <>
                    <div className="day-stat">
                      <span className="day-stat-label">Total</span>
                      <span className="day-stat-value">{s.total}</span>
                    </div>
                    <div className="day-stat-divider" />
                    <div className="day-stat">
                      <span className="day-stat-label">Done</span>
                      <span className="day-stat-value day-stat-done">{s.done}</span>
                    </div>
                    <div className="day-stat-divider" />
                    <div className="day-stat">
                      <span className="day-stat-label">Time Left</span>
                      <span className="day-stat-value">{s.totalMins ? formatMinutes(s.totalMins) : "—"}</span>
                    </div>
                    <div className="day-stat-divider" />
                    <div className="day-stat">
                      <span className="day-stat-label">Progress</span>
                      <div className="day-stat-progress-row">
                        <div className="progress-track"><div className="progress-fill" style={{ width: `${s.pct}%` }} /></div>
                        <span className="day-stat-pct">{s.pct}%</span>
                      </div>
                    </div>
                  </>
                })()}
              </div>
            </div>
            <div className="calendar-outer">
              <div className="calendar-grid">
                <div className="col-spacer"/>
                {days.map(day=>{
                  const k=dateKey(day)
                  return <div className={`col-header${isSameDate(day,today)?" today":""}`} key={k}>
                    <div className="col-date">{SHORT_MONTHS[day.getMonth()]} {day.getDate()}</div>
                    <div className="col-day">{DAYS[day.getDay()]}</div>
                  </div>
                })}
                <div className="row-label"><span className="row-label-text">Week {weekNum}</span></div>
                {days.map(day=>{
                  const k=dateKey(day), dayTasks=tasks[k]||[], total=dayTasks.reduce((s,t)=>s+(parseDurationToMinutes(t.time)||0),0)
                  return <div className={`day-cell${isSameDate(day,today)?" today":""}`} key={k}>
                    {dayTasks.map(task=>
                      <div className={`task-card${task.done?" done":""}`} key={task.id} onClick={()=>handleEditTask(k,task)}>
                        <div className="task-top">
                          <button className="task-check" onClick={e=>{e.stopPropagation();toggleTask(k,task.id)}} type="button" aria-label={task.done?"Mark task incomplete":"Mark task complete"}>
                            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2"><polyline points="1.5,5 4,7.5 8.5,2.5"/></svg>
                          </button>
                          <div className="task-name">{task.name}</div>
                          {isViewAll && task.calendarName && <span className="task-cal-badge" style={task.calendarColor ? { background: task.calendarColor } : undefined}>{task.calendarName.slice(0, 4).toUpperCase()}</span>}
                        </div>
                        <div className="task-footer">
                          <span className="task-tag">{tagLabel(task.tag)}</span>
                          <span className="task-time">{task.time}</span>
                        </div>
                      </div>
                    )}
                    {!isViewAll && <button className="add-task-btn" onClick={()=>openModal(k)} type="button" aria-label={`Add task for ${formatDateLabel(k)}`}>+</button>}
                    {total ? <div className="day-total">Total Time: {formatMinutes(total)}</div> : null}
                  </div>
                })}
              </div>
            </div>
          </div>
        )}
        {viewMode === "monthly" && (
          <MonthlyView
            tasks={tasks}
            onToggleTask={toggleTask}
            onDeleteTask={deleteTask}
            onAddTask={isViewAll ? undefined : handleAddTask}
            onEditTask={handleEditTask}
            rebalanceButton={isViewAll ? undefined : rebalanceButton}
            isViewAll={isViewAll}
            progressMode={progressMode}
            allTasksStats={allTasksStats}
          />
        )}
        {viewMode === "daily" && (
          <DayView
            tasks={tasks}
            onToggleTask={toggleTask}
            onAddTask={isViewAll ? undefined : handleAddTask}
            onEditTask={handleEditTask}
            rebalanceButton={isViewAll ? undefined : rebalanceButton}
            isViewAll={isViewAll}
            progressMode={progressMode}
            allTasksStats={allTasksStats}
          />
        )}
      </div>

      {/* Add / Edit task modal */}
      <div className={`modal-overlay${addingToDay||editingTask?" open":""}`} onClick={e=>{if(e.target===e.currentTarget){setAddingToDay(null);setEditingTask(null)}}}>
        <div className="modal">
          <div className="modal-header-row">
            <h3>{editingTask ? "Edit Task" : "Add Task"}</h3>
            {isViewAll && editingTask?.task.calendarId && (() => {
              const cal = calLookup.get(editingTask.task.calendarId!)
              const calTheme = cal ? THEMES[cal.color_theme || "rose"] : THEMES.rose
              return cal ? <span className="modal-cal-badge" style={{ background: calTheme.accent }}>{cal.name}</span> : null
            })()}
          </div>
          <label>Task Name</label>
          <input type="text" value={taskName} onChange={e=>setTaskName(e.target.value)} placeholder="e.g. Energy & Momentum Videos"/>
          <label>Type</label>
          <input type="text" value={taskTag} onChange={e=>setTaskTag(e.target.value)} placeholder="e.g. Physics, Math, etc." />
          {viewMode === "daily" ? (
            <div className="modal-row">
              <div>
                <label>Start Time</label>
                <input type="time" value={taskStart} onChange={e=>setTaskStart(e.target.value)} />
              </div>
              <div>
                <label>Duration</label>
                <input type="text" value={taskTime} onChange={e=>setTaskTime(e.target.value)} placeholder="e.g. 1h or 45min" />
              </div>
            </div>
          ) : (
            <>
              <label>Duration</label>
              <input type="text" value={taskTime} onChange={e=>setTaskTime(e.target.value)} placeholder="e.g. 1h or 25min" required/>
            </>
          )}
          <div className="modal-actions">
            {editingTask && <button className="btn-delete" onClick={async ()=>{await deleteTask(editingTask.dayKey, editingTask.task.id);setEditingTask(null);showToast("Task deleted")}} type="button">Delete</button>}
            <button className="btn-cancel" onClick={()=>{setAddingToDay(null);setEditingTask(null)}} type="button">Cancel</button>
            <button className="btn-primary" onClick={saveTask} type="button">{editingTask ? "Update" : "Add Task"}</button>
          </div>
        </div>
      </div>

      {/* Rebalance modal */}
      <div className={`modal-overlay rebalance-overlay${rebalanceOpen?" open":""}`} onClick={e=>{if(e.target===e.currentTarget)setRebalanceOpen(false)}}>
        <div className="rebalance-modal">
          <div className="rebalance-header">
            <h3>Rebalance Schedule</h3>
            <button className="icon-close" onClick={()=>setRebalanceOpen(false)} type="button">&times;</button>
          </div>
          <div className="rebalance-body">
            <div className="rebalance-form">
              <section className="rebalance-section">
                <h4>Select Dates</h4>
                <label>Start Date</label>
                <input type="date" value={rebalanceStartDate} onChange={e=>setRebalanceStartDate(e.target.value)}/>
                <label>End Date</label>
                <input type="date" value={rebalanceExamDate} onChange={e=>setRebalanceExamDate(e.target.value)}/>
                <label>Select Days Off</label>
                <div className="date-add-row">
                  <input type="date" value={dayOffInput} onChange={e=>setDayOffInput(e.target.value)}/>
                  <button className="small-btn" onClick={()=>{if(dayOffInput){addDayOffToDb(dayOffInput);setDayOffInput("")}}} type="button">Add</button>
                </div>
                <div className="day-off-list">
                  {[...daysOff].sort().map(k=>
                    <span className="day-off-chip" key={k}>
                      {formatDateLabel(k)}
                      <button type="button" onClick={()=>removeDayOffFromDb(k)}>&times;</button>
                    </span>
                  )}
                </div>
              </section>
              <button className="btn-primary rebalance-submit" onClick={applyRebalance} type="button" disabled={loading}>
                {loading ? "Rebalancing..." : "Rebalance Study Schedule"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <aside className={`settings-panel${settingsOpen?" open":""}`}>
        <button className="settings-close" onClick={()=>setSettingsOpen(false)} type="button">&times;</button>
        <h3>Calendar Settings</h3>
        <div className="settings-row">
          <label>Color Theme</label>
          <div className="theme-grid">
            {Object.entries(THEMES).map(([key, t]) => (
              <button
                key={key}
                className={`theme-swatch${colorTheme === key ? " selected" : ""}`}
                style={{ "--swatch": t.accent } as React.CSSProperties}
                onClick={async () => {
                  setColorTheme(key)
                  if (isViewAll) {
                    await saveUserSettings({ color_theme: key })
                  } else {
                    await supabase.from("calendars").update({ color_theme: key }).eq("id", calendar.id)
                  }
                  showToast(`Theme changed to ${t.label}`)
                }}
                type="button"
                title={t.label}
              />
            ))}
          </div>
        </div>
        <div className="settings-row">
          <label>Progress Bar</label>
          <div className="toggle-group">
            <button
              className={`toggle-btn${progressMode === "show_all" ? " active" : ""}`}
              onClick={async () => {
                setProgressMode("show_all")
                if (isViewAll) {
                  await saveUserSettings({ progress_mode: "show_all" })
                } else {
                  await supabase.from("calendars").update({ progress_mode: "show_all" }).eq("id", calendar.id)
                }
                showToast("Showing progress for all tasks")
              }}
              type="button"
            >
              Show All
            </button>
            <button
              className={`toggle-btn${progressMode === "current_view" ? " active" : ""}`}
              onClick={async () => {
                setProgressMode("current_view")
                if (isViewAll) {
                  await saveUserSettings({ progress_mode: "current_view" })
                } else {
                  await supabase.from("calendars").update({ progress_mode: "current_view" }).eq("id", calendar.id)
                }
                showToast("Showing progress for current view only")
              }}
              type="button"
            >
              Current View
            </button>
          </div>
        </div>
        <div className="settings-section-title">Tasks</div>
        <div className="settings-row">
          <label>Card Style</label>
          <button className="btn" onClick={() => setCardStyleOpen(!cardStyleOpen)} type="button" aria-expanded={cardStyleOpen} aria-haspopup="true">
            {selectedRebalanceView.charAt(0).toUpperCase() + selectedRebalanceView.slice(1)}
          </button>
          {cardStyleOpen && (
            <div className="card-style-popover">
              <h4>Select View</h4>
              <div className="view-card-grid">
                {(["clean","detailed","compact"] as RebalanceView[]).map(v=>
                  <button className={`view-card${selectedRebalanceView===v?" selected":""}`} key={v} onClick={()=>{setSelectedRebalanceView(v);setCardStyleOpen(false);saveUserSettings({card_style:v})}} type="button">
                    <span className={`view-card-lines${v==="detailed"||v==="compact"?` ${v}`:""}`}/>
                    <strong>{v.charAt(0).toUpperCase()+v.slice(1)}</strong>
                    <span>{v==="clean"?"Default":v==="detailed"?"Balanced":"Dense"}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="settings-row">
          <label>Tasks</label>
          <button className="btn" onClick={() => { setSettingsOpen(false); setBulkStartDate(dateKey(new Date())); setBulkEndDate(calendar.due_date || dateKey(new Date())); setBulkPool([]); setBulkAddOpen(true) }} type="button">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Add Bulk
          </button>
        </div>
      </aside>

      {/* Bulk add modal */}
      <div className={`modal-overlay${bulkAddOpen?" open":""}`} onClick={e=>{if(e.target===e.currentTarget)setBulkAddOpen(false)}}>
        <div className="rebalance-modal">
          <div className="rebalance-header">
            <h3>Add Tasks in Bulk</h3>
            <button className="icon-close" onClick={()=>setBulkAddOpen(false)} type="button">&times;</button>
          </div>
          <div className="rebalance-body">
            <div className="rebalance-form">
              <section className="rebalance-section">
                <h4>Tasks</h4>
                <div className="bulk-task-grid">
                  {bulkPool.map((t, i) => (
                    <div className="task-card" key={i}>
                      <div className="task-top">
                        <div className="task-name">{t.name}</div>
                        <button className="bulk-remove-btn" onClick={() => setBulkPool(p => p.filter((_, j) => j !== i))} type="button">&times;</button>
                      </div>
                      <div className="task-footer">
                        <span className="task-tag">{tagLabel(t.tag)}</span>
                        <span className="task-time">{formatMinutes(t.minutes)}</span>
                      </div>
                    </div>
                  ))}
                  <button className="add-task-btn" onClick={() => { setShowBulkForm(true); setAiPanelOpen(false); setBulkFormName(""); setBulkFormTag(""); setBulkFormTime("") }} type="button">+</button>
                  <button className="add-task-btn" onClick={() => { setAiPanelOpen(true); setShowBulkForm(false) }} type="button">AI</button>
                </div>
                {aiPanelOpen && (
                  <div className="bulk-inline-form">
                    <label>Input Text / Goal</label>
                    <textarea
                      className="ai-textarea"
                      rows={6}
                      value={aiInputText}
                      onChange={e => setAiInputText(e.target.value)}
                      placeholder="Paste your content, book summary, project description, or goal here..."
                    />
                    <label>Upload File (.md, .txt)</label>
                    <input
                      type="file"
                      accept=".md,.txt"
                      onChange={async e => {
                        const file = e.target.files?.[0]
                        if (file) setAiInputText(await file.text())
                      }}
                    />
                    <label>Additional Instructions (optional)</label>
                    <textarea
                      className="ai-textarea"
                      rows={3}
                      value={aiInstructions}
                      onChange={e => setAiInstructions(e.target.value)}
                      placeholder="E.g.: Order tasks from easiest to hardest, group by phase, etc."
                    />
                    <label>Model</label>
                    <select className="ai-select" value={aiModel} onChange={e => setAiModel(e.target.value)}>
                      <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Recommended)</option>
                      <option value="qwen/qwen3-32b">qwen/qwen3-32b (Faster)</option>
                      <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
                    </select>
                    <div className="bulk-form-actions">
                      <button className="btn-cancel" onClick={() => setAiPanelOpen(false)} type="button">Cancel</button>
                      <button className="btn-primary" onClick={generateTasksWithAI} type="button" disabled={aiLoading}>
                        {aiLoading ? "Generating..." : "Generate"}
                      </button>
                    </div>
                  </div>
                )}
                {showBulkForm && (
                  <div className="bulk-inline-form">
                    <input type="text" value={bulkFormName} onChange={e => setBulkFormName(e.target.value)} placeholder="Task name" />
                    <div className="modal-row">
                      <div>
                        <label>Type</label>
                        <input type="text" value={bulkFormTag} onChange={e => setBulkFormTag(e.target.value)} placeholder="e.g. physics" />
                      </div>
                      <div>
                        <label>Duration</label>
                        <input type="text" value={bulkFormTime} onChange={e => setBulkFormTime(e.target.value)} placeholder="e.g. 1h or 45min" />
                      </div>
                    </div>
                    <div className="bulk-form-actions">
                      <button className="btn-cancel" onClick={() => setShowBulkForm(false)} type="button">Cancel</button>
                      <button className="btn-primary" onClick={() => {
                        const mins = parseDurationToMinutes(bulkFormTime)
                        if (bulkFormName.trim() && mins) {
                          setBulkPool(p => [...p, { name: bulkFormName.trim(), tag: bulkFormTag, minutes: mins }])
                          setShowBulkForm(false)
                        } else {
                          showToast("Enter a name and valid duration")
                        }
                      }} type="button">Add</button>
                    </div>
                  </div>
                )}
              </section>
              <section className="rebalance-section">
                <h4>Date Range</h4>
                <label>Start Date</label>
                <input type="date" value={bulkStartDate} onChange={e=>setBulkStartDate(e.target.value)} />
                <label>End Date</label>
                <input type="date" value={bulkEndDate} onChange={e=>setBulkEndDate(e.target.value)} />
              </section>
              <button className="btn-primary rebalance-submit" onClick={applyBulkAdd} type="button" disabled={loading}>
                {loading ? "Adding..." : "Add Tasks"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`toast${toast?" show":""}`}>{toast}</div>
    </div>
  )
}
