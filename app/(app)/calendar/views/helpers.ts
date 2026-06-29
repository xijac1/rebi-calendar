export type SubjectTag = "p" | "bio" | "rc" | "math" | "gen"

export type Task = {
  id: string
  name: string
  tag: SubjectTag
  time: string
  start?: string
  done: boolean
}

export type TasksByDate = Record<string, Task[]>

export const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
export const SHORT_DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"]
export const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
export const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"]

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`
}

export function dateFromKey(key: string) {
  const [y,m,d] = key.split("-").map(Number)
  return new Date(y,m-1,d)
}

export function formatDateLabel(key: string) {
  const d = dateFromKey(key)
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export function isSameDate(a: Date, b: Date) {
  return a.getDate()===b.getDate() && a.getMonth()===b.getMonth() && a.getFullYear()===b.getFullYear()
}

export function parseDurationToMinutes(value: string) {
  const text = String(value||"").trim().toLowerCase()
  if (!text||text==="-") return null
  let mins = 0, matched = false
  const h = text.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b/)
  const m = text.match(/(\d+)\s*(m|min|mins|minute|minutes)\b/)
  if (h) { mins+=Number(h[1])*60; matched=true }
  if (m) { mins+=Number(m[1]); matched=true }
  if (!matched&&/^\d+$/.test(text)) { mins=Number(text); matched=true }
  return matched&&mins>0 ? Math.round(mins) : null
}

export function formatMinutes(mins: number) {
  const h = Math.floor(mins/60), m=mins%60
  if (h&&m) return `${h}h ${m}min`
  if (h) return `${h}h`
  return `${m}min`
}

export function tagLabel(tag: SubjectTag) {
  return {p:"P",bio:"BIO",rc:"RC",math:"MATH",gen:"GEN"}[tag]
}

export function tagClass(tag: SubjectTag) {
  return {p:"tag-p",bio:"tag-bio",rc:"tag-rc",math:"tag-math",gen:"tag-gen"}[tag]
}

export function tagColor(tag: SubjectTag) {
  return {p:"#8b7cf8",bio:"#4ade80",rc:"#38bdf8",math:"#fb923c",gen:"#f472b6"}[tag]
}

export function getWeekStart(date: Date) {
  const d = new Date(date); d.setDate(d.getDate()-d.getDay()); d.setHours(0,0,0,0)
  return d
}

export function computeTotalTime(dayTasks: Task[]) {
  const m = dayTasks.reduce((s,t)=>s+(parseDurationToMinutes(t.time)||0),0)
  return m?formatMinutes(m):null
}
