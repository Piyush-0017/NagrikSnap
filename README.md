# Grievance AI (SIH1516) — Setup Guide

Two folders: `backend/` (FastAPI) and `frontend/` (React + Vite). Run both at once, in two terminals.

## 1. Open in VS Code
Unzip this folder, then in VS Code: File → Open Folder → select `grievance-ai`.

## 2. Backend setup
Open a terminal in VS Code (`` Ctrl+` ``) and run:

```
cd backend
python -m venv venv
```

Activate it:
- Windows: `venv\Scripts\activate`
- Mac/Linux: `source venv/bin/activate`

```
pip install -r requirements.txt
```

Copy `.env.example` to `.env`:
```
cp .env.example .env      # Mac/Linux
copy .env.example .env    # Windows
```

Edit `.env` and fill in:
- `GROQ_API_KEY` — free key from https://console.groq.com
- `FAST2SMS_API_KEY` — free key from https://www.fast2sms.com (optional — app works without it, SMS just won't send)
- `JWT_SECRET_KEY` — generate one:
  ```
  python -c "import secrets; print(secrets.token_hex(32))"
  ```
  Paste the output as the value.
- `DEFAULT_ADMIN_PASSWORD` — set any password, e.g. `demo1234`. Username defaults to `admin`.

Run the backend:
```
uvicorn main:app --reload
```
Leave this running. You should see `Uvicorn running on http://127.0.0.1:8000` and `Seeded default admin user: admin`.

## 3. Frontend setup
Open a **second** terminal (`+` icon in VS Code terminal panel):

```
cd frontend
npm install
npm run dev
```
Leave this running too. It'll print a local URL — usually `http://localhost:5173`.

## 4. Open the app
- Citizen portal: http://localhost:5173
- Admin login: http://localhost:5173/admin — log in with the username/password you set in `.env`

## 5. Demo flow
1. On the citizen page, describe an issue (e.g. "No water supply since 2 days"), enter a 10-digit phone number, add an address or click "Use my location," submit.
2. Note the Tracking ID shown.
3. Go to `/admin`, log in, see the complaint appear with AI-assigned department and priority.
4. Change its status — this logs to the audit trail and (if SMS key is set) texts the citizen.
5. Go back to the citizen page → "Track a Complaint" → paste the Tracking ID → see live status.

## Troubleshooting
- **"JWT_SECRET_KEY is not set"** — you skipped the `.env` step above.
- **CORS error in browser console** — make sure backend is running on port 8000 and frontend on 5173 (defaults match `ALLOWED_ORIGINS` in `.env`).
- **Admin login fails** — check `DEFAULT_ADMIN_PASSWORD` in backend `.env`, then delete `grievance.db` and restart `uvicorn` to reseed.
- **Classification always returns "Others"** — check `GROQ_API_KEY` is valid.


## Reviews API

- `GET /reviews` — list all reviews + average
- `GET /reviews/{complaint_id}` — check if reviewed
- `POST /reviews` — body: `{ complaint_id, rating, comment, name, phone, department }`
  - Allowed when complaint is **Resolved** (if it exists in backend DB)
  - Stored in `backend/reviews.json`
  - Frontend also mirrors to localStorage for offline demo


## AI Help Assistant (chat widget)

- Floating **Help** button on every page (bottom-right)
- FAQ rules for NagrikSnap topics (Report / Track / departments / Login / Reviews)
- With `GROQ_API_KEY`: can answer **general questions** as well as civic help
- Works offline with built-in FAQ if backend/Groq is down
