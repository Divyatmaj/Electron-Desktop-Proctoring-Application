const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  setFullScreen: () => ipcRenderer.invoke("full-screen"),
  minimizeWindow: () => ipcRenderer.invoke("window-minimize"),
  getExamInfo: () => ipcRenderer.invoke("get-exam-info"),
  getRemainingTime: () => ipcRenderer.invoke("get-time"),
  startTest: (student) => ipcRenderer.invoke("start-test", student),
  getQuestion: (id) => ipcRenderer.invoke("get-question", id),
  confirmEndTest: (unanswered) =>
    ipcRenderer.invoke("confirm-end-test", unanswered),
  submitTest: (answers, reason) =>
    ipcRenderer.invoke("submit-test", answers, reason),
  savePhoto: (image) => ipcRenderer.invoke("save-photo", image),
  reportViolation: (type) => ipcRenderer.invoke("report-violation", type),
  // Returns an unsubscribe function so React effects can clean up.
  onViolation: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("violation", listener);
    return () => ipcRenderer.removeListener("violation", listener);
  },
  quitApp: () => ipcRenderer.invoke("quit-app"),
});
