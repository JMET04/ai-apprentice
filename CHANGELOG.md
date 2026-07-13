# Changelog

All notable changes to AI Apprentice are documented here.

## 1.0.0 - 2026-07-12

### Added

- Branded the product as AI 学徒 with a Chinese-first plugin surface.
- Added an eight-stage packaging workflow from requirements clarification to final teacher review.
- Integrated the source-thread Image2 prompt optimizer as a packaged skill, deterministic first-generation guidance compiler, optional local-library search, schema, and smoke test.
- Integrated the source-thread natural communication behavior as a packaged skill, context-aware guidance compiler, style checker, schema, regression suite, and advanced MCP tools.
- Made packaging plan recording automatically compile prompt guidance and made first-sample recording fail closed when guidance is missing, blocked, or unsafe.
- Added Image2 sample self-check requirements for dimensions, topology, conflicts, closure, manufacturability, and labels.
- Added the responsive AI Apprentice mask workbench with five annotation tools, history, drafts, playback, touch support, and structured exports.
- Restored the original engineering-image mask workbench unchanged and added separate Office-text and engineering-software mask workbenches with independent MCP tools, assets, result formats, and regression tests.
- Added native DOCX paragraph and XLSX cell point edits with source preservation, exact text matching, OOXML part hashing, and target-scoped review reports.
- Added durable mask-correction submission, idempotent task storage, teacher review, retry, result recording, and status replay.
- Added the first executable engineering adapter: reviewed AICAD dimension corrections now produce native AICAD, AutoCAD script, DXF, audit, manifest, hashes, and an exact rollback copy.
- Added a persistent multi-round learning experiment proving that only teacher-approved rules affect later runs and that disabled rules stop applying.
- Extended Word and Excel point edits to cover cross-run text, table paragraphs, merged cells, rich shared strings, comments, formulas, and protected non-target content.
- Added a 29-case real-artifact failure matrix and formal cold-start, page-load, large-file, concurrency, long-sequence, memory, and AICAD performance benchmarks.
- Moved test and package temporary files to the workspace disk by default.
- Added context-aware learned-rule conflict decisions with selected/suppressed rules and visible problem markers.
- Integrated the full AICAD 1.2.0 plugin, strict request/result schemas, manifest verification, and offline adapter.
- Added GitHub CI, release packaging, contribution, security, architecture, and manual test documentation.

### Changed

- Renamed the user-facing product to AI 学徒 / AI Apprentice while preserving protocol identifiers for compatibility.
- Reduced the default MCP surface to 7 teacher-facing tools and the advanced task surface to 30 tools; the full legacy maintenance surface is now explicit opt-in.
- Moved the oversized TLCL compatibility catalog out of the public README into a maintainer-only internal document.

### Safety

- Image2 pixels are explicitly forbidden as engineering dimension truth.
- RAG remains provenance-carrying evidence only.
- Corrections create disabled rule drafts and cannot unlock technology acceptance or packaging production.
- Natural voice cannot claim human biography, exclusive understanding, emotional dependency, or permission to bypass evidence and review gates.
- CAD outputs remain engineering candidates until real host and human review.

### Verification

- Plugin integrity: 363 checks.
- Human communication regression: 36 checks.
- Image2 prompt optimizer: 18 checks.
- Packaging workflow: 29 checks, including prompt-packet tamper rejection.
- Original engineering-image mask browser: 7 checks; independent Office and engineering-software workbenches: 8 checks; real submission browser: 10 checks; MCP three-tier surface: 14 checks.
- Durable mask service: 13 checks; multi-round learning convergence: 12 checks; surgical Office text editing: 20 checks.
- Learned rule conflict resolution: 7 checks.
- AICAD: 6 integration checks, 10 existing adapter checks, 14 object-edit adapter checks, and 87 manifest hashes.
- Real-artifact failure matrix: 29 checks; product performance baseline: 8 checks.
