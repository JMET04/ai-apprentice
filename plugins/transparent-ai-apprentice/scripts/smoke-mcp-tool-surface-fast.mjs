#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const sourceRepoRoot = resolve(pluginRoot, "..", "..");
const sourceServerScript = join(sourceRepoRoot, "plugins", "transparent-ai-apprentice", "scripts", "mcp-server.mjs");
const packagedServerScript = join(pluginRoot, "scripts", "mcp-server.mjs");
const runsFromSourceTree = existsSync(sourceServerScript);
const repoRoot = runsFromSourceTree ? sourceRepoRoot : resolve(process.cwd());
const serverScript = runsFromSourceTree ? sourceServerScript : packagedServerScript;

const teacherFacingNames = [
  "teach_apprentice",
  "show_teaching_card",
  "run_apprentice_profile",
  "review_apprentice_profile",
  "correct_last_result"
];

const requiredAdvancedNames = [
  "continue_teaching",
  "create_plugin_health_index",
  "create_plugin_manual_test_readiness_pack",
  "create_plugin_manual_test_result_receipt_template",
  "create_plugin_manual_test_session_packet",
  "validate_plugin_manual_test_result_receipt",
  "create_tlcl_direction_operational_console",
  "create_tlcl_next_route_input_contract",
  "create_tlcl_runtime_gate",
  "create_tlcl_reasoning_budget_governor",
  "create_tlcl_rag_evidence_attachment",
  "create_real_case_pilot_intake",
  "create_packaging_design_workflow",
  "create_transparent_sketch_overlay_kit",
  "create_office_text_mask_workbench",
  "create_engineering_software_mask_workbench",
  "validate_multimodal_surgical_mask_correction",
  "apply_surgical_office_text_edit",
  "resolve_learned_rule_conflicts"
];

const checks = [];

function check(name, pass, evidence = "") {
  checks.push({ name, pass, evidence });
}

function withTimeout(promise, ms, label) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

function parseToolJson(result) {
  const text = result?.content?.[0]?.text;
  if (!text) throw new Error("MCP tool call did not return text content");
  return JSON.parse(text);
}

function startServer(extraEnv = {}) {
  const child = spawn(process.execPath, [serverScript], {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    stdio: ["pipe", "pipe", "pipe"]
  });
  let nextId = 1;
  let stdoutBuffer = "";
  let stderr = "";
  const pending = new Map();

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    }
  });

  child.on("exit", () => {
    for (const request of pending.values()) {
      request.reject(new Error(stderr || "MCP server exited before replying"));
    }
    pending.clear();
  });

  child.on("error", (error) => {
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  });

  function rpc(method, params = {}, timeoutMs = 10000) {
    const id = nextId++;
    const payload = `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`;
    child.stdin.write(payload);
    return withTimeout(new Promise((resolve, reject) => pending.set(id, { resolve, reject })), timeoutMs, method);
  }

  async function stop() {
    if (!child.killed) child.kill();
    await withTimeout(new Promise((resolve) => child.once("exit", resolve)), 5000, "mcp-server-stop").catch(() => {});
  }

  return { rpc, stop, stderr: () => stderr };
}

async function withServer(extraEnv, fn) {
  const server = startServer(extraEnv);
  try {
    await server.rpc("initialize", {}, 10000);
    server.rpc("notifications/initialized", {}, 3000).catch(() => {});
    return await fn(server);
  } finally {
    await server.stop();
  }
}

function namesFromList(listResult) {
  return (listResult.tools || []).map((tool) => tool.name).sort();
}

const defaultList = await withServer({}, (server) => server.rpc("tools/list", {}, 10000));
const defaultNames = namesFromList(defaultList);
check(
  "Default MCP surface is teacher-facing and bounded",
  defaultList.mode === "teacher_facing" &&
    defaultNames.length === teacherFacingNames.length &&
    teacherFacingNames.every((name) => defaultNames.includes(name)),
  `mode=${defaultList.mode}; tools=${defaultNames.join(",")}`
);

check(
  "Default MCP surface hides advanced construction tools",
  !defaultNames.includes("continue_teaching") &&
    !defaultNames.includes("create_plugin_health_index") &&
    !defaultNames.includes("create_tlcl_runtime_gate"),
  `tools=${defaultNames.join(",")}`
);

const advancedList = await withServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" }, (server) =>
  server.rpc("tools/list", {}, 10000)
);
const advancedNames = namesFromList(advancedList);
const missingAdvancedNames = requiredAdvancedNames.filter((name) => !advancedNames.includes(name));
check(
  "Advanced MCP surface exposes the maintainer and TLCL core tools",
  advancedList.mode === "advanced" && advancedNames.length >= 300 && missingAdvancedNames.length === 0,
  `mode=${advancedList.mode}; tools=${advancedNames.length}; missing=${missingAdvancedNames.join(",") || "none"}`
);

const defaultTeachResult = await withServer({}, async (server) =>
  parseToolJson(
    await server.rpc(
      "tools/call",
      {
        name: "teach_apprentice",
        arguments: {
          message:
            "Prepare a handoff-oriented manual test card for the apprentice. Do not enable rules or write long-term memory.",
          profileName: "mcp-surface-fast-smoke"
        }
      },
      15000
    )
  )
);
const serializedTeachResult = JSON.stringify(defaultTeachResult);
check(
  "Default teach_apprentice returns a teacher-readable card without exposing internal ids",
  defaultTeachResult.ok === true &&
    serializedTeachResult.includes("teacher") &&
    !serializedTeachResult.includes("traceId") &&
    !serializedTeachResult.includes("ruleId") &&
    !serializedTeachResult.includes("demonstrationId"),
  `route=${defaultTeachResult.route || "unknown"}; bytes=${serializedTeachResult.length}`
);

const healthIndexResult = await withServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" }, async (server) =>
  parseToolJson(
    await server.rpc(
      "tools/call",
      {
        name: "create_plugin_health_index",
        arguments: {
          goal: "Fast MCP surface smoke should prove the maintainer health index tool is callable.",
          outDir: join(repoRoot, ".ta-smoke", "mcp-tool-surface-fast", "health-index")
        }
      },
      20000
    )
  )
);
check(
  "Advanced create_plugin_health_index is callable through MCP",
  healthIndexResult.responseMode === "transparent_ai_apprentice_plugin_health_index_result_v1" &&
    healthIndexResult.status === "ready_for_plugin_maintainer_review" &&
    Boolean(healthIndexResult.indexPath),
  `status=${healthIndexResult.status}; index=${healthIndexResult.indexPath || "missing"}`
);

const packagingWorkflowResult = await withServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" }, async (server) =>
  parseToolJson(
    await server.rpc(
      "tools/call",
      {
        name: "create_packaging_design_workflow",
        arguments: {
          action: "create",
          request: "Create a reviewed tuck-lock packaging workflow",
          productType: "tuck-lock folding carton",
          length: 200,
          width: 120,
          height: 60,
          unit: "mm",
          outputDir: join(repoRoot, ".ta-smoke", "mcp-tool-surface-fast", "packaging-workflow")
        }
      },
      15000
    )
  )
);
check(
  "Advanced packaging workflow starts at deep planning and keeps release locks closed",
  packagingWorkflowResult.ok === true &&
    packagingWorkflowResult.stage === "solution_planning" &&
    packagingWorkflowResult.locks?.accepted === false &&
    packagingWorkflowResult.locks?.ruleEnabled === false &&
    packagingWorkflowResult.locks?.packagingGated === true,
  `stage=${packagingWorkflowResult.stage}; session=${packagingWorkflowResult.sessionPath || "missing"}`
);

const surgicalRoot = join(repoRoot, ".ta-smoke", "mcp-tool-surface-fast", "surgical-correction");
mkdirSync(surgicalRoot, { recursive: true });
const advancedEnv = { TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" };

const originalImageKitResult = await withServer(advancedEnv, async (server) =>
  parseToolJson(
    await server.rpc(
      "tools/call",
      {
        name: "create_transparent_sketch_overlay_kit",
        arguments: {
          goal: "Review the existing engineering image with the original overlay.",
          software: "Image2 / AICAD",
          backdrop: join(pluginRoot, "assets", "examples", "engineering-object-index.png"),
          outputDir: join(surgicalRoot, "original-image-mask")
        }
      },
      20000
    )
  )
);
const originalImageHtml = readFileSync(originalImageKitResult.browserOverlay, "utf8");
check(
  "Original engineering-image overlay remains the restored standalone workbench",
  originalImageKitResult.ok === true &&
    originalImageKitResult.format === "transparent_ai_transparent_sketch_overlay_kit_result_v1" &&
    !originalImageHtml.includes("data-content-type=") &&
    !originalImageHtml.includes('id="nativeLocator"') &&
    !originalImageHtml.includes('id="objectId"'),
  `overlay=${originalImageKitResult.browserOverlay}`
);

const officeMaskResult = await withServer(advancedEnv, async (server) =>
  parseToolJson(
    await server.rpc(
      "tools/call",
      {
        name: "create_office_text_mask_workbench",
        arguments: {
          goal: "Replace only paragraph 2 text.",
          software: "Microsoft Word",
          demoPreset: "office_text_replace",
          outputDir: join(surgicalRoot, "office-text-mask")
        }
      },
      20000
    )
  )
);
const officeMaskHtml = readFileSync(officeMaskResult.browserOverlay, "utf8");
check(
  "Standalone Office text mask is callable through its own MCP tool",
  officeMaskResult.format === "mingtu_office_text_mask_workbench_result_v1" &&
    officeMaskResult.dedicatedMaskType === "text" &&
    officeMaskHtml.includes('id="nativeLocator"') &&
    !officeMaskHtml.includes('id="objectId"') &&
    !officeMaskHtml.includes("data-content-type="),
  `overlay=${officeMaskResult.browserOverlay}`
);

const engineeringKitResult = await withServer(advancedEnv, async (server) =>
  parseToolJson(
    await server.rpc(
      "tools/call",
      {
        name: "create_engineering_software_mask_workbench",
        arguments: {
          goal: "Only change engineering dimension D04 to 450 mm and preserve every other entity.",
          software: "AICAD / AutoCAD",
          demoPreset: "engineering_dimension_change",
          backdrop: join(pluginRoot, "assets", "examples", "engineering-object-index.png"),
          outputDir: join(surgicalRoot, "engineering-mask")
        }
      },
      20000
    )
  )
);
check(
  "Standalone engineering-software mask creates a surgical D04 demonstration through MCP",
  engineeringKitResult.ok === true &&
    engineeringKitResult.format === "mingtu_engineering_software_mask_workbench_result_v1" &&
    engineeringKitResult.dedicatedMaskType === "engineering" &&
    engineeringKitResult.demoPreset === "engineering_dimension_change" &&
    engineeringKitResult.enforcesSurgicalEditAndOutsideMaskPreservation === true &&
    engineeringKitResult.reviewLocks?.softwareActionsExecuted === false,
  `packet=${engineeringKitResult.samplePacket || "missing"}`
);

const maskValidationResult = await withServer(advancedEnv, async (server) =>
  parseToolJson(
    await server.rpc(
      "tools/call",
      {
        name: "validate_multimodal_surgical_mask_correction",
        arguments: { input: engineeringKitResult.samplePacket }
      },
      15000
    )
  )
);
check(
  "Advanced surgical mask validator accepts the D04 packet and keeps execution locked",
  maskValidationResult.passed === true &&
    maskValidationResult.contentType === "engineering" &&
    maskValidationResult.readyForExecution === false &&
    maskValidationResult.locks?.softwareActionsExecuted === false,
  `status=${maskValidationResult.status}; targets=${maskValidationResult.changeTargetCount}`
);

const officeFixtureDir = join(surgicalRoot, "office-fixtures");
const officeEditor = join(pluginRoot, "scripts", "surgical-office-text-edit.py");
const fixtureRun = spawnSync("python", ["-B", officeEditor, "--create-test-fixtures", officeFixtureDir], {
  cwd: repoRoot,
  encoding: "utf8",
  env: { ...process.env, PYTHONUTF8: "1", TEMP: join(repoRoot, ".ta-smoke"), TMP: join(repoRoot, ".ta-smoke") }
});
if (fixtureRun.status !== 0) throw new Error(fixtureRun.stderr || "Unable to create Office fixtures");
const officeFixtures = JSON.parse((fixtureRun.stdout || "{}").replace(/^\uFEFF/, ""));
const officeTarget = {
  id: "word-paragraph-2",
  contentType: "text",
  role: "change",
  label: "paragraph:2",
  maskGeometry: { kind: "rect", box: [0.2, 0.2, 0.7, 0.3], points: [], coordinateUnits: "normalized_0_to_1" },
  editIntent: {
    kind: "text_edit",
    documentType: "word_docx",
    locator: "paragraph:2",
    operation: "replace",
    sourceText: "\u5468\u4e94",
    replacementText: "\u5468\u4e00",
    typographyNote: "preserve existing style",
    sourceTextConfirmedByTeacher: true,
    requiresExactTextMatch: true
  },
  preserveOutsideThisMask: true,
  teacherReviewRequired: true,
  completeness: { complete: true, reason: "exact_source_and_text_operation_present" }
};
const officeRequest = {
  modificationFormat: "mingtu_multimodal_surgical_mask_correction_v1",
  activeContentType: "text",
  modificationTargets: [officeTarget],
  changeTargets: [officeTarget],
  surgicalEditContract: {
    format: "mingtu_surgical_edit_contract_v1",
    policy: "surgical_only",
    selectedChangeTargetIds: [officeTarget.id],
    globalPreserveInstruction: "Preserve every unselected paragraph, style, and package part.",
    changeOnlyInsideSelectedTargets: true,
    preserveAllUnmarkedContent: true,
    fullRegenerationAllowed: false,
    localEditFailureBehavior: "block_and_return_to_teacher_without_regenerating",
    validation: {
      textOutsideTargets: "exact_text_and_style_match_required",
      beforeAfterComparisonRequired: true,
      rejectIfUnmarkedContentChanged: true
    }
  },
  locks: {
    ruleEnabled: false,
    accepted: false,
    packagingGated: true,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    memoryWritten: false
  }
};
const officeRequestPath = join(surgicalRoot, "word-request.json");
const officeOutputPath = join(surgicalRoot, "word-edited.docx");
writeFileSync(officeRequestPath, JSON.stringify(officeRequest, null, 2), "utf8");
const officeEditResult = await withServer(advancedEnv, async (server) =>
  parseToolJson(
    await server.rpc(
      "tools/call",
      {
        name: "apply_surgical_office_text_edit",
        arguments: { request: officeRequestPath, input: officeFixtures.docx, output: officeOutputPath }
      },
      20000
    )
  )
);
check(
  "Advanced Office tool changes only the confirmed Word paragraph through MCP",
  officeEditResult.status === "passed_targeted_edit" &&
    officeEditResult.targetedEdit?.nativeTarget === "paragraph:2" &&
    officeEditResult.changedPackageParts?.length === 1 &&
    officeEditResult.changedPackageParts[0] === "word/document.xml" &&
    officeEditResult.verification?.fullDocumentRecheckRequired === false,
  `target=${officeEditResult.targetedEdit?.nativeTarget}; changed=${officeEditResult.changedPackageParts?.join(",")}`
);

const ruleRequestPath = join(surgicalRoot, "rule-conflict-request.json");
writeFileSync(ruleRequestPath, JSON.stringify({
  context: { documentType: "excel_xlsx", sheet: "finance-review" },
  rules: [
    { id: "general", enabled: true, action: "round to whole number", appliesWhen: { documentType: "excel_xlsx" }, confidence: "high" },
    { id: "teacher-exception", enabled: true, action: "keep two decimals", appliesWhen: { documentType: "excel_xlsx", sheet: "finance-review" }, teacherException: true, confidence: "high", reviewStatus: "approved" }
  ]
}, null, 2), "utf8");
const ruleDecisionResult = await withServer(advancedEnv, async (server) =>
  parseToolJson(
    await server.rpc(
      "tools/call",
      { name: "resolve_learned_rule_conflicts", arguments: { input: ruleRequestPath } },
      15000
    )
  )
);
check(
  "Advanced rule resolver selects the contextual teacher exception and marks the issue through MCP",
  ruleDecisionResult.status === "resolved_by_teacher_exception" &&
    ruleDecisionResult.decision?.selectedRuleId === "teacher-exception" &&
    ruleDecisionResult.problemMarkers?.[0]?.type === "apparent_rule_conflict" &&
    ruleDecisionResult.rulesMutated === false,
  `selected=${ruleDecisionResult.decision?.selectedRuleId}; markers=${ruleDecisionResult.problemMarkers?.length || 0}`
);

const passed = checks.filter((item) => item.pass).length;
const output = {
  responseMode: "transparent_ai_mcp_tool_surface_fast_smoke_v1",
  status: passed === checks.length ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  command: "npm run smoke:plugin-tool-surface",
  fullRegressionCommand: "npm run smoke:plugin-tool-surface:full",
  serverScript,
  passed,
  total: checks.length,
  checks,
  nextAction:
    passed === checks.length
      ? "Use this fast gate for handoff checks; run the full MCP tool surface smoke only for deep regression."
      : "Fix failed MCP surface checks before treating the plugin install as ready for handoff."
};

console.log(JSON.stringify(output, null, 2));
if (output.status !== "passed") {
  process.exit(1);
}
