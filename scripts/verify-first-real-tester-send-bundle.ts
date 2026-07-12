import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

type Check = { name: string; pass: boolean; evidence: string };

type Bundle = {
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
  actualSendPerformed?: boolean;
  requiresManualSend?: boolean;
  selectedLane?: { id?: string; title?: string; preflightCommand?: string; preflightEvidencePath?: string };
  externalSendFolder?: string;
  returnIntakeFolder?: string;
  maintainerReadme?: string;
  dispatchPacketSource?: { manifestPath?: string; packetRoot?: string; generatedAt?: string; sourceEvidence?: Record<string, string> };
  sendFiles?: Array<{ id?: string; sourcePacketPath?: string; bundlePath?: string; audience?: string; bytes?: number; sha256?: string }>;
  returnFiles?: Array<{ id?: string; sourcePacketPath?: string; bundlePath?: string; audience?: string; bytes?: number; sha256?: string }>;
  excludedLaneIds?: string[];
  blockedActions?: string[];
  failedReasons?: string[];
  nextAction?: string;
};

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts", "productization");
const bundlePath = path.join(artifactsDir, "first-real-tester-send-bundle.json");
const bundleMarkdownPath = path.join(artifactsDir, "first-real-tester-send-bundle.md");
const bundleDir = path.join(artifactsDir, "first-real-tester-send-bundle");
const verificationPath = path.join(artifactsDir, "first-real-tester-send-bundle-verification.json");

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

function push(checks: Check[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function fileExists(relativePath: string, minBytes = 100) {
  const fullPath = path.join(rootDir, relativePath);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).size >= minBytes;
}

function fileSha256(relativePath: string) {
  const fullPath = path.join(rootDir, relativePath);
  return fs.existsSync(fullPath) ? crypto.createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex") : "missing";
}

function declaredFilesMatchFingerprints(files: Array<{ bundlePath?: string; bytes?: number; sha256?: string }>) {
  return files.every((file) => {
    if (!file.bundlePath || !Number(file.bytes) || !/^[a-f0-9]{64}$/.test(file.sha256 ?? "")) return false;
    const relativePath = `artifacts/productization/first-real-tester-send-bundle/${file.bundlePath}`;
    return fileExists(relativePath, 1) && fs.statSync(path.join(rootDir, relativePath)).size === file.bytes && fileSha256(relativePath) === file.sha256;
  });
}

function listFiles(relativeDir: string): string[] {
  const fullDir = path.join(rootDir, relativeDir);
  if (!fs.existsSync(fullDir)) return [];
  const results: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else results.push(path.relative(rootDir, full).replaceAll("\\", "/"));
    }
  };
  walk(fullDir);
  return results;
}

function main() {
  const bundle = readJson<Bundle>(bundlePath);
  const nestedManifest = readJson<Bundle>(path.join(bundleDir, "manifest.json"));
  const markdown = readText(bundleMarkdownPath);
  const maintainerReadme = readText(path.join(bundleDir, "MAINTAINER_README_DO_NOT_SEND.md"));
  const sendFilesOnDisk = listFiles("artifacts/productization/first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON");
  const returnFilesOnDisk = listFiles("artifacts/productization/first-real-tester-send-bundle/KEEP_FOR_RETURN_INTAKE");
  const selectedLane = bundle?.selectedLane?.id ?? "missing";
  const checks: Check[] = [];
  const expectedExcluded = selectedLane === "public_beta_tester_session" ? "human_acceptance_review" : "public_beta_tester_session";
  const sendPaths = bundle?.sendFiles?.map((file) => file.bundlePath ?? "") ?? [];
  const returnPaths = bundle?.returnFiles?.map((file) => file.bundlePath ?? "") ?? [];
  const allPaths = [...sendPaths, ...returnPaths];

  push(
    checks,
    "Send bundle exists for exactly one selected lane",
    bundle?.responseMode === "first_real_tester_send_bundle_json_v1" &&
      bundle.status === "ready_to_send_chosen_lane" &&
      nestedManifest?.responseMode === bundle.responseMode &&
      ["public_beta_tester_session", "human_acceptance_review"].includes(selectedLane) &&
      (bundle.failedReasons?.length ?? -1) === 0 &&
      fs.existsSync(bundleDir),
    `status=${bundle?.status ?? "missing"}; lane=${selectedLane}; failed=${bundle?.failedReasons?.join(",") || "none"}`
  );

  push(
    checks,
    "Send bundle preserves productization locks and does not perform an external send",
    bundle?.productScope === "bounded_core_teaching_loop" &&
      bundle.allSoftwareObjective === "paused" &&
      bundle.releaseDecision === "do_not_release" &&
      bundle.reviewOnly === true &&
      bundle.accepted === false &&
      bundle.packagingGated === true &&
      bundle.canRelease === false &&
      bundle.canActivateRealModel === false &&
      bundle.actualSendPerformed === false &&
      bundle.requiresManualSend === true,
    `release=${bundle?.releaseDecision ?? "missing"}; accepted=${bundle?.accepted ?? "missing"}; packaging=${bundle?.packagingGated ?? "missing"}; canRelease=${bundle?.canRelease ?? "missing"}; canActivate=${bundle?.canActivateRealModel ?? "missing"}; sent=${bundle?.actualSendPerformed ?? "missing"}`
  );

  push(
    checks,
    "Send bundle is backed by a ready dispatch packet and bootstrap return controls",
    bundle?.dispatchPacketSource?.manifestPath === "artifacts/productization/first-real-tester-dispatch-packet.json" &&
      bundle.dispatchPacketSource.packetRoot === "artifacts/productization/first-real-tester-dispatch-packet" &&
      bundle.dispatchPacketSource.sourceEvidence?.firstRealTesterLaunch?.includes("verifier=passed 8/8") === true &&
      bundle.dispatchPacketSource.sourceEvidence?.returnWorkbench?.includes("ready_to_process_exactly_one_first_return") === true &&
      bundle.dispatchPacketSource.sourceEvidence.returnWorkbench.includes("verifier=") &&
      bundle.dispatchPacketSource.sourceEvidence?.returnGate?.includes("waiting_for_first_return") === true &&
      bundle.dispatchPacketSource.sourceEvidence.returnGate.includes("canInvite=false") &&
      bundle.dispatchPacketSource.sourceEvidence.returnGate.includes("verifier="),
    `source=${bundle?.dispatchPacketSource?.manifestPath ?? "missing"}; evidence=${JSON.stringify(bundle?.dispatchPacketSource?.sourceEvidence ?? {})}`
  );

  push(
    checks,
    "External send folder contains only selected-lane send files",
    bundle?.externalSendFolder === "artifacts/productization/first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON" &&
      sendPaths.length >= 2 &&
      sendPaths.every((filePath) => filePath.startsWith("SEND_TO_FIRST_EXTERNAL_PERSON/")) &&
      sendPaths.every((filePath) => fileExists(`artifacts/productization/first-real-tester-send-bundle/${filePath}`, 100)) &&
      sendFilesOnDisk.length === sendPaths.length + 1 &&
      sendFilesOnDisk.some((filePath) => filePath.endsWith("/README.md")) &&
      !sendFilesOnDisk.some((filePath) => filePath.includes(expectedExcluded)) &&
      !sendFilesOnDisk.some((filePath) => /release|real.?model/i.test(filePath)),
    `declared=${sendPaths.join(",")}; disk=${sendFilesOnDisk.join(",")}; excluded=${expectedExcluded}`
  );

  push(
    checks,
    "Return intake folder is kept separate from external send materials",
    bundle?.returnIntakeFolder === "artifacts/productization/first-real-tester-send-bundle/KEEP_FOR_RETURN_INTAKE" &&
      returnPaths.length >= 1 &&
      returnPaths.every((filePath) => filePath.startsWith("KEEP_FOR_RETURN_INTAKE/")) &&
      returnPaths.every((filePath) => fileExists(`artifacts/productization/first-real-tester-send-bundle/${filePath}`, 100)) &&
      returnFilesOnDisk.length === returnPaths.length &&
      maintainerReadme.includes("Send only the files in `SEND_TO_FIRST_EXTERNAL_PERSON`") &&
      maintainerReadme.includes("Keep `KEEP_FOR_RETURN_INTAKE` with the maintainer"),
    `declared=${returnPaths.join(",")}; disk=${returnFilesOnDisk.join(",")}`
  );

  push(
    checks,
    "Declared send bundle fingerprints match disk files",
    declaredFilesMatchFingerprints(bundle?.sendFiles ?? []) && declaredFilesMatchFingerprints(bundle?.returnFiles ?? []),
    `send=${(bundle?.sendFiles ?? []).map((file) => `${file.bundlePath}:${(file.sha256 ?? "missing").slice(0, 12)}/${fileSha256(`artifacts/productization/first-real-tester-send-bundle/${file.bundlePath ?? "missing"}`).slice(0, 12)}`).join(",")}; return=${(bundle?.returnFiles ?? []).length}`
  );

  push(
    checks,
    "Unselected lane and release-only materials are explicitly blocked",
    bundle?.excludedLaneIds?.includes(expectedExcluded) === true &&
      bundle.blockedActions?.includes("send_unselected_lane_materials") === true &&
      bundle.blockedActions?.includes("send_release_approval_as_first_test_material") === true &&
      bundle.blockedActions?.includes("send_real_model_trial_as_first_test_material") === true &&
      bundle.blockedActions?.includes("send_keep_for_return_intake_folder_to_external_person") === true &&
      !allPaths.some((filePath) => /release|real.?model/i.test(filePath)) &&
      !allPaths.some((filePath) => filePath.includes(expectedExcluded)),
    `excluded=${bundle?.excludedLaneIds?.join(",") ?? "missing"}; blocked=${bundle?.blockedActions?.join(",") ?? "missing"}`
  );

  push(
    checks,
    "Selected lane carries a preflight and return path before widening",
    typeof bundle?.selectedLane?.preflightCommand === "string" &&
      bundle.selectedLane.preflightCommand.includes("--base-url") &&
      typeof bundle.selectedLane.preflightEvidencePath === "string" &&
      bundle.selectedLane.preflightEvidencePath.startsWith("artifacts/productization/") &&
      bundle.nextAction?.includes("process the first return through the workbench and return gate") === true,
    `preflight=${bundle?.selectedLane?.preflightCommand ?? "missing"}; evidence=${bundle?.selectedLane?.preflightEvidencePath ?? "missing"}; next=${bundle?.nextAction ?? "missing"}`
  );

  push(
    checks,
    "Send bundle Markdown is readable and explicit",
    markdown.includes("# First Real Tester Send Bundle") &&
      markdown.includes(`Selected lane: \`${selectedLane}\``) &&
      markdown.includes("Actual send performed: `false`") &&
      markdown.includes("sha256") &&
      markdown.includes("Can release: `false`") &&
      markdown.includes("Can activate real model: `false`") &&
      markdown.length > 1500,
    `bytes=${markdown.length}`
  );

  const passed = checks.filter((check) => check.pass).length;
  const verification = {
    responseMode: "first_real_tester_send_bundle_verification_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    command: "npm run verify:first-real-tester-send-bundle",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    selectedLane,
    passed,
    total: checks.length,
    checks,
    nextAction:
      passed === checks.length
        ? "Run the selected lane preflight, then send only SEND_TO_FIRST_EXTERNAL_PERSON and keep return intake materials with the maintainer."
        : "Rebuild first-real-tester-send-bundle and fix failed checks before contacting any first external tester or reviewer."
  };

  fs.writeFileSync(verificationPath, `${JSON.stringify(verification, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(verification, null, 2));
  console.log(`\nFirst real tester send bundle verification written to ${verificationPath}`);
  if (verification.status !== "passed") process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

export {};
