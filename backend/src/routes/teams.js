/**
 * routes/teams.js
 * GET    /api/teams         — list all teams (sorted by wins)
 * GET    /api/teams/:id     — single team
 * POST   /api/teams         — create team (admin)
 * PUT    /api/teams/:id     — update team (admin)
 * DELETE /api/teams/:id     — delete team (admin)
 */

const router   = require('express').Router();
const supabase = require('../config/supabase');
const { requireAdmin } = require('../middleware/auth');
const broadcast = require('../services/broadcast');

const mapTeam = t => ({
  id:      t.id,
  name:    t.name,
  emoji:   t.emoji,
  color:   t.color,
  played:  t.played,
  won:     t.won,
  lost:    t.lost,
  nr:      t.nr,
  nrr:     t.nrr,
  captain: t.captain,
  code:    t.team_code,
  players: t.players || [],
  createdAt: t.created_at,
  updatedAt: t.updated_at,
});

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('teams').select('*').order('won', { ascending: false });
    if (error) throw error;
    res.json((data || []).map(mapTeam));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('teams').select('*').eq('id', req.params.id).single();
    if (error) return res.status(404).json({ error: 'Team not found' });
    res.json(mapTeam(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  const t = req.body;
  if (!t?.name) return res.status(400).json({ error: 'name is required' });
  try {
    const row = {
      name:      t.name,
      emoji:     t.emoji     || '🏏',
      color:     t.color     || '#64748b',
      played:    t.played    || 0,
      won:       t.won       || 0,
      lost:      t.lost      || 0,
      nr:        t.nr        || 0,
      nrr:       String(t.nrr || '0.00'),
      captain:   t.captain   || '',
      team_code: t.code      || '',
      players:   t.players   || [],
    };
    const { data, error } = await supabase.from('teams').insert(row).select().single();
    if (error) throw error;
    broadcast.broadcast('teams_updated', { action: 'created', id: data.id });
    res.status(201).json(mapTeam(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  const t = req.body;
  try {
    const row = {
      ...(t.name    !== undefined && { name:      t.name }),
      ...(t.emoji   !== undefined && { emoji:     t.emoji }),
      ...(t.color   !== undefined && { color:     t.color }),
      ...(t.played  !== undefined && { played:    t.played }),
      ...(t.won     !== undefined && { won:       t.won }),
      ...(t.lost    !== undefined && { lost:      t.lost }),
      ...(t.nr      !== undefined && { nr:        t.nr }),
      ...(t.nrr     !== undefined && { nrr:       String(t.nrr) }),
      ...(t.captain !== undefined && { captain:   t.captain }),
      ...(t.code    !== undefined && { team_code: t.code }),
      ...(t.players !== undefined && { players:   t.players }),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('teams').update(row).eq('id', req.params.id).select().single();
    if (error) throw error;
    broadcast.broadcast('teams_updated', { action: 'updated', id: data.id });
    res.json(mapTeam(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase.from('teams').delete().eq('id', req.params.id);
    if (error) throw error;
    broadcast.broadcast('teams_updated', { action: 'deleted', id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
