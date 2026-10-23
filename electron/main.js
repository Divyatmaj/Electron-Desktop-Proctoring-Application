const {
  BrowserWindow,
  Menu,
  app,
  ipcMain,
  dialog,
  nativeTheme,
  screen,
  shell,
} = require("electron");
const path = require("path");
const fs = require("fs");

const exam = require("./data/exam.json");

const DEV_SERVER_URL = "http://127.0.0.1:5173/";
const EXAM_DURATION_MS = exam.durationMinutes * 60 * 1000;
const SNAPSHOT_INTERVAL_MS = (exam.snapshotIntervalSeconds ?? 5) * 1000;
const MAX_FIELD_LENGTH = 80;
const MAX_VIOLATIONS = exam.maxViolations ?? 3;
// A second monitor makes it easy to keep notes in view, so by default the
// test can't start with one connected and plugging one in is a warning.
const REQUIRE_SINGLE_DISPLAY = exam.requireSingleDisplay ?? true;

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
      sandbox: true,
      // In a packaged build DevTools would let the student call the exam API
      // directly, so they're only available with --dev.
      devTools: isDev,
    },
  });

  // The window only ever shows Athena: no following links, no popups.
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  // The camera is the only permission Athena needs, so everything else
  // (microphone, notifications, geolocation...) is refused.
  const ses = win.webContents.session;
  ses.setPermissionRequestHandler((_wc, permission, callback, details) => {
    const mediaTypes = details.mediaTypes ?? [];
    const videoOnly = mediaTypes.every((type) => type === "video");
    callback(permission === "media" && videoOnly);
  });
  ses.setPermissionCheckHandler((_wc, permission) => permission === "media");

  // Closing the window mid-test would throw the exam away, so the only way
  // out is End Test. A force quit is still possible, which is why the
  // session is also saved to disk.
  win.on("close", (event) => {
    if (!isExamRunning()) return;

    event.preventDefault();
    if (session.dialogOpen) return;

    session.dialogOpen = true;
    dialog
      .showMessageBox(win, {
        type: "warning",
        title: "Test in progress",
        message: "You can't close Athena during the test.",
        detail: "Use End Test to submit your answers first.",
        buttons: ["OK"],
      })
      .finally(() => {
        session.dialogOpen = false;
      });
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

// The running session is mirrored to this file after every change, so if
// Athena crashes or is force quit the student comes back to the same exam
// (same timer, answers and warnings) instead of a fresh one.
function getSessionFile() {
  return path.join(getDataDir("sessions"), "active.json");
}

function saveSession() {
  if (!isExamRunning()) return;

  const data = {
    id: session.id,
    student: session.student,
    startedAt: session.startedAt,
    endTime: session.endTime,
    answers: session.answers,
    flagged: [...session.flagged],
    violations: session.violations,
  };

  // Write then rename, so a crash mid-write can't leave a half-written file.
  const file = getSessionFile();
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2));
  fs.renameSync(`${file}.tmp`, file);
}

function clearSavedSession() {
  fs.rmSync(getSessionFile(), { force: true });
}

function readSavedSession() {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(getSessionFile(), "utf8"));
  } catch {
    return null;
  }

  const valid =
    typeof data?.id === "string" &&
    typeof data.student?.name === "string" &&
    typeof data.student?.rollNumber === "string" &&
    Number.isFinite(data.startedAt) &&
    Number.isFinite(data.endTime);

  return valid ? data : null;
}

// Warning photos share the folder, so only the regular photos are counted.
function countSnapshots(sessionId) {
  try {
    return fs
      .readdirSync(path.join(getDataDir("camera_feed"), sessionId))
      .filter((name) => name.startsWith("photo-")).length;
  } catch {
    return 0;
  }
}

// Picks up a session saved by a previous run. If its time ran out while
// Athena was closed it's submitted straight away; otherwise the exam carries
// on and the restart is logged as a warning.
function restoreSession() {
  const saved = readSavedSession();
  if (!saved) return;

  session.id = saved.id;
  session.student = saved.student;
  session.startedAt = saved.startedAt;
  session.endTime = saved.endTime;
  session.answers = saved.answers ?? {};
  session.flagged = new Set(saved.flagged ?? []);
  session.violations = Array.isArray(saved.violations) ? saved.violations : [];
  session.snapshotCount = countSnapshots(saved.id);

  const remaining = session.endTime - Date.now();
  if (remaining <= 0) {
    finishExam("timeout");
    return;
  }

  session.timeoutHandle = setTimeout(() => finishExam("timeout"), remaining);
  win.kiosk = true;
  recordViolation("app-restarted");
}

// The default menu has Reload, Toggle DevTools and Quit shortcuts. Packaged
// builds keep only the Edit menu so copy and paste still work on macOS.
function setUpMenu() {
  if (isDev) return;

  const menu =
    process.platform === "darwin"
      ? Menu.buildFromTemplate([{ role: "editMenu" }])
      : null;
  Menu.setApplicationMenu(menu);
}

function getDisplayCount() {
  return screen.getAllDisplays().length;
}

function watchDisplays() {
  screen.on("display-added", () => {
    win.webContents.send("displays-changed", getDisplayCount());
    if (REQUIRE_SINGLE_DISPLAY) recordViolation("extra-display");
  });

  screen.on("display-removed", () => {
    win.webContents.send("displays-changed", getDisplayCount());
  });
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

  saveSession();

  const warning = getLatestWarning();
  win.webContents.send("violation", warning);

  if (warning.limitReached) finishExam("violations");
}

// The banner MainExam shows for the most recent warning, or null if there
// hasn't been one.
function getLatestWarning() {
  const count = session.violations.length;
  if (count === 0) return null;

  return {
    violation: session.violations[count - 1],
    count,
    max: MAX_VIOLATIONS,
    limitReached: count >= MAX_VIOLATIONS,
  };
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

  writeResult();
  clearSavedSession();

  // The exam is over, so the student shouldn't be stuck in kiosk mode.
  win.kiosk = false;
  win.webContents.send("exam-finished", session.result);

  return session.result;
}

function getResultPath() {
  return path.join(getDataDir("results"), `${session.id}.json`);
}

function writeResult() {
  fs.writeFileSync(getResultPath(), JSON.stringify(session.result, null, 2));
}

// One folder per exam session, so every snapshot can be traced back to the
// result file with the same name.
function getSnapshotDir() {
  return getDataDir(path.join("camera_feed", session.id));
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
    requireSingleDisplay: REQUIRE_SINGLE_DISPLAY,
  };
});

ipcMain.handle("start-test", (_event, student) => {
  if (session.startedAt !== null) return session.id;

  const name = cleanField(student?.name);
  const rollNumber = cleanField(student?.rollNumber);
  if (!name || !rollNumber) return null;
  if (REQUIRE_SINGLE_DISPLAY && getDisplayCount() > 1) return null;

  session.student = { name, rollNumber };
  session.startedAt = Date.now();
  session.endTime = session.startedAt + EXAM_DURATION_MS;
  session.id = makeSessionId(rollNumber, session.startedAt);
  session.timeoutHandle = setTimeout(
    () => finishExam("timeout"),
    EXAM_DURATION_MS,
  );
  saveSession();

  return session.id;
});

ipcMain.handle("get-display-count", () => getDisplayCount());

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
    warning: getLatestWarning(),
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
  } else {
    if (!Number.isInteger(optionIndex)) return false;
    if (optionIndex < 0 || optionIndex >= q.options.length) return false;

    session.answers[id] = optionIndex;
  }

  saveSession();
  return true;
});

ipcMain.handle("set-flag", (_event, id, flagged) => {
  if (!isExamRunning()) return false;
  if (!questions.some((item) => item.id === id)) return false;

  if (flagged) session.flagged.add(id);
  else session.flagged.delete(id);
  saveSession();
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

function decodeJpeg(image) {
  if (typeof image !== "string" || !image.startsWith(JPEG_PREFIX)) return null;
  return Buffer.from(image.slice(JPEG_PREFIX.length), "base64");
}

ipcMain.handle("save-photo", (_event, image) => {
  if (session.id === null || session.result) return null;

  const data = decodeJpeg(image);
  if (!data) return null;

  const filePath = path.join(getSnapshotDir(), `photo-${Date.now()}.jpg`);
  fs.writeFileSync(filePath, data);
  session.snapshotCount += 1;

  return filePath;
});

// The renderer takes a photo the moment it hears about a warning, so whoever
// reviews the session can see what was going on. `number` is the warning's
// 1-based position in the log; each warning gets at most one photo.
ipcMain.handle("save-warning-photo", (_event, number, image) => {
  const violation = session.violations[number - 1];
  if (!violation || violation.snapshot) return null;

  const data = decodeJpeg(image);
  if (!data) return null;

  const fileName = `warning-${number}-${violation.type}.jpg`;
  fs.writeFileSync(path.join(getSnapshotDir(), fileName), data);
  violation.snapshot = fileName;

  // The last warning can end the exam before its photo arrives. The result
  // shares this violations array, so it's written again and resent.
  if (session.result) {
    writeResult();
    win.webContents.send("exam-finished", session.result);
  } else {
    saveSession();
  }

  return fileName;
});

// These open Finder/Explorer or an image viewer, which would take the
// student out of the exam, so they only work once it's over.
ipcMain.handle("open-snapshots-folder", () => {
  if (!session.result) return;
  shell.openPath(getSnapshotDir());
});

ipcMain.handle("show-result-file", () => {
  if (!session.result) return;
  shell.showItemInFolder(getResultPath());
});

ipcMain.handle("open-warning-photo", (_event, number) => {
  const violation = session.violations[number - 1];
  if (!session.result || !violation?.snapshot) return;
  shell.openPath(path.join(getSnapshotDir(), violation.snapshot));
});

// Two copies of Athena would mean two sessions writing the same files, so a
// second launch just brings the existing window forward.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    nativeTheme.themeSource = "system";
    setUpMenu();
    createWindow();
    watchDisplays();
    restoreSession();
  });
}

app.on("window-all-closed", () => {
  app.quit();
});
