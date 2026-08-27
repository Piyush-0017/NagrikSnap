"""
NagrikSnap Database - SQLite persistence layer.

Replaces the prototype's JSON-file storage with a real, reliable SQLite database.
Tables:
  - users      (citizen + admin accounts)
  - complaints (reported issues)
  - reviews    (feedback after resolution)

Existing JSON data (complaints.json / reviews.json / users.json) is migrated
automatically on first run so nothing is lost.
"""

import sqlite3
import os
import json
import threading

DB_PATH = os.path.join(os.path.dirname(__file__), "nagriksnap.db")
_JSON_COMPLAINTS = os.path.join(os.path.dirname(__file__), "complaints.json")
_JSON_REVIEWS = os.path.join(os.path.dirname(__file__), "reviews.json")
_JSON_USERS = os.path.join(os.path.dirname(__file__), "users.json")

# sqlite3 connections are not thread-safe; guard access with a lock.
_lock = threading.Lock()


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db():
    """Create tables if they don't exist and migrate legacy JSON data."""
    with _lock:
        conn = _connect()
        try:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id            TEXT PRIMARY KEY,
                    name          TEXT NOT NULL,
                    username      TEXT,
                    phone         TEXT NOT NULL,
                    password_hash TEXT,
                    role          TEXT NOT NULL DEFAULT 'citizen',
                    department    TEXT DEFAULT '',
                    address       TEXT DEFAULT '',
                    lat           REAL,
                    lng           REAL,
                    created_at    TEXT,
                    updated_at    TEXT,
                    last_login    TEXT
                );

                CREATE TABLE IF NOT EXISTS complaints (
                    id                 TEXT PRIMARY KEY,
                    description        TEXT NOT NULL,
                    phone              TEXT NOT NULL,
                    address            TEXT,
                    lat                REAL,
                    lng                REAL,
                    department         TEXT DEFAULT '',
                    priority           TEXT DEFAULT 'Medium',
                    status             TEXT DEFAULT 'Pending',
                    photo              TEXT,
                    created_at         TEXT,
                    assigned_admin     TEXT,
                    assigned_admin_id  TEXT,
                    assigned_admin_name TEXT,
                    email              TEXT DEFAULT ''
                );

                CREATE TABLE IF NOT EXISTS messages (
                    id            TEXT PRIMARY KEY,
                    recipient_phone TEXT NOT NULL,
                    recipient_email TEXT DEFAULT '',
                    complaint_id  TEXT,
                    subject       TEXT NOT NULL,
                    body          TEXT NOT NULL,
                    channel       TEXT NOT NULL DEFAULT 'inbox',
                    is_read       INTEGER NOT NULL DEFAULT 0,
                    created_at    TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS reviews (
                    id            TEXT PRIMARY KEY,
                    complaint_id  TEXT NOT NULL,
                    rating        INTEGER NOT NULL,
                    comment       TEXT DEFAULT '',
                    name          TEXT DEFAULT 'Citizen',
                    phone         TEXT DEFAULT '',
                    department    TEXT DEFAULT '',
                    created_at    TEXT
                );

                CREATE INDEX IF NOT EXISTS idx_complaints_phone   ON complaints(phone);
                CREATE INDEX IF NOT EXISTS idx_complaints_status  ON complaints(status);
                CREATE INDEX IF NOT EXISTS idx_complaints_dept    ON complaints(department);
                CREATE INDEX IF NOT EXISTS idx_users_phone        ON users(phone);
                CREATE INDEX IF NOT EXISTS idx_reviews_complaint  ON reviews(complaint_id);
                """
            )
            # Forward-compatible migration for existing SQLite databases.
            try:
                conn.execute("ALTER TABLE complaints ADD COLUMN email TEXT DEFAULT ''")
                conn.commit()
            except sqlite3.OperationalError:
                pass
        finally:
            conn.close()

    _migrate_json()


def _migrate_json():
    """Import legacy JSON files into the DB (best-effort, once)."""
    with _lock:
        conn = _connect()
        try:
            # Complaints
            if os.path.exists(_JSON_COMPLAINTS):
                try:
                    with open(_JSON_COMPLAINTS, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    if isinstance(data, list):
                        for c in data:
                            conn.execute(
                                "INSERT OR IGNORE INTO complaints "
                                "(id, description, phone, email, address, lat, lng, department, priority, status, photo, created_at, assigned_admin, assigned_admin_id, assigned_admin_name) "
                                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                                (
                                    c.get("id") or c.get("tracking_id"),
                                    c.get("description", ""),
                                    str(c.get("phone", "")),
                                    c.get("email", ""),
                                    c.get("address"),
                                    c.get("lat"),
                                    c.get("lng"),
                                    c.get("department", ""),
                                    c.get("priority", "Medium"),
                                    c.get("status", "Pending"),
                                    c.get("photo"),
                                    c.get("createdAt"),
                                    json.dumps(c.get("assigned_admin")) if c.get("assigned_admin") else None,
                                    c.get("assigned_admin_id"),
                                    c.get("assigned_admin_name"),
                                ),
                            )
                        conn.commit()
                        # Rename so we don't re-import on next boot
                        os.rename(_JSON_COMPLAINTS, _JSON_COMPLAINTS + ".migrated")
                except Exception as e:
                    print("[DB] complaints migration warning:", e)

            # Reviews
            if os.path.exists(_JSON_REVIEWS):
                try:
                    with open(_JSON_REVIEWS, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    if isinstance(data, list):
                        for r in data:
                            conn.execute(
                                "INSERT OR IGNORE INTO reviews "
                                "(id, complaint_id, rating, comment, name, phone, department, created_at) "
                                "VALUES (?,?,?,?,?,?,?,?)",
                                (
                                    r.get("id"),
                                    r.get("complaint_id"),
                                    int(r.get("rating", 0)),
                                    r.get("comment", ""),
                                    r.get("name", "Citizen"),
                                    str(r.get("phone", "")),
                                    r.get("department", ""),
                                    r.get("created_at"),
                                ),
                            )
                        conn.commit()
                        os.rename(_JSON_REVIEWS, _JSON_REVIEWS + ".migrated")
                except Exception as e:
                    print("[DB] reviews migration warning:", e)

            # Users
            if os.path.exists(_JSON_USERS):
                try:
                    with open(_JSON_USERS, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    if isinstance(data, list):
                        for u in data:
                            conn.execute(
                                "INSERT OR IGNORE INTO users "
                                "(id, name, username, phone, password_hash, role, department, address, lat, lng, created_at, updated_at, last_login) "
                                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                                (
                                    u.get("id"),
                                    u.get("name"),
                                    u.get("username"),
                                    str(u.get("phone", "")),
                                    u.get("password_hash"),
                                    u.get("role", "citizen"),
                                    u.get("department", ""),
                                    u.get("address", ""),
                                    u.get("lat"),
                                    u.get("lng"),
                                    u.get("created_at") or u.get("createdAt"),
                                    u.get("updated_at"),
                                    u.get("lastLogin") or u.get("last_login"),
                                ),
                            )
                        conn.commit()
                        os.rename(_JSON_USERS, _JSON_USERS + ".migrated")
                except Exception as e:
                    print("[DB] users migration warning:", e)
        finally:
            conn.close()


# ===================== USERS =====================
def get_users():
    with _lock:
        conn = _connect()
        try:
            rows = conn.execute("SELECT * FROM users").fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()


def get_user_by_phone(phone, role=None):
    with _lock:
        conn = _connect()
        try:
            if role:
                row = conn.execute(
                    "SELECT * FROM users WHERE phone=? AND role=?", (phone, role)
                ).fetchone()
            else:
                row = conn.execute(
                    "SELECT * FROM users WHERE phone=?", (phone,)
                ).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()


def get_user_by_id(user_id):
    with _lock:
        conn = _connect()
        try:
            row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()


def add_user(user: dict):
    with _lock:
        conn = _connect()
        try:
            conn.execute(
                "INSERT INTO users "
                "(id, name, username, phone, password_hash, role, department, address, lat, lng, created_at, updated_at, last_login) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    user.get("id"),
                    user.get("name"),
                    user.get("username"),
                    str(user.get("phone", "")),
                    user.get("password_hash"),
                    user.get("role", "citizen"),
                    user.get("department", ""),
                    user.get("address", ""),
                    user.get("lat"),
                    user.get("lng"),
                    user.get("created_at"),
                    user.get("updated_at"),
                    user.get("last_login"),
                ),
            )
            conn.commit()
        finally:
            conn.close()


def update_user(user_id, fields: dict):
    """Update a user row with the given fields (whitelist keys only)."""
    allowed = {"name", "username", "phone", "password_hash", "department",
               "address", "lat", "lng", "updated_at", "last_login"}
    keys = [k for k in fields if k in allowed and fields[k] is not None]
    if not keys:
        return
    set_clause = ", ".join(f"{k}=?" for k in keys)
    values = [fields[k] for k in keys] + [user_id]
    with _lock:
        conn = _connect()
        try:
            conn.execute(f"UPDATE users SET {set_clause} WHERE id=?", values)
            conn.commit()
        finally:
            conn.close()


# ===================== COMPLAINTS =====================
def get_complaints(filters=None, search=None, page=1, per_page=50):
    """Return (items, total). filters: {status, priority, department}."""
    filters = filters or {}
    where = []
    params = []

    if filters.get("status"):
        where.append("status=?")
        params.append(filters["status"])
    if filters.get("priority"):
        where.append("priority=?")
        params.append(filters["priority"])
    if filters.get("department"):
        where.append("LOWER(department) LIKE ?")
        params.append("%" + filters["department"].lower() + "%")
    if search:
        like = "%" + search.lower() + "%"
        where.append(
            "(LOWER(id) LIKE ? OR phone LIKE ? OR LOWER(description) LIKE ? OR LOWER(COALESCE(address,'')) LIKE ?)"
        )
        params.extend([like, like, like, like])

    where_sql = (" WHERE " + " AND ".join(where)) if where else ""

    with _lock:
        conn = _connect()
        try:
            total = conn.execute(
                f"SELECT COUNT(*) AS c FROM complaints{where_sql}", params
            ).fetchone()["c"]

            page = max(1, page)
            per_page = max(1, min(100, per_page))
            offset = (page - 1) * per_page
            rows = conn.execute(
                f"SELECT * FROM complaints{where_sql} ORDER BY created_at DESC LIMIT ? OFFSET ?",
                params + [per_page, offset],
            ).fetchall()
            items = [dict(r) for r in rows]
            return items, total
        finally:
            conn.close()


def get_complaint_by_id(tracking_id):
    with _lock:
        conn = _connect()
        try:
            row = conn.execute(
                "SELECT * FROM complaints WHERE id=?", (tracking_id,)
            ).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()


def add_complaint(c: dict):
    with _lock:
        conn = _connect()
        try:
            conn.execute(
                "INSERT INTO complaints "
                "(id, description, phone, email, address, lat, lng, department, priority, status, photo, created_at, assigned_admin, assigned_admin_id, assigned_admin_name) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    c.get("id"),
                    c.get("description", ""),
                    str(c.get("phone", "")),
                    c.get("email", ""),
                    c.get("address"),
                    c.get("lat"),
                    c.get("lng"),
                    c.get("department", ""),
                    c.get("priority", "Medium"),
                    c.get("status", "Pending"),
                    c.get("photo"),
                    c.get("createdAt"),
                    json.dumps(c.get("assigned_admin")) if c.get("assigned_admin") else None,
                    c.get("assigned_admin_id"),
                    c.get("assigned_admin_name"),
                ),
            )
            conn.commit()
        finally:
            conn.close()


def update_complaint_status(tracking_id, status):
    with _lock:
        conn = _connect()
        try:
            conn.execute(
                "UPDATE complaints SET status=? WHERE id=?", (status, tracking_id)
            )
            conn.commit()
        finally:
            conn.close()


def analytics():
    """Aggregate counts for the admin dashboard."""
    with _lock:
        conn = _connect()
        try:
            total = conn.execute("SELECT COUNT(*) c FROM complaints").fetchone()["c"]
            by_status = {r["status"]: r["c"] for r in
                         conn.execute("SELECT status, COUNT(*) c FROM complaints GROUP BY status")}
            by_priority = {r["priority"]: r["c"] for r in
                           conn.execute("SELECT priority, COUNT(*) c FROM complaints GROUP BY priority")}
            by_department = {r["department"]: r["c"] for r in
                             conn.execute("SELECT department, COUNT(*) c FROM complaints GROUP BY department")}
            resolved = by_status.get("Resolved", 0)
            high_unresolved = conn.execute(
                "SELECT COUNT(*) c FROM complaints WHERE priority='High' AND status!='Resolved'"
            ).fetchone()["c"]
            return {
                "total": total,
                "by_status": by_status,
                "by_priority": by_priority,
                "by_department": by_department,
                "resolved_rate": round((resolved / total) * 100, 2) if total else 0,
                "high_unresolved": high_unresolved,
            }
        finally:
            conn.close()


# ===================== MESSAGES =====================
def add_message(message: dict):
    with _lock:
        conn = _connect()
        try:
            conn.execute("INSERT INTO messages (id, recipient_phone, recipient_email, complaint_id, subject, body, channel, is_read, created_at) VALUES (?,?,?,?,?,?,?,?,?)", (
                message.get("id"), str(message.get("recipient_phone", "")), message.get("recipient_email", ""), message.get("complaint_id"), message.get("subject", ""), message.get("body", ""), message.get("channel", "inbox"), int(message.get("is_read", 0)), message.get("created_at")
            ))
            conn.commit()
        finally:
            conn.close()


def get_messages(phone: str, unread_only=False):
    with _lock:
        conn = _connect()
        try:
            sql = "SELECT * FROM messages WHERE recipient_phone=?"
            params = [phone]
            if unread_only:
                sql += " AND is_read=0"
            rows = conn.execute(sql + " ORDER BY created_at DESC", params).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()


def mark_message_read(message_id: str, phone: str):
    with _lock:
        conn = _connect()
        try:
            conn.execute("UPDATE messages SET is_read=1 WHERE id=? AND recipient_phone=?", (message_id, phone))
            conn.commit()
        finally:
            conn.close()


# ===================== REVIEWS =====================
def get_reviews():
    with _lock:
        conn = _connect()
        try:
            rows = conn.execute(
                "SELECT * FROM reviews ORDER BY created_at DESC"
            ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()


def get_review_by_complaint(complaint_id):
    with _lock:
        conn = _connect()
        try:
            row = conn.execute(
                "SELECT * FROM reviews WHERE complaint_id=?", (complaint_id,)
            ).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()


def add_review(r: dict):
    with _lock:
        conn = _connect()
        try:
            conn.execute(
                "INSERT INTO reviews "
                "(id, complaint_id, rating, comment, name, phone, department, created_at) "
                "VALUES (?,?,?,?,?,?,?,?)",
                (
                    r.get("id"),
                    r.get("complaint_id"),
                    int(r.get("rating", 0)),
                    r.get("comment", ""),
                    r.get("name", "Citizen"),
                    str(r.get("phone", "")),
                    r.get("department", ""),
                    r.get("created_at"),
                ),
            )
            conn.commit()
        finally:
            conn.close()


# Initialize the database on import.
init_db()
