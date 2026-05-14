"""Serve the built AgentLabs app with API proxy to the real backend."""
import http.server
import urllib.request
import json
import os
import sys
import mimetypes

PORT = 3005
BACKEND = "http://127.0.0.1:8101"
ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, "..", "dist")

mimetypes.init()

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/"):
            return self._proxy("GET")
        return self._serve_static()

    def do_POST(self):
        if self.path.startswith("/api/"):
            return self._proxy("POST")

    def _serve_static(self):
        # SPA: for non-file routes serve index.html
        path = self.path.split("?")[0].split("#")[0]
        if path == "/":
            path = "/index.html"
        # Check if it's a known SPA route
        spa_routes = {"/reports", "/exports", "/rl-lab", "/agent-hardening"}
        if path in spa_routes:
            path = "/index.html"

        filepath = DIST + path
        if not os.path.isfile(filepath):
            filepath = DIST + "/index.html"

        ext = os.path.splitext(filepath)[1]
        ctype = mimetypes.guess_type(filepath)[0] or "application/octet-stream"

        try:
            with open(filepath, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not found")

    def _proxy(self, method):
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len) if content_len > 0 else b"{}"
        url = BACKEND + self.path
        req = urllib.request.Request(url, data=body, method=method)
        req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                data = resp.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(data)
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def log_message(self, fmt, *args):
        print(f"  [{self.command}] {self.path} -> {args[0] if args else ''}")

if __name__ == "__main__":
    print(f"=== AgentLabs Server ===")
    print(f"Frontend (built): http://127.0.0.1:{PORT}")
    print(f"API proxy -> {BACKEND}")
    print(f"Serving dist/ from: {DIST}")
    srv = http.server.HTTPServer(("127.0.0.1", PORT), Handler)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down")
