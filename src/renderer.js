const form = document.getElementById("connection-form");
const hostInput = document.getElementById("host");
const portInput = document.getElementById("port");
const passwordInput = document.getElementById("password");
const connectButton = document.getElementById("connect-button");
const disconnectButton = document.getElementById("disconnect-button");
const saveButton = document.getElementById("save-button");
const clearLogButton = document.getElementById("clear-log-button");
const statusCard = document.getElementById("status-card");
const connectionStatus = document.getElementById("connection-status");
const logList = document.getElementById("log-list");

const statusTextMap = {
  disconnected: "未连接",
  connecting: "连接中",
  connected: "已连接",
  error: "连接失败",
};

function getFormConfig() {
  return {
    host: hostInput.value.trim(),
    port: Number(portInput.value),
    password: passwordInput.value,
  };
}

function addLog(entry) {
  const item = document.createElement("article");
  item.className = `log-entry log-${entry.level || "info"}`;

  const timestamp = document.createElement("span");
  timestamp.className = "log-time";
  timestamp.textContent = entry.time || "";

  const message = document.createElement("p");
  message.className = "log-message";
  message.textContent = entry.message || "";

  item.append(timestamp, message);
  logList.prepend(item);
}

function setConnectionState(state) {
  const status = state?.status || "disconnected";
  statusCard.dataset.status = status;
  connectionStatus.textContent = state?.message || statusTextMap[status] || "未知状态";

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  connectButton.disabled = isConnecting || isConnected;
  disconnectButton.disabled = !isConnected && !isConnecting;
  hostInput.disabled = isConnecting || isConnected;
  portInput.disabled = isConnecting || isConnected;
  passwordInput.disabled = isConnecting || isConnected;
}

function validateForSave(config) {
  if (!config.host) {
    addLog({
      level: "error",
      time: new Date().toLocaleString("zh-CN", { hour12: false }),
      message: "保存失败: 请填写服务器 IP。",
    });
    return false;
  }

  if (!Number.isInteger(config.port) || config.port <= 0 || config.port > 65535) {
    addLog({
      level: "error",
      time: new Date().toLocaleString("zh-CN", { hour12: false }),
      message: "保存失败: RCON 端口必须是 1 到 65535 之间的整数。",
    });
    return false;
  }

  if (!config.password) {
    addLog({
      level: "error",
      time: new Date().toLocaleString("zh-CN", { hour12: false }),
      message: "保存失败: 请填写 RCON 密码。",
    });
    return false;
  }

  return true;
}

async function initialize() {
  const savedConfig = await window.rconApp.loadConfig();
  hostInput.value = savedConfig.host || "";
  portInput.value = savedConfig.port || "";
  passwordInput.value = savedConfig.password || "";

  setConnectionState(await window.rconApp.getConnectionState());

  window.rconApp.onLogMessage(addLog);
  window.rconApp.onConnectionStateChange(setConnectionState);

  addLog({
    level: "info",
    time: new Date().toLocaleString("zh-CN", { hour12: false }),
    message: "工具已启动，请填写或确认连接配置。",
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const config = getFormConfig();
  await window.rconApp.connect(config);
});

disconnectButton.addEventListener("click", async () => {
  await window.rconApp.disconnect();
});

saveButton.addEventListener("click", async () => {
  const config = getFormConfig();
  if (!validateForSave(config)) {
    return;
  }

  await window.rconApp.saveConfig(config);
  addLog({
    level: "success",
    time: new Date().toLocaleString("zh-CN", { hour12: false }),
    message: "配置已保存，下次启动会自动回填。",
  });
});

clearLogButton.addEventListener("click", () => {
  logList.innerHTML = "";
});

initialize();
