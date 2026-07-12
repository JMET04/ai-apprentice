export type LearningChallengePreset = {
  id: string;
  label: string;
  input: string;
  expectedLighting: string;
  expectedReview: boolean;
};

export const defaultLearningChallengeSuite: LearningChallengePreset[] = [
  {
    id: "positive-visual-cue",
    label: "正向视觉线索",
    input: "日内瓦湖边人像，clear 天气很好，golden hour，画面有 warm orange rim light 和 long shadows。",
    expectedLighting: "golden hour",
    expectedReview: false
  },
  {
    id: "counterexample-midday",
    label: "反例：正午强光",
    input: "日内瓦湖边人像，midday 正午，虽然有 rim light 和 long shadows，但太阳在 overhead sun。",
    expectedLighting: "natural light",
    expectedReview: true
  },
  {
    id: "ordinary-daylight",
    label: "普通日光",
    input: "日内瓦湖边小路，clear 普通日光，均匀自然光，主体和背景关系清楚。",
    expectedLighting: "natural light",
    expectedReview: true
  }
];
