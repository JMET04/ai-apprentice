import { NextResponse } from "next/server";
import { memoryStore } from "@/server/memory/memory-store";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    description?: string;
    domain?: string;
  };

  if (!body.name?.trim() || !body.domain?.trim()) {
    return NextResponse.json({ error: "Apprentice name and domain are required." }, { status: 400 });
  }

  const apprentice = await memoryStore.createApprentice({
    name: body.name.trim(),
    description: body.description?.trim() ?? "A teachable AI apprentice ready to learn from feedback.",
    domain: body.domain.trim()
  });

  return NextResponse.json({
    id: apprentice.id,
    name: apprentice.name,
    domain: apprentice.domain,
    savedAt: apprentice.createdAt
  });
}
