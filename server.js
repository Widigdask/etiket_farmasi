const http = require("http");
const fs = require("fs");
const path = require("path");

const host = "127.0.0.1";
const port = Number(process.env.PORT) || 8000;
const root = __dirname;
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

http
  .createServer((request, response) => {
    let urlPath;

    try {
      urlPath = decodeURIComponent(request.url.split("?")[0]);
    } catch {
      response.writeHead(400);
      response.end("Bad request");
      return;
    }

    const requestedPath = urlPath === "/" ? "/index.html" : urlPath;
    const filePath = path.resolve(root, "." + requestedPath);
    if (!filePath.startsWith(root + path.sep)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    fs.stat(filePath, (error, stats) => {
      if (error || !stats.isFile()) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      const contentType =
        contentTypes[path.extname(filePath).toLowerCase()] ||
        "application/octet-stream";
      response.writeHead(200, { "Content-Type": contentType });
      fs.createReadStream(filePath).pipe(response);
    });
  })
  .listen(port, host, () => {
    console.log(`EtiketFarmasi tersedia di http://localhost:${port}/index.html`);
  });
