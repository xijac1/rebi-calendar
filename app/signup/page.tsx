"use client"

import { useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"

export default function SignupPage() {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [terms, setTerms] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  function scorePassword(pw: string) {
    let score = 0
    if (pw.length >= 8) score++
    if (pw.length >= 12) score++
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    return Math.min(4, Math.max(0, Math.round(score * 4 / 5)))
  }

  const pwScore = password.length === 0 ? 0 : Math.max(1, scorePassword(password))
  const pwColors = ["#c0392b", "#e67e22", "#f1c40f", "#dd0426"]
  const pwLabels = ["Weak", "Fair", "Good", "Strong"]

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName || !lastName || !email || !password || !confirm) return
    if (password !== confirm) return setError("Passwords do not match")
    if (!terms) return setError("You must agree to the terms")
    setLoading(true)
    setError("")
    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) return setError(error.message)
    router.push("/dashboard")
  }

  return (
    <div className="auth-full-page">
      <div className="auth-card auth-card-wide">
        <div className="auth-logo">
          <img src="/rebi_logo.png" alt="Rebi" width="30" height="30" />
          <span className="auth-logo-text">Rebi<span>Calendar</span></span>
        </div>
        <h2 className="auth-heading">Create your account</h2>
        <p className="auth-sub">Free forever — no credit card needed</p>

        <form onSubmit={handleSignup}>
          <div className="name-row">
            <div className="auth-field">
              <label>First name</label>
              <input type="text" placeholder="Jane" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="auth-field">
              <label>Last name</label>
              <input type="text" placeholder="Smith" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>

          <div className="auth-field">
            <label>Email address</label>
            <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="auth-field">
            <label>Password</label>
            <div className="input-wrap">
              <input
                type={showPw ? "text" : "password"}
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button className="toggle-pw" type="button" onClick={() => setShowPw(!showPw)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {showPw
                    ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><path d="M1 1l22 22"/></>
                    : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                  }
                </svg>
              </button>
            </div>
            <div className="strength-bar">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="strength-seg" style={{ background: i < pwScore ? pwColors[pwScore - 1] : "#252525" }} />
              ))}
            </div>
            <div className="strength-label" style={{ color: password.length === 0 ? "#555" : pwColors[pwScore - 1] }}>
              {password.length === 0 ? "" : pwLabels[pwScore - 1]}
            </div>
          </div>

          <div className="auth-field">
            <label>Confirm password</label>
            <div className="input-wrap">
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Repeat your password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={confirm && password !== confirm ? "error" : ""}
                required
              />
              <button className="toggle-pw" type="button" onClick={() => setShowConfirm(!showConfirm)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {showConfirm
                    ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><path d="M1 1l22 22"/></>
                    : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                  }
                </svg>
              </button>
            </div>
          </div>

          <div className="terms-row">
            <input type="checkbox" id="terms" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            <label htmlFor="terms" className="terms-text" style={{ margin: 0, fontSize: "12px", color: "#666" }}>
              I agree to the <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>
            </label>
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button className="btn-submit" type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{" "}
          <button className="auth-link" onClick={() => router.push("/login")}>
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}
