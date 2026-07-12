(() => {
  "use strict";

  const config = globalThis.__MINGTU_OVERLAY_CONFIG__ || {};
  const locks = {
    ruleEnabled: false,
    accepted: false,
    technologyAccepted: false,
    packagingGated: true,
    nativeExecutionImplemented: false,
    teacherReviewRequired: true,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    memoryWritten: false
  };
  const toolNames = {
    brush: "自由画笔",
    ellipse: "圈选",
    rect: "框选",
    arrow: "箭头",
    text: "文字"
  };
  const contentTypeNames = {
    text: "文字内容修改",
    image: "图片局部修改",
    engineering: "工程对象修改"
  };
  const contentTypeIcons = {
    text: "#i-document",
    image: "#i-image",
    engineering: "#i-cad"
  };
  const contentFieldIds = [
    "maskRole", "editScopePolicy", "globalPreserveNote",
    "textDocumentType", "textLocator", "textOperation", "sourceText", "replacementText", "typographyNote",
    "imageOperation", "imageInstruction", "imagePreserve",
    "engineeringObjectType", "engineeringObjectId", "engineeringAction",
    "engineeringValue", "engineeringUnit", "engineeringConstraint"
  ];
  const byId = (id) => document.getElementById(id);
  const all = (selector) => Array.from(document.querySelectorAll(selector));
  const canvas = byId("maskCanvas");
  const scene = byId("scene");
  const viewport = byId("canvasViewport");
  const baseImage = byId("baseImage");
  const ctx = canvas.getContext("2d");
  const storageKey = `mingtu-overlay-draft:${config.kitId || "local"}`;
  const state = {
    tool: "brush",
    annotations: [],
    redoStack: [],
    current: null,
    zoom: 1,
    overlayVisible: true,
    readonly: false,
    empty: !config.initialBackdropDataUrl,
    playbackIndex: 0,
    contentType: ["text", "image", "engineering"].includes(config.contentType) ? config.contentType : "image",
    backdropName: config.initialBackdropName || "",
    backdropDataUrl: config.initialBackdropDataUrl || "",
    backdropKind: config.initialBackdropDataUrl ? "image" : "none",
    sourceTextDocument: "",
    dirty: false,
    submittedAt: null
  };

  function id(prefix = "mark") {
    if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function elementValue(name, fallback = "") {
    const element = byId(name);
    return element ? element.value : fallback;
  }

  function setElementValue(name, value) {
    const element = byId(name);
    if (element && value !== undefined && value !== null) element.value = String(value);
  }

  function captureEditIntent(contentType = state.contentType) {
    if (contentType === "text") {
      const operation = elementValue("textOperation", "replace");
      return {
        kind: "text_edit",
        documentType: elementValue("textDocumentType", "word_docx"),
        locator: elementValue("textLocator", "").trim(),
        operation,
        sourceText: elementValue("sourceText", "").trim(),
        replacementText: elementValue("replacementText", "").trim(),
        typographyNote: elementValue("typographyNote", "").trim(),
        sourceTextConfirmedByTeacher: Boolean(elementValue("sourceText", "").trim()),
        requiresExactTextMatch: operation !== "format"
      };
    }
    if (contentType === "engineering") {
      return {
        kind: "engineering_edit",
        objectType: elementValue("engineeringObjectType", "dimension"),
        objectId: elementValue("engineeringObjectId", "").trim(),
        action: elementValue("engineeringAction", "change_dimension"),
        expectedValue: elementValue("engineeringValue", "").trim(),
        unit: elementValue("engineeringUnit", "mm"),
        constraintNote: elementValue("engineeringConstraint", "").trim(),
        objectIdentityConfirmedByTeacher: Boolean(elementValue("engineeringObjectId", "").trim()),
        dimensionsMayNotBeInferredFromPixels: true
      };
    }
    return {
      kind: "image_edit",
      operation: elementValue("imageOperation", "replace_region"),
      instruction: elementValue("imageInstruction", "").trim(),
      preserveInstruction: elementValue("imagePreserve", "").trim(),
      preserveUnmarkedRegions: true
    };
  }

  function fieldValues() {
    return Object.fromEntries(contentFieldIds.map((fieldId) => [fieldId, elementValue(fieldId, "")]));
  }

  function applyFieldValues(values = {}) {
    for (const fieldId of contentFieldIds) {
      if (Object.prototype.hasOwnProperty.call(values, fieldId)) setElementValue(fieldId, values[fieldId]);
    }
    if (values.correctionNote !== undefined) setElementValue("correctionNote", values.correctionNote);
    if (values.issueType !== undefined) setElementValue("issueType", values.issueType);
    if (values.workflowStep !== undefined) setElementValue("workflowStep", values.workflowStep);
    if (values.spatialMode !== undefined) setElementValue("spatialMode", values.spatialMode);
    if (values.depthHint !== undefined) setElementValue("depthHint", values.depthHint);
  }

  function normalizedPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || canvas.width || 1);
    const height = Math.max(1, rect.height || canvas.height || 1);
    return {
      x: Math.max(0, Math.min(1, (event.clientX - (rect.left || 0)) / width)),
      y: Math.max(0, Math.min(1, (event.clientY - (rect.top || 0)) / height)),
      t: Date.now(),
      pressure: Number(event.pressure || 0.5),
      zHint: Number(elementValue("depthHint", "0")),
      planeId: elementValue("spatialMode", "screen_2d")
    };
  }

  function annotationLabel(tool = state.tool) {
    const text = elementValue("textInput", "").trim();
    const intent = captureEditIntent();
    if (state.contentType === "text" && intent.sourceText) {
      const replacement = intent.operation === "delete" ? "删除" : intent.replacementText || "调整格式";
      return `文字：${intent.sourceText.slice(0, 14)} → ${replacement.slice(0, 14)}`;
    }
    if (state.contentType === "engineering" && intent.objectId) {
      const value = intent.expectedValue ? ` ${intent.expectedValue}${intent.unit === "none" ? "" : ` ${intent.unit}`}` : "";
      return `${intent.objectId} · ${intent.action}${value}`;
    }
    if (state.contentType === "image" && intent.instruction) return intent.instruction.slice(0, 32);
    return text || toolNames[tool] || "老师标注";
  }

  function newAnnotation(tool, point) {
    return {
      id: id(tool),
      tool,
      role: elementValue("maskRole", "change"),
      contentType: state.contentType,
      editIntent: captureEditIntent(),
      mode: elementValue("spatialMode", "screen_2d"),
      semanticLabel: annotationLabel(tool),
      color: elementValue("strokeColor", "#d4463a"),
      width: Number(elementValue("strokeWidth", "6")),
      depthHint: Number(elementValue("depthHint", "0")),
      createdAt: new Date().toISOString(),
      points: [point]
    };
  }

  function canvasPoint(point) {
    return { x: point.x * canvas.width, y: point.y * canvas.height };
  }

  function drawArrow(from, to, annotation) {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const head = Math.max(12, annotation.width * 3.4) * (canvas.width / 1344);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.lineTo(to.x - head * Math.cos(angle - Math.PI / 6), to.y - head * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - head * Math.cos(angle + Math.PI / 6), to.y - head * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }

  function drawAnnotation(annotation, active = false) {
    const points = annotation.points || [];
    if (!points.length) return;
    const first = canvasPoint(points[0]);
    const last = canvasPoint(points.at(-1));
    ctx.save();
    const roleColor = annotation.role === "protect" ? "#26734a" : annotation.role === "reference" ? "#1769a6" : annotation.color || "#d4463a";
    ctx.strokeStyle = roleColor;
    ctx.fillStyle = roleColor;
    ctx.lineWidth = Math.max(1, Number(annotation.width || 6) * (canvas.width / 1344));
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (active || annotation.role === "protect") ctx.setLineDash(annotation.role === "protect" ? [8, 6] : [10, 7]);

    if (annotation.tool === "brush") {
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      for (const point of points.slice(1)) {
        const p = canvasPoint(point);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    } else if (annotation.tool === "ellipse") {
      ctx.beginPath();
      ctx.ellipse((first.x + last.x) / 2, (first.y + last.y) / 2, Math.abs(last.x - first.x) / 2, Math.abs(last.y - first.y) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (annotation.tool === "rect") {
      ctx.strokeRect(Math.min(first.x, last.x), Math.min(first.y, last.y), Math.abs(last.x - first.x), Math.abs(last.y - first.y));
    } else if (annotation.tool === "arrow") {
      drawArrow(first, last, annotation);
    } else if (annotation.tool === "text") {
      const scale = canvas.width / 1344;
      const fontSize = Math.max(14, 18 * scale);
      const text = annotation.semanticLabel || "老师说明";
      ctx.font = `700 ${fontSize}px "Microsoft YaHei UI", sans-serif`;
      const metrics = ctx.measureText(text);
      ctx.globalAlpha = 0.92;
      ctx.fillRect(first.x - 5 * scale, first.y - fontSize, metrics.width + 10 * scale, fontSize + 8 * scale);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(text, first.x, first.y + 2 * scale);
    }
    ctx.restore();
  }

  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!state.overlayVisible) return;
    const visible = state.readonly && state.annotations.length
      ? [state.annotations[Math.min(state.playbackIndex, state.annotations.length - 1)]]
      : state.annotations;
    for (const annotation of visible) drawAnnotation(annotation, state.readonly);
    if (state.current) drawAnnotation(state.current, true);
  }

  function resizeCanvas(width = 1344, height = 756) {
    const maxDimension = 2048;
    const ratio = Math.min(1, maxDimension / Math.max(width, height));
    canvas.width = Math.max(320, Math.round(width * ratio));
    canvas.height = Math.max(180, Math.round(height * ratio));
    scene.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
    redraw();
  }

  function markDirty() {
    state.dirty = true;
    const indicator = byId("dirtyState");
    indicator?.classList.add("unsaved");
    if (indicator) indicator.lastChild.textContent = " 草稿待保存";
    saveDraft();
    globalThis.setTimeout?.(() => {
      state.dirty = false;
      indicator?.classList.remove("unsaved");
      if (indicator) indicator.lastChild.textContent = " 草稿已保存";
    }, 260);
  }

  function saveDraft() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        format: "mingtu_overlay_draft_v1",
        savedAt: new Date().toISOString(),
        annotations: state.annotations,
        contentType: state.contentType,
        contentFields: fieldValues(),
        backdropName: state.backdropName,
        backdropDataUrl: state.backdropDataUrl,
        backdropKind: state.backdropKind,
        sourceTextDocument: state.sourceTextDocument,
        correctionNote: elementValue("correctionNote", ""),
        issueType: elementValue("issueType", "结构错误"),
        workflowStep: elementValue("workflowStep", "Image2 样图复核")
      }));
      const count = byId("restoreDraft")?.querySelector("b");
      if (count) count.textContent = "1";
    } catch {}
  }

  function restoreDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (!draft || draft.format !== "mingtu_overlay_draft_v1") return toast("没有可恢复的本地草稿");
      state.annotations = Array.isArray(draft.annotations) ? draft.annotations : [];
      state.redoStack = [];
      state.backdropKind = draft.backdropKind || "image";
      state.sourceTextDocument = draft.sourceTextDocument || "";
      if (draft.backdropDataUrl) setBackdrop(draft.backdropDataUrl, draft.backdropName || "本地草稿底图", state.backdropKind);
      applyFieldValues(draft.contentFields || {});
      if (byId("correctionNote")) byId("correctionNote").value = draft.correctionNote || "";
      if (byId("issueType")) byId("issueType").value = draft.issueType || "结构错误";
      if (byId("workflowStep")) byId("workflowStep").value = draft.workflowStep || "Image2 样图复核";
      setContentType(draft.contentType || "image", { preserveTool: true });
      updateUI();
      toast("已恢复本地纠错草稿");
    } catch {
      toast("草稿损坏，无法恢复");
    }
  }

  function toast(message) {
    const element = byId("toast");
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
    globalThis.clearTimeout?.(toast.timer);
    toast.timer = globalThis.setTimeout?.(() => { element.hidden = true; }, 2200);
  }

  function setTool(tool) {
    if (!toolNames[tool]) return;
    state.tool = tool;
    for (const button of all("[data-tool]")) {
      const selected = button.dataset.tool === tool;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
    if (byId("toolState")) byId("toolState").textContent = toolNames[tool];
  }

  function setContentType(contentType, options = {}) {
    if (!contentTypeNames[contentType]) return;
    state.contentType = contentType;
    for (const button of all("[data-content-type]")) {
      const selected = button.dataset.contentType === contentType;
      button.setAttribute("aria-pressed", String(selected));
    }
    for (const panel of all("[data-content-panel]")) panel.hidden = panel.dataset.contentPanel !== contentType;
    if (!options.preserveTool) setTool(contentType === "image" ? "brush" : "rect");
    const label = contentTypeNames[contentType];
    if (byId("contentState")) byId("contentState").textContent = label;
    if (byId("contentBadgeLabel")) byId("contentBadgeLabel").textContent = label;
    byId("contentBadge")?.querySelector("use")?.setAttribute("href", contentTypeIcons[contentType]);
    if (byId("contentContractStatus")) byId("contentContractStatus").textContent = contentType === "text" ? "文字区域" : contentType === "engineering" ? "工程对象" : "图片区域";
    if (byId("summaryBase") && !state.empty) byId("summaryBase").textContent = state.backdropKind === "text_document" ? "文档" : contentType === "engineering" ? "工程图" : "图片";
    updateUI();
  }

  function annotationSummary(annotation) {
    const mode = annotation.mode === "depth_axis_3d" ? "三维" : annotation.mode === "perspective_grid" ? "透视" : "二维";
    const content = annotation.contentType === "text" ? "文字" : annotation.contentType === "engineering" ? "工程" : "图片";
    const role = annotation.role === "protect" ? "保护" : annotation.role === "reference" ? "参考" : "修改";
    return `${content} · ${role} · ${toolNames[annotation.tool] || annotation.tool} · ${mode}`;
  }

  function renderList() {
    const list = byId("annotationList");
    if (!list) return;
    if (!state.annotations.length) {
      list.innerHTML = '<li class="list-empty"><span>还没有标注</span><small>选择内容类型和标注角色，再用画笔、圈选、框选、箭头或文字开始。</small></li>';
      return;
    }
    list.innerHTML = state.annotations.map((annotation, index) => `
      <li data-annotation-id="${annotation.id}" class="${state.readonly && index === state.playbackIndex ? "is-active" : ""}">
        <span class="list-index mono">${String(index + 1).padStart(2, "0")}</span>
        <span class="list-copy"><strong>${escapeHtml(annotation.semanticLabel || toolNames[annotation.tool])}</strong><small>${annotationSummary(annotation)}</small></span>
        <button class="list-remove" type="button" data-remove-id="${annotation.id}" aria-label="删除第 ${index + 1} 条标注"><svg><use href="#i-trash"/></svg></button>
      </li>`).join("");
    for (const button of all("[data-remove-id]")) {
      button.addEventListener("click", () => removeAnnotation(button.dataset.removeId));
    }
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[character]);
  }

  function updateUI() {
    if (byId("annotationCount")) byId("annotationCount").textContent = String(state.annotations.length);
    if (byId("maskState")) byId("maskState").textContent = state.annotations.length ? `${state.annotations.length} 处修改` : "无修改";
    if (byId("summaryMask")) byId("summaryMask").textContent = state.annotations.length ? "有标注" : "空";
    if (byId("summaryBase")) byId("summaryBase").textContent = state.empty ? "未加载" : state.backdropKind === "text_document" ? "文档" : state.contentType === "engineering" ? "工程图" : "图片";
    if (byId("zoomState")) byId("zoomState").textContent = `${Math.round(state.zoom * 100)}%`;
    if (byId("zoomValue")) byId("zoomValue").textContent = `${Math.round(state.zoom * 100)}%`;
    if (byId("playbackIndex")) byId("playbackIndex").textContent = state.annotations.length ? `${state.playbackIndex + 1} / ${state.annotations.length}` : "0 / 0";
    if (byId("summaryStatus")) byId("summaryStatus").textContent = state.submittedAt ? "已提交" : state.readonly ? "回放" : "草稿";
    if (byId("contentState")) byId("contentState").textContent = contentTypeNames[state.contentType];
    if (scene) {
      scene.style.setProperty("--scene-zoom", state.zoom);
      scene.classList.toggle("overlay-hidden", !state.overlayVisible);
      scene.classList.toggle("readonly", state.readonly);
    }
    if (byId("emptyStage")) byId("emptyStage").hidden = !state.empty;
    if (baseImage) baseImage.hidden = state.empty;
    if (byId("readonlyBanner")) byId("readonlyBanner").hidden = !state.readonly;
    const toggle = byId("toggleOverlay");
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(state.overlayVisible));
      const use = toggle.querySelector("use");
      use?.setAttribute("href", state.overlayVisible ? "#i-eye" : "#i-eye-off");
      const label = toggle.querySelector("span");
      if (label) label.textContent = state.overlayVisible ? "显示蒙版" : "隐藏蒙版";
    }
    byId("readonlyToggle")?.setAttribute("aria-pressed", String(state.readonly));
    byId("emptyToggle")?.setAttribute("aria-pressed", String(state.empty));
    renderList();
    redraw();
  }

  function commit(annotation) {
    if (!annotation) return;
    const first = annotation.points[0];
    const last = annotation.points.at(-1) || first;
    const distance = Math.hypot((last.x || 0) - (first.x || 0), (last.y || 0) - (first.y || 0));
    if (annotation.tool !== "text" && distance < 0.003 && annotation.points.length < 3) return;
    state.annotations.push(annotation);
    state.redoStack = [];
    state.playbackIndex = state.annotations.length - 1;
    markDirty();
    updateUI();
  }

  function undo() {
    const annotation = state.annotations.pop();
    if (!annotation) return;
    state.redoStack.push(annotation);
    state.playbackIndex = Math.max(0, state.annotations.length - 1);
    markDirty();
    updateUI();
  }

  function redo() {
    const annotation = state.redoStack.pop();
    if (!annotation) return;
    state.annotations.push(annotation);
    state.playbackIndex = state.annotations.length - 1;
    markDirty();
    updateUI();
  }

  function removeAnnotation(annotationId) {
    const index = state.annotations.findIndex((annotation) => annotation.id === annotationId);
    if (index < 0) return;
    const [annotation] = state.annotations.splice(index, 1);
    state.redoStack.push(annotation);
    state.playbackIndex = Math.min(state.playbackIndex, Math.max(0, state.annotations.length - 1));
    markDirty();
    updateUI();
  }

  function clearAnnotations() {
    if (!state.annotations.length) return;
    state.redoStack.push(...state.annotations.splice(0));
    state.playbackIndex = 0;
    markDirty();
    updateUI();
    toast("蒙版已清空，可使用撤销恢复最后一条标注");
  }

  function setZoom(value) {
    state.zoom = Math.max(0.5, Math.min(2, Math.round(value * 10) / 10));
    updateUI();
  }

  function setBackdrop(dataUrl, name = "老师提供的底图", kind = "image") {
    state.backdropDataUrl = dataUrl || "";
    state.backdropName = name;
    state.backdropKind = dataUrl ? kind : "none";
    if (kind !== "text_document") state.sourceTextDocument = "";
    state.empty = !dataUrl;
    if (!dataUrl) return updateUI();
    baseImage.onload = () => {
      resizeCanvas(baseImage.naturalWidth || 1344, baseImage.naturalHeight || 756);
      updateUI();
    };
    baseImage.src = dataUrl;
    baseImage.alt = `${name}，老师纠错底图`;
    updateUI();
  }

  function wrapText(context, text, maxWidth) {
    const rows = [];
    let row = "";
    for (const character of String(text || "")) {
      if (character === "\n") {
        rows.push(row);
        row = "";
        continue;
      }
      const next = row + character;
      if (row && context.measureText(next).width > maxWidth) {
        rows.push(row);
        row = character;
      } else row = next;
    }
    rows.push(row);
    return rows;
  }

  function setTextBackdrop(text, name = "文字文档") {
    const source = String(text || "").replace(/\r\n/g, "\n");
    const documentCanvas = document.createElement("canvas");
    documentCanvas.width = 1344;
    documentCanvas.height = 756;
    const documentContext = documentCanvas.getContext("2d");
    documentContext.fillStyle = "#f5f7f8";
    documentContext.fillRect(0, 0, documentCanvas.width, documentCanvas.height);
    documentContext.fillStyle = "#ffffff";
    documentContext.fillRect(70, 34, 1204, 688);
    documentContext.strokeStyle = "#c4ccd1";
    documentContext.strokeRect(70.5, 34.5, 1203, 687);
    documentContext.fillStyle = "#182126";
    documentContext.font = '700 25px "Microsoft YaHei UI", sans-serif';
    documentContext.fillText(name, 112, 86);
    documentContext.fillStyle = "#5d6870";
    documentContext.font = '15px "Cascadia Mono", "Microsoft YaHei UI", monospace';
    documentContext.fillText("老师文字修改底稿 · 请框选精确文字并填写原文与新文", 112, 116);
    documentContext.font = '18px "Microsoft YaHei UI", sans-serif';
    const rows = wrapText(documentContext, source || "空文档", 1050).slice(0, 25);
    rows.forEach((row, index) => {
      const y = 164 + index * 22;
      documentContext.fillStyle = "#97a3aa";
      documentContext.font = '13px "Cascadia Mono", monospace';
      documentContext.fillText(String(index + 1).padStart(2, "0"), 102, y);
      documentContext.fillStyle = "#273137";
      documentContext.font = '17px "Microsoft YaHei UI", sans-serif';
      documentContext.fillText(row, 142, y);
    });
    state.sourceTextDocument = source;
    setBackdrop(documentCanvas.toDataURL("image/png"), name, "text_document");
    state.sourceTextDocument = source;
    setContentType("text");
  }

  function boxFromAnnotation(annotation) {
    const points = annotation.points || [];
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((value) => Number(value.toFixed(6)));
  }

  function detailRows(anchors, strokes) {
    return [
      ...anchors.map((anchor) => ({
        id: `${anchor.id}-region`,
        sourceElementId: anchor.id,
        detailCategory: "position/alignment/relation",
        classification: "constraint_or_relationship_backed",
        logicSource: "teacher marked normalized anchor box",
        teacherReviewRequired: true,
        blocksExecutionIfMissing: true
      })),
      ...strokes.flatMap((stroke) => {
        const first = stroke.points[0] || {};
        const last = stroke.points.at(-1) || first;
        const rows = [{
          id: `${stroke.id}-direction`,
          sourceElementId: stroke.id,
          detailCategory: "position/alignment/relation",
          classification: stroke.targetAnchorId ? "constraint_or_relationship_backed" : "teacher_exception_or_design_rule",
          logicSource: stroke.targetAnchorId ? "normalized points plus teacher marked target anchor" : "teacher normalized mark plus semantic correction note",
          values: { dx: Number(((last.x || 0) - (first.x || 0)).toFixed(6)), dy: Number(((last.y || 0) - (first.y || 0)).toFixed(6)) },
          teacherReviewRequired: true,
          blocksExecutionIfMissing: true
        }];
        if (stroke.mode === "perspective_grid" || stroke.mode === "depth_axis_3d") rows.push({
          id: `${stroke.id}-depth`,
          sourceElementId: stroke.id,
          detailCategory: "view/depth/perspective",
          classification: "constraint_or_relationship_backed",
          logicSource: "teacher selected spatial mode and depth hint",
          teacherReviewRequired: true,
          blocksExecutionIfMissing: true
        });
        return rows;
      })
    ];
  }

  function targetCompleteness(target) {
    const intent = target.editIntent || {};
    if (target.role !== "change") return { complete: true, reason: "non_change_region" };
    if (target.contentType === "text") {
      if (intent.documentType !== "plain_text" && !intent.locator) return { complete: false, reason: "missing_native_office_locator" };
      if (!intent.sourceText) return { complete: false, reason: "missing_teacher_confirmed_source_text" };
      if (intent.operation === "replace" && !intent.replacementText) return { complete: false, reason: "missing_replacement_text" };
      if (intent.operation === "format" && !intent.typographyNote) return { complete: false, reason: "missing_typography_instruction" };
      return { complete: true, reason: "exact_source_and_text_operation_present" };
    }
    if (target.contentType === "engineering") {
      if (!intent.objectId) return { complete: false, reason: "missing_engineering_object_id" };
      if (intent.action === "change_dimension" && (!intent.expectedValue || !intent.unit)) return { complete: false, reason: "missing_engineering_target_value_or_unit" };
      return { complete: true, reason: "engineering_object_action_and_parameter_present" };
    }
    if (!intent.instruction) return { complete: false, reason: "missing_local_image_edit_instruction" };
    return { complete: true, reason: "local_image_instruction_present" };
  }

  function modificationTargets() {
    return state.annotations.map((annotation) => {
      const points = annotation.points || [];
      const target = {
        id: annotation.id,
        contentType: annotation.contentType || "image",
        role: annotation.role || "change",
        label: annotation.semanticLabel,
        maskGeometry: {
          kind: annotation.tool,
          box: boxFromAnnotation(annotation),
          points: clone(points),
          coordinateUnits: "normalized_0_to_1"
        },
        editIntent: clone(annotation.editIntent || {}),
        preserveOutsideThisMask: true,
        teacherReviewRequired: true
      };
      return { ...target, completeness: targetCompleteness(target) };
    });
  }

  function targetDetailRows(targets) {
    return targets.map((target) => ({
      id: `${target.id}-content-edit`,
      sourceElementId: target.id,
      detailCategory: target.contentType === "text" ? "annotation/semantic/standard" : target.contentType === "engineering" ? "measurable geometry" : "position/alignment/relation",
      classification: target.completeness.complete ? "teacher_exception_or_design_rule" : "missing_evidence_blocks_execution",
      logicSource: target.completeness.complete
        ? `${target.role} mask plus teacher-confirmed ${target.contentType} edit intent`
        : target.completeness.reason,
      teacherReviewRequired: true,
      blocksExecutionIfMissing: true
    }));
  }

  function requestedEditMode(contentType = state.contentType) {
    if (contentType === "text") return "text_region_edit_only";
    if (contentType === "engineering") return "engineering_object_change_review_only";
    return "image2_local_edit_only";
  }

  function nextAdapter(contentType = state.contentType) {
    if (contentType === "text") return "reviewed_text_or_document_editor_adapter";
    if (contentType === "engineering") return "reviewed_CAD_API_macro_file_or_UI_adapter_after_object_confirmation";
    return "Image2 local edit";
  }

  function packet() {
    const targets = modificationTargets();
    const anchors = state.annotations
      .filter((annotation) => annotation.tool === "rect" || annotation.tool === "ellipse")
      .map((annotation) => ({
        id: annotation.id,
        type: annotation.tool === "ellipse" ? "teacher_marked_ellipse_region" : "teacher_marked_region",
        label: annotation.semanticLabel,
        box: boxFromAnnotation(annotation),
        role: annotation.role || "change",
        contentType: annotation.contentType || "image",
        editIntent: clone(annotation.editIntent || {}),
        mode: annotation.mode,
        depthHint: annotation.depthHint
      }));
    const strokes = state.annotations
      .filter((annotation) => annotation.tool !== "rect" && annotation.tool !== "ellipse")
      .map((annotation) => ({
        id: annotation.id,
        kind: annotation.tool,
        role: annotation.role || "change",
        contentType: annotation.contentType || "image",
        editIntent: clone(annotation.editIntent || {}),
        mode: annotation.mode,
        semanticLabel: annotation.semanticLabel,
        color: annotation.color,
        width: annotation.width,
        targetAnchorId: anchors.at(-1)?.id || "",
        depthHint: annotation.depthHint > 0.08 ? "nearer_than_start" : annotation.depthHint < -0.08 ? "farther_than_start" : "same_plane",
        points: annotation.points
      }));
    const rows = [...detailRows(anchors, strokes), ...targetDetailRows(targets)];
    const changeTargets = targets.filter((target) => target.role === "change");
    const protectedTargets = targets.filter((target) => target.role === "protect");
    const referenceTargets = targets.filter((target) => target.role === "reference");
    const policy = elementValue("editScopePolicy", "surgical_only");
    return {
      format: "transparent_ai_sketch_overlay_packet_v1",
      workbenchFormat: "mingtu_teacher_mask_correction_v1",
      modificationFormat: "mingtu_multimodal_surgical_mask_correction_v1",
      kitId: config.kitId || "local-mask-review",
      software: config.software || "Image2 packaging review",
      goal: config.goal || "老师纠正包装样图",
      createdAt: new Date().toISOString(),
      fullContinuousRecording: false,
      overlayMode: elementValue("spatialMode", "screen_2d"),
      background: {
        kind: state.backdropKind === "text_document" ? "teacher_supplied_text_document_render" : state.backdropName ? "teacher_supplied_or_generated_review_image" : "transparent_screen_overlay",
        fileName: state.backdropName,
        embeddedForLocalReview: Boolean(state.backdropDataUrl),
        sha256: config.initialBackdropSha256 || null,
        sourceTextIncluded: state.backdropKind === "text_document"
      },
      coordinateSpace: {
        origin: "top_left_review_image",
        units: "normalized_0_to_1",
        canvasPixels: { width: canvas.width, height: canvas.height },
        supports2D: true,
        supports3DDepthHints: true,
        supportsPerspectiveRelationships: true
      },
      anchors,
      strokes,
      annotations: clone(state.annotations),
      activeContentType: state.contentType,
      supportedContentTypes: ["text", "image", "engineering"],
      modificationTargets: targets,
      changeTargets,
      preservationRegions: protectedTargets,
      referenceRelations: referenceTargets,
      contentEdit: {
        activeContentType: state.contentType,
        currentIntent: captureEditIntent(),
        textEditRequests: changeTargets.filter((target) => target.contentType === "text"),
        imageEditRequests: changeTargets.filter((target) => target.contentType === "image"),
        engineeringEditRequests: changeTargets.filter((target) => target.contentType === "engineering")
      },
      surgicalEditContract: {
        format: "mingtu_surgical_edit_contract_v1",
        policy,
        selectedChangeTargetIds: changeTargets.map((target) => target.id),
        explicitProtectionRegionIds: protectedTargets.map((target) => target.id),
        globalPreserveInstruction: elementValue("globalPreserveNote", "").trim(),
        changeOnlyInsideSelectedTargets: true,
        preserveAllUnmarkedContent: true,
        fullRegenerationAllowed: policy === "teacher_requested_regeneration",
        localEditFailureBehavior: policy === "local_then_review_regeneration"
          ? "stop_and_prepare_separate_full_regeneration_candidate_for_teacher_comparison"
          : policy === "teacher_requested_regeneration"
            ? "prepare_full_regeneration_candidate_without_replacing_current_artifact"
            : "block_and_return_to_teacher_without_regenerating",
        validation: {
          textOutsideTargets: "exact_text_and_style_match_required",
          imageOutsideTargets: "pixel_or_perceptual_diff_must_be_zero_or_within_teacher_confirmed_tolerance",
          engineeringOutsideTargets: "unselected_entity_ids_parameters_constraints_and_topology_must_match_before_state",
          beforeAfterComparisonRequired: true,
          rejectIfUnmarkedContentChanged: true
        }
      },
      teacherCorrection: {
        issueType: elementValue("issueType", "结构错误"),
        workflowStep: elementValue("workflowStep", "Image2 样图复核"),
        note: elementValue("correctionNote", "").trim(),
        requestedEditMode: requestedEditMode(),
        editScopePolicy: policy,
        preserveUnmarkedRegions: true,
        rejectWholeArtifactReplacementForLocalIssue: policy !== "teacher_requested_regeneration"
      },
      spatialIntent: {
        relationships: strokes.map((stroke) => ({
          subject: stroke.id,
          relation: stroke.mode === "depth_axis_3d" ? "nearer_than" : stroke.mode === "perspective_grid" ? "perspective_to" : "position_hint",
          object: stroke.targetAnchorId || stroke.semanticLabel || "teacher-mark"
        })),
        perspectiveCues: strokes.filter((stroke) => stroke.mode === "perspective_grid" || stroke.mode === "depth_axis_3d").map((stroke) => ({ strokeId: stroke.id, cue: stroke.mode, depthHint: stroke.depthHint })),
        inferredTeacherIntent: "review_only: teacher marks and written correction identify local changes; unmarked regions should be preserved"
      },
      proposedSoftwareAction: {
        executionMode: "teacher_review_only",
        nativeExecutionImplemented: false,
        requiresToolAdapter: true,
        nextAdapter: nextAdapter(),
        targetIds: changeTargets.map((target) => target.id),
        fullArtifactReplacementPrepared: false
      },
      universalDetailLogicContract: {
        format: "transparent_ai_universal_detail_logic_contract_v1",
        principle: "All consequential sketch details must be logicized before execution; visual similarity alone is insufficient.",
        detailLogicScope: ["measurable geometry", "angular/curvature", "pattern/spacing/count", "position/alignment/relation", "view/depth/perspective", "tolerance/fit/clearance", "annotation/semantic/standard", "material/process/manufacturing", "teacher exception/design rule", "decorative/non-parametric"],
        requiredClassifications: ["data_or_formula_backed", "constraint_or_relationship_backed", "teacher_exception_or_design_rule", "decorative_or_non_parametric", "missing_evidence_blocks_execution"],
        consequentialDetailRows: rows,
        missingDetailLogicCount: rows.filter((row) => row.classification === "missing_evidence_blocks_execution").length,
        missingLogicSourceBehavior: "block_execute_and_route_to_teacher_review",
        blockedActions: ["execute_or_generate_output_that_only_looks_similar_without_detail_logic", "treat_image_pixels_as_engineering_dimensions", "change_unmarked_content_during_local_edit", "replace_whole_artifact_for_local_issue_without_teacher_request", "enable_rule_or_unlock_packaging_from_visual_correction"]
      },
      locks
    };
  }

  function validateCorrection(data) {
    if (!data.changeTargets.length) return "请至少添加一处修改区；保护区和参考关系不能代替修改目标";
    const incomplete = data.changeTargets.find((target) => !target.completeness.complete);
    if (incomplete) {
      const messages = {
        missing_teacher_confirmed_source_text: "文字修改还缺少老师确认的原文",
        missing_native_office_locator: "Word / Excel 修改还缺少原生定位器",
        missing_replacement_text: "替换文字操作还缺少新文字",
        missing_typography_instruction: "格式修改还缺少字体或排版要求",
        missing_engineering_object_id: "工程修改还缺少对象编号或名称",
        missing_engineering_target_value_or_unit: "尺寸修改还缺少目标值或单位",
        missing_local_image_edit_instruction: "图片修改还缺少蒙版内的具体要求"
      };
      return messages[incomplete.completeness.reason] || `修改目标 ${incomplete.label || incomplete.id} 的证据不完整`;
    }
    if (!data.surgicalEditContract.globalPreserveInstruction) return "请说明未标注内容必须保持什么";
    return "";
  }

  async function submitCorrection() {
    const note = elementValue("correctionNote", "").trim();
    if (!note && !state.annotations.length) {
      setSubmitState("error", "请先添加蒙版标注或填写老师意见");
      return;
    }
    const data = packet();
    const validationError = validateCorrection(data);
    if (validationError) {
      setSubmitState("error", validationError);
      return;
    }
    setSubmitState("submitting", "正在锁定修改区、保护区与未标注内容…");
    await new Promise((resolve) => globalThis.setTimeout(resolve, 320));
    const text = JSON.stringify(data, null, 2);
    try { await navigator.clipboard?.writeText(text); } catch {}
    try {
      const link = document.createElement("a");
      link.download = `mingtu-surgical-mask-correction-${config.kitId || "local"}.json`;
      link.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      link.click();
      globalThis.setTimeout?.(() => URL.revokeObjectURL?.(link.href), 1000);
    } catch {}
    state.submittedAt = data.createdAt;
    setSubmitState("success", state.contentType === "engineering" ? "工程对象修改包已导出，等待对象确认与受控适配器" : state.contentType === "text" ? "文字局部修改包已导出，等待精确替换并核对外部零改动" : "图片局部修改包已导出，等待蒙版内修改与外部差异检查");
    updateUI();
  }

  function setSubmitState(kind, message) {
    const status = byId("submitStatus");
    const button = byId("submitButton");
    status?.classList.remove("is-submitting", "is-success", "is-error");
    status?.classList.add(kind === "submitting" ? "is-submitting" : kind === "success" ? "is-success" : kind === "error" ? "is-error" : "");
    const label = status?.querySelector("span");
    if (label) label.textContent = message;
    if (button) button.disabled = kind === "submitting";
  }

  function updateLatestEditIntent() {
    const latest = [...state.annotations].reverse().find((annotation) => (annotation.contentType || "image") === state.contentType && (annotation.role || "change") === "change");
    if (latest) latest.editIntent = captureEditIntent();
    markDirty();
    updateUI();
  }

  function bindEvents() {
    for (const button of all("[data-content-type]")) button.addEventListener("click", () => setContentType(button.dataset.contentType));
    for (const button of all("[data-tool]")) button.addEventListener("click", () => setTool(button.dataset.tool));
    byId("strokeWidth")?.addEventListener("input", (event) => { if (byId("widthOutput")) byId("widthOutput").textContent = `${event.target.value} px`; });
    byId("strokeColor")?.addEventListener("input", (event) => { const swatch = event.target.nextElementSibling; if (swatch) swatch.style.background = event.target.value; });
    byId("depthHint")?.addEventListener("input", (event) => { if (byId("depthOutput")) byId("depthOutput").textContent = Number(event.target.value).toFixed(2); });
    byId("undoButton")?.addEventListener("click", undo);
    byId("redoButton")?.addEventListener("click", redo);
    byId("restoreDraft")?.addEventListener("click", restoreDraft);
    byId("clearButton")?.addEventListener("click", () => {
      const dialog = byId("clearDialog");
      if (dialog?.showModal) dialog.showModal();
      else if (globalThis.confirm?.("清空全部蒙版？")) clearAnnotations();
    });
    byId("clearDialog")?.addEventListener("close", (event) => { if (event.target.returnValue === "confirm") clearAnnotations(); });
    byId("toggleOverlay")?.addEventListener("click", () => { state.overlayVisible = !state.overlayVisible; updateUI(); });
    byId("readonlyToggle")?.addEventListener("click", () => { state.readonly = !state.readonly; state.playbackIndex = 0; updateUI(); });
    byId("playbackNext")?.addEventListener("click", () => { if (state.annotations.length) state.playbackIndex = (state.playbackIndex + 1) % state.annotations.length; updateUI(); });
    byId("emptyToggle")?.addEventListener("click", () => { state.empty = !state.empty; updateUI(); });
    byId("zoomIn")?.addEventListener("click", () => setZoom(state.zoom + 0.1));
    byId("zoomOut")?.addEventListener("click", () => setZoom(state.zoom - 0.1));
    byId("fitButton")?.addEventListener("click", () => setZoom(1));
    byId("zoomValue")?.addEventListener("click", () => setZoom(1));
    byId("inspectorToggle")?.addEventListener("click", () => byId("inspector")?.classList.add("is-open"));
    byId("inspectorClose")?.addEventListener("click", () => byId("inspector")?.classList.remove("is-open"));
    byId("submitButton")?.addEventListener("click", submitCorrection);
    byId("failureDemo")?.addEventListener("click", () => setSubmitState("error", "提交失败：本地写入被阻止，请保留草稿后重试"));
    for (const input of [byId("correctionNote"), byId("issueType"), byId("workflowStep")]) input?.addEventListener("input", markDirty);
    for (const fieldId of contentFieldIds) {
      const field = byId(fieldId);
      if (!field) continue;
      field.addEventListener("input", ["maskRole", "editScopePolicy", "globalPreserveNote"].includes(fieldId) ? markDirty : updateLatestEditIntent);
    }

    byId("imageUpload")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      const isText = file.type.startsWith("text/") || /\.(txt|md|csv|json)$/i.test(file.name);
      reader.onload = () => {
        if (isText) setTextBackdrop(String(reader.result || ""), file.name);
        else setBackdrop(String(reader.result), file.name, "image");
        markDirty();
      };
      if (isText) reader.readAsText(file, "utf8");
      else reader.readAsDataURL(file);
    });

    canvas.addEventListener("pointerdown", (event) => {
      if (state.readonly || state.empty) return;
      const point = normalizedPoint(event);
      state.current = newAnnotation(state.tool, point);
      if (state.tool === "text") {
        commit(state.current);
        state.current = null;
        return;
      }
      canvas.setPointerCapture?.(event.pointerId);
      redraw();
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!state.current) return;
      const point = normalizedPoint(event);
      if (state.current.tool === "brush") state.current.points.push(point);
      else state.current.points[1] = point;
      redraw();
    });
    canvas.addEventListener("pointerup", (event) => {
      if (!state.current) return;
      const point = normalizedPoint(event);
      if (state.current.tool === "brush") state.current.points.push(point);
      else state.current.points[1] = point;
      const annotation = state.current;
      state.current = null;
      commit(annotation);
    });
    canvas.addEventListener("pointercancel", () => { state.current = null; redraw(); });
    globalThis.addEventListener?.("blur", () => { state.current = null; redraw(); });
    globalThis.addEventListener?.("resize", redraw, { passive: true });
    document.addEventListener("visibilitychange", () => { if (document.hidden) { state.current = null; redraw(); } });
    document.addEventListener("keydown", (event) => {
      if (/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName || "")) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      } else if ({ b: "brush", o: "ellipse", r: "rect", a: "arrow", t: "text" }[key]) {
        setTool({ b: "brush", o: "ellipse", r: "rect", a: "arrow", t: "text" }[key]);
      }
    });
  }

  function importAnnotations(annotations) {
    state.annotations = clone(Array.isArray(annotations) ? annotations : []);
    state.redoStack = [];
    state.playbackIndex = 0;
    updateUI();
  }

  function initialize() {
    if (byId("taskTitle")) byId("taskTitle").textContent = config.goal || "包装样图老师复核";
    if (byId("taskId")) byId("taskId").textContent = config.kitId || "MT-LOCAL";
    resizeCanvas(config.canvasWidth || 1344, config.canvasHeight || 756);
    bindEvents();
    applyFieldValues(config.initialFields || {});
    setContentType(state.contentType);
    if (config.initialBackdropDataUrl) setBackdrop(config.initialBackdropDataUrl, config.initialBackdropName || "审校底图", "image");
    if (Array.isArray(config.initialAnnotations) && config.initialAnnotations.length) importAnnotations(config.initialAnnotations);
    else updateUI();
  }

  globalThis.packet = packet;
  globalThis.MingTuOverlay = {
    packet,
    importAnnotations,
    setBackdrop,
    setTextBackdrop,
    setContentType,
    setTool,
    setCorrection(values = {}) {
      if (values.note !== undefined && byId("correctionNote")) byId("correctionNote").value = values.note;
      if (values.issueType !== undefined && byId("issueType")) byId("issueType").value = values.issueType;
      if (values.workflowStep !== undefined && byId("workflowStep")) byId("workflowStep").value = values.workflowStep;
      applyFieldValues(values);
    },
    getState: () => clone(state)
  };

  initialize();
})();
