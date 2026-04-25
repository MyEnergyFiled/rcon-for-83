const { Rcon } = require("rcon-client");

const listeners = {
  log: new Set(),
  state: new Set(),
};

let client = null;
let connectionState = {
  status: "disconnected",
  message: "未连接",
};

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

  try {
    client = await Rcon.connect({
      host: normalizedConfig.host,
      port: Number(normalizedConfig.port),
      password: normalizedConfig.password,
    });

    client.on("end", () => {
      client = null;
      emitState({
        status: "disconnected",
        message: "未连接",
      });
      emitLog("warning", "RCON 连接已关闭。");
    });

    client.on("error", (error) => {
      emitLog("error", `连接出现异常: ${mapConnectionError(error)}`);
      emitState({
        status: "error",
        message: "连接异常",
      });
    });

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

    return { ok: false, error: friendlyError };
  }
}

module.exports = {
  connect,
  disconnect,
  getConnectionState,
  onLogMessage,
  onConnectionStateChange,
};
