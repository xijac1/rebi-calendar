"use client"

import { useState, useMemo, useEffect, useRef, type ReactNode } from "react"
import type { Task, TasksByDate, SubjectTag } from "./helpers"
import {
  dateKey, isSameDate, tagLabel, tagColor,
  formatMinutes, parseDurationToMinutes, SHORT_MONTHS, DAYS,
} from "./helpers"

const HOUR_H = 72

interface DayViewProps {
  tasks: TasksByDate
  onToggleTask: (dayKey: string, taskId: string) => void
  onAddTask?: () => void
  onEditTask?: (dayKey: string, task: Task) => void
  rebalanceButton?: ReactNode
  isViewAll?: boolean
  progressMode?: "current_view" | "show_all"
  allTasksStats?: { total: number; done: number; totalMins: number; pct: number }
}

export default function DayView({ tasks, onToggleTask, onAddTask, onEditTask, rebalanceButton, isViewAll, progressMode, allTasksStats }: DayViewProps) {
  const today = useMemo(() => new Date(), [])
  const [viewDate, setViewDate] = useState(today)
  const scrollRef = useRef<HTMLDivElement>(null)
  const key = dateKey(viewDate)
  const dayTasks = tasks[key] || []

  const stats = useMemo(() => {
    const total = dayTasks.length
    const done = dayTasks.filter(t => t.done).length
    const totalMins = dayTasks.reduce((s, t) => s + (parseDurationToMinutes(t.time) || 0), 0)
    const pct = total ? Math.round((done / total) * 100) : 0
    return { total, done, totalMins, pct }
  }, [dayTasks])

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), [])

  const sorted = useMemo(() => {
    return [...dayTasks].sort((a, b) => {
      const aMin = timeToMins(a.start || "09:00")
      const bMin = timeToMins(b.start || "09:00")
      return aMin - bMin
    })
  }, [dayTasks])

  function timeToMins(t: string) {
    const [h, m] = t.split(":").map(Number)
    return h * 60 + (m || 0)
  }

  function minsToTime(mins: number) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
  }

  function navigate(dir: number) {
    const d = new Date(viewDate)
    d.setDate(d.getDate() + dir)
    setViewDate(d)
  }

  function goToday() {
    setViewDate(new Date())
  }

  const isToday = isSameDate(viewDate, today)
  const nowMinutes = today.getHours() * 60 + today.getMinutes()
  const nowTop = isToday ? (nowMinutes / 60) * HOUR_H : -1

  useEffect(() => {
    if (isToday && scrollRef.current) {
      scrollRef.current.scrollTop = nowTop - 200
    }
  }, [isToday, nowTop])

  const tableRows = useMemo(() => {
    return hours.map(h => {
      const label = h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`
      return { hour: h, label, top: h * HOUR_H }
    })
  }, [hours])

  return (
    <div className="day-view">
      <div className="topbar">
        <div className="topbar-left">
          <span className={`day-big${isToday ? " today" : ""}`}>{viewDate.getDate()}</span>
          <div className="day-meta">
            <span className="day-weekday">{DAYS[viewDate.getDay()]}</span>
            <span className="day-month">{SHORT_MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
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
            const s = progressMode === "show_all" && allTasksStats ? allTasksStats : stats
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
                <span className="day-stat-label">Total Time</span>
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

      <div className="day-main">
        <div className="day-scroll" ref={scrollRef}>
          <div className="day-scroll-inner" style={{ height: `${24 * HOUR_H}px` }}>
            {tableRows.map(row => (
              <div className="hour-row" key={row.hour} style={{ top: `${row.top}px` }}>
                <div className="hour-label">{row.label}</div>
                <div className="hour-line" />
                <div className="half-tick" />
              </div>
            ))}
            {isToday && nowTop >= 0 && (
              <div className="now-line" style={{ top: `${nowTop}px` }}>
                <div className="now-dot" />
              </div>
            )}
            <div className="tasks-layer">
              {sorted.map(task => {
                const startMins = timeToMins(task.start || "09:00")
                const durMins = parseDurationToMinutes(task.time) || 30
                const top = (startMins / 60) * HOUR_H
                const height = Math.max((durMins / 60) * HOUR_H, 22)

                return (
                  <div
                    className={`task-block${task.done?" done":""}`}
                    key={task.id}
                    onClick={()=>onEditTask?.(key,task)}
                    style={{
                      top: `${top}px`,
                      height: `${height}px`,
                      background: `${tagColor(task.tag)}22`,
                      borderLeftColor: tagColor(task.tag),
                      color: tagColor(task.tag),
                    }}
                  >
                    <button className="task-block-check" onClick={e => { e.stopPropagation(); onToggleTask(key, task.id); }} type="button">
                      {task.done && <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="1.5,5 4,7.5 8.5,2.5"/></svg>}
                    </button>
                    <div className="task-block-name">{task.name}</div>
                    {height > 44 && (
                      <div className="task-block-time">
                        {task.start || "09:00"} – {minsToTime(startMins + durMins)} · {task.time}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="day-sidebar">
          <div className="day-sidebar-header">Task List</div>
          <div className="day-sidebar-list">
            {dayTasks.length === 0 && (
              <div className="day-sidebar-empty">
                No tasks for this day. Click "Add Task" to get started.
              </div>
            )}
            {sorted.map(task => (
              <div className={`day-sidebar-task${task.done ? " done" : ""}`} key={task.id} onClick={()=>onEditTask?.(key,task)}>
                <button className="sidebar-check" onClick={e=>{e.stopPropagation();onToggleTask(key, task.id)}} type="button">
                  {task.done && <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="1.5,5 4,7.5 8.5,2.5"/></svg>}
                </button>
                <div className="day-sidebar-task-info">
                  <div className="day-sidebar-task-name">{task.name}</div>
                  <div className="day-sidebar-task-foot">
                    <span className="day-sidebar-tag" style={{ background: `${tagColor(task.tag)}22`, color: tagColor(task.tag) }}>{tagLabel(task.tag)}</span>
                    {isViewAll && task.calendarName && <span className="sidebar-cal-badge" style={task.calendarColor ? { background: task.calendarColor } : undefined}>{task.calendarName.slice(0, 4).toUpperCase()}</span>}
                    <span className="day-sidebar-time">{task.start || "09:00"} · {task.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
