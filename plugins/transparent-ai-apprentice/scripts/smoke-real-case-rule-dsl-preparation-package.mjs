#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const smokeRoot = join(root, ".ta-smoke", "real-case-rule-dsl-preparation-package");
mkdirSync(smokeRoot, { recursive: true });

function runNode(args, { expectOk = true } = {}) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
  if (expectOk && result.status !== 0) throw new Error(result.stderr || result.stdout || args.join(" "));
  if (!expectOk && result.status === 0) throw new Error(`Expected failure: ${args.join(" ")}`);
  return result;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function makeReadyPilot() {
  const artifactPath = join(smokeRoot, "source-packaging-case.json");
  const rollbackDir = join(smokeRoot, "rollback");
  mkdirSync(rollbackDir, { recursive: true });
  writeJson(artifactPath, {
    case: "folding carton",
    objects: [{ id: "glue-1", kind: "glue_tab", width_mm: 14 }]
  });
  const intake = JSON.parse(
    runNode([
      "plugins/transparent-ai-apprentice/scripts/create-real-case-pilot-intake.mjs",
      "--goal",
      "Learn packaging box glue tab and fold line logic from a real source drawing.",
      "--case-type",
      "packaging_box",
      "--software",
      "draw.io",
      "--artifact",
      artifactPath,
      "--knowledge-source",
      "teacher packaging note",
      "--constraint",
      "Glue tab width must follow board thickness and production minimum.",
      "--constraint",
      "Fold lines and cut lines must be separately bound to source feature ids.",
      "--rollback-point",
      rollbackDir,
      "--out-dir",
      join(smokeRoot, "intake")
    ]).stdout
  );
  const receipt = readJson(intake.receiptTemplatePath);
  receipt.teacherDecision = "pilot_route_selected_for_manual_preparation";
  receipt.selectedRoute = "prepare_universal_detail_logic";
  receipt.selectedRouteReviewed = true;
  receipt.rollbackRetained = true;
  receipt.teacherConfirmedNoExecution = true;
  receipt.reviewedEvidenceRows = receipt.reviewedEvidenceRows.map((row) => ({
    ...row,
    teacherReviewed: row.present || row.id === "knowledge_sources"
  }));
  const receiptPath = join(smokeRoot, "teacher-receipt.json");
  writeJson(receiptPath, receipt);
  const validation = JSON.parse(
    runNode([
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-pilot-intake-receipt.mjs",
      "--intake",
      intake.intakePath,
      "--receipt",
      receiptPath,
      "--out-dir",
      join(smokeRoot, "validation")
    ]).stdout
  );
  return validation.validationPath;
}

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const readyValidationPath = makeReadyPilot();
const prep = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/create-real-case-rule-dsl-preparation-package.mjs",
    "--pilot-validation",
    readyValidationPath,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "prep")
  ]).stdout
);
const prepPacket = readJson(prep.packagePath);
check(
  "Real-case Rule DSL prep creates draft_disabled candidate rules from packaging constraints",
  prep.ok &&
    prepPacket.format === "transparent_ai_real_case_rule_dsl_preparation_package_v1" &&
    prepPacket.status === "real_case_rule_dsl_preparation_waiting_for_teacher_rule_review" &&
    prepPacket.candidateRuleCount === 2 &&
    prepPacket.candidateRows.every((row) => row.lifecycle === "draft_disabled" && row.dslValidationOk),
  JSON.stringify({ packagePath: prep.packagePath, candidateRuleCount: prepPacket.candidateRuleCount })
);
check(
  "Real-case Rule DSL prep keeps active compilation execution and packaging locked",
  prepPacket.locks.activeRulePackageCompiled === false &&
    prepPacket.locks.ruleEnabled === false &&
    prepPacket.locks.targetSoftwareCommandsExecuted === false &&
    prepPacket.locks.packagingUnlocked === false &&
    prepPacket.nextTeacherReview.forbiddenDecisions.includes("compile_active_package"),
  JSON.stringify(prepPacket.locks)
);

const missingFlag = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-rule-dsl-preparation-package.mjs",
    "--pilot-validation",
    readyValidationPath,
    "--out-dir",
    join(smokeRoot, "missing-flag")
  ],
  { expectOk: false }
);
check(
  "Real-case Rule DSL prep requires explicit teacher-reviewed flag",
  /REAL_CASE_RULE_DSL_PREPARATION_REQUIRES_TEACHER_REVIEWED_FLAG/.test(missingFlag.stderr || missingFlag.stdout),
  (missingFlag.stderr || missingFlag.stdout).slice(0, 220)
);

const summary = {
  format: "transparent_ai_real_case_rule_dsl_preparation_package_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
