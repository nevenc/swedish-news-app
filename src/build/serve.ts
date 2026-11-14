import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

/** Minimal static file server for local preview of the generated site. */
export function serveStatic(root: string, port: number): Promise<number> {
  const server = createServer(async (req, res) => {
    const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
    let rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
    if (rel.endsWith("/")) rel += "index.html";
    let abs = join(root, rel);
    try {
      let s = await stat(abs);
      if (s.isDirectory()) {
        abs = join(abs, "index.html");
        s = await stat(abs);
      }
      res.writeHead(200, {
        "content-type": TYPES[extname(abs)] ?? "application/octet-stream",
        "content-length": s.size,
        "access-control-allow-origin": "*",
        "cache-control": "no-cache",
      });
      createReadStream(abs).pipe(res);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
    }
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(port));
  });
}
