#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const root = mkdtempSync(join(tmpdir(), "ta-physical-world-grounding-"));
const sourceRoot = join(root, "UnityPhysicalWorldUnderstanding");
mkdirSync(sourceRoot, { recursive: true });
writeFileSync(
  join(root, "deep-research-report.md"),
  [
    "# Physical report",
    "Unity is the visualization and integration layer, not full real-world authority.",
    "Real readiness requires calibrated real evidence, sim-to-real trace parity, RGB-D, force, tactile, and unseen geometry."
  ].join("\n"),
  "utf8"
);
writeFileSync(
  join(sourceRoot, "README.md"),
  [
    "# Physical World Understanding in Unity",
    "RGB and raycast-depth proxy capture from Camera.main are exported.",
    "Camera calibration includes intrinsics, extrinsics, and calibrated_rgbd_observation.",
    "RGB-D point-cloud observation intake validates point cloud, panel poses, fold angles, and contact observations.",
    "ObservationStateEstimator compares fold angles and reports under-fold and over-fold errors.",
    "Sim-to-real trace parity compares pose, fold angle, and force error.",
    "Physical unseen geometry benchmark evaluates held-out same-topology variants.",
    "ClosedLoopCorrectionPlanner turns observed under-fold states into corrective delta-angle actions."
  ].join("\n"),
  "utf8"
);

const result = runNodeScript("create-physical-world-spatial-grounding-pack.mjs", [
  "--source-root",
  sourceRoot,
  "--output-dir",
  join(root, "grounding")
]);
const pack = readJson(result.packPath);

const checks = [
  {
    name: "Grounding pack is ready from bounded physical evidence",
    pass:
      pack.status === "source_project_grounding_ready_for_transparent_overlay_review" &&
      pack.counts.presentEvidenceRows >= 5 &&
      pack.evidenceRows.some((row) => row.id === "camera_rgb_depth" && row.present) &&
      pack.evidenceRows.some((row) => row.id === "point_cloud_panel_pose" && row.present) &&
      pack.evidenceRows.some((row) => row.id === "fold_angle_state" && row.present)
  },
  {
    name: "Transparent overlay handoff includes 2D, perspective, depth, and angle review questions",
    pass:
      pack.transparentOverlayHandoffRows.some((row) => row.overlayNeed.includes("2D")) &&
      pack.transparentOverlayHandoffRows.some((row) => row.overlayNeed.includes("Perspective")) &&
      pack.transparentOverlayHandoffRows.some((row) => row.overlayNeed.includes("3D")) &&
      pack.transparentOverlayHandoffRows.some((row) => row.overlayNeed.includes("Angle"))
  },
  {
    name: "Grounding pack keeps side-effect and authority locks closed",
    pass:
      pack.locks.reviewOnly === true &&
      pack.locks.noUnityExecution === true &&
      pack.locks.noTargetSoftwareExecution === true &&
      pack.locks.noScreenshotCapture === true &&
      pack.locks.noMemoryWrite === true &&
      pack.locks.noRuleEnablement === true &&
      pack.locks.noRealWorldAuthorityClaim === true &&
      pack.goalComplete === false
  }
];
const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      smoke: "transparent_ai_physical_world_spatial_grounding_pack_smoke_v1",
      status: failed.length ? "failed" : "passed",
      checks,
      artifacts: {
        pack: result.packPath,
        html: result.htmlPath,
        startHere: result.startHerePath
      }
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
