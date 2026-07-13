param(
  [string]$OutputPath
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$PluginName = "transparent-ai-apprentice"
$SourcePlugin = Join-Path $RepoRoot "plugins\$PluginName"

if (-not $OutputPath) {
  $DistDir = Join-Path $RepoRoot "dist"
  New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
  $OutputPath = Join-Path $DistDir "$PluginName-codex-plugin.zip"
}

$WorkRoot = Join-Path $RepoRoot ".ta-package"
$PackageRoot = Join-Path $WorkRoot "$PluginName-package"
$VerifyRoot = Join-Path $WorkRoot "$PluginName-package-verify"

New-Item -ItemType Directory -Force -Path $WorkRoot | Out-Null

foreach ($Path in @($PackageRoot, $VerifyRoot)) {
  if (Test-Path -LiteralPath $Path) {
    Remove-Item -LiteralPath $Path -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

Get-ChildItem -LiteralPath $SourcePlugin -Force | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $PackageRoot $_.Name) -Recurse -Force
}
$resolvedPackageRoot = [IO.Path]::GetFullPath($PackageRoot).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
Get-ChildItem -LiteralPath $PackageRoot -Directory -Recurse -Force |
  Where-Object { $_.Name -in @("bin", "obj") } |
  Sort-Object { $_.FullName.Length } -Descending |
  ForEach-Object {
    $resolvedBuildDirectory = [IO.Path]::GetFullPath($_.FullName)
    if (-not $resolvedBuildDirectory.StartsWith($resolvedPackageRoot, [StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing to remove a build directory outside the package staging root: $resolvedBuildDirectory"
    }
    if (Test-Path -LiteralPath $resolvedBuildDirectory) {
      Remove-Item -LiteralPath $resolvedBuildDirectory -Recurse -Force
    }
  }
Copy-Item -LiteralPath (Join-Path $RepoRoot "package.json") -Destination (Join-Path $PackageRoot "package.json") -Force
Copy-Item -LiteralPath (Join-Path $RepoRoot "scripts\run-with-workspace-temp.mjs") -Destination (Join-Path $PackageRoot "scripts\run-with-workspace-temp.mjs") -Force

if (Test-Path -LiteralPath $OutputPath) {
  Remove-Item -LiteralPath $OutputPath -Force
}

$ArchiveItems = Get-ChildItem -LiteralPath $PackageRoot -Force
Compress-Archive -LiteralPath $ArchiveItems.FullName -DestinationPath $OutputPath -Force

Expand-Archive -LiteralPath $OutputPath -DestinationPath $VerifyRoot -Force

$Required = @(
  ".codex-plugin\plugin.json",
  ".mcp.json",
  "skills\teachable-apprentice\SKILL.md",
  "skills\packaging-design-apprentice\SKILL.md",
  "schemas\packaging-design-session.schema.json",
  "schemas\aicad-packaging-handoff.schema.json",
  "scripts\packaging-design-workflow.mjs",
  "scripts\smoke-packaging-design-workflow.mjs",
  "schemas\ai-apprentice-aicad-request-v1.schema.json",
  "schemas\ai-apprentice-aicad-result-v1.schema.json",
  "scripts\aicad-handoff-adapter.mjs",
  "scripts\smoke-aicad-handoff-adapter.mjs",
  "skills\aicad-draw\SKILL.md",
  "skills\aicad-model-3d\SKILL.md",
  "integrations\aicad-agent-v1\integration-manifest.json",
  "integrations\aicad-agent-v1\validation\validation.json",
  "integrations\aicad-agent-v1\plugin\aicad-agent\.codex-plugin\plugin.json",
  "integrations\aicad-agent-v1\plugin\aicad-agent\scripts\aicad_agent.py",
  "scripts\session-state.mjs",
  "scripts\continue-teaching.mjs",
  "scripts\create-action-sequence-artifact.mjs",
  "scripts\create-example-teaching-artifact.mjs",
  "scripts\start-guided-teaching.mjs",
  "scripts\create-visual-teaching-kit.mjs",
  "scripts\create-visual-teaching-template.mjs",
  "scripts\create-voice-teaching-kit.mjs",
  "scripts\create-workalong-teaching-kit.mjs",
  "scripts\create-teacher-learning-method-profile.mjs",
  "scripts\create-all-software-observer-bootstrap.mjs",
  "scripts\run-all-software-observer-supervisor.mjs",
  "scripts\run-all-software-low-token-learning-cycle.mjs",
  "scripts\run-automatic-low-token-learning-runner.mjs",
  "scripts\create-automatic-low-token-learning-schedule.mjs",
  "scripts\run-all-software-operational-learning-activation-dry-run-rehearsal.mjs",
  "scripts\create-all-software-operational-learning-registration-execute-gate.mjs",
  "scripts\create-all-software-operational-learning-post-activation-witness.mjs",
  "scripts\create-all-software-operational-status-console.mjs",
  "scripts\create-automatic-triggered-visual-check-queue.mjs",
  "scripts\create-all-software-observer-coverage-audit.mjs",
  "scripts\create-all-software-coverage-repair-queue.mjs",
  "scripts\create-all-software-coverage-expansion-plan.mjs",
  "scripts\run-all-software-coverage-rollout-batch.mjs",
  "scripts\run-all-software-coverage-rollout-supervisor.mjs",
  "scripts\create-all-software-coverage-convergence-audit.mjs",
  "scripts\create-convergence-automatic-learning-package.mjs",
  "scripts\create-automatic-observer-schedule.mjs",
  "scripts\create-software-observer-inventory.mjs",
  "scripts\create-software-observer-queue.mjs",
  "scripts\run-software-observer-queue-item.mjs",
  "scripts\watch-log-source-metadata-deltas.mjs",
  "scripts\monitor-software-observation-deltas.mjs",
  "scripts\create-triggered-visual-check-request.mjs",
  "scripts\capture-triggered-visual-check.mjs",
  "scripts\run-software-observer-watch-cycle.mjs",
  "scripts\create-software-capability-profile.mjs",
  "scripts\create-software-control-channel-probe.mjs",
  "scripts\create-software-control-channel-profile.mjs",
  "scripts\create-all-software-control-channel-coverage-audit.mjs",
  "scripts\create-all-software-execution-pilot-queue.mjs",
  "scripts\run-all-software-execution-pilot-runner.mjs",
  "scripts\run-all-software-execution-pilot-batch.mjs",
  "scripts\run-real-local-all-software-execution-readiness-batch.mjs",
  "scripts\create-real-local-execution-pilot-selector.mjs",
  "scripts\create-real-local-execution-approval-gate.mjs",
  "scripts\create-engineering-voice-control-workbench.mjs",
  "scripts\run-engineering-voice-command-control-loop.mjs",
  "scripts\create-engineering-voice-execution-approval-gate.mjs",
  "scripts\smoke-engineering-voice-command-control-loop.mjs",
  "scripts\smoke-engineering-voice-execution-approval-gate.mjs",
  "scripts\create-goal-command-center.mjs",
  "scripts\smoke-goal-command-center.mjs",
  "scripts\run-goal-command-center-trial.mjs",
  "scripts\smoke-goal-command-center-trial.mjs",
  "scripts\create-adaptive-software-observer-from-profile.mjs",
  "scripts\create-universal-software-observer-kit.mjs",
  "scripts\compact-universal-observation-learning-events.mjs",
  "scripts\create-transparent-sketch-overlay-kit.mjs",
  "scripts\create-engineering-mask-demo.mjs",
  "scripts\create-office-text-mask-demo.mjs",
  "scripts\create-office-text-mask-workbench.mjs",
  "scripts\create-engineering-software-mask-workbench.mjs",
  "scripts\mask-correction-store.mjs",
  "scripts\mask-correction-service.mjs",
  "scripts\smoke-mask-correction-service.mjs",
  "scripts\smoke-mask-workbench-submission-browser.mjs",
  "scripts\aicad-object-mask-adapter.mjs",
  "scripts\smoke-aicad-object-mask-adapter.mjs",
  "scripts\smoke-multiround-learning-convergence.mjs",
  "scripts\smoke-product-failure-matrix.mjs",
  "scripts\benchmark-product-performance.mjs",
  "schemas\ai-apprentice-native-selection-v1.schema.json",
  "schemas\ai-apprentice-context-action-v1.schema.json",
  "scripts\native-selection-store.mjs",
  "scripts\create-native-selection-workbench-v2.mjs",
  "scripts\smoke-native-selection-workbench-v2.mjs",
  "assets\native-selection-workbench-v2\shared\tokens.css",
  "assets\native-selection-workbench-v2\shared\assistant-v2.js",
  "assets\native-selection-workbench-v2\packaging-mask\index.html",
  "assets\native-selection-workbench-v2\office-native-selection\index.html",
  "assets\native-selection-workbench-v2\engineering-native-selection\index.html",
  "scripts\word-native-selection-adapter.mjs",
  "scripts\autocad-native-selection-adapter.mjs",
  "scripts\smoke-native-selection-agent-plugin.mjs",
  "scripts\smoke-word-native-selection-host.ps1",
  "scripts\smoke-word-native-selection-live.mjs",
  "scripts\smoke-aicad-managed-selection-bridge.mjs",
  "assets\desktop-companion\AI-Apprentice-Companion.ps1",
  "assets\desktop-companion\README.md",
  "host-bridges\word\capture-word-selection.ps1",
  "host-bridges\word\apply-word-selection.ps1",
  "host-bridges\word\CAIApprenticeEvents.cls",
  "host-bridges\word\AI_Apprentice_WordBridge.bas",
  "host-bridges\word\install-word-bridge.ps1",
  "host-bridges\aicad\AI_Apprentice_Selection.lsp",
  "host-bridges\aicad-managed\AI.Apprentice.AutoCAD.Selection.csproj",
  "host-bridges\aicad-managed\NativeSelectionExtension.cs",
  "host-bridges\aicad-managed\ContextMenuHostExtension.cs",
  "host-bridges\aicad-managed\AI.Apprentice.AutoCAD.ContextMenu.csproj",
  "host-bridges\aicad-managed\install-autocad-managed-selection-bridge.ps1",
  "host-bridges\aicad-managed\apply-autocad-selection.ps1",
  "host-bridges\aicad-managed\smoke-autocad-managed-runtime.ps1",
  "host-bridges\aicad-managed\smoke-autocad-managed-desktop-live.ps1",
  "host-bridges\aicad-managed\runtime\AI.Apprentice.NativeSelection.bundle\PackageContents.xml",
  "host-bridges\aicad-managed\runtime\AI.Apprentice.NativeSelection.bundle\Contents\AI.Apprentice.AutoCAD.Selection.dll",
  "host-bridges\aicad-managed\runtime\AI.Apprentice.NativeSelection.bundle\Contents\AI.Apprentice.AutoCAD.ContextMenu.dll",
  "scripts\run-with-workspace-temp.mjs",
  "scripts\create-precise-content-mask-workbench.mjs",
  "scripts\validate-multimodal-surgical-mask-correction.mjs",
  "scripts\surgical-office-text-edit.py",
  "scripts\resolve-learned-rule-conflicts.mjs",
  "assets\mask-workbench\index.template.html",
  "assets\mask-workbench\styles.css",
  "assets\mask-workbench\app.js",
  "assets\mask-workbench\design-tokens.json",
  "assets\text-mask-workbench\index.template.html",
  "assets\text-mask-workbench\styles.css",
  "assets\text-mask-workbench\app.js",
  "assets\engineering-software-mask-workbench\index.template.html",
  "assets\engineering-software-mask-workbench\styles.css",
  "assets\engineering-software-mask-workbench\app.js",
  "assets\mask-submission-client.js",
  "assets\examples\aicad-object-mask-source.plan.json",
  "docs\internal-deep-route-catalog.md",
  "assets\examples\engineering-object-index.png",
  "schemas\multimodal-surgical-mask-correction.schema.json",
  "scripts\interpret-transparent-sketch-spatial-intent.mjs",
  "scripts\create-spatial-software-execution-route-bridge.mjs",
  "scripts\create-supervised-software-action-kit.mjs",
  "scripts\create-existing-software-execution-adapter.mjs",
  "scripts\verify-supervised-action-outcome.mjs",
  "scripts\finalize-workalong-observation.mjs",
  "scripts\create-learning-workflow.mjs",
  "scripts\create-teach-execute-learning-loop.mjs",
  "scripts\start-teach-execute-safe-run.mjs",
  "scripts\start-teach-execute-reviewed-observation.mjs",
  "scripts\start-teach-execute-action-rehearsal.mjs",
  "scripts\start-teach-execute-supervised-execution.mjs",
  "scripts\create-rollback-point.mjs",
  "scripts\confirm-rollback-point.mjs",
  "scripts\create-recording-demonstration-artifact.mjs",
  "scripts\create-demonstration-capture.mjs",
  "scripts\review-teaching-session.mjs",
  "scripts\review-apprentice-profile.mjs",
  "scripts\correct-last-result.mjs",
  "scripts\show-teaching-card.mjs",
  "scripts\mcp-server.mjs",
  "scripts\verify-plugin.mjs",
  "scripts\create-plugin-health-index.mjs",
  "scripts\smoke-plugin-health-index.mjs",
  "scripts\create-plugin-manual-test-readiness-pack.mjs",
  "scripts\smoke-plugin-manual-test-readiness.mjs",
  "scripts\create-plugin-manual-test-result-receipt-template.mjs",
  "scripts\validate-plugin-manual-test-result-receipt.mjs",
  "scripts\smoke-plugin-manual-test-result-receipt.mjs",
  "scripts\create-plugin-manual-test-session-packet.mjs",
  "scripts\smoke-plugin-manual-test-session-packet.mjs",
  "scripts\smoke-action-sequence-teaching.mjs",
  "scripts\smoke-continue-teaching.mjs",
  "scripts\smoke-example-teaching.mjs",
  "scripts\smoke-guided-teaching.mjs",
  "scripts\smoke-visual-teaching-kit.mjs",
  "scripts\smoke-visual-teaching-template.mjs",
  "scripts\smoke-existing-drawing-spatial-controlled-execution.mjs",
  "scripts\smoke-sketch-demonstration-implementation-audit.mjs",
  "scripts\smoke-ai-apprentice-mask-workbench-browser.mjs",
  "scripts\smoke-independent-mask-workbenches.mjs",
  "scripts\smoke-surgical-office-text-edit.mjs",
  "scripts\smoke-learned-rule-conflict-resolution.mjs",
  "scripts\smoke-recording-demonstration.mjs",
  "scripts\smoke-mcp-tool-surface-fast.mjs",
  "scripts\smoke-mcp-tool-surface.mjs",
  "scripts\smoke-workalong-end-to-end.mjs",
  "scripts\smoke-teacher-learning-method-profile.mjs",
  "scripts\smoke-learning-workflow.mjs",
  "scripts\smoke-rollback-point.mjs",
  "scripts\smoke-universal-observer-and-overlay.mjs",
  "scripts\smoke-spatial-intent-interpreter.mjs",
  "scripts\smoke-spatial-software-execution-route-bridge.mjs",
  "scripts\smoke-real-local-spatial-execution-route.mjs",
  "scripts\create-original-goal-readiness-audit.mjs",
  "scripts\smoke-original-goal-readiness-audit.mjs",
  "scripts\smoke-real-local-engineering-voice-control-closed-loop.mjs",
  "scripts\smoke-real-local-engineering-voice-controlled-execution.mjs",
  "scripts\smoke-real-local-engineering-voice-command-control-loop.mjs",
  "scripts\smoke-real-local-full-goal-integrated-cycle.mjs",
  "scripts\smoke-goal-coverage.mjs",
  "scripts\smoke-all-software-observer-bootstrap.mjs",
  "scripts\smoke-all-software-observer-supervisor.mjs",
  "scripts\smoke-all-software-low-token-learning-cycle.mjs",
  "scripts\smoke-automatic-low-token-learning-runner.mjs",
  "scripts\smoke-automatic-low-token-learning-schedule.mjs",
  "scripts\smoke-all-software-operational-learning-activation-dry-run-rehearsal.mjs",
  "scripts\smoke-all-software-operational-learning-registration-execute-gate.mjs",
  "scripts\smoke-all-software-operational-learning-post-activation-witness.mjs",
  "scripts\smoke-all-software-operational-status-console.mjs",
  "scripts\smoke-automatic-triggered-visual-check-queue.mjs",
  "scripts\smoke-real-local-automatic-low-token-learning-schedule.mjs",
  "scripts\smoke-real-local-all-software-low-token-learning-cycle.mjs",
  "scripts\smoke-all-software-observer-coverage-audit.mjs",
  "scripts\smoke-all-software-coverage-repair-queue.mjs",
  "scripts\smoke-automatic-observer-schedule.mjs",
  "scripts\smoke-software-observer-inventory.mjs",
  "scripts\smoke-software-observer-queue.mjs",
  "scripts\smoke-log-source-metadata-deltas.mjs",
  "scripts\smoke-software-observer-queue-runner.mjs",
  "scripts\smoke-software-observation-delta-monitor.mjs",
  "scripts\smoke-triggered-visual-check-request.mjs",
  "scripts\smoke-triggered-visual-capture.mjs",
  "scripts\smoke-triggered-visual-evidence-learning-handoff.mjs",
  "scripts\smoke-software-observer-watch-cycle.mjs",
  "scripts\smoke-real-local-triggered-visual-check.mjs",
  "scripts\smoke-real-local-all-software-observer.mjs",
  "scripts\create-real-local-all-software-low-token-readiness-package.mjs",
  "scripts\smoke-real-local-all-software-low-token-readiness-package.mjs",
  "scripts\smoke-real-local-all-software-coverage-audit.mjs",
  "scripts\smoke-real-local-all-software-coverage-repair-queue.mjs",
  "scripts\smoke-real-local-all-software-coverage-expansion-plan.mjs",
  "scripts\smoke-real-local-all-software-coverage-rollout-batch.mjs",
  "scripts\smoke-real-local-all-software-coverage-rollout-supervisor.mjs",
  "scripts\smoke-real-local-all-software-coverage-convergence-audit.mjs",
  "scripts\smoke-real-local-convergence-automatic-learning-package.mjs",
  "scripts\smoke-real-local-all-software-control-channel-coverage-audit.mjs",
  "scripts\smoke-real-local-all-software-execution-pilot-queue.mjs",
  "scripts\smoke-real-local-all-software-execution-pilot-runner.mjs",
  "scripts\smoke-real-local-all-software-execution-pilot-batch.mjs",
  "scripts\smoke-real-local-all-software-execution-readiness-batch.mjs",
  "scripts\smoke-real-local-execution-pilot-selector.mjs",
  "scripts\smoke-real-local-execution-approval-gate.mjs",
  "scripts\smoke-engineering-voice-control-workbench.mjs",
  "scripts\smoke-software-capability-profile.mjs",
  "scripts\smoke-software-control-channel-probe.mjs",
  "scripts\smoke-software-control-channel-profile.mjs",
  "scripts\smoke-adaptive-software-observer-from-profile.mjs",
  "scripts\smoke-compact-universal-learning-events.mjs",
  "scripts\smoke-teach-execute-learning-loop.mjs",
  "scripts\smoke-teach-execute-safe-start.mjs",
  "scripts\smoke-teach-execute-reviewed-observation.mjs",
  "scripts\smoke-teach-execute-action-rehearsal.mjs",
  "scripts\smoke-teach-execute-supervised-execution.mjs",
  "scripts\smoke-existing-software-execution-adapter.mjs",
  "scripts\smoke-supervised-action-bridge.mjs",
  "scripts\smoke-supervised-action-outcome-verifier.mjs",
  "scripts\smoke-demonstration-capture.mjs",
  "scripts\smoke-session-review.mjs",
  "scripts\smoke-profile-review.mjs",
  "scripts\smoke-correct-last-result.mjs",
  "scripts\smoke-teaching-card.mjs",
  "scripts\smoke-approve-and-save-profile.mjs",
  "assets\templates\tool-adapters.json",
  "assets\examples\drawing-demo.svg",
  "assets\examples\drawio-demo.drawio",
  "assets\examples\excalidraw-demo.json",
  "assets\examples\mermaid-demo.mmd",
  "assets\examples\screen-event-log-demo.json"
)

$Missing = @()
foreach ($Relative in $Required) {
  if (-not (Test-Path -LiteralPath (Join-Path $VerifyRoot $Relative))) {
    $Missing += $Relative
  }
}

if ($Missing.Count -gt 0) {
  throw "Plugin package is missing required files: $($Missing -join ', ')"
}

$BuildArtifacts = @(Get-ChildItem -LiteralPath $VerifyRoot -Directory -Recurse -Force | Where-Object { $_.Name -in @("bin", "obj") })
if ($BuildArtifacts.Count -gt 0) {
  throw "Plugin package contains build artifact directories: $($BuildArtifacts.FullName -join ', ')"
}

$FileCount = (Get-ChildItem -LiteralPath $VerifyRoot -Recurse -Force -File).Count
$PackageInfo = Get-Item -LiteralPath $OutputPath
$PackageHash = (Get-FileHash -LiteralPath $PackageInfo.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
$ChecksumPath = Join-Path $PackageInfo.DirectoryName "SHA256SUMS.txt"
$ChecksumLine = "$PackageHash  $($PackageInfo.Name)"
Set-Content -LiteralPath $ChecksumPath -Value $ChecksumLine -Encoding ascii
$Manifest = Get-Content -LiteralPath (Join-Path $VerifyRoot ".codex-plugin\plugin.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$StarterPrompts = @($Manifest.interface.defaultPrompt)
if ($StarterPrompts.Count -lt 1 -or $StarterPrompts.Count -gt 3) {
  throw "Plugin package manifest must include 1 to 3 starter prompts."
}
foreach ($Prompt in $StarterPrompts) {
  if (-not ($Prompt -is [string]) -or $Prompt.Length -gt 128 -or $Prompt.Length -eq 0) {
    throw "Plugin package manifest has an invalid starter prompt: $Prompt"
  }
}

$Verify = & node (Join-Path $VerifyRoot "scripts\verify-plugin.mjs")
if ($LASTEXITCODE -ne 0) {
  throw "Expanded plugin package verifier failed."
}
$VerifyResult = ConvertFrom-Json ($Verify -join "`n")

[pscustomobject]@{
  status = "packaged"
  pluginName = $PluginName
  packagePath = $PackageInfo.FullName
  packageBytes = $PackageInfo.Length
  packageSha256 = $PackageHash
  checksumPath = $ChecksumPath
  verifiedFileCount = $FileCount
  requiredFilesPresent = $Required.Count
  starterPrompts = $StarterPrompts.Count
  verifier = $VerifyResult
} | ConvertTo-Json -Depth 4
