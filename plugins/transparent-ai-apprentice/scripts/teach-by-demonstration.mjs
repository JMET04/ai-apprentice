#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

function compactResult(result) {
  return Object.fromEntries(
    Object.entries(result).filter(([key]) =>
      [
        "ok",
        "sessionPath",
        "sessionId",
        "demonstrationId",
        "exchangeId",
        "traceId",
        "ruleDraftId",
        "correctionId",
        "extractedCueCount",
        "matchedCueCount",
        "outcome",
        "ruleEnabled",
        "requiresTeacherConfirmation",
        "reviewStatus"
      ].includes(key)
    )
  );
}

const sessionArg = argValue("--session");
const name = argValue("--name", "teachable-apprentice");
const task = argValue("--task", "Teach the apprentice from a direct demonstration.");
const artifactArg = argValue("--artifact");
const teacherMessage = argValue("--teacher-message");
const apprenticeAttempt = argValue("--apprentice-attempt");
const teacherCorrection = argValue("--teacher-correction");
const taughtBehavior = argValue("--taught-behavior", "Apply the teacher's demonstrated behavior after review.");
const futureInput = argValue("--future-input");
const tool = argValue("--tool", artifactArg ? "existing-tool" : "conversation");
const teacherAction = argValue("--teacher-action", "Teacher provided a direct demonstration.");

if (!artifactArg && !teacherMessage) {
  throw new Error(
    "Usage: node teach-by-demonstration.mjs [--session <session.json>] --artifact <file> OR --teacher-message <teaching note> [--future-input <test input>]"
  );
}

let sessionPath = sessionArg ? resolve(sessionArg) : "";
const actions = [];

if (sessionPath && !existsSync(sessionPath)) {
  throw new Error(`Teaching session not found: ${sessionPath}`);
}

if (!sessionPath) {
  const created = runScript("create-teaching-session.mjs", ["--name", name, "--task", task]);
  sessionPath = created.sessionPath;
  actions.push({
    step: "create teaching session",
    result: compactResult(created)
  });
}

let taughtResult;
if (artifactArg) {
  const artifactPath = resolve(artifactArg);
  if (!existsSync(artifactPath)) {
    throw new Error(`Demonstration artifact not found: ${artifactPath}`);
  }
  const args = [
    "--session",
    sessionPath,
    "--artifact",
    artifactPath,
    "--tool",
    tool,
    "--teacher-action",
    teacherAction,
    "--taught-behavior",
    taughtBehavior
  ];
  taughtResult = runScript("import-demonstration-artifact.mjs", args);
  actions.push({
    step: "import existing-tool demonstration",
    result: compactResult(taughtResult)
  });
} else {
  const args = [
    "--session",
    sessionPath,
    "--teacher-message",
    teacherMessage,
    "--taught-behavior",
    taughtBehavior,
    "--channel",
    tool
  ];
  if (apprenticeAttempt) args.push("--apprentice-attempt", apprenticeAttempt);
  if (teacherCorrection) args.push("--teacher-correction", teacherCorrection);
  taughtResult = runScript("record-teacher-exchange.mjs", args);
  actions.push({
    step: "record conversational teaching",
    result: compactResult(taughtResult)
  });
}

let replayResult = null;
if (futureInput) {
  replayResult = runScript("replay-teaching-session.mjs", ["--session", sessionPath, "--input", futureInput]);
  actions.push({
    step: "replay future input",
    result: compactResult(replayResult)
  });
}

const result = {
  ok: true,
  format: "transparent_ai_teach_by_demonstration_result_v1",
  mode: artifactArg ? "existing_tool_artifact" : "conversation_exchange",
  sessionPath,
  taughtResult: compactResult(taughtResult),
  replayResult: replayResult ? compactResult(replayResult) : null,
  publicTraceRequired: true,
  ruleEnabled: false,
  requiresTeacherConfirmation: true,
  nextTeacherPrompt: replayResult
    ? "Review the replay: did the apprentice learn the intended behavior, or should the draft be narrowed?"
    : "Provide a small future input to replay before enabling any memory.",
  actions
};

console.log(JSON.stringify(result, null, 2));
