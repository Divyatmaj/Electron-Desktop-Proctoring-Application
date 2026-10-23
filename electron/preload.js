const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  setFullScreen: () => ipcRenderer.invoke("full-screen"),
  minimizeWindow: () => ipcRenderer.invoke("window-minimize"),
  getExamInfo: () => ipcRenderer.invoke("get-exam-info"),
  getDisplayCount: () => ipcRenderer.invoke("get-display-count"),
  getRemainingTime: () => ipcRenderer.invoke("get-time"),
  startTest: (student) => ipcRenderer.invoke("start-test", student),
  getSession: () => ipcRenderer.invoke("get-session"),
  getQuestion: (id) => ipcRenderer.invoke("get-question", id),
  saveAnswer: (id, optionIndex) =>
    ipcRenderer.invoke("save-answer", id, optionIndex),
  setFlag: (id, flagged) => ipcRenderer.invoke("set-flag", id, flagged),
  confirmEndTest: () => ipcRenderer.invoke("confirm-end-test"),
  submitTest: () => ipcRenderer.invoke("submit-test"),
  savePhoto: (image) => ipcRenderer.invoke("save-photo", image),
  saveWarningPhoto: (number, image) =>
    ipcRenderer.invoke("save-warning-photo", number, image),
  openSnapshotsFolder: () => ipcRenderer.invoke("open-snapshots-folder"),
  showResultFile: () => ipcRenderer.invoke("show-result-file"),
  openWarningPhoto: (number) =>
    ipcRenderer.invoke("open-warning-photo", number),
  reportViolation: (type) => ipcRenderer.invoke("report-violation", type),
  // Returns an unsubscribe function so React effects can clean up.
  onViolation: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("violation", listener);
    return () => ipcRenderer.removeListener("violation", listener);
  },
  onDisplaysChanged: (callback) => {
    const listener = (_event, count) => callback(count);
    ipcRenderer.on("displays-changed", listener);
    return () => ipcRenderer.removeListener("displays-changed", listener);
  },
  onExamFinished: (callback) => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on("exam-finished", listener);
    return () => ipcRenderer.removeListener("exam-finished", listener);
  },
  quitApp: () => ipcRenderer.invoke("quit-app"),
});
