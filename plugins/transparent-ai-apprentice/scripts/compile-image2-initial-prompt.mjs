#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DOMAINS = new Set([
  "packaging",
  "cad_technical",
  "product_visual",
  "ecommerce",
  "ui_web",
  "architecture_interior",
  "industrial_design",
  "general_image"
]);

export const IMAGE2_PROMPT_LOCKS = Object.freeze({
  reviewOnly: true,
  accepted: false,
  technologyAccepted: false,
  ruleEnabled: false,
  packagingGated: true,
  productionReleased: false,
  teacherReviewRequired: true
});

function text(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function list(value) {
  if (Array.isArray(value)) return value.map((item) => text(String(item))).filter(Boolean);
  return text(value) ? [text(value)] : [];
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function inferDomain(input) {
  const requested = text(input.domain, "auto").toLowerCase();
  if (DOMAINS.has(requested)) return requested;
  const haystack = [input.task, input.subject, input.outputType, input.productType]
    .map((item) => text(item).toLowerCase())
    .join(" ");
  if (/包装|纸盒|彩盒|礼盒|刀模|dieline|packag|carton|box/.test(haystack)) return "packaging";
  if (/cad|工程图|技术图|technical drawing|exploded view|爆炸图/.test(haystack)) return "cad_technical";
  if (/电商|详情页|ecommerce|marketplace|listing/.test(haystack)) return "ecommerce";
  if (/界面|网页|网站|dashboard|app|ui|ux|saas/.test(haystack)) return "ui_web";
  if (/建筑|室内|空间|平面图|architecture|interior|floor plan/.test(haystack)) return "architecture_interior";
  if (/工业设计|概念产品|cmf|industrial design|hardware concept/.test(haystack)) return "industrial_design";
  if (/产品图|商业摄影|product visual|product photo|hero image/.test(haystack)) return "product_visual";
  return "general_image";
}

function dimensionsFrom(input) {
  const candidate = input.dimensions || input.confirmedFacts?.internalDimensions || {};
  const values = [candidate.length, candidate.width, candidate.height].map(Number);
  if (!values.every((value) => Number.isFinite(value) && value > 0)) return null;
  return { length: values[0], width: values[1], height: values[2], unit: text(candidate.unit, "mm") };
}

function factLines(input, dimensions) {
  const facts = input.confirmedFacts && typeof input.confirmedFacts === "object" ? input.confirmedFacts : {};
  const lines = [];
  const productType = text(input.productType || facts.productType || input.subject);
  if (productType) lines.push(`产品/主体类型：${productType}`);
  if (dimensions) lines.push(`确认尺寸：${dimensions.length} × ${dimensions.width} × ${dimensions.height} ${dimensions.unit}`);
  for (const [key, value] of Object.entries(facts)) {
    if (["productType", "internalDimensions"].includes(key) || value == null || value === "") continue;
    const rendered = typeof value === "object" ? JSON.stringify(value) : String(value);
    lines.push(`${key}：${rendered}`);
  }
  return unique(lines);
}

const domainDefaults = {
  packaging: {
    output: "一张中文包装工程审校样图，以清晰正投影视图或平面展开结构为主，可附一个小型立体结构参考",
    composition: "画布优先、白色或浅灰工程底色、结构居中、标注避让、信息层级清楚",
    viewpoint: "无夸张透视的正投影或平面展开视图",
    exclusions: ["不要只生成装饰性包装摄影或孤立 mockup", "不要生成无法闭合、无法折叠或悬浮的结构"]
  },
  cad_technical: {
    output: "一张平面正投影或爆炸技术审校图",
    composition: "白底、清晰线型、对象编号、尺寸与说明分区",
    viewpoint: "正投影、轴测或明确爆炸轴，不使用戏剧化透视",
    exclusions: ["不要把视觉样图声称为原生 CAD", "不要添加未经确认的尺寸"]
  },
  product_visual: {
    output: "一张商业级产品视觉候选图",
    composition: "主体清楚、材质可辨、背景克制、为文案留出可用空间",
    viewpoint: "能够准确展示产品形态的三分之二角度或用户指定角度",
    exclusions: ["不要改变产品核心结构", "不要生成随机品牌或错误文字"]
  },
  ecommerce: {
    output: "一张适合电商主图或详情页首屏的产品候选图",
    composition: "主体占比明确、卖点区域有秩序、移动端缩略图仍可辨认",
    viewpoint: "正面或三分之二角度，避免过度广角",
    exclusions: ["不要伪造认证、销量或平台徽章", "不要生成随机价格和促销信息"]
  },
  ui_web: {
    output: "一张可实施的产品界面视觉候选图",
    composition: "信息密度符合场景，稳定网格，清晰导航、状态和操作层级",
    viewpoint: "正视界面，不使用透视设备 mockup 代替真实界面",
    exclusions: ["不要用营销插画替代实际产品界面", "不要生成不可读小字或重叠控件"]
  },
  architecture_interior: {
    output: "一张保持空间几何关系的建筑或室内设计候选图",
    composition: "比例可信、动线清楚、材料和光照关系可辨",
    viewpoint: "用户指定平面、立面、轴测或真实相机视角",
    exclusions: ["不要擅自改变承重或主要空间结构", "不要混淆平面图与透视效果图"]
  },
  industrial_design: {
    output: "一张工业设计概念审校图，突出结构、CMF 和使用关系",
    composition: "主体完整、关键接口可见、材料分区清楚",
    viewpoint: "三分之二角度并保持真实尺度感",
    exclusions: ["不要生成无法制造的悬浮部件", "不要忽略接口、装配和握持关系"]
  },
  general_image: {
    output: "一张符合任务目标的高质量视觉候选图",
    composition: "主体明确、层级清楚、画面完整",
    viewpoint: "最能表达任务目标的稳定视角",
    exclusions: ["不要增加无关主体", "不要生成随机文字、标志或水印"]
  }
};

function bullets(items, empty = "- 无") {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : empty;
}

export function compileInitialPrompt(input = {}, options = {}) {
  const task = text(input.task || input.request);
  if (!task) throw new Error("A non-empty task is required");
  const domain = inferDomain(input);
  const defaults = domainDefaults[domain];
  const dimensions = dimensionsFrom(input);
  const productType = text(input.productType || input.confirmedFacts?.productType || input.subject);
  const blockingUnknowns = [];
  if (domain === "packaging" && !productType) blockingUnknowns.push("需要确认产品类型和包装/盒型");
  if (domain === "packaging" && !dimensions) blockingUnknowns.push("需要确认长 × 宽 × 高及单位");

  const confirmed = factLines(input, dimensions);
  const preserve = unique([
    ...list(input.preserve),
    ...(domain === "packaging" ? ["所有已确认工程尺寸和产品类型", "结构面板、开合方向与主要比例关系"] : [])
  ]);
  const changes = unique(list(input.changes).length ? list(input.changes) : [task]);
  const constraints = unique([
    ...list(input.constraints),
    `输出语言：${text(input.locale, "zh-CN") === "zh-CN" ? "简体中文" : text(input.locale)}`,
    "所有文字清晰可读；无法可靠生成的长文本使用明确占位区",
    ...(domain === "packaging" || domain === "cad_technical"
      ? ["尺寸文字只能复制已确认数据，禁止从图片像素量取或推断", "当前结果仅用于审校，不代表技术验收或生产批准"]
      : [])
  ]);
  const exclusions = unique([
    ...defaults.exclusions,
    ...list(input.exclusions),
    "不要乱码、随机 logo、水印、假认证章、假验收章或未经要求的品牌名",
    "不要比例畸变、重复部件、断裂边缘、不合理阴影或模糊关键结构"
  ]);

  const outputType = text(input.outputType, defaults.output);
  const prompt = [
    "请根据以下已确认信息生成第一版 Image2 审校样图。不要把它当作最终交付。",
    "",
    "【任务目标】",
    task,
    `交付类型：${outputType}`,
    `目标受众：${text(input.audience, "任务提出者与后续人工审校者")}`,
    "",
    "【已确认事实】",
    bullets(confirmed, "- 除任务描述外暂无额外确认事实，不得自行补造关键参数"),
    "",
    "【必须保留】",
    bullets(preserve),
    "",
    "【需要生成或调整】",
    bullets(changes),
    "",
    "【画面与表达】",
    `- 构图：${text(input.composition, defaults.composition)}`,
    `- 视角：${text(input.viewpoint, defaults.viewpoint)}`,
    `- 光线：${text(input.lighting, "均匀、克制，确保结构和材质清楚")}`,
    `- 材料与质感：${text(input.materials, "忠实呈现已确认材料；未确认时保持中性，不虚构工艺")}`,
    `- 文字与排版：${text(input.typography, "中文优先，层级明确，标注与结构线互不遮挡")}`,
    "",
    "【约束】",
    bullets(constraints),
    "",
    "【禁止事项】",
    bullets(exclusions),
    "",
    "【输出要求】",
    "- 输出一张结构完整、边缘清晰、可供下一步尺寸与形状自查的样图。",
    "- 保留足够空白供老师使用蒙版圈画和文字纠错。",
    "- 不得在画面中声称已通过工程、技术、制造或量产验收。"
  ].join("\n");

  const libraryRoot = resolve(options.libraryRoot || process.env.IMAGE2_PROMPT_LIBRARY || "D:\\image2专业提示词库");
  const libraryAvailable = existsSync(libraryRoot);
  const readyForGeneration = blockingUnknowns.length === 0;
  const validationChecklist = [
    { id: "task_defined", status: task ? "pass" : "blocked", evidence: task },
    { id: "domain_routed", status: "pass", evidence: domain },
    { id: "confirmed_facts_separated", status: confirmed.length ? "pass" : "needs_review", evidence: `${confirmed.length} confirmed fact lines` },
    { id: "preservation_rules_present", status: preserve.length ? "pass" : "needs_review", evidence: `${preserve.length} preservation rules` },
    { id: "exclusions_present", status: exclusions.length ? "pass" : "blocked", evidence: `${exclusions.length} exclusions` },
    { id: "language_policy_present", status: "pass", evidence: text(input.locale, "zh-CN") },
    { id: "dimension_authority", status: domain === "packaging" && !dimensions ? "blocked" : "pass", evidence: dimensions ? `${dimensions.length} x ${dimensions.width} x ${dimensions.height} ${dimensions.unit}` : "not required or not yet confirmed" },
    { id: "review_boundary_present", status: "pass", evidence: "first sample remains review-only" }
  ];

  return {
    format: "transparent_ai_apprentice_image2_initial_prompt_guidance_v1",
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    mode: "initial_generation_guidance",
    route: { domain, existingCapabilityFirst: true, generator: "image2" },
    request: {
      task,
      subject: text(input.subject || productType) || null,
      outputType,
      locale: text(input.locale, "zh-CN"),
      dimensions,
      referenceImages: list(input.referenceImages)
    },
    prompt,
    negativePrompt: exclusions.join("；"),
    blockingUnknowns,
    readyForGeneration,
    validationChecklist,
    library: {
      optional: true,
      available: libraryAvailable,
      mode: libraryAvailable ? "local_library_available" : "bundled_fallback",
      root: libraryAvailable ? libraryRoot : null,
      suggestedQuery: `${domain} ${productType || text(input.subject, "professional image")}`
    },
    provenance: {
      skill: "image2-prompt-optimizer",
      sourceThreadId: "019f09a9-90ab-76b2-aa1f-b7c9bddf93e8",
      compiler: "compile-image2-initial-prompt.mjs"
    },
    locks: IMAGE2_PROMPT_LOCKS
  };
}

function value(args, name, fallback = "") {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function runCli() {
  const args = process.argv.slice(2);
  const inputPath = value(args, "input");
  const input = inputPath
    ? JSON.parse(readFileSync(resolve(inputPath), "utf8").replace(/^\uFEFF/, ""))
    : {
        task: value(args, "task"),
        domain: value(args, "domain", "auto"),
        subject: value(args, "subject"),
        productType: value(args, "product-type"),
        outputType: value(args, "output-type"),
        locale: value(args, "locale", "zh-CN"),
        dimensions: {
          length: value(args, "length"),
          width: value(args, "width"),
          height: value(args, "height"),
          unit: value(args, "unit", "mm")
        }
      };
  const packet = compileInitialPrompt(input, { libraryRoot: value(args, "library-root") || undefined });
  const outputPath = value(args, "output");
  if (outputPath) {
    const absolute = resolve(outputPath);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, JSON.stringify(packet, null, 2), "utf8");
  }
  console.log(JSON.stringify({ ok: true, outputPath: outputPath ? resolve(outputPath) : null, ...packet }, null, 2));
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    runCli();
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exit(1);
  }
}
