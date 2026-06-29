"use client"

import { useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSignIn() {
    setLoading(true)
    setError("")
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) return setError(error.message)
    router.push("/dashboard")
  }

  async function handleSignUp() {
    setLoading(true)
    setError("")
    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) return setError(error.message)
    router.push("/dashboard")
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Sign In</h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="login-error">{error}</p>}
        <div className="login-actions">
          <button onClick={handleSignIn} disabled={loading}>
            {loading ? "Loading..." : "Sign In"}
          </button>
          <button onClick={handleSignUp} disabled={loading}>
            {loading ? "Loading..." : "Sign Up"}
          </button>
        </div>
      </div>
    </div>
  )
}