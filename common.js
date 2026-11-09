const MONTHS = ['styczeń','luty','marzec','kwiecień','maj','czerwiec','lipiec','sierpień','wrzesień','październik','listopad','grudzień'];
const CAT_PL = { handling: 'Obsługa (handling)', storage: 'Magazynowanie', transport: 'Transport', refacturing: 'Refaktury' };
const CAT_ORDER = ['handling', 'storage', 'transport', 'refacturing'];
const PALLET_SERVICE = 'Magazynowanie palet';
const HOURS_SERVICE = 'Godziny dodatkowe';
const PAGES = [['index.html','Pulpit','home'],['evidence.html','Ewidencje','evidence'],['items.html','Transport i refaktury','items'],['invoice.html','Faktura','invoice']];
const ctx = { clients: [], services: [], categories: [] };

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt = n => n == null ? '' : Number(n).toLocaleString('pl-PL', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const catName = n => CAT_PL[n] || n;
const serviceId = name => { const s = ctx.services.find(x => x.name === name); return s ? s.id : null; };
function showMsg(t, err) { $('msg').innerHTML = t ? '<div class="alert ' + (err ? 'err' : 'ok') + '">' + esc(t) + '</div>' : ''; }
function loadState() { try { return JSON.parse(localStorage.getItem('rz')) || {}; } catch (e) { return {}; } }
function saveState() { try { localStorage.setItem('rz', JSON.stringify({c: $('clientSel').value, y: $('yearInp').value, m: $('monthSel').value})); } catch (e) {} }
function params() {
  const y = parseInt($('yearInp').value), m = parseInt($('monthSel').value), mm = String(m).padStart(2, '0');
  return { client: parseInt($('clientSel').value), year: y, month: m, first: y + '-' + mm + '-01', end: y + '-' + mm + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0') };
}

async function initPage(active, render) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.href = 'index.html'; return; }
  const { data: profile } = await sb.from('app_users').select('email,role').eq('user_id', session.user.id).maybeSingle();
  if (!profile) { await sb.auth.signOut(); location.href = 'index.html?e=1'; return; }
  const st = loadState(), now = new Date();
  document.body.innerHTML =
    '<nav><div class="brand">Rozliczenia</div>' +
    PAGES.map(p => '<a href="' + p[0] + '" class="' + (p[2] === active ? 'active' : '') + '">' + p[1] + '</a>').join('') +
    '</nav>' +
    '<div class="main"><div class="top">' +
    '<div><label>Klient</label><select id="clientSel"></select></div>' +
    '<div><label>Rok</label><input id="yearInp" type="number" style="width:90px"></div>' +
    '<div><label>Miesiąc</label><select id="monthSel"></select></div>' +
    '<div id="badge"></div><div class="topright"><span>' + new Date().toLocaleDateString('pl-PL', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'}) + '</span><b>' + esc(profile.email) + '</b><button class="sec" id="outBtn">Wyloguj</button></div></div>' +
    '<div class="content"><div id="msg"></div><div id="content"></div></div></div>';
  $('outBtn').onclick = async () => { await sb.auth.signOut(); location.href = 'index.html'; };
  $('yearInp').value = st.y || now.getFullYear();
  $('monthSel').innerHTML = MONTHS.map((m, i) => '<option value="' + (i + 1) + '">' + m + '</option>').join('');
  $('monthSel').value = st.m || now.getMonth() + 1;
  const [c, s, k] = await Promise.all([
    sb.from('clients').select('id,name').eq('active', true).order('name'),
    sb.from('services').select('id,name,unit'),
    sb.from('categories').select('id,name')]);
  ctx.clients = c.data || []; ctx.services = s.data || []; ctx.categories = k.data || [];
  $('clientSel').innerHTML = ctx.clients.map(x => '<option value="' + x.id + '">' + esc(x.name) + '</option>').join('');
  if (st.c) $('clientSel').value = st.c;
  const refresh = async () => {
    saveState(); showMsg('');
    if (!$('clientSel').value) { showMsg('Brak przypisanych klientów.', true); return; }
    const p = params();
    const per = await sb.from('periods').select('status').eq('client_id', p.client).eq('year', p.year).eq('month', p.month).maybeSingle();
    const closed = per.data && per.data.status === 'closed';
    $('badge').innerHTML = '<span class="badge ' + (closed ? 'closed' : 'open') + '">' + (closed ? 'Miesiąc zamknięty' : 'Miesiąc otwarty') + '</span>';
    await render();
  };
  window.reloadPage = refresh;
  ['clientSel', 'yearInp', 'monthSel'].forEach(id => $(id).onchange = refresh);
  refresh();
}
