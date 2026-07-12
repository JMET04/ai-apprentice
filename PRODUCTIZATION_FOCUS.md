# Productization Focus

Date: 2026-06-23

## Current Decision

The all-software objective is paused.

For teammate takeover, start with `PRODUCT_HANDOFF.md`.

The current productization goal is narrower and more useful:

```text
Make one ordinary user teaching loop reliable, understandable, and repeatable.
```

This means the product should first help a teacher:

1. Create or select an apprentice.
2. Teach one concrete task.
3. Run the task once.
4. Inspect the public trace.
5. Correct the result.
6. Review the extracted rule.
7. Run again and see whether the behavior improved.
8. Keep packaging, release, broad automation, and native execution locked until explicit review.

## What Moves Out Of The Main Path

The following remain useful research or advanced-plugin lanes, but they should not dominate the product UI:

- all-software unattended learning,
- universal native software execution,
- broad local software inventory,
- recurring monitor registration,
- large TLCL receipt chains,
- generic engineering-software voice control,
- automatic screenshot escalation,
- packaging/release acceptance gates.

These capabilities should be reachable later through an advanced/developer area, not through the first-run user journey.

## Productization Requirements

### User Experience

- The first screen must explain what works today.
- The primary call to action must start the core teaching loop.
- The UI must distinguish demo-ready capabilities from paused research goals.
- Teachers should not need to understand internal terms like TLCL, receipt, delivery gate, or package lifecycle.
- Every page should answer: what did the apprentice learn, why did it act this way, and what should the teacher do next?

### Core Capability

- Keep the current teaching-loop demo runnable.
- Preserve public trace, validation, confidence, and human review points.
- Preserve correction-to-rule extraction.
- Preserve rule provenance.
- Preserve explicit acceptance and packaging locks.
- Add real-model integration only behind the existing AI service interface.

### Safety Boundary

- Do not enable new memory automatically unless the teacher explicitly chooses that behavior.
- Do not present review-only evidence as product acceptance.
- Do not claim all-software coverage.
- Do not claim universal native execution.
- Do not expose private chain-of-thought.

## Immediate Implementation Work

Completed in this productization pass:

- Replaced the dashboard with a product-focused core-path overview.
- Fixed the dashboard primary path to target the stable `task-photo-travel-journal` demo first, so old smoke records cannot become the product entry task.
- Changed dashboard and manual-acceptance headline metrics to use stable-demo counts instead of workspace totals, so old smoke records do not inflate the visible product readiness numbers.
- Replaced unreadable mojibake in the app shell and acceptance gate.
- Added visible messaging that the all-software goal is paused.
- Moved internal tools and registered skills below the primary user path.
- Added `/manual-test` as a product-facing manual acceptance workbench.
- Linked the manual acceptance workbench from the sidebar and dashboard.
- Fixed `/manual-test` to target the stable `task-photo-travel-journal` demo first, so smoke-created or recent experimental tasks cannot silently become the handoff acceptance object.
- Added browser-local pass/blocker/notes capture for the core teaching loop.
- Added JSON export for manual acceptance reports so testing evidence can be handed off.
- Added `npm run smoke:product` to check the product entry, manual test workbench, qualification API, packaging lock, and product-facing mojibake regressions.
- Added `npm run smoke:manual-browser` to run the manual acceptance workbench in a real Chromium browser, mark every step passed, fill tester notes, export the JSON report, save desktop/mobile browser evidence under `artifacts/productization/`, and prove automation cannot save real `human_review` evidence.
- Classified manual acceptance receipts as `automated_browser_smoke` or `human_review`, so browser smoke can no longer be mistaken for a real human acceptance pass.
- Surfaced the manual acceptance evidence classification on `/handoff` and `/manual-test`, so takeover users can see whether the latest evidence is automated smoke or real human review.
- Added `npm run cleanup:smoke-records` as a dry-run-first maintenance script for old generated smoke apprentices/tasks, with `-- --apply` required before deletion.
- Added `npm run verify:handoff` to check takeover docs, stable demo data, absence of smoke records, browser evidence, cleanup evidence, and packaging locks.
- Added `/api/product-readiness` as the machine-readable handoff contract for the current scope, stable task, evidence artifacts, verification commands, and packaging lock state.
- Added `/api/manual-acceptance-reports` plus a manual-test save action so review-only acceptance evidence can be persisted under `artifacts/productization/` instead of only downloaded from the browser.
- Added `/api/ai-service-status` and a server-side AI service selector so routes use the AI service boundary while the current accepted runtime remains deterministic `mock`.
- Added `/api/health` and `npm run doctor:product` for lightweight runtime diagnosis after the app is already running.
- Added `artifacts/productization/product-verification-receipt.json` so every full `npm run verify:product` pass leaves durable product verification evidence.
- Added `artifacts/productization/product-ui-api-smoke.json` so product-facing UI/API smoke has durable evidence and can be packaged with handoff and public beta materials.
- Added product UI/API smoke visibility to `/api/health` and a strict UI/API smoke check to `npm run doctor:product`, so a running trial server cannot look fully diagnosed without the latest product-facing smoke receipt.
- Added `/tasks/[id]/review` as a lightweight task acceptance view for ordinary testers.
- Moved the primary task links from the heavy evidence dossier to the lightweight review view, while keeping the full dossier available for deep inspection.
- Added a first-run guide to the run/correction console so testers can follow run, correct, rerun, and record steps without reading internal evidence first.
- Added `npm run smoke:core-loop` as a real HTTP end-to-end check that creates a smoke apprentice/task, runs once, saves teacher correction, reruns with learned memory, verifies packaging remains locked, and cleans up local smoke records by default.
- Added `npm run verify:product` as the preferred one-command product readiness check: it runs typecheck, builds the app, starts a temporary production server using the standalone build when available, runs product UI/API smoke, runs real-browser manual acceptance smoke, runs the real core loop smoke, and then stops the temporary server.
- Changed the `verify:product` temporary production server to run from `artifacts/productization/runtime/verify-standalone`, matching the no-`.next`-lock behavior of `start:product`.
- Added `npm run start:product` as the local production-mode trial server for testers after `npm run build`, with the demo SQLite database pinned to `prisma/dev.db` by default.
- Changed `npm run start:product` to launch from `artifacts/productization/runtime/standalone` so a running local trial server does not lock `.next/standalone` and block later builds on Windows.
- Added `npm run verify:product-runtime` so the public `start:product` command is covered by repeatable runtime evidence under `artifacts/productization/product-runtime-verification.json`.
- Added `npm run verify:human-acceptance` and `artifacts/productization/human-acceptance-gate.json` as a real human review gate. The command intentionally fails until `/manual-test` saves `evidenceKind=human_review`; `verify:product` uses `--allow-pending` only to write the current blocked/pass snapshot.
- Added `npm run preflight:human-acceptance` and `artifacts/productization/human-acceptance-session-preflight.json` so the live `/manual-test` page, save API, current human gate, release lock, and AI boundary are checked before asking a real reviewer to save `human_review` evidence.
- Added `npm run build:human-acceptance-reviewer-kit`, `npm run verify:human-acceptance-reviewer-kit`, and `artifacts/productization/human-acceptance-reviewer-kit.md` so the next real reviewer gets a current, evidence-backed, review-only acceptance kit before saving `human_review` evidence.
- Added `npm run build:human-acceptance-receipt-template`, `npm run verify:human-acceptance-receipt`, and `artifacts/productization/human-acceptance-receipt.template.json` so real human acceptance can return structured reviewer evidence that is validated without becoming release approval or packaging unlock.
- Added `npm run intake:human-acceptance-return`, `npm run verify:human-acceptance-return-intake`, and human acceptance return intake receipts so a filled reviewer receipt can be archived, reconciled with the saved `/manual-test` gate, and routed back into release blocker planning without claiming release readiness.
- Hardened the real human review classification so non-smoke sources no longer become `human_review` by default. A real save now requires reviewer name, every step passed, per-step notes, and `manual_test_workbench_human_review_evidence_v1` attestation before the API emits `classificationReason=valid_human_review_evidence`.
- Added `npm run verify:manual-acceptance-classification` and `artifacts/productization/manual-acceptance-classification-verification.json` so bypass cases are verified without touching the latest real product evidence.
- Added `npm run verify:product-release-readiness` and `artifacts/productization/product-release-readiness.json` as a strict production go/no-go gate. It intentionally blocks while human acceptance, real-model readiness, packaging release approval, or the durable product UI/API smoke receipt are missing.
- Added `npm run build:product-status-summary`, `npm run verify:product-status-summary`, and `artifacts/productization/product-status-summary.md` as the one-page productization status companion: bounded beta can start, release cannot, real model remains mock, and all-software remains paused.
- Added `npm run build:product-operator-brief`, `npm run verify:product-operator-brief`, and `artifacts/productization/product-operator-brief.md` so the next maintainer has one concise, verified handoff for beta invitation, human acceptance, real-model trial planning, and blocked release-only transitions.
- Added `npm run build:product-release-blocker-board`, `npm run verify:product-release-blocker-board`, and `artifacts/productization/product-release-blocker-board.md` so the current release blockers become explicit maintainer lanes with evidence paths, verifier commands, continue conditions, and stop conditions while `releaseDecision=do_not_release`.
- Added `npm run build:product-release-approval-template`, `npm run verify:product-release-approval`, and `artifacts/productization/product-release-approval.template.json` so separate release/packaging approval can return structured reviewer evidence after human and model acceptance exist, without unlocking packaging, saving acceptance, accepting the model, or changing `releaseDecision=do_not_release`.
- Added `npm run intake:product-release-approval-return` and `npm run verify:product-release-approval-return-intake` so returned release-review receipts can be archived, refresh release blockers, and still keep `accepted=false`, `packagingGated=true`, `canRelease=false`, and `releaseDecision=do_not_release`.
- Added `npm run build:real-model-trial-kit`, `npm run verify:real-model-trial-kit`, and `artifacts/productization/real-model-trial-kit.md` so the real-model blocker now has a review-only trial path covering provider setup, `/api/ai-service-status`, returned evidence, rollback, and stop conditions without activating a real model or unlocking release.
- Added `npm run verify:real-model-adapter-contract` and `artifacts/productization/real-model-adapter-contract-verification.json` so the OpenAI-compatible adapter contract is exercised with fake fetch before any real provider trial: bounded execution shape, public trace, review-only correction rule, enabled-rule filtering, no secret leak, no real network, no model acceptance, and no packaging unlock.
- Added `npm run build:real-model-trial-receipt-template`, `npm run verify:real-model-trial-receipt`, and `artifacts/productization/real-model-trial-receipt.template.json` so a real-model trial can return structured reviewer evidence that is validated without becoming model acceptance, release approval, or packaging unlock.
- Added `npm run intake:real-model-trial-return` and `npm run verify:real-model-trial-return-intake` so returned real-model trial receipts can be archived, refresh release blockers, and still keep `canActivateRealModel=false`, `accepted=false`, `packagingGated=true`, and `releaseDecision=do_not_release`.
- Added `npm run package:product-trial` and `artifacts/productization/product-trial-packet/` as a concentrated review-only handoff bundle with docs, receipts, browser evidence, and locked packaging boundaries.
- Added `npm run cleanup:runtime-artifacts` as a dry-run-first maintenance script for inactive verification runtime copies, with `runtime-artifact-cleanup.json` included in readiness and handoff evidence.
- Added `npm run verify:live-handoff` and `artifacts/productization/live-product-handoff.json` to confirm the currently running trial server, runtime directory, release lock, and trial packet evidence are aligned before teammate handoff.
- Added `npm run smoke:handoff-browser`, `artifacts/productization/handoff-browser-smoke.json`, and desktop/mobile `/handoff` screenshots so the beta feedback return loop is visually verified before inviting a tester.
- Added the manual acceptance browser smoke to `npm run prepare:public-beta`, followed by `npm run verify:human-acceptance -- --allow-pending`, so the standard beta-preparation chain refreshes `/manual-test` evidence while preserving the real-human-review blocker.
- Upgraded `npm run package:public-beta` so the beta packet requires live handoff, runtime cleanup, doctor, release-blocked, handoff, and manual-classification evidence before marking a bounded beta ready.
- Added `npm run verify:public-beta` and `artifacts/productization/public-beta-readiness.json` to independently verify the beta packet, required evidence, feedback template, and locked release boundary before inviting testers.
- Added `PUBLIC_BETA_FEEDBACK_RECEIPT.template.json` to the public beta packet so tester feedback can be collected as structured review-only evidence without becoming acceptance, packaging, release, or all-software scope.
- Added `generatedFiles` to `public-beta-manifest.json` and verification coverage for the generated tester entrypoint, Markdown feedback template, and machine-readable feedback receipt template.
- Made `npm run verify:public-beta` sync its latest readiness receipt back into the public beta packet, so the handoff bundle stays self-contained after verification.
- Added `npm run verify:public-beta-feedback` and `artifacts/productization/public-beta-feedback-receipt-validation.json` so the generated beta feedback template and filled tester receipts can be validated without becoming acceptance, packaging, release, or all-software scope.
- Added `npm run verify:public-beta-feedback-api` and `artifacts/productization/public-beta-feedback-api-verification.json` so the `/public-beta` browser submit path proves dry-run validation, valid saves, invalid rejection, blocked-feedback safeguards, and review-only locks without touching the real feedback inbox.
- Added `npm run smoke:public-beta-browser`, `artifacts/productization/public-beta-browser-smoke.json`, and desktop/mobile `/public-beta` screenshots so the tester entry and Feedback Receipt Builder are visually verified before inviting a bounded tester.
- Added `npm run collect:public-beta-feedback` and `artifacts/productization/public-beta-feedback-collection.json` to turn filled beta feedback receipts into a review-only follow-up queue. With no submitted receipts, the expected state is `waiting_for_feedback`, not failure.
- Added `npm run verify:public-beta-feedback-collection` and `artifacts/productization/public-beta-feedback-collection-verification.json` so empty, ready, needs-fix, blocked, and invalid beta feedback receipts are classified correctly before using the real inbox queue.
- Added `npm run plan:public-beta-follow-up` and `artifacts/productization/public-beta-follow-up-plan.json` so the feedback queue becomes concrete tester-intake, fix-planning, blocker-review, and release-lock actions without becoming acceptance or release approval.
- Added `npm run verify:public-beta-follow-up-plan` and `artifacts/productization/public-beta-follow-up-plan-verification.json` so the follow-up planner proves waiting, ready, needs-fix, blocked, invalid, and missing-collection states preserve the review-only boundary.
- Added `npm run build:public-beta-tester-invite`, `npm run verify:public-beta-tester-invite`, and `artifacts/productization/public-beta-tester-invite.md` so the next beta tester invite is generated from current readiness, follow-up, live handoff, and release-lock evidence instead of hand-written judgment.
- Added `npm run preflight:public-beta-tester` and `artifacts/productization/public-beta-tester-session-preflight.json` as the final live URL, tester entry page, invite, return-intake, and release-lock check before contacting one bounded beta tester.
- Added generated `docs/PUBLIC_BETA_TESTER_RUNBOOK.md` to the public beta packet so testers get a clean session script separate from maintainer-only evidence and commands.
- Added `npm run intake:public-beta-return` and `npm run verify:public-beta-return-intake` so returned tester feedback is validated, copied into the inbox, collected, and converted into a follow-up plan without saving acceptance, enabling packaging, claiming release, or resuming all-software scope.
- Added `/api/public-beta-feedback-receipts` and the `/public-beta` Feedback Receipt Builder so one bounded tester can validate, download, or save a structured review-only feedback receipt from the product UI before maintainer collection and follow-up planning.
- Exposed public beta feedback validation, collection, and collection-verification receipts in `/api/product-readiness` so takeover tooling can see whether beta feedback is ready, waiting, blocked, invalid, or needs fixes.
- Made `/handoff` force-dynamic so the takeover page reads the latest artifacts, release gate, live handoff, and beta feedback status instead of serving a stale prerendered snapshot.
- Made the review-only product trial packet carry current public-beta readiness and feedback receipts when they exist, and tightened `verify:handoff` so the current handoff bundle proves beta follow-up evidence is self-contained.
- Added `npm run prepare:public-beta` and `artifacts/productization/public-beta-preparation.json` as the one-command ordered preparation chain for feedback verification, `/public-beta` browser evidence, inbox collection, handoff refresh, live handoff, beta packet build, and final beta readiness sync.
- Synced the final public beta preparation receipt into `public-beta-packet/evidence/public-beta-preparation.json`, with verifier coverage so the beta packet proves how it was prepared.
- Made successful public beta preparation steps compact and path-sanitized, while preserving sanitized output tails only for failed preparation steps.
- Updated `npm run package:github-source` so the GitHub upload archive includes the current public beta packet, trial packet, compact preparation receipt, live handoff, runtime cleanup, UI/API smoke, and feedback evidence while still excluding secrets, databases, dependencies, build cache, runtime copies, and local tool state.
- Added `npm run verify:github-source` and `artifacts/github-source-package/github-source-package-verification.json` so the GitHub upload archive is independently checked by manifest, extracted zip contents, lock evidence, and forbidden-payload exclusions before handoff.
- Added `.github/workflows/productization-ci.yml` so uploaded GitHub checkouts build the product runtime, start it, wait for `/api/health`, and automatically run `ci:productization:gates` without activating real models, releasing, or resuming all-software scope.
- Added `npm run ci:productization` as the self-contained local equivalent of Productization CI: it builds the product runtime, starts or reuses the selected host/port, waits for `/api/health`, runs the bounded productization gates against the same base URL, refreshes both live human-acceptance and public-beta tester preflights, writes and verifies the local CI receipt, stages the GitHub source package, verifies takeover-entry consistency against the staged docs, rebuilds/verifies the final GitHub source package with that receipt, runs the dependency-free new-repository bootstrap check against the staged checkout, then builds/verifies the product delivery index so the archive includes the current local CI evidence and staged-doc scan. Added `npm run verify:productization-ci-local` to validate receipt freshness, health gate, gates completion, final handoff packaging behavior, staged source-package scan, and the locked release boundary.

Recommended next work:

1. Before a teammate takes over, run `npm run build:product-takeover-matrix` and `npm run verify:product-takeover-matrix`, then open `artifacts/productization/product-takeover-decision-matrix.md` first to choose one allowed next action and see the stop conditions. Use `artifacts/productization/product-status-summary.md` only as the companion beta-ready/release-blocked status page.

2. Run the first manual product smoke test from `/manual-test`: open dashboard, run the demo task, submit a correction, confirm the new rule appears, run again, and inspect trace/memory provenance.

3. Use `npm run verify:product` before handoff or before inviting another tester. It avoids the dev-server/build `.next` race by starting its own temporary production server after build, with the demo SQLite database pinned to `prisma/dev.db`.

4. Before a real tester saves `/manual-test` evidence, run `npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000`, then build and verify the human acceptance reviewer kit and receipt template. Treat `npm run verify:human-acceptance` failure as the next productization blocker, not as release-ready state.

5. Rebuild the review-only trial packet with `npm run package:product-trial` when evidence changes, then open `artifacts/productization/product-trial-packet/START_HERE.md` as the tester entrypoint.

6. Run `npm run verify:live-handoff -- --base-url http://127.0.0.1:3000` after starting the local trial server and before inviting a tester.

7. Prefer `npm run prepare:public-beta -- --base-url http://127.0.0.1:3000` before inviting a tester. Use `artifacts/productization/product-takeover-decision-matrix.md` as the first takeover page, `artifacts/productization/product-status-summary.md` as the companion status page, `artifacts/productization/product-operator-brief.md` as the maintainer next-step brief, `artifacts/productization/public-beta-tester-invite.md` as the invite, `artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md` as the packet overview, and `artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md` as the tester-facing runbook.

8. Validate beta feedback with `npm run verify:public-beta-feedback`, `npm run verify:public-beta-feedback-api`, and `npm run intake:public-beta-return -- --receipt <path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json` when a tester returns a filled receipt. Treat `blocked` or `needs_fix_before_more_testers` as follow-up planning evidence, not release approval.

9. Before any real provider trial, run the real-model adapter contract, trial kit, receipt template, and return-intake verifiers. Keep `AI_PROVIDER_MANUAL_ACCEPTED=false` until a separate human model trial explicitly accepts provider behavior.

10. After real human acceptance and real-model trial evidence exist, use the separate product release approval template and return intake. Treat even a valid release-review receipt as follow-up release-review evidence, not packaging unlock.

11. After public beta preparation is green, run `npm run ci:productization` as the one-command local gate; it builds, starts or reuses the selected host/port, waits for `/api/health`, runs the bounded productization gates against the same base URL, and refreshes both live human-acceptance and public-beta tester preflights before handoff packaging. When you need a clean GitHub upload archive for another developer, the full local CI now verifies the local receipt, stages the source package, verifies takeover-entry consistency against staged docs, rebuilds/verifies the final archive with that receipt, and rebuilds/verifies the product delivery index; after upload, confirm `.github/workflows/productization-ci.yml` passes in GitHub Actions, including its `/api/health` runtime wait, before inviting a tester from that checkout.

12. Continue shrinking the ordinary-user path, replacing remaining mojibake across deep-inspection pages, and deciding whether the Web app is the real product shell or only a local evidence viewer for the Codex plugin.
## Status Label

Use this label for the project now:

```text
Productization pass focused on the core teach-correct-review-reuse loop. All-software learning and universal native execution are paused as advanced research goals.
```
