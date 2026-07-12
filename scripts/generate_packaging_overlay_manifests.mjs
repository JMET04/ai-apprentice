import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildOverlayManifest } from "./packaging_precision_core.mjs";

const WORKSPACE = "D:\\Transparent AI Apprentice MCP";
const SESSION_ROOT = path.join(WORKSPACE, "artifacts", "packaging_teaching_session");
const PROFILE_FILE = path.join(SESSION_ROOT, "annotation_overlay_profiles.json");
const OUTPUT_DIR = path.join(SESSION_ROOT, "annotation_overlays");

const CASES = [
  {
    id: "case_01_transport_box",
    label: "案例 01：电子设备运输外箱",
    baseImage: path.join(SESSION_ROOT, "image2_review_images", "case_01_transport_box_image2_review.png"),
    catalogFile: path.join(SESSION_ROOT, "case_01_transport_box", "cad", "object_catalog.json"),
  },
  {
    id: "case_02_auto_lock_carton",
    label: "案例 02：小型零售自锁底纸盒",
    baseImage: path.join(SESSION_ROOT, "image2_review_images", "case_02_auto_lock_carton_image2_review.png"),
    catalogFile: path.join(SESSION_ROOT, "case_02_auto_lock_carton", "cad", "object_catalog.json"),
  },
  {
    id: "case_03_master_carton_12pack",
    label: "案例 03：12 入集合运输箱",
    baseImage: path.join(SESSION_ROOT, "image2_review_images", "case_03_master_carton_12pack_image2_review.png"),
    catalogFile: path.join(SESSION_ROOT, "case_03_master_carton_12pack", "cad", "object_catalog.json"),
  },
];

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function pngDimensions(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature || buffer.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error("Expected PNG with IHDR header");
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

async function buildCase(caseConfig, profile) {
  const [imageBuffer, catalog] = await Promise.all([
    fs.readFile(caseConfig.baseImage),
    readJson(caseConfig.catalogFile),
  ]);
  const dimensions = pngDimensions(imageBuffer);
  if (dimensions.width !== profile.canvas.width || dimensions.height !== profile.canvas.height) {
    throw new Error(`${caseConfig.id} profile canvas does not match immutable base image`);
  }
  const manifest = buildOverlayManifest({
    caseId: caseConfig.id,
    baseImage: {
      path: caseConfig.baseImage,
      sha256: crypto.createHash("sha256").update(imageBuffer).digest("hex"),
      ...dimensions,
    },
    catalogFile: caseConfig.catalogFile,
    catalog,
    profile,
  });
  const outputFile = path.join(OUTPUT_DIR, `${caseConfig.id}.overlay.json`);
  await fs.writeFile(outputFile, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return {
    id: caseConfig.id,
    label: caseConfig.label,
    baseImage: caseConfig.baseImage,
    baseImageSha256: manifest.baseImage.sha256,
    overlayManifest: outputFile,
    objectCount: manifest.labels.length,
    displayGroupCount: manifest.displayGroups.length,
    dimensionDisplayGroupCount: manifest.displayGroups.filter((group) => group.category === "dimension").length,
  };
}

export async function generateOverlayManifests() {
  const profiles = await readJson(PROFILE_FILE);
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const results = [];
  for (const caseConfig of CASES) {
    const profile = profiles.cases[caseConfig.id];
    if (!profile) throw new Error(`Missing registration profile for ${caseConfig.id}`);
    results.push(await buildCase(caseConfig, profile));
  }
  const index = {
    schema: "packaging_annotation_overlay_index_v1",
    generatedAt: new Date().toISOString(),
    profileFile: PROFILE_FILE,
    cases: results,
    policy: {
      standardBaseImagesImmutable: true,
      overlaysAreSeparate: true,
      reviewOnly: true,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
    },
  };
  const indexFile = path.join(OUTPUT_DIR, "index.json");
  await fs.writeFile(indexFile, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  return { indexFile, cases: results };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateOverlayManifests()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
