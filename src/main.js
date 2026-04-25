const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const path = require("node:path");

const {
  connect,
  disconnect,
  getConnectionState,
  onLogMessage,
  onConnectionStateChange,
  runCommand,
} = require("./rconService");
const { loadConfig, saveConfig } = require("./configStore");

let mainWindow;

function broadcast(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function createWindow() {
  Menu.setApplicationMenu(null);
  const windowIcon = path.join(__dirname, "..", "assets", "icon.png");

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 920,
    minHeight: 680,
    icon: windowIcon,
    backgroundColor: "#11151b",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  onLogMessage((entry) => broadcast("log-message", entry));
  onConnectionStateChange((state) =>
    broadcast("connection-state-change", state),
  );

  ipcMain.handle("config:load", async () => loadConfig());
  ipcMain.handle("config:save", async (_, config) => saveConfig(config));
  ipcMain.handle("rcon:get-state", async () => getConnectionState());
  ipcMain.handle("rcon:connect", async (_, config) => connect(config));
  ipcMain.handle("rcon:disconnect", async () => disconnect());
  ipcMain.handle("rcon:run-command", async (_, commandKey, payload) =>
    runCommand(commandKey, payload),
  );

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  await disconnect();
});
