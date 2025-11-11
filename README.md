Universal Electron Thin Client

Universal Electron-based thin client for kiosks and terminals, featuring remote UI support, automatic reconnection, and COM-port peripheral integration.

✅ Features

Remote UI loading (local / LAN / domain)

Automatic reconnect when the server becomes unavailable

Kiosk mode (full-screen, locked UI, PIN-protected exit)

COM-port peripheral integration (serialport)

Secure preload bridge (context isolation, sandbox, no nodeIntegration)

Fallback offline screen

Environment-based configuration

🚀 Getting Started
1. Clone the repository
git clone https://github.com/<yourname>/<repo>.git
cd <repo>

2. Install dependencies
npm install

3. Development modes

Local UI (index.html):

npm run dev:local


Remote UI (LAN dev server):

npm run dev:lan


Remote UI (production domain):

npm run dev:domain


LAN + DevTools enabled:

npm run devtools:lan

⚙️ Environment Variables
Variable	Description	Example
UI_MODE	local or remote	remote
APP_URL	URL of remote UI	http://192.168.1.16:5173
ADMIN_PIN	PIN for kiosk exit	1234
ALLOW_DEVTOOLS	1 = enable DevTools	0
SERIAL_AUTOTEST_PATH	Optional COM port auto-test	/dev/ttyUSB0
SERIAL_AUTOTEST_BAUD	Baud rate	9600
🖥️ Build (optional)

If you later configure a builder (e.g., electron-builder), document build commands here:

npm run build

🔌 COM-port API (Renderer)
await window.serialAPI.list()
await window.serialAPI.open("/dev/ttyUSB0", 9600)
await window.serialAPI.write("ping\n")
await window.serialAPI.close()

🔐 Kiosk Control (Renderer)
const result = await window.native.kioskAskExit();
if (result.ok) console.log("Exited kiosk mode");

📂 Project Structure
/main.js            → Electron main process  
/preload.js         → Secure IPC bridge  
/index.html         → Offline fallback UI  
/pin.html           → PIN modal  
/peripherals/       → Serial abstractions  

✅ License

MIT License
