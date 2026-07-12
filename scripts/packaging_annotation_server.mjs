import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildEditContract } from "./packaging_precision_core.mjs";

const WORKSPACE = "D:\\Transparent AI Apprentice MCP";
const SESSION_ROOT = path.join(WORKSPACE, "artifacts", "packaging_teaching_session");
const IMAGE_DIR = path.join(SESSION_ROOT, "image2_review_images");
const OVERLAY_DIR = path.join(SESSION_ROOT, "annotation_overlays");
const SAVE_ROOT = path.join(SESSION_ROOT, "annotation_reviews");
const HOST = "127.0.0.1";
const START_PORT = Number(process.env.PACKAGING_ANNOTATION_PORT || 43123);

const cases = [
  {
    id: "case_01_transport_box",
    label: "案例 01：电子设备运输外箱",
    image: path.join(IMAGE_DIR, "case_01_transport_box_image2_review.png"),
    overlayFile: path.join(OVERLAY_DIR, "case_01_transport_box.overlay.json"),
  },
  {
    id: "case_02_auto_lock_carton",
    label: "案例 02：小型零售自锁底纸盒",
    image: path.join(IMAGE_DIR, "case_02_auto_lock_carton_image2_review.png"),
    overlayFile: path.join(OVERLAY_DIR, "case_02_auto_lock_carton.overlay.json"),
  },
  {
    id: "case_03_master_carton_12pack",
    label: "案例 03：12 入集合运输箱",
    image: path.join(IMAGE_DIR, "case_03_master_carton_12pack_image2_review.png"),
    overlayFile: path.join(OVERLAY_DIR, "case_03_master_carton_12pack.overlay.json"),
  },
];

async function loadAndVerifyCaseData() {
  for (const item of cases) {
    const [imageBuffer, overlayText] = await Promise.all([
      fs.readFile(item.image),
      fs.readFile(item.overlayFile, "utf8"),
    ]);
    const overlay = JSON.parse(overlayText);
    const actualHash = crypto.createHash("sha256").update(imageBuffer).digest("hex");
    if (overlay.caseId !== item.id || overlay.baseImage.sha256 !== actualHash) {
      throw new Error(`Immutable base image check failed for ${item.id}; regenerate and review registration before serving`);
    }
    const catalog = JSON.parse(await fs.readFile(overlay.catalog.path, "utf8"));
    item.baseImageSha256 = actualHash;
    item.overlay = overlay;
    item.catalog = catalog;
  }
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, headers);
  res.end(payload);
}

function notFound(res) {
  send(res, 404, { error: "not_found" }, { "Content-Type": "application/json; charset=utf-8" });
}

function dataUrlToBuffer(dataUrl) {
  const match = /^data:image\/png;base64,(.+)$/u.exec(dataUrl || "");
  if (!match) {
    throw new Error("Expected PNG data URL");
  }
  return Buffer.from(match[1], "base64");
}

function stringifyJsonForWindows(data) {
  return JSON.stringify(data, null, 2).replace(/[^\x00-\x7F]/gu, (char) => {
    const code = char.codePointAt(0);
    if (code === undefined) return char;
    if (code <= 0xffff) return `\\u${code.toString(16).padStart(4, "0")}`;
    const shifted = code - 0x10000;
    const high = 0xd800 + (shifted >> 10);
    const low = 0xdc00 + (shifted & 0x3ff);
    return `\\u${high.toString(16).padStart(4, "0")}\\u${low.toString(16).padStart(4, "0")}`;
  });
}

function safeStamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

const html = String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>包装图纸蒙版标注</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #18212f;
      --ink-strong: #0b1220;
      --muted: #667085;
      --muted-strong: #475467;
      --line: #d5dbe5;
      --line-strong: #aeb8c7;
      --chrome: #f6f8fb;
      --workspace: #e9edf2;
      --panel: #ffffff;
      --blue: #155eef;
      --blue-dark: #1849a9;
      --blue-soft: #eef4ff;
      --red: #d92d20;
      --red-soft: #fff1f0;
      --amber: #b54708;
      --amber-soft: #fff7ed;
      --green: #067647;
      --green-soft: #ecfdf3;
      --mono: "IBM Plex Mono", "Cascadia Mono", Consolas, monospace;
      --sans: "Noto Sans CJK SC", "Source Han Sans SC", "Microsoft YaHei UI", "PingFang SC", sans-serif;
    }
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; }
    body {
      margin: 0;
      overflow: hidden;
      font-family: var(--sans);
      font-size: 14px;
      color: var(--ink);
      background: var(--workspace);
    }
    button, select, input, textarea { font: inherit; }
    button { letter-spacing: 0; }
    button:focus-visible, select:focus-visible, input:focus-visible, textarea:focus-visible {
      outline: 2px solid #84adff;
      outline-offset: 2px;
    }
    button:disabled { cursor: not-allowed; opacity: .54; }
    .app {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 348px;
      grid-template-rows: 54px minmax(0, 1fr);
      width: 100vw;
      height: 100vh;
      min-width: 1060px;
    }
    header {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: 236px minmax(0, 1fr) auto;
      align-items: center;
      gap: 16px;
      padding: 0 12px;
      background: #101828;
      color: #f8fafc;
      border-bottom: 1px solid #344054;
    }
    .brand {
      display: flex;
      align-items: center;
      min-width: 0;
      gap: 10px;
    }
    .brandMark {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      flex: 0 0 30px;
      border: 1px solid #667085;
      border-radius: 4px;
      color: #84adff;
      font: 800 14px var(--mono);
      background: #1d2939;
    }
    .title { min-width: 0; line-height: 1.15; }
    .title strong {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 14px;
      font-weight: 700;
    }
    .title span {
      display: block;
      margin-top: 3px;
      color: #98a2b3;
      font: 500 10px var(--mono);
      text-transform: uppercase;
    }
    .tabs {
      display: flex;
      align-items: center;
      min-width: 0;
      height: 100%;
      gap: 2px;
      overflow: hidden;
    }
    .tabs button {
      min-width: 0;
      max-width: 230px;
      height: 34px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 0 12px;
      border: 1px solid transparent;
      border-radius: 4px;
      color: #d0d5dd;
      background: transparent;
      cursor: pointer;
    }
    .tabs button:hover { color: #fff; background: #1d2939; }
    .tabs button.active {
      color: #fff;
      border-color: #475467;
      background: #344054;
      box-shadow: inset 0 -2px 0 #528bff;
      font-weight: 700;
    }
    .viewControls {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .iconButton {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      padding: 0;
      border: 1px solid #475467;
      border-radius: 4px;
      color: #f2f4f7;
      background: #1d2939;
      font: 700 18px var(--mono);
      cursor: pointer;
    }
    .iconButton:hover { border-color: #84adff; background: #344054; }
    .zoomReadout {
      width: 48px;
      color: #d0d5dd;
      text-align: center;
      font: 600 11px var(--mono);
    }
    .work {
      display: grid;
      grid-template-rows: 48px 30px minmax(0, 1fr);
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      background: var(--workspace);
    }
    .canvasToolbar {
      display: flex;
      align-items: center;
      min-width: 0;
      gap: 8px;
      padding: 7px 10px;
      background: var(--chrome);
      border-bottom: 1px solid var(--line);
    }
    .toolGroup {
      display: flex;
      align-items: center;
      gap: 3px;
      min-width: 0;
    }
    .toolGroup + .toolGroup {
      padding-left: 8px;
      border-left: 1px solid var(--line);
    }
    .toolButton, .actionButton {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 32px;
      gap: 6px;
      padding: 0 9px;
      border: 1px solid transparent;
      border-radius: 4px;
      color: var(--muted-strong);
      background: transparent;
      cursor: pointer;
      white-space: nowrap;
      font-size: 12px;
    }
    .toolButton:hover, .actionButton:hover { border-color: var(--line); background: #fff; color: var(--ink); }
    .toolButton.active {
      border-color: #84adff;
      color: var(--blue-dark);
      background: var(--blue-soft);
      box-shadow: inset 0 -2px 0 var(--blue);
      font-weight: 700;
    }
    .toolGlyph {
      display: inline-grid;
      place-items: center;
      width: 17px;
      height: 17px;
      font: 700 14px var(--mono);
    }
    .toolbarSpacer { flex: 1 1 auto; min-width: 8px; }
    .rangeControl {
      display: grid;
      grid-template-columns: auto 86px 34px;
      align-items: center;
      gap: 6px;
      color: var(--muted-strong);
      font-size: 11px;
      white-space: nowrap;
    }
    .rangeControl input { width: 86px; accent-color: var(--blue); }
    .rangeValue { color: var(--ink); text-align: right; font: 600 11px var(--mono); }
    .actionButton { border-color: var(--line); background: #fff; }
    .actionButton.danger { margin-left: 4px; border-color: #f5b7b1; color: #b42318; background: #fff; }
    .actionButton.danger:hover { border-color: var(--red); background: var(--red-soft); }
    .workspaceStatus {
      display: flex;
      align-items: center;
      gap: 14px;
      min-width: 0;
      padding: 0 12px;
      color: var(--muted-strong);
      background: #f9fafb;
      border-bottom: 1px solid var(--line);
      font-size: 11px;
    }
    .statusItem { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
    .statusDot { width: 6px; height: 6px; border-radius: 50%; background: #98a2b3; }
    .statusDot.blue { background: var(--blue); }
    .statusDot.red { background: var(--red); }
    .statusDot.amber { background: #f79009; }
    .statusValue { color: var(--ink); font: 600 11px var(--mono); }
    .canvasWrap {
      position: relative;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      width: 100%;
      min-width: 0;
      min-height: 0;
      padding: 12px;
      overflow: auto;
      background-color: var(--workspace);
    }
    .stage {
      position: relative;
      flex: 0 0 auto;
      width: 1344px;
      height: 756px;
      overflow: hidden;
      background: #fff;
      border: 1px solid #98a2b3;
      box-shadow: 0 10px 28px rgba(16, 24, 40, .14), 0 2px 5px rgba(16, 24, 40, .12);
      transform-origin: top center;
    }
    canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
    #referenceCanvas { pointer-events: none; }
    #maskCanvas { cursor: crosshair; touch-action: none; }
    aside {
      display: grid;
      grid-template-rows: 58px minmax(0, 1fr) auto;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      background: var(--panel);
      border-left: 1px solid var(--line-strong);
    }
    .inspectorHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 0 14px;
      border-bottom: 1px solid var(--line);
      background: #f9fafb;
    }
    .inspectorTitle { line-height: 1.15; }
    .inspectorTitle strong { display: block; color: var(--ink-strong); font-size: 14px; }
    .inspectorTitle span { display: block; margin-top: 3px; color: var(--muted); font: 500 10px var(--mono); }
    .reviewBadge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 7px;
      border: 1px solid #fedf89;
      border-radius: 4px;
      color: #93370d;
      background: #fffaeb;
      font-size: 11px;
      white-space: nowrap;
    }
    .inspectorScroll { min-height: 0; overflow: auto; scrollbar-gutter: stable; }
    .panel {
      padding: 14px;
      border-bottom: 1px solid var(--line);
      background: #fff;
    }
    .panel h2 { margin: 0 0 12px; color: var(--ink-strong); font-size: 13px; }
    .panelHeading {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 12px;
    }
    .panelHeading h2 { margin: 0; }
    .annotationMeta { color: var(--muted); font: 600 11px var(--mono); white-space: nowrap; }
    .densityControl {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 2px;
      margin-bottom: 12px;
      padding: 2px;
      border: 1px solid var(--line);
      border-radius: 5px;
      background: #f2f4f7;
    }
    .densityControl button {
      height: 30px;
      padding: 0 9px;
      border: 0;
      border-radius: 3px;
      color: var(--muted-strong);
      background: transparent;
      cursor: pointer;
      font-size: 12px;
    }
    .densityControl button.active {
      color: var(--blue-dark);
      background: #fff;
      box-shadow: 0 1px 2px rgba(16, 24, 40, .16);
      font-weight: 700;
    }
    .toggleGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 10px; }
    .toggleItem { display: flex; align-items: center; gap: 7px; min-width: 0; color: var(--muted-strong); font-size: 12px; }
    .toggleItem input { width: 15px; height: 15px; margin: 0; accent-color: var(--blue); }
    .objectDetail {
      margin-top: 12px;
      padding: 10px;
      min-height: 58px;
      border-left: 3px solid #98a2b3;
      background: #f8fafc;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.55;
    }
    .detailTitle { color: var(--ink); font-size: 13px; font-weight: 700; }
    .detailValue { margin-top: 3px; color: var(--blue-dark); font: 700 12px var(--mono); }
    .detailIds { margin-top: 4px; color: var(--muted); font: 500 11px/1.5 var(--mono); }
    .memberGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; margin-top: 9px; }
    .memberGrid button {
      min-width: 0;
      height: 30px;
      padding: 0 7px;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 4px;
      color: var(--muted-strong);
      background: #fff;
      text-align: left;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 11px;
      cursor: pointer;
    }
    .memberGrid button.selected { border-color: #f79009; color: #9a3412; background: var(--amber-soft); font-weight: 700; }
    .detailActions { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 9px; }
    .detailActions button {
      height: 30px;
      border: 1px solid var(--line);
      border-radius: 4px;
      color: var(--muted-strong);
      background: #fff;
      cursor: pointer;
      font-size: 11px;
    }
    .row { display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 8px; align-items: center; margin: 9px 0; }
    .row label { color: var(--muted); font-size: 12px; }
    select, textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 4px;
      color: var(--ink);
      background: #fff;
    }
    select { height: 34px; padding: 0 28px 0 9px; }
    textarea { min-height: 118px; padding: 9px 10px; resize: vertical; line-height: 1.55; }
    textarea::placeholder { color: #98a2b3; }
    .inspectorFooter {
      padding: 10px 12px 12px;
      border-top: 1px solid var(--line-strong);
      background: #f9fafb;
      box-shadow: 0 -6px 14px rgba(16, 24, 40, .05);
    }
    .saveMeta { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; color: var(--muted); font-size: 11px; }
    .saveState { display: inline-flex; align-items: center; gap: 6px; }
    .primary {
      width: 100%;
      height: 38px;
      border: 1px solid var(--blue-dark);
      border-radius: 4px;
      color: #fff;
      background: var(--blue);
      cursor: pointer;
      font-weight: 700;
    }
    .primary:hover { background: #004eeb; }
    .primary:active { background: var(--blue-dark); }
    .status {
      max-height: 74px;
      margin-top: 8px;
      padding: 7px 8px;
      overflow: auto;
      border-left: 3px solid #98a2b3;
      color: var(--muted-strong);
      background: #fff;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font: 500 10px/1.45 var(--mono);
    }
    .status[data-tone="success"] { border-color: var(--green); color: #05603a; background: var(--green-soft); }
    .status[data-tone="error"] { border-color: var(--red); color: #912018; background: var(--red-soft); }
    .status[data-tone="working"] { border-color: var(--blue); color: var(--blue-dark); background: var(--blue-soft); }
    @media (max-width: 1240px) {
      .app { grid-template-columns: minmax(0, 1fr) 330px; }
      header { grid-template-columns: 205px minmax(0, 1fr) auto; gap: 10px; }
      .toolButton { padding: 0 7px; }
      .rangeControl { grid-template-columns: auto 70px 32px; }
      .rangeControl input { width: 70px; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; animation: none !important; }
    }
  </style>
</head>
<body>
  <div class="app">
    <header>
      <div class="brand">
        <div class="brandMark" aria-hidden="true">PA</div>
        <div class="title"><strong>包装工程审校台</strong><span>Packaging review desk</span></div>
      </div>
      <div class="tabs" id="tabs"></div>
      <div class="viewControls" aria-label="画布视图控制">
        <button class="iconButton" id="zoomOut" type="button" title="缩小" aria-label="缩小">−</button>
        <span class="zoomReadout" id="zoomReadout">80%</span>
        <button class="iconButton" id="zoomIn" type="button" title="放大" aria-label="放大">＋</button>
        <button class="iconButton" id="fit" type="button" title="适配画布" aria-label="适配画布">⊡</button>
      </div>
    </header>

    <main class="work">
      <div class="canvasToolbar" aria-label="蒙版标注工具栏">
        <div class="toolGroup">
          <button class="toolButton active" data-tool="brush" type="button" aria-pressed="true" title="画蒙版"><span class="toolGlyph" aria-hidden="true">✎</span>画蒙版</button>
          <button class="toolButton" data-tool="eraser" type="button" aria-pressed="false" title="擦除蒙版"><span class="toolGlyph" aria-hidden="true">◇</span>擦除</button>
          <button class="toolButton" data-tool="rect" type="button" aria-pressed="false" title="框选区域"><span class="toolGlyph" aria-hidden="true">□</span>框选</button>
          <button class="toolButton" data-tool="point" type="button" aria-pressed="false" title="点选锚点"><span class="toolGlyph" aria-hidden="true">⊙</span>锚点</button>
          <button class="toolButton" data-tool="object" type="button" aria-pressed="false" title="定位工程对象"><span class="toolGlyph" aria-hidden="true">⌖</span>对象</button>
        </div>
        <div class="toolGroup">
          <label class="rangeControl" for="brushSize"><span>笔刷</span><input id="brushSize" type="range" min="6" max="90" value="28"/><output class="rangeValue" id="brushSizeValue">28px</output></label>
          <label class="rangeControl" for="opacity"><span>透明度</span><input id="opacity" type="range" min="20" max="85" value="42"/><output class="rangeValue" id="opacityValue">42%</output></label>
        </div>
        <div class="toolbarSpacer"></div>
        <div class="toolGroup">
          <button class="actionButton" id="undo" type="button" title="撤销上一步">↶ 撤销</button>
          <button class="actionButton danger" id="clear" type="button" title="清空当前蒙版">清空蒙版</button>
        </div>
      </div>
      <div class="workspaceStatus" aria-live="polite">
        <span class="statusItem"><span class="statusDot blue"></span>工具 <span class="statusValue" id="activeToolStatus">画蒙版</span></span>
        <span class="statusItem"><span class="statusDot" id="maskStatusDot"></span>蒙版 <span class="statusValue" id="maskStatus">无</span></span>
        <span class="statusItem"><span class="statusDot amber"></span>绑定 <span class="statusValue" id="selectionStatus">0 对象</span></span>
        <span class="statusItem"><span class="statusDot" id="dirtyStatusDot"></span><span class="statusValue" id="dirtyStatus">已同步</span></span>
      </div>
      <div class="canvasWrap">
        <div class="stage" id="stage">
          <canvas id="imageCanvas"></canvas>
          <canvas id="referenceCanvas"></canvas>
          <canvas id="maskCanvas"></canvas>
        </div>
      </div>
    </main>

    <aside>
      <div class="inspectorHeader">
        <div class="inspectorTitle"><strong>审校检查器</strong><span id="currentCaseStatus">CASE 01</span></div>
        <span class="reviewBadge"><span class="statusDot amber"></span>仅供审校</span>
      </div>
      <div class="inspectorScroll">
        <section class="panel">
          <div class="panelHeading">
            <h2>工程标注</h2>
            <span class="annotationMeta" id="annotationMeta">加载中</span>
          </div>
          <div class="densityControl" aria-label="标注密度">
            <button class="active" data-density="compact" type="button" aria-pressed="true">精简</button>
            <button data-density="full" type="button" aria-pressed="false">逐项</button>
          </div>
          <div class="toggleGrid">
            <label class="toggleItem"><input id="showEdges" type="checkbox"/>边 E</label>
            <label class="toggleItem"><input id="showFaces" type="checkbox"/>面 F</label>
            <label class="toggleItem"><input id="showSpecials" type="checkbox"/>位置 S</label>
            <label class="toggleItem"><input id="showDimensions" type="checkbox" checked/>尺寸 D</label>
            <label class="toggleItem"><input id="showValues" type="checkbox" checked/>显示数值</label>
          </div>
          <div class="objectDetail" id="objectDetail"><div class="detailTitle">尚未定位对象</div><div class="detailIds">使用“对象”工具点选图中标注。</div></div>
        </section>

        <section class="panel">
          <h2>纠错记录</h2>
          <div class="row">
            <label for="issueType">问题类型</label>
            <select id="issueType">
              <option>结构错误</option>
              <option>尺寸错误</option>
              <option>材料/缓冲错误</option>
              <option>排版/文字错误</option>
              <option>默认规则错误</option>
              <option>需要追问用户</option>
            </select>
          </div>
          <div class="row">
            <label for="step">影响步骤</label>
            <select id="step">
              <option>模板选择</option>
              <option>尺寸计算</option>
              <option>缓冲/内衬选择</option>
              <option>刀线展开</option>
              <option>装配示意</option>
              <option>中文图纸表达</option>
              <option>人工复核边界</option>
            </select>
          </div>
          <textarea id="note" aria-label="教师纠错意见" placeholder="写下需要修改的工程事实、正确值或判断条件。"></textarea>
        </section>
      </div>

      <div class="inspectorFooter">
        <div class="saveMeta">
          <span class="saveState"><span class="statusDot amber"></span>审校记录，不启用规则</span>
          <span id="footerSelection">0 个对象</span>
        </div>
        <button id="save" class="primary" type="button">保存蒙版和纠错记录</button>
        <div class="status" id="status" data-tone="neutral">等待标注。</div>
      </div>
    </aside>
  </div>

  <script>
    const cases = CASES_JSON;
    let currentCase = cases[0].id;
    let tool = "brush";
    let zoom = 0.8;
    let drawing = false;
    let start = null;
    let last = null;
    let history = [];
    let overlayManifest = null;
    let overlayMode = "compact";
    let focusedGroupId = null;
    let laidOutLabels = [];
    let isDirty = false;
    let maskHasContent = false;
    const selectedObjectIds = new Set();
    const stage = document.getElementById("stage");
    const imageCanvas = document.getElementById("imageCanvas");
    const referenceCanvas = document.getElementById("referenceCanvas");
    const maskCanvas = document.getElementById("maskCanvas");
    const imageCtx = imageCanvas.getContext("2d");
    const referenceCtx = referenceCanvas.getContext("2d");
    const maskCtx = maskCanvas.getContext("2d");
    const statusEl = document.getElementById("status");
    const objectDetailEl = document.getElementById("objectDetail");
    const annotationMetaEl = document.getElementById("annotationMeta");
    const saveButton = document.getElementById("save");
    const toolNames = { brush: "画蒙版", eraser: "擦除", rect: "框选", point: "锚点", object: "对象" };
    const img = new Image();

    function setStatus(text, tone = "neutral") {
      statusEl.textContent = text;
      statusEl.dataset.tone = tone;
    }

    function setDirty(value) {
      isDirty = Boolean(value);
      document.getElementById("dirtyStatus").textContent = isDirty ? "有未保存修改" : "已同步";
      document.getElementById("dirtyStatusDot").className = "statusDot " + (isDirty ? "red" : "");
    }

    function setMaskStatus(value) {
      maskHasContent = Boolean(value);
      document.getElementById("maskStatus").textContent = maskHasContent ? "已有内容" : "无";
      document.getElementById("maskStatusDot").className = "statusDot " + (maskHasContent ? "red" : "");
    }

    function updateSelectionStatus() {
      const count = selectedObjectIds.size;
      document.getElementById("selectionStatus").textContent = count + " 对象";
      document.getElementById("footerSelection").textContent = count + " 个对象";
    }

    function resizeCanvases(w, h) {
      imageCanvas.width = w; imageCanvas.height = h;
      referenceCanvas.width = w; referenceCanvas.height = h;
      maskCanvas.width = w; maskCanvas.height = h;
      applyZoom();
    }

    function applyZoom() {
      stage.style.transform = "none";
      stage.style.width = Math.round(imageCanvas.width * zoom) + "px";
      stage.style.height = Math.round(imageCanvas.height * zoom) + "px";
      document.getElementById("zoomReadout").textContent = Math.round(zoom * 100) + "%";
    }

    function fitToViewport() {
      const wrap = document.querySelector(".canvasWrap");
      const availableWidth = Math.max(320, wrap.clientWidth - 28);
      const availableHeight = Math.max(240, wrap.clientHeight - 28);
      zoom = Math.max(0.25, Math.min(1, availableWidth / imageCanvas.width, availableHeight / imageCanvas.height));
      applyZoom();
    }

    function renderTabs() {
      const tabs = document.getElementById("tabs");
      tabs.innerHTML = "";
      for (const c of cases) {
        const btn = document.createElement("button");
        btn.textContent = c.label.replace("案例 ", "");
        btn.className = c.id === currentCase ? "active" : "";
        btn.type = "button";
        btn.title = c.label;
        btn.setAttribute("aria-pressed", c.id === currentCase ? "true" : "false");
        btn.onclick = () => loadCase(c.id);
        tabs.appendChild(btn);
      }
    }

    function pushHistory() {
      history.push(maskCanvas.toDataURL("image/png"));
      if (history.length > 25) history.shift();
    }

    function visibleCategory(category) {
      if (category === "edge") return document.getElementById("showEdges").checked;
      if (category === "face") return document.getElementById("showFaces").checked;
      if (category === "special") return document.getElementById("showSpecials").checked;
      if (category === "dimension") return document.getElementById("showDimensions").checked;
      return false;
    }

    function intersects(a, b) {
      return !(a.x + a.w + 3 < b.x || b.x + b.w + 3 < a.x || a.y + a.h + 3 < b.y || b.y + b.h + 3 < a.y);
    }

    function categoryColor(category) {
      if (category === "dimension") return "#175cd3";
      if (category === "edge") return "#b42318";
      if (category === "face") return "#067647";
      return "#7a2e0e";
    }

    function objectIdRange(ids) {
      if (ids.length <= 1) return ids[0] || "";
      const parsed = ids.map(id => /^([A-Z]+)(\d+)$/u.exec(id));
      if (parsed.every(Boolean) && parsed.every(item => item[1] === parsed[0][1])) {
        const numbers = parsed.map(item => Number(item[2]));
        const consecutive = numbers.every((number, index) => index === 0 || number === numbers[index - 1] + 1);
        if (consecutive) return ids[0] + "–" + ids.at(-1);
      }
      return ids.length <= 3 ? ids.join("、") : ids[0] + "…" + ids.at(-1);
    }

    function labelLines(entry) {
      const showValues = document.getElementById("showValues").checked;
      if (entry.kind === "group") {
        const group = entry.group;
        const idText = objectIdRange(group.memberObjectIds);
        const title = group.title + (idText ? "  " + idText : "");
        if (!showValues) return { title, value: group.memberCount > 1 ? group.memberCount + "处关联" : "" };
        const value = group.engineeringValue?.display || "";
        return { title, value: value + (group.memberCount > 1 ? " · " + group.memberCount + "处相同" : "") };
      }
      const label = entry.label;
      return {
        title: label.label + "  " + label.id,
        value: showValues ? (label.engineeringValue?.display || "") : "",
      };
    }

    function chooseLabelRect(anchorPx, lines, occupied, compact = false) {
      referenceCtx.font = "700 13px Microsoft YaHei, sans-serif";
      const titleWidth = referenceCtx.measureText(lines.title).width;
      referenceCtx.font = "700 14px Microsoft YaHei, sans-serif";
      const valueWidth = lines.value ? referenceCtx.measureText(lines.value).width : 0;
      const w = Math.ceil(Math.max(titleWidth, valueWidth)) + 16;
      const h = lines.value ? 39 : 25;
      const [ax, ay] = anchorPx;
      const candidates = [
        [-Math.round(w / 2), -h - 14], [-Math.round(w / 2), 14],
        [13, -Math.round(h / 2)], [-w - 13, -Math.round(h / 2)],
        [13, -h - 12], [13, 12], [-w - 13, -h - 12], [-w - 13, 12],
      ];
      for (let ring = 0; ring < (compact ? 5 : 9); ring += 1) {
        const shift = ring * (h + 5);
        for (const [dx, dy] of candidates) {
          const rect = {
            x: Math.max(4, Math.min(referenceCanvas.width - w - 4, ax + dx)),
            y: Math.max(4, Math.min(referenceCanvas.height - h - 4, ay + dy + (dy < 0 ? -shift : shift))),
            w,
            h,
          };
          if (!occupied.some((item) => intersects(rect, item))) return rect;
        }
      }
      return {
        x: Math.max(4, Math.min(referenceCanvas.width - w - 4, ax + 10)),
        y: Math.max(4, Math.min(referenceCanvas.height - h - 4, ay + 8)),
        w,
        h,
      };
    }

    function renderReferenceOverlay() {
      referenceCtx.clearRect(0, 0, referenceCanvas.width, referenceCanvas.height);
      laidOutLabels = [];
      if (!overlayManifest) return;
      const occupied = [];
      const entries = overlayMode === "compact"
        ? overlayManifest.displayGroups
          .filter(group => visibleCategory(group.category))
          .map(group => ({ kind: "group", group, anchorPx: group.anchorPx }))
        : overlayManifest.labels
          .filter(label => visibleCategory(label.category))
          .map(label => ({ kind: "label", label, anchorPx: label.anchorPx }));
      entries.sort((a, b) => {
        const idsA = a.kind === "group" ? a.group.memberObjectIds : [a.label.id];
        const idsB = b.kind === "group" ? b.group.memberObjectIds : [b.label.id];
        const selectedA = idsA.some(id => selectedObjectIds.has(id));
        const selectedB = idsB.some(id => selectedObjectIds.has(id));
        return Number(selectedB) - Number(selectedA) || idsA[0].localeCompare(idsB[0]);
      });
      for (const entry of entries) {
        const lines = labelLines(entry);
        const rect = chooseLabelRect(entry.anchorPx, lines, occupied, overlayMode === "compact");
        occupied.push(rect);
        const objectIds = entry.kind === "group" ? entry.group.memberObjectIds : [entry.label.id];
        const selectedCount = objectIds.filter(id => selectedObjectIds.has(id)).length;
        const selected = selectedCount > 0;
        const focused = entry.kind === "group" && entry.group.id === focusedGroupId;
        const category = entry.kind === "group" ? entry.group.category : entry.label.category;
        const color = categoryColor(category);
        const [ax, ay] = entry.anchorPx;
        const lineX = Math.max(rect.x, Math.min(rect.x + rect.w, ax));
        const lineY = Math.max(rect.y, Math.min(rect.y + rect.h, ay));
        referenceCtx.save();
        referenceCtx.strokeStyle = selected || focused ? "#f79009" : color;
        referenceCtx.fillStyle = selected || focused ? "#f79009" : color;
        referenceCtx.lineWidth = selected || focused ? 2.5 : 1.4;
        referenceCtx.beginPath();
        referenceCtx.moveTo(ax, ay);
        referenceCtx.lineTo(lineX, lineY);
        referenceCtx.stroke();
        const memberAnchors = entry.kind === "group" ? entry.group.memberAnchors : [{ objectId: entry.label.id, anchorPx: entry.label.anchorPx }];
        for (const member of memberAnchors) {
          const memberSelected = selectedObjectIds.has(member.objectId);
          referenceCtx.beginPath();
          referenceCtx.fillStyle = memberSelected ? "#f79009" : "rgba(255,255,255,0.96)";
          referenceCtx.strokeStyle = memberSelected || focused ? "#f79009" : color;
          referenceCtx.lineWidth = memberSelected || focused ? 2.5 : 1.5;
          referenceCtx.arc(member.anchorPx[0], member.anchorPx[1], memberSelected ? 5 : 3.5, 0, Math.PI * 2);
          referenceCtx.fill();
          referenceCtx.stroke();
        }
        referenceCtx.fillStyle = selected || focused ? "rgba(255,247,237,0.98)" : "rgba(255,255,255,0.96)";
        referenceCtx.strokeStyle = selected || focused ? "#f79009" : color;
        referenceCtx.lineWidth = selected || focused ? 2.5 : 1.4;
        referenceCtx.beginPath();
        referenceCtx.roundRect(rect.x, rect.y, rect.w, rect.h, 4);
        referenceCtx.fill();
        referenceCtx.stroke();
        referenceCtx.fillStyle = "#101828";
        referenceCtx.font = "700 13px Microsoft YaHei, sans-serif";
        referenceCtx.textBaseline = "top";
        referenceCtx.fillText(lines.title, rect.x + 8, rect.y + (lines.value ? 5 : 6));
        if (lines.value) {
          referenceCtx.fillStyle = selected || focused ? "#b54708" : color;
          referenceCtx.font = "700 14px Microsoft YaHei, sans-serif";
          referenceCtx.fillText(lines.value, rect.x + 8, rect.y + 20);
        }
        referenceCtx.restore();
        laidOutLabels.push({ ...entry, rect });
      }

      const focusedGroup = overlayManifest.displayGroups.find(group => group.id === focusedGroupId);
      if (overlayMode === "compact" && focusedGroup && visibleCategory(focusedGroup.category) && focusedGroup.memberCount > 1) {
        for (const member of focusedGroup.memberAnchors) {
          const label = overlayManifest.labels.find(item => item.id === member.objectId);
          if (!label) continue;
          referenceCtx.font = "800 12px Microsoft YaHei, sans-serif";
          const w = Math.ceil(referenceCtx.measureText(label.id).width) + 10;
          const lines = { title: label.id, value: "" };
          const rect = chooseLabelRect(member.anchorPx, lines, occupied, true);
          rect.w = w;
          rect.h = 21;
          occupied.push(rect);
          const selected = selectedObjectIds.has(label.id);
          referenceCtx.save();
          referenceCtx.fillStyle = selected ? "#f79009" : "rgba(255,255,255,0.98)";
          referenceCtx.strokeStyle = "#f79009";
          referenceCtx.lineWidth = selected ? 2.5 : 1.5;
          referenceCtx.beginPath();
          referenceCtx.roundRect(rect.x, rect.y, rect.w, rect.h, 4);
          referenceCtx.fill();
          referenceCtx.stroke();
          referenceCtx.fillStyle = selected ? "#fff" : "#9a3412";
          referenceCtx.textBaseline = "middle";
          referenceCtx.font = "800 12px Microsoft YaHei, sans-serif";
          referenceCtx.fillText(label.id, rect.x + 5, rect.y + rect.h / 2);
          referenceCtx.restore();
          laidOutLabels.push({ kind: "member", label, rect });
        }
      }
      const visibleObjects = overlayManifest.labels.filter(label => visibleCategory(label.category)).length;
      annotationMetaEl.textContent = overlayMode === "compact" ? entries.length + "组 / " + visibleObjects + "对象" : visibleObjects + "项";
      window.__packagingAnnotationDebug = {
        overlayMode,
        visibleObjects,
        focusedGroupId,
        selectedObjectIds: [...selectedObjectIds],
        items: laidOutLabels.map(item => ({
          kind: item.kind,
          id: item.kind === "group" ? item.group.id : item.label.id,
          memberObjectIds: item.kind === "group" ? item.group.memberObjectIds : [item.label.id],
          rect: item.rect,
        })),
      };
      updateSelectionStatus();
    }

    function escapeHtml(value) {
      return String(value || "").replace(/[&<>"']/gu, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
    }

    function renderObjectDetail(label = null) {
      const selected = overlayManifest?.labels.filter(item => selectedObjectIds.has(item.id)) || [];
      const group = overlayManifest?.displayGroups.find(item => item.id === focusedGroupId);
      if (group) {
        const value = group.engineeringValue?.display || "无独立数值";
        const allSelected = group.memberObjectIds.every(id => selectedObjectIds.has(id));
        const members = group.memberObjectIds.map(id => overlayManifest.labels.find(item => item.id === id)).filter(Boolean);
        objectDetailEl.innerHTML =
          '<div class="detailTitle">' + escapeHtml(group.title) + '</div>' +
          '<div class="detailValue">' + escapeHtml(value) + ' · ' + group.memberCount + '处相同</div>' +
          '<div class="detailIds">关联对象：' + escapeHtml(group.memberObjectIds.join("、")) + '</div>' +
          '<div class="memberGrid">' + members.map(member =>
            '<button data-object-id="' + member.id + '" class="' + (selectedObjectIds.has(member.id) ? 'selected' : '') + '" title="' + escapeHtml(member.label) + '">' + member.id + ' · ' + escapeHtml(member.label) + '</button>'
          ).join("") + '</div>' +
          '<div class="detailActions"><button data-group-bind="' + group.id + '">' + (allSelected ? '解除整组' : '绑定整组') + '</button><button data-group-collapse="true">收起成员</button></div>';
        return;
      }
      const focus = label || selected.at(-1);
      if (!focus) {
        objectDetailEl.innerHTML = '<div class="detailTitle">尚未定位对象</div><div class="detailIds">使用“对象定位”点选图中标注。</div>';
        return;
      }
      const value = focus.engineeringValue?.display || "无独立数值";
      const selectedText = selected.length ? selected.map(item => item.id).join("、") : "无";
      objectDetailEl.innerHTML = '<div class="detailTitle">' + focus.id + ' · ' + escapeHtml(focus.label) + '</div><div class="detailValue">' + escapeHtml(value) + '</div><div class="detailIds">已绑定：' + escapeHtml(selectedText) + '</div>';
    }

    function selectObjectAt(point) {
      const hits = laidOutLabels
        .map(item => {
          const target = item.kind === "group" ? item.group : item.label;
          const [ax, ay] = target.anchorPx;
          const inside = point.x >= item.rect.x && point.x <= item.rect.x + item.rect.w && point.y >= item.rect.y && point.y <= item.rect.y + item.rect.h;
          const distance = inside ? 0 : Math.hypot(point.x - ax, point.y - ay);
          return { ...item, distance, priority: item.kind === "member" ? 0 : item.kind === "label" ? 1 : 2 };
        })
        .filter(item => item.distance <= 34)
        .sort((a, b) => a.distance - b.distance || a.priority - b.priority);
      if (!hits.length) {
        setStatus("这里没有可见编号。可以先打开对应的 E / F / S / D 分类。");
        return;
      }
      const hit = hits[0];
      if (hit.kind === "group" && hit.group.memberCount > 1) {
        focusedGroupId = hit.group.id;
        renderReferenceOverlay();
        renderObjectDetail();
        setStatus("已展开“" + hit.group.title + "”：" + hit.group.memberCount + "处关联。请选择单个编号，或明确绑定整组。");
        return;
      }
      const picked = hit.kind === "group"
        ? overlayManifest.labels.find(item => item.id === hit.group.memberObjectIds[0])
        : hit.label;
      if (selectedObjectIds.has(picked.id)) selectedObjectIds.delete(picked.id);
      else selectedObjectIds.add(picked.id);
      renderReferenceOverlay();
      renderObjectDetail(picked);
      setDirty(true);
      setStatus("已绑定对象：" + [...selectedObjectIds].join("、"));
    }

    async function loadCase(id) {
      currentCase = id;
      renderTabs();
      const c = cases.find(x => x.id === id);
      document.getElementById("currentCaseStatus").textContent = c.label.replace("案例 ", "CASE ");
      selectedObjectIds.clear();
      focusedGroupId = null;
      overlayManifest = await fetch("/api/overlay/" + encodeURIComponent(id) + "?t=" + Date.now()).then(res => res.json());
      overlayMode = overlayManifest.displayDefaults?.mode || "compact";
      document.querySelectorAll("[data-density]").forEach(button => {
        const active = button.dataset.density === overlayMode;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      document.getElementById("showEdges").checked = Boolean(overlayManifest.displayDefaults?.edge);
      document.getElementById("showFaces").checked = Boolean(overlayManifest.displayDefaults?.face);
      document.getElementById("showSpecials").checked = Boolean(overlayManifest.displayDefaults?.special);
      document.getElementById("showDimensions").checked = overlayManifest.displayDefaults?.dimension !== false;
      document.getElementById("showValues").checked = overlayManifest.displayDefaults?.engineeringValues !== false;
      img.onload = () => {
        resizeCanvases(img.naturalWidth, img.naturalHeight);
        imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
        imageCtx.drawImage(img, 0, 0);
        renderReferenceOverlay();
        renderObjectDetail();
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        history = [];
        setMaskStatus(false);
        setDirty(false);
        updateSelectionStatus();
        requestAnimationFrame(fitToViewport);
        setStatus("已加载标准底图：" + c.label + "\n精简标注已合并同类工程值；底图未重绘。");
      };
      img.src = "/image/" + encodeURIComponent(id) + "?t=" + Date.now();
    }

    function pos(evt) {
      const rect = maskCanvas.getBoundingClientRect();
      return {
        x: (evt.clientX - rect.left) * (maskCanvas.width / rect.width),
        y: (evt.clientY - rect.top) * (maskCanvas.height / rect.height)
      };
    }

    function drawBrush(a, b, erase = false) {
      const size = Number(document.getElementById("brushSize").value);
      const alpha = Number(document.getElementById("opacity").value) / 100;
      maskCtx.save();
      maskCtx.lineCap = "round";
      maskCtx.lineJoin = "round";
      maskCtx.lineWidth = size;
      if (erase) {
        maskCtx.globalCompositeOperation = "destination-out";
        maskCtx.strokeStyle = "rgba(0,0,0,1)";
      } else {
        maskCtx.globalCompositeOperation = "source-over";
        maskCtx.strokeStyle = "rgba(224, 36, 36, " + alpha + ")";
      }
      maskCtx.beginPath();
      maskCtx.moveTo(a.x, a.y);
      maskCtx.lineTo(b.x, b.y);
      maskCtx.stroke();
      maskCtx.restore();
    }

    function drawRect(a, b) {
      const alpha = Number(document.getElementById("opacity").value) / 100;
      maskCtx.save();
      maskCtx.fillStyle = "rgba(224, 36, 36, " + alpha + ")";
      maskCtx.strokeStyle = "rgba(185, 28, 28, 0.9)";
      maskCtx.lineWidth = 5;
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const w = Math.abs(a.x - b.x);
      const h = Math.abs(a.y - b.y);
      maskCtx.fillRect(x, y, w, h);
      maskCtx.strokeRect(x, y, w, h);
      maskCtx.restore();
    }

    maskCanvas.addEventListener("pointerdown", (evt) => {
      const pointer = pos(evt);
      if (tool === "object") {
        selectObjectAt(pointer);
        return;
      }
      drawing = true;
      maskCanvas.setPointerCapture(evt.pointerId);
      start = pointer;
      last = start;
      pushHistory();
      setDirty(true);
      if (tool === "point") {
        const size = Number(document.getElementById("brushSize").value);
        maskCtx.save();
        maskCtx.fillStyle = "rgba(224, 36, 36, 0.55)";
        maskCtx.beginPath();
        maskCtx.arc(start.x, start.y, size / 1.7, 0, Math.PI * 2);
        maskCtx.fill();
        maskCtx.restore();
        setMaskStatus(true);
      }
    });

    maskCanvas.addEventListener("pointermove", (evt) => {
      if (!drawing) return;
      const p = pos(evt);
      if (tool === "brush") drawBrush(last, p, false);
      if (tool === "eraser") drawBrush(last, p, true);
      if (tool === "brush") setMaskStatus(true);
      last = p;
    });

    maskCanvas.addEventListener("pointerup", (evt) => {
      if (!drawing) return;
      const p = pos(evt);
      if (tool === "rect") {
        drawRect(start, p);
        setMaskStatus(true);
      }
      drawing = false;
      start = null;
      last = null;
    });

    document.querySelectorAll("[data-tool]").forEach(btn => {
      btn.onclick = () => {
        tool = btn.dataset.tool;
        maskCanvas.style.cursor = tool === "object" ? "pointer" : "crosshair";
        document.getElementById("activeToolStatus").textContent = toolNames[tool];
        document.querySelectorAll("[data-tool]").forEach(b => {
          const active = b === btn;
          b.classList.toggle("active", active);
          b.setAttribute("aria-pressed", active ? "true" : "false");
        });
      };
    });

    document.querySelectorAll("[data-density]").forEach(button => {
      button.onclick = () => {
        overlayMode = button.dataset.density;
        focusedGroupId = null;
        document.querySelectorAll("[data-density]").forEach(item => {
          const active = item === button;
          item.classList.toggle("active", active);
          item.setAttribute("aria-pressed", active ? "true" : "false");
        });
        renderReferenceOverlay();
        renderObjectDetail();
        setDirty(true);
        setStatus(overlayMode === "compact" ? "已切换为精简标注：同类同值对象合并显示。" : "已切换为逐项标注：显示每个对象编号。");
      };
    });

    objectDetailEl.addEventListener("click", event => {
      const objectButton = event.target.closest("[data-object-id]");
      if (objectButton) {
        const id = objectButton.dataset.objectId;
        if (selectedObjectIds.has(id)) selectedObjectIds.delete(id);
        else selectedObjectIds.add(id);
        renderReferenceOverlay();
        renderObjectDetail();
        setDirty(true);
        setStatus("已绑定对象：" + ([...selectedObjectIds].join("、") || "无"));
        return;
      }
      const groupButton = event.target.closest("[data-group-bind]");
      if (groupButton) {
        const group = overlayManifest.displayGroups.find(item => item.id === groupButton.dataset.groupBind);
        if (!group) return;
        const allSelected = group.memberObjectIds.every(id => selectedObjectIds.has(id));
        for (const id of group.memberObjectIds) {
          if (allSelected) selectedObjectIds.delete(id);
          else selectedObjectIds.add(id);
        }
        renderReferenceOverlay();
        renderObjectDetail();
        setDirty(true);
        setStatus((allSelected ? "已解除整组：" : "已绑定整组：") + group.memberObjectIds.join("、"));
        return;
      }
      if (event.target.closest("[data-group-collapse]")) {
        focusedGroupId = null;
        renderReferenceOverlay();
        renderObjectDetail();
      }
    });

    ["showEdges", "showFaces", "showSpecials", "showDimensions", "showValues"].forEach(id => {
      document.getElementById(id).addEventListener("change", () => {
        if (focusedGroupId) {
          const group = overlayManifest?.displayGroups.find(item => item.id === focusedGroupId);
          if (group && !visibleCategory(group.category)) focusedGroupId = null;
        }
        renderReferenceOverlay();
        renderObjectDetail();
        setDirty(true);
      });
    });

    document.getElementById("undo").onclick = () => {
      const prev = history.pop();
      if (!prev) return;
      const h = new Image();
      h.onload = () => {
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        maskCtx.drawImage(h, 0, 0);
        setMaskStatus(true);
        setDirty(true);
      };
      h.src = prev;
    };

    document.getElementById("clear").onclick = () => {
      pushHistory();
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      setMaskStatus(false);
      setDirty(true);
      setStatus("已清空当前蒙版；尚未保存。", "working");
    };

    document.getElementById("zoomIn").onclick = () => { zoom = Math.min(1.4, zoom + 0.1); applyZoom(); };
    document.getElementById("zoomOut").onclick = () => { zoom = Math.max(0.25, zoom - 0.1); applyZoom(); };
    document.getElementById("fit").onclick = fitToViewport;
    window.addEventListener("resize", fitToViewport);

    document.getElementById("brushSize").addEventListener("input", event => {
      document.getElementById("brushSizeValue").textContent = event.target.value + "px";
    });
    document.getElementById("opacity").addEventListener("input", event => {
      document.getElementById("opacityValue").textContent = event.target.value + "%";
    });
    ["issueType", "step", "note"].forEach(id => {
      document.getElementById(id).addEventListener(id === "note" ? "input" : "change", () => setDirty(true));
    });

    function maskSummary() {
      const pixels = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
      let minX = maskCanvas.width;
      let minY = maskCanvas.height;
      let maxX = -1;
      let maxY = -1;
      let pixelCount = 0;
      for (let y = 0; y < maskCanvas.height; y += 1) {
        for (let x = 0; x < maskCanvas.width; x += 1) {
          if (pixels[(y * maskCanvas.width + x) * 4 + 3] === 0) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          pixelCount += 1;
        }
      }
      return {
        nonEmpty: pixelCount > 0,
        pixelCount,
        boundsPx: pixelCount > 0 ? [minX, minY, maxX, maxY] : null,
        canvas: { width: maskCanvas.width, height: maskCanvas.height },
      };
    }

    async function save() {
      const composite = document.createElement("canvas");
      composite.width = imageCanvas.width;
      composite.height = imageCanvas.height;
      const ctx = composite.getContext("2d");
      ctx.drawImage(imageCanvas, 0, 0);
      ctx.drawImage(referenceCanvas, 0, 0);
      ctx.drawImage(maskCanvas, 0, 0);
      const currentMaskSummary = maskSummary();
      const payload = {
        caseId: currentCase,
        caseLabel: cases.find(x => x.id === currentCase)?.label,
        issueType: document.getElementById("issueType").value,
        affectedWorkflowStep: document.getElementById("step").value,
        teacherCorrection: document.getElementById("note").value.trim(),
        selectedObjectIds: [...selectedObjectIds],
        overlayDisplayMode: overlayMode,
        focusedDisplayGroupId: focusedGroupId,
        sourceBaseSha256: overlayManifest?.baseImage?.sha256,
        overlaySchema: overlayManifest?.schema,
        maskSummary: currentMaskSummary,
        maskPng: maskCanvas.toDataURL("image/png"),
        annotatedPng: composite.toDataURL("image/png"),
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
      };
      if (!payload.teacherCorrection) {
        setStatus("请先写一句文字纠错，这样我能知道蒙版想表达什么。", "error");
        return;
      }
      setStatus("正在保存审校证据...", "working");
      saveButton.disabled = true;
      saveButton.textContent = "保存中...";
      try {
        const res = await fetch("/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus("保存失败：" + (data.error || res.status), "error");
          return;
        }
        const targets = data.editContract?.target?.objectIds || [];
        const candidates = data.editContract?.target?.candidates?.map(item => item.id) || [];
        const targetLine = targets.length ? "精确目标：" + targets.join("、") : "待确认候选：" + (candidates.join("、") || "无");
        setDirty(false);
        setStatus("已保存：\n" + targetLine + "\n" + data.annotationJson + "\n" + data.annotatedPng, "success");
      } catch (error) {
        setStatus("保存失败：" + error.message, "error");
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = "保存蒙版和纠错记录";
      }
    }

    saveButton.onclick = save;
    renderTabs();
    loadCase(currentCase);
  </script>
</body>
</html>`;

async function handleSave(req, res) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const selected = cases.find((item) => item.id === payload.caseId);
  if (!selected) {
    send(res, 400, { error: "unknown_case" }, { "Content-Type": "application/json; charset=utf-8" });
    return;
  }
  if (payload.sourceBaseSha256 !== selected.baseImageSha256) {
    send(res, 409, { error: "immutable_base_hash_mismatch" }, { "Content-Type": "application/json; charset=utf-8" });
    return;
  }
  const stamp = safeStamp();
  const dir = path.join(SAVE_ROOT, `${stamp}_${payload.caseId}`);
  await fs.mkdir(dir, { recursive: true });
  const maskPng = path.join(dir, "mask.png");
  const annotatedPng = path.join(dir, "annotated.png");
  const annotationJson = path.join(dir, "annotation.json");
  const maskEvidence = payload.maskSummary?.nonEmpty ? {
    path: maskPng,
    boundsPx: payload.maskSummary.boundsPx,
    pixelCount: payload.maskSummary.pixelCount,
    canvas: payload.maskSummary.canvas,
  } : null;
  const editContract = buildEditContract({
    instruction: payload.teacherCorrection,
    catalog: selected.catalog,
    baseImageSha256: selected.baseImageSha256,
    selectedObjectIds: Array.isArray(payload.selectedObjectIds) ? payload.selectedObjectIds : [],
    mask: maskEvidence,
  });
  const jsonPayload = {
    sessionId: "packaging_teaching_session",
    savedAt: new Date().toISOString(),
    caseId: payload.caseId,
    caseLabel: payload.caseLabel,
    sourceImage: selected.image,
    sourceBaseImage: {
      path: selected.image,
      sha256: selected.baseImageSha256,
      immutable: true,
    },
    referenceOverlay: {
      path: selected.overlayFile,
      schema: selected.overlay.schema,
      labelsOnly: true,
      redrawBaseGeometry: false,
    },
    issueType: payload.issueType,
    affectedWorkflowStep: payload.affectedWorkflowStep,
    teacherCorrection: payload.teacherCorrection,
    selectedObjectIds: editContract.target.objectIds,
    overlayDisplayMode: payload.overlayDisplayMode || "compact",
    focusedDisplayGroupId: payload.focusedDisplayGroupId || null,
    editContractDraft: editContract,
    evidence: {
      maskPng,
      annotatedPng,
    },
    draftRule: "",
    requiredEvidenceBeforeEnablement: "teacher review and follow-up run required",
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
  };
  await fs.writeFile(maskPng, dataUrlToBuffer(payload.maskPng));
  await fs.writeFile(annotatedPng, dataUrlToBuffer(payload.annotatedPng));
  await fs.writeFile(annotationJson, stringifyJsonForWindows(jsonPayload), "utf8");
  send(res, 200, { maskPng, annotatedPng, annotationJson, editContract }, { "Content-Type": "application/json; charset=utf-8" });
}

function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${HOST}`);
      if (req.method === "GET" && url.pathname === "/") {
        send(res, 200, html.replace("CASES_JSON", JSON.stringify(cases.map(({ id, label }) => ({ id, label })))), {
          "Content-Type": "text/html; charset=utf-8",
        });
        return;
      }
      if (req.method === "GET" && url.pathname === "/favicon.ico") {
        send(res, 204, "");
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/health") {
        send(res, 200, { ok: true, cases: cases.length }, { "Content-Type": "application/json; charset=utf-8" });
        return;
      }
      if (req.method === "GET" && url.pathname.startsWith("/image/")) {
        const id = decodeURIComponent(url.pathname.slice("/image/".length));
        const selected = cases.find((item) => item.id === id);
        if (!selected) return notFound(res);
        const png = await fs.readFile(selected.image);
        send(res, 200, png, {
          "Content-Type": "image/png",
          "Cache-Control": "no-store",
        });
        return;
      }
      if (req.method === "GET" && url.pathname.startsWith("/api/overlay/")) {
        const id = decodeURIComponent(url.pathname.slice("/api/overlay/".length));
        const selected = cases.find((item) => item.id === id);
        if (!selected) return notFound(res);
        send(res, 200, selected.overlay, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/cases") {
        send(res, 200, {
          cases: cases.map((item) => ({
            id: item.id,
            label: item.label,
            baseImageSha256: item.baseImageSha256,
            overlaySchema: item.overlay?.schema,
            objectCount: item.overlay?.labels?.length || 0,
            displayGroupCount: item.overlay?.displayGroups?.length || 0,
          })),
        }, { "Content-Type": "application/json; charset=utf-8" });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/save") {
        await handleSave(req, res);
        return;
      }
      notFound(res);
    } catch (error) {
      send(res, 500, { error: String(error.stack || error) }, { "Content-Type": "application/json; charset=utf-8" });
    }
  });
}

async function listen(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(port, HOST, () => resolve(server));
  });
}

async function main() {
  await fs.mkdir(SAVE_ROOT, { recursive: true });
  await loadAndVerifyCaseData();
  let server;
  let port = START_PORT;
  for (let i = 0; i < 20; i += 1) {
    try {
      server = await listen(port);
      break;
    } catch (error) {
      if (error.code !== "EADDRINUSE") throw error;
      port += 1;
    }
  }
  if (!server) throw new Error("No available port");
  console.log(`PACKAGING_ANNOTATION_URL=http://${HOST}:${port}/`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
