import os

from werkzeug.middleware.dispatcher import DispatcherMiddleware
from werkzeug.wrappers import Response

from application import app as flask_app


base_path = os.getenv("APP_BASE_PATH", "").rstrip("/")
app = (
    DispatcherMiddleware(Response("Not found", status=404), {base_path: flask_app})
    if base_path
    else flask_app
)

if __name__ == "__main__":
    from werkzeug.serving import run_simple

    port = int(os.environ.get("PORT", 5000))
    if base_path:
        run_simple("0.0.0.0", port, app, use_debugger=flask_app.config.get("DEBUG", False))
    else:
        flask_app.run(host="0.0.0.0", port=port, debug=flask_app.config.get("DEBUG", False))

