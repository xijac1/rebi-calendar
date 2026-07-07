"use client"

import { useState, useMemo, type ReactNode } from "react"
import type { Task, TasksByDate } from "./helpers"
import {
  dateKey, isSameDate, formatDateLabel, tagLabel, tagColor,
  MONTH_NAMES, SHORT_MONTHS, SHORT_DAYS, formatMinutes, parseDurationToMinutes,
} from "./helpers"

interface MonthlyViewProps {
  tasks: TasksByDate
  onToggleTask: (dayKey: string, taskId: string) => void
  onDeleteTask: (dayKey: string, taskId: string) => void
  onAddTask?: () => void
  onEditTask?: (dayKey: string, task: Task) => void
  rebalanceButton?: ReactNode
  isViewAll?: boolean
  progressMode?: "current_view" | "show_all"
  allTasksStats?: { total: number; done: number; totalMins: number; pct: number }
}

export default function MonthlyView({ tasks, onToggleTask, onDeleteTask, onAddTask, onEditTask, rebalanceButton, isViewAll, progressMode, allTasksStats }: MonthlyViewProps) {
  const today = useMemo(() => new Date(), [])
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)

  const firstDay = useMemo(() => new Date(viewYear, viewMonth, 1), [viewYear, viewMonth])
  const daysInMonth = useMemo(() => new Date(viewYear, viewMonth + 1, 0).getDate(), [viewYear, viewMonth])
  const startDow = firstDay.getDay()

  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7

  const cells = useMemo(() => {
    const result: { day: number; date: Date; key: string; out: boolean }[] = []
    const prevMonth = new Date(viewYear, viewMonth, 0)
    const prevDays = prevMonth.getDate()

    for (let i = 0; i < startDow; i++) {
      const d = prevDays - startDow + i + 1
      const date = new Date(viewYear, viewMonth - 1, d)
      result.push({ day: d, date, key: dateKey(date), out: true })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d)
      result.push({ day: d, date, key: dateKey(date), out: false })
    }
    const remaining = totalCells - result.length
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(viewYear, viewMonth + 1, d)
      result.push({ day: d, date, key: dateKey(date), out: true })
    }
    return result
  }, [viewYear, viewMonth, startDow, daysInMonth, totalCells])

  function navigate(dir: number) {
    let m = viewMonth + dir
    let y = viewYear
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setViewMonth(m)
    setViewYear(y)
  }

  function goToday() {
    setViewMonth(today.getMonth())
    setViewYear(today.getFullYear())
  }

  const selectedDateTasks = selectedDayKey ? tasks[selectedDayKey] || [] : []

  const monthStats = useMemo(() => {
    const monthKeys = cells.filter(c => !c.out).map(c => c.key)
    const all = monthKeys.flatMap(k => tasks[k] || [])
    const total = all.length
    const done = all.filter(t => t.done).length
    const totalMins = all.filter(t => !t.done).reduce((s, t) => s + (parseDurationToMinutes(t.time) || 0), 0)
    const pct = total ? Math.round((done / total) * 100) : 0
    return { total, done, totalMins, pct }
  }, [cells, tasks])

  return (
    <div className="monthly-view">
      <div className="topbar">
        <div className="topbar-left">
          <span className={`day-big${viewMonth === today.getMonth() && viewYear === today.getFullYear() ? " today" : ""}`}>{MONTH_NAMES[viewMonth]}</span>
          <div className="day-meta">
            <span className="day-weekday">{viewYear}</span>
          </div>
        </div>
        <div className="topbar-center">
          <button className="nav-btn" onClick={() => navigate(-1)} type="button">&lt;</button>
          <button className="today-btn" onClick={goToday} type="button">Today</button>
          <button className="nav-btn" onClick={() => navigate(1)} type="button">&gt;</button>
          {rebalanceButton}
        </div>
        <div className="day-stats">
          {(() => {
            const s = progressMode === "show_all" && allTasksStats ? allTasksStats : monthStats
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

      <div className="dow-row">
        {SHORT_DAYS.map(d => <div className="dow-cell" key={d}>{d}</div>)}
      </div>

      <div className="month-grid">
        {cells.map(cell => {
          const dayTasks = tasks[cell.key] || []
          const visible = dayTasks.slice(0, 3)
          const more = dayTasks.length - 3
          const isT = isSameDate(cell.date, today)

          return (
            <div
              className={`day-cell${isT ? " today" : ""}${cell.out ? " out" : ""}`}
              key={cell.key}
              onClick={() => setSelectedDayKey(cell.key)}
            >
              <div className="day-cell-header">
                {cell.day === 1 && <span className="month-label">{SHORT_MONTHS[cell.date.getMonth()]}</span>}
                <span className={`day-num${isT ? " today" : ""}`}>{cell.day}</span>
              </div>
              <div className="task-pills">
                {visible.map(task => (
                  <span className={`task-pill pill-${task.tag}`} key={task.id} title={task.name}>

                    {isViewAll && task.calendarName && <span className="pill-cal-badge" style={task.calendarColor ? { background: task.calendarColor } : undefined}>{task.calendarName.slice(0, 4).toUpperCase()}</span>}
                    <span className="pill-name">{task.name}</span>
                  </span>
                ))}
                {more > 0 && <span className="more-count preserver">+{more} more</span>}
              </div>
            </div>
          )
        })}
      </div>



      {/* Day detail modal */}
      {selectedDayKey && (
        <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) setSelectedDayKey(null) }}>
          <div className="modal monthly-modal">
            <h3>{formatDateLabel(selectedDayKey)}</h3>
            <div className="monthly-modal-tasks">
              {selectedDateTasks.length === 0 && (
                <p className="monthly-no-tasks">No tasks for this day</p>
              )}
              {selectedDateTasks.map(task => (
                <div className={`day-sidebar-task${task.done ? " done" : ""}`} key={task.id}>
                  <button className="sidebar-check" onClick={() => onToggleTask(selectedDayKey, task.id)} type="button">
                    {task.done && <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="1.5,5 4,7.5 8.5,2.5"/></svg>}
                  </button>
                  <div className="day-sidebar-task-info">
                    <div className="day-sidebar-task-name">{task.name}</div>
                    <div className="day-sidebar-task-foot">
                      <span className="day-sidebar-tag" style={{ background: `${tagColor(task.tag)}22`, color: tagColor(task.tag) }}>{tagLabel(task.tag)}</span>
                      {isViewAll && task.calendarName && <span className="sidebar-cal-badge" style={task.calendarColor ? { background: task.calendarColor } : undefined}>{task.calendarName.slice(0, 4).toUpperCase()}</span>}
                      <span className="day-sidebar-time">{task.time}</span>
                    </div>
                  </div>
                  <button className="modal-delete" onClick={() => onDeleteTask(selectedDayKey, task.id)} type="button">&times;</button>
                </div>
              ))}
            </div>
            <div className="monthly-modal-form">
              {onAddTask && (
                <button className="btn-primary" onClick={() => { setSelectedDayKey(null); onAddTask() }} type="button">Add Task</button>
              )}
              <button className="btn-cancel" onClick={() => setSelectedDayKey(null)} type="button">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
