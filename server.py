"""
Lightweight inventory capture server.

Serves the scanning web app and stores scan submissions in SQLite so that the
inventory state can be reviewed later.
"""

from __future__ import annotations

import json
import mimetypes
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterable, Tuple
from urllib.parse import parse_qs
from wsgiref.simple_server import make_server

BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "inventory.db"
EMPLOYEE_FILE = DATA_DIR / "employees.json"

CONTENT_TYPES = {
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".html": "text/html",
    ".svg": "image/svg+xml",
}


def ensure_database() -> None:
    """Create the scans table if it does not exist yet."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS scans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                employee TEXT NOT NULL,
                qr_data TEXT,
                barcode_data TEXT,
                extra JSON
            )
            """
        )
        conn.commit()


def load_employees() -> list[str]:
    """Return the list of employees with graceful fallback."""
    if not EMPLOYEE_FILE.exists():
        return []
    with EMPLOYEE_FILE.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def read_body(environ) -> bytes:
    try:
        length = int(environ.get("CONTENT_LENGTH") or 0)
    except (ValueError, TypeError):
        length = 0
    body = environ["wsgi.input"].read(length) if length else b""
    return body


def json_response(start_response: Callable, status: str, payload: dict, code: str = "200 OK") -> Iterable[bytes]:
    body = json.dumps(payload).encode("utf-8")
    headers = [("Content-Type", "application/json; charset=utf-8"), ("Content-Length", str(len(body)))]
    start_response(code, headers)
    return [body]


def serve_file(start_response: Callable, path: Path) -> Iterable[bytes]:
    if not path.exists() or not path.is_file():
        start_response("404 Not Found", [("Content-Type", "text/plain")])
        return [b"Not Found"]

    ext = path.suffix.lower()
    content_type = CONTENT_TYPES.get(ext) or mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    body = path.read_bytes()
    headers = [
        ("Content-Type", f"{content_type}; charset=utf-8" if content_type.startswith("text/") else content_type),
        ("Content-Length", str(len(body))),
        ("Cache-Control", "no-store"),
    ]
    start_response("200 OK", headers)
    return [body]


def handle_scan_submission(start_response: Callable, environ) -> Iterable[bytes]:
    body = read_body(environ)
    if not body:
        return json_response(start_response, "error", {"error": "Empty request body"}, "400 Bad Request")
    try:
        payload = json.loads(body.decode("utf-8"))
    except json.JSONDecodeError:
        return json_response(start_response, "error", {"error": "Invalid JSON"}, "400 Bad Request")

    employee = (payload.get("employee") or "").strip()
    if not employee:
        return json_response(start_response, "error", {"error": "Employee is required"}, "400 Bad Request")

    qr_data = payload.get("qrData")
    barcode_data = payload.get("barcodeData")
    extra = {k: v for k, v in payload.items() if k not in {"employee", "qrData", "barcodeData"}}
    timestamp = datetime.now(timezone.utc).isoformat()

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "INSERT INTO scans (created_at, employee, qr_data, barcode_data, extra) VALUES (?, ?, ?, ?, ?)",
            (timestamp, employee, qr_data, barcode_data, json.dumps(extra)),
        )
        conn.commit()

    return json_response(start_response, "ok", {"status": "stored"})


def handle_scan_list(start_response: Callable, environ) -> Iterable[bytes]:
    query = parse_qs(environ.get("QUERY_STRING", ""))
    employee_filter = query.get("employee", [None])[0]

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        if employee_filter:
            cursor.execute(
                "SELECT created_at, employee, qr_data, barcode_data, extra FROM scans WHERE employee = ? ORDER BY created_at DESC",
                (employee_filter,),
            )
        else:
            cursor.execute(
                "SELECT created_at, employee, qr_data, barcode_data, extra FROM scans ORDER BY created_at DESC"
            )
        rows = cursor.fetchall()

    items = []
    for row in rows:
        record = {
            "timestamp": row["created_at"],
            "employee": row["employee"],
            "qrData": row["qr_data"],
            "barcodeData": row["barcode_data"],
        }
        if row["extra"]:
            try:
                record["extra"] = json.loads(row["extra"])
            except json.JSONDecodeError:
                record["extra"] = row["extra"]
        items.append(record)

    return json_response(start_response, "ok", {"items": items})


def application(environ, start_response):
    path = environ.get("PATH_INFO") or "/"
    method = environ.get("REQUEST_METHOD", "GET").upper()

    if path == "/" and method == "GET":
        return serve_file(start_response, PUBLIC_DIR / "index.html")

    if path == "/favicon.ico" and method == "GET":
        start_response("204 No Content", [("Cache-Control", "no-store")])
        return [b""]

    if path == "/api/users" and method == "GET":
        employees = load_employees()
        return json_response(start_response, "ok", {"employees": employees})

    if path == "/api/scan" and method == "POST":
        return handle_scan_submission(start_response, environ)

    if path == "/api/scans" and method == "GET":
        return handle_scan_list(start_response, environ)

    if path.startswith("/") and method == "GET":
        target = (PUBLIC_DIR / path.lstrip("/")).resolve()
        base = PUBLIC_DIR.resolve()
        if target.exists() and str(target).startswith(str(base)):
            return serve_file(start_response, target)

    start_response("404 Not Found", [("Content-Type", "text/plain")])
    return [b"Not Found"]


def main() -> None:
    ensure_database()
    port = int(os.environ.get("PORT", "8000"))
    print(f"Serving on http://127.0.0.1:{port}")
    with make_server("0.0.0.0", port, application) as httpd:
        httpd.serve_forever()


if __name__ == "__main__":
    main()
