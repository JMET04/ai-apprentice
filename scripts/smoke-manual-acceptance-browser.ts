import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser } from "playwright";

type SmokeCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

type Capture = {
  viewport: "desktop" | "mobile";
  screenshotPath: string;
  screenshotBytes: number;
  pass: boolean;
};

const baseUrl = getArg("--base-url") ?? process.env.PRODUCT_SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const desktopScreenshotPath = path.join(artifactsDir, "manual-acceptance-browser-desktop.png");
const mobileScreenshotPath = path.join(artifactsDir, "manual-acceptance-browser-mobile.png");
const legacyScreenshotPath = path.join(artifactsDir, "manual-acceptance-browser.png");
const smokeReceiptPath = path.join(artifactsDir, "manual-acceptance-browser-smoke.json");
const exportedReportPath = path.join(artifactsDir, "manual-acceptance-report.browser-smoke.json");
const latestPath = path.join(artifactsDir, "manual-acceptance-latest.json");

function getArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function push(checks: SmokeCheck[], name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
}

async function launchBrowser() {
  const attempts = [
    { label: "bundled chromium", options: { timeout: 8000 } },
    { label: "msedge", options: { channel: "msedge" as const, timeout: 8000 } },
    { label: "chrome", options: { channel: "chrome" as const, timeout: 8000 } }
  ];
  const errors: string[] = [];

  for (const attempt of attempts) {
    try {
      const browser = await chromium.launch({ ...attempt.options, headless: true });
      return { browser, label: attempt.label };
    } catch (error) {
      errors.push(`${attempt.label}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    }
  }

  throw new Error(`No Chromium browser available for manual acceptance smoke. ${errors.join(" | ")}`);
}

async function captureManualPage(
  page: Awaited<ReturnType<Browser["newPage"]>>,
  viewport: Capture["viewport"],
  screenshotPath: string
) {
  if (viewport === "mobile") {
    await page.setViewportSize({ width: 390, height: 844 });
  } else {
    await page.setViewportSize({ width: 1366, height: 900 });
  }

  await page.screenshot({ path: screenshotPath, fullPage: true });
  const screenshotBytes = fs.statSync(screenshotPath).size;
  return {
    viewport,
    screenshotPath: path.relative(process.cwd(), screenshotPath),
    screenshotBytes,
    pass: screenshotBytes > 10_000
  };
}

async function main() {
  const checks: SmokeCheck[] = [];
  const captures: Capture[] = [];
  let browser: Browser | null = null;

  try {
    const launched = await launchBrowser();
    browser = launched.browser;

    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    await page.goto(new URL("/manual-test", baseUrl).toString(), { waitUntil: "domcontentloaded" });
    await page.getByText("Manual test entry").waitFor({ state: "visible", timeout: 15_000 });
    await page.locator('[data-manual-test-ready="true"]').waitFor({ state: "visible", timeout: 15_000 });

    push(
      checks,
      "Manual acceptance page is readable",
      (await page.getByText("Manual test entry").count()) > 0 &&
        (await page.getByText("Review Object").count()) > 0 &&
        (await page.getByText("Stable demo metrics").count()) > 0 &&
        (await page.getByText("Run the photography journal task once").count()) > 0 &&
        (await page.getByText("Export report").count()) > 0 &&
        (await page.getByText("Smoke photography journal").count()) === 0,
      `browser=${launched.label}; title=${await page.title()}`
    );

    push(
      checks,
      "Packaging boundary remains visible",
      (await page.getByText("accepted: false").count()) > 0 &&
        (await page.getByText("packagingGated: true").count()) > 0 &&
        (await page.getByText("pending_teacher_acceptance").count()) > 0,
      "accepted=false; packagingGated=true; status=pending_teacher_acceptance"
    );

    const passButtons = page.getByRole("button", { name: /^Passed$/ });
    const passButtonCount = await passButtons.count();
    for (let index = 0; index < passButtonCount; index += 1) {
      await passButtons.nth(index).click();
    }

    const textareas = page.locator("textarea");
    const textareaCount = await textareas.count();
    for (let index = 0; index < textareaCount; index += 1) {
      await textareas.nth(index).fill(
        index === textareaCount - 1
          ? "Browser smoke only: the manual acceptance workbench is readable, recordable, exportable, and still release-locked."
          : `Browser smoke step ${index + 1}: visible evidence and stop condition were present.`
      );
    }

    push(
      checks,
      "Tester can mark every step as passed",
      passButtonCount >= 6 &&
        textareaCount >= passButtonCount + 1 &&
        (await page.getByText("The bounded core path has enough human evidence").count()) > 0,
      `passButtons=${passButtonCount}; textareas=${textareaCount}`
    );

    fs.mkdirSync(artifactsDir, { recursive: true });
    const desktopCapture = await captureManualPage(page, "desktop", desktopScreenshotPath);
    captures.push(desktopCapture);
    fs.copyFileSync(desktopScreenshotPath, legacyScreenshotPath);
    const mobileCapture = await captureManualPage(page, "mobile", mobileScreenshotPath);
    captures.push(mobileCapture);

    push(
      checks,
      "Manual acceptance page has desktop and mobile browser captures",
      captures.every((capture) => capture.pass) && fs.existsSync(legacyScreenshotPath),
      captures.map((capture) => `${capture.viewport}=${capture.screenshotBytes}`).join("; ")
    );

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export report" }).click();
    const download = await downloadPromise;
    const downloadedPath = await download.path();
    if (!downloadedPath) {
      throw new Error("Manual acceptance report download did not expose a temporary file path.");
    }

    const report = JSON.parse(fs.readFileSync(downloadedPath, "utf8")) as {
      format?: string;
      summary?: { readyForHumanTrial?: boolean; passed?: number; failed?: number; notRun?: number };
      releaseBoundary?: { reminder?: string; evidence?: Array<{ label: string; value: string }> };
      steps?: Array<{ status?: string; note?: string }>;
    };

    fs.writeFileSync(exportedReportPath, JSON.stringify(report, null, 2));

    push(
      checks,
      "Manual acceptance report exports review-only evidence",
      report.format === "transparent_ai_apprentice_manual_acceptance_report_v1" &&
        report.summary?.readyForHumanTrial === true &&
        report.summary.passed === passButtonCount &&
        report.summary.failed === 0 &&
        report.summary.notRun === 0 &&
        report.releaseBoundary?.reminder?.includes("does not unlock packaging") === true &&
        report.releaseBoundary.evidence?.some((item) => item.label === "accepted" && item.value === "false") === true &&
        report.steps?.every((step) => step.status === "passed" && Boolean(step.note)) === true,
      `report=${path.relative(process.cwd(), exportedReportPath)}`
    );

    await page.getByTestId("save-manual-acceptance-report").click();
    await page
      .getByTestId("manual-acceptance-save-status")
      .getByText("Human review evidence is incomplete")
      .waitFor({ state: "visible", timeout: 15_000 });

    push(
      checks,
      "Browser smoke cannot save real human evidence from the UI",
      (await page.getByTestId("manual-acceptance-save-status").getByText("Human review evidence is incomplete").count()) > 0,
      "The UI refused to save human_review evidence without reviewer name and attestation."
    );

    const smokeSaveResponse = await fetch(new URL("/api/manual-acceptance-reports", baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "manual-browser-smoke",
        report
      })
    });
    if (!smokeSaveResponse.ok) {
      throw new Error(`Unable to save browser-smoke manual acceptance evidence: ${smokeSaveResponse.status}`);
    }

    const latestResponse = await fetch(new URL("/api/manual-acceptance-reports", baseUrl));
    const latest = (await latestResponse.json()) as {
      status?: string;
      latest?: {
        responseMode?: string;
        latestReportPath?: string;
        evidenceKind?: string;
        humanReviewed?: boolean;
        automationGenerated?: boolean;
        reviewOnly?: boolean;
        accepted?: boolean;
        packagingGated?: boolean;
        report?: {
          summary?: { readyForHumanTrial?: boolean; failed?: number; notRun?: number };
          releaseBoundary?: { reminder?: string };
        };
      };
    };
    const normalizedLatestPath = latest.latest?.latestReportPath?.replaceAll("\\", "/");

    push(
      checks,
      "Manual acceptance report is saved as automated product evidence",
      latestResponse.status === 200 &&
        latest.status === "saved" &&
        latest.latest?.responseMode === "manual_acceptance_saved_receipt_json_v1" &&
        normalizedLatestPath === "artifacts/productization/manual-acceptance-latest.json" &&
        latest.latest.evidenceKind === "automated_browser_smoke" &&
        latest.latest.humanReviewed === false &&
        latest.latest.automationGenerated === true &&
        latest.latest.reviewOnly === true &&
        latest.latest.accepted === false &&
        latest.latest.packagingGated === true &&
        latest.latest.report?.summary?.readyForHumanTrial === true &&
        latest.latest.report.summary.failed === 0 &&
        latest.latest.report.summary.notRun === 0 &&
        latest.latest.report.releaseBoundary?.reminder?.includes("does not unlock packaging") === true &&
        fs.existsSync(latestPath),
      `apiStatus=${latestResponse.status}; latest=${path.relative(process.cwd(), latestPath)}; evidenceKind=${
        latest.latest?.evidenceKind
      }`
    );
  } finally {
    await browser?.close();
  }

  const passed = checks.filter((check) => check.pass).length;
  const result = {
    responseMode: "manual_acceptance_browser_smoke_receipt_json_v1",
    status: passed === checks.length ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    baseUrl,
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    evidenceKind: "automated_browser_smoke",
    humanReviewed: false,
    automationGenerated: true,
    passed,
    total: checks.length,
    captures,
    checks
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(smokeReceiptPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));

  if (result.status !== "passed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export {};
