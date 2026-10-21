const { BrowserWindow, app, ipcMain, dialog, nativeTheme } = require("electron");
const path = require("path");
const fs = require("fs");

const questions = require("./data/questions.json");

const DEV_SERVER_URL = "http://127.0.0.1:5173/";
const EXAM_DURATION_MS = 60 * 60 * 1000;

const isDev = process.argv.includes("--dev");

let win = null;
let endTime = null;

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

// Snapshots live in the per-user data folder so they still save once the
// app is packaged (the app's own folder is read-only there).
function getCameraFeedDir() {
  const dir = path.join(app.getPath("userData"), "camera_feed");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

ipcMain.handle("full-screen", () => {
  win.kiosk = true;
});

ipcMain.handle("start-test", () => {
  endTime = Date.now() + EXAM_DURATION_MS;
});

ipcMain.handle("get-time", () => {
  if (endTime === null) return 0;
  return Math.max(0, endTime - Date.now());
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

ipcMain.handle("get-question", (_event, id) => {
  return questions.find((q) => q.id === id) ?? null;
});

ipcMain.handle("save-photo", (_event, image) => {
  const imageData = image.split(",")[1];

  const filePath = path.join(getCameraFeedDir(), `photo-${Date.now()}.png`);
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
