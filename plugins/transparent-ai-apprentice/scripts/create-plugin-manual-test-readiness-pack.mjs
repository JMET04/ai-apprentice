#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readText(path) {
  return readFileSync(path, "utf8").replace(/^\uFEFF/, "");
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function toPosix(path) {
  return path.split("\\").join("/");
}

function rel(path) {
  return toPosix(relative(repoRoot, path));
}

function htmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value, "utf8");
  return path;
}

function collectMcpToolNames(serverText) {
  const names = new Set();
  const pattern = /\n\s*\{\s*name:\s*"([^"]+)"/g;
  let match;
  while ((match = pattern.exec(serverText))) names.add(match[1]);
  return [...names].sort();
}

const goal = argValue("--goal", "manual plugin handoff test readiness");
const outputRoot = resolve(argValue("--out-dir", join(pluginRoot, "artifacts", "manual-test-readiness")));
const manifestPath = join(pluginRoot, ".codex-plugin", "plugin.json");
const serverPath = join(pluginRoot, "scripts", "mcp-server.mjs");
const readmePath = join(pluginRoot, "README.md");
const skillPath = join(pluginRoot, "skills", "teachable-apprentice", "SKILL.md");
const repoPackagePath = join(repoRoot, "package.json");
const bundledPackagePath = join(pluginRoot, "package.json");
const packagePath = existsSync(repoPackagePath) ? repoPackagePath : bundledPackagePath;

const manifest = readJson(manifestPath);
const packageJson = existsSync(packagePath) ? readJson(packagePath) : { scripts: {} };
const packageScripts = packageJson.scripts || {};
const mcpServerText = readText(serverPath);
const readmeText = readText(readmePath);
const skillText = readText(skillPath);
const mcpToolNames = collectMcpToolNames(mcpServerText);

const scenarios = [
  {
    id: "install_and_tool_surface",
    title: "Installed plugin and MCP surface",
    command: "npm run smoke:plugin-tool-surface",
    expectedEvidence: ".ta-smoke/mcp-tool-surface-fast/health-index/plugin-health-index.json",
    manualAction: "Open the plugin in Codex, confirm the starter prompts appear, and verify ordinary users see only teacher-facing tools.",
    passCriteria: [
      "default tools/list mode is teacher_facing",
      "only teach_apprentice, show_teaching_card, run_apprentice_profile, review_apprentice_profile, and correct_last_result are exposed by default",
      "advanced mode still lists create_plugin_health_index and TLCL core tools"
    ],
    stopConditions: ["advanced tools appear in the default surface", "MCP health index cannot be created"]
  },
  {
    id: "first_teacher_entry",
    title: "First teaching entry and guided intake",
    command: "npm run smoke:plugin-guided",
    expectedEvidence: ".transparent-apprentice generated teaching artifacts",
    manualAction: "Ask the plugin to teach a small task from a short instruction, then inspect whether the response gives a clear next teaching action.",
    passCriteria: [
      "teacher can start without knowing internal script names",
      "output is a public teacher card rather than hidden chain-of-thought",
      "next action stays review-only until explicit teacher approval"
    ],
    stopConditions: ["the plugin asks for internal ids before first use", "the response claims memory approval or product acceptance"]
  },
  {
    id: "visual_demonstration",
    title: "Visual teaching from existing artifacts",
    command: "npm run smoke:plugin-visual-kit",
    expectedEvidence: ".transparent-apprentice visual teaching templates",
    manualAction: "Use a screenshot, draw.io export, table, or short notes as teaching evidence and verify the plugin produces editable review material.",
    passCriteria: [
      "generated material reuses existing tools instead of requiring a custom canvas",
      "visual evidence is treated as review evidence only",
      "rule drafts remain disabled until teacher review"
    ],
    stopConditions: ["visual evidence is treated as automatic authority", "the flow requires unavailable native integration"]
  },
  {
    id: "correction_memory_loop",
    title: "Correction, replay, and approved profile memory",
    command: "npm run smoke:plugin-approve-save-profile",
    expectedEvidence: ".transparent-apprentice approved profile memory artifacts",
    manualAction: "Teach one tiny rule, correct an intentionally wrong result, approve the corrected behavior, save profile memory, and rerun.",
    passCriteria: [
      "correction changes a disabled rule draft before approval",
      "saved memory records provenance",
      "future run uses approved memory without exposing private chain-of-thought"
    ],
    stopConditions: ["correction writes long-term memory without approval", "profile review cannot explain what was learned"]
  },
  {
    id: "tlcl_direction_and_runtime_safety",
    title: "TLCL direction, runtime gate, and reasoning budget",
    command: "npm run smoke:plugin-tlcl-direction-operational-console",
    expectedEvidence: ".ta-smoke/tlcl-direction-operational-console",
    manualAction: "Review the TLCL direction console and confirm the next route is a safe manual review route rather than execution.",
    passCriteria: [
      "route choices remain launcher, RAG evidence, high-reasoning repair, or reasoning-budget review",
      "runtime gate and reasoning budget keep medium runtime reuse separate from high-reasoning repair",
      "RAG evidence remains non-authoritative"
    ],
    stopConditions: ["console runs a downstream tool automatically", "route claims acceptance, packaging unlock, or completion"]
  },
  {
    id: "real_case_pilot",
    title: "Real-case packaging/CAD pilot intake",
    command: "npm run smoke:plugin-real-case-pilot-intake",
    expectedEvidence: ".ta-smoke/real-case-pilot-intake",
    manualAction: "Provide one packaging/CAD/engineering artifact plus strict logic constraints and confirm the plugin routes it into existing TLCL review gates.",
    passCriteria: [
      "pilot intake recommends only review-only TLCL/detail-logic routes",
      "missing evidence blocks rather than guessing",
      "execute-now decisions fail closed"
    ],
    stopConditions: ["the pilot runs target software directly", "the pilot skips teacher receipt gates"]
  }
];

const scenarioRows = scenarios.map((scenario) => ({
  ...scenario,
  packageScriptPresent: packageScripts[scenario.command.replace(/^npm run /, "")] === undefined ? false : true
}));

const requiredMcpTools = [
  "teach_apprentice",
  "show_teaching_card",
  "correct_last_result",
  "create_plugin_health_index",
  "create_tlcl_direction_operational_console",
  "create_tlcl_runtime_gate",
  "create_tlcl_reasoning_budget_governor",
  "create_tlcl_rag_evidence_attachment",
  "create_real_case_pilot_intake"
];
const missingTools = requiredMcpTools.filter((tool) => !mcpToolNames.includes(tool));
const missingScenarioCommands = scenarioRows
  .filter((scenario) => !scenario.packageScriptPresent)
  .map((scenario) => scenario.command);
const commandSequence = [
  ...new Set([
    "npm run smoke:plugin-health-index",
    "npm run smoke:plugin-tool-surface",
    ...scenarioRows.map((scenario) => scenario.command)
  ])
];

const checks = [
  {
    name: "Manual test scenarios map to package smoke commands",
    pass: missingScenarioCommands.length === 0,
    evidence: missingScenarioCommands.join(",") || "none"
  },
  {
    name: "Manual test pack covers teacher, visual, correction, TLCL, and real-case lanes",
    pass:
      scenarioRows.some((scenario) => scenario.id === "first_teacher_entry") &&
      scenarioRows.some((scenario) => scenario.id === "visual_demonstration") &&
      scenarioRows.some((scenario) => scenario.id === "correction_memory_loop") &&
      scenarioRows.some((scenario) => scenario.id === "tlcl_direction_and_runtime_safety") &&
      scenarioRows.some((scenario) => scenario.id === "real_case_pilot"),
    evidence: scenarioRows.map((scenario) => scenario.id).join(",")
  },
  {
    name: "MCP tools needed for the manual test lanes exist",
    pass: missingTools.length === 0,
    evidence: missingTools.join(",") || "none"
  },
  {
    name: "Documentation still states review-only and no acceptance boundaries",
    pass:
      readmeText.includes("review-only") &&
      (readmeText.includes("does not invoke models") || readmeText.includes("do not invoke models")) &&
      skillText.includes("Do not treat a conversation record as acceptance"),
    evidence: "README and skill keep review-only language"
  }
];

const passed = checks.filter((check) => check.pass).length;
const status = passed === checks.length ? "ready_for_human_manual_testing" : "needs_manual_test_readiness_follow_up";
const packPath = join(outputRoot, "manual-test-readiness-pack.json");
const markdownPath = join(outputRoot, "MANUAL_TEST_READINESS_START_HERE.md");
const htmlPath = join(outputRoot, "manual-test-readiness.html");

const pack = {
  responseMode: "transparent_ai_apprentice_manual_test_readiness_pack_v1",
  status,
  generatedAt: new Date().toISOString(),
  goal,
  plugin: {
    name: manifest.name,
    version: manifest.version,
    displayName: manifest.interface?.displayName || "",
    source: rel(pluginRoot)
  },
  safetyBoundary: {
    reviewOnly: true,
    invokesModels: false,
    executesTargetSoftware: false,
    writesMemory: false,
    enablesRules: false,
    unlocksPackaging: false,
    claimsProductAcceptance: false,
    claimsCompletion: false
  },
  manualTestStatus: {
    readyForHumanTesting: status === "ready_for_human_manual_testing",
    productAcceptanceClaimed: false,
    recommendedNextPhase: "human_exploratory_and_scenario_testing",
    notYetReadyFor: ["production release", "technology acceptance", "packaging unlock", "unsupervised execution"]
  },
  scenarios: scenarioRows,
  commandSequence,
  requiredMcpTools: requiredMcpTools.map((name) => ({ name, present: mcpToolNames.includes(name) })),
  checks,
  nextAction:
    status === "ready_for_human_manual_testing"
      ? "Run the command sequence, then perform the manual actions scenario by scenario and record blockers before any product acceptance claim."
      : "Fix missing command/tool/documentation checks before starting a formal manual test pass."
};

const markdown = [
  "# Manual Test Readiness",
  "",
  `Generated: ${pack.generatedAt}`,
  `Status: ${pack.status}`,
  `Plugin: ${pack.plugin.name} ${pack.plugin.version}`,
  "",
  "## Boundary",
  "",
  "- Ready for human scenario testing: true",
  "- Product acceptance claimed: false",
  "- Executes target software: false",
  "- Writes memory: false",
  "- Enables rules: false",
  "- Unlocks packaging: false",
  "",
  "## Command Sequence",
  "",
  ...pack.commandSequence.map((command) => `- \`${command}\``),
  "",
  "## Scenarios",
  "",
  ...pack.scenarios.flatMap((scenario) => [
    `### ${scenario.title}`,
    "",
    `- Command: \`${scenario.command}\``,
    `- Evidence: \`${scenario.expectedEvidence}\``,
    `- Manual action: ${scenario.manualAction}`,
    `- Pass criteria: ${scenario.passCriteria.join("; ")}`,
    `- Stop conditions: ${scenario.stopConditions.join("; ")}`,
    ""
  ]),
  "## Checks",
  "",
  ...checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}: ${check.evidence}`),
  "",
  "## Next Action",
  "",
  pack.nextAction,
  ""
].join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Transparent AI Apprentice Manual Test Readiness</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #17202a; line-height: 1.45; }
    h1, h2 { margin-bottom: 8px; }
    code { background: #f3f5f7; padding: 2px 5px; border-radius: 4px; }
    .status { display: inline-block; padding: 4px 8px; border: 1px solid #1f7a4d; color: #1f7a4d; border-radius: 4px; }
    .scenario { border-top: 1px solid #d8dee4; padding: 16px 0; }
    .boundary { background: #f8fafc; padding: 12px 14px; border-left: 4px solid #5b6b7a; }
  </style>
</head>
<body>
  <h1>Manual Test Readiness</h1>
  <p><span class="status">${htmlEscape(pack.status)}</span></p>
  <p>${htmlEscape(pack.plugin.name)} ${htmlEscape(pack.plugin.version)}</p>
  <div class="boundary">
    <strong>Boundary:</strong> human testing is ready; product acceptance, packaging unlock, memory write, rule enablement, and target software execution are not claimed.
  </div>
  <h2>Command Sequence</h2>
  <ol>${pack.commandSequence.map((command) => `<li><code>${htmlEscape(command)}</code></li>`).join("")}</ol>
  <h2>Scenarios</h2>
  ${pack.scenarios
    .map(
      (scenario) => `<section class="scenario">
        <h3>${htmlEscape(scenario.title)}</h3>
        <p><strong>Command:</strong> <code>${htmlEscape(scenario.command)}</code></p>
        <p><strong>Evidence:</strong> <code>${htmlEscape(scenario.expectedEvidence)}</code></p>
        <p><strong>Manual action:</strong> ${htmlEscape(scenario.manualAction)}</p>
        <p><strong>Pass criteria:</strong> ${htmlEscape(scenario.passCriteria.join("; "))}</p>
        <p><strong>Stop conditions:</strong> ${htmlEscape(scenario.stopConditions.join("; "))}</p>
      </section>`
    )
    .join("")}
</body>
</html>
`;

writeJson(packPath, pack);
writeText(markdownPath, markdown);
writeText(htmlPath, html);

console.log(
  JSON.stringify(
    {
      responseMode: "transparent_ai_apprentice_manual_test_readiness_pack_result_v1",
      status,
      generatedAt: pack.generatedAt,
      packPath,
      markdownPath,
      htmlPath,
      passed,
      total: checks.length,
      scenarioCount: pack.scenarios.length,
      nextAction: pack.nextAction
    },
    null,
    2
  )
);

if (status !== "ready_for_human_manual_testing") {
  process.exit(1);
}
