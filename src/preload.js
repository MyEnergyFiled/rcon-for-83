const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("rconApp", {
  loadConfig: () => ipcRenderer.invoke("config:load"),
  saveConfig: (config) => ipcRenderer.invoke("config:save", config),
  getConnectionState: () => ipcRenderer.invoke("rcon:get-state"),
  connect: (config) => ipcRenderer.invoke("rcon:connect", config),
  disconnect: () => ipcRenderer.invoke("rcon:disconnect"),
  onLogMessage: (callback) => {
    const handler = (_, payload) => callback(payload);
    ipcRenderer.on("log-message", handler);
    return () => ipcRenderer.removeListener("log-message", handler);
  },
  onConnectionStateChange: (callback) => {
    const handler = (_, payload) => callback(payload);
    ipcRenderer.on("connection-state-change", handler);
    return () => ipcRenderer.removeListener("connection-state-change", handler);
  },
});
