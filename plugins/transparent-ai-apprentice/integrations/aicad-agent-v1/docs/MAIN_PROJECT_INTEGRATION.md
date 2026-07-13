# Main project integration

Use the existing main-project route; do not add a parallel workflow:

`packaging-design-apprentice` → `transparent_ai_apprentice_aicad_packaging_handoff_v1` → strict adapter preflight → AICAD offline compile → optional host gate → `transparent_ai_apprentice_aicad_result_v1` → `record-cad-result` → teacher review.

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
