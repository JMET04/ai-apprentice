#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: JSON.parse(readFileSync(resolve(text), "utf8").replace(/^\uFEFF/, "")), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256Object(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function providerRoleUsePlanTraceFromPrep(prep) {
  const trace = prep?.sourceEvidence?.providerRoleUsePlan || {};
  return {
    inheritedFromPrep: Boolean(trace.providerRoleUsePlanHash),
    requiredForScopedProvider: trace.requiredForScopedProvider === true,
    accepted: trace.accepted === true,
    providerRole: trace.providerRole || "",
    providerRoleUsePlanPath: trace.providerRoleUsePlanPath || "",
    providerRoleUsePlanHash: trace.providerRoleUsePlanHash || "",
    nextGateSatisfied: trace.nextGateSatisfied !== false
  };
}

function slug(value) {
  return (
    String(value || "tlcl-dry-run-route-review-handoff")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-dry-run-route-review-handoff"
  );
}

function commandTemplate(tool, args) {
  return `${tool} ${JSON.stringify(args || {})}`;
}

function locks() {
  return {
    reviewOnly: true,
    handoffOnly: true,
    doesNotRunDryRun: true,
    noSoftwareExecution: true,
    noTargetSoftwareCommands: true,
    noUiEvents: true,
    noScreenshots: true,
    noFullLogs: true,
    noRuleEnablement: true,
    noMemoryWrite: true,
    noPackagingUnlock: true,
    noCompletionClaim: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  };
}

const goal = argValue("--goal", "Create a TLCL dry-run route review handoff from a validated teacher review receipt.");
const validationInput = readJsonInput(
  argValue("--validation", argValue("--review-validation", "")),
  "--validation",
  "transparent_ai_tlcl_medium_runtime_dry_run_prep_review_validation_v1"
);
const prepInputText = argValue("--prep", argValue("--dry-run-prep", ""));
const prepInput = prepInputText
  ? readJsonInput(prepInputText, "--prep", "transparent_ai_tlcl_medium_runtime_dry_run_prep_v1")
  : { value: null, path: "" };
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-medium-runtime-dry-run-route-review-handoffs"))
);

const validation = validationInput.value;
const ready = validation.status === "ready_for_separate_dry_run_route_review" && validation.readyForDryRunRouteReview === true;
const seniorCompile = validation.status === "escalate_to_senior_compile" || validation.escalateToSeniorCompile === true;
const forbidden = validation.forbiddenDecisionUsed === true || validation.status === "blocked_for_forbidden_decision";
const handoffId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const handoffDir = join(outRoot, handoffId);
const packetPath = join(handoffDir, "tlcl-medium-runtime-dry-run-route-review-handoff.json");
const receiptPath = join(handoffDir, "tlcl-medium-runtime-dry-run-route-review-handoff-receipt.json");
const readmePath = join(handoffDir, "TLCL_MEDIUM_RUNTIME_DRY_RUN_ROUTE_REVIEW_HANDOFF_START_HERE.md");

const routeReview = validation.nextDryRunRouteReview || null;
const providerRoleUsePlanTrace = providerRoleUsePlanTraceFromPrep(prepInput.value);
const tool = routeReview?.dryRunHandoff?.tool || "";
const args = routeReview?.dryRunHandoff?.arguments || {};
const status = forbidden
  ? "blocked_for_forbidden_decision"
  : ready
    ? "dry_run_route_review_handoff_ready"
    : seniorCompile
      ? "senior_compile_repair_handoff_ready"
      : "waiting_for_teacher_review_validation";
const handoffItems = ready
  ? [
      {
        id: "tlcl_dry_run_route_review_001",
        kind: "reviewed_dry_run_route_handoff",
        routeIndex: routeReview.routeIndex,
        adapterId: routeReview.adapterId || "",
        tool,
        arguments: args,
        commandTemplate: commandTemplate(tool, args),
        executesNow: false,
        blockedUntil: "teacher opens the separate dry-run route review and explicitly confirms the next dry-run-only action",
        requiresRetainedRollbackPoint: true,
        requiresPostDryRunReceiptReview: true
      }
    ]
  : [];
const seniorCompileHandoff = seniorCompile
  ? {
      kind: "senior_compile_repair_handoff",
      escalates_to: "senior_reasoning_compile",
      teacherCorrection: validation.seniorCompileEscalation?.teacherCorrection || "",
      repairTasks: validation.seniorCompileEscalation?.repairTasks || [
        "Repair the TLCL contract, route evidence, or target/logic interpretation before another dry-run route review."
      ],
      executesNow: false
    }
  : null;

const packet = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_dry_run_route_review_handoff_v1",
  handoffId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  sourceEvidence: {
    validationPath: validationInput.path,
    validationHash: sha256Object(validation),
    prepPath: prepInput.path,
    prepHash: prepInput.value ? sha256Object(prepInput.value) : "",
    providerRoleUsePlanTrace
  },
  handoffItems,
  seniorCompileHandoff,
  blockedTransitions: [
    "run_dry_run_from_handoff",
    "execute_target_software_from_handoff",
    "send_ui_events_from_handoff",
    "enable_rule_from_handoff",
    "write_memory_from_handoff",
    "unlock_packaging_from_handoff",
    "claim_completion_from_handoff"
  ],
  nextTeacherActions:
    status === "dry_run_route_review_handoff_ready"
      ? [
          "Review the single dry-run route handoff item.",
          "Confirm a retained rollback point before any later dry-run-only runner.",
          "Run the separate dry-run route review step only after teacher confirmation.",
          "If the route is wrong, send a correction back to senior compile."
        ]
      : status === "senior_compile_repair_handoff_ready"
        ? ["Send the teacher correction and repair tasks to senior_reasoning_compile before retrying."]
        : ["Resolve the validation blocker before any route review handoff."],
  locks: locks(),
  paths: { handoff: packetPath, receipt: receiptPath, readme: readmePath }
};
const receipt = {
  format: "transparent_ai_tlcl_medium_runtime_dry_run_route_review_handoff_receipt_v1",
  handoffId,
  status,
  handoffItemCount: handoffItems.length,
  dryRunExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  locks: locks()
};

writeJson(packetPath, packet);
writeJson(receiptPath, receipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Medium Runtime Dry-Run Route Review Handoff",
    "",
    `Status: ${status}`,
    "",
    "This packet translates a validated TLCL medium-runtime dry-run prep review into a next-step handoff.",
    "It never runs dry-runs, executes target software, sends UI events, enables rules, writes memory, unlocks packaging, or claims completion.",
    "",
    "Handoff items:",
    ...(handoffItems.length ? handoffItems.map((item) => `- ${item.id}: ${item.commandTemplate}`) : ["- none"]),
    "",
    seniorCompileHandoff ? `Senior compile correction: ${seniorCompileHandoff.teacherCorrection}` : ""
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_tlcl_medium_runtime_dry_run_route_review_handoff_result_v1",
      status,
      handoffPath: packetPath,
      receiptPath,
      readmePath,
      handoffItemCount: handoffItems.length,
      seniorCompileHandoffReady: Boolean(seniorCompileHandoff),
      dryRunExecuted: false,
      targetSoftwareCommandsExecuted: false,
      uiEventsSent: false,
      screenshotsCaptured: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true
    },
    null,
    2
  )
);
