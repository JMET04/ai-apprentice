from __future__ import annotations

import json
import math
from collections import defaultdict
from pathlib import Path


WORKSPACE = Path(__file__).resolve().parents[1]
CATALOG_PATH = WORKSPACE / "artifacts" / "packaging_teaching_session" / "case_01_transport_box" / "cad" / "object_catalog.json"
OUTPUT_DIR = WORKSPACE / "artifacts" / "packaging_teaching_session" / "case_01_transport_box" / "cad" / "aicad_agent_redraw"

# This shared datum is a real structural junction present in CUT, CREASE, and SLOT geometry.
ABSOLUTE_DATUM = (35.0, 167.5)
LAYER_TYPES = {"CUT": "cut", "CREASE": "crease", "SLOT": "slot"}


def clean_number(value: float) -> float:
    rounded = round(float(value), 9)
    return 0.0 if abs(rounded) < 1e-9 else rounded


def point_key(point: tuple[float, float]) -> tuple[float, float]:
    return clean_number(point[0]), clean_number(point[1])


def local_point(point: tuple[float, float]) -> tuple[float, float]:
    return point_key((point[0] - ABSOLUTE_DATUM[0], point[1] - ABSOLUTE_DATUM[1]))


def edge_points(edge: dict) -> tuple[tuple[float, float], tuple[float, float]]:
    x1, y1, x2, y2 = edge["endpoints_mm"]
    return (float(x1), float(y1)), (float(x2), float(y2))


def prepare_edges(catalog: dict) -> dict[str, list[dict]]:
    groups: dict[str, list[dict]] = defaultdict(list)
    for item in catalog["objects"]:
        if item.get("category") != "edge":
            continue
        line_type = item.get("line_type")
        if line_type not in LAYER_TYPES.values():
            continue
        edge = dict(item)
        if edge["id"] == "E24":
            # Split the relief at the shared datum so every layer starts from the same origin.
            edge_a = dict(edge, id="E24A", label=edge["label"] + "（左半）", endpoints_mm=[35.0, 167.5, 30.0, 167.5])
            edge_b = dict(edge, id="E24B", label=edge["label"] + "（右半）", endpoints_mm=[35.0, 167.5, 40.0, 167.5])
            groups[line_type].extend([edge_a, edge_b])
        else:
            groups[line_type].append(edge)
    return groups


def orient_first_edge(edges: list[dict], line_type: str) -> list[dict]:
    ordered = sorted(edges, key=lambda item: item["id"])
    for index, edge in enumerate(ordered):
        start, end = edge_points(edge)
        if point_key(start) == point_key(ABSOLUTE_DATUM):
            return [edge, *ordered[:index], *ordered[index + 1 :]]
        if point_key(end) == point_key(ABSOLUTE_DATUM):
            reversed_edge = dict(edge, endpoints_mm=[end[0], end[1], start[0], start[1]])
            return [reversed_edge, *ordered[:index], *ordered[index + 1 :]]
    raise ValueError(f"{line_type} has no entity anchored at shared datum {ABSOLUTE_DATUM}")


def make_anchor(point: tuple[float, float], known: dict[tuple[float, float], str]) -> tuple[dict, dict]:
    key = point_key(point)
    reference = known.get(key)
    if reference:
        return {"ref": reference}, {"kind": "start_coincident", "target": reference}
    return (
        {"point": [key[0], key[1]]},
        {"kind": "start_offset", "target": "origin", "dx": key[0], "dy": key[1]},
    )


def build_plan(layer: str, line_type: str, edges: list[dict]) -> dict:
    known_points: dict[tuple[float, float], str] = {}
    steps: list[dict] = []
    for index, edge in enumerate(orient_first_edge(edges, line_type)):
        absolute_start, absolute_end = edge_points(edge)
        start = local_point(absolute_start)
        end = local_point(absolute_end)
        if index == 0:
            if start != (0.0, 0.0):
                raise ValueError(f"First {layer} entity does not start at origin: {edge['id']} {start}")
            start_anchor = {"ref": "origin"}
            start_constraint = {"kind": "start_coincident", "target": "origin"}
        else:
            start_anchor, start_constraint = make_anchor(start, known_points)

        end_reference = known_points.get(point_key(end))
        target_anchor = {"ref": end_reference} if end_reference else {"point": [end[0], end[1]]}
        dx = end[0] - start[0]
        dy = end[1] - start[1]
        length = clean_number(math.hypot(dx, dy))
        if length <= 0:
            raise ValueError(f"Zero-length edge: {edge['id']}")

        constraints = [start_constraint]
        if abs(dy) < 1e-9:
            constraints.append({"kind": "horizontal"})
        elif abs(dx) < 1e-9:
            constraints.append({"kind": "vertical"})
        constraints.append({"kind": "length", "value": length})
        if end_reference:
            constraints.append({"kind": "end_coincident", "target": end_reference})

        steps.append(
            {
                "id": edge["id"],
                "type": "line",
                "purpose": f"{layer} | {edge['label']}",
                "reasoning": (
                    f"Reconstructs catalog edge {edge['id']} from the validated FEFCO 0201 object catalog; "
                    f"absolute endpoints are {absolute_start} to {absolute_end} mm and share datum {ABSOLUTE_DATUM}."
                ),
                "start": start_anchor,
                "construction": {"kind": "to_point", "target": target_anchor},
                "constraints": constraints,
            }
        )
        known_points.setdefault(point_key(start), f"{edge['id']}.start")
        known_points.setdefault(point_key(end), f"{edge['id']}.end")

    return {
        "schema_version": "2.0",
        "drawing": {
            "name": f"case01_fefco0201_{layer.lower()}",
            "units": "mm",
            "origin": [0, 0],
            "tolerance": 0.000001,
        },
        "steps": steps,
    }


def main() -> None:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    groups = prepare_edges(catalog)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    summary = {
        "schema": "case01_aicad_layer_plan_set_v1",
        "source_catalog": str(CATALOG_PATH),
        "source_catalog_schema": catalog["schema"],
        "units": "mm",
        "absolute_datum_mm": list(ABSOLUTE_DATUM),
        "coordinate_mapping": "aicad_xy = catalog_xy - [35.0, 167.5]",
        "blank_bbox_aicad_mm": [-35.0, -167.5, 1540.0, 429.5],
        "blank_size_mm": [1575.0, 597.0],
        "layers": {},
        "review_boundary": "Constraint redraw reproduces structural CUT/CREASE/SLOT geometry; production text, dimensions, and glue graphics remain in the companion production DXF.",
    }
    for layer, line_type in LAYER_TYPES.items():
        plan = build_plan(layer, line_type, groups[line_type])
        path = OUTPUT_DIR / f"case01_fefco0201_{layer.lower()}.plan.json"
        path.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        summary["layers"][layer] = {"plan": str(path), "entity_count": len(plan["steps"])}

    summary_path = OUTPUT_DIR / "case01_fefco0201_plan_set.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
