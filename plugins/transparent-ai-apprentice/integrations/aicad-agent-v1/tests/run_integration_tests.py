from __future__ import annotations
import hashlib, json, os, re, subprocess, sys, tempfile, unittest
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
        for path in ROOT.rglob("*"):
            if path.is_dir(): self.assertNotIn(path.name, forbidden_names)
            elif path.suffix.lower() not in {".exe", ".dll", ".png", ".dxf", ".zip"}:
                data = path.read_bytes()
                for pattern in patterns: self.assertIsNone(pattern.search(data), f"{pattern.pattern!r} in {path}")

if __name__ == "__main__": unittest.main(verbosity=2)
