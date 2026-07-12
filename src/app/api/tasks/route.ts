import { NextResponse } from "next/server";
import { demoApprentice } from "@/lib/demo-data";
import { memoryStore } from "@/server/memory/memory-store";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    goal?: string;
    inputExample?: string;
    expectedOutput?: string;
    notes?: string;
    errorCases?: string;
    apprenticeId?: string;
  };

  if (!body.name?.trim() || !body.goal?.trim()) {
    return NextResponse.json({ error: "Task name and goal are required." }, { status: 400 });
  }

  const apprenticeId = body.apprenticeId ?? demoApprentice.id;
  const apprentice = await memoryStore.getApprenticeProfile(apprenticeId);
  if (!apprentice) {
    return NextResponse.json({ error: "Selected apprentice was not found." }, { status: 404 });
  }

  const result = await memoryStore.saveTaskDraft({
    apprenticeId,
    name: body.name.trim(),
    goal: body.goal.trim(),
    inputExample: body.inputExample?.trim() ?? "",
    expectedOutput: body.expectedOutput?.trim() ?? "",
    notes: body.notes?.trim() ?? "",
    errorCases: body.errorCases?.trim() ?? ""
  });

  return NextResponse.json({
    id: result.task.id,
    name: result.task.name,
    status: result.task.status,
    workflowId: result.workflow.id,
    savedAt: result.task.createdAt
  });
}
