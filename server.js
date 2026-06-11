const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'copa2026-super-secret-key';
const WC_API = 'https://worldcup26.ir';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

let liveMatchesCache = null;
let liveCacheTime = 0;
const CACHE_TTL = 30000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Token não fornecido' });
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

async function fetchMatches() {
  const now = Date.now();
  if (liveMatchesCache && (now - liveCacheTime) < CACHE_TTL) return liveMatchesCache;
  try {
    const res = await fetch(`${WC_API}/get/games`, {
      headers: { 'Accept': 'application/json' }
    });
    const data = await res.json();
    liveMatchesCache = Array.isArray(data) ? data : (data.games || []);
    liveCacheTime = now;
    return liveMatchesCache;
  } catch {
    return liveMatchesCache || [];
  }
}

// ===================== AUTH =====================

app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Preencha todos os campos' });
  const hash = bcrypt.hashSync(password, 10);
  const { error: insErr } = await supabase.from('users').insert({ username, email, password_hash: hash });
  if (insErr) {
    if (insErr.code === '23505') return res.status(400).json({ error: 'Usuário ou email já cadastrado' });
    return res.status(500).json({ error: 'Erro ao registrar' });
  }
  const { data: users } = await supabase.from('users').select('id, username, email').eq('username', username).limit(1);
  if (!users || !users.length) return res.status(500).json({ error: 'Erro ao registrar' });
  const user = users[0];
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Preencha todos os campos' });
  const { data: users, error } = await supabase.from('users').select('*').eq('username', username).limit(1);
  if (error || !users.length) return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  const user = users[0];
  if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
});

app.get('/api/me', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('users').select('id, username, email, created_at').eq('id', req.userId).single();
  if (error) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json(data);
});

app.get('/api/groups', async (req, res) => {
  const { data: groups, error: gErr } = await supabase.from('groups_cup').select('*').order('id');
  if (gErr) return res.status(500).json({ error: gErr.message });
  const { data: teams, error: tErr } = await supabase.from('teams').select('*').order('id');
  if (tErr) return res.status(500).json({ error: tErr.message });
  res.json(groups.map(g => ({ ...g, teams: teams.filter(t => t.group_id === g.id) })));
});

app.get('/api/live-matches', async (req, res) => {
  const matches = await fetchMatches();
  const now = new Date();

  const live = matches.filter(m => m.time_elapsed && m.time_elapsed !== 'notstarted' && m.finished !== 'TRUE');
  const today = matches.filter(m => {
    if (!m.local_date) return false;
    const parts = m.local_date.split(' ');
    if (parts.length < 2) return false;
    const [m1, d1, y1] = parts[0].split('/');
    const d = new Date(`${y1}-${m1}-${d1}T${parts[1]}`);
    return d.toDateString() === now.toDateString() && m.time_elapsed === 'notstarted';
  });
  const upcoming = matches.filter(m => {
    if (m.time_elapsed !== 'notstarted' || m.finished === 'TRUE') return false;
    if (m.local_date) {
      const parts = m.local_date.split(' ');
      if (parts.length >= 2) {
        const [m1, d1, y1] = parts[0].split('/');
        const d = new Date(`${y1}-${m1}-${d1}T${parts[1]}`);
        if (d.toDateString() === now.toDateString()) return false;
      }
    }
    return true;
  }).sort((a, b) => {
    if (!a.local_date || !b.local_date) return 0;
    const pa = a.local_date.split(' '), pb = b.local_date.split(' ');
    if (pa.length < 2 || pb.length < 2) return 0;
    const [ma,da,ya] = pa[0].split('/'), [mb,db,yb] = pb[0].split('/');
    return new Date(`${ya}-${ma}-${da}T${pa[1]}`) - new Date(`${yb}-${mb}-${db}T${pb[1]}`);
  }).slice(0, 8);

  let userPreds = [];
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const { data } = await supabase.from('match_predictions').select('*').eq('user_id', decoded.id);
      if (data) userPreds = data;
    }
  } catch {}

  res.json({ live, today, upcoming, all: matches, userPredictions: userPreds });
});

app.get('/api/locked-matches', async (req, res) => {
  const matches = await fetchMatches();
  const locked = matches.filter(m =>
    m.time_elapsed && m.time_elapsed !== 'notstarted'
  ).map(m => parseInt(m.id));
  res.json(locked);
});

// ===================== PREDICTIONS (CRUD) =====================

app.get('/api/predictions/groups', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('group_predictions').select('*').eq('user_id', req.userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/predictions/groups', authMiddleware, async (req, res) => {
  const matches = await fetchMatches();
  const { predictions } = req.body;
  if (!predictions || !Array.isArray(predictions)) return res.status(400).json({ error: 'Dados inválidos' });

  const locked = new Set();
  for (const m of matches) {
    if (m.time_elapsed && m.time_elapsed !== 'notstarted' && m.type === 'group') {
      locked.add(m.group);
    }
  }

  for (const p of predictions) {
    if (locked.has(p.group_id)) {
      return res.status(400).json({ error: `Grupo ${p.group_id} já começou, palpites bloqueados` });
    }
  }

  const records = predictions.map(p => ({
    user_id: req.userId, group_id: p.group_id,
    first_place_team_id: p.first_place_team_id, second_place_team_id: p.second_place_team_id,
    third_place_team_id: p.third_place_team_id || null
  }));
  const { error } = await supabase.from('group_predictions').upsert(records, { onConflict: 'user_id, group_id' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.get('/api/predictions/third-advancing', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('third_place_advancing').select('team_id').eq('user_id', req.userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(r => r.team_id));
});

app.post('/api/predictions/third-advancing', authMiddleware, async (req, res) => {
  const { team_ids } = req.body;
  if (!Array.isArray(team_ids) || team_ids.length > 8)
    return res.status(400).json({ error: 'No máximo 8 times' });
  const { error: delErr } = await supabase.from('third_place_advancing').delete().eq('user_id', req.userId);
  if (delErr) return res.status(500).json({ error: delErr.message });
  if (team_ids.length) {
    const { error } = await supabase.from('third_place_advancing').insert(
      team_ids.map(tid => ({ user_id: req.userId, team_id: tid }))
    );
    if (error) return res.status(500).json({ error: error.message });
  }
  res.json({ success: true });
});

app.get('/api/predictions/knockout', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('knockout_predictions').select('*').eq('user_id', req.userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/predictions/knockout', authMiddleware, async (req, res) => {
  const matches = await fetchMatches();
  const { predictions } = req.body;
  if (!predictions || !Array.isArray(predictions)) return res.status(400).json({ error: 'Dados inválidos' });

  const startedMap = {};
  for (const m of matches) {
    if (m.time_elapsed && m.time_elapsed !== 'notstarted') {
      startedMap[parseInt(m.id)] = true;
    }
  }

  for (const p of predictions) {
    const mid = parseInt(p.stage.replace('m', ''));
    if (startedMap[mid]) {
      return res.status(400).json({ error: `Jogo ${mid} já começou, palpites bloqueados` });
    }
  }

  const records = predictions.map(p => ({
    user_id: req.userId, stage: p.stage,
    team_id: p.team_id || null, home_score: p.home_score || 0, away_score: p.away_score || 0
  }));
  const { error } = await supabase.from('knockout_predictions').upsert(records, { onConflict: 'user_id, stage' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.get('/api/predictions/match', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('match_predictions').select('*').eq('user_id', req.userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/predictions/match', authMiddleware, async (req, res) => {
  const { match_id, home_score, away_score } = req.body;
  if (!match_id || home_score === undefined || away_score === undefined)
    return res.status(400).json({ error: 'Dados inválidos' });
  const matches = await fetchMatches();
  const match = matches.find(m => parseInt(m.id) === match_id);
  if (!match) return res.status(404).json({ error: 'Jogo não encontrado' });
  if (match.time_elapsed && match.time_elapsed !== 'notstarted')
    return res.status(400).json({ error: 'Jogo já começou, palpite bloqueado' });
  const { error } = await supabase.from('match_predictions').upsert(
    { user_id: req.userId, match_id, home_score: parseInt(home_score), away_score: parseInt(away_score) },
    { onConflict: 'user_id, match_id' }
  );
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.post('/api/predictions/clear-groups', authMiddleware, async (req, res) => {
  const { error: del1 } = await supabase.from('group_predictions').delete().eq('user_id', req.userId);
  if (del1) return res.status(500).json({ error: del1.message });
  const { error: del2 } = await supabase.from('third_place_advancing').delete().eq('user_id', req.userId);
  if (del2) return res.status(500).json({ error: del2.message });
  const { error: del3 } = await supabase.from('knockout_predictions').delete().eq('user_id', req.userId);
  if (del3) return res.status(500).json({ error: del3.message });
  res.json({ success: true });
});

// ===================== SCORING ENGINE =====================

function getActualGroupStandings(matches) {
  const groups = {};
  for (const m of matches) {
    if (m.type !== 'group' || m.finished !== 'TRUE') continue;
    const g = m.group;
    if (!groups[g]) groups[g] = {};
    const hid = parseInt(m.home_team_id), aid = parseInt(m.away_team_id);
    const hs = parseInt(m.home_score)||0, as = parseInt(m.away_score)||0;
    if (!groups[g][hid]) groups[g][hid] = { id: hid, p: 0, gf: 0, ga: 0 };
    if (!groups[g][aid]) groups[g][aid] = { id: aid, p: 0, gf: 0, ga: 0 };
    groups[g][hid].gf += hs; groups[g][hid].ga += as;
    groups[g][aid].gf += as; groups[g][aid].ga += hs;
    if (hs > as) groups[g][hid].p += 3;
    else if (as > hs) groups[g][aid].p += 3;
    else { groups[g][hid].p += 1; groups[g][aid].p += 1; }
  }
  const result = {};
  for (const g of Object.keys(groups).sort()) {
    result[g] = Object.values(groups[g]).sort((a, b) => {
      if (b.p !== a.p) return b.p - a.p;
      const gdA = a.gf - a.ga, gdB = b.gf - b.ga;
      return gdB - gdA || b.gf - a.gf;
    });
  }
  return result;
}

function getThirdPlaceRanking(standings) {
  const thirds = [];
  for (const g of Object.keys(standings)) {
    if (standings[g].length >= 3) {
      thirds.push({ ...standings[g][2], group: g });
    }
  }
  return thirds.sort((a, b) => {
    if (b.p !== a.p) return b.p - a.p;
    const gdA = a.gf - a.ga, gdB = b.gf - b.ga;
    return gdB - gdA || b.gf - a.gf;
  }).slice(0, 8);
}

function getKnockoutWinner(match) {
  if (match.finished !== 'TRUE') return null;
  const hs = parseInt(match.home_score)||0, as = parseInt(match.away_score)||0;
  if (hs > as) return parseInt(match.home_team_id);
  if (as > hs) return parseInt(match.away_team_id);
  return null;
}

function getStagePoints(matchId, type) {
  if (type === 'third') return 30;
  if (type === 'final') return 0; // handled separately
  const id = parseInt(matchId);
  if (id <= 88) return 20; // R32
  if (id <= 96) return 20; // R16
  if (id <= 100) return 30; // QF
  if (id <= 102) return 50; // SF
  return 0;
}

async function calculateUserFullScore(userId, matches) {
  const allMatches = matches || await fetchMatches();
  const finished = allMatches.filter(m => m.finished === 'TRUE');
  const standings = getActualGroupStandings(finished);
  const topThirds = getThirdPlaceRanking(standings);
  const advancingThirdIds = new Set(topThirds.map(t => t.id));

  const { data: gp } = await supabase.from('group_predictions').select('*').eq('user_id', userId);
  const { data: ta } = await supabase.from('third_place_advancing').select('team_id').eq('user_id', userId);
  const { data: kp } = await supabase.from('knockout_predictions').select('*').eq('user_id', userId);
  const { data: mp } = await supabase.from('match_predictions').select('*').eq('user_id', userId);

  const breakdown = [];
  let total = 0;

  // --- GROUP STAGE ---
  const userGroupMap = {};
  if (gp) for (const p of gp) userGroupMap[p.group_id] = p;

  for (const [g, teams] of Object.entries(standings)) {
    if (teams.length < 2) continue;
    const actualFirst = teams[0].id;
    const actualSecond = teams[1].id;
    const pred = userGroupMap[g];
    if (!pred) continue;

    const check = (position, predictedId, actualId, actualFirstId, actualSecondId) => {
      // 10pts for correct qualification (top 2)
      if (predictedId === actualFirstId || predictedId === actualSecondId) {
        breakdown.push({
          category: 'group_qualify', reference_id: g, subreference_id: String(predictedId),
          points: 10, reason: `${getTeamName(predictedId)} classificado no Grupo ${g}`
        });
        total += 10;
        // +15 for correct position
        if (predictedId === actualId) {
          breakdown.push({
            category: 'group_position', reference_id: g, subreference_id: String(predictedId),
            points: 15, reason: `${getTeamName(predictedId)} em ${position}º no Grupo ${g}`
          });
          total += 15;
        }
      }
    };

    if (pred.first_place_team_id) {
      check('1º', pred.first_place_team_id, actualFirst, actualFirst, actualSecond);
    }
    if (pred.second_place_team_id) {
      check('2º', pred.second_place_team_id, actualSecond, actualFirst, actualSecond);
    }
  }

  // --- THIRD PLACE ADVANCING ---
  if (ta && advancingThirdIds.size === 8) {
    const userThirdIds = new Set(ta.map(t => t.team_id));
    for (const tid of userThirdIds) {
      if (advancingThirdIds.has(tid)) {
        breakdown.push({
          category: 'third_advance', reference_id: String(tid), subreference_id: null,
          points: 10, reason: `${getTeamName(tid)} entre os 8 melhores terceiros`
        });
        total += 10;
      }
    }
  }

  // --- KNOCKOUT ---
  const koMap = {};
  if (kp) for (const p of kp) koMap[p.stage] = p;

  for (const m of finished) {
    if (m.type === 'group') continue;
    const mid = parseInt(m.id);

    // Skip third place and final (handled separately)
    if (m.type === 'third' || m.type === 'final') continue;

    if (m.type === 'r32' || m.type === 'r16' || m.type === 'qf' || m.type === 'sf') {
      const winner = getKnockoutWinner(m);
      if (!winner) continue;
      const pred = koMap[`m${mid}`];
      if (pred && pred.team_id == winner) {
        const pts = getStagePoints(mid, m.type);
        const stageNames = { r32: 'Rodada de 32', r16: 'Oitavas', qf: 'Quartas', sf: 'Semifinais' };
        breakdown.push({
          category: 'knockout', reference_id: `m${mid}`, subreference_id: String(winner),
          points: pts, reason: `${getTeamName(winner)} avançou nas ${stageNames[m.type]||m.type}`
        });
        total += pts;
      }
    }
  }

  // --- THIRD PLACE MATCH ---
  const thirdMatch = finished.find(m => m.type === 'third');
  if (thirdMatch) {
    const winner = getKnockoutWinner(thirdMatch);
    if (winner) {
      const pred = koMap['m103'];
      if (pred && pred.team_id == winner) {
        breakdown.push({
          category: 'third_place', reference_id: 'm103', subreference_id: String(winner),
          points: 30, reason: `${getTeamName(winner)} venceu a disputa de 3º lugar`
        });
        total += 30;
      }
    }
  }

  // --- FINAL ---
  const finalMatch = finished.find(m => m.type === 'final');
  if (finalMatch) {
    const fhs = parseInt(finalMatch.home_score)||0, fas = parseInt(finalMatch.away_score)||0;
    const fWinnerId = fhs > fas ? parseInt(finalMatch.home_team_id) : (fas > fhs ? parseInt(finalMatch.away_team_id) : null);
    const fLoserId = fhs > fas ? parseInt(finalMatch.away_team_id) : (fas > fhs ? parseInt(finalMatch.home_team_id) : null);

    const pred = koMap['final'];
    if (pred && pred.team_id) {
      // Champion
      if (fWinnerId && pred.team_id == fWinnerId) {
        breakdown.push({
          category: 'champion', reference_id: 'final', subreference_id: String(fWinnerId),
          points: 100, reason: `${getTeamName(fWinnerId)} campeão!`
        });
        total += 100;
      }
      // Vice
      if (fLoserId && pred.team_id == fLoserId) {
        breakdown.push({
          category: 'vice', reference_id: 'final', subreference_id: String(fLoserId),
          points: 50, reason: `${getTeamName(fLoserId)} vice-campeão`
        });
        total += 50;
      }
    }

    // Final match prediction (score guess)
    // Check if user has a match_prediction for the final
    const finalMp = mp ? mp.find(p => p.match_id == 104) : null;
    if (finalMp) {
      if (finalMp.home_score == fhs && finalMp.away_score == fas) {
        breakdown.push({
          category: 'final_exact', reference_id: '104', subreference_id: null,
          points: 200, reason: 'Placar exato da final!'
        });
        total += 200;
      } else if (fWinnerId && ((finalMp.home_score > finalMp.away_score && fhs > fas) ||
                 (finalMp.away_score > finalMp.home_score && fas > fhs) ||
                 (finalMp.home_score === finalMp.away_score && fhs === fas))) {
        breakdown.push({
          category: 'final_winner', reference_id: '104', subreference_id: null,
          points: 50, reason: 'Acertou o vencedor da final'
        });
        total += 50;
      }
    }
  }

  // --- MATCH PREDICTIONS (group stage + non-final KO) ---
  const predMap = {};
  if (mp) for (const p of mp) predMap[p.match_id] = p;

  for (const m of finished) {
    const mid = parseInt(m.id);
    const pred = predMap[mid];
    if (!pred) continue;
    const realH = parseInt(m.home_score)||0, realA = parseInt(m.away_score)||0;
    let pts = 0, reason = '';
    if (realH === pred.home_score && realA === pred.away_score) {
      pts = 10;
      reason = `Placar exato: ${realH}x${realA}`;
    } else if (
      (realH > realA && pred.home_score > pred.away_score) ||
      (realA > realH && pred.away_score > pred.home_score) ||
      (realH === realA && pred.home_score === pred.away_score)
    ) {
      pts = 5;
      reason = `Vencedor/empate certo: ${m.home_team_name_en} ${realH}x${realA} ${m.away_team_name_en}`;
    }
    if (pts > 0) {
      breakdown.push({
        category: 'match_prediction', reference_id: String(mid), subreference_id: null,
        points: pts, reason: reason
      });
      total += pts;
      // Update stored points
      if (pts !== (pred.points || 0)) {
        await supabase.from('match_predictions').update({ points: pts }).eq('id', pred.id).eq('points', pred.points || 0);
      }
    }
  }

  return { total, breakdown };
}

let teamNameCache = {};
async function getTeamName(id) {
  if (teamNameCache[id]) return teamNameCache[id];
  const { data } = await supabase.from('teams').select('name').eq('id', id).single();
  const name = data ? data.name : `Time #${id}`;
  teamNameCache[id] = name;
  return name;
}

// ===================== SCORING ENDPOINTS =====================

app.get('/api/history', authMiddleware, async (req, res) => {
  const matches = await fetchMatches();
  const finished = matches.filter(m => m.finished === 'TRUE');
  const { data: predictions, error } = await supabase.from('match_predictions').select('*').eq('user_id', req.userId);
  if (error) return res.status(500).json({ error: error.message });
  const predMap = {};
  if (predictions) for (const p of predictions) predMap[p.match_id] = p;
  const result = [];
  for (const m of finished) {
    const mid = parseInt(m.id);
    const pred = predMap[mid];
    const entry = {
      id: mid,
      home_team_name_en: m.home_team_name_en, away_team_name_en: m.away_team_name_en,
      home_score: parseInt(m.home_score) || 0, away_score: parseInt(m.away_score) || 0,
      local_date: m.local_date, type: m.type, group: m.group,
      user_prediction: pred ? { home_score: pred.home_score, away_score: pred.away_score } : null,
      points: 0
    };
    if (pred) {
      const realH = parseInt(m.home_score) || 0;
      const realA = parseInt(m.away_score) || 0;
      if (realH === pred.home_score && realA === pred.away_score) {
        entry.points = 10;
      } else if ((realH > realA && pred.home_score > pred.away_score) ||
                 (realA > realH && pred.away_score > pred.home_score) ||
                 (realH === realA && pred.home_score === pred.away_score)) {
        entry.points = 5;
      }
      if (entry.points !== (pred.points || 0)) {
        await supabase.from('match_predictions').update({ points: entry.points }).eq('id', pred.id);
      }
    }
    result.push(entry);
  }
  result.sort((a, b) => b.id - a.id);
  res.json(result);
});

app.get('/api/calculate-scores', authMiddleware, async (req, res) => {
  try {
    const matches = await fetchMatches();
    const { data: users } = await supabase.from('users').select('id, username');
    if (!users) return res.json({ error: 'Nenhum usuário' });

    // Clear old scoring history for recalculation
    await supabase.from('scoring_history').delete().neq('id', 0);

    teamNameCache = {};
    const allResults = [];

    for (const u of users) {
      const { total, breakdown } = await calculateUserFullScore(u.id, matches);
      allResults.push({ user_id: u.id, username: u.username, total, breakdown });

      // Store in scoring_history
      if (breakdown.length) {
        const records = breakdown.map(b => ({
          user_id: u.id,
          category: b.category,
          reference_id: b.reference_id,
          subreference_id: b.subreference_id,
          points: b.points,
          reason: b.reason
        }));
        await supabase.from('scoring_history').insert(records);
      }
    }

    allResults.sort((a, b) => b.total - a.total);
    res.json(allResults.map((r, i) => ({ rank: i + 1, ...r })));
  } catch (err) {
    console.error('Calculate scores error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/scores', authMiddleware, async (req, res) => {
  try {
    const matches = await fetchMatches();
    const { data: users } = await supabase.from('users').select('id, username');
    if (!users) return res.json([]);

    // Try to use cached scoring_history first
    const { data: history } = await supabase.from('scoring_history').select('user_id, points');
    let scoreMap = {};
    if (history && history.length) {
      for (const h of history) {
        scoreMap[h.user_id] = (scoreMap[h.user_id] || 0) + h.points;
      }
      // If history exists, check if any new finished matches need recalculation
      const finishedCount = matches.filter(m => m.finished === 'TRUE').length;
      if (finishedCount === 0) {
        // No finished matches, return empty scores
        return res.json(users.map(u => ({
          username: u.username, score: 0, totalScore: 0,
          groupPredictions: 0, knockoutPredictions: 0
        })));
      }
    }

    // Full recalculation
    teamNameCache = {};
    const allResults = [];

    for (const u of users) {
      const { total } = await calculateUserFullScore(u.id, matches);
      const { count: gpCount } = await supabase.from('group_predictions').select('*', { count: 'exact', head: true }).eq('user_id', u.id);
      const { count: kpCount } = await supabase.from('knockout_predictions').select('*', { count: 'exact', head: true }).eq('user_id', u.id);
      allResults.push({ username: u.username, score: total, totalScore: total, groupPredictions: gpCount || 0, knockoutPredictions: kpCount || 0 });
    }

    allResults.sort((a, b) => b.totalScore - a.totalScore);
    res.json(allResults.map((u, i) => ({ rank: i + 1, ...u })));
  } catch (err) {
    console.error('Scores error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/leaderboard', authMiddleware, async (req, res) => {
  try {
    const { data: users, error: uErr } = await supabase.from('users').select('id, username');
    if (uErr) return res.status(500).json({ error: uErr.message });
    if (!users) return res.json([]);

    teamNameCache = {};
    const leaderboard = [];

    for (const u of users) {
      const { total } = await calculateUserFullScore(u.id);
      const { count: gpCount } = await supabase.from('group_predictions').select('*', { count: 'exact', head: true }).eq('user_id', u.id);
      const { count: kpCount } = await supabase.from('knockout_predictions').select('*', { count: 'exact', head: true }).eq('user_id', u.id);
      leaderboard.push({ username: u.username, groupPredictions: gpCount || 0, knockoutPredictions: kpCount || 0, totalScore: total });
    }

    leaderboard.sort((a, b) => b.totalScore - a.totalScore);
    res.json(leaderboard.map((u, i) => ({ rank: i + 1, ...u })));
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/my-score', authMiddleware, async (req, res) => {
  try {
    const matches = await fetchMatches();
    teamNameCache = {};
    const { total, breakdown } = await calculateUserFullScore(req.userId, matches);
    res.json({ total, breakdown });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\u{1F525} Servidor rodando em http://localhost:${PORT}`);
});
