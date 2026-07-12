import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type FeedbackCollection = {
  responseMode?: string;
  status?: string;
  generatedAt?: string;
  command?: string;
  inboxDir?: string;
  totalReceipts?: number;
  validReceipts?: number;
  invalidReceipts?: number;
  decisionCounts?: Record<string, number>;
  releaseDecision?: string;
  reviewOnly?: boolean;
  accepted?: boolean;
  packagingGated?: boolean;
  receipts?: Array<{
    file?: string;
    valid?: boolean;
    testerName?: string;
    testerDate?: string;
    betaDecision?: string;
    blocker?: string;
    nextActionRecommendation?: string;
    failedChecks?: string[];
  }>;
  nextAction?: string;
};

type LaunchPreflightGate = {
  requiredImmediatelyBeforeContact: true;
  command: string;
  evidencePath: string;
  stopIf: string;
};

type FollowUpAction = {
  id: string;
  lane: "tester_intake" | "fix_planning" | "blocker_review" | "receipt_hygiene" | "release_lock";
  title: string;
  evidencePath: string;
  command: string;
  continueCondition: string;
  stopCondition: string;
  owner: "maintainer" | "tester" | "reviewer";
  launchPreflight?: LaunchPreflightGate;
};

const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const defaultCollectionPath = path.join(artifactsDir, "public-beta-feedback-collection.json");
const defaultOutputPath = path.join(artifactsDir, "public-beta-follow-up-plan.json");
const testerLaunchPreflight: LaunchPreflightGate = {
  requiredImmediatelyBeforeContact: true,
  command: "npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000",
  evidencePath: "artifacts/productization/public-beta-tester-session-preflight.json",
  stopIf: "Do not contact a tester if the live preflight is missing, stale, failed, or releaseDecision is not do_not_release."
};

function getArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}.`);
  }
  return path.resolve(process.cwd(), value);
}

function readCollection(collectionPath: string): FeedbackCollection | null {
  try {
    return JSON.parse(fs.readFileSync(collectionPath, "utf8")) as FeedbackCollection;
  } catch {
    return null;
  }
}

function rel(targetPath: string) {
  return path.relative(process.cwd(), targetPath).replaceAll("\\", "/");
}

function action(action: FollowUpAction): FollowUpAction {
  return action;
}

export function buildPublicBetaFollowUpPlan(args: {
  collectionPath?: string;
  outputPath?: string;
}) {
  const collectionPath = args.collectionPath ?? defaultCollectionPath;
  const outputPath = args.outputPath ?? defaultOutputPath;
  const collection = readCollection(collectionPath);
  const collectionStatus = collection?.status ?? "missing_collection";
  const counts = {
    totalReceipts: collection?.totalReceipts ?? 0,
    validReceipts: collection?.validReceipts ?? 0,
    invalidReceipts: collection?.invalidReceipts ?? 0,
    readyForNextTester: collection?.decisionCounts?.ready_for_next_beta_tester ?? 0,
    needsFix: collection?.decisionCounts?.needs_fix_before_more_testers ?? 0,
    blocked: collection?.decisionCounts?.blocked ?? 0
  };
  const invalidReceipts = (collection?.receipts ?? []).filter((receipt) => receipt.valid === false);
  const blockerReceipts = (collection?.receipts ?? []).filter(
    (receipt) => receipt.valid === true && receipt.betaDecision === "blocked"
  );
  const needsFixReceipts = (collection?.receipts ?? []).filter(
    (receipt) => receipt.valid === true && receipt.betaDecision === "needs_fix_before_more_testers"
  );

  const status =
    collectionStatus === "ready_for_next_beta_tester"
      ? "ready_for_next_beta_tester"
      : collectionStatus === "waiting_for_feedback"
        ? "waiting_for_feedback"
        : collectionStatus === "has_invalid_feedback"
          ? "invalid_feedback"
          : collectionStatus === "blocked_by_beta_feedback"
            ? "blocked_by_beta_feedback"
            : collectionStatus === "needs_fix_before_more_testers"
              ? "needs_fix_before_more_testers"
              : "missing_collection";

  const canInviteNextTester = status === "waiting_for_feedback" || status === "ready_for_next_beta_tester";
  const actions: FollowUpAction[] = [];

  if (status === "missing_collection") {
    actions.push(
      action({
        id: "collect-feedback-inbox",
        lane: "receipt_hygiene",
        title: "Collect the current public beta feedback inbox before planning more tester intake.",
        evidencePath: rel(collectionPath),
        command: "npm run collect:public-beta-feedback",
        continueCondition: "A public_beta_feedback_collection_json_v1 receipt exists with reviewOnly=true.",
        stopCondition: "Collection is missing or cannot be parsed.",
        owner: "maintainer"
      })
    );
  }

  if (status === "waiting_for_feedback") {
    actions.push(
      action({
        id: "invite-first-bounded-beta-tester",
        lane: "tester_intake",
        title: "Run live tester preflight, then invite one bounded beta tester using the public beta packet.",
        evidencePath: "artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md",
        command: testerLaunchPreflight.command,
        continueCondition:
          "The live preflight passes immediately before contact; then the tester returns a filled feedback receipt, a filled whole-session receipt, and real /manual-test human review evidence.",
        stopCondition:
          "The live preflight is missing, stale, failed, changes the release lock, or the tester reports a blocker, invalid receipt, or release/all-software confusion.",
        owner: "maintainer",
        launchPreflight: testerLaunchPreflight
      })
    );
  }

  if (status === "ready_for_next_beta_tester") {
    actions.push(
      action({
        id: "invite-next-bounded-beta-tester",
        lane: "tester_intake",
        title: "Run live tester preflight, then proceed to one more bounded beta tester.",
        evidencePath: rel(collectionPath),
        command: testerLaunchPreflight.command,
        continueCondition:
          "The live preflight passes immediately before contact; then the next tester also returns ready_for_next_beta_tester with no invalid receipts.",
        stopCondition:
          "The live preflight is missing, stale, failed, changes the release lock, or any tester returns needs_fix_before_more_testers, blocked, or invalid feedback.",
        owner: "maintainer",
        launchPreflight: testerLaunchPreflight
      })
    );
  }

  if (invalidReceipts.length > 0 || status === "invalid_feedback") {
    actions.push(
      action({
        id: "repair-invalid-feedback-receipts",
        lane: "receipt_hygiene",
        title: "Repair or discard invalid feedback receipts before using feedback for planning.",
        evidencePath: rel(collectionPath),
        command: "npm run verify:public-beta-feedback -- --receipt <path>",
        continueCondition: "Every receipt is parseable, submitted, locked, and has complete tester/core-loop fields.",
        stopCondition: "Any invalid receipt remains in the inbox.",
        owner: "maintainer"
      })
    );
  }

  if (needsFixReceipts.length > 0 || status === "needs_fix_before_more_testers") {
    actions.push(
      action({
        id: "plan-beta-fixes-before-more-testers",
        lane: "fix_planning",
        title: "Plan fixes from beta feedback before inviting more testers.",
        evidencePath: rel(collectionPath),
        command: "npm run collect:public-beta-feedback",
        continueCondition: "Fixes are implemented, product verification passes, and the refreshed feedback plan allows tester intake.",
        stopCondition: "A confusing behavior or missing product behavior remains unresolved.",
        owner: "maintainer"
      })
    );
  }

  if (blockerReceipts.length > 0 || status === "blocked_by_beta_feedback") {
    actions.push(
      action({
        id: "review-beta-blockers",
        lane: "blocker_review",
        title: "Stop tester intake and review blocking beta feedback.",
        evidencePath: rel(collectionPath),
        command: "npm run verify:product-release-readiness -- --allow-blocked",
        continueCondition: "The blocker has a fix or explicit non-release follow-up decision.",
        stopCondition: "The blocker is unresolved or could affect the bounded core teaching loop.",
        owner: "reviewer"
      })
    );
  }

  actions.push(
    action({
      id: "preserve-release-and-packaging-locks",
      lane: "release_lock",
      title: "Keep beta feedback separate from product acceptance, packaging, and release approval.",
      evidencePath: rel(outputPath),
      command: "npm run verify:product-release-readiness -- --allow-blocked",
      continueCondition: "releaseDecision remains do_not_release and accepted remains false.",
      stopCondition: "Any follow-up action claims acceptance, enables packaging, or resumes all-software scope.",
      owner: "reviewer"
    })
  );

  const plan = {
    responseMode: "public_beta_follow_up_plan_json_v1",
    status,
    generatedAt: new Date().toISOString(),
    command:
      outputPath === defaultOutputPath && collectionPath === defaultCollectionPath
        ? "npm run plan:public-beta-follow-up"
        : `npm run plan:public-beta-follow-up -- --collection ${rel(collectionPath)} --out ${rel(outputPath)}`,
    sourceCollectionPath: rel(collectionPath),
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canInviteNextTester,
    testerLaunchGate: canInviteNextTester ? testerLaunchPreflight : null,
    counts,
    invalidReceipts: invalidReceipts.map((receipt) => ({
      file: receipt.file ?? "",
      failedChecks: receipt.failedChecks ?? []
    })),
    blockerReceipts: blockerReceipts.map((receipt) => ({
      file: receipt.file ?? "",
      testerName: receipt.testerName ?? "",
      blocker: receipt.blocker ?? ""
    })),
    needsFixReceipts: needsFixReceipts.map((receipt) => ({
      file: receipt.file ?? "",
      testerName: receipt.testerName ?? "",
      nextActionRecommendation: receipt.nextActionRecommendation ?? ""
    })),
    actions,
    nextAction:
      status === "ready_for_next_beta_tester"
        ? "Run the live tester preflight, then invite one more bounded beta tester; do not unlock release or packaging."
        : status === "waiting_for_feedback"
          ? "Run the live tester preflight, then invite the first bounded beta tester and collect both filled feedback and whole-session receipts."
          : status === "invalid_feedback"
            ? "Fix invalid feedback receipts before more tester intake."
            : status === "blocked_by_beta_feedback"
              ? "Stop tester intake and review the blocking feedback."
              : status === "needs_fix_before_more_testers"
                ? "Fix beta feedback issues before more tester intake."
                : "Run npm run collect:public-beta-feedback before planning tester intake.",
    locks: {
      mustNotSaveAcceptance: true,
      mustNotEnableRules: true,
      mustNotUnlockPackaging: true,
      mustNotClaimReleaseReady: true,
      mustNotResumeAllSoftwareObjective: true
    }
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(plan, null, 2));
  return plan;
}

function main() {
  const plan = buildPublicBetaFollowUpPlan({
    collectionPath: getArg("--collection") ?? defaultCollectionPath,
    outputPath: getArg("--out") ?? defaultOutputPath
  });
  console.log(JSON.stringify(plan, null, 2));
  console.log(`\nPublic beta follow-up plan written to ${getArg("--out") ?? defaultOutputPath}`);
}

const currentFile = fileURLToPath(import.meta.url);
if (path.resolve(process.argv[1] ?? "") === currentFile) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

export {};
