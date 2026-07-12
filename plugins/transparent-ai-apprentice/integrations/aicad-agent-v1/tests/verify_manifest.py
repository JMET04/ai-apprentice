from __future__ import annotations
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
