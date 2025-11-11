// Мост: киоск + статусы + COM. nodeIntegration=false.
const { contextBridge, ipcRenderer } = require("electron");

// Kiosk API (колбэки остаются)
contextBridge.exposeInMainWorld("native", {
    kioskAskExit: async () => {
        await ipcRenderer.invoke("kiosk:ask-exit");
        return new Promise((resolve) => {
            ipcRenderer.once("pin:result", (_e, ok) => resolve({ ok }));
        });
    },
    kioskEnter: () => ipcRenderer.invoke("kiosk:enter"),
    onStatus: (cb) => { // подписка на статусы монитора
        const handler = (_e, msg) => cb && cb(msg);
        ipcRenderer.on("status:message", handler);
        return () => ipcRenderer.off("status:message", handler);
    }
});

// COM (без UI)
contextBridge.exposeInMainWorld("serialAPI", {
    list: () => ipcRenderer.invoke("serial:list"),
    open: (path, baudRate) => ipcRenderer.invoke("serial:open", { path, baudRate }),
    write: (data) => ipcRenderer.invoke("serial:write", data),
    close: () => ipcRenderer.invoke("serial:close")
});
