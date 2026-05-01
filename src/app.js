import {
  buildAnalytics,
  createProject,
  createSession,
  formatMinutes,
  sampleState,
  toDateKey
} from "./core.js";
import { clearState, exportState, importState, loadState, saveState } from "./storage.js";

const els = {
  todayLabel: document.querySelector("#todayLabel"),
  viewTitle: document.querySelector("#viewTitle"),
  tabs: [...document.querySelectorAll(".tab")],
  views: [...document.querySelectorAll(".view")],
  metricGrid: document.querySelector("#metricGrid"),
  focusChart: document.querySelector("#focusChart"),
  projectChart: document.querySelector("#projectChart"),
  recentSessions: document.querySelector("#recentSessions"),
  distractionList: document.querySelector("#distractionList"),
  rangeSelect: document.querySelector("#rangeSelect"),
  sessionForm: document.querySelector("#sessionForm"),
  projectForm: document.querySelector("#projectForm"),
  sessionDate: document.querySelector("[name='date']"),
  sessionProject: document.querySelector("[name='projectId']"),
  projectColor: document.querySelector("[name='color']"),
  projectTarget: document.querySelector("[name='weeklyTarget']"),
  timerProject: document.querySelector("#timerProject"),
  projectFilter: document.querySelector("#projectFilter"),
  sessionTable: document.querySelector("#sessionTable"),
  projectList: document.querySelector("#projectList"),
  seedData: document.querySelector("#seedData"),
  exportData: document.querySelector("#exportData"),
  importData: document.querySelector("#importData"),
  clearData: document.querySelector("#clearData"),
  focusLength: document.querySelector("#focusLength"),
  dailyGoal: document.querySelector("#dailyGoal"),
  saveSettings: document.querySelector("#saveSettings"),
  timerClock: document.querySelector("#timerClock"),
  timerStart: document.querySelector("#timerStart"),
  timerPause: document.querySelector("#timerPause"),
  timerSave: document.querySelector("#timerSave"),
  timerNote: document.querySelector("#timerNote")
};

let state = loadState();
let currentView = "dashboard";
let timer = {
  running: false,
  startedAt: null,
  elapsedSeconds: 0,
  interval: null
};

initialize();

function initialize() {
  els.todayLabel.textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric"
  });
  els.sessionDate.value = toDateKey(new Date());
  syncSettingsForm();
  bindEvents();
  render();
}

function bindEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  els.rangeSelect.addEventListener("change", renderDashboard);
  els.projectFilter.addEventListener("change", renderSessions);

  els.sessionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(els.sessionForm));
    addSession(createSession(data));
    els.sessionForm.reset();
    els.sessionDate.value = toDateKey(new Date());
  });

  els.projectForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(els.projectForm));
    state.projects.push(createProject(data));
    persistAndRender();
    els.projectForm.reset();
    els.projectColor.value = "#2563eb";
    els.projectTarget.value = 300;
  });

  els.seedData.addEventListener("click", () => {
    state = sampleState();
    persistAndRender();
  });

  els.exportData.addEventListener("click", () => {
    const blob = new Blob([exportState(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `focus-ledger-${toDateKey(new Date())}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  els.importData.addEventListener("change", async () => {
    const file = els.importData.files[0];
    if (!file) {
      return;
    }
    state = importState(await file.text());
    persistAndRender();
    els.importData.value = "";
  });

  els.clearData.addEventListener("click", () => {
    if (confirm("Clear all Focus Ledger data?")) {
      clearState();
      state = loadState();
      persistAndRender();
    }
  });

  els.saveSettings.addEventListener("click", () => {
    state.settings.focusLength = Number(els.focusLength.value);
    state.settings.dailyGoal = Number(els.dailyGoal.value);
    resetTimer();
    persistAndRender();
  });

  els.timerStart.addEventListener("click", startTimer);
  els.timerPause.addEventListener("click", pauseTimer);
  els.timerSave.addEventListener("click", saveTimerSession);
}

function switchView(view) {
  currentView = view;
  els.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === view));
  els.views.forEach((panel) => panel.classList.toggle("is-active", panel.id === `${view}View`));
  els.viewTitle.textContent = view[0].toUpperCase() + view.slice(1);
  render();
}

function addSession(session) {
  state.sessions.push(session);
  persistAndRender();
}

function removeSession(id) {
  state.sessions = state.sessions.filter((session) => session.id !== id);
  persistAndRender();
}

function persistAndRender() {
  saveState(state);
  render();
}

function render() {
  renderProjectOptions();
  syncSettingsForm();
  renderTimer();

  if (currentView === "dashboard") {
    renderDashboard();
  } else if (currentView === "sessions") {
    renderSessions();
  } else if (currentView === "projects") {
    renderProjects();
  }
}

function renderDashboard() {
  const analytics = buildAnalytics(state, { days: Number(els.rangeSelect.value) });
  els.metricGrid.innerHTML = [
    metric("Today", formatMinutes(analytics.todayMinutes), `${Math.round(analytics.goalProgress * 100)}% of goal`),
    metric("Range Total", formatMinutes(analytics.totalMinutes), `${analytics.days} day window`),
    metric("Daily Average", formatMinutes(analytics.averageMinutes), "active and inactive days"),
    metric("Streak", `${analytics.streak} days`, "consecutive focus days")
  ].join("");

  drawBarChart(els.focusChart, analytics.dailySeries, state.settings.dailyGoal);
  drawProjectChart(els.projectChart, analytics.projectTotals);
  renderRecentSessions(analytics.recentSessions);
  renderDistractions(analytics.distractions);
}

function renderRecentSessions(sessions) {
  if (sessions.length === 0) {
    els.recentSessions.innerHTML = emptyHtml();
    return;
  }

  els.recentSessions.innerHTML = sessions
    .map(
      (session) => `
        <article class="activity-item">
          <span class="dot" style="background:${session.project.color}"></span>
          <div>
            <strong>${escapeHtml(session.project.name)}</strong>
            <p>${session.date} · ${formatMinutes(session.minutes)} · ${escapeHtml(session.energy)}</p>
          </div>
        </article>
      `
    )
    .join("");
}

function renderDistractions(distractions) {
  if (distractions.length === 0) {
    els.distractionList.innerHTML = emptyHtml();
    return;
  }

  els.distractionList.innerHTML = distractions
    .slice(0, 8)
    .map(
      (item) => `
        <article class="activity-item">
          <span class="count">${item.count}</span>
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <p>logged distraction</p>
          </div>
        </article>
      `
    )
    .join("");
}

function renderSessions() {
  const filter = els.projectFilter.value;
  const projects = new Map(state.projects.map((project) => [project.id, project]));
  const sessions = [...state.sessions]
    .filter((session) => filter === "all" || session.projectId === filter)
    .sort((left, right) => `${right.date}-${right.createdAt}`.localeCompare(`${left.date}-${left.createdAt}`));

  if (sessions.length === 0) {
    els.sessionTable.innerHTML = emptyHtml();
    return;
  }

  els.sessionTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Project</th>
          <th>Time</th>
          <th>Energy</th>
          <th>Notes</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${sessions
          .map((session) => {
            const project = projects.get(session.projectId) ?? { name: "Unknown", color: "#64748b" };
            return `
              <tr>
                <td>${session.date}</td>
                <td><span class="dot" style="background:${project.color}"></span>${escapeHtml(project.name)}</td>
                <td>${formatMinutes(session.minutes)}</td>
                <td>${escapeHtml(session.energy)}</td>
                <td>${escapeHtml(session.note || session.distractions.join(", ") || "—")}</td>
                <td><button type="button" data-remove-session="${escapeAttr(session.id)}">Delete</button></td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;

  els.sessionTable.querySelectorAll("[data-remove-session]").forEach((button) => {
    button.addEventListener("click", () => removeSession(button.dataset.removeSession));
  });
}

function renderProjects() {
  const analytics = buildAnalytics(state, { days: 7 });

  els.projectList.innerHTML = state.projects
    .map((project) => {
      const total = analytics.projectTotals.find((item) => item.id === project.id);
      const minutes = total?.minutes ?? 0;
      const progress = project.weeklyTarget > 0 ? Math.min(minutes / project.weeklyTarget, 1) : 0;
      return `
        <article class="project-row">
          <div>
            <span class="dot" style="background:${project.color}"></span>
            <strong>${escapeHtml(project.name)}</strong>
            <p>${formatMinutes(minutes)} of ${formatMinutes(project.weeklyTarget)} this week</p>
          </div>
          <div class="progress"><span style="width:${Math.round(progress * 100)}%; background:${project.color}"></span></div>
        </article>
      `;
    })
    .join("");
}

function renderProjectOptions() {
  const options = state.projects.map((project) => `<option value="${escapeAttr(project.id)}">${escapeHtml(project.name)}</option>`).join("");
  const filterOptions = `<option value="all">All projects</option>${options}`;

  els.sessionProject.innerHTML = options;
  els.timerProject.innerHTML = options;
  els.projectFilter.innerHTML = filterOptions;
}

function syncSettingsForm() {
  els.focusLength.value = state.settings.focusLength;
  els.dailyGoal.value = state.settings.dailyGoal;
}

function startTimer() {
  if (timer.running) {
    return;
  }

  timer.running = true;
  timer.startedAt = Date.now();
  timer.interval = setInterval(renderTimer, 500);
  renderTimer();
}

function pauseTimer() {
  if (!timer.running) {
    return;
  }

  timer.elapsedSeconds += Math.floor((Date.now() - timer.startedAt) / 1000);
  timer.running = false;
  timer.startedAt = null;
  clearInterval(timer.interval);
  renderTimer();
}

function saveTimerSession() {
  const seconds = currentTimerSeconds();
  const minutes = Math.max(1, Math.round(seconds / 60));

  if (seconds < 60 && !confirm("Save a one-minute session?")) {
    return;
  }

  addSession(
    createSession({
      projectId: els.timerProject.value,
      minutes,
      date: toDateKey(new Date()),
      note: els.timerNote.value,
      energy: "steady",
      distractions: []
    })
  );
  resetTimer();
}

function resetTimer() {
  timer.running = false;
  timer.startedAt = null;
  timer.elapsedSeconds = 0;
  clearInterval(timer.interval);
  renderTimer();
}

function renderTimer() {
  const target = state.settings.focusLength * 60;
  const remaining = Math.max(target - currentTimerSeconds(), 0);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  els.timerClock.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  if (remaining === 0 && timer.running) {
    pauseTimer();
  }
}

function currentTimerSeconds() {
  if (!timer.running) {
    return timer.elapsedSeconds;
  }

  return timer.elapsedSeconds + Math.floor((Date.now() - timer.startedAt) / 1000);
}

function drawBarChart(canvas, series, goal) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const padding = 36;
  const max = Math.max(goal, ...series.map((item) => item.minutes), 60);
  const barWidth = (width - padding * 2) / series.length - 10;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#dbe4ee";
  ctx.lineWidth = 1;

  for (let step = 0; step <= 4; step += 1) {
    const y = padding + ((height - padding * 2) * step) / 4;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  series.forEach((item, index) => {
    const x = padding + index * (barWidth + 10);
    const barHeight = ((height - padding * 2) * item.minutes) / max;
    const y = height - padding - barHeight;
    ctx.fillStyle = item.minutes >= goal ? "#0f766e" : "#2563eb";
    roundRect(ctx, x, y, barWidth, barHeight, 6);
    ctx.fill();
    ctx.fillStyle = "#475569";
    ctx.font = "13px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(item.label, x + barWidth / 2, height - 12);
  });
}

function drawProjectChart(canvas, projects) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const centerX = width / 2;
  const centerY = height / 2 - 8;
  const radius = Math.min(width, height) * 0.28;
  const total = projects.reduce((sum, project) => sum + project.minutes, 0);
  let start = -Math.PI / 2;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  if (total === 0) {
    ctx.fillStyle = "#64748b";
    ctx.font = "15px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("No project data", centerX, centerY);
    return;
  }

  projects.forEach((project) => {
    const angle = (project.minutes / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = project.color;
    ctx.fill();
    start += angle;
  });

  ctx.fillStyle = "#0f172a";
  ctx.font = "600 16px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(formatMinutes(total), centerX, centerY + 6);

  projects.slice(0, 4).forEach((project, index) => {
    const y = height - 58 + index * 18;
    ctx.fillStyle = project.color;
    ctx.fillRect(24, y - 9, 10, 10);
    ctx.fillStyle = "#475569";
    ctx.font = "13px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(`${project.name} · ${formatMinutes(project.minutes)}`, 42, y);
  });
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function metric(label, value, detail) {
  return `
    <article class="metric">
      <p>${label}</p>
      <strong>${value}</strong>
      <span>${detail}</span>
    </article>
  `;
}

function emptyHtml() {
  return document.querySelector("#emptyTemplate").innerHTML;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
