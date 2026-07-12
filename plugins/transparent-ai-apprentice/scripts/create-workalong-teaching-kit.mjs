#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function argValues(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "workalong-teaching-kit";
}

function jsonScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function writeUtf8Bom(path, text) {
  writeFileSync(path, `\uFEFF${text}`, "utf8");
}

const goal = argValue("--goal", argValue("--task", "Teach the apprentice while the teacher works."));
const software = argValue("--software", argValue("--tool", "desktop software"));
const questionMode = argValue("--question-mode", argValue("--preferred-question-mode", "both"));
const locale = argValue("--locale", "zh-CN");
const preferredTone = argValue("--preferred-tone", "concise_direct");
const teacherName = argValue("--teacher-name");
const futureInput = argValue("--future-input");
const outputRoot = argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "workalong-kits"));
const logPaths = [...argValues("--log-path"), ...argValues("--log")];
const screenEvidencePaths = [...argValues("--screen-evidence"), ...argValues("--screenshot"), ...argValues("--screen-path")];
const eventLogPaths = [...argValues("--event-log"), ...argValues("--trace-path")];

mkdirSync(outputRoot, { recursive: true });
const kitId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const kitDir = join(outputRoot, kitId);
mkdirSync(kitDir, { recursive: true });

const readmePath = join(kitDir, "WORKALONG_START_HERE.md");
const overlayPath = join(kitDir, "workalong-overlay.html");
const collectorPath = join(kitDir, "collect-workalong-evidence.ps1");
const manifestPath = join(kitDir, "workalong-teaching-manifest.json");
const sourceMapPath = join(kitDir, "workalong-source-map.json");
const policyPath = join(kitDir, "workalong-observation-policy.json");
const templatePath = join(kitDir, "workalong-evidence-template.json");
const finalizedObservationPath = join(kitDir, "workalong-observation.json");
const finalizerScriptPath = join(__dirname, "finalize-workalong-observation.mjs");

const locks = {
  ruleEnabled: false,
  accepted: false,
  packagingGated: true,
  technologyAccepted: false,
  requiresTeacherConfirmation: true
};

const observationPolicy = {
  format: "transparent_ai_workalong_observation_policy_v1",
  kitId,
  goal,
  software,
  principle: "Spend tokens only on state changes, not continuous screen video.",
  tokenBudgetStrategy: [
    "Watch file timestamps, log tail hashes, and teacher marker events first.",
    "Capture a screenshot only after a log delta, error keyword, window-state marker, or teacher flag.",
    "Throttle screenshots and store file paths plus short observations instead of image bytes.",
    "Keep only the last useful log tail, the trigger reason, and the teacher answer.",
    "Export a compact transparent_ai_workalong_observation_v1 packet for teach_apprentice."
  ],
  triggers: [
    "log_file_changed",
    "error_keyword_detected",
    "warning_or_rebuild_keyword_detected",
    "manual_teacher_marker_changed",
    "teacher_question_answered",
    "before_after_state_marked"
  ],
  screenshotPolicy: {
    defaultMode: "on_trigger_only",
    minimumSecondsBetweenSnapshots: 20,
    fullContinuousRecording: false
  },
  questionPolicy: {
    mode: questionMode,
    askWhen: [
      "A log change is not explainable from the tail summary.",
      "The same command leads to a new screen state.",
      "The teacher makes a choice that could become a reusable rule.",
      "A counterexample or exception appears."
    ],
    askBeforeSavingRule: true
  },
  locks
};

const sourceMap = {
  format: "transparent_ai_workalong_source_map_v1",
  kitId,
  software,
  logPaths,
  screenEvidencePaths,
  eventLogPaths,
  recommendedScenarios: [
    {
      id: "cad-solidworks-cam-cae",
      tools: ["SolidWorks", "CAD", "CAM", "CAE", "FreeCAD", "Fusion 360", "Inventor"],
      watch: ["journal or rebuild logs", "solver/export logs", "model file paths", "teacher screenshots on rebuild/error"],
      learn: ["parameter choices", "feature order", "failure recovery", "validation checkpoints"]
    },
    {
      id: "ide-terminal-git",
      tools: ["editor", "terminal", "git", "test runner"],
      watch: ["command output", "test logs", "changed files", "error snapshots"],
      learn: ["debug sequence", "safe commands", "retry boundaries", "review checkpoints"]
    },
    {
      id: "browser-saas-operations",
      tools: ["browser", "CRM", "ERP", "admin console", "support desk"],
      watch: ["browser recorder events", "audit logs", "form state screenshots"],
      learn: ["routing rules", "approval criteria", "exception handling"]
    },
    {
      id: "spreadsheet-bi-documents",
      tools: ["Excel", "Sheets", "Power BI", "Word", "PowerPoint"],
      watch: ["file changes", "exported tables", "screenshots after formulas/charts"],
      learn: ["data cleanup", "report formatting", "review questions"]
    },
    {
      id: "design-media-3d",
      tools: ["Figma", "Photoshop", "Blender", "video editor", "slicer"],
      watch: ["exported assets", "render logs", "version snapshots"],
      learn: ["style decisions", "before/after quality checks", "reject criteria"]
    }
  ],
  nativeIntegrationRequired: false,
  locks
};

const evidenceTemplate = {
  format: "transparent_ai_workalong_observation_v1",
  kitId,
  sourceTool: "transparent-ai-apprentice workalong kit",
  goal,
  software,
  tokenPolicy: observationPolicy.tokenBudgetStrategy,
  logs: logPaths.map((path) => ({ path, trigger: "not_run_yet", tailSummary: "" })),
  screenEvidence: screenEvidencePaths.map((path) => ({ path, reason: "teacher_supplied" })),
  eventLogs: eventLogPaths.map((path) => ({ path, source: "existing event log" })),
  questions: [],
  teacherAnswers: [],
  events: [
    { type: "workalong_policy", text: "Use log deltas and triggered screenshots instead of continuous recording.", order: 1 },
    { type: "workalong_setup", software, logPathCount: logPaths.length, screenEvidencePathCount: screenEvidencePaths.length, order: 2 }
  ],
  locks
};

const manifest = {
  ok: true,
  format: "transparent_ai_workalong_teaching_kit_v1",
  kitId,
  goal,
  software,
  kitDir,
  files: {
    teacherReadme: readmePath,
    overlay: overlayPath,
    collector: collectorPath,
    sourceMap: sourceMapPath,
    observationPolicy: policyPath,
    evidenceTemplate: templatePath,
    finalizedObservation: finalizedObservationPath,
    manifest: manifestPath
  },
  questionMode,
  preferredTone,
  teacherName,
  locale,
  technology: {
    primary: "File timestamp and log-tail watcher plus triggered screenshots",
    overlay: "Local browser HTML with optional Web Speech API and manual text",
    customNativeIntegration: false,
    fullContinuousRecording: false,
    networkRequired: false
  },
  nextMcpCalls: [
    {
      when: "The collector has written workalong-events.jsonl and the teacher wants a compact observation packet.",
      command: `"${process.execPath}" "${finalizerScriptPath}" --manifest "${manifestPath}"`,
      output: finalizedObservationPath
    },
    {
      when: "The teacher exports the compact work-along observation JSON.",
      tool: "teach_apprentice",
      arguments: {
        goal,
        message: "<paste the generated transparent_ai_workalong_observation_v1 JSON>",
        tool: `${software} workalong kit`,
        ...(futureInput ? { futureInput } : {})
      }
    },
    {
      when: "The teacher wants to correct the inferred rule after replay.",
      tool: "teach_apprentice",
      arguments: {
        message: "<teacher correction, approval, or approve and remember>"
      }
    }
  ],
  observationPolicy,
  sourceMap,
  locks
};

const collectorScript = `param(
  [string[]]$LogPath = @(${logPaths.map((path) => `"${path.replace(/"/g, '`"')}"`).join(", ")}),
  [string]$OutDir = "${kitDir.replace(/\\/g, "\\\\")}",
  [int]$TailLines = 80,
  [int]$PollSeconds = 2,
  [int]$MinSecondsBetweenSnapshots = 20,
  [int]$MaxPolls = 0,
  [switch]$CaptureScreenshots
)

$ErrorActionPreference = "Stop"
$EventPath = Join-Path $OutDir "workalong-events.jsonl"
$ScreenshotDir = Join-Path $OutDir "triggered-screenshots"
$MarkerPath = Join-Path $OutDir "teacher-marker.txt"
New-Item -ItemType Directory -Force -Path $OutDir, $ScreenshotDir | Out-Null
if (-not (Test-Path -LiteralPath $MarkerPath)) {
  Set-Content -LiteralPath $MarkerPath -Value "Edit this file when you want to force a learning checkpoint." -Encoding UTF8
}

$State = @{}
$LastSnapshotAt = Get-Date "2000-01-01"
$PollCount = 0
$InitialMarker = Get-Item -LiteralPath $MarkerPath
$State["__teacher_marker__"] = "$($InitialMarker.LastWriteTimeUtc.Ticks):$($InitialMarker.Length)"

function Write-WorkalongEvent([hashtable]$Event) {
  $Event.format = "transparent_ai_workalong_observation_event_v1"
  $Event.kitId = "${kitId}"
  $Event.software = "${software.replace(/"/g, '\\"')}"
  $Event.timestamp = (Get-Date).ToString("o")
  $Event.locks = @{
    ruleEnabled = $false
    accepted = $false
    packagingGated = $true
    technologyAccepted = $false
  }
  ($Event | ConvertTo-Json -Depth 12 -Compress) | Add-Content -LiteralPath $EventPath -Encoding UTF8
}

function New-TriggeredScreenshot([string]$Reason) {
  if (-not $CaptureScreenshots) { return "" }
  $now = Get-Date
  if (($now - $script:LastSnapshotAt).TotalSeconds -lt $MinSecondsBetweenSnapshots) { return "" }
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
  $path = Join-Path $ScreenshotDir ("trigger-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".png")
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
  $script:LastSnapshotAt = $now
  return $path
}

Write-WorkalongEvent @{
  type = "collector_started"
  reason = "low_token_event_driven_observation"
  tokenPolicy = "Watch log deltas first; screenshot only on triggers."
  watchedLogPaths = $LogPath
  markerPath = $MarkerPath
}

while ($true) {
  foreach ($path in $LogPath) {
    if (-not $path -or -not (Test-Path -LiteralPath $path)) { continue }
    $item = Get-Item -LiteralPath $path
    $key = $item.FullName
    $signature = "$($item.LastWriteTimeUtc.Ticks):$($item.Length)"
    if ($State[$key] -eq $signature) { continue }
    $State[$key] = $signature
    $tail = @(Get-Content -LiteralPath $key -Tail $TailLines -ErrorAction SilentlyContinue)
    $joined = ($tail -join "\`n")
    $seriousKeyword = $joined -match "(?i)(error|failed|exception|fatal|warning|solver)"
    $stateKeyword = ($joined -match "(?i)(rebuild|export)") -and ($joined -notmatch "(?i)(completed normally|success|succeeded|completed successfully)")
    $trigger = if ($seriousKeyword -or $stateKeyword) { "error_or_state_keyword" } else { "log_file_changed" }
    $screenshot = if ($trigger -eq "error_or_state_keyword") { New-TriggeredScreenshot $trigger } else { "" }
    Write-WorkalongEvent @{
      type = $trigger
      path = $key
      bytes = $item.Length
      tailLineCount = $tail.Count
      tailSummary = ($joined.Substring(0, [Math]::Min($joined.Length, 2000)))
      screenshotPath = $screenshot
    }
  }

  $PollCount += 1
  if ($MaxPolls -gt 0 -and $PollCount -ge $MaxPolls) {
    break
  }

  $marker = Get-Item -LiteralPath $MarkerPath
  $markerKey = "__teacher_marker__"
  $markerSignature = "$($marker.LastWriteTimeUtc.Ticks):$($marker.Length)"
  if ($State[$markerKey] -ne $markerSignature) {
    $State[$markerKey] = $markerSignature
    Write-WorkalongEvent @{
      type = "manual_teacher_marker_changed"
      path = $MarkerPath
      note = (Get-Content -LiteralPath $MarkerPath -Raw -Encoding UTF8)
      screenshotPath = (New-TriggeredScreenshot "manual_teacher_marker_changed")
    }
  }

  Start-Sleep -Seconds $PollSeconds
}
`;

const overlayHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Transparent AI Apprentice Work-Along Kit</title>
  <style>
    :root { color-scheme: light; --ink:#17202a; --muted:#5f6b76; --line:#cfd8df; --panel:#f7f9fb; --accent:#0f766e; --warn:#9a3412; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Arial, sans-serif; color: var(--ink); background: #fff; }
    main { max-width: 1120px; margin: 0 auto; padding: 18px; display: grid; gap: 14px; }
    header, section { border: 1px solid var(--line); border-radius: 8px; padding: 14px; background: var(--panel); }
    h1 { margin: 0 0 8px; font-size: 24px; }
    h2 { margin: 0 0 10px; font-size: 17px; }
    p { margin: 0 0 8px; color: var(--muted); line-height: 1.45; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    button, input, textarea, select { font: inherit; }
    button { border: 1px solid #8aa39e; background: #fff; color: var(--ink); border-radius: 6px; padding: 8px 11px; cursor: pointer; }
    button.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
    label { display: grid; gap: 5px; font-weight: 650; }
    input, select, textarea { width: 100%; border: 1px solid var(--line); border-radius: 6px; padding: 9px; background: #fff; color: var(--ink); }
    textarea { min-height: 120px; resize: vertical; line-height: 1.45; }
    .status { padding: 9px; border-radius: 6px; border: 1px solid var(--line); background: #fff; color: var(--muted); }
    code { background: #edf2f7; padding: 2px 4px; border-radius: 4px; }
    @media (max-width: 760px) { main { padding: 10px; } .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Low-Token Work-Along Kit</h1>
      <p>Goal: <strong id="goal"></strong></p>
      <p>Software: <strong id="software"></strong></p>
      <p>This kit avoids continuous recording. It learns from log deltas, triggered screenshots, teacher markers, and short answers.</p>
    </header>

    <section>
      <h2>Capture compact evidence</h2>
      <div class="grid">
        <label>Trigger reason
          <select id="triggerReason">
            <option value="log_file_changed">log file changed</option>
            <option value="error_keyword_detected">error keyword detected</option>
            <option value="before_after_state_marked">before/after state marked</option>
            <option value="teacher_question_answered">teacher question answered</option>
            <option value="manual_teacher_marker">manual teacher marker</option>
          </select>
        </label>
        <label>Screenshot or artifact path
          <input id="screenshotPath" placeholder="Optional path created by the collector or teacher">
        </label>
      </div>
      <label>Log tail or event summary
        <textarea id="logSummary" placeholder="Paste only the important tail lines or event summary, not the whole log."></textarea>
      </label>
      <div class="row">
        <button id="addEvent" class="primary">Add compact event</button>
        <button id="askQuestion">Draft question</button>
        <button id="speakQuestion">Speak question</button>
      </div>
      <p id="status" class="status">Waiting for a trigger or teacher marker.</p>
    </section>

    <section>
      <h2>Ask the teacher only when useful</h2>
      <div class="grid">
        <label>Question
          <textarea id="question"></textarea>
        </label>
        <label>Teacher answer
          <textarea id="answer" placeholder="Short answer, rule boundary, or counterexample."></textarea>
        </label>
      </div>
      <div class="row">
        <button id="addAnswer">Add answer</button>
        <button id="buildJson" class="primary">Build JSON for teach_apprentice</button>
      </div>
    </section>

    <section>
      <h2>Paste back to Codex</h2>
      <p>Copy this compact <code>transparent_ai_workalong_observation_v1</code> JSON into <code>teach_apprentice.message</code>.</p>
      <textarea id="outputJson" spellcheck="false"></textarea>
    </section>
  </main>

  <script>
    const manifest = ${jsonScript(manifest)};
    const template = ${jsonScript(evidenceTemplate)};
    const events = [...template.events];
    const questions = [];
    const answers = [];
    document.getElementById('goal').textContent = manifest.goal;
    document.getElementById('software').textContent = manifest.software;

    function addEvent() {
      const reason = document.getElementById('triggerReason').value;
      const screenshotPath = document.getElementById('screenshotPath').value.trim();
      const summary = document.getElementById('logSummary').value.trim();
      events.push({
        type: reason,
        software: manifest.software,
        text: summary || reason,
        screenshotPath,
        tokenPolicy: 'delta_only_triggered_screenshot',
        order: events.length + 1
      });
      document.getElementById('status').textContent = 'Added event #' + events.length + ': ' + reason;
      buildJson();
    }

    function draftQuestion() {
      const reason = document.getElementById('triggerReason').value;
      const question = reason.includes('error')
        ? 'I saw an error or warning in the log. What decision did you make, and should it become a reusable rule?'
        : reason.includes('before_after')
          ? 'Which visible change is the before/after signal I should learn from?'
          : 'What is the smallest rule boundary I should remember from this moment?';
      document.getElementById('question').value = question;
      return question;
    }

    function speak(text) {
      if (!('speechSynthesis' in window)) {
        document.getElementById('status').textContent = 'speechSynthesis unavailable; read the question manually.';
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = manifest.locale || 'zh-CN';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }

    function addAnswer() {
      const question = document.getElementById('question').value.trim() || draftQuestion();
      const answer = document.getElementById('answer').value.trim();
      questions.push({ text: question, order: questions.length + 1 });
      answers.push({ text: answer, order: answers.length + 1 });
      events.push({
        type: 'teacher_question_answered',
        question,
        answer,
        order: events.length + 1
      });
      document.getElementById('status').textContent = 'Added teacher answer #' + answers.length;
      buildJson();
    }

    function buildJson() {
      const payload = {
        ...template,
        sourceTool: manifest.software + ' low-token workalong kit',
        questions,
        teacherAnswers: answers,
        events,
        suggestedTeachApprentice: manifest.nextMcpCalls[0],
        locks: manifest.locks
      };
      document.getElementById('outputJson').value = JSON.stringify(payload, null, 2);
      return payload;
    }

    document.getElementById('addEvent').addEventListener('click', addEvent);
    document.getElementById('askQuestion').addEventListener('click', draftQuestion);
    document.getElementById('speakQuestion').addEventListener('click', () => speak(document.getElementById('question').value.trim() || draftQuestion()));
    document.getElementById('addAnswer').addEventListener('click', addAnswer);
    document.getElementById('buildJson').addEventListener('click', buildJson);
    buildJson();
  </script>
</body>
</html>
`;

const readme = `# Transparent AI Apprentice Work-Along Teaching Kit

Goal: ${goal}

Software: ${software}

This kit is for low-token apprentice learning while the teacher works. It does not record the screen continuously. The intended loop is:

1. Watch cheap signals first: log modified time, log tail delta, event files, and a manual teacher marker.
2. Capture a screenshot only on a useful trigger: error keyword, rebuild/export warning, visible before/after marker, or teacher request.
3. Ask the teacher a short question through the browser overlay, speech synthesis, or plain text only when the event is ambiguous or could become a reusable rule.
4. Convert \`workalong-events.jsonl\` into compact \`transparent_ai_workalong_observation_v1\` JSON and paste it into \`teach_apprentice.message\`.

Recommended collector command:

\`\`\`powershell
powershell -ExecutionPolicy Bypass -File "${collectorPath}" -CaptureScreenshots
\`\`\`

Finalize the compact observation packet:

\`\`\`powershell
& "${process.execPath}" "${finalizerScriptPath}" --manifest "${manifestPath}"
\`\`\`

For SolidWorks/CAD/CAM/CAE, start with rebuild logs, journal/export logs, solver logs, model file paths, and screenshots only when a state changes. This is review-only evidence; it does not approve memory, enable rules, accept technology, or unlock packaging.
`;

writeFileSync(policyPath, `${JSON.stringify(observationPolicy, null, 2)}\n`, "utf8");
writeFileSync(sourceMapPath, `${JSON.stringify(sourceMap, null, 2)}\n`, "utf8");
writeFileSync(templatePath, `${JSON.stringify(evidenceTemplate, null, 2)}\n`, "utf8");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
writeUtf8Bom(collectorPath, collectorScript);
writeFileSync(overlayPath, overlayHtml, "utf8");
writeFileSync(readmePath, readme, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_workalong_teaching_kit_result_v1",
      kitId,
      kitPath: manifestPath,
      teacherReadme: readmePath,
      files: manifest.files,
      questionMode,
      software,
      observationPolicy,
      sourceMap,
      nextMcpCalls: manifest.nextMcpCalls,
      locks
    },
    null,
    2
  )
);
