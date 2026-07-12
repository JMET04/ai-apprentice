param(
  [string]$PackageRoot = "qa\preview-packages"
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$name = "transparent-ai-apprentice-mcp-preview-$timestamp"
$outRoot = Join-Path $root $PackageRoot
$packageDir = Join-Path $outRoot $name
$zipPath = "$packageDir.zip"

$standalone = Join-Path $root ".next\standalone"
$static = Join-Path $root ".next\static"
$db = Join-Path $root "prisma\dev.db"
$schema = Join-Path $root "prisma\schema.prisma"

if (-not (Test-Path -LiteralPath $standalone)) {
  throw "Missing .next\standalone. Run npm.cmd run build first."
}

if (-not (Test-Path -LiteralPath $static)) {
  throw "Missing .next\static. Run npm.cmd run build first."
}

if (-not (Test-Path -LiteralPath $db)) {
  throw "Missing prisma\dev.db. Run npm.cmd run setup:demo first."
}

New-Item -ItemType Directory -Path $outRoot -Force | Out-Null
New-Item -ItemType Directory -Path $packageDir -Force | Out-Null

Copy-Item -Path (Join-Path $standalone "*") -Destination $packageDir -Recurse -Force

$nextDir = Join-Path $packageDir ".next"
New-Item -ItemType Directory -Path $nextDir -Force | Out-Null
Copy-Item -LiteralPath $static -Destination $nextDir -Recurse -Force

$packagePrisma = Join-Path $packageDir "prisma"
New-Item -ItemType Directory -Path $packagePrisma -Force | Out-Null
Copy-Item -LiteralPath $db -Destination (Join-Path $packagePrisma "dev.db") -Force
Copy-Item -LiteralPath $schema -Destination (Join-Path $packagePrisma "schema.prisma") -Force

@'
DATABASE_URL="file:./dev.db"
NODE_ENV="production"
'@ | Set-Content -LiteralPath (Join-Path $packageDir ".env") -Encoding UTF8

@'
# Transparent AI Apprentice MCP Preview Package

This is a local production preview package generated from the current workspace.

## Start

From this package directory:

```powershell
$env:PORT="3062"
node server.js
```

Then open:

- http://localhost:3062
- http://localhost:3062/tasks/task-photo-travel-journal
- http://localhost:3062/tasks/task-photo-travel-journal/teach
- http://localhost:3062/tasks/task-photo-travel-journal/run

## Verification Used Before Packaging

- npm.cmd run typecheck
- npm.cmd run test
- npm.cmd run verify:learning
- npm.cmd run build

## Notes

- The demo SQLite database is included at `prisma/dev.db`.
- Mock AI service remains isolated behind service interfaces.
- No private chain-of-thought is exposed; the app shows structured traces and review points.
- Teacher acceptance state may still show review gates until product acceptance is explicitly persisted in app state.
'@ | Set-Content -LiteralPath (Join-Path $packageDir "START_HERE.md") -Encoding UTF8

$manifest = [ordered]@{
  name = $name
  generatedAt = (Get-Date).ToString("o")
  sourceRoot = $root
  packageDir = $packageDir
  zipPath = $zipPath
  startCommand = 'node server.js'
  defaultPort = 3062
  included = @(
    ".next standalone server",
    ".next/static",
    "prisma/dev.db",
    "prisma/schema.prisma",
    ".env",
    "START_HERE.md"
  )
  verification = @(
    "npm.cmd run typecheck",
    "npm.cmd run test",
    "npm.cmd run verify:learning",
    "npm.cmd run build"
  )
}

$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $packageDir "preview-manifest.json") -Encoding UTF8

if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -LiteralPath $packageDir -DestinationPath $zipPath -Force

[pscustomobject]@{
  PackageDir = $packageDir
  ZipPath = $zipPath
  StartCommand = "node server.js"
  SuggestedPort = 3062
}
