const { Rcon } = require("rcon-client");

const listeners = {
  log: new Set(),
  state: new Set(),
};

const commandDefinitions = {
  help: {
    buildCommand: (payload) =>
      payload.commandName ? `help ${payload.commandName}` : "help",
    summary: (payload) =>
      payload.commandName
        ? `查询命令帮助 ${payload.commandName}`
        : "获取帮助命令列表",
  },
  listPlayers: {
    buildCommand: () => "listPlayers",
    summary: () => "获取玩家列表",
  },
  kickPlayer: {
    validate: (payload) => {
      if (!payload.playerId) {
        return "请填写玩家 ID。";
      }
      if (!payload.reason) {
        return "请填写踢出原因。";
      }
      return null;
    },
    buildCommand: (payload) =>
      `kickPlayer ${payload.playerId} "${payload.reason.replace(/"/g, '\\"')}"`,
    summary: (payload) => `踢出并封禁玩家 ${payload.playerId}`,
  },
  unbanPlayer: {
    validate: (payload) => {
      if (!payload.playerId) {
        return "请填写玩家 ID。";
      }
      return null;
    },
    buildCommand: (payload) => `unbanPlayer ${payload.playerId}`,
    summary: (payload) => `解除封禁 ${payload.playerId}`,
  },
  removePlayerRole: {
    validate: (payload) => {
      if (!payload.playerId) {
        return "请填写玩家 ID。";
      }
      return null;
    },
    buildCommand: (payload) => `removePlayerRole ${payload.playerId}`,
    summary: (payload) => `移除玩家角色 ${payload.playerId}`,
  },
  sendMessage: {
    validate: (payload) => {
      if (!payload.messageText) {
        return "请填写广播消息内容。";
      }
      return null;
    },
    buildCommand: (payload) =>
      `sendMessage "${payload.messageText.replace(/"/g, '\\"')}"`,
    summary: () => "发送全服广播消息",
  },
  listMaps: {
    buildCommand: () => "listMaps",
    summary: () => "获取地图列表",
  },
  loadMap: {
    validate: (payload) => {
      if (!payload.mapName) {
        return "请填写地图名称。";
      }
      return null;
    },
    buildCommand: (payload) => `loadMap ${payload.mapName}`,
    summary: (payload) => `立即加载地图 ${payload.mapName}`,
  },
  setNextMap: {
    validate: (payload) => {
      if (!payload.mapName) {
        return "请填写地图名称。";
      }
      return null;
    },
    buildCommand: (payload) => `setNextMap ${payload.mapName}`,
    summary: (payload) => `设置下一张地图 ${payload.mapName}`,
  },
  listMapRotations: {
    buildCommand: () => "listMapRotations",
    summary: () => "获取地图池列表",
  },
  setMapRotation: {
    validate: (payload) => {
      if (!payload.rotationName) {
        return "请填写地图池名称。";
      }
      return null;
    },
    buildCommand: (payload) => `setMapRotation ${payload.rotationName}`,
    summary: (payload) => `切换地图池 ${payload.rotationName}`,
  },
};

let client = null;
let connectionState = {
  status: "disconnected",
  message: "未连接",
};

function formatErrorDetails(error) {
  if (!error) {
    return "无错误对象";
  }

  const parts = [];
  if (error.name) {
    parts.push(`name=${error.name}`);
  }
  if (error.code) {
    parts.push(`code=${error.code}`);
  }
  if (error.errno) {
    parts.push(`errno=${error.errno}`);
  }
  if (error.syscall) {
    parts.push(`syscall=${error.syscall}`);
  }
  if (error.message) {
    parts.push(`message=${error.message}`);
  }

  return parts.join(", ") || String(error);
}

function describeConfig(config) {
  return `host=${config.host}, port=${config.port}, passwordLength=${config.password.length}`;
}

function normalizeConfig(config = {}) {
  const rawHost = String(config.host || "").trim();
  const rawPort = config.port;
  const hostParts = rawHost.split(":").map((part) => part.trim()).filter(Boolean);

  if (hostParts.length <= 1) {
    return {
      host: rawHost,
      port: Number(rawPort),
      password: String(config.password || ""),
      hostPortMismatch: false,
    };
  }

  const host = hostParts[0];
  const embeddedPort = Number(hostParts[hostParts.length - 1]);
  const formPort = Number(rawPort);
  const hasEmbeddedPort = Number.isInteger(embeddedPort);
  const hasFormPort = Number.isInteger(formPort);

  return {
    host,
    port: hasFormPort ? formPort : embeddedPort,
    password: String(config.password || ""),
    hostPortMismatch:
      hasEmbeddedPort && hasFormPort && embeddedPort !== formPort,
  };
}

function emitLog(level, message) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    level,
    message,
    time: new Date().toLocaleString("zh-CN", { hour12: false }),
  };

  listeners.log.forEach((listener) => listener(entry));
}

function emitState(nextState) {
  connectionState = nextState;
  listeners.state.forEach((listener) => listener(connectionState));
}

function onLogMessage(listener) {
  listeners.log.add(listener);
}

function onConnectionStateChange(listener) {
  listeners.state.add(listener);
}

function getConnectionState() {
  return connectionState;
}

function validateConfig(config) {
  if (!config || typeof config !== "object") {
    return "配置不能为空。";
  }

  if (config.hostPortMismatch) {
    return "服务器 IP 中包含的端口与 RCON 端口输入框不一致，请只填写纯 IP，端口单独填在 RCON 端口里。";
  }

  if (!config.host || !String(config.host).trim()) {
    return "请填写服务器 IP。";
  }

  const port = Number(config.port);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return "RCON 端口必须是 1 到 65535 之间的整数。";
  }

  if (!config.password || !String(config.password).trim()) {
    return "请填写 RCON 密码。";
  }

  return null;
}

function mapConnectionError(error) {
  const message = error?.message || "未知错误";
  const lower = message.toLowerCase();

  if (
    lower.includes("auth") ||
    lower.includes("password") ||
    lower.includes("login")
  ) {
    return "认证失败，请检查 RCON 密码是否正确。";
  }

  if (lower.includes("timed out") || lower.includes("timeout")) {
    return "连接超时，请检查服务器 IP 和端口是否可达。";
  }

  if (
    lower.includes("econnrefused") ||
    lower.includes("refused") ||
    lower.includes("ehostunreach") ||
    lower.includes("enotfound")
  ) {
    return "无法连接到服务器，请检查 IP、端口或网络状态。";
  }

  return `连接失败: ${message}`;
}

function mapCommandError(error) {
  const message = error?.message || "未知错误";
  return `命令执行失败: ${message}`;
}

async function disconnect() {
  if (!client) {
    emitState({
      status: "disconnected",
      message: "未连接",
    });
    return { ok: true };
  }

  try {
    client.end();
    emitLog("info", "已断开与 RCON 服务器的连接。");
  } catch (error) {
    emitLog("error", `断开连接时出现异常: ${error.message}`);
  } finally {
    client = null;
    emitState({
      status: "disconnected",
      message: "未连接",
    });
  }

  return { ok: true };
}

async function connect(config) {
  const normalizedConfig = normalizeConfig(config);
  const validationError = validateConfig(normalizedConfig);
  if (validationError) {
    emitLog("error", validationError);
    emitState({
      status: "error",
      message: validationError,
    });
    return { ok: false, error: validationError };
  }

  await disconnect();

  emitState({
    status: "connecting",
    message: "连接中",
  });
  emitLog(
    "info",
    `正在连接 ${normalizedConfig.host}:${Number(normalizedConfig.port)} ...`,
  );
  emitLog("info", `调试: 连接参数 ${describeConfig(normalizedConfig)}`);

  try {
    const nextClient = new Rcon({
      host: normalizedConfig.host,
      port: Number(normalizedConfig.port),
      password: normalizedConfig.password,
      timeout: 5000,
    });

    nextClient.on("connect", () => {
      emitLog("info", "调试: TCP 连接已建立，等待 RCON 认证。");
    });

    nextClient.on("authenticated", () => {
      emitLog("info", "调试: RCON 认证通过。");
    });

    nextClient.on("end", () => {
      client = null;
      emitState({
        status: "disconnected",
        message: "未连接",
      });
      emitLog("warning", "RCON 连接已关闭。");
      emitLog("warning", "调试: 收到 end 事件，连接被本地或服务端关闭。");
    });

    nextClient.on("error", (error) => {
      emitLog("error", `连接出现异常: ${mapConnectionError(error)}`);
      emitLog("error", `调试: 底层错误详情: ${formatErrorDetails(error)}`);
      emitState({
        status: "error",
        message: "连接异常",
      });
    });

    await nextClient.connect();
    client = nextClient;

    emitState({
      status: "connected",
      message: "已连接",
    });
    emitLog("success", "连接成功，已建立 RCON 会话。");

    return { ok: true };
  } catch (error) {
    client = null;
    const friendlyError = mapConnectionError(error);

    emitState({
      status: "error",
      message: "连接失败",
    });
    emitLog("error", friendlyError);
    emitLog("error", `调试: 连接失败原始详情: ${formatErrorDetails(error)}`);

    return { ok: false, error: friendlyError };
  }
}

async function runCommand(commandKey, payload = {}) {
  if (!client) {
    const error = "请先连接 RCON 服务器。";
    emitLog("error", error);
    return { ok: false, error };
  }

  const definition = commandDefinitions[commandKey];
  if (!definition) {
    const error = `暂不支持的命令: ${commandKey}`;
    emitLog("error", error);
    return { ok: false, error };
  }

  const normalizedPayload = {
    playerId: String(payload.playerId || "").trim(),
    reason: String(payload.reason || "").trim(),
    commandName: String(payload.commandName || "").trim(),
    messageText: String(payload.messageText || "").trim(),
    mapName: String(payload.mapName || "").trim(),
    rotationName: String(payload.rotationName || "").trim(),
  };

  const validationError = definition.validate?.(normalizedPayload) || null;
  if (validationError) {
    emitLog("error", validationError);
    return { ok: false, error: validationError };
  }

  const command = definition.buildCommand(normalizedPayload);
  emitLog("info", `执行命令: ${definition.summary(normalizedPayload)}`);

  try {
    const data = await client.send(command);
    emitLog("success", `命令执行成功: ${definition.summary(normalizedPayload)}`);
    if (typeof data === "string" && data.trim()) {
      emitLog("info", `服务器返回: ${data}`);
    }

    return { ok: true, data: typeof data === "string" ? data : String(data ?? "") };
  } catch (error) {
    const friendlyError = mapCommandError(error);
    emitLog("error", friendlyError);
    return { ok: false, error: friendlyError };
  }
}

module.exports = {
  connect,
  disconnect,
  getConnectionState,
  onLogMessage,
  onConnectionStateChange,
  runCommand,
};
