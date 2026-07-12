#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function visitFiles(root, fileName) {
  const resolvedRoot = resolve(root);
  if (!existsSync(resolvedRoot)) return [];
  const found = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name === fileName) found.push({ path, time: statSync(path).mtimeMs });
    }
  };
  visit(resolvedRoot);
  return found;
}

function newestFile(root, fileName) {
  return visitFiles(root, fileName).sort((a, b) => b.time - a.time)[0]?.path || "";
}

function newestByNameFragment(root, fragment) {
  const resolvedRoot = resolve(root);
  if (!existsSync(resolvedRoot)) return "";
  const found = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name.includes(fragment) && entry.name.endsWith(".json")) {
        found.push({ path, time: statSync(path).mtimeMs });
      }
    }
  };
  visit(resolvedRoot);
  return found.sort((a, b) => b.time - a.time)[0]?.path || "";
}

function newestRollbackPoint(root) {
  return newestFile(join(root, ".transparent-apprentice", "rollback-points"), "rollback-point.json");
}

function resolveOptionalPath(value) {
  const text = String(value || "").trim();
  return text ? resolve(text) : "";
}

function slugify(value) {
  return (
    String(value || "voice-numbered-teacher-console")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[._-]+|[._-]+$/g, "")
      .slice(0, 84) || "voice-numbered-teacher-console"
  );
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path && existsSync(path) ? pathToFileURL(path).href : "";
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    consoleDoesNotListenToMicrophone: true,
    consoleDoesNotParseNewCommand: true,
    consoleDoesNotCreateNewTargets: true,
    consoleDoesNotConfirmNumber: true,
    consoleDoesNotRunExecutionApproval: true,
    consoleDoesNotExecuteTargetSoftware: true,
    consoleDoesNotWriteMemory: true,
    consoleDoesNotDeleteRollbackPoint: true,
    microphoneOpened: false,
    commandParsed: false,
    numberedTargetConfirmed: false,
    executionApprovalGranted: false,
    targetSoftwareCommandsExecuted: false,
    softwareActionsExecuted: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function laneById(gate, id) {
  return (Array.isArray(gate?.lanes) ? gate.lanes : []).find((lane) => lane?.id === id) || null;
}

function evidenceRows(map) {
  return Object.entries(map)
    .map(
      ([key, value]) =>
        `<tr><td><code>${htmlEscape(key)}</code></td><td><a href="${htmlEscape(fileHref(value))}">${htmlEscape(value || "missing")}</a></td></tr>`
    )
    .join("\n");
}

function writeHtml(path, consoleArtifact) {
  const stepRows = consoleArtifact.teacherActionSequence
    .map(
      (step) => `<tr><td><code>${htmlEscape(step.id)}</code></td><td>${htmlEscape(step.action)}</td><td>${htmlEscape(step.continueCondition)}</td><td>${htmlEscape(step.stopCondition)}</td></tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Voice/Text Numbered Execution Teacher Console</title>
  <style>
    body { margin: 0; font: 14px/1.45 Segoe UI, Arial, sans-serif; color: #182433; background: #f6f8fb; }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    section { background: #fff; border: 1px solid #d8e2ec; border-radius: 8px; padding: 16px; margin: 12px 0; }
    table { border-collapse: collapse; width: 100%; background: #fff; }
    th, td { border-top: 1px solid #e5ebf2; padding: 8px; text-align: left; vertical-align: top; }
    pre, code { background: #edf3f8; border-radius: 5px; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; padding: 10px; }
    .lock { color: #8a3b00; font-weight: 700; }
  </style>
</head>
<body>
<main>
  <h1>Voice/Text Numbered Execution Teacher Console</h1>
  <section>
    <p>Status: <code>${htmlEscape(consoleArtifact.status)}</code></p>
    <p>Final lane ready: <code>${htmlEscape(consoleArtifact.finalLane.ready)}</code></p>
    <p class="lock">Review-only. This console does not listen to microphone, parse new commands, create targets, confirm a number, run execution approval, execute software, write memory, delete rollback points, or claim completion.</p>
  </section>
  <section>
    <h2>Capability State</h2>
    <table><tbody>
      <tr><th>Voice numbered convergence</th><td>${htmlEscape(consoleArtifact.capabilityState.convergenceStatus)}</td></tr>
      <tr><th>Integrated evidence gate</th><td>${htmlEscape(consoleArtifact.capabilityState.integratedGateStatus)}</td></tr>
      <tr><th>Voice control session</th><td>${htmlEscape(consoleArtifact.capabilityState.voiceControlSessionStatus)}</td></tr>
      <tr><th>Single-number confirmation required</th><td>${htmlEscape(consoleArtifact.capabilityState.singleNumberConfirmationRequired)}</td></tr>
      <tr><th>Execution locked</th><td>${htmlEscape(consoleArtifact.capabilityState.executionLocked)}</td></tr>
    </tbody></table>
  </section>
  <section>
    <h2>Teacher Action Sequence</h2>
    <table><thead><tr><th>Step</th><th>Action</th><th>Continue</th><th>Stop</th></tr></thead><tbody>${stepRows}</tbody></table>
  </section>
  <section>
    <h2>Source Evidence</h2>
    <table><thead><tr><th>Source</th><th>Path</th></tr></thead><tbody>${evidenceRows(consoleArtifact.sourceEvidence)}</tbody></table>
  </section>
</main>
</body>
</html>
`,
    "utf8"
  );
}

function writeReadme(path, consoleArtifact) {
  const lines = [
    "# Voice/Text Numbered Execution Teacher Console",
    "",
    `Status: ${consoleArtifact.status}`,
    `Final lane ready: ${consoleArtifact.finalLane.ready}`,
    "",
    "This console connects voice/text command intake, numbered target candidates, single-number confirmation, and execution approval gates into one review-only teacher entrypoint.",
    "It does not listen to the microphone, parse new commands, create target candidates, confirm a number, run execution approval, execute software, write memory, delete rollback points, or claim completion.",
    "",
    "## Teacher Sequence",
    "",
    ...consoleArtifact.teacherActionSequence.map((step, index) => `${index + 1}. ${step.action}`),
    "",
    "## Final Gate Boundary",
    "",
    consoleArtifact.finalLane.blocker || "Voice/text numbered execution lane is still not complete."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const repoRoot = process.cwd();
const goal = argValue("--goal", "Create voice text numbered execution teacher console.");
const finalGatePath = resolve(
  argValue(
    "--final-completion-gate",
    newestFile(join(repoRoot, "artifacts", "current-goal-final-completion-gates"), "original-goal-final-completion-gate.json")
  )
);
const integratedGatePath = resolve(
  argValue(
    "--integrated-evidence-gate",
    newestFile(join(repoRoot, "artifacts", "current-goal-integrated-evidence-gates"), "current-goal-integrated-evidence-gate.json")
  )
);
const convergenceAuditPath = resolve(
  argValue(
    "--voice-numbered-convergence-audit",
    newestFile(join(repoRoot, "artifacts", "current-goal-voice-numbered-convergence-audits"), "voice-numbered-execution-convergence-audit.json")
  )
);
const voiceSessionPath = resolve(
  argValue(
    "--voice-control-session",
    newestFile(join(repoRoot, "artifacts", "current-goal-voice-text-numbered-execution-sessions"), "engineering-voice-control-session.json")
  )
);
const commandConfirmationPath = resolveOptionalPath(
  argValue(
    "--command-confirmation",
    newestByNameFragment(join(repoRoot, "artifacts"), "engineering-command-confirmation")
  )
);
const targetConfirmationPath = resolveOptionalPath(
  argValue(
    "--target-confirmation",
    newestByNameFragment(join(repoRoot, "artifacts"), "target-confirmation")
  )
);
const executionApprovalPath = resolveOptionalPath(
  argValue(
    "--execution-approval-gate",
    newestByNameFragment(join(repoRoot, "artifacts"), "execution-approval-gate")
  )
);
const rollbackPath = resolve(argValue("--rollback-point", newestRollbackPoint(repoRoot)));
const outputRoot = resolve(
  argValue("--output-dir", join(repoRoot, "artifacts", "current-goal-voice-numbered-teacher-consoles"))
);
mkdirSync(outputRoot, { recursive: true });

const finalGate = existsSync(finalGatePath) ? readJson(finalGatePath) : null;
const integratedGate = existsSync(integratedGatePath) ? readJson(integratedGatePath) : null;
const convergenceAudit = existsSync(convergenceAuditPath) ? readJson(convergenceAuditPath) : null;
const voiceSession = existsSync(voiceSessionPath) ? readJson(voiceSessionPath) : null;
const commandConfirmation = existsSync(commandConfirmationPath) ? readJson(commandConfirmationPath) : null;
const targetConfirmation = existsSync(targetConfirmationPath) ? readJson(targetConfirmationPath) : null;
const executionApproval = existsSync(executionApprovalPath) ? readJson(executionApprovalPath) : null;
const rollback = existsSync(rollbackPath) ? readJson(rollbackPath) : null;
const voiceLane = laneById(finalGate, "voice_text_numbered_execution_capability_convergence");

const blockers = [];
if (!finalGate) blockers.push("final_completion_gate_missing");
if (!voiceLane) blockers.push("voice_text_numbered_final_lane_missing");
if (!integratedGate) blockers.push("integrated_evidence_gate_missing");
if (!convergenceAudit) blockers.push("voice_numbered_convergence_audit_missing");
if (!voiceSession) blockers.push("voice_control_session_missing");
if (!rollback) blockers.push("rollback_point_missing");

const consoleStatus = blockers.length
  ? "voice_numbered_teacher_console_needs_source_evidence"
  : "voice_numbered_teacher_console_ready_for_teacher_number_receipt_not_execution";
const consoleId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const consoleDir = join(outputRoot, consoleId);
mkdirSync(consoleDir, { recursive: true });
const consolePath = join(consoleDir, "current-goal-voice-numbered-teacher-console.json");
const htmlPath = join(consoleDir, "current-goal-voice-numbered-teacher-console.html");
const readmePath = join(consoleDir, "CURRENT_GOAL_VOICE_NUMBERED_TEACHER_CONSOLE.md");

const consoleArtifact = {
  ok: blockers.length === 0,
  format: "transparent_ai_current_goal_voice_numbered_teacher_console_v1",
  consoleId,
  createdAt: new Date().toISOString(),
  goal,
  status: consoleStatus,
  blockers,
  finalLane: {
    id: voiceLane?.id || "voice_text_numbered_execution_capability_convergence",
    ready: voiceLane?.ready === true,
    blocker: voiceLane?.blocker || "",
    sourcePath: voiceLane?.sourcePath || ""
  },
  capabilityState: {
    convergenceStatus: convergenceAudit?.status || "",
    integratedGateStatus: integratedGate?.status || "",
    voiceControlSessionStatus: voiceSession?.status || "",
    commandConfirmationStatus: commandConfirmation?.status || "",
    targetConfirmationStatus: targetConfirmation?.status || "",
    executionApprovalStatus: executionApproval?.status || "",
    singleNumberConfirmationRequired: true,
    executionLocked: true,
    completionClaimAllowed: false
  },
  teacherActionSequence: [
    {
      id: "capture_voice_or_text_intent",
      action: "Use the existing voice/text workbench or transcript fallback to capture the non-expert command as intent only.",
      continueCondition: "Intent is recorded without executing target software.",
      stopCondition: "Any flow tries to execute directly from speech or text."
    },
    {
      id: "show_numbered_candidates",
      action: "Translate intent into numbered target candidates over reviewed visual/spatial evidence.",
      continueCondition: "Candidate numbers are visible and tied to evidence.",
      stopCondition: "The system chooses a target without showing numbered alternatives."
    },
    {
      id: "teacher_confirms_one_number",
      action: "Teacher or user confirms exactly one number before any dry-run or execution approval route.",
      continueCondition: "Exactly one number is confirmed and receipt validation passes.",
      stopCondition: "No number, multiple numbers, ambiguous target, or forbidden execute decision."
    },
    {
      id: "prepare_execution_gate_only",
      action: "Prepare the existing execution approval gate package after one-number confirmation; keep execution blocked until the separate approval gate is valid.",
      continueCondition: "Approval gate remains review-only with rollback and explicit teacher approval requirements.",
      stopCondition: "Any command runs target software, writes memory, or claims completion."
    }
  ],
  sourceEvidence: {
    finalCompletionGate: existsSync(finalGatePath) ? finalGatePath : "",
    integratedEvidenceGate: existsSync(integratedGatePath) ? integratedGatePath : "",
    voiceNumberedConvergenceAudit: existsSync(convergenceAuditPath) ? convergenceAuditPath : "",
    voiceControlSession: existsSync(voiceSessionPath) ? voiceSessionPath : "",
    commandConfirmation: existsSync(commandConfirmationPath) ? commandConfirmationPath : "",
    targetConfirmation: existsSync(targetConfirmationPath) ? targetConfirmationPath : "",
    executionApprovalGate: existsSync(executionApprovalPath) ? executionApprovalPath : "",
    rollbackPoint: existsSync(rollbackPath) ? rollbackPath : ""
  },
  paths: {
    console: consolePath,
    html: htmlPath,
    readme: readmePath
  },
  locks: locks()
};

writeJson(consolePath, consoleArtifact);
writeHtml(htmlPath, consoleArtifact);
writeReadme(readmePath, consoleArtifact);

console.log(
  JSON.stringify(
    {
      ok: true,
      consolePath,
      htmlPath,
      readmePath,
      status: consoleArtifact.status,
      blockers: consoleArtifact.blockers,
      capabilityState: consoleArtifact.capabilityState
    },
    null,
    2
  )
);
