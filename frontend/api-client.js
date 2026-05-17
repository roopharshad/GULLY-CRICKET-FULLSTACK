/**
 * api-client.js
 * GullyCricket — Frontend API client
 *
 * Replaces supabase-client.js.
 * All requests go through the Express backend REST API.
 * Live updates come via WebSocket instead of Supabase Realtime.
 *
 * HOW TO CONFIGURE:
 * Set API_BASE_URL below to your deployed backend URL.
 * For local dev: leave as '' (same origin) or 'http://localhost:3000'
 * For production: 'https://your-backend.onrender.com'
 */

// ── CONFIG ────────────────────────────────────────────────────────────────────
const API_BASE_URL = '';   // ← set to backend URL if hosting separately
const WS_URL       = '';   // ← leave '' to auto-detect, or 'wss://your-backend.onrender.com/ws'
// ─────────────────────────────────────────────────────────────────────────────

// ── Helpers ───────────────────────────────────────────────────────────────────
function apiUrl(path) {
  return (API_BASE_URL ? API_BASE_URL.replace(/\/$/, '') : '') + path;
}

async function apiFetch(path, options = {}) {
  const token = _adminToken || sessionStorage.getItem('gc_admin_token') || '';
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['X-Admin-Token'] = token;

  const res = await fetch(apiUrl(path), { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── State ─────────────────────────────────────────────────────────────────────
const STORAGE_KEY        = 'gully_cricket_data';
const USERS_KEY          = 'gully_cricket_users';
const SOUND_SETTINGS_KEY = 'gully_cricket_sounds';

let _cache      = null;
let _cacheUsers = null;
let _adminToken = sessionStorage.getItem('gc_admin_token') || '';
let _ws         = null;
let _wsHandlers = [];

// ═══════════════════════════════════════════════════════════════════════════════
//  CORE DATA
// ═══════════════════════════════════════════════════════════════════════════════

async function getData() {
  try {
    const d = await apiFetch('/api/data');
    _cache = d;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch (_) {}
    return d;
  } catch (err) {
    console.warn('API getData failed, using localStorage fallback:', err.message);
    return _getLocalData();
  }
}

function _getLocalData() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      const d = JSON.parse(s);
      if (!d.banners)        d.banners = [];
      if (!d.teams)          d.teams = [];
      if (!d.players)        d.players = [];
      if (!d.recentMatches)  d.recentMatches = [];
      return d;
    }
  } catch (_) {}
  return _cache || {
    liveMatch: null, players: [], teams: [], recentMatches: [],
    battingScorecard: [], bowlingScorecard: [], banners: [], schedule: []
  };
}

function getData_sync() {
  if (_cache) return _cache;
  return _getLocalData();
}

async function saveData(d) {
  // Instant local cache for UI responsiveness
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch (_) {}
  _cache = d;

  try {
    await apiFetch('/api/data', { method: 'PUT', body: JSON.stringify(d) });
  } catch (err) {
    console.warn('API saveData failed (cached locally):', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  USERS
// ═══════════════════════════════════════════════════════════════════════════════

async function getUsers() {
  try {
    const users = await apiFetch('/api/users');
    _cacheUsers = users;
    try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch (_) {}
    return users;
  } catch (err) {
    console.warn('API getUsers failed:', err.message);
    return _getLocalUsers();
  }
}

function getUsers_sync() {
  if (_cacheUsers) return _cacheUsers;
  return _getLocalUsers();
}

function _getLocalUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch (_) { return []; }
}

async function saveUsers(users) {
  _cacheUsers = users;
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch (_) {}
  // Individual user ops (addUser/removeUser) call the correct endpoints.
  // saveUsers is kept for compatibility but does a best-effort re-sync.
  try {
    for (const u of users) await addUser(u);
  } catch (err) {
    console.warn('saveUsers partial error:', err.message);
  }
}

async function addUser(user) {
  try {
    const u = await apiFetch('/api/users/register', {
      method: 'POST',
      body: JSON.stringify({
        phone: user.phone, name: user.name, team: user.team, password: user.password
      }),
    });
    const users = await getUsers();
    return users;
  } catch (err) {
    console.warn('API addUser failed:', err.message);
    const users = _getLocalUsers();
    const idx = users.findIndex(u => u.phone === user.phone);
    if (idx >= 0) users[idx] = user; else users.push(user);
    try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch (_) {}
    return users;
  }
}

async function removeUser(phone) {
  try {
    await apiFetch(`/api/users/${encodeURIComponent(phone)}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('API removeUser failed:', err.message);
  }
  const users = _getLocalUsers().filter(u => u.phone !== phone);
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch (_) {}
  return users;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ADMIN CREDENTIALS
// ═══════════════════════════════════════════════════════════════════════════════

async function getAdminCreds() {
  // Admin creds are not exposed via GET — login is done via POST /api/admin/login
  return { username: 'admin', password: '' };
}

/**
 * adminLogin(username, password)
 * Returns { ok, adminToken } on success.
 * Stores adminToken in sessionStorage for subsequent write operations.
 */
async function adminLogin(username, password) {
  try {
    const res = await apiFetch('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (res.ok && res.adminToken) {
      _adminToken = res.adminToken;
      sessionStorage.setItem('gc_admin_token', res.adminToken);
    }
    return res;
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function saveAdminCreds(username, password) {
  try {
    await apiFetch('/api/admin/credentials', {
      method: 'PUT',
      body: JSON.stringify({ username, password }),
    });
  } catch (err) {
    console.warn('saveAdminCreds failed:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SOUND SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

async function loadSoundSettings() {
  try {
    return await apiFetch('/api/admin/sound');
  } catch (err) {
    try { return JSON.parse(localStorage.getItem(SOUND_SETTINGS_KEY) || '{}'); } catch (_) { return {}; }
  }
}

async function saveSoundSettings(s) {
  try { localStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify(s)); } catch (_) {}
  try {
    await apiFetch('/api/admin/sound', { method: 'PUT', body: JSON.stringify(s) });
  } catch (err) {
    console.warn('saveSoundSettings failed:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  WEBSOCKET — live updates from backend
// ═══════════════════════════════════════════════════════════════════════════════

function _getWsUrl() {
  if (WS_URL) return WS_URL;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const base  = API_BASE_URL ? API_BASE_URL.replace(/^https?/, proto === 'wss:' ? 'wss' : 'ws') : `${proto}//${location.host}`;
  return base.replace(/\/$/, '') + '/ws';
}

function subscribeToLiveUpdates(onUpdate) {
  if (_ws) {
    try { _ws.close(); } catch (_) {}
  }

  function connect() {
    try {
      const wsUrl = _getWsUrl();
      _ws = new WebSocket(wsUrl);

      _ws.onopen = () => console.log('[WS] Connected to GullyCricket backend');

      _ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (['data_updated', 'players_updated', 'teams_updated', 'matches_updated'].includes(msg.type)) {
            const d = await getData();
            onUpdate(d);
          }
        } catch (_) {}
      };

      _ws.onclose = () => {
        console.log('[WS] Disconnected — reconnecting in 3s…');
        setTimeout(connect, 3000);
      };

      _ws.onerror = (err) => {
        console.warn('[WS] Error:', err);
      };

    } catch (err) {
      console.warn('[WS] Cannot connect:', err.message);
    }
  }

  connect();
  return _ws;
}
