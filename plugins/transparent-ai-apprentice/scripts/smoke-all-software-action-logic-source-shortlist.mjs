#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function makeSmokeRoot(preferredRoot = "") {
  const id = String(Date.now());
  const candidates = [
    preferredRoot ? join(resolve(preferredRoot), id) : "",
    join(repoRoot, ".transparent-apprentice", "all-software-action-logic-source-shortlist-smoke", id),
    join(tmpdir(), "transparent-ai-apprentice-smoke", "all-software-action-logic-source-shortlist", id)
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      mkdirSync(candidate, { recursive: true });
      return candidate;
    } catch {
      // Try the next bounded smoke directory.
    }
  }
  throw new Error("Unable to create an action logic source shortlist smoke directory.");
}

const smokeRoot = makeSmokeRoot(argValue("--output-dir", argValue("--out-dir", "")));

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

const packagePath = join(smokeRoot, "contract-package.json");
writeFileSync(
  packagePath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_action_logic_source_contract_package_v1",
      packageId: "shortlist-smoke-package",
      status: "waiting_for_teacher_action_logic_source_review",
      contractRows: [
        {
          rowId: "control-row-001",
          software: "ExampleCAD",
          processName: "ExampleCAD",
          lane: "confirm_numbered_target_or_exact_route",
          currentStatus: "control_route_needs_action_logic_source_contract",
          evidenceSummary: { status: "control_route_needs_action_logic_source_contract" },
          teacherLogicPrompt: "Confirm action logic before execution.",
          draftContract: {
            actionIntent: "Teacher must confirm the intended action for ExampleCAD.",
            targetBinding: "Bind ExampleCAD only to one teacher-confirmed numbered target.",
            dataToActionLogic: "Block until the teacher supplies the state-to-action mapping.",
            dataRelationshipMap: "Teacher maps each datum to the action parameter it controls.",
            geometryRelationshipLogic: "Teacher confirms 2D position, angle, perspective, and depth relationships.",
            targetSelectionLogic: "Select exactly one teacher-confirmed numbered target.",
            uncertaintyAndBlockers: "block execution if any required field is unknown",
            rollbackPolicy: "retained rollback point required before any execution-capable runner",
            outcomeVerifier: "post-action evidence checkpoint required before memory",
            validationEvidencePlan: "compare deterministic output fields before learning",
            ragEvidenceRole: "evidence_only_not_authority",
            reasoningTierBoundary:
              "highest reasoning compiles or repairs this contract; medium reasoning may only execute after teacher validation and execution gate approval",
            mediumRuntimeReuseConditions:
              "allowed only after matrix patch, teacher validation, execution gate, retained rollback point, and verifier plan",
            providerRoleUsePlanTrace: "highest-reasoning draft from evidence; medium-runtime reuse blocked"
          },
          defaultDecision: "needs_teacher_review",
          allowedTeacherDecisions: ["needs_teacher_review", "teacher_confirmed_logic_contract", "blocked_needs_more_evidence"],
          accepted: false,
          ruleEnabled: false,
          packagingGated: true
        },
        {
          rowId: "control-row-002",
          software: "NeedsRoute",
          draftContract: {
            ragEvidenceRole: "evidence_only_not_authority",
            reasoningTierBoundary: "highest reasoning compiles; medium runtime blocked"
          },
          accepted: false,
          ruleEnabled: false,
          packagingGated: true
        }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        softwareActionsExecuted: false,
        memoryWritten: false
      }
    },
    null,
    2
  ),
  "utf8"
);

const result = runNodeScript("create-all-software-action-logic-source-shortlist.mjs", [
  "--goal",
  "Smoke action logic shortlist.",
  "--package",
  packagePath,
  "--output-dir",
  join(smokeRoot, "shortlist")
]);
const shortlist = readJson(result.shortlistPath);
const receipt = readJson(result.receiptTemplatePath);
const validation = runNodeScript("validate-all-software-action-logic-source-contract-receipt.mjs", [
  "--package",
  packagePath,
  "--receipt",
  result.receiptTemplatePath,
  "--output-dir",
  join(smokeRoot, "validation")
]);
const validationFile = readJson(validation.validationPath);

const checks = [
  check("shortlist status waits for teacher review", shortlist.status === "waiting_for_teacher_action_logic_source_shortlist_review", shortlist.status),
  check("exactly one recommended row is selected", shortlist.recommendedRows.length === 1, shortlist.recommendedRows.length),
  check("default receipt remains needs_teacher_review", receipt.rowDecisions[0].teacherDecision === "needs_teacher_review", receipt.rowDecisions[0].teacherDecision),
  check(
    "default validation has no ready matrix patch rows",
    validationFile.readyPatchRowCount === 0 &&
      Array.isArray(validationFile.matrixPatch?.rows) &&
      validationFile.matrixPatch.rows.length === 0,
    `${validationFile.readyPatchRowCount} ready rows`
  ),
  check(
    "locks keep execution memory rules and packaging closed",
    shortlist.locks.softwareActionsExecuted === false &&
      shortlist.locks.memoryWritten === false &&
      shortlist.locks.ruleEnabled === false &&
      shortlist.locks.packagingGated === true,
    JSON.stringify(shortlist.locks)
  )
];

const failed = checks.filter((row) => !row.pass);
const smoke = {
  ok: failed.length === 0,
  format: "transparent_ai_all_software_action_logic_source_shortlist_smoke_v1",
  smokeRoot,
  checks,
  paths: {
    packagePath,
    shortlistPath: result.shortlistPath,
    receiptTemplatePath: result.receiptTemplatePath,
    validationPath: validation.validationPath
  }
};
console.log(JSON.stringify(smoke, null, 2));
if (failed.length) process.exit(1);
