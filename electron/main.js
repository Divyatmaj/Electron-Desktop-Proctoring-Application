const { BrowserWindow, app, ipcMain, dialog, nativeTheme } = require("electron");
const path = require("path");
const fs = require("fs");

const exam = require("./data/exam.json");

const DEV_SERVER_URL = "http://127.0.0.1:5173/";
const EXAM_DURATION_MS = exam.durationMinutes * 60 * 1000;
const SNAPSHOT_INTERVAL_MS = (exam.snapshotIntervalSeconds ?? 5) * 1000;
const MAX_FIELD_LENGTH = 80;
const MAX_VIOLATIONS = exam.maxViolations ?? 3;

// Violations the renderer is allowed to report. Window focus and full screen
// are watched here in the main process, where the renderer can't fake them.
const RENDERER_VIOLATIONS = new Set(["camera-lost"]);

const { questions } = exam;

const isDev = process.argv.includes("--dev");

let win = null;

// Single source of truth for the exam session. The renderer only ever sees
// what it needs; correct answers never leave the main process.
const session = {
  id: null,
  student: null,
  snapshotCount: 0,
  violations: [],
  // Saved as the student picks them, so a reloaded or crashed renderer can
  // pick up where it left off. { [questionId]: optionIndex }
  answers: {},
  flagged: new Set(),
  timeoutHandle: null,
  // True while one of our own native dialogs is up, since that also takes
  // focus away from the window and shouldn't count against the student.
  dialogOpen: false,
  startedAt: null,
  endTime: null,
  result: null,
};

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 700,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.on("blur", () => {
    if (session.dialogOpen) return;
    // Clicking into the detached DevTools isn't the student leaving.
    if (isDev && win.webContents.isDevToolsFocused()) return;

    recordViolation("focus-lost");
  });

  win.on("leave-full-screen", () => {
    if (!isExamRunning()) return;

    recordViolation("fullscreen-exited");
    win.kiosk = true;
  });

  if (isDev) {
    win.loadURL(DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

// Snapshots and results live in the per-user data folder so they still save
// once the app is packaged (the app's own folder is read-only there).
function getDataDir(name) {
  const dir = path.join(app.getPath("userData"), name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanField(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_FIELD_LENGTH);
}

// "21-CS 042" + 1761130000000 -> "21-CS-042-1761130000000". Safe to use as a
// folder name and still easy to match back to the student by eye.
function makeSessionId(rollNumber, startedAt) {
  const slug = rollNumber.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "student"}-${startedAt}`;
}

function isExamRunning() {
  return session.startedAt !== null && session.result === null;
}

function recordViolation(type) {
  if (!isExamRunning()) return;

  const violation = { type, at: Date.now() };
  session.violations.push(violation);

  const limitReached = session.violations.length >= MAX_VIOLATIONS;

  win.webContents.send("violation", {
    violation,
    count: session.violations.length,
    max: MAX_VIOLATIONS,
    limitReached,
  });

  if (limitReached) finishExam("violations");
}

// Grades the saved answers, writes the result file and tells the renderer.
// Every way an exam can end (button, timer, warnings) comes through here, so
// it only ever runs once.
function finishExam(reason) {
  if (session.result) return session.result;

  clearTimeout(session.timeoutHandle);
  const submittedAt = Date.now();

  session.result = {
    sessionId: session.id,
    student: session.student,
    ...gradeAnswers(session.answers),
    reason,
    startedAt: session.startedAt,
    submittedAt,
    durationMs: Math.min(submittedAt, session.endTime) - session.startedAt,
    snapshotCount: session.snapshotCount,
    violations: session.violations,
  };

  const resultPath = path.join(getDataDir("results"), `${session.id}.json`);
  fs.writeFileSync(resultPath, JSON.stringify(session.result, null, 2));

  // The exam is over, so the student shouldn't be stuck in kiosk mode.
  win.kiosk = false;
  win.webContents.send("exam-finished", session.result);

  return session.result;
}

function gradeAnswers(answers) {
  const review = questions.map((q) => {
    const selected = Number.isInteger(answers[q.id]) ? answers[q.id] : null;

    return {
      id: q.id,
      question: q.question,
      options: q.options,
      selected,
      correct: q.answer,
      isCorrect: selected === q.answer,
      flagged: session.flagged.has(q.id),
    };
  });

  return {
    score: review.filter((r) => r.isCorrect).length,
    answered: review.filter((r) => r.selected !== null).length,
    total: questions.length,
    review,
  };
}

ipcMain.handle("full-screen", () => {
  win.kiosk = true;
  return win.kiosk;
});

ipcMain.handle("window-minimize", () => {
  if (!win.kiosk) win.minimize();
});

ipcMain.handle("get-exam-info", () => {
  return {
    title: exam.title,
    rules: exam.rules,
    totalQuestions: questions.length,
    durationMs: EXAM_DURATION_MS,
    snapshotIntervalMs: SNAPSHOT_INTERVAL_MS,
    maxViolations: MAX_VIOLATIONS,
  };
});

ipcMain.handle("start-test", (_event, student) => {
  if (session.startedAt !== null) return session.id;

  const name = cleanField(student?.name);
  const rollNumber = cleanField(student?.rollNumber);
  if (!name || !rollNumber) return null;

  session.student = { name, rollNumber };
  session.startedAt = Date.now();
  session.endTime = session.startedAt + EXAM_DURATION_MS;
  session.id = makeSessionId(rollNumber, session.startedAt);
  session.timeoutHandle = setTimeout(
    () => finishExam("timeout"),
    EXAM_DURATION_MS,
  );

  return session.id;
});

ipcMain.handle("get-time", () => {
  if (session.endTime === null) return 0;
  if (session.result) return 0;
  return Math.max(0, session.endTime - Date.now());
});

// Everything the renderer needs to rebuild the screen after a reload.
ipcMain.handle("get-session", () => {
  let status = "idle";
  if (session.result) status = "finished";
  else if (session.startedAt !== null) status = "running";

  return {
    status,
    student: session.student,
    answers: session.answers,
    flagged: [...session.flagged],
    result: session.result,
  };
});

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

ipcMain.handle("confirm-end-test", async () => {
  const unanswered = questions.length - Object.keys(session.answers).length;
  const flagged = session.flagged.size;

  const notes = [];
  if (unanswered > 0) notes.push(`${plural(unanswered, "question")} unanswered`);
  if (flagged > 0) notes.push(`${flagged} marked for review`);

  const detail =
    (notes.length > 0 ? `You have ${notes.join(" and ")}. ` : "") +
    "You can't change your answers after submitting.";

  session.dialogOpen = true;

  try {
    const result = await dialog.showMessageBox(win, {
      type: "question",
      title: "End Test",
      message: "Submit your test now?",
      detail,
      buttons: ["Submit", "Keep Working"],
      defaultId: 1,
      cancelId: 1,
    });

    return result.response === 0;
  } finally {
    session.dialogOpen = false;
  }
});

ipcMain.handle("get-question", (_event, id) => {
  const q = questions.find((item) => item.id === id);
  if (!q) return null;

  return { id: q.id, question: q.question, options: q.options };
});

ipcMain.handle("report-violation", (_event, type) => {
  if (RENDERER_VIOLATIONS.has(type)) recordViolation(type);
});

ipcMain.handle("save-answer", (_event, id, optionIndex) => {
  if (!isExamRunning()) return false;

  const q = questions.find((item) => item.id === id);
  if (!q) return false;

  if (optionIndex === null) {
    delete session.answers[id];
    return true;
  }

  if (!Number.isInteger(optionIndex)) return false;
  if (optionIndex < 0 || optionIndex >= q.options.length) return false;

  session.answers[id] = optionIndex;
  return true;
});

ipcMain.handle("set-flag", (_event, id, flagged) => {
  if (!isExamRunning()) return false;
  if (!questions.some((item) => item.id === id)) return false;

  if (flagged) session.flagged.add(id);
  else session.flagged.delete(id);
  return true;
});

ipcMain.handle("submit-test", () => {
  if (session.startedAt === null) return null;
  return finishExam("manual");
});

ipcMain.handle("quit-app", () => {
  app.quit();
});

const JPEG_PREFIX = "data:image/jpeg;base64,";

ipcMain.handle("save-photo", (_event, image) => {
  if (session.id === null || session.result) return null;
  if (typeof image !== "string" || !image.startsWith(JPEG_PREFIX)) return null;

  const imageData = image.slice(JPEG_PREFIX.length);

  // One folder per exam session, so every snapshot can be traced back to the
  // result file with the same name.
  const filePath = path.join(
    getDataDir(path.join("camera_feed", session.id)),
    `photo-${Date.now()}.jpg`,
  );
  fs.writeFileSync(filePath, Buffer.from(imageData, "base64"));
  session.snapshotCount += 1;

  return filePath;
});

app.whenReady().then(() => {
  nativeTheme.themeSource = "system";
  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});
