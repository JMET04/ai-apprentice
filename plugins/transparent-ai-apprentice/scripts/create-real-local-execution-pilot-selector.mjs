#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function argValues(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return (
    String(value || "real-local-execution-pilot-selector")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 56) || "real-local-execution-pilot-selector"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label) {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  if (existsSync(text)) return { value: readJson(text), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function runNodeScript(scriptName, args, cwd = process.cwd(), timeout = 240000) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd,
    encoding: "utf8",
    timeout
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function scorePilot(pilot, index) {
  const text = [pilot.software, pilot.primaryAdapterId, pilot.routeMode, pilot.status].filter(Boolean).join(" ").toLowerCase();
  let score = 100 - index;
  if (text.includes("cad") || text.includes("solid") || text.includes("cam") || text.includes("engineering")) score += 40;
  if (text.includes("cli") || text.includes("script") || text.includes("api") || text.includes("browser") || text.includes("file")) score += 25;
  if (text.includes("ui")) score += 10;
  if (pilot.adapterPackagePath && existsSync(pilot.adapterPackagePath)) score += 30;
  return score;
}

function numberedCandidates(queue, maxCandidates) {
  const pilots = Array.isArray(queue.pilots) ? queue.pilots : [];
  return pilots
    .map((pilot, index) => ({ pilot, index, score: scorePilot(pilot, index) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCandidates)
    .map((entry, index) => ({
      number: index + 1,
      pilotId: entry.pilot.pilotId,
      software: entry.pilot.software,
      routeMode: entry.pilot.routeMode || "",
      primaryAdapterId: entry.pilot.primaryAdapterId || "",
      adapterPackagePath: entry.pilot.adapterPackagePath || "",
      actionPlanPath: entry.pilot.actionPlanPath || "",
      score: entry.score,
      whyThisIsReviewable: [
        entry.pilot.adapterPackagePath ? "adapter package exists" : "adapter package missing",
        entry.pilot.primaryAdapterId ? `primary adapter ${entry.pilot.primaryAdapterId}` : "no primary adapter",
        entry.pilot.routeMode ? `route ${entry.pilot.routeMode}` : "route mode missing"
      ],
      requiredBeforeExecute: [
        "teacher confirms this candidate number",
        "teacher supplies exact reviewed command/API/file/browser target/window evidence when execute mode is requested",
        "runner preflight, receipt verification, and post-action checkpoint must pass before screenshots or memory"
      ]
    }));
}

function candidateBySelection(candidates, selectedNumber, selectedPilotId) {
  if (selectedPilotId) {
    const match = candidates.find((candidate) => candidate.pilotId === selectedPilotId);
    if (!match) throw new Error(`selected pilot id not found in candidate list: ${selectedPilotId}`);
    return match;
  }
  if (!selectedNumber) return null;
  const index = Number(selectedNumber) - 1;
  if (!candidates[index]) throw new Error(`selected candidate number not found: ${selectedNumber}`);
  return candidates[index];
}

function writeReadme(path, packet) {
  const lines = [
    "# Real-Local Execution Pilot Selector",
    "",
    `Goal: ${packet.goal}`,
    "",
    "This packet turns a real local execution readiness batch into numbered software pilot candidates for teacher selection.",
    "",
    `Candidates: ${packet.counts.numberedCandidates}`,
    `Selected candidate: ${packet.selectedCandidate ? `${packet.selectedCandidate.number} / ${packet.selectedCandidate.software}` : "none"}`,
    `Runner invoked: ${packet.counts.runnerInvoked ? "yes" : "no"}`,
    "",
    "Review order:",
    "1. Read the numbered candidates and choose exactly one number.",
    "2. Check the adapter route and action plan for that software.",
    "3. Keep dry-run mode unless the teacher supplies exact route evidence and explicit confirmation.",
    "4. Review runner receipt, outcome verification, and checkpoint before screenshots or memory.",
    "",
    "Numbered candidates:"
  ];
  for (const candidate of packet.numberedCandidates) {
    lines.push(
      `- ${candidate.number}. ${candidate.software} (${candidate.pilotId}, ${candidate.primaryAdapterId || "adapter TBD"})`
    );
  }
  lines.push(
    "",
    "Locked boundary: accepted=false, ruleEnabled=false, packagingGated=true, screenshotsCaptured=false, fullContinuousRecording=false, memoryWritten=false, nativeUniversalExecution=false, allSoftwareExecutionComplete=false."
  );
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue(
  "--goal",
  argValue("--task", "Select one real local software execution pilot candidate for teacher review.")
);
const readinessInput = readJsonInput(argValue("--readiness-batch", argValue("--readiness", "")), "--readiness-batch");
const queueInput = readJsonInput(argValue("--queue", argValue("--queue-path", "")), "--queue");
const maxCandidates = Math.max(1, Number(argValue("--max-candidates", "6")));
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "real-local-execution-pilot-selectors"))
);
const selectorId = `${new Date().toISOString().replace(/[:.]/g, "-")}-pilot-selector`;
const selectorDir = join(outputRoot, selectorId);
const workRoot = join(process.cwd(), ".transparent-apprentice", "rl-pilot-select-work", String(Date.now()));
mkdirSync(selectorDir, { recursive: true });
mkdirSync(workRoot, { recursive: true });

let readiness = readinessInput.value;
let readinessPath = readinessInput.path;
if (!readiness && !queueInput.value) {
  const generated = runNodeScript("run-real-local-all-software-execution-readiness-batch.mjs", [
    "--goal",
    "Real local pilot selector readiness.",
    "--max-processes",
    argValue("--max-processes", "8"),
    "--max-installed",
    argValue("--max-installed", "8"),
    "--max-software",
    argValue("--max-software", "8"),
    "--max-pilots",
    argValue("--max-pilots", "3"),
    "--max-log-files-per-candidate",
    argValue("--max-log-files-per-candidate", "1"),
    "--output-dir",
    join(workRoot, "readiness")
  ]);
  readinessPath = generated.packetPath;
  readiness = readJson(readinessPath);
}

const queuePath =
  queueInput.path ||
  readiness?.generatedEvidence?.executionPilotQueue ||
  readiness?.executionPilotQueue ||
  "";
const queue = queueInput.value || (queuePath ? readJson(queuePath) : null);
if (!queue || queue.format !== "transparent_ai_all_software_execution_pilot_queue_v1") {
  throw new Error("selector requires a transparent_ai_all_software_execution_pilot_queue_v1 queue or readiness batch with executionPilotQueue evidence");
}

const candidates = numberedCandidates(queue, maxCandidates);
const selectedCandidate = candidateBySelection(
  candidates,
  argValue("--selected-number", argValue("--number", "")),
  argValue("--selected-pilot-id", argValue("--pilot-id", ""))
);
const executeRequested = hasFlag("--execute");
const teacherConfirmation = argValue("--teacher-confirmation", argValue("--confirmation", ""));
let runnerResult = null;
if (selectedCandidate) {
  const runnerArgs = ["--queue", queuePath || JSON.stringify(queue), "--pilot-id", selectedCandidate.pilotId];
  if (argValue("--adapter-id", selectedCandidate.primaryAdapterId)) runnerArgs.push("--adapter-id", argValue("--adapter-id", selectedCandidate.primaryAdapterId));
  if (executeRequested) runnerArgs.push("--execute");
  if (teacherConfirmation) runnerArgs.push("--teacher-confirmation", teacherConfirmation);
  if (argValue("--reviewed-command", "")) runnerArgs.push("--reviewed-command", argValue("--reviewed-command", ""));
  if (argValue("--reviewed-api-request", "")) runnerArgs.push("--reviewed-api-request", argValue("--reviewed-api-request", ""));
  if (argValue("--reviewed-mapping", "")) runnerArgs.push("--reviewed-mapping", argValue("--reviewed-mapping", ""));
  if (argValue("--reviewed-browser-target", "")) runnerArgs.push("--reviewed-browser-target", argValue("--reviewed-browser-target", ""));
  if (argValue("--target-window-title", "")) runnerArgs.push("--target-window-title", argValue("--target-window-title", ""));
  for (const marker of argValues("--teacher-marker")) runnerArgs.push("--teacher-marker", marker);
  runnerArgs.push("--output-dir", join(workRoot, "selected-run"));
  runnerResult = runNodeScript("run-all-software-execution-pilot-runner.mjs", runnerArgs, process.cwd(), 240000);
}

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  memoryWritten: false,
  softwareActionsExecuted: Boolean(runnerResult?.controlledRouteActionExecuted),
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  teacherConfirmationRequiredBeforeExecute: true,
  dryRunFirst: true
};
const packetPath = join(selectorDir, "real-local-execution-pilot-selector.json");
const receiptPath = join(selectorDir, "real-local-execution-pilot-selector-receipt.json");
const readmePath = join(selectorDir, "REAL_LOCAL_EXECUTION_PILOT_SELECTOR_START_HERE.md");
const packet = {
  ok: true,
  format: "transparent_ai_real_local_execution_pilot_selector_v1",
  selectorId,
  createdAt: new Date().toISOString(),
  goal,
  productIntent:
    "Let a non-expert teacher choose one numbered real local software pilot before any supervised execution attempt.",
  sourceEvidence: {
    readinessBatchPath: readinessPath,
    executionPilotQueuePath: queuePath,
    shortWorkRoot: workRoot
  },
  counts: {
    queuePilots: Array.isArray(queue.pilots) ? queue.pilots.length : 0,
    numberedCandidates: candidates.length,
    runnerInvoked: Boolean(runnerResult),
    controlledRouteActionExecuted: Boolean(runnerResult?.controlledRouteActionExecuted)
  },
  numberedCandidates: candidates,
  selectedCandidate,
  selectedRunner: runnerResult
    ? {
        status: runnerResult.status,
        runPath: runnerResult.runPath,
        receiptPath: runnerResult.receiptPath,
        adapterReceiptPath: runnerResult.adapterReceiptPath,
        outcomeVerificationPath: runnerResult.outcomeVerificationPath,
        postActionCheckpointPath: runnerResult.postActionCheckpointPath,
        controlledRouteActionExecuted: Boolean(runnerResult.controlledRouteActionExecuted)
      }
    : null,
  nextTeacherActions: selectedCandidate
    ? [
        "Review the selected runner receipt and outcome verification.",
        "If this dry run matches the intended route, provide exact reviewed route evidence before execute mode.",
        "If the wrong software or route was selected, choose another candidate number instead of saving memory."
      ]
    : [
        "Choose one candidate number for the next dry-run pilot.",
        "Prefer a structured adapter route when one exists, but keep UI fallback available for software with no API/CLI/file route.",
        "Do not request execute mode until exact route evidence and explicit teacher confirmation exist."
      ],
  completionBoundary: {
    allSoftwareExecutionComplete: false,
    nativeUniversalExecution: false,
    reason:
      "This selector moves real local software from readiness into one teacher-selected pilot. It does not prove all installed software can be executed."
  },
  locks
};
const receipt = {
  ok: true,
  format: "transparent_ai_real_local_execution_pilot_selector_receipt_v1",
  selectorId,
  status: selectedCandidate
    ? "selected_real_local_pilot_dry_run_ready_for_teacher_review"
    : "waiting_for_teacher_to_choose_numbered_real_local_pilot",
  packetPath,
  selectedPilotId: selectedCandidate?.pilotId || "",
  selectedSoftware: selectedCandidate?.software || "",
  runnerInvoked: Boolean(runnerResult),
  controlledRouteActionExecuted: Boolean(runnerResult?.controlledRouteActionExecuted),
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  locks
};

writeReadme(readmePath, packet);
writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_real_local_execution_pilot_selector_result_v1",
      status: receipt.status,
      selectorPath: packetPath,
      receiptPath,
      readmePath,
      numberedCandidates: candidates.length,
      selectedPilotId: selectedCandidate?.pilotId || "",
      selectedSoftware: selectedCandidate?.software || "",
      runnerInvoked: Boolean(runnerResult),
      runnerStatus: runnerResult?.status || "",
      runnerPath: runnerResult?.runPath || "",
      runnerReceiptPath: runnerResult?.receiptPath || "",
      outcomeVerificationPath: runnerResult?.outcomeVerificationPath || "",
      postActionCheckpointPath: runnerResult?.postActionCheckpointPath || "",
      screenshotsCaptured: false,
      fullContinuousRecording: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false
    },
    null,
    2
  )
);
