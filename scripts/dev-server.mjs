#!/usr/bin/env node
// Zero-dependency static file server for local development. Serves the repo
// root so ES module imports in main.js (e.g. "./src/tools/...") resolve the
// same way on disk as they do over HTTP. WebMCP's
// document.modelContext requires a secure context; http://localhost counts
// as one, so this is all local development needs -- no HTTPS/cert setup.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = normalize(join(here, ".."));
const port = Number(process.env.PORT) || 8787;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";

    const filePath = normalize(join(root, pathname));
    if (!filePath.startsWith(root)) {
      res.writeHead(403).end("forbidden");
      return;
    }

    const st = await stat(filePath).catch(() => null);
    if (!st || !st.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("not found: " + pathname);
      return;
    }

    const body = await readFile(filePath);
    const type = MIME[extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type }).end(body);
  } catch (ex) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end(String(ex?.stack ?? ex));
  }
});

server.listen(port, () => {
  console.log(`tableread dev server: http://localhost:${port}/`);
});
