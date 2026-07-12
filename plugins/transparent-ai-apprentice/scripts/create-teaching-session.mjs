#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { markActiveSession } from "./session-state.mjs";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "apprentice-session";
}

const name = argValue("--name", "teachable-apprentice");
const task = argValue("--task", "");
const sessionId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(name)}`;
const root = join(process.cwd(), ".transparent-apprentice");
const sessionDir = join(root, "sessions");
const sessionPath = join(sessionDir, `${sessionId}.json`);

mkdirSync(sessionDir, { recursive: true });

if (existsSync(sessionPath)) {
  throw new Error(`Session already exists: ${sessionPath}`);
}

const session = {
  format: "transparent_ai_teaching_session_v1",
  sessionId,
  apprenticeName: name,
  task,
  teacherDemonstrations: [],
  executionAttempts: [],
  corrections: [],
  publicTraces: [],
  ruleDrafts: [],
  nextReplayPlan: [],
  lockDefaults: {
    ruleEnabled: false,
    requiresTeacherConfirmation: true,
    privateChainOfThoughtExposed: false
  }
};

writeFileSync(sessionPath, `${JSON.stringify(session, null, 2)}\n`, "utf8");
const activeSession = markActiveSession(sessionPath, "create_teaching_session");
console.log(JSON.stringify({ ok: true, sessionPath, sessionId, activeSessionPath: activeSession.sessionPath }, null, 2));
