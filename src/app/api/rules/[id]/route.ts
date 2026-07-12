import { NextResponse } from "next/server";
import { memoryStore } from "@/server/memory/memory-store";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as {
    enabled?: boolean;
    apprenticeId?: string;
    taskId?: string;
  };

  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean." }, { status: 400 });
  }

  try {
    const rule = await memoryStore.updateRuleEnabled({
      ruleId: id,
      enabled: body.enabled,
      apprenticeId: body.apprenticeId,
      taskId: body.taskId
    });

    if (!rule) {
      return NextResponse.json({ error: "Rule not found." }, { status: 404 });
    }

    return NextResponse.json(rule);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update rule." },
      { status: 400 }
    );
  }
}
