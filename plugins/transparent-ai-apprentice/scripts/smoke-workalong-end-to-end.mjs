#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const serverScript = "plugins/transparent-ai-apprentice/scripts/mcp-server.mjs";
const smokeRoot = join(repoRoot, ".transparent-apprentice", "workalong-e2e-smoke", String(Date.now()));
const logPath = join(smokeRoot, "solidworks-rebuild.log");
const kitOutputRoot = join(smokeRoot, "kits");

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function runPowerShell(args) {
  const result = spawnSync("powershell", args, {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "PowerShell command failed");
  return result;
}

function appendJsonl(path, value) {
  writeFileSync(path, `${JSON.stringify(value)}\n`, { encoding: "utf8", flag: "a" });
}

function startServer() {
  const child = spawn(process.execPath, [serverScript], {
    cwd: repoRoot,
    stdio: ["pipe", "pipe", "pipe"]
  });
  let nextId = 1;
  const pending = new Map();
  let stdoutBuffer = "";
  let stderr = "";

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    }
  });

  function rpc(method, params = {}) {
    const id = nextId++;
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  async function stop() {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
  }

  return { rpc, stop, stderr: () => stderr };
}

async function callTeachApprentice(argumentsObject) {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: argumentsObject
    });
    return JSON.parse(result.content[0].text);
  } finally {
    await server.stop();
  }
}

mkdirSync(smokeRoot, { recursive: true });
writeFileSync(logPath, "INFO: opened model fuselage-wing-test\nINFO: rebuild completed normally\n", "utf8");

const kit = runNodeScript("create-workalong-teaching-kit.mjs", [
  "--goal",
  "Learn a SolidWorks rebuild recovery workflow unobtrusively while the teacher works.",
  "--software",
  "SolidWorks",
  "--log-path",
  logPath,
  "--question-mode",
  "both",
  "--future-input",
  "A future SolidWorks rebuild fails after changing rib thickness.",
  "--output-dir",
  kitOutputRoot
]);

const collectorPath = kit.files.collector;
runPowerShell(["-ExecutionPolicy", "Bypass", "-File", collectorPath, "-MaxPolls", "1"]);
const quietFinalize = runNodeScript("finalize-workalong-observation.mjs", ["--manifest", kit.kitPath]);
const quietObservation = JSON.parse(readFileSync(quietFinalize.outputPath, "utf8"));

writeFileSync(
  logPath,
  [
    "INFO: opened model fuselage-wing-test",
    "ERROR: rebuild failed after changing rib thickness on feature Rib-03",
    "WARNING: teacher rolled back rib thickness and rebuilt successfully"
  ].join("\n"),
  "utf8"
);
runPowerShell(["-ExecutionPolicy", "Bypass", "-File", collectorPath, "-MaxPolls", "1"]);
const questionFinalize = runNodeScript("finalize-workalong-observation.mjs", ["--manifest", kit.kitPath]);
const questionObservation = JSON.parse(readFileSync(questionFinalize.outputPath, "utf8"));

appendJsonl(join(dirname(kit.kitPath), "workalong-events.jsonl"), {
  type: "teacher_question_answered",
  question: "I saw a rebuild failure after a rib thickness change. What decision should I learn?",
  answer:
    "When SolidWorks rebuild fails after a rib thickness change on the same rib feature, roll back that thickness change and rebuild before exporting.",
  format: "transparent_ai_workalong_observation_event_v1",
  kitId: kit.kitId,
  software: "SolidWorks",
  timestamp: new Date().toISOString(),
  locks: {
    ruleEnabled: false,
    accepted: false,
    packagingGated: true,
    technologyAccepted: false
  }
});

const answeredFinalize = runNodeScript("finalize-workalong-observation.mjs", ["--manifest", kit.kitPath]);
const answeredObservation = JSON.parse(readFileSync(answeredFinalize.outputPath, "utf8"));

const profileName = `workalong-e2e-${Date.now()}`;
const taught = await callTeachApprentice({
  whatToTeach: "Learn SolidWorks rebuild recovery from real low-token workalong collector output.",
  message:
    "transparent_ai_workalong_observation_v1\nHere is the workalong observation JSON:\n```json\n" +
    JSON.stringify(answeredObservation, null, 2) +
    "\n```",
  taughtBehavior:
    "When SolidWorks rebuild fails after a rib thickness change on the same rib feature, roll back that thickness change and rebuild before exporting.",
  futureInput: "A future SolidWorks rebuild fails after changing rib thickness on feature Rib-03."
});

const saved = await callTeachApprentice({
  approval: "approved",
  remember: true,
  profileName
});

const reproduced = await callTeachApprentice({
  useLearnedMemory: true,
  profileName,
  learnedInput: "A future SolidWorks rebuild fails after changing rib thickness on feature Rib-03."
});

const checks = [
  {
    name: "Collector observes normal log deltas without asking the teacher",
    pass:
      quietFinalize.format === "transparent_ai_workalong_observation_finalize_result_v1" &&
      quietFinalize.needsTeacherQuestion === false &&
      quietObservation.fullContinuousRecording === false &&
      quietObservation.events.some((event) => event.type === "log_file_changed") &&
      !quietObservation.events.some((event) => event.type === "manual_teacher_marker_changed"),
    evidence: `events=${quietFinalize.eventCount}; needsQuestion=${quietFinalize.needsTeacherQuestion}; continuous=${quietObservation.fullContinuousRecording}`
  },
  {
    name: "Collector/finalizer asks only when an ambiguous work state appears",
    pass:
      questionFinalize.needsTeacherQuestion === true &&
      questionFinalize.suggestedQuestionCount > 0 &&
      questionObservation.askTeacherOnlyWhen.length > 0 &&
      questionObservation.events.some((event) => event.type === "error_or_state_keyword"),
    evidence: `ambiguous=${questionFinalize.ambiguousEventCount}; suggested=${questionFinalize.suggestedQuestionCount}; needsQuestion=${questionFinalize.needsTeacherQuestion}`
  },
  {
    name: "Teacher answer closes the question and creates compact learning evidence",
    pass:
      answeredFinalize.needsTeacherQuestion === false &&
      answeredFinalize.teacherAnswerCount === 1 &&
      answeredObservation.teacherAnswers.length === 1 &&
      answeredObservation.logs.length >= 1 &&
      answeredObservation.fullContinuousRecording === false,
    evidence: `answers=${answeredFinalize.teacherAnswerCount}; logs=${answeredObservation.logs.length}; events=${answeredObservation.events.length}`
  },
  {
    name: "teach_apprentice learns from finalized work-along evidence",
    pass:
      taught.format === "transparent_ai_teach_apprentice_card_v1" &&
      taught.status === "waiting_for_teacher_review" &&
      taught.teachingEvidence?.some((item) => item.sourceTool === "SolidWorks low-token workalong collector") &&
      taught.learnedDraft?.draftCreated === true &&
      taught.learnedDraft?.ruleEnabledForSession === false &&
      taught.reviewLocks?.packagingGated === true,
    evidence: `status=${taught.status}; evidence=${taught.teachingEvidence?.length ?? 0}; replay=${taught.learnedDraft?.replayOutcome}`
  },
  {
    name: "Approved work-along memory can reproduce the same workflow later",
    pass:
      saved.status === "teacher_approved" &&
      saved.savedMemory?.approvedMemoryCount > 0 &&
      reproduced.status === "learned_work_generated" &&
      reproduced.learnedWork?.usedApprovedProfileMemory === true &&
      reproduced.learnedWork?.outcome === "applied_profile_memory" &&
      reproduced.learnedWork?.matchedCueCount > 0 &&
      reproduced.learnedWork?.actionTaken?.includes("roll back") &&
      reproduced.reviewLocks?.packagingGated === true,
    evidence: `saved=${saved.status}; reproduced=${reproduced.status}; outcome=${reproduced.learnedWork?.outcome}; cues=${reproduced.learnedWork?.matchedCueCount}`
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  kitPath: kit.kitPath,
  quietObservationPath: quietFinalize.outputPath,
  answeredObservationPath: answeredFinalize.outputPath,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
