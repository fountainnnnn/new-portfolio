"""Simple server: serves static files and proxies API calls."""
import http.server
import urllib.request
import json
import os, sys

PORT = 3004
BACKEND = "http://127.0.0.1:8101"
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), "..", "public")

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/"):
            return self._proxy("GET")
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/"):
            return self._proxy("POST")

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
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def translate_path(self, path):
        # Serve from public/ directory
        if path == "/" or path == "":
            path = "/report-test.html"
        rel = path.lstrip("/")
        full = os.path.join(PUBLIC_DIR, rel)
        print(f"  GET {path} -> {full}")
        if os.path.isfile(full):
            return full
        # Fallback to report-test.html for SPA-like behavior
        return os.path.join(PUBLIC_DIR, "report-test.html")

if __name__ == "__main__":
    print(f"Serving on http://127.0.0.1:{PORT}")
    print(f"API proxy -> {BACKEND}")
    srv = http.server.HTTPServer(("127.0.0.1", PORT), Handler)
    srv.serve_forever()
