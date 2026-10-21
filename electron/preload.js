const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  setFullScreen: () => ipcRenderer.invoke("full-screen"),
  getRemainingTime: () => ipcRenderer.invoke("get-time"),
  startTest: () => ipcRenderer.invoke("start-test"),
  showRules: () => ipcRenderer.invoke("show-rules"),
  getQuestion: (id) => ipcRenderer.invoke("get-question", id),
  savePhoto: (image) => ipcRenderer.invoke("save-photo", image),
});
