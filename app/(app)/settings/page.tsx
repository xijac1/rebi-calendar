"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"

type SettingsSection = "profile" | "api"

export default function SettingsPage() {
  const supabase = createClient()
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile")
  const [userEmail, setUserEmail] = useState("")
  const [userName, setUserName] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [nameInput, setNameInput] = useState("")
  const [avatarInput, setAvatarInput] = useState("")
  const [profileSaved, setProfileSaved] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [hasApiKey, setHasApiKey] = useState(false)
  const [apiSaved, setApiSaved] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserEmail(user.email ?? "")
      const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || ""
      const avatar = user.user_metadata?.avatar_url || ""
      setUserName(name)
      setAvatarUrl(avatar)
      setNameInput(name)
      setAvatarInput(avatar)
    })
  }, [])

  useEffect(() => {
    const existing = localStorage.getItem("groq_api_key")
    if (existing) {
      setApiKeyInput(existing)
      setHasApiKey(true)
    }
  }, [])

  async function handleSaveProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.auth.updateUser({
      data: {
        full_name: nameInput.trim(),
        avatar_url: avatarInput.trim(),
      },
    })
    await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email,
      display_name: nameInput.trim() || null,
      avatar_url: avatarInput.trim() || null,
    }, { onConflict: "id" })
    setUserName(nameInput.trim())
    setAvatarUrl(avatarInput.trim())
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2000)
  }

  const initial = userName?.charAt(0).toUpperCase() || "?"

  const sections: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
    {
      id: "profile",
      label: "Profile",
      icon: (
        <div className="settings-nav-avatar">{initial}</div>
      ),
    },
    {
      id: "api",
      label: "Add API",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
        </svg>
      ),
    },
  ]

  return (
    <div className="settings-layout">
      <aside className="settings-nav">
        <div className="settings-nav-header">Settings</div>
        {sections.map((s) => (
          <button
            key={s.id}
            className={`settings-nav-btn${activeSection === s.id ? " active" : ""}`}
            onClick={() => setActiveSection(s.id)}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </aside>
      <div className="settings-content">
        {activeSection === "profile" && (
          <div className="settings-profile-page">
            <h2>Profile</h2>
            <p className="settings-profile-desc">Manage your personal information and how it appears across the app.</p>
            <div className="settings-profile-avatar-section">
              <div className="settings-profile-avatar">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="settings-profile-img" />
                ) : (
                  <span>{initial}</span>
                )}
              </div>
              <div className="settings-profile-avatar-info">
                <div className="settings-profile-name-display">{userName || "User"}</div>
                <div className="settings-profile-email-display">{userEmail}</div>
              </div>
            </div>
            <div className="settings-profile-field">
              <label htmlFor="profile-name">Display Name</label>
              <input
                id="profile-name"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="settings-profile-field">
              <label htmlFor="profile-email">Email</label>
              <input
                id="profile-email"
                type="text"
                value={userEmail}
                disabled
                className="settings-profile-email-input"
              />
            </div>
            <div className="settings-profile-field">
              <label htmlFor="profile-avatar">Avatar URL</label>
              <input
                id="profile-avatar"
                type="text"
                value={avatarInput}
                onChange={(e) => setAvatarInput(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
              />
            </div>
            <div className="settings-profile-actions">
              <button className="btn-primary" onClick={handleSaveProfile}>
                Save Changes
              </button>
              {profileSaved && <span className="settings-profile-success">Profile updated.</span>}
            </div>
          </div>
        )}
        {activeSection === "api" && (
          <div className="settings-api-page">
            <h2>API Keys</h2>
            <p className="settings-api-desc">Add your Groq API key to enable AI-powered features like study schedule rebalancing.</p>
            <div className="settings-api-field">
              <label htmlFor="api-key">Groq API Key</label>
              <input
                id="api-key"
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="gsk_..."
              />
            </div>
            <div className="settings-api-actions">
              <button
                className="btn-primary"
                onClick={() => {
                  localStorage.setItem("groq_api_key", apiKeyInput.trim())
                  setHasApiKey(true)
                  setApiSaved(true)
                  setTimeout(() => setApiSaved(false), 2000)
                }}
              >
                {hasApiKey ? "Update Key" : "Save Key"}
              </button>
              {apiKeyInput && (
                <button
                  className="btn"
                  onClick={() => {
                    localStorage.removeItem("groq_api_key")
                    setApiKeyInput("")
                    setHasApiKey(false)
                  }}
                >
                  Remove Key
                </button>
              )}
            </div>
            {apiSaved && <p className="settings-api-success">API key saved successfully.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
