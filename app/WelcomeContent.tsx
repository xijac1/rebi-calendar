"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import type { User } from "@supabase/supabase-js"

export default function WelcomePage({
  autoOpenLogin,
  autoOpenSignup,
}: {
  autoOpenLogin?: boolean
  autoOpenSignup?: boolean
}) {
  const [user, setUser] = useState<User | null>(null)
  const [showLogin, setShowLogin] = useState(autoOpenLogin ?? false)
  const [showSignup, setShowSignup] = useState(autoOpenSignup ?? false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [supabase])

  // ── Login state ──
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [loginError, setLoginError] = useState("")
  const [loginLoading, setLoginLoading] = useState(false)
  const [showLoginPw, setShowLoginPw] = useState(false)

  // ── Signup state ──
  const [signupFirstName, setSignupFirstName] = useState("")
  const [signupLastName, setSignupLastName] = useState("")
  const [signupEmail, setSignupEmail] = useState("")
  const [signupPassword, setSignupPassword] = useState("")
  const [signupConfirm, setSignupConfirm] = useState("")
  const [signupTerms, setSignupTerms] = useState(false)
  const [signupError, setSignupError] = useState("")
  const [signupLoading, setSignupLoading] = useState(false)
  const [showSignupPw, setShowSignupPw] = useState(false)
  const [showSignupConfirm, setShowSignupConfirm] = useState(false)

  function scorePassword(pw: string) {
    let score = 0
    if (pw.length >= 8) score++
    if (pw.length >= 12) score++
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    return Math.min(4, Math.max(0, Math.round(score * 4 / 5)))
  }

  const pwScore = signupPassword.length === 0 ? 0 : Math.max(1, scorePassword(signupPassword))
  const pwColors = ["#c0392b", "#e67e22", "#f1c40f", "#dd0426"]
  const pwLabels = ["Weak", "Fair", "Good", "Strong"]

  async function handleLogin() {
    setLoginLoading(true)
    setLoginError("")
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })
    setLoginLoading(false)
    if (error) return setLoginError(error.message)
    router.push("/dashboard")
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUser(null)
    router.push("/?login=1")
  }

  async function handleSignup() {
    if (!signupFirstName || !signupLastName || !signupEmail || !signupPassword || !signupConfirm) return
    if (signupPassword !== signupConfirm) return setSignupError("Passwords do not match")
    if (!signupTerms) return setSignupError("You must agree to the terms")
    setSignupLoading(true)
    setSignupError("")
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
    })
    setSignupLoading(false)
    if (error) return setSignupError(error.message)
    router.push("/dashboard")
  }

  return (
    <div className="welcome-page">
      {/* NAV */}
      <nav className="welcome-nav">
        <a className="nav-logo" href="#">
          <svg className="nav-logo-icon" viewBox="0 0 30 30" fill="none">
            <circle cx="15" cy="15" r="14" fill="#2f0505" stroke="#dd0426" strokeWidth="1.4"/>
            <path d="M9.5 20.5 L15 10 L20.5 20.5" stroke="#dd0426" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <path d="M11.5 17.5 H18.5" stroke="#dd0426" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          <span className="nav-logo-name">Rebi<span>Calendar</span></span>
        </a>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#">Pricing</a>
        </div>
        <div className="nav-actions">
          {user ? (
            <div className="user-menu-wrap">
              <button className="user-avatar-btn" onClick={() => setShowUserMenu(!showUserMenu)}>
                <div className="user-avatar">{user.email?.charAt(0).toUpperCase() || "U"}</div>
              </button>
              {showUserMenu && (
                <>
                  <div className="user-menu-overlay" onClick={() => setShowUserMenu(false)} />
                  <div className="user-menu">
                    <div className="user-menu-header">{user.email}</div>
                    <button className="user-menu-item" onClick={() => { setShowUserMenu(false); router.push("/dashboard") }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                      Dashboard
                    </button>
                    <button className="user-menu-item" onClick={() => { setShowUserMenu(false); router.push("/dashboard") }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                      Settings
                    </button>
                    <div className="user-menu-divider" />
                    <button className="user-menu-item user-menu-signout" onClick={() => { setShowUserMenu(false); handleSignOut() }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <button className="btn-ghost" onClick={() => setShowLogin(true)}>Sign in</button>
              <button className="btn-primary" onClick={() => setShowSignup(true)}>Get started</button>
            </>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="eyebrow">
          <span className="eyebrow-dot"></span>
          Smart calendar rebalancing
        </div>
        <h1>Never fall behind a<br />deadline <em>again</em></h1>
        <p>Rebi Calendar automatically redistributes missed tasks into your remaining days — so you always have a clear, honest path to done.</p>
        <div className="hero-cta">
          {user ? (
            <button className="btn-hero" onClick={() => router.push("/dashboard")}>
              Go to Dashboard
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          ) : (
            <>
              <button className="btn-hero" onClick={() => setShowSignup(true)}>
                Start for free
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
              <a className="btn-hero-ghost" href="#how">See how it works</a>
            </>
          )}
        </div>
      </section>

      {/* DEMO WIDGET */}
      <div className="demo-wrap">
        <div className="demo-card">
          <div className="demo-topbar">
            <div className="demo-dots">
              <div className="demo-dot red"></div>
              <div className="demo-dot amber"></div>
              <div className="demo-dot green"></div>
            </div>
            <div className="demo-url">app.rebicalendar.com</div>
          </div>
          <div className="demo-body">
            <div className="demo-sidebar">
              <div className="demo-cal-list-title">My Calendars</div>
              <div className="demo-cal-item active">
                <div className="cal-dot" style={{ background: "#dd0426" }}></div>
                Q2 Product Launch
              </div>
              <div className="demo-cal-item">
                <div className="cal-dot" style={{ background: "#3b82f6" }}></div>
                Study Schedule
              </div>
              <div className="demo-cal-item">
                <div className="cal-dot" style={{ background: "#a855f7" }}></div>
                Fitness Plan
              </div>
              <div className="demo-cal-item">
                <div className="cal-dot" style={{ background: "#f59e0b" }}></div>
                Side Project
              </div>
              <button className="demo-rebalance-btn">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
                </svg>
                Rebalance
              </button>
            </div>
            <div className="demo-cal">
              <div className="demo-cal-header">
                <span className="demo-cal-month">June 2026</span>
                <div className="demo-cal-nav">
                  <button>‹</button>
                  <button>›</button>
                </div>
              </div>
              <div className="cal-grid">
                <div className="cal-day-label">Su</div>
                <div className="cal-day-label">Mo</div>
                <div className="cal-day-label">Tu</div>
                <div className="cal-day-label">We</div>
                <div className="cal-day-label">Th</div>
                <div className="cal-day-label">Fr</div>
                <div className="cal-day-label">Sa</div>
                <div className="cal-day faded">25</div>
                <div className="cal-day faded">26</div>
                <div className="cal-day faded">27</div>
                <div className="cal-day faded">28</div>
                <div className="cal-day faded">29</div>
                <div className="cal-day faded">30</div>
                <div className="cal-day faded">31</div>
                <div className="cal-day">1</div>
                <div className="cal-day has-event">2<div className="event-pip done"></div></div>
                <div className="cal-day has-event">3<div className="event-pip done"></div></div>
                <div className="cal-day">4</div>
                <div className="cal-day has-event">5<div className="event-pip done"></div></div>
                <div className="cal-day">6</div>
                <div className="cal-day">7</div>
                <div className="cal-day has-event">8<div className="event-pip overdue"></div></div>
                <div className="cal-day has-event">9<div className="event-pip overdue"></div></div>
                <div className="cal-day has-event">10<div className="event-pip overdue"></div></div>
                <div className="cal-day">11</div>
                <div className="cal-day has-event">12<div className="event-pip overdue"></div></div>
                <div className="cal-day">13</div>
                <div className="cal-day">14</div>
                <div className="cal-day">15</div>
                <div className="cal-day">16</div>
                <div className="cal-day">17</div>
                <div className="cal-day">18</div>
                <div className="cal-day">19</div>
                <div className="cal-day">20</div>
                <div className="cal-day">21</div>
                <div className="cal-day">22</div>
                <div className="cal-day">23</div>
                <div className="cal-day">24</div>
                <div className="cal-day">25</div>
                <div className="cal-day">26</div>
                <div className="cal-day">27</div>
                <div className="cal-day today">28</div>
                <div className="cal-day has-event">29<div className="event-pip rebalanced"></div></div>
                <div className="cal-day has-event">30<div className="event-pip rebalanced"></div></div>
                <div className="cal-day faded has-event">1<div className="event-pip rebalanced"></div></div>
                <div className="cal-day faded has-event">2<div className="event-pip rebalanced"></div></div>
                <div className="cal-day faded">3</div>
                <div className="cal-day faded">4</div>
                <div className="cal-day faded">5</div>
              </div>
              <div className="demo-legend" style={{ display: "flex", gap: "16px", marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
                <div className="legend-item">
                  <div className="legend-swatch" style={{ background: "#dd0426" }}></div> Completed
                </div>
                <div className="legend-item">
                  <div className="legend-swatch" style={{ background: "#c0392b" }}></div> Missed
                </div>
                <div className="legend-item">
                  <div className="legend-swatch" style={{ background: "#f39c12" }}></div> Rebalanced
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section className="section" id="how">
        <div className="section-label">How it works</div>
        <h2 className="section-title">Three steps to staying on track</h2>
        <p className="section-sub">Rebi works with how you actually live — not the perfect schedule you planned on Sunday night.</p>
        <div className="steps">
          <div className="step-card">
            <div className="step-num">STEP 1</div>
            <div className="step-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
            </div>
            <div className="step-title">Create a calendar</div>
            <div className="step-desc">Give it a name, a start date, and a due date. Add your tasks or milestones — daily, weekly, or custom.</div>
          </div>
          <div className="step-card">
            <div className="step-num">STEP 2</div>
            <div className="step-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 3"/>
              </svg>
            </div>
            <div className="step-title">Work at your pace</div>
            <div className="step-desc">Check off what you finish. Skip a day — life happens. Rebi tracks what was done and what drifted.</div>
          </div>
          <div className="step-card">
            <div className="step-num">STEP 3</div>
            <div className="step-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
              </svg>
            </div>
            <div className="step-title">Hit Rebalance</div>
            <div className="step-desc">One click spreads everything you missed evenly across the days remaining before your due date. Your plan is fresh again.</div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="section" id="features" style={{ paddingTop: 0 }}>
        <div className="section-label">Features</div>
        <h2 className="section-title">Everything you need, nothing you don&apos;t</h2>
        <p className="section-sub">Built for people juggling multiple goals with real deadlines.</p>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </div>
            <div className="feature-title">Multiple calendars</div>
            <div className="feature-desc">Run a study plan, a fitness goal, and a work project side by side — each with its own timeline and due date.</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            </div>
            <div className="feature-title">Smart rebalancing</div>
            <div className="feature-desc">Missed items are redistributed evenly into your remaining days — never piled onto a single day before the deadline.</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div className="feature-title">Progress tracking</div>
            <div className="feature-desc">See exactly how far along you are on each calendar, day by day, with a clear visual of what's done and what's ahead.</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            </div>
            <div className="feature-title">Start &amp; due dates</div>
            <div className="feature-desc">Every calendar has a fixed window. Rebi always knows how many days are left to work with when rebalancing.</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
            </div>
            <div className="feature-title">Daily focus view</div>
            <div className="feature-desc">Open the app and see exactly what's on today's list — no digging, no scrolling through weeks of noise.</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"/></svg>
            </div>
            <div className="feature-title">Deadline awareness</div>
            <div className="feature-desc">Rebi warns you when you're falling too far behind to recover without rebalancing — before it's too late to catch up.</div>
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <div className="cta-band">
        <h2>Your next deadline is waiting.</h2>
        <p>Start building a calendar that bends to your life — not the other way around.</p>
        <button className="btn-hero" onClick={() => user ? router.push("/dashboard") : setShowSignup(true)}>
          {user ? "Go to Dashboard" : "Create your first calendar"}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>

      {/* FOOTER */}
      <footer className="welcome-footer">
        <a className="footer-logo" href="#">
          <svg width="22" height="22" viewBox="0 0 30 30" fill="none">
            <circle cx="15" cy="15" r="14" fill="#2f0505" stroke="#dd0426" strokeWidth="1.4"/>
            <path d="M9.5 20.5 L15 10 L20.5 20.5" stroke="#dd0426" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <path d="M11.5 17.5 H18.5" stroke="#dd0426" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          <span>Rebi<em>Calendar</em></span>
        </a>
        <span className="footer-copy">&copy; 2026 RebiCalendar. All rights reserved.</span>
        <div className="footer-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Contact</a>
        </div>
      </footer>

      {/* ── LOGIN MODAL ── */}
      {showLogin && (
        <div className="auth-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowLogin(false) }}>
          <div className="auth-card">
            <button className="auth-close" onClick={() => setShowLogin(false)}>&times;</button>
            <div className="auth-logo">
              <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                <circle cx="15" cy="15" r="14" fill="#2f0505" stroke="#dd0426" strokeWidth="1.4"/>
                <path d="M9.5 20.5 L15 10 L20.5 20.5" stroke="#dd0426" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <path d="M11.5 17.5 H18.5" stroke="#dd0426" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              <span className="auth-logo-text">Rebi<span>Calendar</span></span>
            </div>
            <h2 className="auth-heading">Welcome back</h2>
            <p className="auth-sub">Sign in to your account to continue</p>

            <button className="oauth-btn" onClick={() => supabase.auth.signInWithOAuth({ provider: "google" })}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="auth-divider">
              <div className="auth-divider-line"></div>
              <span className="auth-divider-text">or sign in with email</span>
              <div className="auth-divider-line"></div>
            </div>

            <div className="auth-field">
              <label>Email address</label>
              <input type="email" placeholder="you@example.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
            </div>
            <div className="auth-field">
              <div className="password-row">
                <label>Password</label>
                <button className="forgot-link" onClick={() => supabase.auth.resetPasswordForEmail(loginEmail)}>Forgot password?</button>
              </div>
              <div className="input-wrap">
                <input type={showLoginPw ? "text" : "password"} placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                <button className="toggle-pw" type="button" onClick={() => setShowLoginPw(!showLoginPw)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {showLoginPw
                      ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><path d="M1 1l22 22"/></>
                      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                    }
                  </svg>
                </button>
              </div>
            </div>

            {loginError && <p className="auth-error">{loginError}</p>}

            <button className="btn-submit" onClick={handleLogin} disabled={loginLoading}>
              {loginLoading ? "Signing in..." : "Sign in"}
            </button>

            <p className="auth-footer">
              Don&apos;t have an account? <button className="auth-link" onClick={() => { setShowLogin(false); setShowSignup(true) }}>Create one</button>
            </p>
            <p className="auth-terms">By signing in, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.</p>
          </div>
        </div>
      )}

      {/* ── SIGNUP MODAL ── */}
      {showSignup && (
        <div className="auth-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowSignup(false) }}>
          <div className="auth-card auth-card-wide">
            <button className="auth-close" onClick={() => setShowSignup(false)}>&times;</button>
            <div className="auth-logo">
              <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                <circle cx="15" cy="15" r="14" fill="#2f0505" stroke="#dd0426" strokeWidth="1.4"/>
                <path d="M9.5 20.5 L15 10 L20.5 20.5" stroke="#dd0426" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <path d="M11.5 17.5 H18.5" stroke="#dd0426" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              <span className="auth-logo-text">Rebi<span>Calendar</span></span>
            </div>
            <h2 className="auth-heading">Create your account</h2>
            <p className="auth-sub">Free forever — no credit card needed</p>

            <button className="oauth-btn" onClick={() => supabase.auth.signInWithOAuth({ provider: "google" })}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              Sign up with Google
            </button>

            <div className="auth-divider">
              <div className="auth-divider-line"></div>
              <span className="auth-divider-text">or sign up with email</span>
              <div className="auth-divider-line"></div>
            </div>

            <div className="name-row">
              <div className="auth-field">
                <label>First name</label>
                <input type="text" placeholder="Jane" value={signupFirstName} onChange={(e) => setSignupFirstName(e.target.value)} />
              </div>
              <div className="auth-field">
                <label>Last name</label>
                <input type="text" placeholder="Smith" value={signupLastName} onChange={(e) => setSignupLastName(e.target.value)} />
              </div>
            </div>

            <div className="auth-field">
              <label>Email address</label>
              <input type="email" placeholder="you@example.com" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} />
            </div>

            <div className="auth-field">
              <label>Password</label>
              <div className="input-wrap">
                <input type={showSignupPw ? "text" : "password"} placeholder="Min. 8 characters" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} />
                <button className="toggle-pw" type="button" onClick={() => setShowSignupPw(!showSignupPw)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {showSignupPw
                      ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><path d="M1 1l22 22"/></>
                      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                    }
                  </svg>
                </button>
              </div>
              <div className="strength-bar">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="strength-seg" style={{ background: i < pwScore ? pwColors[pwScore - 1] : "#252525" }}></div>
                ))}
              </div>
              <div className="strength-label" style={{ color: signupPassword.length === 0 ? "#555" : pwColors[pwScore - 1] }}>
                {signupPassword.length === 0 ? "" : pwLabels[pwScore - 1]}
              </div>
            </div>

            <div className="auth-field">
              <label>Confirm password</label>
              <div className="input-wrap">
                <input
                  type={showSignupConfirm ? "text" : "password"}
                  placeholder="Repeat your password"
                  value={signupConfirm}
                  onChange={(e) => setSignupConfirm(e.target.value)}
                  className={signupConfirm && signupPassword !== signupConfirm ? "error" : ""}
                />
                <button className="toggle-pw" type="button" onClick={() => setShowSignupConfirm(!showSignupConfirm)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {showSignupConfirm
                      ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><path d="M1 1l22 22"/></>
                      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                    }
                  </svg>
                </button>
              </div>
            </div>

            <div className="terms-row">
              <input type="checkbox" id="terms" checked={signupTerms} onChange={(e) => setSignupTerms(e.target.checked)} />
              <label htmlFor="terms" className="terms-text" style={{ margin: 0, fontSize: "12px", color: "#666" }}>
                I agree to the <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>
              </label>
            </div>

            {signupError && <p className="auth-error">{signupError}</p>}

            <button className="btn-submit" onClick={handleSignup} disabled={signupLoading}>
              {signupLoading ? "Creating account..." : "Create account"}
            </button>

            <p className="auth-footer">
              Already have an account? <button className="auth-link" onClick={() => { setShowSignup(false); setShowLogin(true) }}>Sign in</button>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
