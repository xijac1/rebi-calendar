"use client"

import { useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { useRouter, usePathname } from "next/navigation"

export default function Sidebar({ userEmail }: { userEmail: string }) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const initial = userEmail.charAt(0).toUpperCase()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/?login=1")
  }

  const navItems = [
    { label: "Calendars", href: "/dashboard", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    )},
    { label: "View All", href: "/calendar/all", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12l9-9 9 9"/><path d="M9 21V9h6v12"/>
      </svg>
    )},
    { label: "Activity", href: "#", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 3"/>
      </svg>
    )},
    { label: "Settings", href: "#", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/>
      </svg>
    )},
  ]

  return (
    <nav className={`sidebar${sidebarExpanded ? " expanded" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <svg className="logo-icon" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" fill="#2f0505" stroke="#dd0426" strokeWidth="1.5"/>
            <path d="M9 18 L14 9 L19 18" stroke="#dd0426" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <path d="M10.5 15.5 H17.5" stroke="#dd0426" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span className="logo-wordmark">Rebi</span>
        </div>
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          title={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3 L11 8 L6 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      <div className="sidebar-nav">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "#" && pathname.startsWith(item.href))
          return (
            <a
              key={item.label}
              className={`nav-item${isActive ? " active" : ""}`}
              href={item.href}
            >
              {item.icon}
              <span className="nav-label">{item.label}</span>
            </a>
          )
        })}
      </div>
      <div className="sidebar-bottom">
        <div className="profile-btn" onClick={handleSignOut} title="Sign out">
          <div className="avatar">{initial}</div>
          <span className="profile-name">{userEmail}</span>
        </div>
      </div>
    </nav>
  )
}
