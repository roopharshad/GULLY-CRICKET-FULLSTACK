/**
 * routes/admin.js
 * POST /api/admin/login          — verify admin credentials
 * PUT  /api/admin/credentials    — change admin username/password (admin)
 * GET  /api/admin/sound          — get sound settings
 * PUT  /api/admin/sound          — update sound settings (admin)
 */

const router   = require('express').Router();
const supabase = require('../config/supabase');
const { requireAdmin } = require('../middleware/auth');

// POST /api/admin/login — verify admin creds, returns X-Admin-Token hint on success
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  try {
    const { data, error } = await supabase
      .from('admin_credentials').select('username,password').eq('id', 1).single();
    if (error) throw error;
    if (data.username === username && data.password === password) {
      // Return the server-level admin secret so the client can use it for subsequent writes
      return res.json({ ok: true, adminToken: process.env.ADMIN_SECRET });
    }
    res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/credentials (admin)
router.put('/credentials', requireAdmin, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  try {
    const { error } = await supabase
      .from('admin_credentials')
      .upsert({ id: 1, username, password, updated_at: new Date().toISOString() });
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/sound
router.get('/sound', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sound_settings').select('settings').eq('id', 1).single();
    if (error) return res.json({});
    res.json(data.settings || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/sound (admin)
router.put('/sound', requireAdmin, async (req, res) => {
  const settings = req.body;
  try {
    const { error } = await supabase
      .from('sound_settings')
      .upsert({ id: 1, settings, updated_at: new Date().toISOString() });
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
