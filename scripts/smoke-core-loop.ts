import { prisma } from "../src/server/db/prisma";

type JsonObject = Record<string, unknown>;

type RunResponse = {
  id: string;
  input: string;
  taskId: string;
  apprenticeId: string;
  status: string;
  output: {
    lightingCondition?: string;
    photographyAdvice?: string[];
  };
  trace: Array<{
    id: string;
    stepName: string;
    appliedRules: Array<{ id: string; title: string }>;
    needsHumanReview: boolean;
  }>;
};

type CorrectionResponse = {
  errorType: string;
  extractedRule: {
    id: string;
    title: string;
    enabled: boolean;
    confidence: number;
  };
  applyAutomatically: boolean;
  requiresHumanConfirmation: boolean;
  learningTrace: Array<{ id: string; label: string; validation: string }>;
};

type SmokeCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

type SmokeRecords = {
  apprenticeId?: string;
  taskId?: string;
  workflowId?: string;
  firstRunId?: string;
  secondRunId?: string;
  learnedRuleId?: string;
};

const baseUrl = getArg("--base-url") ?? process.env.PRODUCT_SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const keepRecords = process.argv.includes("--keep-records");

function getArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

async function postJson<T>(path: string, body: JsonObject) {
  const response = await fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json()) as T | { error?: string };

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${JSON.stringify(payload)}`);
  }

  return payload as T;
}

function push(checks: SmokeCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

function isLocalBaseUrl(value: string) {
  try {
    const url = new URL(value);
    return ["127.0.0.1", "localhost"].includes(url.hostname);
  } catch {
    return false;
  }
}

async function cleanupSmokeRecords(records: SmokeRecords) {
  if (!records.apprenticeId || !records.taskId) {
    return { cleaned: false, reason: "Smoke records were not fully created." };
  }

  if (keepRecords) {
    return { cleaned: false, reason: "--keep-records was provided." };
  }

  if (!isLocalBaseUrl(baseUrl)) {
    return { cleaned: false, reason: "Base URL is not localhost; refusing direct local DB cleanup." };
  }

  const runIds = [records.firstRunId, records.secondRunId].filter(Boolean) as string[];

  await prisma.correction.deleteMany({
    where: {
      apprenticeId: records.apprenticeId,
      taskId: records.taskId
    }
  });
  await prisma.traceStep.deleteMany({
    where: {
      runId: { in: runIds }
    }
  });
  await prisma.executionRun.deleteMany({
    where: {
      id: { in: runIds },
      apprenticeId: records.apprenticeId,
      taskId: records.taskId
    }
  });
  await prisma.rule.deleteMany({
    where: {
      apprenticeId: records.apprenticeId,
      taskId: records.taskId,
      ...(records.learnedRuleId ? { id: records.learnedRuleId } : {})
    }
  });

  if (records.workflowId) {
    await prisma.workflowNode.deleteMany({
      where: { workflowId: records.workflowId }
    });
    await prisma.workflow.deleteMany({
      where: {
        id: records.workflowId,
        taskId: records.taskId
      }
    });
  }

  await prisma.task.deleteMany({
    where: {
      id: records.taskId,
      apprenticeId: records.apprenticeId
    }
  });
  await prisma.apprentice.deleteMany({
    where: {
      id: records.apprenticeId,
      name: { startsWith: "Smoke Apprentice " }
    }
  });

  return {
    cleaned: true,
    reason: "Removed smoke apprentice, task, workflow, rule, runs, trace steps, and corrections."
  };
}

async function main() {
  const checks: SmokeCheck[] = [];
  const smokeRecords: SmokeRecords = {};
  let cleanup = { cleaned: false, reason: "Cleanup did not run." };
  const input =
    "Today I visited Lake Geneva at sunset with clear weather, lake reflections, snow mountains, and a portrait subject.";

  try {
    const apprentice = await postJson<{ id: string; name: string }>("/api/apprentices", {
      name: `Smoke Apprentice ${stamp}`,
      description: "Temporary product smoke apprentice for the core teach-correct-rerun loop.",
      domain: "Photography travel writing"
    });
    smokeRecords.apprenticeId = apprentice.id;

    const task = await postJson<{ id: string; workflowId: string }>("/api/tasks", {
      apprenticeId: apprentice.id,
      name: `Smoke photography journal ${stamp}`,
      goal: "Verify the core product loop can run, accept teacher correction, save memory, and rerun with evidence.",
      inputExample: input,
      expectedOutput: "location, weather, subjects, lightingCondition, recommendedTitles, journalBody, photographyAdvice",
      notes: "Smoke task for productization only.",
      errorCases: "Sunset is treated as generic natural light."
    });
    smokeRecords.taskId = task.id;
    smokeRecords.workflowId = task.workflowId;

    const firstRun = await postJson<RunResponse>("/api/runs", {
      apprenticeId: apprentice.id,
      taskId: task.id,
      input
    });
    smokeRecords.firstRunId = firstRun.id;

    push(
      checks,
      "First run is saved with conservative output",
      Boolean(firstRun.id) &&
        firstRun.taskId === task.id &&
        firstRun.apprenticeId === apprentice.id &&
        firstRun.output.lightingCondition === "natural light" &&
        firstRun.trace.length >= 6,
      `run=${firstRun.id}; lighting=${firstRun.output.lightingCondition}; trace=${firstRun.trace.length}`
    );

    const correction = await postJson<CorrectionResponse>("/api/corrections", {
      apprenticeId: apprentice.id,
      taskId: task.id,
      runId: firstRun.id,
      beforeOutput: firstRun.output,
      feedback:
        "When the travel note says sunset, dusk, golden hour, evening sun, or 日落, set lightingCondition to golden hour and recommend warm side light or backlight.",
      memoryPolicy: {
        applyAutomatically: true,
        requiresHumanConfirmation: false
      }
    });
    smokeRecords.learnedRuleId = correction.extractedRule.id;

    push(
      checks,
      "Teacher correction becomes enabled reusable memory",
      correction.errorType === "lighting_condition_rule" &&
        correction.extractedRule.enabled === true &&
        correction.applyAutomatically === true &&
        correction.requiresHumanConfirmation === false &&
        correction.learningTrace.length >= 3,
      `rule=${correction.extractedRule.id}; enabled=${correction.extractedRule.enabled}; trace=${correction.learningTrace.length}`
    );

    const secondRun = await postJson<RunResponse>("/api/runs", {
      apprenticeId: apprentice.id,
      taskId: task.id,
      input
    });
    smokeRecords.secondRunId = secondRun.id;
    const appliedRuleTitles = secondRun.trace.flatMap((step) => step.appliedRules.map((rule) => rule.title));

    push(
      checks,
      "Second run reuses learned memory",
      secondRun.output.lightingCondition === "golden hour" &&
        appliedRuleTitles.includes(correction.extractedRule.title) &&
        (secondRun.output.photographyAdvice ?? []).some((item) => /side light|backlight/i.test(item)),
      `run=${secondRun.id}; lighting=${secondRun.output.lightingCondition}; applied=${appliedRuleTitles.join(", ")}`
    );

    const qualificationResponse = await fetch(new URL(`/api/tasks/${task.id}/qualification`, baseUrl));
    const qualification = (await qualificationResponse.json()) as {
      status?: string;
      packaging?: { gated?: boolean; accepted?: boolean; status?: string };
      summary?: { requirementsPassed?: number; requirementsTotal?: number };
    };

    push(
      checks,
      "Task remains review-only after learning",
      qualificationResponse.ok &&
        qualification.packaging?.gated === true &&
        qualification.packaging.accepted === false &&
        qualification.packaging.status === "pending_teacher_acceptance",
      `status=${qualification.status}; packaging=${JSON.stringify(qualification.packaging)}`
    );
  } finally {
    cleanup = await cleanupSmokeRecords(smokeRecords);
    await prisma.$disconnect();
  }

  const passed = checks.filter((check) => check.pass).length;
  const result = {
    status: passed === checks.length ? "passed" : "failed",
    baseUrl,
    smokeRecords,
    cleanup,
    passed,
    total: checks.length,
    checks
  };

  console.log(JSON.stringify(result, null, 2));

  if (result.status !== "passed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export {};
