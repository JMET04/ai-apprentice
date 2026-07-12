#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function argValues(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function slug(value) {
  return (
    String(value || "tlcl-apprentice-session")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-apprentice-session"
  );
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function relativeArtifact(path) {
  if (!path) return "";
  const resolved = resolve(path);
  const rel = relative(repoRoot, resolved);
  return rel.startsWith("..") ? resolved : rel;
}

const goal = argValue(
  "--goal",
  argValue(
    "--task",
    "Launch a transparent AI apprentice session with TLCL cost control, RAG evidence, teacher review, rollback, and correction escalation."
  )
);
const software = argValue("--software", argValue("--app", "target engineering software"));
const teacherCommand = argValue(
  "--teacher-command",
  argValue("--command", argValue("--text-command", "Teach the apprentice the workflow, then run only after numbered confirmation."))
);
const teacherStyle = argValue("--teacher-style", argValue("--style", "voice or typed instruction, visual demonstration, correction-first"));
const rollbackPoint = argValue("--rollback-point", argValue("--rollback", ""));
const outputRoot = resolve(
  argValue("--output-dir", argValue("--out-dir", join(repoRoot, ".transparent-apprentice", "tlcl-apprentice-session-launches")))
);
const knowledgeSources = [...argValues("--knowledge-source"), ...argValues("--source-knowledge"), ...argValues("--rag-source")];
const sourceArtifacts = [...argValues("--artifact"), ...argValues("--source-artifact"), ...argValues("--drawing")];

mkdirSync(outputRoot, { recursive: true });
const launchId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(`${software}-${goal}`)}`;
const launchDir = join(outputRoot, launchId);
mkdirSync(launchDir, { recursive: true });

const statusRefresh = runNodeScript("create-tlcl-status-refresh.mjs", [
  "--goal",
  goal,
  "--out-dir",
  join(launchDir, "tlcl-status-refresh")
]);

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  modelInvoked: false,
  providerInvoked: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  memoryWritten: false,
  ragEvidenceTreatedAsAuthority: false,
  rollbackRequiredBeforeExecution: true,
  teacherConfirmationRequiredBeforeExecution: true,
  numberedTargetConfirmationRequired: true,
  correctionEscalatesToHighReasoning: true,
  mediumRuntimeRequiresConfirmedWorkflow: true
};

const optimizedPrompt = [
  "Treat this as a TLCL apprentice session, not a generic agent request.",
  "Use the highest reasoning tier only to compile or repair the normative logic contract.",
  "Use medium reasoning only for a teacher-reviewed reusable workflow with deterministic validators, rollback, and fresh outcome review.",
  "Use RAG only as cited evidence with logic extraction hints; it cannot authorize execution, enable rules, write memory, or unlock packaging.",
  "Before any engineering action, convert voice or text into numbered target candidates and wait for one teacher-confirmed number.",
  "If the teacher corrects the output, route back to high-reasoning contract repair before another medium-runtime attempt."
].join(" ");

const lanes = [
  {
    id: "teach_intent",
    title: "Teacher intent and existing-tool demonstration",
    purpose: "Capture what the human wants to teach through voice, text, screenshots, drawing software, CAD exports, or examples.",
    recommendedTool: "continue_teaching",
    commandTemplate:
      "Use continue_teaching with teacherStyle, source artifacts, and universalDetailLogic=true when output details must be data-bound.",
    requiredBeforeAdvance: ["teacher states goal", "source artifact or example is reviewed", "no rule memory is written yet"]
  },
  {
    id: "rag_evidence",
    title: "Knowledge-augmented RAG evidence lane",
    purpose: "Attach manuals, standards, papers, examples, or software docs as evidence packets and disabled Rule Card drafts.",
    recommendedTool: "knowledge/create-rag-research-intake-queue.mjs",
    commandTemplate:
      "node plugins/transparent-ai-apprentice/scripts/knowledge/create-rag-research-intake-queue.mjs --goal <goal> --lead <source>",
    requiredBeforeAdvance: ["source is teacher/researcher confirmed", "retrieval evidence remains non-authoritative"]
  },
  {
    id: "rag_rule_dsl_review",
    title: "Reviewed RAG Rule DSL validation chain",
    purpose:
      "Continue from a teacher-reviewed retrieval draft into Rule DSL validation, human Rule DSL review, and a disabled rule package without activating rules.",
    recommendedTool: "knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs",
    commandTemplate:
      "node plugins/transparent-ai-apprentice/scripts/knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs --review-validation <retrieval-draft-review-validation.json> --rollback-point <retained-rollback-point> --teacher-reviewed",
    requiredBeforeAdvance: [
      "retrieval draft review receipt is validated",
      "logicExtractionHint and logicFitDecision are preserved when present",
      "all downstream rules remain draft_disabled"
    ]
  },
  {
    id: "high_reasoning_compile",
    title: "Highest-reasoning logic contract compile",
    purpose: "Compile teacher teaching, RAG evidence, corrections, and detail logic into Rule Cards, Rule DSL, tests, and failure policy.",
    recommendedTool: "create_tlcl_reasoning_budget_governor",
    commandTemplate:
      "create_tlcl_reasoning_budget_governor(operation=compile_logic_contract, tier=senior_reasoning_compile)",
    requiredBeforeAdvance: ["rules remain draft_disabled", "deterministic validators are planned", "teacher review is still required"]
  },
  {
    id: "deterministic_validation",
    title: "Rule DSL and deterministic validation",
    purpose: "Fail closed on active blocking fail, unknown, or validator error before any delivery or runtime reuse.",
    recommendedTool: "scripts/rules/evaluate-rule-package.mjs",
    commandTemplate:
      "node plugins/transparent-ai-apprentice/scripts/rules/evaluate-rule-package.mjs --package <disabled-or-active-rule-package>",
    requiredBeforeAdvance: ["Validation Report is reviewed", "unknown is not converted to pass"]
  },
  {
    id: "medium_runtime_reuse",
    title: "Medium-runtime reusable workflow",
    purpose: "Run only confirmed workflow logic at lower cost after validators, rollback, approval gate, and fresh outcome review are ready.",
    recommendedTool: "create_tlcl_reasoning_budget_medium_reuse_handoff",
    commandTemplate:
      "create_tlcl_reasoning_budget_medium_reuse_handoff(confirmed reasoning-budget review validation)",
    requiredBeforeAdvance: ["workflow fingerprint matches", "reasoningBudgetGovernorReviewTrace is preserved"]
  },
  {
    id: "voice_numbered_confirmation",
    title: "Voice/text numbered target confirmation",
    purpose: "Convert non-expert voice or typed commands into numbered target candidates before any dry-run or execution gate.",
    recommendedTool: "create_engineering_voice_control_session",
    commandTemplate:
      "create_engineering_voice_control_session(software, command, visual evidence, teacher confirmation)",
    requiredBeforeAdvance: ["one number is confirmed", "route evidence and rollback are present"]
  },
  {
    id: "approved_execution_and_review",
    title: "Approved gate, fresh outcome review, and correction loop",
    purpose: "Execute only through teacher-approved gates, then require outcome review; mismatch or correction returns to high reasoning.",
    recommendedTool: "run_tlcl_medium_runtime_approved_gate_runner",
    commandTemplate:
      "run_tlcl_medium_runtime_approved_gate_runner requires execute flag, teacher confirmation, and rollback confirmation.",
    requiredBeforeAdvance: ["fresh outcome review receipt", "reuse only after matched contract"]
  }
];

const nextCalls = [
  {
    id: "refresh_tlcl_status",
    tool: "create_tlcl_status_refresh",
    arguments: { goal }
  },
  {
    id: "start_with_existing_tool_demo",
    tool: "continue_teaching",
    arguments: {
      goal,
      software,
      teacherStyle,
      teacherMessage: teacherCommand,
      universalDetailLogic: true,
      sourceDrawing: sourceArtifacts[0] || ""
    }
  },
  {
    id: "start_with_rag_sources",
    tool: "knowledge/create-rag-research-intake-queue.mjs",
    arguments: {
      goal,
      sources: knowledgeSources.map(relativeArtifact),
      note: "RAG is evidence only and must not authorize execution or rule activation."
    }
  },
  {
    id: "continue_with_rag_rule_dsl_review",
    tool: "knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs",
    arguments: {
      goal,
      reviewValidation: "<retrieval-draft-review-validation.json>",
      rollbackPoint: rollbackPoint ? relativeArtifact(rollbackPoint) : "<retained-rollback-point>",
      teacherReviewed: true,
      note:
        "Continue only after teacher-reviewed retrieval evidence; create a Rule DSL validation package for draft_disabled rules without activation, memory writes, software execution, or packaging unlock."
    }
  },
  {
    id: "start_with_voice_numbered_confirmation",
    tool: "create_engineering_voice_control_session",
    arguments: {
      goal,
      software,
      command: teacherCommand,
      teacherStyle,
      rollbackPoint: rollbackPoint ? relativeArtifact(rollbackPoint) : ""
    }
  },
  {
    id: "prepare_cost_governor_review",
    tool: "create_tlcl_reasoning_budget_governor",
    arguments: {
      goal,
      operation: "compile_logic_contract",
      tier: "senior_reasoning_compile",
      note: "Compile or repair normative logic before medium-runtime reuse."
    }
  }
];

const receiptTemplate = {
  format: "transparent_ai_tlcl_apprentice_session_launcher_receipt_v1",
  launchId,
  defaultDecision: "needs_teacher_review",
  allowedDecisions: [
    "start_with_existing_tool_demo",
    "start_with_rag_sources",
    "continue_with_rag_rule_dsl_review",
    "start_with_voice_numbered_confirmation",
    "start_with_low_token_observation",
    "blocked"
  ],
  blockedDecisions: ["accepted", "execute_now", "enable_rule", "write_memory", "unlock_packaging", "claim_complete"],
  teacherSelectedDecision: "needs_teacher_review",
  teacherNotes: "",
  confirmedRollbackPoint: rollbackPoint ? relativeArtifact(rollbackPoint) : "",
  handoffInputs: {
    sourceDrawing: sourceArtifacts[0] ? relativeArtifact(sourceArtifacts[0]) : "",
    teacherConfirmedSource: knowledgeSources[0] ? relativeArtifact(knowledgeSources[0]) : "",
    retrievalDraftReviewValidation: "",
    visualEvidence: sourceArtifacts[0] ? relativeArtifact(sourceArtifacts[0]) : ""
  },
  locks
};

const packet = {
  format: "transparent_ai_tlcl_apprentice_session_launcher_v1",
  status: "tlcl_apprentice_session_launch_waiting_for_teacher_route_choice",
  launchId,
  goal,
  software,
  teacherCommand,
  teacherStyle,
  optimizedPrompt,
  statusRefresh,
  paths: {},
  sources: {
    knowledgeSources: knowledgeSources.map(relativeArtifact),
    sourceArtifacts: sourceArtifacts.map(relativeArtifact),
    rollbackPoint: rollbackPoint ? relativeArtifact(rollbackPoint) : ""
  },
  costControlContract: {
    highReasoning: "compile_or_repair_logic_contract",
    mediumReasoning: "execute_confirmed_reusable_workflow_only",
    lowReasoning: "fixed_transform_and_metadata_tasks",
    deterministicValidators: "pass_fail_unknown_error_fail_closed",
    correctionRoute: "teacher_correction_to_high_reasoning_repair"
  },
  marketResponse: {
    strongerModelsAndDistilledSkillsAreProviders: true,
    allowedProviderRoles: ["senior_reasoning_compile", "medium_reasoning_runtime", "low_reasoning_tool"],
    providerMayBypassContractLifecycle: false
  },
  ragPolicy: {
    externalKnowledgeBaseRetriever: true,
    evidenceOnly: true,
    canDraftDisabledRules: true,
    canAuthorizeExecution: false,
    canEnableRules: false,
    canWriteMemory: false
  },
  lanes,
  nextCalls,
  receiptTemplate,
  locks
};

const packetPath = join(launchDir, "tlcl-apprentice-session-launcher.json");
const receiptTemplatePath = join(launchDir, "tlcl-apprentice-session-launcher-receipt-template.json");
const receiptBuilderPath = join(launchDir, "tlcl-apprentice-session-route-receipt-builder.html");
const htmlPath = join(launchDir, "index.html");
const readmePath = join(launchDir, "README.md");

packet.paths = {
  packetPath,
  receiptTemplatePath,
  receiptBuilderPath,
  htmlPath,
  readmePath,
  statusRefreshPath: statusRefresh.refreshPath || ""
};

writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");

writeFileSync(
  receiptBuilderPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TLCL Route Receipt Builder</title>
  <style>
    :root { color-scheme: light; font-family: "Segoe UI", Arial, sans-serif; background: #f6f8fb; color: #17202a; }
    body { margin: 0; }
    main { max-width: 980px; margin: 0 auto; padding: 22px; }
    h1 { font-size: 26px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 16px; margin: 14px 0 8px; }
    .panel { background: #fff; border: 1px solid #d7dee9; border-radius: 8px; padding: 16px; margin-top: 12px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05); }
    label { display: block; margin: 8px 0; line-height: 1.4; }
    input[type="text"], textarea { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 6px; padding: 9px; font: 13px "Segoe UI", Arial, sans-serif; }
    textarea { min-height: 190px; font-family: Consolas, monospace; }
    textarea.command { min-height: 92px; }
    button, a.button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 8px 12px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; margin: 6px 6px 0 0; }
    button.secondary, a.secondary { background: #fff; color: #174d89; }
    code { word-break: break-all; }
  </style>
</head>
<body>
  <main>
    <h1>TLCL Route Receipt Builder</h1>
    <p>This page helps the teacher create a receipt JSON only. It does not validate, execute software, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.</p>
    <section class="panel">
      <h2>1. Choose one route</h2>
      <div id="routes"></div>
      <h2>2. Teacher note</h2>
      <input id="teacherNotes" type="text" value="">
      <h2>3. Retained rollback point</h2>
      <input id="rollbackPoint" type="text" value="${htmlEscape(rollbackPoint ? relativeArtifact(rollbackPoint) : "")}">
      <h2>4. Route handoff inputs</h2>
      <label>Existing-tool source drawing or artifact
        <input id="sourceDrawing" type="text" value="${htmlEscape(sourceArtifacts[0] ? relativeArtifact(sourceArtifacts[0]) : "")}">
      </label>
      <label>Teacher-confirmed RAG source or lead
        <input id="teacherConfirmedSource" type="text" value="${htmlEscape(knowledgeSources[0] ? relativeArtifact(knowledgeSources[0]) : "")}">
      </label>
      <label>Reviewed retrieval draft validation path for RAG Rule DSL continuation
        <input id="retrievalDraftReviewValidation" type="text" value="">
      </label>
      <label>Voice/text route visual evidence
        <input id="visualEvidence" type="text" value="${htmlEscape(sourceArtifacts[0] ? relativeArtifact(sourceArtifacts[0]) : "")}">
      </label>
      <h2>5. Receipt file path for manual validation</h2>
      <input id="receiptPathForValidation" type="text" value="tlcl-apprentice-session-launcher-receipt.json">
      <button id="buildReceipt">Build receipt JSON</button>
      <button id="copyReceipt" class="secondary">Copy receipt JSON</button>
      <button id="downloadReceipt" class="secondary">Download receipt JSON</button>
      <button id="copyValidationCommand" class="secondary">Copy validation command</button>
      <a class="button secondary" href="${pathToFileURL(receiptTemplatePath).href}">Open template</a>
    </section>
    <section class="panel">
      <h2>Receipt JSON</h2>
      <textarea id="receiptJson" spellcheck="false"></textarea>
    </section>
    <section class="panel">
      <h2>Manual validation command template</h2>
      <p>This command is for a human or next agent to run after the receipt file is saved. This page does not run it.</p>
      <textarea id="validationCommand" class="command" spellcheck="false"></textarea>
    </section>
  </main>
  <script>
    const receiptTemplate = ${jsonForScript(receiptTemplate)};
    const launcherPacketPath = ${jsonForScript(packetPath)};
    const validationOutputDir = ${jsonForScript(join(launchDir, "route-receipt-validation"))};
    const routeLabels = {
      start_with_existing_tool_demo: "Existing tool demo / continue teaching",
      start_with_rag_sources: "RAG evidence intake only",
      continue_with_rag_rule_dsl_review: "Reviewed RAG Rule DSL validation chain",
      start_with_voice_numbered_confirmation: "Voice or text numbered confirmation",
      start_with_low_token_observation: "Low-token observation bootstrap",
      blocked: "Blocked by teacher"
    };
    const routes = document.getElementById("routes");
    const output = document.getElementById("receiptJson");
    const validationCommand = document.getElementById("validationCommand");
    function quoteCli(value) {
      return '"' + String(value || "").replace(/"/g, '\\"') + '"';
    }
    function buildValidationCommand() {
      const receiptPath = document.getElementById("receiptPathForValidation").value || "tlcl-apprentice-session-launcher-receipt.json";
      validationCommand.value = [
        "node",
        "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-launcher-receipt.mjs",
        "--launcher",
        quoteCli(launcherPacketPath),
        "--receipt",
        quoteCli(receiptPath),
        "--out-dir",
        quoteCli(validationOutputDir)
      ].join(" ");
    }
    for (const route of receiptTemplate.allowedDecisions) {
      const label = document.createElement("label");
      label.innerHTML = '<input type="radio" name="route" value="' + route + '"' + (route === "start_with_existing_tool_demo" ? " checked" : "") + '> ' + (routeLabels[route] || route) + ' <code>' + route + '</code>';
      routes.appendChild(label);
    }
    function buildReceipt() {
      const selected = document.querySelector('input[name="route"]:checked')?.value || "needs_teacher_review";
      const receipt = {
        ...receiptTemplate,
        teacherSelectedDecision: selected,
        teacherNotes: document.getElementById("teacherNotes").value,
        confirmedRollbackPoint: document.getElementById("rollbackPoint").value,
        handoffInputs: {
          sourceDrawing: document.getElementById("sourceDrawing").value,
          teacherConfirmedSource: document.getElementById("teacherConfirmedSource").value,
          retrievalDraftReviewValidation: document.getElementById("retrievalDraftReviewValidation").value,
          visualEvidence: document.getElementById("visualEvidence").value
        }
      };
      output.value = JSON.stringify(receipt, null, 2);
      buildValidationCommand();
      return receipt;
    }
    document.getElementById("buildReceipt").addEventListener("click", buildReceipt);
    document.getElementById("copyReceipt").addEventListener("click", async () => {
      buildReceipt();
      await navigator.clipboard.writeText(output.value);
    });
    document.getElementById("copyValidationCommand").addEventListener("click", async () => {
      buildReceipt();
      await navigator.clipboard.writeText(validationCommand.value);
    });
    document.getElementById("receiptPathForValidation").addEventListener("input", buildValidationCommand);
    document.getElementById("downloadReceipt").addEventListener("click", () => {
      buildReceipt();
      const blob = new Blob([output.value + "\\n"], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tlcl-apprentice-session-launcher-receipt.json";
      a.click();
      URL.revokeObjectURL(url);
    });
    buildReceipt();
  </script>
</body>
</html>
`,
  "utf8"
);

writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TLCL Apprentice Session Launcher</title>
  <style>
    :root { color-scheme: light; font-family: "Segoe UI", Arial, sans-serif; background: #f5f7fa; color: #17202a; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 17px; margin: 0 0 10px; }
    p { line-height: 1.5; }
    .top { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr); gap: 16px; align-items: start; }
    .panel, .lane { background: #fff; border: 1px solid #d7dee9; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(255px, 1fr)); gap: 14px; margin-top: 16px; }
    .badge { display: inline-flex; min-height: 24px; align-items: center; border-radius: 999px; padding: 0 8px; font-size: 12px; background: #e7f0ff; color: #174d89; margin: 3px 4px 3px 0; }
    .lock { border: 1px solid #e4e9f1; border-radius: 6px; padding: 7px; font-size: 13px; background: #fbfcfe; }
    .locks { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; margin-top: 10px; }
    textarea { width: 100%; min-height: 220px; box-sizing: border-box; border: 1px solid #cdd6e3; border-radius: 6px; padding: 10px; font: 13px Consolas, monospace; }
    button, a.button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 8px 12px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
    button.secondary, a.secondary { background: #fff; color: #174d89; }
    code { word-break: break-all; }
    @media (max-width: 760px) { main { padding: 16px; } .top { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <h1>TLCL Apprentice Session Launcher</h1>
    <p>${htmlEscape(goal)}</p>
    <section class="top">
      <div class="panel">
        <h2>Optimized Prompt</h2>
        <p>${htmlEscape(optimizedPrompt)}</p>
        <span class="badge">highest reasoning compiles logic</span>
        <span class="badge">medium reasoning reuses confirmed workflow</span>
        <span class="badge">RAG is evidence only</span>
        <span class="badge">correction returns to repair</span>
        <p><a class="button secondary" href="${pathToFileURL(packetPath).href}">Open packet JSON</a> <a class="button secondary" href="${pathToFileURL(receiptTemplatePath).href}">Open receipt template</a> <a class="button secondary" href="${pathToFileURL(receiptBuilderPath).href}">Open route receipt builder</a></p>
      </div>
      <div class="panel">
        <h2>Safety Locks</h2>
        <div id="locks" class="locks"></div>
      </div>
    </section>
    <section class="panel" style="margin-top:16px">
      <h2>Next Calls</h2>
      <button id="copyCalls">Copy next calls</button>
      <button id="copyReceipt" class="secondary">Copy receipt template</button>
      <textarea id="packet" spellcheck="false"></textarea>
    </section>
    <section class="grid" id="lanes"></section>
  </main>
  <script>
    const packet = ${jsonForScript(packet)};
    const lanes = document.getElementById("lanes");
    const locks = document.getElementById("locks");
    const textArea = document.getElementById("packet");
    textArea.value = JSON.stringify(packet.nextCalls, null, 2);
    for (const lane of packet.lanes) {
      const el = document.createElement("article");
      el.className = "lane";
      const requirements = (lane.requiredBeforeAdvance || []).map((item) => "<li>" + String(item) + "</li>").join("");
      el.innerHTML = "<h2>" + lane.title + "</h2><p>" + lane.purpose + "</p><p><strong>Tool:</strong> <code>" + lane.recommendedTool + "</code></p><p><code>" + lane.commandTemplate + "</code></p><ul>" + requirements + "</ul>";
      lanes.appendChild(el);
    }
    for (const [key, value] of Object.entries(packet.locks)) {
      const el = document.createElement("div");
      el.className = "lock";
      el.textContent = key + ": " + value;
      locks.appendChild(el);
    }
    document.getElementById("copyCalls").addEventListener("click", async () => {
      textArea.value = JSON.stringify(packet.nextCalls, null, 2);
      await navigator.clipboard.writeText(textArea.value);
    });
    document.getElementById("copyReceipt").addEventListener("click", async () => {
      textArea.value = JSON.stringify(packet.receiptTemplate, null, 2);
      await navigator.clipboard.writeText(textArea.value);
    });
  </script>
</body>
</html>
`,
  "utf8"
);

writeFileSync(
  readmePath,
  [
    "# TLCL Apprentice Session Launcher",
    "",
    "This package is a review-only first screen for starting a cost-controlled Transparent AI Apprentice session.",
    "",
    `- Packet: ${packetPath}`,
    `- Browser page: ${htmlPath}`,
    `- Receipt template: ${receiptTemplatePath}`,
    `- Route receipt builder: ${receiptBuilderPath}`,
    `- TLCL status refresh: ${statusRefresh.refreshPath || ""}`,
    "",
    "It keeps RAG evidence non-authoritative, stronger models and distilled skills role-scoped, medium runtime bounded to confirmed workflows, and teacher corrections routed back to high-reasoning contract repair.",
    "",
    "It does not invoke models, execute target software, send UI events, capture screenshots, write memory, enable rules, unlock packaging, or claim completion."
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      status: packet.status,
      format: "transparent_ai_tlcl_apprentice_session_launcher_result_v1",
      launchId,
      packetPath,
      htmlPath,
      receiptTemplatePath,
      receiptBuilderPath,
      readmePath,
      statusRefreshPath: statusRefresh.refreshPath || "",
      laneCount: lanes.length,
      nextCallCount: nextCalls.length,
      optimizedPrompt,
      locks
    },
    null,
    2
  )
);
