# Electron-Desktop-Proctoring-Application
# Athena Proctoring

A desktop application for exam proctoring, built with React, Vite, and Electron.

## Features

- Pre-exam checklist: student details, camera, full screen and exam rules
- Kiosk-mode exam window with a server-side (main process) timer
- Crash-safe sessions: a force-quit or crashed exam resumes where it left off
- Question navigator, keyboard shortcuts and automatic submit on timeout
- Grading in the main process, so correct answers never reach the renderer
- Periodic webcam snapshots, stored per exam session
- Results screen with a per-question review

## Tech Stack

- JavaScript
- React
- Vite
- Electron
- CSS

## Getting Started

### Requirements

- Node.js
- npm

### Installation

```bash
npm install
```

### Running

```bash
npm run dev          # Vite dev server + Electron with DevTools
npm run start:built  # production build loaded from dist/
npm test             # lint + build
```

## Configuring the exam

Edit `electron/data/exam.json`:

| Field | Meaning |
| --- | --- |
| `title` | Shown on the setup screen and exam bar |
| `durationMinutes` | Length of the exam |
| `snapshotIntervalSeconds` | How often a webcam snapshot is saved |
| `rules` | Rules the student must accept before starting |
| `questions` | `{ id, question, options, answer }`, where `answer` is the index of the correct option |

## Where data is saved

Everything goes in Electron's per-user data folder
(`~/Library/Application Support/athena-proctoring` on macOS,
`%APPDATA%\athena-proctoring` on Windows):

- `results/<sessionId>.json`: score, answers, student details and timing
- `sessions/active.json`: the exam in progress, removed once it's submitted.
  If Athena crashes or is force quit, the next launch resumes this session
  (same timer, answers and warnings) and logs the restart as a warning.
  Delete it to throw away an unfinished session, e.g. while testing.
- `camera_feed/<sessionId>/photo-<timestamp>.jpg`: webcam snapshots

The session ID is the student's roll number plus the start time, so a result
and its snapshots always share a name.
