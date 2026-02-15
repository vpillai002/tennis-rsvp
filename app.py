from __future__ import annotations

import os
import secrets
from datetime import datetime
from pathlib import Path
from typing import Dict

import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = Path(__file__).parent
DB_URL = os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")

app = Flask(__name__, static_folder=".", static_url_path="")
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "tennis123"
TOKENS: Dict[str, datetime] = {}


def get_db() -> psycopg2.extensions.connection:
    if not DB_URL:
        raise RuntimeError("SUPABASE_DB_URL is not set")
    url = DB_URL
    if "sslmode=" not in url:
        separator = "&" if "?" in url else "?"
        url = f"{url}{separator}sslmode=require"
    return psycopg2.connect(url, cursor_factory=RealDictCursor)


def init_db() -> None:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
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
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS rsvps (
                    id SERIAL PRIMARY KEY,
                    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    choice TEXT NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL,
                    UNIQUE(event_id, name)
                )
                """
            )


def row_to_event(row: Dict[str, str], responses: Dict[str, str]) -> dict:
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
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM events")
            events = cur.fetchall()
            cur.execute("SELECT event_id, name, choice FROM rsvps")
            rsvp_rows = cur.fetchall()

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
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO events (id, title, date, location, notes, color)
                VALUES (%s, %s, %s, %s, %s, %s)
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
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE events
                SET title = %s, date = %s, location = %s, notes = %s, color = %s
                WHERE id = %s
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
        with conn.cursor() as cur:
            cur.execute("DELETE FROM events WHERE id = %s", (event_id,))
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
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO rsvps (event_id, name, choice, updated_at)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (event_id, name)
                DO UPDATE SET choice = EXCLUDED.choice, updated_at = EXCLUDED.updated_at
                """,
                (event_id, name, choice, datetime.utcnow().isoformat()),
            )

    return jsonify({"status": "ok"})


if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)
