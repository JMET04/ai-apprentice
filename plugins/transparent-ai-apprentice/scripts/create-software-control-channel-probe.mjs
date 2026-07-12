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

function argValues(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return String(value || "software-control-channel-probe")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "software-control-channel-probe";
}

function safeJson(value) {
  return JSON.stringify(value, null, 2);
}

const goal = argValue("--goal", argValue("--task", "Read-only discovery of reusable software control channels before execution."));
const software = argValue("--software", argValue("--app", "target software"));
const processName = argValue("--process-name", "");
const windowTitle = argValue("--window-title", "");
const installPath = argValue("--install-path", "");
const executable = argValue("--executable", "");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "software-control-channel-probes")));
const runReadOnlyProbe = hasFlag("--run-read-only-probe");
const includeRegistry = hasFlag("--include-registry");
const includePorts = !hasFlag("--no-port-scan");
const maxFiles = argValue("--max-files", "160");
const maxDepth = argValue("--max-depth", "4");
const maxRegistryItems = argValue("--max-registry-items", "60");
const knownImportFormats = argValues("--import-format");
const knownExportFormats = argValues("--export-format");
const knownExtensions = argValues("--file-extension");

mkdirSync(outputRoot, { recursive: true });
const probeId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const probeDir = join(outputRoot, probeId);
mkdirSync(probeDir, { recursive: true });

const probePlanPath = join(probeDir, "software-control-channel-probe-plan.json");
const probeScriptPath = join(probeDir, "collect-software-control-channel-probe.ps1");
const probeResultTemplatePath = join(probeDir, "software-control-channel-probe-result-template.json");
const probeResultPath = join(probeDir, "software-control-channel-probe-result.json");
const nextProfileRequestPath = join(probeDir, "next-control-channel-profile-request.json");
const readmePath = join(probeDir, "SOFTWARE_CONTROL_CHANNEL_PROBE_START_HERE.md");

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  helpCommandExecuted: false,
  registryWrites: false,
  logContentsRead: false,
  rawFullLogsRetained: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequiredBeforeExecution: true
};

const probePlan = {
  format: "transparent_ai_software_control_channel_probe_plan_v1",
  probeId,
  createdAt: new Date().toISOString(),
  goal,
  software,
  processName,
  windowTitle,
  installPath,
  executable,
  knownImportFormats,
  knownExportFormats,
  knownExtensions,
  principle:
    "Discover reusable control channels using read-only metadata before screenshots, UI automation, or target-software execution.",
  readOnlySignals: [
    "running process and visible-window metadata",
    "install directory file-name and extension metadata",
    "script, macro, add-in, plug-in, API, SDK, COM, and type-library file clues",
    "import/export/config/project file clues",
    "local listening port metadata for the target process",
    "optional read-only registry class/app-path clues when explicitly enabled"
  ],
  blockedActions: [
    "do not execute target software commands",
    "do not send UI events",
    "do not run macro/API methods",
    "do not write registry",
    "do not capture screenshots",
    "do not save memory or unlock packaging"
  ],
  generatedProbeScript: probeScriptPath,
  resultTemplate: probeResultTemplatePath,
  nextProfileRequest: nextProfileRequestPath,
  locks
};

const probeScript = String.raw`param(
  [string]$Software = "",
  [string]$ProcessName = "",
  [string]$WindowTitle = "",
  [string]$InstallPath = "",
  [string]$Executable = "",
  [string]$OutputPath = "",
  [int]$MaxFiles = 160,
  [int]$MaxDepth = 4,
  [int]$MaxRegistryItems = 60,
  [switch]$IncludeRegistry,
  [switch]$IncludePorts
)

$ErrorActionPreference = "SilentlyContinue"

function Add-UniqueValue([System.Collections.Generic.List[string]]$List, [string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return }
  if (-not $List.Contains($Value)) { [void]$List.Add($Value) }
}

function Get-SafeChildFiles([string]$Root, [int]$MaxDepth, [int]$MaxFiles) {
  $results = New-Object System.Collections.Generic.List[object]
  if (-not $Root -or -not (Test-Path -LiteralPath $Root)) { return $results }
  $rootItem = Get-Item -LiteralPath $Root
  $rootDepth = ($rootItem.FullName.TrimEnd("\") -split "\\").Count
  $queue = New-Object System.Collections.Generic.Queue[object]
  $queue.Enqueue($rootItem)
  while ($queue.Count -gt 0 -and $results.Count -lt $MaxFiles) {
    $current = $queue.Dequeue()
    $currentDepth = ($current.FullName.TrimEnd("\") -split "\\").Count - $rootDepth
    foreach ($file in Get-ChildItem -LiteralPath $current.FullName -File) {
      if ($results.Count -ge $MaxFiles) { break }
      $lower = $file.Name.ToLowerInvariant()
      if ($lower -match "api|sdk|macro|script|plugin|plug-in|addin|add-in|automation|import|export|config|settings|template|schema|com|type.?lib|tlb|olb|rest|http|cli|command") {
        $results.Add([ordered]@{
          name = $file.Name
          path = $file.FullName
          extension = $file.Extension
          length = $file.Length
          lastWriteTimeUtc = $file.LastWriteTimeUtc.ToString("o")
        })
      }
    }
    if ($currentDepth -lt $MaxDepth) {
      foreach ($dir in Get-ChildItem -LiteralPath $current.FullName -Directory) {
        $queue.Enqueue($dir)
      }
    }
  }
  return $results
}

$matchedProcesses = @()
foreach ($proc in Get-Process) {
  $name = [string]$proc.ProcessName
  $title = [string]$proc.MainWindowTitle
  $matchesName = $ProcessName -and $name -like "*$ProcessName*"
  $matchesSoftware = $Software -and $name -like "*$Software*"
  $matchesTitle = $WindowTitle -and $title -like "*$WindowTitle*"
  if ($matchesName -or $matchesSoftware -or $matchesTitle) {
    $path = ""
    try { $path = $proc.MainModule.FileName } catch {}
    $matchedProcesses += [ordered]@{
      processName = $name
      id = $proc.Id
      mainWindowTitle = $title
      path = $path
    }
  }
}

$candidateRoots = New-Object System.Collections.Generic.List[string]
Add-UniqueValue $candidateRoots $InstallPath
if ($Executable -and (Test-Path -LiteralPath $Executable)) {
  Add-UniqueValue $candidateRoots (Split-Path -Parent $Executable)
}
foreach ($proc in $matchedProcesses) {
  if ($proc.path) { Add-UniqueValue $candidateRoots (Split-Path -Parent $proc.path) }
}

$candidateFiles = @()
foreach ($root in $candidateRoots) {
  $candidateFiles += Get-SafeChildFiles -Root $root -MaxDepth $MaxDepth -MaxFiles $MaxFiles
}

$apiHints = @()
$macroHints = @()
$cliHints = @()
$fileHints = @()
$browserHints = @()
foreach ($file in $candidateFiles) {
  $text = ($file.name + " " + $file.path + " " + $file.extension).ToLowerInvariant()
  if ($text -match "api|sdk|automation|com|tlb|olb|rest|http") { $apiHints += $file }
  if ($text -match "macro|vba|bas|addin|add-in|plugin|plug-in") { $macroHints += $file }
  if ($text -match "cli|command|script|ps1|cmd|bat|py|js") { $cliHints += $file }
  if ($text -match "import|export|schema|template|config|settings|json|xml|ini|cfg|dxf|step|stp|iges|csv") { $fileHints += $file }
  if ($text -match "web|browser|localhost|http|rest") { $browserHints += $file }
}

$ports = @()
if ($IncludePorts) {
  $ids = @($matchedProcesses | ForEach-Object { $_.id })
  if ($ids.Count -gt 0) {
    foreach ($conn in Get-NetTCPConnection -State Listen) {
      if ($ids -contains $conn.OwningProcess) {
        $ports += [ordered]@{
          localAddress = $conn.LocalAddress
          localPort = $conn.LocalPort
          owningProcess = $conn.OwningProcess
        }
      }
    }
  }
}

$registryClues = @()
if ($IncludeRegistry) {
  $patterns = @($Software, $ProcessName) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  $roots = @("Registry::HKEY_CURRENT_USER\Software\Classes", "Registry::HKEY_LOCAL_MACHINE\Software\Classes")
  foreach ($root in $roots) {
    if ($registryClues.Count -ge $MaxRegistryItems) { break }
    foreach ($item in Get-ChildItem -LiteralPath $root) {
      if ($registryClues.Count -ge $MaxRegistryItems) { break }
      foreach ($pattern in $patterns) {
        if ($item.PSChildName -like "*$pattern*") {
          $registryClues += [ordered]@{ key = $item.Name; name = $item.PSChildName }
          break
        }
      }
    }
  }
}

$result = [ordered]@{
  format = "transparent_ai_software_control_channel_probe_result_v1"
  source = "read_only_control_channel_metadata_probe"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  software = $Software
  processName = $ProcessName
  windowTitle = $WindowTitle
  installPath = $InstallPath
  executable = $Executable
  matchedProcesses = $matchedProcesses
  candidateRoots = @($candidateRoots)
  candidateFiles = @($candidateFiles)
  discoveredSignals = [ordered]@{
    apiRoutes = @($apiHints)
    macroRoutes = @($macroHints)
    cliRoutes = @($cliHints)
    fileImportExportRoutes = @($fileHints)
    browserOrLocalServiceRoutes = @($browserHints + $ports)
    windowsUiFallbackRoutes = @($matchedProcesses | Where-Object { $_.mainWindowTitle })
    registryClassClues = @($registryClues)
  }
  lowTokenPolicy = [ordered]@{
    fileContentsRead = $false
    targetSoftwareCommandsExecuted = $false
    screenshotsCaptured = $false
    fullContinuousRecording = $false
    registryWrites = $false
  }
  locks = [ordered]@{
    reviewOnly = $true
    accepted = $false
    ruleEnabled = $false
    technologyAccepted = $false
    packagingGated = $true
    fileContentsRead = $false
    targetSoftwareCommandsExecuted = $false
    screenshotsCaptured = $false
    fullContinuousRecording = $false
    registryWrites = $false
    softwareActionsExecuted = $false
    nativeUniversalExecution = $false
  }
}

$json = $result | ConvertTo-Json -Depth 8
if ($OutputPath) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputPath) | Out-Null
  [System.IO.File]::WriteAllText($OutputPath, $json, [System.Text.UTF8Encoding]::new($false))
}
$json
`;

const probeTemplate = {
  format: "transparent_ai_software_control_channel_probe_result_v1",
  source: "template_waiting_for_read_only_probe",
  software,
  processName,
  windowTitle,
  installPath,
  executable,
  discoveredSignals: {
    apiRoutes: [],
    macroRoutes: [],
    cliRoutes: [],
    fileImportExportRoutes: [],
    browserOrLocalServiceRoutes: [],
    windowsUiFallbackRoutes: [],
    registryClassClues: []
  },
  lowTokenPolicy: {
    fileContentsRead: false,
    targetSoftwareCommandsExecuted: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    registryWrites: false
  },
  locks
};

const nextProfileRequest = {
  format: "transparent_ai_software_control_channel_probe_to_profile_request_v1",
  tool: "create_software_control_channel_profile",
  arguments: {
    goal,
    software,
    processName,
    windowTitle,
    installPath,
    executable,
    probeResult: probeResultPath
  },
  blockedActions: ["execute_now", "send_ui_events", "run_target_command", "enable_memory", "unlock_packaging"],
  locks
};

writeFileSync(probePlanPath, `${safeJson(probePlan)}\n`, "utf8");
writeFileSync(probeScriptPath, probeScript, "utf8");
writeFileSync(probeResultTemplatePath, `${safeJson(probeTemplate)}\n`, "utf8");
writeFileSync(nextProfileRequestPath, `${safeJson(nextProfileRequest)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# Software Control Channel Read-Only Probe",
    "",
    `Goal: ${goal}`,
    `Software: ${software}`,
    "",
    "This packet discovers reusable control channels before any execution adapter is selected.",
    "",
    "Default probe behavior:",
    "- reads process/window metadata, install-directory file names, local listening ports, and optional registry class clues;",
    "- does not read file contents;",
    "- does not execute target software commands, macros, APIs, or UI events;",
    "- does not capture screenshots or write memory;",
    "- writes a probe result that can be passed to create_software_control_channel_profile.",
    "",
    "Generated files:",
    `- ${basename(probePlanPath)}`,
    `- ${basename(probeScriptPath)}`,
    `- ${basename(probeResultTemplatePath)}`,
    `- ${basename(nextProfileRequestPath)}`,
    "",
    "Run the probe only after reviewing the scope. It is still read-only metadata collection.",
    "",
    "Locked defaults: accepted=false, ruleEnabled=false, packagingGated=true, fullContinuousRecording=false, screenshotsCaptured=false, softwareActionsExecuted=false, targetSoftwareCommandsExecuted=false, nativeUniversalExecution=false."
  ].join("\n"),
  "utf8"
);

let probeRun = null;
if (runReadOnlyProbe) {
  const args = [
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    probeScriptPath,
    "-Software",
    software,
    "-ProcessName",
    processName,
    "-WindowTitle",
    windowTitle,
    "-InstallPath",
    installPath,
    "-Executable",
    executable,
    "-OutputPath",
    probeResultPath,
    "-MaxFiles",
    String(maxFiles),
    "-MaxDepth",
    String(maxDepth),
    "-MaxRegistryItems",
    String(maxRegistryItems)
  ];
  if (includeRegistry) args.push("-IncludeRegistry");
  if (includePorts) args.push("-IncludePorts");
  const result = spawnSync("powershell", args, { cwd: process.cwd(), encoding: "utf8" });
  probeRun = {
    status: result.status,
    stdoutPreview: String(result.stdout || "").slice(0, 800),
    stderrPreview: String(result.stderr || "").slice(0, 800),
    resultPath: existsSync(probeResultPath) ? probeResultPath : ""
  };
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "read-only control-channel probe failed");
  }
}

const completedProbeResult = existsSync(probeResultPath)
  ? JSON.parse(readFileSync(probeResultPath, "utf8").replace(/^\uFEFF/, ""))
  : null;
const discoveredSignals = completedProbeResult?.discoveredSignals || {};

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_software_control_channel_probe_result_wrapper_v1",
      probeId,
      teacherReadme: readmePath,
      probePlan: probePlanPath,
      probeScript: probeScriptPath,
      probeResultTemplate: probeResultTemplatePath,
      probeResult: existsSync(probeResultPath) ? probeResultPath : "",
      nextProfileRequest: nextProfileRequestPath,
      probePlanPath,
      probeScriptPath,
      probeResultTemplatePath,
      probeResultPath: existsSync(probeResultPath) ? probeResultPath : "",
      nextProfileRequestPath,
      readmePath,
      runReadOnlyProbe: Boolean(probeRun),
      didRunReadOnlyProbe: Boolean(probeRun),
      probeRun,
      matchedProcessCount: Array.isArray(completedProbeResult?.matchedProcesses) ? completedProbeResult.matchedProcesses.length : 0,
      candidateFileCount: Array.isArray(completedProbeResult?.candidateFiles) ? completedProbeResult.candidateFiles.length : 0,
      discoveredRouteCounts: {
        apiRoutes: Array.isArray(discoveredSignals.apiRoutes) ? discoveredSignals.apiRoutes.length : 0,
        macroRoutes: Array.isArray(discoveredSignals.macroRoutes) ? discoveredSignals.macroRoutes.length : 0,
        cliRoutes: Array.isArray(discoveredSignals.cliRoutes) ? discoveredSignals.cliRoutes.length : 0,
        fileImportExportRoutes: Array.isArray(discoveredSignals.fileImportExportRoutes) ? discoveredSignals.fileImportExportRoutes.length : 0,
        browserOrLocalServiceRoutes: Array.isArray(discoveredSignals.browserOrLocalServiceRoutes) ? discoveredSignals.browserOrLocalServiceRoutes.length : 0,
        windowsUiFallbackRoutes: Array.isArray(discoveredSignals.windowsUiFallbackRoutes) ? discoveredSignals.windowsUiFallbackRoutes.length : 0
      },
      fullContinuousRecording: false,
      screenshotsCaptured: false,
      softwareActionsExecuted: false,
      targetSoftwareCommandsExecuted: false,
      nativeUniversalExecution: false,
      reviewLocks: locks
    },
    null,
    2
  )
);
