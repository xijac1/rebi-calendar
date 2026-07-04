export type SubjectTag = string

export type Task = {
  id: string
  name: string
  tag: SubjectTag
  time: string
  start?: string
  done: boolean
  calendarId?: string
  calendarName?: string
  calendarColor?: string
  description?: string
  order?: number
}

export type TasksByDate = Record<string, Task[]>

export const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
export const SHORT_DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
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

const TAG_COLORS = ["#8b7cf8","#dd0426","#38bdf8","#fb923c","#f472b6","#22c55e","#06b6d4","#eab308","#a855f7","#14b8a6"]
const TAG_LABELS: Record<string,string> = {p:"P",bio:"BIO",rc:"RC",math:"MATH",gen:"GEN"}

function hashTag(tag: string) {
  let h = 0
  for (let i = 0; i < tag.length; i++) h = ((h << 5) - h) + tag.charCodeAt(i), h |= 0
  return Math.abs(h)
}

export function tagLabel(tag: SubjectTag) {
  return TAG_LABELS[tag] || tag.slice(0, 3).toUpperCase()
}

export function tagClass(tag: SubjectTag) {
  const known = ["p","bio","rc","math","gen"]
  return known.includes(tag) ? `tag-${tag}` : ""
}

export function tagColor(tag: SubjectTag) {
  const builtin: Record<string,string> = {p:"#8b7cf8",bio:"#dd0426",rc:"#38bdf8",math:"#fb923c",gen:"#f472b6"}
  return builtin[tag] || TAG_COLORS[hashTag(tag) % TAG_COLORS.length]
}

export function getWeekStart(date: Date) {
  const d = new Date(date); d.setDate(d.getDate()-d.getDay()); d.setHours(0,0,0,0)
  return d
}

export function computeTotalTime(dayTasks: Task[]) {
  const m = dayTasks.reduce((s,t)=>s+(parseDurationToMinutes(t.time)||0),0)
  return m?formatMinutes(m):null
}
