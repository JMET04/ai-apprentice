import type { QualificationReport } from "@/server/qualification/learning-report";

export type QualificationApiSummary = Pick<
  QualificationReport,
  | "taskId"
  | "apprenticeId"
  | "status"
  | "packaging"
  | "summary"
  | "requirements"
  | "policyEvidence"
  | "teacherReviewChecklist"
  | "learningLoopTimeline"
> & {
  responseMode: "qualification_summary_json_v1";
  fullReportHint: string;
};

export function buildQualificationApiSummary(report: QualificationReport): QualificationApiSummary {
  return {
    responseMode: "qualification_summary_json_v1",
    fullReportHint: "Append ?view=full only for local deep inspection; the full review tree can be very large.",
    taskId: report.taskId,
    apprenticeId: report.apprenticeId,
    status: report.status,
    packaging: report.packaging,
    summary: report.summary,
    requirements: report.requirements,
    policyEvidence: report.policyEvidence,
    teacherReviewChecklist: report.teacherReviewChecklist,
    learningLoopTimeline: report.learningLoopTimeline
  };
}
