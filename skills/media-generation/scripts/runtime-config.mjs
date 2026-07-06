import fs from "fs";
import os from "os";
import path from "path";

export const SKILL_RUNTIME_CONFIG_PATH = path.join(os.homedir(), ".modelmax", "config.json");

export async function loadSkillRuntimeConfig() {
  try {
    const raw = await fs.promises.readFile(SKILL_RUNTIME_CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function saveSkillRuntimeConfig(config) {
  await fs.promises.mkdir(path.dirname(SKILL_RUNTIME_CONFIG_PATH), { recursive: true });
  await fs.promises.writeFile(SKILL_RUNTIME_CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
}

export function extractConfiguredApiKey(config) {
  const value = config?.MODELMAX_API_KEY;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function extractConfiguredAutoPayEnabled(config) {
  const value = config?.MODELMAX_AUTO_PAY;
  return value === true || value === "true";
}
