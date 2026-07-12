#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function touch(path, text = "ok") {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text, "utf8");
}

const temp = mkdtempSync(join(tmpdir(), "current-goal-next-teacher-confirmation-cockpit-"));
const artifacts = join(temp, "artifacts");
mkdirSync(artifacts, { recursive: true });
const paths = {
  batchHtml: join(artifacts, "batch.html"),
  proofHtml: join(artifacts, "proof.html"),
  overlayHtml: join(artifacts, "overlay.html"),
  samplePacket: join(artifacts, "sample-packet.json"),
  shortestHtml: join(artifacts, "shortest.html"),
  shortestReceiptHtml: join(artifacts, "shortest-receipt.html"),
  finalHtml: join(artifacts, "final.html"),
  convergenceHtml: join(artifacts, "convergence.html"),
  inventory: join(artifacts, "inventory.json"),
  candidateEvidence: join(artifacts, "candidate-evidence.json")
};
for (const path of Object.values(paths)) touch(path);

const launchpadPath = join(temp, "current-goal-start-here.json");
const launchpad = {
  ok: true,
  format: "transparent_ai_current_goal_start_here_launchpad_v1",
  status: "stable_start_here_ready_review_only_goal_not_complete",
  statusSummary: {
    allSoftwareObserverInventoryBatchReviewBuilderStatus: "waiting_for_teacher_inventory_batch_review_receipt",
    nextProofGapFocusedReceiptBuilderStatus: "waiting_for_teacher_to_fill_next_proof_gap_focused_receipt",
    nextProofGapCandidateEvidencePath: paths.candidateEvidence,
    spatialStatus: "waiting_for_teacher_exported_overlay_packet",
    shortestTeacherEvidencePackStatus: "shortest_teacher_evidence_pack_ready_review_only_goal_not_complete",
    finalTeacherAcceptanceReviewPackStatus: "waiting_for_final_teacher_acceptance_review"
  },
  entryLinks: [
    { id: "all_software_observer_inventory_batch_review_builder_html", path: paths.batchHtml },
    { id: "all_software_observer_inventory_probe_output", path: paths.inventory },
    { id: "next_proof_gap_focused_receipt_builder_html", path: paths.proofHtml },
    { id: "proof_gap_evidence_prefill_html", path: paths.candidateEvidence },
    { id: "transparent_overlay_browser_html", path: paths.overlayHtml },
    { id: "spatial_handoff_html", path: paths.samplePacket },
    { id: "shortest_teacher_evidence_pack_html", path: paths.shortestHtml },
    { id: "shortest_teacher_evidence_receipt_builder_html", path: paths.shortestReceiptHtml },
    { id: "final_teacher_acceptance_review_pack_html", path: paths.finalHtml },
    { id: "final_convergence_readiness_gate_html", path: paths.convergenceHtml }
  ],
  safeNextActions: [
    {
      id: "build_all_software_reviewed_queue_from_receipt",
      commandOrPath: "node plugins\\transparent-ai-apprentice\\scripts\\create-all-software-observer-reviewed-queue-from-receipt.mjs --receipt <teacher-filled.json>"
    },
    {
      id: "validate_proof_gap_teacher_queue_receipt",
      commandOrPath: "node plugins\\transparent-ai-apprentice\\scripts\\validate-original-goal-proof-gap-teacher-queue-receipt.mjs --receipt <teacher-filled.json>"
    },
    {
      id: "validate_teacher_overlay_packet",
      commandOrPath: "node plugins\\transparent-ai-apprentice\\scripts\\validate-transparent-sketch-overlay-packet.mjs --overlay-packet <teacher-exported.json>"
    },
    {
      id: "validate_shortest_teacher_evidence_receipt",
      commandOrPath: "node plugins\\transparent-ai-apprentice\\scripts\\validate-current-goal-shortest-teacher-evidence-receipt.mjs --receipt <teacher-filled.json>"
    },
    {
      id: "validate_final_teacher_acceptance_receipt",
      commandOrPath: "node plugins\\transparent-ai-apprentice\\scripts\\validate-current-goal-final-teacher-acceptance-receipt.mjs --receipt <teacher-filled.json>"
    }
  ],
  paths: {
    allSoftwareObserverInventoryBatchReviewBuilderHtml: paths.batchHtml,
    allSoftwareObserverInventoryProbeOutput: paths.inventory,
    proofGapNextFocusedReceiptBuilderHtml: paths.proofHtml,
    teacherSpatialOverlayHtml: paths.overlayHtml,
    teacherSpatialSampleOverlayPacket: paths.samplePacket
  },
  goalComplete: false
};
writeFileSync(launchpadPath, `${JSON.stringify(launchpad, null, 2)}\n`, "utf8");

const resultText = execFileSync(
  process.execPath,
  [
    "plugins/transparent-ai-apprentice/scripts/create-current-goal-next-teacher-confirmation-cockpit.mjs",
    "--launchpad",
    launchpadPath,
    "--output-dir",
    join(temp, "cockpit")
  ],
  { cwd: process.cwd(), encoding: "utf8" }
);
const result = JSON.parse(resultText);
const cockpit = readJson(result.cockpitPath);
const html = readFileSync(result.htmlPath, "utf8");

assert(result.ok === true, "cockpit command should succeed");
assert(cockpit.format === "transparent_ai_current_goal_next_teacher_confirmation_cockpit_v1", "unexpected cockpit format");
assert(cockpit.status === "waiting_for_teacher_confirmation_across_current_goal_next_actions", "unexpected cockpit status");
assert(cockpit.reviewCards.length === 5, "cockpit should expose five teacher confirmation cards");
assert(cockpit.receiptTemplate?.format === "transparent_ai_current_goal_next_teacher_confirmation_cockpit_receipt_v1", "receipt template missing");
assert(cockpit.receiptTemplate.rowDecisions.length === 5, "receipt template should include five rows");
assert(cockpit.interactiveReceiptBuilder?.generatesReceiptJsonInBrowser === true, "browser receipt builder should be available");
assert(cockpit.nextValidationCommand.includes("validate-current-goal-next-teacher-confirmation-cockpit-receipt.mjs"), "next validation command missing");
assert(cockpit.paths.receiptTemplate && existsSync(cockpit.paths.receiptTemplate), "receipt template file should exist");
assert(cockpit.reviewCards.every((item) => item.defaultDecision === "needs_teacher_review"), "cards should default to teacher review");
assert(
  cockpit.reviewCards.every((item) => item.blockedTeacherDecisions.includes("accepted")),
  "cards should block acceptance decisions"
);
assert(cockpit.locks.reviewOnly === true, "cockpit should be review only");
assert(cockpit.locks.cockpitDoesNotExecuteTargetSoftware === true, "cockpit should not execute target software");
assert(cockpit.locks.cockpitDoesNotDeleteRollbackPoints === true, "cockpit should not delete rollback points");
assert(cockpit.goalComplete === false, "cockpit must not claim goal completion");
assert(cockpit.reviewCards.some((item) => item.id === "transparent_overlay_packet"), "transparent overlay card missing");
assert(
  cockpit.reviewCards.some((item) => item.nextCommandAfterTeacherReview.includes("create-all-software-observer-reviewed-queue-from-receipt.mjs")),
  "all-software reviewed-queue bridge command missing"
);
assert(html.includes("Current Goal Next Teacher Confirmation Cockpit"), "html title missing");
assert(html.includes("Transparent overlay packet"), "html overlay card missing");
assert(html.includes("Generate reviewed receipt JSON"), "html receipt generator missing");
assert(existsSync(result.readmePath), "readme should exist");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_current_goal_next_teacher_confirmation_cockpit_smoke_v1",
      cockpitPath: result.cockpitPath,
      htmlPath: result.htmlPath,
      cardCount: cockpit.reviewCards.length
    },
    null,
    2
  )
);
