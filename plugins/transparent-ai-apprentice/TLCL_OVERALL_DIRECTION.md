# Transparent AI Apprentice Overall Direction: TLCL

This note records the updated overall direction after reviewing the market-direction report supplied by the user.

## Final Positioning

Transparent AI Apprentice should converge on one core direction:

```text
Teachable Logic Contract Layer for AI Workflows
可教学逻辑契约层驱动的 AI 工作系统
```

It is not a stronger chatbot, a universal autonomous Agent, or a tool that claims to control all software. It is the trusted delivery layer that lets strong models enter professional production systems.

The product promise is:

```text
Skill makes AI able to do work.
Transparent AI Apprentice makes AI work verifiable, reusable, deliverable, and auditable.
```

## Core Problem

The market problem is no longer whether AI can generate outputs. The problem is that generated outputs can look correct while still being unusable, unverifiable, or impossible to audit.

Transparent AI Apprentice should solve the missing layer between generation and trusted delivery:

```text
Human teaching
+ senior-model rule extraction
+ Rule DSL
+ Artifact Envelope
+ Workflow
+ Validator Registry
+ Test Cases
+ Approval Gate
+ Audit Chain
+ low-cost runtime execution
```

## Operating Model

The system should separate authority clearly:

- Senior reasoning model: learns, generalizes, drafts rules, compiles contracts, and helps with exception repair.
- Human teacher: reviews rules, confirms responsibility, supplies corrections, and approves high-risk transitions.
- Rule DSL and Rule Package: turn reviewed knowledge into machine-checkable contracts.
- Medium reasoning runtime: executes confirmed workflows under the contract, carries enough reasoning to follow context, explain steps, and escalate when the contract is insufficient.
- Low reasoning/tool layer: runs fixed extraction, formatting, metadata checks, retrieval, and template tasks at low cost.
- Deterministic validators: judge pass, fail, unknown, or error.
- Audit chain: records evidence, rule versions, validator versions, approvals, rollbacks, and blocked transitions.

The critical principle is:

```text
The model proposes and executes; the validator judges; the human owns approval.
```

## First-Stage MVP

The first-stage MVP should converge on:

```text
Transparent overlay
+ detail-logic teaching
+ Artifact Envelope
+ Rule DSL
+ Validator
+ Validation Report
+ audit trail
```

Recommended first domain:

```text
Packaging dieline / simple engineering drawing validation
```

This domain is strong because it proves the key thesis:

```text
Looks right != production-ready.
Generated output != deliverable artifact.
AI needs external structure logic and validators.
```

The MVP flow is:

```text
Teacher uploads a packaging dieline, engineering drawing, or screenshot
-> teacher marks intent on a transparent overlay
-> AI labels candidate targets
-> teacher confirms the target number
-> AI writes a structured operation plan and data-to-output logic explanation
-> teacher corrects one detail relationship
-> system drafts a disabled Rule Card
-> human reviews the rule
-> system compiles Rule DSL / Rule Package
-> new data is applied in dry-run
-> Validator checks pass/fail/unknown/error
-> only reviewed passing rules can become reusable memory
```

## Required Hard Deliverables

The MVP must prove three hard artifacts before broad expansion:

1. Rule DSL

Natural-language corrections become executable and lifecycle-managed rules.

2. Artifact Envelope

Every input becomes a unified structure that validators can inspect, such as `packaging_dieline` objects, relations, context, and source refs.

3. Validator

Validators must output `pass`, `fail`, `unknown`, or `error`.

Blocking policy:

```text
active + blocking + fail = block delivery
active + blocking + unknown = block delivery
validator error = block delivery
```

## Scope Retention And Priority

The following lanes remain required product capabilities from the original user goal. They are not removed. They are prioritized as support lanes that must attach to the TLCL chain instead of outranking it:

- all-software autonomous learning
- unattended computer control
- voice control for every engineering tool
- continuous screen observation
- generic Agent positioning
- complete 3D understanding
- fully automatic CAD operation

The first-stage product must focus on making these lanes contract-bearing and auditable: every observation, voice command, sketch, RAG retrieval, or software action should produce evidence that can enter Artifact Envelope, Rule Card, Rule DSL, validators, approval gates, rollback points, and audit reports.

Packaging dieline validation is a strong first verification scenario after the TLCL skeleton is ready, but it is not the only product goal and does not need to block the contract-layer prototype.

## Commercial Narrative

Transparent AI Apprentice is not competing with Claude, GPT, Gemini, or open-source models. Stronger base models help the system compile better contracts. The product value is the trusted delivery layer around those models:

Distilled skills and stronger model releases are handled as replaceable capability providers, not as the product boundary. A distilled skill can become a low-cost tool layer or a medium-runtime candidate only after it is wrapped by Rule DSL, validators, approval gates, rollback points, audit receipts, and teacher-reviewed evidence. A stronger Claude/GPT/Gemini-class model improves the senior compiler, but it still cannot bypass the contract lifecycle.

```text
We do not make AI better at talking.
We make AI work acceptable for delivery.
```

Investor-facing one-liner:

```text
Transparent AI Apprentice is the training, quality-control, work-license, and responsibility system for AI employees.
```

## Roadmap

Phase 1, 1-2 months:

- Rule Card schema
- Artifact Envelope schema
- Validation Report schema
- Rule Package compiler
- Expression Validator
- Policy Gate Validator
- packaging glue-tab width demo
- pass/fail/unknown reports

Phase 2, 2-4 months:

- Topology Validator
- Geometry Validator
- packaging face/edge/tab/line representation
- connectedness checks
- cut/fold line conflict checks
- glue-tab attachment checks
- localized error report

Phase 3, 4-6 months:

- Senior Model Rule Compiler
- Medium Reasoning Runtime
- Low Reasoning Tool Layer
- Reasoning Budget Router
- Escalation Policy
- TLCL Runtime Gate: Validation Report + teacher correction -> `medium_runtime_allowed` or `escalate_to_senior_compile`
- cost/reliability experiment comparing direct strong model, direct low-cost model, medium model without contract, and TLCL pipeline

Phase 4, 6-12 months:

- industry pilots in packaging structure checks, CAD/engineering drawing review, ecommerce page compliance, enterprise document compliance, brand template checks, and workflow approval.

## Direction Lock

Until the TLCL MVP is proven, new implementation should prefer this priority order:

```text
Artifact Envelope
-> Rule Card
-> Rule DSL / Rule Package
-> Validator Registry
-> Validation Report
-> Delivery / Execution Gate
-> Audit Trail
-> Model Router / low-cost runtime
```

Broad autonomous software control should not outrank this chain.

For the complete merged target and task list, see `FULL_TARGET_DIRECTION_AND_TASK_LIST.md`.
