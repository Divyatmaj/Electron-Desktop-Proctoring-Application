const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  setFullScreen: () => ipcRenderer.invoke("full-screen"),
  minimizeWindow: () => ipcRenderer.invoke("window-minimize"),
  getExamInfo: () => ipcRenderer.invoke("get-exam-info"),
  getRemainingTime: () => ipcRenderer.invoke("get-time"),
  startTest: () => ipcRenderer.invoke("start-test"),
  getQuestion: (id) => ipcRenderer.invoke("get-question", id),
  confirmEndTest: (unanswered) =>
    ipcRenderer.invoke("confirm-end-test", unanswered),
  submitTest: (answers, reason) =>
    ipcRenderer.invoke("submit-test", answers, reason),
  savePhoto: (image) => ipcRenderer.invoke("save-photo", image),
  quitApp: () => ipcRenderer.invoke("quit-app"),
});
