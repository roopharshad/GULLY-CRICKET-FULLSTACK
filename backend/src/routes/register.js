/**
 * routes/register.js
 * POST /api/register — public self-registration
 * Creates user + team (if new) + player record atomically
 */

const router   = require('express').Router();
const supabase = require('../config/supabase');
const broadcast = require('../services/broadcast');

router.post('/', async (req, res) => {
  const { name, phone, password, role, team, isNewTeam, player, teamData } = req.body;
  if (!phone || !name || !password || !team) {
    return res.status(400).json({ error: 'name, phone, password, team are required' });
  }

  try {
    // 1. Upsert user
    const { data: userData, error: uErr } = await supabase
      .from('users')
      .upsert({ phone, name, password, role: role || 'fan', team }, { onConflict: 'phone' })
      .select().single();
    if (uErr) throw uErr;

    // 2. Create or update team
    if (isNewTeam && teamData) {
      const teamRow = {
        name:      teamData.name,
        emoji:     teamData.emoji     || '🏏',
        color:     teamData.color     || '#64748b',
        played:    0, won: 0, lost: 0, nr: 0,
        nrr:       '0.00',
        captain:   teamData.captain   || name,
        team_code: teamData.code      || '',
        players:   teamData.players   || [name],
      };
      await supabase.from('teams').upsert(teamRow, { onConflict: 'name' });
    } else {
      // Add player to existing team's players array
      const { data: existingTeam } = await supabase
        .from('teams').select('id,players').eq('name', team).single();
      if (existingTeam) {
        const players = existingTeam.players || [];
        if (!players.includes(name)) {
          players.push(name);
          await supabase.from('teams').update({ players, updated_at: new Date().toISOString() })
            .eq('id', existingTeam.id);
        }
      }
    }

    // 3. Add player stats record (only if not already there)
    const { data: existingPlayer } = await supabase
      .from('players').select('id').eq('name', name).eq('team', team).single();
    if (!existingPlayer) {
      const pRow = {
        name,
        team,
        role:       (player && player.role) || role || 'Batsman',
        matches:    0, runs: 0, balls: 0, wickets: 0,
        avg:        '0.0', sr: '0.0',
        color:      (player && player.color) || '#64748b',
        fours: 0, sixes: 0, bowl_balls: 0, bowl_runs: 0,
      };
      await supabase.from('players').insert(pRow);
    }

    // Broadcast update to all connected clients
    broadcast.broadcast('data_updated', { ts: Date.now(), source: 'registration' });

    res.status(201).json({ ok: true, user: { id: userData.id, name, phone, team } });
  } catch (err) {
    console.error('[POST /api/register]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
