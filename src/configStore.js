const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

const CONFIG_FILE_NAME = "config.json";

function getConfigPath() {
  return path.join(app.getPath("userData"), CONFIG_FILE_NAME);
}

function normalizeConfig(rawConfig = {}) {
  return {
    host: typeof rawConfig.host === "string" ? rawConfig.host : "",
    port:
      typeof rawConfig.port === "number" && Number.isFinite(rawConfig.port)
        ? rawConfig.port
        : 0,
    password: typeof rawConfig.password === "string" ? rawConfig.password : "",
  };
}

function loadConfig() {
  try {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
      return normalizeConfig();
    }

    const content = fs.readFileSync(configPath, "utf8");
    return normalizeConfig(JSON.parse(content));
  } catch {
    return normalizeConfig();
  }
}

function saveConfig(config) {
  const normalizedConfig = normalizeConfig(config);
  const configPath = getConfigPath();

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(
    configPath,
    JSON.stringify(normalizedConfig, null, 2),
    "utf8",
  );

  return normalizedConfig;
}

module.exports = {
  loadConfig,
  saveConfig,
};
