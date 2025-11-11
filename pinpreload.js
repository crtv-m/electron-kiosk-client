// pinpreload.cjs (CommonJS)
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pinAPI", {
    submit: (pin) => ipcRenderer.invoke("pin:submit", pin),
    cancel: () => ipcRenderer.invoke("pin:cancel")
});