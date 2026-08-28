/* ===== UTILS ===== */
function toDateStr(d) { return (d || new Date()).toISOString().split('T')[0]; }
function today()  { return toDateStr(); }
function genId()  { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function buildHintHTML(word, typed) {
  const letters = word.split('');
  const typedArr = (typed || '').split('');
  return letters.map((letter, i) => {
    const isEdge = i === 0 || (i === letters.length - 1 && letters.length > 1);
    const t = typedArr[i];
    if (t !== undefined) {
      const ok = t.toLowerCase() === letter.toLowerCase();
      return `<span class="hint-known" style="color:var(--${ok ? 'success' : 'danger'});border-color:var(--${ok ? 'success' : 'danger'})">${t}</span>`;
    }
    return isEdge
      ? `<span class="hint-known">${letter}</span>`
      : `<span class="hint-blank"></span>`;
  }).join('');
}
function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const DATA_SCHEMA_VERSION = 2;
const KEY = 'vocabmaster_v2';
const LEGACY_KEY = 'vocabmaster_v1';
const AI_KEY = 'vocabmaster_ai';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const LETTER_GROUPS = LETTERS.map(letter => ({
  id: `letter-${letter.toLowerCase()}`,
  name: letter,
  createdAt: '2026-05-30'
}));
const GEMINI_MODELS = [
  { id: 'gemini-3.7-flash',      label: 'gemini-3.7-flash（最新、強大）' },
  { id: 'gemini-3.5-flash',      label: 'gemini-3.5-flash（穩定、均衡）' },
  { id: 'gemini-3.5-flash-lite', label: 'gemini-3.5-flash-lite（快速、省成本）' },
  { id: 'gemini-2.5-pro',        label: 'gemini-2.5-pro（強推理）' },
  { id: 'gemini-2.5-flash',      label: 'gemini-2.5-flash（舊版穩定）' },
];

function letterGroupId(letter) {
  return `letter-${letter.toLowerCase()}`;
}

function getInitialGroupId(word) {
  const first = String(word || '').trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? letterGroupId(first) : null;
}

function syncLetterGroups() {
  state.groups = LETTER_GROUPS.map(g => ({ ...g }));
  state.words.forEach(w => { w.groupId = getInitialGroupId(w.word); });
}

function formatExample(ex) {
  if (!ex) return '';
  if (typeof ex === 'string') return ex.trim();
  return [ex.en, ex.zh].filter(Boolean).join('\n').trim();
}

function normalizeSense(s) {
  s = s || {};
  const definitions = Array.isArray(s.definitions)
    ? s.definitions.map(d => String(d).trim()).filter(Boolean)
    : String(s.definition || '').split(/[;；、]/).map(d => d.trim()).filter(Boolean);
  const examples = Array.isArray(s.examples)
    ? s.examples
    : (s.example ? [s.example] : []);
  return {
    partOfSpeech: String(s.partOfSpeech || s.pos || '').trim(),
    definitions,
    examples
  };
}

function normalizeWord(w) {
  const senses = Array.isArray(w.senses) ? w.senses.map(normalizeSense) : [];
  const senseDefs = senses.flatMap(s => s.definitions);
  const sensePos = [...new Set(senses.map(s => s.partOfSpeech).filter(Boolean))];
  const firstSenseExample = senses.flatMap(s => s.examples).map(formatExample).find(Boolean) || '';
  return {
    id: w.id || genId(),
    word: String(w.word || '').trim(),
    definition: String(w.definition || senseDefs.join(';')).trim(),
    partOfSpeech: String(w.partOfSpeech || sensePos.join(';')).trim(),
    example: String(w.example || firstSenseExample).trim(),
    senses,
    groupId: getInitialGroupId(w.word),
    createdAt: w.createdAt || today(),
    repetitions: w.repetitions || 0,
    easeFactor: w.easeFactor || 2.5,
    interval: w.interval || 1,
    dueDate: w.dueDate || today(),
    lastReviewed: w.lastReviewed || null,
    totalReviews: w.totalReviews || 0,
    correctCount: w.correctCount || 0
  };
}

function normalizeData(data) {
  const words = Array.isArray(data?.words)
    ? data.words.map(normalizeWord).filter(w => w.word)
    : [];
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    words,
    groups: LETTER_GROUPS.map(g => ({ ...g }))
  };
}

function statePayload() {
  syncLetterGroups();
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    words: state.words,
    groups: state.groups
  };
}

function definitionText(w) {
  return w.definition || (w.senses || []).flatMap(s => s.definitions || []).join(';');
}

function partOfSpeechText(w) {
  if (w.partOfSpeech) return w.partOfSpeech;
  return [...new Set((w.senses || []).map(s => s.partOfSpeech).filter(Boolean))].join(';');
}

/* ===== LOCAL DATA ===== */
async function loadBundledData() {
  try {
    const res = await fetch('vocab-data.json', { cache: 'no-store' });
    if (!res.ok) return;
    const data = normalizeData(await res.json());
    state.words  = data.words;
    state.groups = data.groups;
    localStorage.setItem(KEY, JSON.stringify(statePayload()));
  } catch {
    // Browsers may block fetch() from local files; users can still connect the JSON file manually.
  }
}

/* ===== STATE ===== */
function loadState() {
  localStorage.removeItem(LEGACY_KEY);
  try {
    const s = localStorage.getItem(KEY);
    return s ? normalizeData(JSON.parse(s)) : { schemaVersion: DATA_SCHEMA_VERSION, words: [], groups: [] };
  }
  catch { return { words: [], groups: [] }; }
}
function saveState() {
  localStorage.setItem(KEY, JSON.stringify(statePayload()));
  writeToFile();
}

let state = loadState();
if (!state.groups) state.groups = [];
syncLetterGroups();

let currentPage    = 'dashboard';
let editingId      = null;
let wordsActiveGid = null;
let wordsSortOrder = 'az';

/* ===== GROUP CRUD ===== */
function addGroup(name) {
  const g = { id: genId(), name: name.trim(), createdAt: today() };
  state.groups.push(g);
  saveState();
  return g;
}
function deleteGroup(id) {
  state.groups = state.groups.filter(g => g.id !== id);
  state.words.forEach(w => { if (w.groupId === id) w.groupId = null; });
  saveState();
}
function getGroupName(id) {
  if (!id) return '未分群';
  const g = state.groups.find(g => g.id === id);
  return g ? g.name : '未分群';
}

/* ===== SM-2 ===== */
function sm2Apply(word, quality) {
  let { repetitions = 0, easeFactor = 2.5, interval = 1 } = word;
  if (quality < 3) { repetitions = 0; interval = 1; }
  else {
    if      (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else                        interval = Math.round(interval * easeFactor);
    repetitions++;
  }
  easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  const due = new Date();
  due.setDate(due.getDate() + interval);
  return {
    ...word, repetitions, easeFactor: +easeFactor.toFixed(2), interval,
    dueDate: toDateStr(due), lastReviewed: today(),
    totalReviews: (word.totalReviews || 0) + 1,
    correctCount: (word.correctCount || 0) + (quality >= 3 ? 1 : 0)
  };
}
function getStatus(w) {
  if (!w.lastReviewed) return 'new';
  if (w.interval >= 21) return 'mastered';
  return 'learning';
}
function statusLabel(w) {
  return { new: '新增', mastered: '已熟練', learning: '學習中' }[getStatus(w)];
}

/* ===== WORD CRUD ===== */
function addWord(data) {
  const w = {
    id: genId(), word: data.word.trim(), definition: data.def.trim(),
    partOfSpeech: (data.pos || '').trim(),
    example: (data.ex || '').trim(),
    senses: Array.isArray(data.senses) ? data.senses : [],
    groupId: getInitialGroupId(data.word),
    createdAt: today(), repetitions: 0, easeFactor: 2.5, interval: 1,
    dueDate: today(), lastReviewed: null, totalReviews: 0, correctCount: 0
  };
  state.words.push(w);
  saveState();
}
function updateWord(id, patch) {
  const i = state.words.findIndex(w => w.id === id);
  if (i !== -1) {
    state.words[i] = { ...state.words[i], ...patch };
    state.words[i].groupId = getInitialGroupId(state.words[i].word);
    saveState();
  }
}
function deleteWord(id) {
  state.words = state.words.filter(w => w.id !== id);
  saveState();
}

/* ===== SPEECH ===== */
function speak(word) {
  if (!('speechSynthesis' in window)) { toast('您的瀏覽器不支援語音功能'); return; }
  window.speechSynthesis.cancel();
  const utter  = new SpeechSynthesisUtterance(word);
  utter.lang   = 'en-US';
  utter.rate   = 0.85;
  utter.pitch  = 1;
  window.speechSynthesis.speak(utter);
}
function speakBtn(word) {
  return `<button class="speak-btn" data-speak="${esc(word)}" title="播放發音">🔊</button>`;
}

/* ===== TOAST ===== */
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

/* ===== MODAL ===== */
function openModal(id, defaultGid) {
  editingId = id || null;
  document.getElementById('modal-title').textContent = id ? '編輯單字' : '新增單字';
  const w = id ? state.words.find(x => x.id === id) : null;
  document.getElementById('f-word').value  = w ? w.word       : '';
  document.getElementById('f-def' ).value  = w ? w.definition : '';
  document.getElementById('f-pos' ).value  = w ? (w.partOfSpeech || '') : '';
  document.getElementById('f-ex'  ).value  = w ? (w.example || '') : '';
  updateGroupPreview(w ? w.word : '');
  document.getElementById('overlay').classList.remove('hidden');
  const fWord = document.getElementById('f-word');
  const fWarn = document.getElementById('f-word-warn');
  fWord.focus();
  fWord.oninput = () => {
    const val = fWord.value.trim().toLowerCase();
    updateGroupPreview(fWord.value);
    const dup = state.words.find(w =>
      w.word.toLowerCase() === val && w.id !== editingId
    );
    if (dup && val) {
      fWarn.textContent = `⚠️ 「${dup.word}」已存在（${dup.definition}）`;
      fWarn.style.display = 'block';
    } else {
      fWarn.style.display = 'none';
    }
  };
}
function updateGroupPreview(word) {
  const el = document.getElementById('f-group-preview');
  if (!el) return;
  const gid = getInitialGroupId(word);
  el.textContent = gid
    ? `自動分類：${getGroupName(gid)}`
    : '輸入英文單字後會依第一個字母自動分類';
}
function closeModal() {
  document.getElementById('overlay').classList.add('hidden');
  editingId = null;
}

/* ===== AI SETTINGS ===== */
function loadAISettings() {
  try {
    const s = localStorage.getItem(AI_KEY);
    return s ? JSON.parse(s) : { apiKey: '', model: 'gemini-3.7-flash' };
  } catch { return { apiKey: '', model: 'gemini-3.7-flash' }; }
}

function saveAISettings(settings) {
  localStorage.setItem(AI_KEY, JSON.stringify(settings));
  updateAIStatus();
}

function getAISettings() { return loadAISettings(); }

function updateAIStatus() {
  const el = document.getElementById('ai-indicator');
  if (!el) return;
  const { apiKey } = loadAISettings();
  el.classList.toggle('hidden', !apiKey);
}

function openAIModal() {
  const { apiKey, model } = loadAISettings();
  document.getElementById('ai-key').value   = apiKey;
  document.getElementById('ai-model').value = model || 'gemini-3.7-flash';
  document.getElementById('ai-overlay').classList.remove('hidden');
}

function closeAIModal() {
  document.getElementById('ai-overlay').classList.add('hidden');
}

/* ===== ROUTER ===== */
function navigate(page) {
  clearQzTimer();
  currentPage = page;
  document.querySelectorAll('.nav li').forEach(li =>
    li.classList.toggle('active', li.dataset.page === page));
  renderPage();
}
function renderPage() {
  const main = document.getElementById('main');
  if      (currentPage === 'dashboard') main.innerHTML = pageDashboard();
  else if (currentPage === 'words')     { main.innerHTML = pageWords(); wireWords(); }
  else if (currentPage === 'quiz')      pageQuizEntry(main);
}

/* ===== DASHBOARD ===== */
function pageDashboard() {
  const recent = [...state.words]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  const recentRows = recent.length
    ? recent.map(w => `<tr>
        <td><strong>${esc(w.word)}</strong></td>
        <td>${esc(w.definition)}</td>
        <td>${w.groupId ? `<span class="badge learning">${esc(getGroupName(w.groupId))}</span>` : '<span style="color:var(--muted)">—</span>'}</td>
        <td><span class="badge ${getStatus(w)}">${statusLabel(w)}</span></td>
      </tr>`).join('')
    : `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:24px">
        尚無單字 — 前往「我的單字」新增吧！</td></tr>`;

  const groupRows = state.groups.length
    ? state.groups.map(g => {
        const cnt = state.words.filter(w => w.groupId === g.id).length;
        return `<tr>
          <td><span class="badge learning">${esc(g.name)}</span></td>
          <td>${cnt} 個</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="2" style="color:var(--muted);text-align:center;padding:16px">
        尚未建立群組</td></tr>`;

  return `
    <div class="page-header"><h1>📊 學習總覽</h1></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="card">
        <h2 style="font-size:.95rem;margin-bottom:14px">最近新增</h2>
        <table class="word-table">
          <thead><tr><th>單字</th><th>釋義</th><th>群組</th><th>狀態</th></tr></thead>
          <tbody>${recentRows}</tbody>
        </table>
      </div>
      <div class="card">
        <h2 style="font-size:.95rem;margin-bottom:14px">群組統計</h2>
        <table class="word-table">
          <thead><tr><th>群組</th><th>單字數</th></tr></thead>
          <tbody>${groupRows}</tbody>
        </table>
      </div>
    </div>`;
}

/* ===== MY WORDS ===== */
function pageWords(filter) {
  filter = filter || '';
  let words = wordsActiveGid
    ? state.words.filter(w => w.groupId === wordsActiveGid)
    : state.words;
  if (filter) words = words.filter(w =>
    w.word.toLowerCase().includes(filter.toLowerCase()) ||
    definitionText(w).toLowerCase().includes(filter.toLowerCase()) ||
    partOfSpeechText(w).toLowerCase().includes(filter.toLowerCase()));

  words = [...words].sort((a, b) => {
    const cmp = a.word.toLowerCase().localeCompare(b.word.toLowerCase());
    return wordsSortOrder === 'az' ? cmp : -cmp;
  });

  const tabs = [
    `<button class="tab${!wordsActiveGid ? ' active' : ''}" data-gid="">
      全部 <span class="tab-count">${state.words.length}</span>
    </button>`,
    ...state.groups.map(g => {
      const cnt = state.words.filter(w => w.groupId === g.id).length;
      return `<button class="tab${wordsActiveGid === g.id ? ' active' : ''}" data-gid="${g.id}">
        ${esc(g.name)} <span class="tab-count">${cnt}</span>
      </button>`;
    })
  ].join('');

  const rows = words.length
    ? words.map(w => `<tr>
        <td><strong>${esc(w.word)}</strong> ${partOfSpeechText(w) ? `<span class="pos-tag">${esc(partOfSpeechText(w))}</span>` : ''} ${speakBtn(w.word)}</td>
        <td>${esc(definitionText(w))}</td>
        <td>${w.groupId ? `<span class="badge learning">${esc(getGroupName(w.groupId))}</span>` : '<span style="color:var(--muted)">—</span>'}</td>
        <td style="white-space:nowrap">
          <button class="btn ghost btn-edit" data-id="${w.id}" style="padding:4px 10px;margin-right:6px">編輯</button>
          <button class="btn danger-soft btn-del" data-id="${w.id}" style="padding:4px 10px">刪除</button>
        </td>
      </tr>`).join('')
    : `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:36px">
        ${filter ? '找不到符合的單字' : wordsActiveGid ? '此群組尚無單字' : '尚無單字，點擊右上角「新增單字」開始！'}</td></tr>`;

  return `
    <div class="page-header">
      <h1>📝 我的單字</h1>
      <button class="btn primary" id="btn-add">＋ 新增單字</button>
    </div>
    <div class="tabs">${tabs}</div>
    <div class="card">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
        <input class="search-bar" id="search" type="text"
          placeholder="🔍 搜尋單字或釋義…" value="${esc(filter)}"
          style="margin-bottom:0;flex:1">
        <button class="btn ghost" id="btn-sort" style="white-space:nowrap;flex-shrink:0">
          ${wordsSortOrder === 'az' ? '🔤 A→Z' : '🔤 Z→A'}
        </button>
      </div>
      <table class="word-table">
        <thead><tr><th>單字</th><th>釋義</th><th>群組</th><th>操作</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function wireWords(filter) {
  filter = filter !== undefined ? filter : (document.getElementById('search')?.value || '');

  document.getElementById('btn-add').onclick = () => openModal(null, wordsActiveGid);

  document.querySelectorAll('.tab[data-gid]').forEach(tab =>
    tab.onclick = e => {
      wordsActiveGid = tab.dataset.gid || null;
      document.getElementById('main').innerHTML = pageWords('');
      wireWords('');
    });

  document.getElementById('btn-sort').onclick = () => {
    wordsSortOrder = wordsSortOrder === 'az' ? 'za' : 'az';
    document.getElementById('main').innerHTML = pageWords(filter);
    wireWords(filter);
  };

  document.getElementById('search').oninput = e => {
    document.getElementById('main').innerHTML = pageWords(e.target.value);
    wireWords(e.target.value);
    const el = document.getElementById('search');
    el.focus(); el.setSelectionRange(el.value.length, el.value.length);
  };

  document.querySelectorAll('.btn-edit').forEach(b =>
    b.onclick = () => openModal(b.dataset.id));

  document.querySelectorAll('.btn-del').forEach(b =>
    b.onclick = () => {
      if (!confirm('確定要刪除這個單字嗎？')) return;
      deleteWord(b.dataset.id);
      document.getElementById('main').innerHTML = pageWords(filter);
      wireWords(filter);
      toast('已刪除');
    });
}

/* ===== SHARED: GROUP PICKER ===== */
function renderGroupPicker(main, title, onPick) {
  const tiles = [
    `<div class="group-tile" data-gid="">
      <div class="gt-icon">📚</div>
      <div class="gt-name">全部</div>
      <div class="gt-count">${state.words.length} 個單字</div>
    </div>`,
    ...state.groups.map(g => {
      const cnt = state.words.filter(w => w.groupId === g.id).length;
      return `<div class="group-tile" data-gid="${g.id}">
        <div class="gt-icon">📁</div>
        <div class="gt-name">${esc(g.name)}</div>
        <div class="gt-count">${cnt} 個單字</div>
      </div>`;
    })
  ].join('');
  main.innerHTML = `
    <div class="page-header"><h1>${title}</h1></div>
    <p style="color:var(--muted);margin-bottom:16px">① 選擇練習範圍</p>
    <div class="group-picker">${tiles}</div>`;
  document.querySelectorAll('.group-tile').forEach(tile =>
    tile.onclick = () => {
      const gid   = tile.dataset.gid || null;
      const words = gid ? state.words.filter(w => w.groupId === gid) : state.words;
      onPick(words, gid);
    });
}

/* ===== LISTENING MODE ===== */
let ls = {};

function startListening(main, words, title, restartFn) {
  ls = { cards: shuffle(words), idx: 0, score: 0, title, restartFn };
  renderListening(main);
}

function renderListening(main) {
  const { cards, idx, score, title, restartFn } = ls;

  if (idx >= cards.length) {
    const pct = Math.round(score / cards.length * 100);
    const emoji = pct === 100 ? '🏆' : pct >= 70 ? '🎉' : pct >= 40 ? '📚' : '💪';
    main.innerHTML = `
      <div class="page-header"><h1>${title}</h1></div>
      <div class="card done-box">
        <div class="de">${emoji}</div>
        <h2>聽力練習完成！</h2>
        <p>答對 ${score} / ${cards.length}（正確率 ${pct}%）</p>
        <button class="btn primary" id="ls-again">再來一次</button>
      </div>`;
    document.getElementById('ls-again').onclick = restartFn;
    return;
  }

  const w = cards[idx], pct = Math.round(idx / cards.length * 100);
  main.innerHTML = `
    <div class="page-header"><h1>${title} — 聽力模式</h1></div>
    <div class="fc-wrap">
      <div class="fc-meta">
        <span class="fc-counter">${idx + 1} / ${cards.length} &nbsp;✓ ${score}</span>
        <div class="progress-wrap"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="card" style="width:100%;max-width:540px;padding:32px;text-align:center">
        <p style="color:var(--muted);font-size:.82rem;margin-bottom:16px">聽發音，輸入英文單字</p>
        <button class="btn primary" id="ls-play" style="font-size:1.4rem;padding:14px 32px;margin-bottom:8px">🔊 播放</button>
        <p style="color:var(--muted);font-size:.82rem;margin-bottom:20px" id="ls-def-wrap">
          <button class="btn ghost" id="ls-show-def" style="font-size:.82rem;padding:4px 10px">顯示中文提示</button>
        </p>
        <input class="type-input" id="ls-in" placeholder="輸入英文單字…" autocomplete="off" spellcheck="false">
        <div id="ls-hint" style="min-height:44px;margin-top:10px;text-align:center"></div>
        <div class="quiz-feedback" id="ls-fb"></div>
        <div class="quiz-row" style="justify-content:center;margin-top:12px">
          <button class="btn ghost"   id="ls-skip">跳過</button>
          <button class="btn primary" id="ls-check">確認</button>
        </div>
      </div>
    </div>`;

  const inp    = document.getElementById('ls-in');
  const hintEl = document.getElementById('ls-hint');
  hintEl.innerHTML = buildHintHTML(w.word, '');
  speak(w.word);
  inp.focus();
  inp.addEventListener('input', () => { hintEl.innerHTML = buildHintHTML(w.word, inp.value); });

  document.getElementById('ls-play').onclick = () => speak(w.word);
  document.getElementById('ls-show-def').onclick = (e) => {
    e.target.replaceWith(Object.assign(document.createElement('span'), {
      textContent: w.definition, style: 'color:var(--muted)'
    }));
  };

  function submit() {
    if (inp.disabled) return;
    inp.disabled = true;
    const ok = inp.value.trim().toLowerCase() === w.word.trim().toLowerCase();
    inp.classList.add(ok ? 'correct' : 'wrong');
    const fb  = document.getElementById('ls-fb');
    const btn = document.getElementById('ls-check');
    const updated = sm2Apply(w, ok ? 5 : 1);
    updateWord(updated.id, updated);
    ls.cards[ls.idx] = updated;
    if (ok) {
      ls.score++;
      fb.innerHTML = `✓ 答對了！${speakBtn(w.word)}`;
      fb.className = 'quiz-feedback ok';
      document.getElementById('ls-skip').style.display = 'none';
      btn.style.display = 'none';
      speak(w.word);
      setTimeout(() => { ls.idx++; renderListening(main); }, 1200);
    } else {
      fb.innerHTML = `✗ 正確答案：<strong>${esc(w.word)}</strong> ${speakBtn(w.word)}`;
      fb.className = 'quiz-feedback bad';
      document.getElementById('ls-skip').style.display = 'none';
      btn.textContent = '繼續 →';
      btn.onclick = () => { ls.idx++; renderListening(main); };
    }
  }

  document.getElementById('ls-check').onclick = submit;
  inp.onkeydown = e => { if (e.key === 'Enter') submit(); };
  document.getElementById('ls-skip').onclick = () => {
    if (inp.disabled) return;
    inp.disabled = true;
    const fb  = document.getElementById('ls-fb');
    const btn = document.getElementById('ls-check');
    fb.innerHTML = `跳過！正確答案：<strong>${esc(w.word)}</strong> ${speakBtn(w.word)}`;
    fb.className = 'quiz-feedback bad';
    const updated = sm2Apply(w, 1);
    updateWord(updated.id, updated);
    ls.cards[ls.idx] = updated;
    document.getElementById('ls-skip').style.display = 'none';
    btn.textContent = '繼續 →';
    btn.onclick = () => { ls.idx++; renderListening(main); };
  };
}

/* ===== QUIZ ===== */
let qz = {};
let qzTimer = null;
function clearQzTimer() { if (qzTimer) { clearInterval(qzTimer); qzTimer = null; } }

function pageQuizEntry(main) {
  if (state.words.length < 4) {
    main.innerHTML = `<div class="page-header"><h1>🧪 測驗</h1></div>
      <div class="empty-state"><div class="ei">⚠️</div>
      <p>至少需要 4 個單字才能進行測驗</p>
      <p style="margin-top:6px">目前：${state.words.length} / 4 個</p></div>`;
    return;
  }
  if (!state.groups.length) { showQuizModeSelect(main, state.words); return; }
  renderGroupPicker(main, '🧪 測驗', (words, gid) => {
    if (words.length < 4) {
      alert('此群組需要至少 4 個單字才能進行測驗！');
      pageQuizEntry(main); return;
    }
    showQuizModeSelect(main, words);
  });
}

function showQuizModeSelect(main, pool) {
  qz._pool = pool;
  main.innerHTML = `
    <div class="page-header"><h1>🧪 測驗</h1></div>
    <p style="color:var(--muted);margin-bottom:4px">選擇測驗模式（每次最多 10 題）</p>
    <div class="mode-grid">
      <div class="mode-card" id="mode-mc">
        <div class="mode-icon">🎯</div>
        <div class="mode-name">選擇題</div>
        <div class="mode-desc">看英文，選出正確的中文釋義</div>
      </div>
      <div class="mode-card" id="mode-type">
        <div class="mode-icon">⌨️</div>
        <div class="mode-name">拼寫測驗</div>
        <div class="mode-desc">看中文釋義，輸入正確的英文單字</div>
      </div>
      <div class="mode-card" id="mode-listen">
        <div class="mode-icon">🎧</div>
        <div class="mode-name">聽力測驗</div>
        <div class="mode-desc">聽發音，拼出正確的英文單字</div>
      </div>
      <div class="mode-card" id="mode-reverse">
        <div class="mode-icon">🔄</div>
        <div class="mode-name">反向模式</div>
        <div class="mode-desc">看英文單字，輸入中文釋義</div>
      </div>
      <div class="mode-card" id="mode-timed">
        <div class="mode-icon">⏱️</div>
        <div class="mode-name">限時模式</div>
        <div class="mode-desc">拼寫測驗加 15 秒倒數計時</div>
      </div>
    </div>`;
  document.getElementById('mode-mc').onclick      = () => startQuiz('mc');
  document.getElementById('mode-type').onclick    = () => showTypeSettings(main, pool);
  document.getElementById('mode-listen').onclick  = () => startListening(main, shuffle(pool).slice(0, Math.min(10, pool.length)), '🧪 聽力測驗', () => showQuizModeSelect(main, pool));
  document.getElementById('mode-reverse').onclick = () => startQuiz('reverse');
  document.getElementById('mode-timed').onclick   = () => startQuiz('timed');
}

function showTypeSettings(main, pool) {
  qz._pool = pool;
  main.innerHTML = `
    <div class="page-header"><h1>⌨️ 拼寫測驗</h1></div>
    <div class="card" style="max-width:480px;padding:28px">
      <div class="settings-section">
        <div class="settings-label">作答方向</div>
        <div class="settings-opts">
          <div class="setting-opt active" id="opt-zh2en">
            <div style="font-weight:600">看中文，打英文</div>
            <div style="font-size:.8rem;color:var(--muted);margin-top:3px">認識並拼寫單字</div>
          </div>
          <div class="setting-opt" id="opt-en2zh">
            <div style="font-weight:600">看英文，打中文</div>
            <div style="font-size:.8rem;color:var(--muted);margin-top:3px">加強釋義記憶</div>
          </div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-label">提示設定</div>
        <label class="setting-check">
          <input type="checkbox" id="show-answer">
          <div>
            <div>顯示答案</div>
            <div style="font-size:.8rem;color:var(--muted)">練習模式：答案可見，不計入 SM-2</div>
          </div>
        </label>
        <label class="setting-check" style="margin-top:10px">
          <input type="checkbox" id="show-example" checked>
          <div>顯示例句</div>
        </label>
      </div>
      <div style="display:flex;gap:10px;margin-top:8px">
        <button class="btn ghost" id="btn-back-ts">← 返回</button>
        <button class="btn primary" id="btn-start-ts" style="flex:1">開始 →</button>
      </div>
    </div>`;

  let dir = 'zh2en';
  const setDir = (d) => {
    dir = d;
    document.getElementById('opt-zh2en').classList.toggle('active', d === 'zh2en');
    document.getElementById('opt-en2zh').classList.toggle('active', d === 'en2zh');
  };
  document.getElementById('opt-zh2en').onclick = () => setDir('zh2en');
  document.getElementById('opt-en2zh').onclick = () => setDir('en2zh');
  document.getElementById('btn-back-ts').onclick = () => showQuizModeSelect(main, pool);
  document.getElementById('btn-start-ts').onclick = () => {
    startQuiz('type', null, {
      dir,
      showAnswer:  document.getElementById('show-answer').checked,
      showExample: document.getElementById('show-example').checked
    });
  };
}

function startQuiz(mode, customPool, settings) {
  clearQzTimer();
  const pool = customPool || qz._pool || state.words;
  const savedSettings = settings || (mode === 'type' ? { dir: qz.dir, showAnswer: qz.showAnswer, showExample: qz.showExample } : {});
  qz = { mode, pool: qz._pool || state.words, cards: shuffle(pool).slice(0, Math.min(10, pool.length)), idx: 0, score: 0, answered: false, ...savedSettings };
  renderQZ();
}

function renderQZ() {
  const main = document.getElementById('main');
  const { mode, cards, idx, score, pool } = qz;
  if (idx >= cards.length) { renderQZResult(main); return; }

  const w = cards[idx], pct = Math.round(idx / cards.length * 100);
  const modeTitle = mode === 'mc' ? '選擇題'
    : mode === 'type' && qz.dir === 'en2zh' ? (qz.showAnswer ? '釋義練習' : '釋義測驗')
    : mode === 'type' ? (qz.showAnswer ? '拼寫練習' : '拼寫測驗')
    : mode === 'timed' ? '限時測驗'
    : mode === 'reverse' ? '反向模式'
    : '拼寫測驗';
  const hdr = `
    <div class="page-header"><h1>🧪 ${modeTitle}</h1></div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="color:var(--muted)">${idx + 1} / ${cards.length}</span>
        <span>分數：<strong>${score}</strong></span>
      </div>
      <div class="progress-wrap" style="margin-bottom:22px">
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>`;

  if (mode === 'mc') {
    const wrong = shuffle(
      [...pool.filter(x => x.id !== w.id),
       ...state.words.filter(x => x.id !== w.id && !pool.find(p => p.id === x.id))]
    ).slice(0, 3);
    const opts = shuffle([w, ...wrong].slice(0, 4));
    main.innerHTML = hdr + `
      <div class="quiz-q">${esc(w.word)}</div>
      <p class="quiz-sub">選出正確的中文釋義</p>
      <div class="quiz-options">
        ${opts.map(o =>
          `<button class="quiz-opt" data-id="${o.id}" data-correct="${o.id === w.id}">
            ${esc(o.definition)}</button>`).join('')}
      </div>
      <div class="quiz-feedback" id="qfb"></div>
      <div class="quiz-row">
        <button class="btn primary" id="btn-next" style="display:none">下一題 →</button>
      </div></div>`;
    document.querySelectorAll('.quiz-opt').forEach(b =>
      b.onclick = () => {
        if (qz.answered) return;
        qz.answered = true;
        const ok = b.dataset.correct === 'true';
        document.querySelectorAll('.quiz-opt').forEach(x => {
          x.disabled = true;
          if (x.dataset.correct === 'true') x.classList.add('correct');
          else if (x === b && !ok)          x.classList.add('wrong');
        });
        const fb = document.getElementById('qfb');
        if (ok) { qz.score++; fb.textContent = '✓ 答對了！'; fb.className = 'quiz-feedback ok'; }
        else    { fb.textContent = `✗ 答錯了！正確答案：${w.definition}`; fb.className = 'quiz-feedback bad'; }
        updateWord(w.id, {
          totalReviews: (w.totalReviews || 0) + 1,
          correctCount: (w.correctCount || 0) + (ok ? 1 : 0)
        });
        document.getElementById('btn-next').style.display = 'inline-flex';
      });
    document.getElementById('btn-next').onclick = () => { qz.idx++; qz.answered = false; renderQZ(); };

  } else if (mode === 'type') {
    const dir         = qz.dir || 'zh2en';
    const showAnswer  = !!qz.showAnswer;
    const showExample = qz.showExample !== false;
    const isZhEn      = dir === 'zh2en';

    const promptHTML  = isZhEn
      ? `<div class="quiz-q" style="font-size:1.3rem;margin-bottom:${showAnswer ? 10 : 18}px">${esc(w.definition)}</div>`
      : `<div class="quiz-q" style="margin-bottom:${showAnswer ? 10 : 18}px">${esc(w.word)} ${speakBtn(w.word)}</div>`;
    const answerHTML  = showAnswer
      ? (isZhEn
          ? `<div class="answer-hint">${speakBtn(w.word)} <strong style="letter-spacing:.1em">${esc(w.word)}</strong></div>`
          : `<div class="answer-hint"><strong>${esc(w.definition)}</strong></div>`)
      : '';
    const exampleHTML = showExample && w.example
      ? `<p style="text-align:center;color:var(--muted);font-style:italic;margin-bottom:18px">${esc(typeof w.example === 'string' ? w.example : (w.example.en || ''))}</p>`
      : '';
    const subLabel    = isZhEn ? '根據中文釋義，輸入英文單字' : '根據英文單字，輸入中文釋義';
    const placeholder = isZhEn ? '輸入英文單字…' : '輸入中文釋義…';

    main.innerHTML = hdr + `
      <p class="quiz-sub">${subLabel}${showAnswer ? '　<span style="color:var(--primary);font-size:.8rem">練習模式</span>' : ''}</p>
      ${promptHTML}${answerHTML}${exampleHTML}
      <input class="type-input" id="type-in" placeholder="${placeholder}" autocomplete="off" ${isZhEn ? 'spellcheck="false"' : ''}>
      ${isZhEn ? '<div id="qz-hint" style="min-height:44px;margin-top:10px;text-align:center"></div>' : ''}
      <div class="quiz-feedback" id="qfb"></div>
      <div class="quiz-row">
        <button class="btn ghost"   id="btn-skip">跳過</button>
        <button class="btn primary" id="btn-check">確認</button>
        <button class="btn primary" id="btn-next" style="display:none">下一題 →</button>
      </div></div>`;

    const inp = document.getElementById('type-in');
    if (isZhEn) {
      const hintEl = document.getElementById('qz-hint');
      hintEl.innerHTML = buildHintHTML(w.word, '');
      inp.addEventListener('input', () => { hintEl.innerHTML = buildHintHTML(w.word, inp.value); });
    }
    inp.focus();

    function typeCheck() {
      if (qz.answered) return;
      qz.answered = true;
      let ok;
      if (isZhEn) {
        ok = inp.value.trim().toLowerCase() === w.word.trim().toLowerCase();
      } else {
        const ans  = inp.value.trim();
        const defs = w.definition.split(/[;；、]/).map(s => s.trim()).filter(Boolean);
        ok = ans.length >= 1 && defs.some(d => d.toLowerCase() === ans.toLowerCase());
      }
      inp.disabled = true; inp.classList.add(ok ? 'correct' : 'wrong');
      const fb       = document.getElementById('qfb');
      const correctStr = isZhEn ? `<strong>${esc(w.word)}</strong>` : `<strong>${esc(w.definition)}</strong>`;
      if (ok) {
        qz.score++;
        fb.textContent = '✓ 答對了！'; fb.className = 'quiz-feedback ok';
        if (isZhEn) speak(w.word);
      } else {
        fb.innerHTML = `✗ 答錯了！正確答案：${correctStr}`; fb.className = 'quiz-feedback bad';
      }
      updateWord(w.id, { totalReviews: (w.totalReviews||0)+1, correctCount: (w.correctCount||0)+(ok?1:0) });
      document.getElementById('btn-check').style.display = 'none';
      document.getElementById('btn-skip' ).style.display = 'none';
      document.getElementById('btn-next' ).style.display = 'inline-flex';
    }
    document.getElementById('btn-check').onclick = typeCheck;
    inp.onkeydown = e => { if (e.key === 'Enter') typeCheck(); };
    document.getElementById('btn-skip').onclick = () => {
      if (qz.answered) return;
      qz.answered = true; inp.disabled = true;
      const correctStr = isZhEn ? `<strong>${esc(w.word)}</strong>` : `<strong>${esc(w.definition)}</strong>`;
      const fb = document.getElementById('qfb');
      fb.innerHTML = `跳過！正確答案：${correctStr}`; fb.className = 'quiz-feedback bad';
      document.getElementById('btn-check').style.display = 'none';
      document.getElementById('btn-skip' ).style.display = 'none';
      document.getElementById('btn-next' ).style.display = 'inline-flex';
    };
    document.getElementById('btn-next').onclick = () => { qz.idx++; qz.answered = false; renderQZ(); };

  } else if (mode === 'fill') {
    const safe   = w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const blanked = w.example.replace(new RegExp(safe, 'gi'), '＿'.repeat(w.word.length));
    main.innerHTML = hdr + `
      <p class="quiz-sub">填入句子中缺少的英文單字</p>
      <div class="quiz-q" style="font-size:1.1rem;line-height:1.8;margin-bottom:10px">${esc(blanked)}</div>
      <p style="text-align:center;color:var(--muted);font-size:.88rem;margin-bottom:16px">${esc(w.definition)}</p>
      <input class="type-input" id="type-in" placeholder="輸入缺少的單字…" autocomplete="off" spellcheck="false">
      <div id="qz-hint" style="min-height:44px;margin-top:10px;text-align:center"></div>
      <div class="quiz-feedback" id="qfb"></div>
      <div class="quiz-row">
        <button class="btn ghost"   id="btn-skip">跳過</button>
        <button class="btn primary" id="btn-check">確認</button>
        <button class="btn primary" id="btn-next" style="display:none">下一題 →</button>
      </div></div>`;
    const inp = document.getElementById('type-in');
    const hintEl = document.getElementById('qz-hint');
    hintEl.innerHTML = buildHintHTML(w.word, '');
    inp.focus();
    inp.addEventListener('input', () => { hintEl.innerHTML = buildHintHTML(w.word, inp.value); });
    function fillCheck() {
      if (qz.answered) return; qz.answered = true;
      const ok = inp.value.trim().toLowerCase() === w.word.trim().toLowerCase();
      inp.disabled = true; inp.classList.add(ok ? 'correct' : 'wrong');
      const fb = document.getElementById('qfb');
      if (ok) { qz.score++; fb.textContent = '✓ 答對了！'; fb.className = 'quiz-feedback ok'; }
      else { fb.innerHTML = `✗ 答錯了！正確答案：<strong>${esc(w.word)}</strong>`; fb.className = 'quiz-feedback bad'; }
      updateWord(w.id, { totalReviews: (w.totalReviews||0)+1, correctCount: (w.correctCount||0)+(ok?1:0) });
      document.getElementById('btn-check').style.display = 'none';
      document.getElementById('btn-skip').style.display  = 'none';
      document.getElementById('btn-next').style.display  = 'inline-flex';
    }
    document.getElementById('btn-check').onclick = fillCheck;
    inp.onkeydown = e => { if (e.key === 'Enter') fillCheck(); };
    document.getElementById('btn-skip').onclick = () => {
      if (qz.answered) return; qz.answered = true; inp.disabled = true;
      document.getElementById('qfb').innerHTML = `跳過！正確答案：<strong>${esc(w.word)}</strong>`; document.getElementById('qfb').className = 'quiz-feedback bad';
      document.getElementById('btn-check').style.display = 'none'; document.getElementById('btn-skip').style.display = 'none'; document.getElementById('btn-next').style.display = 'inline-flex';
    };
    document.getElementById('btn-next').onclick = () => { qz.idx++; qz.answered = false; renderQZ(); };

  } else if (mode === 'reverse') {
    main.innerHTML = hdr + `
      <p class="quiz-sub">根據英文單字，輸入中文釋義</p>
      <div class="quiz-q">${esc(w.word)} ${speakBtn(w.word)}</div>
      ${w.example ? `<p style="text-align:center;color:var(--muted);font-style:italic;margin-bottom:18px">${esc(w.example)}</p>` : ''}
      <input class="type-input" id="type-in" placeholder="輸入中文釋義…" autocomplete="off">
      <div class="quiz-feedback" id="qfb"></div>
      <div class="quiz-row">
        <button class="btn ghost"   id="btn-skip">跳過</button>
        <button class="btn primary" id="btn-check">確認</button>
        <button class="btn primary" id="btn-next" style="display:none">下一題 →</button>
      </div></div>`;
    const inp = document.getElementById('type-in');
    inp.focus();
    function revCheck() {
      if (qz.answered) return; qz.answered = true;
      const ans  = inp.value.trim();
      const defs = w.definition.split(/[;；、]/).map(s => s.trim()).filter(Boolean);
      const ok   = ans.length >= 1 && defs.some(d => d.toLowerCase() === ans.toLowerCase());
      inp.disabled = true; inp.classList.add(ok ? 'correct' : 'wrong');
      const fb = document.getElementById('qfb');
      if (ok) { qz.score++; fb.textContent = '✓ 答對了！'; fb.className = 'quiz-feedback ok'; }
      else { fb.innerHTML = `✗ 正確答案：<strong>${esc(w.definition)}</strong>`; fb.className = 'quiz-feedback bad'; }
      updateWord(w.id, { totalReviews: (w.totalReviews||0)+1, correctCount: (w.correctCount||0)+(ok?1:0) });
      document.getElementById('btn-check').style.display = 'none';
      document.getElementById('btn-skip').style.display  = 'none';
      document.getElementById('btn-next').style.display  = 'inline-flex';
    }
    document.getElementById('btn-check').onclick = revCheck;
    inp.onkeydown = e => { if (e.key === 'Enter') revCheck(); };
    document.getElementById('btn-skip').onclick = () => {
      if (qz.answered) return; qz.answered = true; inp.disabled = true;
      document.getElementById('qfb').innerHTML = `跳過！正確答案：<strong>${esc(w.definition)}</strong>`; document.getElementById('qfb').className = 'quiz-feedback bad';
      document.getElementById('btn-check').style.display = 'none'; document.getElementById('btn-skip').style.display = 'none'; document.getElementById('btn-next').style.display = 'inline-flex';
    };
    document.getElementById('btn-next').onclick = () => { qz.idx++; qz.answered = false; renderQZ(); };

  } else if (mode === 'timed') {
    clearQzTimer();
    const TIME = 15;
    main.innerHTML = hdr + `
      <p class="quiz-sub">根據中文釋義，輸入英文單字</p>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden">
          <div id="timer-bar" style="height:100%;background:var(--primary);width:100%;transition:width 1s linear"></div>
        </div>
        <span id="timer-num" style="font-size:1rem;font-weight:700;color:var(--primary);min-width:24px;text-align:right">${TIME}</span>
      </div>
      <div class="quiz-q" style="font-size:1.3rem;margin-bottom:18px">${esc(w.definition)}</div>
      ${w.example ? `<p style="text-align:center;color:var(--muted);font-style:italic;margin-bottom:18px">${esc(w.example)}</p>` : ''}
      <input class="type-input" id="type-in" placeholder="輸入英文單字…" autocomplete="off" spellcheck="false">
      <div id="qz-hint" style="min-height:44px;margin-top:10px;text-align:center"></div>
      <div class="quiz-feedback" id="qfb"></div>
      <div class="quiz-row">
        <button class="btn ghost"   id="btn-skip">跳過</button>
        <button class="btn primary" id="btn-check">確認</button>
        <button class="btn primary" id="btn-next" style="display:none">下一題 →</button>
      </div></div>`;
    const inp = document.getElementById('type-in');
    const hintEl = document.getElementById('qz-hint');
    hintEl.innerHTML = buildHintHTML(w.word, '');
    inp.focus();
    inp.addEventListener('input', () => { hintEl.innerHTML = buildHintHTML(w.word, inp.value); });
    let timeLeft = TIME;
    qzTimer = setInterval(() => {
      timeLeft--;
      const bar = document.getElementById('timer-bar');
      const num = document.getElementById('timer-num');
      if (bar) bar.style.width = (timeLeft / TIME * 100) + '%';
      if (num) { num.textContent = timeLeft; num.style.color = timeLeft <= 5 ? 'var(--danger)' : 'var(--primary)'; }
      if (timeLeft <= 0) { clearQzTimer(); timedSkip(); }
    }, 1000);
    function timedCheck() {
      if (qz.answered) return; qz.answered = true; clearQzTimer();
      const ok = inp.value.trim().toLowerCase() === w.word.trim().toLowerCase();
      inp.disabled = true; inp.classList.add(ok ? 'correct' : 'wrong');
      const fb = document.getElementById('qfb');
      if (ok) { qz.score++; fb.textContent = '✓ 答對了！'; fb.className = 'quiz-feedback ok'; }
      else { fb.innerHTML = `✗ 答錯了！正確答案：<strong>${esc(w.word)}</strong>`; fb.className = 'quiz-feedback bad'; }
      updateWord(w.id, { totalReviews: (w.totalReviews||0)+1, correctCount: (w.correctCount||0)+(ok?1:0) });
      document.getElementById('btn-check').style.display = 'none';
      document.getElementById('btn-skip').style.display  = 'none';
      document.getElementById('btn-next').style.display  = 'inline-flex';
    }
    function timedSkip() {
      if (qz.answered) return; qz.answered = true; clearQzTimer(); inp.disabled = true;
      document.getElementById('qfb').innerHTML = timeLeft <= 0
        ? `⏰ 時間到！正確答案：<strong>${esc(w.word)}</strong>`
        : `跳過！正確答案：<strong>${esc(w.word)}</strong>`;
      document.getElementById('qfb').className = 'quiz-feedback bad';
      document.getElementById('btn-check').style.display = 'none';
      document.getElementById('btn-skip').style.display  = 'none';
      document.getElementById('btn-next').style.display  = 'inline-flex';
    }
    document.getElementById('btn-check').onclick = timedCheck;
    inp.onkeydown = e => { if (e.key === 'Enter') timedCheck(); };
    document.getElementById('btn-skip').onclick = timedSkip;
    document.getElementById('btn-next').onclick = () => { qz.idx++; qz.answered = false; renderQZ(); };
  }
}

function renderQZResult(main) {
  const { score, cards, mode } = qz;
  const isPractice = mode === 'type' && !!qz.showAnswer;
  const pct   = Math.round(score / cards.length * 100);
  const emoji = isPractice ? '📖' : (pct === 100 ? '🏆' : pct >= 70 ? '🎉' : pct >= 40 ? '📚' : '💪');
  const title = isPractice ? '練習完成！' : '測驗完成！';
  const sub   = isPractice
    ? `練習了 ${cards.length} 個單字，拼對 ${score} 個`
    : `正確率 ${pct}%`;
  main.innerHTML = `
    <div class="page-header"><h1>🧪 ${isPractice ? '練習結果' : '測驗結果'}</h1></div>
    <div class="card result-box">
      <div class="result-emoji">${emoji}</div>
      <h2 style="margin-bottom:8px">${title}</h2>
      <div class="result-score">${score} / ${cards.length}</div>
      <div class="result-pct">${sub}</div>
      <div class="result-row">
        <button class="btn ghost"   id="btn-menu">返回模式選擇</button>
        <button class="btn primary" id="btn-retry">再試一次</button>
      </div>
    </div>`;
  document.getElementById('btn-menu').onclick  = () => pageQuizEntry(main);
  document.getElementById('btn-retry').onclick = () => startQuiz(mode);
}

/* ===== AUTO-SAVE (File System Access API) ===== */
const fsDB = (() => {
  let db = null;
  function open() {
    return new Promise((res, rej) => {
      if (db) return res(db);
      const r = indexedDB.open('vocabmaster_fs', 1);
      r.onupgradeneeded = e => e.target.result.createObjectStore('h');
      r.onsuccess  = e => { db = e.target.result; res(db); };
      r.onerror    = rej;
    });
  }
  return {
    get: async k => { try { const d = await open(); return new Promise(r => { const q = d.transaction('h').objectStore('h').get(k); q.onsuccess = () => r(q.result ?? null); q.onerror = () => r(null); }); } catch { return null; } },
    set: async (k, v) => { try { const d = await open(); const tx = d.transaction('h','readwrite'); tx.objectStore('h').put(v, k); } catch {} },
    del: async k => { try { const d = await open(); d.transaction('h','readwrite').objectStore('h').delete(k); } catch {} }
  };
})();

let fileHandle = null;

async function writeToFile() {
  if (!fileHandle) return;
  try {
    if (await fileHandle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
      showFileStatus('reconnect'); return;
    }
    const existingText = await (await fileHandle.getFile()).text();
    if (state.words.length === 0 && existingText.trim()) {
      const existing = normalizeData(JSON.parse(existingText));
      if (existing.words.length > 0) {
        state.words = existing.words;
        state.groups = existing.groups;
        localStorage.setItem(KEY, JSON.stringify(statePayload()));
        renderPage();
        toast(`已從 JSON 載入 ${state.words.length} 筆，未覆蓋檔案`);
        return;
      }
    }
    const w = await fileHandle.createWritable();
    await w.write(JSON.stringify(statePayload(), null, 2));
    await w.close();
  } catch {}
}

async function initAutoSave() {
  if (!window.showSaveFilePicker) return;
  const handle = await fsDB.get('fh');
  if (!handle) return;
  fileHandle = handle;
  const perm = await handle.queryPermission({ mode: 'readwrite' });
  if (perm === 'granted') {
    try {
      const text = await (await handle.getFile()).text();
      if (text.trim()) {
        const data = normalizeData(JSON.parse(text));
        if (Array.isArray(data.words)) {
          state.words  = data.words;
          state.groups = data.groups;
          localStorage.setItem(KEY, JSON.stringify(statePayload()));
        }
      }
    } catch {}
    showFileStatus('connected', handle.name);
  } else {
    showFileStatus('reconnect');
  }
}

async function setupAutoSave() {
  if (!window.showOpenFilePicker && !window.showSaveFilePicker) {
    alert('您的瀏覽器不支援資料檔連結，請改用 Chrome 或 Edge。'); return;
  }
  try {
    let handle;
    const pickerOptions = {
      types: [{ description: 'JSON 資料檔', accept: { 'application/json': ['.json'] } }]
    };
    if (window.showOpenFilePicker) {
      [handle] = await window.showOpenFilePicker(pickerOptions);
      const perm = await handle.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') { showFileStatus('reconnect'); return; }
    } else {
      handle = await window.showSaveFilePicker({ suggestedName: 'vocab-data', ...pickerOptions });
    }
    fileHandle = handle;
    await fsDB.set('fh', handle);
    try {
      const text = await (await handle.getFile()).text();
      if (text.trim()) {
        const data = normalizeData(JSON.parse(text));
        if (Array.isArray(data.words)) {
          const ok = data.words.length === 0 || state.words.length === 0 ||
            confirm(`檔案中有 ${data.words.length} 個單字，要載入嗎？\n（目前 ${state.words.length} 個單字會被覆蓋）`);
          if (ok) {
            state.words  = data.words;
            state.groups = data.groups;
            localStorage.setItem(KEY, JSON.stringify(statePayload()));
            renderPage();
          }
        }
      }
    } catch {}
    await writeToFile();
    showFileStatus('connected', handle.name);
    toast('✅ 自動儲存已啟用，資料將自動存入檔案');
  } catch {}
}

async function reconnectFile() {
  if (!fileHandle) return;
  try {
    const perm = await fileHandle.requestPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      showFileStatus('connected', fileHandle.name);
      toast('已重新授權');
    }
  } catch {}
}

async function disconnectFile() {
  fileHandle = null;
  await fsDB.del('fh');
  showFileStatus('none');
  toast('已中斷自動儲存連結');
}

function showFileStatus(status, name) {
  const btnEl  = document.getElementById('btn-autosave');
  const conEl  = document.getElementById('file-connected');
  const recEl  = document.getElementById('file-reconnect');
  const nameEl = document.getElementById('file-name');
  const lblEl  = document.getElementById('autosave-label');
  if (status === 'connected') {
    btnEl.classList.add('hidden');
    conEl.classList.remove('hidden');
    recEl.classList.add('hidden');
    if (nameEl) nameEl.textContent = name || '已連結';
    if (lblEl)  lblEl.textContent  = '選擇資料檔';
  } else if (status === 'reconnect') {
    btnEl.classList.add('hidden');
    conEl.classList.add('hidden');
    recEl.classList.remove('hidden');
    if (lblEl) lblEl.textContent = '選擇資料檔';
  } else {
    btnEl.classList.remove('hidden');
    conEl.classList.add('hidden');
    recEl.classList.add('hidden');
    if (lblEl) lblEl.textContent = '選擇資料檔';
  }
}

/* ===== EXPORT / IMPORT ===== */
function exportData() {
  const json = JSON.stringify(statePayload(), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `vocab-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('資料已匯出');
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = normalizeData(JSON.parse(e.target.result));
      if (!Array.isArray(data.words)) throw new Error();
      const msg = state.words.length > 0
        ? `確定要匯入？目前的 ${state.words.length} 個單字將被覆蓋。`
        : '確定要匯入此備份檔案？';
      if (!confirm(msg)) return;
      state.words  = data.words;
      state.groups = data.groups;
      saveState();
      renderPage();
      toast(`匯入成功！共 ${state.words.length} 個單字`);
    } catch {
      alert('匯入失敗：檔案格式不正確，請選擇由本程式匯出的 .json 檔案。');
    }
  };
  reader.readAsText(file);
}

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.nav li').forEach(li =>
    li.onclick = () => navigate(li.dataset.page));

  document.getElementById('modal-close').onclick = closeModal;
  document.getElementById('form-cancel').onclick = closeModal;
  document.getElementById('overlay').onclick = e => {
    if (e.target.id === 'overlay') closeModal();
  };

  document.getElementById('word-form').onsubmit = e => {
    e.preventDefault();
    const data = {
      word:    document.getElementById('f-word' ).value,
      def:     document.getElementById('f-def'  ).value,
      pos:     document.getElementById('f-pos'  ).value,
      ex:      document.getElementById('f-ex'   ).value
    };
    if (editingId) {
      updateWord(editingId, {
        word: data.word.trim(),
        definition: data.def.trim(),
        partOfSpeech: data.pos.trim(),
        example: data.ex.trim()
      });
      toast('單字已更新');
    } else {
      addWord(data);
      toast('單字已新增');
    }
    closeModal();
    if (currentPage === 'words') {
      document.getElementById('main').innerHTML = pageWords();
      wireWords();
    } else if (currentPage === 'dashboard') {
      document.getElementById('main').innerHTML = pageDashboard();
    }
  };

  document.addEventListener('click', e => {
    const speakBtn = e.target.closest('.speak-btn');
    if (speakBtn) { e.stopPropagation(); speak(speakBtn.dataset.speak); return; }

  });

  document.getElementById('btn-autosave').onclick  = setupAutoSave;
  document.getElementById('btn-disconnect').onclick = disconnectFile;
  document.getElementById('btn-reconnect').onclick  = reconnectFile;

  document.getElementById('btn-ai-settings').onclick = openAIModal;
  document.getElementById('ai-modal-close').onclick  = closeAIModal;
  document.getElementById('ai-cancel').onclick       = closeAIModal;
  document.getElementById('ai-overlay').onclick = e => {
    if (e.target.id === 'ai-overlay') closeAIModal();
  };
  document.getElementById('ai-key-toggle').onclick = () => {
    const inp = document.getElementById('ai-key');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  };
  document.getElementById('ai-save').onclick = () => {
    const apiKey = document.getElementById('ai-key').value.trim();
    const model  = document.getElementById('ai-model').value;
    saveAISettings({ apiKey, model });
    closeAIModal();
    toast(apiKey ? '✅ AI 設定已儲存' : '已清除 AI 設定');
  };
  updateAIStatus();

  await initAutoSave();
  await loadBundledData();
  renderPage();
});
