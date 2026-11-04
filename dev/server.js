/**
 * Local dev server that mirrors how Vercel serves this project:
 * static files from the project root, plus /api/* as functions.
 */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT || 4321);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith("/api/")) {
    const route = pathname.slice(5).replace(/\/$/, "");
    if (!/^[a-z-]+$/.test(route)) {
      res.writeHead(404).end(JSON.stringify({ error: "Not found" }));
      return;
    }
    try {
      const { default: handler } = await import(`../api/${route}.js`);
      await handler(req, res);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  const relative = normalize(pathname === "/" ? "/index.html" : pathname).replace(/^(\.\.[/\\])+/, "");
  const file = join(root, relative);
  if (!file.startsWith(root)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    // Vercel's cleanUrls maps /learn to /learn.html; mirror that locally.
    if (!file.endsWith(".html")) {
      try {
        const body = await readFile(`${file}.html`);
        res.writeHead(200, { "Content-Type": types[".html"] });
        res.end(body);
        return;
      } catch {
        // fall through to 404
      }
    }
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h1>404</h1><p>That page wandered off. <a href='/'>Back to camp</a></p>");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Loop Troop is running at http://localhost:${port}`);
});
