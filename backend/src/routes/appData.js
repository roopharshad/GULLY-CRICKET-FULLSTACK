/**
 * routes/appData.js
 * GET  /api/data  — fetch ALL data from Supabase (players, teams, matches, app config)
 * PUT  /api/data  — save live match state only (admin)
 */

const router    = require('express').Router();
const supabase  = require('../config/supabase');
const { requireAdmin } = require('../middleware/auth');
const broadcast = require('../services/broadcast');

// ── GET /api/data ─────────────────────────────────────────────────────────────
// This is the SINGLE endpoint all devices call to get fresh data from Supabase
router.get('/', async (req, res) => {
  try {
    // Fetch all tables in parallel — each query is independent and won't fail others
    const results = await Promise.allSettled([
      supabase.from('app_data').select('data').eq('id', 'main').single(),
      supabase.from('players').select('*').order('runs', { ascending: false }),
      supabase.from('teams').select('*').order('won', { ascending: false }),
      supabase.from('matches').select('*').order('id', { ascending: false }),
    ]);

    // Extract data safely — if any query fails, use empty array
    const appData  = results[0].status === 'fulfilled' ? (results[0].value.data?.data || {}) : {};
    const playersRaw = results[1].status === 'fulfilled' ? (results[1].value.data || []) : [];
    const teamsRaw   = results[2].status === 'fulfilled' ? (results[2].value.data || []) : [];
    const matchesRaw = results[3].status === 'fulfilled' ? (results[3].value.data || []) : [];

    // Log what we are returning so we can debug
    console.log(`[GET /api/data] players:${playersRaw.length} teams:${teamsRaw.length} matches:${matchesRaw.length}`);

    const players = playersRaw.map(p => ({
      id:        p.id,
      name:      p.name,
      team:      p.team,
      role:      p.role        || 'Batsman',
      matches:   p.matches     || 0,
      runs:      p.runs        || 0,
      balls:     p.balls       || 0,
      wickets:   p.wickets     || 0,
      avg:       p.avg         || '0.0',
      sr:        p.sr          || '0.0',
      color:     p.color       || '#64748b',
      fours:     p.fours       || 0,
      sixes:     p.sixes       || 0,
      bowlBalls: p.bowl_balls  || 0,
      bowlRuns:  p.bowl_runs   || 0,
    }));

    const teams = teamsRaw.map(t => ({
      id:      t.id,
      name:    t.name,
      emoji:   t.emoji         || '🏏',
      color:   t.color         || '#64748b',
      played:  t.played        || 0,
      won:     t.won           || 0,
      lost:    t.lost          || 0,
      nr:      t.nr            || 0,
      nrr:     t.nrr           || '0.00',
      captain: t.captain       || '',
      code:    t.team_code     || '',
      players: t.players       || [],
    }));

    const recentMatches = matchesRaw.map(m => ({
      id:        m.id,
      title:     m.title       || '',
      teams:     m.teams       || '',
      t1:        m.t1          || '',
      t2:        m.t2          || '',
      result:    m.result      || '',
      topScorer: m.top_scorer  || '',
      status:    m.status      || 'upcoming',
      batting1:  m.batting1    || [],
      batting2:  m.batting2    || [],
      bowling1:  m.bowling1    || [],
      bowling2:  m.bowling2    || [],
    }));

    res.json({
      ...appData,
      players,
      teams,
      recentMatches,
    });

  } catch (err) {
    console.error('[GET /api/data] fatal:', err.message);
    // Return empty data rather than 500 — frontend will use cache
    res.json({
      players: [], teams: [], recentMatches: [],
      liveMatch: null, schedule: [], banners: [],
      battingScorecard: [], bowlingScorecard: [], matchState: null,
    });
  }
});

// ── PUT /api/data ─────────────────────────────────────────────────────────────
// ONLY saves live match state — players/teams use dedicated routes
router.put('/', requireAdmin, async (req, res) => {
  const d = req.body;
  if (!d || typeof d !== 'object') {
    return res.status(400).json({ error: 'Body must be a JSON object' });
  }

  try {
    const appBlob = {
      liveMatch:        d.liveMatch        || null,
      schedule:         d.schedule         || [],
      banners:          d.banners          || [],
      battingScorecard: d.battingScorecard || [],
      bowlingScorecard: d.bowlingScorecard || [],
      matchState:       d.matchState       || null,
    };

    const { error } = await supabase
      .from('app_data')
      .upsert({ id: 'main', data: appBlob, updated_at: new Date().toISOString() });

    if (error) throw error;

    // Broadcast to all connected WebSocket clients
    broadcast.broadcast('data_updated', { ts: Date.now() });

    res.json({ ok: true });
  } catch (err) {
    console.error('[PUT /api/data]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
