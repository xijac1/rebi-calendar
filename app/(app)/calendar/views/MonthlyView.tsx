"use client"

import { useState, useMemo } from "react"
import type { Task, TasksByDate, SubjectTag } from "./helpers"
import {
  dateKey, isSameDate, formatDateLabel, tagLabel, tagColor,
  MONTH_NAMES, SHORT_DAYS, formatMinutes, parseDurationToMinutes,
} from "./helpers"

interface MonthlyViewProps {
  tasks: TasksByDate
  onToggleTask: (dayKey: string, taskId: string) => void
  onDeleteTask: (dayKey: string, taskId: string) => void
  onAddTask: () => void
}

export default function MonthlyView({ tasks, onToggleTask, onDeleteTask, onAddTask }: MonthlyViewProps) {
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

  return (
    <div className="monthly-view">
      <div className="monthly-header">
        <span className="monthly-title">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <div className="monthly-nav">
          <button className="today-btn" onClick={goToday} type="button">Today</button>
          <button className="nav-btn" onClick={() => navigate(-1)} type="button">&lt;</button>
          <button className="nav-btn" onClick={() => navigate(1)} type="button">&gt;</button>
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
              <span className={`day-num${isT ? " today" : ""}`}>{cell.day}</span>
              <div className="task-pills">
                {visible.map(task => (
                  <span className={`task-pill pill-${task.tag}`} key={task.id} title={task.name}>
                    <span className="pill-dot" style={{ background: tagColor(task.tag) }} />
                    <span className="pill-name">{task.name}</span>
                  </span>
                ))}
                {more > 0 && <span className="more-count preserver">+{more} more</span>}
              </div>
            </div>
          )
        })}
      </div>

      <div className="legend">
        <div className="legend-item"><div className="legend-dot" style={{background:tagColor("p")}} /> Physics</div>
        <div className="legend-item"><div className="legend-dot" style={{background:tagColor("bio")}} /> Biology</div>
        <div className="legend-item"><div className="legend-dot" style={{background:tagColor("rc")}} /> Reading Comp</div>
        <div className="legend-item"><div className="legend-dot" style={{background:tagColor("math")}} /> Math</div>
        <div className="legend-item"><div className="legend-dot" style={{background:tagColor("gen")}} /> General</div>
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
                <div className={`monthly-task-row${task.done ? " done" : ""}`} key={task.id}>
                  <button className="task-check" onClick={() => onToggleTask(selectedDayKey, task.id)} type="button">
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2"><polyline points="1.5,5 4,7.5 8.5,2.5"/></svg>
                  </button>
                  <span className="modal-tag-dot" style={{ background: tagColor(task.tag) }} />
                  <span className="modal-task-name">{task.name} <span className="modal-task-time">{task.time}</span></span>
                  <button className="modal-delete" onClick={() => onDeleteTask(selectedDayKey, task.id)} type="button">&times;</button>
                </div>
              ))}
            </div>
            <div className="monthly-modal-form">
              <button className="btn-primary" onClick={() => { setSelectedDayKey(null); onAddTask() }} type="button">Add Task</button>
              <button className="btn-cancel" onClick={() => setSelectedDayKey(null)} type="button">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
