# 🏏 GullyCricket — Full-Stack Deployment Guide

## Architecture

```
┌─────────────────────────┐        ┌──────────────────────────────┐
│   FRONTEND (Netlify)    │  REST  │    BACKEND (Render / Railway)│
│                         │◄──────►│                              │
│  index.html             │  + WS  │  Express + Node.js           │
│  admin.html             │        │  src/server.js               │
│  api-client.js          │        │  src/routes/…                │
└─────────────────────────┘        └─────────────┬────────────────┘
                                                 │ Supabase SDK
                                                 ▼
                                   ┌──────────────────────────┐
                                   │     Supabase (DB)         │
                                   │  PostgreSQL + Realtime    │
                                   └──────────────────────────┘
```

- **Frontend**: Static HTML/JS served from Netlify (or any CDN)
- **Backend**: Node.js/Express REST API + WebSocket server (Render free tier)
- **Database**: Supabase PostgreSQL — Supabase keys are NEVER in the browser

---

## Step 1 — Supabase Setup

1. Go to [https://supabase.com](https://supabase.com) → **New Project**
2. In **SQL Editor**, paste and run `supabase_schema.sql`
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public key** → `SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` *(keep this secret!)*

---

## Step 2 — Deploy the Backend

### Option A: Render.com (recommended, free)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New → Web Service**
3. Connect your repo → set **Root Directory** to `backend`
4. Build command: `npm install` | Start command: `npm start`
5. Add environment variables:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | your service role key |
| `SUPABASE_ANON_KEY` | your anon key |
| `ADMIN_SECRET` | any long random string |
| `ALLOWED_ORIGINS` | `https://your-site.netlify.app` |

6. Deploy → copy the URL (e.g. `https://gully-cricket-backend.onrender.com`)

### Option B: Railway.app

```bash
cd backend
railway init
railway up
railway variables set NODE_ENV=production SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ADMIN_SECRET=...
```

### Option C: Local

```bash
cd backend
cp .env.example .env
# Edit .env with your values
npm install
npm start
```

---

## Step 3 — Configure the Frontend

Open `frontend/api-client.js` and set your backend URL:

```js
// Line 16-17 in api-client.js
const API_BASE_URL = 'https://gully-cricket-backend.onrender.com'; // ← your backend URL
const WS_URL       = 'wss://gully-cricket-backend.onrender.com/ws'; // ← websocket URL
```

---

## Step 4 — Deploy the Frontend

### Option A: Netlify (recommended)

1. Go to [netlify.com](https://netlify.com) → **New site from folder**
2. Drag & drop the `frontend/` folder
3. Done — get a live URL

### Option B: Vercel

```bash
cd frontend
npx vercel
```

### Option C: GitHub Pages

Push `frontend/` contents to a GitHub repo → Settings → Pages → main branch, root.

---

## API Reference

All write endpoints require the `X-Admin-Token` header.
The token is returned by `POST /api/admin/login`.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | — | Health check |
| GET | `/api/data` | — | Full data blob (all tables merged) |
| PUT | `/api/data` | admin | Save full data blob |
| GET | `/api/players` | — | List players |
| GET | `/api/players/:id` | — | Single player |
| POST | `/api/players` | admin | Create player |
| PUT | `/api/players/:id` | admin | Update player |
| DELETE | `/api/players/:id` | admin | Delete player |
| GET | `/api/teams` | — | List teams |
| GET | `/api/teams/:id` | — | Single team |
| POST | `/api/teams` | admin | Create team |
| PUT | `/api/teams/:id` | admin | Update team |
| DELETE | `/api/teams/:id` | admin | Delete team |
| GET | `/api/matches` | — | List matches |
| GET | `/api/matches/live` | — | Current live match |
| GET | `/api/matches/:id` | — | Single match |
| POST | `/api/matches` | admin | Create match |
| PUT | `/api/matches/:id` | admin | Update match |
| DELETE | `/api/matches/:id` | admin | Delete match |
| POST | `/api/admin/login` | — | Verify admin credentials |
| PUT | `/api/admin/credentials` | admin | Change admin password |
| GET | `/api/admin/sound` | — | Get sound settings |
| PUT | `/api/admin/sound` | admin | Save sound settings |
| GET | `/api/users` | admin | List registered users |
| POST | `/api/users/register` | — | Register user |
| POST | `/api/users/login` | — | User login |
| DELETE | `/api/users/:phone` | admin | Remove user |

### WebSocket

Connect to `ws://your-backend/ws` — messages are JSON:

```json
{ "type": "data_updated",    "payload": { "table": "app_data" }, "ts": 1700000000000 }
{ "type": "players_updated", "payload": { "action": "updated", "id": 3 }, "ts": ... }
{ "type": "matches_updated", "payload": { "action": "created", "id": 7 }, "ts": ... }
{ "type": "teams_updated",   "payload": { "action": "deleted", "id": 2 }, "ts": ... }
```

---

## Default Admin Login

- **Username:** `admin`
- **Password:** `admin123`

Change via Admin Panel → Settings → Admin Credentials after first login.

---

## File Structure

```
gully_cricket/
├── backend/
│   ├── package.json
│   ├── .env.example          ← copy to .env and fill in values
│   ├── .gitignore
│   └── src/
│       ├── server.js         ← main entry point
│       ├── config/
│       │   └── supabase.js   ← Supabase admin client
│       ├── middleware/
│       │   └── auth.js       ← X-Admin-Token guard
│       ├── services/
│       │   └── broadcast.js  ← WebSocket broadcast helper
│       └── routes/
│           ├── appData.js
│           ├── players.js
│           ├── teams.js
│           ├── matches.js
│           ├── users.js
│           └── admin.js
├── frontend/
│   ├── index.html            ← fan/viewer page
│   ├── admin.html            ← admin panel
│   ├── api-client.js         ← frontend API + WebSocket client
│   └── netlify.toml
├── supabase_schema.sql       ← run once in Supabase SQL Editor
├── render.yaml               ← Render.com one-click deploy config
└── README.md
```
