export const PUBLIC_BETA_FRESHNESS_RECOVERY_MARKER = "pending_productization_evidence_freshness_refresh";
export const PUBLIC_BETA_FRESHNESS_CHECK_NAME = "Productization evidence freshness is verified and packaged";

export type PublicBetaReadinessLike = {
  status?: string;
  betaCanStart?: boolean;
  passed?: number;
  total?: number;
  releaseDecision?: string;
  checks?: Array<{ name?: string; pass?: boolean; evidence?: string }>;
};

export function isPublicBetaFreshnessOnlyPending(publicBeta: PublicBetaReadinessLike | null | undefined) {
  if (
    publicBeta?.status !== "failed" ||
    publicBeta.releaseDecision !== "do_not_release" ||
    (publicBeta.total ?? 0) <= 0 ||
    publicBeta.passed !== (publicBeta.total ?? 0) - 1
  ) {
    return false;
  }

  const failedChecks = publicBeta.checks?.filter((check) => check.pass !== true) ?? [];
  return (
    failedChecks.length === 1 &&
    failedChecks[0]?.pass === false &&
    failedChecks[0]?.name === PUBLIC_BETA_FRESHNESS_CHECK_NAME &&
    failedChecks[0]?.evidence?.includes("status=failed") === true
  );
}

export function isPublicBetaGateReady(publicBeta: PublicBetaReadinessLike | null | undefined) {
  return (publicBeta?.status === "passed" && publicBeta.betaCanStart === true) || isPublicBetaFreshnessOnlyPending(publicBeta);
}

export function publicBetaGateStatusLine(publicBeta: PublicBetaReadinessLike | null | undefined) {
  if (!isPublicBetaGateReady(publicBeta)) return null;

  const recovery = isPublicBetaFreshnessOnlyPending(publicBeta)
    ? ` recovery=${PUBLIC_BETA_FRESHNESS_RECOVERY_MARKER}`
    : "";
  return `passed ${publicBeta?.passed ?? 0}/${publicBeta?.total ?? 0}${recovery}`;
}
