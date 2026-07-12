import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

type SmokeCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

const root = process.cwd();
const args = parseCliArgs(process.argv.slice(2));

function parseCliArgs(argv: string[]) {
  const parsed = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }

    const raw = arg.slice(2);
    if (raw.includes("=")) {
      const [key, ...value] = raw.split("=");
      parsed.set(key, value.join("="));
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      parsed.set(raw, next);
      index += 1;
    }
  }

  return parsed;
}

function latestPreviewPackageDir() {
  const packageRoot = join(root, "qa", "preview-packages");
  if (!existsSync(packageRoot)) {
    return "";
  }

  const dirs = readdirSync(packageRoot)
    .filter((name) => name.startsWith("transparent-ai-apprentice-mcp-preview-") && !name.endsWith(".zip"))
    .map((name) => join(packageRoot, name))
    .filter((candidate) => statSync(candidate).isDirectory())
    .sort();

  return dirs.at(-1) ?? "";
}

function readIfExists(path: string) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function findFiles(dir: string, suffix: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...findFiles(entryPath, suffix));
    } else if (entry.name.endsWith(suffix)) {
      found.push(entryPath);
    }
  }
  return found;
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  return { response, text, parsed };
}

async function readResponseText(response: Response) {
  try {
    return { text: await response.text(), error: "" };
  } catch (error) {
    return { text: "", error: error instanceof Error ? error.message : String(error) };
  }
}

function push(checks: SmokeCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

async function main() {
  const baseUrl = (args.get("base-url") ?? process.env.PREVIEW_BASE_URL ?? "http://127.0.0.1:3091").replace(/\/$/, "");
  const packageDir = args.get("package-dir") ?? process.env.PREVIEW_PACKAGE_DIR ?? latestPreviewPackageDir();
  const taskPath = "/tasks/task-photo-travel-journal";
  const checks: SmokeCheck[] = [];

  const pageResponse = await fetch(`${baseUrl}${taskPath}`, { method: "GET" });
  const pageBody = await readResponseText(pageResponse.clone());
  push(checks, "Task page returns 200", pageResponse.status === 200, `${taskPath} -> ${pageResponse.status}`);
  push(
    checks,
    "Task page response is usable size",
    pageResponse.status === 200 && pageBody.error === "" && pageBody.text.length > 1000 && pageBody.text.length < 5_000_000,
    pageBody.error ? `read error=${pageBody.error}` : `bytes=${pageBody.text.length}`
  );

  const qualification = await fetchJson(`${baseUrl}/api/tasks/task-photo-travel-journal/qualification`);
  const qualificationRecord = qualification.parsed as
    | {
        responseMode?: string;
        status?: string;
        packaging?: { accepted?: boolean; gated?: boolean };
        summary?: Record<string, unknown>;
      }
    | null;
  push(
    checks,
    "Qualification API stays review-only",
    qualification.response.status === 200 &&
      qualificationRecord?.status === "qualified_for_teacher_review" &&
      qualificationRecord.packaging?.accepted === false &&
      qualificationRecord.packaging?.gated === true,
    `status=${qualificationRecord?.status}; accepted=${qualificationRecord?.packaging?.accepted}; gated=${qualificationRecord?.packaging?.gated}`
  );
  push(
    checks,
    "Qualification API uses compact summary response",
    qualification.response.status === 200 &&
      qualificationRecord?.responseMode === "qualification_summary_json_v1" &&
      qualification.text.length < 250_000,
    `mode=${qualificationRecord?.responseMode}; bytes=${qualification.text.length}`
  );

  const trialPayload = {
    apprenticeId: "apprentice-photo-journal",
    taskId: "task-photo-travel-journal",
    nextReviewPlan: "Preview smoke saved trial feedback; packaging remains locked.",
    items: [
      {
        id: `smoke-task-${Date.now()}`,
        label: "Smoke task detail",
        route: taskPath,
        expectedEvidence: "Task page loads and trial receipt is bundled.",
        decision: "works",
        note: "Automated preview smoke."
      },
      {
        id: `smoke-export-${Date.now()}`,
        label: "Smoke review export",
        route: taskPath,
        expectedEvidence: "Review exports remain locked.",
        decision: "not_tried",
        note: "Left for teacher review."
      }
    ]
  };
  const trial = await fetchJson(`${baseUrl}/api/teacher-trial-feedback-drafts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trialPayload)
  });
  const trialRecord = trial.parsed as
    | {
        draft?: { errorType?: string; learningTrace?: unknown[]; afterOutput?: { followUpItems?: unknown[] } };
        ruleEnabled?: boolean;
        accepted?: boolean;
        packagingGated?: boolean;
        mode?: string;
      }
    | null;
  push(
    checks,
    "Trial feedback POST saves locked draft",
    trial.response.status === 200 &&
      trialRecord?.draft?.errorType === "teacher_trial_feedback_draft" &&
      trialRecord.ruleEnabled === false &&
      trialRecord.accepted === false &&
      trialRecord.packagingGated === true,
    `status=${trial.response.status}; errorType=${trialRecord?.draft?.errorType}; trace=${trialRecord?.draft?.learningTrace?.length ?? 0}; followUps=${trialRecord?.draft?.afterOutput?.followUpItems?.length ?? 0}`
  );

  const qualificationAfterTrial = await fetchJson(`${baseUrl}/api/tasks/task-photo-travel-journal/qualification`);
  const qualificationAfterTrialRecord = qualificationAfterTrial.parsed as
    | {
        responseMode?: string;
        status?: string;
        packaging?: { accepted?: boolean; gated?: boolean };
      }
    | null;
  push(
    checks,
    "Qualification API stays ready after trial feedback",
    qualificationAfterTrial.response.status === 200 &&
      qualificationAfterTrialRecord?.responseMode === "qualification_summary_json_v1" &&
      qualificationAfterTrialRecord?.status === "qualified_for_teacher_review" &&
      qualificationAfterTrialRecord.packaging?.accepted === false &&
      qualificationAfterTrialRecord.packaging?.gated === true,
    `mode=${qualificationAfterTrialRecord?.responseMode}; status=${qualificationAfterTrialRecord?.status}; accepted=${qualificationAfterTrialRecord?.packaging?.accepted}; gated=${qualificationAfterTrialRecord?.packaging?.gated}; bytes=${qualificationAfterTrial.text.length}`
  );

  const appBuildManifest = readIfExists(join(packageDir, ".next", "app-build-manifest.json"));
  const appPathManifest = readIfExists(join(packageDir, ".next", "app-path-routes-manifest.json"));
  const apiRoute = readIfExists(join(packageDir, ".next", "server", "app", "api", "teacher-trial-feedback-drafts", "route.js"));
  const taskChunks = findFiles(join(packageDir, ".next", "static", "chunks", "app", "tasks"), ".js");
  const taskChunkWithPanel = taskChunks.find((path) => {
    const source = readIfExists(path);
    return source.includes("Hands-on trial receipt") && source.includes("/api/teacher-trial-feedback-drafts");
  });

  push(
    checks,
    "Package includes trial feedback API route",
    appBuildManifest.includes("/api/teacher-trial-feedback-drafts/route") &&
      appPathManifest.includes("/api/teacher-trial-feedback-drafts") &&
      apiRoute.includes("teacher_trial_feedback_draft"),
    packageDir ? `packageDir=${packageDir}` : "packageDir missing"
  );
  push(
    checks,
    "Package includes trial feedback client panel",
    Boolean(taskChunkWithPanel),
    taskChunkWithPanel ? `chunk=${taskChunkWithPanel}` : "task chunk marker missing"
  );

  const passed = checks.filter((check) => check.pass).length;
  const output = {
    status: passed === checks.length ? "passed" : "failed",
    passed,
    total: checks.length,
    baseUrl,
    packageDir,
    checks
  };

  console.log(JSON.stringify(output, null, 2));

  if (passed !== checks.length) {
    process.exitCode = 1;
  }
}

void main();
