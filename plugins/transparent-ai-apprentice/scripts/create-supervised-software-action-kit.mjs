#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function multiArg(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function slugify(value) {
  return String(value || "supervised-software-action")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "supervised-software-action";
}

function readOverlayPacket(packetInput, goal, software) {
  if (!packetInput) return sampleOverlayPacket(goal, software);
  const trimmed = String(packetInput).trim();
  if (existsSync(trimmed)) return JSON.parse(readFileSync(trimmed, "utf8"));
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  throw new Error(`Overlay packet was not a file path or JSON object: ${packetInput}`);
}

function sampleOverlayPacket(goal, software) {
  return {
    format: "transparent_ai_sketch_overlay_packet_v1",
    goal,
    software,
    overlayMode: "2d_3d",
    coordinateSpace: {
      origin: "top_left_screen_or_screenshot",
      units: "normalized_0_to_1",
      supports2D: true,
      supports3DDepthHints: true
    },
    anchors: [
      { id: "target-field", type: "teacher_marked_region", label: "target field", box: [0.32, 0.28, 0.48, 0.36] }
    ],
    strokes: [
      {
        id: "click-target",
        mode: "screen_2d",
        semanticLabel: "click the marked target",
        points: [
          { x: 0.42, y: 0.32, t: 0, zHint: 0 },
          { x: 0.425, y: 0.323, t: 30, zHint: 0 }
        ]
      },
      {
        id: "drag-arrow",
        mode: "perspective_grid",
        semanticLabel: "drag this item to the right target plane",
        points: [
          { x: 0.18, y: 0.72, t: 0, zHint: 0 },
          { x: 0.64, y: 0.42, t: 90, zHint: 0.3 }
        ]
      }
    ],
    spatialIntent: {
      relationships: [
        { subject: "drag-arrow", relation: "perspective_to", object: "target-field" }
      ],
      perspectiveCues: [{ strokeId: "drag-arrow", cue: "perspective_grid" }],
      inferredTeacherIntent: "review_only: compile teacher drawing into supervised action candidates"
    }
  };
}

function firstPoint(stroke) {
  return Array.isArray(stroke?.points) && stroke.points.length > 0 ? stroke.points[0] : { x: 0.5, y: 0.5 };
}

function lastPoint(stroke) {
  return Array.isArray(stroke?.points) && stroke.points.length > 0
    ? stroke.points[stroke.points.length - 1]
    : firstPoint(stroke);
}

function distance(a, b) {
  const dx = Number(a.x ?? 0) - Number(b.x ?? 0);
  const dy = Number(a.y ?? 0) - Number(b.y ?? 0);
  return Math.sqrt(dx * dx + dy * dy);
}

function pointActionCoordinate(point) {
  return {
    xNormalized: clamp01(Number(point.x ?? 0.5)),
    yNormalized: clamp01(Number(point.y ?? 0.5)),
    zHint: Number(point.zHint ?? 0),
    coordinateSource: "transparent_overlay_normalized_point"
  };
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function writeUtf8Bom(path, text) {
  writeFileSync(path, `\uFEFF${text}`, "utf8");
}

function clamp01(value) {
  if (Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function actionFromStroke(stroke, index) {
  const start = firstPoint(stroke);
  const end = lastPoint(stroke);
  const label = String(stroke.semanticLabel || stroke.id || `stroke ${index + 1}`);
  const movement = distance(start, end);
  const confidence = movement > 0.08 ? "medium" : "low";
  const base = {
    sourceStrokeId: stroke.id || `stroke-${index + 1}`,
    semanticLabel: label,
    mode: stroke.mode || "screen_2d",
    teacherReviewRequired: true,
    confidence,
    validationBeforeExecute: [
      "teacher confirms active target window is correct",
      "teacher confirms normalized coordinates match the visible target",
      "dry run was reviewed before execution"
    ]
  };
  if (movement > 0.08) {
    return {
      ...base,
      id: `action-${index + 1}-drag`,
      kind: "drag",
      from: pointActionCoordinate(start),
      to: pointActionCoordinate(end),
      reason: "Long teacher stroke is interpreted as a drag or move gesture."
    };
  }
  return {
    ...base,
    id: `action-${index + 1}-click`,
    kind: "click",
    at: pointActionCoordinate(end),
    reason: "Short teacher stroke or tap-like mark is interpreted as a click target."
  };
}

function actionsFromSpatialInterpretation(interpretation) {
  if (!Array.isArray(interpretation?.suggestedActions)) return [];
  return interpretation.suggestedActions.map((suggested, index) => {
    const base = {
      id: `action-spatial-${index + 1}-${suggested.kind === "click" ? "click" : "drag"}`,
      kind: suggested.kind === "click" ? "click" : "drag",
      sourceStrokeId: suggested.sourceStrokeId,
      semanticLabel: suggested.semanticLabel || suggested.spatialReason || suggested.sourceStrokeId,
      mode: "spatial_intent_interpretation",
      teacherReviewRequired: true,
      confidence: suggested.confidence >= 0.65 ? "medium" : "low",
      confidenceScore: suggested.confidence,
      spatialReason: suggested.spatialReason,
      reason:
        suggested.kind === "click"
          ? "Spatial intent interpreter classified this mark as a click target."
          : "Spatial intent interpreter classified this stroke as a position, perspective, or depth drag.",
      validationBeforeExecute: [
        "teacher confirms active target window is correct",
        "teacher confirms interpreted spatial relationship matches the visible target",
        "dry run was reviewed before execution"
      ]
    };
    if (suggested.kind === "click") {
      return { ...base, at: suggested.at };
    }
    return { ...base, from: suggested.from, to: suggested.to };
  });
}

function extraActionsFromArgs(typeTexts, hotkeys, strokes) {
  const lastStrokeEnd = strokes.length > 0 ? pointActionCoordinate(lastPoint(strokes[strokes.length - 1])) : pointActionCoordinate({});
  const typeActions = typeTexts.map((text, index) => ({
    id: `action-type-${index + 1}`,
    kind: "type_text",
    text,
    at: lastStrokeEnd,
    teacherReviewRequired: true,
    confidence: "low",
    reason: "Teacher or agent provided explicit text to type after reviewing the overlay intent.",
    validationBeforeExecute: ["teacher confirms target text field is focused", "teacher confirms text is safe to type"]
  }));
  const hotkeyActions = hotkeys.map((hotkey, index) => ({
    id: `action-hotkey-${index + 1}`,
    kind: "hotkey",
    hotkey,
    teacherReviewRequired: true,
    confidence: "low",
    reason: "Teacher or agent provided an explicit hotkey after reviewing the overlay intent.",
    validationBeforeExecute: ["teacher confirms target software focus", "teacher confirms hotkey will not cause destructive change"]
  }));
  return [...typeActions, ...hotkeyActions];
}

const goal = argValue("--goal", argValue("--task", "Turn teacher overlay intent into reviewed software actions."));
const software = argValue("--software", argValue("--app", "target software"));
const processName = argValue("--process-name", "");
const windowTitle = argValue("--window-title", "");
const overlayPacketInput = argValue("--overlay-packet", "");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "supervised-action-kits")));
const typeTexts = multiArg("--type-text");
const hotkeys = multiArg("--hotkey");
mkdirSync(outputRoot, { recursive: true });

const overlayPacket = readOverlayPacket(overlayPacketInput, goal, software);
const kitId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const kitDir = join(outputRoot, kitId);
mkdirSync(kitDir, { recursive: true });

const planPath = join(kitDir, "supervised-action-plan.json");
const runnerPath = join(kitDir, "run-supervised-software-actions.ps1");
const manifestPath = join(kitDir, "supervised-action-manifest.json");
const policyPath = join(kitDir, "supervised-action-policy.json");
const readmePath = join(kitDir, "SUPERVISED_ACTION_START_HERE.md");
const overlayEvidencePath = join(kitDir, "source-transparent-sketch-overlay-packet.json");
const receiptPath = join(kitDir, "supervised-action-execution-receipt.json");
const receiptTemplatePath = join(kitDir, "supervised-action-execution-receipt-template.json");
const preflightPath = join(kitDir, "supervised-action-preflight.json");
const outcomeVerificationTemplatePath = join(kitDir, "supervised-action-outcome-verification-template.json");
const spatialExecutionReadinessPath = join(kitDir, "spatial-execution-readiness.json");

writeFileSync(overlayEvidencePath, `${JSON.stringify(overlayPacket, null, 2)}\n`, "utf8");
const interpretationResult = runNodeScript("interpret-transparent-sketch-spatial-intent.mjs", [
  "--overlay-packet",
  overlayEvidencePath,
  "--output-dir",
  kitDir
]);
const spatialIntentInterpretation = JSON.parse(readFileSync(interpretationResult.interpretationPath, "utf8"));

const strokes = Array.isArray(overlayPacket.strokes) ? overlayPacket.strokes : [];
const strokeActions = strokes.map(actionFromStroke);
const interpretedActions = actionsFromSpatialInterpretation(spatialIntentInterpretation);
const actions = [
  ...(interpretedActions.length > 0 ? interpretedActions : strokeActions),
  ...extraActionsFromArgs(typeTexts, hotkeys, strokes)
];
if (!actions.some((action) => action.kind === "click")) {
  const anchor = Array.isArray(overlayPacket.anchors) ? overlayPacket.anchors[0] : null;
  const box = Array.isArray(anchor?.box) ? anchor.box : [0.5, 0.5, 0.5, 0.5];
  actions.unshift({
    id: "action-anchor-click",
    kind: "click",
    at: pointActionCoordinate({ x: (Number(box[0]) + Number(box[2])) / 2, y: (Number(box[1]) + Number(box[3])) / 2 }),
    sourceStrokeId: anchor?.id || "fallback-anchor",
    semanticLabel: anchor?.label || "teacher marked target",
    mode: "screen_2d",
    teacherReviewRequired: true,
    confidence: "low",
    reason: "Fallback click candidate from teacher anchor because no tap-like stroke was present.",
    validationBeforeExecute: ["teacher confirms active target window is correct", "teacher confirms coordinate target"]
  });
}

const locks = {
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  teacherReviewRequired: true,
  teacherConfirmationRequired: true
};

const spatialRelationshipKinds = [
  ...new Set([
    ...(spatialIntentInterpretation.inferredRelationships || []).map((row) => row.relation),
    ...(spatialIntentInterpretation.declaredRelationships || []).map((row) => row.relation)
  ])
].filter(Boolean);
const spatialExecutionReadiness = {
  format: "transparent_ai_spatial_execution_readiness_v1",
  status: "waiting_for_teacher_review",
  sourceOverlayPacket: overlayEvidencePath,
  spatialIntentInterpretation: interpretationResult.interpretationPath,
  supports2DPosition:
    spatialIntentInterpretation.summary?.supports2D === true &&
    actions.some((action) => action.at || action.from || action.to),
  supportsPerspectiveRelationships:
    spatialRelationshipKinds.includes("perspective_to") ||
    Number(spatialIntentInterpretation.summary?.perspectiveCueCount || 0) > 0,
  supports3DDepthHints:
    spatialIntentInterpretation.summary?.supports3DDepthHints === true &&
    spatialRelationshipKinds.some((relation) => relation === "nearer_than" || relation === "farther_than"),
  relationshipKinds: spatialRelationshipKinds,
  actionBinding: actions.map((action) => ({
    actionId: action.id,
    kind: action.kind,
    sourceStrokeId: action.sourceStrokeId,
    spatialReason: action.spatialReason || action.reason || "",
    preserves2DPosition: Boolean(action.at || action.from || action.to),
    preservesPerspective:
      String(action.spatialReason || action.reason || "").includes("perspective") ||
      spatialRelationshipKinds.includes("perspective_to"),
    preservesDepth:
      String(action.spatialReason || action.reason || "").includes("nearer_than") ||
      String(action.spatialReason || action.reason || "").includes("farther_than") ||
      spatialRelationshipKinds.some((relation) => relation === "nearer_than" || relation === "farther_than")
  })),
  requiredTeacherConfirmations: [
    "the active target window is correct",
    "the normalized 2D coordinates match the visible target",
    "the perspective relationship matches the teacher's intended plane or vanishing direction",
    "the depth hint means a real nearer/farther operation in this software, not only visual emphasis",
    "the action order is correct before any Execute switch is used"
  ],
  blockedUntil: [
    "dry-run receipt reviewed",
    "preflight active-window and coordinate checks pass",
    "teacher explicitly supplies -TeacherConfirmed and -Execute",
    "post-action verification plan is ready"
  ],
  lowTokenPostActionVerification: [
    "runner receipt status and executed action ids",
    "preflight status and active-window match",
    "target software log metadata delta",
    "file modified-time delta",
    "manual teacher marker",
    "triggered screenshot only if cheap signals are ambiguous"
  ],
  locks: {
    ...locks,
    nativeUniversalExecution: false,
    fullContinuousRecording: false
  }
};

const plan = {
  format: "transparent_ai_supervised_software_action_plan_v1",
  kitId,
  createdAt: new Date().toISOString(),
  goal,
  targetSoftware: {
    software,
    processName,
    windowTitle,
    requiresActiveTargetWindow: true
  },
  overlayEvidence: {
    format: overlayPacket.format || "unknown",
    overlayMode: overlayPacket.overlayMode || "unknown",
    strokeCount: strokes.length,
    anchorCount: Array.isArray(overlayPacket.anchors) ? overlayPacket.anchors.length : 0,
    coordinateSpace: overlayPacket.coordinateSpace || null,
    spatialIntent: overlayPacket.spatialIntent || null,
    spatialIntentInterpretation: interpretationResult.interpretationPath,
    source: overlayEvidencePath
  },
  executionPolicy: {
    nativeUniversalExecution: false,
    defaultMode: "dry_run",
    executionMode: "dry_run_until_teacher_confirmed",
    teacherConfirmationRequired: true,
    requiresActiveTargetWindow: true,
    executeSwitchRequired: true,
    noBackgroundHiddenControl: true,
    supportedGenericActions: ["click", "drag", "type_text", "hotkey"],
    unsupportedWithoutAdapter: [
      "software-specific semantic operations",
      "saving or deleting files",
      "native CAD feature creation",
      "3D model edits without a reviewed software adapter"
    ]
  },
  spatialIntentInterpretation,
  spatialExecutionReadiness,
  spatialInterpretation: actions.map((action) => ({
    actionId: action.id,
    sourceStrokeId: action.sourceStrokeId,
    interpretedKind: action.kind,
    semanticLabel: action.semanticLabel || action.reason,
    reason: action.spatialReason || action.reason,
    confidence: action.confidence,
    confidenceScore: action.confidenceScore ?? null
  })),
  actions,
  publicTrace: actions.map((action, index) => ({
    step: `compile_overlay_action_${index + 1}`,
    inputObserved: `${action.kind} candidate from ${action.sourceStrokeId || action.id}`,
    ruleCandidates: ["transparent overlay spatial intent", "teacher confirmation gate"],
    actionProposed: action.kind,
    confidence: action.confidence,
    validation: action.validationBeforeExecute,
    teacherReviewPoint: "Confirm the target window, coordinates, and action order before execution.",
    memoryEffect: "none"
  })),
  reviewLocks: locks
};

const lowTokenPostActionVerification = {
  preferredSignals: [
    "runner receipt status and executed action ids",
    "target software log delta or event count",
    "file modified-time delta",
    "manual teacher marker",
    "triggered screenshot only if the receipt or cheap signals are ambiguous"
  ],
  nextSuggestedTools: ["verify_supervised_action_outcome", "watch_log_source_metadata_deltas", "teach_apprentice", "correct_last_result"]
};

const preflight = {
  format: "transparent_ai_supervised_software_action_preflight_v1",
  kitId,
  planPath,
  createdAt: new Date().toISOString(),
  status: "not_run_yet",
  defaultPreflightPath: preflightPath,
  targetSoftware: plan.targetSoftware,
  expectedActionCount: actions.length,
  expectedActionKinds: [...new Set(actions.map((action) => action.kind))],
  coordinateSystem: {
    units: "normalized_0_to_1",
    primaryScreenMapping: "runner maps normalized points to primary screen pixels at run time",
    coordinateBoundsOk: actions.every((action) => {
      const points = [action.at, action.from, action.to].filter(Boolean);
      return points.every(
        (point) =>
          Number(point.xNormalized) >= 0 &&
          Number(point.xNormalized) <= 1 &&
          Number(point.yNormalized) >= 0 &&
          Number(point.yNormalized) <= 1
      );
    })
  },
  activeWindowCheck: {
    required: true,
    expectedWindowTitleContains: windowTitle || "",
    expectedProcessName: processName || "",
    blockOnTitleMismatchWhenProvided: true,
    observedAtGenerationTime: "not_checked_until_runner"
  },
  riskReview: {
    highRiskActions: actions
      .filter((action) => action.kind === "hotkey")
      .map((action) => ({ id: action.id, kind: action.kind, reason: "Hotkeys can trigger app-level side effects." })),
    destructiveActionDetected: false,
    manualTeacherConfirmationRequired: true,
    executeRequires: ["-TeacherConfirmed", "-Execute"]
  },
  lowTokenPostActionVerification,
  teacherChecklist: [
    "target software is open, visible, and active",
    "active window title matches the expected software when a title hint exists",
    "normalized coordinates point at the visible teacher-marked target",
    "action order matches the teacher's 2D, perspective, and depth intent",
    "dry-run receipt was reviewed before execution"
  ],
  locks: {
    ...locks,
    nativeUniversalExecution: false,
    fullContinuousRecording: false
  }
};

const policy = {
  format: "transparent_ai_supervised_software_action_policy_v1",
  nativeUniversalExecution: false,
  teacherConfirmationRequired: true,
  defaultMode: "dry_run",
  executeRequires: ["-TeacherConfirmed", "-Execute"],
  preflightRequired: true,
  preflightFormat: "transparent_ai_supervised_software_action_preflight_v1",
  allowedGenericActions: ["click", "drag", "type_text", "hotkey"],
  blockedByDefault: [
    "hidden background execution",
    "unreviewed destructive actions",
    "foreground window title mismatch when the plan provides a target title",
    "claiming universal native app control",
    "saving accepted memory or unlocking packaging"
  ],
  rollbackReminder: "Create and keep a rollback point before replacing adapters, package state, or confirmed learning direction."
};

const receiptTemplate = {
  format: "transparent_ai_supervised_software_action_execution_receipt_v1",
  kitId,
  planPath,
  createdAt: new Date().toISOString(),
  status: "not_run_yet",
  executionMode: "dry_run_until_teacher_confirmed",
  defaultReceiptPath: receiptPath,
  preflightPath,
  expectedRunnerOutput: "The PowerShell runner writes this receipt for both dry-run and teacher-confirmed execution.",
  lowTokenPostActionVerification,
  teacherReviewFields: {
    targetWindowWasCorrect: "not_checked",
    visibleResultMatchedTeacherIntent: "not_checked",
    teacherNote: "",
    nextDecision: "needs_teacher_review"
  },
  locks: {
    ...locks,
    nativeUniversalExecution: false,
    fullContinuousRecording: false
  }
};

const outcomeVerificationTemplate = {
  format: "transparent_ai_supervised_action_outcome_verification_template_v1",
  kitId,
  createdAt: new Date().toISOString(),
  defaultTool: "verify_supervised_action_outcome",
  defaultArguments: {
    receipt: receiptPath,
    plan: planPath,
    preflight: preflightPath,
    queue: "<optional transparent_ai_software_observer_queue_v1 path when logs/files should be checked by metadata only>",
    teacherMarkers: ["<optional manual teacher marker after visible review>"]
  },
  expectedOutput: "transparent_ai_supervised_action_outcome_verification_v1",
  lowTokenStrategy:
    "Use runner receipt, preflight, optional log-source metadata delta gate, file/event markers, and teacher review before tail reads, screenshots, or memory writes.",
  screenshotsOnlyWhen: [
    "receipt says execution happened but cheap signals are ambiguous",
    "teacher marker says the visible result needs review",
    "metadata changed but bounded tail evidence is insufficient"
  ],
  locks: {
    ...locks,
    nativeUniversalExecution: false,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    logContentsRead: false
  }
};

const runner = String.raw`param(
  [string]$PlanPath = "__PLAN_PATH__",
  [switch]$TeacherConfirmed,
  [switch]$Execute
)

$ErrorActionPreference = "Stop"
$Plan = Get-Content -LiteralPath $PlanPath -Raw -Encoding UTF8 | ConvertFrom-Json
$KitDir = Split-Path -Parent $PlanPath
$ReceiptPath = Join-Path $KitDir "supervised-action-execution-receipt.json"
$PreflightPath = Join-Path $KitDir "supervised-action-preflight.json"

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class TaaWindow {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
}
"@

function Get-ActiveWindowSummary {
  $Handle = [TaaWindow]::GetForegroundWindow()
  $Builder = New-Object System.Text.StringBuilder 512
  [void][TaaWindow]::GetWindowText($Handle, $Builder, $Builder.Capacity)
  [pscustomobject]@{
    handle = $Handle.ToInt64()
    title = $Builder.ToString()
  }
}

function Test-NormalizedCoordinateBounds {
  foreach ($Action in $Plan.actions) {
    foreach ($Name in @("at", "from", "to")) {
      $Point = $Action.$Name
      if ($null -eq $Point) { continue }
      if ($Point.xNormalized -lt 0 -or $Point.xNormalized -gt 1 -or $Point.yNormalized -lt 0 -or $Point.yNormalized -gt 1) {
        return $false
      }
    }
  }
  return $true
}

function Write-Preflight {
  param(
    [string]$Status,
    [string]$Reason
  )
  $ActiveWindow = Get-ActiveWindowSummary
  $ExpectedTitle = [string]$Plan.targetSoftware.windowTitle
  $TitleMatched = $true
  if (-not [string]::IsNullOrWhiteSpace($ExpectedTitle)) {
    $TitleMatched = $ActiveWindow.title -like "*$ExpectedTitle*"
  }
  $Preflight = [pscustomobject]@{
    format = "transparent_ai_supervised_software_action_preflight_v1"
    kitId = $Plan.kitId
    planPath = $PlanPath
    createdAt = (Get-Date).ToUniversalTime().ToString("o")
    status = $Status
    reason = $Reason
    teacherConfirmed = [bool]$TeacherConfirmed
    executeSwitchPresent = [bool]$Execute
    targetSoftware = $Plan.targetSoftware
    activeWindow = $ActiveWindow
    activeWindowTitleMatched = [bool]$TitleMatched
    coordinateBoundsOk = [bool](Test-NormalizedCoordinateBounds)
    actionCount = @($Plan.actions).Count
    actionKinds = @($Plan.actions | ForEach-Object { $_.kind } | Select-Object -Unique)
    executeAllowed = [bool]($TeacherConfirmed -and $Execute -and $TitleMatched -and (Test-NormalizedCoordinateBounds))
    blockReasons = @(
      if (-not $TeacherConfirmed) { "missing TeacherConfirmed switch" }
      if (-not $Execute) { "missing Execute switch" }
      if (-not $TitleMatched) { "active window title mismatch" }
      if (-not (Test-NormalizedCoordinateBounds)) { "normalized coordinate outside 0..1 bounds" }
    )
    lowTokenPostActionVerification = [pscustomobject]@{
      preferredSignals = @("preflight status", "runner receipt", "target software log delta", "file modified-time delta", "manual teacher marker", "triggered screenshot only if ambiguous")
      nextSuggestedTools = @("verify_supervised_action_outcome", "watch_log_source_metadata_deltas", "teach_apprentice", "correct_last_result")
    }
    locks = [pscustomobject]@{
      nativeUniversalExecution = $false
      fullContinuousRecording = $false
      teacherConfirmationRequired = $true
      packagingGated = $true
    }
  }
  $Preflight | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $PreflightPath -Encoding UTF8
  $Preflight
}

function Write-ExecutionReceipt {
  param(
    [string]$Status,
    [string]$Reason,
    [object[]]$ExecutedActionIds,
    [object]$Preflight
  )
  $Receipt = [pscustomobject]@{
    format = "transparent_ai_supervised_software_action_execution_receipt_v1"
    kitId = $Plan.kitId
    planPath = $PlanPath
    createdAt = (Get-Date).ToUniversalTime().ToString("o")
    status = $Status
    reason = $Reason
    teacherConfirmed = [bool]$TeacherConfirmed
    executeSwitchPresent = [bool]$Execute
    preflightPath = $PreflightPath
    preflightStatus = $Preflight.status
    activeWindowTitleMatched = $Preflight.activeWindowTitleMatched
    coordinateBoundsOk = $Preflight.coordinateBoundsOk
    nativeUniversalExecution = $false
    fullContinuousRecording = $false
    teacherConfirmationRequired = $true
    requiresActiveTargetWindow = $true
    targetSoftware = $Plan.targetSoftware
    plannedActionCount = @($Plan.actions).Count
    plannedActionIds = @($Plan.actions | ForEach-Object { $_.id })
    executedActionIds = @($ExecutedActionIds)
    lowTokenPostActionVerification = [pscustomobject]@{
      preferredSignals = @("runner receipt", "target software log delta", "file modified-time delta", "manual teacher marker", "triggered screenshot only if ambiguous")
      nextSuggestedTools = @("verify_supervised_action_outcome", "watch_log_source_metadata_deltas", "teach_apprentice", "correct_last_result")
    }
    teacherReviewFields = [pscustomobject]@{
      targetWindowWasCorrect = "needs_teacher_review"
      visibleResultMatchedTeacherIntent = "needs_teacher_review"
      teacherNote = ""
      nextDecision = "needs_teacher_review"
    }
  }
  $Receipt | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ReceiptPath -Encoding UTF8
  $Receipt
}

function Convert-NormalizedPoint {
  param($Point)
  Add-Type -AssemblyName System.Windows.Forms
  $Bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  [pscustomobject]@{
    X = [int]($Bounds.Left + ($Point.xNormalized * $Bounds.Width))
    Y = [int]($Bounds.Top + ($Point.yNormalized * $Bounds.Height))
  }
}

if (-not $TeacherConfirmed -or -not $Execute) {
  $Preflight = Write-Preflight -Status "dry_run_preflight" -Reason "No mouse or keyboard events will be sent without both TeacherConfirmed and Execute."
  Write-ExecutionReceipt -Status "dry_run" -Reason "TeacherConfirmed and Execute switches are both required before mouse or keyboard events are sent." -ExecutedActionIds @() -Preflight $Preflight | ConvertTo-Json -Depth 12
  exit 0
}

if (-not $Plan.executionPolicy.teacherConfirmationRequired) {
  throw "Plan is missing teacher confirmation policy."
}

$Preflight = Write-Preflight -Status "execute_preflight" -Reason "Teacher supplied execution switches; checking active window and coordinate bounds before sending input."
if (-not $Preflight.executeAllowed) {
  Write-ExecutionReceipt -Status "blocked_by_preflight" -Reason "Preflight blocked execution before mouse or keyboard events." -ExecutedActionIds @() -Preflight $Preflight | ConvertTo-Json -Depth 12
  exit 1
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class TaaMouse {
  [DllImport("user32.dll")]
  public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")]
  public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
}
"@

$MOUSEEVENTF_LEFTDOWN = 0x0002
$MOUSEEVENTF_LEFTUP = 0x0004
$Executed = New-Object System.Collections.ArrayList

foreach ($Action in $Plan.actions) {
  if ($Action.kind -eq "click") {
    $P = Convert-NormalizedPoint $Action.at
    [TaaMouse]::SetCursorPos($P.X, $P.Y) | Out-Null
    Start-Sleep -Milliseconds 80
    [TaaMouse]::mouse_event($MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 80
    [TaaMouse]::mouse_event($MOUSEEVENTF_LEFTUP, 0, 0, 0, [UIntPtr]::Zero)
    [void]$Executed.Add($Action.id)
  } elseif ($Action.kind -eq "drag") {
    $From = Convert-NormalizedPoint $Action.from
    $To = Convert-NormalizedPoint $Action.to
    [TaaMouse]::SetCursorPos($From.X, $From.Y) | Out-Null
    Start-Sleep -Milliseconds 80
    [TaaMouse]::mouse_event($MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 120
    [TaaMouse]::SetCursorPos($To.X, $To.Y) | Out-Null
    Start-Sleep -Milliseconds 120
    [TaaMouse]::mouse_event($MOUSEEVENTF_LEFTUP, 0, 0, 0, [UIntPtr]::Zero)
    [void]$Executed.Add($Action.id)
  } elseif ($Action.kind -eq "type_text") {
    [System.Windows.Forms.SendKeys]::SendWait($Action.text)
    [void]$Executed.Add($Action.id)
  } elseif ($Action.kind -eq "hotkey") {
    [System.Windows.Forms.SendKeys]::SendWait($Action.hotkey)
    [void]$Executed.Add($Action.id)
  } else {
    throw "Unsupported action kind: $($Action.kind)"
  }
}

Write-ExecutionReceipt -Status "executed_under_teacher_supervision" -Reason "Teacher confirmed visible target window, preflight passed, and execution switch was present." -ExecutedActionIds @($Executed) -Preflight $Preflight | ConvertTo-Json -Depth 12
`;

const manifest = {
  format: "transparent_ai_supervised_software_action_kit_v1",
  kitId,
  goal,
  software,
  files: {
    readme: readmePath,
    actionPlan: planPath,
    runner: runnerPath,
    policy: policyPath,
    preflight: preflightPath,
    executionReceipt: receiptPath,
    executionReceiptTemplate: receiptTemplatePath,
    outcomeVerificationTemplate: outcomeVerificationTemplatePath,
    spatialIntentInterpretation: interpretationResult.interpretationPath,
    spatialExecutionReadiness: spatialExecutionReadinessPath,
    sourceOverlayPacket: overlayEvidencePath,
    manifest: manifestPath
  },
  capabilities: {
    overlayPacketInput: true,
    compilesSpatialIntentToActionPlan: true,
    interpretsPerspectiveAndDepthCues: true,
    interpretsRelativePosition: true,
    genericMouseKeyboardBridge: true,
    defaultMode: "dry_run",
    writesPreflight: true,
    blocksOnTargetWindowMismatch: true,
    teacherConfirmationRequired: true,
    requiresActiveTargetWindow: true,
    writesExecutionReceipt: true,
    writesOutcomeVerificationTemplate: true,
  lowTokenPostActionVerification: true,
    spatialExecutionReadiness: true,
    nativeUniversalExecution: false,
    noBackgroundHiddenControl: true
  },
  nextTeacherAction: "Review supervised-action-plan.json, focus the target window, then run the PowerShell runner without switches for dry run. Inspect supervised-action-preflight.json and supervised-action-execution-receipt-template.json before execution, then run verify_supervised_action_outcome on supervised-action-execution-receipt.json after a runner pass. Add -TeacherConfirmed -Execute only after confirming coordinates, active window, and action order.",
  reviewLocks: locks
};

writeFileSync(planPath, JSON.stringify(plan, null, 2), "utf8");
writeFileSync(spatialExecutionReadinessPath, JSON.stringify(spatialExecutionReadiness, null, 2), "utf8");
writeFileSync(preflightPath, JSON.stringify(preflight, null, 2), "utf8");
writeFileSync(policyPath, JSON.stringify(policy, null, 2), "utf8");
writeFileSync(receiptTemplatePath, JSON.stringify(receiptTemplate, null, 2), "utf8");
writeFileSync(outcomeVerificationTemplatePath, JSON.stringify(outcomeVerificationTemplate, null, 2), "utf8");
writeUtf8Bom(runnerPath, runner.replace("__PLAN_PATH__", planPath.replaceAll("\\", "\\\\")));
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
writeFileSync(readmePath, [
  "# Supervised Software Action Bridge",
  "",
  `Goal: ${goal}`,
  `Software: ${software}`,
  "",
  "This kit turns `transparent_ai_sketch_overlay_packet_v1` evidence into a reviewed `transparent_ai_supervised_software_action_plan_v1`.",
  "",
  "Default behavior is dry run. The generated PowerShell runner prints the plan unless both `-TeacherConfirmed` and `-Execute` are present.",
  "",
  "This is a supervised generic UI bridge, not universal native app control. It requires the teacher to keep the target software visible, active, and confirm coordinates before execution.",
  "",
  "Suggested review order:",
  "",
  `1. Open ${basename(spatialExecutionReadinessPath)} and confirm the 2D position, perspective relation, and 3D depth hints were preserved.`,
  `2. Open ${basename(planPath)} and check every action.`,
  "3. Put the target software in the exact expected state.",
  "4. Run the runner without switches and review the dry run JSON.",
  `5. Review ${basename(preflightPath)} and confirm active window, normalized coordinates, action risk, and low-token verification signals.`,
  `6. Review ${basename(receiptTemplatePath)} so the teacher knows what receipt fields will be written.`,
  "7. Only if the teacher confirms, run with `-TeacherConfirmed -Execute`. The runner blocks when a provided target window title does not match the foreground window.",
  `8. Inspect ${basename(receiptPath)} after the dry run or supervised execution.`,
  `9. Run \`verify_supervised_action_outcome\` using ${basename(outcomeVerificationTemplatePath)}. Prefer the preflight, receipt, metadata-only log deltas, event counts, file modified-time deltas, or a manual teacher marker before asking for a screenshot.`,
  "",
  "Locked defaults: ruleEnabled=false, accepted=false, technologyAccepted=false, packagingGated=true."
].join("\n"), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_supervised_software_action_kit_result_v1",
  kitId,
  kitPath: manifestPath,
  teacherReadme: readmePath,
  actionPlan: planPath,
  spatialExecutionReadinessPath,
  runner: runnerPath,
  policy: policyPath,
  preflight: preflightPath,
  executionReceipt: receiptPath,
  executionReceiptTemplate: receiptTemplatePath,
  outcomeVerificationTemplate: outcomeVerificationTemplatePath,
  actionCount: actions.length,
  actionKinds: [...new Set(actions.map((action) => action.kind))],
  spatialIntentInterpretation: interpretationResult.interpretationPath,
  spatialExecutionReadiness: true,
  spatialExecutionReadinessFormat: spatialExecutionReadiness.format,
  defaultMode: "dry_run",
  writesPreflight: true,
  blocksOnTargetWindowMismatch: true,
  teacherConfirmationRequired: true,
  requiresActiveTargetWindow: true,
  writesExecutionReceipt: true,
  writesOutcomeVerificationTemplate: true,
  lowTokenPostActionVerification: true,
  nativeUniversalExecution: false,
  reviewLocks: locks
}, null, 2));
