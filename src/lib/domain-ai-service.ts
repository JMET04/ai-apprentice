export type AISelfStudyTopic = {
  id: string;
  label: string;
  whyToLearn: string;
  possibleMistakes: string[];
  teacherConfirmationQuestion: string;
  passCriteria: string;
  reviewOnly: true;
  accepted: false;
  packagingGated: true;
};

export type AIDomainSelfStudyResult = {
  domain: string;
  topics: AISelfStudyTopic[];
  generatedAt: string;
  note: string;
};

export function mockAIDomainSelfStudy(domain: string, teacherGoal: string): AIDomainSelfStudyResult {
  const baseTopics: AISelfStudyTopic[] = [
    {
      id: "self-study-coordinate-frame",
      label: "坐标系和单位约定",
      whyToLearn: `${domain} 里的所有位置、偏移和容差计算都必须基于明确的坐标系和单位，否则后续几何结果没有可比性。`,
      possibleMistakes: [
        "把不同坐标系的原点混在一起计算，导致位置偏移。",
        "忘记检查单位是否统一（如 meter 混用 centimeter）。",
        "忽略轴的指向，把 y 轴偏移当成 z 轴偏移。"
      ],
      teacherConfirmationQuestion: `老师，在 ${domain} 场景里，坐标系原点和轴指向是否固定？有没有需要我特别注意的轴反向或右手/左手约定？`,
      passCriteria: "能说出当前领域的坐标系原点、三个轴指向、单位，并检查至少一个输入是否符合这些约定。",
      reviewOnly: true as const,
      accepted: false as const,
      packagingGated: true as const
    },
    {
      id: "self-study-geometry-primitives",
      label: "几何基元和拟合模型",
      whyToLearn: "人类的粗略线条可能不直、不精确；AI 必须理解直线、折线、圆弧等几何基元的数学表达，才能从抖动数据里还原出老师的真实意图。",
      possibleMistakes: [
        "把人类的一次手抖直接当成真实曲线去拟合。",
        "只用最小二乘直线，不给轴向约束和折线候选。",
        "拟合时忽略人类的明确约束（如必须吸附到某条轴上）。"
      ],
      teacherConfirmationQuestion: `老师，在 ${domain} 里你最常用哪种几何表达？直线、折线还是曲线？有没有哪种模型不适合当前场景？`,
      passCriteria: "能针对一组三维点列同时生成直线、轴向线和折线候选，并比较残差和适用边界。",
      reviewOnly: true as const,
      accepted: false as const,
      packagingGated: true as const
    },
    {
      id: "self-study-tolerance-and-error",
      label: "容差和误差判断",
      whyToLearn: "不设容差，AI 可能把所有手抖都当成可忽略噪声，或者把合理偏差误判为错误；容差是工程语义的核心参数。",
      possibleMistakes: [
        "容差设置太宽，导致不合格点也被视为可接受。",
        "容差设置太窄，把老师的合理表达也标记为超容差。",
        "只检查距离残差，不检查方向偏移或局部变化。"
      ],
      teacherConfirmationQuestion: `老师，你希望我把容差设在什么量级？是距离容差更重要，还是方向（角度）容差更重要？`,
      passCriteria: "能对每个拟合候选算出每个点的残差距离、标记超容差点，并让老师一眼看到哪些点需要审查。",
      reviewOnly: true as const,
      accepted: false as const,
      packagingGated: true as const
    },
    {
      id: "self-study-construction-order",
      label: "构造顺序和逐步验证",
      whyToLearn: `在 ${domain} 里，生成几何体不能一次输出完；老师需要每一步都能检查锚点、方向、偏移和验证结果，才能及时纠正。`,
      possibleMistakes: [
        "一次性生成全部几何，让老师只能在最后才发现中间错了。",
        "先做复杂构造再做基础验证，颠倒检查和生成的顺序。",
        "每一步不预留老师纠正点，导致纠正成本很高。"
      ],
      teacherConfirmationQuestion: "老师，你希望我先验证再生成、先生成再验证，还是每步都交替？",
      passCriteria: "能对当前候选生成至少3步构造预测，每一步都包含为什么生成、验证检查和老师纠正点。",
      reviewOnly: true as const,
      accepted: false as const,
      packagingGated: true as const
    },
    {
      id: "self-study-old-memory-conflict",
      label: "旧知识冲突和记忆管理",
      whyToLearn: "老师可能在不同时间教过相互冲突的规则；AI 不能静默合并或忽略，必须主动展示冲突并请教。",
      possibleMistakes: [
        "把新教的规则直接覆盖旧规则，不先对比适用条件。",
        "检测到冲突但直接静默选择置信度更高的一方。",
        "旧规则过于泛化，把新场景误判为不适用。"
      ],
      teacherConfirmationQuestion: "老师，如果以后遇到新旧知识不完全一致的情况，我应该先暂停请教你，还是按适用条件更窄的那条先执行？",
      passCriteria: "能把新旧规则冲突展示出来，包括旧规则原文、新知识摘要和请教老师的问题。",
      reviewOnly: true as const,
      accepted: false as const,
      packagingGated: true as const
    }
  ];

  const domainLower = domain.toLowerCase();
  const goalLower = teacherGoal.toLowerCase();
  let topics: AISelfStudyTopic[];

  if (domainLower.includes("三维") || domainLower.includes("3d") || domainLower.includes("坐标") || domainLower.includes("空间")) {
    topics = baseTopics;
  } else if (domainLower.includes("线") || domainLower.includes("几何") || domainLower.includes("拟合")) {
    topics = [baseTopics[0], baseTopics[1], baseTopics[2], baseTopics[3]];
  } else if (domainLower.includes("规则") || domainLower.includes("记忆") || goalLower.includes("长期")) {
    topics = [baseTopics[0], baseTopics[2], baseTopics[4]];
  } else {
    topics = [baseTopics[0], baseTopics[1], baseTopics[2]];
  }

  return {
    domain,
    topics,
    generatedAt: new Date().toISOString(),
    note: "由 mock AI service 生成，不连接外部模型；未来可替换为真实 LLM 调用。每个自学主题保持 reviewOnly=true、accepted=false、packagingGated=true。"
  };
}
