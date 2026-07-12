#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "current-goal-integrated-evidence-gate", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const result = runNodeScript("create-current-goal-integrated-evidence-gate.mjs", [
  "--goal",
  "Smoke full current goal: all software low-token learning, teacher-method adaptation, transparent overlay drawing, perspective and 2D/3D depth understanding, and later teacher-confirmed software execution.",
  "--output-dir",
  smokeRoot
]);
const gate = readJson(result.gatePath);
const byId = new Map(gate.requirements.map((item) => [item.id, item]));
const expectedIds = [
  "all_software_low_token_log_learning",
  "teacher_method_adaptation",
  "transparent_drawing_mask",
  "spatial_perspective_position_understanding",
  "two_d_three_d_depth_sketch_demonstration",
  "teacher_confirmed_target_software_execution",
  "voice_text_numbered_execution_control",
  "rollback_teacher_review_control",
  "high_to_medium_reasoning_cost_control",
  "rag_knowledge_evidence_only"
];

const checks = [
  {
    name: "Integrated gate writes JSON HTML README and keeps source handoffs linked",
    pass:
      gate.format === "transparent_ai_current_goal_integrated_evidence_gate_v1" &&
      existsSync(gate.paths.gate) &&
      existsSync(gate.paths.html) &&
      existsSync(gate.paths.readme) &&
      gate.sourceEvidenceStatus.lowTokenHandoff === "linked" &&
      gate.sourceEvidenceStatus.teacherSpatialDrawingHandoff === "linked" &&
      gate.sourceEvidenceStatus.physicalWorldSpatialGroundingPack === "linked" &&
      gate.sourceEvidenceStatus.teacherMethodAdaptationHandoff === "linked" &&
      gate.sourceEvidenceStatus.voiceTextNumberedExecutionSession === "linked",
    evidence: gate.paths
  },
  {
    name: "Requirement matrix preserves the full current objective instead of only one narrow lane",
    pass:
      expectedIds.every((id) => byId.has(id)) &&
      gate.requirements.length >= expectedIds.length &&
      gate.completionAudit.totalRequirements === gate.requirements.length,
    evidence: gate.requirements.map((item) => item.id)
  },
  {
    name: "Low-token all-software lane is partial proof only and still waits for teacher route selection",
    pass:
      byId.get("all_software_low_token_log_learning")?.implementationEvidenceProven === true &&
      byId.get("all_software_low_token_log_learning")?.completionProven === false &&
      /Teacher must select/.test(byId.get("all_software_low_token_log_learning")?.blocker || ""),
    evidence: byId.get("all_software_low_token_log_learning")
  },
  {
    name: "Transparent overlay and 2D/3D depth sketch are implementation-ready but not teacher evidence",
    pass:
      byId.get("transparent_drawing_mask")?.implementationEvidenceProven === true &&
      byId.get("transparent_drawing_mask")?.completionProven === false &&
      byId.get("two_d_three_d_depth_sketch_demonstration")?.implementationEvidenceProven === true &&
      byId.get("two_d_three_d_depth_sketch_demonstration")?.completionProven === false &&
      byId
        .get("two_d_three_d_depth_sketch_demonstration")
        ?.strictLocks.includes("sample_validation_not_goal_completion"),
    evidence: {
      transparent: byId.get("transparent_drawing_mask"),
      depth: byId.get("two_d_three_d_depth_sketch_demonstration")
    }
  },
  {
    name: "Physical-world grounding is folded into spatial perspective and 2D/3D depth evidence without becoming authority",
    pass:
      byId.get("spatial_perspective_position_understanding")?.evidenceSummary
        ?.physicalGroundingReadyForOverlayReview === true &&
      (byId.get("spatial_perspective_position_understanding")?.evidenceSummary?.physicalGroundingPresentRows || 0) >= 5 &&
      Array.isArray(
        byId.get("two_d_three_d_depth_sketch_demonstration")?.evidenceSummary?.physicalGroundingOverlayNeeds
      ) &&
      byId
        .get("two_d_three_d_depth_sketch_demonstration")
        ?.evidenceSummary?.physicalGroundingOverlayNeeds.includes("3D depth / near-far intent") &&
      byId
        .get("teacher_confirmed_target_software_execution")
        ?.nextActionCommand.includes("--physical-world-spatial-grounding-pack") &&
      gate.locks.gateDoesNotExecuteTargetSoftware === true &&
      gate.goalComplete === false,
    evidence: {
      sourceStatus: gate.sourceEvidenceStatus.physicalWorldSpatialGroundingPack,
      spatial: byId.get("spatial_perspective_position_understanding")?.evidenceSummary,
      depth: byId.get("two_d_three_d_depth_sketch_demonstration")?.evidenceSummary,
      executionCommand: byId.get("teacher_confirmed_target_software_execution")?.nextActionCommand
    }
  },
  {
    name: "Voice/text numbered execution lane is implementation-ready but blocked until teacher confirms one number",
    pass:
      byId.get("voice_text_numbered_execution_control")?.implementationEvidenceProven === true &&
      byId.get("voice_text_numbered_execution_control")?.completionProven === false &&
      byId
        .get("voice_text_numbered_execution_control")
        ?.strictLocks.includes("voice_text_cannot_execute_without_confirmed_number") &&
      /confirm exactly one numbered target/.test(byId.get("voice_text_numbered_execution_control")?.blocker || ""),
    evidence: byId.get("voice_text_numbered_execution_control")
  },
  {
    name: "Teacher method and high-to-medium reasoning are gated before medium runtime reuse",
    pass:
      byId.get("teacher_method_adaptation")?.implementationEvidenceProven === true &&
      byId.get("teacher_method_adaptation")?.completionProven === false &&
      byId.get("high_to_medium_reasoning_cost_control")?.implementationEvidenceProven === true &&
      byId.get("high_to_medium_reasoning_cost_control")?.completionProven === false &&
      gate.locks.mediumRuntimeReuseEnabled === false,
    evidence: {
      teacherMethod: byId.get("teacher_method_adaptation"),
      reasoning: byId.get("high_to_medium_reasoning_cost_control")
    }
  },
  {
    name: "Actual target software execution and goal completion remain explicitly blocked",
    pass:
      byId.get("teacher_confirmed_target_software_execution")?.completionProven === false &&
      /separate execution approval gate/.test(byId.get("teacher_confirmed_target_software_execution")?.blocker || "") &&
      gate.goalComplete === false &&
      gate.completionAudit.goalCompleteProven === false &&
      gate.completionAudit.completionProvenCount === 0 &&
      gate.blockedActions.includes("execute_target_software_from_integrated_gate") &&
      gate.blockedActions.includes("claim_current_goal_complete_from_integrated_gate"),
    evidence: gate.completionAudit
  },
  {
    name: "Integrated gate keeps all system-change locks closed",
    pass:
      gate.locks.gateDoesNotReadLogs === true &&
      gate.locks.gateDoesNotReadFullLogs === true &&
      gate.locks.gateDoesNotCaptureScreenshots === true &&
      gate.locks.gateDoesNotRecordScreen === true &&
      gate.locks.gateDoesNotExecuteTargetSoftware === true &&
      gate.locks.gateDoesNotWriteMemory === true &&
      gate.locks.gateDoesNotEnableRules === true &&
      gate.locks.goalComplete === false,
    evidence: gate.locks
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(JSON.stringify({ ok: false, failed, smokeRoot }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_current_goal_integrated_evidence_gate_smoke_v1",
      smokeRoot,
      checks,
      artifact: result.gatePath
    },
    null,
    2
  )
);
