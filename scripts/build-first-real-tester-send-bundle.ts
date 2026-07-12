import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

type PacketFile = {
  id?: string;
  packetPath?: string;
  audience?: string;
  bytes?: number;
};

type Lane = {
  id?: string;
  title?: string;
  allowed?: boolean;
  preflightCommand?: string;
  preflightEvidencePath?: string;
  packetSendFolder?: string;
  packetReturnFolder?: string;
  sendFiles?: PacketFile[];
  returnFiles?: PacketFile[];
  returnCommands?: string[];
  stopConditions?: string[];
};

type DispatchManifest = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
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
  lanes?: Lane[];
  blockedActions?: string[];
};

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts", "productization");
const dispatchManifestPath = path.join(artifactsDir, "first-real-tester-dispatch-packet.json");
const dispatchPacketDir = path.join(artifactsDir, "first-real-tester-dispatch-packet");
const bundleDir = path.join(artifactsDir, "first-real-tester-send-bundle");
const bundleManifestPath = path.join(artifactsDir, "first-real-tester-send-bundle.json");
const bundleMarkdownPath = path.join(artifactsDir, "first-real-tester-send-bundle.md");

const allowedLaneIds = new Set(["public_beta_tester_session", "human_acceptance_review"]);

function argValue(name: string): string | undefined {
  const prefixed = `${name}=`;
  const directIndex = process.argv.indexOf(name);
  if (directIndex >= 0) return process.argv[directIndex + 1];
  const inline = process.argv.find((arg) => arg.startsWith(prefixed));
  return inline?.slice(prefixed.length);
}

function readJson<T>(targetPath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(targetPath, "utf8")) as T;
  } catch {
    return null;
  }
}

function copyDeclaredFile(sourcePacketPath: string, destinationRelativePath: string) {
  const source = path.join(dispatchPacketDir, sourcePacketPath);
  const destination = path.join(bundleDir, destinationRelativePath);
  if (!fs.existsSync(source) || fs.statSync(source).size < 100) {
    throw new Error(`Declared dispatch packet file is missing or too small: ${sourcePacketPath}`);
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  return {
    sourcePacketPath,
    bundlePath: destinationRelativePath.replaceAll("\\", "/"),
    bytes: fs.statSync(destination).size,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(destination)).digest("hex")
  };
}

function markdownList(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

function main() {
  const selectedLaneId = argValue("--lane") ?? "public_beta_tester_session";
  if (!allowedLaneIds.has(selectedLaneId)) {
    throw new Error(`Unsupported --lane ${selectedLaneId}. Use public_beta_tester_session or human_acceptance_review.`);
  }

  const dispatch = readJson<DispatchManifest>(dispatchManifestPath);
  const lanes = dispatch?.lanes ?? [];
  const selectedLane = lanes.find((lane) => lane.id === selectedLaneId);
  const excludedLaneIds = lanes.map((lane) => lane.id).filter((id): id is string => Boolean(id && id !== selectedLaneId));
  const failedReasons: string[] = [];

  if (dispatch?.responseMode !== "first_real_tester_dispatch_packet_json_v1") failedReasons.push("dispatch_manifest_missing");
  if (dispatch?.status !== "ready_to_send_one_lane") failedReasons.push("dispatch_packet_not_ready");
  if (dispatch?.productScope !== "bounded_core_teaching_loop") failedReasons.push("unexpected_product_scope");
  if (dispatch?.allSoftwareObjective !== "paused") failedReasons.push("all_software_not_paused");
  if (dispatch?.releaseDecision !== "do_not_release") failedReasons.push("release_not_locked");
  if (dispatch?.accepted !== false || dispatch?.packagingGated !== true || dispatch?.canRelease !== false || dispatch?.canActivateRealModel !== false) {
    failedReasons.push("productization_locks_not_preserved");
  }
  if (dispatch?.dispatchRule?.chooseExactlyOneLane !== true || dispatch?.dispatchRule?.sendOnlyChosenLaneFolder !== true) {
    failedReasons.push("single_lane_dispatch_rule_missing");
  }
  if (!selectedLane || selectedLane.allowed !== true) failedReasons.push("selected_lane_not_allowed");
  if ((selectedLane?.sendFiles?.length ?? 0) === 0) failedReasons.push("selected_lane_send_files_missing");
  if ((selectedLane?.returnFiles?.length ?? 0) === 0) failedReasons.push("selected_lane_return_files_missing");

  fs.rmSync(bundleDir, { recursive: true, force: true });
  fs.mkdirSync(bundleDir, { recursive: true });

  const sendFiles = (selectedLane?.sendFiles ?? []).map((file) => {
    if (!file.packetPath) throw new Error(`Selected lane ${selectedLaneId} has a send file without packetPath.`);
    const fileName = path.basename(file.packetPath);
    return { ...file, ...copyDeclaredFile(file.packetPath, path.join("SEND_TO_FIRST_EXTERNAL_PERSON", fileName)) };
  });

  const returnFiles = (selectedLane?.returnFiles ?? []).map((file) => {
    if (!file.packetPath) throw new Error(`Selected lane ${selectedLaneId} has a return file without packetPath.`);
    const fileName = path.basename(file.packetPath);
    return { ...file, ...copyDeclaredFile(file.packetPath, path.join("KEEP_FOR_RETURN_INTAKE", fileName)) };
  });

  const maintainerReadme = `# First Real Tester Send Bundle\n\nStatus: \`${failedReasons.length === 0 ? "ready_to_send_chosen_lane" : "blocked_before_send"}\`\n\nSelected lane: \`${selectedLaneId}\`\n\nThis folder is a local preparation artifact. It does not send email, does not contact a tester, and does not record acceptance.\n\n## Send Boundary\n\nSend only the files in \`SEND_TO_FIRST_EXTERNAL_PERSON\` to the chosen first external tester or reviewer. Keep \`KEEP_FOR_RETURN_INTAKE\` with the maintainer for collecting returned receipts.\n\n## Preflight\n\nRun this immediately before contacting the person:\n\n\`${selectedLane?.preflightCommand ?? "missing"}\`\n\nPreflight evidence path: \`${selectedLane?.preflightEvidencePath ?? "missing"}\`\n\n## Return Commands\n\n${markdownList((selectedLane?.returnCommands ?? []).map((command) => `\`${command}\``))}\n\n## Stop Conditions\n\n${markdownList(selectedLane?.stopConditions ?? [])}\n\n## Excluded Lanes\n\n${markdownList(excludedLaneIds.map((id) => `\`${id}\``))}\n\n## Locked Boundary\n\n- Release decision: \`do_not_release\`\n- Accepted: \`false\`\n- Packaging gated: \`true\`\n- Can release: \`false\`\n- Can activate real model: \`false\`\n- Actual send performed: \`false\`\n`;
  fs.writeFileSync(path.join(bundleDir, "MAINTAINER_README_DO_NOT_SEND.md"), maintainerReadme, "utf8");

  const externalReadme = `# First External Session Materials\n\nYou are receiving only the selected first-session materials for \`${selectedLaneId}\`. This is not a product release and not acceptance. Follow the included runbook or kit, then return the requested receipt files to the maintainer.\n`;
  fs.writeFileSync(path.join(bundleDir, "SEND_TO_FIRST_EXTERNAL_PERSON", "README.md"), externalReadme, "utf8");

  const bundle = {
    responseMode: "first_real_tester_send_bundle_json_v1",
    status: failedReasons.length === 0 ? "ready_to_send_chosen_lane" : "blocked_before_send",
    generatedAt: new Date().toISOString(),
    command: `npm run build:first-real-tester-send-bundle -- --lane ${selectedLaneId}`,
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    actualSendPerformed: false,
    requiresManualSend: true,
    selectedLane: {
      id: selectedLaneId,
      title: selectedLane?.title ?? "missing",
      preflightCommand: selectedLane?.preflightCommand ?? "missing",
      preflightEvidencePath: selectedLane?.preflightEvidencePath ?? "missing"
    },
    externalSendFolder: "artifacts/productization/first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON",
    returnIntakeFolder: "artifacts/productization/first-real-tester-send-bundle/KEEP_FOR_RETURN_INTAKE",
    maintainerReadme: "artifacts/productization/first-real-tester-send-bundle/MAINTAINER_README_DO_NOT_SEND.md",
    dispatchPacketSource: {
      manifestPath: "artifacts/productization/first-real-tester-dispatch-packet.json",
      packetRoot: "artifacts/productization/first-real-tester-dispatch-packet",
      generatedAt: dispatch?.generatedAt ?? "missing",
      sourceEvidence: dispatch?.sourceEvidence ?? {}
    },
    sendFiles,
    returnFiles,
    excludedLaneIds,
    blockedActions: [
      ...(dispatch?.blockedActions ?? []),
      "send_keep_for_return_intake_folder_to_external_person",
      "send_maintainer_readme_to_external_person",
      "send_unselected_lane_materials"
    ],
    failedReasons,
    nextAction:
      failedReasons.length === 0
        ? "Run the selected lane preflight against the real base URL, then send only SEND_TO_FIRST_EXTERNAL_PERSON. Keep return templates and process the first return through the workbench and return gate."
        : "Fix failed send-bundle readiness checks before contacting any first external tester or reviewer."
  };

  fs.writeFileSync(path.join(bundleDir, "manifest.json"), `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  fs.writeFileSync(bundleManifestPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");

  const markdown = `# First Real Tester Send Bundle\n\nStatus: \`${bundle.status}\`\n\nSelected lane: \`${selectedLaneId}\`\n\nExternal send folder: \`${bundle.externalSendFolder}\`\n\nReturn intake folder: \`${bundle.returnIntakeFolder}\`\n\n## Send Files\n\n${markdownList(sendFiles.map((file) => `\`${file.bundlePath}\` (${file.bytes} bytes, sha256 \`${file.sha256}\`)`))}\n\n## Return Intake Files\n\n${markdownList(returnFiles.map((file) => `\`${file.bundlePath}\` (${file.bytes} bytes, sha256 \`${file.sha256}\`)`))}\n\n## Excluded Lanes\n\n${markdownList(excludedLaneIds.map((id) => `\`${id}\``))}\n\n## Preflight Before Manual Send\n\nRun this before contacting the first external person, using the actual running product base URL if it is not \`http://127.0.0.1:3000\`:\n\n\`${bundle.selectedLane.preflightCommand}\`\n\nPreflight evidence: \`${bundle.selectedLane.preflightEvidencePath}\`\n\n## Blocked Actions\n\n${markdownList(bundle.blockedActions.map((action) => `\`${action}\``))}\n\n## Maintainer Rule\n\nThe external person should receive only \`SEND_TO_FIRST_EXTERNAL_PERSON\`. The maintainer keeps \`KEEP_FOR_RETURN_INTAKE\`, \`MAINTAINER_README_DO_NOT_SEND.md\`, and the manifest so the first return can be processed through the workbench and return gate before any widening.\n\n## Boundary\n\n- Release decision: \`${bundle.releaseDecision}\`\n- Accepted: \`${bundle.accepted}\`\n- Packaging gated: \`${bundle.packagingGated}\`\n- Can release: \`${bundle.canRelease}\`\n- Can activate real model: \`${bundle.canActivateRealModel}\`\n- Actual send performed: \`${bundle.actualSendPerformed}\`\n\n## Failed Reasons\n\n${failedReasons.length === 0 ? "- none" : markdownList(failedReasons)}\n\n## Next Action\n\n${bundle.nextAction}\n`;
  fs.writeFileSync(bundleMarkdownPath, markdown, "utf8");

  console.log(JSON.stringify(bundle, null, 2));
  console.log(`\nFirst real tester send bundle written to ${bundleDir}`);
  if (bundle.status !== "ready_to_send_chosen_lane") process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

export {};
