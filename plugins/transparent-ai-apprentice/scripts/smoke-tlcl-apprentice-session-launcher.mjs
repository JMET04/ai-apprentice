#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const scriptPath = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-tlcl-apprentice-session-launcher.mjs");
const outRoot = join(repoRoot, ".transparent-apprentice", "tlcl-apprentice-session-launcher-smoke");

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

const fixtureManual = join(outRoot, "fixture-manual.md");
const fixtureDrawing = join(outRoot, "fixture-drawing.svg");
const fixtureRollback = join(outRoot, "fixture-rollback-point.json");

writeFileSync(
  fixtureManual,
  [
    "# Fixture Process Manual",
    "",
    "Use this source only as cited evidence. It cannot authorize execution or enable rules."
  ].join("\n"),
  "utf8"
);
writeFileSync(
  fixtureDrawing,
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#f8fafc"/><text x="40" y="80" font-family="Arial" font-size="24">Fixture drawing</text></svg>',
  "utf8"
);
writeFileSync(
  fixtureRollback,
  JSON.stringify(
    {
      format: "transparent_ai_rollback_point_result_v1",
      rollbackId: "fixture-rollback",
      status: "waiting_for_teacher_confirmation",
      deleteOnlyAfterTeacherConfirmation: true
    },
    null,
    2
  ),
  "utf8"
);

function run(args) {
  const output = execFileSync(process.execPath, [scriptPath, "--output-dir", outRoot, ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  return JSON.parse(output);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const result = run([
  "--goal",
  "Teach a cost-controlled CAD apprentice to derive strict geometry from reviewed data logic.",
  "--software",
  "FixtureCAD",
  "--teacher-command",
  "Draw the reinforced panel from the confirmed dimensions, then ask before changing the slot.",
  "--teacher-style",
  "voice, screenshot, correction-first",
  "--knowledge-source",
  fixtureManual,
  "--artifact",
  fixtureDrawing,
  "--rollback-point",
  fixtureRollback
]);

const packet = readJson(result.packetPath);
const receipt = readJson(result.receiptTemplatePath);
const html = readFileSync(result.htmlPath, "utf8");
const receiptBuilderHtml = readFileSync(result.receiptBuilderPath, "utf8");
const readme = readFileSync(result.readmePath, "utf8");

const checks = [];
function check(name, passed, evidence = {}) {
  checks.push({ name, passed, evidence });
}

check("Launcher writes a review-only TLCL session packet", packet.format === "transparent_ai_tlcl_apprentice_session_launcher_v1" && packet.status === "tlcl_apprentice_session_launch_waiting_for_teacher_route_choice", {
  packetPath: result.packetPath
});
check("Launcher creates a browser first screen and receipt template", existsSync(result.htmlPath) && existsSync(result.receiptTemplatePath) && html.includes("TLCL Apprentice Session Launcher"), {
  htmlPath: result.htmlPath,
  receiptTemplatePath: result.receiptTemplatePath
});
check("Launcher creates a teacher route receipt builder page", existsSync(result.receiptBuilderPath) && html.includes("Open route receipt builder") && receiptBuilderHtml.includes("TLCL Route Receipt Builder") && receiptBuilderHtml.includes("start_with_existing_tool_demo") && receiptBuilderHtml.includes("start_with_low_token_observation") && receiptBuilderHtml.includes("does not validate, execute software"), {
  receiptBuilderPath: result.receiptBuilderPath
});
check("Route receipt builder collects concrete handoff inputs", receipt.handoffInputs?.teacherConfirmedSource?.includes("fixture-manual.md") && receipt.handoffInputs?.sourceDrawing?.includes("fixture-drawing.svg") && receiptBuilderHtml.includes("Route handoff inputs") && receiptBuilderHtml.includes("retrievalDraftReviewValidation") && receiptBuilderHtml.includes("Teacher-confirmed RAG source or lead"), {
  handoffInputs: receipt.handoffInputs
});
check("Launcher exposes reviewed RAG Rule DSL validation as a locked route", packet.lanes.some((lane) => lane.id === "rag_rule_dsl_review" && lane.recommendedTool === "knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs") && packet.nextCalls.some((call) => call.id === "continue_with_rag_rule_dsl_review") && receiptBuilderHtml.includes("continue_with_rag_rule_dsl_review"), {
  laneIds: packet.lanes.map((lane) => lane.id),
  nextCallIds: packet.nextCalls.map((call) => call.id)
});
check("Route receipt builder gives a manual validator command template", receiptBuilderHtml.includes("Manual validation command template") && receiptBuilderHtml.includes("validate-tlcl-apprentice-session-launcher-receipt.mjs") && receiptBuilderHtml.includes("Copy validation command") && receiptBuilderHtml.includes("This page does not run it"), {
  receiptBuilderPath: result.receiptBuilderPath
});
check("Optimized prompt encodes high-reasoning compile and medium-runtime reuse", packet.optimizedPrompt.includes("highest reasoning tier") && packet.costControlContract.mediumReasoning === "execute_confirmed_reusable_workflow_only", {
  optimizedPrompt: packet.optimizedPrompt
});
check("RAG stays evidence-only and non-authoritative", packet.ragPolicy.externalKnowledgeBaseRetriever === true && packet.ragPolicy.evidenceOnly === true && packet.ragPolicy.canAuthorizeExecution === false && packet.locks.ragEvidenceTreatedAsAuthority === false, {
  ragPolicy: packet.ragPolicy
});
check("Voice and numbered confirmation are visible before execution", packet.lanes.some((lane) => lane.id === "voice_numbered_confirmation" && lane.recommendedTool === "create_engineering_voice_control_session") && packet.locks.numberedTargetConfirmationRequired === true, {
  laneIds: packet.lanes.map((lane) => lane.id)
});
check("Teacher correction returns to high-reasoning repair", packet.costControlContract.correctionRoute === "teacher_correction_to_high_reasoning_repair" && packet.lanes.some((lane) => lane.id === "approved_execution_and_review"), {
  costControlContract: packet.costControlContract
});
check("Stronger models and distilled skills remain role-scoped providers", packet.marketResponse.strongerModelsAndDistilledSkillsAreProviders === true && packet.marketResponse.providerMayBypassContractLifecycle === false, {
  marketResponse: packet.marketResponse
});
check("Receipt blocks acceptance, execution, memory, and packaging shortcuts", receipt.defaultDecision === "needs_teacher_review" && receipt.blockedDecisions.includes("execute_now") && receipt.blockedDecisions.includes("write_memory") && receipt.blockedDecisions.includes("unlock_packaging"), {
  blockedDecisions: receipt.blockedDecisions
});
check("Generated package links to TLCL status refresh evidence", typeof result.statusRefreshPath === "string" && existsSync(result.statusRefreshPath) && readme.includes("TLCL status refresh"), {
  statusRefreshPath: result.statusRefreshPath
});
check("Next calls give one first-screen route across teaching, RAG, Rule DSL review, voice, and cost governor", packet.nextCalls.length === 6 && packet.nextCalls.some((call) => call.id === "start_with_rag_sources") && packet.nextCalls.some((call) => call.id === "continue_with_rag_rule_dsl_review") && packet.nextCalls.some((call) => call.id === "prepare_cost_governor_review"), {
  nextCallIds: packet.nextCalls.map((call) => call.id)
});

const passed = checks.filter((item) => item.passed).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  format: "transparent_ai_tlcl_apprentice_session_launcher_smoke_v1",
  passed,
  total: checks.length,
  checks,
  result
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
