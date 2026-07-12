#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slug(value) {
  return (
    String(value || "tlcl-validated-continuation-router")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-validated-continuation-router"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(value, label) {
  const text = String(value || "").trim();
  if (!text) return { value: null, path: "" };
  if (existsSync(text)) return { value: readJson(text), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonForHtml(value) {
  return htmlEscape(JSON.stringify(value, null, 2));
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    routerDoesNotExecuteNextCall: true,
    routerDoesNotInvokeDownstreamTool: true,
    routerDoesNotInvokeModel: true,
    routerDoesNotFetchRag: true,
    routerDoesNotWriteMemory: true,
    routerDoesNotEnableRule: true,
    routerDoesNotUnlockPackaging: true,
    targetSoftwareCommandsExecuted: false,
    downstreamToolInvoked: false,
    modelInvoked: false,
    ragFetched: false,
    memoryWritten: false,
    goalComplete: false
  };
}

const routeSpecs = {
  continue_teaching: {
    route: "continue_teaching_manual_handoff",
    label: "Continue the teach-execute loop manually",
    nextGate: "teacher_or_agent_reads_handoff_then_continues_teaching",
    commandHint: "Use the validated handoff inputs as a normal teacher-facing continuation, not an automatic tool run."
  },
  "knowledge/create-rag-research-intake-queue.mjs": {
    route: "rag_research_intake_manual_handoff",
    label: "Prepare RAG research intake manually",
    nextGate: "teacher_reviewed_rag_research_intake",
    commandHint: "node plugins/transparent-ai-apprentice/scripts/knowledge/create-rag-research-intake-queue.mjs"
  },
  "knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs": {
    route: "rag_rule_dsl_validation_package_manual_handoff",
    label: "Prepare reviewed RAG Rule DSL validation package manually",
    nextGate: "teacher_reviewed_rag_rule_dsl_validation_package",
    commandHint:
      "node plugins/transparent-ai-apprentice/scripts/knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs"
  },
  create_engineering_voice_control_session: {
    route: "voice_numbered_confirmation_manual_handoff",
    label: "Prepare engineering voice/text numbered confirmation manually",
    nextGate: "teacher_numbered_target_confirmation",
    commandHint: "node plugins/transparent-ai-apprentice/scripts/create-engineering-voice-control-session.mjs"
  },
  create_all_software_observer_bootstrap: {
    route: "low_token_observer_bootstrap_manual_handoff",
    label: "Prepare low-token observer bootstrap manually",
    nextGate: "teacher_reviewed_low_token_observer_bootstrap",
    commandHint: "node plugins/transparent-ai-apprentice/scripts/create-all-software-observer-bootstrap.mjs"
  },
  create_tlcl_reasoning_budget_governor: {
    route: "reasoning_budget_governor_manual_handoff",
    label: "Prepare TLCL reasoning budget governor manually",
    nextGate: "teacher_reviewed_reasoning_budget_governor",
    commandHint: "node plugins/transparent-ai-apprentice/scripts/create-tlcl-reasoning-budget-governor.mjs"
  }
};

const validationInput = readJsonInput(
  argValue("--validation", argValue("--continuation-validation", "")),
  "--validation"
);
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-apprentice-session-validated-continuation-routes")
  )
);
mkdirSync(outputRoot, { recursive: true });

const validation = validationInput.value;
const handoff = validation?.nextManualHandoff || null;
const nextTool = handoff?.tool || "";
const spec = routeSpecs[nextTool] || null;
const routerId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(nextTool || "blocked")}`;
const routerDir = join(outputRoot, routerId);
mkdirSync(routerDir, { recursive: true });

const routerPath = join(routerDir, "tlcl-apprentice-session-validated-continuation-router.json");
const readmePath = join(routerDir, "TLCL_VALIDATED_CONTINUATION_ROUTER_START_HERE.md");
const htmlPath = join(routerDir, "tlcl-apprentice-session-validated-continuation-router.html");
const blockerRows = [];
const routerLocks = locks();

function block(code, message) {
  blockerRows.push({ code, message });
}

if (!validation) block("validation_missing", "A continuation validation packet is required.");
if (validation && validation.format !== "transparent_ai_tlcl_apprentice_session_handoff_item_continuation_validation_v1") {
  block(
    "validation_format_invalid",
    "Validation must be transparent_ai_tlcl_apprentice_session_handoff_item_continuation_validation_v1."
  );
}
if (validation && validation.ok !== true) block("validation_not_ok", "Continuation validation must be ok=true.");
if (
  validation &&
  validation.status !== "tlcl_handoff_item_continuation_request_validated_waiting_for_manual_next_call"
) {
  block("validation_status_not_ready", "Continuation validation status is not ready for manual next call routing.");
}
if (handoff?.executesNow !== false) block("handoff_execute_lock_missing", "nextManualHandoff must keep executesNow=false.");
if (!nextTool) block("next_tool_missing", "nextManualHandoff.tool is required.");
if (nextTool && !spec) block("next_tool_not_allowlisted", `Next tool is not allowlisted for TLCL continuation routing: ${nextTool}`);
if (validation?.locks?.validatorDoesNotExecuteNextCall !== true) {
  block("source_validator_lock_missing", "Source validation must prove it did not execute nextCall.");
}

const passed = blockerRows.length === 0;
const status = passed
  ? "tlcl_validated_continuation_route_prepared_waiting_for_manual_downstream_review"
  : "blocked_before_tlcl_validated_continuation_route";
const preparedRoute = passed
  ? {
      route: spec.route,
      label: spec.label,
      nextGate: spec.nextGate,
      nextTool,
      args: handoff.args || {},
      commandTemplate: handoff.commandTemplate || "",
      commandHint: spec.commandHint,
      handoffInputs: handoff.handoffInputs || {},
      executesNow: false,
      instruction:
        "Review this route packet and run the downstream tool only as a separate explicit manual step after teacher confirmation."
    }
  : null;

const router = {
  ok: passed,
  format: "transparent_ai_tlcl_apprentice_session_validated_continuation_router_v1",
  routerId,
  createdAt: new Date().toISOString(),
  status,
  validationPath: validationInput.path,
  sourceValidationStatus: validation?.status || "",
  preparedRoute,
  blockers: blockerRows,
  blockedActions: [
    "execute_downstream_tool_from_router",
    "auto_run_next_call_from_router",
    "invoke_model_from_router",
    "fetch_rag_from_router",
    "write_memory_from_router",
    "enable_rule_from_router",
    "unlock_packaging_from_router",
    "claim_completion_from_router"
  ],
  locks: routerLocks,
  paths: {
    router: routerPath,
    readme: readmePath,
    html: htmlPath
  }
};

writeFileSync(routerPath, `${JSON.stringify(router, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# TLCL Validated Continuation Router",
    "",
    `- Status: ${router.status}`,
    `- Passed: ${router.ok}`,
    `- Source validation: ${validationInput.path || "<inline validation>"}`,
    `- Next tool: ${preparedRoute?.nextTool || "<blocked>"}`,
    `- Route: ${preparedRoute?.route || "<blocked>"}`,
    `- Executes now: false`,
    "",
    "This router prepares the next manual TLCL route. It does not execute downstream tools.",
    "",
    "Prepared route:",
    "",
    "```json",
    JSON.stringify(preparedRoute, null, 2),
    "```"
  ].join("\n") + "\n",
  "utf8"
);
writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TLCL Validated Continuation Router</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; background: #f7f9fc; color: #17202a; }
    body { margin: 0; }
    main { max-width: 1080px; margin: 0 auto; padding: 22px; }
    h1 { font-size: 25px; margin: 0 0 8px; letter-spacing: 0; }
    section { background: #fff; border: 1px solid #d8e0ec; border-radius: 8px; padding: 15px; margin-top: 12px; }
    pre { white-space: pre-wrap; word-break: break-word; background: #f1f5f9; border: 1px solid #d8e0ec; border-radius: 6px; padding: 12px; }
    a { color: #174d89; word-break: break-all; }
    code { word-break: break-all; }
  </style>
</head>
<body>
  <main>
    <h1>TLCL Validated Continuation Router</h1>
    <p>Status: <code>${htmlEscape(router.status)}</code></p>
    <p>This page prepares a manual downstream route only. It does not run nextCall, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.</p>
    <section>
      <h2>Evidence</h2>
      <p>Router: <a href="${htmlEscape(pathToFileURL(routerPath).href)}">${htmlEscape(routerPath)}</a></p>
      <p>Source validation: <code>${htmlEscape(validationInput.path || "<inline validation>")}</code></p>
    </section>
    <section>
      <h2>Prepared Route</h2>
      <pre>${jsonForHtml(preparedRoute)}</pre>
    </section>
    <section>
      <h2>Blockers</h2>
      <pre>${jsonForHtml(blockerRows)}</pre>
    </section>
    <section>
      <h2>Locks</h2>
      <pre>${jsonForHtml(routerLocks)}</pre>
    </section>
  </main>
</body>
</html>
`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: passed,
      format: "transparent_ai_tlcl_apprentice_session_validated_continuation_router_result_v1",
      status,
      route: preparedRoute?.route || "",
      nextTool: preparedRoute?.nextTool || "",
      routerPath,
      readmePath,
      htmlPath,
      blockers: blockerRows,
      locks: routerLocks
    },
    null,
    2
  )
);
