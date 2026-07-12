#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "next-proof-gap-focused-receipt-builder", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
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

const candidatePath = join(smokeRoot, "post-registration-output-witness.html");
writeFileSync(candidatePath, "bounded output witness candidate\n", "utf8");
const queuePath = join(smokeRoot, "original-goal-proof-gap-teacher-queue.json");
writeFileSync(
  queuePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_original_goal_proof_gap_teacher_queue_v1",
      status: "waiting_for_teacher_evidence_queue_receipt",
      nextProofGapSummary: {
        itemNumber: 1,
        routeId: "post_registration_output_witness_route",
        requirementId: "all_software_low_token_learning"
      },
      queueItems: [
        {
          itemNumber: 1,
          phase: "all_software_low_token_log_learning",
          requirementId: "all_software_low_token_learning",
          routeId: "post_registration_output_witness_route",
          title: "Prove runner launch and bounded output witness",
          teacherQuestion:
            "Does the bounded runner/output witness prove the monitor ran without reading full logs or capturing screenshots unnecessarily?",
          requiredTeacherInputs: [
            "registered-and-matching monitor status",
            "teacher confirmation text",
            "output witness receipt"
          ],
          evidence: [{ key: "candidate", label: "Candidate witness", value: candidatePath, exists: true }],
          verificationCommandTemplate: "node run-witness.js --teacher-confirmation \"<teacher-confirmation>\"",
          blockedUntilTeacher: true,
          highRiskMarkers: ["--teacher-confirmation"]
        },
        {
          itemNumber: 2,
          phase: "transparent_overlay_spatial_depth",
          requirementId: "transparent_overlay_spatial_depth",
          routeId: "transparent_overlay_depth_route",
          title: "Depth route",
          teacherQuestion: "Does the overlay packet prove depth intent?",
          requiredTeacherInputs: ["overlay packet"]
        }
      ]
    },
    null,
    2
  )}\n`,
  "utf8"
);

const prefillPath = join(smokeRoot, "original-goal-proof-gap-evidence-prefill.json");
writeFileSync(
  prefillPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_original_goal_proof_gap_evidence_prefill_v1",
      status: "candidate_only_waiting_for_teacher_review",
      rows: [
        {
          itemNumber: 1,
          requirementId: "all_software_low_token_learning",
          routeId: "post_registration_output_witness_route",
          candidateObservedEvidencePath: candidatePath,
          primaryCandidateEvidence: {
            key: "postRegistrationOutputWitnessHtml",
            label: "Post-registration output witness",
            value: candidatePath,
            exists: true
          },
          candidateEvidence: [
            {
              key: "postRegistrationOutputWitnessHtml",
              label: "Post-registration output witness",
              value: candidatePath,
              exists: true
            }
          ],
          teacherStillMustConfirm: [
            "teacher must review the candidate evidence",
            "teacher must provide a retained rollback point"
          ]
        }
      ]
    },
    null,
    2
  )}\n`,
  "utf8"
);

const result = runNodeScript("create-original-goal-next-proof-gap-focused-receipt-builder.mjs", [
  "--queue",
  queuePath,
  "--prefill",
  prefillPath,
  "--output-dir",
  join(smokeRoot, "focused-builder")
]);
const builder = readJson(result.builderPath);
const template = readJson(result.receiptTemplatePath);
const html = readFileSync(result.htmlPath, "utf8");
const readme = readFileSync(result.readmePath, "utf8");

const teacherFilledReceiptPath = join(smokeRoot, "teacher-filled-next-proof-gap-focused-receipt.json");
const receipt = JSON.parse(JSON.stringify(template));
receipt.rows[0].decision = "teacher_evidence_attached";
receipt.rows[0].observedEvidencePath = candidatePath;
receipt.rows[0].teacherConfirmationText = "teacher confirmed bounded witness and no full log read";
receipt.rows[0].retainedRollbackPoint = "rollback-point-kept-until-teacher-confirms";
writeFileSync(teacherFilledReceiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
const validation = runNodeScript("validate-original-goal-proof-gap-teacher-queue-receipt.mjs", [
  "--queue",
  queuePath,
  "--receipt",
  teacherFilledReceiptPath,
  "--output-dir",
  join(smokeRoot, "validation")
]);

const blankReceiptValidation = runNodeScript("validate-original-goal-proof-gap-teacher-queue-receipt.mjs", [
  "--queue",
  queuePath,
  "--receipt",
  result.receiptTemplatePath,
  "--output-dir",
  join(smokeRoot, "blank-validation")
]);

const checks = [
  {
    name: "Focused builder writes JSON HTML README and one-row receipt template",
    pass:
      builder.format === "transparent_ai_original_goal_next_proof_gap_focused_receipt_builder_v1" &&
      existsSync(builder.paths.builder) &&
      existsSync(builder.paths.html) &&
      existsSync(builder.paths.readme) &&
      existsSync(builder.paths.receiptTemplate) &&
      template.format === "transparent_ai_original_goal_proof_gap_teacher_queue_receipt_v1" &&
      template.focusedOnly === true &&
      template.rows.length === 1,
    evidence: builder.paths
  },
  {
    name: "Focused row selects the current post-registration output witness route",
    pass:
      builder.focusedRouteId === "post_registration_output_witness_route" &&
      builder.focusedRequirementId === "all_software_low_token_learning" &&
      builder.focusedRow.itemNumber === 1 &&
      builder.candidateEvidenceExists === true &&
      builder.focusedRow.candidateObservedEvidencePath === candidatePath,
    evidence: builder.focusedRow
  },
  {
    name: "Template keeps observed evidence blank and requires retained rollback point",
    pass:
      template.rows[0].observedEvidencePath === "" &&
      template.rows[0].teacherConfirmationText === "" &&
      template.rows[0].retainedRollbackPoint === "" &&
      template.rows[0].requiresRetainedRollbackPoint === true &&
      template.rows[0].candidateObservedEvidencePath === candidatePath,
    evidence: template.rows[0]
  },
  {
    name: "HTML and README expose teacher-facing focused workflow",
    pass:
      html.includes("Use candidate path after teacher review") &&
      html.includes("post_registration_output_witness_route") &&
      html.includes("Copy validation command") &&
      html.includes("Retained rollback point") &&
      readme.includes("one-row teacher receipt builder") &&
      readme.includes("retained rollback point"),
    evidence: { htmlPath: result.htmlPath, readmePath: result.readmePath }
  },
  {
    name: "Existing validator accepts a filled focused receipt and rejects blank readiness",
    pass:
      validation.status === "validated_with_manual_next_review_queue" &&
      validation.readyRows === 1 &&
      validation.nextReviewQueue === 1 &&
      blankReceiptValidation.status === "waiting_for_teacher_evidence" &&
      blankReceiptValidation.readyRows === 0,
    evidence: { validation, blankReceiptValidation }
  },
  {
    name: "Locks stay closed",
    pass:
      builder.locks.reviewOnly === true &&
      builder.locks.builderDoesNotRunCommands === true &&
      builder.locks.builderDoesNotExecuteTargetSoftware === true &&
      builder.locks.builderDoesNotReadFullLogs === true &&
      builder.locks.builderDoesNotCaptureScreenshots === true &&
      builder.locks.builderDoesNotWriteMemory === true &&
      builder.locks.builderDoesNotDeleteRollbackPoints === true &&
      builder.locks.goalComplete === false,
    evidence: builder.locks
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(JSON.stringify({ ok: false, failed, smokeRoot }, null, 2));
  process.exit(1);
}

rmSync(smokeRoot, { recursive: true, force: true });

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_original_goal_next_proof_gap_focused_receipt_builder_smoke_v1",
      checks,
      tempCleaned: true
    },
    null,
    2
  )
);
