const { BrowserWindow, app, ipcMain, dialog, nativeTheme } = require("electron");
const path = require("path");
const fs = require("fs");

const exam = require("./data/exam.json");

const DEV_SERVER_URL = "http://127.0.0.1:5173/";
const EXAM_DURATION_MS = exam.durationMinutes * 60 * 1000;
const SNAPSHOT_INTERVAL_MS = (exam.snapshotIntervalSeconds ?? 5) * 1000;
const MAX_FIELD_LENGTH = 80;

const { questions } = exam;

const isDev = process.argv.includes("--dev");

let win = null;

// Single source of truth for the exam session. The renderer only ever sees
// what it needs; correct answers never leave the main process.
const session = {
  id: null,
  student: null,
  snapshotCount: 0,
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

  return session.id;
});

ipcMain.handle("get-time", () => {
  if (session.endTime === null) return 0;
  if (session.result) return 0;
  return Math.max(0, session.endTime - Date.now());
});

ipcMain.handle("confirm-end-test", async (_event, unanswered) => {
  const detail =
    unanswered > 0
      ? `You still have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}. You can't change your answers after submitting.`
      : "You can't change your answers after submitting.";

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
});

ipcMain.handle("get-question", (_event, id) => {
  const q = questions.find((item) => item.id === id);
  if (!q) return null;

  return { id: q.id, question: q.question, options: q.options };
});

ipcMain.handle("submit-test", (_event, answers, reason) => {
  if (session.startedAt === null) return null;
  if (session.result) return session.result;

  const submittedAt = Date.now();

  session.result = {
    sessionId: session.id,
    student: session.student,
    ...gradeAnswers(answers ?? {}),
    reason: reason === "timeout" ? "timeout" : "manual",
    startedAt: session.startedAt,
    submittedAt,
    durationMs: Math.min(submittedAt, session.endTime) - session.startedAt,
    snapshotCount: session.snapshotCount,
  };

  const resultPath = path.join(getDataDir("results"), `${session.id}.json`);
  fs.writeFileSync(resultPath, JSON.stringify(session.result, null, 2));

  // The exam is over, so the student shouldn't be stuck in kiosk mode.
  win.kiosk = false;

  return session.result;
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
