(() => {
  "use strict";

  const config = globalThis.__MINGTU_OVERLAY_CONFIG__ || {};
  const locks = {
    ruleEnabled: false,
    accepted: false,
    technologyAccepted: false,
    packagingGated: true,
    nativeExecutionImplemented: false,
    teacherReviewRequired: true
  };
  const toolNames = {
    brush: "自由画笔",
    ellipse: "圈选",
    rect: "框选",
    arrow: "箭头",
    text: "文字"
  };
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
    backdropName: config.initialBackdropName || "",
    backdropDataUrl: config.initialBackdropDataUrl || "",
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
    return text || toolNames[tool] || "老师标注";
  }

  function newAnnotation(tool, point) {
    return {
      id: id(tool),
      tool,
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
    ctx.strokeStyle = annotation.color || "#d4463a";
    ctx.fillStyle = annotation.color || "#d4463a";
    ctx.lineWidth = Math.max(1, Number(annotation.width || 6) * (canvas.width / 1344));
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (active) ctx.setLineDash([10, 7]);

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
        backdropName: state.backdropName,
        backdropDataUrl: state.backdropDataUrl,
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
      if (draft.backdropDataUrl) setBackdrop(draft.backdropDataUrl, draft.backdropName || "本地草稿底图");
      if (byId("correctionNote")) byId("correctionNote").value = draft.correctionNote || "";
      if (byId("issueType")) byId("issueType").value = draft.issueType || "结构错误";
      if (byId("workflowStep")) byId("workflowStep").value = draft.workflowStep || "Image2 样图复核";
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

  function annotationSummary(annotation) {
    const mode = annotation.mode === "depth_axis_3d" ? "三维" : annotation.mode === "perspective_grid" ? "透视" : "二维";
    return `${toolNames[annotation.tool] || annotation.tool} · ${mode}`;
  }

  function renderList() {
    const list = byId("annotationList");
    if (!list) return;
    if (!state.annotations.length) {
      list.innerHTML = '<li class="list-empty"><span>还没有标注</span><small>从画笔、圈选、框选、箭头或文字开始。</small></li>';
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
    if (byId("summaryBase")) byId("summaryBase").textContent = state.empty ? "未加载" : state.backdropName ? "已加载" : "Image2";
    if (byId("zoomState")) byId("zoomState").textContent = `${Math.round(state.zoom * 100)}%`;
    if (byId("zoomValue")) byId("zoomValue").textContent = `${Math.round(state.zoom * 100)}%`;
    if (byId("playbackIndex")) byId("playbackIndex").textContent = state.annotations.length ? `${state.playbackIndex + 1} / ${state.annotations.length}` : "0 / 0";
    if (byId("summaryStatus")) byId("summaryStatus").textContent = state.submittedAt ? "已提交" : state.readonly ? "回放" : "草稿";
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

  function setBackdrop(dataUrl, name = "老师提供的底图") {
    state.backdropDataUrl = dataUrl || "";
    state.backdropName = name;
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

  function packet() {
    const anchors = state.annotations
      .filter((annotation) => annotation.tool === "rect" || annotation.tool === "ellipse")
      .map((annotation) => ({
        id: annotation.id,
        type: annotation.tool === "ellipse" ? "teacher_marked_ellipse_region" : "teacher_marked_region",
        label: annotation.semanticLabel,
        box: boxFromAnnotation(annotation),
        mode: annotation.mode,
        depthHint: annotation.depthHint
      }));
    const strokes = state.annotations
      .filter((annotation) => annotation.tool !== "rect" && annotation.tool !== "ellipse")
      .map((annotation) => ({
        id: annotation.id,
        kind: annotation.tool,
        mode: annotation.mode,
        semanticLabel: annotation.semanticLabel,
        color: annotation.color,
        width: annotation.width,
        targetAnchorId: anchors.at(-1)?.id || "",
        depthHint: annotation.depthHint > 0.08 ? "nearer_than_start" : annotation.depthHint < -0.08 ? "farther_than_start" : "same_plane",
        points: annotation.points
      }));
    const rows = detailRows(anchors, strokes);
    return {
      format: "transparent_ai_sketch_overlay_packet_v1",
      workbenchFormat: "mingtu_teacher_mask_correction_v1",
      kitId: config.kitId || "local-mask-review",
      software: config.software || "Image2 packaging review",
      goal: config.goal || "老师纠正包装样图",
      createdAt: new Date().toISOString(),
      fullContinuousRecording: false,
      overlayMode: elementValue("spatialMode", "screen_2d"),
      background: {
        kind: state.backdropName ? "teacher_supplied_or_generated_review_image" : "transparent_screen_overlay",
        fileName: state.backdropName,
        embeddedForLocalReview: Boolean(state.backdropDataUrl)
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
      teacherCorrection: {
        issueType: elementValue("issueType", "结构错误"),
        workflowStep: elementValue("workflowStep", "Image2 样图复核"),
        note: elementValue("correctionNote", "").trim(),
        requestedEditMode: "image2_local_edit_only",
        preserveUnmarkedRegions: true
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
        nextAdapter: "Image2 local edit"
      },
      universalDetailLogicContract: {
        format: "transparent_ai_universal_detail_logic_contract_v1",
        principle: "All consequential sketch details must be logicized before execution; visual similarity alone is insufficient.",
        detailLogicScope: ["measurable geometry", "angular/curvature", "pattern/spacing/count", "position/alignment/relation", "view/depth/perspective", "tolerance/fit/clearance", "annotation/semantic/standard", "material/process/manufacturing", "teacher exception/design rule", "decorative/non-parametric"],
        requiredClassifications: ["data_or_formula_backed", "constraint_or_relationship_backed", "teacher_exception_or_design_rule", "decorative_or_non_parametric", "missing_evidence_blocks_execution"],
        consequentialDetailRows: rows,
        missingDetailLogicCount: rows.filter((row) => row.classification === "missing_evidence_blocks_execution").length,
        missingLogicSourceBehavior: "block_execute_and_route_to_teacher_review",
        blockedActions: ["execute_or_generate_output_that_only_looks_similar_without_detail_logic", "treat_image_pixels_as_engineering_dimensions", "enable_rule_or_unlock_packaging_from_visual_correction"]
      },
      locks
    };
  }

  async function submitCorrection() {
    const note = elementValue("correctionNote", "").trim();
    if (!note && !state.annotations.length) {
      setSubmitState("error", "请先添加蒙版标注或填写老师意见");
      return;
    }
    setSubmitState("submitting", "正在整理结构化纠错证据…");
    await new Promise((resolve) => globalThis.setTimeout(resolve, 320));
    const data = packet();
    const text = JSON.stringify(data, null, 2);
    try { await navigator.clipboard?.writeText(text); } catch {}
    try {
      const link = document.createElement("a");
      link.download = `mingtu-teacher-correction-${config.kitId || "local"}.json`;
      link.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      link.click();
      globalThis.setTimeout?.(() => URL.revokeObjectURL?.(link.href), 1000);
    } catch {}
    state.submittedAt = data.createdAt;
    setSubmitState("success", "纠错证据已导出，等待 Image2 局部修改");
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

  function bindEvents() {
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

    byId("imageUpload")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { setBackdrop(String(reader.result), file.name); markDirty(); };
      reader.readAsDataURL(file);
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
    setTool("brush");
    if (config.initialBackdropDataUrl) setBackdrop(config.initialBackdropDataUrl, config.initialBackdropName || "Image2 样图");
    else updateUI();
  }

  globalThis.packet = packet;
  globalThis.MingTuOverlay = {
    packet,
    importAnnotations,
    setBackdrop,
    setTool,
    setCorrection(values = {}) {
      if (values.note !== undefined && byId("correctionNote")) byId("correctionNote").value = values.note;
      if (values.issueType !== undefined && byId("issueType")) byId("issueType").value = values.issueType;
      if (values.workflowStep !== undefined && byId("workflowStep")) byId("workflowStep").value = values.workflowStep;
    },
    getState: () => clone(state)
  };

  initialize();
})();
