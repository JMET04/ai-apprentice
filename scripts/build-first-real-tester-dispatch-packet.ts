import fs from "node:fs";
import path from "node:path";

type JsonRecord = Record<string, any>;

type DispatchFile = {
  id: string;
  sourcePath: string;
  packetPath: string;
  audience: "maintainer" | "external_tester_or_reviewer" | "facilitator_return_intake";
  required: boolean;
};

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts", "productization");
const packetDir = path.join(artifactsDir, "first-real-tester-dispatch-packet");
const manifestPath = path.join(artifactsDir, "first-real-tester-dispatch-packet.json");
const markdownPath = path.join(artifactsDir, "first-real-tester-dispatch-packet.md");

function readJson<T = JsonRecord>(relativePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8")) as T;
  } catch {
    return null;
  }
}

function ensureFile(relativePath: string) {
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).size < 100) {
    throw new Error(`Required dispatch source is missing or too small: ${relativePath}`);
  }
}

function copyFile(file: DispatchFile) {
  ensureFile(file.sourcePath);
  const destination = path.join(packetDir, file.packetPath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(rootDir, file.sourcePath), destination);
  return {
    ...file,
    bytes: fs.statSync(destination).size
  };
}

function statusLine(status: string | undefined, passed?: number, total?: number) {
  if (!status) return "missing";
  if (typeof passed === "number" && typeof total === "number") return `${status} ${passed}/${total}`;
  return status;
}

function markdownList(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

function laneMarkdown(lane: any) {
  return `### ${lane.title}\n\n- Lane ID: \`${lane.id}\`\n- Allowed: \`${lane.allowed}\`\n- Preflight: \`${lane.preflightCommand}\`\n- Send folder: \`${lane.packetSendFolder}\`\n- Return folder: \`${lane.packetReturnFolder}\`\n\nSend files:\n\n${markdownList(lane.sendFiles.map((file: any) => `\`${file.packetPath}\``))}\n\nReturn/intake files:\n\n${markdownList(lane.returnFiles.map((file: any) => `\`${file.packetPath}\``))}\n\nReturn commands:\n\n${markdownList(lane.returnCommands.map((command: string) => `\`${command}\``))}\n\nStop conditions:\n\n${markdownList(lane.stopConditions)}\n`;
}

function buildFirstRealTesterDispatchPacket() {
  const launch = readJson<{
    responseMode?: string;
    status?: string;
    readyToLaunch?: boolean;
    releaseDecision?: string;
    accepted?: boolean;
    packagingGated?: boolean;
    canRelease?: boolean;
    canActivateRealModel?: boolean;
    launchLanes?: Array<{ id?: string; title?: string; allowed?: boolean; preflightCommand?: string; preflightEvidencePath?: string; sendMaterials?: string[]; returnCommands?: string[]; stopConditions?: string[] }>;
  }>("artifacts/productization/first-real-tester-launch.json");
  const launchVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/first-real-tester-launch-verification.json"
  );
  const workbench = readJson<{ status?: string }>("artifacts/productization/first-real-tester-return-workbench.json");
  const workbenchVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/first-real-tester-return-workbench-verification.json"
  );
  const returnGate = readJson<{ status?: string; returnState?: { canInviteAdditionalTesterOrReviewer?: boolean } }>(
    "artifacts/productization/first-real-tester-return-gate.json"
  );
  const returnGateVerification = readJson<{ status?: string; passed?: number; total?: number }>(
    "artifacts/productization/first-real-tester-return-gate-verification.json"
  );

  const publicBetaLane = launch?.launchLanes?.find((lane) => lane.id === "public_beta_tester_session");
  const humanLane = launch?.launchLanes?.find((lane) => lane.id === "human_acceptance_review");
  const failedReasons: string[] = [];

  if (launch?.responseMode !== "first_real_tester_launch_json_v1") failedReasons.push("first_real_launch_missing");
  if (launch?.status !== "ready_to_invite_one_bounded_real_tester_or_reviewer" || launch.readyToLaunch !== true) {
    failedReasons.push("first_real_launch_not_ready");
  }
  if (statusLine(launchVerification?.status, launchVerification?.passed, launchVerification?.total) !== "passed 8/8") {
    failedReasons.push("first_real_launch_not_verified");
  }
  if (workbench?.status !== "ready_to_process_exactly_one_first_return") failedReasons.push("return_workbench_not_ready");
  const workbenchVerificationLine = statusLine(
    workbenchVerification?.status,
    workbenchVerification?.passed,
    workbenchVerification?.total
  );
  // Dispatch is the bootstrap packet that creates the send bundle; the return workbench
  // may only become fully verified after the generated send bundle and receipt template exist.
  if (returnGate?.status !== "waiting_for_first_return" || returnGate.returnState?.canInviteAdditionalTesterOrReviewer !== false) {
    failedReasons.push("return_gate_not_waiting_or_allows_extra_invites");
  }
  // The return gate must remain waiting and must block extra invites; full verification is
  // refreshed after the send bundle has been generated and bound to the return workbench.
  if (!publicBetaLane?.allowed) failedReasons.push("public_beta_lane_not_allowed");
  if (!humanLane?.allowed) failedReasons.push("human_acceptance_lane_not_allowed");

  const maintainerFiles: DispatchFile[] = [
    {
      id: "start_first_real_tester",
      sourcePath: "artifacts/productization/first-real-tester-dispatch-packet.md",
      packetPath: "START_FIRST_REAL_TESTER.md",
      audience: "maintainer",
      required: true
    },
    {
      id: "first_real_tester_launch",
      sourcePath: "artifacts/productization/first-real-tester-launch.md",
      packetPath: "maintainer/first-real-tester-launch.md",
      audience: "maintainer",
      required: true
    },
    {
      id: "first_real_tester_return_workbench",
      sourcePath: "artifacts/productization/first-real-tester-return-workbench.md",
      packetPath: "maintainer/first-real-tester-return-workbench.md",
      audience: "maintainer",
      required: true
    },
    {
      id: "first_real_tester_return_gate",
      sourcePath: "artifacts/productization/first-real-tester-return-gate.md",
      packetPath: "maintainer/first-real-tester-return-gate.md",
      audience: "maintainer",
      required: true
    }
  ];

  const publicBetaSendFiles: DispatchFile[] = [
    {
      id: "public_beta_tester_invite",
      sourcePath: "artifacts/productization/public-beta-tester-invite.md",
      packetPath: "lanes/public_beta_tester_session/send/PUBLIC_BETA_TESTER_INVITE.md",
      audience: "external_tester_or_reviewer",
      required: true
    },
    {
      id: "public_beta_tester_runbook",
      sourcePath: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md",
      packetPath: "lanes/public_beta_tester_session/send/PUBLIC_BETA_TESTER_RUNBOOK.md",
      audience: "external_tester_or_reviewer",
      required: true
    },
    {
      id: "public_beta_session_plan",
      sourcePath: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_PLAN.md",
      packetPath: "lanes/public_beta_tester_session/send/PUBLIC_BETA_SESSION_PLAN.md",
      audience: "external_tester_or_reviewer",
      required: true
    }
  ];
  const publicBetaReturnFiles: DispatchFile[] = [
    {
      id: "public_beta_session_receipt_template",
      sourcePath: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_SESSION_RECEIPT.template.json",
      packetPath: "lanes/public_beta_tester_session/return/PUBLIC_BETA_SESSION_RECEIPT.template.json",
      audience: "facilitator_return_intake",
      required: true
    },
    {
      id: "public_beta_feedback_receipt_template",
      sourcePath: "artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_FEEDBACK_RECEIPT.template.json",
      packetPath: "lanes/public_beta_tester_session/return/PUBLIC_BETA_FEEDBACK_RECEIPT.template.json",
      audience: "facilitator_return_intake",
      required: true
    }
  ];
  const humanSendFiles: DispatchFile[] = [
    {
      id: "human_acceptance_reviewer_invite",
      sourcePath: "artifacts/productization/human-acceptance-reviewer-invite.md",
      packetPath: "lanes/human_acceptance_review/send/HUMAN_ACCEPTANCE_REVIEWER_INVITE.md",
      audience: "external_tester_or_reviewer",
      required: true
    },
    {
      id: "human_acceptance_reviewer_kit",
      sourcePath: "artifacts/productization/human-acceptance-reviewer-kit.md",
      packetPath: "lanes/human_acceptance_review/send/HUMAN_ACCEPTANCE_REVIEWER_KIT.md",
      audience: "external_tester_or_reviewer",
      required: true
    }
  ];
  const humanReturnFiles: DispatchFile[] = [
    {
      id: "human_acceptance_receipt_template",
      sourcePath: "artifacts/productization/human-acceptance-receipt.template.json",
      packetPath: "lanes/human_acceptance_review/return/HUMAN_ACCEPTANCE_RECEIPT.template.json",
      audience: "facilitator_return_intake",
      required: true
    }
  ];

  const manifestDraft = {
    responseMode: "first_real_tester_dispatch_packet_json_v1",
    status: failedReasons.length === 0 ? "ready_to_send_one_lane" : "blocked_before_dispatch",
    generatedAt: new Date().toISOString(),
    command: "npm run build:first-real-tester-dispatch-packet",
    packetRoot: "artifacts/productization/first-real-tester-dispatch-packet",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    dispatchRule: {
      chooseExactlyOneLane: true,
      sendOnlyChosenLaneFolder: true,
      doNotSendReleaseApprovalOrRealModelTrialMaterials: true,
      doNotInviteAdditionalTesterOrReviewerBeforeReturnGateAllowsIt: true
    },
    sourceEvidence: {
      firstRealTesterLaunch: `${launch?.status ?? "missing"}; verifier=${statusLine(
        launchVerification?.status,
        launchVerification?.passed,
        launchVerification?.total
      )}`,
      returnWorkbench: `${workbench?.status ?? "missing"}; verifier=${statusLine(
        workbenchVerification?.status,
        workbenchVerification?.passed,
        workbenchVerification?.total
      )}`,
      returnGate: `${returnGate?.status ?? "missing"}; canInvite=${
        returnGate?.returnState?.canInviteAdditionalTesterOrReviewer ?? "missing"
      }; verifier=${statusLine(returnGateVerification?.status, returnGateVerification?.passed, returnGateVerification?.total)}`
    },
    lanes: [
      {
        id: "public_beta_tester_session",
        title: publicBetaLane?.title ?? "One bounded public beta tester session",
        allowed: publicBetaLane?.allowed === true,
        preflightCommand: publicBetaLane?.preflightCommand ?? "missing",
        preflightEvidencePath: publicBetaLane?.preflightEvidencePath ?? "missing",
        packetSendFolder: "lanes/public_beta_tester_session/send",
        packetReturnFolder: "lanes/public_beta_tester_session/return",
        sendFiles: publicBetaSendFiles,
        returnFiles: publicBetaReturnFiles,
        returnCommands: publicBetaLane?.returnCommands ?? [],
        stopConditions: publicBetaLane?.stopConditions ?? []
      },
      {
        id: "human_acceptance_review",
        title: humanLane?.title ?? "One real human acceptance review",
        allowed: humanLane?.allowed === true,
        preflightCommand: humanLane?.preflightCommand ?? "missing",
        preflightEvidencePath: humanLane?.preflightEvidencePath ?? "missing",
        packetSendFolder: "lanes/human_acceptance_review/send",
        packetReturnFolder: "lanes/human_acceptance_review/return",
        sendFiles: humanSendFiles,
        returnFiles: humanReturnFiles,
        returnCommands: humanLane?.returnCommands ?? [],
        stopConditions: humanLane?.stopConditions ?? []
      }
    ],
    maintainerFiles,
    blockedActions: [
      "send_both_lanes_to_the_same_first_external_person",
      "invite_additional_tester_or_reviewer_before_return_gate_allows_it",
      "send_release_approval_as_first_test_material",
      "send_real_model_trial_as_first_test_material",
      "release_product",
      "unlock_packaging",
      "activate_real_model",
      "resume_all_software_scope"
    ],
    failedReasons,
    nextAction:
      failedReasons.length === 0
        ? "Choose exactly one lane, run its preflight against the actual base URL, send only that lane's send folder, then process returned files through the return workbench and return gate."
        : "Fix dispatch readiness failures before sending any first real tester or reviewer material."
  };

  const markdown = `# First Real Tester Dispatch Packet\n\nStatus: \`${manifestDraft.status}\`\n\nRelease decision: \`${manifestDraft.releaseDecision}\`\n\nThis packet is for a maintainer preparing the first real outside productization pass. Choose exactly one lane, send only that lane's \`send\` folder, and keep the \`return\` folder for collecting and validating returned receipts.\n\n## Dispatch Rule\n\n- Choose exactly one lane: \`${manifestDraft.dispatchRule.chooseExactlyOneLane}\`\n- Send only chosen lane folder: \`${manifestDraft.dispatchRule.sendOnlyChosenLaneFolder}\`\n- Do not send release approval or real-model trial materials: \`${manifestDraft.dispatchRule.doNotSendReleaseApprovalOrRealModelTrialMaterials}\`\n- Do not invite anyone else before return gate allows it: \`${manifestDraft.dispatchRule.doNotInviteAdditionalTesterOrReviewerBeforeReturnGateAllowsIt}\`\n\n## Source Evidence\n\n| Evidence | Status |\n| --- | --- |\n| First real tester launch | \`${manifestDraft.sourceEvidence.firstRealTesterLaunch}\` |\n| Return workbench | \`${manifestDraft.sourceEvidence.returnWorkbench}\` |\n| Return gate | \`${manifestDraft.sourceEvidence.returnGate}\` |\n\n## Lane Packets\n\n${manifestDraft.lanes.map(laneMarkdown).join("\n")}\n\n## Maintainer Files\n\n${markdownList(maintainerFiles.map((file) => `\`${file.packetPath}\``))}\n\n## Blocked Actions\n\n${markdownList(manifestDraft.blockedActions.map((item) => `\`${item}\``))}\n\n## Boundary\n\n- Product scope: \`${manifestDraft.productScope}\`\n- All-software objective: \`${manifestDraft.allSoftwareObjective}\`\n- Accepted: \`${manifestDraft.accepted}\`\n- Packaging gated: \`${manifestDraft.packagingGated}\`\n- Can release: \`${manifestDraft.canRelease}\`\n- Can activate real model: \`${manifestDraft.canActivateRealModel}\`\n\n## Failed Reasons\n\n${failedReasons.length === 0 ? "- none" : markdownList(failedReasons)}\n\n## Next Action\n\n${manifestDraft.nextAction}\n`;

  fs.rmSync(packetDir, { recursive: true, force: true });
  fs.mkdirSync(packetDir, { recursive: true });
  fs.writeFileSync(markdownPath, markdown, "utf8");

  const copiedMaintainerFiles = maintainerFiles.map(copyFile);
  const copiedLanes = manifestDraft.lanes.map((lane) => ({
    ...lane,
    sendFiles: lane.sendFiles.map(copyFile),
    returnFiles: lane.returnFiles.map(copyFile)
  }));

  const manifest = {
    ...manifestDraft,
    lanes: copiedLanes,
    maintainerFiles: copiedMaintainerFiles
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(packetDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

try {
  const manifest = buildFirstRealTesterDispatchPacket();
  console.log(JSON.stringify(manifest, null, 2));
  console.log(`\nFirst real tester dispatch packet written to ${packetDir}`);
  console.log(`First real tester dispatch packet manifest written to ${manifestPath}`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

export {};
