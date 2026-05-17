/**
 * routes/players.js
 * GET    /api/players         — list all players (sorted by runs)
 * GET    /api/players/:id     — single player
 * POST   /api/players         — create player (admin)
 * PUT    /api/players/:id     — update player (admin)
 * DELETE /api/players/:id     — delete player (admin)
 */

const router   = require('express').Router();
const supabase = require('../config/supabase');
const { requireAdmin } = require('../middleware/auth');
const broadcast = require('../services/broadcast');

const mapPlayer = p => ({
  id:        p.id,
  name:      p.name,
  team:      p.team,
  role:      p.role,
  matches:   p.matches,
  runs:      p.runs,
  balls:     p.balls,
  wickets:   p.wickets,
  avg:       p.avg,
  sr:        p.sr,
  color:     p.color,
  fours:     p.fours,
  sixes:     p.sixes,
  bowlBalls: p.bowl_balls,
  bowlRuns:  p.bowl_runs,
  createdAt: p.created_at,
  updatedAt: p.updated_at,
});

// GET /api/players
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('players').select('*').order('runs', { ascending: false });
    if (error) throw error;
    res.json((data || []).map(mapPlayer));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/players/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('players').select('*').eq('id', req.params.id).single();
    if (error) return res.status(404).json({ error: 'Player not found' });
    res.json(mapPlayer(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/players (admin)
router.post('/', requireAdmin, async (req, res) => {
  const p = req.body;
  if (!p?.name) return res.status(400).json({ error: 'name is required' });
  try {
    const row = {
      name:       p.name,
      team:       p.team       || '',
      role:       p.role       || 'Batsman',
      matches:    p.matches    || 0,
      runs:       p.runs       || 0,
      balls:      p.balls      || 0,
      wickets:    p.wickets    || 0,
      avg:        String(p.avg || '0.0'),
      sr:         String(p.sr  || '0.0'),
      color:      p.color      || '#64748b',
      fours:      p.fours      || 0,
      sixes:      p.sixes      || 0,
      bowl_balls: p.bowlBalls  || 0,
      bowl_runs:  p.bowlRuns   || 0,
    };
    const { data, error } = await supabase.from('players').insert(row).select().single();
    if (error) throw error;
    broadcast.broadcast('players_updated', { action: 'created', id: data.id });
    res.status(201).json(mapPlayer(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/players/:id (admin)
router.put('/:id', requireAdmin, async (req, res) => {
  const p = req.body;
  try {
    const row = {
      ...(p.name      !== undefined && { name:       p.name }),
      ...(p.team      !== undefined && { team:       p.team }),
      ...(p.role      !== undefined && { role:       p.role }),
      ...(p.matches   !== undefined && { matches:    p.matches }),
      ...(p.runs      !== undefined && { runs:       p.runs }),
      ...(p.balls     !== undefined && { balls:      p.balls }),
      ...(p.wickets   !== undefined && { wickets:    p.wickets }),
      ...(p.avg       !== undefined && { avg:        String(p.avg) }),
      ...(p.sr        !== undefined && { sr:         String(p.sr) }),
      ...(p.color     !== undefined && { color:      p.color }),
      ...(p.fours     !== undefined && { fours:      p.fours }),
      ...(p.sixes     !== undefined && { sixes:      p.sixes }),
      ...(p.bowlBalls !== undefined && { bowl_balls: p.bowlBalls }),
      ...(p.bowlRuns  !== undefined && { bowl_runs:  p.bowlRuns }),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('players').update(row).eq('id', req.params.id).select().single();
    if (error) throw error;
    broadcast.broadcast('players_updated', { action: 'updated', id: data.id });
    res.json(mapPlayer(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/players/:id (admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase.from('players').delete().eq('id', req.params.id);
    if (error) throw error;
    broadcast.broadcast('players_updated', { action: 'deleted', id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
