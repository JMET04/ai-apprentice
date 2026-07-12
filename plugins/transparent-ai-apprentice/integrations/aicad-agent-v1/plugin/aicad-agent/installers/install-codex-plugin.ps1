[CmdletBinding(SupportsShouldProcess)]
param([string]$DestinationRoot = (Join-Path $HOME 'plugins'))
$ErrorActionPreference = 'Stop'
$source = Split-Path -Parent $PSScriptRoot
$root = [IO.Path]::GetFullPath($DestinationRoot)
$destination = [IO.Path]::GetFullPath((Join-Path $root 'aicad-agent'))
if (-not $destination.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe destination.' }
if (-not (Test-Path -LiteralPath (Join-Path $source '.codex-plugin\plugin.json') -PathType Leaf)) { throw 'Plugin manifest is missing.' }
& python -c "import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 1)"
if ($LASTEXITCODE -ne 0) { throw 'Python 3.10 or newer is required.' }
New-Item -ItemType Directory -Path $root -Force | Out-Null
if ($PSCmdlet.ShouldProcess($destination, 'Install aicad-agent plugin files')) {
  if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Recurse -Force }
  New-Item -ItemType Directory -Path $destination -Force | Out-Null
  Get-ChildItem -LiteralPath $source -Force | Where-Object Name -ne 'installers' | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $destination -Recurse -Force }
  Copy-Item -LiteralPath (Join-Path $source 'installers') -Destination $destination -Recurse -Force
}
Write-Host "Installed plugin files: $destination"
Write-Host 'Register or install through the main project review process; this script does not modify a marketplace.'
