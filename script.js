/* ========== CONFIG ========== */
const ADMIN_PASS = 'afl3169';
const TOKEN_KEY  = 'afl9e_token';
const DAYS       = ['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Proje'];

/* ========== STATE ========== */
let tasks = JSON.parse(localStorage.getItem('afl_tasks') || '[]'); // [{id,day,subject,desc,tag,createdAt}]
let visitors = Number(localStorage.getItem('afl_visitors') || 0);
if (!localStorage.getItem('afl_visited')) {
  localStorage.setItem('afl_visited', '1');
  visitors++;
  localStorage.setItem('afl_visitors', String(visitors));
}
let editingId = null;

/* ========== HELPERS ========== */
const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const escapeHtml = s => String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const toast = (msg) => { const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1600); };
const isAdmin = () => !!localStorage.getItem(TOKEN_KEY);

/* ========== TABS ========== */
$$('.tab').forEach(btn=>{
  btn.onclick = () => {
    $$('.tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    $$('.tabpage').forEach(p=>p.classList.remove('active'));
    $('#'+btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'schedule') renderSchedule();
    if (btn.dataset.tab === 'weather')  loadWeather();
  };
});

/* ========== STATS INIT ========== */
$('#statVisitors').textContent = visitors;

/* ========== RENDER TASKS ========== */
function renderTasks(){
  // group by day
  const byDay = DAYS.map(()=>[]);
  tasks.forEach(t => byDay[t.day].push(t));

  const grid = $('#daysGrid');
  grid.innerHTML = '';
  DAYS.forEach((dayName, i) => {
    const col = document.createElement('div');
    col.className = 'day';
    col.innerHTML = `<h3>${dayName} · <span class="muted">${byDay[i].length} ödev</span></h3>`;
    const list = document.createElement('div');
    list.className = 'list';

    byDay[i].forEach(t => {
      const card = document.createElement('div');
      card.className = 'task';
      card.innerHTML = `
        <div class="ttl">${escapeHtml(t.subject)} ${t.tag ? `<span class="tag">${escapeHtml(t.tag)}</span>` : ''}</div>
        <div class="meta">${escapeHtml(t.desc || '')}</div>
        <div class="meta">${new Date(t.createdAt).toLocaleString('tr-TR')}</div>
      `;
      if (isAdmin()) {
        const ctr = document.createElement('div');
        ctr.className = 'controls';
        const e = document.createElement('button'); e.className='btn'; e.textContent='Düzenle';
        const r = document.createElement('button'); r.className='btn'; r.textContent='Sil';
        e.onclick = () => openEdit(t);
        r.onclick = () => removeTask(t.id);
        ctr.append(e,r);
        card.append(ctr);
      }
      list.append(card);
    });

    col.append(list);
    grid.append(col);
  });

  $('#statTasks').textContent = tasks.length;
}

/* ========== MODAL (ADD/EDIT) ========== */
const modal = $('#taskModal');
const closeModal = () => modal.classList.remove('show');
$('#closeModal').onclick = closeModal;
$('#cancelTask').onclick = closeModal;

const daySel = $('#daySelect');
const subject = $('#subject');
const desc   = $('#desc');
const tagInp = $('#tag');
const hint   = $('#modalHint');

$('#addBtn').onclick = async () => {
  const ok = await ensureAdmin(); if(!ok) return;
  editingId = null;
  $('#modalTitle').textContent = 'Yeni Ödev';
  daySel.value = '0'; subject.value=''; desc.value=''; tagInp.value='';
  hint.textContent = 'Admin modunda ekleme yapıyorsun.';
  modal.classList.add('show');
};

$('#saveTask').onclick = () => {
  const payload = {
    id: editingId || uid(),
    day: Number(daySel.value),
    subject: subject.value.trim(),
    desc: desc.value.trim(),
    tag: tagInp.value.trim(),
    createdAt: editingId ? (tasks.find(t=>t.id===editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
  };
  if (!payload.subject) { hint.textContent = 'Ders/Konu gerekli.'; return; }

  if (editingId) {
    const idx = tasks.findIndex(t=>t.id===editingId);
    if (idx!==-1) tasks[idx] = payload;
    toast('Ödev güncellendi');
  } else {
    tasks.push(payload);
    toast('Ödev eklendi');
  }
  localStorage.setItem('afl_tasks', JSON.stringify(tasks));
  modal.classList.remove('show');
  renderTasks();
};

function openEdit(t){
  editingId = t.id;
  $('#modalTitle').textContent = 'Ödevi Düzenle';
  daySel.value = String(t.day);
  subject.value = t.subject || '';
  desc.value    = t.desc || '';
  tagInp.value  = t.tag || '';
  hint.textContent = 'Düzenleme modundasın.';
  modal.classList.add('show');
}

function removeTask(id){
  if (!confirm('Silinsin mi?')) return;
  tasks = tasks.filter(t=>t.id!==id);
  localStorage.setItem('afl_tasks', JSON.stringify(tasks));
  renderTasks();
  toast('Ödev silindi');
}

/* ========== ADMIN ========== */
$('#adminBtn').onclick = ensureAdmin;
async function ensureAdmin(){
  if (isAdmin()) return true;
  const p = prompt('Admin şifresi:');
  if (p === null) return false;
  if (p === ADMIN_PASS) {
    localStorage.setItem(TOKEN_KEY, '1');
    toast('Admin moduna geçildi');
    return true;
  } else {
    alert('Hatalı şifre.');
    return false;
  }
}

/* ========== SCHEDULE (client-side) ========== */
function getSchedule(){
  const raw = localStorage.getItem('afl_schedule');
  if (raw) {
    try { const j = JSON.parse(raw); if (Array.isArray(j) && j.length===5) return j; } catch {}
  }
  // default 5x8
  return Array.from({length:5},()=>Array(8).fill('—'));
}
function setSchedule(rows){
  localStorage.setItem('afl_schedule', JSON.stringify(rows));
}
async function renderSchedule(){
  const rows = getSchedule();
  const table = $('#scheduleTable');
  table.innerHTML = '<tr><th>Gün</th>'+Array.from({length:8},(_,i)=>`<th>${i+1}</th>`).join('')+'</tr>';
  const ds = ['Pazartesi','Salı','Çarşamba','Perşembe','Cuma'];
  rows.forEach((row,ri)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<th>${ds[ri]}</th>` + row.map(c=>`<td class="editable">${escapeHtml(c)}</td>`).join('');
    table.append(tr);
  });

  // Tools görünürlüğü
  $('#scheduleTools').classList.toggle('hidden', !isAdmin());

  if (isAdmin()) {
    table.querySelectorAll('td.editable').forEach(td=>{
      td.addEventListener('click', ()=>{
        const r = td.parentElement.rowIndex - 1;
        const c = td.cellIndex - 1;
        const val = prompt('Ders / Öğretmen:', rows[r][c]);
        if (val !== null) {
          rows[r][c] = val.trim() || '—';
          setSchedule(rows);
          renderSchedule();
        }
      });
    });

    // Export/Import
    $('#exportSchedule').onclick = ()=>{
      const blob = new Blob([JSON.stringify(rows,null,2)],{type:'application/json'});
      const url  = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download='afl_schedule.json'; a.click(); URL.revokeObjectURL(url);
    };
    $('#importSchedule').onchange = async (e)=>{
      const f = e.target.files[0]; if(!f) return;
      const txt = await f.text();
      try {
        const j = JSON.parse(txt);
        if (Array.isArray(j) && j.length===5 && j.every(r=>Array.isArray(r)&&r.length===8)) {
          setSchedule(j); renderSchedule(); toast('Program yüklendi');
        } else alert('Geçersiz format');
      } catch { alert('JSON okunamadı'); }
      e.target.value = '';
    };
  }
}

/* ========== WEATHER (Open-Meteo) ========== */
const weatherGrid   = $('#weatherGrid');
const weatherStatus = $('#weatherStatus');
$('#reloadWeather').onclick = loadWeather;

async function loadWeather(){
  weatherStatus.textContent = 'Yükleniyor…';
  weatherGrid.innerHTML = '';
  try{
    const q = $('#cityInput').value.trim();
    let lat = 36.9518, lon = 30.8479; // Aksu FL civarı
    if (q) {
      // basit geocode
      const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=tr&format=json`).then(r=>r.json());
      if (geo && geo.results && geo.results[0]) { lat = geo.results[0].latitude; lon = geo.results[0].longitude; }
    }
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,windspeed_10m_max,weathercode&timezone=auto`;
    const data = await fetch(url).then(r=>r.json());

    const days = data.daily.time.slice(0,5);
    const minT = data.daily.temperature_2m_min;
    const maxT = data.daily.temperature_2m_max;
    const wind = data.daily.windspeed_10m_max;
    const code = data.daily.weathercode;

    weatherStatus.textContent = q ? `${q} • 5 Günlük Tahmin` : 'Aksu Fen Lisesi • 5 Günlük Tahmin';

    days.forEach((d,i)=>{
      const div = document.createElement('div');
      div.className = 'wc';
      div.innerHTML = `
        <img src="${icon(code[i])}" alt="">
        <h4>${new Date(d).toLocaleDateString('tr-TR',{weekday:'long'})}</h4>
        <p>${minT[i]}° / ${maxT[i]}°</p>
        <p>Rüzgar ${wind[i]} km/sa</p>
      `;
      weatherGrid.append(div);
    });
  }catch(e){
    weatherStatus.textContent = 'Hava durumu alınamadı.';
  }
}
// basit ikon eşleme
function icon(code){
  if (code < 3)  return 'https://cdn-icons-png.flaticon.com/512/3222/3222802.png'; // açık
  if (code < 60) return 'https://cdn-icons-png.flaticon.com/512/1163/1163624.png'; // bulutlu
  return 'https://cdn-icons-png.flaticon.com/512/4151/4151022.png';               // yağışlı
}

/* ========== INIT ========== */
function initVisitors(){ $('#statVisitors').textContent = visitors; }
function initTasks(){ renderTasks(); }
function initWeather(){ /* sekmeye geçince çağrılıyor */ }
function initSchedule(){ renderSchedule(); }

(function start(){
  initVisitors();
  initTasks();
  initSchedule();
  // hava durumu sekmesine geçildiğinde yenilenir
})();
