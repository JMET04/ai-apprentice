import { NextResponse } from "next/server";
import {
  buildPublicBetaFeedbackTemplate,
  readPublicBetaFeedbackInboxSummary,
  savePublicBetaFeedbackReceipt,
  type PublicBetaFeedbackReceipt
} from "@/server/productization/public-beta-feedback";

export async function GET() {
  return NextResponse.json({
    responseMode: "public_beta_feedback_receipts_endpoint_json_v1",
    status: "ready",
    template: buildPublicBetaFeedbackTemplate(),
    inbox: readPublicBetaFeedbackInboxSummary(),
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      receipt?: PublicBetaFeedbackReceipt;
      dryRun?: boolean;
    };

    if (!body.receipt) {
      return NextResponse.json({ error: "Missing receipt." }, { status: 400 });
    }

    const result = savePublicBetaFeedbackReceipt(body.receipt, { dryRun: body.dryRun });
    return NextResponse.json(result, { status: result.status === "rejected" ? 400 : 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to process public beta feedback receipt."
      },
      { status: 400 }
    );
  }
}
