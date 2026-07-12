import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";

type SmokeCheck = {
  name: string;
  pass: boolean;
  evidence: string;
};

type ViewportCase = {
  name: "desktop" | "mobile";
  width: number;
  height: number;
  screenshotName: string;
};

const baseUrl = getArg("--base-url") ?? process.env.PRODUCT_SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const artifactsDir = path.join(process.cwd(), "artifacts", "productization");
const receiptPath = path.join(artifactsDir, "handoff-browser-smoke.json");

const viewportCases: ViewportCase[] = [
  { name: "desktop", width: 1440, height: 1100, screenshotName: "handoff-beta-feedback-desktop.png" },
  { name: "mobile", width: 390, height: 1200, screenshotName: "handoff-beta-feedback-mobile.png" }
];

function getArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
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

  throw new Error(`No Chromium browser available for handoff browser smoke. ${errors.join(" | ")}`);
}

async function captureReturnLoop(page: Page, viewportCase: ViewportCase) {
  await page.setViewportSize({ width: viewportCase.width, height: viewportCase.height });
  await page.goto(new URL("/handoff", baseUrl).toString(), { waitUntil: "networkidle" });

  const returnLoopSection = page.locator("section").filter({ hasText: "Beta Feedback Return Loop" }).first();
  await returnLoopSection.scrollIntoViewIfNeeded();
  await returnLoopSection.getByText("Beta Feedback Return Loop").waitFor({ state: "visible", timeout: 15_000 });

  const requiredText = [
    "returnLoop=waiting_for_first_tester_return",
    "collection=waiting_for_feedback",
    "followUp=passed",
    "intake=passed",
    "release=do_not_release",
    "Return Handling Commands",
    "npm run collect:public-beta-feedback",
    "npm run plan:public-beta-follow-up",
    "npm run intake:public-beta-return"
  ];
  const visibleResults = await Promise.all(
    requiredText.map(async (text) => ({
      text,
      visible: (await returnLoopSection.getByText(text, { exact: false }).count()) > 0
    }))
  );
  const box = await returnLoopSection.boundingBox();
  const screenshotPath = path.join(artifactsDir, viewportCase.screenshotName);
  await returnLoopSection.screenshot({ path: screenshotPath });
  const screenshotBytes = fs.statSync(screenshotPath).size;

  return {
    viewport: viewportCase.name,
    screenshotPath: path.join("artifacts", "productization", viewportCase.screenshotName),
    screenshotBytes,
    boundingBox: box,
    visibleResults,
    pass:
      visibleResults.every((item) => item.visible) &&
      screenshotBytes > 10_000 &&
      Number(box?.width ?? 0) > 250 &&
      Number(box?.height ?? 0) > 250
  };
}

async function main() {
  const checks: SmokeCheck[] = [];
  let browser: Browser | null = null;
  fs.mkdirSync(artifactsDir, { recursive: true });

  try {
    const launched = await launchBrowser();
    browser = launched.browser;
    const page = await browser.newPage();
    const captures = [];

    for (const viewportCase of viewportCases) {
      captures.push(await captureReturnLoop(page, viewportCase));
    }

    for (const capture of captures) {
      const missing = capture.visibleResults.filter((item) => !item.visible).map((item) => item.text);
      push(
        checks,
        `Handoff beta return loop is visible on ${capture.viewport}`,
        capture.pass,
        `screenshot=${capture.screenshotPath}; bytes=${capture.screenshotBytes}; box=${Math.round(
          capture.boundingBox?.width ?? 0
        )}x${Math.round(capture.boundingBox?.height ?? 0)}; missing=${missing.join(",") || "none"}`
      );
    }

    push(
      checks,
      "Handoff return loop screenshots preserve release locks",
      captures.every((capture) =>
        capture.visibleResults.some((item) => item.text === "release=do_not_release" && item.visible)
      ),
      "release=do_not_release appears in every captured return-loop section."
    );

    const passed = checks.filter((item) => item.pass).length;
    const result = {
      responseMode: "handoff_browser_smoke_receipt_json_v1",
      status: passed === checks.length ? "passed" : "failed",
      generatedAt: new Date().toISOString(),
      command: `npm run smoke:handoff-browser -- --base-url ${baseUrl}`,
      baseUrl,
      productScope: "bounded_core_teaching_loop",
      allSoftwareObjective: "paused",
      releaseDecision: "do_not_release",
      reviewOnly: true,
      accepted: false,
      packagingGated: true,
      passed,
      total: checks.length,
      browser: launched.label,
      captures,
      checks
    };

    fs.writeFileSync(receiptPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    console.log(`\nHandoff browser smoke receipt written to ${receiptPath}`);

    if (result.status !== "passed") {
      process.exitCode = 1;
    }
  } finally {
    await browser?.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export {};
