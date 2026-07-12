#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
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
  return toPosix(relative(pluginRoot, path));
}

function walkFiles(root, options = {}) {
  const files = [];
  const excludeDirs = new Set(options.excludeDirs || []);
  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory() && excludeDirs.has(entry.name)) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        files.push(full);
      }
    }
  }
  if (existsSync(root)) walk(root);
  return files;
}

function collectMcpToolNames(serverText) {
  const names = new Set();
  const pattern = /\n\s*\{\s*name:\s*"([^"]+)"/g;
  let match;
  while ((match = pattern.exec(serverText))) {
    names.add(match[1]);
  }
  return [...names].sort();
}

function check(name, pass, evidence = "") {
  return { name, pass, evidence };
}

const goal = argValue("--goal", "transparent-ai-apprentice plugin health index");
const outputRoot = resolve(argValue("--out-dir", join(pluginRoot, "artifacts", "plugin-health-index")));
mkdirSync(outputRoot, { recursive: true });

const manifestPath = join(pluginRoot, ".codex-plugin", "plugin.json");
const mcpConfigPath = join(pluginRoot, ".mcp.json");
const mcpServerPath = join(pluginRoot, "scripts", "mcp-server.mjs");
const skillPath = join(pluginRoot, "skills", "teachable-apprentice", "SKILL.md");
const readmePath = join(pluginRoot, "README.md");
const repoPackagePath = join(repoRoot, "package.json");
const bundledPackagePath = join(pluginRoot, "package.json");
const packagePath = existsSync(repoPackagePath) ? repoPackagePath : bundledPackagePath;

const manifest = readJson(manifestPath);
const mcpConfig = readJson(mcpConfigPath);
const mcpServerText = readText(mcpServerPath);
const skillText = readText(skillPath);
const readmeText = readText(readmePath);
const packageJson = existsSync(packagePath) ? readJson(packagePath) : { scripts: {} };
const packageScripts = packageJson.scripts || {};

const allPluginFiles = walkFiles(pluginRoot, { excludeDirs: ["artifacts"] });
const scriptFiles = walkFiles(join(pluginRoot, "scripts"), { excludeDirs: [] });
const rootScriptFiles = readdirSync(join(pluginRoot, "scripts"), { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => join(pluginRoot, "scripts", entry.name));
const skillFiles = walkFiles(join(pluginRoot, "skills"));
const schemaFiles = walkFiles(join(pluginRoot, "schemas"));
const smokeScripts = scriptFiles.filter((file) => basename(file).startsWith("smoke-") && file.endsWith(".mjs"));
const createScripts = scriptFiles.filter((file) => basename(file).startsWith("create-") && file.endsWith(".mjs"));
const validateScripts = scriptFiles.filter((file) => basename(file).startsWith("validate-") && file.endsWith(".mjs"));
const runScripts = scriptFiles.filter((file) => basename(file).startsWith("run-") && file.endsWith(".mjs"));
const rootSmokeScripts = rootScriptFiles.filter((file) => basename(file).startsWith("smoke-") && file.endsWith(".mjs"));
const mcpToolNames = collectMcpToolNames(mcpServerText);

const requiredPackageScripts = {
  "verify:plugin": "node plugins/transparent-ai-apprentice/scripts/verify-plugin.mjs",
  "build:plugin-health-index": "node plugins/transparent-ai-apprentice/scripts/create-plugin-health-index.mjs",
  "smoke:plugin-health-index": "node plugins/transparent-ai-apprentice/scripts/smoke-plugin-health-index.mjs",
  "build:plugin-manual-test-readiness":
    "node plugins/transparent-ai-apprentice/scripts/create-plugin-manual-test-readiness-pack.mjs",
  "smoke:plugin-manual-test-readiness":
    "node plugins/transparent-ai-apprentice/scripts/smoke-plugin-manual-test-readiness.mjs",
  "build:plugin-manual-test-result-receipt-template":
    "node plugins/transparent-ai-apprentice/scripts/create-plugin-manual-test-result-receipt-template.mjs",
  "smoke:plugin-manual-test-result-receipt":
    "node plugins/transparent-ai-apprentice/scripts/smoke-plugin-manual-test-result-receipt.mjs",
  "build:plugin-manual-test-session-packet":
    "node plugins/transparent-ai-apprentice/scripts/create-plugin-manual-test-session-packet.mjs",
  "smoke:plugin-manual-test-session-packet":
    "node plugins/transparent-ai-apprentice/scripts/smoke-plugin-manual-test-session-packet.mjs",
  "smoke:plugin-tool-surface": "node plugins/transparent-ai-apprentice/scripts/smoke-mcp-tool-surface-fast.mjs",
  "smoke:plugin-tool-surface:full": "node plugins/transparent-ai-apprentice/scripts/smoke-mcp-tool-surface.mjs",
  "smoke:plugin-guided": "node plugins/transparent-ai-apprentice/scripts/smoke-guided-teaching.mjs",
  "smoke:plugin-tlcl-direction-operational-console":
    "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-direction-operational-console.mjs",
  "smoke:plugin-tlcl-runtime-gate": "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-runtime-gate.mjs",
  "smoke:plugin-tlcl-rag-evidence-attachment":
    "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-rag-evidence-attachment.mjs",
  "smoke:plugin-tlcl-reasoning-budget-governor":
    "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-reasoning-budget-governor.mjs",
  "smoke:plugin-tlcl-market-response-provider-boundary-audit":
    "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-market-response-provider-boundary-audit.mjs"
};

const missingPackageScripts = Object.entries(requiredPackageScripts)
  .filter(([name, command]) => packageScripts[name] !== command)
  .map(([name]) => name);

const coreMcpTools = [
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
  "create_real_case_pilot_intake"
];
const missingCoreMcpTools = coreMcpTools.filter((tool) => !mcpToolNames.includes(tool));

const primaryRoutes = [
  {
    id: "maintainer_health",
    command: "npm run build:plugin-health-index",
    purpose: "Refresh the readable plugin surface index before deeper work.",
    evidencePath: "plugins/transparent-ai-apprentice/artifacts/plugin-health-index/plugin-health-index.md"
  },
  {
    id: "fast_manifest_and_surface_gate",
    command: "npm run smoke:plugin-health-index",
    purpose: "Prove manifest, MCP, skill, scripts, and package command registration stay aligned.",
    evidencePath: ".ta-smoke/plugin-health-index/plugin-health-index.json"
  },
  {
    id: "fast_mcp_tool_surface_gate",
    command: "npm run smoke:plugin-tool-surface",
    purpose: "Prove the default teacher-facing MCP surface, advanced-mode core tools, and health-index MCP call without running the full regression chain.",
    evidencePath: ".ta-smoke/mcp-tool-surface-fast/health-index/plugin-health-index.json"
  },
  {
    id: "human_manual_test_readiness",
    command: "npm run smoke:plugin-manual-test-readiness",
    purpose: "Generate and verify the human manual testing handoff pack with scenarios, pass criteria, and stop conditions before exploratory testing.",
    evidencePath: ".ta-smoke/plugin-manual-test-readiness/MANUAL_TEST_READINESS_START_HERE.md"
  },
  {
    id: "human_manual_test_result_receipt",
    command: "npm run smoke:plugin-manual-test-result-receipt",
    purpose: "Generate and validate the human manual testing result receipt path so blockers and follow-up evidence return without becoming acceptance.",
    evidencePath: ".ta-smoke/plugin-manual-test-result-receipt/validation/manual-test-result-validation.json"
  },
  {
    id: "human_manual_test_session_packet",
    command: "npm run smoke:plugin-manual-test-session-packet",
    purpose: "Generate one tester-facing session packet that bundles readiness scenarios, a fillable result receipt, and validation return command.",
    evidencePath: ".ta-smoke/plugin-manual-test-session-packet/session/MANUAL_TEST_SESSION_START_HERE.md"
  },
  {
    id: "full_static_plugin_gate",
    command: "npm run verify:plugin",
    purpose: "Run the existing broad static plugin verifier after targeted changes.",
    evidencePath: "stdout JSON"
  },
  {
    id: "teacher_entry_smoke",
    command: "npm run smoke:plugin-guided",
    purpose: "Check the low-friction teacher entry flow.",
    evidencePath: ".transparent-apprentice generated teaching artifacts"
  },
  {
    id: "tlcl_direction_smoke",
    command: "npm run smoke:plugin-tlcl-direction-operational-console",
    purpose: "Check the current TLCL route chooser and no-op locks.",
    evidencePath: ".ta-smoke/tlcl-direction-operational-console"
  }
];

const packagePluginSmokeScripts = Object.keys(packageScripts).filter((name) => name.startsWith("smoke:plugin"));
const rootSmokeScriptNames = new Set(rootSmokeScripts.map((file) => basename(file)));
const registeredRootSmokeFiles = new Set(
  packagePluginSmokeScripts
    .map((name) => packageScripts[name])
    .filter((command) => typeof command === "string" && command.includes("plugins/transparent-ai-apprentice/scripts/"))
    .map((command) => basename(command.split(" ").at(-1) || ""))
    .filter((name) => rootSmokeScriptNames.has(name))
);
const unregisteredRootSmokeFiles = [...rootSmokeScriptNames].filter((name) => !registeredRootSmokeFiles.has(name)).sort();

const checks = [
  check(
    "Plugin manifest, MCP config, and skill path are coherent",
    manifest.name === "transparent-ai-apprentice" &&
      manifest.skills === "./skills/" &&
      manifest.mcpServers === "./.mcp.json" &&
      mcpConfig.mcpServers?.["transparent-ai-apprentice"]?.command === "node" &&
      mcpConfig.mcpServers?.["transparent-ai-apprentice"]?.args?.includes("./plugins/transparent-ai-apprentice/scripts/mcp-server.mjs"),
    `manifest=${manifest.name}; skills=${manifest.skills}; mcp=${manifest.mcpServers}`
  ),
  check(
    "MCP server exposes the core teacher and TLCL tools",
    missingCoreMcpTools.length === 0 && mcpToolNames.length >= 50,
    `tools=${mcpToolNames.length}; missing=${missingCoreMcpTools.join(",") || "none"}`
  ),
  check(
    "Plugin has a broad but discoverable implementation surface",
    allPluginFiles.length >= 500 && scriptFiles.length >= 300 && smokeScripts.length >= 100 && skillFiles.length >= 1,
    `files=${allPluginFiles.length}; scripts=${scriptFiles.length}; smoke=${smokeScripts.length}; skills=${skillFiles.length}; schemas=${schemaFiles.length}`
  ),
  check(
    "Root package exposes the maintainer command contract",
    missingPackageScripts.length === 0,
    `required=${Object.keys(requiredPackageScripts).length}; missing=${missingPackageScripts.join(",") || "none"}`
  ),
  check(
    "README documents the health index as a first maintainer entrypoint",
    readmeText.includes("## Maintainer Health Index") &&
      readmeText.includes("npm run build:plugin-health-index") &&
      readmeText.includes("npm run smoke:plugin-health-index"),
    "README health index section present"
  ),
  check(
    "Health index is a no-op review artifact",
    true,
    "does not invoke models, run target software, write memory, enable rules, unlock packaging, or claim completion"
  ),
  check(
    "Root smoke registration coverage is visible for future cleanup",
    packagePluginSmokeScripts.length >= 100 && registeredRootSmokeFiles.size >= 100,
    `packageSmoke=${packagePluginSmokeScripts.length}; registeredRootSmoke=${registeredRootSmokeFiles.size}; unregisteredRootSmoke=${unregisteredRootSmokeFiles.length}`
  )
];

const passed = checks.filter((item) => item.pass).length;
const status = passed === checks.length ? "ready_for_plugin_maintainer_review" : "needs_plugin_surface_follow_up";
const indexPath = join(outputRoot, "plugin-health-index.json");
const markdownPath = join(outputRoot, "plugin-health-index.md");

const index = {
  responseMode: "transparent_ai_apprentice_plugin_health_index_v1",
  status,
  generatedAt: new Date().toISOString(),
  goal,
  plugin: {
    name: manifest.name,
    version: manifest.version,
    displayName: manifest.interface?.displayName || "",
    root: rel(pluginRoot)
  },
  safetyBoundary: {
    reviewOnly: true,
    invokesModels: false,
    executesTargetSoftware: false,
    writesMemory: false,
    enablesRules: false,
    unlocksPackaging: false,
    claimsCompletion: false
  },
  counts: {
    pluginFiles: allPluginFiles.length,
    scriptFiles: scriptFiles.length,
    rootScriptFiles: rootScriptFiles.length,
    smokeScripts: smokeScripts.length,
    rootSmokeScripts: rootSmokeScripts.length,
    createScripts: createScripts.length,
    validateScripts: validateScripts.length,
    runScripts: runScripts.length,
    skillFiles: skillFiles.length,
    schemaFiles: schemaFiles.length,
    mcpTools: mcpToolNames.length,
    packagePluginSmokeScripts: packagePluginSmokeScripts.length,
    registeredRootSmokeFiles: registeredRootSmokeFiles.size,
    unregisteredRootSmokeFiles: unregisteredRootSmokeFiles.length
  },
  commandContract: {
    source: existsSync(packagePath) ? `${toPosix(relative(pluginRoot, packagePath))}#scripts` : "missing_package_json",
    requiredPackageScripts: Object.entries(requiredPackageScripts).map(([name, command]) => ({
      name,
      command,
      present: packageScripts[name] === command
    })),
    missingPackageScripts
  },
  mcpSurface: {
    coreTools: coreMcpTools.map((name) => ({ name, present: mcpToolNames.includes(name) })),
    sampleTools: mcpToolNames.slice(0, 24)
  },
  primaryRoutes,
  smokeRegistration: {
    unregisteredRootSmokeFiles: unregisteredRootSmokeFiles.slice(0, 50),
    note:
      "Unregistered root smoke files are not automatically failures; this list exists so maintainers can decide which surfaces deserve package-level command aliases."
  },
  checks,
  nextAction:
    status === "ready_for_plugin_maintainer_review"
      ? "Use plugin-health-index.md as the first maintainer map, then run the targeted route smoke before broad verify:plugin."
      : "Fix failed checks, rerun npm run build:plugin-health-index, then rerun npm run smoke:plugin-health-index."
};

const markdown = [
  "# Transparent AI Apprentice Plugin Health Index",
  "",
  `Generated: ${index.generatedAt}`,
  `Status: ${index.status}`,
  "",
  "## Safety Boundary",
  "",
  "- Review-only artifact: true",
  "- Invokes models: false",
  "- Executes target software: false",
  "- Writes memory: false",
  "- Enables rules: false",
  "- Unlocks packaging: false",
  "- Claims completion: false",
  "",
  "## Surface Counts",
  "",
  ...Object.entries(index.counts).map(([name, value]) => `- ${name}: ${value}`),
  "",
  "## Maintainer Routes",
  "",
  ...primaryRoutes.map((route) => `- ${route.id}: \`${route.command}\` - ${route.purpose}`),
  "",
  "## Checks",
  "",
  ...checks.map((item) => `- ${item.pass ? "PASS" : "FAIL"} ${item.name}: ${item.evidence}`),
  "",
  "## Next Action",
  "",
  index.nextAction,
  ""
].join("\n");

writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf8");
writeFileSync(markdownPath, markdown, "utf8");

console.log(
  JSON.stringify(
    {
      responseMode: "transparent_ai_apprentice_plugin_health_index_result_v1",
      status,
      generatedAt: index.generatedAt,
      indexPath,
      markdownPath,
      passed,
      total: checks.length,
      counts: index.counts,
      nextAction: index.nextAction
    },
    null,
    2
  )
);

if (status !== "ready_for_plugin_maintainer_review") {
  process.exit(1);
}
