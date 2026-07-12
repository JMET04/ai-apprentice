#!/usr/bin/env node
const http = require("http");
const fs = require("fs");
const path = require("path");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const root = path.resolve(argValue("--root", process.cwd()));
const port = Number(argValue("--port", "8090"));
const host = argValue("--host", "127.0.0.1");
const indexFile = argValue("--index", "index.html");

if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  console.error(`Static preview root does not exist or is not a directory: ${root}`);
  process.exit(1);
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

const server = http.createServer((req, res) => {
  try {
    const requested = decodeURIComponent((req.url || "/").split("?")[0]);
    const relative = requested === "/" || requested === "" ? `/${indexFile}` : requested;
    const filePath = path.resolve(root, `.${relative}`);
    const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

    if (filePath !== root && !filePath.startsWith(rootWithSep)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream"
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(error && error.message ? error.message : String(error));
  }
});

server.listen(port, host, () => {
  console.log(`Static preview serving ${root} at http://${host}:${port}/`);
});
