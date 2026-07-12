import { NextResponse } from "next/server";
import { demoApprentice, demoTask } from "@/lib/demo-data";
import type { MemoryApplicationPolicy, StructuredFeedbackRecord } from "@/lib/types";
import { getAIService } from "@/server/ai/service";
import { memoryStore } from "@/server/memory/memory-store";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    feedback?: string;
    beforeOutput?: unknown;
    structuredFeedback?: StructuredFeedbackRecord;
    memoryPolicy?: MemoryApplicationPolicy;
    apprenticeId?: string;
    taskId?: string;
    runId?: string;
  };
  const task = body.taskId ? await memoryStore.getTaskProfile(body.taskId) : null;
  if (body.taskId && !task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  const apprenticeId = body.apprenticeId ?? task?.apprenticeId ?? demoApprentice.id;
  const taskId = task?.id ?? body.taskId ?? demoTask.id;

  if (task && task.apprenticeId !== apprenticeId) {
    return NextResponse.json({ error: "Task does not belong to this apprentice." }, { status: 400 });
  }

  if (!body.runId) {
    return NextResponse.json(
      { error: "Correction must be linked to a saved execution run." },
      { status: 400 }
    );
  }

  const run = await memoryStore.getRunProfile(body.runId);
  if (!run) {
    return NextResponse.json(
      { error: "Correction cannot be linked because the execution run was not saved." },
      { status: 400 }
    );
  }

  if (run.taskId !== taskId || run.apprenticeId !== apprenticeId) {
    return NextResponse.json(
      { error: "Correction run does not belong to this apprentice task." },
      { status: 400 }
    );
  }

  const extraction = await getAIService().extractCorrectionRule({
    feedback: body.feedback ?? "",
    beforeOutput: body.beforeOutput ?? {},
    structuredFeedback: body.structuredFeedback,
    memoryPolicy: body.memoryPolicy,
    apprenticeId,
    taskId
  });
  await memoryStore.saveRule(extraction.extractedRule);
  await memoryStore.saveCorrection({
    extraction,
    feedback: body.feedback ?? "",
    beforeOutput: body.beforeOutput ?? {},
    afterOutput: { learnedRule: extraction.extractedRule, structuredFeedback: body.structuredFeedback ?? null },
    apprenticeId,
    taskId,
    runId: body.runId
  });
  return NextResponse.json(extraction);
}
