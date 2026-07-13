#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { semanticPreflight, runOfflineCompile } from "./aicad-handoff-adapter.mjs";

const pluginRoot = resolve(
  import.meta.dirname,
  "..",
  "integrations",
  "aicad-agent-v1",
  "plugin",
  "aicad-agent"
);
const fixturePath = resolve(
  import.meta.dirname,
  "..",
  "integrations",
  "aicad-agent-v1",
  "contracts",
  "examples",
  "packaging-request.json"
);
const temp = mkdtempSync(join(tmpdir(), "ai-apprentice-aicad-adapter-"));
const request = JSON.parse(readFileSync(fixturePath, "utf8"));
const requestPath = join(temp, "request.json");
writeFileSync(requestPath, JSON.stringify(request, null, 2), "utf8");

const preflight = semanticPreflight(request);
assert.equal(preflight.ok, true);
assert.equal(preflight.locks.packagingGated, true);

const planPath = join(pluginRoot, "runtime", "examples", "rectangle.plan.json");
const result = runOfflineCompile({ requestPath, planPath, outputDir: join(temp, "output"), pluginRoot });
assert.equal(result.format, "transparent_ai_apprentice_aicad_result_v1");
assert.equal(result.provenance.version, "1.2.0");
assert.equal(result.provenance.imagePixelsUsedAsDimensions, false);
assert.equal(result.status, "pass_with_host_skips");
assert.equal(result.hostExecutions.every((item) => item.executedThisRun === false), true);

const tampered = structuredClone(request);
tampered.engineeringTruth.imagePixelsUsedAsDimensions = true;
assert.throws(() => semanticPreflight(tampered), /PIXEL_DIMENSION_FORBIDDEN/);

console.log(JSON.stringify({
  ok: true,
  checks: 10,
  pluginRoot,
  outputDir: join(temp, "output"),
  locks: result.safety
}, null, 2));
