from __future__ import annotations

import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CASE_ROOT = (
    ROOT
    / "artifacts"
    / "packaging_teaching_session"
    / "case_01_transport_box"
    / "cad"
)
REDRAW_ROOT = CASE_ROOT / "aicad_agent_redraw"
CATALOG_PATH = CASE_ROOT / "object_catalog.json"
REPORT_PATH = REDRAW_ROOT / "geometry_validation.json"
DATUM = (35.0, 167.5)
TOLERANCE = 1e-6


def canonical_line(points: tuple[float, float, float, float]) -> tuple[tuple[float, float], tuple[float, float]]:
    start = (round(points[0], 6), round(points[1], 6))
    end = (round(points[2], 6), round(points[3], 6))
    return tuple(sorted((start, end)))  # type: ignore[return-value]


def read_aicad_lines(path: Path) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for raw_line in path.read_text(encoding="ascii").splitlines()[1:]:
        fields = raw_line.split("|")
        if fields[0] != "LINE":
            continue
        local = tuple(float(value) for value in fields[2:6])
        catalog = (
            local[0] + DATUM[0],
            local[1] + DATUM[1],
            local[2] + DATUM[0],
            local[3] + DATUM[1],
        )
        records.append({"id": fields[1], "local": local, "catalog": catalog})
    return records


def line_length(points: tuple[float, float, float, float]) -> float:
    return math.hypot(points[2] - points[0], points[3] - points[1])


def main() -> None:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8-sig"))
    expected = {
        str(item["id"]): tuple(float(value) for value in item["endpoints_mm"])
        for item in catalog["objects"]
        if item.get("category") == "edge"
    }
    expected_types = {
        str(item["id"]): str(item["line_type"]).upper()
        for item in catalog["objects"]
        if item.get("category") == "edge"
    }

    files = {
        "CUT": REDRAW_ROOT / "cut" / "case01_fefco0201_cut.aicad",
        "CREASE": REDRAW_ROOT / "crease" / "case01_fefco0201_crease.aicad",
        "SLOT": REDRAW_ROOT / "slot" / "case01_fefco0201_slot.aicad",
    }
    records = {layer: read_aicad_lines(path) for layer, path in files.items()}

    actual_by_id: dict[str, tuple[float, float, float, float]] = {}
    split_e24: list[tuple[float, float, float, float]] = []
    duplicate_ids: list[str] = []
    layer_mismatches: list[str] = []
    for layer, layer_records in records.items():
        for record in layer_records:
            entity_id = str(record["id"])
            points = record["catalog"]
            assert isinstance(points, tuple)
            if entity_id in {"E24A", "E24B"}:
                split_e24.append(points)
                continue
            if entity_id in actual_by_id:
                duplicate_ids.append(entity_id)
            actual_by_id[entity_id] = points
            if expected_types.get(entity_id) != layer:
                layer_mismatches.append(entity_id)

    if len(split_e24) == 2:
        endpoints = [
            (segment[0], segment[1]) for segment in split_e24
        ] + [
            (segment[2], segment[3]) for segment in split_e24
        ]
        counts = {point: endpoints.count(point) for point in set(endpoints)}
        outer = sorted(point for point, count in counts.items() if count == 1)
        if len(outer) == 2:
            actual_by_id["E24"] = (outer[0][0], outer[0][1], outer[1][0], outer[1][1])

    missing = sorted(set(expected) - set(actual_by_id))
    unexpected = sorted(set(actual_by_id) - set(expected))
    geometry_mismatches: list[dict[str, object]] = []
    for entity_id in sorted(set(expected) & set(actual_by_id)):
        expected_line = canonical_line(expected[entity_id])
        actual_line = canonical_line(actual_by_id[entity_id])
        if expected_line != actual_line:
            geometry_mismatches.append(
                {
                    "id": entity_id,
                    "expected": expected[entity_id],
                    "actual": actual_by_id[entity_id],
                }
            )

    all_local = [record["local"] for layer_records in records.values() for record in layer_records]
    xs = [point for item in all_local for point in (item[0], item[2])]  # type: ignore[index]
    ys = [point for item in all_local for point in (item[1], item[3])]  # type: ignore[index]
    bounds = [min(xs), min(ys), max(xs), max(ys)]
    size = [bounds[2] - bounds[0], bounds[3] - bounds[1]]
    entity_counts = {layer: len(layer_records) for layer, layer_records in records.items()}

    manifests: dict[str, dict[str, object]] = {}
    manifest_errors: list[str] = []
    for layer, artifact_path in files.items():
        manifest_path = artifact_path.with_suffix(".manifest.json")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
        manifests[layer] = {
            "path": str(manifest_path),
            "entity_count": manifest.get("entity_count"),
            "source_hash": manifest.get("source_sha256"),
        }
        if manifest.get("entity_count") != entity_counts[layer]:
            manifest_errors.append(layer)

    ok = not any(
        (
            duplicate_ids,
            layer_mismatches,
            missing,
            unexpected,
            geometry_mismatches,
            manifest_errors,
        )
    ) and all(abs(a - b) <= TOLERANCE for a, b in zip(size, (1575.0, 597.0)))

    report = {
        "schema": "case01_aicad_geometry_validation_v1",
        "status": "ok" if ok else "failed",
        "source_catalog": str(CATALOG_PATH),
        "datum_translation_mm": list(DATUM),
        "expected_catalog_edges": len(expected),
        "plugin_entity_counts": entity_counts,
        "logical_catalog_edges_reconstructed": len(actual_by_id),
        "local_bounds_mm": bounds,
        "blank_size_mm": size,
        "e24_split_for_origin_invariant": len(split_e24) == 2,
        "duplicate_ids": duplicate_ids,
        "layer_mismatches": layer_mismatches,
        "missing_ids": missing,
        "unexpected_ids": unexpected,
        "geometry_mismatches": geometry_mismatches,
        "manifest_errors": manifest_errors,
        "manifests": manifests,
        "max_logical_edge_length_mm": max(line_length(line) for line in actual_by_id.values()),
        "review_only_locks": {
            "reviewOnly": True,
            "accepted": False,
            "ruleEnabled": False,
            "packagingGated": True,
        },
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if not ok:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
