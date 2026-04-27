# Focus Ledger

Focus Ledger is a local-first browser app for tracking focus sessions, distractions, project targets, and weekly productivity patterns. It runs as plain HTML, CSS, and JavaScript with no backend and no runtime dependencies.

I built this project for fun as a more complete productivity tool: useful enough to run locally, but still compact enough to inspect and modify without a framework.

## Features

- Focus timer with project assignment and session saving.
- Manual session ledger with project, date, energy, notes, and distractions.
- Project targets with weekly progress.
- Dashboard metrics for today, range totals, daily average, and streak.
- Canvas charts for weekly focus and project mix.
- Distraction ranking from logged sessions.
- Local browser persistence.
- JSON import/export.
- Testable analytics core.

## Quick Start

Open `index.html` in a browser. The page uses a generated classic browser bundle, so it works when opened directly from the filesystem.

For checks:

```bash
npm run build
npm test
npm run check
```

No install step is required because the app has no external dependencies.

## Project Layout

```text
index.html          App shell
src/styles.css      Responsive interface styling
src/app.js          Browser UI, timer, charts, forms, rendering
src/core.js         State normalization, session/project creation, analytics
src/storage.js      Local storage and import/export helpers
src/focus-ledger.bundle.js Browser bundle for direct index.html usage
scripts/build-browser.js Bundle generator
test/core.test.js   Analytics and model tests
```

## Data Model

Focus Ledger stores data in local storage under `focus-ledger:v1`.

```json
{
  "version": 1,
  "settings": {
    "focusLength": 25,
    "dailyGoal": 120
  },
  "projects": [],
  "sessions": []
}
```

Sessions contain the project, date, minutes, energy, note, distractions, and creation timestamp. Projects contain a display name, color, and weekly target.

## How It Works

The app keeps the user interface and business logic separated. `src/core.js` owns state normalization, validation, aggregation, streak calculation, and formatting. `src/app.js` handles browser events, local rendering, canvas charts, import/export, and the focus timer.

This makes the important logic testable without a browser while keeping the app simple to run.

## Roadmap

- Editable sessions and projects.
- Calendar heatmap view.
- Keyboard shortcuts for timer control.
- Markdown weekly review export.
- Optional PWA install support.

## License

MIT
