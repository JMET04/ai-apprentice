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
const receiptPath = path.join(artifactsDir, "public-beta-browser-smoke.json");

const viewportCases: ViewportCase[] = [
  { name: "desktop", width: 1440, height: 1200, screenshotName: "public-beta-browser-desktop.png" },
  { name: "mobile", width: 390, height: 1100, screenshotName: "public-beta-browser-mobile.png" }
];

const requiredTexts = [
  "Feedback Receipt Builder",
  "Confusing wording",
  "Missing behavior",
  "Screenshot or evidence path",
  "releaseDecision=do_not_release"
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

  throw new Error(`No Chromium browser available for public beta browser smoke. ${errors.join(" | ")}`);
}

async function inboxTotal(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/public-beta-feedback-receipts");
    const json = await response.json();
    return Number(json.inbox?.totalReceipts ?? -1);
  });
}

async function capturePage(page: Page, viewportCase: ViewportCase) {
  await page.setViewportSize({ width: viewportCase.width, height: viewportCase.height });
  await page.goto(new URL("/public-beta", baseUrl).toString(), { waitUntil: "networkidle" });
  await page.getByText("Feedback Receipt Builder").waitFor({ state: "visible", timeout: 15_000 });

  const visibilityResults = await Promise.all(
    requiredTexts.map(async (text) => {
      const locator = ["Confusing wording", "Missing behavior", "Screenshot or evidence path"].includes(text)
        ? page.locator("label").filter({ hasText: text }).first()
        : page.getByText(text, { exact: false }).first();
      return { text, visible: await locator.isVisible().catch(() => false) };
    })
  );
  const missingTexts = visibilityResults.filter((item) => !item.visible).map((item) => item.text);
  const screenshotPath = path.join(artifactsDir, viewportCase.screenshotName);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const screenshotBytes = fs.statSync(screenshotPath).size;

  return {
    viewport: viewportCase.name,
    screenshotPath: path.join("artifacts", "productization", viewportCase.screenshotName),
    screenshotBytes,
    missingTexts,
    pass: missingTexts.length === 0 && screenshotBytes > 10_000
  };
}

async function fillLabelControl(page: Page, labelText: string, value: string) {
  const field = page.locator("label").filter({ hasText: labelText }).first();
  await field.locator("input, textarea").first().fill(value);
}
async function fillAndValidate(page: Page) {
  await page.goto(new URL("/public-beta", baseUrl).toString(), { waitUntil: "networkidle" });
  await page.getByText("Feedback Receipt Builder").waitFor({ state: "visible", timeout: 15_000 });
  const beforeInbox = await inboxTotal(page);

  await page.getByLabel("Tester name").fill("Browser Beta Tester");
  await page.getByLabel("Role").fill("QA");
  await page.getByLabel("Environment").fill("Playwright public beta browser smoke");

  const yesButtons = page.getByRole("button", { name: "Yes" });
  const yesCount = await yesButtons.count();
  for (let index = 0; index < yesCount; index += 1) {
    await yesButtons.nth(index).click();
  }

  await page.getByLabel("Core loop notes").fill("Core loop was clear in browser smoke.");
  await page.getByLabel("Boundary notes").fill("Release and all-software boundaries stayed visible.");
  await page.getByLabel("Next action recommendation").fill("Proceed to one bounded tester after maintainer review.");
  await fillLabelControl(page, "Confusing wording", "No confusing wording observed in browser smoke.");
  await fillLabelControl(page, "Missing behavior", "No missing behavior observed in browser smoke.");
  await fillLabelControl(page, "Screenshot or evidence path", "artifacts/productization/public-beta-browser-desktop.png");
  await page.getByRole("button", { name: "Validate" }).click();
  await page.getByText("Receipt status: validated_dry_run").waitFor({ state: "visible", timeout: 15_000 });

  const afterInbox = await inboxTotal(page);
  return {
    yesCount,
    beforeInbox,
    afterInbox,
    dryRunValidated: (await page.getByText("Receipt status: validated_dry_run").count()) > 0,
    noInboxGrowth: beforeInbox === afterInbox
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
      captures.push(await capturePage(page, viewportCase));
    }

    for (const capture of captures) {
      push(
        checks,
        `Public beta feedback workbench is visible on ${capture.viewport}`,
        capture.pass,
        `screenshot=${capture.screenshotPath}; bytes=${capture.screenshotBytes}; missing=${capture.missingTexts.join(",") || "none"}`
      );
    }

    const validation = await fillAndValidate(page);
    push(
      checks,
      "Tester can dry-run validate structured feedback without growing inbox",
      validation.yesCount >= 10 && validation.dryRunValidated && validation.noInboxGrowth,
      `yesButtons=${validation.yesCount}; inbox=${validation.beforeInbox}->${validation.afterInbox}; dryRun=${validation.dryRunValidated}`
    );

    push(
      checks,
      "Public beta browser smoke preserves release locks",
      captures.every((capture) => capture.missingTexts.includes("releaseDecision=do_not_release") === false),
      "releaseDecision=do_not_release is visible in every captured viewport."
    );

    const passed = checks.filter((check) => check.pass).length;
    const result = {
      responseMode: "public_beta_browser_smoke_receipt_json_v1",
      status: passed === checks.length ? "passed" : "failed",
      generatedAt: new Date().toISOString(),
      command: `npm run smoke:public-beta-browser -- --base-url ${baseUrl}`,
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
      validation,
      checks
    };

    fs.writeFileSync(receiptPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    console.log(`\nPublic beta browser smoke receipt written to ${receiptPath}`);

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