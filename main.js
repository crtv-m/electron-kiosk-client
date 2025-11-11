import { app, BrowserWindow, screen, ipcMain, session } from "electron";
import { fileURLToPath } from "url";
import path from "path";
import url from "node:url";
import * as Serial from "./peripherals/serial.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const ADMIN_PIN = process.env.ADMIN_PIN || "1234";
const UI_MODE   = process.env.UI_MODE || "remote";
const APP_URL   = process.env.APP_URL || "http://127.0.0.1:5173";
const ALLOW_DEVTOOLS = process.env.ALLOW_DEVTOOLS === "1";
const SERIAL_PATH = process.env.SERIAL_AUTOTEST_PATH || "";
const SERIAL_BAUD = Number(process.env.SERIAL_AUTOTEST_BAUD || "9600");

let win = null;
let pinWin = null;
let monitorId = null; // таймер переподключения

const APP_ORIGIN = (() => {
    try { return new url.URL(UI_MODE === "remote" ? APP_URL : "file://").origin; }
    catch { return "null"; }
})();

if (!app.requestSingleInstanceLock()) app.quit();
app.disableHardwareAcceleration();

function enterKiosk(w) {
    const { bounds } = screen.getPrimaryDisplay();
    w.setBounds(bounds, false);
    w.maximize();
    w.setFullScreen(true);
    w.setKiosk(true);
    w.setAlwaysOnTop(true, "screen-saver");
    w.show(); w.focus();
}

// простая отправка статуса в рендер
function status(msg) { win && win.webContents.send("status:message", String(msg)); }

// HEAD-пинг с таймаутом
async function isServerUp() {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 5000);
    try {
        const res = await fetch(APP_URL, { method: "HEAD", signal: ac.signal });
        return res.ok;
    } catch { return false; }
    finally { clearTimeout(t); }
}

// монитор: раз в минуту пытаемся переподключиться
function startMonitor() {
    if (monitorId) return;
    status("Нет связи с сервером. Повтор через 60 сек…");
    monitorId = setInterval(async () => {
        status("Пытаемся подключиться к серверу…");
        if (await isServerUp()) {
            status("Связь восстановлена. Загружаем приложение…");
            clearInterval(monitorId); monitorId = null;
            win && win.loadURL(APP_URL);
        } else {
            status("Сервер недоступен. Следующая попытка через 60 сек.");
        }
    }, 60_000);
}

async function openPinModal(parent) {
    if (pinWin) return;
    pinWin = new BrowserWindow({
        parent, modal: true, show: false, width: 360, height: 220,
        resizable: false, frame: false, alwaysOnTop: true, backgroundColor: "#111",
        webPreferences: {
            preload: path.join(__dirname, "pinpreload.js"),
            contextIsolation: true, nodeIntegration: false, sandbox: true
        }
    });
    pinWin.on("closed", () => { pinWin = null; });
    await pinWin.loadFile(path.join(__dirname, "pin.html"));
    pinWin.show(); pinWin.focus();
}

function createWindow() {
    const { bounds } = screen.getPrimaryDisplay();
    win = new BrowserWindow({
        show: false,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        autoHideMenuBar: false,
        backgroundColor: "#000",
        fullscreen: false,
        kiosk: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            devTools: 1
        }
    });

    // грузим удалённый UI или локальный
    if (UI_MODE === "remote") win.loadURL(APP_URL);
    else win.loadFile(path.join(__dirname, "index.html"));

    // CSP/COOP/COEP/CORP
    session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
        const csp = [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data:",
            "connect-src 'self' " + (UI_MODE === "remote" ? new url.URL(APP_URL).origin : ""),
            "object-src 'none'",
            "frame-ancestors 'none'",
            "base-uri 'none'"
        ].join("; ");
        cb({ responseHeaders: {
                ...details.responseHeaders,
                "Content-Security-Policy": [csp],
                "Cross-Origin-Opener-Policy": ["same-origin"],
                "Cross-Origin-Embedder-Policy": ["require-corp"],
                "Cross-Origin-Resource-Policy": ["same-origin"]
            }});
    });

    // защита навигации/окон
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (e, targetUrl) => {
        const origin = new url.URL(targetUrl).origin;
        if (origin !== APP_ORIGIN && origin !== "file://") e.preventDefault();
    });

    // devtools/off
    if (!ALLOW_DEVTOOLS) {
        win.webContents.on("context-menu", (e) => e.preventDefault());
        win.webContents.on("before-input-event", (e, input) => {
            const combo = ((input.control || input.meta) && input.shift && input.key.toUpperCase() === "I") || input.key === "F12";
            if (combo) e.preventDefault();
        });
    }

    // возврат в киоск и оффлайн-режим
    win.once("ready-to-show", () => enterKiosk(win));

    // если удалённый UI не загрузился — показываем локальную заглушку и стартуем монитор
    win.webContents.on("did-fail-load", () => {
        status("Не удалось загрузить серверный UI. Переходим в оффлайн-страницу.");
        win.loadFile(path.join(__dirname, "index.html")).then(() => startMonitor());
    });

    // защита permissions
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
}

/* ---------- Kiosk IPC ---------- */
ipcMain.handle("kiosk:ask-exit", async () => {
    if (!win) return { ok: false };
    win.setAlwaysOnTop(false); win.setKiosk(false); win.setFullScreen(false);
    await openPinModal(win);
    return { ok: false };
});
ipcMain.handle("pin:submit", (_e, pin) => {
    const ok = String(pin || "") === String(ADMIN_PIN);
    if (pinWin) { pinWin.close(); pinWin = null; }
    if (ok && win) { win.setKiosk(false); win.setFullScreen(false); win.setAlwaysOnTop(false); }
    else if (win) { enterKiosk(win); }
    win && win.webContents.send("pin:result", ok);
    return { ok };
});
ipcMain.handle("pin:cancel", () => {
    if (pinWin) { pinWin.close(); pinWin = null; }
    if (win) enterKiosk(win);
    win && win.webContents.send("pin:result", false);
    return { ok: false };
});
ipcMain.handle("kiosk:enter", () => { if (!win) return { ok: false }; enterKiosk(win); return { ok: true }; });

/* ---------- Serial IPC (без UI) ---------- */
ipcMain.handle("serial:list", async () => Serial.list());
ipcMain.handle("serial:open", async (_e, { path, baudRate }) => Serial.open(path, baudRate));
ipcMain.handle("serial:write", async (_e, data) => Serial.write(data));
ipcMain.handle("serial:close", async () => Serial.close());

async function maybeAutoTestSerial() {
    if (!SERIAL_PATH) return;
    try { await Serial.open(SERIAL_PATH, SERIAL_BAUD); await Serial.write("ping\n"); }
    catch (e) { console.error("[SERIAL-AUTOTEST]", e?.message || e); }
}

app.whenReady().then(async () => {
    createWindow();
    await maybeAutoTestSerial();

    // Если UI удалённый — сразу проверим доступность и при необходимости включим монитор
    if (UI_MODE === "remote" && !(await isServerUp())) {
        status("Сервер не отвечает. Переходим в оффлайн-страницу.");
        await win.loadFile(path.join(__dirname, "index.html"));
        startMonitor();
    }

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});
app.on("second-instance", () => { if (win) { win.show(); win.focus(); } });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
