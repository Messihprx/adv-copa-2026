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

app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Preencha todos os campos' });
  const hash = bcrypt.hashSync(password, 10);
  const { data, error } = await supabase.from('users').insert({ username, email, password_hash: hash }).select().single();
  if (error) {
    if (error.code === '23505') return res.status(400).json({ error: 'Usuário ou email já cadastrado' });
    return res.status(500).json({ error: 'Erro ao registrar' });
  }
  const token = jwt.sign({ id: data.id, username: data.username }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: data.id, username: data.username, email: data.email } });
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

app.get('/api/scores', authMiddleware, async (req, res) => {
  const matches = await fetchMatches();
  const finished = matches.filter(m => m.finished === 'TRUE' && parseInt(m.home_score) > 0 || parseInt(m.away_score) > 0 || m.finished === 'TRUE');

  const { data: users } = await supabase.from('users').select('id, username');
  if (!users) return res.json([]);

  const userScores = [];
  for (const u of users) {
    let score = 0;
    const { data: gp } = await supabase.from('group_predictions').select('*').eq('user_id', u.id);
    const { data: kp } = await supabase.from('knockout_predictions').select('*').eq('user_id', u.id);

    const predMap = {};
    if (gp) for (const p of gp) predMap[`g_${p.group_id}`] = p;
    if (kp) for (const p of kp) predMap[p.stage] = p;

    for (const m of finished) {
      const mid = parseInt(m.id);
      const hId = parseInt(m.home_team_id);
      const aId = parseInt(m.away_team_id);
      const hSc = parseInt(m.home_score) || 0;
      const aSc = parseInt(m.away_score) || 0;

      if (m.type === 'group' && m.group) {
        const p = predMap[`g_${m.group}`];
        if (p) {
          const realWinner = hSc > aSc ? hId : (aSc > hSc ? aId : null);
          const predicted = hSc > aSc ? 'home' : (aSc > hSc ? 'away' : 'draw');
          if (hSc !== aSc) {
            const winnerTeamId = hSc > aSc ? hId : aId;
            if (p.first_place_team_id && p.first_place_team_id == winnerTeamId) score += 1;
            if (p.second_place_team_id && p.second_place_team_id == winnerTeamId) score += 1;
          }
        }
      }

      const p = predMap[`m${mid}`];
      if (p && p.team_id) {
        const winner = hSc > aSc ? hId : (aSc > hSc ? aId : null);
        if (winner && p.team_id == winner) {
          const pts = mid <= 88 ? 4 : (mid <= 96 ? 6 : (mid <= 100 ? 8 : (mid <= 102 ? 10 : 15)));
          score += pts;
        }
      }
    }

    const finalP = predMap['final'];
    if (finalP && finalP.team_id) {
      const finalMatch = finished.find(m => m.id == 104);
      if (finalMatch) {
        const fh = parseInt(finalMatch.home_score) || 0;
        const fa = parseInt(finalMatch.away_score) || 0;
        const fWinner = fh > fa ? finalMatch.home_team_id : (fa > fh ? finalMatch.away_team_id : null);
        if (fWinner && finalP.team_id == fWinner) {
          score += 15;
          if (finalP.home_score == fh && finalP.away_score == fa) score += 5;
        }
      }
    }

    const { count: gpCount } = await supabase.from('group_predictions').select('*', { count: 'exact', head: true }).eq('user_id', u.id);
    const { count: kpCount } = await supabase.from('knockout_predictions').select('*', { count: 'exact', head: true }).eq('user_id', u.id);
    userScores.push({ username: u.username, score, groupPredictions: gpCount || 0, knockoutPredictions: kpCount || 0 });
  }

  userScores.sort((a, b) => b.score - a.score);
  res.json(userScores.map((u, i) => ({ rank: i + 1, ...u })));
});

app.get('/api/leaderboard', authMiddleware, async (req, res) => {
  const { data: users, error } = await supabase.from('users').select('id, username');
  if (error) return res.status(500).json({ error: error.message });
  const leaderboard = [];
  for (const u of users) {
    const { count: gpCount } = await supabase.from('group_predictions').select('*', { count: 'exact', head: true }).eq('user_id', u.id);
    const { count: kpCount } = await supabase.from('knockout_predictions').select('*', { count: 'exact', head: true }).eq('user_id', u.id);
    leaderboard.push({ username: u.username, groupPredictions: gpCount || 0, knockoutPredictions: kpCount || 0, total: (gpCount || 0) + (kpCount || 0) });
  }
  leaderboard.sort((a, b) => b.total - a.total);
  res.json(leaderboard.map((u, i) => ({ rank: i + 1, ...u })));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\u{1F525} Servidor rodando em http://localhost:${PORT}`);
});
