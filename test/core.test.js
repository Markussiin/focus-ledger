import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAnalytics,
  calculateStreak,
  createProject,
  createSession,
  formatMinutes,
  normalizeState,
  toDateKey
} from "../src/core.js";

test("creates normalized sessions", () => {
  const session = createSession(
    {
      projectId: "deep-work",
      date: "2026-04-27",
      minutes: "49.6",
      note: "  Draft   proposal  ",
      distractions: "Slack, phone, "
    },
    new Date("2026-04-27T10:00:00Z")
  );

  assert.equal(session.minutes, 50);
  assert.equal(session.note, "Draft proposal");
  assert.deepEqual(session.distractions, ["Slack", "phone"]);
});

test("creates projects with stable fields", () => {
  const project = createProject(
    {
      name: "Client Work",
      color: "#111111",
      weeklyTarget: "300"
    },
    new Date("2026-04-27T10:00:00Z")
  );

  assert.equal(project.id, "client-work-1777284000000");
  assert.equal(project.weeklyTarget, 300);
});

test("builds analytics for a date range", () => {
  const state = normalizeState({
    settings: { dailyGoal: 100 },
    projects: [{ id: "p1", name: "Project", color: "#2563eb", weeklyTarget: 200 }],
    sessions: [
      createSession({ projectId: "p1", date: "2026-04-27", minutes: 50, distractions: "Slack" }),
      createSession({ projectId: "p1", date: "2026-04-26", minutes: 75, distractions: "Email, Slack" })
    ]
  });

  const analytics = buildAnalytics(state, { today: new Date("2026-04-27T12:00:00"), days: 2 });

  assert.equal(analytics.totalMinutes, 125);
  assert.equal(analytics.todayMinutes, 50);
  assert.equal(analytics.averageMinutes, 63);
  assert.equal(analytics.projectTotals[0].minutes, 125);
  assert.deepEqual(analytics.distractions, [
    { name: "Slack", count: 2 },
    { name: "Email", count: 1 }
  ]);
});

test("calculates current streak", () => {
  const sessions = [
    createSession({ projectId: "p1", date: "2026-04-27", minutes: 20 }),
    createSession({ projectId: "p1", date: "2026-04-26", minutes: 20 }),
    createSession({ projectId: "p1", date: "2026-04-24", minutes: 20 })
  ];

  assert.equal(calculateStreak(sessions, new Date("2026-04-27T12:00:00")), 2);
});

test("formats minutes and date keys", () => {
  assert.equal(formatMinutes(45), "45m");
  assert.equal(formatMinutes(120), "2h");
  assert.equal(formatMinutes(135), "2h 15m");
  assert.equal(toDateKey(new Date("2026-04-27T12:00:00")), "2026-04-27");
});

