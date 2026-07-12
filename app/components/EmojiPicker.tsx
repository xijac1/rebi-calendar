"use client"

import { useState, useRef, useEffect } from "react"

const EMOJIS = [
  "📅", "📆", "🗓️", "📚", "📖", "🎓", "📝", "✏️",
  "🎯", "⭐", "🔥", "💪", "✅", "📊", "📈", "🏆",
  "💡", "🎨", "🎵", "🎮", "🏁", "🚀", "🎉", "💻",
  "📁", "🗂️", "🔬", "🧪", "📐", "🎒", "🏋️", "🧠",
]

type Props = {
  value: string
  onChange: (emoji: string) => void
  triggerClass?: string
}

export default function EmojiPicker({ value, onChange, triggerClass }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div className="emoji-picker-wrap" ref={ref}>
      <button
        type="button"
        className={`emoji-picker-trigger${triggerClass ? ` ${triggerClass}` : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        {value || "📅"}
      </button>
      {open && (
        <div className="emoji-picker-dropdown">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={`emoji-picker-option${emoji === value ? " selected" : ""}`}
              onClick={() => { onChange(emoji); setOpen(false) }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
