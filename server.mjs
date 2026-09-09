import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = 4173;

const MIME_TYPES = {
  ".html": "text/html; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".js": "application/javascript; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml"
};

const server = http.createServer((req, res) => {
  const [rawPath, query = ""] = req.url.split("?", 2);
  let reqPath = decodeURIComponent(rawPath);

  // Match Cloudflare Pages: .html URLs redirect to their extensionless canonical URL.
  if (reqPath.endsWith(".html") && reqPath !== "/404.html") {
    const canonicalPath = reqPath === "/index.html" ? "/" : reqPath.slice(0, -5);
    const location = query ? `${canonicalPath}?${query}` : canonicalPath;
    res.writeHead(308, { Location: location });
    res.end();
    return;
  }

  if (reqPath === "/") reqPath = "/index.html";

  const filePath = path.resolve(PUBLIC_DIR, "." + reqPath);

  // public/ の外に出るパス（../ など）は配信しない
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=UTF-8" });
    res.end("403 Forbidden");
    return;
  }

  const serveFile = candidatePath => {
    const ext = path.extname(candidatePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(candidatePath).pipe(res);
  };

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      serveFile(filePath);
      return;
    }

    // Match Cloudflare Pages: extensionless article URLs serve the matching HTML file.
    const htmlPath = path.extname(filePath) ? null : filePath + ".html";
    if (htmlPath) {
      fs.stat(htmlPath, (htmlErr, htmlStats) => {
        if (!htmlErr && htmlStats.isFile()) {
          serveFile(htmlPath);
          return;
        }

        sendNotFound();
      });
      return;
    }

    sendNotFound();

    function sendNotFound() {
      res.writeHead(404, { "Content-Type": "text/html; charset=UTF-8" });
      const notFoundPath = path.join(PUBLIC_DIR, "404.html");
      if (fs.existsSync(notFoundPath)) {
        res.end(fs.readFileSync(notFoundPath));
      } else {
        res.end("<h1>404 Not Found</h1>");
      }
    }
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Server running at http://127.0.0.1:${PORT}/`);
});
