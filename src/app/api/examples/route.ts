import { NextResponse } from "next/server";
import { demoApprentice, demoTask } from "@/lib/demo-data";
import { extractRuleFromTeachingExample } from "@/server/corrections/example-extractor";
import { memoryStore } from "@/server/memory/memory-store";

function parseExpectedOutput(value: string | undefined) {
  if (!value?.trim()) {
    return {};
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {
      teacherExpectedOutput: value.trim()
    };
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    input?: string;
    expectedOutput?: string;
    apprenticeId?: string;
    taskId?: string;
  };

  if (!body.input?.trim() || !body.expectedOutput?.trim()) {
    return NextResponse.json({ error: "Example input and expected output are required." }, { status: 400 });
  }

  const task = body.taskId ? await memoryStore.getTaskProfile(body.taskId) : null;
  if (body.taskId && !task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  const apprenticeId = body.apprenticeId ?? task?.apprenticeId ?? demoApprentice.id;
  const taskId = task?.id ?? body.taskId ?? demoTask.id;

  if (task && task.apprenticeId !== apprenticeId) {
    return NextResponse.json({ error: "Task does not belong to this apprentice." }, { status: 400 });
  }

  const expectedOutput = parseExpectedOutput(body.expectedOutput);
  const extraction = extractRuleFromTeachingExample({
    input: body.input.trim(),
    expectedOutput,
    apprenticeId,
    taskId
  });

  await memoryStore.saveRule(extraction.extractedRule);
  const example = await memoryStore.saveTeachingExample({
    id: `example-${Date.now()}`,
    apprenticeId,
    taskId,
    input: body.input.trim(),
    expectedOutput,
    extractedRule: extraction.extractedRule,
    learningTrace: extraction.learningTrace,
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({
    example,
    extraction
  });
}
