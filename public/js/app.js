const API = '/api';
let token = localStorage.getItem('token');
let currentUser = null;
let groupsData = [];
let groupPredictions = {};
let knockoutPredictions = {};
let thirdPlaceAdvancing = [];
let matchPredictions = [];
let matchTimerInterval = null;
let bracketState = {};
let lockedMatches = [];
let liveInterval = null;
let resultsInterval = null;
let scoreUpdateInterval = null;

const FLAG_CODES = {
  'M\u00e9xico': 'mx', '\u00c1frica do Sul': 'za', 'Coreia do Sul': 'kr', 'Rep\u00fablica Tcheca': 'cz',
  'Canad\u00e1': 'ca', 'B\u00f3snia e Herzegovina': 'ba', 'Catar': 'qa', 'Su\u00ed\u00e7a': 'ch',
  'Brasil': 'br', 'Marrocos': 'ma', 'Haiti': 'ht', 'Esc\u00f3cia': 'gb-sct',
  'Estados Unidos': 'us', 'Paraguai': 'py', 'Austr\u00e1lia': 'au', 'Turquia': 'tr',
  'Alemanha': 'de', 'Cura\u00e7ao': 'cw', 'Costa do Marfim': 'ci', 'Equador': 'ec',
  'Holanda': 'nl', 'Jap\u00e3o': 'jp', 'Su\u00e9cia': 'se', 'Tun\u00edsia': 'tn',
  'B\u00e9lgica': 'be', 'Egito': 'eg', 'Ir\u00e3': 'ir', 'Nova Zel\u00e2ndia': 'nz',
  'Espanha': 'es', 'Cabo Verde': 'cv', 'Ar\u00e1bia Saudita': 'sa', 'Uruguai': 'uy',
  'Fran\u00e7a': 'fr', 'Senegal': 'sn', 'Iraque': 'iq', 'Noruega': 'no',
  'Argentina': 'ar', 'Arg\u00e9lia': 'dz', '\u00c1ustria': 'at', 'Jord\u00e2nia': 'jo',
  'Portugal': 'pt', 'RD Congo': 'cd', 'Uzbequist\u00e3o': 'uz', 'Col\u00f4mbia': 'co',
  'Inglaterra': 'gb-eng', 'Cro\u00e1cia': 'hr', 'Gana': 'gh', 'Panam\u00e1': 'pa'
};

const STAGE_NAMES = { group: 'Fase de Grupos', r32: 'Rodada de 32', r16: 'Oitavas', qf: 'Quartas', sf: 'Semi', third: '3\u00ba lugar', final: 'Final' };

const API_FLAGS = {
  'Mexico': 'mx', 'South Africa': 'za', 'South Korea': 'kr', 'Korea Republic': 'kr', 'Czech Republic': 'cz', 'Czechia': 'cz',
  'Canada': 'ca', 'Bosnia and Herzegovina': 'ba', 'Qatar': 'qa', 'Switzerland': 'ch',
  'Brazil': 'br', 'Morocco': 'ma', 'Haiti': 'ht', 'Scotland': 'gb-sct',
  'USA': 'us', 'United States': 'us', 'Paraguay': 'py', 'Australia': 'au', 'Turkey': 'tr', 'T\u00fcrkiye': 'tr',
  'Germany': 'de', 'Cura\u00e7ao': 'cw', 'Curacao': 'cw', 'Ivory Coast': 'ci', 'C\u00f4te d\'Ivoire': 'ci', 'Ecuador': 'ec',
  'Netherlands': 'nl', 'Japan': 'jp', 'Sweden': 'se', 'Tunisia': 'tn',
  'Belgium': 'be', 'Egypt': 'eg', 'Iran': 'ir', 'IR Iran': 'ir', 'New Zealand': 'nz',
  'Spain': 'es', 'Cape Verde': 'cv', 'Saudi Arabia': 'sa', 'Uruguay': 'uy',
  'France': 'fr', 'Senegal': 'sn', 'Iraq': 'iq', 'Norway': 'no',
  'Argentina': 'ar', 'Algeria': 'dz', 'Austria': 'at', 'Jordan': 'jo',
  'Portugal': 'pt', 'Colombia': 'co', 'Uzbekistan': 'uz', 'Democratic Republic of the Congo': 'cd', 'Congo DR': 'cd',
  'England': 'gb-eng', 'Croatia': 'hr', 'Ghana': 'gh', 'Panama': 'pa'
};

function liveFlag(name) {
  const c = API_FLAGS[name] || 'unknown';
  return `https://flagcdn.com/24x18/${c}.png`;
}
function liveFlagImg(name) {
  const c = API_FLAGS[name];
  if (!c) return '';
  return `<img src="https://flagcdn.com/24x18/${c}.png" alt="${name}" style="width:22px;height:auto;border-radius:2px;vertical-align:middle;margin:0 6px;">`;
}

const STADIUM_TZ = {
  '1': -6, '2': -6, '3': -6, '4': -5, '5': -5, '6': -5,
  '7': -4, '8': -4, '9': -4, '10': -4, '11': -4, '12': -4,
  '13': -7, '14': -7, '15': -7, '16': -7
};
function parseBrasilia(localDate, stadiumId) {
  if (!localDate) return '';
  const parts = localDate.split(' ');
  if (parts.length < 2) return localDate;
  const [mo, da, ye] = parts[0].split('/');
  const [hh, mi] = parts[1].split(':');
  const stdTz = STADIUM_TZ[stadiumId] || -5;
  const d = new Date(Date.UTC(parseInt(ye), parseInt(mo) - 1, parseInt(da), parseInt(hh) - stdTz, parseInt(mi)));
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function flagUrl(name) { const c = FLAG_CODES[name] || 'unknown'; return `https://flagcdn.com/24x18/${c}.png`; }
function flagImg(name, size) { const s = size || 20; return `<img src="${flagUrl(name)}" alt="${name}" style="width:${s}px;height:auto;border-radius:2px;vertical-align:middle;margin-right:${s > 20 ? '8' : '6'}px;">`; }
function showToast(msg, type) {
  const t = document.getElementById('saveToast');
  t.textContent = msg; t.className = 'save-toast show';
  if (type === 'error') { t.style.background = 'var(--red)'; t.style.color = '#fff'; }
  else { t.style.background = 'var(--green)'; t.style.color = '#000'; }
  setTimeout(() => t.classList.remove('show'), 2800);
}

async function apiCall(path, opts) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`${API}${path}`, { ...opts, headers });
    if (res.status === 401 && path !== '/login' && path !== '/register') { localStorage.removeItem('token'); token = null; showAuth(); return null; }
    return res.json();
  } catch { return null; }
}

function showAuth() { document.getElementById('authContainer').style.display = 'flex'; document.getElementById('appContainer').classList.remove('show'); }
function showApp() { document.getElementById('authContainer').style.display = 'none'; document.getElementById('appContainer').classList.add('show'); }
function logout() { localStorage.removeItem('token'); token = null; currentUser = null; if (liveInterval) clearInterval(liveInterval); if (liveScoreInterval) clearInterval(liveScoreInterval); showAuth(); }

document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab + 'Form').classList.add('active');
    document.getElementById('authError').classList.remove('show');
  });
});

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault(); const u = document.getElementById('loginUsername').value, p = document.getElementById('loginPassword').value;
  const btn = document.querySelector('#loginForm .btn'); btn.disabled = true;
  const d = await apiCall('/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) }); btn.disabled = false;
  if (d?.error) { const e = document.getElementById('authError'); e.textContent = d.error; e.classList.add('show'); return; }
  token = d.token; currentUser = d.user; localStorage.setItem('token', token); initApp();
});
document.getElementById('registerForm').addEventListener('submit', async e => {
  e.preventDefault(); const u = document.getElementById('regUsername').value, em = document.getElementById('regEmail').value, p = document.getElementById('regPassword').value;
  const btn = document.querySelector('#registerForm .btn'); btn.disabled = true;
  const d = await apiCall('/register', { method: 'POST', body: JSON.stringify({ username: u, email: em, password: p }) }); btn.disabled = false;
  if (d?.error) { const e = document.getElementById('authError'); e.textContent = d.error; e.classList.add('show'); return; }
  token = d.token; currentUser = d.user; localStorage.setItem('token', token); initApp();
});

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('show'));
    item.classList.add('active');
    const pid = 'page' + item.dataset.page.charAt(0).toUpperCase() + item.dataset.page.slice(1);
    document.getElementById(pid).classList.add('show');
    if (item.dataset.page === 'home') renderLiveMatches();
    if (item.dataset.page === 'results') renderResults();
    if (item.dataset.page === 'knockout') { buildBracket(); renderBracket(); }
    if (item.dataset.page === 'leaderboard') loadLeaderboard();
    if (item.dataset.page === 'history') loadHistory();
    if (item.dataset.page === 'info') renderInfo();
    if (item.dataset.page === 'profile') renderProfile();
  });
});

async function initApp() {
  showApp();
  document.getElementById('headerUsername').textContent = currentUser.username;
  document.getElementById('headerAvatar').textContent = currentUser.username.charAt(0).toUpperCase();
  groupsData = await apiCall('/groups') || [];
  const saved = await apiCall('/predictions/groups') || [];
  groupPredictions = {};
  for (const p of saved) groupPredictions[p.group_id] = { first: p.first_place_team_id, second: p.second_place_team_id, third: p.third_place_team_id };
  const savedKO = await apiCall('/predictions/knockout') || [];
  knockoutPredictions = {};
  for (const p of savedKO) knockoutPredictions[p.stage] = { team_id: p.team_id, home_score: p.home_score, away_score: p.away_score };
  thirdPlaceAdvancing = await apiCall('/predictions/third-advancing') || [];
  matchPredictions = await apiCall('/predictions/match') || [];
  await loadLocked();
  renderGroups();
  buildBracket(); renderBracket();
  renderLiveMatches();
  if (liveInterval) clearInterval(liveInterval);
  liveInterval = setInterval(renderLiveMatches, 45000);
  if (resultsInterval) clearInterval(resultsInterval);
  resultsInterval = setInterval(renderResults, 30000);
}

async function loadLocked() {
  const d = await apiCall('/locked-matches');
  lockedMatches = d || [];
}

function getTeam(id) {
  if (!id) return null;
  for (const g of groupsData) { const t = g.teams.find(t => t.id == id); if (t) return t; }
  return null;
}

function renderGroups() {
  const c = document.getElementById('groupsContainer');
  if (!groupsData.length) { c.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>'; return; }
  let h = '<div class="groups-grid">';
  for (const g of groupsData) {
    const p = groupPredictions[g.id] || {};
    const hasAll = p.first && p.second && p.third;
    const st = hasAll ? 'done' : 'pending';
    const stxt = hasAll ? 'Completo' : 'Pendente';
    h += `<div class="group-card"><div class="group-header"><div class="group-name"><div class="group-badge">${g.id}</div><span class="group-title">${g.name}</span></div><span class="group-status ${st}">${hasAll ? '✅' : '⏳'} ${stxt}</span></div><div class="team-list">`;
    const order = [];
    for (const t of g.teams) {
      let cls = '', badge = '', pos = 0;
      if (p.first == t.id) { cls = 'selected-first'; badge = '<span class="badge badge-1st">1\u00ba</span>'; pos = 1; }
      else if (p.second == t.id) { cls = 'selected-second'; badge = '<span class="badge badge-2nd">2\u00ba</span>'; pos = 2; }
      else if (p.third == t.id) { cls = 'selected-third'; badge = '<span class="badge badge-3rd">3\u00ba</span>'; pos = 3; }
      order.push({ pos, html: `<div class="team-item ${cls}" onclick="pickTeam('${g.id}',${t.id})">${flagImg(t.name, 22)}<span class="name">${t.name}</span>${badge}<div class="pick-btn">${pos ? '#' + pos : ''}</div></div>` });
    }
    order.sort((a, b) => (a.pos === 0 ? 1 : 0) - (b.pos === 0 ? 1 : 0) || a.pos - b.pos);
    for (const o of order) h += o.html;
    h += `</div></div>`;
  }
  h += '</div>';
  const thirdTeams = [];
  for (const g of groupsData) { const p = groupPredictions[g.id]; if (p && p.third) { const t = getTeam(p.third); if (t) thirdTeams.push(t); } }
  if (thirdTeams.length === 12) {
    const sel = thirdPlaceAdvancing.length;
    h += `<div class="third-section"><div class="section-title">\uD83C\uDFC6 8 Melhores Terceiros</div><p class="third-desc">Selecione quais 8 dos 12 terceiros colocados avan\u00e7am para o mata-mata.</p><div class="third-count">${sel} de 8 classificados</div><div class="third-grid">`;
    for (const t of thirdTeams) {
      const adv = thirdPlaceAdvancing.includes(t.id);
      h += `<div class="third-item${adv ? ' selected' : ''}" onclick="toggleThirdAdvancing(${t.id})">${flagImg(t.name, 22)}<span>${t.name}</span><span class="third-check">${adv ? '\u2714' : ''}</span></div>`;
    }
    h += `</div>`;
    if (sel < 8) h += `<div class="third-warning">Selecione exatamente 8 terceiros para liberar o mata-mata</div>`;
    else h += `<div class="third-ok">\u2705 8 terceiros selecionados! O chaveamento ser\u00e1 gerado automaticamente.</div>`;
    h += `</div>`;
  }
  c.innerHTML = h; updateGroupsProgress();
}

function pickTeam(gid, tid) {
  if (!groupPredictions[gid]) groupPredictions[gid] = { first: null, second: null, third: null };
  const p = groupPredictions[gid];
  if (p.first == tid) { p.first = null; renderGroups(); return; }
  if (p.second == tid) { p.second = null; renderGroups(); return; }
  if (p.third == tid) { p.third = null; renderGroups(); return; }
  if (!p.first) { p.first = tid; renderGroups(); return; }
  if (!p.second && p.first != tid) { p.second = tid; renderGroups(); return; }
  if (!p.third && p.first != tid && p.second != tid) { p.third = tid; renderGroups(); return; }
}

function toggleThirdAdvancing(tid) {
  const idx = thirdPlaceAdvancing.indexOf(tid);
  if (idx >= 0) { thirdPlaceAdvancing.splice(idx, 1); renderGroups(); return; }
  if (thirdPlaceAdvancing.length >= 8) return;
  thirdPlaceAdvancing.push(tid);
  renderGroups();
}

function updateGroupsProgress() {
  let c = 0; for (const g of groupsData) { const p = groupPredictions[g.id]; if (p && p.first && p.second && p.third) c++; }
  document.getElementById('groupsCount').textContent = c;
  document.getElementById('groupsProgress').style.width = `${(c / 12) * 100}%`;
}

async function saveGroupPredictions() {
  const preds = [];
  for (const g of groupsData) { const p = groupPredictions[g.id]; if (p && p.first && p.second && p.third) preds.push({ group_id: g.id, first_place_team_id: p.first, second_place_team_id: p.second, third_place_team_id: p.third }); }
  if (!preds.length) { showToast('Selecione pelo menos um grupo completo', 'error'); return; }
  if (thirdPlaceAdvancing.length !== 8) { showToast('Selecione exatamente 8 terceiros classificados', 'error'); return; }
  const btn = document.querySelector('#pageGroups .save-bar .btn'); btn.disabled = true; btn.textContent = 'Salvando...';
  const r = await apiCall('/predictions/groups', { method: 'POST', body: JSON.stringify({ predictions: preds }) });
  if (r?.error) { btn.disabled = false; btn.textContent = 'Salvar Palpites'; showToast(r.error, 'error'); return; }
  const r2 = await apiCall('/predictions/third-advancing', { method: 'POST', body: JSON.stringify({ team_ids: thirdPlaceAdvancing }) });
  if (r2?.error) { btn.disabled = false; btn.textContent = 'Salvar Palpites'; showToast(r2.error, 'error'); return; }
  btn.disabled = false; btn.textContent = 'Salvar Palpites';
  showToast('Palpites salvos!'); buildBracket(); renderBracket();
}

const BRACKET = {
  round32: [
    { id: 73, label: 'M73', home: '2A', away: '2B', r16: 90, side: 'home' },
    { id: 75, label: 'M75', home: '1F', away: '2C', r16: 90, side: 'away' },
    { id: 74, label: 'M74', home: '1E', away: '3ABCDEF', r16: 89, side: 'home' },
    { id: 77, label: 'M77', home: '1I', away: '3CDFGH', r16: 89, side: 'away' },
    { id: 76, label: 'M76', home: '1C', away: '2F', r16: 91, side: 'home' },
    { id: 78, label: 'M78', home: '2E', away: '2I', r16: 91, side: 'away' },
    { id: 79, label: 'M79', home: '1A', away: '3CEFHI', r16: 92, side: 'home' },
    { id: 80, label: 'M80', home: '1L', away: '3EHIJK', r16: 92, side: 'away' },
    { id: 83, label: 'M83', home: '2K', away: '2L', r16: 93, side: 'home' },
    { id: 84, label: 'M84', home: '1H', away: '2J', r16: 93, side: 'away' },
    { id: 81, label: 'M81', home: '1D', away: '3BEFIJ', r16: 94, side: 'home' },
    { id: 82, label: 'M82', home: '1G', away: '3AEHIJ', r16: 94, side: 'away' },
    { id: 86, label: 'M86', home: '1J', away: '2H', r16: 95, side: 'home' },
    { id: 88, label: 'M88', home: '2D', away: '2G', r16: 95, side: 'away' },
    { id: 85, label: 'M85', home: '1B', away: '3EFGIJ', r16: 96, side: 'home' },
    { id: 87, label: 'M87', home: '1K', away: '3DEIJL', r16: 96, side: 'away' }
  ],
  round16: [
    { id: 89, home: 74, away: 77, qf: 97, side: 'home' }, { id: 90, home: 73, away: 75, qf: 97, side: 'away' },
    { id: 91, home: 76, away: 78, qf: 99, side: 'home' }, { id: 92, home: 79, away: 80, qf: 99, side: 'away' },
    { id: 93, home: 83, away: 84, qf: 98, side: 'home' }, { id: 94, home: 81, away: 82, qf: 98, side: 'away' },
    { id: 95, home: 86, away: 88, qf: 100, side: 'home' }, { id: 96, home: 85, away: 87, qf: 100, side: 'away' }
  ],
  quarters: [
    { id: 97, home: 89, away: 90, sf: 101, side: 'home' }, { id: 98, home: 93, away: 94, sf: 101, side: 'away' },
    { id: 99, home: 91, away: 92, sf: 102, side: 'home' }, { id: 100, home: 95, away: 96, sf: 102, side: 'away' }
  ],
  semis: [{ id: 101, home: 97, away: 98 }, { id: 102, home: 99, away: 100 }],
  third: { id: 103, home: 101, away: 102, type: 'third' },
  finalMatch: { id: 104, home: 101, away: 102, type: 'final' }
};

function buildBracket() {
  bracketState = { round32: {}, round16: {}, quarters: {}, semis: {}, third: { winner: null, home: null, away: null }, final: { winner: null, home: null, away: null, homeScore: 0, awayScore: 0 } };
  const thirdMapping = thirdPlaceAdvancing.length === 8 ? assignThirdPlaceSlots() : null;
  for (const m of BRACKET.round32) {
    let ht = resolveTeam(m.home), at = resolveTeam(m.away);
    if (isSlotThird(m.away) && thirdMapping && thirdMapping[m.id]) at = getTeam(thirdMapping[m.id]);
    bracketState.round32[m.id] = { home: ht?.id || null, away: at?.id || null, winner: null };
  }
  for (const m of BRACKET.round32) { const s = knockoutPredictions[`m${m.id}`]; if (s && s.team_id) bracketState.round32[m.id].winner = s.team_id; }
  for (const m of BRACKET.round16) { const s = knockoutPredictions[`m${m.id}`]; if (s && s.team_id) bracketState.round16[m.id] = { winner: s.team_id }; }
  for (const m of BRACKET.quarters) { const s = knockoutPredictions[`m${m.id}`]; if (s && s.team_id) bracketState.quarters[m.id] = { winner: s.team_id }; }
  for (const m of BRACKET.semis) { const s = knockoutPredictions[`m${m.id}`]; if (s && s.team_id) bracketState.semis[m.id] = { winner: s.team_id }; }
  if (knockoutPredictions['third'] && knockoutPredictions['third'].team_id) bracketState.third.winner = knockoutPredictions['third'].team_id;
  if (knockoutPredictions['final']) { const f = knockoutPredictions['final']; if (f.team_id) bracketState.final.winner = f.team_id; bracketState.final.homeScore = f.home_score || 0; bracketState.final.awayScore = f.away_score || 0; }
  propagateBracket();
}

function propagateBracket() {
  for (const m of BRACKET.round32) {
    const s = bracketState.round32[m.id];
    if (!s || !s.winner) continue;
    const r16 = BRACKET.round16.find(x => x.id === m.r16);
    if (!r16) continue;
    if (!bracketState.round16[r16.id]) bracketState.round16[r16.id] = { home: null, away: null, winner: null };
    bracketState.round16[r16.id][m.side] = s.winner;
  }
  for (const m of BRACKET.round16) {
    const s = bracketState.round16[m.id];
    if (!s || !s.winner) continue;
    const q = BRACKET.quarters.find(x => x.id === m.qf);
    if (!q) continue;
    if (!bracketState.quarters[q.id]) bracketState.quarters[q.id] = { home: null, away: null, winner: null };
    bracketState.quarters[q.id][m.side] = s.winner;
  }
  for (const m of BRACKET.quarters) {
    const s = bracketState.quarters[m.id];
    if (!s || !s.winner) continue;
    const sf = BRACKET.semis.find(x => x.id === m.sf);
    if (!sf) continue;
    if (!bracketState.semis[sf.id]) bracketState.semis[sf.id] = { home: null, away: null, winner: null };
    bracketState.semis[sf.id][m.side] = s.winner;
  }
  for (const m of BRACKET.semis) {
    const s = bracketState.semis[m.id];
    if (!s || !s.winner) continue;
    const side = m.id === 101 ? 'home' : 'away';
    bracketState.final[side] = s.winner;
  }
  const s1 = bracketState.semis[101], s2 = bracketState.semis[102];
  if (s1 && s1.winner && s1.home && s1.away) bracketState.third.home = s1.home === s1.winner ? s1.away : s1.home;
  if (s2 && s2.winner && s2.home && s2.away) bracketState.third.away = s2.home === s2.winner ? s2.away : s2.home;
}

function getGroupIdFromTeam(tid) {
  for (const g of groupsData) { if (g.teams.some(t => t.id == tid)) return g.id; }
  return null;
}

function resolveTeam(slot) {
  if (!slot) return null;
  if (slot.startsWith('1') || slot.startsWith('2')) {
    const pos = slot[0] === '1' ? 'first' : 'second', gid = slot[1], p = groupPredictions[gid];
    if (!p) return null; const tid = pos === 'first' ? p.first : p.second; return getTeam(tid);
  }
  return null;
}

function assignThirdPlaceSlots() {
  if (thirdPlaceAdvancing.length !== 8) return null;
  const thirdSlots = BRACKET.round32.filter(m => isSlotThird(m.away));
  const mapping = {};
  const used = new Set();
  function backtrack(idx) {
    if (idx >= thirdSlots.length) return true;
    const m = thirdSlots[idx];
    const gs = m.away.replace('3', '').match(/[A-L]/g) || [];
    for (const tid of thirdPlaceAdvancing) {
      if (used.has(tid)) continue;
      const gid = getGroupIdFromTeam(tid);
      if (!gs.includes(gid)) continue;
      mapping[m.id] = tid;
      used.add(tid);
      if (backtrack(idx + 1)) return true;
      used.delete(tid);
      delete mapping[m.id];
    }
    return false;
  }
  return backtrack(0) ? mapping : null;
}

function isSlotThird(slot) { return slot && slot.startsWith('3'); }
function getEligibleThird(slot) {
  if (!slot || !slot.startsWith('3')) return [];
  const gs = slot.replace('3', '').match(/[A-L]/g) || [], cand = [];
  for (const g of groupsData) {
    if (!gs.includes(g.id)) continue;
    const p = groupPredictions[g.id]; if (!p || !p.first || !p.second) continue;
    const used = [p.first, p.second];
    for (const t of g.teams) if (!used.includes(t.id)) cand.push(t);
  }
  return cand;
}

function selectKnockoutWinner(round, matchId, teamId) {
  if (round === 'final' && matchId === 104) {
    const side = bracketState.final.home && bracketState.final.home == teamId ? 'home' : 'away';
    if (!bracketState.final.home || !bracketState.final.away) return;
    bracketState.final.winner = teamId;
    renderBracket(); return;
  }
  if (!bracketState[round]) bracketState[round] = {};
  if (!bracketState[round][matchId]) bracketState[round][matchId] = { home: null, away: null, winner: null };
  bracketState[round][matchId].winner = teamId;
  if (round === 'round32') {
    const m = BRACKET.round32.find(x => x.id === matchId);
    if (m) {
      const r16m = BRACKET.round16.find(x => x.id === m.r16);
      if (r16m) {
        const slot = m.side === 'home' ? 'home' : 'away';
        if (!bracketState.round16[m.r16]) bracketState.round16[m.r16] = { home: null, away: null, winner: null };
        bracketState.round16[m.r16][slot] = teamId; bracketState.round16[m.r16].winner = null;
      }
    }
  }
  if (round === 'round16') {
    const m = BRACKET.round16.find(x => x.id === matchId);
    if (m) {
      const qm = BRACKET.quarters.find(x => x.id === m.qf);
      if (qm) {
        const slot = m.side === 'home' ? 'home' : 'away';
        if (!bracketState.quarters[m.qf]) bracketState.quarters[m.qf] = { home: null, away: null, winner: null };
        bracketState.quarters[m.qf][slot] = teamId; bracketState.quarters[m.qf].winner = null;
      }
    }
  }
  if (round === 'quarters') {
    const m = BRACKET.quarters.find(x => x.id === matchId);
    if (m) {
      const sm = BRACKET.semis.find(x => x.id === m.sf);
      if (sm) {
        const slot = m.side === 'home' ? 'home' : 'away';
        if (!bracketState.semis[m.sf]) bracketState.semis[m.sf] = { home: null, away: null, winner: null };
        bracketState.semis[m.sf][slot] = teamId; bracketState.semis[m.sf].winner = null;
      }
    }
  }
  if (round === 'semis') {
    const side = matchId === 101 ? 'home' : 'away';
    bracketState.final[side] = teamId; bracketState.final.winner = null;
    const m = bracketState.semis[matchId];
    if (m && m.home && m.away) {
      const loser = m.home === teamId ? m.away : m.home;
      if (matchId === 101) bracketState.third.home = loser;
      else bracketState.third.away = loser;
    }
    bracketState.third.winner = null;
  }
  if (round === 'third' && matchId === 103) {
    bracketState.third.winner = teamId;
    renderBracket(); return;
  }
  renderBracket();
}

function renderBracket() {
  const c = document.getElementById('knockoutContainer');
  if (!groupsData.length || !Object.keys(groupPredictions).length) {
    c.innerHTML = '<div class="empty-state"><span class="icon">\uD83C\uDFC6</span><h3>Fa\u00e7a os palpites dos grupos primeiro</h3><p>Volte na aba Grupos e selecione quem passa em 1\u00ba, 2\u00ba e 3\u00ba</p></div>'; return;
  }
  if (thirdPlaceAdvancing.length !== 8 || !BRACKET.round32.every(m => bracketState.round32[m.id]?.home && bracketState.round32[m.id]?.away)) {
    const nf = BRACKET.round32.filter(m => !bracketState.round32[m.id]?.home || !bracketState.round32[m.id]?.away).length;
    c.innerHTML = `<div class="empty-state"><span class="icon">\uD83D\uDD14</span><h3>Aguardando distribui\u00e7\u00e3o autom\u00e1tica</h3><p>${nf} confrontos ainda n\u00e3o definidos. Volte em Grupos e selecione os 8 terceiros.</p></div>`; return;
  }
  function mc(tid, click, isWinner) {
    const t = getTeam(tid); if (!t) return '<div class="ms">---</div>';
    return `<div class="ms${isWinner ? ' msw' : ''}" ${click ? `onclick="${click}"` : ''}><span class="msf">${flagImg(t.name, 18)}</span><span class="msn">${t.name}</span></div>`;
  }
  function row(m) {
    const s = bracketState.round32[m.id] || {}, ht = s?.home, at = s?.away, wn = s?.winner;
    const locked = lockedMatches.includes(m.id);
    const is3 = isSlotThird(m.away);
    const hc = ht && !locked ? `selectKnockoutWinner('round32',${m.id},${ht})` : null;
    const ac = at && !locked ? `selectKnockoutWinner('round32',${m.id},${at})` : null;
    return `<div class="match">${mc(ht, hc, wn && wn == ht)}<div class="msep"><span class="ml">${m.label}</span>${wn && wn == ht ? '<span class="mx">\u2714</span>' : 'VS'}</div>${mc(at, ac, wn && wn == at)}${locked ? '<div class="mlock">\uD83D\uDD12</div>' : ''}</div>`;
  }
  function col(matches, roundKey, roundLabel) {
    let h = `<div class="bcol"><div class="brl">${roundLabel}</div>`;
    for (const m of matches) {
      if (roundKey === 'r32') { h += row(m); continue; }
      const s = bracketState[roundKey]?.[m.id];
      if (!s) continue;
      const ht = s.home, at = s.away, wn = s.winner;
      const locked = lockedMatches.includes(m.id);
      const rk = roundKey === 'round16' ? 'round16' : roundKey === 'quarters' ? 'quarters' : 'semis';
      const hc = ht && !locked ? `selectKnockoutWinner('${rk}',${m.id},${ht})` : null;
      const ac = at && !locked ? `selectKnockoutWinner('${rk}',${m.id},${at})` : null;
      h += `<div class="match">${mc(ht, hc, wn && wn == ht)}<div class="msep"><span class="ml">M${m.id}</span>${wn && wn == ht ? '<span class="mx">\u2714</span>' : 'VS'}</div>${mc(at, ac, wn && wn == at)}${locked ? '<div class="mlock">\uD83D\uDD12</div>' : ''}</div>`;
    }
    h += `</div>`; return h;
  }
  let h = `<div class="bracket-wrapper">`;
  h += `<div class="bgrid">`;
  h += col(BRACKET.round32, 'r32', 'Rodada de 32');
  h += col(BRACKET.round16, 'round16', 'Oitavas');
  h += col(BRACKET.quarters, 'quarters', 'Quartas');
  h += col(BRACKET.semis, 'semis', 'Semifinais');
  const fs = bracketState.final || {}, fh = getTeam(fs.home), fa = getTeam(fs.away), fw = getTeam(fs.winner);
  const ts = bracketState.third || {}, th = getTeam(ts.home), ta = getTeam(ts.away), tw = getTeam(ts.winner);
  h += `<div class="bcol bcol-final"><div class="brl">Finais</div>
    <div class="third-match"><div class="ml bronze">3\u00ba</div>${th ? mc(th.id, th && !tw && !lockedMatches.includes(103) ? `selectKnockoutWinner('third',103,${th.id})` : null, tw && tw.id == th.id) : '<div class="ms">---</div>'}<div class="msep">VS</div>${ta ? mc(ta.id, ta && !tw && !lockedMatches.includes(103) ? `selectKnockoutWinner('third',103,${ta.id})` : null, tw && tw.id == ta.id) : '<div class="ms">---</div>'}${tw ? `<div class="mt bronze">\uD83E\uDD49${flagImg(tw.name, 14)}${tw.name}</div>` : ''}${lockedMatches.includes(103) ? '<div class="mlock">\uD83D\uDD12</div>' : ''}</div>
    <div class="final-match"><div class="ml gold">\uD83C\uDFC6Final</div>
      <div class="final-team-score-row">${mc(fs.home, fh && !fs.winner ? `selectKnockoutWinner('final',104,${fs.home})` : null, fw && fw.id == fs.home)}<input type="number" min="0" max="20" class="si" id="fhScore" value="${fs.homeScore || ''}" placeholder="0" onchange="updateFinalScore()"></div>
      <div class="msep">VS</div>
      <div class="final-team-score-row">${mc(fs.away, fa && !fs.winner ? `selectKnockoutWinner('final',104,${fs.away})` : null, fw && fw.id == fs.away)}<input type="number" min="0" max="20" class="si" id="faScore" value="${fs.awayScore || ''}" placeholder="0" onchange="updateFinalScore()"></div>
      ${fw ? `<div class="mt champ">\uD83C\uDFC6${flagImg(fw.name, 20)}${fw.name}</div>` : ''}
    </div></div>`;
  h += `</div></div>`;
  c.innerHTML = h;
}

function updateFinalScore() {
  const h = parseInt(document.getElementById('fhScore')?.value) || 0, a = parseInt(document.getElementById('faScore')?.value) || 0;
  if (!bracketState.final) bracketState.final = {};
  bracketState.final.homeScore = h; bracketState.final.awayScore = a;
}

async function saveKnockoutPredictions() {
  const preds = [];
  for (const m of BRACKET.round32) { const s = bracketState.round32[m.id]; if (s && s.winner && !lockedMatches.includes(m.id)) preds.push({ stage: `m${m.id}`, team_id: s.winner }); }
  for (const m of BRACKET.round16) { const s = bracketState.round16[m.id]; if (s && s.winner) preds.push({ stage: `m${m.id}`, team_id: s.winner }); }
  for (const m of BRACKET.quarters) { const s = bracketState.quarters[m.id]; if (s && s.winner) preds.push({ stage: `m${m.id}`, team_id: s.winner }); }
  for (const m of BRACKET.semis) { const s = bracketState.semis[m.id]; if (s && s.winner) preds.push({ stage: `m${m.id}`, team_id: s.winner }); }
  if (bracketState.third && bracketState.third.winner) preds.push({ stage: 'third', team_id: bracketState.third.winner });
  const f = bracketState.final; if (f && f.winner) preds.push({ stage: 'final', team_id: f.winner, home_score: f.homeScore || 0, away_score: f.awayScore || 0 });
  if (!preds.length) { showToast('Selecione pelo menos um vencedor', 'error'); return; }
  const btn = document.querySelector('#pageKnockout .save-bar .btn'); btn.disabled = true; btn.textContent = 'Salvando...';
  const r = await apiCall('/predictions/knockout', { method: 'POST', body: JSON.stringify({ predictions: preds }) });
  btn.disabled = false; btn.textContent = 'Salvar Palpites';
  if (r?.error) { showToast(r.error, 'error'); return; }
  showToast('Palpites salvos!');
}

function showClearModal() {
  document.getElementById('clearModal').classList.add('show');
}
function hideClearModal() {
  document.getElementById('clearModal').classList.remove('show');
}
async function confirmClearPredictions() {
  hideClearModal();
  const r = await apiCall('/predictions/clear-groups', { method: 'POST' });
  if (r?.error) { showToast(r.error, 'error'); return; }
  groupPredictions = {}; thirdPlaceAdvancing = []; knockoutPredictions = {};
  renderGroups(); buildBracket(); renderBracket();
  showToast('Palpites limpos!');
}

let matchModalMatchId = null, matchModalLocked = false;
function showMatchModal(mid, homeN, awayN) {
  matchModalMatchId = mid;
  const pred = matchPredictions.find(p => p.match_id == mid);
  document.getElementById('matchModalHomeScore').value = pred?.home_score || '';
  document.getElementById('matchModalAwayScore').value = pred?.away_score || '';
  document.getElementById('matchModalHomeName').textContent = homeN;
  document.getElementById('matchModalAwayName').textContent = awayN;
  document.getElementById('matchModalTitle').textContent = `⚽ ${homeN} vs ${awayN}`;
  document.getElementById('matchModal').classList.add('show');
  startMatchTimer(mid);
}
function hideMatchModal() {
  document.getElementById('matchModal').classList.remove('show');
  if (matchTimerInterval) clearInterval(matchTimerInterval);
  matchTimerInterval = null;
}
async function saveMatchPrediction() {
  if (matchModalLocked) { showToast('Jogo já começou, palpite bloqueado', 'error'); hideMatchModal(); return; }
  const hs = parseInt(document.getElementById('matchModalHomeScore').value) || 0;
  const as = parseInt(document.getElementById('matchModalAwayScore').value) || 0;
  const r = await apiCall('/predictions/match', { method: 'POST', body: JSON.stringify({ match_id: matchModalMatchId, home_score: hs, away_score: as }) });
  if (r?.error) { showToast(r.error, 'error'); return; }
  matchPredictions = await apiCall('/predictions/match') || [];
  hideMatchModal(); renderLiveMatches(); showToast('Palpite salvo!');
}
function startMatchTimer(mid) {
  if (matchTimerInterval) clearInterval(matchTimerInterval);
  const d = document.getElementById('matchModalTimer');
  matchTimerInterval = setInterval(async function () {
    const matches = await apiCall('/live-matches');
    const match = matches?.all?.find(m => parseInt(m.id) === mid);
    if (!match || !match.local_date) { d.textContent = ''; return; }
    const parts = match.local_date.split(' ');
    if (parts.length < 2) { d.textContent = ''; return; }
    const [mo, da, ye] = parts[0].split('/');
    const [hh, mi] = parts[1].split(':');
    const stdTz = STADIUM_TZ[match.stadium_id] || -5;
    const matchUtc = Date.UTC(parseInt(ye), parseInt(mo) - 1, parseInt(da), parseInt(hh) - stdTz, parseInt(mi));
    const now = Date.now();
    const diff = matchUtc - now;
    if (diff <= 0) { d.textContent = '⏰ Jogo começou!'; matchModalLocked = true; clearInterval(matchTimerInterval); matchTimerInterval = null; return; }
    if (diff < 60000) { d.textContent = '⏰ Menos de 1 minuto!'; matchModalLocked = true; }
    else {
      const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
      d.textContent = `⏳ Palpite disponível por mais: ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      matchModalLocked = false;
    }
  }, 1000);
}

function liveCardBadge(status) {
  if (status === 'live') return '<span class="live-badge live"><span class="dot-pulse"></span> AO VIVO</span>';
  if (status === 'finished') return '<span class="live-badge finished">✅ Encerrado</span>';
  return '<span class="live-badge upcoming">⏳ Aguardando</span>';
}

function formatStatus(m) {
  const short = m.status_short;
  if (!short) return m.time_elapsed || '';
  if (short === 'NS') return 'Não Começou';
  if (short === '1H') return m.live_minute ? `1ºT ${m.live_minute}'` : '1º Tempo';
  if (short === 'HT') return 'Intervalo';
  if (short === '2H') return m.live_minute ? `2ºT ${m.live_minute}'` : '2º Tempo';
  if (short === 'ET') return m.live_minute ? `${m.live_minute}'` : '';
  if (short === 'P' || short === 'PEN') return 'Pênaltis';
  if (short === 'FT' || short === 'AET') return 'Encerrado';
  if (short === 'SUSP') return 'Suspenso';
  return short;
}

function formatMatchDate(m) {
  if (m.iso_date || m.timestamp) {
    const d = m.timestamp ? new Date(m.timestamp * 1000) : new Date(m.iso_date);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  return parseBrasilia(m.local_date, m.stadium_id);
}

function formatScoreBreakdown(m) {
  if (!m.score_halftime || (m.score_halftime.home === null && m.score_fulltime?.home === null)) return '';
  let html = '<div class="match-score-breakdown">';
  if (m.score_halftime.home !== null) html += `<span><small>HT</small> ${m.score_halftime.home}x${m.score_halftime.away}</span>`;
  if (m.score_fulltime.home !== null) html += `<span><small>FT</small> ${m.score_fulltime.home}x${m.score_fulltime.away}</span>`;
  if (m.score_extratime?.home !== null) html += `<span><small>ET</small> ${m.score_extratime.home}x${m.score_extratime.away}</span>`;
  if (m.score_penalty?.home !== null) html += `<span><small>PEN</small> ${m.score_penalty.home}x${m.score_penalty.away}</span>`;
  html += '</div>';
  return html;
}

function userPredictionHtml(mid, homeN, awayN) {
  const pred = matchPredictions.find(p => p.match_id == mid);
  if (!pred) return `<button class="btn btn-sm btn-guess" onclick="showMatchModal(${mid},'${homeN.replace(/'/g, "\\'")}','${awayN.replace(/'/g, "\\'")}')">🔮 Adivinhar</button>`;
  return `<div class="my-prediction"><div class="pred-label">Meu palpite:</div><div class="pred-score">${liveFlagImg(homeN)}${homeN} <strong>${pred.home_score}</strong> x <strong>${pred.away_score}</strong> ${liveFlagImg(awayN)}${awayN}</div></div>`;
}

async function renderLiveMatches() {
  const c = document.getElementById('liveContainer');
  const d = await apiCall('/live-matches');
  if (!d) { c.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>'; return; }
  if (d.userPredictions) matchPredictions = d.userPredictions;
  const live = d.live || [], today = d.today || [], upcoming = d.upcoming || [];
  let h = '';
  if (live.length) {
    h += `<div class="section-title"><span class="dot-pulse"></span> ${live.length} jogo(s) ao vivo agora</div><div class="live-grid">`;
    for (const m of live) {
      const homeN = m.home_team_name_en || 'Time A', awayN = m.away_team_name_en || 'Time B';
      const hs = m.home_score || 0, as = m.away_score || 0;
      const mid = parseInt(m.id);
      h += `<div class="live-card live-card-live" data-match-id="${mid}">
        <div class="live-teams">
          <div class="live-team">${liveFlagImg(homeN)}<span class="team-name">${homeN}</span></div>
          <div class="live-score-row"><span class="live-score big">${hs}</span><span class="live-score-sep">x</span><span class="live-score big">${as}</span></div>
          <div class="live-team"><span class="team-name">${awayN}</span>${liveFlagImg(awayN)}</div>
        </div>
        ${formatScoreBreakdown(m)}
        <div class="live-meta">
          <span class="live-stage">${STAGE_NAMES[m.type] || m.group || ''}</span>
          <span class="live-meta-right">
            <span class="live-time">${formatMatchDate(m)}</span>
            <span class="live-time-elapsed">${formatStatus(m)}</span>
          </span>
        </div>
        ${userPredictionHtml(mid, homeN, awayN)}
      </div>`;
    }
    h += '</div>';
  }
  if (today.length) {
    h += `<div class="section-title">\uD83D\uDDC3\uFE0F Jogos de Hoje</div><div class="live-grid">`;
    for (const m of today) {
      const homeN = m.home_team_name_en || 'Time A', awayN = m.away_team_name_en || 'Time B';
      const brTime = formatMatchDate(m);
      h += `<div class="live-card live-card-today">
        ${liveCardBadge('upcoming')}
        <div class="live-badge time">\uD83D\uDD51 ${brTime || 'Hoje'}</div>
        <div class="live-teams">
          <div class="live-team">${liveFlagImg(homeN)}<span class="team-name">${homeN}</span></div>
          <span class="live-score">vs</span>
          <div class="live-team"><span class="team-name">${awayN}</span>${liveFlagImg(awayN)}</div>
        </div>
        <div class="live-meta">
          <span class="live-stage">${STAGE_NAMES[m.type] || m.group || ''}</span>
          <span class="live-meta-right"><span class="live-time-elapsed">${formatStatus(m)}</span></span>
        </div>
        ${userPredictionHtml(parseInt(m.id), homeN, awayN)}
      </div>`;
    }
    h += '</div>';
  }
  if (upcoming.length) {
    h += `<div class="section-title">\uD83D\uDCC5 Pr\u00f3ximos Jogos</div><div class="live-grid">`;
    for (const m of upcoming.slice(0, 6)) {
      const homeN = m.home_team_name_en || 'TBD', awayN = m.away_team_name_en || 'TBD';
      const brTime = formatMatchDate(m);
      h += `<div class="live-card live-card-upcoming">
        <div class="live-badge time">\uD83D\uDD51 ${brTime || 'Agendado'}</div>
        <div class="live-teams">
          <div class="live-team">${homeN !== 'TBD' ? liveFlagImg(homeN) : ''}<span class="team-name">${homeN}</span></div>
          <span class="live-score">vs</span>
          <div class="live-team"><span class="team-name">${awayN}</span>${awayN !== 'TBD' ? liveFlagImg(awayN) : ''}</div>
        </div>
        <div class="live-meta">
          <span class="live-stage">${STAGE_NAMES[m.type] || m.group || ''}</span>
          <span class="live-meta-right"><span class="live-time-elapsed">${formatStatus(m)}</span></span>
        </div>
      </div>`;
    }
    h += '</div>';
  }
  if (!live.length && !today.length && !upcoming.length) {
    h = `<div class="live-empty"><span class="icon">\uD83C\uDFC6</span><h3>Nenhum jogo rolando no momento</h3><p>Volte durante a Copa do Mundo 2026 para acompanhar os jogos ao vivo!<br>A Copa come\u00e7a em 11 de junho de 2026.</p></div>`;
  }
  h += renderGroupScheduleCards();
  h += renderKnockoutSchedule(d.all || []);
  c.innerHTML = h;
  startLiveScoreUpdates();
  attachGroupCardEvents();
}

function renderGroupScheduleCards() {
  if (!groupsData.length) return '';
  let h = `<div class="section-title" style="margin-top:32px">\uD83C\uDFC6 Programação dos Grupos</div>`;
  h += `<div class="groups-schedule-grid">`;
  for (const g of groupsData) {
    let flagsHtml = '';
    for (const t of g.teams) {
      flagsHtml += `<span class="gs-flag">${flagImg(t.name, 26)}</span>`;
    }
    h += `<div class="gs-card" data-group="${g.id}">
      <div class="gs-header">
        <div class="group-badge">${g.id}</div>
        <span class="gs-name">${g.name}</span>
      </div>
      <div class="gs-flags">${flagsHtml}</div>
      <div class="gs-arrow">\u25BC</div>
      <div class="gs-matches" id="gsMatches_${g.id}"></div>
    </div>`;
  }
  h += `</div>`;
  return h;
}

function attachGroupCardEvents() {
  document.querySelectorAll('.gs-card').forEach(card => {
    card.addEventListener('click', async function(e) {
      if (e.target.closest('.gs-matches')) return;
      const gid = this.dataset.group;
      const container = this.querySelector('.gs-matches');
      if (container.innerHTML) {
        container.innerHTML = '';
        this.classList.remove('expanded');
        return;
      }
      this.classList.add('expanded');
      container.innerHTML = '<div class="loading-spinner" style="padding:16px"><div class="spinner"></div></div>';
      const d = await apiCall('/live-matches');
      if (!d || !d.all) { container.innerHTML = ''; return; }
      const groupMatches = d.all.filter(m => m.type === 'group' && m.group === gid)
        .sort((a, b) => {
          const dateA = a.local_date || '', dateB = b.local_date || '';
          return dateA.localeCompare(dateB);
        });
      if (!groupMatches.length) { container.innerHTML = '<div class="gs-empty">Nenhuma partida</div>'; return; }
      let html = '';
      for (const m of groupMatches) {
        const hn = m.home_team_name_en || 'Time A', an = m.away_team_name_en || 'Time B';
        const brTime = formatMatchDate(m);
        const status = m.finished === 'TRUE' ? `${m.home_score || 0} x ${m.away_score || 0}` : (m.time_elapsed && m.time_elapsed !== 'notstarted' ? `${m.home_score || 0} x ${m.away_score || 0}` : 'vs');
        html += `<div class="gs-match">
          <span class="gs-match-time">${brTime || '—'}</span>
          <span class="gs-match-teams">${liveFlagImg(hn)}${hn}</span>
          <span class="gs-match-score">${status}</span>
          <span class="gs-match-teams">${an}${liveFlagImg(an)}</span>
        </div>`;
      }
      container.innerHTML = html;
    });
  });
}

function renderKnockoutSchedule(allMatches) {
  const stages = [
    { key: 'r32', label: 'Rodada de 32' },
    { key: 'r16', label: 'Oitavas de Final' },
    { key: 'qf', label: 'Quartas de Final' },
    { key: 'sf', label: 'Semifinais' },
    { key: 'third', label: 'Disputa de 3º lugar' },
    { key: 'final', label: 'Final' }
  ];
  let h = `<div class="section-title" style="margin-top:32px">\uD83C\uDFF4 Programação do Mata-Mata</div>`;
  for (const stage of stages) {
    const matches = allMatches.filter(m => m.type === stage.key)
      .sort((a, b) => (a.local_date || '').localeCompare(b.local_date || ''));
    if (!matches.length) continue;
    h += `<div class="ko-schedule-round">
      <div class="ko-schedule-label">${stage.label}</div>
      <div class="ko-schedule-matches">`;
    for (const m of matches) {
      const hn = m.home_team_name_en || 'TBD', an = m.away_team_name_en || 'TBD';
      const brTime = formatMatchDate(m);
      const status = m.finished === 'TRUE' ? `${m.home_score || 0} x ${m.away_score || 0}` : (m.time_elapsed && m.time_elapsed !== 'notstarted' ? `${m.home_score || 0} x ${m.away_score || 0}` : 'vs');
      h += `<div class="ko-schedule-match">
        <span class="ko-sched-time">${brTime || '—'}</span>
        <span class="ko-sched-teams">${hn !== 'TBD' ? liveFlagImg(hn) : ''}${hn}</span>
        <span class="ko-sched-score">${status}</span>
        <span class="ko-sched-teams">${an}${an !== 'TBD' ? liveFlagImg(an) : ''}</span>
      </div>`;
    }
    h += `</div></div>`;
  }
  return h || '';
}

let liveScoreInterval = null;

function startLiveScoreUpdates() {
  if (liveScoreInterval) { clearInterval(liveScoreInterval); liveScoreInterval = null; }
  const liveCards = document.querySelectorAll('.live-card-live');
  if (!liveCards.length) return;
  const myInterval = setInterval(async () => {
    const scores = await apiCall('/live-scores');
    if (!scores || !scores.length) return;
    for (const s of scores) {
      const card = document.querySelector(`.live-card-live[data-match-id="${s.id}"]`);
      if (!card) continue;
      const scoresEl = card.querySelectorAll('.live-score.big');
      if (scoresEl.length >= 2) {
        scoresEl[0].textContent = s.home_score;
        scoresEl[1].textContent = s.away_score;
      }
      const elapsed = card.querySelector('.live-time-elapsed');
      if (elapsed) elapsed.textContent = s.time_elapsed;
    }
    if (!document.querySelectorAll('.live-card-live').length) {
      clearInterval(myInterval);
      if (liveScoreInterval === myInterval) liveScoreInterval = null;
    }
  }, 10000);
  liveScoreInterval = myInterval;
}

async function renderResults() {
  const c = document.getElementById('resultsContainer');
  const d = await apiCall('/live-matches');
  if (!d || !d.all) { c.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>'; return; }
  const all = d.all;
  let h = '<div class="results-page">';

  const groups = {};
  for (let g = 65; g <= 76; g++)groups[String.fromCharCode(g)] = {};
  for (const m of all) {
    if (m.type !== 'group' || !m.group) continue;
    const g = m.group;
    const hid = parseInt(m.home_team_id), aid = parseInt(m.away_team_id);
    const hn = m.home_team_name_en || 'Time', an = m.away_team_name_en || 'Time';
    const hs = parseInt(m.home_score) || 0, as = parseInt(m.away_score) || 0;
    if (!groups[g][hid]) groups[g][hid] = { id: hid, name: hn, p: 0, j: 0, v: 0, e: 0, d: 0, gf: 0, ga: 0 };
    if (!groups[g][aid]) groups[g][aid] = { id: aid, name: an, p: 0, j: 0, v: 0, e: 0, d: 0, gf: 0, ga: 0 };
    if (m.finished === 'TRUE') {
      groups[g][hid].j++; groups[g][aid].j++;
      groups[g][hid].gf += hs; groups[g][hid].ga += as;
      groups[g][aid].gf += as; groups[g][aid].ga += hs;
      if (hs > as) { groups[g][hid].p += 3; groups[g][hid].v++; groups[g][aid].d++; }
      else if (as > hs) { groups[g][aid].p += 3; groups[g][aid].v++; groups[g][hid].d++; }
      else { groups[g][hid].p += 1; groups[g][aid].p += 1; groups[g][hid].e++; groups[g][aid].e++; }
    }
  }
  h += `<div class="section-title">\uD83D\uDCCB Classifica\u00e7\u00e3o Real dos Grupos</div><div class="groups-grid">`;
  for (let gid = 65; gid <= 76; gid++) {
    const g = String.fromCharCode(gid);
    const teams = Object.values(groups[g] || {}).sort((a, b) => {
      if (b.p !== a.p) return b.p - a.p;
      const gdA = a.gf - a.ga, gdB = b.gf - b.ga;
      return gdB - gdA || b.gf - a.gf;
    });
    if (!teams.length) {
      h += `<div class="group-card"><div class="group-header"><div class="group-name"><div class="group-badge">${g}</div><span class="group-title">Grupo ${g}</span></div></div><div class="team-list"><div class="team-item" style="cursor:default;pointer-events:none;color:var(--text-muted)">A definir...</div></div></div>`;
      continue;
    }
    h += `<div class="group-card"><div class="group-header"><div class="group-name"><div class="group-badge">${g}</div><span class="group-title">Grupo ${g}</span></div></div><div class="team-list">`;
    for (let i = 0; i < teams.length; i++) {
      const t = teams[i], pos = i + 1;
      let cls = '', badge = '';
      if (pos === 1) { cls = 'selected-first'; badge = '<span class="badge badge-1st">1\u00ba</span>'; }
      else if (pos === 2) { cls = 'selected-second'; badge = '<span class="badge badge-2nd">2\u00ba</span>'; }
      else if (pos === 3) { cls = 'selected-third'; badge = '<span class="badge badge-3rd">3\u00ba</span>'; }
      const gd = t.gf - t.ga;
      const info = `<span class="real-stats">${t.p}<small>P</small></span><span class="real-stats">${t.j}<small>J</small></span><span class="real-stats">${t.v}<small>V</small></span><span class="real-stats">${t.e}<small>E</small></span><span class="real-stats">${t.d}<small>D</small></span><span class="real-stats">${t.gf}<small>GP</small></span><span class="real-stats">${gd >= 0 ? '+' : ''}${gd}<small>SG</small></span>`;
      h += `<div class="team-item ${cls}" style="cursor:default;pointer-events:none">${liveFlagImg(t.name)}<span class="name">${t.name}</span>${badge}<span class="stats-row">${info}</span></div>`;
    }
    h += `</div></div>`;
  }
  h += '</div>';

  const r32 = all.filter(m => m.type === 'r32').sort((a, b) => parseInt(a.id) - parseInt(b.id));
  const r16 = all.filter(m => m.type === 'r16').sort((a, b) => parseInt(a.id) - parseInt(b.id));
  const qf = all.filter(m => m.type === 'qf').sort((a, b) => parseInt(a.id) - parseInt(b.id));
  const sf = all.filter(m => m.type === 'sf').sort((a, b) => parseInt(a.id) - parseInt(b.id));
  const third = all.find(m => m.type === 'third');
  const finalM = all.find(m => m.type === 'final');
  if (r32.length || r16.length || qf.length || sf.length || third || finalM) {
    h += `<div class="section-title" style="margin-top:32px">\uD83C\uDFC6 Chaveamento Real</div><div class="bracket-wrapper"><div class="bgrid">`;
    const koCol = (matches, label) => {
      if (!matches.length) return '';
      return `<div class="bcol"><div class="brl">${label}</div>${matches.map(m => {
        const hn = m.home_team_name_en || 'TBD', an = m.away_team_name_en || 'TBD';
        const hs = parseInt(m.home_score) || 0, as = parseInt(m.away_score) || 0;
        const started = m.time_elapsed && m.time_elapsed !== 'notstarted';
        const fin = m.finished === 'TRUE';
        const wn = fin ? (hs > as ? 'home' : (as > hs ? 'away' : null)) : (started ? (hs > as ? 'home' : (as > hs ? 'away' : null)) : null);
        const sc = fin ? `<span class="mx">${hs}-${as}</span>` : (started ? `${hs}-${as}` : 'VS');
        return `<div class="match"><div class="ml">${fin ? '✅' : (started ? '\uD83D\uDD34' : '📅')}M${m.id}</div>
          <div class="ms${wn === 'home' ? ' msw' : ''}">${hn !== 'TBD' ? liveFlagImg(hn) : ''}<span class="msn">${hn}</span></div>
          <div class="msep">${sc}</div>
          <div class="ms${wn === 'away' ? ' msw' : ''}">${an !== 'TBD' ? liveFlagImg(an) : ''}<span class="msn">${an}</span></div></div>`;
      }).join('')}</div>`;
    };
    h += koCol(r32, 'Rodada de 32');
    h += koCol(r16, 'Oitavas');
    h += koCol(qf, 'Quartas');
    h += koCol(sf, 'Semifinais');
    if (third || finalM) {
      h += `<div class="bcol bcol-final"><div class="brl">Finais</div>`;
      if (third) {
        const ths = parseInt(third.home_score) || 0, tas = parseInt(third.away_score) || 0;
        const tw = third.finished === 'TRUE' ? (ths > tas ? 'home' : (tas > ths ? 'away' : null)) : null;
        h += `<div class="third-match"><div class="ml bronze">3\u00ba</div>
          <div class="ms${tw === 'home' ? ' msw' : ''}">${liveFlagImg(third.home_team_name_en)}${third.home_team_name_en}</div>
          <div class="msep">${third.finished === 'TRUE' ? `${third.home_score}-${third.away_score}` : 'VS'}</div>
          <div class="ms${tw === 'away' ? ' msw' : ''}">${liveFlagImg(third.away_team_name_en)}${third.away_team_name_en}</div></div>`;
      }
      if (finalM) {
        const fhs = parseInt(finalM.home_score) || 0, fas = parseInt(finalM.away_score) || 0;
        const fw = finalM.finished === 'TRUE' ? (fhs > fas ? 'home' : (fas > fhs ? 'away' : null)) : null;
        h += `<div class="final-match"><div class="ml gold">\uD83C\uDFC6Final</div>
          <div class="ms${fw === 'home' ? ' msw' : ''}">${liveFlagImg(finalM.home_team_name_en)}${finalM.home_team_name_en}</div>
          <div class="msep">${finalM.finished === 'TRUE' ? `${finalM.home_score}-${finalM.away_score}` : 'VS'}</div>
          <div class="ms${fw === 'away' ? ' msw' : ''}">${liveFlagImg(finalM.away_team_name_en)}${finalM.away_team_name_en}</div></div>`;
      }
      h += `</div>`;
    }
    h += `</div></div>`;
  }
  h += '</div>';
  c.innerHTML = h;
}

async function loadHistory() {
  const c = document.getElementById('historyContainer');
  const d = await apiCall('/history');
  if (!d || !d.length) { c.innerHTML = '<div class="empty-state"><span class="icon">\uD83D\uDCC5</span><h3>Nenhum jogo encerrado</h3><p>Os jogos encerrados aparecer\u00e3o aqui com seus palpites e pontua\u00e7\u00e3o.</p></div>'; return; }
  let h = '<div class="history-grid">';
  for (const m of d) {
    const pts = m.points || 0;
    const pf = pts === 10 ? '<span class="pts-badge pts-10">+10 Acerto exato!</span>' : pts === 5 ? '<span class="pts-badge pts-5">+5 Vencedor certo</span>' : '<span class="pts-badge pts-0">0 Errou</span>';
    const predHtml = m.user_prediction ? `<div class="hist-pred"><span class="hist-pred-label">Meu palpite:</span><strong>${m.user_prediction.home_score} x ${m.user_prediction.away_score}</strong></div>` : '<div class="hist-pred none">Sem palpite</div>';
    h += `<div class="hist-card">
      <div class="hist-header">
        <span class="hist-stage">${STAGE_NAMES[m.type] || m.group || 'Jogo'}</span>
        <span class="hist-date">${m.local_date || ''}</span>
      </div>
      <div class="hist-teams">
        <span class="hist-team">${liveFlagImg(m.home_team_name_en)}${m.home_team_name_en}</span>
        <span class="hist-score"><strong>${m.home_score}</strong> x <strong>${m.away_score}</strong></span>
        <span class="hist-team">${liveFlagImg(m.away_team_name_en)}${m.away_team_name_en}</span>
      </div>
      <div class="hist-details">
        ${predHtml}
        <div class="hist-points">${pf}</div>
      </div>
    </div>`;
  }
  h += '</div>'; c.innerHTML = h;
}

async function loadLeaderboard() {
  const c = document.getElementById('leaderboardContainer');
  const d = await apiCall('/leaderboard');
  if (!d || !d.length) { c.innerHTML = '<div class="empty-state"><span class="icon">\uD83D\uDCCA</span><h3>Ningu\u00e9m ainda</h3><p>Seja o primeiro a fazer seus palpites!</p></div>'; return; }
  const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];
  let h = '<table class="leaderboard-table"><thead><tr><th>#</th><th>Palpiteiro</th><th>Grupos</th><th>Mata-Mata</th><th>Total</th></tr></thead><tbody>';
  for (const u of d) {
    const rk = u.rank <= 3 ? `<span class="rank-medal">${medals[u.rank - 1]}</span>` : `<span class="rank-number">${u.rank}</span>`;
    h += `<tr><td>${rk}</td><td><strong>${u.username}</strong></td><td>${u.groupPredictions}/12</td><td>${u.knockoutPredictions}</td><td><strong>${u.totalScore}</strong></td></tr>`;
  }
  h += '</tbody></table>'; c.innerHTML = h;
}

async function loadScores() {
  const c = document.getElementById('leaderboardContainer');
  const d = await apiCall('/scores');
  if (!d || !d.length) { c.innerHTML = '<div class="empty-state"><span class="icon">\uD83C\uDFC6</span><h3>Sem pontua\u00e7\u00e3o ainda</h3><p>Os resultados aparecer\u00e3o quando os jogos come\u00e7arem!</p></div>'; return; }
  const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];
  let h = '<table class="leaderboard-table"><thead><tr><th>#</th><th>Palpiteiro</th><th>Grupos</th><th>Mata-Mata</th><th>Pontos</th></tr></thead><tbody>';
  for (const u of d) {
    const rk = u.rank <= 3 ? `<span class="rank-medal">${medals[u.rank - 1]}</span>` : `<span class="rank-number">${u.rank}</span>`;
    h += `<tr><td>${rk}</td><td><strong>${u.username}</strong></td><td>${u.groupPredictions}/12</td><td>${u.knockoutPredictions}</td><td style="color:var(--gold);font-weight:700;font-size:18px;">${u.totalScore}</td></tr>`;
  }
  h += '</tbody></table>'; c.innerHTML = h;
}

async function loadMyScore() {
  const c = document.getElementById('leaderboardContainer');
  const d = await apiCall('/my-score');
  if (!d) { c.innerHTML = '<div class="empty-state"><span class="icon">\uD83D\uDCCA</span><h3>Erro ao carregar</h3></div>'; return; }
  let h = '<div class="my-score-page">';
  h += `<div class="my-score-total"><span class="ms-label">Minha Pontua\u00e7\u00e3o Total</span><span class="ms-value">${d.total}</span></div>`;
  if (d.breakdown && d.breakdown.length) {
    h += '<div class="score-breakdown"><div class="score-bd-title">\uD83D\uDCCA Detalhamento</div>';
    const icons = { 'group_qualify': '📋', 'group_position': '🎯', 'third_advance': '🔝', 'knockout': '🏆', 'third_place': '🥉', 'champion': '👑', 'vice': '🥈', 'final_winner': '⚽', 'final_exact': '🎯', 'match_prediction': '📊' };
    for (const b of d.breakdown) {
      const icon = icons[b.category] || '•';
      h += `<div class="score-item"><span class="score-icon">${icon}</span><span class="score-reason">${b.reason}</span><span class="score-pts ${b.points >= 50 ? 'pts-high' : (b.points >= 20 ? 'pts-mid' : 'pts-low')}">+${b.points}</span></div>`;
    }
    h += '</div>';
  } else {
    h += '<div class="empty-state"><span class="icon">\uD83D\uDCC5</span><h3>Nenhum ponto ainda</h3><p>Seus pontos aparecer\u00e3o aqui quando os jogos terminarem!</p></div>';
  }
  h += '</div>'; c.innerHTML = h;
}

function renderInfo() {
  document.getElementById('infoContainer').innerHTML = `
<div class="info-page">

<section class="info-card">
  <div class="info-icon">🎯</div>
  <h3>O que \u00e9?</h3>
  <p>O <strong>Palpite Copa 2026</strong> \u00e9 um jogo interativo onde voc\u00ea <strong>prev\u00ea os resultados</strong> de todos os jogos da Copa do Mundo 2026. Voc\u00ea ganha pontos conforme seus palpites acertam os resultados reais.</p>
</section>

<section class="info-card">
  <div class="info-icon">📋</div>
  <h3>Fase de Grupos</h3>
  <p>Nos 12 grupos (A a L), cada um com 4 sele\u00e7\u00f5es, voc\u00ea deve indicar quem fica em <strong>1\u00ba</strong>, <strong>2\u00ba</strong> e <strong>3\u00ba</strong> lugar. Clique no time uma vez para 1\u00ba, duas para 2\u00ba, tr\u00eas para 3\u00ba, quatro para limpar.</p>
  <p>Ap\u00f3s escolher os 12 terceiros lugares, voc\u00ea seleciona <strong>8 deles</strong> para avan\u00e7ar ao mata-mata — exatamente como no regulamento real da Copa de 2026.</p>
</section>

<section class="info-card">
  <div class="info-icon">🏆</div>
  <h3>Mata-Mata</h3>
  <p>O chaveamento \u00e9 <strong>preenchido automaticamente</strong> com base nos seus palpites dos grupos (1\u00ba, 2\u00ba e 3\u00ba lugares). Voc\u00ea s\u00f3 precisa clicar no vencedor de cada partida.</p>
  <p>O bracket segue o formato oficial: 32 times → Oitavas → Quartas → Semifinais → Final (e disputa de 3\u00ba lugar).</p>
</section>

<section class="info-card">
  <div class="info-icon">⚽</div>
  <h3>Palpites de Placar</h3>
  <p>Em cada jogo da aba <strong>Ao Vivo</strong>, voc\u00ea pode clicar em <strong>"Adivinhar"</strong> e dar um palpite do placar exato. O prazo limite \u00e9 <strong>1 minuto antes</strong> do in\u00edcio da partida — ap\u00f3s isso, o palpite \u00e9 bloqueado.</p>
</section>

<section class="info-card">
  <div class="info-icon">📊</div>
  <h3>Sistema de Pontua\u00e7\u00e3o</h3>

  <h4 style="margin-top:16px;color:var(--gold);">Fase de Grupos</h4>
  <div class="scoring-table">
    <div class="scoring-row"><span class="scoring-label">Acertar classifica\u00e7\u00e3o (top 2)</span><span class="scoring-pts highlight-gold">10 pts cada time</span></div>
    <div class="scoring-row"><span class="scoring-label">Acertar posi\u00e7\u00e3o exata (1\u00ba ou 2\u00ba)</span><span class="scoring-pts highlight-green">+15 pts cada</span></div>
  </div>
  <p>M\u00e1ximo por grupo: <strong>50 pts</strong> (2 times × 10 classifica\u00e7\u00e3o + 15 posi\u00e7\u00e3o = 25 cada)</p>
  <p><strong>Exemplo:</strong> Usu\u00e1rio previu 1\u00ba Brasil, 2\u00ba Marrocos → resultado exato → Brasil 25 + Marrocos 25 = <strong>50 pts</strong></p>

  <h4 style="margin-top:16px;color:var(--gold);">Terceiros Colocados</h4>
  <div class="scoring-table">
    <div class="scoring-row"><span class="scoring-label">Acertar terceiro entre os 8 melhores</span><span class="scoring-pts highlight-gold">10 pts cada</span></div>
  </div>
  <p>M\u00e1ximo: <strong>80 pts</strong> (8 terceiros × 10)</p>

  <h4 style="margin-top:16px;color:var(--gold);">Mata-Mata</h4>
  <div class="scoring-table">
    <div class="scoring-row"><span class="scoring-label">Acertar classificado na Rodada de 32</span><span class="scoring-pts highlight-gold">20 pts</span></div>
    <div class="scoring-row"><span class="scoring-label">Acertar classificado nas Oitavas</span><span class="scoring-pts highlight-gold">20 pts</span></div>
    <div class="scoring-row"><span class="scoring-label">Acertar classificado nas Quartas</span><span class="scoring-pts highlight-gold">30 pts</span></div>
    <div class="scoring-row"><span class="scoring-label">Acertar classificado nas Semifinais</span><span class="scoring-pts highlight-gold">50 pts</span></div>
    <div class="scoring-row"><span class="scoring-label">Vencedor da disputa de 3\u00ba lugar</span><span class="scoring-pts">30 pts</span></div>
  </div>

  <h4 style="margin-top:16px;color:var(--gold);">Final</h4>
  <div class="scoring-table">
    <div class="scoring-row"><span class="scoring-label">Acertar o campe\u00e3o</span><span class="scoring-pts highlight-gold">100 pts</span></div>
    <div class="scoring-row"><span class="scoring-label">Acertar o vice-campe\u00e3o</span><span class="scoring-pts highlight-green">50 pts</span></div>
    <div class="scoring-row"><span class="scoring-label">Acertar vencedor da final</span><span class="scoring-pts">50 pts</span></div>
    <div class="scoring-row"><span class="scoring-label">Acertar placar exato da final</span><span class="scoring-pts highlight-gold">200 pts</span></div>
  </div>
  <p>M\u00e1ximo na final: <strong>350 pts</strong> (campe\u00e3o 100 + vice 50 + vencedor 50 + placar 200)</p>

  <h4 style="margin-top:16px;color:var(--gold);">Palpites de Placar (jogos comuns)</h4>
  <div class="scoring-table">
    <div class="scoring-row"><span class="scoring-label">Placar exato</span><span class="scoring-pts highlight-gold">10 pontos</span></div>
    <div class="scoring-row"><span class="scoring-label">Vencedor/empate certo (placar errado)</span><span class="scoring-pts highlight-green">5 pontos</span></div>
    <div class="scoring-row"><span class="scoring-label">Palpite errado</span><span class="scoring-pts">0 pontos</span></div>
  </div>
  <p><strong>Exemplos:</strong></p>
  <ul class="info-list">
    <li>Jogo termina <strong>2×1</strong> e voc\u00ea palpitou <strong>2×1</strong> → <span class="highlight-gold">10 pts</span> (exato)</li>
    <li>Jogo termina <strong>2×1</strong> e voc\u00ea palpitou <strong>3×0</strong> → <span class="highlight-green">5 pts</span> (vencedor certo)</li>
    <li>Jogo termina <strong>2×1</strong> e voc\u00ea palpitou <strong>0×2</strong> → 0 pts (errou)</li>
    <li>Empate <strong>1×1</strong> e voc\u00ea palpitou <strong>0×0</strong> → <span class="highlight-green">5 pts</span> (empate certo)</li>
  </ul>
</section>

<section class="info-card">
  <div class="info-icon">🔴</div>
  <h3>Ao Vivo</h3>
  <p>A aba <strong>Ao Vivo</strong> mostra todos os jogos do dia com atualiza\u00e7\u00e3o autom\u00e1tica. Os jogos s\u00e3o divididos em:</p>
  <ul class="info-list">
    <li><strong>Ao Vivo</strong> — partidas em andamento com placar e tempo decorrido</li>
    <li><strong>Hoje</strong> — jogos do dia que ainda n\u00e3o come\u00e7aram</li>
    <li><strong>Pr\u00f3ximos</strong> — jogos futuros</li>
  </ul>
  <p>Jogos ao vivo t\u00eam fundo vermelho pulsante. Clique em <strong>"Adivinhar"</strong> para dar seu palpite (dispon\u00edvel at\u00e9 1 minuto antes do in\u00edcio).</p>
</section>

<section class="info-card">
  <div class="info-icon">📊</div>
  <h3>Resultados</h3>
  <p>A aba <strong>Resultados</strong> mostra a <strong>classifica\u00e7\u00e3o real</strong> dos grupos calculada automaticamente a partir dos placares oficiais da API <a href="https://worldcup26.ir" target="_blank">worldcup26.ir</a>.</p>
  <p>Estat\u00edsticas: <strong>P</strong> (pontos), <strong>J</strong>, <strong>V</strong>, <strong>E</strong>, <strong>D</strong>, <strong>GP</strong>, <strong>SG</strong>.</p>
  <p>Abaixo dos grupos, o <strong>chaveamento real</strong> mostra o bracket completo com os times e placares.</p>
</section>

<section class="info-card">
  <div class="info-icon">📜</div>
  <h3>Hist\u00f3rico e Minha Pontua\u00e7\u00e3o</h3>
  <p>Na aba <strong>Ranking</strong>, clique em <strong>"Minha Pontua\u00e7\u00e3o"</strong> para ver o detalhamento completo de todos os seus pontos, com data, evento, pontos ganhos e motivo.</p>
  <p><strong>Exemplo de detalhamento:</strong></p>
  <ul class="info-list">
    <li>+25 — Brasil classificado e 1\u00ba no Grupo C</li>
    <li>+10 — Marrocos classificado no Grupo C</li>
    <li>+30 — Brasil avan\u00e7ou nas Quartas</li>
    <li>+100 — Brasil campe\u00e3o!</li>
  </ul>
  <p>A aba <strong>Hist\u00f3rico</strong> lista todos os jogos encerrados com seu palpite e pontua\u00e7\u00e3o.</p>
</section>

<section class="info-card">
  <div class="info-icon">📊</div>
  <h3>Ranking</h3>
  <p>A aba <strong>Ranking</strong> exibe a pontua\u00e7\u00e3o total de todos os participantes, com duas visualiza\u00e7\u00f5es:</p>
  <ul class="info-list">
    <li><strong>Ver Pontua\u00e7\u00e3o</strong> — ranking por pontos totais</li>
    <li><strong>Ver Palpites</strong> — quem fez mais palpites</li>
  </ul>
  <p>Toda pontua\u00e7\u00e3o \u00e9 <strong>calculada automaticamente</strong> conforme os jogos terminam, sem necessidade de interven\u00e7\u00e3o manual.</p>
</section>

<section class="info-card">
  <div class="info-icon">🗑️</div>
  <h3>Limpar Palpites</h3>
  <p>Voc\u00ea pode apagar todos os seus palpites de grupos clicando em <strong>"Limpar Palpites"</strong> na aba Grupos.</p>
</section>

<section class="info-card">
  <div class="info-icon">🌐</div>
  <h3>Dados e API</h3>
  <p>Todos os resultados e jogos v\u00eam da API p\u00fablica <a href="https://worldcup26.ir" target="_blank">worldcup26.ir</a>, que fornece dados oficiais da Copa do Mundo 2026 em tempo real.</p>
  <p>As bandeiras das sele\u00e7\u00f5es s\u00e3o carregadas do <a href="https://flagcdn.com" target="_blank">flagcdn.com</a>.</p>
</section>

</div>`;
}

function navigateToProfile() {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('show'));
  document.getElementById('pageProfile').classList.add('show');
  renderProfile();
}

async function renderProfile() {
  const c = document.getElementById('profileContainer');
  const [me, score, groups, leaderboard] = await Promise.all([
    apiCall('/me'), apiCall('/my-score'), apiCall('/groups'), apiCall('/scores')
  ]);
  if (!me) { c.innerHTML = '<div class="empty-state"><span class="icon">⚠️</span><h3>Erro ao carregar</h3></div>'; return; }

  const created = new Date(me.created_at || Date.now());
  const memberSince = created.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const myRank = leaderboard ? leaderboard.findIndex(u => u.username === me.username) + 1 : null;
  const totalUsers = leaderboard ? leaderboard.length : 0;

  const gpCount = groups ? groups.reduce((s, g) => s + g.teams.length, 0) : 0;
  const mpCount = score && score.breakdown ? score.breakdown.filter(b => b.category === 'match_prediction').length : 0;
  const groupPts = score && score.breakdown ? score.breakdown.filter(b => b.category === 'group_qualify' || b.category === 'group_position').reduce((s, b) => s + b.points, 0) : 0;
  const koPts = score && score.breakdown ? score.breakdown.filter(b => b.category === 'knockout' || b.category === 'champion' || b.category === 'vice' || b.category === 'third_place').reduce((s, b) => s + b.points, 0) : 0;
  const matchPts = score && score.breakdown ? score.breakdown.filter(b => b.category === 'match_prediction' || b.category === 'final_exact' || b.category === 'final_winner').reduce((s, b) => s + b.points, 0) : 0;

  const letter = me.username.charAt(0).toUpperCase();
  const colors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#01a3a4', '#f368e0', '#ff6348', '#7bed9f'];
  const colorIdx = me.username.charCodeAt(0) % colors.length;
  const avatarBg = colors[colorIdx];

  let h = `
<div class="profile-page">
  <div class="profile-header-card">
    <div class="profile-avatar" style="background:${avatarBg}">${letter}</div>
    <div class="profile-info">
      <h1 class="profile-name">${me.username}</h1>
      <span class="profile-email">${me.email || ''}</span>
      <span class="profile-member">Membro desde ${memberSince}</span>
    </div>
    ${myRank ? `<div class="profile-rank-badge">#${myRank} de ${totalUsers}</div>` : ''}
  </div>

  <div class="profile-stats-grid">
    <div class="profile-stat-card"><div class="ps-value" style="color:var(--gold)">${score ? score.total : 0}</div><div class="ps-label">Pontos Totais</div></div>
    <div class="profile-stat-card"><div class="ps-value" style="color:var(--green)">${groupPts}</div><div class="ps-label">Grupos</div></div>
    <div class="profile-stat-card"><div class="ps-value" style="color:var(--blue)">${koPts}</div><div class="ps-label">Mata-Mata</div></div>
    <div class="profile-stat-card"><div class="ps-value" style="color:var(--primary)">${matchPts}</div><div class="ps-label">Placares</div></div>
  </div>

  <div class="profile-section">
    <div class="profile-section-title">📊 Atividade</div>
    <div class="profile-activity-grid">
      <div class="profile-activity-item"><span class="pa-value">${Object.keys(groupPredictions || {}).length}</span><span class="pa-label">Grupos com palpite</span></div>
      <div class="profile-activity-item"><span class="pa-value">${Object.keys(knockoutPredictions || {}).length}</span><span class="pa-label">Palpites no mata-mata</span></div>
      <div class="profile-activity-item"><span class="pa-value">${matchPredictions ? matchPredictions.length : 0}</span><span class="pa-label">Palpites de placar</span></div>
      <div class="profile-activity-item"><span class="pa-value">${mpCount}</span><span class="pa-label">Placares pontuados</span></div>
    </div>
  </div>

  <div class="profile-section">
    <div class="profile-section-title">🏆 Pontuação por Categoria</div>
    <div class="profile-categories">
      <div class="profile-cat"><span class="pc-label">Grupos (classificação + posição)</span><div class="pc-bar"><div class="pc-fill pc-fill-gold" style="width:${score && score.total ? Math.round(groupPts / score.total * 100) : 0}%"></div></div><span class="pc-value">${groupPts}</span></div>
      <div class="profile-cat"><span class="pc-label">Terceiros colocados</span><div class="pc-bar"><div class="pc-fill pc-fill-green" style="width:${score && score.total ? Math.round((score.breakdown || []).filter(b => b.category === 'third_advance').reduce((s, b) => s + b.points, 0) / score.total * 100) : 0}%"></div></div><span class="pc-value">${(score.breakdown || []).filter(b => b.category === 'third_advance').reduce((s, b) => s + b.points, 0)}</span></div>
      <div class="profile-cat"><span class="pc-label">Mata-mata (avanços)</span><div class="pc-bar"><div class="pc-fill pc-fill-blue" style="width:${score && score.total ? Math.round(koPts / score.total * 100) : 0}%"></div></div><span class="pc-value">${koPts}</span></div>
      <div class="profile-cat"><span class="pc-label">Placares (5/10pts)</span><div class="pc-bar"><div class="pc-fill pc-fill-primary" style="width:${score && score.total ? Math.round(matchPts / score.total * 100) : 0}%"></div></div><span class="pc-value">${matchPts}</span></div>
    </div>
  </div>

  <div class="profile-section">
    <div class="profile-section-title">📋 Últimos Pontos</div>
    <div class="profile-recent">`;
  if (score && score.breakdown && score.breakdown.length) {
    const recent = score.breakdown.slice(-5).reverse();
    for (const b of recent) {
      const icons = { 'group_qualify': '📋', 'group_position': '🎯', 'third_advance': '🔝', 'knockout': '🏆', 'third_place': '🥉', 'champion': '👑', 'vice': '🥈', 'final_winner': '⚽', 'final_exact': '🎯', 'match_prediction': '📊' };
      h += `<div class="profile-recent-item"><span class="pri-icon">${icons[b.category] || '•'}</span><span class="pri-text">${b.reason}</span><span class="pri-pts">+${b.points}</span></div>`;
    }
  } else {
    h += `<div class="profile-recent-empty">Nenhum ponto ainda. Faça seus palpites!</div>`;
  }
  h += `
    </div>
  </div>
</div>`;
  c.innerHTML = h;
}

if (token) {
  apiCall('/me').then(user => { if (user) { currentUser = user; initApp(); } else showAuth(); });
} else showAuth();
