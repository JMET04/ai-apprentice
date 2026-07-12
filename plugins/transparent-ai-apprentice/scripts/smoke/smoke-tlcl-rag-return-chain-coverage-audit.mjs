#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const scriptsRoot = join(pluginRoot, "scripts");

function read(path) {
  return readFileSync(path, "utf8");
}

function readPlugin(relativePath) {
  return read(join(pluginRoot, relativePath));
}

function hasAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

function hyphenToSnake(value) {
  return value.replaceAll("-", "_");
}

const surfaces = {
  rootReadme: read(join(repoRoot, "README.md")),
  pluginReadme: readPlugin("README.md"),
  packageJson: read(join(repoRoot, "package.json")),
  mcpServer: readPlugin("scripts/mcp-server.mjs"),
  mcpToolSurfaceSmoke: readPlugin("scripts/smoke-mcp-tool-surface.mjs"),
  verifyPlugin: readPlugin("scripts/verify-plugin.mjs"),
  goalCoverage: readPlugin("scripts/smoke-goal-coverage.mjs")
};

const createFiles = readdirSync(scriptsRoot)
  .filter((name) =>
    name.startsWith("create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-") &&
    name.endsWith("-builder.mjs")
  )
  .sort();

const gates = createFiles.map((createFile) => {
  const createStem = basename(createFile, ".mjs");
  const validateStem = createStem.replace(/^create-/, "validate-").replace(/-builder$/, "");
  const smokeStem = createStem.replace(/^create-/, "smoke-").replace(/-builder$/, "");
  const createPath = join(scriptsRoot, createFile);
  const validateFile = `${validateStem}.mjs`;
  const smokeFile = `${smokeStem}.mjs`;
  const validatePath = join(scriptsRoot, validateFile);
  const smokePath = join(scriptsRoot, smokeFile);
  const createTool = hyphenToSnake(createStem);
  const validateTool = hyphenToSnake(validateStem);
  const smokeScript = `smoke:plugin-${smokeStem.replace(/^smoke-/, "")}`;
  return {
    id: createStem
      .replace(/^create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-/, "")
      .replace(/-builder$/, ""),
    createFile,
    validateFile,
    smokeFile,
    createStem,
    validateStem,
    smokeStem,
    createPath,
    validatePath,
    smokePath,
    createTool,
    validateTool,
    smokeScript
  };
});

const gateResults = gates.map((gate) => {
  const builderExists = existsSync(gate.createPath);
  const validatorExists = existsSync(gate.validatePath);
  const smokeExists = existsSync(gate.smokePath);
  const builderText = builderExists ? read(gate.createPath) : "";
  const validatorText = validatorExists ? read(gate.validatePath) : "";
  const smokeText = smokeExists ? read(gate.smokePath) : "";
  const pass =
    builderExists &&
    validatorExists &&
    smokeExists &&
    hasAll(builderText, ["goalComplete: false", "accepted: false", "ruleEnabled: false"]) &&
    hasAll(validatorText, [
      "goalComplete: false",
      "accepted: false",
      "ruleEnabled: false",
      "high_reasoning_logic_contract_repair"
    ]) &&
    smokeText.includes("blocks forbidden") &&
    hasAll(surfaces.mcpServer, [gate.createTool, gate.createFile, gate.validateTool, gate.validateFile]) &&
    hasAll(surfaces.mcpToolSurfaceSmoke, [gate.createTool, gate.validateTool]) &&
    surfaces.packageJson.includes(gate.smokeScript) &&
    hasAll(surfaces.verifyPlugin, [gate.createFile, gate.validateFile, gate.smokeFile]) &&
    hasAll(surfaces.goalCoverage, [gate.createTool, gate.validateTool, gate.smokeScript]) &&
    hasAll(surfaces.pluginReadme, [gate.createStem, gate.validateStem]) &&
    (surfaces.rootReadme.includes(gate.createFile) ||
      surfaces.rootReadme.includes("Current TLCL RAG return-chain coverage audit") ||
      surfaces.rootReadme.includes("Artifact Envelope -> Rule Card -> Rule DSL / Rule Package -> Validator Registry"));

  const missing = [];
  if (!builderExists) missing.push("builder_file");
  if (!validatorExists) missing.push("validator_file");
  if (!smokeExists) missing.push("smoke_file");
  if (!hasAll(builderText, ["goalComplete: false", "accepted: false", "ruleEnabled: false"])) {
    missing.push("builder_noop_locks");
  }
  if (
    !hasAll(validatorText, [
      "goalComplete: false",
      "accepted: false",
      "ruleEnabled: false",
      "high_reasoning_logic_contract_repair"
    ])
  ) {
    missing.push("validator_noop_or_repair_locks");
  }
  if (!smokeText.includes("blocks forbidden")) missing.push("forbidden_smoke_case");
  if (!hasAll(surfaces.mcpServer, [gate.createTool, gate.createFile, gate.validateTool, gate.validateFile])) {
    missing.push("mcp_server_surface");
  }
  if (!hasAll(surfaces.mcpToolSurfaceSmoke, [gate.createTool, gate.validateTool])) {
    missing.push("mcp_tool_surface_smoke");
  }
  if (!surfaces.packageJson.includes(gate.smokeScript)) missing.push("package_script");
  if (!hasAll(surfaces.verifyPlugin, [gate.createFile, gate.validateFile, gate.smokeFile])) {
    missing.push("verify_plugin_coverage");
  }
  if (!hasAll(surfaces.goalCoverage, [gate.createTool, gate.validateTool, gate.smokeScript])) {
    missing.push("goal_coverage");
  }
  if (!hasAll(surfaces.pluginReadme, [gate.createStem, gate.validateStem])) missing.push("plugin_readme");
  if (
    !surfaces.rootReadme.includes(gate.createFile) &&
    !surfaces.rootReadme.includes("Current TLCL RAG return-chain coverage audit") &&
    !surfaces.rootReadme.includes("Artifact Envelope -> Rule Card -> Rule DSL / Rule Package -> Validator Registry")
  ) {
    missing.push("root_readme_context");
  }

  return {
    id: gate.id,
    pass,
    missing,
    files: {
      builder: relative(pluginRoot, gate.createPath).replaceAll("\\", "/"),
      validator: relative(pluginRoot, gate.validatePath).replaceAll("\\", "/"),
      smoke: relative(pluginRoot, gate.smokePath).replaceAll("\\", "/")
    },
    tools: {
      builder: gate.createTool,
      validator: gate.validateTool
    },
    smokeScript: gate.smokeScript
  };
});

const missingGates = gateResults.filter((gate) => !gate.pass);
const result = {
  ok: gates.length > 0 && missingGates.length === 0,
  smoke: "transparent_ai_tlcl_rag_return_chain_coverage_audit_smoke_v1",
  gateCount: gates.length,
  coveredGateIds: gateResults.filter((gate) => gate.pass).map((gate) => gate.id),
  missingGateIds: missingGates.map((gate) => gate.id),
  gates: gateResults,
  auditedSurfaces: [
    "README.md",
    "plugins/transparent-ai-apprentice/README.md",
    "package.json",
    "plugins/transparent-ai-apprentice/scripts/mcp-server.mjs",
    "plugins/transparent-ai-apprentice/scripts/smoke-mcp-tool-surface.mjs",
    "plugins/transparent-ai-apprentice/scripts/verify-plugin.mjs",
    "plugins/transparent-ai-apprentice/scripts/smoke-goal-coverage.mjs"
  ],
  locks: {
    reviewOnly: true,
    evidenceOnly: true,
    staticAuditOnly: true,
    externalFetchPerformed: false,
    modelInvoked: false,
    ragFetched: false,
    softwareActionsExecuted: false,
    memoryWritten: false,
    ruleEnabled: false,
    accepted: false,
    packagingUnlocked: false,
    goalComplete: false
  }
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) {
  console.error(
    JSON.stringify(
      {
        error: "TLCL_RAG_RETURN_CHAIN_COVERAGE_AUDIT_FAILED",
        missingGateIds: result.missingGateIds,
        missingGates
      },
      null,
      2
    )
  );
  process.exit(1);
}
