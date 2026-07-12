#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "six-remaining-teacher-review-handoff", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence ?? "") };
}

const controlBuilderPath = join(smokeRoot, "control-builder.json");
const actionPackagePath = join(smokeRoot, "action-package.json");
writeFileSync(
  controlBuilderPath,
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_control_channel_repair_receipt_builder_v1",
      status: "receipt_builder_ready_for_teacher_use",
      paths: {
        html: join(smokeRoot, "control.html"),
        receiptTemplate: join(smokeRoot, "control-receipt-template.json")
      },
      reviewRows: [
        {
          itemId: "follow-up-probe-control-row-006",
          sourceRowId: "control-row-006",
          software: "AntiCheatExpert",
          evidencePath: "D:\\example\\probe-plan.json",
          probePlanPath: "D:\\example\\probe-plan.json",
          probeResultTemplatePath: "D:\\example\\probe-result-template.json"
        },
        {
          itemId: "follow-up-probe-control-row-007",
          sourceRowId: "control-row-007",
          software: "Autodesk Identity Manager",
          evidencePath: "D:\\example\\probe-plan-2.json",
          probePlanPath: "D:\\example\\probe-plan-2.json",
          probeResultTemplatePath: "D:\\example\\probe-result-template-2.json"
        }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        softwareActionsExecuted: false
      }
    },
    null,
    2
  ),
  "utf8"
);
writeFileSync(
  actionPackagePath,
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_action_logic_source_contract_package_v1",
      status: "waiting_for_teacher_action_logic_source_review",
      paths: {
        html: join(smokeRoot, "logic.html"),
        receiptTemplate: join(smokeRoot, "logic-receipt-template.json")
      },
      contractRows: [
        {
          rowId: "control-row-006",
          software: "AntiCheatExpert",
          currentStatus: "observation_ready_but_action_logic_source_missing"
        },
        {
          rowId: "control-row-007",
          software: "Autodesk Identity Manager",
          currentStatus: "observation_ready_but_action_logic_source_missing"
        },
        {
          rowId: "control-row-999",
          software: "NotInControlBuilder",
          currentStatus: "observation_ready_but_action_logic_source_missing"
        }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        softwareActionsExecuted: false
      }
    },
    null,
    2
  ),
  "utf8"
);

const result = runNodeScript("create-current-goal-six-remaining-teacher-review-handoff.mjs", [
  "--goal",
  "Smoke focused six remaining teacher review handoff.",
  "--control-channel-builder",
  controlBuilderPath,
  "--action-logic-package",
  actionPackagePath,
  "--output-dir",
  join(smokeRoot, "handoff")
]);
const handoff = readJson(result.handoffPath);
const html = readFileSync(result.htmlPath, "utf8");
const readme = readFileSync(result.readmePath, "utf8");

const checks = [
  check("handoff status waits for teacher review", handoff.status === "waiting_for_teacher_review_before_control_profile_action_logic_or_execution", handoff.status),
  check("shared rows only", handoff.rows.length === 2 && handoff.counts.sharedRows === 2, JSON.stringify(handoff.counts)),
  check("review order has control then logic", handoff.reviewOrder[0].id === "control_channel_probe_package_review" && handoff.reviewOrder[1].id === "action_logic_source_contract_review", handoff.reviewOrder.map((row) => row.id).join(",")),
  check("locks keep execution and rule enablement closed", handoff.locks.accepted === false && handoff.locks.ruleEnabled === false && handoff.locks.doesNotExecuteTargetSoftware === true && handoff.locks.packagingGated === true, JSON.stringify(handoff.locks)),
  check("html and readme are generated", html.includes("Six Remaining Teacher Review Handoff") && readme.includes("After teacher-filled receipts"), `${html.length}/${readme.length}`)
];

const failed = checks.filter((row) => !row.pass);
const smoke = {
  ok: failed.length === 0,
  format: "transparent_ai_current_goal_six_remaining_teacher_review_handoff_smoke_v1",
  smokeRoot,
  checks,
  paths: {
    controlBuilderPath,
    actionPackagePath,
    handoffPath: result.handoffPath,
    htmlPath: result.htmlPath,
    readmePath: result.readmePath
  }
};
console.log(JSON.stringify(smoke, null, 2));
if (failed.length) process.exit(1);