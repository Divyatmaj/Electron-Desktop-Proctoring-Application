# Athena Proctoring

A desktop application for exam proctoring, built with React, Vite, and Electron.

## Features

- Pre-exam checklist: student details, camera, full screen, a single display
  and exam rules
- Kiosk-mode exam window with the timer kept in the main process
- Warnings for leaving the window, exiting full screen, connecting another
  display, losing the camera or restarting the app. Warnings within 2 seconds
  of the last one count as part of it, and reaching the limit submits the
  test automatically
- Locked-down window: one instance only, sandboxed renderer, no DevTools,
  reload or navigation in packaged builds, camera as the only permission and
  a strict Content Security Policy
- Single-display check before the test and during it
- Crash-safe sessions: a force-quit or crashed exam resumes where it left off
- Question navigator, keyboard shortcuts and automatic submit on timeout
- Grading in the main process, so correct answers never reach the renderer
- Periodic webcam snapshots, stored per exam session, plus a photo taken the
  moment each warning is logged
- Low-time notices at 5 minutes and 1 minute left
- Results screen with a per-question review, warning photos and shortcuts to
  the session's snapshot folder and result file

## Screenshots

<!-- TODO: add screenshots to docs/screenshots/ and uncomment these.
![Setup checklist](docs/screenshots/setup.png)
![Exam with a warning](docs/screenshots/exam-warning.png)
![Results](docs/screenshots/results.png)
-->

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

To test the 5 and 1 minute notices without waiting an hour, shorten the exam
for a dev run (ignored outside `npm run dev`):

```bash
ATHENA_EXAM_MINUTES=6 npm run dev
```

## Configuring the exam

Edit `electron/data/exam.json`:

| Field | Meaning |
| --- | --- |
| `title` | Shown on the setup screen and exam bar |
| `durationMinutes` | Length of the exam |
| `snapshotIntervalSeconds` | How often a webcam snapshot is saved |
| `maxViolations` | Warnings allowed before the test is submitted automatically |
| `requireSingleDisplay` | Block the start while more than one display is connected and log a warning if one is plugged in mid-test (default `true`) |
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
- `camera_feed/<sessionId>/warning-<n>-<type>.jpg`: the photo taken for
  warning number `n`. Its file name is also stored as `snapshot` on that
  warning in the result file

The session ID is the student's roll number plus the start time, so a result
and its snapshots always share a name.

## Limitations and future work

- Questions and their answers ship as plain JSON inside the app, so anyone
  with access to the app's files can read them. A real deployment would fetch
  the paper from a server when the exam starts.
- Results and snapshots stay on the student's machine. Nothing is uploaded to
  an invigilator.
- Proctoring watches the window, displays and camera, but doesn't analyse the
  camera feed (no face detection).
- `npm test` runs lint and a production build; there are no unit tests yet.
