from __future__ import annotations

import json
import math
import unittest
from pathlib import Path

from aicad.engine import PlanError
from aicad.engine3d import compile_plan3d


ROOT = Path(__file__).resolve().parents[1]


def sample() -> dict:
    return json.loads((ROOT / "runtime" / "examples" / "mounting_plate_3d.plan.json").read_text(encoding="utf-8"))


class Engine3DTests(unittest.TestCase):
    def test_compiles_feature_graph_and_analytic_state(self) -> None:
        plan = compile_plan3d(sample())
        self.assertEqual([item.id for item in plan.features], ["F001", "F002", "F003", "F004"])
        self.assertAlmostEqual(plan.features[-1].expected_volume_after, 115514.15926535898, places=7)
        self.assertEqual(plan.features[-1].expected_bbox, (-60.0, -40.0, 0.0, 60.0, 40.0, 20.0))
        self.assertEqual(plan.features[-1].expected_body_count, 1)

    def test_requires_exact_origin(self) -> None:
        data = sample()
        data["part"]["origin"] = [1, 0, 0]
        with self.assertRaisesRegex(PlanError, "exactly"):
            compile_plan3d(data)

    def test_first_feature_must_be_dependency_free_base(self) -> None:
        data = sample()
        data["features"][0]["type"] = "boss_extrude"
        with self.assertRaisesRegex(PlanError, "first 3D feature"):
            compile_plan3d(data)

    def test_rejects_forward_dependency(self) -> None:
        data = sample()
        data["features"][1]["depends_on"] = ["F003"]
        with self.assertRaisesRegex(PlanError, "unknown or later"):
            compile_plan3d(data)

    def test_rejects_profile_outside_support(self) -> None:
        data = sample()
        data["features"][2]["profile"]["center"] = [60, 0]
        data["features"][2]["constraints"][1]["dx"] = 60
        with self.assertRaisesRegex(PlanError, "not contained"):
            compile_plan3d(data)

    def test_rejects_overlapping_hole_pattern(self) -> None:
        data = sample()
        data["features"][1]["profile"]["radius"] = 40
        data["features"][1]["constraints"][3]["value"] = 40
        with self.assertRaisesRegex(PlanError, "overlapping"):
            compile_plan3d(data)

    def test_declared_constraint_must_match_geometry(self) -> None:
        data = sample()
        data["features"][0]["constraints"][1]["value"] = 121
        with self.assertRaisesRegex(PlanError, "width constraint"):
            compile_plan3d(data)

    def test_source_hash_is_canonical_and_sensitive(self) -> None:
        first = compile_plan3d(sample()).source_hash
        reordered = json.loads(json.dumps(sample(), sort_keys=True))
        self.assertEqual(first, compile_plan3d(reordered).source_hash)
        changed = sample()
        changed["features"][0]["purpose"] += " changed"
        self.assertNotEqual(first, compile_plan3d(changed).source_hash)

    def test_volume_is_derived_not_caller_supplied(self) -> None:
        plan = compile_plan3d(sample())
        base = 120 * 80 * 12
        holes = 4 * math.pi * 5**2 * 12
        boss = math.pi * 15**2 * 8
        bore = math.pi * 5**2 * 20
        self.assertAlmostEqual(plan.features[-1].expected_volume_after, base - holes + boss - bore, places=8)


if __name__ == "__main__":
    unittest.main()
