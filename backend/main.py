"""
NagrikSnap Backend - FastAPI
AI-Powered Citizen Grievance System
with real Fast2SMS + Login System
"""

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import uvicorn
import os
import uuid
from datetime import datetime, timedelta
import json
import requests
import hashlib
import secrets
import time

# SQLite persistence layer (replaces JSON files)
import database as db

# Optional: Groq AI
try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = FastAPI(
    title="NagrikSnap API",
    description="AI-Powered Citizen Grievance System with SMS + Auth",
    version="1.2"
)

# Configurable CORS origins (default: local dev frontend)
_ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _ALLOWED_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
DB_FILE = "complaints.json"
REVIEWS_FILE = "reviews.json"
USERS_FILE = "users.json"

# ===== Simple Auth Store =====
# Default admin: username=admin, password=nagriksnap123
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD_HASH = hashlib.sha256(
    os.getenv("ADMIN_PASSWORD", "nagriksnap123").encode()
).hexdigest()

# In-memory tokens (for prototype). Production should use Redis/JWT properly.
active_tokens = {}  # token -> {username, role, expires}




def load_reviews():
    return db.get_reviews()


def save_reviews(data):
    # No-op: reviews are persisted via db.add_review; kept for compatibility.
    pass




def haversine_km(lat1, lon1, lat2, lon2):
    """Distance between two GPS points in km"""
    from math import radians, sin, cos, sqrt, atan2
    try:
        lat1, lon1, lat2, lon2 = map(float, (lat1, lon1, lat2, lon2))
    except (TypeError, ValueError):
        return None
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def find_nearest_admin(lat, lng, department: str = ""):
    """Pick nearest registered admin (prefer same department)."""
    users = load_users()
    admins = [u for u in users if u.get("role") == "admin" and u.get("lat") and u.get("lng")]
    if not admins:
        return None
    scored = []
    for a in admins:
        dist = haversine_km(lat, lng, a.get("lat"), a.get("lng"))
        if dist is None:
            continue
        # Prefer same department with a distance bonus
        same_dept = 0 if (department and a.get("department") and department.lower() in str(a.get("department")).lower()) else 50
        scored.append((dist + same_dept, dist, a))
    if not scored:
        return None
    scored.sort(key=lambda x: x[0])
    best = scored[0]
    return {
        "admin_id": best[2].get("id"),
        "admin_name": best[2].get("name"),
        "admin_phone": best[2].get("phone"),
        "admin_department": best[2].get("department"),
        "distance_km": round(best[1], 2),
    }


def load_db():
    items, _ = db.get_complaints(per_page=100000)
    return items


def save_db(data):
    # No-op: complaints are persisted via db.add_complaint / update_complaint_status.
    pass


def load_users():
    return db.get_users()


def save_users(data):
    # No-op: users are persisted via db.add_user / update_user.
    pass


# ===== Auth Helpers =====
def create_token(username: str, role: str) -> str:
    token = secrets.token_urlsafe(32)
    active_tokens[token] = {
        "username": username,
        "role": role,
        "expires": time.time() + 86400 * 7,  # 7 days
    }
    return token


def verify_token(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.replace("Bearer ", "").strip()
    data = active_tokens.get(token)
    if not data or data["expires"] < time.time():
        raise HTTPException(status_code=401, detail="Token expired or invalid")
    return data


def require_admin(user=Depends(verify_token)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def hash_password(password: str) -> str:
    """Hash a password with salt for secure storage."""
    if not password:
        return ""
    salt = secrets.token_hex(8)
    return f"sha256${salt}${hashlib.sha256((salt + password).encode()).hexdigest()}"


def verify_password(password: str, stored: str) -> bool:
    """Verify a plaintext password against a stored hash (supports legacy plaintext)."""
    if not stored:
        return False
    if stored.startswith("sha256$"):
        try:
            _, salt, digest = stored.split("$", 2)
            return hashlib.sha256((salt + password).encode()).hexdigest() == digest
        except ValueError:
            return False
    # Legacy plaintext / plain sha256 fallback
    if stored.startswith("plain$"):
        return stored[6:] == password
    return hashlib.sha256(password.encode()).hexdigest() == stored


# Simple in-memory rate limiter for OTP (per phone, per window)
_RATE_LIMITS = {}  # key -> [timestamps]


def rate_limit(key: str, limit: int, window_seconds: int) -> bool:
    """Return True if allowed, False if rate limited."""
    now = time.time()
    hits = [t for t in _RATE_LIMITS.get(key, []) if now - t < window_seconds]
    if len(hits) >= limit:
        _RATE_LIMITS[key] = hits + [now]
        return False
    hits.append(now)
    _RATE_LIMITS[key] = hits
    return True


# ===== Fast2SMS =====
def send_email(to: str, subject: str, html: str) -> dict:
    api_key = os.getenv("RESEND_API_KEY")
    sender = os.getenv("RESEND_FROM", "NagrikSnap <onboarding@resend.dev>")
    if not to:
        return {"success": False, "message": "Email not provided"}
    if not api_key:
        print("[EMAIL] RESEND_API_KEY not configured. Email skipped (demo mode).")
        return {"success": False, "message": "Email provider not configured", "demo": True}
    try:
        response = requests.post("https://api.resend.com/emails", headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, json={"from": sender, "to": [to], "subject": subject, "html": html}, timeout=15)
        response.raise_for_status()
        return {"success": True, "id": response.json().get("id")}
    except Exception as e:
        print(f"[EMAIL] Error: {e}")
        return {"success": False, "message": "Email delivery failed"}


def store_message(phone, subject, body, complaint_id=None, email="", channel="inbox"):
    db.add_message({"id": str(uuid.uuid4()), "recipient_phone": phone, "recipient_email": email, "complaint_id": complaint_id, "subject": subject, "body": body, "channel": channel, "created_at": datetime.now().isoformat()})


def send_sms(phone: str, message: str) -> dict:
    api_key = os.getenv("FAST2SMS_API_KEY")
    if not api_key:
        print("[SMS] No FAST2SMS_API_KEY found. SMS skipped (demo mode).")
        return {"success": False, "message": "API key not configured", "demo": True}

    phone_clean = "".join(filter(str.isdigit, phone))[-10:]
    if len(phone_clean) != 10:
        return {"success": False, "message": "Invalid phone number"}

    url = "https://www.fast2sms.com/dev/bulkV2"
    payload = {
        "route": "q",
        "message": message,
        "language": "english",
        "numbers": phone_clean,
    }
    headers = {
        "authorization": api_key,
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
    }
    try:
        response = requests.post(url, data=payload, headers=headers, timeout=15)
        result = response.json()
        print(f"[SMS] Sent to {phone_clean}: {result}")
        return {
            "success": result.get("return", False),
            "message": result.get("message", ["Unknown"]),
            "request_id": result.get("request_id"),
        }
    except Exception as e:
        print(f"[SMS] Error: {e}")
        return {"success": False, "message": str(e)}


# ===== AI Classification =====
def classify_with_ai(text: str) -> dict:
    lower = text.lower()
    department = "General Administration"
    priority = "Medium"

    if any(w in lower for w in ["pothole", "road", "गड्ढा", "सड़क", "footpath"]):
        department = "Public Works / Roads"
    elif any(w in lower for w in ["garbage", "rubbish", "waste", "कचरा", "कूड़ा", "bin"]):
        department = "Sanitation / Waste Management"
    elif any(w in lower for w in ["water", "pipe", "leak", "पानी", "नल", "supply"]):
        department = "Water Supply"
    elif any(w in lower for w in ["light", "streetlight", "बत्ती", "लाइट", "electricity"]):
        department = "Electrical / Street Lights"
    elif any(w in lower for w in ["tree", "park", "पेड़", "पार्क", "garden"]):
        department = "Parks & Horticulture"
    elif any(w in lower for w in ["sewage", "drain", "नाला", "सीवर", "flood"]):
        department = "Drainage / Sewerage"

    if any(w in lower for w in ["urgent", "danger", "accident", "emergency", "जरूरी", "खतरा", "दुर्घटना"]):
        priority = "High"
    elif any(w in lower for w in ["minor", "small", "छोटा"]):
        priority = "Low"

    groq_key = os.getenv("GROQ_API_KEY")
    if GROQ_AVAILABLE and groq_key:
        try:
            client = Groq(api_key=groq_key)
            prompt = f"""Analyze this citizen complaint and return ONLY a JSON object with two keys:
"department" (one of: Public Works / Roads, Sanitation / Waste Management, Water Supply, Electrical / Street Lights, Parks & Horticulture, Drainage / Sewerage, General Administration)
"priority" (High, Medium, or Low)

Complaint: {text}"""
            response = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=100,
            )
            import re
            content = response.choices[0].message.content
            match = re.search(r"\{.*\}", content, re.DOTALL)
            if match:
                result = json.loads(match.group())
                department = result.get("department", department)
                priority = result.get("priority", priority)
        except Exception as e:
            print(f"[Groq] Error: {e}")

    return {"department": department, "priority": priority}


def generate_tracking_id():
    return f"NS{datetime.now().strftime('%y%m%d')}{uuid.uuid4().hex[:6].upper()}"


# ===== Models =====
class StatusUpdate(BaseModel):
    status: str


class LoginRequest(BaseModel):
    username: str
    password: str


class CitizenRegister(BaseModel):
    name: str
    phone: str


# ===== Auth Endpoints =====
@app.post("/auth/login")
def admin_login(data: LoginRequest):
    """Admin login → returns token (env default admin + registered admins)"""
    username = (data.username or "").strip()
    password = data.password or ""

    # 1) Env default admin (fast path)
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    if username == ADMIN_USERNAME and password_hash == ADMIN_PASSWORD_HASH:
        token = create_token(username, "admin")
        return {
            "success": True,
            "token": token,
            "username": username,
            "role": "admin",
            "message": "Login successful",
        }

    # 2) Registered admin in DB (by name or username)
    users = load_users()
    match = next(
        (u for u in users
         if u.get("role") == "admin"
         and (u.get("name", "").lower() == username.lower()
              or (u.get("username") or "").lower() == username.lower()
              or str(u.get("phone", "")) == username)
         and verify_password(password, u.get("password_hash") or "")),
        None,
    )
    if match:
        token = create_token(match.get("name") or username, "admin")
        return {
            "success": True,
            "token": token,
            "username": match.get("name") or username,
            "role": "admin",
            "user_id": match.get("id"),
            "department": match.get("department"),
            "message": "Login successful",
        }

    raise HTTPException(status_code=401, detail="Invalid username or password")


@app.post("/auth/citizen")
def citizen_login(data: CitizenRegister):
    """Simple citizen register / login by name + phone"""
    phone = "".join(filter(str.isdigit, data.phone))[-10:]
    if len(phone) != 10:
        raise HTTPException(status_code=400, detail="Invalid phone number")

    users = load_users()
    existing = next((u for u in users if u["phone"] == phone), None)
    if existing:
        existing["name"] = data.name
        existing["lastLogin"] = datetime.now().isoformat()
        db.update_user(existing["id"], {"name": data.name, "last_login": datetime.now().isoformat()})
    else:
        new_user = {
            "id": str(uuid.uuid4())[:8],
            "name": data.name,
            "phone": phone,
            "role": "citizen",
            "created_at": datetime.now().isoformat(),
            "last_login": datetime.now().isoformat(),
        }
        db.add_user(new_user)

    token = create_token(phone, "citizen")
    return {
        "success": True,
        "token": token,
        "name": data.name,
        "phone": phone,
        "role": "citizen",
    }


@app.get("/auth/me")
def get_me(user=Depends(verify_token)):
    return user


@app.post("/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        active_tokens.pop(token, None)
    return {"success": True, "message": "Logged out"}


# ===== Public Endpoints =====
@app.get("/")
def root():
    return {
        "message": "NagrikSnap API is running 🚀",
        "sms_enabled": bool(os.getenv("FAST2SMS_API_KEY")),
        "auth": "enabled",
        "docs": "/docs",
    }


@app.post("/complaints")
async def create_complaint(
    description: str = Form(...),
    phone: str = Form(...),
    email: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    lat: Optional[float] = Form(None),
    lng: Optional[float] = Form(None),
    photo: Optional[UploadFile] = File(None),
):
    description = (description or "").strip()
    if not description:
        raise HTTPException(status_code=400, detail="Description is required")
    if len(description) > 2000:
        raise HTTPException(status_code=400, detail="Description must be under 2000 characters")

    phone_clean = "".join(filter(str.isdigit, phone))[-10:]
    if len(phone_clean) != 10:
        raise HTTPException(status_code=400, detail="Invalid 10-digit phone number")

    classification = classify_with_ai(description)

    # Assign nearest admin by GPS (prefer same department)
    assigned = None
    try:
        if lat is not None and lng is not None:
            assigned = find_nearest_admin(lat, lng, classification.get("department", ""))
    except Exception as e:
        print("[ASSIGN]", e)

    tracking_id = generate_tracking_id()

    photo_path = None
    if photo and photo.filename:
        ext = os.path.splitext(photo.filename)[1] or ".jpg"
        filename = f"{tracking_id}{ext}"
        photo_path = os.path.join(UPLOAD_DIR, filename)
        with open(photo_path, "wb") as f:
            f.write(await photo.read())

    complaint = {
        "id": tracking_id,
        "description": description,
        "phone": phone_clean,
        "email": (email or "").strip(),
        "address": address,
        "lat": lat,
        "lng": lng,
        "department": classification["department"],
        "priority": classification["priority"],
        "status": "Pending",
        "photo": photo_path,
        "createdAt": datetime.now().isoformat(),
        "assigned_admin": assigned,
        "assigned_admin_id": (assigned or {}).get("admin_id") if assigned else None,
        "assigned_admin_name": (assigned or {}).get("admin_name") if assigned else None,
    }

    db.add_complaint(complaint)

    sms_message = (
        f"NagrikSnap: Your complaint {tracking_id} is registered. "
        f"Dept: {classification['department']}. "
        f"Priority: {classification['priority']}."
    )
    sms_result = send_sms(phone_clean, sms_message)
    inbox_body = f"Your complaint {tracking_id} was registered successfully. Department: {classification['department']}. Priority: {classification['priority']}."
    store_message(phone_clean, "Complaint registered", inbox_body, tracking_id, email or "")
    email_result = send_email(email or "", f"NagrikSnap complaint {tracking_id} registered", f"<p>{inbox_body}</p>")
    admin_email = os.getenv("ADMIN_NOTIFICATION_EMAIL")
    admin_result = send_email(admin_email or "", f"New complaint: {tracking_id}", f"<p>{description}</p><p>Phone: {phone_clean}</p>")

    return {
        "success": True,
        "tracking_id": tracking_id,
        "email_sent": email_result.get("success", False),
        "admin_email_sent": admin_result.get("success", False),
        "department": classification["department"],
        "priority": classification["priority"],
        "sms_sent": sms_result.get("success", False),
        "message": "Complaint registered successfully",
    }


@app.get("/complaints")
def get_all_complaints(
    user=Depends(require_admin),
    status: Optional[str] = None,
    priority: Optional[str] = None,
    department: Optional[str] = None,
    q: Optional[str] = None,
    page: int = 1,
    per_page: int = 50,
):
    """Admin only – list all complaints with filters, search & pagination"""
    db = load_db()

    # Apply filters
    if status:
        db = [c for c in db if c.get("status") == status]
    if priority:
        db = [c for c in db if c.get("priority") == priority]
    if department:
        db = [c for c in db if department.lower() in str(c.get("department", "")).lower()]
    if q:
        ql = q.lower()
        db = [c for c in db if
              ql in str(c.get("id", "")).lower()
              or ql in c.get("phone", "")
              or ql in str(c.get("description", "")).lower()
              or ql in str(c.get("address", "")).lower()]

    total = len(db)
    page = max(1, page)
    per_page = max(1, min(100, per_page))
    start = (page - 1) * per_page
    items = db[start:start + per_page]

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
        "items": items,
    }


@app.get("/analytics")
def analytics(user=Depends(require_admin)):
    """Admin only – complaint analytics (status/priority/department breakdown)"""
    db = load_db()
    total = len(db)

    def bucket(key):
        out = {}
        for c in db:
            k = c.get(key) or "Unknown"
            out[k] = out.get(k, 0) + 1
        return out

    return {
        "total": total,
        "by_status": bucket("status"),
        "by_priority": bucket("priority"),
        "by_department": bucket("department"),
        "resolved_rate": round((bucket("status").get("Resolved", 0) / total) * 100, 2) if total else 0,
        "high_unresolved": sum(1 for c in db if c.get("priority") == "High" and c.get("status") != "Resolved"),
    }


@app.get("/complaints/{tracking_id}")
def get_complaint(tracking_id: str):
    """Public – anyone can track by ID"""
    db = load_db()
    for c in db:
        if c["id"] == tracking_id:
            return c
    raise HTTPException(status_code=404, detail="Complaint not found")


@app.put("/complaints/{tracking_id}/status")
def update_status(tracking_id: str, data: StatusUpdate, user=Depends(require_admin)):
    """Admin only – update status + send SMS"""
    complaint = db.get_complaint_by_id(tracking_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    old_status = complaint.get("status", "")
    db.update_complaint_status(tracking_id, data.status)

    sms_message = (
        f"NagrikSnap Update: Your complaint {tracking_id} "
        f"status changed from {old_status} to {data.status}."
    )
    sms_result = send_sms(complaint.get("phone", ""), sms_message)

    return {
        "success": True,
        "message": f"Status updated to {data.status}",
        "sms_sent": sms_result.get("success", False),
    }


@app.get("/messages")
def get_messages(user=Depends(verify_token), unread_only: bool = False):
    if user["role"] != "citizen":
        raise HTTPException(status_code=403, detail="Citizen access required")
    return {"messages": db.get_messages(user["username"], unread_only)}


@app.patch("/messages/{message_id}/read")
def read_message(message_id: str, user=Depends(verify_token)):
    if user["role"] != "citizen":
        raise HTTPException(status_code=403, detail="Citizen access required")
    db.mark_message_read(message_id, user["username"])
    return {"success": True}


@app.get("/uploads/{filename}")
def get_upload(filename: str):
    path = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(path):
        return FileResponse(path)
    raise HTTPException(status_code=404, detail="File not found")




# ===== OTP Store (in-memory for prototype; use Redis in production) =====
otp_store = {}  # phone -> {otp, role, expires, attempts}


class OtpRequest(BaseModel):
    phone: str
    role: str = "citizen"  # citizen | admin


class OtpVerify(BaseModel):
    phone: str
    otp: str
    role: str = "citizen"
    new_password: str


@app.post("/auth/otp/send")
def send_otp(data: OtpRequest):
    """Send 6-digit OTP via Fast2SMS for password reset"""
    phone = "".join(filter(str.isdigit, data.phone))[-10:]
    if len(phone) != 10:
        raise HTTPException(status_code=400, detail="Invalid 10-digit phone number")

    role = data.role if data.role in ("citizen", "admin") else "citizen"

    # Rate limit: max 3 OTP requests per 10 minutes per phone
    if not rate_limit(f"otp:{role}:{phone}", 3, 600):
        raise HTTPException(status_code=429, detail="Too many OTP requests. Please wait a few minutes.")

    # Generate OTP
    import random
    otp = str(random.randint(100000, 999999))
    otp_store[f"{role}:{phone}"] = {
        "otp": otp,
        "role": role,
        "expires": time.time() + 300,  # 5 minutes
        "attempts": 0,
    }

    message = (
        f"NagrikSnap OTP for password reset is {otp}. "
        f"Valid for 5 minutes. Do not share with anyone."
    )
    sms_result = send_sms(phone, message)

    response = {
        "success": True,
        "phone": phone,
        "sms_sent": sms_result.get("success", False),
        "demo": sms_result.get("demo", False),
        "message": "OTP sent via SMS" if sms_result.get("success") else "OTP generated (SMS demo mode)",
        "expires_in": 300,
    }
    # Only expose OTP in response when SMS is in demo mode (no API key)
    if sms_result.get("demo") or not sms_result.get("success"):
        response["demo_otp"] = otp
        response["hint"] = "FAST2SMS_API_KEY not set or SMS failed — using demo OTP"

    return response


@app.post("/auth/otp/verify-reset")
def verify_otp_and_reset(data: OtpVerify):
    """Verify OTP and return success so frontend can update local password store.
    Backend also updates users.json if that phone exists there.
    """
    phone = "".join(filter(str.isdigit, data.phone))[-10:]
    role = data.role if data.role in ("citizen", "admin") else "citizen"
    key = f"{role}:{phone}"

    entry = otp_store.get(key)
    if not entry:
        raise HTTPException(status_code=400, detail="OTP not requested or expired. Request a new OTP.")

    if time.time() > entry["expires"]:
        del otp_store[key]
        raise HTTPException(status_code=400, detail="OTP expired. Request a new one.")

    entry["attempts"] += 1
    if entry["attempts"] > 5:
        del otp_store[key]
        raise HTTPException(status_code=400, detail="Too many attempts. Request a new OTP.")

    if data.otp.strip() != entry["otp"]:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

# Update the user's password in the DB
    user = db.get_user_by_phone(phone, role)
    updated = False
    if user:
        db.update_user(user["id"], {
            "password_hash": hash_password(data.new_password),
            "updated_at": datetime.now().isoformat(),
        })
        updated = True

    del otp_store[key]

    return {
        "success": True,
        "message": "Password reset successful",
        "phone": phone,
        "role": role,
        "backend_user_updated": updated,
    }


@app.post("/auth/register")
def register_user(data: dict):
    """Register citizen or admin account in users.json (with optional GPS for nearby assignment)"""
    name = (data.get("name") or "").strip()
    phone = "".join(filter(str.isdigit, str(data.get("phone", ""))))[-10:]
    password = data.get("password") or ""
    role = data.get("role") if data.get("role") in ("citizen", "admin") else "citizen"
    department = data.get("department") or ""
    address = (data.get("address") or "").strip()
    lat = data.get("lat")
    lng = data.get("lng")
    try:
        lat = float(lat) if lat is not None and str(lat) != "" else None
        lng = float(lng) if lng is not None and str(lng) != "" else None
    except (TypeError, ValueError):
        lat, lng = None, None

    if not name or len(phone) != 10 or len(password) < 6:
        raise HTTPException(status_code=400, detail="Invalid name, phone or password")

    users = load_users()
    if any(u.get("phone") == phone and u.get("role", "citizen") == role for u in users):
        raise HTTPException(status_code=400, detail="Phone already registered for this role")

    db.add_user({
        "id": str(uuid.uuid4())[:8],
        "name": name,
        "username": name.lower().replace(" ", ""),
        "phone": phone,
        "password_hash": hash_password(password),
        "role": role,
        "department": department if role == "admin" else "",
        "address": address,
        "lat": lat,
        "lng": lng,
        "created_at": datetime.now().isoformat(),
    })
    return {
        "success": True,
        "message": "Registered",
        "role": role,
        "phone": phone,
        "location_saved": lat is not None and lng is not None,
    }




# ===== Reviews (after complaint Resolved) =====
class ReviewCreate(BaseModel):
    complaint_id: str
    rating: int
    comment: Optional[str] = ""
    name: Optional[str] = "Citizen"
    phone: Optional[str] = ""
    department: Optional[str] = ""


@app.get("/reviews")
def list_reviews():
    """Public list of all citizen reviews + department stats"""
    reviews = load_reviews()
    reviews_sorted = sorted(reviews, key=lambda r: r.get("created_at", ""), reverse=True)
    avg = 0.0
    if reviews_sorted:
        avg = sum(float(r.get("rating", 0)) for r in reviews_sorted) / len(reviews_sorted)

    # Department breakdown (satisfaction per department)
    dept_stats = {}
    for r in reviews_sorted:
        d = (r.get("department") or "General").strip() or "General"
        if d not in dept_stats:
            dept_stats[d] = {"count": 0, "total_rating": 0.0, "average": 0.0}
        dept_stats[d]["count"] += 1
        dept_stats[d]["total_rating"] += float(r.get("rating", 0))
    for d in dept_stats:
        dept_stats[d]["average"] = round(dept_stats[d]["total_rating"] / dept_stats[d]["count"], 2)

    return {
        "reviews": reviews_sorted,
        "count": len(reviews_sorted),
        "average": round(avg, 2),
        "by_department": dept_stats,
    }


@app.get("/reviews/{complaint_id}")
def get_review_for_complaint(complaint_id: str):
    reviews = load_reviews()
    found = next((r for r in reviews if r.get("complaint_id") == complaint_id), None)
    if not found:
        return {"found": False}
    return {"found": True, "review": found}


@app.post("/reviews")
def create_review(data: ReviewCreate):
    """Submit a review only if complaint exists and is Resolved"""
    complaint_id = (data.complaint_id or "").strip()
    if not complaint_id:
        raise HTTPException(status_code=400, detail="complaint_id required")
    if data.rating < 1 or data.rating > 5:
        raise HTTPException(status_code=400, detail="rating must be 1-5")

    # Prefer checking complaints DB
    db = load_db()
    complaint = next((c for c in db if c.get("tracking_id") == complaint_id or c.get("id") == complaint_id), None)

    # If complaint exists in backend DB, enforce Resolved
    if complaint is not None:
        status = complaint.get("status", "")
        if status != "Resolved":
            raise HTTPException(status_code=400, detail="Can only review Resolved complaints")

    reviews = load_reviews()
    if any(r.get("complaint_id") == complaint_id for r in reviews):
        raise HTTPException(status_code=400, detail="This complaint was already reviewed")

    review = {
        "id": "rv_" + str(uuid.uuid4())[:8],
        "complaint_id": complaint_id,
        "rating": int(data.rating),
        "comment": (data.comment or "").strip()[:1000],
        "name": (data.name or "Citizen").strip()[:80],
        "phone": "".join(filter(str.isdigit, data.phone or ""))[-10:],
        "department": (data.department or (complaint or {}).get("department", "")).strip()[:120],
        "created_at": datetime.now().isoformat(),
    }
    db.add_review(review)
    return {"success": True, "review": review}





# ===== AI Help Chat (FAQ + optional Groq) =====
class ChatRequest(BaseModel):
    message: str
    lang: Optional[str] = "en"


CHAT_FAQ = [
    (["report", "how to report", "शिकायत", "रिपोर्ट", "snap", "दर्ज"],
     "To report: open Report Issue → photo → describe (Hindi/English) → location → Submit. You get Tracking ID + SMS.",
     "समस्या रिपोर्ट: Report Issue खोलें → फोटो → वर्णन → स्थान → Submit। Tracking ID + SMS मिलेगा।"),
    (["track", "tracking", "status", "ट्रैक", "id"],
     "Track Complaint page: enter Tracking ID or mobile number to see status timeline.",
     "Track Complaint पर Tracking ID या मोबाइल नंबर डालकर स्थिति देखें।"),
    (["pothole", "road", "गड्ढा", "सड़क"],
     "Road/pothole → Public Works / Roads. Report with photo and exact location.",
     "सड़क/गड्ढा → Public Works / Roads। फोटो और स्थान के साथ रिपोर्ट करें।"),
    (["garbage", "waste", "कचरा", "कूड़ा"],
     "Garbage → Sanitation / Waste Management. Snap and report.",
     "कचरा → Sanitation विभाग। फोटो लेकर रिपोर्ट करें।"),
    (["water", "pipe", "पानी", "नल"],
     "Water issues → Water Supply department.",
     "पानी की समस्या → Water Supply विभाग।"),
    (["light", "streetlight", "बत्ती", "लाइट"],
     "Street lights → Electrical / Street Lights.",
     "स्ट्रीट लाइट → Electrical / Street Lights।"),
    (["login", "password", "otp", "signup", "लॉगिन", "पासवर्ड"],
     "Login page: Sign up or Forgot password with phone OTP. Admin tab for staff.",
     "Login: Sign up या Forgot password (फोन OTP)। Admin टैब स्टाफ के लिए।"),
    (["review", "rating", "रिव्यू"],
     "After status is Resolved, rate on Track page. See all reviews via footer → Reviews.",
     "Resolved होने पर Track पेज से रेटिंग दें। Footer → Reviews पर सभी रिव्यू।"),
    (["hello", "hi", "namaste", "help", "नमस्ते", "मदद"],
     "Namaste! I help with Report, Track, departments, Login, and Reviews.",
     "नमस्ते! मैं Report, Track, विभाग, Login और Reviews में मदद करता/करती हूँ।"),
]


def chat_rule_reply(message: str, lang: str) -> Optional[str]:
    lower = message.lower()
    for keys, en, hi in CHAT_FAQ:
        if any(k.lower() in lower or k in message for k in keys):
            return hi if lang == "hi" else en
    return None


def chat_with_groq(message: str, lang: str) -> Optional[str]:
    groq_key = os.getenv("GROQ_API_KEY")
    if not (GROQ_AVAILABLE and groq_key):
        return None
    try:
        client = Groq(api_key=groq_key)
        system = (
            "You are the helpful AI assistant for NagrikSnap, an Indian citizen grievance app "
            "(report civic issues, track complaints, login, reviews). "
            "You CAN answer general questions (explanations, advice, education, daily life) clearly and briefly. "
            "When the user asks about civic problems, reporting, tracking, departments, login, or reviews, "
            "prioritize accurate NagrikSnap guidance. "
            "Be concise (max about 120 words). Be polite and safe: refuse harmful, illegal, or dangerous instructions. "
            f"Reply in {'Hindi' if lang == 'hi' else 'English'} unless the user clearly uses another language."
        )
        resp = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": message},
            ],
            max_tokens=180,
            temperature=0.3,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception as e:
        print(f"[CHAT] Groq error: {e}")
        return None


@app.post("/chat")
def chat_assist(data: ChatRequest):
    msg = (data.message or "").strip()
    if not msg:
        raise HTTPException(status_code=400, detail="message required")
    lang = "hi" if (data.lang == "hi" or any("\u0900" <= ch <= "\u097F" for ch in msg)) else "en"

    rule = chat_rule_reply(msg, lang)
    if rule:
        return {"reply": rule, "source": "faq"}

    ai = chat_with_groq(msg, lang)
    if ai:
        return {"reply": ai, "source": "groq"}

    fallback = (
        "अभी विस्तृत AI जवाब उपलब्ध नहीं है (GROQ_API_KEY सेट करें)। "
        "NagrikSnap पर मैं Report, Track, Login और Reviews में मदद कर सकता/सकती हूँ — या सामान्य सवाल बाद में पूछें।"
        if lang == "hi"
        else "Full AI answers need GROQ_API_KEY on the server. "
             "I can still help with Report, Track, Login, and Reviews from built-in guides."
    )
    return {"reply": fallback, "source": "fallback"}




@app.get("/admins/nearby")
def admins_nearby(lat: float, lng: float, limit: int = 5):
    """Debug/helper: nearest admins to a location"""
    users = load_users()
    admins = [u for u in users if u.get("role") == "admin" and u.get("lat") is not None]
    out = []
    for a in admins:
        d = haversine_km(lat, lng, a.get("lat"), a.get("lng"))
        if d is None:
            continue
        out.append({
            "id": a.get("id"),
            "name": a.get("name"),
            "department": a.get("department"),
            "phone": a.get("phone"),
            "distance_km": round(d, 2),
        })
    out.sort(key=lambda x: x["distance_km"])
    return {"admins": out[: max(1, min(limit, 20))]}


@app.post("/test-sms")
def test_sms(phone: str = Form(...), message: str = Form("NagrikSnap test SMS"), user=Depends(require_admin)):
    result = send_sms(phone, message)
    return result


# Ensure the database is initialized (tables + migration) on startup.
db.init_db()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
