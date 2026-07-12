import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAIServiceRuntimeStatus } from "../src/server/ai/service";

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const kitJsonPath = path.join(artifactsDir, "real-model-trial-kit.json");
const kitMarkdownPath = path.join(artifactsDir, "real-model-trial-kit.md");

function readJson<T>(relativePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
  } catch {
    return null;
  }
}

function readText(relativePath: string) {
  try {
    return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
  } catch {
    return "";
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

export function buildRealModelTrialKit() {
  const ai = getAIServiceRuntimeStatus();
  const envExample = readText(".env.example");
  const releaseReadiness = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    blockers?: Array<{ name?: string; evidence?: string; nextAction?: string }>;
    boundary?: { accepted?: boolean; packagingGated?: boolean; activeProvider?: string };
  }>("artifacts/productization/product-release-readiness.json");
  const releaseBlockerBoard = readJson<{
    responseMode?: string;
    status?: string;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    lanes?: Array<{ id?: string; status?: string; evidencePaths?: string[]; commands?: string[] }>;
  }>("artifacts/productization/product-release-blocker-board.json");
  const releaseBlockerBoardVerification = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
  }>("artifacts/productization/product-release-blocker-board-verification.json");
  const productSmoke = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
  }>("artifacts/productization/product-ui-api-smoke.json");
  const adapterContract = readJson<{
    responseMode?: string;
    status?: string;
    passed?: number;
    total?: number;
    realNetworkUsed?: boolean;
    realProviderAccepted?: boolean;
    canActivateRealModel?: boolean;
    canRelease?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
  }>("artifacts/productization/real-model-adapter-contract-verification.json");

  const envDocumentsProvider =
    envExample.includes("AI_PROVIDER") &&
    envExample.includes("AI_PROVIDER_MANUAL_ACCEPTED") &&
    envExample.includes("OPENAI_API_KEY") &&
    envExample.includes("OPENAI_MODEL") &&
    envExample.includes("OPENAI_BASE_URL");
  const realModelBlockerPresent =
    releaseReadiness?.blockers?.some((blocker) => blocker.name === "Real model adapter is ready") === true;
  const releaseLocked =
    releaseReadiness?.responseMode === "product_release_readiness_gate_json_v1" &&
    releaseReadiness.status === "blocked_not_release_ready" &&
    releaseReadiness.releaseDecision === "do_not_release" &&
    releaseReadiness.boundary?.accepted === false &&
    releaseReadiness.boundary.packagingGated === true;
  const blockerBoardReady =
    releaseBlockerBoard?.responseMode === "product_release_blocker_board_json_v1" &&
    releaseBlockerBoard.status === "ready_for_blocker_resolution" &&
    releaseBlockerBoard.releaseDecision === "do_not_release" &&
    releaseBlockerBoard.accepted === false &&
    releaseBlockerBoard.packagingGated === true &&
    releaseBlockerBoard.canRelease === false &&
    releaseBlockerBoard.lanes?.some((lane) => lane.id === "real_model_adapter") === true &&
    releaseBlockerBoardVerification?.status === "passed" &&
    releaseBlockerBoardVerification.passed === releaseBlockerBoardVerification.total;

  const failedReasons: string[] = [];
  if (!ai.configured.openAIAdapterImplemented) {
    failedReasons.push("openai_adapter_not_implemented");
  }
  if (!envDocumentsProvider) {
    failedReasons.push("env_example_missing_real_model_controls");
  }
  if (!releaseLocked || !realModelBlockerPresent) {
    failedReasons.push("release_readiness_not_locked_on_real_model_blocker");
  }
  if (!blockerBoardReady) {
    failedReasons.push("release_blocker_board_not_ready");
  }
  if (productSmoke?.responseMode !== "product_ui_api_smoke_receipt_json_v1" || productSmoke.status !== "passed") {
    failedReasons.push("product_smoke_not_green");
  }
  if (
    adapterContract?.responseMode !== "real_model_adapter_contract_verification_json_v1" ||
    adapterContract.status !== "passed" ||
    adapterContract.passed !== adapterContract.total ||
    adapterContract.realNetworkUsed !== false ||
    adapterContract.realProviderAccepted !== false ||
    adapterContract.canActivateRealModel !== false ||
    adapterContract.canRelease !== false ||
    adapterContract.accepted !== false ||
    adapterContract.packagingGated !== true
  ) {
    failedReasons.push("real_model_adapter_contract_not_verified");
  }

  const status = failedReasons.length === 0 ? "ready_for_real_model_trial_planning" : "needs_productization_work";
  const trialPhases = [
    {
      id: "configure_without_source_control",
      title: "Configure provider outside source control",
      reviewerAction:
        "In a separate trial environment, set AI_PROVIDER=openai, configure OPENAI_API_KEY, and optionally set OPENAI_MODEL or OPENAI_BASE_URL outside source control.",
      continueCondition:
        "Secrets are not committed, .env.example remains a template, and AI_PROVIDER_MANUAL_ACCEPTED=false until a separate reviewer approves the model trial.",
      stopCondition:
        "Stop if secrets appear in source, logs, artifacts, or the trial requires changing committed defaults."
    },
    {
      id: "pre_acceptance_dry_run",
      title: "Dry-run runtime status before acceptance",
      reviewerAction:
        "Start the product runtime and inspect GET /api/ai-service-status while AI_PROVIDER_MANUAL_ACCEPTED=false.",
      continueCondition:
        "The API reports a configured or missing real provider while activeProvider remains mock and releaseDecision remains do_not_release.",
      stopCondition:
        "Stop if the app activates a real provider before manual acceptance or if release/packaging locks change."
    },
    {
      id: "separate_real_model_trial",
      title: "Run a bounded real-model trial only after explicit approval",
      reviewerAction:
        "After a real reviewer approves the trial, set AI_PROVIDER_MANUAL_ACCEPTED=true only in the trial environment and run one bounded product task.",
      continueCondition:
        "The trial records model output, trace evidence, reviewer notes, and rollback instructions without saving release approval.",
      stopCondition:
        "Stop if model output bypasses trace, silently enables rules, writes long-term acceptance, or changes packaging state."
    },
    {
      id: "human_acceptance_for_model",
      title: "Record separate model acceptance evidence",
      reviewerAction:
        "Have a human reviewer compare mock and real-model behavior, record observed output quality, and decide whether follow-up is required.",
      continueCondition:
        "Evidence explicitly says the model trial is acceptable for the bounded product loop and remains separate from product release approval.",
      stopCondition:
        "Stop if acceptance is inferred from automation, missing reviewer notes, or unrelated public beta feedback."
    },
    {
      id: "release_gate_recheck",
      title: "Recheck release gates after the trial",
      reviewerAction:
        "Run npm run verify:product, npm run smoke:product -- --base-url http://127.0.0.1:3000, and npm run verify:product-release-readiness -- --allow-blocked.",
      continueCondition:
        "Release readiness may remove the real-model blocker only after evidence exists, but packaging remains blocked until separate release approval.",
      stopCondition:
        "Stop if any verifier reports accepted=true, packagingGated=false, releaseDecision=release_candidate without explicit release approval, or allSoftwareObjective is resumed."
    }
  ];
  const maintainerCommands = [
    "npm run build:real-model-trial-kit",
    "npm run verify:real-model-trial-kit",
    "npm run verify:real-model-adapter-contract",
    "npm run build:real-model-trial-receipt-template",
    "npm run verify:real-model-trial-receipt",
    "npm run verify:real-model-trial-receipt -- --receipt path/to/filled-real-model-trial-receipt.json",
    "GET /api/ai-service-status",
    "npm run verify:product",
    "npm run smoke:product -- --base-url http://127.0.0.1:3000",
    "npm run verify:product-release-readiness -- --allow-blocked",
    "npm run build:product-release-blocker-board",
    "npm run verify:product-release-blocker-board"
  ];
  const locks = {
    mustNotCommitSecrets: true,
    mustNotSetManualAcceptanceFromKit: true,
    mustNotActivateRealModelFromKit: true,
    mustNotSaveAcceptanceFromKit: true,
    mustNotEnableRules: true,
    mustNotUnlockPackaging: true,
    mustNotClaimReleaseReady: true,
    mustNotResumeAllSoftwareObjective: true
  };
  const credentialRedactionChecklist = [
    {
      id: "redacted_environment_summary",
      reviewerAction:
        "Return only AI_PROVIDER, OPENAI_MODEL, and OPENAI_BASE_URL values; write OPENAI_API_KEY as redacted_present or redacted_missing, never the key value.",
      evidence: "A redacted environment summary attached to the filled real-model trial receipt.",
      stopCondition: "Stop if any returned field contains an API key, bearer token, sk-* token, or unredacted secret value."
    },
    {
      id: "artifact_secret_scan_before_return",
      reviewerAction:
        "Before returning evidence, scan notes, screenshots, JSON receipts, and copied logs for OPENAI_API_KEY, Authorization, Bearer, and sk-* style tokens.",
      evidence: "Reviewer note confirming the scan found no secret-like values in returned artifacts.",
      stopCondition: "Stop and rotate credentials if a secret appears in any artifact, log, screenshot, or receipt."
    },
    {
      id: "trial_log_minimization",
      reviewerAction:
        "Keep logs limited to command names, statuses, model name, endpoint host, and redacted response summaries; do not paste raw provider request headers or full environment dumps.",
      evidence: "Trial notes with command status and sanitized output summary only.",
      stopCondition: "Stop if raw request headers, full .env content, or provider credentials are needed to explain the trial."
    },
    {
      id: "rollback_to_mock_after_trial",
      reviewerAction:
        "After the trial, restore AI_PROVIDER=mock or AI_PROVIDER_MANUAL_ACCEPTED=false in the trial environment and confirm /api/ai-service-status reports mock fallback unless a separate accepted model trial remains active.",
      evidence: "Post-trial /api/ai-service-status response showing activeProvider=mock or a separately accepted trial state.",
      stopCondition:
        "Stop if the real provider remains active without separate model acceptance or if releaseDecision, accepted, packagingGated, or allSoftwareObjective changed."
    }
  ];

  const kit = {
    responseMode: "real_model_trial_kit_json_v1",
    status,
    generatedAt: new Date().toISOString(),
    command: "npm run build:real-model-trial-kit",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canActivateRealModel: false,
    canRelease: false,
    failedReasons,
    aiService: {
      activeProvider: ai.activeProvider,
      requestedProvider: ai.requestedProvider,
      status: ai.status,
      realModelReady: ai.realModelReady,
      switchRequires: ai.switchRequires,
      configured: ai.configured,
      safetyBoundary: ai.safetyBoundary
    },
    sourceEvidence: {
      aiServiceSource: evidenceStatus("src/server/ai/service.ts"),
      openAIAdapterSource: evidenceStatus("src/server/ai/openai-service.ts"),
      envExample: {
        ...evidenceStatus(".env.example"),
        documentsProviderControls: envDocumentsProvider
      },
      releaseReadiness: {
        path: "artifacts/productization/product-release-readiness.json",
        status: releaseReadiness?.status ?? "missing",
        releaseDecision: releaseReadiness?.releaseDecision ?? "missing",
        realModelBlockerPresent,
        activeProvider: releaseReadiness?.boundary?.activeProvider ?? "missing"
      },
      releaseBlockerBoard: {
        path: "artifacts/productization/product-release-blocker-board.json",
        status: releaseBlockerBoard?.status ?? "missing",
        realModelLanePresent: releaseBlockerBoard?.lanes?.some((lane) => lane.id === "real_model_adapter") === true,
        verificationStatus: releaseBlockerBoardVerification?.status ?? "missing"
      },
      productSmoke: {
        path: "artifacts/productization/product-ui-api-smoke.json",
        status: productSmoke?.status ?? "missing",
        passed: productSmoke?.passed ?? 0,
        total: productSmoke?.total ?? 0
      },
      adapterContract: {
        path: "artifacts/productization/real-model-adapter-contract-verification.json",
        status: adapterContract?.status ?? "missing",
        passed: adapterContract?.passed ?? 0,
        total: adapterContract?.total ?? 0,
        realNetworkUsed: adapterContract?.realNetworkUsed ?? null,
        realProviderAccepted: adapterContract?.realProviderAccepted ?? null
      }
    },
    trialPhases,
    credentialRedactionChecklist,
    maintainerCommands,
    forbiddenTransitions: [
      "Do not commit real provider secrets.",
      "Do not set AI_PROVIDER_MANUAL_ACCEPTED=true from this kit.",
      "Do not activate a real model from this kit.",
      "Do not save product acceptance from this kit.",
      "Do not enable rules from this kit.",
      "Do not unlock packaging from this kit.",
      "Do not claim release readiness from this kit.",
      "Do not resume the all-software objective from this kit."
    ],
    evidenceToReturn: [
      "GET /api/ai-service-status response from the trial environment.",
      "Redacted environment summary with AI_PROVIDER, OPENAI_MODEL, OPENAI_BASE_URL, and no OPENAI_API_KEY value.",
      "Completed credential redaction checklist with no secret-like values in notes, screenshots, JSON receipts, logs, or returned artifacts.",
      "real-model-adapter-contract-verification.json proving the adapter contract with fake fetch and no real network.",
      "Real-model trial output, trace, reviewer notes, and rollback notes.",
      "Filled real-model trial receipt validated with npm run verify:real-model-trial-receipt -- --receipt <path>.",
      "npm run verify:product output.",
      "npm run smoke:product -- --base-url http://127.0.0.1:3000 output.",
      "npm run verify:product-release-readiness -- --allow-blocked output."
    ],
    nextAction:
      status === "ready_for_real_model_trial_planning"
        ? "Use real-model-trial-kit.md to plan a separate real-provider trial; keep AI_PROVIDER_MANUAL_ACCEPTED=false until a human reviewer explicitly accepts the trial."
        : "Fix failed real-model trial kit readiness reasons, then rebuild and verify the kit.",
    locks
  };

  const markdown = `# Real Model Trial Kit

Status: \`${status}\`

Release decision: \`do_not_release\`

Can activate real model: \`false\`

Current active provider: \`${ai.activeProvider}\`

## Runtime Boundary

- Current runtime status: \`${ai.status}\`.
- Requested provider: \`${ai.requestedProvider}\`.
- Real model ready: \`${ai.realModelReady}\`.
- Keep \`AI_PROVIDER_MANUAL_ACCEPTED=false\` until a separate human reviewer approves the real-model trial.
- Configure \`OPENAI_API_KEY\`, \`OPENAI_MODEL\`, and \`OPENAI_BASE_URL\` outside source control.
- Inspect \`/api/ai-service-status\` before and after trial setup.

## Trial Phases

${trialPhases
  .map(
    (phase, index) =>
      `${index + 1}. ${phase.title}\n   - Reviewer action: ${phase.reviewerAction}\n   - Continue condition: ${phase.continueCondition}\n   - Stop condition: ${phase.stopCondition}`
  )
  .join("\n")}

## Maintainer Commands

${maintainerCommands.map((command) => `- \`${command}\``).join("\n")}

## Credential Redaction Checklist

${credentialRedactionChecklist
  .map(
    (item) =>
      `- ${item.id}\n  - Reviewer action: ${item.reviewerAction}\n  - Evidence: ${item.evidence}\n  - Stop condition: ${item.stopCondition}`
  )
  .join("\n")}

## Source Evidence

| Evidence | Path | Status |
| --- | --- | --- |
| AI service source | \`src/server/ai/service.ts\` | \`${ai.status}\` |
| OpenAI adapter source | \`src/server/ai/openai-service.ts\` | \`${ai.configured.openAIAdapterImplemented}\` |
| Env example | \`.env.example\` | \`${envDocumentsProvider ? "documents_provider_controls" : "missing_provider_controls"}\` |
| Release readiness | \`artifacts/productization/product-release-readiness.json\` | \`${markdownEscape(releaseReadiness?.status ?? "missing")}\` |
| Release blocker board | \`artifacts/productization/product-release-blocker-board.json\` | \`${markdownEscape(releaseBlockerBoard?.status ?? "missing")}\` |
| Adapter contract | \`artifacts/productization/real-model-adapter-contract-verification.json\` | \`${markdownEscape(adapterContract?.status ?? "missing")}\` |

## Evidence To Return

${kit.evidenceToReturn.map((item) => `- ${item}`).join("\n")}

Use \`artifacts/productization/real-model-trial-receipt.template.json\` for the reviewer return. Validate any filled copy with \`npm run verify:real-model-trial-receipt -- --receipt <path>\`.

## Boundary

- This kit is review-only.
- It does not set \`AI_PROVIDER_MANUAL_ACCEPTED=true\`.
- It does not activate a real provider.
- It does not save acceptance.
- It does not enable rules.
- It does not unlock packaging.
- It does not claim release readiness.
- It keeps \`accepted=false\`, \`packagingGated=true\`, \`releaseDecision=do_not_release\`, and \`allSoftwareObjective=paused\`.

## Failed Reasons

${failedReasons.length === 0 ? "- none" : failedReasons.map((reason) => `- ${reason}`).join("\n")}
`;

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(kitJsonPath, JSON.stringify(kit, null, 2));
  fs.writeFileSync(kitMarkdownPath, markdown);

  return {
    ...kit,
    generatedFiles: [evidenceStatus("artifacts/productization/real-model-trial-kit.json"), evidenceStatus("artifacts/productization/real-model-trial-kit.md")]
  };
}

function main() {
  const kit = buildRealModelTrialKit();
  console.log(JSON.stringify(kit, null, 2));
  console.log(`\nReal model trial kit written to ${kitJsonPath}`);
  console.log(`Real model trial kit Markdown written to ${kitMarkdownPath}`);

  if (kit.status !== "ready_for_real_model_trial_planning") {
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
