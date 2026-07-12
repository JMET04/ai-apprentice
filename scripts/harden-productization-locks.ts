import fs from "node:fs";
import path from "node:path";

type JsonRecord = Record<string, unknown>;

type HardenedArtifact = {
  path: string;
  responseMode: string;
  status: string;
  addedFields: string[];
};

type DangerousArtifact = {
  path: string;
  responseMode: string;
  status: string;
  dangerousFields: string[];
};

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, "artifacts", "productization");
const receiptJsonPath = path.join(artifactsDir, "productization-lock-hardening.json");
const receiptMarkdownPath = path.join(artifactsDir, "productization-lock-hardening.md");

const expectedLocks = {
  allSoftwareObjective: "paused",
  releaseDecision: "do_not_release",
  reviewOnly: true,
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
    record.allSoftwareObjective === "paused" ||
    record.releaseDecision === "do_not_release" ||
    record.reviewOnly === true ||
    record.accepted === false ||
    record.packagingGated === true ||
    record.canRelease === false ||
    record.canActivateRealModel === false
  );
}

function relativeArtifactPath(targetPath: string) {
  return path.relative(rootDir, targetPath).replaceAll("\\", "/");
}

function findDangerousFields(record: JsonRecord) {
  return Object.entries(expectedLocks)
    .filter(([field, expected]) => field in record && record[field] !== expected)
    .map(([field, expected]) => `${field}=${valueLabel(record[field])}; expected=${String(expected)}`);
}

function hardenRecord(record: JsonRecord) {
  const addedFields: string[] = [];

  for (const [field, expected] of Object.entries(expectedLocks)) {
    if (!(field in record)) {
      record[field] = expected;
      addedFields.push(field);
    }
  }

  return addedFields;
}

function markdownList(rows: HardenedArtifact[]) {
  if (rows.length === 0) return "- none";
  return rows.map((row) => `- \`${row.path}\`: ${row.addedFields.join(", ")}`).join("\n");
}

export function hardenProductizationLocks() {
  const allJsonPaths = fs.existsSync(artifactsDir)
    ? fs.readdirSync(artifactsDir)
        .filter((name) => name.endsWith(".json"))
        .map((name) => path.join(artifactsDir, name))
        .sort()
    : [];

  const boundaryArtifacts = allJsonPaths
    .map((targetPath) => ({ targetPath, record: readJson(targetPath) }))
    .filter((item): item is { targetPath: string; record: JsonRecord } => Boolean(item.record))
    .filter((item) => isBoundaryLike(item.record));

  const dangerousArtifacts: DangerousArtifact[] = [];
  const hardenedArtifacts: HardenedArtifact[] = [];

  for (const item of boundaryArtifacts) {
    const dangerousFields = findDangerousFields(item.record);
    const artifactPath = relativeArtifactPath(item.targetPath);

    if (dangerousFields.length > 0) {
      dangerousArtifacts.push({
        path: artifactPath,
        responseMode: valueLabel(item.record.responseMode),
        status: valueLabel(item.record.status),
        dangerousFields
      });
      continue;
    }

    const addedFields = hardenRecord(item.record);
    if (addedFields.length > 0) {
      fs.writeFileSync(item.targetPath, `${JSON.stringify(item.record, null, 2)}\n`, "utf8");
      hardenedArtifacts.push({
        path: artifactPath,
        responseMode: valueLabel(item.record.responseMode),
        status: valueLabel(item.record.status),
        addedFields
      });
    }
  }

  const status = dangerousArtifacts.length > 0 ? "failed" : "passed";
  const receipt = {
    responseMode: "productization_lock_hardening_json_v1",
    status,
    generatedAt: new Date().toISOString(),
    command: "npm run harden:productization-locks",
    productScope: "bounded_core_teaching_loop",
    allSoftwareObjective: "paused",
    releaseDecision: "do_not_release",
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    canRelease: false,
    canActivateRealModel: false,
    scannedJsonFiles: allJsonPaths.length,
    boundaryLikeArtifacts: boundaryArtifacts.length,
    hardenedArtifacts: hardenedArtifacts.length,
    dangerousArtifacts: dangerousArtifacts.length,
    hardenedArtifactDetails: hardenedArtifacts,
    dangerousArtifactDetails: dangerousArtifacts,
    nextAction:
      dangerousArtifacts.length > 0
        ? "Stop and fix dangerous productization lock values before packaging or inviting testers."
        : "Run npm run audit:productization-lock-coverage to verify every boundary-like JSON artifact now carries explicit top-level productization locks."
  };

  const markdown = `# Productization Lock Hardening\n\nStatus: \`${status}\`\n\nGenerated: \`${receipt.generatedAt}\`\n\n## Summary\n\n- Boundary-like JSON artifacts: \`${boundaryArtifacts.length}\`\n- Hardened artifacts: \`${hardenedArtifacts.length}\`\n- Dangerous artifacts: \`${dangerousArtifacts.length}\`\n\n## Hardened Artifacts\n\n${markdownList(hardenedArtifacts)}\n\n## Dangerous Artifacts\n\n${
    dangerousArtifacts.length === 0
      ? "- none"
      : dangerousArtifacts.map((row) => `- \`${row.path}\`: ${row.dangerousFields.join("; ")}`).join("\n")
  }\n\n## Boundary\n\nThis hardening pass only adds missing top-level lock fields to existing boundary-like productization JSON. It does not unlock release, packaging, real-model activation, or all-software scope.\n`;

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(receiptJsonPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  fs.writeFileSync(receiptMarkdownPath, markdown, "utf8");
  return receipt;
}

function main() {
  const receipt = hardenProductizationLocks();
  console.log(JSON.stringify(receipt, null, 2));
  console.log(`\nProductization lock hardening receipt written to ${receiptJsonPath}`);
  console.log(`Productization lock hardening Markdown written to ${receiptMarkdownPath}`);
  if (receipt.status !== "passed") {
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
