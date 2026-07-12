import { NextResponse } from "next/server";
import { buildProductHealth } from "@/server/productization/health";

export async function GET() {
  const health = await buildProductHealth();
  return NextResponse.json(health, { status: health.status === "healthy" ? 200 : 503 });
}
