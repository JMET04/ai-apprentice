# Exact copy and merge checklist

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
