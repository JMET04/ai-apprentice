export const visualLearningAcceptanceGate = {
  accepted: false,
  status: "pending_teacher_acceptance",
  packagingGated: true,
  title: "Packaging gate is locked",
  reason:
    "Rules, memory activation, packaging, release, and automatic execution stay locked until a teacher explicitly accepts the learning result, rule boundary, and reuse behavior."
} as const;
