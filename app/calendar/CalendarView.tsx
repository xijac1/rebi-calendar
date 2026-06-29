"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import type { TaskRow, DayOffRow, CalendarRow } from "./[id]/page"

type SubjectTag = "p" | "bio" | "rc" | "math"
type ViewMode = "weekly" | "daily" | "monthly"
type RebalanceView = "clean" | "detailed" | "compact"

type Task = {
  id: string
  name: string
  tag: SubjectTag
  time: string
  done: boolean
}

type TasksByDate = Record<string, Task[]>

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

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`
}

function dateFromKey(key: string) {
  const [y,m,d] = key.split("-").map(Number)
  return new Date(y,m-1,d)
}

function formatDateLabel(key: string) {
  const d = dateFromKey(key)
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function isSameDate(a: Date, b: Date) {
  return a.getDate()===b.getDate() && a.getMonth()===b.getMonth() && a.getFullYear()===b.getFullYear()
}

function parseDurationToMinutes(value: string) {
  const text = String(value||"").trim().toLowerCase()
  if (!text||text==="-") return null
  let mins = 0, matched = false
  const h = text.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b/)
  const m = text.match(/(\d+)\s*(m|min|mins|minute|minutes)\b/)
  if (h) { mins+=Number(h[1])*60; matched=true }
  if (m) { mins+=Number(m[1]); matched=true }
  if (!matched&&/^\d+$/.test(text)) { mins=Number(text); matched=true }
  return matched&&mins>0 ? Math.round(mins) : null
}

function formatMinutes(mins: number) {
  const h = Math.floor(mins/60), m=mins%60
  if (h&&m) return `${h}h ${m}min`
  if (h) return `${h}h`
  return `${m}min`
}

function tagLabel(tag: SubjectTag) { return {p:"P",bio:"BIO",rc:"RC",math:"MATH"}[tag] }
function tagClass(tag: SubjectTag) { return {p:"tag-p",bio:"tag-bio",rc:"tag-rc",math:"tag-math"}[tag] }

function getWeekStart(date: Date) {
  const d = new Date(date); d.setDate(d.getDate()-d.getDay()); d.setHours(0,0,0,0)
  return d
}

function computeTotalTime(dayTasks: Task[]) {
  const m = dayTasks.reduce((s,t)=>s+(parseDurationToMinutes(t.time)||0),0)
  return m?formatMinutes(m):null
}

function getEligibleStudyDays(startKey: string, examKey: string, daysOff: Set<string>) {
  const start = dateFromKey(startKey), exam = dateFromKey(examKey)
  const dates: string[] = []
  for (const day = new Date(start); day<=exam; day.setDate(day.getDate()+1)) {
    const k = dateKey(day)
    if (!daysOff.has(k)) dates.push(k)
  }
  return dates
}

function getUnfinishedTasks(tasks: TasksByDate) {
  return Object.entries(tasks).sort(([a],[b])=>a.localeCompare(b))
    .flatMap(([key,dayTasks]) =>
      dayTasks.filter(t=>!t.done).map(t=>({...t,originalDate:key,minutes:parseDurationToMinutes(t.time)})))
}

function buildBalancedPlan(tasks: TasksByDate, startKey: string, examKey: string, daysOff: Set<string>): RebalancePlan {
  const unfinished = getUnfinishedTasks(tasks)
  const invalid = unfinished.filter(t=>!t.minutes)
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
}: {
  calendar: CalendarRow
  initialTasks: TaskRow[]
  initialDaysOff: DayOffRow[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const [tasks, setTasks] = useState<TasksByDate>(() => {
    const grouped: TasksByDate = {}
    initialTasks.forEach((t) => {
      const key = t.scheduled_date || "unscheduled"
      if (!grouped[key]) grouped[key] = []
      grouped[key].push({
        id: t.id,
        name: t.title,
        tag: (t.subject as SubjectTag) || "p",
        time: t.duration_minutes ? `${t.duration_minutes}min` : "30min",
        done: t.completed,
      })
    })
    return grouped
  })

  const [daysOff, setDaysOff] = useState<Set<string>>(() => new Set(initialDaysOff.map((d) => d.date)))
  const [loading, setLoading] = useState(false)
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()))
  const [addingToDay, setAddingToDay] = useState<string | null>(null)
  const [taskName, setTaskName] = useState("")
  const [taskTag, setTaskTag] = useState<SubjectTag>("p")
  const [taskTime, setTaskTime] = useState("")
  const [dayOffInput, setDayOffInput] = useState("")
  const [rebalanceOpen, setRebalanceOpen] = useState(false)
  const [rebalanceStartDate, setRebalanceStartDate] = useState(calendar.start_date || dateKey(new Date()))
  const [rebalanceExamDate, setRebalanceExamDate] = useState(calendar.due_date || dateKey(new Date()))
  const [selectedRebalanceView, setSelectedRebalanceView] = useState<RebalanceView>("detailed")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toast, setToast] = useState("")

  const today = useMemo(() => new Date(), [])

  const days = useMemo(() => Array.from({length:7},(_,i)=>{const d=new Date(currentWeekStart);d.setDate(d.getDate()+i);return d}),[currentWeekStart])

  const weekNum = useMemo(() => {
    const start = dateFromKey(calendar.start_date || dateKey(new Date()))
    const diff = Math.floor((currentWeekStart.getTime()-start.getTime())/(7*86400000))
    return Math.max(1,diff+1)
  },[currentWeekStart, calendar.start_date])

  const progress = useMemo(() => {
    const all = Object.values(tasks).flat()
    const done = all.filter(t=>t.done).length
    const pct = all.length?(done/all.length)*100:0
    return {done,total:all.length,pct}
  },[tasks])

  const daysUntilExam = useMemo(() => {
    const due = calendar.due_date
    if (!due) return 0
    const diff = Math.ceil((dateFromKey(due).getTime()-today.getTime())/86400000)
    return Math.max(0,diff)
  },[today, calendar.due_date])

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
      if (e.key==="Escape") { setAddingToDay(null); setSettingsOpen(false); setRebalanceOpen(false) }
    }
    document.addEventListener("keydown",closeOnEscape)
    return ()=>document.removeEventListener("keydown",closeOnEscape)
  },[])

  async function addTaskToDb(dayKey: string, title: string, subject: SubjectTag, durationMinutes: number) {
    const { data, error } = await supabase.from("tasks").insert({
      calendar_id: calendar.id,
      title,
      subject,
      duration_minutes: durationMinutes,
      scheduled_date: dayKey,
      completed: false,
    }).select("id").single()
    if (error) return null
    const taskId = data.id
    const timeStr = durationMinutes >= 60
      ? `${Math.floor(durationMinutes/60)}h${durationMinutes%60 ? ` ${durationMinutes%60}min` : ""}`
      : `${durationMinutes}min`
    setTasks(prev => ({
      ...prev,
      [dayKey]: [...(prev[dayKey]||[]), { id: taskId, name: title, tag: subject, time: timeStr, done: false }]
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
    setAddingToDay(dayKey); setTaskName(""); setTaskTag("p"); setTaskTime("")
  }

  async function saveTask() {
    const name = taskName.trim(), time = taskTime.trim()
    if (!addingToDay||!name) return
    const mins = parseDurationToMinutes(time)
    if (!mins) { showToast("Enter a valid duration like 1h or 25min"); return }
    await addTaskToDb(addingToDay, name, taskTag, mins)
    setAddingToDay(null)
    showToast("Task added")
  }

  function toggleTask(dayKey: string, id: string) {
    const task = tasks[dayKey]?.find(t => t.id === id)
    if (!task) return
    toggleTaskDone(dayKey, id, task.done)
  }

  return (
    <main className="schedule-app" style={{ paddingTop: "24px" }}>
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button className="btn" onClick={() => router.push("/dashboard")} type="button">
            &larr; Dashboard
          </button>
          <h1>{calendar.name}</h1>
        </div>
        <div className="topbar-actions">
          <button className="btn" onClick={openRebalanceModal} type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
            Rebalance
          </button>
          <button className="btn" onClick={() => setSettingsOpen(true)} type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Settings
          </button>
        </div>
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <div className="card-title">{calendar.name}</div>
            <div className="card-subtitle">{calendar.start_date && calendar.due_date ? `Schedule Range: ${formatDateLabel(calendar.start_date)} to ${formatDateLabel(calendar.due_date)}` : "No date range set"}</div>
          </div>
          <div className="view-controls">
            <select className="view-select" defaultValue="weekly">
              <option value="weekly">Weekly View</option>
              <option value="daily">Daily View</option>
              <option value="monthly">Monthly View</option>
            </select>
            <button className="nav-btn" onClick={()=>setCurrentWeekStart(p=>{const n=new Date(p);n.setDate(n.getDate()-7);return n})} type="button">&lt;</button>
            <button className="today-btn" onClick={()=>setCurrentWeekStart(getWeekStart(new Date()))} type="button">Today</button>
            <button className="nav-btn" onClick={()=>setCurrentWeekStart(p=>{const n=new Date(p);n.setDate(n.getDate()+7);return n})} type="button">&gt;</button>
          </div>
        </div>

        <div className="progress-row">
          <div className="progress-left">
            <div className="progress-label">{progress.done}/{progress.total} tasks completed</div>
            <div className="progress-track"><div className="progress-fill" style={{width:`${progress.pct}%`}}/></div>
          </div>
          <div className="progress-days">{daysUntilExam} days until due date</div>
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
              const k=dateKey(day), dayTasks=tasks[k]||[], total=computeTotalTime(dayTasks)
              return <div className={`day-cell${isSameDate(day,today)?" today":""}`} key={k}>
                <button className="add-task-btn" onClick={()=>openModal(k)} type="button" aria-label={`Add task for ${formatDateLabel(k)}`}>+</button>
                {dayTasks.map(task=>
                  <div className={`task-card${task.done?" done":""}`} key={task.id}>
                    <div className="task-top">
                      <button className="task-check" onClick={()=>toggleTask(k,task.id)} type="button" aria-label={task.done?"Mark task incomplete":"Mark task complete"}>
                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2"><polyline points="1.5,5 4,7.5 8.5,2.5"/></svg>
                      </button>
                      <div className="task-name">{task.name}</div>
                    </div>
                    <div className="task-footer">
                      <span className={`task-tag ${tagClass(task.tag)}`}>{tagLabel(task.tag)}</span>
                      <span className="task-time">{task.time}</span>
                    </div>
                  </div>
                )}
                {total ? <div className="day-total">Total Time: {total}</div> : null}
              </div>
            })}
          </div>
        </div>
      </section>

      {/* Add task modal */}
      <div className={`modal-overlay${addingToDay?" open":""}`} onClick={e=>{if(e.target===e.currentTarget)setAddingToDay(null)}}>
        <div className="modal">
          <h3>Add Task</h3>
          <label>Task Name</label>
          <input type="text" value={taskName} onChange={e=>setTaskName(e.target.value)} placeholder="e.g. Energy & Momentum Videos"/>
          <label>Duration</label>
          <input type="text" value={taskTime} onChange={e=>setTaskTime(e.target.value)} placeholder="e.g. 1h or 25min" required/>
          <div className="modal-actions">
            <button className="btn-cancel" onClick={()=>setAddingToDay(null)} type="button">Cancel</button>
            <button className="btn-primary" onClick={saveTask} type="button">Add Task</button>
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

      {/* Settings panel */}
      <aside className={`settings-panel${settingsOpen?" open":""}`}>
        <button className="settings-close" onClick={()=>setSettingsOpen(false)} type="button">&times;</button>
        <h3>Settings</h3>
        <div className="settings-row">
          <label>Schedule Name</label>
          <input type="text" defaultValue={calendar.name}/>
        </div>
        <div className="settings-row">
          <label>Start Date</label>
          <input type="date" defaultValue={calendar.start_date||""}/>
        </div>
        <div className="settings-row">
          <label>End Date</label>
          <input type="date" defaultValue={calendar.due_date||""}/>
        </div>
        <div className="settings-actions">
          <button className="btn-primary settings-save" onClick={()=>{setSettingsOpen(false);showToast("Settings saved")}} type="button">Save Settings</button>
        </div>
      </aside>

      <div className={`toast${toast?" show":""}`}>{toast}</div>
    </main>
  )
}
