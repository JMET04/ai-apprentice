import { NextResponse } from "next/server";
import {
  productReleaseReadinessReceiptPath,
  readProductReleaseReadinessReceipt
} from "@/server/productization/readiness";

export async function GET() {
  const latest = readProductReleaseReadinessReceipt();

  return NextResponse.json(
    {
      responseMode: "product_release_readiness_latest_json_v1",
      status: latest ? "saved" : "not_run_yet",
      generatedAt: new Date().toISOString(),
      reportPath: "artifacts/productization/product-release-readiness.json",
      absoluteReportPath: productReleaseReadinessReceiptPath,
      latest: latest ?? {
        status: "not_run_yet",
        releaseDecision: "do_not_release",
        blockers: [
          {
            name: "Product release readiness has not been verified",
            evidence: "Run npm run verify:product-release-readiness -- --allow-blocked to write the latest gate snapshot."
          }
        ]
      },
      trialReadinessIsReleaseReadiness: false
    },
    { status: latest ? 200 : 404 }
  );
}
