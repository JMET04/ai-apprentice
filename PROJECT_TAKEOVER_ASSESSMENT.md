# Transparent AI Apprentice MCP Takeover Assessment

Date: 2026-06-26

## Executive Summary

This project has moved from broad all-software ambition back to a bounded productization track.

The current product goal is not "control every program" and not "release to production". The current goal is a productized, review-only AI apprentice MVP for the core teaching loop:

```text
human teaches -> AI executes -> human corrects -> system extracts reusable rule drafts -> next run is more controlled and transparent
```

As of the latest local productization pass, the project is ready for a controlled first outside pass: exactly one bounded beta tester or one real human acceptance reviewer can be invited through the generated handoff materials. The product is still not release-ready. Release, packaging unlock, real-model activation, all-software scope, and product acceptance remain intentionally blocked.

## Current Productization Status

Use this status label when handing the project to another maintainer:

```text
Bounded core teaching-loop productization candidate. Automated build, tests, source package, new-repository bootstrap, public beta packet, and first-real-tester handoff are green. Ready for one controlled human/beta pass, not production release.
```

Latest verified evidence:

- Local productization CI: `passed`, 3/3.
- Productization CI receipt verification: `passed`, 8/8.
- TypeScript typecheck: passed.
- Unit tests: 15 test files, 108 tests passed.
- Next.js production build: passed.
- Public beta readiness: `passed`, 60/60, `betaCanStart=true`.
- GitHub source package verification: `passed`, 48/48.
- Dependency-free new repository bootstrap: `passed`, 9/9.
- Product delivery index verification: `passed`, 14/14.
- First real tester launch verification: `passed`, 8/8.
- First real tester contact readiness: `passed`, 7/7.
- First real tester final go/no-go: `passed`, 8/8.

Current verified source archive:

Use `artifacts/productization/product-delivery-index.json` or `artifacts/productization/product-delivery-index.md` as the current archive pointer. The delivery index is rebuilt after source package verification so this assessment does not hard-code a self-staling zip filename or SHA.

The local root `.git` directory is not valid. Treat the verified source archive named by the product delivery index as the handoff source of truth, not local Git status.

## What Is Implemented

- Next.js product prototype for the teachable-apprentice loop.
- API routes for apprentices, tasks, workflows, runs, corrections, visual demonstrations, manual acceptance, public beta feedback, and product readiness.
- Prisma/SQLite schema for users, apprentices, tasks, workflows, rules, corrections, teaching examples, visual demonstrations, execution runs, and trace steps.
- AI service interface with mock provider as the default safe runtime.
- OpenAI-compatible real-model adapter contract tests using fake fetch; no real provider activation is accepted yet.
- Structured public trace model that exposes steps, rules, confidence, validation, and review points without private chain-of-thought.
- Demo learning loop around a photography travel journal task.
- Correction-to-rule extraction for the demo domain.
- Manual acceptance workbench at `/manual-test` with artifact-backed review evidence.
- Public beta workbench at `/public-beta` with feedback receipt validation.
- Product handoff and return-loop surfaces at `/handoff`.
- Product trial packet, public beta packet, first-real-tester dispatch packet, send bundle, send receipt template, return workbench, and return gate.
- Source-only GitHub handoff package with dependency-free bootstrap verifier.
- Productization lock hardening and coverage audit so review-only materials do not become release, packaging, model activation, or all-software acceptance.

## Verified Functional Areas I Would Trust

These are backed by current automated evidence and are reasonable to rely on for a controlled beta or reviewer pass:

- Build and type safety: production build and `tsc` pass.
- Unit-level product behavior covered by Vitest: 108 tests pass.
- Productization CI orchestration: build, runtime health, gates, final package, source verifier, bootstrap, and delivery index pass as one local command.
- Public beta packet completeness: 60/60 readiness checks pass.
- First-real-tester send flow: launch, dispatch, selected-lane send bundle, contact readiness, send execution brief, receipt template, final go/no-go, return workbench, and return gate are generated and verified.
- Source package boundary: archive excludes secrets, dependencies, local database, build cache, and `.git`.
- New checkout bootstrap: staged source passes dependency-free `verify:new-repo-bootstrap` before `npm install`.
- Release locks: current materials preserve `releaseDecision=do_not_release`, `allSoftwareObjective=paused`, `accepted=false`, `packagingGated=true`, `canRelease=false`, and `canActivateRealModel=false`.

## What Is Still Not Complete

These are the current blockers to real release:

1. Real human acceptance is not complete.
   Current evidence still says the latest acceptance evidence is automated browser smoke, not `human_review` from a real reviewer.

2. Real model acceptance is not complete.
   The active provider remains mock. The adapter contract is verified with fake fetch, but that does not activate or accept a real model.

3. Release and packaging approval are still locked.
   Release readiness is intentionally `blocked_not_release_ready`; packaging remains gated until separate human/model/release approval exists.

4. The all-software objective is paused.
   Do not resume universal native control, unattended all-app monitoring, or broad software coverage from these productization artifacts.

5. The demo domain is still narrow.
   The strongest product evidence is around the bounded core teaching loop and demo learning workflows, not arbitrary domain-specialized apprentices in production.

## First Read Order For Takeover

Open these in order:

1. `artifacts/productization/product-delivery-index.md`
2. `artifacts/productization/product-takeover-decision-matrix.md`
3. `artifacts/productization/productization-launch-checklist.md`
4. `artifacts/productization/first-real-tester-launch.md`
5. `artifacts/productization/first-real-tester-dispatch-packet/START_FIRST_REAL_TESTER.md`
6. `artifacts/productization/first-real-tester-send-bundle.md`
7. `artifacts/productization/first-real-tester-contact-readiness.md`
8. `artifacts/productization/first-real-tester-send-execution-brief.md`
9. `artifacts/productization/first-real-tester-send-receipt-template.md`
10. `artifacts/productization/first-real-tester-final-go-no-go.md`
11. `artifacts/productization/first-real-tester-return-workbench.md`
12. `artifacts/productization/first-real-tester-return-gate.md`
13. `artifacts/productization/product-status-summary.md`
14. `artifacts/productization/product-operator-brief.md`
15. `artifacts/productization/product-release-blocker-board.md`

## Recommended Next Action

Do not add broad new features first. The next productization step should be a controlled human pass:

1. Run `npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000` immediately before contact.
2. Rebuild and verify contact readiness, send execution brief, send receipt template, and final go/no-go if anything changed.
3. Send only `artifacts/productization/first-real-tester-send-bundle/SEND_TO_FIRST_EXTERNAL_PERSON` to exactly one external tester.
4. Keep `KEEP_FOR_RETURN_INTAKE`, maintainer notes, release approval material, real-model material, and unselected-lane material inside the workspace.
5. After sending, fill a copy of `artifacts/productization/first-real-tester-send-receipt.template.json` and validate it with `npm run verify:first-real-tester-send-receipt-template -- --receipt <path>`.
6. When the first return arrives, process it through `first-real-tester-return-workbench` and `first-real-tester-return-gate` before inviting anyone else.

A parallel valid path is to run one real human acceptance review instead of public beta, but the same rule holds: one lane, one person, live preflight, validated send receipt, then gated return processing.

## Main Takeover Risks

1. Evidence sprawl.
   There are many generated artifacts. Use the delivery index and takeover matrix first; do not browse random historical evidence and infer status from it.

2. Root Git is invalid.
   Use the verified source archive and delivery index as handoff evidence. Reinitialize source control only after deciding which generated artifacts should be retained.

3. Mock AI boundary.
   The productized beta path is safe with mock AI. Real-provider use requires the separate real-model trial kit, redaction checklist, returned evidence, and explicit acceptance.

4. Release confusion.
   Public beta readiness does not mean release readiness. The current release gate is intentionally blocked.

5. First tester widening.
   Do not invite a second tester or reviewer until the first return has been processed and the return gate allows widening.

## Useful Commands

```bash
npm run ci:productization
npm run verify:github-source
npm run verify:new-repo-bootstrap -- --root artifacts/github-source-package/transparent-ai-apprentice-mcp
npm run verify:product-delivery-index
npm run preflight:public-beta-tester -- --base-url http://127.0.0.1:3000
npm run verify:first-real-tester-final-go-no-go
npm run verify:product-release-readiness -- --allow-blocked
```

## Bottom Line

Start artificial/manual testing now, but keep it bounded. The system is ready for exactly one controlled beta tester or one human acceptance reviewer. It is not ready for production release, real-model activation, packaging unlock, or any return to the all-software objective.