#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "triggered-visual-transparent-overlay-handoff-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const queuePath = join(smokeRoot, "automatic-triggered-visual-check-queue.json");
const eventPolicyPath = join(smokeRoot, "event-triggered-low-token-observation-policy.json");
const readinessPath = join(smokeRoot, "real-local-all-software-low-token-readiness-package.json");
const mcpServerText = readFileSync(join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "mcp-server.mjs"), "utf8");

writeFileSync(
  queuePath,
  `${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_automatic_triggered_visual_check_queue_v1",
      queueId: "smoke-triggered-visual-queue",
      status: "waiting_for_teacher_visual_check_review",
      requests: [
        {
          id: "visual-request-1",
          source: "automatic_low_token_compact_learning_event",
          software: "GenericModeler",
          processName: "GenericModeler.exe",
          triggerReason: "needs_teacher_review",
          compactLearningEventsPath: join(smokeRoot, "compact-learning-events.json"),
          learningCyclePath: join(smokeRoot, "all-software-low-token-learning-cycle.json"),
          triggerEvidence: {
            compactEventCount: 2,
            classifications: ["needs_teacher_review"],
            reviewPrompt: "Which visible target should receive the command?"
          },
          captureOnlyAfterReview: true,
          maxScreenshots: 1
        }
      ],
      locks: {
        maxOneScreenshotPerRequest: true,
        teacherConfirmationRequiredBeforeCapture: true,
        screenshotsCaptured: false,
        softwareActionsExecuted: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(
  eventPolicyPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_event_triggered_low_token_observation_policy_v1",
      status: "waiting_for_teacher_event_trigger_policy_review",
      locks: { eventTriggeredOnly: true, screenshotsCaptured: false, softwareActionsExecuted: false }
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(
  readinessPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_real_local_all_software_low_token_readiness_package_v1",
      status: "waiting_for_teacher_review_before_registration_or_learning_memory",
      counts: { compactLearningEvents: 2, triggeredVisualRequests: 1 },
      locks: { screenshotsCaptured: false, softwareActionsExecuted: false }
    },
    null,
    2
  )}\n`,
  "utf8"
);

const result = runNodeScript("create-triggered-visual-transparent-overlay-handoff.mjs", [
  "--visual-check-queue",
  queuePath,
  "--event-policy",
  eventPolicyPath,
  "--readiness-package",
  readinessPath,
  "--request-index",
  "0",
  "--teacher-command",
  "Mark possible positions with numbers and wait for teacher confirmation.",
  "--output-dir",
  join(smokeRoot, "handoff")
]);
const handoff = readJson(result.handoffPath);
const dryRunCapture = readJson(handoff.paths.dryRunCaptureReceipt);

const checks = [
  {
    name: "Triggered visual handoff creates overlay kit and teacher-visible HTML",
    pass:
      handoff.format === "transparent_ai_triggered_visual_transparent_overlay_handoff_v1" &&
      handoff.status === "waiting_for_teacher_transparent_overlay_capture_or_export" &&
      existsSync(handoff.paths.overlayHtml) &&
      existsSync(handoff.paths.overlayManifest) &&
      existsSync(handoff.paths.sampleOverlayPacket) &&
      existsSync(result.htmlPath),
    evidence: result.handoffPath
  },
  {
    name: "Triggered visual handoff creates dry-run capture receipt without screenshot",
    pass:
      dryRunCapture.format === "transparent_ai_triggered_visual_check_capture_receipt_v1" &&
      dryRunCapture.status === "dry_run_no_screenshot_captured" &&
      dryRunCapture.screenshotCount === 0 &&
      dryRunCapture.locks.softwareActionsExecuted === false,
    evidence: handoff.paths.dryRunCaptureReceipt
  },
  {
    name: "Triggered visual handoff links overlay to spatial interpretation target confirmation and execution gate templates",
    pass:
      handoff.commandTemplates.interpretTeacherOverlayPacket.includes("interpret-transparent-sketch-spatial-intent.mjs") &&
      handoff.commandTemplates.createSpatialTargetConfirmation.includes("create-spatial-target-confirmation-kit.mjs") &&
      handoff.commandTemplates.createSpatialSoftwareExecutionGate.includes("create-spatial-to-software-execution-gate-package.mjs") &&
      handoff.teacherReviewOrder.some((step) => step.includes("2D position, angle, perspective, and 3D depth logic")),
    evidence: JSON.stringify(handoff.commandTemplates)
  },
  {
    name: "Triggered visual handoff keeps execution memory rule and packaging locks closed",
    pass:
      handoff.locks.handoffDoesNotCaptureScreenshots === true &&
      handoff.locks.handoffDoesNotExecuteSoftware === true &&
      handoff.locks.handoffDoesNotWriteMemory === true &&
      handoff.locks.handoffDoesNotEnableRules === true &&
      handoff.locks.screenshotsCaptured === false &&
      handoff.locks.softwareActionsExecuted === false &&
      handoff.locks.teacherExportedOverlayPacketRequired === true &&
      handoff.locks.numberedTargetConfirmationRequired === true,
    evidence: JSON.stringify(handoff.locks)
  },
  {
    name: "MCP advanced tool exposes triggered visual transparent overlay handoff",
    pass:
      mcpServerText.includes('name: "create_triggered_visual_transparent_overlay_handoff"') &&
      mcpServerText.includes("create-triggered-visual-transparent-overlay-handoff.mjs") &&
      mcpServerText.includes("buildTriggeredVisualTransparentOverlayHandoffArgs"),
    evidence: "mcp-server.mjs contains create_triggered_visual_transparent_overlay_handoff"
  }
];
const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_triggered_visual_transparent_overlay_handoff_smoke_v1",
      smokeRoot,
      paths: {
        handoff: result.handoffPath,
        html: result.htmlPath,
        overlayHtml: handoff.paths.overlayHtml,
        dryRunCaptureReceipt: handoff.paths.dryRunCaptureReceipt
      },
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
