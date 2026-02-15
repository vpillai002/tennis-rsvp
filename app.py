from __future__ import annotations

import os
import secrets
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Dict

from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "events.db"

app = Flask(__name__, static_folder=".", static_url_path="")
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "tennis123"
TOKENS: Dict[str, datetime] = {}


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                date TEXT NOT NULL,
                location TEXT,
                notes TEXT,
                color TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS rsvps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT NOT NULL,
                name TEXT NOT NULL,
                choice TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(event_id, name),
                FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
            )
            """
        )


def row_to_event(row: sqlite3.Row, responses: Dict[str, str]) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "date": row["date"],
        "location": row["location"],
        "notes": row["notes"],
        "color": row["color"],
        "responses": responses,
    }


def require_admin() -> bool:
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        return False
    return token in TOKENS


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(force=True)
    username = data.get("username")
    password = data.get("password")
    if username != ADMIN_USERNAME or password != ADMIN_PASSWORD:
        return jsonify({"error": "Invalid password"}), 401
    token = secrets.token_urlsafe(24)
    TOKENS[token] = datetime.utcnow()
    return jsonify({"token": token})


@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/api/events", methods=["GET"])
def get_events():
    init_db()
    with get_db() as conn:
        events = conn.execute("SELECT * FROM events").fetchall()
        rsvp_rows = conn.execute("SELECT event_id, name, choice FROM rsvps").fetchall()

    responses_map: Dict[str, Dict[str, str]] = {}
    for row in rsvp_rows:
        responses_map.setdefault(row["event_id"], {})[row["name"]] = row["choice"]

    payload = [row_to_event(row, responses_map.get(row["id"], {})) for row in events]
    return jsonify(payload)


@app.route("/api/events", methods=["POST"])
def create_event():
    init_db()
    if not require_admin():
        return jsonify({"error": "Unauthorized"}), 401
    data = request.get_json(force=True)
    required = ["id", "title", "date"]
    for key in required:
        if not data.get(key):
            return jsonify({"error": f"Missing {key}"}), 400

    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO events (id, title, date, location, notes, color)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                data["id"],
                data["title"],
                data["date"],
                data.get("location"),
                data.get("notes"),
                data.get("color"),
            ),
        )

    return jsonify({"status": "ok"})


@app.route("/api/events/<event_id>", methods=["PUT"])
def update_event(event_id: str):
    init_db()
    if not require_admin():
        return jsonify({"error": "Unauthorized"}), 401
    data = request.get_json(force=True)
    with get_db() as conn:
        conn.execute(
            """
            UPDATE events
            SET title = ?, date = ?, location = ?, notes = ?, color = ?
            WHERE id = ?
            """,
            (
                data.get("title"),
                data.get("date"),
                data.get("location"),
                data.get("notes"),
                data.get("color"),
                event_id,
            ),
        )

    return jsonify({"status": "ok"})


@app.route("/api/events/<event_id>", methods=["DELETE"])
def delete_event(event_id: str):
    init_db()
    if not require_admin():
        return jsonify({"error": "Unauthorized"}), 401
    with get_db() as conn:
        conn.execute("DELETE FROM events WHERE id = ?", (event_id,))
    return jsonify({"status": "ok"})


@app.route("/api/events/<event_id>/rsvp", methods=["POST"])
def rsvp_event(event_id: str):
    init_db()
    data = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    choice = data.get("choice")
    if not name or choice not in {"yes", "maybe", "no"}:
        return jsonify({"error": "Invalid RSVP"}), 400

    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO rsvps (event_id, name, choice, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(event_id, name)
            DO UPDATE SET choice = excluded.choice, updated_at = excluded.updated_at
            """,
            (event_id, name, choice, datetime.utcnow().isoformat()),
        )

    return jsonify({"status": "ok"})


if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)
