import { NextResponse } from "next/server";
import {
  readLatestManualAcceptanceEnvelope,
  saveManualAcceptanceReport,
  type HumanReviewEvidence,
  type ManualAcceptanceReport
} from "@/server/productization/manual-acceptance";

export async function GET() {
  const latest = readLatestManualAcceptanceEnvelope();

  if (!latest) {
    return NextResponse.json(
      {
        responseMode: "manual_acceptance_latest_receipt_json_v1",
        status: "not_saved_yet",
        latest: null
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    responseMode: "manual_acceptance_latest_receipt_json_v1",
    status: "saved",
    latest
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      report?: ManualAcceptanceReport;
      source?: string;
      humanReviewEvidence?: HumanReviewEvidence;
    };

    if (!body.report) {
      return NextResponse.json({ error: "Missing report." }, { status: 400 });
    }

    return NextResponse.json(saveManualAcceptanceReport(body.report, body.source, body.humanReviewEvidence));
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to save manual acceptance report."
      },
      { status: 400 }
    );
  }
}
