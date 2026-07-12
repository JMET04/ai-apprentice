#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverSessionPath, markActiveSession } from "./session-state.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function runScript(scriptName, args) {
  const packagedScript = join(scriptDir, scriptName);
  const sourceTreeScript = join(process.cwd(), "plugins", "transparent-ai-apprentice", "scripts", scriptName);
  const scriptPath = existsSync(packagedScript) ? packagedScript : sourceTreeScript;
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  }
  return JSON.parse(result.stdout);
}

const sessionArg = argValue("--session");
const profileArg = argValue("--profile");
const profileName = argValue("--profile-name");
const correction = argValue("--correction", argValue("--teacher-correction"));
const decisionArg = argValue("--decision");
const type = argValue("--type");
const revisedCondition = argValue("--revised-condition");
const revisedAction = argValue("--revised-action");

if (!correction) {
  throw new Error("Usage: node correct-last-result.mjs (--session <session.json> | --profile <profile.json> | --profile-name <name>) --correction <what was wrong>");
}

if (sessionArg && (profileArg || profileName)) {
  throw new Error("Pass either a teaching session or an apprentice profile, not both.");
}

const sessionDiscovery = !sessionArg && !profileArg && !profileName
  ? discoverSessionPath("")
  : { sessionPath: sessionArg ? resolve(sessionArg) : "", autoDiscoveredSession: false, discoverySource: sessionArg ? "explicit" : "" };
const autoSessionPath = !sessionArg && !profileArg && !profileName ? sessionDiscovery.sessionPath : "";

if (!sessionArg && !profileArg && !profileName && !autoSessionPath) {
  throw new Error("No teaching session found to correct. Use continue_teaching first, or pass --session/--profile.");
}

let result;
let targetSurface;

if (sessionArg || autoSessionPath) {
  const sessionPath = resolve(sessionArg || autoSessionPath);
  if (!existsSync(sessionPath)) throw new Error(`Teaching session not found: ${sessionPath}`);
  markActiveSession(sessionPath, sessionArg ? "correct_last_result_explicit" : "correct_last_result_auto");
  const args = ["--session", sessionPath, "--correction", correction];
  if (type) args.push("--type", type);
  args.push("--decision", decisionArg || "needs_teacher_review");
  result = runScript("apply-teacher-correction.mjs", args);
  targetSurface = "teaching_session";
} else {
  const decision = decisionArg || "disable";
  const args = ["--teacher-correction", correction, "--decision", decision];
  if (profileArg) args.push("--profile", resolve(profileArg));
  if (profileName) args.push("--profile-name", profileName);
  if (revisedCondition) args.push("--revised-condition", revisedCondition);
  if (revisedAction) args.push("--revised-action", revisedAction);
  result = runScript("correct-apprentice-memory.mjs", args);
  targetSurface = "apprentice_profile";
}

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_correct_last_result_v1",
      targetSurface,
      autoDiscoveredSession: sessionDiscovery.autoDiscoveredSession,
      sessionDiscoverySource: sessionDiscovery.discoverySource,
      sessionPath: targetSurface === "teaching_session" ? result.sessionPath : "",
      correction,
      decision: targetSurface === "teaching_session" ? decisionArg || "needs_teacher_review" : decisionArg || "disable",
      correctedResult: result,
      nextTeacherPrompt:
        targetSurface === "teaching_session"
          ? "Replay the corrected teaching session before enabling memory."
          : "Review the apprentice profile or run another task to confirm the correction.",
      locks: {
        ruleEnabled: result.ruleEnabled === true ? true : false,
        accepted: false,
        packagingGated: result.packagingGated !== false,
        technologyAccepted: result.technologyAccepted === true
      }
    },
    null,
    2
  )
);
