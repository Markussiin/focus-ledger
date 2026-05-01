export const DEFAULT_STATE = Object.freeze({
  version: 1,
  settings: {
    focusLength: 25,
    dailyGoal: 120
  },
  projects: [
    { id: "deep-work", name: "Deep Work", color: "#2563eb", weeklyTarget: 420 },
    { id: "learning", name: "Learning", color: "#0f766e", weeklyTarget: 240 }
  ],
  sessions: []
});

export function createSession(input, now = new Date()) {
  const minutes = Number(input.minutes);
  const projectId = normalizeId(input.projectId);

  if (!projectId) {
    throw new Error("Project is required");
  }

  if (!Number.isFinite(minutes) || minutes < 1) {
    throw new Error("Minutes must be a positive number");
  }

  return {
    id: normalizeId(input.id) || cryptoSafeId("session", now),
    projectId,
    date: normalizeDateKey(input.date, now),
    minutes: Math.round(minutes),
    energy: input.energy ?? "steady",
    note: cleanText(input.note),
    distractions: parseDistractions(input.distractions),
    createdAt: input.createdAt ?? now.toISOString()
  };
}

export function createProject(input, now = new Date()) {
  const name = cleanText(input.name);
  const weeklyTarget = Number(input.weeklyTarget ?? 300);

  if (!name) {
    throw new Error("Project name is required");
  }

  if (!Number.isFinite(weeklyTarget) || weeklyTarget < 0) {
    throw new Error("Weekly target must be a positive number");
  }

  return {
    id: normalizeId(input.id) || slugify(`${name}-${now.getTime()}`),
    name,
    color: normalizeColor(input.color, "#2563eb"),
    weeklyTarget: Math.round(weeklyTarget)
  };
}

export function normalizeState(value) {
  const base = clone(DEFAULT_STATE);
  const state = value && typeof value === "object" ? value : {};

  return {
    version: 1,
    settings: {
      ...base.settings,
      ...(state.settings ?? {})
    },
    projects: Array.isArray(state.projects) && state.projects.length > 0 ? state.projects.map(normalizeProject) : base.projects,
    sessions: Array.isArray(state.sessions) ? state.sessions.map(normalizeSession).filter(Boolean) : []
  };
}

export function buildAnalytics(state, options = {}) {
  const today = options.today ?? new Date();
  const days = Number(options.days ?? 7);
  const projects = new Map(state.projects.map((project) => [project.id, project]));
  const range = buildDateRange(today, days);
  const rangeSet = new Set(range.map((item) => item.date));
  const rangeSessions = state.sessions.filter((session) => rangeSet.has(session.date));
  const totalMinutes = sum(rangeSessions.map((session) => session.minutes));
  const todayMinutes = sum(state.sessions.filter((session) => session.date === toDateKey(today)).map((session) => session.minutes));
  const projectTotals = summarizeProjects(rangeSessions, projects);
  const distractions = summarizeDistractions(rangeSessions);
  const dailySeries = range.map((item) => ({
    ...item,
    minutes: sum(rangeSessions.filter((session) => session.date === item.date).map((session) => session.minutes))
  }));

  return {
    days,
    totalMinutes,
    todayMinutes,
    dailyGoal: state.settings.dailyGoal,
    goalProgress: state.settings.dailyGoal > 0 ? Math.min(todayMinutes / state.settings.dailyGoal, 1) : 0,
    averageMinutes: Math.round(totalMinutes / days),
    streak: calculateStreak(state.sessions, today),
    projectTotals,
    distractions,
    dailySeries,
    recentSessions: [...state.sessions]
      .sort((left, right) => `${right.date}-${right.createdAt}`.localeCompare(`${left.date}-${left.createdAt}`))
      .slice(0, 8)
      .map((session) => ({
        ...session,
        project: projects.get(session.projectId) ?? { name: "Unknown", color: "#64748b" }
      }))
  };
}

export function calculateStreak(sessions, today = new Date()) {
  const activeDates = new Set(sessions.filter((session) => session.minutes > 0).map((session) => session.date));
  let cursor = new Date(today);
  let streak = 0;

  while (activeDates.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) {
    return `${remainder}m`;
  }

  if (remainder === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainder}m`;
}

export function toDateKey(date) {
  const copy = new Date(date);
  const year = copy.getFullYear();
  const month = String(copy.getMonth() + 1).padStart(2, "0");
  const day = String(copy.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function sampleState(today = new Date()) {
  const state = normalizeState(DEFAULT_STATE);
  const projectIds = state.projects.map((project) => project.id);
  const notes = ["Planning sprint work", "Writing implementation notes", "Refactoring dashboard flow", "Reviewing product ideas"];
  const distractions = [["Slack"], ["Phone", "Email"], [], ["Meetings"]];

  state.sessions = Array.from({ length: 24 }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (index % 12));
    return createSession(
      {
        projectId: projectIds[index % projectIds.length],
        date: toDateKey(date),
        minutes: 25 + ((index * 15) % 85),
        energy: ["high", "steady", "low"][index % 3],
        note: notes[index % notes.length],
        distractions: distractions[index % distractions.length]
      },
      new Date(date.getTime() + index * 1000)
    );
  });

  return state;
}

function summarizeProjects(sessions, projects) {
  const totals = new Map();

  for (const session of sessions) {
    totals.set(session.projectId, (totals.get(session.projectId) ?? 0) + session.minutes);
  }

  return [...totals.entries()]
    .map(([projectId, minutes]) => {
      const project = projects.get(projectId) ?? { id: projectId, name: "Unknown", color: "#64748b", weeklyTarget: 0 };
      return {
        ...project,
        minutes,
        progress: project.weeklyTarget > 0 ? Math.min(minutes / project.weeklyTarget, 1) : 0
      };
    })
    .sort((left, right) => right.minutes - left.minutes);
}

function summarizeDistractions(sessions) {
  const totals = new Map();

  for (const session of sessions) {
    for (const item of session.distractions) {
      totals.set(item, (totals.get(item) ?? 0) + 1);
    }
  }

  return [...totals.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

function buildDateRange(today, days) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (days - index - 1));
    return {
      date: toDateKey(date),
      label: date.toLocaleDateString(undefined, { weekday: "short" })
    };
  });
}

function normalizeProject(project) {
  return createProject(
    {
      id: project.id,
      name: project.name,
      color: project.color,
      weeklyTarget: project.weeklyTarget
    },
    new Date(0)
  );
}

function normalizeSession(session) {
  try {
    const createdAt = validDate(session.createdAt) ? session.createdAt : new Date(0).toISOString();
    return createSession(
      {
        id: session.id,
        projectId: session.projectId,
        date: session.date,
        minutes: session.minutes,
        energy: session.energy,
        note: session.note,
        distractions: session.distractions,
        createdAt
      },
      new Date(createdAt)
    );
  } catch {
    return null;
  }
}

function parseDistractions(value) {
  if (Array.isArray(value)) {
    return value.map(cleanText).filter(Boolean);
  }

  return String(value ?? "")
    .split(",")
    .map(cleanText)
    .filter(Boolean);
}

function cleanText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeId(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeColor(value, fallback) {
  const color = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function normalizeDateKey(value, fallback) {
  const date = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : toDateKey(fallback);
}

function validDate(value) {
  return !Number.isNaN(new Date(value).getTime());
}

function cryptoSafeId(prefix, date) {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}-${date.getTime()}-${random}`.replace(/[^a-zA-Z0-9-]/g, "");
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
