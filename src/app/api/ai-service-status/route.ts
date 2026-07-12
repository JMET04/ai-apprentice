import { NextResponse } from "next/server";
import { getAIServiceRuntimeStatus } from "@/server/ai/service";

export async function GET() {
  return NextResponse.json(getAIServiceRuntimeStatus());
}
