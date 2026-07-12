import fs from "node:fs";
import path from "node:path";

type JsonRecord = Record<string, unknown>;

type ArtifactRow = {
  path: string;
  responseMode: string;
  status: string;
  releaseDecision: string;
  accepted: string;
  packagingGated: string;
  canRelease: string;
  canActivateRealModel: string;
  missingFields: string[];
  dangerousFields: string[];
};

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts", "productization");
const auditJsonPath = path.join(artifactsDir, "productization-lock-coverage-audit.json");
const auditMarkdownPath = path.join(artifactsDir, "productization-lock-coverage-audit.md");
const expectedLocks = {
  accepted: false,
  packagingGated: true,
  canRelease: false,
  canActivateRealModel: false
} as const;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function readJson(targetPath: string): JsonRecord | null {
  try {
    return asRecord(JSON.parse(fs.readFileSync(targetPath, "utf8").replace(/^\uFEFF/, "")));
  } catch {
    return null;
  }
}

function valueLabel(value: unknown) {
  if (value === undefined) return "missing";
  if (value === null) return "null";
  return String(value);
}

function isBoundaryLike(record: JsonRecord) {
  return (
    record.releaseDecision === "do_not_release" ||
    record.reviewOnly === true ||
    record.accepted === false ||
    record.packagingGated === true ||
    record.canRelease === false ||
    record.canActivateRealModel === false
  );
}

function rowFor(relativePath: string, record: JsonRecord): ArtifactRow {
  const missingFields = Object.keys(expectedLocks).filter((field) => !(field in record));
  const dangerousFields = Object.entries(expectedLocks)
    .filter(([field, expected]) => field in record && record[field] !== expected)
    .map(([field, expected]) => `${field}=${valueLabel(record[field])}; expected=${String(expected)}`);

  if ("releaseDecision" in record && record.releaseDecision !== "do_not_release") {
    dangerousFields.push(`releaseDecision=${valueLabel(record.releaseDecision)}; expected=do_not_release`);
  }

  return {
    path: relativePath,
    responseMode: valueLabel(record.responseMode),
    status: valueLabel(record.status),
    releaseDecision: valueLabel(record.releaseDecision),
    accepted: valueLabel(record.accepted),
    packagingGated: valueLabel(record.packagingGated),
    canRelease: valueLabel(record.canRelease),
    canActivateRealModel: valueLabel(record.canActivateRealModel),
    missingFields,
    dangerousFields
  };
}

function markdownTable(rows: ArtifactRow[]) {
  if (rows.length === 0) return "| Artifact | Status | Missing fields |\n| --- | --- | --- |\n| none | - | - |";
  return [
    "| Artifact | Status | Missing fields |",
    "| --- | --- | --- |",
    ...rows.map((row) => `| \`${row.path}\` | \`${row.status}\` | \`${row.missingFields.join(", ") || "none"}\` |`)
  ].join("\n");
}

export function auditProductizationLockCoverage() {
  const allJsonPaths = fs.existsSync(artifactsDir)
    ? fs.readdirSync(artifactsDir)
        .filter((name) => name.endsWith(".json"))
        .map((name) => path.join(artifactsDir, name))
        .sort()
    : [];

  const rows = allJsonPaths
    .map((targetPath) => ({ targetPath, record: readJson(targetPath) }))
    .filter((item): item is { targetPath: string; record: JsonRecord } => Boolean(item.record))
    .filter((item) => isBoundaryLike(item.record))
    .map((item) => rowFor(path.relative(rootDir, item.targetPath).replaceAll("\\", "/"), item.record));

  const dangerous = rows.filter((row) => row.dangerousFields.length > 0);
  const missing = rows.filter((row) => row.missingFields.length > 0);
  const explicitlyLocked = rows.filter((row) => row.missingFields.length === 0 && row.dangerousFields.length === 0);
  const missingByField = Object.keys(expectedLocks).reduce<Record<string, number>>((acc, field) => {
    acc[field] = missing.filter((row) => row.missingFields.includes(field)).length;
    return acc;
  }, {});
  const status = dangerous.length > 0 ? "failed" : missing.length > 0 ? "passed_with_explicit_lock_backlog" : "passed";
  const audit = {
    responseMode: "productization_lock_coverage_audit_json_v1",
    status,
    generatedAt: new Date().toISOString(),
    command: "npm run audit:productization-lock-coverage",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    scannedJsonFiles: allJsonPaths.length,
    boundaryLikeArtifacts: rows.length,
    explicitlyLockedArtifacts: explicitlyLocked.length,
    artifactsWithMissingExplicitLocks: missing.length,
    artifactsWithDangerousLocks: dangerous.length,
    missingByField,
    dangerousArtifacts: dangerous,
    explicitLockBacklog: missing,
    nextAction:
      dangerous.length > 0
        ? "Stop and fix dangerous productization lock violations before packaging or inviting testers."
        : missing.length > 0
          ? "Use explicitLockBacklog to harden the next productization pass; current audit found no dangerous unlocks."
          : "All boundary-like productization JSON artifacts carry explicit top-level release and real-model locks."
  };

  const markdown = `# Productization Lock Coverage Audit\n\nStatus: \`${status}\`\n\nGenerated: \`${audit.generatedAt}\`\n\n## Summary\n\n- Boundary-like JSON artifacts: \`${rows.length}\`\n- Fully explicit top-level locks: \`${explicitlyLocked.length}\`\n- Missing explicit lock fields: \`${missing.length}\`\n- Dangerous lock violations: \`${dangerous.length}\`\n- Missing by field: \`${JSON.stringify(missingByField)}\`\n\n## Dangerous Violations\n\n${dangerous.length === 0 ? "- none" : dangerous.map((row) => `- \`${row.path}\`: ${row.dangerousFields.join("; ")}`).join("\n")}\n\n## Explicit Lock Backlog\n\n${markdownTable(missing)}\n\n## Boundary\n\nThis audit does not unlock release, packaging, real-model activation, or all-software scope. It keeps \`accepted=false\`, \`packagingGated=true\`, \`canRelease=false\`, \`canActivateRealModel=false\`, and \`releaseDecision=do_not_release\`.\n`;

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(auditJsonPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  fs.writeFileSync(auditMarkdownPath, markdown, "utf8");
  return audit;
}

function main() {
  const audit = auditProductizationLockCoverage();
  console.log(JSON.stringify(audit, null, 2));
  console.log(`\nProductization lock coverage audit written to ${auditJsonPath}`);
  console.log(`Productization lock coverage audit Markdown written to ${auditMarkdownPath}`);
  if (audit.status === "failed") {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

export {};
