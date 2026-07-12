import { describe, expect, it } from "vitest";
import {
  PUBLIC_BETA_FRESHNESS_RECOVERY_MARKER,
  isPublicBetaFreshnessOnlyPending,
  isPublicBetaGateReady,
  publicBetaGateStatusLine
} from "./public-beta-recovery";

describe("public beta evidence freshness recovery gate", () => {
  it("treats a fully passed public beta verifier as ready", () => {
    const readiness = {
      status: "passed",
      betaCanStart: true,
      passed: 59,
      total: 59,
      releaseDecision: "do_not_release"
    };

    expect(isPublicBetaFreshnessOnlyPending(readiness)).toBe(false);
    expect(isPublicBetaGateReady(readiness)).toBe(true);
    expect(publicBetaGateStatusLine(readiness)).toBe("passed 59/59");
  });

  it("allows only the evidence freshness refresh check to be temporarily pending", () => {
    const readiness = {
      status: "failed",
      betaCanStart: false,
      passed: 58,
      total: 59,
      releaseDecision: "do_not_release",
      checks: [
        {
          name: "Productization evidence freshness is verified and packaged",
          pass: false,
          evidence: "status=failed; stale=product-status-summary"
        }
      ]
    };

    expect(isPublicBetaFreshnessOnlyPending(readiness)).toBe(true);
    expect(isPublicBetaGateReady(readiness)).toBe(true);
    expect(publicBetaGateStatusLine(readiness)).toBe(`passed 58/59 recovery=${PUBLIC_BETA_FRESHNESS_RECOVERY_MARKER}`);
  });

  it("blocks recovery when any non-freshness public beta check fails", () => {
    const readiness = {
      status: "failed",
      betaCanStart: false,
      passed: 58,
      total: 59,
      releaseDecision: "do_not_release",
      checks: [
        {
          name: "Public beta packet includes tester runbook",
          pass: false,
          evidence: "status=failed; missing=PUBLIC_BETA_TESTER_RUNBOOK.md"
        }
      ]
    };

    expect(isPublicBetaFreshnessOnlyPending(readiness)).toBe(false);
    expect(isPublicBetaGateReady(readiness)).toBe(false);
    expect(publicBetaGateStatusLine(readiness)).toBeNull();
  });

  it("blocks recovery when release locks are not preserved", () => {
    const readiness = {
      status: "failed",
      betaCanStart: false,
      passed: 58,
      total: 59,
      releaseDecision: "release",
      checks: [
        {
          name: "Productization evidence freshness is verified and packaged",
          pass: false,
          evidence: "status=failed"
        }
      ]
    };

    expect(isPublicBetaFreshnessOnlyPending(readiness)).toBe(false);
    expect(isPublicBetaGateReady(readiness)).toBe(false);
  });
});
