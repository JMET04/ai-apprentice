import { NextResponse } from "next/server";
import { buildProductReadiness } from "@/server/productization/readiness";

export async function GET() {
  return NextResponse.json(await buildProductReadiness());
}
