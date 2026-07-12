# Source and release audit

- Rebuild decision: **1.2.0**. Release 1.1.0 is not complete because it omitted current packaging rules/QA/tests, the AutoCAD bundle, full source/docs and integration contracts.
- Source version drift found: plugin/MCP 1.1.0; Python package/CLI/AutoCAD bundle 1.0.0. The handoff copy is unified to 1.2.0.
- Latest packaging registry contains PKG-G001 through PKG-G021. The packaged QA is parameterized and no longer contains case01 dimension constants.
- The prior packaging test depended on `jobs/`; this build contains a sanitized self-contained fixture.
- SolidWorks SDK path contained a machine-specific default; it is replaced by `$(ProgramFiles)`/MSBuild override.
- Proprietary SolidWorks interop DLLs are excluded pending redistribution-right confirmation.
- Core upstream tests were previously observed at 28/28 pass; this handoff performs fresh packaged tests and records them under `validation/`.

This audit is engineering evidence only, not production or technical acceptance.
