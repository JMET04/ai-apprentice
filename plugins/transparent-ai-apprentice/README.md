# Transparent AI Apprentice Codex Plugin

This is an Agent plugin, not a standalone AI product or standalone web app. It attaches teachable, traceable capabilities to the Agent that installed it. The host Agent owns reasoning, model access, tool choice, and conversation state; the plugin bundles MCP tools, skills, host bridges, deterministic adapters, and review records. It does not bundle a model, ask for an LLM API key, or start its own model API.

The Word/CAD desktop companion follows the same boundary. It only captures a native host selection, collects the teacher's instruction, and hands that structured context to the connected Agent. It never reasons, generates content, or executes screen control by itself.

The plugin helps a human teach the connected Agent through a direct teaching loop:

Human demonstrates -> Codex executes -> human corrects -> plugin extracts rule drafts -> human reviews -> future runs use reviewed memory.

The plugin keeps private chain-of-thought hidden. It exposes only public structured traces: steps, observed inputs, proposed action, rule candidates, confidence, validation, and human review points.

## Natural Human Communication

The packaged `warm-human-communication` skill applies to clarification, correction, failure, progress, technical, emotional, and casual replies. It answers the user's latest point first, keeps technical truth and review boundaries visible, and avoids customer-service scripts, process narration, generic comfort, sycophancy, false human biography, and emotional dependency.

```bash
node plugins/transparent-ai-apprentice/scripts/compile-human-communication-guidance.mjs --message "你怎么又理解错了" --context auto
node plugins/transparent-ai-apprentice/scripts/check-human-communication-style.mjs --text "draft reply" --context correction
npm run smoke:human-communication
```

The compiler emits response guidance rather than a canned final answer. The style checker is context-aware, so concise technical status language remains valid while the same changelog language can be flagged in a correction or emotional moment. Both are exposed in advanced MCP mode as `compile_human_communication_guidance` and `check_human_communication_style`.

## Separate Image, Office Text, And Engineering Software Masks

The original `create_transparent_sketch_overlay_kit` and `assets/mask-workbench` remain the restored engineering-image overlay. They do not contain a text/image/engineering switch. Office text uses the standalone `create_office_text_mask_workbench` plus `assets/text-mask-workbench`; engineering software uses `create_engineering_software_mask_workbench` plus `assets/engineering-software-mask-workbench`. The dedicated pages have different result formats and do not show each other's fields.

The two new workbenches still separate `change`, `protect`, and `reference` marks. Their `mingtu_surgical_edit_contract_v1` changes only selected targets, preserves every unmarked region, requires before/after comparison outside the mask, and blocks whole-artifact regeneration for a local issue unless the teacher chooses a separate regeneration candidate.

Text masks are not treated as image OCR. A Word edit binds to `paragraph:N`; an Excel edit binds to `SheetName!A1`. `surgical-office-text-edit.py` writes a separate DOCX/XLSX, requires one exact source-text match, never overwrites the source, and hashes every package part to prove only `word/document.xml` or the selected worksheet XML changed. The report narrows any visual spot check to the changed paragraph or cell instead of asking the user to reread the whole file.

The native Office adapter also supports `table:N/row:N/cell:N/paragraph:N`, Word replacements across rich-text runs, Excel merged-range anchors, and localized Excel shared rich text. It preserves comments, styles, formulas, and unselected package parts byte-for-byte. Formula cells and merged non-anchor cells fail closed.

`mask-correction-service.mjs` turns both new workbench submit buttons into durable tasks with packet hashes, teacher review, retries, result recording, and event replay. Browser submission failures enter a local retry queue and never claim success. The unified MCP entry is `manage_mask_correction`.

`aicad-object-mask-adapter.mjs` is the first native engineering-object adapter. After teacher review, it changes only the selected AICAD plan object, compiles AICAD/SCR/DXF artifacts, proves protected object hashes are unchanged, stores an exact rollback point, and returns the result to the correction task for teacher verification.

```bash
npm run demo:engineering-mask
npm run demo:office-text-mask
npm run smoke:mask-workbench
npm run smoke:independent-masks
npm run smoke:office-surgical-edit
npm run smoke:rule-conflicts
npm run smoke:mask-correction-service
npm run smoke:mask-submission-browser
npm run smoke:aicad-object-mask-adapter
npm run smoke:multiround-learning
npm run smoke:product-failure-matrix
npm run benchmark:product
```

Apparent learned-rule conflicts are handled through `resolve_learned_rule_conflicts`: current context, scope specificity, teacher-confirmed exceptions, evidence, confidence, priority, and risk are compared. The result records selected and suppressed rules plus a visible `apparent_rule_conflict` marker; underlying memory is never silently mutated or dropped.

## Image2 First-Generation Prompt Optimizer

The packaged `image2-prompt-optimizer` skill runs before a first Image2 generation. It routes to existing capabilities, separates confirmed facts from assumptions, compiles `mingtu_image2_initial_prompt_guidance_v1`, and blocks packaging generation when product type or authoritative dimensions are missing.

```bash
node plugins/transparent-ai-apprentice/scripts/compile-image2-initial-prompt.mjs --input request.json --output prompt-guidance.json
npm run smoke:image2-prompt-optimizer
```

The optional `IMAGE2_PROMPT_LIBRARY` can search the local 125,399-entry catalog for patterns. The large external database is not bundled and is never required: the plugin includes a deterministic fallback compiler and its own first-generation contract. Prompt retrieval is evidence only and cannot approve dimensions, skip teacher review, enable rules, or unlock packaging.

## Maintainer Health Index

Start plugin maintenance with the health index before adding another route or smoke script:

```bash
npm run build:plugin-health-index
npm run smoke:plugin-health-index
npm run smoke:plugin-tool-surface
npm run smoke:plugin-manual-test-readiness
npm run smoke:plugin-manual-test-session-packet
```

The index writes `plugins/transparent-ai-apprentice/artifacts/plugin-health-index/plugin-health-index.json` and `.md`. It summarizes the manifest, MCP surface, skill file, script counts, package command contract, fast maintainer routes, and unregistered root smoke files. `smoke:plugin-tool-surface` is the fast MCP handoff gate; use `npm run smoke:plugin-tool-surface:full` only for deep MCP regression. `smoke:plugin-manual-test-readiness` writes a human testing handoff pack with scenario commands, pass criteria, and stop conditions. `smoke:plugin-manual-test-session-packet` verifies the one-pass tester packet that bundles the readiness guide, fillable result receipt, and validation return command. These routes are review-only artifacts: they do not invoke models, execute target software, write memory, enable rules, unlock packaging, claim product acceptance, or claim completion.

## Manual Test Readiness

Run:

```bash
npm run build:plugin-manual-test-readiness
npm run smoke:plugin-manual-test-readiness
npm run build:plugin-manual-test-result-receipt-template
npm run smoke:plugin-manual-test-result-receipt
npm run build:plugin-manual-test-session-packet
npm run smoke:plugin-manual-test-session-packet
```

The pack writes `plugins/transparent-ai-apprentice/artifacts/manual-test-readiness/MANUAL_TEST_READINESS_START_HERE.md`, JSON, and HTML. It organizes the first human manual test pass across install/tool surface, first teaching entry, visual demonstration, correction/profile memory, TLCL safety, and real-case pilot intake. It is not product acceptance; every scenario keeps review-only, no execution, no memory write, no rule enablement, no packaging unlock, and no completion-claim boundaries explicit.

After a tester runs the scenarios, generate a result receipt template and validate the filled receipt before follow-up planning. The validation produces a blocker/follow-up queue while still blocking product acceptance, rule enablement, memory writes, target software execution, packaging unlock, and completion claims.

For an actual tester handoff, prefer the session packet. It writes `plugins/transparent-ai-apprentice/artifacts/manual-test-session/MANUAL_TEST_SESSION_START_HERE.md`, JSON, HTML, a nested readiness pack, and `manual-test-result-receipt-to-fill.json`. Advanced MCP exposes this as `create_plugin_manual_test_session_packet`. The packet is a testing workbench only; it does not accept the product, run target software, write memory, enable rules, unlock packaging, or claim completion.

## Internal TLCL Maintenance

The Teachable Logic Contract Layer (TLCL) remains the internal safety and evidence architecture. It converts reviewed teaching into bounded Rule Cards, validators, reports, execution gates, and audit trails. It is not a user-facing maze and it does not grant automatic authority.

The public tool surfaces are intentionally bounded:

- Default teacher-facing mode: 7 tools.
- Advanced task mode: 30 tools via `TRANSPARENT_AI_APPRENTICE_TOOL_MODE=advanced`.
- Full maintainer mode: all compatibility and deep TLCL routes via `TRANSPARENT_AI_APPRENTICE_TOOL_MODE=full`.

Deep TLCL builders and receipt validators remain available for compatibility and audits, but they are internal routes behind task-oriented entry points. Product work should begin with teaching, correction, mask task management, packaging workflow, Office editing, AICAD execution, health checks, or manual-test packets.

The maintained contract chain is:

```text
Artifact Envelope -> Rule Card -> Validator -> Validation Report -> Reviewed Execution Gate -> Audit Trail
```

See `TLCL_OVERALL_DIRECTION.md` and `FULL_TARGET_DIRECTION_AND_TASK_LIST.md` for deep-maintainer references.

## Native host selection plugin

This is an Agent plugin, not a standalone AI runtime. manage_native_selection ingests exact Word ranges and AutoCAD/AICAD entity or subentity paths, creates a self-contained review workbench, and submits bounded changes to the existing teacher-review chain. Explicitly reviewed changes can be applied through separate Word COM and AutoCAD managed execution routes; both revalidate the captured target, leave the host document open and unsaved, and return a result pending teacher verification. The host Agent owns reasoning and tool use; no separate model API, API key, account, or desktop model process is required.

The desktop companion is capture-and-handoff UI only. It records incremental teacher opinions with teacherInstructionRevision and teacherInstructionHistory, keeps background preparation enabled by default, and records screen control as explicit_opt_in only when the teacher enables it for that revision.

npm run smoke:native-selection-agent-plugin
npm run smoke:word-native-selection-live
npm run smoke:aicad-managed-selection-bridge
npm run smoke:native-selection-workbench-v2

真实 AutoCAD 2025 数据层烟测：npm run smoke:aicad-managed-runtime。该命令验证 Core Console 中的 LINE 实体、句柄定位、几何快照、从 100 到 450 的真实线长事务，以及 3DSOLID 指定面的原生偏移事务；桌面 COM 调度、右键菜单与 Ctrl 子对象捕获仍按人工测试手册复核。
