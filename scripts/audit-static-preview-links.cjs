#!/usr/bin/env node
const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function isRelativePreviewUrl(value) {
  return Boolean(value) && !/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith("/") && !value.startsWith("\\");
}

function requestHeadOrGet(url) {
  const client = url.startsWith("https:") ? https : http;
  return new Promise((resolve) => {
    const req = client.request(url, { method: "HEAD" }, (res) => {
      res.resume();
      res.on("end", () => {
        if (res.statusCode === 405) {
          client.get(url, (getRes) => {
            getRes.resume();
            getRes.on("end", () => resolve({ url, statusCode: getRes.statusCode }));
          }).on("error", (error) => resolve({ url, error: error.message }));
        } else {
          resolve({ url, statusCode: res.statusCode });
        }
      });
    });
    req.on("error", (error) => resolve({ url, error: error.message }));
    req.end();
  });
}

function collectLinks(packet) {
  const links = [];
  for (const link of packet.entryLinks || []) {
    links.push({ source: `entryLinks.${link.id || link.label || "unknown"}`, url: link.url, path: link.path });
  }
  for (const stage of packet.stages || []) {
    if (stage.openUrl) links.push({ source: `stages.${stage.id}.openUrl`, url: stage.openUrl, path: stage.openPath });
    if (stage.evidenceUrl && stage.evidenceUrl !== stage.openUrl) {
      links.push({ source: `stages.${stage.id}.evidenceUrl`, url: stage.evidenceUrl, path: stage.evidencePath });
    }
  }
  const seen = new Set();
  return links.filter((link) => {
    const key = `${link.source}|${link.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  const manifestPath = path.resolve(argValue("--manifest", argValue("--center", "")));
  const baseUrl = argValue("--base-url", "http://127.0.0.1:8090/");
  if (!manifestPath) throw new Error("Usage: node scripts/audit-static-preview-links.cjs --manifest <goal-command-center.json> [--base-url http://127.0.0.1:8090/]");
  if (!fs.existsSync(manifestPath)) throw new Error(`Manifest does not exist: ${manifestPath}`);

  const packet = readJson(manifestPath);
  const base = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const links = collectLinks(packet);
  const checks = [];

  for (const link of links) {
    const relative = isRelativePreviewUrl(link.url);
    const result = relative ? await requestHeadOrGet(new URL(link.url, base).toString()) : { statusCode: 0 };
    checks.push({
      source: link.source,
      url: link.url,
      absoluteUrl: relative ? new URL(link.url, base).toString() : "",
      relative,
      statusCode: result.statusCode || 0,
      error: result.error || "",
      pass: relative && result.statusCode === 200
    });
  }

  const failed = checks.filter((check) => !check.pass);
  const audit = {
    ok: failed.length === 0,
    format: "transparent_ai_static_preview_link_audit_v1",
    manifestPath,
    baseUrl: base.toString(),
    checked: checks.length,
    failed: failed.length,
    checks,
    locks: {
      softwareActionsExecuted: false,
      targetSoftwareCommandsExecuted: false,
      screenshotsCaptured: false,
      memoryWritten: false,
      nativeUniversalExecution: false
    }
  };

  console.log(JSON.stringify(audit, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
