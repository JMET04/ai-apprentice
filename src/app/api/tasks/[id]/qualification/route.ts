import { NextResponse } from "next/server";
import { memoryStore } from "@/server/memory/memory-store";
import { buildQualificationReport } from "@/server/qualification/learning-report";
import { buildQualificationApiSummary } from "@/server/qualification/qualification-api-summary";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await memoryStore.getTaskProfile(id);

  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  const report = buildQualificationReport(task);
  const view = new URL(request.url).searchParams.get("view");

  if (view === "full") {
    return NextResponse.json(report);
  }

  return NextResponse.json(buildQualificationApiSummary(report));
}
