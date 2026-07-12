#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "physical-world-spatial-grounding")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "physical-world-spatial-grounding"
  );
}

function readText(path, maxChars = 120000) {
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8").replace(/^\uFEFF/, "").slice(0, maxChars);
}

function newestDirectoryWithFile(root, fileName) {
  if (!existsSync(root)) return "";
  return (
    readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const dir = join(root, entry.name);
        const file = join(dir, fileName);
        return existsSync(file) ? { file, time: statSync(dir).mtimeMs } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.time - a.time)[0]?.file || ""
  );
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path && existsSync(path) ? pathToFileURL(path).href : "";
}

function link(label, path) {
  return path && existsSync(path)
    ? `<a href="${htmlEscape(fileHref(path))}">${htmlEscape(label)}</a>`
    : `<span>${htmlEscape(label)}: ${htmlEscape(path || "missing")}</span>`;
}

function containsAny(text, terms) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term.toLowerCase()));
}

function keywordEvidence(readmeText, reportText) {
  const combined = `${readmeText}\n${reportText}`;
  const checks = [
    {
      id: "camera_rgb_depth",
      label: "RGB/depth camera observation evidence",
      terms: ["RGB", "depth", "Camera.main", "raycast-depth", "RGB-D", "calibrated_rgbd_observation"]
    },
    {
      id: "camera_calibration",
      label: "Camera calibration, intrinsics, and extrinsics evidence",
      terms: ["camera calibration", "intrinsics", "extrinsics", "calibration", "cameraIntrinsics", "cameraExtrinsics"]
    },
    {
      id: "point_cloud_panel_pose",
      label: "Point cloud and panel pose grounding evidence",
      terms: ["point-cloud", "point cloud", "pointCloud", "panel poses", "panel-pose", "panelPoses"]
    },
    {
      id: "fold_angle_state",
      label: "Fold angle and state-estimation evidence",
      terms: ["fold angles", "fold-angle", "foldAnglesDegrees", "ObservationStateEstimator", "under-fold", "over-fold"]
    },
    {
      id: "sim_to_real_parity",
      label: "Sim-to-real parity and real evidence boundary",
      terms: ["sim-to-real", "trace parity", "real-world readiness", "calibrated real", "realEvidenceReady=false"]
    },
    {
      id: "unseen_geometry",
      label: "Unseen geometry benchmark evidence",
      terms: ["unseen geometry", "unseen-geometry", "held-out geometry", "same-topology"]
    },
    {
      id: "closed_loop_correction",
      label: "Closed-loop correction from observed spatial state",
      terms: ["ClosedLoopCorrectionPlanner", "corrective", "diagnosed", "delta-angle", "next-action"]
    }
  ];
  return checks.map((check) => ({
    ...check,
    present: containsAny(combined, check.terms),
    evidenceTermsFound: check.terms.filter((term) => containsAny(combined, [term]))
  }));
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    sourceProjectNotModified: true,
    noUnityExecution: true,
    noTargetSoftwareExecution: true,
    noScreenshotCapture: true,
    noFullLogRead: true,
    noMemoryWrite: true,
    noRuleEnablement: true,
    noRealWorldAuthorityClaim: true,
    noCompletionClaim: true,
    sourceEvidenceOnly: true,
    goalComplete: false
  };
}

function writeHtml(path, pack) {
  const rows = pack.evidenceRows
    .map(
      (row) => `<tr>
        <td><code>${htmlEscape(row.id)}</code></td>
        <td>${htmlEscape(row.label)}</td>
        <td>${htmlEscape(String(row.present))}</td>
        <td>${htmlEscape(row.evidenceTermsFound.join(", "))}</td>
      </tr>`
    )
    .join("");
  const handoffRows = pack.transparentOverlayHandoffRows
    .map(
      (row) => `<tr>
        <td>${htmlEscape(row.overlayNeed)}</td>
        <td>${htmlEscape(row.physicalGrounding)}</td>
        <td>${htmlEscape(row.teacherQuestion)}</td>
      </tr>`
    )
    .join("");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Physical World Spatial Grounding Pack</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 24px; color: #17202a; background: #f7f8fa; }
    main { max-width: 1120px; margin: 0 auto; }
    section { background: white; border: 1px solid #d9dee7; border-radius: 8px; padding: 18px; margin: 14px 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-top: 1px solid #e5e8ef; padding: 8px; text-align: left; vertical-align: top; }
    code, pre { background: #f0f3f7; border-radius: 6px; padding: 2px 4px; overflow-wrap: anywhere; }
    .locked { color: #8a2f18; font-weight: 600; }
  </style>
</head>
<body>
<main>
  <h1>Physical World Spatial Grounding Pack</h1>
  <section>
    <p><strong>Status:</strong> <code>${htmlEscape(pack.status)}</code></p>
    <p><strong>Source root:</strong> ${link(pack.sourceProject.root, pack.sourceProject.root)}</p>
    <p class="locked">Review-only grounding. This does not run Unity, execute target software, capture screenshots, enable rules, write memory, or claim real-world completion.</p>
  </section>
  <section>
    <h2>Evidence Rows</h2>
    <table><thead><tr><th>ID</th><th>Evidence</th><th>Present</th><th>Terms</th></tr></thead><tbody>${rows}</tbody></table>
  </section>
  <section>
    <h2>Transparent Overlay Handoff</h2>
    <table><thead><tr><th>Overlay Need</th><th>Physical Grounding</th><th>Teacher Question</th></tr></thead><tbody>${handoffRows}</tbody></table>
  </section>
</main>
</body>
</html>`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, pack) {
  writeFileSync(
    path,
    [
      "# Physical World Spatial Grounding Pack",
      "",
      `Status: ${pack.status}`,
      "",
      "This pack connects the existing Unity physical-world understanding prototype to the transparent sketch/2D/3D depth teaching chain.",
      "",
      "It is evidence-only. It does not run Unity, capture screenshots, execute target software, write memory, enable rules, claim technology acceptance, or claim the current goal complete.",
      "",
      "Use this as a grounding checklist when a teacher draws on the transparent overlay:",
      "",
      ...pack.transparentOverlayHandoffRows.map(
        (row) => `- ${row.overlayNeed}: ${row.physicalGrounding} | Ask: ${row.teacherQuestion}`
      )
    ].join("\n"),
    "utf8"
  );
}

const defaultSourceRoot = "D:\\AI对物理世界的理解\\UnityPhysicalWorldUnderstanding";
const sourceRoot = resolve(argValue("--source-root", defaultSourceRoot));
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), "artifacts", "physical-world-spatial-grounding-packs"))
);
mkdirSync(outputRoot, { recursive: true });
const packId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(basename(sourceRoot))}`;
const dir = join(outputRoot, packId);
mkdirSync(dir, { recursive: true });

const readmePath = join(sourceRoot, "README.md");
const reportPath = resolve(sourceRoot, "..", "deep-research-report.md");
const completionGatePath = newestDirectoryWithFile(
  join(sourceRoot, "Experiments", "physical-understanding-completion-gate"),
  "cardboard-box-v0-physical-understanding-completion-gate.json"
);
const readmeText = readText(readmePath);
const reportText = readText(reportPath);
const evidenceRows = keywordEvidence(readmeText, reportText);
const presentCount = evidenceRows.filter((row) => row.present).length;
const missing = evidenceRows.filter((row) => !row.present).map((row) => row.id);
const status =
  existsSync(sourceRoot) && presentCount >= 5
    ? "source_project_grounding_ready_for_transparent_overlay_review"
    : "source_project_grounding_incomplete_or_missing";
const lockState = locks();
const packPath = join(dir, "physical-world-spatial-grounding-pack.json");
const htmlPath = join(dir, "physical-world-spatial-grounding-pack.html");
const startHerePath = join(dir, "PHYSICAL_WORLD_SPATIAL_GROUNDING_START_HERE.md");
const pack = {
  ok: true,
  format: "transparent_ai_physical_world_spatial_grounding_pack_v1",
  packId,
  createdAt: new Date().toISOString(),
  status,
  sourceProject: {
    root: sourceRoot,
    readme: readmePath,
    report: reportPath,
    completionGate: completionGatePath,
    exists: existsSync(sourceRoot)
  },
  counts: {
    evidenceRows: evidenceRows.length,
    presentEvidenceRows: presentCount,
    missingEvidenceRows: missing.length
  },
  evidenceRows,
  transparentOverlayHandoffRows: [
    {
      overlayNeed: "2D anchor/region selection",
      physicalGrounding: "Bind teacher-marked regions to panel poses, keypoints, and normalized screen or calibrated camera coordinates.",
      teacherQuestion: "Which visible panel/feature/region is this mark attached to?"
    },
    {
      overlayNeed: "Perspective plane or face alignment",
      physicalGrounding: "Use camera calibration, plane hints, panel normals, and perspective relationships as evidence before any software action.",
      teacherQuestion: "Which face or plane should the drawn direction align with?"
    },
    {
      overlayNeed: "3D depth / near-far intent",
      physicalGrounding: "Use RGB-D, point cloud, zHint, and near/far relationships to separate depth intent from a flat screen arrow.",
      teacherQuestion: "Is this mark meant to move on the same plane, nearer, farther, or across a fold/hinge?"
    },
    {
      overlayNeed: "Angle, fold, rotation, or direction",
      physicalGrounding: "Use fold-angle observations, hinge axes, trajectory traces, and under/over-fold diagnosis before proposing corrections.",
      teacherQuestion: "Is this a target angle, a direction cue, or a correction from an observed mismatch?"
    },
    {
      overlayNeed: "Execution readiness boundary",
      physicalGrounding: "Treat Unity evidence as bounded prototype grounding unless calibrated real evidence, sim-to-real parity, and teacher review are present.",
      teacherQuestion: "Should this remain a dry-run explanation, or has the teacher reviewed enough evidence to prepare a separate approval gate?"
    }
  ],
  nextCommands: [
    {
      id: "create_teacher_spatial_drawing_handoff_with_physical_grounding",
      command:
        "node plugins\\transparent-ai-apprentice\\scripts\\create-current-goal-teacher-spatial-drawing-handoff.mjs --software \"teacher-selected engineering software\" --output-dir artifacts\\current-goal-teacher-spatial-drawing-handoffs"
    },
    {
      id: "validate_teacher_overlay_packet_after_grounding_review",
      command:
        "node plugins\\transparent-ai-apprentice\\scripts\\validate-transparent-sketch-overlay-packet.mjs --overlay-packet \"<teacher-exported-transparent-sketch-packet.json>\" --output-dir artifacts\\current-goal-transparent-sketch-overlay-packet-validations"
    }
  ],
  blockedClaims: [
    "claim_unity_project_proves_real_world_understanding",
    "execute_target_software_from_grounding_pack",
    "treat_grounding_pack_as_teacher_acceptance",
    "enable_rules_or_memory_from_grounding_pack",
    "claim_current_goal_complete_from_grounding_pack"
  ],
  missingEvidenceRows: missing,
  paths: {
    pack: packPath,
    html: htmlPath,
    startHere: startHerePath
  },
  locks: lockState,
  goalComplete: false
};

writeFileSync(packPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
writeHtml(htmlPath, pack);
writeReadme(startHerePath, pack);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_physical_world_spatial_grounding_pack_result_v1",
      status,
      packPath,
      htmlPath,
      startHerePath,
      counts: pack.counts,
      missingEvidenceRows: missing,
      locks: lockState
    },
    null,
    2
  )
);
