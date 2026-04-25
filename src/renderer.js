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
const themeToggleButton = document.getElementById("theme-toggle-button");
const themeToggleLabel = document.getElementById("theme-toggle-label");
const broadcastMessageInput = document.getElementById("broadcast-message-input");
const sendMessageButton = document.getElementById("send-message-button");
const helpButton = document.getElementById("help-button");
const helpCommandInput = document.getElementById("help-command-input");
const refreshPlayersButton = document.getElementById("refresh-players-button");
const playersOutput = document.getElementById("players-output");
const kickPlayerIdInput = document.getElementById("kick-player-id");
const kickReasonInput = document.getElementById("kick-reason");
const kickPlayerButton = document.getElementById("kick-player-button");
const managePlayerIdInput = document.getElementById("manage-player-id");
const unbanPlayerButton = document.getElementById("unban-player-button");
const removeRoleButton = document.getElementById("remove-role-button");
const listMapsButton = document.getElementById("list-maps-button");
const listRotationsButton = document.getElementById("list-rotations-button");
const mapsOutput = document.getElementById("maps-output");
const loadMapSelect = document.getElementById("load-map-select");
const loadMapButton = document.getElementById("load-map-button");
const nextMapSelect = document.getElementById("next-map-select");
const nextMapButton = document.getElementById("next-map-button");
const rotationNameSelect = document.getElementById("rotation-name-select");
const setRotationButton = document.getElementById("set-rotation-button");

const PLAYER_LIST_REFRESH_MS = 30_000;
const EMPTY_MAP_OPTION = "请先查询地图列表";
const EMPTY_ROTATION_OPTION = "请先查询地图池列表";
const THEME_STORAGE_KEY = "rcon83-theme";

const playerControls = [
  helpButton,
  helpCommandInput,
  refreshPlayersButton,
  kickPlayerIdInput,
  kickReasonInput,
  kickPlayerButton,
  managePlayerIdInput,
  unbanPlayerButton,
  removeRoleButton,
];

const mapControls = [
  listMapsButton,
  listRotationsButton,
  loadMapSelect,
  loadMapButton,
  nextMapSelect,
  nextMapButton,
  rotationNameSelect,
  setRotationButton,
];

const sideControls = [broadcastMessageInput, sendMessageButton];

const statusTextMap = {
  disconnected: "未连接",
  connecting: "连接中",
  connected: "已连接",
  error: "连接失败",
};

let playerListRefreshTimer = null;
let playerListRefreshInFlight = false;

function getFormConfig() {
  return {
    host: hostInput.value.trim(),
    port: Number(portInput.value),
    password: passwordInput.value,
  };
}

function nowText() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

function applyTheme(theme) {
  const nextTheme = theme === "light" ? "light" : "dark";
  document.body.dataset.theme = nextTheme;
  themeToggleLabel.textContent = nextTheme === "light" ? "白天" : "夜间";
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
}

function initializeTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || "dark";
  applyTheme(savedTheme);
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

function addLocalLog(level, message) {
  addLog({
    level,
    time: nowText(),
    message,
  });
}

function setControlsDisabled(controls, disabled) {
  controls.forEach((control) => {
    control.disabled = disabled;
  });
}

function stopPlayerListAutoRefresh() {
  if (playerListRefreshTimer) {
    clearInterval(playerListRefreshTimer);
    playerListRefreshTimer = null;
  }
}

function normalizeListText(rawText) {
  return String(rawText || "").replace(/\r/g, "");
}

function parseSelectableItems(rawText) {
  const text = normalizeListText(rawText);
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const values = [];
  const pushValue = (value) => {
    const cleaned = value
      .trim()
      .replace(/^[-*]\s*/, "")
      .replace(/^\d+[\).\s-]+/, "")
      .trim();

    if (!cleaned) {
      return;
    }

    const lower = cleaned.toLowerCase();
    if (
      lower.startsWith("listing ") ||
      lower.startsWith("available ") ||
      lower.startsWith("current ") ||
      lower.startsWith("process ")
    ) {
      return;
    }

    values.push(cleaned);
  };

  if (lines.length <= 1) {
    const singleLine = lines[0] || text.trim();
    const payload = singleLine.includes(":")
      ? singleLine.slice(singleLine.lastIndexOf(":") + 1)
      : singleLine;

    payload
      .split(/[,;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach(pushValue);
  } else {
    lines.forEach((line) => {
      if (line.includes(":") && /[,;]+/.test(line)) {
        line
          .slice(line.lastIndexOf(":") + 1)
          .split(/[,;]+/)
          .map((item) => item.trim())
          .filter(Boolean)
          .forEach(pushValue);
        return;
      }

      pushValue(line);
    });
  }

  return [...new Set(values)];
}

function resetSelect(select, placeholder) {
  select.innerHTML = "";
  const option = document.createElement("option");
  option.value = "";
  option.textContent = placeholder;
  select.append(option);
  select.value = "";
}

function fillSelect(select, items, placeholder) {
  resetSelect(select, placeholder);
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    select.append(option);
  });
}

async function refreshPlayerList({ silent = false } = {}) {
  if (playerListRefreshInFlight) {
    return;
  }

  playerListRefreshInFlight = true;
  try {
    const result = await window.rconApp.runCommand("listPlayers", {});
    if (!result.ok) {
      if (!silent) {
        addLocalLog("error", "玩家列表刷新失败。");
      }
      return;
    }

    playersOutput.textContent = result.data?.trim() || "命令已执行，但没有返回内容。";
    if (!silent) {
      addLocalLog("success", "玩家列表已刷新。");
    }
  } finally {
    playerListRefreshInFlight = false;
  }
}

async function refreshMapsList() {
  const result = await window.rconApp.runCommand("listMaps", {});
  if (!result.ok) {
    addLocalLog("error", "地图列表刷新失败。");
    return;
  }

  const output = result.data?.trim() || "命令已执行，但没有返回内容。";
  mapsOutput.textContent = output;
  const items = parseSelectableItems(output);
  fillSelect(loadMapSelect, items, EMPTY_MAP_OPTION);
  fillSelect(nextMapSelect, items, EMPTY_MAP_OPTION);
  addLocalLog("success", `地图列表已刷新，共解析 ${items.length} 项。`);
}

async function refreshRotationsList() {
  const result = await window.rconApp.runCommand("listMapRotations", {});
  if (!result.ok) {
    addLocalLog("error", "地图池列表刷新失败。");
    return;
  }

  const output = result.data?.trim() || "命令已执行，但没有返回内容。";
  mapsOutput.textContent = output;
  const items = parseSelectableItems(output);
  fillSelect(rotationNameSelect, items, EMPTY_ROTATION_OPTION);
  addLocalLog("success", `地图池列表已刷新，共解析 ${items.length} 项。`);
}

function startPlayerListAutoRefresh() {
  stopPlayerListAutoRefresh();
  playerListRefreshTimer = setInterval(() => {
    refreshPlayerList({ silent: true });
  }, PLAYER_LIST_REFRESH_MS);
}

function resetOutputs() {
  playersOutput.textContent = "连接后可获取玩家列表或查询 help。";
  mapsOutput.textContent = "连接后可获取地图列表和地图池。";
  broadcastMessageInput.value = "";
  resetSelect(loadMapSelect, EMPTY_MAP_OPTION);
  resetSelect(nextMapSelect, EMPTY_MAP_OPTION);
  resetSelect(rotationNameSelect, EMPTY_ROTATION_OPTION);
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
  setControlsDisabled(sideControls, !isConnected);
  setControlsDisabled(playerControls, !isConnected);
  setControlsDisabled(mapControls, !isConnected);

  if (isConnected) {
    startPlayerListAutoRefresh();
    refreshPlayerList({ silent: true });
    return;
  }

  stopPlayerListAutoRefresh();
  resetOutputs();
}

function validateForSave(config) {
  if (!config.host) {
    addLocalLog("error", "保存失败: 请填写服务器 IP。");
    return false;
  }

  if (!Number.isInteger(config.port) || config.port <= 0 || config.port > 65535) {
    addLocalLog("error", "保存失败: RCON 端口必须是 1 到 65535 之间的整数。");
    return false;
  }

  if (!config.password) {
    addLocalLog("error", "保存失败: 请填写 RCON 密码。");
    return false;
  }

  return true;
}

async function initialize() {
  initializeTheme();

  const savedConfig = await window.rconApp.loadConfig();
  hostInput.value = savedConfig.host || "";
  portInput.value = savedConfig.port || "";
  passwordInput.value = savedConfig.password || "";

  setConnectionState(await window.rconApp.getConnectionState());

  window.rconApp.onLogMessage(addLog);
  window.rconApp.onConnectionStateChange(setConnectionState);

  addLocalLog("info", "工具已启动，请填写或确认连接配置。");
}

async function handleCommand(commandKey, payload, successMessage, outputTarget) {
  const result = await window.rconApp.runCommand(commandKey, payload);
  if (!result.ok) {
    return;
  }

  if (outputTarget) {
    outputTarget.textContent = result.data?.trim() || "命令已执行，但没有返回内容。";
  }

  if (successMessage) {
    addLocalLog("success", successMessage);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await window.rconApp.connect(getFormConfig());
});

themeToggleButton.addEventListener("click", () => {
  const nextTheme = document.body.dataset.theme === "light" ? "dark" : "light";
  applyTheme(nextTheme);
});

disconnectButton.addEventListener("click", async () => {
  stopPlayerListAutoRefresh();
  await window.rconApp.disconnect();
});

saveButton.addEventListener("click", async () => {
  const config = getFormConfig();
  if (!validateForSave(config)) {
    return;
  }

  await window.rconApp.saveConfig(config);
  addLocalLog("success", "配置已保存，下次启动会自动回填。");
});

sendMessageButton.addEventListener("click", async () => {
  const messageText = broadcastMessageInput.value.trim();
  if (!messageText) {
    addLocalLog("error", "请填写广播消息内容。");
    return;
  }

  await handleCommand(
    "sendMessage",
    { messageText },
    "全服广播消息已发送。",
  );
});

helpButton.addEventListener("click", async () => {
  const commandName = helpCommandInput.value.trim();
  await handleCommand(
    "help",
    { commandName },
    commandName ? `已获取 ${commandName} 的帮助信息。` : "已获取 help 命令列表。",
    playersOutput,
  );
});

refreshPlayersButton.addEventListener("click", async () => {
  await refreshPlayerList();
});

kickPlayerButton.addEventListener("click", async () => {
  const playerId = kickPlayerIdInput.value.trim();
  const reason = kickReasonInput.value.trim();

  if (!playerId) {
    addLocalLog("error", "请填写玩家 ID。");
    return;
  }

  if (!reason) {
    addLocalLog("error", "请填写踢出原因。");
    return;
  }

  if (!window.confirm(`确认踢出并封禁玩家 ${playerId} 吗？`)) {
    return;
  }

  await handleCommand(
    "kickPlayer",
    { playerId, reason },
    `已发送踢出并封禁玩家 ${playerId} 的请求。`,
  );
});

unbanPlayerButton.addEventListener("click", async () => {
  const playerId = managePlayerIdInput.value.trim();
  if (!playerId) {
    addLocalLog("error", "请填写玩家 ID。");
    return;
  }

  if (!window.confirm(`确认解除玩家 ${playerId} 的封禁吗？`)) {
    return;
  }

  await handleCommand(
    "unbanPlayer",
    { playerId },
    `已发送解除封禁请求: ${playerId}。`,
  );
});

removeRoleButton.addEventListener("click", async () => {
  const playerId = managePlayerIdInput.value.trim();
  if (!playerId) {
    addLocalLog("error", "请填写玩家 ID。");
    return;
  }

  if (!window.confirm(`确认移除玩家 ${playerId} 的当前角色吗？`)) {
    return;
  }

  await handleCommand(
    "removePlayerRole",
    { playerId },
    `已发送移除角色请求: ${playerId}。`,
  );
});

listMapsButton.addEventListener("click", async () => {
  await refreshMapsList();
});

listRotationsButton.addEventListener("click", async () => {
  await refreshRotationsList();
});

loadMapButton.addEventListener("click", async () => {
  const mapName = loadMapSelect.value.trim();
  if (!mapName) {
    addLocalLog("error", "请先从地图列表中选择地图。");
    return;
  }

  if (!window.confirm(`确认立即加载地图 ${mapName} 吗？`)) {
    return;
  }

  await handleCommand(
    "loadMap",
    { mapName },
    `已发送立即加载地图请求: ${mapName}。`,
  );
});

nextMapButton.addEventListener("click", async () => {
  const mapName = nextMapSelect.value.trim();
  if (!mapName) {
    addLocalLog("error", "请先从地图列表中选择下一张地图。");
    return;
  }

  await handleCommand(
    "setNextMap",
    { mapName },
    `已设置下一张地图: ${mapName}。`,
  );
});

setRotationButton.addEventListener("click", async () => {
  const rotationName = rotationNameSelect.value.trim();
  if (!rotationName) {
    addLocalLog("error", "请先从地图池列表中选择地图池。");
    return;
  }

  if (!window.confirm(`确认切换地图池为 ${rotationName} 吗？`)) {
    return;
  }

  await handleCommand(
    "setMapRotation",
    { rotationName },
    `已发送切换地图池请求: ${rotationName}。`,
  );
});

clearLogButton.addEventListener("click", () => {
  logList.innerHTML = "";
});

initialize();
