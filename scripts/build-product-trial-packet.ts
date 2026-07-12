import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const packetDir = path.join(artifactsDir, "product-trial-packet");
const docsDir = path.join(packetDir, "docs");
const evidenceDir = path.join(packetDir, "evidence");

type PacketFile = {
  source: string;
  destination: string;
  required: boolean;
};

const files: PacketFile[] = [
  { source: "README.md", destination: "docs/README.md", required: true },
  { source: "PRODUCT_HANDOFF.md", destination: "docs/PRODUCT_HANDOFF.md", required: true },
  { source: "PRODUCTIZATION_FOCUS.md", destination: "docs/PRODUCTIZATION_FOCUS.md", required: true },
  { source: ".env.example", destination: "docs/.env.example", required: true },
  {
    source: "artifacts/productization/product-verification-receipt.json",
    destination: "evidence/product-verification-receipt.json",
    required: true
  },
  {
    source: "artifacts/productization/product-ui-api-smoke.json",
    destination: "evidence/product-ui-api-smoke.json",
    required: true
  },
  {
    source: "artifacts/productization/product-runtime-verification.json",
    destination: "evidence/product-runtime-verification.json",
    required: true
  },
  {
    source: "artifacts/productization/product-runtime-doctor.json",
    destination: "evidence/product-runtime-doctor.json",
    required: true
  },
  {
    source: "artifacts/productization/product-release-readiness.json",
    destination: "evidence/product-release-readiness.json",
    required: true
  },
  {
    source: "artifacts/productization/productization-evidence-freshness.json",
    destination: "evidence/productization-evidence-freshness.json",
    required: false
  },
  {
    source: "artifacts/productization/product-status-summary.json",
    destination: "evidence/product-status-summary.json",
    required: false
  },
  {
    source: "artifacts/productization/product-status-summary-verification.json",
    destination: "evidence/product-status-summary-verification.json",
    required: false
  },
  {
    source: "artifacts/productization/product-status-summary.md",
    destination: "docs/PRODUCT_STATUS_SUMMARY.md",
    required: false
  },

    {
    source: "artifacts/productization/productization-launch-checklist.json",
    destination: "evidence/productization-launch-checklist.json",
    required: false
  },
  {
    source: "artifacts/productization/productization-launch-checklist-verification.json",
    destination: "evidence/productization-launch-checklist-verification.json",
    required: false
  },
  {
    source: "artifacts/productization/productization-launch-checklist.md",
    destination: "docs/PRODUCTIZATION_LAUNCH_CHECKLIST.md",
    required: false
  },
{
    source: "artifacts/productization/product-operator-brief.json",
    destination: "evidence/product-operator-brief.json",
    required: false
  },
  {
    source: "artifacts/productization/product-operator-brief-verification.json",
    destination: "evidence/product-operator-brief-verification.json",
    required: false
  },
  {
    source: "artifacts/productization/product-operator-brief.md",
    destination: "docs/PRODUCT_OPERATOR_BRIEF.md",
    required: false
  },
  {
    source: "artifacts/productization/product-takeover-decision-matrix.json",
    destination: "evidence/product-takeover-decision-matrix.json",
    required: false
  },
  {
    source: "artifacts/productization/product-takeover-decision-matrix-verification.json",
    destination: "evidence/product-takeover-decision-matrix-verification.json",
    required: false
  },
  {
    source: "artifacts/productization/product-takeover-decision-matrix.md",
    destination: "docs/PRODUCT_TAKEOVER_DECISION_MATRIX.md",
    required: false
  },
  {
    source: "artifacts/productization/product-takeover-entry-consistency.json",
    destination: "evidence/product-takeover-entry-consistency.json",
    required: false
  },
  {
    source: "artifacts/productization/product-release-blocker-board.json",
    destination: "evidence/product-release-blocker-board.json",
    required: false
  },
  {
    source: "artifacts/productization/product-release-blocker-board-verification.json",
    destination: "evidence/product-release-blocker-board-verification.json",
    required: false
  },
  {
    source: "artifacts/productization/product-release-blocker-board.md",
    destination: "docs/PRODUCT_RELEASE_BLOCKER_BOARD.md",
    required: false
  },
  {
    source: "artifacts/productization/product-release-approval.template.json",
    destination: "docs/PRODUCT_RELEASE_APPROVAL.template.json",
    required: false
  },
  {
    source: "artifacts/productization/product-release-approval-template.md",
    destination: "docs/PRODUCT_RELEASE_APPROVAL_TEMPLATE.md",
    required: false
  },
  {
    source: "artifacts/productization/product-release-approval-validation.json",
    destination: "evidence/product-release-approval-validation.json",
    required: false
  },
  {
    source: "artifacts/productization/product-release-approval-return-intake-verification.json",
    destination: "evidence/product-release-approval-return-intake-verification.json",
    required: false
  },
  {
    source: "artifacts/productization/real-model-trial-kit.json",
    destination: "evidence/real-model-trial-kit.json",
    required: false
  },
  {
    source: "artifacts/productization/real-model-adapter-contract-verification.json",
    destination: "evidence/real-model-adapter-contract-verification.json",
    required: false
  },
  {
    source: "artifacts/productization/real-model-trial-kit-verification.json",
    destination: "evidence/real-model-trial-kit-verification.json",
    required: false
  },
  {
    source: "artifacts/productization/real-model-trial-kit.md",
    destination: "docs/REAL_MODEL_TRIAL_KIT.md",
    required: false
  },
  {
    source: "artifacts/productization/real-model-trial-receipt.template.json",
    destination: "docs/REAL_MODEL_TRIAL_RECEIPT.template.json",
    required: false
  },
  {
    source: "artifacts/productization/real-model-trial-receipt-template.md",
    destination: "docs/REAL_MODEL_TRIAL_RECEIPT_TEMPLATE.md",
    required: false
  },
  {
    source: "artifacts/productization/real-model-trial-receipt-validation.json",
    destination: "evidence/real-model-trial-receipt-validation.json",
    required: false
  },
  {
    source: "artifacts/productization/real-model-trial-return-intake-verification.json",
    destination: "evidence/real-model-trial-return-intake-verification.json",
    required: false
  },
  {
    source: "artifacts/productization/product-handoff-readiness.json",
    destination: "evidence/product-handoff-readiness.json",
    required: true
  },
  {
    source: "artifacts/productization/human-acceptance-gate.json",
    destination: "evidence/human-acceptance-gate.json",
    required: true
  },
  {
    source: "artifacts/productization/human-acceptance-session-preflight.json",
    destination: "evidence/human-acceptance-session-preflight.json",
    required: false
  },
  {
    source: "artifacts/productization/human-acceptance-reviewer-kit.json",
    destination: "evidence/human-acceptance-reviewer-kit.json",
    required: false
  },
  {
    source: "artifacts/productization/human-acceptance-reviewer-kit-verification.json",
    destination: "evidence/human-acceptance-reviewer-kit-verification.json",
    required: false
  },
  {
    source: "artifacts/productization/human-acceptance-reviewer-kit.md",
    destination: "docs/HUMAN_ACCEPTANCE_REVIEWER_KIT.md",
    required: false
  },
  {
    source: "artifacts/productization/human-acceptance-receipt.template.json",
    destination: "docs/HUMAN_ACCEPTANCE_RECEIPT.template.json",
    required: false
  },
  {
    source: "artifacts/productization/human-acceptance-receipt-template.md",
    destination: "docs/HUMAN_ACCEPTANCE_RECEIPT_TEMPLATE.md",
    required: false
  },
  {
    source: "artifacts/productization/human-acceptance-receipt-validation.json",
    destination: "evidence/human-acceptance-receipt-validation.json",
    required: false
  },
  {
    source: "artifacts/productization/human-acceptance-return-intake-verification.json",
    destination: "evidence/human-acceptance-return-intake-verification.json",
    required: false
  },
  {
    source: "artifacts/productization/human-acceptance-return-intake.json",
    destination: "evidence/human-acceptance-return-intake.json",
    required: false
  },
  {
    source: "artifacts/productization/manual-acceptance-classification-verification.json",
    destination: "evidence/manual-acceptance-classification-verification.json",
    required: true
  },
  {
    source: "artifacts/productization/manual-acceptance-latest.json",
    destination: "evidence/manual-acceptance-latest.json",
    required: true
  },
  {
    source: "artifacts/productization/manual-acceptance-report.browser-smoke.json",
    destination: "evidence/manual-acceptance-report.browser-smoke.json",
    required: true
  },
  {
    source: "artifacts/productization/manual-acceptance-browser-smoke.json",
    destination: "evidence/manual-acceptance-browser-smoke.json",
    required: true
  },
  {
    source: "artifacts/productization/smoke-record-cleanup.json",
    destination: "evidence/smoke-record-cleanup.json",
    required: true
  },
  {
    source: "artifacts/productization/runtime-artifact-cleanup.json",
    destination: "evidence/runtime-artifact-cleanup.json",
    required: true
  },
  {
    source: "artifacts/productization/live-product-handoff.json",
    destination: "evidence/live-product-handoff.json",
    required: false
  },
  {
    source: "artifacts/productization/handoff-browser-smoke.json",
    destination: "evidence/handoff-browser-smoke.json",
    required: false
  },
  {
    source: "artifacts/productization/public-beta-readiness.json",
    destination: "evidence/public-beta-readiness.json",
    required: false
  },
  {
    source: "artifacts/productization/public-beta-feedback-receipt-validation.json",
    destination: "evidence/public-beta-feedback-receipt-validation.json",
    required: false
  },
  {
    source: "artifacts/productization/public-beta-feedback-api-verification.json",
    destination: "evidence/public-beta-feedback-api-verification.json",
    required: false
  },
  {
    source: "artifacts/productization/public-beta-feedback-collection.json",
    destination: "evidence/public-beta-feedback-collection.json",
    required: false
  },
  {
    source: "artifacts/productization/public-beta-feedback-collection-verification.json",
    destination: "evidence/public-beta-feedback-collection-verification.json",
    required: false
  },
  {
    source: "artifacts/productization/public-beta-follow-up-plan.json",
    destination: "evidence/public-beta-follow-up-plan.json",
    required: false
  },
  {
    source: "artifacts/productization/public-beta-follow-up-plan-verification.json",
    destination: "evidence/public-beta-follow-up-plan-verification.json",
    required: false
  },
  {
    source: "artifacts/productization/public-beta-tester-invite.json",
    destination: "evidence/public-beta-tester-invite.json",
    required: false
  },
  {
    source: "artifacts/productization/public-beta-tester-invite-verification.json",
    destination: "evidence/public-beta-tester-invite-verification.json",
    required: false
  },
  {
    source: "artifacts/productization/public-beta-tester-session-preflight.json",
    destination: "evidence/public-beta-tester-session-preflight.json",
    required: false
  },
  {
    source: "artifacts/productization/public-beta-tester-invite.md",
    destination: "docs/PUBLIC_BETA_TESTER_INVITE.md",
    required: false
  },
  {
    source: "artifacts/productization/public-beta-return-intake-verification.json",
    destination: "evidence/public-beta-return-intake-verification.json",
    required: false
  },
  {
    source: "artifacts/productization/public-beta-return-intake.json",
    destination: "evidence/public-beta-return-intake.json",
    required: false
  },
  {
    source: "artifacts/productization/public-beta-preparation.json",
    destination: "evidence/public-beta-preparation.json",
    required: false
  },
  {
    source: "artifacts/productization/manual-acceptance-browser.png",
    destination: "evidence/manual-acceptance-browser.png",
    required: false
  },
  {
    source: "artifacts/productization/manual-acceptance-browser-desktop.png",
    destination: "evidence/manual-acceptance-browser-desktop.png",
    required: false
  },
  {
    source: "artifacts/productization/manual-acceptance-browser-mobile.png",
    destination: "evidence/manual-acceptance-browser-mobile.png",
    required: false
  },
  {
    source: "artifacts/productization/dashboard-product-entry.png",
    destination: "evidence/dashboard-product-entry.png",
    required: false
  },
  {
    source: "artifacts/productization/handoff-beta-feedback-desktop.png",
    destination: "evidence/handoff-beta-feedback-desktop.png",
    required: false
  },
  {
    source: "artifacts/productization/handoff-beta-feedback-mobile.png",
    destination: "evidence/handoff-beta-feedback-mobile.png",
    required: false
  }
];

function copyPacketFile(file: PacketFile) {
  const source = path.join(process.cwd(), file.source);
  const destination = path.join(packetDir, file.destination);

  if (!fs.existsSync(source)) {
    if (file.required) {
      throw new Error(`Missing required product trial packet source: ${file.source}`);
    }

    return null;
  }

  if (!file.required && !optionalRuntimeEvidenceIsFresh(file.source)) {
    return null;
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);

  return {
    source: file.source,
    destination: file.destination,
    bytes: fs.statSync(destination).size,
    required: file.required
  };
}

function readJson<T>(relativePath: string): T | null {
  const fullPath = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, "utf8")) as T;
}

function timestampMs(value: string | undefined) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function optionalRuntimeEvidenceIsFresh(relativePath: string) {
  if (relativePath !== "artifacts/productization/public-beta-tester-session-preflight.json") {
    return true;
  }

  const preflight = readJson<{ generatedAt?: string }>(relativePath);
  const freshness = readJson<{ generatedAt?: string }>("artifacts/productization/productization-evidence-freshness.json");
  const preflightMs = timestampMs(preflight?.generatedAt);
  const freshnessMs = timestampMs(freshness?.generatedAt);

  return Number.isFinite(preflightMs) && Number.isFinite(freshnessMs) && preflightMs >= freshnessMs;
}

function writeStartHere() {
  const content = `# Transparent AI Apprentice Product Trial Packet

This packet is a review-only handoff bundle for the bounded Web product loop.

## Open First

1. Read \`docs/PRODUCT_HANDOFF.md\`.
2. Start the app from the repository root in local production mode:

\`\`\`bash
npm run start:product -- --hostname 127.0.0.1 --port 3000
\`\`\`

3. Open \`http://127.0.0.1:3000/handoff\`.
4. Run the quick runtime doctor:

\`\`\`bash
npm run doctor:product
\`\`\`

## Evidence Included

- \`evidence/product-verification-receipt.json\`
- \`evidence/product-ui-api-smoke.json\`
- \`evidence/product-runtime-verification.json\`
- \`evidence/product-runtime-doctor.json\`
- \`evidence/product-release-readiness.json\`
- \`evidence/product-trial-packet-verification.json\` after \`npm run verify:product-trial\`
- \`evidence/productization-evidence-freshness.json\`
- \`evidence/product-status-summary.json\`
- \`evidence/product-status-summary-verification.json\`
- \`evidence/product-takeover-decision-matrix.json\`
- \`evidence/product-takeover-decision-matrix-verification.json\`
- \`docs/PRODUCT_TAKEOVER_DECISION_MATRIX.md\`
- \`evidence/productization-launch-checklist.json\`
- \`evidence/productization-launch-checklist-verification.json\`
- \`docs/PRODUCTIZATION_LAUNCH_CHECKLIST.md\`
- \`docs/PRODUCT_STATUS_SUMMARY.md\`
- \`evidence/product-release-blocker-board.json\`
- \`evidence/product-release-blocker-board-verification.json\`
- \`docs/PRODUCT_RELEASE_BLOCKER_BOARD.md\`
- \`docs/PRODUCT_RELEASE_APPROVAL.template.json\`
- \`docs/PRODUCT_RELEASE_APPROVAL_TEMPLATE.md\`
- \`evidence/product-release-approval-validation.json\`
- \`evidence/real-model-trial-kit.json\`
- \`evidence/real-model-trial-kit-verification.json\`
- \`docs/REAL_MODEL_TRIAL_KIT.md\`
- \`docs/REAL_MODEL_TRIAL_RECEIPT.template.json\`
- \`docs/REAL_MODEL_TRIAL_RECEIPT_TEMPLATE.md\`
- \`evidence/real-model-trial-receipt-validation.json\`
- \`evidence/product-handoff-readiness.json\`
- \`evidence/runtime-artifact-cleanup.json\`
- \`evidence/live-product-handoff.json\`
- \`evidence/public-beta-readiness.json\`
- \`evidence/public-beta-feedback-receipt-validation.json\`
- \`evidence/public-beta-feedback-api-verification.json\`
- \`evidence/public-beta-feedback-collection.json\`
- \`evidence/public-beta-feedback-collection-verification.json\`
- \`evidence/public-beta-follow-up-plan.json\`
- \`evidence/public-beta-follow-up-plan-verification.json\`
- \`evidence/public-beta-tester-invite.json\`
- \`evidence/public-beta-tester-invite-verification.json\`
- \`evidence/public-beta-tester-session-preflight.json\` when generated after the latest freshness receipt
- \`docs/PUBLIC_BETA_TESTER_INVITE.md\`
- \`evidence/public-beta-return-intake-verification.json\`
- \`evidence/public-beta-return-intake.json\`
- \`evidence/public-beta-preparation.json\`
- \`evidence/human-acceptance-gate.json\`
- \`evidence/human-acceptance-session-preflight.json\`
- \`evidence/human-acceptance-reviewer-kit.json\`
- \`evidence/human-acceptance-reviewer-kit-verification.json\`
- \`docs/HUMAN_ACCEPTANCE_REVIEWER_KIT.md\`
- \`docs/HUMAN_ACCEPTANCE_RECEIPT.template.json\`
- \`docs/HUMAN_ACCEPTANCE_RECEIPT_TEMPLATE.md\`
- \`evidence/human-acceptance-receipt-validation.json\`
- \`evidence/manual-acceptance-classification-verification.json\`
- \`evidence/manual-acceptance-latest.json\`
- \`evidence/manual-acceptance-report.browser-smoke.json\`

\`manual-acceptance-latest.json\` is classified. Browser smoke evidence uses \`evidenceKind=automated_browser_smoke\` and \`humanReviewed=false\`; a real tester pass must save \`evidenceKind=human_review\` with reviewer name, per-step notes, and the manual-review attestation. Run \`npm run verify:human-acceptance\` after a real pass; it is expected to fail until real human evidence exists.

## Boundary

This packet is not release acceptance. It keeps \`accepted=false\`, \`packagingGated=true\`, and the all-software objective paused.
`;

  fs.writeFileSync(path.join(packetDir, "START_HERE.md"), content);
}

export function buildProductTrialPacket(source = "manual") {
  fs.rmSync(packetDir, { recursive: true, force: true });
  fs.mkdirSync(docsDir, { recursive: true });
  fs.mkdirSync(evidenceDir, { recursive: true });

  const includedFiles = files.map(copyPacketFile).filter((file): file is NonNullable<typeof file> => Boolean(file));
  writeStartHere();

  const manifest = {
    responseMode: "product_trial_packet_manifest_json_v1",
    status: "built",
    generatedAt: new Date().toISOString(),
    source,
    packetDir: "artifacts/productization/product-trial-packet",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    entrypoints: {
      handoff: "http://127.0.0.1:3000/handoff",
      health: "http://127.0.0.1:3000/api/health",
      readiness: "http://127.0.0.1:3000/api/product-readiness",
      manualAcceptance: "http://127.0.0.1:3000/manual-test"
    },
    commands: [
      "npm run setup:demo",
      "npm run verify:product",
      "npm run smoke:product -- --base-url http://127.0.0.1:3000",
      "npm run verify:product-runtime",
      "npm run verify:human-acceptance",
      "npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000",
      "npm run build:human-acceptance-receipt-template",
      "npm run verify:human-acceptance-receipt",
      "npm run intake:human-acceptance-return -- --receipt path/to/submitted-human-acceptance.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json",
      "npm run verify:human-acceptance-return-intake",
      "npm run verify:manual-acceptance-classification",
      "npm run verify:product-release-readiness",
      "npm run verify:productization-evidence-freshness",
      "npm run build:product-takeover-matrix",
      "npm run verify:product-takeover-matrix",
      "npm run build:productization-launch-checklist",
      "npm run verify:productization-launch-checklist",
      "npm run build:product-status-summary",
      "npm run verify:product-status-summary",
      "npm run build:product-release-approval-template",
      "npm run verify:product-release-approval",
      "npm run intake:product-release-approval-return -- --receipt path/to/filled-product-release-approval.json",
      "npm run verify:product-release-approval-return-intake",
      "npm run verify:real-model-adapter-contract",
      "npm run build:real-model-trial-kit",
      "npm run verify:real-model-trial-kit",
      "npm run build:real-model-trial-receipt-template",
      "npm run verify:real-model-trial-receipt",
      "npm run intake:real-model-trial-return -- --receipt path/to/filled-real-model-trial-receipt.json",
      "npm run verify:real-model-trial-return-intake",
      "npm run start:product -- --hostname 127.0.0.1 --port 3000",
      "npm run package:product-trial",
      "npm run verify:product-trial",
      "npm run doctor:product",
      "npm run verify:live-handoff",
      "npm run prepare:public-beta -- --base-url http://127.0.0.1:3000",
      "npm run verify:public-beta",
      "npm run verify:public-beta-feedback",
      "npm run verify:public-beta-feedback-api",
      "npm run verify:public-beta-feedback-collection",
      "npm run collect:public-beta-feedback",
      "npm run plan:public-beta-follow-up",
      "npm run verify:public-beta-follow-up-plan",
      "npm run build:public-beta-tester-invite",
      "npm run verify:public-beta-tester-invite",
      "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000",
      "npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json",
      "npm run verify:public-beta-return-intake",
      "npm run cleanup:smoke-records",
      "npm run cleanup:runtime-artifacts"
    ],
    packagingBoundary: {
      accepted: false,
      packagingGated: true,
      status: "pending_teacher_acceptance"
    },
    includedFiles,
    nextHumanSteps: [
      "Run one real human acceptance pass from /manual-test.",
      "Save the review-only acceptance evidence in the app.",
      "Fill docs/HUMAN_ACCEPTANCE_RECEIPT.template.json and validate the copy with npm run verify:human-acceptance-receipt -- --receipt <path>.",
      "Archive a returned reviewer receipt with npm run intake:human-acceptance-return -- --receipt <path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json; this does not claim acceptance unless the saved /manual-test gate passes.",
      "Run npm run verify:human-acceptance-return-intake after human return intake; only after it passes, run the intake receipt's postIntakeRefresh.commandSequence before relying on refreshed reviewer invite, blocker board, status summary, takeover matrix, or evidence freshness files.",
      "Run npm run verify:human-acceptance and keep human-acceptance-gate.json with the packet.",
      "Run npm run verify:product-release-readiness and keep the blocked/pass release decision with the packet.",
      "Run npm run verify:productization-evidence-freshness and keep the coherent evidence timeline receipt with the packet.",
      "Run npm run verify:product-trial after rebuilding the trial packet; it embeds evidence/product-trial-packet-verification.json back into the packet.",
      "Open docs/PRODUCT_TAKEOVER_DECISION_MATRIX.md first to choose one allowed next action and see stop conditions.",
      "Then open docs/PRODUCTIZATION_LAUNCH_CHECKLIST.md to confirm the controlled launch gate, live preflights, allowed lanes, and blocked release transitions.",
      "Then open docs/PRODUCT_STATUS_SUMMARY.md to see beta-ready, release-blocked, real-model-mock, and all-software-paused status in one place.",
      "Use docs/PRODUCT_RELEASE_APPROVAL.template.json only for a separate release reviewer; process a filled copy with npm run intake:product-release-approval-return -- --receipt <path> so validation, archive, and release-lock refresh happen together.",
      "Keep evidence/real-model-adapter-contract-verification.json with the packet before planning a real-provider trial.",
      "If inviting beta testers, run npm run verify:public-beta, use docs/PUBLIC_BETA_TESTER_INVITE.md for one tester, run npm run preflight:public-beta-tester against the live URL, then process returned JSON receipts with npm run intake:public-beta-return -- --receipt <path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json before inviting another tester.",
      "Use docs/REAL_MODEL_TRIAL_KIT.md before any real provider trial; it does not activate a real model or unlock release.",
      "Use docs/REAL_MODEL_TRIAL_RECEIPT.template.json to collect real-model trial evidence and process a filled copy with npm run intake:real-model-trial-return -- --receipt <path> before using it for follow-up.",
      "Keep AI_PROVIDER=mock until a real-model trial is configured and separately accepted.",
      "Do not resume the all-software objective in the main product path."
    ]
  };

  fs.writeFileSync(path.join(packetDir, "product-trial-manifest.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

const currentFile = fileURLToPath(import.meta.url);
if (path.resolve(process.argv[1] ?? "") === currentFile) {
  try {
    const manifest = buildProductTrialPacket("package:product-trial");
    console.log(JSON.stringify(manifest, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
