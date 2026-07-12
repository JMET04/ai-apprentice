export type SkillDefinition = {
  name: string;
  description: string;
  learnedFrom: "seed" | "teacher-correction" | "future-marketplace";
};

export const skillRegistry: SkillDefinition[] = [
  {
    name: "photography-travel-journal",
    description:
      "Turns raw travel notes into structured photography journals with visible trace evidence.",
    learnedFrom: "teacher-correction"
  }
];
