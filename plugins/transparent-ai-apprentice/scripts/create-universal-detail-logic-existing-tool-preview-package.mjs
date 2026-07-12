#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "universal-detail-logic-existing-tool-preview")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "universal-detail-logic-existing-tool-preview"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function lockState() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    previewDoesNotExecuteSoftware: true,
    previewDoesNotGenerateNativeCad: true,
    previewDoesNotWriteMemory: true,
    previewDoesNotEnableRules: true,
    targetCadGenerated: false,
    targetOutputGenerated: false,
    cadSoftwareExecuted: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function flattenComputed(row) {
  return Object.entries(row.computedValues || {}).map(([name, value]) => ({
    name,
    value: Number.isFinite(Number(value)) ? Number(value) : value
  }));
}

function writeSvg(path, rows) {
  const width = 960;
  const rowHeight = 64;
  const top = 58;
  const height = top + Math.max(1, rows.length) * rowHeight + 30;
  const numericValues = rows.flatMap((row) => flattenComputed(row).map((item) => Math.abs(Number(item.value))).filter(Number.isFinite));
  const maxValue = Math.max(1, ...numericValues);
  const body = rows
    .map((row, index) => {
      const y = top + index * rowHeight;
      const computed = flattenComputed(row);
      const primary = computed[0]?.value ?? 0;
      const barWidth = Math.max(12, Math.min(520, (Math.abs(Number(primary)) / maxValue) * 520));
      const valueText = computed.map((item) => `${item.name}=${item.value}`).join("; ") || "no numeric value";
      return `<g>
  <text x="32" y="${y}" font-size="16" font-family="Segoe UI, Arial" fill="#17202a">${htmlEscape(row.featureId)} ${htmlEscape(row.detailCategory || "")}</text>
  <rect x="32" y="${y + 12}" width="${barWidth.toFixed(2)}" height="18" rx="3" fill="#2f7d7e" />
  <text x="570" y="${y + 27}" font-size="14" font-family="Segoe UI, Arial" fill="#17202a">${htmlEscape(valueText)}</text>
  <text x="32" y="${y + 50}" font-size="12" font-family="Segoe UI, Arial" fill="#526070">${htmlEscape(row.validation || "logic validation required before visual review")}</text>
</g>`;
    })
    .join("\n");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="100%" height="100%" fill="#f7f8fb" />
<text x="32" y="34" font-size="24" font-family="Segoe UI, Arial" fill="#17202a">Universal Detail Logic Preview</text>
<text x="32" y="54" font-size="13" font-family="Segoe UI, Arial" fill="#526070">Existing-tool SVG preview. Logic values are computed first; visual similarity remains secondary.</text>
${body}
</svg>
`;
  writeFileSync(path, svg, "utf8");
}

function writeHtml(path, pkg) {
  const rows = pkg.previewRows
    .map(
      (row) => `<tr><td>${htmlEscape(row.featureId)}</td><td>${htmlEscape(row.detailCategory)}</td><td><code>${htmlEscape(
        JSON.stringify(row.computedValues)
      )}</code></td><td>${htmlEscape(row.existingToolHint)}</td></tr>`
    )
    .join("\n");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Universal Detail Logic Existing-Tool Preview</title>
<style>:root{font-family:"Segoe UI",Arial,sans-serif;color:#17202a;background:#f7f8fb}body{margin:0}main{max-width:1120px;margin:0 auto;padding:28px}h1{font-size:28px;letter-spacing:0}.panel,table{background:#fff;border:1px solid #d8e0ea;border-radius:8px;box-shadow:0 1px 2px rgba(16,32,56,.06)}.panel{padding:16px}table{width:100%;border-collapse:collapse}th,td{padding:10px 12px;border-bottom:1px solid #e7edf5;text-align:left;vertical-align:top;font-size:13px}th{background:#eef3f9}code{overflow-wrap:anywhere}</style>
</head><body><main>
<h1>Universal Detail Logic Existing-Tool Preview</h1>
<section class="panel"><p><strong>Status:</strong> ${htmlEscape(pkg.status)}</p><p><strong>Preview rows:</strong> ${pkg.counts.previewRows}</p><p><strong>SVG:</strong> <code>${htmlEscape(pkg.paths.svgPreview)}</code></p><p>This package is for teacher review in existing tools. It does not execute target software or generate native CAD.</p></section>
<h2>Preview Rows</h2><table><thead><tr><th>Feature</th><th>Category</th><th>Computed Values</th><th>Existing Tool Hint</th></tr></thead><tbody>${rows}</tbody></table>
</main></body></html>`;
  writeFileSync(path, html, "utf8");
}

const dryRunInput = readJsonInput(
  argValue("--dry-run", argValue("--logic-dry-run", "")),
  "--dry-run",
  "transparent_ai_universal_detail_logic_application_dry_run_v1"
);
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "universal-detail-logic-existing-tool-previews"))
);
mkdirSync(outputRoot, { recursive: true });

const dryRun = dryRunInput.value;
const previewId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(dryRun.dryRunId)}`;
const previewDir = join(outputRoot, previewId);
mkdirSync(previewDir, { recursive: true });
const packagePath = join(previewDir, "universal-detail-logic-existing-tool-preview-package.json");
const recipePath = join(previewDir, "universal-detail-logic-preview-recipe.json");
const svgPath = join(previewDir, "universal-detail-logic-preview.svg");
const htmlPath = join(previewDir, "universal-detail-logic-existing-tool-preview.html");
const readmePath = join(previewDir, "UNIVERSAL_DETAIL_LOGIC_EXISTING_TOOL_PREVIEW_START_HERE.md");
const locks = lockState();

const dryRunReady =
  dryRun.status === "review_only_logic_application_dry_run_ready_for_teacher_review" &&
  dryRun.counts?.blockedRows === 0 &&
  Array.isArray(dryRun.appliedFeatureRows);
const previewRows = dryRunReady
  ? dryRun.appliedFeatureRows.map((row) => ({
      featureId: row.featureId,
      featureType: row.featureType,
      detailCategory: row.detailCategory,
      computedValues: row.computedValues,
      validation: row.validation,
      existingToolHint:
        "Review this computed value in the SVG/JSON preview first; then import or recreate through an approved existing-tool route only after teacher confirmation.",
      visualSimilarityRole: "secondary_review_signal_only_after_logic_validation_passes"
    }))
  : [];

const recipe = {
  format: "transparent_ai_universal_detail_logic_existing_tool_preview_recipe_v1",
  sourceDryRun: dryRunInput.path,
  previewRows,
  existingToolRoutes: [
    "open_svg_preview_in_browser_or_vector_editor",
    "import_svg_preview_into_draw_io_or_other_drawing_tool",
    "use_json_recipe_for_scriptable_existing_tool_preview",
    "route_to_supervised_execution_adapter_only_after_teacher_review_and_rollback"
  ],
  blockedIf: dryRunReady ? [] : ["logic_application_dry_run_has_blocked_rows_or_is_not_ready"],
  locks
};
writeFileSync(recipePath, `${JSON.stringify(recipe, null, 2)}\n`, "utf8");
if (dryRunReady) writeSvg(svgPath, previewRows);
else writeFileSync(svgPath, `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="120"><text x="24" y="60">Preview blocked until logic dry-run has zero blocked rows.</text></svg>\n`, "utf8");

const previewPackage = {
  ok: true,
  format: "transparent_ai_universal_detail_logic_existing_tool_preview_package_v1",
  previewId,
  createdAt: new Date().toISOString(),
  sourceDryRun: dryRunInput.path,
  status: dryRunReady
    ? "review_only_existing_tool_preview_ready_for_teacher_review"
    : "blocked_until_logic_application_dry_run_ready",
  decision: dryRunReady ? "ready_for_teacher_preview_review" : "needs_teacher_review",
  counts: {
    previewRows: previewRows.length,
    blockedDryRunRows: dryRun.counts?.blockedRows || 0
  },
  gates: {
    sourceDryRunReady: dryRunReady,
    visualSimilarityStillSecondaryOnly: true,
    noTargetSoftwareExecutionPerformed: true,
    noNativeCadGenerated: true
  },
  previewRows,
  existingToolRoutes: recipe.existingToolRoutes,
  blockedActions: [
    "execute_target_software_from_preview",
    "generate_native_cad_from_preview",
    "write_memory_from_preview",
    "enable_rules_from_preview",
    "claim_complete_from_preview"
  ],
  locks,
  paths: {
    package: packagePath,
    recipe: recipePath,
    svgPreview: svgPath,
    html: htmlPath,
    readme: readmePath,
    sourceDryRun: dryRunInput.path
  }
};

writeFileSync(packagePath, `${JSON.stringify(previewPackage, null, 2)}\n`, "utf8");
writeHtml(htmlPath, previewPackage);
writeFileSync(
  readmePath,
  [
    "# Universal Detail Logic Existing-Tool Preview",
    "",
    `Status: ${previewPackage.status}`,
    `Preview rows: ${previewPackage.counts.previewRows}`,
    "",
    "Open the SVG or JSON recipe in an existing drawing/vector/tooling workflow for teacher review.",
    "",
    "Safety boundary:",
    "- No target software was executed.",
    "- No native CAD or final output was generated.",
    "- No screenshot was captured.",
    "- No memory was written.",
    "- No rule was enabled or accepted.",
    "- Visual similarity remains secondary after logic validation.",
    "",
    `SVG preview: ${svgPath}`,
    `JSON recipe: ${recipePath}`
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      status: previewPackage.status,
      format: "transparent_ai_universal_detail_logic_existing_tool_preview_package_result_v1",
      packagePath,
      recipePath,
      svgPath,
      htmlPath,
      readmePath,
      previewRows: previewRows.length,
      locks
    },
    null,
    2
  )
);
