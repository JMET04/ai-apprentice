# Knowledge-Augmented RAG Research Direction

This file records the adviser feedback from the WeChat screenshots and turns it into a durable project goal for Transparent AI Apprentice MCP.

## Extracted Adviser Feedback

Source status: extracted from user-provided screenshots. These are research leads and product-direction notes, not independently verified research claims in this pass.

Screenshot extraction checklist:

- Image 1/2: the adviser names the core direction as "知识增强、RAG".
- Image 3: the adviser adds "知识增强大模型", which reframes the product from prompt-only assistance to a model/agent grounded by retrievable external knowledge.
- Image 4: the adviser says domestic Zhejiang University teams are a useful lead to investigate; this is a research lead, not a verified citation yet.
- Image 5: the adviser explains RAG as adding an external knowledge-base retriever to the model, so answers, plans, and rule drafts can consult an outside knowledge store.
- Embedded screenshot text: the target user story is "让普通人可以低成本培养自己专业相关的智能体", so the research lane must serve ordinary-user teaching, not just technical novelty.

Authoritative corrected Chinese extraction:

- 大佬给出的核心方向是“知识增强、RAG”。
- “可以自己调研下，这块研究挺多”的意思是：这不是一个只靠我们自己拍脑袋创造的方向，应该优先研究已有论文、工程实践和成熟框架。
- “知识增强大模型”说明目标不只是给普通大模型加一段提示词，而是让模型或智能体带外部知识检索、知识注入和专业知识 grounding。
- “目前国内浙大团队做的挺多也还不错，了解了解”应作为研究线索去核实，当前版本不能直接当作已确认引用。
- 他解释 RAG 是“给大模型加一个外接知识库的检索器，相当于问大模型可以从外接知识库里检索”。
- 截图里前面的产品描述也很关键：让普通人可以低成本培养自己专业相关的智能体。也就是说，RAG 不是为了炫技，而是为了让非专业用户能把资料、规则、经验、纠错和案例喂给自己的 AI 学徒。
- 对 Transparent AI Apprentice 来说，这条建议应理解为：把“老师教学 + 软件观察 + 规则抽取”升级成“老师教学 + 外部知识证据 + 软件观察 + 规则抽取”的闭环。

Goal enrollment decision:

- Add "knowledge enhancement / RAG / knowledge-augmented large model" as an official research lane under the Transparent AI Apprentice goal.
- Treat this lane as a source-backed evidence and rule-drafting layer.
- Keep teacher review, deterministic validators, rollback points, and approval gates as the authority layer.
- Start with existing local, deterministic technology: local corpus cards, hashed chunks, retrieval evidence packets, disabled Rule Cards, and smoke tests before exploring heavier vector databases or web retrieval.
- Research external work, including Zhejiang University leads, only through primary sources before citing it or turning it into implementation requirements.

中文提取：

- 大佬给出的核心方向是“知识增强、RAG”。
- 他说“可以自己调研下，这块研究挺多”，意思是这不是一个只靠我们自己拍脑袋创造的方向，应该优先研究已有论文、工程实践和成熟框架。
- 他进一步补充“知识增强大模型”，说明目标不只是给普通大模型加一段提示词，而是让模型或智能体带外部知识检索、知识注入和专业知识 grounding。
- 他提到“目前国内浙大团队做的挺多也还不错，了解了解”。这应作为研究线索去核实，不在当前版本直接当作已确认引用。
- 他解释 RAG 是“给大模型加一个外接知识库的检索器，相当于问大模型可以从外接知识库里检索”。
- 截图里前面的产品描述也很关键：让普通人可以低成本培养自己专业相关的智能体。也就是说，RAG 不是为了炫技，而是为了让非专业用户能把资料、规则、经验、纠错和案例喂给自己的 AI 学徒。
- 对 Transparent AI Apprentice 来说，这条建议应被理解为：把“老师教学 + 软件观察 + 规则抽取”升级成“老师教学 + 外部知识证据 + 软件观察 + 规则抽取”的闭环。

English normalized notes:

- "Knowledge enhancement, RAG" is the key direction to investigate.
- "This area has a lot of research" means the project should study existing papers, methods, and implementations instead of inventing every part from scratch.
- "Knowledge-augmented large model" is the more precise target: not a generic chat prompt, but an agent grounded by external knowledge retrieval and source-backed evidence.
- The adviser mentioned Zhejiang University teams in China as a possible research lead. Treat that as a lead to verify, not as a confirmed citation yet.
- RAG was explained as adding an external knowledge-base retriever to the large model, so the model can search an external knowledge store while answering or planning.
- The practical product goal is to let ordinary people cultivate domain-specialized agents at low cost.

## Prompt-Optimized Project Goal

Use this wording when discussing the direction with another person or another AI:

```text
We are building a teachable AI apprentice, not a generic chatbot. Add a knowledge-augmented RAG lane so ordinary users can provide manuals, standards, papers, software docs, examples, teacher notes, prior corrections, and log-format references. The system should retrieve compact source-backed evidence, draft disabled rules or explanations, expose provenance and uncertainty, and then wait for teacher review, validators, rollback points, and approval gates before anything becomes reusable memory or executable action.
```

The updated product goal is:

```text
普通人提供专业资料、案例、纠错、软件日志、操作演示
  -> 知识源登记与低成本摄取
  -> RAG 检索外部证据
  -> 生成带来源的 evidence packet
  -> 生成禁用规则草案或候选解释
  -> Rule DSL / validator / teacher review 审核
  -> 合格后才成为可复用记忆
```

Corrected Chinese goal:

```text
普通人提供专业资料、案例、纠错、软件日志、操作演示
  -> 知识源登记与低成本摄取
  -> RAG 检索外部证据
  -> 生成带来源的 evidence packet
  -> 生成禁用规则草案或候选解释
  -> Rule DSL / validator / teacher review 审核
  -> 合格后才成为可复用记忆
```

## How This Joins The Product Goal

The project now has a formal research lane:

```text
Teacher knowledge, manuals, standards, papers, examples, logs, and corrections
  -> knowledge source registry
  -> retrieval evidence packet with provenance
  -> candidate rule or action explanation
  -> Rule DSL / Validator / teacher review gate
  -> only approved rules become reusable memory
```

RAG is not a replacement for the Rule DSL or validation layer. The right division of labor is:

- RAG supplies grounded external knowledge, citations, manuals, standards, examples, prior teacher corrections, and likely rule drafts.
- Rule DSL and validators decide whether an artifact or action passes executable checks.
- Teacher review decides whether a rule can become reusable memory.
- Approval gates and rollback points decide whether any high-risk action can proceed.

This makes the apprentice more rigorous: it should not merely imitate a drawing, interface, or workflow that "looks right"; it should cite which manual, teacher note, standard, prior correction, or software log pattern supports each important rule.

## Why It Matters For The Original Goal

For all-software low-token learning:

- Retrieve each software tool's manuals, CLI/API docs, log formats, error-code references, and known workflow examples.
- Use metadata deltas to decide when retrieval is needed, instead of rereading full logs or recording continuously.
- Store retrieved evidence as compact references so the next run can reuse source ids and hashes instead of carrying long text.

For transparent sketch overlays and spatial teaching:

- Retrieve CAD, drawing, packaging, geometry, tolerance, or interface-specific conventions before interpreting teacher strokes.
- Let retrieved examples explain why a candidate numbered target or spatial relation is plausible.
- Still require teacher confirmation before execution.

For strict detail logic:

- Use RAG to find source-backed constraints such as minimum sizes, closed topology, angle relations, allowed tolerances, naming conventions, or process rules.
- Convert those constraints into disabled Rule Cards first.
- Promote them only after teacher review and validator coverage.

## Proposed Architecture Layer

Add a "Knowledge Contract Layer" between evidence input and rule generation.

Core components:

- Knowledge source registry: declares source type, owner, domain, license or permission note, freshness, and trust level.
- Ingestion and normalization: converts PDFs, markdown, software manuals, screenshots with OCR, exported logs, and teacher notes into normalized chunks.
- Chunk hash and provenance: every chunk gets a stable id, source path or URL, hash, page or section locator, and extraction timestamp.
- Local retriever first: start with keyword or BM25-style retrieval over local corpora before adding heavier vector search.
- Retrieval evidence packet: stores query, selected chunks, ranks, source ids, confidence, missing evidence, and blocked assumptions.
- Rule draft handoff: retrieved evidence may propose disabled Rule Cards with source references.
- Validator handoff: Rule DSL and validators remain the enforcement layer.
- Audit trail: every answer or rule draft says which retrieved evidence was used and where teacher review is still required.

This layer should become the bridge between low-token observation and strict detail logic:

- Low-token software signals decide when retrieval is worth spending tokens on.
- RAG retrieves compact evidence instead of forcing the model to reread whole logs, manuals, or screenshots.
- Retrieved evidence is converted into source-backed rule candidates.
- Teacher corrections decide which relationship is actually true for the current domain.
- Validators and dry-runs check whether the relationship works on new data.

## Research Questions To Add

- Which knowledge-enhanced LLM and RAG papers are most relevant to teachable agents?
- What work from Zhejiang University or other domestic teams is actually applicable to knowledge-enhanced agents, domain-specific RAG, or human-in-the-loop knowledge injection?
- How can ordinary users inject domain knowledge without writing complex ontologies or code?
- How can retrieved knowledge be converted into verifiable Rule Cards instead of vague prompts?
- How should the system evaluate whether retrieval improved correctness, rule precision, and detail rigor?
- How can stale, conflicting, or weak sources be detected before they affect rules?
- What is the minimum viable local corpus pipeline for manuals, standards, teacher examples, and software logs?

## Guardrails

RAG must stay evidence-only until reviewed.

- RAG must not mark a rule active.
- RAG must not execute target software.
- RAG must not bypass teacher target confirmation.
- RAG must not unlock packaging or release.
- RAG must not treat retrieved text as unquestioned truth.
- RAG must not store private chain-of-thought.
- Retrieved chunks are evidence inputs. Validators, teacher review, rollback points, and approval gates remain authoritative.

## First Implementation Slice

The smallest useful build should be:

1. `knowledge-source-card.schema.json` for manuals, papers, standards, teacher notes, and software docs.
2. `retrieval-evidence-packet.schema.json` for query, chunks, ranks, hashes, and blocked assumptions.
3. A local corpus ingest script for markdown, JSON, and text first. PDF/OCR can follow.
4. A simple local keyword/BM25 retriever with deterministic output.
5. A smoke test that retrieves a source snippet and drafts a disabled Rule Card with source refs.
6. A validator check that retrieved evidence cannot enable a rule, execute software, or unlock packaging.

Current prototype status:

- `schemas/knowledge-source-card.schema.json` and `schemas/retrieval-evidence-packet.schema.json` already exist.
- `scripts/knowledge/create-rag-research-intake-queue.mjs` turns the adviser note and unverified research leads into a review-only source-candidate queue, with Zhejiang University kept as an unverified lead until primary-source research.
- `scripts/knowledge/create-rag-research-intake-receipt-builder.mjs` and `validate-rag-research-intake-receipt.mjs` gate that queue through a teacher/researcher receipt before any lead can become a confirmed source card.
- `scripts/knowledge/create-rag-confirmed-source-registry-package.mjs` converts validated confirmed source cards into a review-only registry package and prepares local corpus ingest commands only for readable local sources.
- `scripts/knowledge/run-rag-confirmed-local-ingest.mjs` consumes that registry after teacher review and a retained rollback point, then runs only the allowlisted local corpus ingester through no-shell structured argv.
- `scripts/knowledge/run-rag-confirmed-retrieval-draft.mjs` consumes the confirmed local ingest run, retrieves from those local corpus indexes, and drafts only `draft_disabled` Rule Cards for review.
- `scripts/knowledge/create-rag-confirmed-retrieval-draft-review-receipt-builder.mjs` and `validate-rag-confirmed-retrieval-draft-review-receipt.mjs` gate those retrieved chunks and disabled drafts through a teacher review receipt before any further rule validation.
- `scripts/knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs` consumes that validated review receipt and runs approved `draft_disabled` Rule Cards through the existing Rule DSL core while keeping every result review-only, disabled, memory-locked, execution-locked, and packaging-gated.
- `scripts/knowledge/create-rag-reviewed-rule-dsl-review-receipt-builder.mjs` and `validate-rag-reviewed-rule-dsl-review-receipt.mjs` require a teacher to review the evidence refs, disabled Rule Card, and DSL validation result before any review-only disabled package planning step.
- `scripts/knowledge/create-rag-reviewed-disabled-rule-package.mjs` stages only teacher-reviewed `draft_disabled` rules and invokes the existing Rule Package compiler through no-shell Node spawn, producing a disabled package for review without active compilation, rule enablement, memory, execution, external fetch, or packaging unlock.
- `scripts/knowledge/create-rag-disabled-package-validation-report.mjs` feeds that disabled package into the existing Validation Report path, proving disabled rules appear as lifecycle-gated `skipped` rows and do not block delivery or execute validators as active rules.
- `scripts/knowledge/create-rag-validation-report-delivery-gate.mjs` consumes that Validation Report packet and closes the next Delivery Gate boundary: `delivery_allowed: true` stays review-only evidence and cannot become rule activation, memory write, software execution, external fetch, technology acceptance, or packaging unlock.
- `scripts/knowledge/create-rag-delivery-gate-audit-trail.mjs` writes the audit trail after the closed Delivery Gate, hashing the Validation Report packet, Validation Report, closed gate, and rollback point into an evidence chain while replaying the forbidden interpretations for future reviewers.
- `scripts/knowledge/create-rag-delivery-gate-audit-review-receipt-builder.mjs` and `validate-rag-delivery-gate-audit-review-receipt.mjs` require a teacher to review the audit evidence chain, blocked transitions, forbidden interpretations, no-action locks, and retained rollback before only a review-only follow-up queue can be prepared.
- `scripts/knowledge/create-rag-audit-review-follow-up-queue.mjs` converts that validated audit review receipt into manual next-review items for the evidence chain, forbidden interpretations, rollback retention, and safe RAG lane selection without running commands, opening files, fetching sources, enabling rules, writing memory, executing software, opening the delivery gate, claiming completion, or unlocking packaging.
- `scripts/knowledge/create-rag-follow-up-queue-selection-receipt-builder.mjs` and `validate-rag-follow-up-queue-selection-receipt.mjs` require the teacher to select exactly one review-only RAG follow-up lane and confirm the no-action boundary before any selected follow-up planning packet can be prepared.
- `scripts/knowledge/create-rag-selected-follow-up-planning-packet.mjs` converts that single teacher-selected lane into a locked review-only planning packet, such as a `request_more_primary_sources` evidence request plan. It requires a retained rollback point and keeps external fetch, software execution, rule enablement, long-term memory, delivery opening, packaging, acceptance, and goal-completion claims disabled.
- `scripts/knowledge/create-rag-primary-source-evidence-request-receipt-builder.mjs` and `validate-rag-primary-source-evidence-request-receipt.mjs` let the teacher provide primary-source files or references with `logicExtractionHint` notes so later RAG work can extract strict data-to-output relationships. The validation result emits review-only `confirmedSources` for a later source-registry follow-up and keeps fetch, execution, rules, memory, packaging, acceptance, and completion locked.
- `scripts/knowledge/create-rag-confirmed-source-registry-package.mjs` also accepts validated primary-source evidence receipts, preserves each `logicExtractionHint`, marks `sourceRegistryFollowUpKind=primary_source_evidence_follow_up`, and prepares only existing local ingest commands for readable local sources.
- `scripts/knowledge/run-rag-confirmed-local-ingest.mjs` preserves `logicExtractionHint` in primary-source local ingest runs and next-review hints so retrieval and disabled Rule Card drafting can stay tied to teacher-specified data-to-output relationships.
- `scripts/knowledge/run-rag-confirmed-retrieval-draft.mjs` preserves `logicExtractionHint` through retrieval and disabled Rule Card drafting so the teacher can review whether the draft rule follows the intended data-to-output relationship.
- `scripts/knowledge/create-rag-confirmed-retrieval-draft-review-receipt-builder.mjs` and `validate-rag-confirmed-retrieval-draft-review-receipt.mjs` require teacher review of `logicExtractionHint` and `logicFitDecision=matches_intended_logic` before a primary-source disabled draft can proceed to Rule DSL validation.
- `scripts/knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs` carries `logicExtractionHint` and `logicFitDecision` into the Rule DSL validation package, rejecting primary-source drafts whose logic fit is not `matches_intended_logic`.
- `scripts/knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs` also preserves and hash-checks upstream `planningLogicEvidence`, rejecting tampered or mismatched next-review copies with `RULE_DSL_VALIDATION_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, `RULE_DSL_VALIDATION_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, or `RULE_DSL_VALIDATION_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH` so deterministic Rule DSL validation cannot silently drop teacher-confirmed data-to-output logic context.
- `scripts/knowledge/create-rag-reviewed-rule-dsl-review-receipt-builder.mjs` and `validate-rag-reviewed-rule-dsl-review-receipt.mjs` carry primary-source `logicExtractionHint` and `logicFitDecision` through the human Rule DSL review gate, requiring teacher review of the logic hint and matching logic-fit decision before disabled package planning.
- `scripts/knowledge/create-rag-reviewed-rule-dsl-review-receipt-builder.mjs` and `validate-rag-reviewed-rule-dsl-review-receipt.mjs` also preserve and validate upstream `planningLogicEvidence` through the human Rule DSL review gate, rejecting tampered package or next-review copies with `RAG_RULE_DSL_REVIEW_BUILDER_PACKAGE_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, `RAG_RULE_DSL_REVIEW_BUILDER_PACKAGE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, `RAG_RULE_DSL_REVIEW_BUILDER_PACKAGE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH`, `RULE_DSL_REVIEW_PACKAGE_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, `RULE_DSL_REVIEW_PACKAGE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, or `RULE_DSL_REVIEW_PACKAGE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH` before any disabled package planning step.
- `scripts/knowledge/create-rag-reviewed-disabled-rule-package.mjs` preserves primary-source `logicExtractionHint` and `logicFitDecision` in staged disabled package metadata and rejects review validation tampering when those logic fields no longer match the next-review evidence.
- `scripts/knowledge/create-rag-reviewed-disabled-rule-package.mjs` also preserves and hash-checks upstream `planningLogicEvidence`, rejecting tampered or mismatched next-review copies with `DISABLED_RULE_PACKAGE_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, `DISABLED_RULE_PACKAGE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, or `DISABLED_RULE_PACKAGE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH` so the compiled disabled package remains tied to teacher-confirmed data-to-output logic while every rule stays `draft_disabled`.
- `scripts/knowledge/create-rag-disabled-package-validation-report.mjs` preserves primary-source logic metadata in `disabledRuleLogicRows`, carries it to next-review hints, and rejects disabled package tampering when staged logic metadata no longer matches next-review evidence.
- `scripts/knowledge/create-rag-disabled-package-validation-report.mjs` also preserves and hash-checks upstream `planningLogicEvidence`, rejecting tampered or mismatched next-review copies with `VALIDATION_REPORT_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, `VALIDATION_REPORT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, or `VALIDATION_REPORT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH` so Validation Report review can inspect teacher-confirmed data-to-output logic while disabled rules remain lifecycle-gated `skipped` rows.
- `scripts/knowledge/create-rag-validation-report-delivery-gate.mjs` preserves `disabledRuleLogicRows` through the closed delivery gate, carrying primary-source logic hints to the next review without opening delivery, execution, packaging, rule activation, memory, external fetch, or acceptance.
- `scripts/knowledge/create-rag-validation-report-delivery-gate.mjs` also preserves and hash-checks upstream `planningLogicEvidence`, rejecting tampered or mismatched next-review copies with `RAG_DELIVERY_GATE_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, `RAG_DELIVERY_GATE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, or `RAG_DELIVERY_GATE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH` so `delivery_allowed` cannot be misread as planning-logic acceptance, rule enablement, execution, or packaging unlock.
- `scripts/knowledge/create-rag-delivery-gate-audit-trail.mjs` preserves primary-source `disabledRuleLogicRows` in the final audit trace, adds `primary_source_logic_evidence` to the evidence chain, and rejects delivery gate tampering when logic rows no longer match next-review hints.
- `scripts/knowledge/create-rag-delivery-gate-audit-trail.mjs` also preserves and hash-checks upstream `planningLogicEvidence`, rejects tampered or mismatched next-review copies with `RAG_DELIVERY_GATE_AUDIT_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, `RAG_DELIVERY_GATE_AUDIT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, or `RAG_DELIVERY_GATE_AUDIT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH`, and adds `primary_source_planning_logic_evidence` to the evidence chain for teacher review without turning the audit into acceptance.
- `scripts/knowledge/create-rag-delivery-gate-audit-review-receipt-builder.mjs` and `validate-rag-delivery-gate-audit-review-receipt.mjs` add `logicEvidenceReviews` so the teacher must explicitly review primary-source logic evidence before any review-only follow-up queue can be prepared.
- `scripts/knowledge/create-rag-delivery-gate-audit-review-receipt-builder.mjs` and `validate-rag-delivery-gate-audit-review-receipt.mjs` also preserve and validate upstream `planningLogicEvidence` through the teacher audit receipt, rejecting tampered audit or next-review copies with `RAG_AUDIT_REVIEW_BUILDER_AUDIT_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, `RAG_AUDIT_REVIEW_BUILDER_AUDIT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, `RAG_AUDIT_REVIEW_BUILDER_AUDIT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH`, `AUDIT_REVIEW_AUDIT_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, `AUDIT_REVIEW_AUDIT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, or `AUDIT_REVIEW_AUDIT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH` before any review-only follow-up queue handoff.
- `scripts/knowledge/create-rag-audit-review-follow-up-queue.mjs` carries reviewed primary-source `logicExtractionHints` into a `review_primary_source_logic_evidence` manual queue item before any next-lane selection.
- `scripts/knowledge/create-rag-audit-review-follow-up-queue.mjs` also preserves and hash-checks upstream `planningLogicEvidence`, rejecting tampered or mismatched next-review copies with `RAG_FOLLOW_UP_QUEUE_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, `RAG_FOLLOW_UP_QUEUE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, or `RAG_FOLLOW_UP_QUEUE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH` so the manual follow-up queue can carry confirmed data-to-output planning context into next-lane selection without accepting, enabling, executing, writing memory, opening delivery, or unlocking packaging.
- `scripts/knowledge/create-rag-follow-up-queue-selection-receipt-builder.mjs` and `validate-rag-follow-up-queue-selection-receipt.mjs` require `logic_evidence_confirmed`, logic evidence review, logic-fit confirmation, and a reviewer note before a primary-source follow-up queue can select the next review-only lane.
- `scripts/knowledge/create-rag-follow-up-queue-selection-receipt-builder.mjs` and `validate-rag-follow-up-queue-selection-receipt.mjs` also preserve and validate upstream `planningLogicEvidence` through the teacher lane-selection receipt, rejecting tampered or mismatched queue next-review copies with `FOLLOW_UP_SELECTION_BUILDER_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, `FOLLOW_UP_SELECTION_BUILDER_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH`, `FOLLOW_UP_SELECTION_QUEUE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, or `FOLLOW_UP_SELECTION_QUEUE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH` so selected follow-up planning cannot silently drop confirmed data-to-output planning context.
- `scripts/knowledge/create-rag-selected-follow-up-planning-packet.mjs` preserves confirmed `logicExtractionHints` and `logicEvidenceReviews` in the selected planning packet and rejects unconfirmed logic evidence with `RAG_SELECTED_FOLLOW_UP_PLANNING_REQUIRES_CONFIRMED_LOGIC_EVIDENCE`.
- `scripts/knowledge/create-rag-selected-follow-up-planning-packet.mjs` also preserves and hash-checks upstream `planningLogicEvidence` in the selected planning packet, rejecting tampered selected or next-review copies with `RAG_SELECTED_FOLLOW_UP_PLANNING_SELECTED_LOGIC_EVIDENCE_MISMATCH`, `RAG_SELECTED_FOLLOW_UP_PLANNING_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH`, or `RAG_SELECTED_FOLLOW_UP_PLANNING_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH` so review-only primary-source planning remains tied to teacher-confirmed data-to-output logic context.
- `scripts/knowledge/create-rag-primary-source-evidence-request-receipt-builder.mjs` and `validate-rag-primary-source-evidence-request-receipt.mjs` carry the selected planning packet's hash-checked `planningLogicEvidence` into the primary-source request receipt, reject tampered or mismatched next-review copies with `RAG_PRIMARY_SOURCE_EVIDENCE_REQUEST_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH`, `RAG_PRIMARY_SOURCE_EVIDENCE_REQUEST_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH`, `PRIMARY_SOURCE_PLANNING_PACKET_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH`, or `PRIMARY_SOURCE_PLANNING_PACKET_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH`, and reject receipt tampering with `PRIMARY_SOURCE_REQUEST_CONTEXT_LOGIC_EVIDENCE_MISMATCH`.
- `scripts/knowledge/create-rag-confirmed-source-registry-package.mjs` preserves and hash-checks `planningLogicEvidence` and `planningLogicEvidenceHash` in primary-source registry packets, rejecting tampered validation or next-review copies with `RAG_CONFIRMED_SOURCE_REGISTRY_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, `RAG_CONFIRMED_SOURCE_REGISTRY_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH`, or `RAG_CONFIRMED_SOURCE_REGISTRY_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH` so local ingest review can compare new source hints against upstream confirmed data-to-output logic evidence.
- `scripts/knowledge/run-rag-confirmed-local-ingest.mjs` preserves and hash-checks upstream `planningLogicEvidence` and `planningLogicEvidenceHash` in local ingest run packets, rejecting tampered registry or next-review copies with `RAG_CONFIRMED_LOCAL_INGEST_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, `RAG_CONFIRMED_LOCAL_INGEST_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH`, or `RAG_CONFIRMED_LOCAL_INGEST_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH` so retrieval review can compare corpus chunks against the confirmed data-to-output logic evidence while RAG stays an evidence-only external knowledge retriever instead of automatic authority.
- `scripts/knowledge/run-rag-confirmed-retrieval-draft.mjs` preserves and hash-checks upstream `planningLogicEvidence` and `planningLogicEvidenceHash` in retrieval draft run packets, rejecting tampered ingest-run or next-review copies with `RAG_CONFIRMED_RETRIEVAL_DRAFT_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, `RAG_CONFIRMED_RETRIEVAL_DRAFT_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH`, or `RAG_CONFIRMED_RETRIEVAL_DRAFT_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH` so retrieved chunks and `draft_disabled` Rule Cards stay tied to confirmed data-to-output logic evidence while retrieval remains evidence-only and cannot become rule acceptance.
- `scripts/knowledge/create-rag-confirmed-retrieval-draft-review-receipt-builder.mjs` and `validate-rag-confirmed-retrieval-draft-review-receipt.mjs` preserve and hash-check upstream `planningLogicEvidence` during teacher review, rejecting tampered retrieval-run or next-review copies with `RAG_RETRIEVAL_DRAFT_REVIEW_BUILDER_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, `RAG_RETRIEVAL_DRAFT_REVIEW_BUILDER_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH`, `RAG_RETRIEVAL_DRAFT_REVIEW_BUILDER_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH`, `RETRIEVAL_REVIEW_RUN_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH`, `RETRIEVAL_REVIEW_RUN_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH`, or `RETRIEVAL_REVIEW_RUN_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH` before Rule DSL validation.
- `scripts/smoke/smoke-rag-next-review-hash-coverage-audit.mjs` audits every knowledge-script `NEXT_REVIEW...HASH_MISMATCH` code and fails if the code is missing from README, this research direction, `verify-plugin`, or goal coverage, so future RAG planning-logic hash checks cannot silently lose delivery-gate visibility.
- `scripts/knowledge/ingest-local-corpus.mjs`, `retrieve-local-knowledge.mjs`, and `draft-rule-card-from-retrieval.mjs` already prove a local, deterministic, evidence-only RAG slice.
- `scripts/knowledge/augment-low-token-learning-with-retrieval.mjs` already connects compact low-token learning events to retrieval evidence and disabled Rule Card drafts.
- `scripts/create-knowledge-augmented-spatial-execution-bridge.mjs` already connects retrieved evidence to the transparent sketch/spatial execution route for teacher review.
- `npm run smoke:plugin-rag-research-intake-queue`, `npm run smoke:plugin-rag-research-intake-receipt`, `npm run smoke:plugin-rag-confirmed-source-registry-package`, `npm run smoke:plugin-rag-confirmed-local-ingest-runner`, `npm run smoke:plugin-rag-confirmed-retrieval-draft-runner`, `npm run smoke:plugin-rag-confirmed-retrieval-draft-review-receipt`, `npm run smoke:plugin-rag-reviewed-rule-dsl-validation-package`, `npm run smoke:plugin-rag-reviewed-rule-dsl-review-receipt`, `npm run smoke:plugin-rag-reviewed-disabled-rule-package`, `npm run smoke:plugin-rag-disabled-package-validation-report`, `npm run smoke:plugin-rag-validation-report-delivery-gate`, `npm run smoke:plugin-rag-delivery-gate-audit-trail`, `npm run smoke:plugin-rag-delivery-gate-audit-review-receipt`, `npm run smoke:plugin-rag-audit-review-follow-up-queue`, `npm run smoke:plugin-rag-follow-up-queue-selection-receipt`, `npm run smoke:plugin-rag-primary-source-follow-up-queue-selection-receipt`, `npm run smoke:plugin-rag-primary-source-follow-up-queue-selection-receipt-planning-logic-context`, `npm run smoke:plugin-rag-selected-follow-up-planning-packet`, `npm run smoke:plugin-rag-primary-source-selected-follow-up-planning-packet`, `npm run smoke:plugin-rag-primary-source-selected-follow-up-planning-packet-planning-logic-context`, `npm run smoke:plugin-rag-primary-source-evidence-request-receipt`, `npm run smoke:plugin-rag-primary-source-evidence-request-logic-context`, `npm run smoke:plugin-rag-primary-source-registry-follow-up`, `npm run smoke:plugin-rag-primary-source-registry-logic-context`, `npm run smoke:plugin-rag-primary-source-local-ingest-follow-up`, `npm run smoke:plugin-rag-primary-source-local-ingest-logic-context`, `npm run smoke:plugin-rag-primary-source-retrieval-draft-follow-up`, `npm run smoke:plugin-rag-primary-source-retrieval-draft-logic-context`, `npm run smoke:plugin-rag-primary-source-retrieval-draft-review-receipt`, `npm run smoke:plugin-rag-primary-source-retrieval-draft-review-logic-context`, `npm run smoke:plugin-rag-primary-source-rule-dsl-validation-package`, `npm run smoke:plugin-rag-primary-source-rule-dsl-validation-planning-logic-context`, `npm run smoke:plugin-rag-primary-source-rule-dsl-review-receipt`, `npm run smoke:plugin-rag-primary-source-rule-dsl-review-planning-logic-context`, `npm run smoke:plugin-rag-primary-source-disabled-rule-package`, `npm run smoke:plugin-rag-primary-source-disabled-rule-package-planning-logic-context`, `npm run smoke:plugin-rag-primary-source-disabled-package-validation-report`, `npm run smoke:plugin-rag-primary-source-disabled-package-validation-report-planning-logic-context`, `npm run smoke:plugin-rag-primary-source-validation-report-delivery-gate`, `npm run smoke:plugin-rag-primary-source-validation-report-delivery-gate-planning-logic-context`, `npm run smoke:plugin-rag-primary-source-delivery-gate-audit-trail`, `npm run smoke:plugin-rag-primary-source-delivery-gate-audit-trail-planning-logic-context`, `npm run smoke:plugin-rag-primary-source-delivery-gate-audit-review-receipt`, `npm run smoke:plugin-rag-primary-source-delivery-gate-audit-review-receipt-planning-logic-context`, `npm run smoke:plugin-rag-primary-source-audit-review-follow-up-queue`, `npm run smoke:plugin-rag-primary-source-audit-review-follow-up-queue-planning-logic-context`, `npm run smoke:plugin-knowledge-rag-rule-draft`, `npm run smoke:plugin-knowledge-augmented-low-token-learning`, and `npm run smoke:plugin-knowledge-augmented-spatial-execution-bridge` are the current verification entrypoints.
- This is still research/prototype evidence. It does not prove that all domain knowledge, all software manuals, PDFs, OCR sources, or vector retrieval modes are complete.

## Success Criteria

This research direction is successful only if it improves rigor:

- More generated rules cite specific evidence.
- Fewer outputs are only visually similar without logic.
- Teacher corrections become source-backed, reusable rules.
- Unknown or conflicting sources block automation instead of being hidden.
- Low-token operation improves because the system retrieves compact evidence only when needed.
