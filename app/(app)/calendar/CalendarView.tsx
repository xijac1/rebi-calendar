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
  ;[...unfinished].map(t=>({...t,minutes:t.minutes as number}))
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
}: {
  calendar: CalendarRow
  initialTasks: TaskRow[]
  initialDaysOff: DayOffRow[]
  allCalendars?: CalendarInfo[]
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
  const [selectedRebalanceView, setSelectedRebalanceView] = useState<RebalanceView>("detailed")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toast, setToast] = useState("")

  const isViewAll = calendar.id === "all"
  const [colorTheme, setColorTheme] = useState(calendar.color_theme || "rose")
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

  const previewText = useMemo(() => {
    if (!rebalanceStartDate||!rebalanceExamDate||dateFromKey(rebalanceStartDate)>dateFromKey(rebalanceExamDate))
      return "Choose a valid start and exam date to preview your balanced workload."
    if (!rebalancePlan) return "Select dates to preview your balanced workload."
    if ("error" in rebalancePlan) return rebalancePlan.error
    if (!rebalancePlan.unfinished.length) return "All tasks are complete. There is nothing to rebalance."
    const avg = Math.ceil(rebalancePlan.totalMinutes/rebalancePlan.studyDays.length)
    return `After rebalancing, ${rebalancePlan.unfinished.length} unfinished tasks will be spread across ${rebalancePlan.studyDays.length} study days at about ${formatMinutes(avg)} per day. Heaviest day: ${formatMinutes(rebalancePlan.maxDayMinutes)}.`
  },[rebalanceExamDate,rebalancePlan,rebalanceStartDate])

  const previewTasks = rebalancePlan&&!("error"in rebalancePlan)
    ? rebalancePlan.dayLoads.filter(d=>d.tasks.length).slice(0,4)
    : []

  function showToast(msg: string) { setToast(msg) }

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
    if (!plan.unfinished.length) { showToast("No unfinished tasks to rebalance"); return }

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
      await supabase.from("tasks").update({ title: name, subject: taskTag || null, duration_minutes: mins }).eq("id", editingTask.task.id)
      const timeStr = formatMinutes(mins)
      setTasks(prev => ({
        ...prev,
        [editingTask.dayKey]: (prev[editingTask.dayKey]||[]).map(t => t.id===editingTask.task.id ? {...t, name, tag: taskTag, time: timeStr} : t)
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

  function handleAddTask() {
    const now = new Date()
    openModal(dateKey(now))
  }

  function handleEditTask(dayKey: string, task: Task) {
    openEditModal(dayKey, task)
  }

  const weekStats = useMemo(() => {
    const dayKeys = days.map(d => dateKey(d))
    const all = dayKeys.flatMap(k => tasks[k] || [])
    const total = all.length
    const done = all.filter(t => t.done).length
    const totalMins = all.reduce((s, t) => s + (parseDurationToMinutes(t.time) || 0), 0)
    const pct = total ? Math.round((done / total) * 100) : 0
    return { total, done, totalMins, pct }
  }, [days, tasks])

  const rebalanceButton = (
    <button className="btn rebalance-btn" onClick={openRebalanceModal} type="button">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
      Rebalance
    </button>
  )

  return (
    <div className="schedule-app" style={themeVars}>
      <div className="persistent-topbar">
        <h1 className="persistent-title">{calendar.name}</h1>
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
          <>
          <div className="topbar">
            <div className="topbar-left">
              <span className={`day-big${isSameDate(currentWeekStart, getWeekStart(today)) ? " today" : ""}`}>{SHORT_MONTHS[currentWeekStart.getMonth()]}</span>
              <div className="day-meta">
                <span className="day-weekday">{MONTH_NAMES[currentWeekStart.getMonth()]}</span>
                <span className="day-month">{currentWeekStart.getFullYear()}</span>
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
              <div className="day-stat">
                <span className="day-stat-label">Total</span>
                <span className="day-stat-value">{weekStats.total}</span>
              </div>
              <div className="day-stat-divider" />
              <div className="day-stat">
                <span className="day-stat-label">Done</span>
                <span className="day-stat-value day-stat-done">{weekStats.done}</span>
              </div>
              <div className="day-stat-divider" />
              <div className="day-stat">
                <span className="day-stat-label">Study Time</span>
                <span className="day-stat-value">{weekStats.totalMins ? formatMinutes(weekStats.totalMins) : "—"}</span>
              </div>
              <div className="day-stat-divider" />
              <div className="day-stat">
                <span className="day-stat-label">Progress</span>
                <div className="day-stat-progress-row">
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${weekStats.pct}%` }} /></div>
                  <span className="day-stat-pct">{weekStats.pct}%</span>
                </div>
              </div>
            </div>
            <div className="topbar-right">
              {!isViewAll && (
                <button className="btn" onClick={handleAddTask} type="button">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  Add Task
                </button>
              )}
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
                        <button className="task-check" onClick={()=>toggleTask(k,task.id)} type="button" aria-label={task.done?"Mark task incomplete":"Mark task complete"}>
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
          </>
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
            <h3>Rebalance Study Schedule</h3>
            <button className="icon-close" onClick={()=>setRebalanceOpen(false)} type="button">&times;</button>
          </div>
          <div className="rebalance-body">
            <div className="rebalance-form">
              <section className="rebalance-section">
                <h4>Select Dates</h4>
                <label>Start Date</label>
                <input type="date" value={rebalanceStartDate} onChange={e=>setRebalanceStartDate(e.target.value)}/>
                <label>Exam Date</label>
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
              <section className="rebalance-section">
                <h4>Select View</h4>
                <div className="view-card-grid">
                  {(["clean","detailed","compact"] as RebalanceView[]).map(v=>
                    <button className={`view-card${selectedRebalanceView===v?" selected":""}`} key={v} onClick={()=>setSelectedRebalanceView(v)} type="button">
                      <span className={`view-card-lines${v==="detailed"||v==="compact"?` ${v}`:""}`}/>
                      <strong>{v.charAt(0).toUpperCase()+v.slice(1)}</strong>
                      <span>{v==="clean"?"Default":v==="detailed"?"Balanced":"Dense"}</span>
                    </button>
                  )}
                </div>
              </section>
              <button className="btn-primary rebalance-submit" onClick={applyRebalance} type="button" disabled={loading}>
                {loading ? "Rebalancing..." : "Rebalance Study Schedule"}
              </button>
            </div>
            <div className="rebalance-preview">
              <div className="preview-board">
                {previewTasks.map(day=>
                  <div className="preview-task" key={day.key}>
                    <strong>{day.tasks[0].name}</strong>
                    <span>{formatDateLabel(day.key)} - {formatMinutes(day.minutes)}</span>
                  </div>
                )}
              </div>
              <div className="preview-copy">
                <h4>Schedule Preview</h4>
                <p>{previewText}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <aside className={`settings-panel${settingsOpen?" open":""}`}>
        <button className="settings-close" onClick={()=>setSettingsOpen(false)} type="button">&times;</button>
        <h3>Settings</h3>
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
                  if (!isViewAll) {
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
      </aside>

      <div className={`toast${toast?" show":""}`}>{toast}</div>
    </div>
  )
}
