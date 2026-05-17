/**
 * routes/matches.js
 * GET    /api/matches           — list all matches
 * GET    /api/matches/live      — current live match
 * GET    /api/matches/:id       — single match
 * POST   /api/matches           — create match (admin)
 * PUT    /api/matches/:id       — update match (admin)
 * DELETE /api/matches/:id       — delete match (admin)
 */

const router   = require('express').Router();
const supabase = require('../config/supabase');
const { requireAdmin } = require('../middleware/auth');
const broadcast = require('../services/broadcast');

const mapMatch = m => ({
  id:        m.id,
  title:     m.title,
  teams:     m.teams,
  t1:        m.t1,
  t2:        m.t2,
  result:    m.result,
  topScorer: m.top_scorer,
  status:    m.status,
  batting1:  m.batting1 || [],
  batting2:  m.batting2 || [],
  bowling1:  m.bowling1 || [],
  bowling2:  m.bowling2 || [],
  matchDate: m.match_date,
  createdAt: m.created_at,
  updatedAt: m.updated_at,
});

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('matches').select('*').order('id', { ascending: false });
    if (error) throw error;
    res.json((data || []).map(mapMatch));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/matches/live — shortcut for the current live match
router.get('/live', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('matches').select('*').eq('status', 'live').limit(1).single();
    if (error) return res.json(null); // no live match is fine
    res.json(mapMatch(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('matches').select('*').eq('id', req.params.id).single();
    if (error) return res.status(404).json({ error: 'Match not found' });
    res.json(mapMatch(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  const m = req.body;
  try {
    const row = {
      title:      m.title      || '',
      teams:      m.teams      || '',
      t1:         m.t1         || '',
      t2:         m.t2         || '',
      result:     m.result     || '',
      top_scorer: m.topScorer  || '',
      status:     m.status     || 'upcoming',
      batting1:   m.batting1   || [],
      batting2:   m.batting2   || [],
      bowling1:   m.bowling1   || [],
      bowling2:   m.bowling2   || [],
      match_date: m.matchDate  || null,
    };
    const { data, error } = await supabase.from('matches').insert(row).select().single();
    if (error) throw error;
    broadcast.broadcast('matches_updated', { action: 'created', id: data.id });
    res.status(201).json(mapMatch(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  const m = req.body;
  try {
    const row = {
      ...(m.title     !== undefined && { title:      m.title }),
      ...(m.teams     !== undefined && { teams:      m.teams }),
      ...(m.t1        !== undefined && { t1:         m.t1 }),
      ...(m.t2        !== undefined && { t2:         m.t2 }),
      ...(m.result    !== undefined && { result:     m.result }),
      ...(m.topScorer !== undefined && { top_scorer: m.topScorer }),
      ...(m.status    !== undefined && { status:     m.status }),
      ...(m.batting1  !== undefined && { batting1:   m.batting1 }),
      ...(m.batting2  !== undefined && { batting2:   m.batting2 }),
      ...(m.bowling1  !== undefined && { bowling1:   m.bowling1 }),
      ...(m.bowling2  !== undefined && { bowling2:   m.bowling2 }),
      ...(m.matchDate !== undefined && { match_date: m.matchDate }),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('matches').update(row).eq('id', req.params.id).select().single();
    if (error) throw error;
    broadcast.broadcast('matches_updated', { action: 'updated', id: data.id, status: data.status });
    res.json(mapMatch(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase.from('matches').delete().eq('id', req.params.id);
    if (error) throw error;
    broadcast.broadcast('matches_updated', { action: 'deleted', id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
