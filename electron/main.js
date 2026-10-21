const { BrowserWindow, app, ipcMain, dialog, nativeTheme } = require("electron");
const path = require("path");
const fs = require("fs");

const questions = require("./data/questions.json");

const DEV_SERVER_URL = "http://127.0.0.1:5173/";
const EXAM_DURATION_MS = 60 * 60 * 1000;

const isDev = process.argv.includes("--dev");

let win = null;

// Single source of truth for the exam session. The renderer only ever sees
// what it needs; correct answers never leave the main process.
const session = {
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
});

ipcMain.handle("get-exam-info", () => {
  return {
    totalQuestions: questions.length,
    durationMs: EXAM_DURATION_MS,
  };
});

ipcMain.handle("start-test", () => {
  if (session.startedAt !== null) return;

  session.startedAt = Date.now();
  session.endTime = session.startedAt + EXAM_DURATION_MS;
});

ipcMain.handle("get-time", () => {
  if (session.endTime === null) return 0;
  if (session.result) return 0;
  return Math.max(0, session.endTime - Date.now());
});

ipcMain.handle("show-rules", async () => {
  const result = await dialog.showMessageBox(win, {
    type: "info",
    title: "Exam Rules",
    message: "Please read the exam rules carefully.",
    detail: `
1. Camera must remain enabled.
2. Do not exit fullscreen mode.
3. Do not use external applications.
4. The exam will start only after accepting the rules.
    `,
    buttons: ["Accept", "Cancel"],
    defaultId: 0,
    cancelId: 1,
  });

  return result.response;
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
    ...gradeAnswers(answers ?? {}),
    reason: reason === "timeout" ? "timeout" : "manual",
    startedAt: session.startedAt,
    submittedAt,
    durationMs: Math.min(submittedAt, session.endTime) - session.startedAt,
  };

  const resultPath = path.join(
    getDataDir("results"),
    `result-${submittedAt}.json`,
  );
  fs.writeFileSync(resultPath, JSON.stringify(session.result, null, 2));

  // The exam is over, so the student shouldn't be stuck in kiosk mode.
  win.kiosk = false;

  return session.result;
});

ipcMain.handle("quit-app", () => {
  app.quit();
});

ipcMain.handle("save-photo", (_event, image) => {
  if (session.result) return null;

  const imageData = image.split(",")[1];

  const filePath = path.join(
    getDataDir("camera_feed"),
    `photo-${Date.now()}.png`,
  );
  fs.writeFileSync(filePath, Buffer.from(imageData, "base64"));

  return filePath;
});

app.whenReady().then(() => {
  nativeTheme.themeSource = "system";
  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});
