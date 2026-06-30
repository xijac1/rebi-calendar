"use client";

import { useEffect, useMemo, useState } from "react";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const DEFAULT_EXAM_DATE = "2026-09-30";
const SCHEDULE_START_DATE = "2026-05-11";

type SubjectTag = "p" | "bio" | "rc" | "math";
type ViewMode = "weekly" | "daily" | "monthly";
type RebalanceView = "clean" | "detailed" | "compact";

type Task = {
  id: number;
  name: string;
  tag: SubjectTag;
  time: string;
  done: boolean;
};

type TasksByDate = Record<string, Task[]>;

type PlannedTask = Task & {
  originalDate: string;
  minutes: number;
};

type DayLoad = {
  key: string;
  minutes: number;
  tasks: PlannedTask[];
};

type RebalancePlan =
  | { error: string }
  | {
      unfinished: PlannedTask[];
      studyDays: string[];
      dayLoads: DayLoad[];
      totalMinutes: number;
      maxDayMinutes: number;
    };

const initialTasks: TasksByDate = {
  "2026-06-27": [
    {
      id: 1,
      name: "Energy & Momentum Videos (5.1-5.4)",
      tag: "p",
      time: "1h",
      done: false,
    },
    {
      id: 2,
      name: "Energy & Momentum Qbank",
      tag: "p",
      time: "25min",
      done: false,
    },
    { id: 3, name: "Bio Bits", tag: "bio", time: "30min", done: false },
    {
      id: 4,
      name: "Extra Reading Comprehension #1",
      tag: "rc",
      time: "20min",
      done: false,
    },
    {
      id: 5,
      name: "Photosynthesis Videos (6.1-6.4)",
      tag: "bio",
      time: "1h",
      done: false,
    },
  ],
  "2026-06-23": [
    { id: 6, name: "Kinematics Qbank", tag: "p", time: "45min", done: true },
  ],
};

function getWeekStart(date: Date) {
  const day = new Date(date);
  const dow = day.getDay();
  day.setDate(day.getDate() - dow);
  day.setHours(0, 0, 0, 0);
  return day;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateLabel(key: string) {
  const date = dateFromKey(key);
  return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function isSameDate(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

function parseDurationToMinutes(value: string) {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  if (!text || text === "-") return null;

  let mins = 0;
  let matched = false;
  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b/);
  const minMatch = text.match(/(\d+)\s*(m|min|mins|minute|minutes)\b/);

  if (hourMatch) {
    mins += Number(hourMatch[1]) * 60;
    matched = true;
  }
  if (minMatch) {
    mins += Number(minMatch[1]);
    matched = true;
  }
  if (!matched && /^\d+$/.test(text)) {
    mins = Number(text);
    matched = true;
  }

  return matched && mins > 0 ? Math.round(mins) : null;
}

function formatMinutes(mins: number) {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  if (hours && minutes) return `${hours}h ${minutes}min`;
  if (hours) return `${hours}h`;
  return `${minutes}min`;
}

function tagLabel(tag: SubjectTag) {
  return { p: "P", bio: "BIO", rc: "RC", math: "MATH" }[tag];
}

function tagClass(tag: SubjectTag) {
  return { p: "tag-p", bio: "tag-bio", rc: "tag-rc", math: "tag-math" }[
    tag
  ];
}

function computeTotalTime(dayTasks: Task[]) {
  const mins = dayTasks.reduce(
    (sum, task) => sum + (parseDurationToMinutes(task.time) || 0),
    0,
  );
  return mins ? formatMinutes(mins) : null;
}

function getEligibleStudyDays(startKey: string, examKey: string, daysOff: Set<string>) {
  const start = dateFromKey(startKey);
  const exam = dateFromKey(examKey);
  const dates: string[] = [];

  for (const day = new Date(start); day <= exam; day.setDate(day.getDate() + 1)) {
    const key = dateKey(day);
    if (!daysOff.has(key)) dates.push(key);
  }

  return dates;
}

function getUnfinishedTasks(tasks: TasksByDate) {
  return Object.entries(tasks)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([key, dayTasks]) =>
      dayTasks
        .filter((task) => !task.done)
        .map((task) => ({
          ...task,
          originalDate: key,
          minutes: parseDurationToMinutes(task.time),
        })),
    );
}

function buildBalancedPlan(
  tasks: TasksByDate,
  startKey: string,
  examKey: string,
  daysOff: Set<string>,
): RebalancePlan {
  const unfinished = getUnfinishedTasks(tasks);
  const invalidTasks = unfinished.filter((task) => !task.minutes);
  const studyDays = getEligibleStudyDays(startKey, examKey, daysOff);

  if (!studyDays.length) {
    return { error: "No study days are available between the selected dates." };
  }
  if (invalidTasks.length) {
    return { error: "Every unfinished task needs a valid duration before rebalancing." };
  }

  const dayLoads: DayLoad[] = studyDays.map((key) => ({
    key,
    minutes: 0,
    tasks: [],
  }));

  [...unfinished]
    .map((task) => ({ ...task, minutes: task.minutes as number }))
    .sort(
      (a, b) =>
        b.minutes - a.minutes || a.originalDate.localeCompare(b.originalDate),
    )
    .forEach((task) => {
      dayLoads.sort((a, b) => a.minutes - b.minutes || a.key.localeCompare(b.key));
      dayLoads[0].tasks.push(task);
      dayLoads[0].minutes += task.minutes;
    });

  dayLoads.sort((a, b) => a.key.localeCompare(b.key));

  const totalMinutes = unfinished.reduce(
    (sum, task) => sum + (task.minutes || 0),
    0,
  );
  const maxDayMinutes = Math.max(0, ...dayLoads.map((day) => day.minutes));

  return {
    unfinished: unfinished.map((task) => ({
      ...task,
      minutes: task.minutes as number,
    })),
    studyDays,
    dayLoads,
    totalMinutes,
    maxDayMinutes,
  };
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 4v6h6" />
      <path d="M23 20v-6h-6" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2">
      <polyline points="1.5,5 4,7.5 8.5,2.5" />
    </svg>
  );
}

export default function ScheduleApp() {
  const [tasks, setTasks] = useState<TasksByDate>(initialTasks);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const [addingToDay, setAddingToDay] = useState<string | null>(null);
  const [taskName, setTaskName] = useState("");
  const [taskTag, setTaskTag] = useState<SubjectTag>("p");
  const [taskTime, setTaskTime] = useState("");
  const [daysOff, setDaysOff] = useState<Set<string>>(() => new Set());
  const [dayOffInput, setDayOffInput] = useState("");
  const [selectedRebalanceView, setSelectedRebalanceView] =
    useState<RebalanceView>("detailed");
  const [rebalanceOpen, setRebalanceOpen] = useState(false);
  const [rebalanceStartDate, setRebalanceStartDate] = useState(() => dateKey(new Date()));
  const [rebalanceExamDate, setRebalanceExamDate] = useState(DEFAULT_EXAM_DATE);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState("");

  const today = useMemo(() => new Date(), []);
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const day = new Date(currentWeekStart);
        day.setDate(day.getDate() + index);
        return day;
      }),
    [currentWeekStart],
  );

  const weekNum = useMemo(() => {
    const start = dateFromKey(SCHEDULE_START_DATE);
    const diff = Math.floor((currentWeekStart.getTime() - start.getTime()) / (7 * 86400000));
    return Math.max(1, diff + 1);
  }, [currentWeekStart]);

  const progress = useMemo(() => {
    const allTasks = Object.values(tasks).flat();
    const done = allTasks.filter((task) => task.done).length;
    const pct = allTasks.length ? (done / allTasks.length) * 100 : 0;
    return { done, total: allTasks.length, pct };
  }, [tasks]);

  const daysUntilExam = useMemo(() => {
    const diff = Math.ceil((dateFromKey(DEFAULT_EXAM_DATE).getTime() - today.getTime()) / 86400000);
    return Math.max(0, diff);
  }, [today]);

  const rebalancePlan = useMemo(() => {
    if (
      !rebalanceStartDate ||
      !rebalanceExamDate ||
      dateFromKey(rebalanceStartDate) > dateFromKey(rebalanceExamDate)
    ) {
      return null;
    }

    return buildBalancedPlan(tasks, rebalanceStartDate, rebalanceExamDate, daysOff);
  }, [daysOff, rebalanceExamDate, rebalanceStartDate, tasks]);

  const previewText = useMemo(() => {
    if (
      !rebalanceStartDate ||
      !rebalanceExamDate ||
      dateFromKey(rebalanceStartDate) > dateFromKey(rebalanceExamDate)
    ) {
      return "Choose a valid start and exam date to preview your balanced workload.";
    }
    if (!rebalancePlan) return "Select dates to preview your balanced workload.";
    if ("error" in rebalancePlan) return rebalancePlan.error;
    if (!rebalancePlan.unfinished.length) {
      return "All tasks are complete. There is nothing to rebalance.";
    }

    const avg = Math.ceil(rebalancePlan.totalMinutes / rebalancePlan.studyDays.length);
    return `After rebalancing, ${rebalancePlan.unfinished.length} unfinished tasks will be spread across ${rebalancePlan.studyDays.length} study days at about ${formatMinutes(avg)} per day. Heaviest day: ${formatMinutes(rebalancePlan.maxDayMinutes)}.`;
  }, [rebalanceExamDate, rebalancePlan, rebalanceStartDate]);

  const previewTasks =
    rebalancePlan && !("error" in rebalancePlan)
      ? rebalancePlan.dayLoads.filter((day) => day.tasks.length).slice(0, 4)
      : [];

  function showToast(message: string) {
    setToast(message);
  }

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAddingToDay(null);
        setSettingsOpen(false);
        setRebalanceOpen(false);
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, []);

  function openRebalanceModal() {
    setRebalanceStartDate(dateKey(new Date()));
    setRebalanceExamDate(DEFAULT_EXAM_DATE);
    setRebalanceOpen(true);
  }

  function addDayOff() {
    if (!dayOffInput) return;
    setDaysOff((current) => new Set(current).add(dayOffInput));
    setDayOffInput("");
  }

  function removeDayOff(key: string) {
    setDaysOff((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }

  function applyRebalance() {
    if (
      !rebalanceStartDate ||
      !rebalanceExamDate ||
      dateFromKey(rebalanceStartDate) > dateFromKey(rebalanceExamDate)
    ) {
      showToast("Choose a valid date range");
      return;
    }

    const plan = buildBalancedPlan(tasks, rebalanceStartDate, rebalanceExamDate, daysOff);
    if ("error" in plan) {
      showToast(plan.error);
      return;
    }
    if (!plan.unfinished.length) {
      showToast("No unfinished tasks to rebalance");
      return;
    }

    setTasks((current) => {
      const next: TasksByDate = {};

      Object.entries(current).forEach(([key, dayTasks]) => {
        const completed = dayTasks.filter((task) => task.done);
        if (completed.length) next[key] = completed;
      });

      plan.dayLoads.forEach((day) => {
        if (!day.tasks.length) return;
        next[day.key] = next[day.key] || [];
        day.tasks.forEach(({ originalDate, minutes, ...task }) => {
          next[day.key].push(task);
        });
      });

      return next;
    });
    setCurrentWeekStart(getWeekStart(dateFromKey(rebalanceStartDate)));
    setRebalanceOpen(false);
    showToast(`Rebalanced ${plan.unfinished.length} tasks`);
  }

  function openModal(dayKey: string) {
    setAddingToDay(dayKey);
    setTaskName("");
    setTaskTag("p");
    setTaskTime("");
  }

  function saveTask() {
    const name = taskName.trim();
    const time = taskTime.trim();

    if (!addingToDay || !name) return;
    if (!parseDurationToMinutes(time)) {
      showToast("Enter a valid duration like 1h or 25min");
      return;
    }

    setTasks((current) => {
      const nextId =
        Math.max(0, ...Object.values(current).flat().map((task) => task.id)) + 1;
      return {
        ...current,
        [addingToDay]: [
          ...(current[addingToDay] || []),
          { id: nextId, name, tag: taskTag, time, done: false },
        ],
      };
    });
    setAddingToDay(null);
    showToast("Task added");
  }

  function toggleTask(dayKey: string, id: number) {
    setTasks((current) => ({
      ...current,
      [dayKey]: (current[dayKey] || []).map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    }));
  }

  function changeView(view: ViewMode) {
    showToast(`${view.charAt(0).toUpperCase() + view.slice(1)} view - coming soon!`);
  }

  return (
    <main className="schedule-app">
      <div className="topbar">
        <h1>Study Schedule</h1>
        <div className="topbar-actions">
          <button className="btn" onClick={openRebalanceModal} type="button">
            <RefreshIcon />
            Rebalance
          </button>
          <button className="btn" onClick={() => setSettingsOpen(true)} type="button">
            <SettingsIcon />
            Settings
          </button>
        </div>
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Custom Schedule</div>
            <div className="card-subtitle">Schedule Range: May 11 to September 30</div>
          </div>
          <div className="view-controls">
            <select
              className="view-select"
              defaultValue="weekly"
              onChange={(event) => changeView(event.target.value as ViewMode)}
            >
              <option value="weekly">Weekly View</option>
              <option value="daily">Daily View</option>
              <option value="monthly">Monthly View</option>
            </select>
            <button
              className="nav-btn"
              onClick={() =>
                setCurrentWeekStart((current) => {
                  const next = new Date(current);
                  next.setDate(next.getDate() - 7);
                  return next;
                })
              }
              type="button"
            >
              {"<"}
            </button>
            <button
              className="today-btn"
              onClick={() => setCurrentWeekStart(getWeekStart(new Date()))}
              type="button"
            >
              Today
            </button>
            <button
              className="nav-btn"
              onClick={() =>
                setCurrentWeekStart((current) => {
                  const next = new Date(current);
                  next.setDate(next.getDate() + 7);
                  return next;
                })
              }
              type="button"
            >
              {">"}
            </button>
          </div>
        </div>

        <div className="progress-row">
          <div className="progress-left">
            <div className="progress-label">
              {progress.done}/{progress.total} tasks completed
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress.pct}%` }} />
            </div>
          </div>
          <div className="progress-days">{daysUntilExam} days until exam</div>
        </div>

        <div className="phase-banner">Phase 1</div>

        <div className="calendar-outer">
          <div className="calendar-grid">
            <div className="col-spacer" />
            {days.map((day) => (
              <div
                className={`col-header${isSameDate(day, today) ? " today" : ""}`}
                key={dateKey(day)}
              >
                <div className="col-date">
                  {SHORT_MONTHS[day.getMonth()]} {day.getDate()}
                </div>
                <div className="col-day">{DAYS[day.getDay()]}</div>
              </div>
            ))}

            <div className="row-label">
              <span className="row-label-text">Week {weekNum}</span>
            </div>

            {days.map((day) => {
              const key = dateKey(day);
              const dayTasks = tasks[key] || [];
              const total = computeTotalTime(dayTasks);

              return (
                <div
                  className={`day-cell${isSameDate(day, today) ? " today" : ""}`}
                  key={key}
                >
                  {dayTasks.map((task) => (
                    <div className={`task-card${task.done ? " done" : ""}`} key={task.id}>
                      <div className="task-top">
                        <button
                          className="task-check"
                          onClick={() => toggleTask(key, task.id)}
                          type="button"
                          aria-label={task.done ? "Mark task incomplete" : "Mark task complete"}
                        >
                          <CheckIcon />
                        </button>
                        <div className="task-name">{task.name}</div>
                      </div>
                      <div className="task-footer">
                        <span className={`task-tag ${tagClass(task.tag)}`}>
                          {tagLabel(task.tag)}
                        </span>
                        <span className="task-time">{task.time}</span>
                      </div>
                    </div>
                  ))}

                  <button
                    className="add-task-btn"
                    onClick={() => openModal(key)}
                    type="button"
                    aria-label={`Add task for ${formatDateLabel(key)}`}
                  >
                    +
                  </button>
                  {total ? <div className="day-total">Total Time: {total}</div> : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div
        className={`modal-overlay rebalance-overlay${rebalanceOpen ? " open" : ""}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) setRebalanceOpen(false);
        }}
      >
        <div className="rebalance-modal">
          <div className="rebalance-header">
            <h3>Rebalance Study Schedule</h3>
            <button
              className="icon-close"
              onClick={() => setRebalanceOpen(false)}
              type="button"
              aria-label="Close rebalance dialog"
            >
              &times;
            </button>
          </div>
          <div className="rebalance-body">
            <div className="rebalance-form">
              <section className="rebalance-section">
                <h4>Select Dates</h4>
                <label htmlFor="rebalance-start-date">Start Date</label>
                <input
                  id="rebalance-start-date"
                  type="date"
                  value={rebalanceStartDate}
                  onChange={(event) => setRebalanceStartDate(event.target.value)}
                />
                <label htmlFor="rebalance-exam-date">Exam Date</label>
                <input
                  id="rebalance-exam-date"
                  type="date"
                  value={rebalanceExamDate}
                  onChange={(event) => setRebalanceExamDate(event.target.value)}
                />
                <label htmlFor="rebalance-day-off">Select Days Off</label>
                <div className="date-add-row">
                  <input
                    id="rebalance-day-off"
                    type="date"
                    value={dayOffInput}
                    onChange={(event) => setDayOffInput(event.target.value)}
                  />
                  <button className="small-btn" onClick={addDayOff} type="button">
                    Add
                  </button>
                </div>
                <div className="day-off-list">
                  {[...daysOff].sort().map((key) => (
                    <span className="day-off-chip" key={key}>
                      {formatDateLabel(key)}
                      <button
                        type="button"
                        aria-label={`Remove ${formatDateLabel(key)}`}
                        onClick={() => removeDayOff(key)}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              </section>
              <section className="rebalance-section">
                <h4>Select View</h4>
                <div className="view-card-grid">
                  {(["clean", "detailed", "compact"] as RebalanceView[]).map((view) => (
                    <button
                      className={`view-card${selectedRebalanceView === view ? " selected" : ""}`}
                      key={view}
                      onClick={() => setSelectedRebalanceView(view)}
                      type="button"
                    >
                      <span
                        className={`view-card-lines${
                          view === "detailed" || view === "compact" ? ` ${view}` : ""
                        }`}
                      />
                      <strong>{view.charAt(0).toUpperCase() + view.slice(1)}</strong>
                      <span>
                        {view === "clean" ? "Default" : view === "detailed" ? "Balanced" : "Dense"}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
              <button
                className="btn-primary rebalance-submit"
                onClick={applyRebalance}
                type="button"
              >
                Rebalance Study Schedule
              </button>
            </div>
            <div className="rebalance-preview">
              <div className="preview-board">
                {previewTasks.map((day) => (
                  <div className="preview-task" key={day.key}>
                    <strong>{day.tasks[0].name}</strong>
                    <span>
                      {formatDateLabel(day.key)} - {formatMinutes(day.minutes)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="preview-copy">
                <h4>Schedule Preview</h4>
                <p>{previewText}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`modal-overlay${addingToDay ? " open" : ""}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) setAddingToDay(null);
        }}
      >
        <div className="modal">
          <h3>Add Task</h3>
          <label htmlFor="modal-task-name">Task Name</label>
          <input
            id="modal-task-name"
            type="text"
            value={taskName}
            onChange={(event) => setTaskName(event.target.value)}
            placeholder="e.g. Energy & Momentum Videos"
          />
          <label htmlFor="modal-task-tag">Subject</label>
          <select
            id="modal-task-tag"
            value={taskTag}
            onChange={(event) => setTaskTag(event.target.value as SubjectTag)}
          >
            <option value="p">Physics (P)</option>
            <option value="bio">Biology (BIO)</option>
            <option value="rc">Reading Comp (RC)</option>
            <option value="math">Math</option>
          </select>
          <label htmlFor="modal-task-time">Duration</label>
          <input
            id="modal-task-time"
            type="text"
            value={taskTime}
            onChange={(event) => setTaskTime(event.target.value)}
            placeholder="e.g. 1h or 25min"
            required
          />
          <div className="modal-actions">
            <button className="btn-cancel" onClick={() => setAddingToDay(null)} type="button">
              Cancel
            </button>
            <button className="btn-primary" onClick={saveTask} type="button">
              Add Task
            </button>
          </div>
        </div>
      </div>

      <aside className={`settings-panel${settingsOpen ? " open" : ""}`}>
        <button
          className="settings-close"
          onClick={() => setSettingsOpen(false)}
          type="button"
          aria-label="Close settings"
        >
          &times;
        </button>
        <h3>Settings</h3>
        <div className="settings-row">
          <label htmlFor="settings-name">Schedule Name</label>
          <input id="settings-name" type="text" defaultValue="Custom Schedule" />
        </div>
        <div className="settings-row">
          <label htmlFor="settings-start-date">Start Date</label>
          <input id="settings-start-date" type="date" defaultValue="2026-05-11" />
        </div>
        <div className="settings-row">
          <label htmlFor="settings-end-date">End Date</label>
          <input id="settings-end-date" type="date" defaultValue="2026-09-30" />
        </div>
        <div className="settings-row">
          <label htmlFor="settings-exam-date">Exam Date</label>
          <input id="settings-exam-date" type="date" defaultValue="2026-09-30" />
        </div>
        <div className="settings-row">
          <label htmlFor="settings-default-view">Default View</label>
          <select id="settings-default-view" defaultValue="Weekly View">
            <option>Weekly View</option>
            <option>Daily View</option>
            <option>Monthly View</option>
          </select>
        </div>
        <div className="settings-actions">
          <button
            className="btn-primary settings-save"
            onClick={() => {
              setSettingsOpen(false);
              showToast("Settings saved");
            }}
            type="button"
          >
            Save Settings
          </button>
        </div>
      </aside>

      <div className={`toast${toast ? " show" : ""}`}>{toast}</div>
    </main>
  );
}
