#!/usr/bin/env node
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { compileInitialPrompt } from "./compile-image2-initial-prompt.mjs";

const args = process.argv.slice(2);

function value(name, fallback = "") {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}

function readJson(path, label) {
  if (!path || !existsSync(path)) fail(`${label} does not exist: ${path || "<missing>"}`);
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
  }
}

function positiveNumber(raw) {
  const number = Number(raw);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function now() {
  return new Date().toISOString();
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function mediaType(path) {
  const types = {
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf"
  };
  return types[extname(path).toLowerCase()] || "application/octet-stream";
}

function positiveValueFromText(raw) {
  const match = String(raw || "").match(/\d+(?:\.\d+)?/);
  return match ? positiveNumber(match[0]) : null;
}

const locks = Object.freeze({
  reviewOnly: true,
  accepted: false,
  technologyAccepted: false,
  ruleEnabled: false,
  packagingGated: true,
  productionReleased: false,
  teacherReviewRequired: true
});

const stages = [
  "requirements_clarification",
  "solution_planning",
  "image2_sample_generation",
  "sample_self_check",
  "teacher_mask_correction",
  "image2_local_edit",
  "cad_handoff",
  "final_teacher_review"
];

const requiredSelfChecks = [
  "dimension_completeness",
  "unit_consistency",
  "shape_and_panel_topology",
  "cut_crease_slot_conflicts",
  "closure_and_clearance",
  "manufacturing_feasibility",
  "annotation_legibility",
  "image2_pixels_not_dimension_truth"
];

function missingRequirements(requirements) {
  const missing = [];
  if (!requirements.productType?.trim()) missing.push("productType");
  for (const field of ["length", "width", "height"]) {
    if (!positiveNumber(requirements.internalDimensions?.[field])) missing.push(`internalDimensions.${field}`);
  }
  return missing;
}

function clarificationQuestions(missing) {
  const questions = [];
  if (missing.includes("productType")) questions.push("你要包装的产品是什么，准备采用哪一种包装盒型？");
  if (missing.some((field) => field.startsWith("internalDimensions."))) {
    questions.push("请提供产品或成盒内尺寸：长 × 宽 × 高，并注明单位。尺寸必须来自用户或工程数据，不能从 Image2 图片像素量取。");
  }
  questions.push("材料、厚度、产品重量、运输方式和印刷/表面工艺有什么要求？不知道的项目可以明确写“待建议”。");
  questions.push("需要交付哪些文件：样图、蒙版纠错稿、DXF、DWG、PDF、PNG 或其他格式？");
  return questions;
}

function nextAction(stage) {
  const actions = {
    requirements_clarification: "向老师询问并补齐产品类型与长宽高，不能猜测关键工程尺寸。",
    solution_planning: "形成公开、结构化的深度方案，并用 image2-prompt-optimizer 编译首次生成提示词指导包。",
    image2_sample_generation: "调用 Image2 生成一张样图并保存原始图像；此阶段禁止直接交付。",
    sample_self_check: "逐项检查尺寸标注和形状拓扑，写入自查报告；失败项也要如实保留并展示给老师。",
    teacher_mask_correction: "以自查后的样图为底图打开中文蒙版，让老师圈画和输入纠错，等待老师提交。",
    image2_local_edit: "把原图、蒙版和老师文字纠错一并交给 Image2 做局部修改，并保留前后对照。",
    cad_handoff: "生成 aicad-agent 交接包；图片只提供形状语义，工程尺寸必须来自已确认数据。",
    final_teacher_review: "展示 CAD、预览和验证证据，等待老师复核；不得自动视为技术或量产验收。"
  };
  return actions[stage];
}

function publicTrace(step, inputObserved, actionProposed, validation, teacherReviewPoint) {
  return {
    step,
    inputObserved,
    ruleCandidates: [
      "关键尺寸必须来自老师或工程数据",
      "Image2 样图不能直接交付",
      "CAD 前必须完成自查、蒙版纠错和 Image2 局部修改"
    ],
    actionProposed,
    confidence: "high",
    validation,
    teacherReviewPoint,
    memoryEffect: "none",
    locks
  };
}

function saveSession(sessionPath, session, traceRow) {
  session.updatedAt = now();
  session.nextAction = nextAction(session.stage);
  session.locks = locks;
  session.trace = [...(session.trace || []), traceRow];
  writeFileSync(sessionPath, JSON.stringify(session, null, 2), "utf8");
  console.log(JSON.stringify({
    ok: true,
    format: "transparent_ai_apprentice_packaging_design_workflow_result_v1",
    sessionPath,
    sessionId: session.id,
    stage: session.stage,
    status: session.status,
    nextAction: session.nextAction,
    missingRequirements: session.requirementsReview?.missing || [],
    clarificationQuestions: session.requirementsReview?.questions || [],
    artifacts: session.artifacts,
    locks
  }, null, 2));
}

function loadSession() {
  const sessionPath = resolve(value("session"));
  const session = readJson(sessionPath, "session");
  if (session.format !== "transparent_ai_apprentice_packaging_design_session_v1") fail("Unsupported session format");
  if (!stages.includes(session.stage)) fail(`Unknown session stage: ${session.stage}`);
  return { sessionPath, session };
}

function requireStage(session, expected) {
  if (session.stage !== expected) {
    fail(`Action requires stage ${expected}, current stage is ${session.stage}. Stage skipping is blocked.`);
  }
}

function requireArtifact(label = "artifact") {
  const artifact = resolve(value("artifact"));
  if (!existsSync(artifact)) fail(`${label} does not exist: ${artifact}`);
  return artifact;
}

function createSession() {
  const requirementsFile = value("requirements-json");
  const supplied = requirementsFile ? readJson(resolve(requirementsFile), "requirements") : {};
  const requirements = {
    request: value("request", supplied.request || ""),
    productType: value("product-type", supplied.productType || ""),
    internalDimensions: {
      length: positiveNumber(value("length", supplied.internalDimensions?.length)),
      width: positiveNumber(value("width", supplied.internalDimensions?.width)),
      height: positiveNumber(value("height", supplied.internalDimensions?.height)),
      unit: value("unit", supplied.internalDimensions?.unit || "mm")
    },
    material: value("material", supplied.material || "待建议"),
    thickness: value("thickness", supplied.thickness || "待建议"),
    productWeight: value("product-weight", supplied.productWeight || "待确认"),
    transport: value("transport", supplied.transport || "待确认"),
    closure: value("closure", supplied.closure || "待建议"),
    printAndFinish: value("print-finish", supplied.printAndFinish || "待确认"),
    outputFormats: supplied.outputFormats || ["sample_png", "correction_packet", "dxf", "dwg", "pdf", "preview_png"],
    references: supplied.references || [],
    dimensionTruthSource: "teacher_or_engineering_data_only"
  };
  const missing = missingRequirements(requirements);
  const id = `${now().replace(/[:.]/g, "-")}-packaging-design`;
  const root = resolve(value("output-dir", join(process.cwd(), ".transparent-apprentice", "packaging-design-sessions")));
  const dir = join(root, id);
  mkdirSync(dir, { recursive: true });
  const sessionPath = join(dir, "packaging-design-session.json");
  const selfCheckTemplatePath = join(dir, "sample-self-check-template.json");
  const session = {
    format: "transparent_ai_apprentice_packaging_design_session_v1",
    version: "1.0.0",
    id,
    createdAt: now(),
    updatedAt: now(),
    stage: missing.length ? "requirements_clarification" : "solution_planning",
    status: missing.length ? "waiting_for_teacher_requirements" : "ready_for_deep_plan",
    requirements,
    requirementsReview: {
      complete: missing.length === 0,
      missing,
      questions: clarificationQuestions(missing)
    },
    artifacts: {
      requirements: requirementsFile ? resolve(requirementsFile) : sessionPath,
      solutionPlan: null,
      initialPromptGuidance: null,
      initialPromptGuidanceSha256: null,
      image2Sample: null,
      selfCheck: null,
      maskCorrection: null,
      image2LocalEdit: null,
      cadHandoff: null,
      cadResult: null
    },
    stageHistory: [{ stage: missing.length ? "requirements_clarification" : "solution_planning", at: now() }],
    trace: [],
    locks
  };
  const template = {
    format: "transparent_ai_apprentice_packaging_sample_self_check_v1",
    sessionId: id,
    samplePath: "<Image2 sample image path>",
    dimensionTruthSource: "teacher_or_engineering_data_only",
    summary: "",
    checks: requiredSelfChecks.map((checkId) => ({
      id: checkId,
      status: "needs_teacher_review",
      evidence: "",
      issue: "",
      proposedRepair: ""
    })),
    overallStatus: "needs_teacher_review",
    locks
  };
  writeFileSync(selfCheckTemplatePath, JSON.stringify(template, null, 2), "utf8");
  session.artifacts.selfCheckTemplate = selfCheckTemplatePath;
  saveSession(sessionPath, session, publicTrace(
    "澄清包装需求",
    requirements.request || "老师尚未提供完整任务描述",
    missing.length ? "只提出必要澄清问题" : "进入深度方案阶段",
    missing.length ? `缺少 ${missing.join(", ")}` : "产品类型和长宽高已提供",
    "确认需求数据，尤其是产品类型和成盒内尺寸"
  ));
}

const action = value("action", "create");

if (action === "create") {
  createSession();
  process.exit(0);
}

const { sessionPath, session } = loadSession();

if (action === "update-requirements") {
  requireStage(session, "requirements_clarification");
  const patchPath = requireArtifact("requirements patch");
  const patch = readJson(patchPath, "requirements patch");
  session.requirements = {
    ...session.requirements,
    ...patch,
    internalDimensions: { ...session.requirements.internalDimensions, ...(patch.internalDimensions || {}) },
    dimensionTruthSource: "teacher_or_engineering_data_only"
  };
  const missing = missingRequirements(session.requirements);
  session.requirementsReview = { complete: missing.length === 0, missing, questions: clarificationQuestions(missing) };
  session.stage = missing.length ? "requirements_clarification" : "solution_planning";
  session.status = missing.length ? "waiting_for_teacher_requirements" : "ready_for_deep_plan";
  session.stageHistory.push({ stage: session.stage, at: now() });
  saveSession(sessionPath, session, publicTrace("更新需求", basename(patchPath), nextAction(session.stage), missing.length ? `仍缺少 ${missing.join(", ")}` : "必要需求已补齐", "复核需求摘要"));
} else if (action === "record-plan") {
  requireStage(session, "solution_planning");
  const artifact = requireArtifact("solution plan");
  session.artifacts.solutionPlan = artifact;
  const promptGuidance = compileInitialPrompt({
    task: session.requirements.request || `为${session.requirements.productType}生成第一版包装审校样图`,
    domain: "packaging",
    subject: session.requirements.productType,
    productType: session.requirements.productType,
    audience: "包装需求提出者、包装设计师与后续工程复核者",
    outputType: "一张中文包装工程审校样图，以清晰正投影视图或平面展开结构为主",
    locale: "zh-CN",
    dimensions: session.requirements.internalDimensions,
    confirmedFacts: {
      productType: session.requirements.productType,
      material: session.requirements.material,
      thickness: session.requirements.thickness,
      productWeight: session.requirements.productWeight,
      transport: session.requirements.transport,
      closure: session.requirements.closure,
      printAndFinish: session.requirements.printAndFinish,
      dimensionTruthSource: "teacher_or_engineering_data_only"
    },
    preserve: [
      "老师确认的产品类型、长宽高、单位和结构方向",
      "所有参考图中的真实产品识别特征，不擅自添加品牌"
    ],
    changes: [
      "根据深度方案形成可供尺寸、形状和封口关系自查的第一版样图",
      "为后续蒙版圈画保留清楚的结构面和标注空间"
    ],
    constraints: [
      `方案证据文件：${basename(artifact)}`,
      `要求输出格式：${(session.requirements.outputFormats || []).join(", ")}`
    ],
    referenceImages: session.requirements.references || []
  });
  if (!promptGuidance.readyForGeneration) {
    fail(`Initial Image2 prompt guidance is blocked: ${promptGuidance.blockingUnknowns.join(", ")}`);
  }
  const promptGuidancePath = join(dirname(sessionPath), "image2-initial-prompt-guidance.json");
  writeFileSync(promptGuidancePath, JSON.stringify(promptGuidance, null, 2), "utf8");
  session.artifacts.initialPromptGuidance = promptGuidancePath;
  session.artifacts.initialPromptGuidanceSha256 = sha256File(promptGuidancePath);
  session.stage = "image2_sample_generation";
  session.status = "ready_for_image2_sample";
  session.stageHistory.push({ stage: session.stage, at: now() });
  saveSession(sessionPath, session, publicTrace(
    "记录深度方案并编译首次生成提示词",
    basename(artifact),
    "使用已验证的提示词指导包调用 Image2 生成样图",
    `方案文件存在；提示词路由=${promptGuidance.route.domain}；检查项=${promptGuidance.validationChecklist.length}`,
    "样图生成后不要直接交付"
  ));
} else if (action === "record-sample") {
  requireStage(session, "image2_sample_generation");
  if (!session.artifacts.initialPromptGuidance || !existsSync(session.artifacts.initialPromptGuidance)) {
    fail("A compiled Image2 initial prompt guidance packet is required before recording the first sample");
  }
  if (!session.artifacts.initialPromptGuidanceSha256 || sha256File(session.artifacts.initialPromptGuidance) !== session.artifacts.initialPromptGuidanceSha256) {
    fail("Image2 initial prompt guidance hash mismatch");
  }
  const promptGuidance = readJson(session.artifacts.initialPromptGuidance, "Image2 initial prompt guidance");
  if (promptGuidance.format !== "transparent_ai_apprentice_image2_initial_prompt_guidance_v1") fail("Unsupported Image2 initial prompt guidance format");
  if (promptGuidance.route?.domain !== "packaging" || promptGuidance.provenance?.skill !== "image2-prompt-optimizer" || promptGuidance.provenance?.sourceThreadId !== "019f09a9-90ab-76b2-aa1f-b7c9bddf93e8") {
    fail("Image2 initial prompt guidance provenance or packaging route is invalid");
  }
  if (promptGuidance.readyForGeneration !== true || (promptGuidance.blockingUnknowns || []).length > 0) {
    fail("Image2 initial prompt guidance still has blocking unknowns");
  }
  if ((promptGuidance.validationChecklist || []).some((check) => check.status === "blocked")) {
    fail("Image2 initial prompt guidance has a blocked validation check");
  }
  for (const [key, expected] of Object.entries({ reviewOnly: true, accepted: false, technologyAccepted: false, ruleEnabled: false, packagingGated: true, productionReleased: false })) {
    if (promptGuidance.locks?.[key] !== expected) fail(`Unsafe Image2 prompt guidance lock: ${key}`);
  }
  const artifact = requireArtifact("Image2 sample");
  session.artifacts.image2Sample = artifact;
  session.stage = "sample_self_check";
  session.status = "sample_generated_not_deliverable";
  session.stageHistory.push({ stage: session.stage, at: now() });
  saveSession(sessionPath, session, publicTrace("记录 Image2 样图", basename(artifact), "执行尺寸与形状自查", "样图存在；交付门仍锁定", "查看自查问题后再进入蒙版"));
} else if (action === "record-self-check") {
  requireStage(session, "sample_self_check");
  const artifact = requireArtifact("self-check report");
  const report = readJson(artifact, "self-check report");
  if (report.format !== "transparent_ai_apprentice_packaging_sample_self_check_v1") fail("Unsupported self-check report format");
  if (report.dimensionTruthSource !== "teacher_or_engineering_data_only") fail("Image2 pixels cannot be used as dimension truth");
  const ids = new Set((report.checks || []).map((check) => check.id));
  const missingChecks = requiredSelfChecks.filter((id) => !ids.has(id));
  if (missingChecks.length) fail(`Self-check report is incomplete: ${missingChecks.join(", ")}`);
  session.artifacts.selfCheck = artifact;
  session.stage = "teacher_mask_correction";
  session.status = "waiting_for_teacher_mask_correction";
  session.stageHistory.push({ stage: session.stage, at: now() });
  const issueCount = report.checks.filter((check) => check.status !== "pass").length;
  saveSession(sessionPath, session, publicTrace("完成样图自查", basename(artifact), "打开蒙版并展示自查结果", `${requiredSelfChecks.length} 项已检查，${issueCount} 项需继续复核`, "老师在样图上圈画并提交纠错"));
} else if (action === "record-correction") {
  requireStage(session, "teacher_mask_correction");
  const artifact = requireArtifact("mask correction packet");
  const packet = readJson(artifact, "mask correction packet");
  if (packet.format !== "transparent_ai_sketch_overlay_packet_v1") fail("Correction must use transparent_ai_sketch_overlay_packet_v1");
  const markCount = (packet.strokes?.length || 0) + (packet.anchors?.length || 0);
  if (markCount === 0 && !packet.teacherCorrectionText?.trim()) fail("Correction packet has no marks or teacher text");
  session.artifacts.maskCorrection = artifact;
  session.stage = "image2_local_edit";
  session.status = "ready_for_image2_local_edit";
  session.stageHistory.push({ stage: session.stage, at: now() });
  saveSession(sessionPath, session, publicTrace("接收老师蒙版纠错", basename(artifact), "用 Image2 对原图做局部修改", `收到 ${markCount} 个图形标注`, "核对局部修改是否忠实执行纠错"));
} else if (action === "record-local-edit") {
  requireStage(session, "image2_local_edit");
  const artifact = requireArtifact("Image2 local edit");
  session.artifacts.image2LocalEdit = artifact;
  session.stage = "cad_handoff";
  session.status = "ready_for_cad_handoff";
  session.stageHistory.push({ stage: session.stage, at: now() });
  saveSession(sessionPath, session, publicTrace("记录 Image2 局部修改", basename(artifact), "准备 CAD 约束绘图交接", "局部修改图存在，原图和纠错证据均已保留", "CAD 只能采用确认尺寸，图片仅作形状语义参考"));
} else if (action === "prepare-cad-handoff") {
  requireStage(session, "cad_handoff");
  if (!session.requirements.material || /待|unknown|pending/i.test(session.requirements.material)) {
    fail("A teacher-confirmed material is required before CAD handoff");
  }
  const thickness = positiveValueFromText(session.requirements.thickness);
  if (!thickness) fail("A positive teacher-confirmed material thickness is required before CAD handoff");
  const unitFactors = { mm: 1, cm: 10, m: 1000, in: 25.4, inch: 25.4, inches: 25.4 };
  const sourceUnit = String(session.requirements.internalDimensions.unit || "mm").toLowerCase();
  const unitFactor = unitFactors[sourceUnit];
  if (!unitFactor) fail(`Unsupported dimension unit for CAD handoff: ${sourceUnit}`);

  const output = resolve(value("output", join(dirname(sessionPath), "ai-apprentice-aicad-request.json")));
  const outputDir = dirname(output);
  const inputsDir = join(outputDir, "aicad-handoff-inputs");
  mkdirSync(inputsDir, { recursive: true });
  function evidenceRef(id, source, visual = false) {
    if (!source || !existsSync(source)) fail(`Missing CAD handoff evidence: ${id}`);
    const extension = extname(source).toLowerCase() || ".bin";
    const destination = join(inputsDir, `${id}${extension}`);
    copyFileSync(source, destination);
    const reference = {
      id,
      relativePath: relative(outputDir, destination).replaceAll("\\", "/"),
      sha256: sha256File(destination),
      mediaType: mediaType(destination)
    };
    return visual ? { ...reference, role: "visual_topology_only", pixelMeasurementsAllowed: false } : reference;
  }
  const solutionPlan = evidenceRef("solution-plan", session.artifacts.solutionPlan);
  const image2Sample = evidenceRef("image2-sample", session.artifacts.image2Sample, true);
  const selfCheck = evidenceRef("sample-self-check", session.artifacts.selfCheck);
  const maskCorrection = evidenceRef("teacher-mask-correction", session.artifacts.maskCorrection);
  const localEdit = evidenceRef("image2-local-edit", session.artifacts.image2LocalEdit);
  const requestedArtifacts = new Set(["plan", "aicad", "scr", "dxf", "audit", "validation", "manifest"]);
  const requestedMap = {
    sample_png: "png",
    preview_png: "png",
    dxf: "dxf",
    dwg: "dwg",
    pdf: "pdf",
    png: "png",
    plan: "plan",
    aicad: "aicad",
    scr: "scr",
    audit: "audit",
    validation: "validation",
    manifest: "manifest",
    sldprt: "sldprt",
    step: "step"
  };
  for (const item of session.requirements.outputFormats || []) {
    if (requestedMap[item]) requestedArtifacts.add(requestedMap[item]);
  }
  const handoff = {
    format: "transparent_ai_apprentice_aicad_request_v1",
    handoffId: session.id,
    mode: "packaging_dieline",
    project: {
      name: session.requirements.request || session.requirements.productType,
      productType: session.requirements.productType,
      structureFamily: session.requirements.closure || "teacher_selected_packaging_structure",
      requestedUnits: "mm"
    },
    product: {
      name: session.requirements.productType,
      shape: "teacher_defined_product_envelope",
      ...(positiveValueFromText(session.requirements.productWeight)
        ? { weightKg: positiveValueFromText(session.requirements.productWeight) }
        : {}),
      dimensions: [{
        id: "confirmed-product-envelope",
        semantic: "product_or_internal_envelope",
        axes: ["length", "width", "height"],
        values: [
          session.requirements.internalDimensions.length * unitFactor,
          session.requirements.internalDimensions.width * unitFactor,
          session.requirements.internalDimensions.height * unitFactor
        ],
        unit: "mm",
        authority: "teacher_explicit",
        sourceRef: "packaging-design-session",
        sourcePointer: "/requirements/internalDimensions",
        immutable: true
      }]
    },
    materials: [{
      id: "primary-packaging-material",
      category: /corrugated|\u74e6\u695e/i.test(session.requirements.material) ? "corrugated_board" : "paperboard_or_teacher_specified",
      name: session.requirements.material,
      authority: "teacher_explicit",
      thickness: { value: thickness, unit: "mm" }
    }],
    engineeringTruth: {
      origin: [0, 0],
      sourcePrecedence: ["teacher_explicit", "approved_engineering", "trusted_catalog", "calculated", "visual_semantics_only"],
      conflictPolicy: "fail_closed_and_report",
      imagePixelsUsedAsDimensions: false,
      parameters: [{ name: "printAndFinish", value: session.requirements.printAndFinish }, { name: "transport", value: session.requirements.transport }]
    },
    evidence: {
      solutionPlan,
      image2Sample,
      selfChecks: [selfCheck],
      teacherCorrectionPackets: [maskCorrection],
      localModificationResults: [localEdit]
    },
    localModifications: [],
    requestedArtifacts: [...requestedArtifacts],
    hostPolicy: { defaultHost: "none", allowOptionalHosts: ["autocad", "solidworks"] },
    safety: {
      reviewOnly: true,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      productionApprovalClaimed: false
    }
  };
  writeFileSync(output, JSON.stringify(handoff, null, 2), "utf8");
  session.artifacts.cadHandoff = output;
  session.status = "cad_handoff_prepared_waiting_for_aicad_result";
  saveSession(sessionPath, session, publicTrace("准备 CAD 交接包", basename(output), "交给 aicad-agent 生成受约束工程图", "严格请求包含相对证据路径、SHA-256、材料厚度、尺寸权威和图片用途限制", "CAD 结果仍需老师最终复核"));
} else if (action === "record-cad-result") {
  requireStage(session, "cad_handoff");
  if (!session.artifacts.cadHandoff) fail("Prepare CAD handoff before recording a CAD result");
  const artifact = requireArtifact("CAD result manifest");
  const result = readJson(artifact, "CAD result manifest");
  if (result.format !== "transparent_ai_apprentice_aicad_result_v1") fail("Unsupported CAD result format");
  if (result.handoffId !== session.id) fail("CAD result handoffId does not match the packaging session");
  if (result.requestSha256 !== sha256File(session.artifacts.cadHandoff)) fail("CAD result requestSha256 does not match the reviewed AICAD request");
  if (result.provenance?.producer !== "aicad-agent" || result.provenance?.version !== "1.2.0") fail("CAD result provenance is not aicad-agent 1.2.0");
  if (result.provenance?.imagePixelsUsedAsDimensions !== false) fail("CAD result used image pixels as dimensional truth");
  const requiredLocks = { reviewOnly: true, accepted: false, ruleEnabled: false, packagingGated: true, productionApprovalClaimed: false };
  for (const [key, expected] of Object.entries(requiredLocks)) {
    if (result.safety?.[key] !== expected) fail(`Unsafe CAD result lock: ${key}`);
  }
  const artifactRoot = dirname(artifact);
  for (const item of result.artifacts || []) {
    if (!item.relativePath || /^[A-Za-z]:|^\/|\.\./.test(item.relativePath)) fail(`Unsafe CAD artifact path: ${item.relativePath}`);
    const candidate = resolve(artifactRoot, item.relativePath);
    if (!(candidate === artifactRoot || candidate.startsWith(`${artifactRoot}${sep}`))) fail(`CAD artifact escapes result directory: ${item.relativePath}`);
    if (["generated", "validated"].includes(item.status)) {
      if (!existsSync(candidate)) fail(`Generated CAD artifact does not exist: ${item.relativePath}`);
      if (item.sha256 && item.sha256 !== sha256File(candidate)) fail(`CAD artifact hash mismatch: ${item.relativePath}`);
    }
  }
  for (const error of result.errors || []) {
    if (!error.rootCause?.trim() || !error.remediation?.trim()) fail(`CAD error ${error.id || "<unknown>"} lacks root-cause learning`);
  }
  for (const rule of result.preventionRuleDrafts || []) {
    if (rule.lifecycle !== "draft_disabled") fail(`CAD prevention rule ${rule.id || "<unknown>"} is not draft_disabled`);
    for (const [key, expected] of Object.entries(requiredLocks)) {
      if (rule.safety?.[key] !== expected) fail(`Unsafe prevention rule lock ${key}: ${rule.id || "<unknown>"}`);
    }
  }
  session.artifacts.cadResult = artifact;
  session.stage = "final_teacher_review";
  session.status = "waiting_for_final_teacher_review";
  session.stageHistory.push({ stage: session.stage, at: now() });
  saveSession(sessionPath, session, publicTrace("记录 CAD 结果", basename(artifact), "展示 CAD、预览与验证证据", `请求绑定、来源、证据路径、哈希和安全锁已验证；结果状态=${result.status}`, "老师决定继续纠错、阻塞或安排后续复核"));
} else {
  fail(`Unsupported action: ${action}`);
}
