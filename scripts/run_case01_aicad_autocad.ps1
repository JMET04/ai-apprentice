[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$caseRoot = Join-Path $projectRoot 'artifacts\packaging_teaching_session\case_01_transport_box\cad'
$redrawRoot = Join-Path $caseRoot 'aicad_agent_redraw'
$stage = Join-Path $env:TEMP 'packaging_aicad_case01'
$installKey = Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Autodesk\AutoCAD\R25.0\ACAD-8101\Install' -ErrorAction SilentlyContinue
$installDirectory = $installKey.INSTALLDIR
$coreConsole = if ($installDirectory) { Join-Path $installDirectory 'accoreconsole.exe' } else { $null }
$plugin = Join-Path $env:APPDATA 'Autodesk\ApplicationPlugins\AiCadConstraint.bundle\Contents\AiCadConstraint.lsp'

if (-not $coreConsole -or -not (Test-Path -LiteralPath $coreConsole -PathType Leaf)) {
    throw "AutoCAD Core Console was not found: $coreConsole"
}

New-Item -ItemType Directory -Force -Path $stage | Out-Null
$stageResolved = (Resolve-Path -LiteralPath $stage).Path
$expectedStageRoot = [IO.Path]::GetFullPath((Join-Path $env:TEMP 'packaging_aicad_case01'))
if (-not $stageResolved.Equals($expectedStageRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Unexpected AutoCAD staging path: $stageResolved"
}

$copies = @{
    $plugin = 'AiCadConstraint.lsp'
    (Join-Path $PSScriptRoot 'autocad_case01_constraint_redraw.lsp') = 'autocad_case01_constraint_redraw.lsp'
    (Join-Path $PSScriptRoot 'autocad_case01_draw.scr') = 'autocad_case01_draw.scr'
    (Join-Path $PSScriptRoot 'autocad_case01_verify.scr') = 'autocad_case01_verify.scr'
    (Join-Path $caseRoot 'carton_dieline.dxf') = 'case01_production_companion.dxf'
    (Join-Path $redrawRoot 'cut\case01_fefco0201_cut.aicad') = 'case01_fefco0201_cut.aicad'
    (Join-Path $redrawRoot 'crease\case01_fefco0201_crease.aicad') = 'case01_fefco0201_crease.aicad'
    (Join-Path $redrawRoot 'slot\case01_fefco0201_slot.aicad') = 'case01_fefco0201_slot.aicad'
}
foreach ($source in $copies.Keys) {
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        throw "Required input is missing: $source"
    }
    Copy-Item -LiteralPath $source -Destination (Join-Path $stageResolved $copies[$source]) -Force
}

$generatedNames = @(
    'case01_fefco0201_constraint_redraw.dwg',
    'draw-report.txt',
    'verify-report.txt',
    'draw.stdout.txt',
    'draw.stderr.txt',
    'verify.stdout.txt',
    'verify.stderr.txt'
)
foreach ($name in $generatedNames) {
    $target = Join-Path $stageResolved $name
    if (Test-Path -LiteralPath $target -PathType Leaf) {
        $resolvedTarget = (Resolve-Path -LiteralPath $target).Path
        if (-not $resolvedTarget.StartsWith($stageResolved + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to remove a file outside the staging directory: $resolvedTarget"
        }
        Remove-Item -LiteralPath $resolvedTarget -Force
    }
}

function Invoke-Case01AutoCad {
    param(
        [Parameter(Mandatory)] [string]$InputDrawing,
        [Parameter(Mandatory)] [string]$ScriptName,
        [Parameter(Mandatory)] [string]$LogPrefix
    )
    $stdout = Join-Path $stageResolved "$LogPrefix.stdout.txt"
    $stderr = Join-Path $stageResolved "$LogPrefix.stderr.txt"
    $script = Join-Path $stageResolved $ScriptName
    $arguments = '/i "{0}" /s "{1}" /l zh-CN' -f $InputDrawing, $script
    $process = Start-Process -FilePath $coreConsole -ArgumentList $arguments -RedirectStandardOutput $stdout -RedirectStandardError $stderr -WindowStyle Hidden -PassThru
    if (-not $process.WaitForExit(90000)) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        throw "AutoCAD Core Console timed out during $LogPrefix."
    }
    $process.WaitForExit()
    if ($null -ne $process.ExitCode -and $process.ExitCode -ne 0) {
        throw "AutoCAD Core Console failed during $LogPrefix with exit code $($process.ExitCode)."
    }
}

$oldRoot = [Environment]::GetEnvironmentVariable('AICAD_CASE_ROOT', 'Process')
try {
    $env:AICAD_CASE_ROOT = $stageResolved
    Invoke-Case01AutoCad -InputDrawing (Join-Path $stageResolved 'case01_production_companion.dxf') -ScriptName 'autocad_case01_draw.scr' -LogPrefix 'draw'
    $stagedDwg = Join-Path $stageResolved 'case01_fefco0201_constraint_redraw.dwg'
    if (-not (Test-Path -LiteralPath $stagedDwg -PathType Leaf)) {
        throw 'AutoCAD did not create the expected DWG.'
    }
    Invoke-Case01AutoCad -InputDrawing $stagedDwg -ScriptName 'autocad_case01_verify.scr' -LogPrefix 'verify'
} finally {
    [Environment]::SetEnvironmentVariable('AICAD_CASE_ROOT', $oldRoot, 'Process')
}

$drawReport = Get-Content -LiteralPath (Join-Path $stageResolved 'draw-report.txt')
$verifyReport = Get-Content -LiteralPath (Join-Path $stageResolved 'verify-report.txt')
if ($drawReport -notcontains 'CASE01_DRAW_PASS') {
    throw "AutoCAD draw report failed: $($drawReport -join '; ')"
}
if ($verifyReport -notcontains 'CASE01_VERIFY_PASS') {
    throw "AutoCAD persistence report failed: $($verifyReport -join '; ')"
}
$companionLine = [string]($verifyReport | Where-Object { $_ -like 'PASS:PERSISTED_COMPANION_LAYER_COUNTS=*' } | Select-Object -First 1)
if ($companionLine -notmatch '=(\d+),(\d+),(\d+)$') {
    throw "Could not parse companion layer counts: $companionLine"
}
$glueCount = [int]$Matches[1]
$dimensionCount = [int]$Matches[2]
$textCount = [int]$Matches[3]

$stagedDwg = Join-Path $stageResolved 'case01_fefco0201_constraint_redraw.dwg'
$finalDwg = Join-Path $redrawRoot 'case01_fefco0201_constraint_redraw.dwg'
Copy-Item -LiteralPath $stagedDwg -Destination $finalDwg -Force
Copy-Item -LiteralPath (Join-Path $stageResolved 'draw-report.txt') -Destination (Join-Path $redrawRoot 'autocad_draw_report.txt') -Force
Copy-Item -LiteralPath (Join-Path $stageResolved 'verify-report.txt') -Destination (Join-Path $redrawRoot 'autocad_verify_report.txt') -Force
Copy-Item -LiteralPath (Join-Path $stageResolved 'draw.stdout.txt') -Destination (Join-Path $redrawRoot 'autocad_draw.stdout.txt') -Force
Copy-Item -LiteralPath (Join-Path $stageResolved 'verify.stdout.txt') -Destination (Join-Path $redrawRoot 'autocad_verify.stdout.txt') -Force

$dwg = Get-Item -LiteralPath $finalDwg
$signature = [Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes($dwg.FullName), 0, 6)
if (-not $signature.StartsWith('AC10')) {
    throw "Unexpected DWG signature: $signature"
}
$validation = [ordered]@{
    schema = 'case01_aicad_autocad_host_validation_v1'
    status = 'pass'
    autocad_core_console = $coreConsole
    autocad_version = (Get-Item -LiteralPath $coreConsole).VersionInfo.FileVersion
    drawing_path = $dwg.FullName
    drawing_signature = $signature
    drawing_bytes = $dwg.Length
    drawing_sha256 = (Get-FileHash -LiteralPath $dwg.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    structural_layers = [ordered]@{ CUT = 21; CREASE = 12; SLOT = 8 }
    aicad_xdata_entities = 41
    plan_to_catalog_translation_mm = @(35.0, 167.5)
    structural_bounds_mm = @(0.0, 0.0, 1575.0, 597.0)
    blank_size_mm = @(1575.0, 597.0)
    production_companion_entities = [ordered]@{
        GLUE = $glueCount
        DIMENSION = $dimensionCount
        TEXT = $textCount
    }
    draw_report = (Join-Path $redrawRoot 'autocad_draw_report.txt')
    verify_report = (Join-Path $redrawRoot 'autocad_verify_report.txt')
    review_only_locks = [ordered]@{
        reviewOnly = $true
        accepted = $false
        ruleEnabled = $false
        packagingGated = $true
    }
}
$validationPath = Join-Path $redrawRoot 'autocad_host_validation.json'
$validation | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $validationPath -Encoding UTF8
$validation | ConvertTo-Json -Depth 6
