---
name: teachable-apprentice
description: Use when the user wants to train a Codex-powered AI assistant through direct demonstration, correction, examples, visual evidence, execution history, or reusable rule memory. This is the core Transparent AI Apprentice workflow.
---

# Teachable Apprentice

## Purpose

Use this skill to help a human teach an AI assistant like training a new apprentice. Do not treat the session as a generic chatbot exchange or a cold automation builder.

The loop is:

1. Capture what the teacher is trying to teach.
2. Ask for or inspect a direct demonstration: text, files, screenshots, commands, UI steps, examples, or corrections.
3. Execute or simulate the task in a small, reviewable way.
4. Show a public structured trace, never private chain-of-thought.
5. Ask the teacher what is wrong, missing, or overgeneralized.
6. Convert feedback into rule-memory drafts with conditions and counterexamples.
7. Keep new rules disabled until the teacher explicitly accepts or enables them.
8. Re-run or replay the task with the reviewed memory to prove improvement.

## Human Communication Contract

Apply the bundled `warm-human-communication` skill to every user-facing reply. Answer the teacher's exact last sentence first, then give the useful action, evidence, or smallest necessary question. Keep technical structure when it helps scanning, but do not turn corrections, frustration, failures, or tone feedback into customer-service scripts, changelogs, or therapy-style intake language.

For substantial, ambiguous, emotionally loaded, or tone-repair replies, use `compile_human_communication_guidance` or `scripts/compile-human-communication-guidance.mjs` before drafting. Use `check_human_communication_style` or `scripts/check-human-communication-style.mjs` before sending sensitive or tone-repair copy. A teacher correction should sound like a real acknowledgement of the exact miss and immediately change the next action; do not reply with "已同步规则如下".

Natural voice must never weaken truth or safety. Do not invent human biography, claim exclusive understanding, encourage emotional dependency, manipulate the teacher, or use closeness to bypass evidence, review, memory, execution, or packaging gates.

## Feasibility-First Tool Reuse

During early development, optimize for proving that teach-by-demonstration works. Reuse existing tools whenever practical instead of building custom software first.

Preferred demonstration surfaces:

- Existing drawing, whiteboard, or diagram-as-code tools for visual teaching, such as draw.io, Excalidraw, Mermaid, Figma, PowerPoint, screenshots, or any local CAD/diagram app the user already uses.
- Existing browser/system voice tools for voice teaching, such as Web Speech API `SpeechRecognition`/`webkitSpeechRecognition`, `speechSynthesis`, and a manual transcript textarea fallback.
- Voice/text engineering software control for non-experts: reuse the existing voice workbench, numbered target confirmation, spatial target bridge, and execution approval gate. The apprentice must restate the understood command, mark possible target positions with numbers, wait for one confirmed number, create/confirm a rollback point, and only then prepare a dry-run-first execution route.
- Logic-backed software execution: do not let a prepared software action be "close enough" because it visually resembles the teacher's intent. Every consequential action detail must have a reviewed logic source before execution: target software, adapter/route, target number or route-only assertion, command/input payload, order/timing, expected outcome, preflight, rollback, and verifier. If any detail lacks a source from data, a confirmed target, a reviewed API/CLI/file/browser/macro route, a control-channel profile, a teacher rule, or an outcome verifier, route it to teacher review with `missingLogicSourceBehavior=block_execute_and_route_to_teacher_review`; do not execute, enable memory, or claim native control.
- Parametric/universal detail logic learning: when the teacher provides a CAD/engineering drawing, model, sketch, diagram, or software output artifact and wants a similar result generated from new data, do not copy surface appearance first. The objective is to make every important detail rigorous from logic, not to generate something that merely looks similar. Lines and angles are only examples: use `create_parametric_drawing_logic_learning_kit` to bind every consequential output detail to teacher-reviewed data fields, variables, formulas, constraints, exceptions, and corrections. This includes lengths, angles, radii, hole counts, spacing, offsets, symmetry, alignment, proportions, tolerances, annotations, view/depth relations, perspective intent, relative placement, coordinate frames, datums, axes, topology, order, connectivity, software output states/properties, material/process rules, semantic labels, and design rules. The kit must emit a `transparent_ai_universal_detail_logic_contract_v1`: every consequential visible, geometric, spatial, semantic, material, process, software-state, or validation detail must be classified as data/formula/constraint-backed, teacher exception/design rule, decorative/non-parametric, or missing evidence that blocks generation. It must also emit a logic completeness gate and detail transfer validation matrix: every transferred detail must define how it is recomputed or re-evaluated on new data, what failure looks like, and why visual similarity is only a secondary review signal after logic validation. Any detail without a logic source must be marked as missing evidence, decorative, or non-parametric before generation or target-software action. The kit must produce a dry-run generation/action plan only; it must not execute CAD or target software, write memory, accept rules, or claim the detail logic is mastered before teacher review.
  Ordinary `teach_apprentice` must route natural requests about CAD/drawing/model/output logic, new data, rigorous details, formulas, constraints, or "not just looking similar" to this kit before work-along observation, because voice or software observation is only an input method while universal detail logic is the learning target.
- Transparent sketch detail logic: when a teacher draws on the transparent overlay, treat strokes as evidence that must be made rigorous, not as a drawing to imitate. `create_transparent_sketch_overlay_kit` and `interpret_transparent_sketch_spatial_intent` must preserve a `transparent_ai_universal_detail_logic_contract_v1` for position, alignment, angle/direction, curvature, spacing/count, perspective, 3D depth, semantic labels, tolerances, material/process hints, and teacher exceptions. If a sketch detail only looks similar but cannot be tied to data, formula, constraint, teacher-confirmed target, reviewed spatial relationship, explicit non-parametric/decorative classification, or teacher exception, set `missingLogicSourceBehavior=block_execute_and_route_to_teacher_review` and do not execute software, enable memory, or claim the system understood the detail.
- Visual engineering target confirmation: when a low-token trigger or teacher review produced one screenshot/visual evidence file, use `create_visual_engineering_target_confirmation_kit` to place numbered candidate targets over that actual image before `confirm_engineering_command_target`. This bridges real software visual context into the existing one-number confirmation and dry-run route without taking more screenshots or executing software.
- Low-token work-along observation for desktop/domain software: watch logs and lightweight state changes first, then capture screenshots only on meaningful triggers instead of streaming continuous video into the model.
- Event-triggered low-token observation policy: when the teacher says continuous recording wastes tokens or asks to look only after logs/state change, first use the existing `create_low_token_trigger_budget_plan`, then create `create_event_triggered_low_token_observation_policy`. The policy must formalize the escalation ladder: metadata-only watch -> bounded tail or compact learning event -> teacher review -> at most one teacher-confirmed screenshot -> visual learning handoff -> separate execution gate. Then create/open `create-event-triggered-low-token-observation-policy-receipt-builder.mjs` so the teacher can generate a filled receipt from a browser page instead of hand-editing JSON. After the teacher downloads/fills the policy receipt, run `validate-event-triggered-low-token-observation-policy-receipt.mjs` before any visual check, lower-token replan, learning handoff, memory write, or execution route. The builder and validator may only emit browser JSON, a review-only follow-up queue, or a lower-token replan command template; they must keep continuous recording, full-log reads, screenshot capture, software execution, UI events, memory writes, rule enablement, native-universal-execution claims, packaging, and goal completion locked.
- Teacher learning method profiling before observation: infer whether this teacher prefers steps, examples, voice, overlay sketches, log deltas, fewer questions, or correction-first review.
- Teacher-reviewed automatic observation scheduling: prepare a Windows Scheduled Task package that periodically runs bounded low-token supervisor passes from a reviewed queue, without registering it by default.
- Teacher-confirmed recurring monitor registration runner: after `create_all_software_recurring_monitor_approval_gate` is ready, use `run_all_software_recurring_monitor_registration_runner` to create a dry-run-first registration package with unregister handoff. It must still block actual Windows task registration unless the teacher explicitly confirms registration, a rollback point exists, and a system-change approval flag is present. After a passed activation dry-run rehearsal and a ready registration execute gate, use `run_all_software_operational_learning_registration_approved_runner` for the final supervised bridge: it consumes the ready gate, invokes only the existing registration runner under `--execute-approved-registration` plus `--allow-system-change`, then immediately runs the read-only registration status verifier. Treat the status verifier as authoritative; a command exit code is not proof of recurring learning. Once read-only status is `registered_and_matches_reviewed_runner`, use `run_all_software_operational_learning_post_registration_output_witness_runner` to trigger exactly one reviewed scheduled runner output and immediately chain run-output audit, teacher review, decision replay, and unattended audit before any operational claim.
- Read-only recurring monitor registration status verification: after a teacher-approved registration attempt, use `verify_all_software_recurring_monitor_registration_status` to check whether the Windows Scheduled Task is absent, matches the reviewed runner, or is mismatched. This verifier must never register, unregister, start, or stop the task.
- Read-only recurring monitor run-output auditing: after scheduled or manually launched automatic low-token runner outputs exist, use `audit_all_software_recurring_monitor_run_output` to scan runner journals into a teacher review queue. It must not launch the runner, change scheduled tasks, read full logs, capture screenshots, execute software, or write memory.
- Recurring monitor teacher review packet: after the run-output audit finds compact learning events, use `create_all_software_recurring_monitor_teacher_review_packet` to route each event to direct `teach_apprentice` review, a triggered visual-check request, or blocker review. It must adapt to the teacher method profile while still capturing no screenshots, writing no memory, executing no software, and changing no schedule.
- Recurring monitor review decision replay queue: after the teacher marks review items as `needs_teacher_review`, `blocked`, or `ready_for_follow_up`, use `create_all_software_recurring_monitor_review_decision_replay_queue` to replay those decisions into the next review-only queue. It must explicitly block `accepted` and keep rules, memory, screenshots, execution, runners, schedules, and packaging locked.
- All-software unattended learning audit: after schedule, approval, registration runner, registration status, run-output audit, teacher review packet, and replay evidence exist, use `create_all_software_unattended_learning_audit` before claiming recurring low-token learning is operational. The audit must report remaining gaps such as missing scheduled-task registration, missing recurring output, or missing teacher review; it must not register tasks, launch runners, capture screenshots, read full logs, execute software, write memory, enable rules, accept technology, or unlock packaging.
- All-software operational learning workbench: after readiness, schedule, recurring monitor, run-output, teacher review, replay, or unattended-audit evidence exists, use `create_all_software_operational_learning_workbench` to create one teacher-facing start-here guide and machine-readable evidence index. It must only organize safe commands and blockers; it must not register tasks, launch runners, start tasks, capture screenshots, read full logs, execute target software, write memory, enable rules, accept technology, or unlock packaging.
- All-software operational status console: when the teacher asks what currently works, asks for overall progress, resumes from saturated context, or wants the next safest step, use `create_all_software_operational_status_console` before a narrative summary. It should scan existing `.transparent-apprentice` evidence or consume explicit paths for the operational workbench, post-activation witness, registration status, run-output audit, teacher review packet, replay queue, unattended audit, coverage convergence, execution convergence, and original-goal readiness. It must only write `transparent_ai_all_software_operational_status_console_v1`, a receipt, and `ALL_SOFTWARE_OPERATIONAL_STATUS_CONSOLE_START_HERE.md`; it must not register tasks, launch runners, capture screenshots, read full logs, execute target software, write memory, enable rules, accept technology, claim all-software completion, or unlock packaging.
- Original-goal current status refresh: when the teacher or next agent asks to refresh current progress for the full original objective, continue from current state, or get the next safe action after context saturation, prefer `create_original_goal_current_status_refresh`. It regenerates the original-goal readiness audit, all-software operational status console, original-goal gap action board, and optional goal command center in one handoff. It must remain review-only and must not register tasks, launch runners, execute wrappers or target software, capture screenshots, read full logs, write memory, enable rules, accept technology, claim original-goal completion, claim universal native execution, or unlock packaging.
- Original-goal integrated control flow: when the teacher asks for the overall framework, full logic, one control flow, or a discussion artifact that connects the original objective end to end, use `create_original_goal_integrated_control_flow` directly or rely on the current-status refresh output that now links it. It must connect all-software low-token observation, event-triggered visual evidence, learning handoff, voice/text numbered targets, transparent 2D/perspective/3D sketch rehearsal, execution approval, post-action evidence, and rollback as one review-only flow. It must not capture screenshots, read full logs, execute software, send UI events, write memory, register schedules, enable rules, accept technology, claim completion, or unlock packaging.
- All-software operational learning trial: when the teacher asks to prove the real local low-token learning chain can run, use `run_all_software_operational_learning_trial`. It reuses the readiness package, manually launches only the existing automatic low-token runner, audits the runner output, creates an unattended-boundary audit, and builds the operational workbench. It must not register or start scheduled tasks, start target software, capture screenshots, send UI events, read full logs, write memory, enable rules, accept technology, claim unattended completion, or unlock packaging.
- Conversation while the teacher demonstrates, including the teacher's explanation, the apprentice's attempt, and the teacher's correction.
- Existing browser or desktop workflows for UI demonstrations.
- Existing files, logs, command history, screen recordings, event logs, screenshots, and before/after examples.
- Existing domain tools for specialized work, such as CAD, spreadsheet, design, notebook, or editor software.

When using an external tool, capture the minimum durable evidence:

- tool name and file path or URL,
- demonstration artifact path,
- teacher message, apprentice attempt, and teacher correction when the lesson happened through conversation,
- first-use voice tone preference, transcript text, spoken confirmation text, and manual fallback status when the lesson happened through voice,
- work-along trigger reason, log tail delta, screenshot path when useful, teacher marker, short teacher question, and teacher answer when the lesson happened beside running software,
- teacher action summary,
- visible before/after state,
- extracted cues or constraints,
- public trace rows,
- disabled rule-memory drafts.

Do not promise native integration until it is proven. In feasibility mode, a screenshot, exported diagram, SVG, image, JSON event log, recording transcript, voice transcript packet, low-token work-along observation packet, or text transcript is enough if Codex can turn it into traceable rule drafts and replay behavior.

## Public Trace Contract

Every important action must show a public trace with these fields:

- `step`: short action name.
- `inputObserved`: what Codex observed from the teacher or workspace.
- `ruleCandidates`: remembered rules or drafts considered.
- `actionProposed`: what Codex proposes to do.
- `confidence`: low, medium, or high.
- `validation`: checks run and result.
- `teacherReviewPoint`: what the human should confirm or correct.
- `memoryEffect`: how prior teaching changed the result, or `none`.

Never expose private chain-of-thought. If reasoning is needed, summarize it as public steps, evidence, rules, confidence, and validation.

## Rule Draft Contract

When extracting reusable memory, produce draft rules with:

- `condition`: when the rule applies.
- `action`: what the apprentice should do.
- `counterexamples`: when the rule must not apply.
- `sourceEvidence`: demonstration, correction, file, run, or teacher quote.
- `confidence`: low, medium, or high.
- `enabled`: default `false`.
- `requiresTeacherConfirmation`: default `true`.
- `reviewStatus`: default `needs_teacher_review`.

Do not silently enable a new rule after one demonstration. Prefer conservative drafts and explicit teacher review.

## Working Style

When the teacher gives a demonstration, first restate the taught behavior in one sentence, then create a tiny replay. After replay, ask for correction only if the next useful action cannot be inferred.

When the teacher corrects Codex, treat the correction as valuable training data. Extract both a positive rule and a boundary/counterexample when possible.

When the teacher asks "why did you do that?", answer with public evidence: observed cues, selected rule, confidence, validation result, and review point.

## Local Session Packet

For a first-time or non-technical teacher, start with the single-entry teaching guide. It accepts a plain goal, existing files, teacher explanation, correction, or approval, then chooses the next safe step. It must not create product acceptance or unlock packaging.

MCP tool name for ordinary teachers:

```text
teach_apprentice
```

Compatible advanced tool name:

```text
continue_teaching
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/continue-teaching.mjs \
  --goal "What the teacher wants the apprentice to learn" \
  --tool "draw.io, Excalidraw, or Mermaid" \
  --step "<optional ordered teacher action>" \
  --before "<optional input example>" \
  --after "<optional expected example>" \
  --file "<optional evidence file>" \
  --teacher-message "<optional explanation>" \
  --correction "<optional plain correction>" \
  --teacher-approval "<optional explicit approval>" \
  --future-input "Optional replay example"
```

Use `teach_apprentice` as the ordinary-user default. It delegates to the same engine as `continue_teaching`, but the name and parameters should feel like teaching an apprentice rather than operating a workflow API. It should teach from ordered hands-on steps, pasted `stepsText`/`actionsText`/`demonstrationText`, normal `message` step narration, pasted browser/recorder/Jam-style screen events, whole `eventLog`/`screenEventLog`/`recordingEvents`/`traceEvents` exports, recorder/trace JSON pasted into a normal `message`, Jam/Playwright/recording links pasted into a normal `message`, one or more local screenshot/drawing/diagram/JSON/text file paths pasted into a normal `message`, before/after examples, whole `examples`/`trainingExamples`/`beforeAfterExamples` pairs, pasted `examplesText`/`examplesMarkdown`/`exampleText` blocks, Markdown/CSV/TSV tables with input/output columns, a pasted `transparent_ai_sketch_overlay_packet_v1`, a pasted `transparent_ai_teach_execute_action_rehearsal_v1`, a pasted `transparent_ai_software_capability_profile_v1` plus optional `transparent_ai_software_capability_probe_result_v1`, a teacher method/adaptation request, a software auto-discovery/log-discovery request, an all-software low-token learning-cycle request with a reviewed queue or reviewed inventory, an all-software coverage expansion plan request with inventory/audit/repair/runner evidence, an all-software coverage rollout batch request with a reviewed expansion plan, an automatic observer schedule request with a reviewed queue, a low-token work-along request, or a voice-teaching request without asking the teacher to write rules. It should generate an existing-tool visual template when no visual evidence exists, generate an existing browser voice kit when the teacher wants to teach by speech, generate a review-only teacher learning method profile when the teacher says how they prefer to teach or asks the apprentice to adapt, generate a software capability profile when the teacher asks to automatically discover logs or low-token observation sources for an unfamiliar app, run an all-software low-token learning cycle when the teacher provides a reviewed queue or reviewed inventory and asks to learn from changed log signals, generate an all-software coverage expansion plan when the teacher asks to widen bounded coverage across all local software in reviewed batches, run one all-software coverage rollout batch when the teacher asks to advance a reviewed expansion batch into runner state, generate a teacher-confirmed automatic observer schedule package when the teacher asks for recurring low-token observation from a reviewed queue, generate an adaptive universal observer setup when the teacher supplies profile/probe results, generate a low-token work-along kit when the teacher wants Codex to learn beside CAD/SolidWorks or other desktop software, generate a supervised dry-run action kit when the teacher pastes a transparent overlay packet, advance reviewed observation plus overlay into action rehearsal when the teacher confirms rehearsal, advance an action rehearsal into the supervised execution gate when the teacher explicitly confirms supervised execution, package multiple files before teaching, teach from a single artifact or teacher message, route plain corrections without asking for internal ids or session paths, classify a plain teacher response after replay, treat a generic `message` as active-lesson feedback when it looks like approval/save/correction and no new evidence is present, approve only the current session memory when the teacher explicitly approves a replay, and save approved memory to an apprentice profile only when the teacher explicitly asks Codex to remember or save it for later.

The plugin manifest and default MCP tool description should be ordinary-teacher friendly, Chinese-first, and action oriented. Starter prompts should make it obvious that a teacher can start by saying "教会助手", paste screenshots/draw.io/recordings/tables, or correct the latest result in plain Chinese. Do not make the first prompt feel like an API form.

`teach_apprentice` should return `transparent_ai_teach_apprentice_card_v1`, not a raw construction log. The card must summarize what happened, what the apprentice drafted, replay status, safe teacher replies, and locked gates. It must include `currentLesson.canContinueWithoutPath=true` and `currentLesson.sessionPathHidden=true` so the ordinary teacher can reply to the active lesson without copying an internal `.transparent-apprentice/sessions` path. When it creates an existing-tool visual starter kit, include `starterKit` paths for the teacher readme, draw.io, Excalidraw, Mermaid, manifest, and `openFirst` path. When it creates a voice kit, include `voiceKit` paths for the teacher readme, browser HTML, preference JSON, manifest, and `openFirst`, plus the first-use preference status. When it creates a teacher method profile, include `teacherMethodProfile` paths for the teacher readme, profile JSON, route JSON, inferred primary mode, next suggested tools, `fullContinuousRecording=false`, and `nativeUniversalExecution=false`. When it creates a software capability profile, include `softwareCapabilityProfile` paths for the teacher readme, profile JSON, read-only probe, observation plan, next observer arguments, teacher adaptation questions, `openFirst`, `defaultNextTool=create_universal_software_observer_kit`, `fullContinuousRecording=false`, and `nativeUniversalExecution=false`. When it creates a software control-channel read-only probe, include `softwareControlChannelProbe` paths for the teacher readme, probe plan, PowerShell probe script, result template, optional probe result, next profile request, discovered route counts, `fullContinuousRecording=false`, `screenshotsCaptured=false`, `softwareActionsExecuted=false`, and `nativeUniversalExecution=false`. When it runs an all-software low-token learning cycle, include `allSoftwareLearningCycle` paths for the readme, learning-cycle JSON, receipt, status, watch-cycle count, changed item count, compact learning event count, `softwareActionsExecuted=false`, `longTermMemoryWritten=false`, `fullContinuousRecording=false`, and `nativeUniversalExecution=false`. When it creates an adaptive observer bridge from a software profile/probe result, include `adaptiveObserverSetup` paths for the teacher readme, setup JSON, teach template, observer kit manifest, observer collector, selected log/event source counts, `defaultNextTool=create_universal_software_observer_kit`, `fullContinuousRecording=false`, and `nativeUniversalExecution=false`. When it creates a work-along kit, include `workalongKit` paths for the teacher readme, browser overlay, PowerShell collector, source map, observation policy, evidence template, manifest, and `openFirst`, plus the low-token strategy and `fullContinuousRecording=false`. When it creates an engineering voice/text command confirmation kit, include `engineeringCommandConfirmationKit` paths for the teacher readme, browser HTML, command intent, voice control workflow, target confirmation, overlay packet, manifest, candidate numbers, `nextConfirmationBridge=confirm_engineering_command_target`, `nextBridge=create_supervised_software_action_kit`, `softwareActionsExecuted=false`, and `nativeUniversalExecution=false`. When it creates an engineering voice-control workbench, include `engineeringVoiceControlWorkbench` paths for the teacher readme, workbench JSON, HTML, receipt template, session path, target confirmation, candidate numbers, `openFirst`, `nextConfirmationBridge=confirm_engineering_command_target`, `softwareActionsExecuted=false`, `targetSoftwareCommandsExecuted=false`, `uiEventsSent=false`, `screenshotsCaptured=false`, `memoryWritten=false`, and `nativeUniversalExecution=false`. The command kit and workbench must write reviewable target evidence, restate the understood operation, mark numbered possible targets, and block execution until the teacher confirms exactly one number. When the teacher confirms one engineering target number, include `engineeringCommandTargetConfirmation` paths for the teacher readme, receipt, narrowed single-target overlay packet, supervised action bridge request, optional supervised action kit, selected candidate number, `selectedTargetOnly=true`, `nextBridge=create_supervised_software_action_kit`, `softwareActionsExecuted=false`, and `nativeUniversalExecution=false`; the bridge request should preserve the source voice/text workflow and interpreted operation. When it creates a supervised action kit from an overlay packet, include `supervisedActionKit` paths for the teacher readme, action plan, spatial execution readiness, runner, policy, manifest, action count, action kinds, `defaultMode=dry_run`, `teacherConfirmationRequired=true`, `requiresActiveTargetWindow=true`, and `nativeUniversalExecution=false`. When it advances reviewed observation plus overlay into action rehearsal, include `teachExecuteActionRehearsal` paths for rehearsal JSON, dry-run receipt, action plan, spatial intent, spatial execution readiness, runner, preflight, existing adapter, and outcome verification. When it advances an action rehearsal into the supervised execution gate, include `teachExecuteSupervisedExecution` paths for execution gate JSON, receipt, runner receipt, preflight, outcome verification, `executeRequested`, `runnerReceiptStatus`, and `softwareActionsExecuted`; without execute mode this must remain a dry-run result. When the teacher provides a recording or trace link, include `teachingEvidence` with the source tool, recording URL, saved artifact path, event count, and a review-only note that the apprentice does not claim full private-video inspection unless extracted events, transcript, or connector evidence is supplied. When it saves approved memory, include `savedMemory` profile information without exposing internal memory ids. It must hide internal rule ids, trace ids, demonstration ids, and default session paths. Use advanced `continue_teaching` only when an agent needs the raw construction result.

The MCP server should keep the default `tools/list` teacher-facing: `teach_apprentice`, `show_teaching_card`, `run_apprentice_profile`, `review_apprentice_profile`, and `correct_last_result`. Use advanced/debug mode only for agents that need explicit lower-level tools by setting `TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS=1`. Do not ask an ordinary teacher to choose between internal construction tools.

## Learned-Work Mode

The apprentice should be able to learn and do in the same teaching loop, but only from approved memory. When the teacher says the next task is something the apprentice has learned before, for example "接下来是你以前学过的，用你学过的知识往下生成", route through approved apprentice profile memory instead of asking for a new demonstration. Use `run-apprentice-profile.mjs` or the `run_apprentice_profile` tool, create no new rule, and show a teacher-facing `learnedWork` result with the matched cues, outcome, and proposed action.

If no approved profile memory exists, say that the apprentice needs an approved saved memory first. Do not pretend the behavior is learned merely because the teacher says it is.

When the teacher says "好了到这", "先停", "stop here", or an equivalent stop command, stop immediately. Do not continue generation, do not approve memory, do not save profile memory, and do not create a new teaching artifact. Return a stopped card that makes it clear the teacher can resume later with a new task, a correction, or a learned-work request.

When the teacher wants voice interaction, do not build a new native voice app first. Create a browser/system voice kit:

```bash
node plugins/transparent-ai-apprentice/scripts/create-voice-teaching-kit.mjs \
  --goal "What the teacher wants the apprentice to learn through voice" \
  --locale "zh-CN" \
  --future-input "Optional future task to replay"
```

MCP tool name:

```text
create_voice_teaching_kit
```

The kit must use existing browser capabilities first: Web Speech API `SpeechRecognition` or `webkitSpeechRecognition` for dictation when available, `speechSynthesis` for spoken apprentice confirmations, and a manual transcript textarea as fallback. On first enable it must ask how the teacher prefers the apprentice to communicate, for example patient step-by-step, concise direct, warm encouraging, or expert pair programmer. The generated transcript packet should include the selected tone, transcript, assistant confirmation text, and `transparent_ai_voice_teaching_turn_v1` events so it can be pasted back into `teach_apprentice`. This is a feasibility wrapper, not a custom speech engine; it must keep `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

When a non-expert wants to control engineering software by speaking or typing a command, do not execute the command directly. Create an engineering command confirmation kit:

```bash
node plugins/transparent-ai-apprentice/scripts/create-engineering-command-confirmation-kit.mjs \
  --goal "What the user wants to do in the engineering software" \
  --software "Target engineering software" \
  --voice-transcript "Optional speech transcript" \
  --command "Optional typed command" \
  --candidate "target-id|visible target label|0.62|0.34|0.1|why this candidate might match"
```

MCP tool name:

```text
create_engineering_command_confirmation_kit
```

The kit must output `transparent_ai_engineering_voice_text_command_intent_v1`, `transparent_ai_engineering_voice_or_text_control_workflow_v1`, and `transparent_ai_numbered_target_confirmation_v1`: possible target locations get visible numbers, the teacher must confirm one number or correct the candidates, and only the confirmed single-target overlay from `confirm_engineering_command_target` may be passed to `create_supervised_software_action_kit`. This is a confirmation layer for voice/text commands, not autonomous engineering-software control; it must keep `softwareActionsExecuted=false`, `nativeUniversalExecution=false`, `fullContinuousRecording=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

When one reviewed screenshot or triggered visual capture already exists, prefer grounding the numbered candidates on that actual visual evidence:

```text
create_visual_engineering_target_confirmation_kit
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/create-visual-engineering-target-confirmation-kit.mjs \
  --goal "What the user wants to do in the engineering software" \
  --software "Target engineering software" \
  --command "Optional typed command" \
  --visual-evidence "reviewed-screenshot-or-image.png" \
  --candidate "visible target label|0.62|0.34|0.1|why this candidate might match"
```

This writes `transparent_ai_visual_engineering_target_confirmation_v1`, a local HTML page with the screenshot as backdrop, `transparent_ai_visual_engineering_command_intent_v1`, `transparent_ai_numbered_target_confirmation_v1`, and a `transparent_ai_sketch_overlay_packet_v1` with `reviewed_visual_evidence_numbered_target_confirmation`. The tool itself must keep `screenshotsCapturedByThisTool=false`, `softwareActionsExecuted=false`, `targetSoftwareCommandsExecuted=false`, `nativeUniversalExecution=false`, `accepted=false`, `ruleEnabled=false`, and `packagingGated=true`. After the teacher confirms one number, use the existing `confirm_engineering_command_target` bridge.

## Engineering Voice Control Session

When the teacher asks to package the whole non-expert engineering-software voice/text control flow, use:

```text
create_engineering_voice_control_session
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/create-engineering-voice-control-session.mjs \
  --goal "What the user wants to do in the engineering software" \
  --software "Target engineering software" \
  --voice-transcript "Optional speech transcript" \
  --command "Optional typed command" \
  --candidate "target-id|visible target label|0.62|0.34|0.1|why this candidate might match"
```

This is an orchestrator over existing abilities: `create_voice_teaching_kit`, `create_engineering_command_confirmation_kit`, `create_software_control_channel_probe`, `create_software_control_channel_profile`, `confirm_engineering_command_target`, and `start_teach_execute_supervised_execution`. It writes `transparent_ai_engineering_voice_control_session_v1` plus a start-here readme, target confirmation path, read-only probe path, control-channel profile path, and next-call handoff. It must also include `transparent_ai_non_expert_voice_text_numbered_control_loop_v1`: speech transcript or typed command -> restate understanding -> mark possible positions with numbers -> wait for exactly one confirmed number or correction -> prepare only a dry-run-first reviewed execution route. Use it only for packaged/full-session requests; ordinary voice/text commands can stay on `create_engineering_command_confirmation_kit` to save tokens. The session must keep `softwareActionsExecuted=false`, `targetSoftwareCommandsExecuted=false`, `nativeUniversalExecution=false`, `fullContinuousRecording=false`, `screenshotsCaptured=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

After a voice/text engineering command has one teacher-confirmed number and an existing execution package, use `create_engineering_voice_execution_approval_gate` before any execute-mode runner. This approval gate validates the confirmed target receipt, route-specific evidence such as a reviewed command/API/mapping/browser target or target window title, explicit teacher execution confirmation, and a rollback point. It only emits a generated runner request; it must keep `approvalGateDoesNotRunRunner=true`, `softwareActionsExecuted=false`, `targetSoftwareCommandsExecuted=false`, `uiEventsSent=false`, `fullContinuousRecording=false`, `storesAudio=false`, `memoryWritten=false`, `ruleEnabled=false`, `accepted=false`, `nativeUniversalExecution=false`, and `packagingGated=true`.

## Engineering Voice Control Workbench

When the teacher wants a user-facing first screen for a non-expert who does not know the engineering software, prefer:

```text
create_engineering_voice_control_workbench
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/create-engineering-voice-control-workbench.mjs \
  --goal "What the user wants to do in the engineering software" \
  --software "Target engineering software" \
  --command "Optional typed command" \
  --voice-transcript "Optional speech transcript" \
  --visual-evidence "Optional reviewed screenshot or visual evidence path" \
  --candidate "target-id|visible target label|0.62|0.34|0.1|why this candidate might match"
```

The workbench must reuse the existing session chain instead of inventing a second controller. It writes `transparent_ai_engineering_voice_control_workbench_v1`, `transparent_ai_engineering_voice_control_workbench_receipt_template_v1`, and a local `engineering-voice-control-workbench.html`. The teacher opens the HTML, speaks or types one short command, selects exactly one numbered candidate or writes a correction, then copies the generated `confirm_engineering_command_target` call. If a reviewed screenshot, image, or triggered visual-check capture receipt is supplied, the workbench must reuse `create_visual_engineering_target_confirmation_kit` and use that visual evidence as the numbered-target backdrop; without visual evidence it keeps the existing abstract candidate panel. The HTML may use browser `SpeechRecognition`/`webkitSpeechRecognition` plus manual text fallback, but it must not execute target software, send UI events, capture screenshots, write memory, enable rules, accept technology, or unlock packaging. Keep `workbenchDoesNotExecuteSoftware=true`, `softwareActionsExecuted=false`, `targetSoftwareCommandsExecuted=false`, `uiEventsSent=false`, `screenshotsCaptured=false`, `memoryWritten=false`, `nativeUniversalExecution=false`, `accepted=false`, `ruleEnabled=false`, `technologyAccepted=false`, and `packagingGated=true`.

## Engineering Voice Command Control Loop

When the teacher asks for "voice control engineering software" as a direct user feature, prefer the one-command wrapper:

```text
run_engineering_voice_command_control_loop
```

CLI equivalent for the first, confirmation-waiting step:

```bash
node plugins/transparent-ai-apprentice/scripts/run-engineering-voice-command-control-loop.mjs \
  --goal "What the user wants to do in the engineering software" \
  --software "Target engineering software" \
  --command "Optional typed command" \
  --voice-transcript "Optional speech transcript" \
  --candidate "target-id|visible target label|0.62|0.34|0.1|why this candidate might match"
```

CLI equivalent after the teacher confirms one visible number:

```bash
node plugins/transparent-ai-apprentice/scripts/run-engineering-voice-command-control-loop.mjs \
  --goal "What the user wants to do in the engineering software" \
  --software "Target engineering software" \
  --command "Optional typed command" \
  --selected-number 1 \
  --teacher-confirmed-number
```

This wrapper must reuse `create_engineering_voice_control_workbench` and `confirm_engineering_command_target`; do not build a second voice stack or bypass the numbered confirmation gate. Without a selected, teacher-confirmed number it writes `transparent_ai_engineering_voice_command_control_loop_v1` with `status=waiting_for_numbered_target_confirmation`. If a number is supplied without `--teacher-confirmed-number`, it must stay blocked. Only after the explicit confirmed number may it generate the single-target overlay, supervised action kit, and existing execution adapter package, and those outputs remain dry-run-first. It must keep `fullContinuousRecording=false`, `storesAudio=false`, `screenshotsCaptured=false`, `softwareActionsExecuted=false`, `targetSoftwareCommandsExecuted=false`, `uiEventsSent=false`, `memoryWritten=false`, `nativeUniversalExecution=false`, `accepted=false`, `ruleEnabled=false`, `technologyAccepted=false`, and `packagingGated=true`.

## Goal Command Center

When the teacher asks for the whole original objective as one usable starting point, prefer:

```text
create_goal_command_center
create_original_goal_current_status_refresh
create_original_goal_integrated_control_flow
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/create-goal-command-center.mjs \
  --goal "All-software low-token learning plus transparent 2D/perspective/3D teaching and supervised execution" \
  --software "Current target software" \
  --command "Optional voice/text engineering instruction" \
  --teacher-style "voice, transparent sketch, logs, correction-first"
```

The command center is an orchestration package, not a new controller. It must reuse `create_teacher_learning_method_profile`, `create_all_software_observer_bootstrap`, `create_transparent_sketch_overlay_kit`, `create_engineering_voice_control_workbench`, and `create_teach_execute_learning_loop`. It writes `transparent_ai_goal_command_center_v1`, `transparent_ai_goal_command_center_receipt_template_v1`, and a local `goal-command-center.html` showing the generated stages and next MCP calls. It should give the teacher one place to start low-token software observation, transparent 2D/perspective/3D sketch teaching, voice/text numbered target confirmation, dry-run action rehearsal, supervised execution gate review, and post-action evidence review. It must not execute target software, send UI events, capture screenshots, write memory, enable rules, claim native universal execution, accept completion, or unlock packaging. Keep `commandCenterDoesNotExecuteSoftware=true`, `softwareActionsExecuted=false`, `targetSoftwareCommandsExecuted=false`, `uiEventsSent=false`, `screenshotsCaptured=false`, `memoryWritten=false`, `nativeUniversalExecution=false`, `accepted=false`, `ruleEnabled=false`, `technologyAccepted=false`, and `packagingGated=true`.

Use the integrated control flow before choosing a single remaining lane when the teacher wants to discuss the whole system shape. It is a teacher-facing map over existing tools, not an execution runner. It should expose the eight-stage chain, requirement coverage, source refresh path if available, and locks proving it did not capture screenshots, read full logs, execute software, send UI events, write memory, register schedules, enable rules, unlock packaging, or claim completion.

After the teacher reviews the command center and explicitly agrees to a bounded local trial, prefer:

```text
run_goal_command_center_trial
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/run-goal-command-center-trial.mjs \
  --command-center "<transparent_ai_goal_command_center_v1 path>" \
  --teacher-reviewed \
  --max-processes 12 \
  --max-installed 12
```

Without `--teacher-reviewed`, the trial must only write `transparent_ai_goal_command_center_trial_v1` with `status=blocked_waiting_for_teacher_review`. With review, it may run the bounded read-only software inventory probe and pass that inventory into `run_all_software_low_token_learning_cycle` so the metadata delta gate initializes or detects changed signals. It must still keep `screenshotsCaptured=false`, `softwareActionsExecuted=false`, `targetSoftwareCommandsExecuted=false`, `uiEventsSent=false`, `memoryWritten=false`, `nativeUniversalExecution=false`, `accepted=false`, `ruleEnabled=false`, and `packagingGated=true`.

When the teacher confirms a number from the browser helper or target confirmation packet, do not pass the multi-candidate overlay directly to execution planning. First narrow it through:

```text
confirm_engineering_command_target
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/confirm-engineering-command-target.mjs \
  --confirmation "<transparent_ai_numbered_target_confirmation_v1 path or review JSON>" \
  --selected-number "2"
```

The result must write `transparent_ai_engineering_command_target_confirmation_receipt_v1`, a `voice_text_confirmed_single_target` `transparent_ai_sketch_overlay_packet_v1` with exactly one selected anchor/stroke, a `transparent_ai_confirmed_engineering_target_supervised_action_request_v1` for `create_supervised_software_action_kit`, and a `transparent_ai_confirmed_engineering_target_existing_execution_adapter_request_v1` for `create_existing_software_execution_adapter`. It may generate the supervised action kit only in dry-run-first mode when explicitly requested. With `--create-execution-adapter`, it should first generate the single-target supervised action plan, then create an existing execution adapter selection package from that plan so browser/CLI/API/file/UI routes are reviewed before any generic UI execution. It must keep unselected candidates out of both bridges. Keep `selectedTargetOnly=true`, `softwareActionsExecuted=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

## Software Control Channel Read-Only Probe

Before the control-channel profile relies on manually supplied hints, create a read-only probe package when the target engineering software is unfamiliar or the teacher wants low-token discovery first.

MCP tool name:

```text
create_software_control_channel_probe
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/create-software-control-channel-probe.mjs \
  --goal "What the teacher wants done" \
  --software "Target engineering software" \
  --install-path "Optional reviewed install path" \
  --process-name "Optional process name" \
  --run-read-only-probe
```

The tool must write `transparent_ai_software_control_channel_probe_plan_v1`, `transparent_ai_software_control_channel_probe_result_v1`, `transparent_ai_software_control_channel_probe_to_profile_request_v1`, a bounded PowerShell metadata probe, and a teacher start-here readme. The probe may inspect process/window metadata, candidate root file names/extensions/sizes/mtimes, optional listening-port metadata, and optional bounded read-only registry class names only when explicitly enabled. It must not run target software commands, invoke `--help`, read file contents, write registry values, click/type, capture screenshots, or continuously record. The result should identify candidate API/SDK/COM, macro/add-in, CLI/script, browser/local-service, file import/export, and visible-window fallback signals, then pass `--probe-result` into `create_software_control_channel_profile`. Keep `targetSoftwareCommandsExecuted=false`, `fileContentsRead=false`, `softwareActionsExecuted=false`, `screenshotsCaptured=false`, `fullContinuousRecording=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

## Software Control Channel Profile

Before a voice/text command, numbered target, transparent sketch, or action rehearsal chooses an execution path, create a review-only software control channel profile when the target app may already expose API, macro, CLI/script, browser, file import/export, or UI automation routes.

MCP tool name:

```text
create_software_control_channel_profile
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/create-software-control-channel-profile.mjs \
  --goal "What the teacher wants done" \
  --software "Target engineering software" \
  --probe-result "Optional transparent_ai_software_control_channel_probe_result_v1 path" \
  --api-hint "Optional reviewed API or macro evidence" \
  --command-name "Optional CLI/script command" \
  --file-extension ".step" \
  --create-adapter-selection
```

The tool must write `transparent_ai_software_control_channel_profile_v1`, `transparent_ai_software_control_channel_existing_adapter_request_v1`, and `transparent_ai_software_control_channel_review_receipt_template_v1`. Prefer reviewed existing control channels before supervised UI automation: `existing-browser-automation`, `existing-cli-or-script`, `existing-application-api`, `existing-file-import-export`, then `existing-windows-ui-automation` only as fallback. When `--create-adapter-selection` is used, it must call `create-existing-software-execution-adapter.mjs` only to create a dry-run-first adapter package, not to execute software. This profile is a bridge between voice/text/numbered target confirmation and execution adapter selection; it must keep `softwareActionsExecuted=false`, `nativeUniversalExecution=false`, `fullContinuousRecording=false`, `screenshotsCaptured=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

## All Software Control Channel Coverage Audit

When the teacher wants this to work across many engineering tools or all local software, do not claim universal native control. First create a review-only control-channel coverage audit that reuses the existing per-software control-channel profile.

MCP tool name:

```text
create_all_software_control_channel_coverage_audit
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-control-channel-coverage-audit.mjs \
  --goal "Voice/text/sketch instruction should choose reviewed existing routes before UI fallback" \
  --inventory "<transparent_ai_all_software_log_source_index_v1 or inventory path>" \
  --max-software 8 \
  --create-profiles
```

The tool must write `transparent_ai_all_software_control_channel_coverage_audit_v1`, `transparent_ai_all_software_control_channel_repair_queue_v1`, and `transparent_ai_all_software_control_channel_coverage_audit_receipt_v1`. Each row must be classified as `structured_control_route_reviewable`, `supervised_ui_fallback_reviewable`, `observation_only_needs_control_evidence`, or `needs_teacher_control_evidence`. Prefer API/SDK/COM, macro/add-in, CLI/script, browser/local-service, and file import/export evidence before Windows UI fallback. Keep `targetSoftwareCommandsExecuted=false`, `softwareActionsExecuted=false`, `screenshotsCaptured=false`, `memoryWritten=false`, `nativeUniversalExecution=false`, `allSoftwareControlComplete=false`, `accepted=false`, `ruleEnabled=false`, `technologyAccepted=false`, and `packagingGated=true`.

## All Software Control-Channel Repair Receipt

When the coverage audit writes `transparent_ai_all_software_control_channel_repair_queue_v1`, do not run profile/probe follow-up automatically. First create a teacher-facing receipt builder:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-control-channel-repair-receipt-builder.mjs \
  --goal "Review missing control-channel evidence before profile or probe follow-up" \
  --repair-queue "<transparent_ai_all_software_control_channel_repair_queue_v1 path>"
```

When an execution capability follow-up batch has already created read-only control-channel probe packages, reuse those concrete probe artifacts instead of asking the teacher to review an abstract queue. The same builder can consume `transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1`, derive `control-channel-repair-queue-from-follow-up.json`, and show `probePlanPath`, `probeResultTemplatePath`, `teacherReadmePath`, and `evidencePath` for each row. It must also write `control-channel-repair-review-receipt-template.json` with every row defaulting to `needs_teacher_review`; this template is only a durable starting point and must validate as waiting, not approval.

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-control-channel-repair-receipt-builder.mjs \
  --goal "Review real probe package evidence before control profile follow-up" \
  --follow-up-batch "<transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1 path>"
```

MCP tool names:

```text
create_all_software_control_channel_repair_receipt_builder
validate_all_software_control_channel_repair_receipt
```

After the teacher fills `transparent_ai_all_software_control_channel_repair_review_receipt_v1`, validate it:

```bash
node plugins/transparent-ai-apprentice/scripts/validate-all-software-control-channel-repair-receipt.mjs \
  --repair-queue "<transparent_ai_all_software_control_channel_repair_queue_v1 path>" \
  --receipt "<teacher-filled-control-channel-repair-receipt.json>"
```

Validation may only emit review-only next commands such as `create_software_control_channel_profile` or `create_software_control_channel_probe`; it must preserve `evidenceReferences` such as `probePlanPath`, `probeResultTemplatePath`, `teacherReadmePath`, and `nextProfileRequestPath` when they came from a follow-up probe package. A default `control-channel-repair-review-receipt-template.json` with `templateOnly=true` and `needs_teacher_review` decisions must keep `readyRowCount=0` until the teacher edits decisions and marks evidence reviewed. A probe result template is not a completed probe result, so the next command must keep `requiresTeacherCompletedProbeResultBeforeProfileTrust=true` until the teacher supplies reviewed result evidence. It must not run probes, create profiles, execute target software, send UI events, capture screenshots, write memory, accept native control, or unlock packaging. Keep `validationDoesNotRunProbe=true`, `validationDoesNotCreateProfile=true`, `probeRan=false`, `controlProfileCreated=false`, `targetSoftwareCommandsExecuted=false`, `accepted=false`, `ruleEnabled=false`, `nativeUniversalExecution=false`, and `packagingGated=true`.

## All Software Execution Gap Review Cockpit

When both control-channel repair evidence and action-logic source contract drafts exist, create a combined teacher review cockpit before any profile, probe, dry-run promotion, medium-runtime reuse, or native execution claim:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-execution-gap-review-cockpit.mjs \
  --goal "Review route evidence and action logic together before execution follow-up" \
  --control-channel-builder "<transparent_ai_all_software_control_channel_repair_receipt_builder_v1 path>" \
  --action-logic-package "<transparent_ai_all_software_action_logic_source_contract_package_v1 path>"
```

MCP tool name:

```text
create_all_software_execution_gap_review_cockpit
```

The cockpit must write `transparent_ai_all_software_execution_gap_review_cockpit_v1`, `all-software-execution-gap-review-cockpit.html`, `execution-gap-review-cockpit-receipt-template.json`, and a start-here readme. Each row must merge control-channel evidence with the action-logic draft contract so the teacher can review action intent, target binding, data-to-action logic, data relationship map, geometry/angle/position/depth relationship, target selection logic, rollback policy, outcome verifier, and reasoning-tier boundary in one pass. The default receipt remains `needs_teacher_review`; it is not acceptance. Keep `cockpitDoesNotRunProbe=true`, `cockpitDoesNotCreateControlProfile=true`, `cockpitDoesNotExecuteTargetSoftware=true`, `cockpitDoesNotEnableRules=true`, `cockpitDoesNotWriteMemory=true`, `cockpitDoesNotAllowMediumRuntime=true`, `softwareActionsExecuted=false`, `targetSoftwareCommandsExecuted=false`, `uiEventsSent=false`, `screenshotsCaptured=false`, `memoryWritten=false`, `nativeUniversalExecution=false`, `accepted=false`, `ruleEnabled=false`, `goalComplete=false`, and `packagingGated=true`.

## All Software Execution Pilot Queue

After a control-channel coverage audit finds reviewed routes, do not jump directly to live software execution. Create a teacher-reviewed dry-run pilot queue first so one software item, one confirmed target or route, and one adapter package can be tested at a time.

MCP tool name:

```text
create_all_software_execution_pilot_queue
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-execution-pilot-queue.mjs \
  --goal "Turn reviewed software control routes into dry-run pilot trials" \
  --coverage-audit "<transparent_ai_all_software_control_channel_coverage_audit_v1 path>" \
  --max-pilots 4 \
  --create-adapter-packages
```

The tool must write `transparent_ai_all_software_execution_pilot_queue_v1`, `transparent_ai_all_software_execution_pilot_action_plan_v1`, and `transparent_ai_all_software_execution_pilot_queue_receipt_v1`. Eligible rows become `structured_route_dry_run_pilot` or `supervised_ui_fallback_dry_run_pilot`; blocked rows stay blocked until teacher evidence improves. When adapter packages are requested, it must reuse `create-existing-software-execution-adapter.mjs` and keep each package dry-run-first. Keep `numberedTargetRequired=true`, `teacherConfirmationRequired=true`, `targetSoftwareCommandsExecuted=false`, `uiEventsSent=false`, `softwareActionsExecuted=false`, `screenshotsCaptured=false`, `memoryWritten=false`, `nativeUniversalExecution=false`, `allSoftwareExecutionComplete=false`, `accepted=false`, `ruleEnabled=false`, `technologyAccepted=false`, and `packagingGated=true`.

## All Software Execution Capability Matrix

After inventory, control-channel coverage, or pilot-queue evidence exists, create a row-by-row execution capability matrix before deciding what to try next:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-execution-capability-matrix.mjs \
  --goal "Route every local software row from low-token observation toward reviewed execution pilots" \
  --inventory "<transparent_ai_software_observer_inventory_v1 path>" \
  --coverage-audit "<transparent_ai_all_software_control_channel_coverage_audit_v1 path>" \
  --pilot-queue "<transparent_ai_all_software_execution_pilot_queue_v1 path>"
```

MCP tool name:

```text
create_all_software_execution_capability_matrix
```

The matrix must write `transparent_ai_all_software_execution_capability_matrix_v1` and `transparent_ai_all_software_execution_capability_matrix_receipt_v1`. It should merge low-token observation evidence, control-channel status, dry-run pilot packages, and readiness-batch evidence into stages such as `dry_run_pilot_package_ready`, `control_route_reviewable_before_pilot`, `observation_ready_control_evidence_missing`, or `needs_teacher_signal_or_control_evidence`. Next review lanes should point to existing tools like `run_all_software_execution_pilot_runner`, `create_all_software_execution_pilot_queue`, `create_software_control_channel_probe`, `create_visual_engineering_target_confirmation_kit`, or `teach_apprentice`. This matrix is a routing and closure aid only: it must keep `targetSoftwareCommandsExecuted=false`, `uiEventsSent=false`, `softwareActionsExecuted=false`, `screenshotsCaptured=false`, `logContentsRead=false`, `memoryWritten=false`, `nativeUniversalExecution=false`, `allSoftwareExecutionComplete=false`, `accepted=false`, `ruleEnabled=false`, `technologyAccepted=false`, and `packagingGated=true`.

To advance the next bounded set of matrix lanes without losing the safety gates, use:

```bash
node plugins/transparent-ai-apprentice/scripts/run-all-software-execution-capability-matrix-follow-up-batch.mjs \
  --matrix "<transparent_ai_all_software_execution_capability_matrix_v1 path>" \
  --pilot-queue "<optional transparent_ai_all_software_execution_pilot_queue_v1 path>" \
  --max-rows 5 \
  --teacher-reviewed
```

MCP tool name:

```text
run_all_software_execution_capability_matrix_follow_up_batch
```

The follow-up batch must write `transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1` and `transparent_ai_all_software_execution_capability_matrix_follow_up_batch_receipt_v1`. It may invoke `run-all-software-execution-pilot-runner.mjs` only for `review_and_run_one_dry_run_pilot` rows, only after `teacherReviewed=true`, and only in dry-run mode. Other lanes must remain as review-only handoffs: `confirm_numbered_target_or_exact_route`, `confirm_visible_window_and_numbered_target`, `collect_control_channel_evidence`, or `ask_teacher_for_signal_or_exclusion`. Keep `targetSoftwareCommandsExecuted=false`, `uiEventsSent=false`, `screenshotsCaptured=false`, `logContentsRead=false`, `fileContentsRead=false`, `memoryWritten=false`, `nativeUniversalExecution=false`, `allSoftwareExecutionComplete=false`, `accepted=false`, `ruleEnabled=false`, `technologyAccepted=false`, and `packagingGated=true`.

Before any prepared dry-run call is promoted, create a teacher-facing receipt builder:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-execution-follow-up-receipt-builder.mjs \
  --goal "Review prepared dry-run calls before runner review" \
  --batch "<transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1 path>"
```

MCP tool names:

```text
create_all_software_execution_follow_up_receipt_builder
validate_all_software_execution_follow_up_receipt
create_all_software_execution_follow_up_handoff_queue
run_all_software_execution_follow_up_handoff_queue_item
create_all_software_execution_follow_up_handoff_item_receipt_builder
validate_all_software_execution_follow_up_handoff_item_receipt
run_all_software_execution_approval_gate_prep_runner
run_all_software_execution_approved_gate_runner
```

After the teacher fills `transparent_ai_all_software_execution_follow_up_review_receipt_v1`, validate it:

```bash
node plugins/transparent-ai-apprentice/scripts/validate-all-software-execution-follow-up-receipt.mjs \
  --batch "<transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1 path>" \
  --receipt "<teacher-filled-execution-follow-up-receipt.json>"
```

Validation may only turn teacher-reviewed prepared rows into review-only dry-run runner review commands; it must not invoke runners, execute target software, send UI events, write memory, accept execution, claim native universal control, or unlock packaging. Keep `validationDoesNotInvokeRunner=true`, `dryRunRunnerInvoked=false`, `targetSoftwareCommandsExecuted=false`, `accepted=false`, `ruleEnabled=false`, `nativeUniversalExecution=false`, and `packagingGated=true`.

Before anyone follows a validated dry-run runner review command, turn the validation into a manual handoff queue:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-execution-follow-up-handoff-queue.mjs \
  --validation "<transparent_ai_all_software_execution_follow_up_receipt_validation_v1 path>"
```

The handoff queue must write `transparent_ai_all_software_execution_follow_up_handoff_queue_v1`, classify safe dry-run runner commands, block unsafe execute/screenshot/schedule/memory markers, and keep `queueDoesNotInvokeRunner=true`, `queueDoesNotExecuteTargetSoftware=true`, `queueDoesNotSendUiEvents=true`, `queueDoesNotReadLogs=true`, `queueDoesNotCaptureScreenshots=true`, `queueDoesNotRegisterSchedule=true`, `queueDoesNotWriteMemory=true`, `dryRunRunnerInvoked=false`, `nativeUniversalExecution=false`, and `goalComplete=false`.

Once the teacher chooses exactly one ready dry-run runner item, consume only that item through the dry-run handoff item runner:

```bash
node plugins/transparent-ai-apprentice/scripts/run-all-software-execution-follow-up-handoff-queue-item.mjs \
  --queue "<transparent_ai_all_software_execution_follow_up_handoff_queue_v1 path>" \
  --row-id "<teacher-reviewed-row-id>"
```

The item runner must write `transparent_ai_all_software_execution_follow_up_handoff_queue_item_run_v1` and invoke the existing `run-all-software-execution-pilot-runner.mjs` only without `--execute`. It must block non-ready items, unresolved placeholders, unsafe execute/screenshot/schedule/memory markers, and state/state-dir log inputs that have not passed a separate low-token log review gate. Keep `queueItemRunnerDoesNotPassExecuteFlag=true`, `queueItemRunnerDoesNotExecuteTargetSoftware=true`, `queueItemRunnerDoesNotSendUiEvents=true`, `queueItemRunnerDoesNotReadLogs=true`, `queueItemRunnerDoesNotCaptureScreenshots=true`, `queueItemRunnerDoesNotRegisterSchedule=true`, `queueItemRunnerDoesNotWriteMemory=true`, `targetSoftwareCommandsExecuted=false`, `accepted=false`, `ruleEnabled=false`, `nativeUniversalExecution=false`, `allSoftwareExecutionComplete=false`, and `goalComplete=false`. A successful item run is one dry-run review receipt, not permission to execute or proof of universal native execution.

After a dry-run handoff item run exists, create a teacher-facing review receipt before any approval gate planning:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-execution-follow-up-handoff-item-receipt-builder.mjs \
  --run "<transparent_ai_all_software_execution_follow_up_handoff_queue_item_run_v1 path>"
```

The builder must write `transparent_ai_all_software_execution_follow_up_handoff_item_receipt_builder_v1` and a `transparent_ai_all_software_execution_follow_up_handoff_item_review_receipt_v1` template. It must ask the teacher to review the item run, pilot runner receipt, outcome verification, and post-action checkpoint. It must keep `builderDoesNotCreateApprovalGate=true`, `builderDoesNotInvokeRunner=true`, `builderDoesNotExecuteTargetSoftware=true`, `builderDoesNotCaptureScreenshots=true`, `builderDoesNotWriteMemory=true`, `accepted=false`, `ruleEnabled=false`, `nativeUniversalExecution=false`, and `goalComplete=false`.

Then validate the teacher-filled handoff item review receipt:

```bash
node plugins/transparent-ai-apprentice/scripts/validate-all-software-execution-follow-up-handoff-item-receipt.mjs \
  --run "<transparent_ai_all_software_execution_follow_up_handoff_queue_item_run_v1 path>" \
  --receipt "<teacher-filled-execution-handoff-item-review-receipt.json>"
```

The validation must write `transparent_ai_all_software_execution_follow_up_handoff_item_receipt_validation_v1`. Only when the teacher marks `dry_run_matched_expected` and confirms every required evidence artifact may it prepare a review-only `create-real-local-execution-approval-gate.mjs` command template. It must not create the approval gate itself, invoke runners, execute target software, send UI events, read logs, capture screenshots, register schedules, write memory, accept rules, unlock packaging, or claim completion. Forbidden decisions such as `execute_now`, `run_execute_mode`, `write_memory`, `claim_complete`, or `native_universal_execution` must be blocked.

After the validation is ready, use the approval-gate prep runner to replace placeholders with reviewed selector, queue, route evidence, teacher confirmation, and rollback evidence, then create only the existing approval gate packet:

```bash
node plugins/transparent-ai-apprentice/scripts/run-all-software-execution-approval-gate-prep-runner.mjs \
  --validation "<transparent_ai_all_software_execution_follow_up_handoff_item_receipt_validation_v1 path>" \
  --selector "<transparent_ai_real_local_execution_pilot_selector_v1 path>" \
  --queue "<transparent_ai_all_software_execution_pilot_queue_v1 path>" \
  --selected-pilot-id "<teacher-reviewed-pilot-id>" \
  --adapter-id "<teacher-reviewed-adapter-id>" \
  --reviewed-command "<reviewed-existing-cli-command-manifest.json>" \
  --teacher-confirmation "teacher confirmed all-software execution pilot" \
  --rollback-point-created
```

The prep runner must write `transparent_ai_all_software_execution_approval_gate_prep_runner_v1` and may invoke only `create-real-local-execution-approval-gate.mjs`; it must block non-ready validations, placeholders, missing route evidence, missing teacher confirmation, and missing rollback points before the approval gate. It must keep `prepRunnerDoesNotInvokeExecutionRunner=true`, `prepRunnerDoesNotExecuteTargetSoftware=true`, `approvalGateDoesNotRunRunner=true`, `targetSoftwareCommandsExecuted=false`, `screenshotsCaptured=false`, `memoryWritten=false`, `accepted=false`, `ruleEnabled=false`, `nativeUniversalExecution=false`, `allSoftwareExecutionComplete=false`, and `goalComplete=false`. A prepared approval gate is still not execution permission; it only prepares the next teacher review packet.

Only after the approval gate packet itself is ready may a teacher or supervised agent run the approved-gate runner:

```bash
node plugins/transparent-ai-apprentice/scripts/run-all-software-execution-approved-gate-runner.mjs \
  --gate "<transparent_ai_real_local_execution_approval_gate_v1 path>" \
  --execute-approved-gate \
  --teacher-confirmation "teacher confirmed approved execution gate runner" \
  --rollback-point-created
```

The approved-gate runner must write `transparent_ai_all_software_execution_approved_gate_runner_v1`, consume only one ready `transparent_ai_real_local_execution_approval_gate_v1`, and invoke only the generated `run-all-software-execution-pilot-runner.mjs` request from that gate. It must block missing `--execute-approved-gate`, non-ready gates, placeholders, missing final teacher confirmation, and missing rollback evidence before runner invocation. When it does execute a controlled route, it must produce the pilot runner receipt, adapter receipt, outcome verification, and post-action checkpoint for teacher review. It must keep `accepted=false`, `ruleEnabled=false`, `memoryWritten=false`, `screenshotsCaptured=false`, `packagingGated=true`, `nativeUniversalExecution=false`, `allSoftwareExecutionComplete=false`, and `goalComplete=false`. It proves one teacher-approved controlled route only, not universal all-software execution.

After the teacher reviews a follow-up batch, reconcile its evidence back into the next matrix pass:

```bash
node plugins/transparent-ai-apprentice/scripts/reconcile-all-software-execution-capability-matrix-follow-up-batch.mjs \
  --follow-up-batch "<transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1 path>" \
  --matrix "<source transparent_ai_all_software_execution_capability_matrix_v1 path>" \
  --inventory "<source inventory path>" \
  --coverage-audit "<source control-channel coverage audit path>" \
  --pilot-queue "<source execution pilot queue path>" \
  --teacher-reviewed-rerun
```

MCP tool name:

```text
reconcile_all_software_execution_capability_matrix_follow_up_batch
```

The reconciliation must write `transparent_ai_all_software_execution_capability_matrix_follow_up_reconciliation_v1` and `transparent_ai_all_software_execution_capability_matrix_follow_up_reconciliation_receipt_v1`. It should map dry-run receipts, control-channel probe packages, route-confirmation requests, visual-confirmation requests, and teacher signal questions into explicit next lanes. With `teacher-reviewed-rerun`, it may regenerate only safe coverage, pilot queue, and matrix packages; it must not run target software, send UI events, capture screenshots, read full logs, write memory, enable rules, accept technology, or unlock packaging. Keep `nativeUniversalExecution=false` and `allSoftwareExecutionComplete=false`.

To reduce manual stitching across repeated matrix passes, use `run_all_software_execution_capability_supervisor` or the CLI script `run-all-software-execution-capability-supervisor.mjs`:

```bash
node plugins/transparent-ai-apprentice/scripts/run-all-software-execution-capability-supervisor.mjs \
  --matrix "<transparent_ai_all_software_execution_capability_matrix_v1 path>" \
  --inventory "<source inventory path>" \
  --coverage-audit "<source control-channel coverage audit path>" \
  --pilot-queue "<source execution pilot queue path>" \
  --max-rounds 2 \
  --max-rows 4 \
  --teacher-reviewed
```

MCP tool name:

```text
run_all_software_execution_capability_supervisor
```

The supervisor must write `transparent_ai_all_software_execution_capability_supervisor_v1` and `transparent_ai_all_software_execution_capability_supervisor_receipt_v1`. It may only reuse the existing follow-up batch and reconciliation tools. Without `teacherReviewed=true`, it must stop after preparing the first follow-up packet. With `teacherReviewed=true`, it may advance bounded rounds into the next safe matrix pass, but it must keep `targetSoftwareCommandsExecuted=false`, `uiEventsSent=false`, `softwareActionsExecuted=false`, `screenshotsCaptured=false`, `logContentsRead=false`, `fileContentsRead=false`, `memoryWritten=false`, `nativeUniversalExecution=false`, `allSoftwareExecutionComplete=false`, `accepted=false`, `ruleEnabled=false`, `technologyAccepted=false`, and `packagingGated=true`.

After one or more supervisor packets exist, audit whether the execution capability evidence has actually converged before any completion claim:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-execution-capability-convergence-audit.mjs \
  --matrix "<initial transparent_ai_all_software_execution_capability_matrix_v1 path>" \
  --supervisor "<transparent_ai_all_software_execution_capability_supervisor_v1 path>"
```

MCP tool name:

```text
create_all_software_execution_capability_convergence_audit
```

The convergence audit must write `transparent_ai_all_software_execution_capability_convergence_audit_v1` and `transparent_ai_all_software_execution_capability_convergence_audit_receipt_v1`. It should aggregate supervisors, select the latest generated matrix, and report remaining route-confirmation, numbered-target, control-channel, dry-run receipt, or teacher-signal gaps. Even if the bounded sampled matrix is ready for teacher completion review, it must keep `allSoftwareExecutionComplete=false`, `nativeUniversalExecution=false`, `targetSoftwareCommandsExecuted=false`, `uiEventsSent=false`, `softwareActionsExecuted=false`, `screenshotsCaptured=false`, `logContentsRead=false`, `fileContentsRead=false`, `memoryWritten=false`, `accepted=false`, `ruleEnabled=false`, `technologyAccepted=false`, and `packagingGated=true`.

To advance one reviewed pilot, use `run_all_software_execution_pilot_runner` or the CLI script `run-all-software-execution-pilot-runner.mjs`. It must invoke the generated existing-route runner for one pilot, write `transparent_ai_all_software_execution_pilot_runner_v1`, verify the adapter receipt through `verify-supervised-action-outcome.mjs`, and create a post-action checkpoint before screenshots or learning.

To advance several reviewed pilots, use `run_all_software_execution_pilot_batch` or the CLI script `run-all-software-execution-pilot-batch.mjs`. It must call the single-pilot runner independently for each selected row, aggregate per-pilot receipts in `transparent_ai_all_software_execution_pilot_batch_v1`, and keep `nativeUniversalExecution=false`, `allSoftwareExecutionComplete=false`, `accepted=false`, `ruleEnabled=false`, and `packagingGated=true`. A successful batch is only bounded evidence that selected reviewed routes ran; it is not acceptance of all installed software.

To prove the real local computer can move from actual software inventory to execution readiness without executing target apps, use `run_real_local_all_software_execution_readiness_batch` or the CLI script `run-real-local-all-software-execution-readiness-batch.mjs`. It must run the read-only inventory probe, create control-channel coverage, create an execution pilot queue, run a dry-run-only pilot batch, and write `transparent_ai_real_local_all_software_execution_readiness_batch_v1`. It must keep `targetSoftwareCommandsExecuted=false`, `uiEventsSent=false`, `softwareActionsExecuted=false`, `screenshotsCaptured=false`, `memoryWritten=false`, `nativeUniversalExecution=false`, `allSoftwareExecutionComplete=false`, `accepted=false`, `ruleEnabled=false`, and `packagingGated=true`. This is readiness evidence for real local software, not proof that every installed app has been safely executed.

To let a non-expert teacher pick the next real local software pilot, use `create_real_local_execution_pilot_selector` or the CLI script `create-real-local-execution-pilot-selector.mjs`. It must consume a real-local readiness batch or pilot queue, create numbered candidate software routes, and optionally advance exactly one teacher-selected number into `run-all-software-execution-pilot-runner.mjs` dry-run evidence. It must keep execute mode gated behind exact reviewed route evidence plus explicit teacher confirmation, and keep `nativeUniversalExecution=false`, `allSoftwareExecutionComplete=false`, `accepted=false`, `ruleEnabled=false`, and `packagingGated=true`.

When the route comes from a transparent sketch or spatial target bridge, do not reuse an auto-selected pilot directly. First create a teacher pilot-selection receipt with `create_spatial_route_pilot_selection_receipt` or `create-spatial-route-pilot-selection-receipt.mjs`. The receipt must show the numbered real-local pilot candidates, require exactly one teacher-reviewed pilot number before approval-prep reuse, and keep `softwareActionsExecuted=false`, `targetSoftwareCommandsExecuted=false`, `screenshotsCaptured=false`, `memoryWritten=false`, `accepted=false`, `ruleEnabled=false`, `nativeUniversalExecution=false`, `allSoftwareExecutionComplete=false`, and `packagingGated=true`. Only a valid teacher receipt may prepare the next `create_spatial_route_execution_approval_prep_handoff` command, and even that command remains a handoff for later approval review rather than execution.

When the teacher has already drawn on the transparent mask and wants the apprentice to mark the possible interpreted target positions with numbers before execution, bridge the overlay or spatial interpretation into the same numbered confirmation protocol:

```bash
node plugins/transparent-ai-apprentice/scripts/create-spatial-target-confirmation-kit.mjs \
  --goal "What the teacher wants the sketch to accomplish" \
  --software "Target software" \
  --overlay-packet <transparent-sketch-packet.json> \
  --command "Optional spoken or typed command paired with the sketch"
```

MCP tool:

```text
create_spatial_target_confirmation_kit
```

The result must write `transparent_ai_spatial_target_confirmation_kit_v1`, `transparent_ai_spatial_numbered_target_confirmation_workflow_v1`, and a reusable `transparent_ai_numbered_target_confirmation_v1` packet. It should derive candidates from transparent overlay anchors, interpreted suggested actions, stroke endpoints, `perspective_to` relationships, and `nearer_than`/`farther_than` depth cues; then the teacher must confirm exactly one number. Do not pass the multi-candidate spatial overlay directly to execution planning. First run `confirm_engineering_command_target` so only one selected target enters `create_supervised_software_action_kit` and `create_existing_software_execution_adapter`. Keep `softwareActionsExecuted=false`, `nativeUniversalExecution=false`, `fullContinuousRecording=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

When the user or teacher asks whether the transparent drawing mask, 2D sketch, perspective relation, and 3D depth demonstration are actually implemented end to end, use the reusable rehearsal bridge instead of manually stitching separate tools:

```bash
node plugins/transparent-ai-apprentice/scripts/create-transparent-sketch-depth-demonstration-rehearsal.mjs \
  --goal "Prove the transparent sketch 2D perspective 3D demonstration chain" \
  --software "Target software" \
  --overlay-packet "<optional teacher-exported transparent sketch packet>" \
  --selected-number "<optional teacher-confirmed number>" \
  --teacher-confirmed-number
```

MCP tool:

```text
create_transparent_sketch_depth_demonstration_rehearsal
```

The rehearsal must reuse `create_transparent_sketch_overlay_kit`, `interpret_transparent_sketch_spatial_intent`, `create_spatial_target_confirmation_kit`, `confirm_engineering_command_target`, and `create_spatial_software_execution_route_bridge`. If no teacher-confirmed number is supplied, it must stop at `waiting_for_teacher_numbered_spatial_target_confirmation`. If a number is explicitly supplied with `--teacher-confirmed-number`, it may narrow to one selected target and prepare only dry-run route review material. It must write `transparent_ai_transparent_sketch_depth_demonstration_rehearsal_v1`, a start-here Markdown file, and an HTML summary. It must prove 2D position, perspective relationship, 3D depth, universal detail logic, numbered confirmation, and route gating while keeping `rehearsalDoesNotCaptureScreenshots=true`, `rehearsalDoesNotExecuteSoftware=true`, `rehearsalDoesNotSendUiEvents=true`, `rehearsalDoesNotWriteMemory=true`, `rehearsalDoesNotEnableRules=true`, `softwareActionsExecuted=false`, `targetSoftwareCommandsExecuted=false`, `uiEventsSent=false`, `screenshotsCaptured=false`, `memoryWritten=false`, `accepted=false`, `ruleEnabled=false`, `nativeUniversalExecution=false`, and `packagingGated=true`.

After creating a depth rehearsal, do not treat the checks as teacher acceptance. First create a teacher-facing review receipt builder:

```bash
node plugins/transparent-ai-apprentice/scripts/create-transparent-sketch-depth-rehearsal-review-receipt-builder.mjs \
  --rehearsal "<transparent-sketch-depth-demonstration-rehearsal.json>" \
  --output-dir ".transparent-apprentice/transparent-sketch-depth-rehearsal-review-receipt-builder"
```

Then validate the teacher-filled receipt:

```bash
node plugins/transparent-ai-apprentice/scripts/validate-transparent-sketch-depth-rehearsal-review-receipt.mjs \
  --builder "<transparent-sketch-depth-rehearsal-review-receipt-builder.json>" \
  --receipt "<teacher-filled-transparent-sketch-depth-rehearsal-review-receipt.json>" \
  --output-dir ".transparent-apprentice/transparent-sketch-depth-rehearsal-review-receipt-validation"
```

The builder must output `transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_builder_v1` plus a `transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_v1` template. The validator must output `transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_validation_v1`. Allowed teacher decisions are `needs_teacher_review`, `teacher_confirms_understanding`, `teacher_marks_ambiguous`, `teacher_requests_correction`, and `blocked_needs_more_evidence`. Forbidden decisions include `accepted`, `execute_now`, `run_now`, `capture_screenshot`, `send_ui_events`, `write_memory`, `enable_rule`, `claim_depth_mastered`, `native_universal_execution`, and `unlock_packaging`. Even when every row is confirmed, the validation decision is only `teacher_confirmed_depth_rehearsal_review_only`; it must keep `readyForExecution=false`, `accepted=false`, `ruleEnabled=false`, `technologyAccepted=false`, `packagingGated=true`, `softwareActionsExecuted=false`, `uiEventsSent=false`, `memoryWritten=false`, `nativeUniversalExecution=false`, and `goalComplete=false`.

When the teacher wants Codex to learn while they work in CAD/SolidWorks or any other desktop/domain software, do not default to continuous screen recording. Create a low-token work-along kit:

```bash
node plugins/transparent-ai-apprentice/scripts/create-workalong-teaching-kit.mjs \
  --goal "What the teacher wants the apprentice to learn while working" \
  --software "SolidWorks or other desktop software" \
  --log-path "<optional software log path>" \
  --question-mode "both" \
  --future-input "Optional future task to replay"
```

MCP tool name:

```text
create_workalong_teaching_kit
```

The kit must prefer cheap signals first: file modified time, log tail delta, event log path, and a manual teacher marker. It should capture screenshots only on meaningful triggers such as error keywords, non-normal rebuild/export state changes, before/after markers, or explicit teacher request. It must not treat normal startup or a normal completed rebuild as a reason to interrupt the teacher. The browser overlay can ask short questions by floating text or `speechSynthesis`, and the teacher can answer briefly. After the collector writes `workalong-events.jsonl`, run `finalize-workalong-observation.mjs` to create compact `transparent_ai_workalong_observation_v1` evidence with `needsTeacherQuestion`, suggested questions, teacher answers, log summaries, screenshot paths, and locked review fields so it can be pasted back into `teach_apprentice`. This is a feasibility wrapper, not native CAD/SolidWorks automation; it must keep `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

## Teacher Learning Method Profile

When the teacher says how they prefer to teach, asks the apprentice to adapt to their learning method, or mixes preferences such as "first draw a sketch, then check logs, ask fewer questions", create a teacher learning method profile before choosing observation or execution tools:

```bash
node plugins/transparent-ai-apprentice/scripts/create-teacher-learning-method-profile.mjs \
  --goal "What the teacher wants the apprentice to learn" \
  --software "Any target software" \
  --teacher-message "I prefer overlay sketches first, then log deltas, and ask only at rule boundaries"
```

MCP tool name:

```text
create_teacher_learning_method_profile
```

The profile must output `transparent_ai_teacher_learning_method_profile_v1`, `teacher-learning-method-route.json`, and a teacher readme. It should infer `preferredTeachingModes`, `evidencePreferenceOrder`, `questionPolicy`, `correctionPolicy`, and low-token next tools such as `teach_apprentice`, `create_transparent_sketch_overlay_kit`, `watch_log_source_metadata_deltas`, `create_voice_teaching_kit`, or `correct_last_result`. The ordinary `teach_apprentice` entry should route natural teacher-method messages to this profile and return `status=waiting_for_teacher_method_review` with a `teacherMethodProfile` card. This is only routing guidance; it must keep `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, `packagingGated=true`, `fullContinuousRecording=false`, and `nativeUniversalExecution=false`.

## Software Capability Profile

When the teacher wants to use an unfamiliar application and says to automatically discover logs, observe all software, or learn with low token cost, first create a software capability profile instead of guessing the app's logs:

```bash
node plugins/transparent-ai-apprentice/scripts/create-software-capability-profile.mjs \
  --goal "What the apprentice should learn from this software" \
  --software "Any target software" \
  --process-name "<optional process name>" \
  --log-root "<optional folder to search>" \
  --windows-event-log "Application"
```

MCP tool name:

```text
create_software_capability_profile
```

The profile must output `transparent_ai_software_capability_profile_v1`, a read-only PowerShell probe, `transparent_ai_software_observation_plan_v1`, `next-observer-arguments.json`, and teacher adaptation questions. It should inspect or prepare cheap sources in this order: process/window metadata, explicit log files, candidate log roots, Windows Event Log summaries, file modified-time deltas, teacher markers, and triggered screenshots only after a meaningful source changes. The ordinary `teach_apprentice` entry should route auto-discovery/log-discovery requests to this profile bridge and return `status=waiting_for_software_profile_review`. This is source discovery, not a claim that every app exposes useful logs or that universal native execution is implemented; keep `fullContinuousRecording=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

## All Software Observer Bootstrap

When the teacher asks for all software to be watched automatically, computer-wide log learning, or low-token recurring observation across apps, prefer the bootstrap over a bare inventory. It chains the existing inventory, teacher exclusion review, queue creation, persisted watch baseline, and next learning calls in one reviewable packet:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-observer-bootstrap.mjs \
  --goal "Bootstrap low-token observation for all software on this computer"
```

MCP tool name:

```text
create_all_software_observer_bootstrap
```

If the teacher has already reviewed an inventory probe, pass `--inventory "<path to software-observer-inventory.json>"` so the bootstrap can create `transparent_ai_software_observer_queue_v1` and initialize the first `transparent_ai_software_observer_watch_cycle_v1` baseline. If no inventory is supplied, it must stop at the read-only probe and teacher exclusion/style template. This is an observer bootstrap, not continuous recording, not full-log retention, not memory acceptance, and not native universal execution; keep `fullContinuousRecording=false`, `screenshotsCaptured=false`, `rawFullLogsRetained=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

## All Software Observer Supervisor

When the teacher has reviewed a `transparent_ai_software_observer_queue_v1` and wants periodic or recurring low-token observation, run the bounded supervisor instead of continuous recording:

```bash
node plugins/transparent-ai-apprentice/scripts/run-all-software-observer-supervisor.mjs \
  --queue "<path to software-observer-queue.json>" \
  --cycles 3 \
  --interval-ms 0
```

MCP tool name:

```text
run_all_software_observer_supervisor
```

The supervisor must run a finite number of watch cycles, keep persisted baselines, stop on meaningful deltas by default, and write `transparent_ai_all_software_observer_supervisor_v1` plus a receipt for teacher review. It must not install a background task, read full logs, capture screenshots by default, continuously record, enable memory, or claim native universal execution. Keep `fullContinuousRecording=false`, `screenshotsCaptured=false`, `rawFullLogsRetained=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

## All Software Low-Token Learning Cycle

When the teacher has reviewed a `transparent_ai_software_observer_queue_v1` or `transparent_ai_software_observer_inventory_v1` and asks the apprentice to automatically learn from all software logs with low token cost, run the learning cycle instead of the bare supervisor. If a reviewed inventory is supplied and no queue is supplied, the cycle must first call the existing queue builder to create a bounded `transparent_ai_software_observer_queue_v1`. The cycle defaults to `watch-log-source-metadata-deltas.mjs` before any bounded tail read: baseline or unchanged metadata skips tail reads, while changed metadata emits a narrowed queue that is passed to `run-software-observer-queue-item.mjs` for compact learning event packets:

```bash
node plugins/transparent-ai-apprentice/scripts/run-all-software-low-token-learning-cycle.mjs \
  --queue "<path to software-observer-queue.json>" \
  --cycles 2 \
  --max-learning-items 3
```

Or from reviewed inventory:

```bash
node plugins/transparent-ai-apprentice/scripts/run-all-software-low-token-learning-cycle.mjs \
  --inventory "<path to software-observer-inventory.json>" \
  --cycles 2 \
  --max-learning-items 3
```

MCP tool name:

```text
run_all_software_low_token_learning_cycle
```

The cycle must output `transparent_ai_all_software_low_token_learning_cycle_v1`, a receipt, `metadataGateRuns`, `tailReadSkippedByMetadataGate`, changed-item compact learning packets, a teacher readme, and `generatedQueueFromInventory` when it had to create the queue from reviewed inventory. If a reviewed software item has no candidate logs, it must not stall or pretend logs were found; it should expose `nonLogFallbackItems`, write a non-log fallback queue, and produce `non_log_low_token_fallback` compact events from Windows Events, process/window metadata, file deltas, or manual teacher markers before screenshots. The ordinary `teach_apprentice` entry should route explicit all-software low-token learning requests with a reviewed queue or reviewed inventory to this tool and return `status=waiting_for_all_software_learning_cycle_review` with an `allSoftwareLearningCycle` card that exposes `metadataDeltaGateEnabled`, `metadataGateRuns`, `tailReadSkippedByMetadataGate`, and `nonLogFallbackItems`. This is still review-only learning evidence: it must not capture screenshots by default, read full logs, execute software, write long-term memory, enable rules, claim native universal execution, or unlock packaging. Keep `longTermMemoryWritten=false`, `softwareActionsExecuted=false`, `fullContinuousRecording=false`, `screenshotsCaptured=false`, `rawFullLogsRetained=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

For repeated automatic low-token learning from a reviewed all-software queue, use:

```text
run_automatic_low_token_learning_runner
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/run-automatic-low-token-learning-runner.mjs \
  --queue path/to/software-observer-queue.json \
  --state-dir .transparent-apprentice/automatic-learning-state \
  --runs 2
```

The runner repeatedly calls `run_all_software_low_token_learning_cycle` with persistent state and writes `transparent_ai_automatic_low_token_learning_runner_v1`, `transparent_ai_automatic_low_token_learning_runner_receipt_v1`, and `transparent_ai_automatic_low_token_learning_status_v1`. It must initialize a baseline without learning from unchanged startup state, skip tail reads when metadata is unchanged, convert only changed reviewed items into compact teacher-review learning events, and stop for teacher review after learning events unless explicitly told to continue. It is the automatic state-machine layer for all-software log learning, not approval to write long-term memory unattended; keep `longTermMemoryWritten=false`, `softwareActionsExecuted=false`, `fullContinuousRecording=false`, `screenshotsCaptured=false`, `rawFullLogsRetained=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

When automatic low-token learning has produced a runner journal or learning-cycle packet and the teacher wants to look only after a meaningful change, use:

```text
create_automatic_triggered_visual_check_queue
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/create-automatic-triggered-visual-check-queue.mjs \
  --runner path/to/automatic-low-token-learning-runner.json \
  --max-requests 3
```

This bridge reads `transparent_ai_automatic_low_token_learning_runner_v1` or `transparent_ai_all_software_low_token_learning_cycle_v1` evidence and writes `transparent_ai_automatic_triggered_visual_check_queue_v1`. It must stay quiet when the runner only initialized a baseline, and it may request visual grounding only for meaningful changed signals such as failure, warning, blocker, ambiguity, teacher-marker, or screenshot-recommended classifications. Every request must keep `captureOnlyAfterReview=true` and `maxScreenshots=1`. The bridge does not capture screenshots, execute software, read full logs, write long-term memory, enable rules, accept technology, or unlock packaging; keep `screenshotsCaptured=false`, `fullContinuousRecording=false`, `softwareActionsExecuted=false`, `longTermMemoryWritten=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

When the teacher confirms one request from that automatic queue, pass the queue directly into the same bounded capture runner and select the exact row:

```bash
node plugins/transparent-ai-apprentice/scripts/capture-triggered-visual-check.mjs \
  --request path/to/automatic-triggered-visual-check-queue.json \
  --selected-request-id automatic-visual-check-1 \
  --teacher-confirmed \
  --reviewed-source-image path/to/teacher-reviewed-single-screenshot.png
```

The capture runner also still accepts `transparent_ai_triggered_visual_check_request_v1`. For automatic queues, it records `sourceRequestFormat=transparent_ai_automatic_triggered_visual_check_queue_v1` and the selected request id in the receipt so the low-token log trigger can be audited before the one allowed visual evidence file.

After a teacher-confirmed capture succeeds, immediately keep the request/queue, capture receipt, and single visual evidence together as one learning handoff:

```text
create_triggered_visual_evidence_learning_handoff
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/create-triggered-visual-evidence-learning-handoff.mjs \
  --capture-receipt path/to/triggered-visual-check-capture-receipt.json \
  --request path/to/automatic-triggered-visual-check-queue.json
```

The handoff writes `transparent_ai_triggered_visual_evidence_learning_handoff_v1` with the complete `evidenceFiles` list and a ready `teachApprenticeCall`. Use it instead of teaching from an isolated screenshot: the request or queue proves the low-token trigger, the receipt proves teacher confirmation and one-shot capture, and the image provides the visual grounding. This handoff must not capture new screenshots, execute software, read full logs, write memory, enable rules, accept technology, or unlock packaging; keep `handoffDoesNotCaptureScreenshots=true`, `handoffDoesNotExecuteSoftware=true`, `handoffDoesNotWriteMemory=true`, `memoryWritten=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

To avoid stopping at a manual "paste into teach_apprentice" step, route a completed handoff into the existing teaching engine and show the teacher a review-only learning card:

```text
run_triggered_visual_evidence_learning_handoff_review
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/run-triggered-visual-evidence-learning-handoff-review.mjs \
  --handoff path/to/triggered-visual-evidence-learning-handoff.json
```

This runner calls the existing `continue-teaching.mjs` multi-file demonstration path and then `show-teaching-card.mjs`, so the request/queue, receipt, and image become one teacher-facing learning card. It is not acceptance and it does not save memory. The teacher must review the card, correct broad or narrow inferences, and explicitly approve only after replay. Keep `handoffReviewDoesNotCaptureScreenshots=true`, `handoffReviewDoesNotExecuteSoftware=true`, `handoffReviewDoesNotReadFullLogs=true`, `handoffReviewDoesNotWriteMemory=true`, `handoffReviewDoesNotEnableRules=true`, `memoryWritten=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

When the same teacher-confirmed visual evidence should help a non-expert control engineering software by voice or typed text, bridge the completed handoff or capture receipt into the existing numbered-target workbench:

```text
create_triggered_visual_evidence_voice_control_workbench
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/create-triggered-visual-evidence-voice-control-workbench.mjs \
  --handoff path/to/triggered-visual-evidence-learning-handoff.json \
  --command "teacher voice transcript or typed command"
```

This bridge reuses `create-engineering-voice-control-workbench.mjs`, which in turn reuses `create_visual_engineering_target_confirmation_kit` over the teacher-confirmed screenshot. It should be used when the low-token system has already justified one visual check and the next useful action is: restate the user's command, mark possible positions with numbers on the real image, wait for exactly one confirmed number or correction, and only then prepare dry-run-first execution review. It must not capture new screenshots, read full logs, execute software, send UI events, write memory, enable rules, accept technology, or unlock packaging; keep `bridgeDoesNotCaptureScreenshots=true`, `bridgeDoesNotExecuteSoftware=true`, `bridgeDoesNotReadFullLogs=true`, `bridgeDoesNotWriteMemory=true`, `bridgeDoesNotEnableRules=true`, `screenshotsCaptured=false`, `softwareActionsExecuted=false`, `targetSoftwareCommandsExecuted=false`, `uiEventsSent=false`, `memoryWritten=false`, `accepted=false`, `ruleEnabled=false`, `technologyAccepted=false`, and `packagingGated=true`.

For background/recurring automatic low-token learning from a reviewed queue or inventory, create a teacher-confirmed schedule package that launches the learning runner:

```text
create_automatic_low_token_learning_schedule
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/create-automatic-low-token-learning-schedule.mjs \
  --queue path/to/software-observer-queue.json \
  --interval-minutes 15 \
  --runs-per-launch 1
```

The schedule must output `transparent_ai_automatic_low_token_learning_schedule_v1`, `transparent_ai_automatic_low_token_learning_schedule_receipt_v1`, `run-scheduled-low-token-learning.ps1`, `register-low-token-learning-task.ps1`, `unregister-low-token-learning-task.ps1`, and a teacher readme. The generated runner must call `run_automatic_low_token_learning_runner`, not only the observer supervisor. The register/unregister scripts must require `-TeacherConfirmed`, and the task must not be registered by default. Scheduled runs are bounded launches that preserve the same metadata-first, unchanged-log-skip, compact-event-only policy. Keep `scheduledTaskInstalled=false`, `longTermMemoryWritten=false`, `softwareActionsExecuted=false`, `fullContinuousRecording=false`, `screenshotsCaptured=false`, `rawFullLogsRetained=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

Before any reviewed schedule package is turned into a recurring monitor registration request, run the approval gate:

```text
create_all_software_recurring_monitor_approval_gate
```

The gate must consume `transparent_ai_automatic_low_token_learning_schedule_v1`, require explicit teacher recurring-monitor confirmation, require reviewed software scope/exclusion confirmation, require a rollback point, and output `transparent_ai_all_software_recurring_monitor_approval_gate_v1` plus a receipt. It may generate a registration request for the existing `register-low-token-learning-task.ps1`, but it must not register the Windows task itself. Keep `approvalGateDoesNotRegisterTask=true`, `scheduledTaskInstalled=false`, `longTermMemoryWritten=false`, `softwareActionsExecuted=false`, `fullContinuousRecording=false`, `screenshotsCaptured=false`, `rawFullLogsRetained=false`, `nativeUniversalExecution=false`, `accepted=false`, `ruleEnabled=false`, and `packagingGated=true`.

After that approval gate is ready, create a dry-run-first registration runner instead of asking the teacher to hand-copy a command:

```text
run_all_software_recurring_monitor_registration_runner
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/run-all-software-recurring-monitor-registration-runner.mjs \
  --approval-gate path/to/all-software-recurring-monitor-approval-gate.json \
  --teacher-confirmation "teacher confirmed recurring monitor registration" \
  --rollback-point-created
```

The runner must output `transparent_ai_all_software_recurring_monitor_registration_runner_v1`, a wrapper PowerShell script, a receipt, and a start-here readme with both register and unregister commands. Default mode is dry-run and must not install the task. Actual registration is allowed only with explicit teacher registration confirmation, rollback evidence, `--execute`, and `--allow-system-change`; otherwise keep `scheduledTaskInstalled=false`, `softwareActionsExecuted=false`, `targetSoftwareCommandsExecuted=false`, `longTermMemoryWritten=false`, `screenshotsCaptured=false`, `rawFullLogsRetained=false`, `nativeUniversalExecution=false`, `accepted=false`, `ruleEnabled=false`, and `packagingGated=true`.

After a teacher-approved registration attempt, verify status with the read-only verifier:

```text
verify_all_software_recurring_monitor_registration_status
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/verify-all-software-recurring-monitor-registration-status.mjs \
  --registration-runner path/to/recurring-monitor-registration-runner.json
```

The verifier must output `transparent_ai_all_software_recurring_monitor_registration_status_v1`, detect `verified_not_registered_yet`, `registered_and_matches_reviewed_runner`, or `registered_but_mismatch_blocked`, preserve the unregister handoff, and keep `registerTaskCalled=false`, `unregisterTaskCalled=false`, `startTaskCalled=false`, `stopTaskCalled=false`, `softwareActionsExecuted=false`, `targetSoftwareCommandsExecuted=false`, `longTermMemoryWritten=false`, `nativeUniversalExecution=false`, `accepted=false`, `ruleEnabled=false`, and `packagingGated=true`.

After scheduled or manually launched automatic low-token runner outputs exist, audit them without launching anything:

```text
audit_all_software_recurring_monitor_run_output
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/audit-all-software-recurring-monitor-run-output.mjs \
  --schedule path/to/automatic-low-token-learning-schedule.json
```

The audit must output `transparent_ai_all_software_recurring_monitor_run_output_audit_v1`, detect `waiting_for_first_scheduled_run_output`, `learning_events_waiting_for_teacher_review`, `no_changed_learning_events_waiting_for_next_run`, or `blocked_recurring_monitor_run_output_lock_mismatch`, and produce a teacher review queue from compact learning event journals. It must keep `runnerLaunched=false`, `scheduledTaskRegistered=false`, `scheduledTaskUnregistered=false`, `screenshotsCaptured=false`, `rawFullLogsRetained=false`, `softwareActionsExecuted=false`, `targetSoftwareCommandsExecuted=false`, `longTermMemoryWritten=false`, `nativeUniversalExecution=false`, `accepted=false`, `ruleEnabled=false`, and `packagingGated=true`.

Turn the audit queue into a teacher-review triage packet before spending screenshot tokens or writing memory:

```text
create_all_software_recurring_monitor_teacher_review_packet
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-recurring-monitor-teacher-review-packet.mjs \
  --run-output-audit path/to/recurring-monitor-run-output-audit.json \
  --teacher-method-profile path/to/teacher-learning-method-profile.json
```

The packet must output `transparent_ai_all_software_recurring_monitor_teacher_review_packet_v1` and classify each review item as `ready_for_teacher_teach_apprentice_review`, `needs_triggered_visual_check_review`, or `blocked_until_lock_or_parse_issue_reviewed`. It may recommend `create_automatic_triggered_visual_check_queue`, but the packet itself must keep `runnerLaunched=false`, `scheduledTaskRegistered=false`, `scheduledTaskUnregistered=false`, `screenshotsCaptured=false`, `rawFullLogsRetained=false`, `softwareActionsExecuted=false`, `targetSoftwareCommandsExecuted=false`, `longTermMemoryWritten=false`, `nativeUniversalExecution=false`, `accepted=false`, `ruleEnabled=false`, and `packagingGated=true`.

Replay teacher decisions from that packet into the next queue without accepting rules:

```text
create_all_software_recurring_monitor_review_decision_replay_queue
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-recurring-monitor-review-decision-replay-queue.mjs \
  --teacher-review-packet path/to/recurring-monitor-teacher-review-packet.json \
  --decision recurring-monitor-review-001=ready_for_follow_up
```

The replay queue must output `transparent_ai_all_software_recurring_monitor_review_decision_replay_queue_v1`. Allowed decisions are `needs_teacher_review`, `blocked`, and `ready_for_follow_up`; `accepted` must be blocked as `blocked_invalid_acceptance_decision`. It may queue a direct compact `teach_apprentice` follow-up or a triggered visual-check request, but must keep `runnerLaunched=false`, `scheduledTaskRegistered=false`, `scheduledTaskUnregistered=false`, `screenshotsCaptured=false`, `rawFullLogsRetained=false`, `softwareActionsExecuted=false`, `targetSoftwareCommandsExecuted=false`, `longTermMemoryWritten=false`, `nativeUniversalExecution=false`, `accepted=false`, `ruleEnabled=false`, and `packagingGated=true`.

Before claiming unattended all-software low-token learning is operational, audit the whole recurring chain:

```text
create_all_software_unattended_learning_audit
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-unattended-learning-audit.mjs \
  --schedule path/to/automatic-low-token-learning-schedule.json \
  --approval-gate path/to/all-software-recurring-monitor-approval-gate.json \
  --registration-runner path/to/recurring-monitor-registration-runner.json \
  --registration-status path/to/recurring-monitor-registration-status.json \
  --run-output-audit path/to/recurring-monitor-run-output-audit.json \
  --teacher-review-packet path/to/recurring-monitor-teacher-review-packet.json \
  --review-decision-replay-queue path/to/recurring-monitor-review-decision-replay-queue.json
```

The audit must output `transparent_ai_all_software_unattended_learning_audit_v1` and `transparent_ai_all_software_unattended_learning_audit_receipt_v1`. It should report `unattended_learning_not_ready_remaining_gaps` when evidence is missing or the scheduled task is absent/mismatched, and only `unattended_learning_ready_for_teacher_operational_review` when the reviewed chain has matching registration status plus recurring output, teacher review, and replay evidence. The audit itself must keep `unattendedAllAppMonitoringComplete=false`, `runnerLaunched=false`, `scheduledTaskRegistered=false`, `screenshotsCaptured=false`, `logContentsRead=false`, `softwareActionsExecuted=false`, `targetSoftwareCommandsExecuted=false`, `longTermMemoryWritten=false`, `nativeUniversalExecution=false`, `accepted=false`, `ruleEnabled=false`, and `packagingGated=true`.

## All Software Operational Learning Workbench

After readiness, schedule, recurring-monitor registration, run-output, teacher-review, replay, or unattended-audit evidence exists, create one operations start point:

```text
create_all_software_operational_learning_workbench
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-operational-learning-workbench.mjs \
  --readiness-package path/to/real-local-all-software-low-token-readiness-package.json \
  --approval-gate path/to/all-software-recurring-monitor-approval-gate.json \
  --registration-runner path/to/recurring-monitor-registration-runner.json \
  --registration-status path/to/recurring-monitor-registration-status.json \
  --run-output-audit path/to/recurring-monitor-run-output-audit.json \
  --teacher-review-packet path/to/recurring-monitor-teacher-review-packet.json \
  --review-decision-replay-queue path/to/recurring-monitor-review-decision-replay-queue.json \
  --unattended-audit path/to/all-software-unattended-learning-audit.json
```

The workbench must output `transparent_ai_all_software_operational_learning_workbench_v1`, `transparent_ai_all_software_operational_learning_workbench_receipt_v1`, and `ALL_SOFTWARE_OPERATIONAL_LEARNING_WORKBENCH_START_HERE.md`. It is the teacher-facing operations guide for the next safe command order, not an activator by itself. It should keep `operationalWorkbenchDoesNotRegisterTask=true`, `operationalWorkbenchDoesNotLaunchRunner=true`, `operationalWorkbenchDoesNotCaptureScreenshots=true`, `softwareActionsExecuted=false`, `targetSoftwareCommandsExecuted=false`, `longTermMemoryWritten=false`, `nativeUniversalExecution=false`, `accepted=false`, `ruleEnabled=false`, and `packagingGated=true`.

## All Software Operational Learning Trial

To prove the current computer can run the all-software low-token learning chain without installing background automation, use:

```text
run_all_software_operational_learning_trial
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/run-all-software-operational-learning-trial.mjs \
  --max-processes 8 \
  --max-installed 8 \
  --max-queue-candidates 6 \
  --runs 1
```

The trial must output `transparent_ai_all_software_operational_learning_trial_v1`, `transparent_ai_all_software_operational_learning_trial_receipt_v1`, and `ALL_SOFTWARE_OPERATIONAL_LEARNING_TRIAL_START_HERE.md`. It may manually launch only the existing low-token runner against a reviewed observer queue, then audit that output and create the unattended-boundary/workbench packets. It must keep `scheduledTaskRegistered=false`, `scheduledTaskStarted=false`, `targetSoftwareCommandsExecuted=false`, `screenshotsCaptured=false`, `longTermMemoryWritten=false`, `nativeUniversalExecution=false`, `accepted=false`, `ruleEnabled=false`, and `packagingGated=true`.

## All Software Operational Learning Activation Gate

After the teacher reviews an operational trial and wants the next step toward automatic low-token learning, create an activation gate instead of registering a task directly:

```text
create_all_software_operational_learning_activation_gate
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-operational-learning-activation-gate.mjs \
  --trial path/to/all-software-operational-learning-trial.json \
  --teacher-confirmation "teacher confirmed all-software recurring monitoring" \
  --scope-confirmation "teacher reviewed monitored software scope" \
  --registration-confirmation "teacher confirmed recurring monitor registration" \
  --teacher-reviewed-scope \
  --rollback-point-created
```

The activation gate must output `transparent_ai_all_software_operational_learning_activation_gate_v1`, `transparent_ai_all_software_operational_learning_activation_gate_receipt_v1`, and `ALL_SOFTWARE_OPERATIONAL_LEARNING_ACTIVATION_GATE_START_HERE.md`. It may create the existing recurring-monitor approval gate, dry-run registration runner, read-only scheduled-task status verifier, and updated operational workbench. It must not register, start, stop, or unregister a scheduled task by itself, and it must keep `activationGateDoesNotRegisterTask=true`, `registrationRunnerDryRunOnly=true`, `registrationStatusQueryOnly=true`, `scheduledTaskRegistered=false`, `targetSoftwareCommandsExecuted=false`, `screenshotsCaptured=false`, `longTermMemoryWritten=false`, `nativeUniversalExecution=false`, `accepted=false`, `ruleEnabled=false`, and `packagingGated=true`.

## All Software Observer Coverage Audit

Before claiming broad "all software" low-token learning coverage, audit the reviewed inventory and observer queue:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-observer-coverage-audit.mjs \
  --inventory "<path to software-observer-inventory.json>" \
  --queue "<path to software-observer-queue.json>"
```

MCP tool name:

```text
create_all_software_observer_coverage_audit
```

The audit must output `transparent_ai_all_software_observer_coverage_audit_v1`, `transparent_ai_all_software_observer_coverage_repair_plan_v1`, and `transparent_ai_all_software_observer_coverage_audit_receipt_v1`. It should classify each reviewed software row as `covered_with_log_metadata_route`, `covered_with_non_log_fallback_route`, `inventory_logs_waiting_for_queue`, or `needs_teacher_review_or_manual_signal`; when watch or learning evidence is supplied it may mark route rows with watch evidence. The repair plan should call out missing observer queue items and missing low-token signals, then suggest `create_software_observer_queue`, `watch_log_source_metadata_deltas`, or a teacher request for a log path, export folder, Windows Event source, file-delta signal, process/window clue, or manual marker. The ordinary `teach_apprentice` entry should route explicit coverage-audit requests to this tool and return `status=waiting_for_all_software_observer_coverage_review` with `allSoftwareObserverCoverageAudit`. This audit reads only existing JSON evidence and metadata counts; it must not read log contents, read arbitrary file contents, capture screenshots, execute software, write memory, accept coverage, enable rules, or unlock packaging. Keep `logContentsRead=false`, `fileContentsRead=false`, `screenshotsCaptured=false`, `softwareActionsExecuted=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

## All Software Coverage Enrollment Ledger

After coverage audit, create a row-by-row enrollment ledger before any "all software" completion claim:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-coverage-enrollment-ledger.mjs \
  --inventory "<path to software-observer-inventory.json>" \
  --queue "<path to software-observer-queue.json>" \
  --coverage-audit "<path to all-software-observer-coverage-audit.json>"
```

MCP tool name:

```text
create_all_software_coverage_enrollment_ledger
```

The ledger must output `transparent_ai_all_software_coverage_enrollment_ledger_v1` and `transparent_ai_all_software_coverage_enrollment_ledger_receipt_v1`. It should turn every bounded inventory row into a status such as `enrolled_log_route_with_watch_evidence`, `enrolled_log_route_waiting_for_watch_evidence`, `enrolled_non_log_fallback_with_watch_evidence`, `enrolled_non_log_fallback_waiting_for_watch_evidence`, `inventory_signal_waiting_for_queue_enrollment`, `needs_teacher_signal_or_exclusion`, or `teacher_excluded_or_private`. Completion still requires teacher review: every in-scope row needs watch or compact-learning evidence, and every private/out-of-scope row needs an explicit teacher exclusion. The ledger may produce `nextReviewQueue` actions using existing tools such as `create_software_observer_queue`, `watch_log_source_metadata_deltas`, `run_software_observer_queue_item`, and `teach_apprentice` teacher-signal requests. It must preserve `allSoftwareCoverageComplete=false` until final teacher review, widened inventory, and recurring monitor evidence are all checked. Keep `screenshotsCapturedByThisTool=false`, `fullContinuousRecording=false`, `logContentsRead=false`, `fileContentsRead=false`, `softwareActionsExecuted=false`, `memoryWritten=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

## Original Goal Low-Token Coverage Dossier Receipt Gate

When the original-goal current status refresh creates `transparent_ai_original_goal_low_token_coverage_evidence_dossier_v1`, do not jump straight from the dossier to enrollment follow-up commands. First create a teacher-facing receipt builder:

```bash
node plugins/transparent-ai-apprentice/scripts/create-original-goal-low-token-coverage-evidence-dossier-receipt-builder.mjs \
  --dossier "<path to original-goal-low-token-coverage-evidence-dossier.json>"
```

Then validate the teacher-filled receipt:

```bash
node plugins/transparent-ai-apprentice/scripts/validate-original-goal-low-token-coverage-evidence-dossier-receipt.mjs \
  --builder "<path to original-goal-low-token-coverage-dossier-receipt-builder.json>" \
  --receipt "<teacher-filled-low-token-coverage-dossier-receipt.json>"
```

The builder must output `transparent_ai_original_goal_low_token_coverage_dossier_receipt_builder_v1` and a `transparent_ai_original_goal_low_token_coverage_dossier_review_receipt_v1` template. The validator must output `transparent_ai_original_goal_low_token_coverage_dossier_receipt_validation_v1`. Only a teacher-reviewed receipt may prepare review-only follow-up plan command templates for `create-all-software-coverage-enrollment-follow-up-plan.mjs`; it must not run those commands itself. Forbidden receipt decisions include `accepted`, `run_now`, `execute_now`, `allow_bounded_tail`, `capture_screenshot`, `read_full_logs`, `execute_software`, `register_schedule`, `write_memory`, `claim_complete`, `native_universal_execution`, and `unlock_packaging`. Keep `validationDoesNotRunFollowUpPlan=true`, `validationDoesNotRunBatch=true`, `validationDoesNotReadLogs=true`, `validationDoesNotCaptureScreenshots=true`, `validationDoesNotExecuteTargetSoftware=true`, `validationDoesNotWriteMemory=true`, `allSoftwareCoverageComplete=false`, `nativeUniversalExecution=false`, `goalComplete=false`, `accepted=false`, `ruleEnabled=false`, and `packagingGated=true`.

## All Software Coverage Enrollment Follow-Up Plan

After the enrollment ledger shows waiting rows or teacher-signal gaps, turn those gaps into a prioritized low-token next-action plan:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-coverage-enrollment-follow-up-plan.mjs \
  --ledger "<path to all-software-coverage-enrollment-ledger.json>"
```

MCP tool name:

```text
create_all_software_coverage_enrollment_follow_up_plan
```

The plan must output `transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1`, `transparent_ai_all_software_coverage_enrollment_follow_up_plan_receipt_v1`, and `ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_START_HERE.md`. It should convert ledger rows into ordered route types such as `collect_watch_or_queue_item_evidence`, `promote_inventory_row_to_observer_queue`, `ask_teacher_for_signal_or_exclusion`, `teacher_review_coverage_receipt`, or `preserve_teacher_exclusion`. Reuse existing low-token tools first: `watch_log_source_metadata_deltas` before bounded tail reads, `run_software_observer_queue_item` for reviewed queue rows, `create_software_observer_queue` for inventory rows waiting for queue enrollment, and `teach_apprentice` only for a short teacher signal/exclusion question. The plan itself must not run those actions, read logs, capture screenshots, schedule tasks, execute software, write memory, accept rules, or unlock packaging. Keep `allSoftwareCoverageComplete=false`, `screenshotsCapturedByThisTool=false`, `logContentsRead=false`, `softwareActionsExecuted=false`, `scheduledTaskInstalled=false`, `memoryWritten=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

Before running a reviewed batch, create a teacher-facing receipt builder so a non-technical teacher can inspect each waiting row and generate a review receipt without running tools:

```text
create_all_software_coverage_enrollment_follow_up_receipt_builder
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-coverage-enrollment-follow-up-receipt-builder.mjs \
  --plan "<path to all-software-coverage-enrollment-follow-up-plan.json>" \
  --batch "<optional dry-run batch path>"
```

The builder must output `transparent_ai_all_software_coverage_enrollment_follow_up_receipt_builder_v1`, an HTML review page, and `transparent_ai_all_software_coverage_enrollment_follow_up_review_receipt_v1` template. It is only a teacher review checkpoint before `run_all_software_coverage_enrollment_follow_up_batch --teacher-reviewed`; it must not validate the receipt, run metadata gates, read log tails, capture screenshots, execute software, register schedules, write memory, accept coverage, claim native universal execution, or unlock packaging. Keep `builderDoesNotRunBatch=true`, `builderDoesNotWriteReceipt=true`, `builderDoesNotValidateReceipt=true`, `allowBoundedTail=false`, `allSoftwareCoverageComplete=false`, `screenshotsCapturedByThisTool=false`, `softwareActionsExecuted=false`, `memoryWritten=false`, `nativeUniversalExecution=false`, `accepted=false`, `ruleEnabled=false`, and `packagingGated=true`.

After the teacher fills `transparent_ai_all_software_coverage_enrollment_follow_up_review_receipt_v1`, validate it before any batch command:

```text
validate_all_software_coverage_enrollment_follow_up_receipt
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/validate-all-software-coverage-enrollment-follow-up-receipt.mjs \
  --plan "<path to all-software-coverage-enrollment-follow-up-plan.json>" \
  --receipt "<teacher-filled-coverage-enrollment-follow-up-receipt.json>"
```

The validator must output `transparent_ai_all_software_coverage_enrollment_follow_up_receipt_validation_v1` and `transparent_ai_all_software_coverage_enrollment_follow_up_receipt_validation_receipt_v1`. It may prepare a separate reviewed batch command only for rows where the teacher selected `teacher_reviewed_run_metadata_gate` or `teacher_reviewed_prepare_signal_question` with `evidenceReviewed=true`. It must block `accepted`, `run_now`, `allow_bounded_tail`, `capture_screenshot`, `execute_software`, `register_schedule`, `write_memory`, `claim_complete`, `native_universal_execution`, and `unlock_packaging`. It must not run the batch, read logs, capture screenshots, execute software, register schedules, write memory, accept coverage, claim native universal execution, or unlock packaging. Keep `validationDoesNotRunBatch=true`, `batchRunnerInvoked=false`, `allSoftwareCoverageComplete=false`, `screenshotsCapturedByThisTool=false`, `softwareActionsExecuted=false`, `targetSoftwareCommandsExecuted=false`, `scheduledTaskInstalled=false`, `memoryWritten=false`, `nativeUniversalExecution=false`, `accepted=false`, `ruleEnabled=false`, and `packagingGated=true`.

After the receipt validation prepares reviewed rows and the teacher explicitly runs the generated command, advance a small selected batch with:

```text
run_all_software_coverage_enrollment_follow_up_batch
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/run-all-software-coverage-enrollment-follow-up-batch.mjs \
  --plan "<path to all-software-coverage-enrollment-follow-up-plan.json>" \
  --teacher-reviewed \
  --max-items 8
```

The batch runner must output `transparent_ai_all_software_coverage_enrollment_follow_up_batch_run_v1` and `transparent_ai_all_software_coverage_enrollment_follow_up_batch_receipt_v1`. Without `--teacher-reviewed`, every row must stay `dry_run_only` with `blocked_until_teacher_review`. With teacher review, it may run only safe low-token actions by default: `watch_log_source_metadata_deltas` for metadata-only change gates, `create_software_observer_queue` for queue promotion, or a prepared teacher signal/exclusion question. Bounded tail reads through `run_software_observer_queue_item` require explicit `--allow-bounded-tail`, and full logs must still never be read or retained. The batch runner must tell the reviewer to rerun coverage audit and enrollment ledger after new evidence. Keep `allSoftwareCoverageComplete=false`, `screenshotsCapturedByThisTool=false`, `fullContinuousRecording=false`, `rawFullLogsRetained=false`, `softwareActionsExecuted=false`, `targetSoftwareCommandsExecuted=false`, `scheduledTaskInstalled=false`, `memoryWritten=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

If the batch was advanced through exactly one coverage enrollment handoff item runner, create a teacher run-review receipt before reconciliation:

```text
create_all_software_coverage_enrollment_follow_up_handoff_item_run_review_receipt_builder
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-coverage-enrollment-follow-up-handoff-item-run-review-receipt-builder.mjs \
  --run "<path to all-software-coverage-enrollment-follow-up-handoff-queue-item-run.json>" \
  --run-receipt "<path to all-software-coverage-enrollment-follow-up-handoff-queue-item-run-receipt.json>"
```

Then validate the teacher-filled run-review receipt before using any reconciliation command:

```text
validate_all_software_coverage_enrollment_follow_up_handoff_item_run_review_receipt
```

The run-review builder must output `transparent_ai_all_software_coverage_enrollment_follow_up_handoff_item_run_review_receipt_builder_v1` and `transparent_ai_all_software_coverage_enrollment_follow_up_handoff_item_run_review_receipt_v1`. The validator must output `transparent_ai_all_software_coverage_enrollment_follow_up_handoff_item_run_review_receipt_validation_v1`. It may prepare only a review-only reconciliation command template after the teacher confirms the single-item run evidence, batch receipt, low-token outcome, and retained rollback point. It must not rerun the item, run reconciliation, read logs, capture screenshots, execute software, register schedules, write memory, accept coverage, claim native universal execution, or unlock packaging. Keep `builderDoesNotRerunItem=true`, `validationDoesNotRerunItem=true`, `validationDoesNotRunCommands=true`, `validationDoesNotReadLogs=true`, `validationDoesNotCaptureScreenshots=true`, `validationDoesNotExecuteTargetSoftware=true`, `validationDoesNotWriteMemory=true`, `allSoftwareCoverageComplete=false`, `nativeUniversalExecution=false`, `goalComplete=false`, `accepted=false`, `ruleEnabled=false`, and `packagingGated=true`.

After a reviewed batch has produced metadata gates, promoted queues, or teacher-signal handoffs, reconcile that evidence back into the closure ledger with:

```text
reconcile_all_software_coverage_enrollment_follow_up_batch
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/reconcile-all-software-coverage-enrollment-follow-up-batch.mjs \
  --batch "<path to all-software-coverage-enrollment-follow-up-batch-run.json>"
```

The reconciliation must output `transparent_ai_all_software_coverage_enrollment_follow_up_reconciliation_v1` and `transparent_ai_all_software_coverage_enrollment_follow_up_reconciliation_receipt_v1`. By default it only prepares the next `create-all-software-observer-coverage-audit.mjs` and `create-all-software-coverage-enrollment-ledger.mjs` commands with the batch evidence paths. With `--teacher-reviewed-rerun`, it may rerun those existing low-token/read-only evidence compilers and produce a regenerated audit plus enrollment ledger. It must block unreviewed batches, require inventory/queue source paths for rerun, and keep `allSoftwareCoverageComplete=false`, `screenshotsCapturedByThisTool=false`, `logContentsRead=false`, `softwareActionsExecuted=false`, `scheduledTaskInstalled=false`, `memoryWritten=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

## All Software Coverage Repair Queue

When a coverage audit or repair plan has gaps and the teacher asks what to fix next, create a reviewed repair queue instead of claiming coverage:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-coverage-repair-queue.mjs \
  --audit "<path to all-software-observer-coverage-audit.json>" \
  --repair-plan "<path to coverage-repair-plan.json>"
```

MCP tool name:

```text
create_all_software_coverage_repair_queue
```

The queue must output `transparent_ai_all_software_coverage_repair_queue_v1` and `transparent_ai_all_software_coverage_repair_queue_receipt_template_v1`. It should queue only actionable gaps such as private/exclusion review, missing observer queue rows, missing low-token signals, inventory logs waiting for promotion, and non-log fallback signals that still need teacher validation. Reuse existing tools in the next actions: `create_software_observer_queue`, `watch_log_source_metadata_deltas`, `create_software_capability_profile`, `create_software_control_channel_probe`, `create_universal_software_observer_kit`, and `create_triggered_visual_check_request` only after a meaningful signal. The ordinary `teach_apprentice` entry should route explicit repair-queue requests to this tool and return `status=waiting_for_all_software_coverage_repair_queue_review` with `allSoftwareCoverageRepairQueue`. This queue reads only audit/repair-plan JSON; it must not read logs, capture screenshots, execute software, write memory, accept coverage, enable rules, or unlock packaging. Keep `logContentsRead=false`, `screenshotsCaptured=false`, `softwareActionsExecuted=false`, `memoryWritten=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

## All Software Coverage Expansion Plan

When bounded inventory, coverage audit, repair queue, or automatic runner evidence exists and the teacher asks to widen toward all local software, create reviewed batches instead of claiming all coverage is finished:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-coverage-expansion-plan.mjs \
  --inventory "<path to software-observer-inventory.json>" \
  --audit "<path to all-software-observer-coverage-audit.json>" \
  --repair-queue "<path to all-software-coverage-repair-queue.json>" \
  --batch-size 8
```

MCP tool name:

```text
create_all_software_coverage_expansion_plan
```

The plan must output `transparent_ai_all_software_coverage_expansion_plan_v1` and `transparent_ai_all_software_coverage_expansion_plan_receipt_v1`. It should group reviewed software candidates into bounded teacher-review batches, put private or unknown software first for exclusion review, choose next calls from existing low-token tools (`create_software_observer_queue`, `watch_log_source_metadata_deltas`, `run_automatic_low_token_learning_runner`, `create_universal_software_observer_kit`, `create_triggered_visual_check_request`, `create_software_capability_profile`, `create_software_control_channel_probe`, and `create_all_software_coverage_repair_queue`), and preserve a completion boundary with `allSoftwareCoverageComplete=false`. The ordinary `teach_apprentice` entry should route explicit coverage-expansion requests to this tool and return `status=waiting_for_all_software_coverage_expansion_plan_review` with the expansion plan. This plan widens coverage but still must not read logs, capture screenshots, install schedules, execute software, write memory, accept coverage, enable rules, or unlock packaging. Keep `scheduledTaskInstalled=false`, `fullContinuousRecording=false`, `screenshotsCaptured=false`, `softwareActionsExecuted=false`, `memoryWritten=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

## All Software Coverage Rollout Batch

When a `transparent_ai_all_software_coverage_expansion_plan_v1` exists and the teacher wants to advance one reviewed batch, run only that batch through the existing queue and automatic low-token runner stack:

```bash
node plugins/transparent-ai-apprentice/scripts/run-all-software-coverage-rollout-batch.mjs \
  --plan "<path to all-software-coverage-expansion-plan.json>" \
  --batch batch-001
```

MCP tool name:

```text
run_all_software_coverage_rollout_batch
```

The runner must output `transparent_ai_all_software_coverage_rollout_batch_run_v1` and `transparent_ai_all_software_coverage_rollout_batch_receipt_v1`. By default it prepares a batch-scoped software inventory, observer queue, receipt, and next coverage audit handoff; it must not run automatic learning until the teacher supplies `teacherReviewed=true` or `--teacher-reviewed`. When reviewed, it reuses `run_automatic_low_token_learning_runner` with persistent state, metadata gates before tail reads, and compact teacher-review learning events only for changed items. It must preserve `allSoftwareCoverageComplete=false` because one batch is not proof that every installed app is covered. Keep `scheduledTaskInstalled=false`, `fullContinuousRecording=false`, `screenshotsCaptured=false`, `softwareActionsExecuted=false`, `memoryWritten=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

## All Software Coverage Rollout Receipt

When a coverage expansion plan has prepared batches but the teacher has not explicitly reviewed them, do not pass `--teacher-reviewed` directly. First create a teacher-facing receipt builder:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-coverage-rollout-receipt-builder.mjs \
  --plan "<path to all-software-coverage-expansion-plan.json>"
```

MCP tool names:

```text
create_all_software_coverage_rollout_receipt_builder
validate_all_software_coverage_rollout_receipt
create_all_software_coverage_rollout_handoff_queue
run_all_software_coverage_rollout_handoff_queue_item
create_all_software_coverage_rollout_handoff_item_run_review_receipt_builder
validate_all_software_coverage_rollout_handoff_item_run_review_receipt
run_original_goal_review_handoff_queue_item
```

The builder must output `transparent_ai_all_software_coverage_rollout_receipt_builder_v1` and a browser HTML page that defaults every batch to `needs_teacher_review`. A filled receipt must use `transparent_ai_all_software_coverage_rollout_review_receipt_v1`. The validator must output `transparent_ai_all_software_coverage_rollout_receipt_validation_v1` and `transparent_ai_all_software_coverage_rollout_receipt_validation_receipt_v1`, converting only `teacher_reviewed_prepare_rollout` rows with `evidenceReviewed=true` into review-only `run_all_software_coverage_rollout_supervisor` commands. After validation, create a manual handoff queue before any supervisor command:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-coverage-rollout-handoff-queue.mjs \
  --validation "<path to all-software-coverage-rollout-receipt-validation.json>"
```

The handoff queue must output `transparent_ai_all_software_coverage_rollout_handoff_queue_v1`. It lists one reviewed rollout command at a time, marks placeholders for teacher resolution, blocks unsafe execute/screenshot/schedule/memory markers, and still does not invoke the supervisor. The builder, validator, and queue must not run coverage runners, register schedules, start software, capture screenshots, read logs, write memory, accept coverage, enable rules, claim all-software completion, or unlock packaging. Keep `rolloutSupervisorInvoked=false`, `coverageRunnerInvoked=false`, `scheduledTaskRegistered=false`, `softwareActionsExecuted=false`, `memoryWritten=false`, `allSoftwareCoverageComplete=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

Once the teacher chooses exactly one ready coverage rollout handoff item and confirms a rollback point exists, consume only that item through the structured single-item runner:

```bash
node plugins/transparent-ai-apprentice/scripts/run-all-software-coverage-rollout-handoff-queue-item.mjs \
  --queue "<path to all-software-coverage-rollout-handoff-queue.json>" \
  --item-number "<teacher-reviewed-item-number>" \
  --run-reviewed-handoff \
  --allow-runner \
  --teacher-confirmation "teacher confirmed coverage rollout handoff item" \
  --rollback-point-created
```

This runner must output `transparent_ai_all_software_coverage_rollout_handoff_queue_item_run_v1` and a receipt. It may invoke the existing `run-all-software-coverage-rollout-supervisor.mjs` only with reconstructed structured arguments from the selected item; it must not execute the queue display command string. It must refuse multi-batch handoff items, unresolved placeholders, missing teacher confirmation, or missing rollback evidence. Keep `queueItemRunnerDoesNotRunArbitraryCommandString=true`, `queueItemRunnerUsesStructuredArgumentsOnly=true`, `queueItemRunnerConsumesOneHandoffItem=true`, `queueItemRunnerDoesNotRegisterSchedule=true`, `queueItemRunnerDoesNotCaptureScreenshots=true`, `queueItemRunnerDoesNotExecuteTargetSoftware=true`, `queueItemRunnerDoesNotWriteMemory=true`, `allSoftwareCoverageComplete=false`, `nativeUniversalExecution=false`, `goalComplete=false`, `accepted=false`, `ruleEnabled=false`, `technologyAccepted=false`, and `packagingGated=true`.

After exactly one rollout handoff item runner completes, create a teacher run-review receipt before any convergence audit:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-coverage-rollout-handoff-item-run-review-receipt-builder.mjs \
  --run "<path to all-software-coverage-rollout-handoff-queue-item-run.json>" \
  --run-receipt "<path to all-software-coverage-rollout-handoff-queue-item-run-receipt.json>"
```

Then validate the teacher-filled run-review receipt before using any convergence audit command:

```bash
node plugins/transparent-ai-apprentice/scripts/validate-all-software-coverage-rollout-handoff-item-run-review-receipt.mjs \
  --builder "<path to coverage-rollout-handoff-item-run-review-receipt-builder.json>" \
  --receipt "<teacher-filled-coverage-rollout-handoff-item-run-review-receipt.json>"
```

The run-review builder must output `transparent_ai_all_software_coverage_rollout_handoff_item_run_review_receipt_builder_v1` and `transparent_ai_all_software_coverage_rollout_handoff_item_run_review_receipt_v1`. The validator must output `transparent_ai_all_software_coverage_rollout_handoff_item_run_review_receipt_validation_v1`. It may prepare only a review-only `create-all-software-coverage-convergence-audit.mjs` command template after the teacher confirms the single rollout item run evidence, supervisor receipt, post-batch audit, low-token outcome, and retained rollback point. It must not rerun the item, run convergence, read logs, capture screenshots, execute software, register schedules, write memory, accept coverage, claim native universal execution, or unlock packaging. Keep `builderDoesNotRerunItem=true`, `validationDoesNotRerunItem=true`, `validationDoesNotRunCommands=true`, `validationDoesNotReadLogs=true`, `validationDoesNotCaptureScreenshots=true`, `validationDoesNotExecuteTargetSoftware=true`, `validationDoesNotWriteMemory=true`, `allSoftwareCoverageComplete=false`, `nativeUniversalExecution=false`, `goalComplete=false`, `accepted=false`, `ruleEnabled=false`, and `packagingGated=true`.

## Original Goal Review Handoff Item Runner

After a teacher action router receipt or teacher review cockpit receipt has been validated into a handoff queue, do not ask the teacher to copy a long command by hand if only one reviewed item should advance. Use the whitelist-only single-item runner:

```bash
node plugins/transparent-ai-apprentice/scripts/run-original-goal-review-handoff-queue-item.mjs \
  --queue "<path to teacher-action-router-or-cockpit-handoff-queue.json>" \
  --item-number "<teacher-reviewed-item-number>" \
  --receipt "<teacher-filled-downstream-receipt-if-needed.json>" \
  --run-reviewed-handoff \
  --allow-runner \
  --teacher-confirmation "teacher confirmed original goal review handoff item" \
  --rollback-point-created
```

MCP tool name:

```text
run_original_goal_review_handoff_queue_item
```

This runner must output `transparent_ai_original_goal_review_handoff_queue_item_run_v1` and a receipt. It may consume either `transparent_ai_original_goal_teacher_action_router_handoff_queue_v1` or `transparent_ai_goal_teacher_review_cockpit_handoff_queue_v1`. For downstream validation, it must ignore the queue command string as an executable command, identify only an allowlisted `validate-*.mjs` script, reconstruct structured arguments, and replace receipt placeholders only from the explicit `--receipt`/`receipt` argument. For open-review items, it must emit the path as review-ready evidence and must not open a GUI. It must refuse unsafe execute/screenshot/schedule/memory markers, non-whitelisted scripts, unresolved placeholders, missing teacher confirmation, or missing rollback evidence. Keep `reviewHandoffItemRunnerDoesNotRunArbitraryCommandString=true`, `reviewHandoffItemRunnerUsesStructuredArgumentsOnly=true`, `reviewHandoffItemRunnerConsumesOneHandoffItem=true`, `reviewHandoffItemRunnerWhitelistOnly=true`, `reviewHandoffItemRunnerDoesNotOpenGui=true`, `reviewHandoffItemRunnerDoesNotRegisterSchedule=true`, `reviewHandoffItemRunnerDoesNotCaptureScreenshots=true`, `reviewHandoffItemRunnerDoesNotExecuteTargetSoftware=true`, `reviewHandoffItemRunnerDoesNotWriteMemory=true`, `nativeUniversalExecution=false`, `goalComplete=false`, `accepted=false`, `ruleEnabled=false`, `technologyAccepted=false`, and `packagingGated=true`.

## All Software Coverage Rollout Supervisor

Use this when the teacher has a reviewed `transparent_ai_all_software_coverage_expansion_plan_v1` and wants to advance multiple selected batches without inventing new monitoring technology:

```bash
node plugins/transparent-ai-apprentice/scripts/run-all-software-coverage-rollout-supervisor.mjs \
  --plan "<path to all-software-coverage-expansion-plan.json>" \
  --teacher-reviewed \
  --max-batches 2
```

MCP tool name:

```text
run_all_software_coverage_rollout_supervisor
```

The supervisor must output `transparent_ai_all_software_coverage_rollout_supervisor_v1` and `transparent_ai_all_software_coverage_rollout_supervisor_receipt_v1`. It reuses `run_all_software_coverage_rollout_batch` for each selected batch and reruns `create_all_software_observer_coverage_audit` after every batch before widening. By default it prepares bounded batch packets and audits only; it must not run automatic learning until `teacherReviewed=true` or `--teacher-reviewed` is supplied. It must keep `allSoftwareCoverageComplete=false` because a bounded selected batch range is not proof that every installed app is covered. Keep `scheduledTaskInstalled=false`, `fullContinuousRecording=false`, `screenshotsCaptured=false`, `softwareActionsExecuted=false`, `memoryWritten=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

## All Software Coverage Convergence Audit

Use this after one or more rollout supervisor packets exist and the teacher asks whether all planned coverage batches are done:

```bash
node plugins/transparent-ai-apprentice/scripts/create-all-software-coverage-convergence-audit.mjs \
  --plan "<path to all-software-coverage-expansion-plan.json>" \
  --supervisor "<path to rollout-supervisor-a.json>" \
  --supervisor "<path to rollout-supervisor-b.json>"
```

MCP tool name:

```text
create_all_software_coverage_convergence_audit
```

The audit must output `transparent_ai_all_software_coverage_convergence_audit_v1` and `transparent_ai_all_software_coverage_convergence_audit_receipt_v1`. It aggregates completed, remaining, and audit-gap batches, and may set `coverageConvergedForTeacherReview=true` only when every planned bounded batch has post-batch audit evidence. It must still keep `allSoftwareCoverageComplete=false`, `accepted=false`, `ruleEnabled=false`, `technologyAccepted=false`, and `packagingGated=true`; convergence is evidence for teacher review, not acceptance.

## Convergence Automatic Learning Package

Use this after a convergence audit has reviewed queue paths from advanced rollout batches and the teacher wants those reviewed queues to continue low-token learning with less manual repetition.

```bash
node plugins/transparent-ai-apprentice/scripts/create-convergence-automatic-learning-package.mjs \
  --convergence "<path to all-software-coverage-convergence-audit.json>" \
  --teacher-reviewed \
  --run-once
```

MCP tool name:

```text
create_convergence_automatic_learning_package
```

The package must output `transparent_ai_convergence_automatic_learning_package_v1`, `transparent_ai_convergence_automatic_learning_package_receipt_v1`, a reviewed queue job list, a unified runner, register/unregister scheduled-task scripts, and a start-here readme. It must reuse `run_automatic_low_token_learning_runner` for each reviewed queue instead of inventing a second runner. By default it only generates files; it must not register a Windows Scheduled Task. The register/unregister scripts must require `-TeacherConfirmed`. `--run-once` is a reviewed proof mode and should run only with `--teacher-reviewed` or equivalent explicit confirmation.

Keep `scheduledTaskInstalled=false`, `screenshotsCaptured=false`, `softwareActionsExecuted=false`, `memoryWritten=false`, `nativeUniversalExecution=false`, `allSoftwareCoverageComplete=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`. The package is a low-token continuation aid, not teacher acceptance, memory approval, release, packaging unlock, or proof of universal native execution.

## Low-Token Operation Preflight Policy

When the teacher wants low-token automatic learning and non-expert engineering-software control to share one safe execution boundary, create a preflight policy before any monitor registration, screenshot capture, dry-run escalation, or execute gate:

```bash
node plugins/transparent-ai-apprentice/scripts/create-low-token-operation-preflight-policy.mjs \
  --runner "<automatic-low-token-learning-runner.json>" \
  --visual-check-queue "<automatic-triggered-visual-check-queue.json>" \
  --target-confirmation "<confirmed-numbered-target.json>" \
  --spatial-intent "<transparent-sketch-spatial-intent.json>" \
  --rollback-point "<rollback-point.json>"
```

MCP tool name:

```text
create_low_token_operation_preflight_policy
```

The policy must output `transparent_ai_low_token_operation_preflight_policy_v1` and order the lanes as: metadata-first low-token observation, visual check only after a meaningful changed signal, voice/text numbered target confirmation, transparent 2D/perspective/3D sketch intent, then execution gate plus rollback. It is a review-only policy packet, not an executor: keep `screenshotsCaptured=false`, `softwareActionsExecuted=false`, `targetSoftwareCommandsExecuted=false`, `longTermMemoryWritten=false`, `nativeUniversalExecution=false`, `accepted=false`, `ruleEnabled=false`, `technologyAccepted=false`, and `packagingGated=true`.

## Automatic Observer Schedule

When the teacher has reviewed a `transparent_ai_software_observer_queue_v1` and asks for automatic or scheduled low-token observation, create a schedule package instead of registering a task directly:

```bash
node plugins/transparent-ai-apprentice/scripts/create-automatic-observer-schedule.mjs \
  --queue "<path to software-observer-queue.json>" \
  --interval-minutes 15 \
  --cycles-per-run 1
```

MCP tool name:

```text
create_automatic_observer_schedule
```

The schedule must output `transparent_ai_automatic_observer_schedule_v1`, a receipt, `run-scheduled-observer.ps1`, `register-scheduled-observer-task.ps1`, `unregister-scheduled-observer-task.ps1`, and a teacher readme. The generated register/unregister scripts must require an explicit `-TeacherConfirmed` flag. The scheduled task, if the teacher later registers it, should only launch bounded `run_all_software_observer_supervisor` passes over the reviewed queue. It must not register by default, continuously record, read full logs, capture screenshots by default, enable memory, or claim native universal execution. Keep `scheduledTaskInstalled=false`, `fullContinuousRecording=false`, `screenshotsCaptured=false`, `rawFullLogsRetained=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

## Software Observer Inventory

When the teacher asks about all software on the computer, all logs, every app, or a computer-wide low-token learning setup, do not force them to name one app first. Create an all-software inventory kit:

```bash
node plugins/transparent-ai-apprentice/scripts/create-software-observer-inventory.mjs \
  --goal "Build a low-token observation inventory for software on this computer"
```

MCP tool name:

```text
create_software_observer_inventory
```

The inventory must output `transparent_ai_software_observer_inventory_v1`, a read-only PowerShell probe, `transparent_ai_software_observer_batch_plan_v1`, and a manifest. The probe should summarize running processes, installed applications, candidate log roots, bounded `transparent_ai_all_software_log_source_index_v1` metadata, and Windows Event Log choices before any screenshots. The log-source index must record paths, size, mtime, extension, and low-token use, not log contents; keep `logContentsRead=false` and read tails only later on triggers. The batch plan must route selected candidates into `create_software_capability_profile`, `create_software_observer_queue`, `create_adaptive_software_observer_from_profile`, and `create_universal_software_observer_kit`. The ordinary `teach_apprentice` entry should route all-software/all-log requests to this inventory and return `status=waiting_for_software_inventory_review` with `softwareObserverInventory`. This is inventory and planning, not a guarantee that every app exposes useful logs and not native universal execution; keep `fullContinuousRecording=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

## Software Observer Queue

After the inventory probe has produced `transparent_ai_software_observer_inventory_v1`, turn the raw candidates into a bounded, teacher-reviewable queue before creating dozens of observers:

```bash
node plugins/transparent-ai-apprentice/scripts/create-software-observer-queue.mjs \
  --inventory "<path to software-observer-inventory.json>" \
  --max-candidates 30 \
  --max-files-per-candidate 8
```

MCP tool name:

```text
create_software_observer_queue
```

The queue must output `transparent_ai_software_observer_queue_v1`, `next-observer-calls.json`, and a teacher readme. It should reuse `candidateLogFiles` from the inventory log-source index first, then use bounded metadata scanning only: log-like file paths, last-write time, byte size, process/window metadata, Windows Event Log names, and manual teacher markers. It must not read full logs, capture screenshots, or start native app actions. Each queue item should carry ready next calls for `create_software_capability_profile`, `create_universal_software_observer_kit`, `watch_log_source_metadata_deltas`, `run_software_observer_queue_item`, `compact_universal_observation_learning_events`, and then `teach_apprentice`. Keep `fullContinuousRecording=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

## Log Source Metadata Delta Gate

Before reading even bounded log tails in a repeated observation pass, use the metadata-only gate:

```bash
node plugins/transparent-ai-apprentice/scripts/watch-log-source-metadata-deltas.mjs \
  --queue "<path to software-observer-queue.json>" \
  --state-dir ".transparent-apprentice/log-source-metadata-state"
```

MCP tool name:

```text
watch_log_source_metadata_deltas
```

The gate must output `transparent_ai_log_source_metadata_delta_watch_v1` and a receipt. It compares only existence, byte size, last-write time, extension, and metadata hash for reviewed candidate logs; keep `logContentsRead=false`, `fullLogsRead=false`, `screenshotsCaptured=false`, and `fullContinuousRecording=false`. If no metadata changed, skip tail reads and screenshots for that pass. If metadata changed, use the emitted narrowed queue or `nextTailReadCall` so later tail reads happen only for changed logs.

To run one reviewed queue item into actual low-token learning evidence, use the queue item runner instead of manually chaining scripts:

```bash
node plugins/transparent-ai-apprentice/scripts/run-software-observer-queue-item.mjs \
  --queue "<path to software-observer-queue.json>" \
  --item "<queue item id or software name>" \
  --max-tail-bytes 65536 \
  --max-tail-lines 80
```

MCP tool name:

```text
run_software_observer_queue_item
```

The runner must consume only one reviewed queue item, create a universal observer kit, read only bounded tails from selected candidate logs, write `transparent_ai_universal_software_observation_v1`, compress it into `transparent_ai_compact_learning_events_from_universal_observation_v1`, and write `transparent_ai_software_observer_queue_item_run_receipt_v1`. This is the preferred low-token path after inventory: it turns "possible app logs" into a concrete compact learning packet for `teach_apprentice` while keeping `rawFullLogsRetained=false`, `screenshotsCaptured=false`, `fullContinuousRecording=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, and `packagingGated=true`.

## Software Observation Delta Monitor

After a first queue item run or universal observation exists, compare the previous compact evidence to the current compact evidence before spending tokens on screenshots:

```bash
node plugins/transparent-ai-apprentice/scripts/monitor-software-observation-deltas.mjs \
  --baseline "<previous universal-observation-summary.json or queue-item receipt>" \
  --current "<current universal-observation-summary.json or queue-item receipt>"
```

MCP tool name:

```text
monitor_software_observation_deltas
```

The monitor must output `transparent_ai_software_observation_delta_monitor_v1`, a current snapshot when queue mode is used, and `transparent_ai_software_observation_delta_monitor_receipt_v1`. It should compare baseline/current bounded log summaries, metadata hashes, event summaries, and teacher markers; classify changes as success, state change, warning, failure/blocker, or ambiguity; and recommend a single reviewed screenshot only when cheap signals show failure, warning, ambiguity, or an explicit teacher marker. It must keep `screenshotRequiredByDefault=false`, `screenshotsCaptured=false`, `fullContinuousRecording=false`, `rawFullLogsRetained=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, and `packagingGated=true`.

When a monitor or metadata gate says a visual check may be useful, create a request packet instead of taking screenshots automatically:

```text
create_triggered_visual_check_request
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/create-triggered-visual-check-request.mjs \
  --delta-monitor "<software-observation-delta-monitor.json>"
```

The request must output `transparent_ai_triggered_visual_check_request_v1` and `transparent_ai_triggered_visual_check_receipt_template_v1`. It may request at most one bounded screenshot per changed item, only after teacher review, and should tell the teacher or next agent what changed, which window to inspect, and how to paste the screenshot path back into `teach_apprentice`. A metadata-only gate should normally prefer bounded-tail review first unless the teacher explicitly asks for visual context. The request tool itself must keep `screenshotsCaptured=false`, `fullContinuousRecording=false`, `softwareActionsExecuted=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, and `packagingGated=true`.

For ordinary teachers, turn a triggered visual-check request or automatic visual-check queue into a browser command builder before capture:

```text
create_triggered_visual_check_command_builder
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/create-triggered-visual-check-command-builder.mjs \
  --queue "<automatic-triggered-visual-check-queue.json>"
```

The command builder must output `transparent_ai_triggered_visual_check_command_builder_v1`, `transparent_ai_triggered_visual_check_command_builder_result_v1`, and a local `triggered-visual-check-command-builder.html`. The teacher opens the HTML, selects exactly one changed visual-check request, chooses reviewed-source-image or one-shot active-screen capture mode, and copies the generated command. It also generates follow-up command text for `create_triggered_visual_evidence_learning_handoff` and `create_triggered_visual_evidence_voice_control_workbench` so a single reviewed visual check can flow into learning or voice/text numbered-target control. The builder itself must not run capture, read the screen, open GUI software, execute target software, write memory, enable rules, accept technology, unlock packaging, or claim completion; keep `builderDoesNotCaptureScreenshots=true`, `builderDoesNotExecuteTargetSoftware=true`, `captureRequiresSeparateTeacherConfirmedCommand=true`, `screenshotsCaptured=false`, `softwareActionsExecuted=false`, `targetSoftwareCommandsExecuted=false`, `memoryWritten=false`, `nativeUniversalExecution=false`, `accepted=false`, `ruleEnabled=false`, and `packagingGated=true`.

After the request is reviewed, use `capture_triggered_visual_check` or the equivalent CLI:

```bash
node plugins/transparent-ai-apprentice/scripts/capture-triggered-visual-check.mjs \
  --request "<triggered-visual-check-request.json>"
```

Without teacher confirmation it must dry-run and capture nothing. With `--teacher-confirmed`, it may copy one reviewed screenshot/image or run the generated one-shot active-screen PowerShell runner, then write `transparent_ai_triggered_visual_check_capture_receipt_v1` with one evidence hash and the next `teach_apprentice` call. It must keep `fullContinuousRecording=false`, `softwareActionsExecuted=false`, `nativeUniversalExecution=false`, `memoryEnabled=false`, `accepted=false`, `ruleEnabled=false`, and `packagingGated=true`.

## Software Observer Watch Cycle

When the teacher wants the apprentice to keep learning from many reviewed apps without spending continuous screen tokens, run a low-token watch cycle over the software observer queue:

```bash
node plugins/transparent-ai-apprentice/scripts/run-software-observer-watch-cycle.mjs \
  --queue "<path to software-observer-queue.json>"
```

MCP tool name:

```text
run_software_observer_watch_cycle
```

The first cycle initializes `transparent_ai_software_observer_watch_state_v1` baselines. Later cycles scan multiple queue items, read only bounded tails from a small number of selected log candidates per app, compare metadata/snippet hashes against the persisted baseline, and output `transparent_ai_software_observer_watch_cycle_v1`. The cycle should report only changed signals and create reviewed screenshot requests only for failure, warning, ambiguity, or explicit teacher markers. It must not run as hidden native execution, must not read full logs, and must keep `screenshotsCaptured=false`, `fullContinuousRecording=false`, `rawFullLogsRetained=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, and `packagingGated=true`.

## Adaptive Software Observer Bridge

When a teacher or agent already has `transparent_ai_software_capability_profile_v1` and optionally `transparent_ai_software_capability_probe_result_v1`, do not ask them to manually copy fields into the universal observer. Bridge the profile/probe result into the observer setup:

```bash
node plugins/transparent-ai-apprentice/scripts/create-adaptive-software-observer-from-profile.mjs \
  --profile "<path to software-capability-profile.json>" \
  --probe-result "<optional path to software-capability-probe-result.json>"
```

MCP tool name:

```text
create_adaptive_software_observer_from_profile
```

The ordinary `teach_apprentice` entry should also route a passed `softwareProfile` object, a `softwareCapabilityProfile` path/object, or pasted `transparent_ai_software_capability_probe_result_v1` plus profile into this bridge and return `status=waiting_for_adaptive_observer_review` with `adaptiveObserverSetup`. The bridge selects explicit/probed log files first, falls back to candidate log roots, carries Windows Event Log names, creates the universal observer kit, and writes a `transparent_ai_universal_software_observation_v1` teach template. It must keep `fullContinuousRecording=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

## Universal Software Observer

When the teacher wants the apprentice to learn from arbitrary software, do not assume the app is CAD or SolidWorks. Create a universal low-token observer kit:

```bash
node plugins/transparent-ai-apprentice/scripts/create-universal-software-observer-kit.mjs \
  --goal "What the apprentice should learn from this software" \
  --software "Any target software" \
  --process-name "<optional process name>" \
  --log-root "<optional folder to search>" \
  --windows-event-log "Application"
```

MCP tool name:

```text
create_universal_software_observer_kit
```

The kit must discover cheap local evidence before screenshots: teacher-provided log paths, log root folders, process-name matches under AppData/ProgramData/Temp/workspace, Windows Event Log entries, file modified-time deltas, and manual teacher markers. It emits `transparent_ai_universal_software_observation_v1` for `teach_apprentice`. It should adapt to different teacher methods: step narration, before/after examples, drawn overlay annotations, voice explanation, screen event exports, logs, and manual markers. This is not a guarantee that every software exposes useful logs, and it is not universal native control; keep `fullContinuousRecording=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

## Compact Universal Learning Events

After running the universal observer collector, compress `transparent_ai_universal_software_observation_v1` before asking the model to learn from it:

```bash
node plugins/transparent-ai-apprentice/scripts/compact-universal-observation-learning-events.mjs \
  --observation "<universal-observation-summary.json>"
```

MCP tool name:

```text
compact_universal_observation_learning_events
```

The compressor must output `transparent_ai_compact_learning_events_from_universal_observation_v1`: compact log-tail, Windows Event Log, file-delta, and teacher-marker events with classifications such as success/completion, warning, failure/blocker, or state change. It must retain only short snippets and counts, not full logs, and it must keep `rawFullLogsRetained=false`, `screenshotRequiredByDefault=false`, `fullContinuousRecording=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`. The next teacher step is to identify which compact event is the reusable rule boundary and provide a counterexample before any memory approval.

## Transparent Sketch Overlay

When the teacher wants to draw directly over software, create a transparent sketch overlay kit:

```bash
node plugins/transparent-ai-apprentice/scripts/create-transparent-sketch-overlay-kit.mjs \
  --goal "What the teacher wants to explain by drawing" \
  --software "Target software" \
  --mode "2d_3d"
```

MCP tool name:

```text
create_transparent_sketch_overlay_kit
```

The kit must support a browser overlay and a Windows top-most semi-transparent PowerShell overlay. The browser overlay should let the teacher load an optional screenshot/backdrop, draw strokes, mark anchor boxes, choose 2D/perspective/3D depth modes, adjust a depth slider, and download `transparent-sketch-packet.json`. The PowerShell live overlay must sit above visible software and support `1` for 2D, `2` for perspective, `3` for 3D depth, Up/Down for `zHint`, `S` to save, and Esc to close. It must save normalized `normalized_0_to_1` coordinates, `mode`, `planeId`, `zHint`, perspective cues, and depth relationships, not raw screen pixels only, so later spatial interpretation preserves position and depth relationships. It exports `transparent_ai_sketch_overlay_packet_v1` with normalized strokes, anchors, spatial relationships, perspective cues, 2D plane sketches, and 3D depth hints. Use it when the teacher explains by drawing arrows, regions, planes, perspective grids, or depth axes. The packet is spatial teaching evidence for `teach_apprentice`; it does not yet mean the apprentice can execute inside arbitrary software without a software-specific adapter. Keep proposed actions `teacher_review_only` and `nativeSoftwareExecutionImplemented=false`.

## Spatial Intent Interpreter

When the teacher has exported a transparent sketch packet, interpret the 2D position, perspective, relative anchor, and 3D depth cues before compiling any action plan:

```bash
node plugins/transparent-ai-apprentice/scripts/interpret-transparent-sketch-spatial-intent.mjs \
  --overlay-packet "<path to transparent_ai_sketch_overlay_packet_v1.json>"
```

MCP tool name:

```text
interpret_transparent_sketch_spatial_intent
```

The interpreter must output `transparent_ai_spatial_intent_interpretation_v1` with stroke geometry, inferred relationships such as `moves_toward`, `perspective_to`, `nearer_than`, and `farther_than`, suggested click/drag actions, confidence scores, and teacher review questions. This is a public review artifact, not native execution. It must keep `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`. `create_supervised_software_action_kit` should embed this interpretation before producing dry-run actions.

## Spatial Software Execution Route Bridge

After the teacher confirms exactly one numbered 2D, perspective, or 3D depth target, bind that selected target to software execution routes before any real action:

```bash
node plugins/transparent-ai-apprentice/scripts/create-spatial-software-execution-route-bridge.mjs \
  --goal "What the confirmed sketch target should accomplish" \
  --software "Target software" \
  --overlay-packet "<transparent_ai_sketch_overlay_packet_v1 path>" \
  --target-confirmation "<transparent_ai_numbered_target_confirmation_v1 path>" \
  --selected-number 2 \
  --control-channel-profile "<optional transparent_ai_software_control_channel_profile_v1 path>"
```

MCP tool name:

```text
create_spatial_software_execution_route_bridge
```

The bridge must output `transparent_ai_spatial_software_execution_route_bridge_v1`, `transparent_ai_selected_spatial_execution_target_v1`, and `transparent_ai_spatial_software_execution_route_receipt_v1`. If no selected number or confirmation receipt exists, it must stop at `waiting_for_numbered_spatial_target_confirmation` and recommend `create_spatial_target_confirmation_kit`; it must not continue with route planning. When a selected number exists, it must first read `transparent_ai_universal_detail_logic_contract_v1` from the spatial intent interpretation or overlay packet. If any consequential detail has `missing_evidence_blocks_execution`, or the contract is missing, it must stop at `blocked_missing_detail_logic_before_execution_route`, keep `routeCandidateCount=0`, set `nextRequiredGate=teacher_detail_logic_review`, and ask the teacher to provide the missing data, formula, constraint, relationship, exception, or explicit decorative/non-parametric classification. Only when `detailLogicGate.ready=true` may it keep `selectedTargetOnly=true`, bind that single teacher-confirmed target to route candidates, and recommend dry-run-first calls to `create_existing_software_execution_adapter` plus post-action review through `create_post_action_evidence_checkpoint`. It should prefer reviewed API, CLI/script, browser, or file import/export routes from `create_software_control_channel_profile` before supervised Windows UI automation. It must not execute software, send target software commands, capture screenshots, continuously record, write memory, accept outcomes, enable rules, unlock packaging, or claim universal native execution.

## Existing Software Execution Adapter

Before turning reviewed sketch intent into UI actions, choose the cheapest existing software execution route:

```bash
node plugins/transparent-ai-apprentice/scripts/create-existing-software-execution-adapter.mjs \
  --goal "What the reviewed action should accomplish" \
  --software "Target software" \
  --action-plan "<optional supervised-action-plan.json>"
```

MCP tool name:

```text
create_existing_software_execution_adapter
```

The adapter selector must output `transparent_ai_existing_software_execution_adapter_selection_v1` and rank existing routes such as `existing-browser-automation`, `existing-cli-or-script`, `existing-application-api`, `existing-file-import-export`, and `existing-windows-ui-automation`. Prefer documented APIs, CLI/script commands, browser automation, or file import/export before generic mouse/keyboard actions, and respect an explicit reviewed `preferredAdapter` as a strong route hint. It must also write `transparent_ai_existing_software_execution_package_v1` with dry-run-first runner files: `run-existing-browser-automation.mjs`, `run-existing-cli-or-script.ps1`, `run-existing-application-api-request.mjs`, `prepare-existing-file-import-export.mjs`, or `run-existing-windows-ui-automation.ps1` as applicable. Each runner entry must include `routeReadiness`, `executeBlocker`, and a route-specific proof checklist: browser routes need reviewed URL/selectors; CLI/script routes need a reviewed command or script; API routes need a reviewed method, payload, and auth boundary; file import/export routes need a save-copy, schema or mapping, diff, and rollback path; Windows UI routes need target-window and low-token verifier evidence. The generated runners must default to dry-run, write `transparent_ai_existing_software_execution_receipt_v1`, and require explicit teacher confirmation plus execute flags before any real route-specific action. The browser runner may perform controlled browser actions only when `--teacher-confirmed --execute --reviewed-browser-target <json>` are supplied. For `targetKind="local-html-dom"`, the reviewed target must have `teacherReviewed=true`, a local HTML file, an id selector, `operation="setText"`, a plain target output file name, and optional expected source hash, and the runner may write only inside `browser-dom-output` while recording source/output hashes. For `targetKind="local-browser-cdp"`, the reviewed target must have `teacherReviewed=true`, a localhost/loopback `cdpEndpoint` or `webSocketDebuggerUrl`, a selector, `operation="setText"`, and a plain target response file name, and the runner may send only a reviewed `Runtime.evaluate` setText expression through Chrome DevTools Protocol, write only inside `browser-cdp-output`, record the CDP result hash, and reject public-network, non-loopback, or credential-bearing endpoints. This does not prove arbitrary Playwright control or arbitrary webpage automation. The file import/export runner may perform the first controlled real action only when `--teacher-confirmed --execute --reviewed-mapping <json>` are supplied; the reviewed mapping must have `teacherReviewed=true`, a source file, a plain target file name, and optional expected source hash, and the runner may write only inside the execution package's `prepared-import-files` directory while recording hashes and backup evidence. The CLI/script runner may perform the first controlled real action only when `-TeacherConfirmed -Execute -ReviewedCommand <json>` are supplied; the reviewed command must have `teacherReviewed=true`, `commandKind="node-script"`, a script source file, a plain target output file name, and the expected script SHA-256, and the runner may write only inside the execution package's `cli-output` directory while recording script/output hashes and exit code. The application API runner may perform the first controlled real action only when `--teacher-confirmed --execute --reviewed-api-request <json>` are supplied; the reviewed request must have `teacherReviewed=true`, a localhost or loopback URL, an allowed method, a plain target response file name, optional JSON/text body, and no secret or session headers, and the runner may write only inside the execution package's `api-responses` directory while recording response status, response path, and response hash. The Windows UI runner may perform supervised generic UI actions only when a reviewed supervised action plan is provided through `-ReviewedActionPlan`, `-TeacherConfirmed -Execute` are present, a reviewed target window title exists, active-window title preflight matches, and normalized coordinate checks pass; it must write `transparent_ai_existing_windows_ui_preflight_v1`, block with `blocked_by_preflight` and `uiEventsSent=false` on mismatch, and still require low-token post-action verification before learning. The package is review-only: it can recommend a dry-run route and next MCP calls, but it must not enable rules, save memory, register background tasks, directly modify third-party app files, send arbitrary public-network API calls, or claim universal native control. Keep `reviewOnly=true`, `noAutonomousExecution=true`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

## Supervised Software Action Bridge

When a reviewed transparent sketch packet should become software actions, create a supervised action bridge kit:

```bash
node plugins/transparent-ai-apprentice/scripts/create-supervised-software-action-kit.mjs \
  --goal "What the reviewed overlay action should accomplish" \
  --software "Target software" \
  --overlay-packet "<transparent_ai_sketch_overlay_packet_v1 path>"
```

MCP tool name:

```text
create_supervised_software_action_kit
```

The kit must first embed the spatial intent interpretation, then compile the overlay packet into `transparent_ai_supervised_software_action_plan_v1` with candidate `click`, `drag`, `type_text`, and `hotkey` actions. It must also write standalone `spatial-execution-readiness.json` using `transparent_ai_spatial_execution_readiness_v1` and mirror that packet in the action plan, binding each action to the source stroke and recording whether 2D position, perspective, and 3D depth relationships are preserved before execution review. The teacher should review this readiness file before any runner pass, especially for voice/text engineering commands where numbered targets were inferred from language. It must also write `transparent_ai_supervised_software_action_preflight_v1` with active-window expectations, normalized coordinate bounds, action risk, and low-token verification signals. The generated PowerShell runner must default to `dry_run`, write preflight plus `transparent_ai_supervised_software_action_execution_receipt_v1`, and send no mouse or keyboard events unless the teacher runs it with both `-TeacherConfirmed` and `-Execute`. If a target window title is provided and the foreground window does not match, the runner must write `blocked_by_preflight` before sending UI events. After any runner pass, prefer low-token evidence first: the preflight, execution receipt, target software log metadata deltas, event counts, file modified-time deltas, or a manual teacher marker; trigger screenshots only when those cheap signals are ambiguous. The target software must be open, visible, active, and supervised by the teacher. This is a generic UI bridge for feasibility, not universal native app control; keep `nativeUniversalExecution=false`, `fullContinuousRecording=false`, `requiresActiveTargetWindow=true`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

## Supervised Action Outcome Verification

After the supervised runner or existing execution adapter runner writes an execution receipt, verify the outcome before learning from it:

```bash
node plugins/transparent-ai-apprentice/scripts/verify-supervised-action-outcome.mjs \
  --receipt "<transparent_ai_supervised_software_action_execution_receipt_v1 or transparent_ai_existing_software_execution_receipt_v1 path>" \
  --plan "<optional supervised-action-plan.json>" \
  --preflight "<optional supervised-action-preflight.json>" \
  --queue "<optional transparent_ai_software_observer_queue_v1 path>"
```

MCP tool name:

```text
verify_supervised_action_outcome
```

The verifier must output `transparent_ai_supervised_action_outcome_verification_v1` and a receipt. It accepts both `transparent_ai_supervised_software_action_execution_receipt_v1` and `transparent_ai_existing_software_execution_receipt_v1`, then uses the runner receipt, preflight status when present, optional `watch_log_source_metadata_deltas`, file/event markers, and manual teacher markers before any screenshot or memory write. It must keep `logContentsRead=false`, `fullLogsRead=false`, `screenshotsCaptured=false`, `fullContinuousRecording=false`, `nativeUniversalExecution=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`. If metadata changed, continue only with the narrowed queue or bounded tail read. If the receipt is dry-run or blocked, do not infer success. If the teacher has not confirmed the visible result matched the overlay intent or existing-route target, do not save a rule.

For ordinary teachers, `teach_apprentice` should also accept a pasted `transparent_ai_sketch_overlay_packet_v1` in a normal `message` or `overlayPacket` field and route it to this bridge automatically. It should also accept a pasted `transparent_ai_supervised_software_action_execution_receipt_v1`, `transparent_ai_existing_software_execution_receipt_v1`, or receipt path and route it to `verify_supervised_action_outcome`. The returned teacher cards should have `status=waiting_for_supervised_action_review` or `status=waiting_for_supervised_outcome_review`; the default MCP surface should still hide the lower-level construction tool list.

## Post-Action Evidence Checkpoint

When the teacher wants to know whether a supervised action actually changed software state, prefer a low-token before/after checkpoint before screenshots or learning:

```bash
create_post_action_evidence_checkpoint
```

Use it before execution with watched files or directories to write a `transparent_ai_post_action_low_token_state_snapshot_v1`; after execution, pass the before state, execution receipt, the same watched paths, optional reviewed observer queue, and teacher markers. The tool writes `transparent_ai_post_action_low_token_evidence_checkpoint_v1`, `transparent_ai_post_action_low_token_evidence_checkpoint_receipt_v1`, and a teacher README. It compares only cheap metadata: path existence, kind, size, mtime, sampled directory child metadata, receipt status, metadata-only log gates, and teacher markers. It must not read file contents, read full logs, capture screenshots, continuously record, execute software, save memory, accept outcomes, or unlock packaging.

If cheap state evidence changed, wait for teacher review before learning. If a teacher-confirmed execution receipt exists but no cheap state evidence changed, the checkpoint may recommend `create_triggered_visual_check_request` with `maxScreenshots=1`; this is still a reviewed request, not an automatic screenshot. Ordinary `teach_apprentice` should route explicit post-action evidence requests with receipt/before-state/watched files to this checkpoint and return `status=waiting_for_post_action_evidence_review`. Keep `fileContentsRead=false`, `logContentsRead=false`, `screenshotsCaptured=false`, `fullContinuousRecording=false`, `softwareActionsExecuted=false`, `nativeUniversalExecution=false`, `outcomeAccepted=false`, `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

## Closed-Loop Learning Workflow

When the teacher wants the apprentice to learn a repeatable worker-helper skill deeply instead of parroting examples, create a closed-loop workflow before saving memory:

```bash
node plugins/transparent-ai-apprentice/scripts/create-learning-workflow.mjs \
  --goal "Repeatable task the apprentice should learn" \
  --domain "office work, CAD workalong, browser workflow, ERP, or spreadsheet work" \
  --future-input "Transfer task to test before memory approval"
```

MCP tool name:

```text
create_learning_workflow
```

The workflow must output `transparent_ai_learning_workflow_v1` with low-token observation, task decomposition, `causal_model`, `boundaries_counterexamples`, practice replay, mastery gates, teacher approval, profile memory, deployment monitoring, and failure recovery. It should reuse existing capabilities instead of building new infrastructure first: work-along kits for event-driven observation, `teach_apprentice` for evidence ingestion, `run_apprentice_profile` for learned work, `correct_last_result` for failure feedback, and `review_apprentice_profile` for memory review.

The anti-parrot gate is mandatory. Before memory can be saved, the apprentice must explain the causal evidence, pass at least one counterexample, reproduce on a transfer task, and preserve a failure-recovery path. If these gates are missing, keep `ruleEnabled=false`, `accepted=false`, `technologyAccepted=false`, and `packagingGated=true`.

## Teach-Execute Learning Loop

When the teacher asks for the whole original objective together, create a single reviewable loop runbook instead of asking them to choose every advanced tool manually:

```bash
node plugins/transparent-ai-apprentice/scripts/create-teach-execute-learning-loop.mjs \
  --goal "Observe arbitrary software, learn cheaply, interpret teacher sketches, execute under supervision, and learn from receipts" \
  --software "Target software or all-software setup"
```

MCP tool name:

```text
create_teach_execute_learning_loop
```

The loop must output `transparent_ai_teach_execute_learning_loop_v1` and chain the existing tools in order: `create_rollback_point`, `create_software_observer_inventory`, `create_software_capability_profile`, `create_adaptive_software_observer_from_profile`, `create_universal_software_observer_kit`, `compact_universal_observation_learning_events`, `create_transparent_sketch_overlay_kit`, `interpret_transparent_sketch_spatial_intent`, `create_software_control_channel_profile`, `create_existing_software_execution_adapter`, `create_supervised_software_action_kit`, `start_teach_execute_action_rehearsal`, `start_teach_execute_supervised_execution`, `verify_supervised_action_outcome`, `create_post_action_evidence_checkpoint`, `teach_apprentice`, and correction/approval memory tools. This is a runbook and verification scaffold, not a hidden executor; it must profile existing APIs, macros, CLI/script routes, browser automation, and file import/export before generic UI actions, route runner calls through the supervised execution gate, compare post-action cheap state evidence before screenshots or learning, and keep `fullContinuousRecording=false`, `nativeUniversalExecution=false`, `accepted=false`, `ruleEnabled=false`, `technologyAccepted=false`, and `packagingGated=true` until teacher review proves each stage.

To move beyond a plan without crossing the execution boundary, safely start a reviewed runbook:

```bash
node plugins/transparent-ai-apprentice/scripts/start-teach-execute-safe-run.mjs \
  --runbook-path "<path to teach-execute-learning-loop.json>"
```

MCP tool name:

```text
start_teach_execute_safe_run
```

Ordinary `teach_apprentice` may route a pasted `transparent_ai_teach_execute_learning_loop_v1` JSON or `teach-execute-learning-loop.json` path to this safe starter. The output must be `transparent_ai_teach_execute_safe_start_v1` with review-only teacher method profile, all-software observer bootstrap, transparent 2D/perspective/3D overlay kit, and existing execution adapter selection. It must keep `softwareActionsExecuted=false`, `screenshotsCaptured=false`, `scheduledTaskRegistered=false`, `memoryEnabled=false`, `accepted=false`, `ruleEnabled=false`, `nativeUniversalExecution=false`, and `packagingGated=true`.

After the teacher reviews safe-start materials and explicitly confirms read-only observation, advance to the first real low-token observation step:

```bash
node plugins/transparent-ai-apprentice/scripts/start-teach-execute-reviewed-observation.mjs \
  --safe-start-path "<path to teach-execute-safe-start.json>" \
  --teacher-confirmation "I confirm read-only observation only"
```

MCP tool name:

```text
start_teach_execute_reviewed_observation
```

Ordinary `teach_apprentice` may route a pasted `transparent_ai_teach_execute_safe_start_v1` JSON or `teach-execute-safe-start.json` path to this reviewed observation starter. Without explicit confirmation, the tool must write `blocked_waiting_for_teacher_confirmation` and must not run local probes. With confirmation, it may run the bounded read-only all-software inventory probe, apply private-app exclusions, create a reviewed observer queue, and initialize a bounded watch baseline. It must keep `softwareActionsExecuted=false`, `screenshotsCaptured=false`, `fullContinuousRecording=false`, `rawFullLogsRetained=false`, `memoryEnabled=false`, `accepted=false`, `ruleEnabled=false`, `nativeUniversalExecution=false`, and `packagingGated=true`.

After the teacher reviews the observation queue and exports a transparent overlay packet from the drawing mask, advance to a supervised execution rehearsal:

```bash
node plugins/transparent-ai-apprentice/scripts/start-teach-execute-action-rehearsal.mjs \
  --reviewed-observation "<path to teach-execute-reviewed-observation.json>" \
  --overlay-packet "<path to transparent-sketch-packet.json>" \
  --teacher-confirmation "teacher confirmed action rehearsal"
```

MCP tool name:

```text
start_teach_execute_action_rehearsal
```

Ordinary `teach_apprentice` may route a pasted `transparent_ai_teach_execute_reviewed_observation_v1` JSON/path plus a `transparent_ai_sketch_overlay_packet_v1` JSON/path to this rehearsal starter when the teacher explicitly asks for action rehearsal and confirms it. The result must be `transparent_ai_teach_execute_action_rehearsal_v1` with spatial intent interpretation, supervised action plan, existing execution adapter selection, dry-run preflight/receipt, and low-token outcome verification. The runner is invoked only in dry-run mode by this starter. It must keep `softwareActionsExecuted=false`, `screenshotsCaptured=false`, `fullContinuousRecording=false`, `rawFullLogsRetained=false`, `memoryEnabled=false`, `accepted=false`, `ruleEnabled=false`, `nativeUniversalExecution=false`, `explicitExecuteStillBlocked=true`, and `packagingGated=true`.

After the teacher reviews the action rehearsal, use the supervised execution gate instead of calling the generated runner directly:

```bash
node plugins/transparent-ai-apprentice/scripts/start-teach-execute-supervised-execution.mjs \
  --action-rehearsal "<path to teach-execute-action-rehearsal.json>" \
  --teacher-confirmation "teacher confirmed supervised execution"
```

MCP tool name:

```text
start_teach_execute_supervised_execution
```

Ordinary `teach_apprentice` may route a pasted `transparent_ai_teach_execute_action_rehearsal_v1` JSON/path to this gate when the teacher explicitly asks for supervised execution and confirms it. Without `--execute`, the gate must run the generated supervised runner only in dry-run mode, write `transparent_ai_teach_execute_supervised_execution_v1`, and verify the runner receipt with `verify_supervised_action_outcome`. With `--execute`, the gate must require explicit teacher confirmation, a target window title that is already baked into the reviewed action plan, and explicit spatial readiness confirmation through `--spatial-readiness-confirmation` or `--spatial-readiness-confirmed`; otherwise it must block before calling the runner. The spatial readiness confirmation means the teacher has reviewed `spatial-execution-readiness.json` and agrees that the inferred 2D position, perspective, and 3D depth relationships match the visible target. If this is missing, write `blocked_spatial_execution_readiness_not_confirmed` before runner invocation. Even when the runner reports `executed_under_teacher_supervision`, the gate must keep `accepted=false`, `ruleEnabled=false`, `technologyAccepted=false`, `packagingGated=true`, `fullContinuousRecording=false`, `screenshotsCaptured=false`, `rawFullLogsRetained=false`, `nativeUniversalExecution=false`, and wait for teacher outcome review before learning.

## Rollback Points

Create rollback points before a direction change could be hard to undo: starting a new learning direction, importing a large demonstration, applying a correction to memory, saving profile memory, packaging a plugin, refreshing a cache, or replacing generated artifacts. Use:

```bash
node plugins/transparent-ai-apprentice/scripts/create-rollback-point.mjs \
  --label "Short checkpoint name" \
  --reason "Why this checkpoint exists" \
  --path "<workspace file or directory to snapshot>"
```

MCP tool names:

```text
create_rollback_point
confirm_rollback_point
```

Do not delete rollback points just because the next step passed locally. Keep them until the teacher explicitly confirms the direction is correct. Only then call `confirm_rollback_point` or `confirm-rollback-point.mjs`; deletion requires both explicit teacher confirmation and `--delete-after-confirmation`. This protects the teacher from losing a known-good state when the apprentice learns in the wrong direction.

When a visual teacher has no artifact yet, create a starter kit before asking them to explain the workflow precisely:

```bash
node plugins/transparent-ai-apprentice/scripts/create-visual-teaching-kit.mjs \
  --goal "What the teacher wants the apprentice to learn visually" \
  --tool "draw.io or Excalidraw" \
  --future-input "Optional future task to replay"
```

MCP tool name:

```text
create_visual_teaching_kit
```

The kit should produce editable draw.io, Excalidraw, and Mermaid templates, a short teacher checklist, and the next `teach_apprentice`/advanced `continue_teaching` calls for edited files, pasted screen events, or natural teacher replies. It is a feasibility-first wrapper around existing visual tools, not a custom drawing surface. It must keep `ruleEnabled=false`, `accepted=false`, and `packagingGated=true`.

When the teacher pastes existing local file paths into a normal `message`, treat them as artifact evidence if the paths exist and look like supported teaching files: draw.io, Excalidraw, SVG, screenshot image, JSON, Mermaid, Markdown, text, PDF, or CSV. Infer readable tool labels such as `draw.io`, `Excalidraw`, `Mermaid`, `screenshot`, `structured artifact`, `notes`, `document`, or `spreadsheet`. Route one pasted path to the same review-only artifact teaching path, and route multiple pasted paths through the existing review-only demonstration capture path instead of asking the teacher to repeat them in `artifact` or `files` parameters.

When the teacher has a screen recording, browser recorder output, Playwright trace summary, or Jam-like event array/object, accept the pasted `screenEvents`, `eventLog`, `screenEventLog`, `recordingEvents`, or `traceEvents` evidence through `teach_apprentice`/advanced `continue_teaching` instead of asking the teacher to save a JSON file or restate every click.

When the teacher pastes recorder or trace JSON directly into a normal `message`, including fenced ```json blocks, parse it as screen-event evidence if it contains `events`, `userEvents`, `steps`, or `actions`. Route it through the same review-only pasted screen-event teaching path instead of asking the teacher to move the JSON into an `eventLog` parameter or save it as a file.

When the teacher only has a Jam link, browser recorder link, Playwright trace link, or other screen recording URL, create a review-only recording artifact instead of forcing them to rewrite the whole workflow:

```bash
node plugins/transparent-ai-apprentice/scripts/create-recording-demonstration-artifact.mjs \
  --recording-url "https://example.com/recording" \
  --source-tool "Jam" \
  --observation "What the teacher wants Codex to watch for" \
  --step "Optional observed step" \
  --future-input "Optional future task to replay"
```

MCP tool name:

```text
create_recording_demonstration_artifact
```

The recording artifact should preserve the URL, teacher observation, optional observed steps, validation checkpoints, and next teaching call. It is review-only evidence; it must not claim that the private recording was fully inspected unless a connector or explicit extracted events are available, and it must keep `ruleEnabled=false`, `accepted=false`, and `packagingGated=true`.

For the ordinary `teach_apprentice` entry, also treat a normal `message` that contains a Jam URL, Playwright trace URL, browser-recorder/replay URL, or direct video recording URL as recording evidence. Infer a readable source tool such as `Jam`, `Playwright trace`, `browser recorder`, or `screen recording`, then route it to the same review-only recording artifact path instead of asking the teacher to copy the link into a `recordingUrl` parameter.

When the teacher replies naturally after a replay or learning card, prefer `teach_apprentice` with `reply` or `teacherResponse` before asking them to choose a tool. Approval-like replies such as "对，就这样，批准这次回放" may call `approve_teaching_memory`; approval plus save intent such as "批准并记住，下次也这样处理" may approve the current replay and then call `save_apprentice_memory` with `profileName`; correction-like replies such as "不对，只有有政策备注的退款才这样处理" may call `correct_last_result`; ambiguous replies must ask for clarification and must not enable memory.

When the teacher can describe the actions they took, create a review-only action sequence artifact:

```bash
node plugins/transparent-ai-apprentice/scripts/create-action-sequence-artifact.mjs \
  --goal "What the ordered actions should teach" \
  --tool "browser workflow" \
  --step "Open the customer ticket" \
  --step "Select the refund category" \
  --step "Type the request for photo evidence" \
  --future-input "Optional future task to replay"
```

MCP tool name:

```text
create_action_sequence_artifact
```

This artifact is useful when the teacher says "watch the steps I take" or "do it in this order." It is not acceptance; it must keep `ruleEnabled=false`, `accepted=false`, and `packagingGated=true`.

For the ordinary `teach_apprentice` entry, accept ordered actions as a `steps` array when the teacher or agent already has structure, but prefer lower-friction text when the teacher is just describing what they did. Accept `stepsText`, `actionsText`, or `demonstrationText` with numbered lines, bullet lines, or narration such as `first open the ticket, then check the policy note, finally route it to review`. Also parse normal `message` text when it clearly contains at least two ordered steps, including Chinese signals such as `先`, `然后`, and `最后`. Route those steps into the same review-only action sequence engine instead of asking the teacher to rewrite them as JSON.

When the teacher has examples instead of a drawing, create a review-only example artifact:

```bash
node plugins/transparent-ai-apprentice/scripts/create-example-teaching-artifact.mjs \
  --goal "What the examples should teach" \
  --before "Input example 1" \
  --after "Expected output 1" \
  --before "Input example 2" \
  --after "Expected output 2" \
  --future-input "Optional future input to replay"
```

MCP tool name:

```text
create_example_teaching_artifact
```

This artifact is useful when the teacher says "here are a few examples, learn this pattern." It is not acceptance; it must keep `ruleEnabled=false`, `accepted=false`, and `packagingGated=true`.

For the ordinary `teach_apprentice` entry, accept example pairs directly as `examples`, `trainingExamples`, or `beforeAfterExamples` with fields such as `{input, output}`, `{before, after}`, or `{prompt, answer}`. Also accept `examplesText`, `examplesMarkdown`, or `exampleText` pasted from notes, using formats such as `Input: ... Output: ...`, `Before: ... After: ...`, Chinese `输入: ... 输出: ...`, one-line `before -> after` examples, Markdown tables, or CSV/TSV tables with input/output-style headers. Route all of them into the same review-only before/after engine instead of asking the teacher to split the examples into separate arrays.

For a first-time teacher who needs only routing advice, use the guided teaching intake. It turns a plain goal into the simplest existing-tool route, the evidence to collect, and the next MCP call. It must not create accepted rules or enable memory.

MCP tool name:

```text
start_guided_teaching
```

Use it when the teacher says things like "I want to show you how I do this", "I have a screenshot", "I recorded it", "I can draw it", or "I do not know how to explain this precisely." The output should recommend an existing-tool route first, such as draw.io, Excalidraw, Mermaid, screenshot, screen recording or event log, browser workflow, structured file, or teacher conversation.

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/start-guided-teaching.mjs \
  --goal "What the teacher wants the apprentice to learn" \
  --context "Optional app, domain, or workflow context" \
  --artifact "<optional existing-tool export path>" \
  --future-input "Optional small replay example"
```

If the teacher wants to demonstrate visually but does not yet have an artifact, create an editable existing-tool template instead of building a custom canvas:

```bash
node plugins/transparent-ai-apprentice/scripts/create-visual-teaching-template.mjs \
  --goal "What the teacher wants the apprentice to learn" \
  --tool "draw.io, Excalidraw, or Mermaid" \
  --future-input "Optional replay example to place in the template"
```

MCP tool name:

```text
create_visual_teaching_template
```

This creates draw.io, Excalidraw, and Mermaid files under `.transparent-apprentice/visual-templates/`. The teacher should open one of those files in the existing drawing or diagram tool, replace the placeholders with the real before state, teacher action, correct result, boundary, and replay example, then use the edited file with `create_demonstration_capture` or `teach_by_demonstration`. The template is only a teaching aid; it must keep `ruleEnabled=false`, `accepted=false`, and `packagingGated=true`.

For normal use after intake, prefer the one-step teaching entry before exposing lower-level session details. It accepts either an artifact or teacher message, creates a session when needed, saves public trace rows, drafts disabled memory, and optionally replays a future input.

When the teacher has multiple existing artifacts from a hands-on demonstration, package them first:

```bash
node plugins/transparent-ai-apprentice/scripts/create-demonstration-capture.mjs \
  --goal "What the teacher demonstrated" \
  --tool "draw.io plus screenshots" \
  --file "<before-screenshot-or-export>" \
  --file "<after-screenshot-or-export>" \
  --teacher-action "What the teacher did" \
  --taught-behavior "Behavior to draft for review"
```

MCP tool name:

```text
create_demonstration_capture
```

This creates a review-only capture manifest under `.transparent-apprentice/captures/`. Use the returned capture path as the `artifact` for `teach_by_demonstration`. The capture manifest is evidence, not acceptance; it must keep `ruleEnabled=false`.

MCP tool name:

```text
teach_by_demonstration
```

CLI equivalent:

```bash
node plugins/transparent-ai-apprentice/scripts/teach-by-demonstration.mjs \
  --name "<assistant-or-task-name>" \
  --task "What the teacher wants to teach" \
  --artifact "<existing-tool-export-path>" \
  --tool "draw.io" \
  --taught-behavior "Draft behavior the apprentice should learn" \
  --future-input "Small future example to replay"
```

For conversation-only teaching, replace `--artifact` with:

```bash
  --teacher-message "What the teacher explained" \
  --apprentice-attempt "What Codex tried" \
  --teacher-correction "What the teacher corrected"
```

This is the default low-friction path. Use lower-level tools only when the teacher or agent needs explicit control over session creation, artifact import, correction, or replay.

If a durable teaching session is useful for lower-level operations, run:

```bash
node plugins/transparent-ai-apprentice/scripts/create-teaching-session.mjs --name "<assistant-or-task-name>"
```

This creates `.transparent-apprentice/sessions/<id>.json` in the current workspace. Use it as the recoverable teaching packet for future Codex turns.

When the teacher wants to demonstrate visually, also start from `assets/templates/tool-adapters.json` and pick an existing-tool route before proposing custom UI.

To import an existing drawing, screenshot, diagram export, screen event log JSON, or text artifact into the session, run:

```bash
node plugins/transparent-ai-apprentice/scripts/import-demonstration-artifact.mjs \
  --session "<session-json-path>" \
  --artifact "<existing-tool-export-path>" \
  --tool "draw.io" \
  --teacher-action "Teacher demonstrated the desired behavior" \
  --taught-behavior "Draft behavior the apprentice should learn"
```

The plugin also provides a local MCP server in `.mcp.json` with tools for creating sessions, importing artifacts, reading the adapter catalog, and verifying the plugin.

When the teacher provides a recording export, Jam-like event log, browser recorder output, or Playwright trace summary, import that artifact before asking the teacher to restate every step. The importer should preserve ordered click/type/select/verify events as review-only evidence and keep `ruleEnabled=false`.

To record a conversational teaching exchange, run:

```bash
node plugins/transparent-ai-apprentice/scripts/record-teacher-exchange.mjs \
  --session "<session-json-path>" \
  --teacher-message "What the teacher explained or demonstrated" \
  --apprentice-attempt "What Codex tried before the correction" \
  --teacher-correction "What the teacher corrected" \
  --taught-behavior "Draft behavior the apprentice should learn"
```

This must create a public exchange trace, a disabled rule draft, and review-only correction evidence. The exchange fields are `teacherMessage`, `apprenticeAttempt`, and `teacherCorrection`. Do not treat a conversation record as acceptance; replay it first.

To apply a teacher correction after Codex misreads a demonstration, run:

```bash
node plugins/transparent-ai-apprentice/scripts/apply-teacher-correction.mjs \
  --session "<session-json-path>" \
  --rule-id "<rule-draft-id>" \
  --correction "This arrow is only an example flow, not a condition" \
  --type "too_broad"
```

Teacher corrections must revise disabled rule drafts, add counterexamples or tighter conditions, and create a public correction trace. They must not enable memory automatically.

To preview whether the corrected draft would affect a future task, run:

```bash
node plugins/transparent-ai-apprentice/scripts/replay-teaching-session.mjs \
  --session "<session-json-path>" \
  --rule-id "<rule-draft-id>" \
  --input "Future task or example to test against the draft"
```

Replay is only a preview. It must show matched cues, proposed behavior, validation, and teacher review questions while keeping `ruleEnabled=false`.

To review what the apprentice has learned so far, run:

```bash
node plugins/transparent-ai-apprentice/scripts/review-teaching-session.mjs \
  --session "<session-json-path>"
```

MCP tool name:

```text
review_teaching_session
```

Use this before asking a teacher to approve memory. It summarizes demonstrations, teaching exchanges, rule drafts, replays, approvals, public traces, the latest teacher review question, and the next teacher action. It is read-only and must not enable memory.

For ordinary teachers, prefer the learning card over raw review JSON:

```bash
node plugins/transparent-ai-apprentice/scripts/show-teaching-card.mjs
```

MCP tool name:

```text
show_teaching_card
```

Use it when the teacher asks "what did it learn?", "is this ready?", "why did it do that?", or "what should I do next?". If the teacher does not provide a session path, use the active teaching session from `.transparent-apprentice/active-session.json`, falling back to latest-session discovery only when needed. The card must summarize evidence, the draft lesson, replay status, public trace fields, and next teacher actions without exposing internal rule ids, trace ids, or private chain-of-thought.

To enable a replayed draft only after explicit teacher approval, run:

```bash
node plugins/transparent-ai-apprentice/scripts/approve-teaching-memory.mjs \
  --teacher-approval "I approve this rule for this teaching session after replay"
```

MCP tool name:

```text
approve_teaching_memory
```

When no session path is provided, approve the active replayed teaching session automatically. Use `--session` or `--rule-id` only when the teacher needs to target an older session or a specific draft. Approval scope is this teaching session only. It may set `ruleEnabled=true` for the approved rule, but it must keep `packagingGated=true` and `technologyAccepted=false`.

To run a future task with approved session memory, run:

```bash
node plugins/transparent-ai-apprentice/scripts/run-learned-task.mjs \
  --session "<session-json-path>" \
  --input "Future task to run with approved memory"
```

MCP tool name:

```text
run_learned_task
```

This is the first point where learned memory may change behavior. It must use only approved session rules, show matched cues and memory provenance, and keep packaging/release gates locked.

To persist an approved rule into a reusable apprentice profile, run:

```bash
node plugins/transparent-ai-apprentice/scripts/save-apprentice-memory.mjs \
  --session "<session-json-path>" \
  --profile-name "<apprentice-name>" \
  --rule-id "<approved-rule-draft-id>"
```

MCP tool name:

```text
save_apprentice_memory
```

This writes approved profile memory under `.transparent-apprentice/apprentices/<apprentice-name>.json`. Save only rules that were replayed and explicitly approved.

To run a future task with persisted apprentice memory, run:

```bash
node plugins/transparent-ai-apprentice/scripts/run-apprentice-profile.mjs \
  --profile-name "<apprentice-name>" \
  --input "Future task to run with persisted profile memory"
```

MCP tool name:

```text
run_apprentice_profile
```

Profile runs must show which approved profile memory matched, which cues matched, and why the action was taken. They must still keep `packagingGated=true` and `technologyAccepted=false`.

If multiple approved profile memories match a future input equally, do not guess. Return `needs_teacher_review_conflict`, leave `selectedMemoryId` empty, list the conflicting memory ids, and ask the teacher to choose, disable, narrow, or reteach. This follows the profile `conflictBehavior=ask_teacher` policy.

To review what a persisted apprentice profile remembers, run:

```bash
node plugins/transparent-ai-apprentice/scripts/review-apprentice-profile.mjs \
  --profile-name "<apprentice-name>"
```

MCP tool name:

```text
review_apprentice_profile
```

Use this when the teacher asks what the apprentice has learned across sessions, why it acted a certain way, what memories are disabled, or what should be taught next. It must summarize enabled memories, disabled memories, known skills, known limits, recent runs, conflict runs, and next teacher actions without changing profile state.

When the teacher says the latest result is wrong, prefer the high-level correction entry before asking for rule ids or memory ids:

```bash
node plugins/transparent-ai-apprentice/scripts/correct-last-result.mjs \
  --correction "What the teacher says was wrong"
```

MCP tool name:

```text
correct_last_result
```

When no session or profile is provided, correct the active teaching session automatically. The active pointer lives at `.transparent-apprentice/active-session.json`; if it is missing or stale, the tool may fall back to latest-session discovery. Use `--session "<session-json-path>"` only when the teacher needs to target an older teaching session. Use `--profile-name` or `--profile` when correcting the latest persisted memory selected by a profile run. This tool must route the correction to the right lower-level tool without requiring the teacher to know a session path, rule id, or memory id.

If a persisted profile memory is too broad, stale, or wrong and the teacher needs exact control, correct it directly:

```bash
node plugins/transparent-ai-apprentice/scripts/correct-apprentice-memory.mjs \
  --profile-name "<apprentice-name>" \
  --memory-id "<profile-memory-id>" \
  --teacher-correction "This memory was wrong because..." \
  --decision "disable"
```

MCP tool name:

```text
correct_apprentice_memory
```

Use `disable` when the memory should stop applying immediately. Use `narrow` or `revise` only when a revised condition or action should be replayed before reuse. Disabled memories must have `reviewStatus=disabled_by_teacher`, must not match future profile runs, and must keep product gates locked.

## Original Goal Readiness Audit

When the teacher asks whether the broad original goal is implemented, do not answer from memory or from a single green smoke. Run the original-goal readiness audit:

```bash
node plugins/transparent-ai-apprentice/scripts/create-original-goal-readiness-audit.mjs
```

Smoke command:

```bash
npm run smoke:plugin-original-goal-readiness-audit
```

The audit must write `transparent_ai_original_goal_readiness_audit_v1` and a teacher-readable `ORIGINAL_GOAL_READINESS_AUDIT_START_HERE.md`. It must map each user requirement to current evidence: all-software low-token log learning, low-token/no continuous recording, teacher-method adaptation, transparent drawing mask, 2D/perspective/3D spatial interpretation, supervised software execution, and voice/text numbered engineering control. It must also keep completion unclaimed when the evidence is only bounded or review-only. In particular, do not mark the full objective complete while unattended all-app monitoring, useful logs for every installed app, or arbitrary native semantic control inside every engineering program remain unproven.

When an operational activation gate exists and the teacher wants to move closer to real automatic low-token learning, use `run_all_software_operational_learning_activation_dry_run_rehearsal` before any system-changing registration. It must invoke the generated registration wrapper only in dry-run mode, capture stdout/stderr/exit code, rerun scheduled-task status verification read-only, and keep scheduled-task registration/start/stop/unregister, screenshots, target software commands, UI events, memory writes, rule enablement, acceptance, packaging, and full unattended completion locked.

After the activation dry-run rehearsal passes, use `create_all_software_operational_learning_registration_execute_gate` before any real scheduled-task registration attempt. It must require explicit teacher registration confirmation plus a retained rollback point, prepare the register and rollback/unregister commands for review, and keep `executeRequestExecuted=false`, `scheduledTaskRegistered=false`, `accepted=false`, `ruleEnabled=false`, and `packagingGated=true`. Actual registration is a separate system-change step, not something the gate performs.

After the registration execute gate is ready and the teacher explicitly approves the system-changing registration attempt, use the approved registration runner instead of copying a raw command by hand:

```bash
node plugins/transparent-ai-apprentice/scripts/run-all-software-operational-learning-registration-approved-runner.mjs \
  --registration-execute-gate "<transparent_ai_all_software_operational_learning_registration_execute_gate_v1 path>" \
  --execute-approved-registration \
  --allow-system-change \
  --teacher-confirmation "teacher confirmed approved registration runner" \
  --rollback-point-created
```

MCP tool name:

```text
run_all_software_operational_learning_registration_approved_runner
```

The approved registration runner must write `transparent_ai_all_software_operational_learning_registration_approved_runner_v1` and `transparent_ai_all_software_operational_learning_registration_approved_runner_receipt_v1`. It may invoke only the existing `run-all-software-recurring-monitor-registration-runner.mjs` request implied by the ready execute gate, and only when `--execute-approved-registration`, `--allow-system-change`, final teacher confirmation, and rollback evidence are present. It must immediately run `verify-all-software-recurring-monitor-registration-status.mjs` after the registration command, and the read-only status verifier is the authoritative proof of whether the task exists and matches the reviewed runner. It must not start the scheduled task, read full logs, capture screenshots, execute target software, send UI events, write memory, enable rules, accept technology, unlock packaging, or claim all-app unattended learning completion. Keep `accepted=false`, `ruleEnabled=false`, `memoryWritten=false`, `screenshotsCaptured=false`, `targetSoftwareCommandsExecuted=false`, `nativeUniversalExecution=false`, `unattendedAllAppMonitoringComplete=false`, and `goalComplete=false`.

After read-only status proves `registered_and_matches_reviewed_runner`, use the post-registration output witness runner before claiming the background/recurring low-token learning chain is useful:

```bash
node plugins/transparent-ai-apprentice/scripts/run-all-software-operational-learning-post-registration-output-witness-runner.mjs \
  --registration-status "<transparent_ai_all_software_recurring_monitor_registration_status_v1 path>" \
  --registration-approved-runner "<transparent_ai_all_software_operational_learning_registration_approved_runner_v1 path>" \
  --dry-run-rehearsal "<transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_v1 path>" \
  --registration-execute-gate "<transparent_ai_all_software_operational_learning_registration_execute_gate_v1 path>" \
  --trigger-reviewed-output \
  --allow-runner-trigger \
  --teacher-confirmation "teacher confirmed post-registration output witness" \
  --rollback-point-created
```

MCP tool name:

```text
run_all_software_operational_learning_post_registration_output_witness_runner
```

The post-registration output witness runner must write `transparent_ai_all_software_operational_learning_post_registration_output_witness_runner_v1` and `transparent_ai_all_software_operational_learning_post_registration_output_witness_runner_receipt_v1`. It directly invokes the same reviewed scheduled runner once using `reviewed_scheduled_runner_direct_invocation`, then immediately reuses `audit_all_software_recurring_monitor_run_output`, `create_all_software_recurring_monitor_teacher_review_packet`, `create_all_software_recurring_monitor_review_decision_replay_queue`, `create_all_software_unattended_learning_audit`, and, when rehearsal/gate evidence is supplied, `create_all_software_operational_learning_post_activation_witness`. It must not register, unregister, start, or stop Windows Scheduled Tasks; must not capture screenshots, execute target software, write memory, enable rules, accept technology, unlock packaging, or claim goal completion; and default replay decisions must remain `needs_teacher_review`.

After a teacher separately performs or approves the registration execute step, or after the approved registration runner produces a post-execute status witness, use `create_all_software_operational_learning_post_activation_witness` before claiming operational automatic learning. It must consume the activation dry-run rehearsal, registration execute gate, read-only registration status, recurring run-output audit, teacher review packet, replay queue, and unattended audit where available. It may report `post_activation_witness_ready_for_teacher_operational_review` only from matching registration plus reviewed recurring output and replay evidence, and it must keep task start, runner launch, screenshots, target software execution, memory writes, rule enablement, packaging, and full-goal completion locked.

## Completion Standard

A teaching loop is not complete until current evidence shows:

- the demonstration or correction was captured,
- a public structured trace exists,
- at least one reusable rule draft or counterexample draft was extracted,
- teacher corrections were captured as review evidence when the first draft was wrong or too broad,
- a replay preview shows whether the corrected draft would affect a future task,
- the draft remains disabled unless the teacher explicitly enabled it,
- explicit teacher approval is recorded before any learned memory changes behavior,
- a replay or learned run shows how the apprentice improved,
- approved memory can be persisted into an apprentice profile and reused in a later profile run,
- profile memory conflicts pause with `needs_teacher_review_conflict` instead of guessing,
- persisted memory can be corrected or disabled when the teacher says it is too broad, stale, or wrong,
- packaging and technology acceptance remain separate from session memory approval.
