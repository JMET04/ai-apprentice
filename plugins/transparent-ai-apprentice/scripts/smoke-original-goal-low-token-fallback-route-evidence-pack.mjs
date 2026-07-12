#!/usr/bin/env node
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function run(args) {
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`command failed\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

const root = mkdtempSync(join(tmpdir(), "ta-low-token-fallback-route-"));
const planPath = join(root, "plan.json");
const outDir = join(root, "out");

writeJson(planPath, {
  ok: true,
  format: "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_v1",
  planId: "smoke-plan",
  sourceEvidence: {
    cockpit: "cockpit.json",
    sourceDossier: "dossier.json"
  },
  actionRows: [
    {
      rowId: "low-token-waiting-001",
      ledgerNumber: 1,
      software: "微信",
      processName: "WeChat.exe",
      blockers: ["log_source_route_not_found_in_ledger"]
    },
    {
      rowId: "low-token-waiting-002",
      ledgerNumber: 2,
      software: "Microsoft ASP.NET Core 7.0.14 Shared Framework (x86)",
      processName: "",
      blockers: ["log_source_route_not_found_in_ledger"]
    }
  ]
});

const result = run([
  "plugins/transparent-ai-apprentice/scripts/create-original-goal-low-token-fallback-route-evidence-pack.mjs",
  "--plan",
  planPath,
  "--output-dir",
  outDir
]);
const pack = JSON.parse(readFileSync(result.packPath, "utf8"));

const checks = [
  {
    name: "Pack is created for blocked waiting rows",
    pass:
      result.format === "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_result_v1" &&
      pack.format === "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_v1" &&
      pack.counts.rows === 2 &&
      pack.counts.candidateRoutes >= 8
  },
  {
    name: "Privacy-sensitive app gets teacher-marker boundary",
    pass:
      pack.rows
        .find((row) => row.software === "微信")
        ?.candidateRoutes.some((route) => route.routeId === "privacy_sensitive_chat_state_metadata") === true
  },
  {
    name: "Runtime framework is routed as dependency metadata",
    pass:
      pack.rows
        .find((row) => row.software.includes("ASP.NET Core"))
        ?.candidateRoutes.some((route) => route.routeId === "runtime_install_metadata") === true
  },
  {
    name: "Fallback route pack keeps all side effects locked",
    pass:
      pack.locks.packDoesNotReadLogs === true &&
      pack.locks.packDoesNotCaptureScreenshots === true &&
      pack.locks.packDoesNotExecuteTargetSoftware === true &&
      pack.locks.packDoesNotRegisterSchedule === true &&
      pack.locks.packDoesNotWriteMemory === true &&
      pack.locks.goalComplete === false
  },
  {
    name: "Teacher contract blocks coverage and completion claims",
    pass:
      pack.teacherReviewContract.blockedDecisions.includes("claim_all_software_coverage_complete") &&
      pack.teacherReviewContract.blockedDecisions.includes("claim_goal_complete") &&
      pack.teacherReviewContract.selectedRouteIsStillNotCoverage === true
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      smoke: "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_smoke_v1",
      status: failed.length ? "failed" : "passed",
      checks,
      artifacts: {
        pack: result.packPath,
        html: result.htmlPath,
        readme: result.readmePath
      }
    },
    null,
    2
  )
);

if (failed.length) process.exit(1);
