import { NextResponse } from "next/server";
import type { ExecutionOutput, TraceStepRecord } from "@/lib/types";
import { extractRuleFromExecutionHistory } from "@/server/corrections/history-lesson-extractor";
import { memoryStore } from "@/server/memory/memory-store";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    runId?: string;
    apprenticeId?: string;
    taskId?: string;
  };

  if (!body.runId) {
    return NextResponse.json({ error: "runId is required." }, { status: 400 });
  }

  const run = await memoryStore.getRunProfile(body.runId);
  if (!run) {
    return NextResponse.json({ error: "Execution run not found." }, { status: 404 });
  }

  if (body.apprenticeId && run.apprenticeId !== body.apprenticeId) {
    return NextResponse.json({ error: "Run does not belong to this apprentice." }, { status: 400 });
  }

  if (body.taskId && run.taskId !== body.taskId) {
    return NextResponse.json({ error: "Run does not belong to this task." }, { status: 400 });
  }

  const input = parseJson<{ rawTravelNote?: string }>(run.input, {});
  const output = parseJson<ExecutionOutput | null>(run.output, null);
  const trace = parseJson<TraceStepRecord[]>(run.trace, []);

  if (!output || trace.length === 0) {
    return NextResponse.json(
      { error: "Run must contain output and trace evidence before it can become memory." },
      { status: 400 }
    );
  }

  const rule = extractRuleFromExecutionHistory({
    runId: run.id,
    apprenticeId: run.apprenticeId,
    taskId: run.taskId,
    input: input.rawTravelNote ?? run.input,
    output,
    trace
  });

  await memoryStore.saveRule(rule);

  return NextResponse.json({
    rule,
    historyLesson: {
      runId: run.id,
      traceSteps: trace.length,
      reviewPoints: trace.filter((step) => step.needsHumanReview).length,
      memoryState: rule.enabled ? "active" : "paused"
    }
  });
}
