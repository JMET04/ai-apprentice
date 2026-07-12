# Product Handoff Runbook

Date: 2026-06-23

## Current Product Decision

The all-software objective is paused.

The current product handoff target is the Web app's bounded core loop:

```text
teacher opens stable demo -> runs task -> reviews trace -> corrects result -> rule is saved -> rerun shows learned behavior -> packaging stays locked
```

This runbook is for a teammate taking over the current productization pass. It is not a claim that universal native software control, unattended learning, packaging, release, or technology acceptance is complete.

## What To Open First

Use these URLs after starting the app:

- Dashboard: `http://127.0.0.1:3000`
- Product takeover status: `http://127.0.0.1:3000/handoff`
- Runtime health API: `http://127.0.0.1:3000/api/health`
- Product readiness API: `http://127.0.0.1:3000/api/product-readiness`
- Product release go/no-go API: `http://127.0.0.1:3000/api/product-release-readiness`
- AI service status API: `http://127.0.0.1:3000/api/ai-service-status`
- Manual acceptance evidence API: `http://127.0.0.1:3000/api/manual-acceptance-reports`
- Manual acceptance workbench: `http://127.0.0.1:3000/manual-test`
- Stable task review: `http://127.0.0.1:3000/tasks/task-photo-travel-journal/review`
- Stable task run/correction: `http://127.0.0.1:3000/tasks/task-photo-travel-journal/run`

`/handoff` is intentionally dynamic. It reads the latest local productization artifacts, release gate, live handoff, and public beta feedback state at request time instead of relying on a stale prerendered snapshot.

The acceptance object must show:

```text
task-photo-travel-journal / Generate a structured photography travel journal from a travel note
```

If the dashboard or manual acceptance workbench shows `Smoke photography journal ...` as the primary product task, stop and fix the entry path before testing.

## Fresh Setup

From the repository root:

```bash
npm install
npm run setup:demo
npm run verify:product
```

`npm run verify:product` is the preferred handoff gate. Its temporary production server also runs from `artifacts/productization/runtime/verify-standalone` instead of directly from `.next/standalone`, so failed verification should not leave `.next` locked. It runs:

1. TypeScript typecheck.
2. Next.js production build.
3. Temporary standalone production server.
4. Product UI/API smoke.
5. Real-browser manual acceptance smoke.
6. Real HTTP teach-correct-rerun smoke.
7. Product handoff readiness check.

The verification pins the demo SQLite database to `prisma/dev.db` so standalone production mode does not accidentally use an empty generated SQLite file.

For a fast documentation/data/evidence check without rebuilding the app, run:

```bash
npm run verify:handoff
```

For a fast runtime check after the app is already running, run:

```bash
npm run doctor:product
```

The doctor checks health, trial readiness, durable product UI/API smoke evidence, the release go/no-go endpoint, and the AI provider boundary. A healthy trial should still report `releaseDecision=do_not_release` until the real human acceptance, real model, and packaging gates are unlocked.
It writes `artifacts/productization/product-runtime-doctor.json` so the runtime diagnosis can be handed off with the rest of the product evidence.

For a final live handoff check against the currently running trial server, run:

```bash
npm run verify:live-handoff -- --base-url http://127.0.0.1:3000
```

This checks the live health/readiness/release/AI endpoints, confirms only the `standalone` runtime remains under `artifacts/productization/runtime/`, and verifies the review-only trial packet evidence. It writes `artifacts/productization/live-product-handoff.json`.
For visual takeover evidence, also run `npm run smoke:handoff-browser -- --base-url http://127.0.0.1:3000`. It captures desktop and mobile screenshots of the `/handoff` beta feedback return loop and writes `artifacts/productization/handoff-browser-smoke.json`.
For public beta entry evidence, run `npm run smoke:public-beta-browser -- --base-url http://127.0.0.1:3000`. It captures desktop and mobile screenshots of `/public-beta`, dry-run validates the feedback builder, and proves validation does not grow the feedback inbox.
For manual acceptance entry evidence, run `npm run smoke:manual-browser -- --base-url http://127.0.0.1:3000`. It captures desktop and mobile screenshots of `/manual-test`, exports the browser-smoke manual report, and proves automation still cannot save real `human_review` evidence.

To preview inactive verification runtime copies after repeated verification runs, run:

```bash
npm run cleanup:runtime-artifacts
```

Apply the cleanup only after reviewing the dry-run output:

```bash
npm run cleanup:runtime-artifacts -- --apply
npm run doctor:product -- --base-url http://127.0.0.1:3000
```

The runtime cleanup targets only inactive `product-runtime-verify-*` and `verify-standalone*` directories under `artifacts/productization/runtime/`. It protects the `standalone` trial runtime and writes `artifacts/productization/runtime-artifact-cleanup.json`.

For the real human acceptance gate, run:

```bash
npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000
npm run build:human-acceptance-reviewer-kit
npm run verify:human-acceptance-reviewer-kit
npm run build:human-acceptance-receipt-template
npm run verify:human-acceptance-receipt
npm run verify:human-acceptance
```

The preflight checks `/manual-test`, the manual acceptance save API, current human gate state, release lock, and AI boundary without saving `human_review` evidence.
After the preflight passes, build and verify `artifacts/productization/human-acceptance-reviewer-kit.md` before giving the task to a real reviewer. The kit is review-only: it keeps `accepted=false`, `packagingGated=true`, `releaseDecision=do_not_release`, and `allSoftwareObjective=paused`.
Give the reviewer a copy of `artifacts/productization/human-acceptance-receipt.template.json`; validate the filled copy with `npm run verify:human-acceptance-receipt -- --receipt path/to/filled-human-acceptance-receipt.json` before treating it as follow-up evidence.
When the reviewer returns a filled receipt, run `npm run intake:human-acceptance-return -- --receipt path/to/filled-human-acceptance-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json`. It validates the receipt, archives only valid copies under `artifacts/productization/human-acceptance-receipt-inbox/`, refreshes `human-acceptance-gate.json`, refreshes release readiness and blocker handoff files, and still keeps `releaseDecision=do_not_release` unless the saved `/manual-test` evidence is genuinely `human_review`.
After return intake, run `npm run verify:human-acceptance-return-intake` first. Only after that verifier passes, run the `postIntakeRefresh.commandSequence` recorded by the intake receipt before relying on refreshed reviewer invites, real-model trial handoff, blocker boards, operator brief, status summary, takeover matrix, delivery freshness, or follow-up planning. Do not rebuild reviewer invites from a failed return-intake verification receipt, and do not treat the returned receipt as acceptance unless `/manual-test` saved `human_review` evidence and `npm run verify:human-acceptance` passes.
This command is expected to fail until a real tester saves `evidenceKind=human_review` from `/manual-test`. Product automation may run `npm run verify:human-acceptance -- --allow-pending` only to write the current gate snapshot without claiming acceptance.

To verify the classification rules themselves, run:

```bash
npm run verify:manual-acceptance-classification
```

This uses a temporary artifact directory and proves automation, missing attestation, mismatched attestation, and failed manual reports cannot become `human_review`.

For the production release go/no-go gate, run:

```bash
npm run verify:product-release-readiness
```

This command is stricter than `verify:product`. It also requires the durable product UI/API smoke receipt to be green. It is expected to fail until real human acceptance exists, a real model adapter is accepted, and the release/packaging lock is explicitly opened. Product automation may run `npm run verify:product-release-readiness -- --allow-blocked` only to write the current blocked release decision.
After refreshing the release receipt, run `npm run build:product-status-summary` and `npm run verify:product-status-summary`, then run `npm run build:product-takeover-matrix` and `npm run verify:product-takeover-matrix`, then run `npm run build:product-operator-brief` and `npm run verify:product-operator-brief`, then run `npm run build:product-release-blocker-board` and `npm run verify:product-release-blocker-board`. Open `artifacts/productization/product-takeover-decision-matrix.md` first to choose one allowed next action and see stop conditions; use `artifacts/productization/product-status-summary.md` as the companion beta-ready/release-blocked page; use `artifacts/productization/product-operator-brief.md` as the single next-step handoff for beta, human acceptance, and real-model trial planning; use `artifacts/productization/product-release-blocker-board.md` as the maintainer action board for resolving release blockers while `releaseDecision=do_not_release`.
For the release/packaging approval blocker, run `npm run build:product-release-approval-template` and `npm run verify:product-release-approval`. Give a separate release reviewer a copy of `artifacts/productization/product-release-approval.template.json` only after human acceptance and real-model evidence exist; process the filled copy with `npm run intake:product-release-approval-return -- --receipt path/to/filled-product-release-approval.json`, then run `npm run verify:product-release-approval-return-intake` before relying on separate release-review evidence. A passed receipt is release-review evidence only: it cannot save product acceptance, accept the model, unlock packaging, resume all-software scope, or change `releaseDecision=do_not_release`.
For the real-model blocker, run `npm run verify:real-model-adapter-contract`, then `npm run build:real-model-trial-kit` and `npm run verify:real-model-trial-kit`. The adapter contract verifier uses fake fetch only: it proves the OpenAI-compatible adapter can produce the bounded execution shape and review-only correction rule without real network, real secrets, model acceptance, packaging unlock, or release approval. Use `artifacts/productization/real-model-trial-kit.md` before any real provider trial; it documents `AI_PROVIDER`, `OPENAI_API_KEY`, `/api/ai-service-status`, `AI_PROVIDER_MANUAL_ACCEPTED=false`, returned evidence, rollback, and the stop conditions. The kit is review-only and cannot activate a real model, save acceptance, unlock packaging, or claim release readiness.
Before handing the trial to a reviewer, run `npm run build:real-model-trial-receipt-template` and `npm run verify:real-model-trial-receipt`. Give the reviewer a copy of `artifacts/productization/real-model-trial-receipt.template.json`; process the filled copy with `npm run intake:real-model-trial-return -- --receipt path/to/filled-real-model-trial-receipt.json`, then run `npm run verify:real-model-trial-return-intake` before relying on real-provider trial evidence. A passed receipt is follow-up evidence only, not model acceptance, release approval, or packaging unlock.

The latest release decision is also exposed at `/api/product-release-readiness`. Treat `/api/product-readiness` and `/handoff` as trial takeover evidence; `/api/product-readiness` also exposes public beta feedback validation and collection status. Treat `/api/product-release-readiness` as the production release go/no-go source.

For a local trial that is closer to production than the dev server, run:

```bash
npm run build
npm run start:product -- --hostname 127.0.0.1 --port 3000
```

This starts the standalone build when available and pins the demo database to `prisma/dev.db` unless `DATABASE_URL` is already set.
On Windows, `start:product` runs from `artifacts/productization/runtime/standalone` instead of directly from `.next/standalone`, so a local trial server does not lock `.next` and block the next `npm run build`.

To verify that public product start command end to end, run:

```bash
npm run verify:product-runtime
```

It writes `artifacts/productization/product-runtime-verification.json`. The verifier passes a dedicated `--runtime-dir artifacts/productization/runtime/product-runtime-verify-<port>` to `start:product`, so it can run even while a local trial server is already using the default standalone copy.

To rebuild the concentrated trial handoff packet after verification, run:

```bash
npm run package:product-trial
```

Open `artifacts/productization/product-trial-packet/START_HERE.md` first when handing the project to another tester. The packet is review-only evidence, not release acceptance.
When public-beta evidence has already been generated, the same trial packet carries the latest public-beta readiness receipt plus feedback template validation, feedback collection, and collection-behavior verification receipts. This keeps takeover and beta follow-up in one evidence bundle without turning beta feedback into acceptance or release approval.

To build a bounded public-beta packet for testers after the live handoff check is green, run:

```bash
npm run prepare:public-beta -- --base-url http://127.0.0.1:3000
```

This is the preferred handoff command before inviting a tester. It runs feedback collection verification, follow-up plan verification, inbox collection, follow-up planning, tester invite generation/verification, human acceptance reviewer kit generation/verification, release blocker board refresh, release approval receipt template generation/verification, real-model trial kit generation/verification, real-model trial receipt template generation/verification, handoff refresh, live handoff, public beta packaging, final beta verification, writes `artifacts/productization/public-beta-preparation.json`, and syncs that compact, path-sanitized receipt into `public-beta-packet/evidence/public-beta-preparation.json`.
It also runs `npm run verify:public-beta-feedback-api` so the browser feedback receipt endpoint is proven before a tester uses `/public-beta`.
It also refreshes `/public-beta` browser evidence with `npm run smoke:public-beta-browser -- --base-url http://127.0.0.1:3000`, including desktop/mobile screenshots and a dry-run feedback validation that must not grow the inbox.
It also refreshes `/manual-test` browser evidence with `npm run smoke:manual-browser -- --base-url http://127.0.0.1:3000`, then refreshes the human acceptance gate with `npm run verify:human-acceptance -- --allow-pending`. The manual acceptance workbench must be readable on desktop and mobile, export browser-smoke evidence, and keep `evidenceKind=automated_browser_smoke` until a real reviewer saves `human_review`.
It also refreshes `/handoff` browser evidence with `npm run smoke:handoff-browser -- --base-url http://127.0.0.1:3000`. The `/handoff` page must show `Beta Feedback Return Loop`, `Return Handling Commands`, `returnLoop=waiting_for_first_tester_return`, and `release=do_not_release` on desktop and mobile before a tester is invited.

If you need to debug the sequence step by step, use:

```bash
npm run package:public-beta
npm run verify:public-beta
npm run preflight:human-acceptance -- --base-url http://127.0.0.1:3000
npm run build:human-acceptance-reviewer-kit
npm run verify:human-acceptance-reviewer-kit
npm run build:human-acceptance-receipt-template
npm run verify:human-acceptance-receipt
npm run verify:human-acceptance-return-intake
npm run build:product-status-summary
npm run verify:product-status-summary
npm run build:product-release-blocker-board
npm run verify:product-release-blocker-board
npm run build:product-operator-brief
npm run verify:product-operator-brief
npm run build:product-release-approval-template
npm run verify:product-release-approval
npm run verify:product-release-approval-return-intake
npm run verify:real-model-adapter-contract
npm run build:real-model-trial-kit
npm run verify:real-model-trial-kit
npm run build:real-model-trial-receipt-template
npm run verify:real-model-trial-receipt
npm run verify:real-model-trial-return-intake
npm run verify:public-beta-feedback
npm run verify:public-beta-feedback-api
npm run smoke:public-beta-browser -- --base-url http://127.0.0.1:3000
npm run verify:public-beta-feedback-collection
npm run collect:public-beta-feedback
npm run plan:public-beta-follow-up
npm run verify:public-beta-follow-up-plan
npm run build:public-beta-tester-invite
npm run verify:public-beta-tester-invite
npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000
npm run smoke:manual-browser -- --base-url http://127.0.0.1:3000
npm run smoke:handoff-browser -- --base-url http://127.0.0.1:3000
npm run intake:public-beta-return -- --receipt path/to/submitted-feedback.json --session-receipt path/to/filled-public-beta-session-receipt.json --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json
npm run verify:public-beta-return-intake
```

Open `artifacts/productization/public-beta-packet/START_PUBLIC_BETA.md` for the packet overview, then give `artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md` to the bounded beta tester as the clean session script. This packet may be `ready_for_public_beta` while `releaseDecision=do_not_release`; it does not unlock packaging or production release.
Use `artifacts/productization/public-beta-packet/docs/REAL_MODEL_TRIAL_KIT.md` before any real-model trial. It explains the real provider setup and acceptance path but keeps `AI_PROVIDER_MANUAL_ACCEPTED=false`, `accepted=false`, `packagingGated=true`, and `releaseDecision=do_not_release` until a separate human model trial and release approval occur.
Keep `artifacts/productization/public-beta-packet/evidence/real-model-adapter-contract-verification.json` with the beta packet before planning any real-provider trial. It is fake-fetch contract evidence only, not a real model trial.
Use `artifacts/productization/public-beta-packet/docs/REAL_MODEL_TRIAL_RECEIPT.template.json` to collect structured real-model trial evidence. Validate any filled copy before relying on it; the validator still keeps `accepted=false`, `packagingGated=true`, and `releaseDecision=do_not_release`.
Use `artifacts/productization/public-beta-packet/docs/PRODUCT_RELEASE_APPROVAL.template.json` only for a separate release reviewer after human and model acceptance evidence exists. Process any filled copy with `npm run intake:product-release-approval-return -- --receipt path/to/filled-product-release-approval.json`; this remains release-review evidence and keeps `accepted=false`, `packagingGated=true`, `canRelease=false`, and `releaseDecision=do_not_release`.
Use `artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_FEEDBACK_RECEIPT.template.json` for structured beta feedback when a machine-readable tester receipt is useful; the template keeps `accepted=false`, `packagingGated=true`, and `releaseDecision=do_not_release`.
Testers can also use `/public-beta` in the running product. The Feedback Receipt Builder can download the same review-only JSON shape or POST it to `/api/public-beta-feedback-receipts`; `dryRun=true` validates without saving, while a valid non-dry-run submit writes to `artifacts/productization/public-beta-feedback-inbox/`.
Run `npm run verify:public-beta-feedback-api` before relying on the browser submit path. It uses a temporary artifact directory to prove dry-run validation does not save, valid ready feedback saves, invalid feedback is rejected, blocked feedback requires a blocker, and release/packaging locks stay closed.
When a tester returns a filled JSON receipt, validate it with `npm run verify:public-beta-feedback -- --receipt <path>`. A valid feedback receipt is follow-up evidence only; it still cannot accept the product, enable rules, unlock packaging, resume all-software scope, or claim release readiness.
Do not hand-copy externally returned tester receipts into `artifacts/productization/public-beta-feedback-inbox/`. Run `npm run intake:public-beta-return -- --receipt <path> --session-receipt <session-receipt-path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json`; it validates the feedback receipt plus whole-session receipt, archives both review-only receipts, refreshes `public-beta-feedback-collection.json`, and refreshes `public-beta-follow-up-plan.json`. Use `npm run collect:public-beta-feedback` only to audit or refresh the current inbox queue after intake or browser-submitted feedback. The collection is a review-only queue for follow-up planning, not release approval.
Run `npm run verify:public-beta-feedback-collection` before relying on a feedback queue. It proves empty, ready, needs-fix, blocked, and invalid receipts are classified correctly without changing the real inbox.
Run `npm run plan:public-beta-follow-up` after collection to produce `artifacts/productization/public-beta-follow-up-plan.json`. This plan is the maintainer-facing decision board for inviting another tester, fixing beta issues, stopping on blockers, or preserving release locks; it is not acceptance or release approval.
Run `npm run build:public-beta-tester-invite` and `npm run verify:public-beta-tester-invite` before contacting a tester. Use `artifacts/productization/public-beta-tester-invite.md` as the sendable maintainer invite copy and `artifacts/productization/public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md` as the tester-facing script for one bounded beta tester.
Run `npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000` immediately before contacting that tester. It checks the live URL, tester entry pages, invite state, return-intake path, and release lock, then writes `artifacts/productization/public-beta-tester-session-preflight.json`.
After intake, invalid receipts are rejected and not copied; do not invite another tester until `npm run verify:public-beta-feedback-collection` and `npm run verify:public-beta-follow-up-plan` pass.
When a human acceptance reviewer returns a filled JSON receipt, run `npm run intake:human-acceptance-return -- --receipt <path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json`. A valid receipt may be archived while the gate still reports `blocked_needs_human_review`; treat `processed_gate_verified` as the only intake status that proves the saved manual evidence and receipt agree. Then run `npm run verify:human-acceptance-return-intake` and, only after it passes, run the receipt's `postIntakeRefresh.commandSequence` before using refreshed reviewer invite, release blocker, status summary, takeover matrix, or evidence freshness files.
The public beta manifest also declares generated files under `generatedFiles`, including the tester entrypoint, the tester runbook, the Markdown feedback template, and the JSON feedback receipt template. `npm run verify:public-beta` checks those declarations before beta can start and, on pass, syncs the latest readiness receipt into `public-beta-packet/evidence/public-beta-readiness.json`.
The manual acceptance browser smoke writes `artifacts/productization/manual-acceptance-browser-smoke.json`, `artifacts/productization/manual-acceptance-browser-desktop.png`, `artifacts/productization/manual-acceptance-browser-mobile.png`, and `artifacts/productization/manual-acceptance-report.browser-smoke.json`. Treat those as visual workbench evidence only; they prove `/manual-test` can be driven and exported, not that a human accepted the product.
The handoff browser smoke writes `artifacts/productization/handoff-browser-smoke.json`, `artifacts/productization/handoff-beta-feedback-desktop.png`, and `artifacts/productization/handoff-beta-feedback-mobile.png`. Treat those as visual takeover evidence only; they prove the beta return-loop handoff is visible, not that feedback has been returned, acceptance has passed, or release is approved.
The public beta browser smoke writes `artifacts/productization/public-beta-browser-smoke.json`, `artifacts/productization/public-beta-browser-desktop.png`, and `artifacts/productization/public-beta-browser-mobile.png`. Treat those as tester-entry evidence only; it proves the `/public-beta` feedback builder is visible and dry-run validation is safe, not that a tester returned feedback or accepted the product.

To prepare a GitHub upload source archive after public beta preparation, run the full local gate:

```bash
npm run ci:productization
```

Use `npm run verify:productization-ci-local`, `npm run package:github-source`, `npm run verify:github-source`, and `npm run verify:new-repo-bootstrap -- --root artifacts/github-source-package/transparent-ai-apprentice-mcp` only when refreshing those artifacts separately from the full local CI. Run `npm run ci:productization` as the one-command bounded-beta gate before handing a checkout to another developer or tester. It builds the runtime, starts or reuses the selected host/port, waits for `/api/health`, runs the bounded productization gates against the same base URL, refreshes both live human-acceptance and public-beta tester preflights, writes and verifies the durable local CI receipt, stages the GitHub source package, verifies takeover-entry consistency against the staged docs, rebuilds/verifies the final GitHub source package with that receipt, runs the dependency-free new-repository bootstrap check, then builds/verifies the product delivery index so handoff evidence includes the current receipt and final staged-doc scan. In GitHub Actions, `.github/workflows/productization-ci.yml` builds the runtime, starts it, waits for `/api/health`, then runs `ci:productization:gates`. The archive excludes `.env`, local databases, `.git`, `.next`, `node_modules`, runtime copies, caches, and local agent/tool state. It includes the current public beta packet, product trial packet, compact public beta preparation receipt, and productization evidence needed for another developer to reproduce the bounded product path.

Important distinction: `manual-acceptance-report.browser-smoke.json` and a latest report with `evidenceKind=automated_browser_smoke` prove the workbench can be driven by automation. They are not a real human acceptance pass. A real tester pass must save `evidenceKind=human_review`, `humanReviewed=true`, `classificationReason=valid_human_review_evidence`, reviewer name, per-step notes, and the manual-review attestation.
After that pass, `artifacts/productization/human-acceptance-gate.json` should report `status=passed`.

## Optional Smoke Data Cleanup

Old smoke-created records can exist in `prisma/dev.db` after interrupted or historical verification runs. Product entry pages intentionally target the stable demo first, but a maintainer can clean generated smoke records before a handoff.

Preview the cleanup:

```bash
npm run cleanup:smoke-records
```

Apply it only after reviewing the dry-run output:

```bash
npm run cleanup:smoke-records -- --apply
npm run smoke:product -- --base-url http://127.0.0.1:3000
```

The cleanup script only targets records named `Smoke Apprentice ...` and `Smoke photography journal ...`. It writes `artifacts/productization/smoke-record-cleanup.json`.

## Local Trial

Start the app in local production mode:

```bash
npm run start:product -- --hostname 127.0.0.1 --port 3000
```

Then run a human pass from `/manual-test`:

1. Open the dashboard and confirm the product path is understandable.
2. Open the stable run page and run the photography journal task.
3. Submit one teacher correction.
4. Confirm the saved rule has visible source/provenance.
5. Rerun and inspect whether the learned rule changes the output.
6. Open the review page and confirm packaging remains locked.
7. Mark each manual acceptance step as passed or blocked.
8. Export the JSON report.
9. Save the review-only acceptance evidence in the app.

Passing manual acceptance means the bounded demo is ready for the next trial. It does not unlock packaging, release, automatic execution, or all-software goals.

## Current Automated Evidence

The latest productization pass keeps these generated browser artifacts under `artifacts/productization/`:

- `product-verification-receipt.json`
- `product-ui-api-smoke.json`
- `product-runtime-verification.json`
- `product-runtime-doctor.json`
- `runtime-artifact-cleanup.json`
- `live-product-handoff.json`
- `handoff-browser-smoke.json`
- `handoff-beta-feedback-desktop.png`
- `handoff-beta-feedback-mobile.png`
- `public-beta-browser-smoke.json`
- `public-beta-browser-desktop.png`
- `public-beta-browser-mobile.png`
- `product-release-readiness.json`
- `product-status-summary.md`
- `product-status-summary.json`
- `product-status-summary-verification.json`
- `product-release-blocker-board.md`
- `product-release-blocker-board.json`
- `product-release-blocker-board-verification.json`
- `product-release-approval.template.json`
- `product-release-approval-template.md`
- `product-release-approval-validation.json`
- `product-release-approval-return-intake-verification.json`
- `real-model-adapter-contract-verification.json`
- `real-model-trial-receipt-validation.json`
- `real-model-trial-return-intake-verification.json`
- `human-acceptance-gate.json`
- `human-acceptance-session-preflight.json`
- `human-acceptance-reviewer-kit.md`
- `human-acceptance-reviewer-kit.json`
- `human-acceptance-reviewer-kit-verification.json`
- `human-acceptance-receipt.template.json`
- `human-acceptance-receipt-template.md`
- `human-acceptance-receipt-validation.json`
- `human-acceptance-return-intake.json`
- `human-acceptance-return-intake-verification.json`
- `manual-acceptance-classification-verification.json`
- `dashboard-demo-metrics.png`
- `dashboard-product-entry.png`
- `manual-acceptance-demo-metrics.png`
- `manual-acceptance-browser-smoke.json`
- `manual-acceptance-browser.png`
- `manual-acceptance-browser-desktop.png`
- `manual-acceptance-browser-mobile.png`
- `manual-acceptance-report.browser-smoke.json`
- `manual-acceptance-latest.json`
- `product-handoff-readiness.json`
- `product-trial-packet/START_HERE.md`
- `product-trial-packet/product-trial-manifest.json`
- `public-beta-packet/START_PUBLIC_BETA.md`
- `public-beta-packet/docs/PUBLIC_BETA_TESTER_RUNBOOK.md`
- `public-beta-packet/docs/PUBLIC_BETA_FEEDBACK_RECEIPT.template.json`
- `public-beta-packet/evidence/public-beta-preparation.json`
- `public-beta-packet/public-beta-manifest.json`
- `public-beta-preparation.json`
- `public-beta-readiness.json`
- `public-beta-feedback-receipt-validation.json`
- `public-beta-feedback-collection.json`
- `public-beta-feedback-collection-verification.json`
- `public-beta-follow-up-plan.json`
- `public-beta-follow-up-plan-verification.json`
- `public-beta-tester-invite.md`
- `public-beta-tester-invite.json`
- `public-beta-tester-invite-verification.json`
- `public-beta-tester-session-preflight.json`
- `public-beta-return-intake-verification.json`
- `public-beta-return-intake.json`
- `../github-source-package/github-source-package-manifest.json`

The automated checks currently cover:

- Dashboard exposes the product path and stable demo task.
- Dashboard and manual acceptance metrics use stable-demo counts, not workspace totals.
- Manual acceptance page can be driven in a real Chromium-family browser.
- Manual report export contains review-only evidence.
- Manual acceptance evidence can be saved through the app without unlocking packaging, and a real human save requires reviewer name, every step passed, per-step notes, and explicit attestation.
- Latest manual acceptance evidence is classified as automated smoke versus real human review.
- The real human acceptance gate writes a durable receipt and blocks until `evidenceKind=human_review` exists.
- Manual acceptance classification has a bypass-resistance receipt proving incomplete or automated evidence cannot become `human_review`.
- Full `verify:product` runs leave a durable receipt with step timing and status.
- Release readiness has a separate go/no-go receipt; current trial readiness does not mean production release readiness.
- Public `start:product` runtime verification leaves a durable receipt for the production-mode start command.
- Runtime doctor leaves a durable receipt for the currently running product server and its release go/no-go status.
- A product trial packet can be rebuilt with docs, receipts, screenshots, current beta feedback receipts when available, and locked review-only boundaries.
- Qualification API remains teacher-review only.
- Core teach-correct-rerun loop works through real HTTP calls.
- Packaging remains gated with `accepted=false`.

## Current Boundaries

Do not claim these as complete:

- Universal all-software learning.
- Unattended native desktop control.
- Production model integration.
- Packaging or release acceptance.
- Automatic long-term memory enablement without teacher review.

The app still uses a mock/demo AI service boundary. Check `/api/ai-service-status` before any trial: `activeProvider` should remain `mock` until a real adapter is added behind the existing AI service interface and manually accepted.

## Known Handoff Risks

- The root `.git` directory is not a valid Git repository in this workspace.
- Large generated evidence folders exist and should not be treated as normal source review paths.
- Old smoke-created records may exist in `prisma/dev.db`; product entry pages intentionally target the stable demo first.
- Use `npm run cleanup:smoke-records` as a dry-run before deleting generated smoke records.
- Use `npm run cleanup:runtime-artifacts` as a dry-run before deleting inactive verification runtime copies; the script protects `artifacts/productization/runtime/standalone`.
- `README.md` contains extensive historical/plugin notes. Use this runbook and `PRODUCTIZATION_FOCUS.md` for the current Web productization pass.

## Recommended Next Work

1. Run one real human acceptance pass, save it through the app, and attach the exported JSON report.
2. Validate and archive the filled reviewer receipt with `npm run intake:human-acceptance-return -- --receipt <path> --send-receipt-validation artifacts/productization/first-real-tester-send-receipt-validation.json`.
3. Run `npm run verify:human-acceptance` and confirm `human-acceptance-gate.json` reports `status=passed`.
4. Confirm `/api/product-readiness` reports `manualAcceptance.humanAcceptanceStatus=human_review_saved`.
5. Fix any blocked manual acceptance step before expanding scope.
5. Keep ordinary pages focused on run, correct, review, and reuse.
6. Move deeper evidence dossiers behind explicit deep-inspection links.
7. Add a real-model adapter behind `src/server/ai/types.ts` only after the bounded loop is manually accepted.
