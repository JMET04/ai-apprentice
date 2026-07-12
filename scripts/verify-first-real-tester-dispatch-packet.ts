import fs from "node:fs";
import path from "node:path";

type Check = { name: string; pass: boolean; evidence: string };

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts", "productization");
const manifestPath = path.join(artifactsDir, "first-real-tester-dispatch-packet.json");
const markdownPath = path.join(artifactsDir, "first-real-tester-dispatch-packet.md");
const packetDir = path.join(artifactsDir, "first-real-tester-dispatch-packet");
const verificationPath = path.join(artifactsDir, "first-real-tester-dispatch-packet-verification.json");

function readJson<T>(targetPath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(targetPath, "utf8")) as T;
  } catch {
    return null;
  }
}

function readText(targetPath: string) {
  try {
    return fs.readFileSync(targetPath, "utf8");
  } catch {
    return "";
  }
}

function existsPacketFile(relativePath: string, minimumBytes = 100) {
  const fullPath = path.join(packetDir, relativePath);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).size >= minimumBytes;
}

function push(checks: Check[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function main() {
  const manifest = readJson<{
    responseMode?: string;
    status?: string;
    productScope?: string;
    allSoftwareObjective?: string;
    releaseDecision?: string;
    reviewOnly?: boolean;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    dispatchRule?: Record<string, boolean>;
    sourceEvidence?: Record<string, string>;
    lanes?: Array<{
      id?: string;
      allowed?: boolean;
      preflightCommand?: string;
      packetSendFolder?: string;
      packetReturnFolder?: string;
      sendFiles?: Array<{ id?: string; packetPath?: string; audience?: string; bytes?: number }>;
      returnFiles?: Array<{ id?: string; packetPath?: string; audience?: string; bytes?: number }>;
      returnCommands?: string[];
      stopConditions?: string[];
    }>;
    maintainerFiles?: Array<{ id?: string; packetPath?: string; audience?: string; bytes?: number }>;
    blockedActions?: string[];
    failedReasons?: string[];
    nextAction?: string;
  }>(manifestPath);
  const packetManifest = readJson<{ responseMode?: string }>(path.join(packetDir, "manifest.json"));
  const markdown = readText(markdownPath);
  const checks: Check[] = [];
  const lanes = manifest?.lanes ?? [];
  const betaLane = lanes.find((lane) => lane.id === "public_beta_tester_session");
  const humanLane = lanes.find((lane) => lane.id === "human_acceptance_review");
  const sendFiles = lanes.flatMap((lane) => lane.sendFiles ?? []);
  const returnFiles = lanes.flatMap((lane) => lane.returnFiles ?? []);
  const maintainerFiles = manifest?.maintainerFiles ?? [];
  const allPacketPaths = [...sendFiles, ...returnFiles, ...maintainerFiles].map((file) => file.packetPath ?? "");

  push(
    checks,
    "Dispatch packet exists and is ready for one lane",
    manifest?.responseMode === "first_real_tester_dispatch_packet_json_v1" &&
      manifest.status === "ready_to_send_one_lane" &&
      (manifest.failedReasons?.length ?? -1) === 0 &&
      packetManifest?.responseMode === manifest.responseMode &&
      fs.existsSync(packetDir) &&
      lanes.length === 2,
    `status=${manifest?.status ?? "missing"}; lanes=${lanes.map((lane) => lane.id).join(",")}; failed=${manifest?.failedReasons?.join(",") || "none"}`
  );

  push(
    checks,
    "Dispatch packet preserves productization locks",
    manifest?.productScope === "bounded_core_teaching_loop" &&
      manifest.allSoftwareObjective === "paused" &&
      manifest.releaseDecision === "do_not_release" &&
      manifest.reviewOnly === true &&
      manifest.accepted === false &&
      manifest.packagingGated === true &&
      manifest.canRelease === false &&
      manifest.canActivateRealModel === false,
    `release=${manifest?.releaseDecision ?? "missing"}; accepted=${manifest?.accepted ?? "missing"}; packaging=${manifest?.packagingGated ?? "missing"}; canRelease=${manifest?.canRelease ?? "missing"}; canActivate=${manifest?.canActivateRealModel ?? "missing"}`
  );

  push(
    checks,
    "Dispatch rule prevents multi-lane or premature widening",
    manifest?.dispatchRule?.chooseExactlyOneLane === true &&
      manifest.dispatchRule.sendOnlyChosenLaneFolder === true &&
      manifest.dispatchRule.doNotSendReleaseApprovalOrRealModelTrialMaterials === true &&
      manifest.dispatchRule.doNotInviteAdditionalTesterOrReviewerBeforeReturnGateAllowsIt === true &&
      manifest.blockedActions?.includes("send_both_lanes_to_the_same_first_external_person") === true &&
      manifest.blockedActions.includes("invite_additional_tester_or_reviewer_before_return_gate_allows_it"),
    `rule=${JSON.stringify(manifest?.dispatchRule ?? {})}; blocked=${manifest?.blockedActions?.join(",") ?? "missing"}`
  );

  push(
    checks,
    "Dispatch packet is backed by launch and bootstrap return-control evidence",
    manifest?.sourceEvidence?.firstRealTesterLaunch?.includes("ready_to_invite_one_bounded_real_tester_or_reviewer") === true &&
      manifest.sourceEvidence.firstRealTesterLaunch.includes("verifier=passed 8/8") &&
      manifest.sourceEvidence.returnWorkbench?.includes("ready_to_process_exactly_one_first_return") === true &&
      manifest.sourceEvidence.returnWorkbench.includes("verifier=") &&
      manifest.sourceEvidence.returnGate?.includes("waiting_for_first_return") === true &&
      manifest.sourceEvidence.returnGate.includes("canInvite=false") &&
      manifest.sourceEvidence.returnGate.includes("verifier="),
    `evidence=${JSON.stringify(manifest?.sourceEvidence ?? {})}`
  );

  push(
    checks,
    "Public beta lane contains only bounded tester session materials and return templates",
    betaLane?.allowed === true &&
      betaLane.preflightCommand === "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000" &&
      betaLane.packetSendFolder === "lanes/public_beta_tester_session/send" &&
      betaLane.packetReturnFolder === "lanes/public_beta_tester_session/return" &&
      betaLane.sendFiles?.some((file) => file.id === "public_beta_tester_invite" && file.audience === "external_tester_or_reviewer") === true &&
      betaLane.sendFiles.some((file) => file.id === "public_beta_tester_runbook") &&
      betaLane.sendFiles.some((file) => file.id === "public_beta_session_plan") &&
      betaLane.returnFiles?.some((file) => file.id === "public_beta_session_receipt_template" && file.audience === "facilitator_return_intake") === true &&
      betaLane.returnFiles.some((file) => file.id === "public_beta_feedback_receipt_template") &&
      betaLane.returnCommands?.includes("npm run intake:public-beta-return -- --receipt <feedback-path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json") === true &&
      betaLane.returnCommands.includes("npm run verify:first-real-tester-return-workbench") &&
      betaLane.returnCommands.includes("npm run verify:first-real-tester-return-gate") &&
      betaLane.stopConditions?.some((condition) => condition.includes("tester.name/tester.date")) === true &&
      betaLane.stopConditions.some((condition) => condition.includes("sessionEvidence.feedbackReceiptPath")),
    `send=${betaLane?.sendFiles?.map((file) => file.id).join(",") ?? "missing"}; return=${betaLane?.returnFiles?.map((file) => file.id).join(",") ?? "missing"}`
  );

  push(
    checks,
    "Human acceptance lane contains reviewer materials and a return template",
    humanLane?.allowed === true &&
      humanLane.preflightCommand === "npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000" &&
      humanLane.packetSendFolder === "lanes/human_acceptance_review/send" &&
      humanLane.packetReturnFolder === "lanes/human_acceptance_review/return" &&
      humanLane.sendFiles?.some((file) => file.id === "human_acceptance_reviewer_invite" && file.audience === "external_tester_or_reviewer") === true &&
      humanLane.sendFiles.some((file) => file.id === "human_acceptance_reviewer_kit") &&
      humanLane.returnFiles?.some((file) => file.id === "human_acceptance_receipt_template" && file.audience === "facilitator_return_intake") === true &&
      humanLane.returnCommands?.includes("npm run intake:human-acceptance-return -- --receipt <path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json") === true &&
      humanLane.returnCommands.includes("npm run verify:first-real-tester-return-workbench") &&
      humanLane.returnCommands.includes("npm run verify:first-real-tester-return-gate") &&
      humanLane.stopConditions?.some((condition) => condition.includes("evidenceKind=human_review")) === true,
    `send=${humanLane?.sendFiles?.map((file) => file.id).join(",") ?? "missing"}; return=${humanLane?.returnFiles?.map((file) => file.id).join(",") ?? "missing"}`
  );

  push(
    checks,
    "Every declared packet file exists with content",
    allPacketPaths.length >= 10 &&
      allPacketPaths.every((packetPath) => existsPacketFile(packetPath, 100)) &&
      maintainerFiles.some((file) => file.packetPath === "START_FIRST_REAL_TESTER.md") &&
      existsPacketFile("manifest.json", 1000),
    `files=${allPacketPaths.length}; missing=${allPacketPaths.filter((packetPath) => !existsPacketFile(packetPath, 100)).join(",") || "none"}`
  );

  push(
    checks,
    "Dispatch packet excludes release approval and real-model trial materials from send folders",
    !allPacketPaths.some((packetPath) => packetPath.includes("PRODUCT_RELEASE_APPROVAL")) &&
      !allPacketPaths.some((packetPath) => packetPath.includes("REAL_MODEL_TRIAL")) &&
      !sendFiles.some((file) => /release|real.?model/i.test(file.packetPath ?? "")) &&
      manifest?.blockedActions?.includes("send_release_approval_as_first_test_material") === true &&
      manifest.blockedActions.includes("send_real_model_trial_as_first_test_material"),
    `paths=${allPacketPaths.join(",")}`
  );

  push(
    checks,
    "Dispatch Markdown is readable and explicit",
    markdown.includes("# First Real Tester Dispatch Packet") &&
      markdown.includes("Choose exactly one lane") &&
      markdown.includes("public_beta_tester_session") &&
      markdown.includes("human_acceptance_review") &&
      markdown.includes("Do not send release approval or real-model trial materials") &&
      markdown.includes("Accepted: `false`") &&
      markdown.includes("Packaging gated: `true`") &&
      markdown.includes("Can release: `false`") &&
      markdown.includes("Can activate real model: `false`") &&
      markdown.length > 2500,
    `bytes=${markdown.length}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const verification = {
    responseMode: "first_real_tester_dispatch_packet_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:first-real-tester-dispatch-packet",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    passed,
    total: checks.length,
    checks,
    nextAction:
      passed === checks.length
        ? "Use first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md to choose and send exactly one first external lane."
        : "Rebuild first-real-tester-dispatch-packet and fix failed checks before sending materials."
  };

  fs.writeFileSync(verificationPath, `${JSON.stringify(verification, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(verification, null, 2));
  console.log(`\nFirst real tester dispatch packet verification written to ${verificationPath}`);

  if (verification.status !== "passed") process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

export {};
