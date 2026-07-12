import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = "D:\\Transparent AI Apprentice MCP\\artifacts\\packaging_teaching_session";
const OUT_DIR = path.join(ROOT, "chinese_review_sheets");
const W = 1680;
const H = 945;

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function text(x, y, value, cls = "text", anchor = "start") {
  return `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${esc(value)}</text>`;
}

function line(x1, y1, x2, y2, cls = "cut", extra = "") {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}" ${extra}/>`;
}

function rect(x, y, w, h, cls = "cutFill", extra = "") {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${cls}" ${extra}/>`;
}

function circleNumber(x, y, n, cls = "anchorCircle") {
  return `<g><circle cx="${x}" cy="${y}" r="17" class="${cls}"/><text x="${x}" y="${y + 6}" class="anchorText" text-anchor="middle">${n}</text></g>`;
}

function dimLine(x1, y1, x2, y2, label, offset = 0) {
  const labelX = (x1 + x2) / 2;
  const labelY = (y1 + y2) / 2 + offset;
  return [
    line(x1, y1, x2, y2, "dim", 'marker-start="url(#arrow)" marker-end="url(#arrow)"'),
    text(labelX, labelY, label, "dimText", "middle"),
  ].join("");
}

function table(x, y, title, rows, col1 = 250, col2 = 170) {
  const rowH = 32;
  const width = col1 + col2;
  const height = rowH * (rows.length + 1);
  let s = `<g>${rect(x, y, width, height, "tableBox")}`;
  s += rect(x, y, width, rowH, "tableHead");
  s += text(x + width / 2, y + 23, title, "tableTitle", "middle");
  for (let i = 0; i < rows.length; i += 1) {
    const yy = y + rowH * (i + 1);
    s += line(x, yy, x + width, yy, "tableLine");
    s += line(x + col1, yy, x + col1, yy + rowH, "tableLine");
    s += text(x + 10, yy + 22, rows[i][0], "tableText");
    s += text(x + width - 10, yy + 22, rows[i][1], "tableText", "end");
  }
  s += "</g>";
  return s;
}

function defs() {
  return `
  <defs>
    <marker id="arrow" markerWidth="9" markerHeight="9" refX="4.5" refY="4.5" orient="auto">
      <path d="M0,0 L9,4.5 L0,9 z" fill="#111827"/>
    </marker>
    <pattern id="hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="8" stroke="#9ca3af" stroke-width="2"/>
    </pattern>
    <pattern id="paper" patternUnits="userSpaceOnUse" width="18" height="18">
      <rect width="18" height="18" fill="#f8f1e6"/>
      <path d="M0 8 H18 M8 0 V18" stroke="#ead7bb" stroke-width="0.8"/>
    </pattern>
  </defs>`;
}

function page(title, body) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <style>
    html, body { margin: 0; width: ${W}px; height: ${H}px; background: white; }
    svg { width: ${W}px; height: ${H}px; display: block; font-family: "Microsoft YaHei", "SimHei", "Noto Sans CJK SC", Arial, sans-serif; }
    .title { font-size: 34px; font-weight: 800; fill: #111827; }
    .subtitle { font-size: 21px; fill: #374151; }
    .section { font-size: 22px; font-weight: 800; fill: #111827; }
    .text { font-size: 18px; fill: #111827; }
    .small { font-size: 15px; fill: #374151; }
    .note { font-size: 16px; fill: #1d4ed8; }
    .cut { stroke: #111827; stroke-width: 2.3; fill: none; }
    .cutFill { stroke: #111827; stroke-width: 2.3; fill: #fff; }
    .crease { stroke: #2563eb; stroke-width: 2.1; stroke-dasharray: 9 7; fill: none; }
    .slot { stroke: #dc2626; stroke-width: 3; fill: none; }
    .lock { stroke: #15803d; stroke-width: 2.2; stroke-dasharray: 8 6; fill: none; }
    .glue { stroke: #6b7280; stroke-width: 2; fill: url(#hatch); }
    .dim { stroke: #111827; stroke-width: 1.7; fill: none; }
    .dimText { font-size: 18px; font-weight: 700; fill: #111827; paint-order: stroke; stroke: #fff; stroke-width: 5px; }
    .tableBox { stroke: #111827; stroke-width: 1.5; fill: #fff; }
    .tableHead { stroke: #111827; stroke-width: 1.5; fill: #f3f4f6; }
    .tableLine { stroke: #9ca3af; stroke-width: 1; }
    .tableTitle { font-size: 18px; font-weight: 800; fill: #111827; }
    .tableText { font-size: 16px; fill: #111827; }
    .anchorCircle { fill: #fff; stroke: #2563eb; stroke-width: 2.5; }
    .anchorText { font-size: 18px; font-weight: 800; fill: #1d4ed8; }
    .panelLabel { font-size: 19px; font-weight: 800; fill: #1f2937; }
    .legendBox { stroke: #111827; stroke-width: 1.4; fill: #fff; }
  </style>
  <title>${esc(title)}</title>
</head>
<body>
  <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${defs()}
    ${body}
  </svg>
</body>
</html>`;
}

function drawFefcoDieline({ x, y, scale, length, width, height, glue, flap, blankLabel, panels }) {
  const gx = glue * scale;
  const p = panels.map((v) => v * scale);
  const fh = flap * scale;
  const bh = height * scale;
  const bodyY = y + fh;
  let cur = x;
  let s = "";

  s += rect(cur, bodyY, gx, bh, "glue");
  s += text(cur + gx / 2, bodyY + bh / 2, "搭接舌", "small", "middle");
  s += line(cur + gx, bodyY, cur + gx, bodyY + bh, "crease");
  cur += gx;

  for (let i = 0; i < p.length; i += 1) {
    const pw = p[i];
    s += rect(cur, bodyY, pw, bh, "cutFill");
    s += rect(cur + 6, y + 10, pw - 12, fh - 10, "cutFill", 'rx="8"');
    s += rect(cur + 6, bodyY + bh, pw - 12, fh - 10, "cutFill", 'rx="8"');
    s += line(cur, bodyY, cur + pw, bodyY, "crease");
    s += line(cur, bodyY + bh, cur + pw, bodyY + bh, "crease");
    s += line(cur + pw, bodyY, cur + pw, bodyY + bh, "crease");
    s += text(cur + pw / 2, bodyY + bh / 2 - 8, `面板 ${i + 1}`, "panelLabel", "middle");
    s += text(cur + pw / 2, bodyY + bh / 2 + 22, ["侧面", "正面", "侧面", "背面"][i] || "", "text", "middle");
    if (i > 0) {
      s += line(cur, y + fh - 8, cur + 16, y + fh + 16, "cut");
      s += line(cur, bodyY + bh + 8, cur + 16, bodyY + bh - 16, "cut");
    }
    s += `<rect x="${cur + pw / 2 - 28}" y="${y + fh / 2 - 4}" width="56" height="8" rx="4" class="slot"/>`;
    s += `<rect x="${cur + pw / 2 - 28}" y="${bodyY + bh + fh / 2 - 4}" width="56" height="8" rx="4" class="slot"/>`;
    cur += pw;
  }

  const totalW = glue * scale + p.reduce((a, b) => a + b, 0);
  const totalH = (flap * 2 + height) * scale;
  s += dimLine(x, y + totalH + 42, x + totalW, y + totalH + 42, blankLabel);
  s += dimLine(x - 32, y, x - 32, y + totalH, `${width} mm`, 6);
  s += circleNumber(x + gx / 2, bodyY + bh / 2 - 60, 3);
  s += circleNumber(x + gx + p[0] + p[1] / 2, y + 22, 5);
  s += circleNumber(x + gx + p[0] + p[1] + p[2] / 2, bodyY + bh + fh / 2, 6);
  s += circleNumber(x + totalW - p[3] / 2, y + fh / 2, 7);
  s += circleNumber(x + totalW / 2, y + totalH + 76, 8);
  s += text(x, y - 18, "展开刀线图（示意，尺寸以 DXF 为准）", "section");
  return s;
}

function case01() {
  let s = "";
  s += text(30, 42, "案例 01：电子设备运输外箱", "title");
  s += text(30, 75, "FEFCO 0201 普通开槽瓦楞箱｜中文批注版", "subtitle");
  s += table(30, 105, "工程摘要", [
    ["产品尺寸（长 x 宽 x 高）", "380 x 280 x 200 mm"],
    ["产品重量", "15 kg"],
    ["纸箱内尺寸", "428 x 328 x 248 mm"],
    ["制造外尺寸", "435 x 335 x 262 mm"],
    ["纸板", "双瓦楞 BC，7 mm"],
    ["缓冲", "EPE（珍珠棉），约 19 mm"],
    ["搭接舌", "35 mm"],
    ["摇盖深度", "167.5 mm"],
    ["展开下料", "1575 x 597 mm"],
  ], 260, 210);

  s += drawFefcoDieline({
    x: 75,
    y: 455,
    scale: 0.6,
    length: 1575,
    width: 597,
    height: 262,
    glue: 35,
    flap: 167.5,
    blankLabel: "展开总长 1575 mm",
    panels: [335, 435, 335, 435],
  });

  s += text(700, 112, "成箱尺寸示意", "section");
  s += `<g transform="translate(710 145)">
    <path d="M70 40 L250 92 L250 250 L70 200 Z" fill="#fff" stroke="#111827" stroke-width="2"/>
    <path d="M70 40 L180 0 L360 52 L250 92 Z" fill="#f9fafb" stroke="#111827" stroke-width="2"/>
    <path d="M250 92 L360 52 L360 210 L250 250 Z" fill="#f3f4f6" stroke="#111827" stroke-width="2"/>
    ${dimLine(70, 230, 250, 280, "435", 24)}
    ${dimLine(270, 260, 385, 220, "335", 22)}
    ${dimLine(382, 55, 382, 210, "262", 6)}
  </g>`;

  s += text(1160, 60, "爆炸装配示意（供批注）", "section");
  s += `<g transform="translate(1180 95)">
    <rect x="90" y="15" width="240" height="66" fill="#e5e7eb" stroke="#111827" stroke-width="2"/>
    <rect x="130" y="125" width="60" height="100" fill="#f3f4f6" stroke="#6b7280" stroke-width="1.8"/>
    <rect x="230" y="125" width="60" height="100" fill="#f3f4f6" stroke="#6b7280" stroke-width="1.8"/>
    <rect x="90" y="180" width="240" height="38" fill="#f3f4f6" stroke="#6b7280" stroke-width="1.8"/>
    <path d="M70 310 L340 310 L390 355 L120 355 Z" fill="#d9a45f" stroke="#111827" stroke-width="2"/>
    <path d="M120 355 L390 355 L390 505 L120 505 Z" fill="#c58c46" stroke="#111827" stroke-width="2"/>
    ${circleNumber(25, 48, 1)} ${text(50, 54, "产品放置与取放间隙", "text")}
    ${circleNumber(25, 170, 2)} ${text(50, 176, "EPE 缓冲：四角 / 围框 / 上下垫需确认", "text")}
    ${circleNumber(25, 330, 4)} ${text(50, 336, "外箱结构：FEFCO 0201", "text")}
  </g>`;

  s += rect(1160, 720, 470, 170, "legendBox", 'rx="8"');
  s += text(1185, 750, "纠错锚点", "section");
  [
    "1 产品间隙/取放空间",
    "2 缓冲形式与厚度",
    "3 搭接舌",
    "4 纸箱结构",
    "5 面板顺序",
    "6 压线/折线",
    "7 开槽/切口",
    "8 展开尺寸",
  ].forEach((v, i) => { s += text(1185 + (i > 3 ? 230 : 0), 782 + (i % 4) * 28, v, "text"); });
  return page("CASE 01 中文包装图纸", s);
}

function case02() {
  let s = "";
  s += text(30, 42, "案例 02：小型零售自锁底纸盒", "title");
  s += text(30, 75, "自锁底折叠纸盒｜中文批注版", "subtitle");

  const x = 130;
  const y = 250;
  const sc = 1.9;
  const glue = 35 * sc;
  const panels = [188, 58, 188, 58].map((v) => v * sc);
  const top = 38 * sc;
  const body = 58 * sc;
  const bottom = 38 * sc;
  const bodyY = y + top;
  const totalW = glue + panels.reduce((a, b) => a + b, 0);
  let cur = x;

  s += text(x, y - 35, "展开刀线图（自锁底示意，需教师确认真实锁底刀模）", "section");
  s += rect(cur, bodyY, glue, body, "glue");
  s += text(cur + glue / 2, bodyY + body / 2, "糊口", "panelLabel", "middle");
  s += line(cur + glue, bodyY, cur + glue, bodyY + body, "crease");
  cur += glue;
  for (let i = 0; i < panels.length; i += 1) {
    const pw = panels[i];
    s += rect(cur, bodyY, pw, body, "cutFill");
    s += line(cur, bodyY, cur + pw, bodyY, "crease");
    s += line(cur, bodyY + body, cur + pw, bodyY + body, "crease");
    s += line(cur + pw, bodyY, cur + pw, bodyY + body, "crease");
    s += text(cur + pw / 2, bodyY + body / 2 - 8, `面板 ${i + 1}`, "panelLabel", "middle");
    s += text(cur + pw / 2, bodyY + body / 2 + 22, ["正面", "右侧", "背面", "左侧"][i], "text", "middle");
    if (i === 2) {
      s += `<path d="M${cur + 10} ${y + top} L${cur + 20} ${y + 25} L${cur + pw - 20} ${y + 25} L${cur + pw - 10} ${y + top} Z" class="cutFill"/>`;
      s += text(cur + pw / 2, y + 65, "上插舌 38 mm", "text", "middle");
    } else if (i === 1 || i === 3) {
      s += `<path d="M${cur + 10} ${y + top} L${cur + 20} ${y + 52} L${cur + pw - 20} ${y + 52} L${cur + pw - 10} ${y + top} Z" class="cutFill"/>`;
      s += text(cur + pw / 2, y + 78, "防尘翼", "small", "middle");
    }
    const by = bodyY + body;
    if (i === 0 || i === 2) {
      s += `<path d="M${cur} ${by} L${cur + pw * 0.45} ${by + bottom} L${cur + pw} ${by}" class="cut"/>`;
      s += line(cur + pw * 0.15, by, cur + pw * 0.8, by + bottom, "lock");
    } else {
      s += `<path d="M${cur} ${by} L${cur + pw * 0.35} ${by + bottom} L${cur + pw} ${by + bottom} L${cur + pw} ${by} Z" class="cutFill"/>`;
      s += line(cur, by, cur + pw, by + bottom, "lock");
    }
    cur += pw;
  }
  s += dimLine(x, y + top + body + bottom + 52, x + totalW, y + top + body + bottom + 52, "展开总长 527 mm");
  s += dimLine(x - 35, y, x - 35, y + top + body + bottom, "134 mm", 6);
  s += circleNumber(x + glue / 2, bodyY + 25, 1);
  s += circleNumber(x + glue + panels[0] + panels[1] + panels[2] / 2, y + 35, 3);
  s += circleNumber(x + glue + panels[0] + panels[1] / 2, y + 65, 4);
  s += circleNumber(x + totalW - panels[3] / 2, bodyY + body + bottom / 2, 5);
  s += circleNumber(x + glue + panels[0] + panels[1] + panels[2] * 0.55, bodyY + body + 55, 6);
  s += circleNumber(x + glue + panels[0] + panels[1] + panels[2] * 0.78, bodyY + body + 75, 7);
  s += circleNumber(x + totalW / 2, y + top + body + bottom + 86, 8);

  s += table(1250, 110, "工程摘要", [
    ["产品尺寸", "180 x 50 x 50 mm"],
    ["产品重量", "0.35 kg"],
    ["纸盒内尺寸", "188 x 58 x 58 mm"],
    ["纸板厚度", "3 mm"],
    ["搭接舌", "35 mm"],
    ["上插舌深度", "38 mm"],
    ["自锁底深度", "38 mm"],
    ["锁底重叠", "9 mm"],
    ["展开下料", "527 x 134 mm"],
  ], 210, 160);

  s += rect(1260, 470, 330, 250, "legendBox", 'rx="8"');
  s += text(1290, 505, "成型示意", "section");
  s += `<g transform="translate(1315 535)">
    <path d="M60 30 L165 55 L165 190 L60 165 Z" fill="#fff" stroke="#111827" stroke-width="2"/>
    <path d="M60 30 L120 5 L225 30 L165 55 Z" fill="#f9fafb" stroke="#111827" stroke-width="2"/>
    <path d="M165 55 L225 30 L225 165 L165 190 Z" fill="#f3f4f6" stroke="#111827" stroke-width="2"/>
    <path d="M65 165 L118 205 L165 190" class="lock"/>
    <text x="120" y="230" class="small" text-anchor="middle">底部锁合方向需复核</text>
  </g>`;

  s += rect(40, 760, 1090, 110, "legendBox", 'rx="8"');
  s += text(65, 792, "图例：黑色=裁切线；蓝色虚线=压痕/折线；绿色虚线=自锁底斜压线；灰色斜纹=糊口区", "text");
  s += text(65, 827, "重点请纠错：纸板类型、锁底形态、插舌/防尘翼比例、糊盒方向、承重边界。", "note");
  return page("CASE 02 中文包装图纸", s);
}

function case03() {
  let s = "";
  s += text(30, 42, "案例 03：12 入集合运输箱", "title");
  s += text(30, 75, "FEFCO 0201 普通开槽瓦楞箱｜中文批注版", "subtitle");
  s += table(30, 105, "工程摘要", [
    ["单个零售内盒尺寸", "188 x 58 x 58 mm"],
    ["装箱数量", "12 入（3 x 2 x 2）"],
    ["内盒间隙", "3 mm"],
    ["预装箱包络", "570 x 119 x 119 mm"],
    ["运输箱内尺寸", "618 x 167 x 167 mm"],
    ["制造外尺寸", "625 x 174 x 181 mm"],
    ["纸板", "双瓦楞 BC，7 mm"],
    ["缓冲", "EPE（珍珠棉），约 19 mm"],
    ["搭接舌", "40 mm"],
    ["摇盖深度", "87 mm"],
    ["展开下料", "1638 x 355 mm"],
  ], 245, 210);

  s += drawFefcoDieline({
    x: 80,
    y: 540,
    scale: 0.53,
    length: 1638,
    width: 355,
    height: 181,
    glue: 40,
    flap: 87,
    blankLabel: "展开总长 1638 mm",
    panels: [174, 625, 174, 625],
  });

  s += text(1010, 45, "装箱排布示意（需优先纠错）", "section");
  s += rect(1010, 70, 615, 410, "legendBox", 'rx="8"');
  s += text(1035, 105, "俯视：每层 3 x 2", "text");
  const bx = 1040;
  const by = 125;
  s += rect(bx, by, 420, 170, "cutFill");
  s += rect(bx + 18, by + 18, 384, 134, "cutFill", 'fill="url(#paper)"');
  for (let r = 0; r < 2; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      s += rect(bx + 34 + c * 118, by + 32 + r * 58, 110, 50, "cutFill", 'fill="#f4d7a1"');
    }
  }
  s += dimLine(bx + 18, by + 168, bx + 402, by + 168, "内长 618 mm");
  s += dimLine(bx + 430, by + 18, bx + 430, by + 152, "内宽 167 mm", 6);
  s += text(1035, 335, "正视：2 层高度", "text");
  s += rect(1040, 355, 420, 90, "cutFill");
  for (let c = 0; c < 3; c += 1) {
    for (let r = 0; r < 2; r += 1) {
      s += rect(1070 + c * 118, 370 + r * 30, 110, 26, "cutFill", 'fill="#f4d7a1"');
    }
  }
  s += text(1495, 105, "图例", "section");
  s += rect(1495, 130, 100, 32, "cutFill", 'fill="#f4d7a1"');
  s += text(1495, 185, "零售内盒", "text");
  s += rect(1495, 215, 100, 32, "cutFill", 'fill="url(#paper)"');
  s += text(1495, 270, "缓冲/隔板区域", "text");
  s += text(1495, 322, "注意：集合箱默认不一定要", "small");
  s += text(1495, 345, "六面 19 mm EPE。", "small");

  s += rect(1010, 510, 615, 330, "legendBox", 'rx="8"');
  s += text(1035, 545, "纠错锚点", "section");
  [
    "1 装箱排布：3 x 2 x 2 是否合理",
    "2 缓冲/隔板：是否过度使用 EPE",
    "3 搭接舌：40 mm 是否合适",
    "4 摇盖深度：87 mm",
    "5 面板顺序与开箱方向",
    "6 开槽宽度与封箱位置",
    "7 抗压/堆码复核点",
    "8 展开尺寸：1638 x 355 mm",
  ].forEach((v, i) => { s += text(1040 + (i > 3 ? 285 : 0), 585 + (i % 4) * 42, v, "text"); });
  s += text(1035, 775, "重点请纠错：集合外箱要先判断内盒是否已有保护性，", "note");
  s += text(1035, 808, "再决定隔板、天地垫、围框或缓冲材料。", "note");
  return page("CASE 03 中文包装图纸", s);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const cases = [
    ["case_01_transport_box_chinese_review", case01()],
    ["case_02_auto_lock_carton_chinese_review", case02()],
    ["case_03_master_carton_12pack_chinese_review", case03()],
  ];
  const bundledBrowser = "D:\\ms-playwright\\chromium_headless_shell-1228\\chrome-headless-shell-win64\\chrome-headless-shell.exe";
  const launchOptions = {};
  try {
    await fs.access(bundledBrowser);
    launchOptions.executablePath = bundledBrowser;
  } catch {
    // Fall back to Playwright's default lookup when the bundled browser is not present.
  }
  const browser = await chromium.launch({ headless: true, ...launchOptions });
  try {
    for (const [name, html] of cases) {
      const htmlPath = path.join(OUT_DIR, `${name}.html`);
      const pngPath = path.join(OUT_DIR, `${name}.png`);
      await fs.writeFile(htmlPath, html, "utf8");
      const pageHandle = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      await pageHandle.setContent(html, { waitUntil: "load" });
      await pageHandle.screenshot({ path: pngPath, fullPage: false });
      await pageHandle.close();
      console.log(`${pngPath}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
