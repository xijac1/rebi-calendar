"use client"

import { useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import type { CalendarRow } from "./page"

export default function DashboardContent({
  initialCalendars,
}: {
  initialCalendars: CalendarRow[]
}) {
  const [search, setSearch] = useState("")
  const [calendars, setCalendars] = useState(initialCalendars)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [newStart, setNewStart] = useState("")
  const [newDue, setNewDue] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState("")
  const router = useRouter()
  const supabase = createClient()

  const filtered = calendars.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleCreateCalendar() {
    if (!newName.trim()) return
    setCreating(true)
    setCreateError("")
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCreating(false); setCreateError("Not authenticated"); return }
    const { data, error } = await supabase
      .from("calendars")
      .insert({
        user_id: user.id,
        name: newName.trim(),
        description: newDesc.trim() || null,
        start_date: newStart || null,
        due_date: newDue || null,
      })
      .select("id, name, start_date, due_date, created_at")
      .single()

    setCreating(false)
    if (error) {
      setCreateError(error.message)
      return
    }
    if (!data) { setCreateError("No data returned"); return }

    setCalendars((prev) => [data as CalendarRow, ...prev])
    setShowCreate(false)
    setNewName("")
    setNewStart("")
    setNewDue("")
    setNewDesc("")
    router.push(`/calendar/${data.id}`)
  }

  async function handleDeleteCalendar(id: string, name: string) {
    if (!confirm(`Delete "${name}" and all its tasks?`)) return
    await supabase.from("calendars").delete().eq("id", id)
    setCalendars((prev) => prev.filter((c) => c.id !== id))
  }

  function formatDate(d: string | null) {
    if (!d) return "No date"
    const date = new Date(d)
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
  }

  function hoursLeft(due: string | null) {
    if (!due) return null
    const ms = new Date(due).getTime() - Date.now()
    if (ms <= 0) return "Overdue"
    const hrs = Math.round(ms / 3600000)
    if (hrs >= 24) return `${Math.round(hrs / 24)}d left`
    return `${hrs}hr left`
  }

  return (
    <>
      <div className="main-content">
        <div className="dash-topbar">
          <h1 className="page-title">Your Calendars</h1>
          <button className="btn-new" onClick={() => setShowCreate(true)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            New calendar
          </button>
        </div>

        <div className="search-wrap">
          <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            className="search-input"
            type="text"
            placeholder="Search for a calendar"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="cal-grid">
          {filtered.length === 0 && (
            <p className="no-results">No calendars found</p>
          )}
          {filtered.map((cal) => {
            const hl = hoursLeft(cal.due_date)
            return (
              <div
                className="cal-card"
                key={cal.id}
                onClick={() => router.push(`/calendar/${cal.id}`)}
              >
                <div className="cal-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                  </svg>
                </div>
                <div className="cal-info">
                  <div className="cal-name">{cal.name}</div>
                  <div className="cal-meta">
                    {cal.due_date ? `End ${formatDate(cal.due_date)}` : "No end date"}
                    {hl ? <span> · {hl}</span> : null}
                  </div>
                </div>
                <button
                  className="cal-delete"
                  onClick={(e) => { e.stopPropagation(); handleDeleteCalendar(cal.id, cal.name) }}
                  title="Delete calendar"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Create calendar modal */}
      {showCreate && (
        <div className="auth-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false) }}>
          <div className="auth-card">
            <button className="auth-close" onClick={() => setShowCreate(false)}>&times;</button>
            <h2 className="auth-heading">New Calendar</h2>
            <p className="auth-sub">Set up a new study schedule or project timeline</p>
            <div className="auth-field">
              <label>Name</label>
              <input type="text" placeholder="e.g. Physics Final" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="auth-field">
              <label>Description (optional)</label>
              <input type="text" placeholder="What's this for?" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            </div>
            <div className="name-row">
              <div className="auth-field">
                <label>Start date</label>
                <input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
              </div>
              <div className="auth-field">
                <label>End date</label>
                <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} />
              </div>
            </div>
            {createError && <p className="auth-error">{createError}</p>}
            <button className="btn-submit" onClick={handleCreateCalendar} disabled={creating || !newName.trim()}>
              {creating ? "Creating..." : "Create calendar"}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
