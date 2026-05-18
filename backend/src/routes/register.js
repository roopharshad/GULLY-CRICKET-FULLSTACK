/**
 * routes/register.js
 * POST /api/register — public self-registration
 * Saves: user + team (new or existing) + player stats
 * This is the SINGLE source of truth for registration
 */

const router    = require('express').Router();
const supabase  = require('../config/supabase');
const broadcast = require('../services/broadcast');

router.post('/', async (req, res) => {
  const { name, phone, password, role, team, isNewTeam, player, teamData } = req.body;

  console.log('[register] incoming:', { name, phone, team, isNewTeam });

  if (!phone || !name || !password || !team) {
    return res.status(400).json({ error: 'name, phone, password, team are required' });
  }

  const errors = [];

  // ── 1. Upsert user ────────────────────────────────────────────────────────
  const { data: userData, error: uErr } = await supabase
    .from('users')
    .upsert({ phone, name, password, role: role || 'fan', team }, { onConflict: 'phone' })
    .select().single();

  if (uErr) {
    console.error('[register] user upsert failed:', uErr.message);
    return res.status(500).json({ error: uErr.message });
  }
  console.log('[register] user saved ✅', userData.id);

  // ── 2. Team — create new or add player to existing ────────────────────────
  if (isNewTeam && teamData) {
    // Create new team
    const teamRow = {
      name:      team,
      emoji:     teamData.emoji   || '🏏',
      color:     teamData.color   || '#64748b',
      played:    0, won: 0, lost: 0, nr: 0,
      nrr:       '0.00',
      captain:   name,
      team_code: teamData.code    || '',
      players:   JSON.stringify([name]),
    };
    const { error: tErr } = await supabase
      .from('teams')
      .upsert(teamRow, { onConflict: 'name' });
    if (tErr) { errors.push('team: ' + tErr.message); console.error('[register] team create failed:', tErr.message); }
    else console.log('[register] new team created ✅', team);
  } else {
    // Add player name to existing team's players array
    const { data: existingTeam, error: tFindErr } = await supabase
      .from('teams').select('id, players').ilike('name', team).single();

    if (existingTeam) {
      let players = existingTeam.players || [];
      if (typeof players === 'string') { try { players = JSON.parse(players); } catch(_) { players = []; } }
      if (!players.includes(name)) {
        players.push(name);
        const { error: tUpdErr } = await supabase
          .from('teams')
          .update({ players: JSON.stringify(players), updated_at: new Date().toISOString() })
          .eq('id', existingTeam.id);
        if (tUpdErr) { errors.push('team update: ' + tUpdErr.message); console.error('[register] team update failed:', tUpdErr.message); }
        else console.log('[register] added to existing team ✅', team);
      }
    } else {
      // Team doesn't exist yet — create it
      console.log('[register] team not found, creating:', team);
      const teamRow = {
        name:      team,
        emoji:     '🏏',
        color:     '#64748b',
        played:    0, won: 0, lost: 0, nr: 0,
        nrr:       '0.00',
        captain:   name,
        team_code: '',
        players:   JSON.stringify([name]),
      };
      const { error: tCrErr } = await supabase.from('teams').upsert(teamRow, { onConflict: 'name' });
      if (tCrErr) { errors.push('team create: ' + tCrErr.message); console.error('[register] team create failed:', tCrErr.message); }
      else console.log('[register] team auto-created ✅', team);
    }
  }

  // ── 3. Player stats — insert if not already there ─────────────────────────
  const { data: existingPlayer } = await supabase
    .from('players').select('id').eq('name', name).eq('team', team).maybeSingle();

  if (!existingPlayer) {
    const pRow = {
      name,
      team,
      role:      (player && player.role) || 'Batsman',
      matches:   0, runs: 0, balls: 0, wickets: 0,
      avg:       '0.0', sr: '0.0',
      color:     (player && player.color) || '#64748b',
      fours: 0, sixes: 0, bowl_balls: 0, bowl_runs: 0,
    };
    const { error: pErr } = await supabase.from('players').insert(pRow);
    if (pErr) { errors.push('player: ' + pErr.message); console.error('[register] player insert failed:', pErr.message); }
    else console.log('[register] player stats created ✅', name, team);
  } else {
    console.log('[register] player already exists, skipping insert', name, team);
  }

  // ── 4. Broadcast to all connected clients ─────────────────────────────────
  broadcast.broadcast('data_updated', { ts: Date.now(), source: 'registration', name, team });

  res.status(201).json({
    ok: true,
    errors: errors.length ? errors : undefined,
    user: { id: userData.id, name, phone, team }
  });
});

module.exports = router;
