import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const kitJsonPath = path.join(artifactsDir, "human-acceptance-reviewer-kit.json");
const kitMarkdownPath = path.join(artifactsDir, "human-acceptance-reviewer-kit.md");
const stableTaskId = "task-photo-travel-journal";

function readJson<T>(relativePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
  } catch {
    return null;
  }
}

function evidenceStatus(relativePath: string) {
  const fullPath = path.join(process.cwd(), relativePath);
  return {
    path: relativePath,
    exists: fs.existsSync(fullPath),
    bytes: fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0
  };
}

function markdownEscape(value: string) {
  return value.replaceAll("|", "\\|");
}

export function buildHumanAcceptanceReviewerKit() {
  const preflight = readJson<{
    responseMode?: string;
    status?: string;
    baseUrl?: string;
    canStartHumanAcceptance?: boolean;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/human-acceptance-session-preflight.json");
  const humanGate = readJson<{
    responseMode?: string;
    status?: string;
    latestEvidenceKind?: string;
    latestHumanReviewed?: boolean;
    latestAutomationGenerated?: boolean;
    nextRequiredAction?: string;
  }>("artifacts/productization/human-acceptance-gate.json");
  const releaseReadiness = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    blockers?: Array<{ name?: string; evidence?: string; nextAction?: string }>;
    boundary?: { accepted?: boolean; packagingGated?: boolean; activeProvider?: string };
  }>("artifacts/productization/product-release-readiness.json");
  const productSmoke = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    passed?: number;
    total?: number;
  }>("artifacts/productization/product-ui-api-smoke.json");
  const publicBetaReadiness = readJson<{
    responseMode?: string;
    status?: string;
    betaCanStart?: boolean;
    releaseDecision?: string;
    passed?: number;
    total?: number;
  }>("artifacts/productization/public-beta-readiness.json");

  const failedReasons: string[] = [];
  if (
    preflight?.responseMode !== "human_acceptance_session_preflight_json_v1" ||
    preflight.status !== "passed" ||
    preflight.canStartHumanAcceptance !== true
  ) {
    failedReasons.push("human_acceptance_preflight_not_ready");
  }
  if (
    releaseReadiness?.releaseDecision !== "do_not_release" ||
    releaseReadiness.boundary?.accepted !== false ||
    releaseReadiness.boundary?.packagingGated !== true
  ) {
    failedReasons.push("release_lock_not_preserved");
  }
  if (productSmoke?.responseMode !== "product_ui_api_smoke_receipt_json_v1" || productSmoke.status !== "passed") {
    failedReasons.push("product_smoke_not_green");
  }
  if (
    humanGate?.responseMode !== "human_acceptance_gate_json_v1" ||
    !["blocked_needs_human_review", "passed"].includes(humanGate.status ?? "")
  ) {
    failedReasons.push("human_acceptance_gate_missing_or_unknown");
  }

  const status = failedReasons.length === 0 ? "ready_for_reviewer" : "not_ready_for_reviewer";
  const baseUrl = preflight?.baseUrl ?? "http://127.0.0.1:3000";
  const reviewerSteps = [
    {
      id: "open_manual_test",
      instruction: `Open ${baseUrl}/manual-test and confirm the Manual test entry is visible.`,
      expectedEvidence: "The page shows the stable manual acceptance workbench for the bounded product loop.",
      stopIf: "The page is unreachable, blank, or does not expose manual acceptance steps."
    },
    {
      id: "run_stable_task",
      instruction: `Open ${baseUrl}/tasks/${stableTaskId}/run and run the stable task once.`,
      expectedEvidence: "The run completes with structured output and a visible public trace.",
      stopIf: "The task cannot be opened, run, or reviewed."
    },
    {
      id: "inspect_trace_and_review",
      instruction: `Open ${baseUrl}/tasks/${stableTaskId}/review and inspect trace, evidence, and rule provenance.`,
      expectedEvidence: "The reviewer can see why the output was produced without private chain-of-thought.",
      stopIf: "Trace, evidence, or rule provenance is missing or confusing enough to block acceptance."
    },
    {
      id: "exercise_correction_loop",
      instruction: "Submit or inspect one correction and confirm reusable rule provenance remains review-bound.",
      expectedEvidence: "Correction evidence is visible and does not become release approval or packaging unlock.",
      stopIf: "A correction silently enables acceptance, packaging, or release."
    },
    {
      id: "save_human_review_evidence",
      instruction:
        "Return to /manual-test, enter reviewer name, mark every step passed or blocked, add per-step notes, confirm the attestation, and save evidence.",
      expectedEvidence:
        "artifacts/productization/manual-acceptance-latest.json records evidenceKind=human_review and humanReviewed=true.",
      stopIf: "Reviewer name, per-step notes, attestation, or save confirmation is missing."
    },
    {
      id: "maintainer_verify_gate",
      instruction:
        "Maintainer runs npm run verify:human-acceptance, then npm run verify:product-release-readiness -- --allow-blocked.",
      expectedEvidence:
        "human-acceptance-gate.json reflects the reviewer result; release readiness stays do_not_release until model and packaging approval are separate.",
      stopIf: "Verification output contradicts the saved evidence or release unlocks automatically."
    }
  ];
  const maintainerCommands = [
    "npm run start:product -- --hostname 127.0.0.1 --port 3000",
    "npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000",
    "npm run build:human-acceptance-reviewer-kit",
    "npm run verify:human-acceptance-reviewer-kit",
    "npm run build:human-acceptance-receipt-template",
    "npm run verify:human-acceptance-receipt",
    "npm run verify:human-acceptance-receipt -- --receipt path/to/filled-human-acceptance-receipt.json",
    "npm run verify:human-acceptance",
    "npm run verify:product-release-readiness -- --allow-blocked"
  ];
  const sourceEvidence = {
    humanAcceptancePreflight: {
      path: "artifacts/productization/human-acceptance-session-preflight.json",
      status: preflight?.status ?? "missing",
      canStartHumanAcceptance: preflight?.canStartHumanAcceptance ?? false,
      passed: preflight?.passed ?? 0,
      total: preflight?.total ?? 0
    },
    humanAcceptanceGate: {
      path: "artifacts/productization/human-acceptance-gate.json",
      status: humanGate?.status ?? "missing",
      latestEvidenceKind: humanGate?.latestEvidenceKind ?? "missing",
      latestHumanReviewed: humanGate?.latestHumanReviewed ?? false,
      latestAutomationGenerated: humanGate?.latestAutomationGenerated ?? true
    },
    releaseReadiness: {
      path: "artifacts/productization/product-release-readiness.json",
      status: releaseReadiness?.status ?? "missing",
      releaseDecision: releaseReadiness?.releaseDecision ?? "missing",
      blockerCount: releaseReadiness?.blockers?.length ?? 0,
      activeProvider: releaseReadiness?.boundary?.activeProvider ?? "unknown"
    },
    productSmoke: {
      path: "artifacts/productization/product-ui-api-smoke.json",
      status: productSmoke?.status ?? "missing",
      passed: productSmoke?.passed ?? 0,
      total: productSmoke?.total ?? 0
    },
    publicBetaReadiness: {
      path: "artifacts/productization/public-beta-readiness.json",
      status: publicBetaReadiness?.status ?? "missing",
      betaCanStart: publicBetaReadiness?.betaCanStart ?? false,
      passed: publicBetaReadiness?.passed ?? 0,
      total: publicBetaReadiness?.total ?? 0
    }
  };
  const evidenceToReturn = [
    "artifacts/productization/manual-acceptance-latest.json",
    "Filled human acceptance receipt validated with npm run verify:human-acceptance-receipt -- --receipt <path>.",
    "artifacts/productization/human-acceptance-gate.json",
    "artifacts/productization/product-release-readiness.json",
    "Optional screenshots or notes for any blocker."
  ];
  const locks = {
    mustNotSaveAcceptanceFromKit: true,
    mustNotEnableRules: true,
    mustNotUnlockPackaging: true,
    mustNotClaimReleaseReady: true,
    mustNotAcceptRealModel: true,
    mustNotResumeAllSoftwareObjective: true
  };

  const kit = {
    responseMode: "human_acceptance_reviewer_kit_json_v1",
    status,
    generatedAt: new Date().toISOString(),
    command: "npm run build:human-acceptance-reviewer-kit",
    productScope: "bounded_core_teaching_loop",
    stableTaskId,
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    canStartReviewerSession: status === "ready_for_reviewer",
    failedReasons,
    baseUrl,
    reviewerSteps,
    maintainerCommands,
    sourceEvidence,
    evidenceToReturn,
    forbiddenOutcomes: [
      "Do not treat this kit as product acceptance.",
      "Do not enable rules from this kit.",
      "Do not unlock packaging from this kit.",
      "Do not claim release readiness from this kit.",
      "Do not claim real-model acceptance from this kit.",
      "Do not resume the all-software objective from this kit."
    ],
    nextAction:
      status === "ready_for_reviewer"
        ? "Give human-acceptance-reviewer-kit.md to one real reviewer, collect saved human_review evidence, then run npm run verify:human-acceptance."
        : "Fix failed reviewer-kit readiness reasons, rerun human acceptance preflight, and rebuild the kit.",
    locks
  };

  const markdown = `# Human Acceptance Reviewer Kit

Status: \`${status}\`

Can start reviewer session: \`${kit.canStartReviewerSession}\`

Release decision: \`do_not_release\`

Stable task: \`${stableTaskId}\`

## Reviewer Steps

${reviewerSteps
  .map(
    (step, index) =>
      `${index + 1}. ${step.instruction}\n   - Expected evidence: ${step.expectedEvidence}\n   - Stop if: ${step.stopIf}`
  )
  .join("\n")}

## Maintainer Commands

${maintainerCommands.map((command) => `- \`${command}\``).join("\n")}

## Source Evidence

| Evidence | Path | Status |
| --- | --- | --- |
${Object.entries(sourceEvidence)
  .map(([name, evidence]) => `| ${name} | \`${markdownEscape(evidence.path)}\` | \`${markdownEscape(evidence.status)}\` |`)
  .join("\n")}

## Evidence To Return

${evidenceToReturn.map((item) => `- \`${item}\``).join("\n")}

Use \`artifacts/productization/human-acceptance-receipt.template.json\` for the reviewer return. Validate any filled copy with \`npm run verify:human-acceptance-receipt -- --receipt <path>\` before using it as follow-up evidence.

## Boundary

- This kit is review-only.
- It does not save acceptance.
- It does not enable rules.
- It does not unlock packaging.
- It does not claim release readiness.
- It does not claim real-model acceptance.
- It keeps \`accepted=false\`, \`packagingGated=true\`, \`canRelease=false\`, \`canActivateRealModel=false\`, and \`allSoftwareObjective=paused\`.
- The saved evidence must be \`evidenceKind=human_review\` with \`humanReviewed=true\`.
- The saved evidence shape is \`manual_test_workbench_human_review_evidence_v1\`.

## Failed Reasons

${failedReasons.length === 0 ? "- none" : failedReasons.map((reason) => `- ${reason}`).join("\n")}
`;

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(kitJsonPath, JSON.stringify(kit, null, 2));
  fs.writeFileSync(kitMarkdownPath, markdown);

  return {
    ...kit,
    generatedFiles: [evidenceStatus("artifacts/productization/human-acceptance-reviewer-kit.json"), evidenceStatus("artifacts/productization/human-acceptance-reviewer-kit.md")]
  };
}

function main() {
  const kit = buildHumanAcceptanceReviewerKit();
  console.log(JSON.stringify(kit, null, 2));
  console.log(`\nHuman acceptance reviewer kit written to ${kitJsonPath}`);
  console.log(`Human acceptance reviewer kit Markdown written to ${kitMarkdownPath}`);

  if (kit.status !== "ready_for_reviewer") {
    process.exitCode = 1;
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (path.resolve(process.argv[1] ?? "") === currentFile) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

export {};
