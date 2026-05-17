/**
 * routes/users.js
 * GET    /api/users             — list users (admin)
 * POST   /api/users/register    — self-register (public)
 * POST   /api/users/login       — login check (public)
 * DELETE /api/users/:phone      — remove user (admin)
 */

const router   = require('express').Router();
const supabase = require('../config/supabase');
const { requireAdmin } = require('../middleware/auth');

const mapUser = u => ({
  id:        u.id,
  phone:     u.phone,
  name:      u.name,
  team:      u.team,
  role:      u.role,
  createdAt: u.created_at,
});

// GET /api/users (admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('*').order('id');
    if (error) throw error;
    res.json((data || []).map(mapUser));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/register
router.post('/register', async (req, res) => {
  const { phone, name, team, password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: 'phone and password are required' });
  try {
    const row = { phone, name: name || '', team: team || '', role: 'fan', password };
    const { data, error } = await supabase
      .from('users').upsert(row, { onConflict: 'phone' }).select().single();
    if (error) throw error;
    res.status(201).json(mapUser(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/login
router.post('/login', async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: 'phone and password are required' });
  try {
    const { data, error } = await supabase
      .from('users').select('*').eq('phone', phone).eq('password', password).single();
    if (error || !data) return res.status(401).json({ error: 'Invalid credentials' });
    res.json(mapUser(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:phone (admin)
router.delete('/:phone', requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase.from('users').delete().eq('phone', req.params.phone);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
