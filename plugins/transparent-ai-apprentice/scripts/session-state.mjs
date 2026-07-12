import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export function apprenticeRoot() {
  return resolve(process.cwd(), ".transparent-apprentice");
}

export function activeSessionPointerPath() {
  return join(apprenticeRoot(), "active-session.json");
}

export function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tempPath, path);
}

export function markActiveSession(sessionPath, source = "teaching_flow") {
  const resolvedSessionPath = resolve(sessionPath);
  const pointerPath = activeSessionPointerPath();
  let sessionId = "";
  try {
    const session = JSON.parse(readFileSync(resolvedSessionPath, "utf8"));
    sessionId = session.sessionId ?? "";
  } catch {
    sessionId = "";
  }
  const pointer = {
    format: "transparent_ai_active_teaching_session_v1",
    sessionPath: resolvedSessionPath,
    sessionId,
    source,
    updatedAt: new Date().toISOString()
  };
  writeJsonAtomic(pointerPath, pointer);
  return pointer;
}

export function activeSessionPath() {
  const pointerPath = activeSessionPointerPath();
  if (!existsSync(pointerPath)) return "";
  try {
    const pointer = JSON.parse(readFileSync(pointerPath, "utf8"));
    const sessionPath = pointer.sessionPath ? resolve(pointer.sessionPath) : "";
    return sessionPath && existsSync(sessionPath) ? sessionPath : "";
  } catch {
    return "";
  }
}

export function latestSessionPath() {
  const sessionsDir = join(apprenticeRoot(), "sessions");
  if (!existsSync(sessionsDir)) return "";
  const candidates = readdirSync(sessionsDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const path = join(sessionsDir, name);
      return { path, modifiedAt: statSync(path).mtimeMs };
    })
    .sort((left, right) => right.modifiedAt - left.modifiedAt);
  return candidates[0]?.path ?? "";
}

export function discoverSessionPath(rawSessionPath = "") {
  if (rawSessionPath) {
    return {
      sessionPath: resolve(rawSessionPath),
      autoDiscoveredSession: false,
      discoverySource: "explicit"
    };
  }

  const active = activeSessionPath();
  if (active) {
    return {
      sessionPath: active,
      autoDiscoveredSession: true,
      discoverySource: "active-session"
    };
  }

  return {
    sessionPath: latestSessionPath(),
    autoDiscoveredSession: true,
    discoverySource: "latest-mtime"
  };
}
