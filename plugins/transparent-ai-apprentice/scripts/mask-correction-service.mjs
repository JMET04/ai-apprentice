#!/usr/bin/env node
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getMaskCorrection,
  listMaskCorrections,
  recordMaskCorrectionResult,
  retryMaskCorrection,
  reviewMaskCorrection,
  submitMaskCorrection
} from "./mask-correction-store.mjs";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(request, maximumBytes = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    request.on("data", chunk => {
      bytes += chunk.length;
      if (bytes > maximumBytes) {
        reject(new Error("Request body exceeds 5 MB."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function send(response, status, value) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  response.end(`${JSON.stringify(value, null, 2)}\n`);
}

export function startMaskCorrectionService({ host = "127.0.0.1", port = 4317, storePath = "" } = {}) {
  const server = createServer(async (request, response) => {
    if (request.method === "OPTIONS") return send(response, 204, {});
    const url = new URL(request.url || "/", `http://${host}:${port}`);
    const parts = url.pathname.split("/").filter(Boolean);
    try {
      if (request.method === "GET" && url.pathname === "/health") {
        return send(response, 200, { status: "ok", service: "ai_apprentice_mask_corrections_v1" });
      }
      if (parts[0] !== "api" || parts[1] !== "mask-corrections") return send(response, 404, { error: "Not found." });
      if (request.method === "GET" && parts.length === 2) {
        return send(response, 200, listMaskCorrections({ storePath, status: url.searchParams.get("status") || "" }));
      }
      if (request.method === "POST" && parts.length === 2) {
        const body = await readJson(request);
        const packet = body.packet ?? body;
        return send(response, 201, submitMaskCorrection({ packet, metadata: body.metadata ?? {}, storePath }));
      }
      const id = decodeURIComponent(parts[2] || "");
      if (request.method === "GET" && parts.length === 3) {
        const record = getMaskCorrection({ id, storePath });
        return record ? send(response, 200, record) : send(response, 404, { error: "Mask correction not found." });
      }
      if (request.method === "POST" && parts[3] === "review") {
        const body = await readJson(request);
        return send(response, 200, reviewMaskCorrection({ id, ...body, storePath }));
      }
      if (request.method === "POST" && parts[3] === "retry") {
        const body = await readJson(request);
        return send(response, 200, retryMaskCorrection({ id, ...body, storePath }));
      }
      if (request.method === "POST" && parts[3] === "result") {
        const body = await readJson(request);
        return send(response, 200, recordMaskCorrectionResult({ id, ...body, storePath }));
      }
      return send(response, 404, { error: "Not found." });
    } catch (error) {
      return send(response, /not found/i.test(error.message) ? 404 : 400, { error: error.message });
    }
  });
  server.listen(port, host, () => {
    const actualPort = server.address()?.port ?? port;
    process.stdout.write(`${JSON.stringify({
      status: "listening",
      service: "ai_apprentice_mask_corrections_v1",
      endpoint: `http://${host}:${actualPort}/api/mask-corrections`,
      storePath: storePath || null
    })}\n`);
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startMaskCorrectionService({
    host: argValue("--host", "127.0.0.1"),
    port: Number(argValue("--port", "4317")),
    storePath: argValue("--store")
  });
}
