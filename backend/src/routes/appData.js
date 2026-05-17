/**
 * routes/appData.js
 * GET  /api/data          — fetch merged app data (match, schedule, banners, scorecards)
 * PUT  /api/data          — update app_data blob (admin only)
 */

const router    = require('express').Router();
const supabase  = require('../config/supabase');
const { requireAdmin } = require('../middleware/auth');
const broadcast = require('../services/broadcast');

// ── GET /api/data ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [appRes, playersRes, teamsRes, matchesRes] = await Promise.all([
      supabase.from('app_data').select('data').eq('id', 'main').single(),
      supabase.from('players').select('*').order('runs', { ascending: false }),
      supabase.from('teams').select('*').order('won', { ascending: false }),
      supabase.from('matches').select('*').order('id', { ascending: false }),
    ]);

    if (appRes.error) throw appRes.error;

    const appData = appRes.data?.data || {};

    const players = (playersRes.data || []).map(p => ({
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
    }));

    const teams = (teamsRes.data || []).map(t => ({
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
    }));

    const recentMatches = (matchesRes.data || []).map(m => ({
      id:         m.id,
      title:      m.title,
      teams:      m.teams,
      t1:         m.t1,
      t2:         m.t2,
      result:     m.result,
      topScorer:  m.top_scorer,
      status:     m.status,
      batting1:   m.batting1 || [],
      batting2:   m.batting2 || [],
      bowling1:   m.bowling1 || [],
      bowling2:   m.bowling2 || [],
    }));

    res.json({ ...appData, players, teams, recentMatches });
  } catch (err) {
    console.error('[GET /api/data]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/data ─────────────────────────────────────────────────────────────
router.put('/', requireAdmin, async (req, res) => {
  const d = req.body;
  if (!d || typeof d !== 'object') return res.status(400).json({ error: 'Body must be JSON object' });

  try {
    const appBlob = {
      liveMatch:         d.liveMatch         || null,
      schedule:          d.schedule          || [],
      banners:           d.banners           || [],
      battingScorecard:  d.battingScorecard  || [],
      bowlingScorecard:  d.bowlingScorecard  || [],
      matchState:        d.matchState        || null,
    };

    const { error: appErr } = await supabase
      .from('app_data')
      .upsert({ id: 'main', data: appBlob, updated_at: new Date().toISOString() });
    if (appErr) throw appErr;

    // Sync players
    if (Array.isArray(d.players) && d.players.length) {
      const rows = d.players.map(p => ({
        ...(p.id ? { id: p.id } : {}),
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
        updated_at: new Date().toISOString(),
      }));
      const { error: pErr } = await supabase.from('players').upsert(rows, { onConflict: 'id' });
      if (pErr) throw pErr;
    }

    // Sync teams
    if (Array.isArray(d.teams) && d.teams.length) {
      const rows = d.teams.map(t => ({
        ...(t.id ? { id: t.id } : {}),
        name:       t.name,
        emoji:      t.emoji      || '🏏',
        color:      t.color      || '#64748b',
        played:     t.played     || 0,
        won:        t.won        || 0,
        lost:       t.lost       || 0,
        nr:         t.nr         || 0,
        nrr:        String(t.nrr || '0.00'),
        captain:    t.captain    || '',
        team_code:  t.code       || '',
        players:    t.players    || [],
        updated_at: new Date().toISOString(),
      }));
      const { error: tErr } = await supabase.from('teams').upsert(rows, { onConflict: 'id' });
      if (tErr) throw tErr;
    }

    // Sync matches
    if (Array.isArray(d.recentMatches) && d.recentMatches.length) {
      const rows = d.recentMatches.map(m => ({
        ...(m.id ? { id: m.id } : {}),
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
        updated_at: new Date().toISOString(),
      }));
      const { error: mErr } = await supabase.from('matches').upsert(rows, { onConflict: 'id' });
      if (mErr) throw mErr;
    }

    // Broadcast live update to all WebSocket clients
    broadcast.broadcast('data_updated', { ts: Date.now() });

    res.json({ ok: true });
  } catch (err) {
    console.error('[PUT /api/data]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
