#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const sourceRepoRoot = resolve(pluginRoot, "..", "..");
const sourceServerScript = join(sourceRepoRoot, "plugins", "transparent-ai-apprentice", "scripts", "mcp-server.mjs");
const packagedServerScript = join(pluginRoot, "scripts", "mcp-server.mjs");
const runsFromSourceTree = existsSync(sourceServerScript);
const repoRoot = runsFromSourceTree ? sourceRepoRoot : resolve(process.cwd());
const serverScript = runsFromSourceTree ? sourceServerScript : packagedServerScript;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function startServer(extraEnv = {}) {
  const child = spawn(process.execPath, [serverScript], {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
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

const smokeRoot = join(repoRoot, ".ta-smoke", "current-goal-final-teacher-acceptance-mcp");
const laneIds = [
  "completion_blocker_matrix_present",
  "all_software_low_token_coverage_final_review",
  "real_local_non_cad_solidworks_scope_evidence",
  "teacher_method_adaptation_reuse_result_proof",
  "unattended_all_software_operational_evidence",
  "transparent_2d_perspective_3d_sketch_implementation",
  "teacher_validated_spatial_intent_and_detail_logic",
  "voice_text_numbered_execution_capability_convergence",
  "rule_dsl_validation_report_delivery_gate_audit",
  "explicit_final_teacher_acceptance"
];
const gatePath = writeJson(join(smokeRoot, "current-goal-final-convergence-readiness-gate.json"), {
  ok: true,
  format: "transparent_ai_current_goal_final_convergence_readiness_gate_v1",
  status: "convergence_evidence_ready_for_final_teacher_review_not_completion",
  summary: {
    totalLanes: laneIds.length,
    reviewEvidenceReadyLanes: laneIds.length - 1,
    missingReviewEvidenceLanes: 1,
    completionReadyLanes: 0,
    finalTeacherAcceptanceReady: false,
    finalGoalCompletionAllowed: false
  },
  lanes: laneIds.map((laneId) => ({
    laneId,
    finalGateStatus: laneId === "explicit_final_teacher_acceptance" ? "blocked_before_goal_completion_claim" : "ready_for_final_teacher_acceptance_review",
    evidencePath: "",
    evidenceFormat: laneId === "explicit_final_teacher_acceptance" ? "" : "fixture_evidence_v1",
    evidenceStatus: laneId === "explicit_final_teacher_acceptance" ? "" : "ready_for_final_teacher_acceptance_review",
    evidenceExists: laneId !== "explicit_final_teacher_acceptance",
    reviewEvidenceReady: laneId !== "explicit_final_teacher_acceptance",
    completionReady: false,
    blocker:
      laneId === "explicit_final_teacher_acceptance"
        ? "Final teacher acceptance receipt is still missing."
        : "Evidence is ready for teacher review."
  })),
  locks: { goalComplete: false }
});

const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
try {
  await server.rpc("initialize", {});
  server.rpc("notifications/initialized", {}).catch(() => {});
  const tools = await server.rpc("tools/list", {});
  const toolNames = tools.tools.map((tool) => tool.name);
  assert(
    toolNames.includes("create_current_goal_final_teacher_acceptance_review_pack") &&
      toolNames.includes("validate_current_goal_final_teacher_acceptance_receipt"),
    "current-goal final teacher acceptance tools should be exposed"
  );

  const packCall = await server.rpc("tools/call", {
    name: "create_current_goal_final_teacher_acceptance_review_pack",
    arguments: {
      finalConvergenceReadinessGate: gatePath,
      outputDir: join(smokeRoot, "packs")
    }
  });
  const packResult = JSON.parse(packCall.content[0].text);
  assert(packResult.readyForTeacherFinalAcceptanceReview === true, "pack tool should produce a teacher-review-ready pack");

  const pack = readJson(packResult.packPath);
  const defaultValidationCall = await server.rpc("tools/call", {
    name: "validate_current_goal_final_teacher_acceptance_receipt",
    arguments: {
      finalConvergenceReadinessGate: gatePath,
      receipt: pack.receiptTemplate,
      outputDir: join(smokeRoot, "default-validation")
    }
  });
  const defaultValidation = JSON.parse(defaultValidationCall.content[0].text);
  assert(defaultValidation.readyForFinalCompletionGate === false, "default receipt must stay blocked through MCP");

  const acceptedReceiptPath = writeJson(join(smokeRoot, "accepted-receipt.json"), {
    ...pack.receiptTemplate,
    teacherDecision: "accept_full_original_goal_completion",
    teacherConfirmedFullOriginalScope: true,
    teacherReviewedEveryEvidenceLane: true,
    teacherAcceptsReviewOnlyBoundary: true,
    teacherAcceptsRemainingCompletionBoundary: true,
    forbiddenAutomationRequested: false,
    teacherSummaryNote: "MCP smoke accepted fixture.",
    laneReviews: pack.receiptTemplate.laneReviews.map((row) => ({
      ...row,
      teacherReviewed: true,
      teacherDecision: "confirmed",
      teacherNote: "Fixture lane confirmed."
    }))
  });
  const acceptedValidationCall = await server.rpc("tools/call", {
    name: "validate_current_goal_final_teacher_acceptance_receipt",
    arguments: {
      finalConvergenceReadinessGate: gatePath,
      receipt: acceptedReceiptPath,
      outputDir: join(smokeRoot, "accepted-validation")
    }
  });
  const acceptedValidation = JSON.parse(acceptedValidationCall.content[0].text);
  assert(acceptedValidation.readyForFinalCompletionGate === true, "accepted receipt should validate ready through MCP");

  console.log(
    JSON.stringify(
      {
        ok: true,
        format: "transparent_ai_current_goal_final_teacher_acceptance_mcp_surface_smoke_v1",
        packStatus: packResult.status,
        defaultValidationStatus: defaultValidation.status,
        acceptedValidationStatus: acceptedValidation.status
      },
      null,
      2
    )
  );
} finally {
  await server.stop();
}
