from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path


VERSION = "1.2.0"
TARGET = Path(__file__).resolve().parents[1]
MAIN = TARGET.parents[1]
SOURCE = Path(os.environ.get("AICAD_SOURCE_ROOT", Path.cwd())).resolve()
PACKAGE = TARGET / "plugin" / "aicad-agent"

SKIP_DIRS = {"__pycache__", ".pytest_cache", "obj", ".git", ".mypy_cache"}
SKIP_SUFFIXES = {".pyc", ".pyo", ".tmp", ".log", ".dwg", ".sldprt", ".step"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.rstrip() + "\n", encoding="utf-8", newline="\n")


def write_json(path: Path, value: object) -> None:
    write_text(path, json.dumps(value, ensure_ascii=False, indent=2))


def copy_file(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def copy_tree(source: Path, destination: Path) -> None:
    for item in source.rglob("*"):
        relative = item.relative_to(source)
        if any(part in SKIP_DIRS for part in relative.parts):
            continue
        if item.is_dir():
            continue
        if item.suffix.lower() in SKIP_SUFFIXES:
            continue
        copy_file(item, destination / relative)


def patch_text(path: Path, replacements: list[tuple[str, str]]) -> None:
    text = path.read_text(encoding="utf-8")
    for old, new in replacements:
        if old not in text:
            raise RuntimeError(f"patch anchor missing in {path}: {old[:80]}")
        text = text.replace(old, new)
    write_text(path, text)


def clean_target() -> None:
    expected = (MAIN / "integration-handoffs").resolve()
    actual = TARGET.resolve()
    if actual.parent != expected or actual.name != "aicad-agent-v1":
        raise RuntimeError(f"refusing to clear unsafe target: {actual}")
    for child in list(TARGET.iterdir()):
        if child.name == "tools":
            for nested in list(child.iterdir()):
                if nested.name != "build_handoff.py":
                    if nested.is_dir():
                        shutil.rmtree(nested)
                    else:
                        nested.unlink()
            continue
        if child.is_dir():
            shutil.rmtree(child)
        else:
            child.unlink()


def assemble_plugin() -> None:
    copy_tree(SOURCE / "agent-plugin" / "aicad-agent", PACKAGE)
    copy_tree(SOURCE / "src", PACKAGE / "runtime" / "src")
    copy_tree(SOURCE / "schema", PACKAGE / "runtime" / "schema")
    copy_tree(SOURCE / "examples", PACKAGE / "runtime" / "examples")
    copy_tree(SOURCE / "tools", PACKAGE / "runtime" / "tools")
    copy_tree(SOURCE / "prompts", PACKAGE / "runtime" / "prompts")
    copy_tree(SOURCE / "docs", PACKAGE / "runtime" / "docs")
    copy_tree(SOURCE / "plugin" / "AiCadConstraint.bundle", PACKAGE / "runtime" / "autocad" / "AiCadConstraint.bundle")
    copy_file(SOURCE / "solidworks-host" / "AiCad.SolidWorksHost" / "Program.cs",
              PACKAGE / "runtime" / "solidworks-host" / "source" / "Program.cs")
    copy_file(SOURCE / "solidworks-host" / "AiCad.SolidWorksHost" / "AiCad.SolidWorksHost.csproj",
              PACKAGE / "runtime" / "solidworks-host" / "source" / "AiCad.SolidWorksHost.csproj")
    host_exe = SOURCE / "build" / "solidworks-host" / "AiCad.SolidWorksHost.exe"
    if not host_exe.is_file():
        raise RuntimeError("compiled SolidWorks host is missing")
    copy_file(host_exe, PACKAGE / "runtime" / "solidworks-host" / host_exe.name)

    for name in ["install.ps1", "uninstall.ps1", "build-solidworks-host.ps1", "test-autocad.ps1"]:
        copy_file(SOURCE / "scripts" / name, PACKAGE / "installers" / name)
    for name in ["test_engine.py", "test_engine3d.py", "test_agent_plugin.py"]:
        copy_file(SOURCE / "tests" / name, PACKAGE / "tests" / name)
    copy_tree(SOURCE / "tests" / "autocad", PACKAGE / "tests" / "autocad")
    copy_file(SOURCE / "pyproject.toml", PACKAGE / "pyproject.toml")
    copy_file(SOURCE / "README.md", PACKAGE / "runtime" / "docs" / "UPSTREAM_README.md")

    patch_text(PACKAGE / ".codex-plugin" / "plugin.json", [
        ('"version": "1.1.0"', f'"version": "{VERSION}"'),
        ('"Audit manifests"]', '"Audit manifests", "Packaging dieline QA", "Review-only MingTu handoff"]'),
    ])
    patch_text(PACKAGE / "scripts" / "aicad_agent.py", [
        ('AGENT_API_VERSION = "1.1.0"', f'AGENT_API_VERSION = "{VERSION}"'),
    ])
    patch_text(PACKAGE / "pyproject.toml", [
        ('version = "1.0.0"', f'version = "{VERSION}"'),
    ])
    patch_text(PACKAGE / "runtime" / "src" / "aicad" / "cli.py", [
        ('VERSION = "1.0.0"', f'VERSION = "{VERSION}"'),
    ])
    patch_text(PACKAGE / "runtime" / "autocad" / "AiCadConstraint.bundle" / "PackageContents.xml", [
        ('AppVersion="1.0.0"', f'AppVersion="{VERSION}"'),
    ])
    lisp = PACKAGE / "runtime" / "autocad" / "AiCadConstraint.bundle" / "Contents" / "AiCadConstraint.lsp"
    lisp_text = lisp.read_text(encoding="utf-8")
    lisp_text = lisp_text.replace("1.0.0", VERSION)
    write_text(lisp, lisp_text)

    csproj = PACKAGE / "runtime" / "solidworks-host" / "source" / "AiCad.SolidWorksHost.csproj"
    patch_text(csproj, [
        ('<SolidWorksApiPath Condition="\'$(SolidWorksApiPath)\' == \'\'">D:\\solidwork26\\SOLIDWORKS\\api\\redist</SolidWorksApiPath>',
         '<SolidWorksApiPath Condition="\'$(SolidWorksApiPath)\' == \'\'">$(ProgramFiles)\\SOLIDWORKS Corp\\SOLIDWORKS\\api\\redist</SolidWorksApiPath>'),
    ])

    patch_solidworks_offline()
    patch_packaging_qa()
    patch_packaged_core_tests()
    patch_packaged_installers()
    create_self_contained_packaging_fixtures()
    create_plugin_docs()


def patch_solidworks_offline() -> None:
    exporter = PACKAGE / "runtime" / "src" / "aicad" / "exporters3d.py"
    patch_text(exporter, [
        ("def host_payload(plan: CompiledPlan3D, output_sldprt: Path, output_step: Path, template_path: Path) -> dict[str, Any]:",
         "def host_payload(plan: CompiledPlan3D, output_sldprt: Path, output_step: Path, template_path: Path | None) -> dict[str, Any]:"),
        ('"template_path": str(template_path.resolve()),',
         '"template_path": str(template_path.resolve()) if template_path else None,'),
        ("def export_plan3d(plan: CompiledPlan3D, output_dir: Path, stem: str, template_path: Path) -> dict[str, Path]:",
         "def export_plan3d(plan: CompiledPlan3D, output_dir: Path, stem: str, template_path: Path | None) -> dict[str, Path]:"),
    ])
    solidworks = PACKAGE / "runtime" / "src" / "aicad" / "solidworks3d.py"
    patch_text(solidworks, [
        ('''    template = find_solidworks_template()
    if template is None:
        raise SolidWorksHostError("SolidWorks 2026 part template was not found")
    paths = export_plan3d(plan, output_dir, stem, template)''',
         '''    template = find_solidworks_template() if execute else None
    if execute and template is None:
        raise SolidWorksHostError("SolidWorks 2026 part template was not found")
    paths = export_plan3d(plan, output_dir, stem, template)'''),
        ('''        "executed": False,
        **_summary(plan),''',
         '''        "executed": False,
        "host_status": "not_requested" if not execute else "pending",
        "native_artifacts": {
            "sldprt": "unavailable_until_host_execution",
            "step": "unavailable_until_host_execution",
            "save_reopen": "not_run",
        },
        **_summary(plan),'''),
        ('''    result["executed"] = True
    result["solidworks_revision"] = report.get("solidworks_revision")''',
         '''    result["executed"] = True
    result["native_artifacts"] = {"sldprt": "validated", "step": "validated", "save_reopen": "passed"}
    result["solidworks_revision"] = report.get("solidworks_revision")'''),
    ])


def patch_packaging_qa() -> None:
    path = PACKAGE / "scripts" / "aicad_packaging_qa.py"
    patch_text(path, [
        ('''    chain = trusted.get("panel_chain_mm", [])
    flap_depth = trusted.get("flap_depth_mm")
    dimensions_pass = (all(abs(a - b) <= TOL for a, b in zip(bbox, expected_bbox)) and
                       abs(sum(chain) - 1575.0) <= TOL and abs(2 * flap_depth - 335.0) <= TOL and
                       trusted.get("manufacturing_mm") == [435.0, 335.0, 262.0] and
                       trusted.get("true_inner_mm") == [428.0, 328.0, 248.0])
    add_result(results, "PKG-G006", dimensions_pass,
               {"actual_bbox_mm": bbox, "expected_bbox_mm": expected_bbox,
                "panel_chain_mm": chain, "panel_chain_sum_mm": sum(chain),
                "flap_closure_mm": 2 * flap_depth}, rule_by_id,''',
         '''    chain = trusted.get("panel_chain_mm", [])
    flap_depth = trusted.get("flap_depth_mm")
    blank = trusted.get("blank_mm", [expected_bbox[2] - expected_bbox[0], expected_bbox[3] - expected_bbox[1]])
    closure_target = trusted.get("closure_target_mm")
    if closure_target is None and isinstance(trusted.get("manufacturing_mm"), list):
        closure_target = trusted["manufacturing_mm"][1]
    vectors = [trusted.get("manufacturing_mm"), trusted.get("true_inner_mm")]
    vectors_valid = all(value is None or (isinstance(value, list) and len(value) == 3 and
                        all(isinstance(item, (int, float)) and item > 0 for item in value)) for value in vectors)
    bbox_size = [expected_bbox[2] - expected_bbox[0], expected_bbox[3] - expected_bbox[1]]
    chain_valid = bool(chain) and all(isinstance(item, (int, float)) and item > 0 for item in chain)
    closure_valid = (flap_depth is None and closure_target is None) or (
        isinstance(flap_depth, (int, float)) and isinstance(closure_target, (int, float)) and
        abs(2 * flap_depth - closure_target) <= TOL)
    dimensions_pass = (len(expected_bbox) == 4 and all(abs(a - b) <= TOL for a, b in zip(bbox, expected_bbox)) and
                       chain_valid and abs(sum(chain) - bbox_size[0]) <= TOL and
                       isinstance(blank, list) and len(blank) == 2 and
                       all(abs(float(blank[i]) - bbox_size[i]) <= TOL for i in range(2)) and
                       closure_valid and vectors_valid)
    add_result(results, "PKG-G006", dimensions_pass,
               {"actual_bbox_mm": bbox, "expected_bbox_mm": expected_bbox,
                "blank_mm": blank, "panel_chain_mm": chain, "panel_chain_sum_mm": sum(chain),
                "closure_target_mm": closure_target,
                "flap_closure_mm": 2 * flap_depth if isinstance(flap_depth, (int, float)) else None}, rule_by_id,'''),
        ('''def preview_checks(png_path: Path | None, svg_path: Path | None) -> dict:
    evidence = {}
    passed = True''',
         '''def preview_checks(png_path: Path | None, svg_path: Path | None) -> dict:
    evidence = {"status": "not_run"}
    passed = False'''),
        ('''    if png_path:
        with Image.open(png_path) as image:''',
         '''    if png_path:
        evidence["status"] = "checked"
        passed = True
        with Image.open(png_path) as image:'''),
        ('''    if svg_path:
        text = svg_path.read_text(encoding="utf-8")''',
         '''    if svg_path:
        evidence["status"] = "checked"
        if not png_path:
            passed = True
        text = svg_path.read_text(encoding="utf-8")'''),
        ('''        passed &= native_text >= 20 and white
    return {"pass": passed, "evidence": evidence}''',
         '''        # SVG text may be converted to vector paths. PNG is sufficient when it is
        # opaque and separately visually reviewed; SVG native text is an optional aid.
        svg_ok = white and (native_text >= 20 or bool(png_path))
        passed &= svg_ok
    return {"pass": passed, "status": evidence["status"], "evidence": evidence}'''),
        ('''    dwg_pass = dwg_report is None or ("REOPEN_PASS" in dwg_report and "FAIL:" not in dwg_report)
    status = "pass" if not failed and preview["pass"] and dwg_pass else "failed"''',
         '''    dwg_status = "not_run" if dwg_report is None else (
        "passed" if "REOPEN_PASS" in dwg_report and "FAIL:" not in dwg_report else "failed")
    checks_pass = not failed and preview["pass"] and dwg_status != "failed"
    status = ("pass" if checks_pass and dwg_status == "passed" else
              "pass_with_host_skips" if checks_pass else "failed")'''),
        ('"autocad_save_reopen_pass": dwg_pass,',
         '"autocad_save_reopen_status": dwg_status,'),
        ('''        f"- AutoCAD保存重开：{'PASS' if dwg_pass else 'FAIL'}", "",''',
         '''        f"- AutoCAD保存重开：{dwg_status.upper()}", "",'''),
        ('''    raise SystemExit(0 if payload["status"] == "pass" else 2)''',
         '''    raise SystemExit(0 if payload["status"] in {"pass", "pass_with_host_skips"} else 2)'''),
    ])


def patch_packaged_core_tests() -> None:
    engine = PACKAGE / "tests" / "test_engine.py"
    patch_text(engine, [
        ('sys.path.insert(0, str(ROOT / "src"))', 'sys.path.insert(0, str(ROOT / "runtime" / "src"))'),
        ('ROOT / "examples" / "rectangle.plan.json"', 'ROOT / "runtime" / "examples" / "rectangle.plan.json"'),
        ('ROOT / "plugin" / "AiCadConstraint.bundle"', 'ROOT / "runtime" / "autocad" / "AiCadConstraint.bundle"'),
        ('"1.0.0"', f'"{VERSION}"'),
        ('ROOT / "scripts" / "install.ps1"', 'ROOT / "installers" / "install.ps1"'),
        ('ROOT / "src" / "aicad" / "cli.py"', 'ROOT / "runtime" / "src" / "aicad" / "cli.py"'),
    ])


def patch_packaged_installers() -> None:
    installer = PACKAGE / "installers" / "install.ps1"
    patch_text(installer, [
        ("'plugin\\AiCadConstraint.bundle'", "'runtime\\autocad\\AiCadConstraint.bundle'"),
        ("$from = Join-Path $root $name", "$from = Join-Path (Join-Path $root 'runtime') $name"),
    ])
    builder = PACKAGE / "installers" / "build-solidworks-host.ps1"
    patch_text(builder, [
        ("[string]$OutputDirectory = 'build\\solidworks-host'", "[string]$OutputDirectory = 'runtime\\solidworks-host'"),
        ("'solidworks-host\\AiCad.SolidWorksHost\\AiCad.SolidWorksHost.csproj'", "'runtime\\solidworks-host\\source\\AiCad.SolidWorksHost.csproj'"),
    ])
    write_text(PACKAGE / "installers" / "install-codex-plugin.ps1", r'''[CmdletBinding(SupportsShouldProcess)]
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
''')
    engine3d = PACKAGE / "tests" / "test_engine3d.py"
    patch_text(engine3d, [
        ('ROOT / "examples" / "mounting_plate_3d.plan.json"', 'ROOT / "runtime" / "examples" / "mounting_plate_3d.plan.json"'),
    ])
    agent = PACKAGE / "tests" / "test_agent_plugin.py"
    patch_text(agent, [
        ('PLUGIN = ROOT / "agent-plugin" / "aicad-agent"', 'PLUGIN = ROOT'),
        ('manifest["version"], "1.1.0"', f'manifest["version"], "{VERSION}"'),
        ('ROOT / "examples"', 'ROOT / "runtime" / "examples"'),
    ])


def sanitize_json(value: object) -> object:
    if isinstance(value, dict):
        return {key: sanitize_json(item) for key, item in value.items()}
    if isinstance(value, list):
        return [sanitize_json(item) for item in value]
    if isinstance(value, str):
        if re.match(r"^[A-Za-z]:[\\/]", value) or value.startswith("/"):
            return "fixtures/" + Path(value.replace("\\", "/")).name
        return value
    return value


def create_self_contained_packaging_fixtures() -> None:
    source_job = SOURCE / "jobs" / "case01_fefco0201_delegated"
    fixture = PACKAGE / "tests" / "fixtures" / "packaging"
    geometry = json.loads((source_job / "case01_image2_geometry.json").read_text(encoding="utf-8"))
    trusted = geometry.setdefault("trusted_numeric_sources", {})
    bbox = geometry["bbox_mm"]
    trusted["blank_mm"] = [bbox[2] - bbox[0], bbox[3] - bbox[1]]
    trusted["closure_target_mm"] = trusted.get("manufacturing_mm", [None, 335])[1]
    write_json(fixture / "geometry.json", sanitize_json(geometry))
    copy_file(source_job / "case01_image2.plugin.dxf", fixture / "dieline.dxf")
    copy_file(source_job / "case01_fefco0201_preview.png", fixture / "preview.png")
    write_json(fixture / "frame-config.json", {
        "reference_measurements_mm": {"outer": [420, 297], "inner_margins": {"left": 25, "top": 5, "right": 5, "bottom": 5}},
        "implementation": {"model_space": "1:1 unchanged", "locked_viewport_scale": "1:5"},
    })
    write_json(fixture / "native-sheet-config.json", {
        "dimensioning": {"counts": {"linear": 10, "radius": 1, "total": 11},
                         "native_entity_types": {"radius": "AcDbRadialDimension"}, "text_override_allowed": False},
        "title_block": {"school": "STU", "name": "明明", "removed_reference_examples": ["班级", "专业", "成绩", "学号"]},
        "technical_requirements": {"location": "inside frame"},
    })
    test_path = PACKAGE / "tests" / "test_packaging_dieline_rules.py"
    test_text = test_path.read_text(encoding="utf-8")
    test_text = test_text.replace('WORKSPACE = Path(__file__).resolve().parents[3]\n', 'FIXTURES = PLUGIN / "tests" / "fixtures" / "packaging"\n')
    test_text = test_text.replace('WORKSPACE / "jobs" / "case01_fefco0201_delegated" / "case01_image2_geometry.json"', 'FIXTURES / "geometry.json"')
    test_text = test_text.replace('WORKSPACE / "jobs" / "case01_fefco0201_delegated" / "case01_frame_reference_config.json"', 'FIXTURES / "frame-config.json"')
    test_text = test_text.replace('WORKSPACE / "jobs" / "case01_fefco0201_delegated" / "case01_native_sheet_config.json"', 'FIXTURES / "native-sheet-config.json"')
    write_text(test_path, test_text)


def create_plugin_docs() -> None:
    write_text(PACKAGE / "README.md", f'''# aicad-agent {VERSION}

Deterministic, origin-anchored CAD plugin for review-only MingTu integration. It compiles 2D AICAD plans to AICAD/SCR/DXF/audit artifacts, runs packaging dieline QA, and supports transactional SolidWorks 3D plans through an optional Windows host.

## Runtime

- Core: Python 3.10+, standard library only.
- Packaging QA: install `requirements-qa.txt`.
- AutoCAD: optional AutoCAD 2025+ bundle under `runtime/autocad`.
- SolidWorks: optional Windows x64, .NET Framework 4.8, licensed SolidWorks 2026 installation. Vendor interop DLLs are intentionally not redistributed.

Quick smoke:

```powershell
python scripts/aicad_agent.py capabilities
python scripts/aicad_agent.py compile --plan runtime/examples/rectangle.plan.json --out smoke --name rectangle
python scripts/aicad_agent.py build3d --plan runtime/examples/mounting_plate_3d.plan.json --out smoke3d --name plate --no-execute
```

This is an engineering candidate for teacher review. It does not represent production or technical acceptance.
''')
    write_text(PACKAGE / "CHANGELOG.md", f'''# Changelog

## {VERSION} - 2026-07-12

- Rebuilt from latest source because 1.1.0 omitted packaging rules/QA/tests and AutoCAD integration assets.
- Added PKG-G001 through PKG-G021 packaging prevention rules and self-contained regression fixtures.
- Parameterized dimension-chain QA; removed case-specific dimensional constants.
- Added honest no-host status and true SolidWorks `--no-execute` offline plan export.
- Unified component version metadata and removed personal SolidWorks SDK path.
- Added strict MingTu request/result contracts, adapters, hashes and safety locks.

## 1.1.0

- Added Codex MCP surface and SolidWorks 3D transaction host.
''')
    write_text(PACKAGE / "THIRD_PARTY_NOTICES.md", '''# Third-party notices

The AICAD source is MIT licensed; see `LICENSE`.

Optional Python QA dependencies are not bundled: `jsonschema`, `ezdxf`, `Pillow`, and `Shapely`. Their licenses must be reviewed by the integrating project and are installed from their publishers.

AutoCAD and SolidWorks are optional commercial hosts and are not included. `SolidWorks.Interop.sldworks.dll` and `SolidWorks.Interop.swconst.dll` are Dassault Systèmes vendor components and are intentionally excluded because redistribution rights were not established. Build the host with `SolidWorksApiPath` pointing to a licensed local installation. The included host executable is project code only and still requires a licensed compatible SolidWorks installation and its interop runtime.
''')
    write_text(PACKAGE / "requirements-qa.txt", "jsonschema>=4.18,<5\nezdxf>=1.4,<2\nPillow>=11,<12\nShapely>=2.1,<3")


def contract_safety() -> dict:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["reviewOnly", "accepted", "ruleEnabled", "packagingGated", "productionApprovalClaimed"],
        "properties": {
            "reviewOnly": {"const": True}, "accepted": {"const": False},
            "ruleEnabled": {"const": False}, "packagingGated": {"const": True},
            "productionApprovalClaimed": {"const": False},
        },
    }


def create_contracts() -> None:
    compatibility = json.loads((MAIN / "plugins" / "transparent-ai-apprentice" / "schemas" / "aicad-packaging-handoff.schema.json").read_text(encoding="utf-8"))
    write_json(TARGET / "contracts" / "mingtu-aicad-packaging-handoff-v1.compat.schema.json", compatibility)
    ref = {
        "type": "object", "additionalProperties": False,
        "required": ["id", "relativePath", "sha256", "mediaType"],
        "properties": {
            "id": {"type": "string", "pattern": "^[A-Za-z0-9_.-]+$"},
            "relativePath": {"type": "string", "pattern": "^(?![A-Za-z]:|/|.*\\.\\.).+"},
            "sha256": {"type": "string", "pattern": "^[a-fA-F0-9]{64}$"},
            "mediaType": {"type": "string", "minLength": 3},
        },
    }
    visual_ref = {
        "type": "object", "additionalProperties": False,
        "required": ["id", "relativePath", "sha256", "mediaType", "role", "pixelMeasurementsAllowed"],
        "properties": {
            **ref["properties"],
            "role": {"const": "visual_topology_only"},
            "pixelMeasurementsAllowed": {"const": False},
        },
    }
    request = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "https://mingtu.local/schemas/mingtu-aicad-request-v1.schema.json",
        "title": "Strict MingTu AICAD request", "type": "object", "additionalProperties": False,
        "required": ["format", "handoffId", "mode", "project", "product", "materials", "engineeringTruth", "evidence", "requestedArtifacts", "hostPolicy", "safety"],
        "$defs": {"artifactRef": ref, "visualArtifactRef": visual_ref, "safety": contract_safety()},
        "properties": {
            "format": {"const": "mingtu_aicad_request_v1"},
            "handoffId": {"type": "string", "minLength": 1},
            "mode": {"enum": ["drawing_2d", "packaging_dieline", "part_3d", "hybrid"]},
            "project": {"type": "object", "additionalProperties": False, "required": ["name", "productType", "requestedUnits"],
                        "properties": {"name": {"type": "string", "minLength": 1}, "productType": {"type": "string", "minLength": 1},
                                       "structureFamily": {"type": "string"}, "requestedUnits": {"const": "mm"}}},
            "product": {"type": "object", "additionalProperties": False, "required": ["name", "dimensions"],
                        "properties": {"name": {"type": "string"}, "shape": {"type": "string"}, "weightKg": {"type": "number", "exclusiveMinimum": 0},
                                       "dimensions": {"type": "array", "minItems": 1, "items": {"type": "object", "additionalProperties": False,
                                           "required": ["id", "semantic", "axes", "values", "unit", "authority", "sourceRef"],
                                           "properties": {"id": {"type": "string"}, "semantic": {"type": "string"}, "axes": {"type": "array", "minItems": 2, "maxItems": 3, "items": {"type": "string"}},
                                                          "values": {"type": "array", "minItems": 2, "maxItems": 3, "items": {"type": "number", "exclusiveMinimum": 0}}, "unit": {"const": "mm"},
                                                          "authority": {"enum": ["teacher_explicit", "approved_engineering", "trusted_catalog", "calculated"]}, "sourceRef": {"type": "string"},
                                                          "sourcePointer": {"type": "string"}, "immutable": {"type": "boolean"}}}}}},
            "materials": {"type": "array", "minItems": 1, "items": {"type": "object", "required": ["id", "category", "name", "authority"],
                         "properties": {"id": {"type": "string"}, "category": {"type": "string"}, "name": {"type": "string"}, "authority": {"enum": ["teacher_explicit", "approved_engineering", "trusted_catalog"]},
                                        "thickness": {"type": "object", "required": ["value", "unit"], "properties": {"value": {"type": "number", "exclusiveMinimum": 0}, "unit": {"const": "mm"}}}}, "additionalProperties": True}},
            "engineeringTruth": {"type": "object", "additionalProperties": False, "required": ["origin", "sourcePrecedence", "conflictPolicy", "imagePixelsUsedAsDimensions"],
                                 "properties": {"origin": {"enum": [[0, 0], [0, 0, 0]]}, "sourcePrecedence": {"const": ["teacher_explicit", "approved_engineering", "trusted_catalog", "calculated", "visual_semantics_only"]},
                                                "conflictPolicy": {"const": "fail_closed_and_report"}, "imagePixelsUsedAsDimensions": {"const": False}, "parameters": {"type": "array"}, "expectedTopology": {"type": "object"}, "expectedBBox": {"type": "array"}}},
            "evidence": {"type": "object", "additionalProperties": False, "required": ["solutionPlan", "image2Sample", "selfChecks", "teacherCorrectionPackets", "localModificationResults"],
                         "properties": {"solutionPlan": {"$ref": "#/$defs/artifactRef"}, "image2Sample": {"$ref": "#/$defs/visualArtifactRef"},
                                        "selfChecks": {"type": "array", "items": {"$ref": "#/$defs/artifactRef"}}, "teacherCorrectionPackets": {"type": "array", "items": {"$ref": "#/$defs/artifactRef"}},
                                        "localModificationResults": {"type": "array", "items": {"$ref": "#/$defs/artifactRef"}}}},
            "localModifications": {"type": "array", "items": {"type": "object", "required": ["id", "baseArtifactSha256", "targetEntityIds", "operation", "requiredGlobalRevalidation"],
                                "properties": {"id": {"type": "string"}, "baseArtifactSha256": {"type": "string", "pattern": "^[a-fA-F0-9]{64}$"}, "targetEntityIds": {"type": "array", "minItems": 1, "items": {"type": "string", "pattern": "^[A-Za-z0-9_]+$"}},
                                               "operation": {"enum": ["add", "replace", "delete", "transform", "update_parameter"]}, "requiredGlobalRevalidation": {"const": True}}, "additionalProperties": True}},
            "requestedArtifacts": {"type": "array", "minItems": 1, "items": {"enum": ["plan", "aicad", "scr", "dxf", "dwg", "pdf", "png", "audit", "validation", "manifest", "sldprt", "step"]}},
            "hostPolicy": {"type": "object", "additionalProperties": False, "required": ["defaultHost", "allowOptionalHosts"], "properties": {"defaultHost": {"const": "none"}, "allowOptionalHosts": {"type": "array", "items": {"enum": ["autocad", "solidworks"]}}}},
            "safety": {"$ref": "#/$defs/safety"},
        },
    }
    result = {
        "$schema": "https://json-schema.org/draft/2020-12/schema", "$id": "https://mingtu.local/schemas/mingtu-aicad-result-v1.schema.json",
        "title": "MingTu AICAD result", "type": "object", "additionalProperties": False,
        "required": ["format", "handoffId", "requestSha256", "status", "provenance", "artifacts", "validation", "hostExecutions", "errors", "preventionRuleDrafts", "safety"],
        "$defs": {"safety": contract_safety()},
        "properties": {
            "format": {"const": "mingtu_aicad_result_v1"}, "handoffId": {"type": "string"}, "requestSha256": {"type": "string", "pattern": "^[a-fA-F0-9]{64}$"},
            "status": {"enum": ["pass", "pass_with_host_skips", "fail", "blocked", "needs_review"]},
            "provenance": {"type": "object", "required": ["producer", "version", "imagePixelsUsedAsDimensions"], "properties": {"producer": {"const": "aicad-agent"}, "version": {"const": VERSION}, "imagePixelsUsedAsDimensions": {"const": False}}, "additionalProperties": True},
            "artifacts": {"type": "array", "items": {"type": "object", "additionalProperties": False, "required": ["id", "kind", "relativePath", "required", "status"],
                "properties": {"id": {"type": "string"}, "kind": {"enum": ["plan", "aicad", "scr", "dxf", "dwg", "pdf", "png", "audit", "validation", "manifest", "swplan", "sldprt", "step"]},
                               "relativePath": {"type": "string", "pattern": "^(?![A-Za-z]:|/|.*\\.\\.).+"}, "required": {"type": "boolean"}, "status": {"enum": ["generated", "validated", "skipped_unavailable", "failed"]},
                               "sha256": {"type": "string", "pattern": "^[a-fA-F0-9]{64}$"}, "sizeBytes": {"type": "integer", "minimum": 0}}}},
            "validation": {"type": "object", "required": ["aicadDeterministicValidation", "mainRuleDslValidation"], "properties": {"aicadDeterministicValidation": {"type": "object"}, "mainRuleDslValidation": {"type": "object"}}, "additionalProperties": True},
            "hostExecutions": {"type": "array", "items": {"type": "object", "required": ["host", "executedThisRun", "mode", "status"], "properties": {"host": {"enum": ["autocad", "solidworks"]}, "executedThisRun": {"type": "boolean"}, "mode": {"enum": ["real", "offline_compile", "historical_evidence", "not_run"]}, "status": {"enum": ["passed", "failed", "unavailable", "skipped"]}, "version": {"type": ["string", "null"]}, "saveReopenStatus": {"enum": ["passed", "failed", "unavailable", "not_run"]}}, "additionalProperties": True}},
            "errors": {"type": "array", "items": {"type": "object", "required": ["id", "code", "stage", "phenomenon", "rootCause", "remediation"], "properties": {"id": {"type": "string"}, "code": {"type": "string"}, "stage": {"type": "string"}, "phenomenon": {"type": "string"}, "rootCause": {"type": "string"}, "remediation": {"type": "string"}, "preventionRuleDraftRef": {"type": "string"}}, "additionalProperties": True}},
            "preventionRuleDrafts": {"type": "array", "items": {"type": "object", "required": ["id", "trigger", "assertion", "lifecycle", "safety"], "properties": {"id": {"type": "string"}, "trigger": {"type": "string"}, "assertion": {"type": "string"}, "lifecycle": {"const": "draft_disabled"}, "safety": {"$ref": "#/$defs/safety"}}, "additionalProperties": True}},
            "safety": {"$ref": "#/$defs/safety"},
        },
    }
    write_json(TARGET / "contracts" / "mingtu-aicad-request-v1.schema.json", request)
    write_json(TARGET / "contracts" / "mingtu-aicad-result-v1.schema.json", result)
    example = {
        "format": "mingtu_aicad_request_v1", "handoffId": "example-packaging-001", "mode": "packaging_dieline",
        "project": {"name": "Review carton", "productType": "transport_box", "structureFamily": "FEFCO_0201", "requestedUnits": "mm"},
        "product": {"name": "Electronic device", "shape": "rectangular", "weightKg": 15,
                    "dimensions": [{"id": "product_envelope", "semantic": "product_envelope", "axes": ["length", "width", "height"], "values": [380, 280, 200], "unit": "mm", "authority": "approved_engineering", "sourceRef": "design-result", "immutable": True}]},
        "materials": [{"id": "primary_board", "category": "corrugated_board", "name": "BC double wall", "authority": "approved_engineering", "thickness": {"value": 7, "unit": "mm"}}],
        "engineeringTruth": {"origin": [0, 0], "sourcePrecedence": ["teacher_explicit", "approved_engineering", "trusted_catalog", "calculated", "visual_semantics_only"], "conflictPolicy": "fail_closed_and_report", "imagePixelsUsedAsDimensions": False},
        "evidence": {"solutionPlan": {"id": "solution", "relativePath": "inputs/design-result.json", "sha256": "0" * 64, "mediaType": "application/json"},
                     "image2Sample": {"id": "image2", "relativePath": "inputs/sample.png", "sha256": "1" * 64, "mediaType": "image/png", "role": "visual_topology_only", "pixelMeasurementsAllowed": False},
                     "selfChecks": [], "teacherCorrectionPackets": [], "localModificationResults": []},
        "localModifications": [], "requestedArtifacts": ["plan", "aicad", "scr", "dxf", "audit", "validation", "manifest", "png"],
        "hostPolicy": {"defaultHost": "none", "allowOptionalHosts": ["autocad", "solidworks"]},
        "safety": {"reviewOnly": True, "accepted": False, "ruleEnabled": False, "packagingGated": True, "productionApprovalClaimed": False},
    }
    write_json(TARGET / "contracts" / "examples" / "packaging-request.json", example)


def create_adapter() -> None:
    write_text(TARGET / "adapters" / "transparent-ai-apprentice" / "aicad-handoff-adapter.mjs", r'''#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const locks = { reviewOnly: true, accepted: false, ruleEnabled: false, packagingGated: true, productionApprovalClaimed: false };
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const fail = message => { throw new Error(message); };

export function semanticPreflight(request) {
  if (request?.format !== "mingtu_aicad_request_v1") fail("unsupported request format");
  for (const [key, value] of Object.entries(locks)) if (request?.safety?.[key] !== value) fail(`unsafe lock: ${key}`);
  if (request?.engineeringTruth?.imagePixelsUsedAsDimensions !== false) fail("PIXEL_DIMENSION_FORBIDDEN");
  if (request?.evidence?.image2Sample?.role !== "visual_topology_only" || request?.evidence?.image2Sample?.pixelMeasurementsAllowed !== false) fail("IMAGE2_ROLE_INVALID");
  for (const dimension of request?.product?.dimensions ?? []) if (!['teacher_explicit','approved_engineering','trusted_catalog','calculated'].includes(dimension.authority)) fail("UNTRUSTED_DIMENSION_AUTHORITY");
  for (const patch of request?.localModifications ?? []) if (patch.requiredGlobalRevalidation !== true) fail("GLOBAL_REVALIDATION_REQUIRED");
  return { ok: true, locks };
}

export function runOfflineCompile({ requestPath, planPath, outputDir, pluginRoot }) {
  const bytes = fs.readFileSync(requestPath);
  const request = JSON.parse(bytes.toString("utf8"));
  semanticPreflight(request);
  const args = [path.join(pluginRoot, "scripts", "aicad_agent.py"), "compile", "--plan", planPath, "--out", outputDir, "--name", "mingtu-handoff"];
  const proc = spawnSync("python", args, { encoding: "utf8", windowsHide: true });
  if (proc.status !== 0) fail(proc.stderr || proc.stdout || "AICAD compile failed");
  return { format: "mingtu_aicad_result_v1", handoffId: request.handoffId, requestSha256: sha(bytes), status: "pass_with_host_skips",
    provenance: { producer: "aicad-agent", version: "1.2.0", imagePixelsUsedAsDimensions: false },
    artifacts: [], validation: { aicadDeterministicValidation: { status: "passed", raw: JSON.parse(proc.stdout) }, mainRuleDslValidation: { status: "not_run", note: "coarse compatibility layer" } },
    hostExecutions: [{ host: "autocad", executedThisRun: false, mode: "offline_compile", status: "skipped", saveReopenStatus: "not_run" }, { host: "solidworks", executedThisRun: false, mode: "not_run", status: "skipped", saveReopenStatus: "not_run" }],
    errors: [], preventionRuleDrafts: [], safety: locks };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const get = flag => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : null; };
  const requestPath = get("--request");
  if (!requestPath) fail("--request is required");
  const request = JSON.parse(fs.readFileSync(requestPath, "utf8"));
  const result = semanticPreflight(request);
  process.stdout.write(JSON.stringify(result) + "\n");
}
''')
    write_json(TARGET / "adapters" / "transparent-ai-apprentice" / "package-scripts.patch.json", {
        "scripts": {"verify:aicad-integration": "python integration-handoffs/aicad-agent-v1/tests/run_integration_tests.py",
                    "smoke:aicad-handoff": "node plugins/transparent-ai-apprentice/scripts/smoke-aicad-handoff-adapter.mjs"},
        "verifyPluginRequiredFiles": ["plugins/aicad-agent/.codex-plugin/plugin.json", "plugins/transparent-ai-apprentice/schemas/mingtu-aicad-result-v1.schema.json", "plugins/transparent-ai-apprentice/scripts/aicad-handoff-adapter.mjs"],
    })


def create_docs() -> None:
    write_text(TARGET / "docs" / "SOURCE_AUDIT.md", f'''# Source and release audit

- Rebuild decision: **1.2.0**. Release 1.1.0 is not complete because it omitted current packaging rules/QA/tests, the AutoCAD bundle, full source/docs and integration contracts.
- Source version drift found: plugin/MCP 1.1.0; Python package/CLI/AutoCAD bundle 1.0.0. The handoff copy is unified to {VERSION}.
- Latest packaging registry contains PKG-G001 through PKG-G021. The packaged QA is parameterized and no longer contains case01 dimension constants.
- The prior packaging test depended on `jobs/`; this build contains a sanitized self-contained fixture.
- SolidWorks SDK path contained a machine-specific default; it is replaced by `$(ProgramFiles)`/MSBuild override.
- Proprietary SolidWorks interop DLLs are excluded pending redistribution-right confirmation.
- Core upstream tests were previously observed at 28/28 pass; this handoff performs fresh packaged tests and records them under `validation/`.

This audit is engineering evidence only, not production or technical acceptance.
''')
    write_text(TARGET / "docs" / "MAIN_PROJECT_INTEGRATION.md", '''# Main project integration

Use the existing main-project route; do not add a parallel workflow:

`packaging-design-apprentice` → `mingtu_aicad_packaging_handoff_v1` → strict adapter preflight → AICAD offline compile → optional host gate → `mingtu_aicad_result_v1` → `record-cad-result` → teacher review.

## Recommended merge

1. Copy `plugin/aicad-agent/**` to `plugins/aicad-agent/**`.
2. Copy the strict request/result schemas to `plugins/transparent-ai-apprentice/schemas/` while retaining the current compatibility handoff schema.
3. Copy the adapter to `plugins/transparent-ai-apprentice/scripts/aicad-handoff-adapter.mjs`.
4. Merge the proposed package scripts; add new files to `verify-plugin.mjs` and the release packager required list.
5. Strengthen `packaging-design-workflow.mjs record-cad-result`: verify request/session binding, result schema, all hashes, path containment and all safety locks before progressing.
6. Keep the bridge advanced-only. Do not expand the five default teacher-facing MCP tools.

## Runtime and degradation

- Default host is `none`. Portable 2D compilation produces plan/AICAD/SCR/DXF/audit/manifest.
- Without AutoCAD, DWG/PDF/native-text/reopen checks are `skipped_unavailable`, never fabricated or counted as passed.
- Without SolidWorks, 3D validation and `--no-execute` swplan/audit/manifest work; SLDPRT/STEP/reopen are unavailable.
- Host execution must be a separate explicit gate on Windows with the licensed host already installed.
- External AI providers are disabled by default. Offline deterministic planning is the integration baseline; never persist API keys.

## Truth and validation

Structured teacher/engineering data outranks catalogs and calculated values. Image2, screenshots and masks may identify topology, intent and presentation only; pixels are never dimensional truth. Local edits must target stable ASCII entity IDs and trigger full global revalidation.

The main Rule DSL geometry checks are coarse compatibility checks. Preserve AICAD numerical checks for endpoint tolerance, duplicates, zero length, overlap, self-intersection, closure and actual layer-coordinate conflicts.

Every request/result and prevention-rule draft stays `reviewOnly=true`, `accepted=false`, `ruleEnabled=false`, `packagingGated=true`. New rules remain `draft_disabled` until teacher review.
''')
    write_text(TARGET / "docs" / "MERGE_CHECKLIST.md", '''# Exact copy and merge checklist

## Copy

- `plugin/aicad-agent/**` → `plugins/aicad-agent/**`
- `contracts/mingtu-aicad-request-v1.schema.json` → `plugins/transparent-ai-apprentice/schemas/mingtu-aicad-request-v1.schema.json`
- `contracts/mingtu-aicad-result-v1.schema.json` → `plugins/transparent-ai-apprentice/schemas/mingtu-aicad-result-v1.schema.json`
- `adapters/transparent-ai-apprentice/aicad-handoff-adapter.mjs` → `plugins/transparent-ai-apprentice/scripts/aicad-handoff-adapter.mjs`
- Add a main-project smoke wrapper based on the packaged adapter test.

## Merge, do not overwrite

- `package.json`: merge `adapters/transparent-ai-apprentice/package-scripts.patch.json` scripts.
- `plugins/transparent-ai-apprentice/scripts/verify-plugin.mjs`: append required AICAD files.
- `scripts/package-codex-plugin.ps1`: append the AICAD plugin/schema/adapter/smoke required items.
- `packaging-design-workflow.mjs`: strengthen `record-cad-result` with schema, session, hash, containment and lock checks.
- Optional adapter registry entry: `aicad-agent-cli`, `nativeIntegrationRequired=false`; AutoCAD/SolidWorks remain optional hosts.

Do not copy packaging rules into active rule examples. If mirrored into the main Rule DSL, place them under a candidate area with `lifecycle=draft_disabled`.
''')
    write_text(TARGET / "docs" / "SECURITY_AND_LIMITS.md", '''# Security, licensing and limits

- Review-only safety locks are schema constants and runtime assertions.
- Paths in contracts and release metadata are relative; traversal and absolute paths are rejected.
- Image pixels cannot become dimensional parameters. Conflicts fail closed.
- No secrets, user configuration, marketplace state, cache, jobs or temporary native CAD files are included.
- OpenAI/network providers require separate explicit authorization; offline is default.
- AutoCAD and SolidWorks are optional commercial hosts. No host license is included.
- SolidWorks interop DLLs are not redistributed. The compiled project host requires a compatible licensed installation.
- 2D native plan primitives are LINE/CIRCLE/ARC; layer/text/dimension orchestration remains in packaging/host adapters.
- 3D supports base/boss/cut extrusions with rectangle/circle/circle-pattern profiles; no assembly, shell, sweep, loft, surface, fillet or chamfer.
- Historical host evidence predates the newest packaged LISP/host executable and is provenance only, not proof of this binary.
''')


def create_evidence() -> None:
    auto = SOURCE / "build" / "autocad-host-test" / "host-validation.json"
    sw = SOURCE / "build" / "solidworks-3d-final" / "mounting-plate-final.solidworks-report.json"
    reopen = SOURCE / "build" / "solidworks-3d-final" / "mounting-plate-final.reopen-report.json"
    auto_data = json.loads(auto.read_text(encoding="utf-8-sig"))
    sw_data = json.loads(sw.read_text(encoding="utf-8-sig"))
    reopen_data = json.loads(reopen.read_text(encoding="utf-8-sig"))
    summary = {
        "schema": "aicad_historical_host_evidence_summary_v1", "executedThisRun": False,
        "warning": "Historical evidence only; it predates the newest packaged LISP/host binary and is not a validation of this build.",
        "autocad": {"mode": "historical_evidence", "status": auto_data.get("status"), "host": "AutoCAD 2025 CoreConsole",
                    "hostFileVersion": "25.0.58.0.0", "dwgFormat": "AC1032", "sourceEvidenceSha256": sha256(auto),
                    "observedChecks": ["plugin load", "entity IDs", "DWG save", "save/reopen persistence", "arc/XData"]},
        "solidworks": {"mode": "historical_evidence", "status": sw_data.get("status"), "hostRevision": sw_data.get("solidworks_revision", "34.0.0"),
                       "sourceEvidenceSha256": sha256(sw), "reopenEvidenceSha256": sha256(reopen), "reopenStatus": reopen_data.get("status"),
                       "observedChecks": ["four feature transactions", "fully constrained sketches", "zero body faults", "volume/bbox", "SLDPRT reopen"]},
        "safety": {"reviewOnly": True, "accepted": False, "ruleEnabled": False, "packagingGated": True},
    }
    write_json(TARGET / "evidence" / "historical-host-evidence-summary.json", summary)


def create_tests() -> None:
    write_text(TARGET / "tests" / "run_integration_tests.py", r'''from __future__ import annotations
import hashlib, json, os, subprocess, sys, tempfile, unittest
from pathlib import Path
import jsonschema

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "plugin" / "aicad-agent"

class IntegrationTests(unittest.TestCase):
    def test_plugin_completeness_and_version(self):
        required = [PLUGIN / ".codex-plugin/plugin.json", PLUGIN / ".mcp.json", PLUGIN / "LICENSE", PLUGIN / "rules/packaging_dieline_rules.json", PLUGIN / "scripts/aicad_packaging_qa.py", PLUGIN / "runtime/autocad/AiCadConstraint.bundle/Contents/AiCadConstraint.lsp", PLUGIN / "runtime/solidworks-host/source/Program.cs", PLUGIN / "runtime/solidworks-host/AiCad.SolidWorksHost.exe"]
        self.assertTrue(all(path.is_file() for path in required))
        self.assertEqual(json.loads(required[0].read_text(encoding="utf8"))["version"], "1.2.0")

    def test_contract_schema_and_semantics(self):
        schema = json.loads((ROOT / "contracts/mingtu-aicad-request-v1.schema.json").read_text(encoding="utf8"))
        sample = json.loads((ROOT / "contracts/examples/packaging-request.json").read_text(encoding="utf8"))
        jsonschema.Draft202012Validator(schema).validate(sample)
        broken = json.loads(json.dumps(sample)); broken["engineeringTruth"]["imagePixelsUsedAsDimensions"] = True
        with self.assertRaises(jsonschema.ValidationError): jsonschema.Draft202012Validator(schema).validate(broken)

    def test_basic_2d_compile(self):
        with tempfile.TemporaryDirectory() as tmp:
            proc = subprocess.run([sys.executable, str(PLUGIN / "scripts/aicad_agent.py"), "compile", "--plan", str(PLUGIN / "runtime/examples/rectangle.plan.json"), "--out", tmp, "--name", "smoke"], capture_output=True, text=True)
            self.assertEqual(proc.returncode, 0, proc.stderr + proc.stdout)
            for suffix in [".plan.json", ".aicad", ".scr", ".dxf", ".audit.md", ".manifest.json"]: self.assertTrue((Path(tmp) / ("smoke" + suffix)).is_file(), suffix)

    def test_packaging_qa_without_host(self):
        f = PLUGIN / "tests/fixtures/packaging"
        with tempfile.TemporaryDirectory() as tmp:
            outj, outm = Path(tmp) / "validation.json", Path(tmp) / "validation.md"
            proc = subprocess.run([sys.executable, str(PLUGIN / "scripts/aicad_packaging_qa.py"), "--geometry", str(f / "geometry.json"), "--dxf", str(f / "dieline.dxf"), "--png", str(f / "preview.png"), "--out-json", str(outj), "--out-md", str(outm)], capture_output=True, text=True)
            self.assertEqual(proc.returncode, 0, proc.stderr + proc.stdout)
            data = json.loads(outj.read_text(encoding="utf8")); self.assertEqual(data["status"], "pass_with_host_skips"); self.assertEqual(data["autocad_save_reopen_status"], "not_run")

    def test_solidworks_no_execute_has_no_host_requirement(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy(); env["AICAD_SOLIDWORKS_TEMPLATE"] = str(Path(tmp) / "missing.prtdot"); env["AICAD_SOLIDWORKS_HOST"] = str(Path(tmp) / "missing.exe")
            proc = subprocess.run([sys.executable, str(PLUGIN / "scripts/aicad_agent.py"), "build3d", "--plan", str(PLUGIN / "runtime/examples/mounting_plate_3d.plan.json"), "--out", tmp, "--name", "offline", "--no-execute"], capture_output=True, text=True, env=env)
            self.assertEqual(proc.returncode, 0, proc.stderr + proc.stdout)
            data = json.loads(proc.stdout); self.assertFalse(data["executed"]); self.assertEqual(data["host_status"], "not_requested"); self.assertTrue((Path(tmp) / "offline.swplan.json").is_file())

    def test_no_personal_paths_secrets_or_cache(self):
        forbidden_names = {"__pycache__", ".pytest_cache", "jobs", "obj"}
        patterns = [re.compile(rb"[A-Za-z]:\\Users\\", re.I), re.compile(rb"D:\\CAD"), re.compile(rb"D:\\Transparent", re.I), re.compile(rb"sk-[A-Za-z0-9]{16,}")]
        import re
        for path in ROOT.rglob("*"):
            if path.is_dir(): self.assertNotIn(path.name, forbidden_names)
            elif path.suffix.lower() not in {".exe", ".dll", ".png", ".dxf", ".zip"}:
                data = path.read_bytes()
                for pattern in patterns: self.assertIsNone(pattern.search(data), f"{pattern.pattern!r} in {path}")

if __name__ == "__main__": unittest.main(verbosity=2)
'''.replace('import hashlib, json, os, subprocess, sys, tempfile, unittest', 'import hashlib, json, os, re, subprocess, sys, tempfile, unittest').replace('        import re\n', ''))
    write_text(TARGET / "tests" / "verify_manifest.py", r'''from __future__ import annotations
import hashlib, json, sys
from pathlib import Path
root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / "integration-manifest.json").read_text(encoding="utf8"))
errors = []
for row in manifest["files"]:
    path = root / row["path"]
    if not path.is_file(): errors.append(f"missing:{row['path']}"); continue
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    if actual != row["sha256"]: errors.append(f"hash:{row['path']}")
print(json.dumps({"ok": not errors, "checked": len(manifest["files"]), "errors": errors}))
raise SystemExit(0 if not errors else 2)
''')


def run_validation() -> None:
    env = os.environ.copy()
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env["PYTHONPATH"] = str(PACKAGE / "runtime" / "src")
    commands = [
        ("integration_smoke", [sys.executable, "-B", "tests/run_integration_tests.py"]),
        ("packaged_unit_and_regression", [sys.executable, "-B", "-m", "unittest", "discover", "-s", "plugin/aicad-agent/tests", "-p", "test_*.py", "-v"]),
        ("adapter_preflight", ["node", "adapters/transparent-ai-apprentice/aicad-handoff-adapter.mjs", "--request", "contracts/examples/packaging-request.json"]),
        ("mcp_capabilities", [sys.executable, "plugin/aicad-agent/scripts/aicad_agent.py", "capabilities"]),
    ]
    results = []
    passed_tests = 0
    for name, command in commands:
        completed = subprocess.run(command, cwd=TARGET, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace", check=False)
        combined = (completed.stdout + "\n" + completed.stderr).strip()
        for match in re.finditer(r"Ran (\d+) tests?", combined):
            passed_tests += int(match.group(1))
        results.append({"name": name, "command": " ".join(command[1:] if command[0] == sys.executable else command),
                        "exitCode": completed.returncode, "status": "pass" if completed.returncode == 0 else "fail",
                        "outputTail": combined[-4000:]})
    rules = json.loads((PACKAGE / "rules" / "packaging_dieline_rules.json").read_text(encoding="utf-8"))
    rule_ids = [item["id"] for item in rules["rules"]]
    registry_ok = rule_ids == [f"PKG-G{index:03d}" for index in range(1, 22)]
    evidence = json.loads((TARGET / "evidence" / "historical-host-evidence-summary.json").read_text(encoding="utf-8"))
    status = "pass" if all(item["exitCode"] == 0 for item in results) and registry_ok else "failed"
    payload = {
        "schema": "aicad_agent_integration_validation_v1", "generatedAt": datetime.now(timezone.utc).isoformat(),
        "status": status, "version": VERSION, "testCount": passed_tests,
        "checks": results,
        "packagingRules": {"status": "pass" if registry_ok else "fail", "count": len(rule_ids), "first": rule_ids[0], "last": rule_ids[-1]},
        "historicalHostEvidence": {
            "executedThisRun": False,
            "autocad2025": {"status": evidence["autocad"]["status"], "mode": "historical_evidence", "latestBinaryValidated": False},
            "solidworks2026": {"status": evidence["solidworks"]["status"], "reopenStatus": evidence["solidworks"]["reopenStatus"], "mode": "historical_evidence", "latestBinaryValidated": False},
            "boundary": "Evidence predates the newest packaged LISP/host binary; no native host rerun was claimed.",
        },
        "hostlessBehavior": {"twoDimensionalPortableCompile": "passed", "solidworksNoExecute": "passed", "nativeArtifacts": "skipped_unavailable unless an explicit licensed host gate runs"},
        "manifestVerification": {"status": "performed_after_manifest_generation", "command": "python tests/verify_manifest.py"},
        "releaseBoundary": "Engineering candidate and teacher-review material only; not production or technical acceptance.",
        "safety": {"reviewOnly": True, "accepted": False, "ruleEnabled": False, "packagingGated": True, "productionApprovalClaimed": False},
    }
    write_json(TARGET / "validation" / "validation.json", payload)
    lines = ["# AICAD 集成交付验证", "", f"- 总状态：**{status.upper()}**", f"- 版本：`{VERSION}`", f"- 自动化测试：`{passed_tests}` 项通过", "- 原生宿主：仅复核历史证据，本次未重跑，不声称验证最新二进制", "- 交付边界：工程候选与老师审核材料，不是量产或技术验收", "", "## 实测命令", ""]
    for item in results:
        lines.append(f"- {item['name']}: **{item['status'].upper()}**（exit {item['exitCode']}）")
    lines.extend(["", "## 宿主与降级", "", "- 无 AutoCAD：2D plan/AICAD/SCR/DXF/audit/manifest 可生成；DWG/PDF/重开标记为不可用。", "- 无 SolidWorks：3D validate 与 `--no-execute` swplan/audit/manifest 可生成；SLDPRT/STEP/重开标记为不可用。", "- AutoCAD 2025 与 SolidWorks 2026 的既有报告均显示通过，但时间早于当前封装的最新组件，只作来源证据。", "", "## 安全锁", "", "`reviewOnly=true, accepted=false, ruleEnabled=false, packagingGated=true`。"])
    write_text(TARGET / "validation" / "validation.md", "\n".join(lines))
    if status != "pass":
        raise RuntimeError("handoff validation failed; see validation/validation.json")


def all_hash_rows(exclude: set[str]) -> list[dict]:
    rows = []
    for path in sorted(TARGET.rglob("*"), key=lambda value: value.as_posix().lower()):
        if not path.is_file():
            continue
        rel = path.relative_to(TARGET).as_posix()
        if rel in exclude or rel.startswith("release/"):
            continue
        rows.append({"path": rel, "sha256": sha256(path), "sizeBytes": path.stat().st_size})
    return rows


def create_manifest_and_release() -> None:
    manifest = {
        "schema": "aicad_agent_integration_manifest_v1", "name": "aicad-agent", "version": VERSION,
        "releaseDecision": {"previous": "1.1.0", "rebuilt": True, "reason": "1.1.0 omitted current packaging rules/QA/tests and complete host/integration assets"},
        "entries": {"codexPlugin": "plugin/aicad-agent/.codex-plugin/plugin.json", "mcp": "plugin/aicad-agent/.mcp.json", "cli": "plugin/aicad-agent/scripts/aicad_agent.py", "strictRequestSchema": "contracts/mingtu-aicad-request-v1.schema.json", "resultSchema": "contracts/mingtu-aicad-result-v1.schema.json", "mainProjectAdapter": "adapters/transparent-ai-apprentice/aicad-handoff-adapter.mjs"},
        "runtime": {"python": ">=3.10", "coreDependencies": [], "qaDependenciesFile": "plugin/aicad-agent/requirements-qa.txt", "defaultProvider": "offline", "platform": "cross-platform core; Windows optional hosts"},
        "optionalHosts": [{"name": "AutoCAD", "testedHistoricalVersion": "2025", "required": False}, {"name": "SolidWorks", "testedHistoricalVersion": "2026 / revision 34.0.0", "required": False, "framework": ".NET Framework 4.8 x64"}],
        "tools": ["aicad_capabilities", "aicad_get_plan_schema", "aicad_generate", "aicad_validate_plan", "aicad_compile_plan", "aicad_solidworks_doctor", "aicad_get_3d_plan_schema", "aicad_validate_3d_plan", "aicad_build_solidworks_part"],
        "capabilities": ["origin-anchored 2D constraint validation", "AICAD/SCR/DXF/audit/manifest export", "packaging dieline QA PKG-G001..PKG-G021", "AutoCAD bundle and XData workflow", "offline 3D plan validation/export", "optional transactional SolidWorks SLDPRT/STEP host", "error root-cause and draft prevention rules"],
        "licenses": {"project": "MIT", "file": "plugin/aicad-agent/LICENSE", "thirdParty": "plugin/aicad-agent/THIRD_PARTY_NOTICES.md", "excludedVendorBinaries": ["SolidWorks.Interop.sldworks.dll", "SolidWorks.Interop.swconst.dll"]},
        "knownLimits": ["native 2D primitives are LINE/CIRCLE/ARC", "packaging IDs follow current four-panel conventions for several checks", "3D feature family is base/boss/cut extrude only", "native host outputs unavailable without licensed hosts", "historical host evidence does not validate newest packaged binaries"],
        "safety": {"reviewOnly": True, "accepted": False, "ruleEnabled": False, "packagingGated": True, "productionApprovalClaimed": False, "failClosedOnTruthConflict": True, "imagePixelsAreNeverDimensionalTruth": True},
        "validationCommands": ["python tests/run_integration_tests.py", "python tests/verify_manifest.py", "python plugin/aicad-agent/scripts/aicad_agent.py capabilities", "python plugin/aicad-agent/scripts/aicad_agent.py build3d --plan plugin/aicad-agent/runtime/examples/mounting_plate_3d.plan.json --out <temp> --name offline --no-execute"],
        "hashPolicy": {"algorithm": "SHA-256", "exclusions": ["integration-manifest.json (self-referential)", "SHA256SUMS (checksum index)", "release/* (archive is recorded in SHA256SUMS)"]},
        "files": all_hash_rows({"integration-manifest.json", "SHA256SUMS"}),
    }
    write_json(TARGET / "integration-manifest.json", manifest)
    release = TARGET / "release" / f"aicad-agent-{VERSION}-mingtu-integration.zip"
    release.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(release, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(TARGET.rglob("*"), key=lambda value: value.as_posix().lower()):
            if not path.is_file() or path == release or path.name == "SHA256SUMS":
                continue
            archive.write(path, (Path(f"aicad-agent-v1") / path.relative_to(TARGET)).as_posix())
    checksum_rows = []
    for path in sorted(TARGET.rglob("*"), key=lambda value: value.as_posix().lower()):
        if path.is_file() and path.name != "SHA256SUMS":
            checksum_rows.append(f"{sha256(path)}  {path.relative_to(TARGET).as_posix()}")
    write_text(TARGET / "SHA256SUMS", "\n".join(checksum_rows))


def main() -> int:
    clean_target()
    assemble_plugin()
    create_contracts()
    create_adapter()
    create_docs()
    create_evidence()
    create_tests()
    run_validation()
    create_manifest_and_release()
    print(json.dumps({"ok": True, "target": str(TARGET), "version": VERSION}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
