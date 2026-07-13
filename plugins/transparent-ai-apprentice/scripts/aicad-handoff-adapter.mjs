#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const locks = { reviewOnly: true, accepted: false, ruleEnabled: false, packagingGated: true, productionApprovalClaimed: false };
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const fail = message => { throw new Error(message); };

export function semanticPreflight(request) {
  if (request?.format !== "transparent_ai_apprentice_aicad_request_v1") fail("unsupported request format");
  for (const [key, value] of Object.entries(locks)) if (request?.safety?.[key] !== value) fail(`unsafe lock: ${key}`);
  if (request?.engineeringTruth?.imagePixelsUsedAsDimensions !== false) fail("PIXEL_DIMENSION_FORBIDDEN");
  if (request?.evidence?.image2Sample?.role !== "visual_topology_only" || request?.evidence?.image2Sample?.pixelMeasurementsAllowed !== false) fail("IMAGE2_ROLE_INVALID");
  for (const dimension of request?.product?.dimensions ?? []) if (!['teacher_explicit','approved_engineering','trusted_catalog','calculated'].includes(dimension.authority)) fail("UNTRUSTED_DIMENSION_AUTHORITY");
  for (const patch of request?.localModifications ?? []) if (patch.requiredGlobalRevalidation !== true) fail("GLOBAL_REVALIDATION_REQUIRED");
  return { ok: true, locks };
}

export function runOfflineCompile({ requestPath, planPath, outputDir, pluginRoot }) {
  const bytes = fs.readFileSync(requestPath);
  const request = JSON.parse(bytes.toString("utf8"));
  semanticPreflight(request);
  const args = ["-B", path.join(pluginRoot, "scripts", "aicad_agent.py"), "compile", "--plan", planPath, "--out", outputDir, "--name", "ai-apprentice-handoff"];
  const proc = spawnSync("python", args, {
    encoding: "utf8",
    windowsHide: true,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" }
  });
  if (proc.status !== 0) fail(proc.stderr || proc.stdout || "AICAD compile failed");
  return { format: "transparent_ai_apprentice_aicad_result_v1", handoffId: request.handoffId, requestSha256: sha(bytes), status: "pass_with_host_skips",
    provenance: { producer: "aicad-agent", version: "1.2.0", imagePixelsUsedAsDimensions: false },
    artifacts: [], validation: { aicadDeterministicValidation: { status: "passed", raw: JSON.parse(proc.stdout) }, mainRuleDslValidation: { status: "not_run", note: "coarse compatibility layer" } },
    hostExecutions: [{ host: "autocad", executedThisRun: false, mode: "offline_compile", status: "skipped", saveReopenStatus: "not_run" }, { host: "solidworks", executedThisRun: false, mode: "not_run", status: "skipped", saveReopenStatus: "not_run" }],
    errors: [], preventionRuleDrafts: [], safety: locks };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const get = flag => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : null; };
  const requestPath = get("--request");
  if (!requestPath) fail("--request is required");
  const request = JSON.parse(fs.readFileSync(requestPath, "utf8"));
  const result = semanticPreflight(request);
  process.stdout.write(JSON.stringify(result) + "\n");
}
