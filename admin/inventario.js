'use strict';
/* Inventario, Resumen y Gastos del panel. Va después de admin.js y usa sus helpers
   (sb, $, h, icon, toast, busy, money, state). Reemplaza seguimiento-inventario.xlsx.

   Escribe en las tablas (inventario, gastos) y lee de las vistas (inventario_calc,
   inventario_resumen, inventario_totales), que calculan utilidad, margen y días en la base:
   así el panel y el chat de operación ven exactamente los mismos números.
   Todo lo que viene de la base se pinta con textContent (helper h), nunca como HTML. */

const INV = {
  units: [],          // filas de inventario_calc
  resumen: [],
  totales: null,
  gastos: [],
  loaded: false,
  loading: null,
  section: 'productos',
  filter: 'stock',    // stock | vendidas | todas
  q: '',
  pedido: 'todos',
  open: new Set(),    // grupos desplegados
  sort: 'rotacion',
  editing: null,      // unidad abierta en el diálogo, o null al crear
  gasto: null
};

const CANALES = ['Marketplace', 'Instagram', 'WhatsApp', 'TikTok', 'Conocido', 'Discord'];
const SECTIONS = { productos: ['listView'], inventario: ['invView'], resumen: ['resView'], gastos: ['gasView'] };

/* ---------- utilidades ---------- */
// "hoy" en Bogotá, igual que hoy_bogota() en la base
const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const fmtFecha = (d) => {
  if (!d) return '';
  const [y, m, dd] = d.split('-').map(Number);
  const s = new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', '');
  return y === +hoy().slice(0, 4) ? s : `${s} ${y}`;
};
const pct = (x) => (x === null || x === undefined ? '—' : `${(Number(x) * 100).toFixed(1).replace('.', ',')}%`);
const moneyOr = (n, dash = '—') => (n === null || n === undefined ? dash : money(n));
const dias = (n) => (n === null || n === undefined ? '—' : `${n} ${Number(n) === 1 ? 'día' : 'días'}`);
const plural2 = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// número entero ≥ 0 desde un input; '' -> null. Acepta "20.000" y "$20.000".
function intOrNull(raw, label, { min = 0, required = false } = {}) {
  const t = String(raw ?? '').replace(/[$\s.]/g, '').trim();
  if (!t) { if (required) throw new Error(`Falta ${label}`); return null; }
  if (!/^\d+$/.test(t) || +t < min) throw new Error(`${label}: solo números enteros${min > 0 ? ' mayores que 0' : ''}`);
  return +t;
}
const textOrNull = (v) => (String(v ?? '').trim() || null);
const dateOrNull = (v) => (v ? v : null);

function errBox(id, msg) {
  const el = $('#' + id);
  el.textContent = msg || '';
  el.hidden = !msg;
}

// estado de una unidad, del más avanzado al menos
function unitState(u) {
  if (u.fecha_venta) return 'vendida';
  if (u.fecha_publicacion) return 'publicada';
  if (u.fecha_llegada) return 'bodega';
  return 'camino';
}
const STATE_LABEL = { vendida: 'Vendida', publicada: 'Publicada', bodega: 'Sin publicar', camino: 'En camino' };
// verde ≤ 30 días, rojo > 60 (regla del Excel)
const rotClass = (d) => (d === null || d === undefined ? '' : d <= 30 ? 'good' : d > 60 ? 'bad' : '');

/* ---------- datos ---------- */
async function loadInv(force = false) {
  if (INV.loading && !force) return INV.loading;
  INV.loading = (async () => {
    const [u, r, t, g] = await Promise.all([
      sb.from('inventario_calc').select('*').order('id'),
      sb.from('inventario_resumen').select('*'),
      sb.from('inventario_totales').select('*').maybeSingle(),
      sb.from('gastos').select('*').order('fecha', { ascending: false }).order('id', { ascending: false })
    ]);
    const err = u.error || r.error || t.error || g.error;
    if (err) throw err;
    INV.units = u.data; INV.resumen = r.data; INV.totales = t.data; INV.gastos = g.data;
    INV.loaded = true;
  })();
  try { await INV.loading; }
  catch (err) { toast('No se pudo cargar el inventario: ' + err.message, 'err'); }
  finally { INV.loading = null; }
  renderSection();
}

// update que detecta cuando el RLS no deja tocar nada (0 filas)
async function invUpdate(table, ids, fields) {
  const list = Array.isArray(ids) ? ids : [ids];
  const { data, error } = await sb.from(table).update(fields).in('id', list).select('id');
  if (error) throw error;
  if (!data || data.length !== list.length) throw new Error('No se guardó todo (sin permiso o la fila ya no existe)');
}

/* ---------- secciones ---------- */
function showSection(name) {
  if (!SECTIONS[name]) name = 'productos';
  if (state.form) return;                     // con el formulario de producto abierto no se cambia de sección
  INV.section = name;
  for (const [sec, ids] of Object.entries(SECTIONS)) for (const id of ids) $('#' + id).hidden = sec !== name;
  if (name !== 'productos') $('#formView').hidden = true;
  document.querySelectorAll('.section-link').forEach((a) => {
    if (a.dataset.section === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (name !== 'productos') {
    if (!INV.loaded) { renderSection(); loadInv(); } else renderSection();
  }
}
function sectionFromHash() { return (location.hash || '#productos').slice(1).split('=')[0]; }
window.addEventListener('hashchange', () => showSection(sectionFromHash()));

window.onAppEnter = () => { showSection(sectionFromHash()); };
window.onAppLogout = () => {
  INV.units = []; INV.resumen = []; INV.totales = null; INV.gastos = []; INV.loaded = false;
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
};

function renderSection() {
  if (INV.section === 'inventario') renderInv();
  else if (INV.section === 'resumen') renderRes();
  else if (INV.section === 'gastos') renderGastos();
}

/* ---------- Inventario ---------- */
function kpi(label, value, sub, cls = '') {
  return h('div', { class: 'kpi ' + cls },
    h('span', { class: 'kpi-label', text: label }),
    h('strong', { class: 'kpi-value tnum', text: value }),
    sub ? h('span', { class: 'kpi-sub tnum', text: sub }) : null);
}

function renderKpis() {
  const t = INV.totales;
  if (!INV.loaded || !t) { $('#invKpis').replaceChildren(...Array.from({ length: 4 }, () => h('div', { class: 'kpi skel-kpi' }))); return; }
  const mes = hoy().slice(0, 7);
  const delMes = INV.units.filter((u) => u.fecha_venta && u.fecha_venta.startsWith(mes));
  const ingMes = delMes.reduce((s, u) => s + (u.precio_final || 0), 0);
  const utMes = delMes.reduce((s, u) => s + (u.utilidad || 0), 0);
  const sinPub = INV.units.filter((u) => unitState(u) === 'bodega').length;
  const nombreMes = new Date().toLocaleDateString('es-CO', { month: 'long', timeZone: 'America/Bogota' });
  $('#invKpis').replaceChildren(
    kpi('En stock', plural2(t.en_stock, 'unidad', 'unidades'), sinPub ? `${sinPub} sin publicar` : 'todas publicadas', sinPub ? 'warn' : ''),
    kpi('Plata quieta', money(t.capital_inmovilizado), 'costo de lo no vendido'),
    kpi(`Ventas de ${nombreMes}`, money(ingMes), plural2(delMes.length, 'venta', 'ventas')),
    kpi(`Utilidad de ${nombreMes}`, money(utMes), ingMes ? `margen ${pct(utMes / ingMes)}` : 'sin ventas aún', utMes > 0 ? 'good' : ''));
}

function groupKey(u) { return `${u.modelo}\u0000${u.color || ''}`; }

function invVisible() {
  const q = INV.q.trim().toLowerCase();
  return INV.units.filter((u) =>
    (INV.filter === 'todas' || (INV.filter === 'stock' ? u.en_stock : !u.en_stock)) &&
    (INV.pedido === 'todos' || (u.pedido || 'Sin pedido') === INV.pedido) &&
    (!q || [u.modelo, u.marca, u.color, u.notas].some((v) => v && v.toLowerCase().includes(q))));
}

function renderPedidoChips() {
  const base = INV.units.filter((u) => INV.filter === 'todas' || (INV.filter === 'stock' ? u.en_stock : !u.en_stock));
  const pedidos = [...new Set(INV.units.map((u) => u.pedido || 'Sin pedido'))].sort((a, b) => b.localeCompare(a, 'es', { numeric: true }));
  if (pedidos.length < 2) { $('#pedidoChips').replaceChildren(); return; }
  const opts = ['todos', ...pedidos];
  $('#pedidoChips').replaceChildren(...opts.map((p) => {
    const n = p === 'todos' ? base.length : base.filter((u) => (u.pedido || 'Sin pedido') === p).length;
    return h('button', {
      class: 'cat tnum', type: 'button', 'aria-pressed': String(INV.pedido === p),
      text: `${p === 'todos' ? 'Todos los pedidos' : p} ${n}`,
      onclick: () => { INV.pedido = p; renderInv(); }
    });
  }));
}

function renderInv() {
  renderKpis();
  const all = INV.units;
  const stock = all.filter((u) => u.en_stock).length;
  $('#cntStock').textContent = INV.loaded ? stock : '';
  $('#cntVendidas').textContent = INV.loaded ? all.length - stock : '';
  $('#cntTodas').textContent = INV.loaded ? all.length : '';
  if (!INV.loaded) {
    $('#invSummary').textContent = 'Cargando…';
    $('#groups').replaceChildren(...Array.from({ length: 5 }, () => h('div', { class: 'group skel-group' })));
    $('#invEmpty').hidden = true;
    return;
  }
  const t = INV.totales;
  $('#invSummary').textContent = `${plural2(t.unidades, 'unidad', 'unidades')} · ${t.vendidas} vendidas · ${t.en_stock} en stock`;
  renderPedidoChips();
  fillDatalists();

  const list = invVisible();
  const groups = new Map();
  for (const u of list) {
    const k = groupKey(u);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(u);
  }
  // primero lo que lleva más días quieto: es lo que pide atención
  const arr = [...groups.values()].sort((a, b) => quiet(b) - quiet(a) || a[0].modelo.localeCompare(b[0].modelo, 'es'));
  const filtered = INV.q.trim() || INV.pedido !== 'todos';
  $('#invEmpty').hidden = arr.length > 0;
  $('#invClear').hidden = !filtered;
  $('#invEmptyText').textContent = filtered ? 'Ninguna unidad coincide con la búsqueda o el filtro.'
    : INV.filter === 'stock' ? 'No hay nada en stock. Todo vendido.'
    : INV.filter === 'vendidas' ? 'Todavía no hay ventas registradas.'
    : 'Todavía no hay unidades. Agregá la primera compra.';
  $('#groups').replaceChildren(...arr.map(groupEl));
}
// días quieto del grupo: el máximo de días en inventario (o desde llegada si no se ha publicado) entre lo que sigue en stock
function quiet(g) {
  return Math.max(-1, ...g.filter((u) => u.en_stock).map((u) => (u.dias_inventario ?? u.dias_desde_llegada ?? -1)));
}

function groupEl(units) {
  const u0 = units[0];
  const key = groupKey(u0);
  const enStock = units.filter((u) => u.en_stock);
  const vendidas = units.length - enStock.length;
  const sinPub = enStock.filter((u) => unitState(u) === 'bodega');
  const publicadas = enStock.filter((u) => unitState(u) === 'publicada');
  // consultas de todo el grupo, también de las unidades ya vendidas (son por publicación, no por unidad)
  const consultas = INV.units.filter((u) => groupKey(u) === key).reduce((s, u) => s + (u.consultas || 0), 0);
  const open = INV.open.has(key);

  // línea de estado del grupo
  let status;
  if (enStock.length === 0) status = h('span', { class: 'gstat', text: 'Todo vendido' });
  else if (publicadas.length) {
    const d = Math.max(...publicadas.map((u) => u.dias_inventario ?? 0));
    const precios = [...new Set(publicadas.map((u) => u.precio_publicado))];
    status = h('span', { class: 'gstat ' + rotClass(d) }, `Publicado ${precios.length === 1 ? moneyOr(precios[0]) : 'a varios precios'} · ${dias(d)}`);
  } else if (sinPub.length) {
    const d = Math.max(...sinPub.map((u) => u.dias_desde_llegada ?? 0));
    status = h('span', { class: 'gstat warn' }, `Sin publicar · llegó hace ${dias(d)}`);
  } else status = h('span', { class: 'gstat', text: 'En camino' });

  const head = h('button', {
    class: 'ghead', type: 'button', 'aria-expanded': String(open),
    onclick: () => { if (INV.open.has(key)) INV.open.delete(key); else INV.open.add(key); renderInv(); }
  },
    h('span', { class: 'gcount tnum', text: String(enStock.length) }),
    h('span', { class: 'ginfo' },
      h('span', { class: 'gname', text: u0.modelo }),
      h('span', { class: 'gmeta tnum' },
        [u0.marca, u0.color].filter(Boolean).join(' · ') || '—',
        h('span', { class: 'sep', 'aria-hidden': 'true', text: '·' }),
        `${enStock.length} en stock${vendidas ? `, ${vendidas} vendida${vendidas === 1 ? '' : 's'}` : ''}`)),
    status,
    icon(open ? 'up' : 'down'));

  const actions = h('div', { class: 'gactions' },
    sinPub.length ? h('button', { class: 'btn btn-sm', type: 'button', onclick: () => openPub(sinPub) }, icon('tag'), h('span', { text: 'Publicar' })) : null,
    enStock.length ? h('button', { class: 'btn btn-sm btn-sell', type: 'button', onclick: () => openSell(pickToSell(enStock)) }, icon('sale'), h('span', { text: 'Vender' })) : null,
    enStock.length ? h('button', {
      class: 'btn btn-sm btn-ghost btn-consulta', type: 'button', title: 'Sumar una consulta (aunque no compren)', 'aria-label': `${consultas} consultas. Sumar una`,
      onclick: (e) => addConsulta(enStock, e.currentTarget)
    }, icon('chat'), h('span', { class: 'tnum' }, String(consultas), h('span', { class: 'hide-sm', text: ` consulta${consultas === 1 ? '' : 's'}` })), h('span', { class: 'plus', text: '+1' })) : null);

  const body = open ? h('ul', { class: 'units' }, ...units.map(unitEl)) : null;
  return h('section', { class: 'group' + (enStock.length ? '' : ' is-done') + (open ? ' is-open' : '') }, head, actions, body);
}

// se vende primero la unidad publicada más vieja; si no hay publicadas, la primera
function pickToSell(enStock) {
  return enStock.find((u) => unitState(u) === 'publicada') || enStock[0];
}

function unitEl(u) {
  const st = unitState(u);
  const bits = [`#${u.id}`, `costo ${money(u.costo)}`];
  if (u.pedido) bits.push(u.pedido);
  let detail;
  if (st === 'vendida') {
    detail = h('span', { class: 'udetail tnum' },
      `Vendida ${fmtFecha(u.fecha_venta)} a ${money(u.precio_final)}${u.canal ? ' · ' + u.canal : ''}${u.combo ? ' · combo' : ''} · `,
      h('b', { class: (u.utilidad ?? 0) >= 0 ? 'pos' : 'neg', text: `utilidad ${money(u.utilidad)} (${pct(u.margen)})` }),
      u.dias_inventario !== null ? h('span', { class: 'rot ' + rotClass(u.dias_inventario), text: ` · ${dias(u.dias_inventario)}` }) : null);
  } else if (st === 'publicada') {
    detail = h('span', { class: 'udetail tnum' }, `Publicada ${fmtFecha(u.fecha_publicacion)} a ${money(u.precio_publicado)} · `,
      h('span', { class: 'rot ' + rotClass(u.dias_inventario), text: dias(u.dias_inventario) }));
  } else if (st === 'bodega') {
    detail = h('span', { class: 'udetail tnum', text: `Llegó ${fmtFecha(u.fecha_llegada)} · ${dias(u.dias_desde_llegada)} en bodega` });
  } else {
    detail = h('span', { class: 'udetail tnum', text: u.fecha_pedido ? `Pedida ${fmtFecha(u.fecha_pedido)}` : 'Sin fechas' });
  }
  const warn = u.estado_llegada && u.estado_llegada !== 'OK' ? h('span', { class: 'badge bad', text: u.estado_llegada }) : null;
  return h('li', { class: 'unit is-' + st },
    h('button', { class: 'unit-main', type: 'button', 'aria-label': `Editar unidad ${u.id} de ${u.modelo}`, onclick: () => openUnit(u) },
      h('span', { class: 'ustate badge st-' + st, text: STATE_LABEL[st] }),
      h('span', { class: 'uinfo' },
        h('span', { class: 'umeta tnum', text: bits.join(' · ') }, warn),
        detail,
        u.notas ? h('span', { class: 'unotes', text: u.notas }) : null)),
    h('div', { class: 'unit-side' },
      st === 'bodega' ? iconBtn('tag', 'Publicar esta unidad', () => openPub([u])) : null,
      st === 'publicada' || st === 'bodega' ? iconBtn('sale', 'Vender esta unidad', () => openSell(u)) : null,
      iconBtn('edit', 'Editar', () => openUnit(u))));
}

async function addConsulta(enStock, btn) {
  // las consultas son por publicación: se suman a una unidad del grupo y el resumen las suma por modelo
  const u = pickToSell(enStock);
  busy(btn, true);
  try {
    await invUpdate('inventario', u.id, { consultas: (u.consultas || 0) + 1 });
    toast(`${u.modelo}: +1 consulta`);
    await loadInv(true);
  } catch (err) { toast('No se pudo sumar: ' + err.message, 'err'); }
  finally { busy(btn, false); }
}

$('#invSearch').addEventListener('input', (e) => { INV.q = e.target.value; renderInv(); });
document.querySelectorAll('.inv-tab').forEach((t) => t.addEventListener('click', () => {
  INV.filter = t.dataset.filter;
  document.querySelectorAll('.inv-tab').forEach((x) => x.setAttribute('aria-selected', String(x === t)));
  renderInv();
}));
$('#invClear').addEventListener('click', () => { INV.q = ''; INV.pedido = 'todos'; $('#invSearch').value = ''; renderInv(); });

function fillDatalists() {
  const uniq = (f) => [...new Set(INV.units.map(f).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  $('#dlModelos').replaceChildren(...uniq((u) => u.modelo).map((v) => h('option', { value: v })));
  $('#dlMarcas').replaceChildren(...uniq((u) => u.marca).map((v) => h('option', { value: v })));
  $('#dlPedidos').replaceChildren(...uniq((u) => u.pedido).map((v) => h('option', { value: v })));
}

/* ---------- diálogos: utilidades ---------- */
document.querySelectorAll('dialog [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

function confirmBox(title, text, yes, { danger = false } = {}) {
  return new Promise((resolve) => {
    const d = $('#confirmDialog');
    $('#confirmTitle').textContent = title;
    $('#confirmText').textContent = text;
    const y = $('#confirmYes');
    y.textContent = yes;
    y.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
    const done = (v) => { d.close(); y.onclick = null; $('#confirmNo').onclick = null; resolve(v); };
    y.onclick = () => done(true);
    $('#confirmNo').onclick = () => done(false);
    d.onclose = () => resolve(false);
    d.showModal();
  });
}

/* ---------- Publicar ---------- */
let pubUnits = [];
function openPub(units) {
  pubUnits = units;
  const u0 = units[0];
  $('#pubWhat').textContent = `${u0.modelo}${u0.color ? ' · ' + u0.color : ''}`;
  $('#pubFecha').value = hoy();
  // sugerencia: el último precio publicado del mismo modelo, si existe
  const prev = INV.units.filter((x) => x.modelo === u0.modelo && x.precio_publicado).sort((a, b) => b.id - a.id)[0];
  $('#pubPrecio').value = prev ? prev.precio_publicado : '';
  const res = INV.resumen.find((r) => r.modelo === u0.modelo);
  $('#pubHelp').textContent = res && res.precio_objetivo ? `Precio objetivo (40%): ${money(res.precio_objetivo)}` : '';
  $('#pubAllWrap').hidden = units.length < 2;
  $('#pubAll').checked = true;
  $('#pubAllLabel').textContent = `Las ${units.length} unidades sin publicar de este grupo`;
  errBox('pubError', '');
  $('#pubDialog').showModal();
  $('#pubPrecio').focus();
}
$('#pubForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  errBox('pubError', '');
  let precio;
  try {
    if (!$('#pubFecha').value) throw new Error('Falta la fecha');
    precio = intOrNull($('#pubPrecio').value, 'El precio', { min: 1, required: true });
  } catch (err) { errBox('pubError', err.message); return; }
  const units = $('#pubAll').checked ? pubUnits : [pubUnits[0]];
  const btn = $('#pubOk');
  busy(btn, true);
  try {
    await invUpdate('inventario', units.map((u) => u.id), { fecha_publicacion: $('#pubFecha').value, precio_publicado: precio });
    $('#pubDialog').close();
    toast(`${units[0].modelo}: ${units.length === 1 ? 'publicada' : units.length + ' publicadas'} a ${money(precio)}`);
    await loadInv(true);
  } catch (err) { errBox('pubError', 'No se pudo guardar: ' + err.message); }
  finally { busy(btn, false); }
});

/* ---------- Vender ---------- */
let sellUnit = null;
$('#sellCanal').replaceChildren(...CANALES.map((c) => h('button', { type: 'button', class: 'pill', 'data-canal': c, text: c })));
$('#sellCanal').addEventListener('click', (e) => {
  const b = e.target.closest('.pill'); if (!b) return;
  const on = b.getAttribute('aria-pressed') !== 'true';
  $('#sellCanal').querySelectorAll('.pill').forEach((x) => x.setAttribute('aria-pressed', String(x === b && on)));
});
$('#sellDomPills').addEventListener('click', (e) => {
  const b = e.target.closest('.pill'); if (!b) return;
  $('#sellDom').value = b.dataset.dom;
  syncDomPills(); sellCalc();
});
function syncDomPills() {
  const v = $('#sellDom').value.replace(/[$\s.]/g, '');
  $('#sellDomPills').querySelectorAll('.pill').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.dom === v)));
}
$('#sellDom').addEventListener('input', () => { syncDomPills(); sellCalc(); });
$('#sellPrecio').addEventListener('input', sellCalc);

function sellCalc() {
  const u = sellUnit; if (!u) return;
  let p, d;
  try { p = intOrNull($('#sellPrecio').value, 'precio'); d = intOrNull($('#sellDom').value, 'domicilio'); }
  catch { $('#sellCalc').textContent = ''; return; }
  if (p === null) { $('#sellCalc').textContent = ''; return; }
  const ut = p - u.costo - (d || 0);
  $('#sellCalc').replaceChildren(...[`Costo ${money(u.costo)} → utilidad `, h('b', { class: ut >= 0 ? 'pos' : 'neg', text: `${money(ut)} (${p ? pct(ut / p) : '—'})` }),
    d === null ? h('span', { class: 'muted', text: ' · sin contar domicilio' }) : null].filter(Boolean));
}

function openSell(u) {
  sellUnit = u;
  $('#sellWhat').textContent = `${u.modelo}${u.color ? ' · ' + u.color : ''} · unidad #${u.id}${u.precio_publicado ? ` · publicada a ${money(u.precio_publicado)}` : ''}`;
  $('#sellFecha').value = hoy();
  $('#sellPrecio').value = u.precio_publicado || '';
  $('#sellDom').value = '0';
  $('#sellCombo').checked = false;
  $('#sellNota').value = '';
  $('#sellCanal').querySelectorAll('.pill').forEach((x) => x.setAttribute('aria-pressed', 'false'));
  syncDomPills(); sellCalc();
  errBox('sellError', '');
  $('#sellDialog').showModal();
  $('#sellPrecio').focus();
}

$('#sellForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  errBox('sellError', '');
  const u = sellUnit;
  let fields;
  try {
    if (!$('#sellFecha').value) throw new Error('Falta la fecha de venta');
    const canalBtn = $('#sellCanal [aria-pressed="true"]');
    if (!canalBtn) throw new Error('Elegí el canal de la venta');
    const nota = $('#sellNota').value.trim();
    fields = {
      fecha_venta: $('#sellFecha').value,
      precio_final: intOrNull($('#sellPrecio').value, 'El precio final', { required: true }),
      costo_domicilio: intOrNull($('#sellDom').value, 'El domicilio'),
      canal: canalBtn.dataset.canal,
      combo: $('#sellCombo').checked
    };
    if (nota) fields.notas = u.notas ? `${u.notas}\n${nota}` : nota;
    // sin fecha de publicación (encargo, venta directa) no se inventa una: los días quedan vacíos
    // y esa venta no entra al promedio de rotación, igual que en el Excel
  } catch (err) { errBox('sellError', err.message); return; }
  const btn = $('#sellOk');
  busy(btn, true);
  try {
    await invUpdate('inventario', u.id, fields);
    $('#sellDialog').close();
    toast(`Venta guardada: ${u.modelo} a ${money(fields.precio_final)}`);
    await loadInv(true);
    await maybeAgotado(u);
  } catch (err) { errBox('sellError', 'No se pudo guardar: ' + err.message); }
  finally { busy(btn, false); }
});

// F4: si era la última unidad en stock de un producto de la web, preguntar si marcarlo agotado
async function maybeAgotado(u) {
  if (!u.producto_id) return;
  const quedan = INV.units.filter((x) => x.producto_id === u.producto_id && x.en_stock).length;
  const p = (state.productos || []).find((x) => x.id === u.producto_id);
  if (quedan > 0 || !p || p.agotado || !p.activo) return;
  const ok = await confirmBox('¿Marcar agotado en la web?',
    `No quedan unidades de ${p.nombre} en stock. Si era un encargo o un combo y todavía hay, dejalo como está.`, 'Marcar agotado');
  if (!ok) return;
  try {
    await patch(p.id, { agotado: true });
    p.agotado = true;
    toast(`${p.nombre}: agotado en la web`);
    if (typeof renderList === 'function') renderList();
  } catch (err) { toast('No se pudo marcar agotado: ' + err.message, 'err'); }
}

/* ---------- Agregar compra / editar unidad ---------- */
const UFIELDS = {
  uModelo: 'modelo', uMarca: 'marca', uColor: 'color', uPedido: 'pedido', uCosto: 'costo',
  uFPedido: 'fecha_pedido', uFLlegada: 'fecha_llegada', uEstado: 'estado_llegada',
  uFPub: 'fecha_publicacion', uPPub: 'precio_publicado', uConsultas: 'consultas',
  uFVenta: 'fecha_venta', uPFinal: 'precio_final', uDom: 'costo_domicilio', uCanal: 'canal', uNotas: 'notas'
};

function fillProductoSelect(sel) {
  const prods = (state.productos || []).filter((p) => p.activo).slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  $('#uProducto').replaceChildren(h('option', { value: '', text: '— ninguno —' }), ...prods.map((p) => h('option', { value: p.id, text: p.nombre })));
  $('#uProducto').value = sel || '';
}

function openUnit(u, { dup = false } = {}) {
  const creating = !u || dup;
  INV.editing = creating ? null : u;
  $('#unitTitle').textContent = !u ? 'Agregar compra' : dup ? 'Duplicar unidad' : `${u.modelo}`;
  $('#unitSub').textContent = !u ? 'Una fila por unidad: si compraste 3 iguales, poné cantidad 3.'
    : dup ? `Copia de la unidad #${u.id}, sin la venta.` : `Unidad #${u.id} · ${STATE_LABEL[unitState(u)]}`;
  const src = u || {};
  for (const [id, f] of Object.entries(UFIELDS)) $('#' + id).value = src[f] ?? '';
  $('#uCombo').checked = !!src.combo;
  if (!u) { $('#uFPedido').value = hoy(); $('#uEstado').value = ''; $('#uConsultas').value = 0; }
  if (dup) {   // la copia arranca sin venta ni consultas
    for (const id of ['uFVenta', 'uPFinal', 'uDom', 'uCanal']) $('#' + id).value = '';
    $('#uCombo').checked = false; $('#uConsultas').value = 0;
  }
  fillProductoSelect(src.producto_id);
  $('#uCantWrap').hidden = !creating;
  $('#uCant').value = 1;
  $('#uCantHelp').textContent = '';
  $('#uPubSet').hidden = !u;              // al agregar compra no hace falta: se publica después
  $('#uSaleSet').hidden = !u || dup;
  $('#unitDelete').hidden = creating;
  $('#unitDup').hidden = creating;
  $('#unitOk').textContent = creating ? 'Agregar' : 'Guardar cambios';
  errBox('unitError', '');
  fillDatalists();
  $('#unitDialog').showModal();
  if (!u) $('#uModelo').focus();
}
$('#buyBtn').addEventListener('click', () => openUnit(null));
$('#unitDup').addEventListener('click', () => { const u = INV.editing; $('#unitDialog').close(); openUnit(u, { dup: true }); });

// al escribir un modelo que ya existe, completar marca (y la regla de cantidad máxima)
$('#uModelo').addEventListener('change', () => {
  const m = $('#uModelo').value.trim();
  const prev = INV.units.filter((x) => x.modelo === m).sort((a, b) => b.id - a.id)[0];
  if (prev && !$('#uMarca').value) $('#uMarca').value = prev.marca || '';
  if (prev && !$('#uProducto').value && prev.producto_id) $('#uProducto').value = prev.producto_id;
  cantHelp();
});
$('#uCant').addEventListener('input', cantHelp);
// regla de compra: máximo 3 por modelo nuevo; hasta 6 si ya rotó (avisa, no bloquea)
function cantHelp() {
  const n = +$('#uCant').value || 0;
  const res = INV.resumen.find((r) => r.modelo === $('#uModelo').value.trim());
  const yaRoto = res && res.vendidas > 0;
  const max = yaRoto ? 6 : 3;
  $('#uCantHelp').textContent = n > max ? `Ojo: la regla es máximo ${max} por ${yaRoto ? 'modelo que ya rotó' : 'modelo nuevo'}` : '';
}

function collectUnit() {
  const modelo = textOrNull($('#uModelo').value);
  if (!modelo) throw new Error('Falta el modelo');
  const row = {
    modelo,
    marca: textOrNull($('#uMarca').value),
    color: textOrNull($('#uColor').value),
    pedido: textOrNull($('#uPedido').value),
    costo: intOrNull($('#uCosto').value, 'El costo', { required: true }),
    fecha_pedido: dateOrNull($('#uFPedido').value),
    fecha_llegada: dateOrNull($('#uFLlegada').value),
    estado_llegada: textOrNull($('#uEstado').value),
    producto_id: textOrNull($('#uProducto').value),
    notas: textOrNull($('#uNotas').value)
  };
  if (!$('#uPubSet').hidden) {
    row.fecha_publicacion = dateOrNull($('#uFPub').value);
    row.precio_publicado = intOrNull($('#uPPub').value, 'El precio publicado', { min: 1 });
    row.consultas = intOrNull($('#uConsultas').value, 'Las consultas') ?? 0;
  }
  if (!$('#uSaleSet').hidden) {
    row.fecha_venta = dateOrNull($('#uFVenta').value);
    row.precio_final = intOrNull($('#uPFinal').value, 'El precio final');
    row.costo_domicilio = intOrNull($('#uDom').value, 'El domicilio');
    row.canal = textOrNull($('#uCanal').value);
    row.combo = $('#uCombo').checked;
    if ((row.fecha_venta === null) !== (row.precio_final === null)) throw new Error('Para la venta van juntos la fecha y el precio final (o los dos vacíos)');
  }
  if (row.fecha_llegada && row.fecha_pedido && row.fecha_llegada < row.fecha_pedido) throw new Error('La llegada no puede ser antes del pedido');
  if (row.fecha_publicacion && row.fecha_llegada && row.fecha_publicacion < row.fecha_llegada) throw new Error('La publicación no puede ser antes de la llegada');
  if (row.fecha_venta && row.fecha_publicacion && row.fecha_venta < row.fecha_publicacion) throw new Error('La venta no puede ser antes de la publicación');
  return row;
}

$('#unitForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  errBox('unitError', '');
  let row;
  try { row = collectUnit(); } catch (err) { errBox('unitError', err.message); return; }
  const btn = $('#unitOk');
  busy(btn, true);
  try {
    if (INV.editing) {
      await invUpdate('inventario', INV.editing.id, row);
      toast('Unidad guardada');
    } else {
      const n = Math.max(1, Math.min(20, parseInt($('#uCant').value, 10) || 1));
      const rows = Array.from({ length: n }, () => ({ ...row }));
      const { data, error } = await sb.from('inventario').insert(rows).select('id');
      if (error) throw error;
      if (!data || data.length !== n) throw new Error('No se crearon todas las unidades (sin permiso)');
      toast(`${row.modelo}: ${plural2(n, 'unidad agregada', 'unidades agregadas')}`);
      INV.open.add(groupKey(row));
    }
    $('#unitDialog').close();
    await loadInv(true);
  } catch (err) { errBox('unitError', 'No se pudo guardar: ' + err.message); }
  finally { busy(btn, false); }
});

$('#unitDelete').addEventListener('click', async () => {
  const u = INV.editing; if (!u) return;
  $('#unitDialog').close();
  const ok = await confirmBox('Eliminar unidad', `Se borra la unidad #${u.id} (${u.modelo}). No se puede deshacer. Si se vendió, mejor dejala: cuenta en el resumen.`, 'Eliminar', { danger: true });
  if (!ok) { $('#unitDialog').showModal(); return; }
  try {
    const { data, error } = await sb.from('inventario').delete().eq('id', u.id).select('id');
    if (error) throw error;
    if (!data || data.length !== 1) throw new Error('No se eliminó (sin permiso o ya no existe)');
    toast(`Unidad #${u.id} eliminada`);
    await loadInv(true);
  } catch (err) { toast('No se pudo eliminar: ' + err.message, 'err'); }
});

/* ---------- Resumen ---------- */
function renderRes() {
  const t = INV.totales;
  if (!INV.loaded || !t) {
    $('#totals').replaceChildren(...Array.from({ length: 6 }, () => h('div', { class: 'kpi skel-kpi' })));
    $('#resRows').replaceChildren();
    return;
  }
  $('#totals').replaceChildren(
    kpi('Inversión', money(t.inversion), plural2(t.unidades, 'unidad', 'unidades')),
    kpi('Ingresos', money(t.ingresos), plural2(t.vendidas, 'vendida', 'vendidas')),
    kpi('Utilidad bruta', money(t.utilidad), t.ingresos ? `margen ${pct(t.utilidad / t.ingresos)}` : '—', t.utilidad > 0 ? 'good' : ''),
    kpi('ROI', pct(t.roi), 'utilidad / inversión total'),
    kpi('Plata quieta', money(t.capital_inmovilizado), plural2(t.en_stock, 'unidad', 'unidades') + ' sin vender'),
    kpi('Después de gastos', money(t.utilidad_despues_gastos), `gastos ${money(t.gastos)}`, t.utilidad_despues_gastos >= 0 ? '' : 'bad'));

  const rows = INV.resumen.slice();
  const nameCmp = (a, b) => a.modelo.localeCompare(b.modelo, 'es', { numeric: true });
  const sorters = {
    // con ventas primero, de la que rota más rápido a la más lenta; sin datos al final
    rotacion: (a, b) => (a.dias_prom_venta === null) - (b.dias_prom_venta === null) || (a.dias_prom_venta ?? 0) - (b.dias_prom_venta ?? 0) || nameCmp(a, b),
    utilidad: (a, b) => b.utilidad - a.utilidad || nameCmp(a, b),
    stock: (a, b) => b.en_stock - a.en_stock || (b.max_dias_en_bodega ?? -1) - (a.max_dias_en_bodega ?? -1) || nameCmp(a, b),
    nombre: nameCmp
  };
  rows.sort(sorters[INV.sort]);
  const vClass = (v) => (v.startsWith('REPONER') ? 'good' : v.startsWith('NO') ? 'bad' : v.startsWith('Sin') ? 'muted' : '');
  $('#resRows').replaceChildren(...rows.map((r) => h('tr', {},
    h('th', { scope: 'row' }, h('span', { class: 'rmodel', text: r.modelo }), r.marca ? h('span', { class: 'rbrand', text: r.marca }) : null),
    h('td', { 'data-l': 'Und.', text: String(r.unidades) }),
    h('td', { 'data-l': 'Vend.', text: String(r.vendidas) }),
    h('td', { 'data-l': 'Stock', class: r.en_stock ? 'strong' : 'muted', text: String(r.en_stock) }),
    h('td', { 'data-l': 'Inversión', text: money(r.inversion) }),
    h('td', { 'data-l': 'Ingresos', text: r.ingresos ? money(r.ingresos) : '—' }),
    h('td', { 'data-l': 'Utilidad', class: r.utilidad > 0 ? 'pos' : r.utilidad < 0 ? 'neg' : 'muted', text: r.vendidas ? money(r.utilidad) : '—' }),
    h('td', { 'data-l': 'Margen', text: pct(r.margen) }),
    h('td', { 'data-l': 'Días venta', class: 'rot ' + rotClass(r.dias_prom_venta), text: r.dias_prom_venta === null ? '—' : String(r.dias_prom_venta).replace('.', ',') }),
    h('td', { 'data-l': 'Veredicto', class: 'verdict' }, h('span', { class: 'vtag ' + vClass(r.veredicto), text: r.veredicto })),
    h('td', { 'data-l': 'Precio obj.', text: moneyOr(r.precio_objetivo) }))));
}
document.querySelectorAll('.res-sort').forEach((t) => t.addEventListener('click', () => {
  INV.sort = t.dataset.sort;
  document.querySelectorAll('.res-sort').forEach((x) => x.setAttribute('aria-selected', String(x === t)));
  renderRes();
}));

/* ---------- CSV (abre en Excel en español: separador ";" y BOM) ---------- */
function csv(rows, cols) {
  const cell = (v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    if (typeof v === 'number' && !Number.isInteger(v)) v = String(v).replace('.', ',');
    const s = String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [cols.map((c) => c[1]).join(';'), ...rows.map((r) => cols.map(([k]) => cell(r[k])).join(';'))].join('\r\n');
}
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
$('#csvInv').addEventListener('click', () => {
  if (!INV.loaded) return;
  download(`inventario-flick-${hoy()}.csv`, csv(INV.units.map((u) => ({ ...u, margen: u.margen === null ? null : Number(u.margen) })), [
    ['id', 'ID'], ['modelo', 'Modelo'], ['marca', 'Marca'], ['color', 'Color'], ['pedido', 'Pedido'], ['costo', 'Costo pagado'],
    ['fecha_pedido', 'Fecha pedido'], ['fecha_llegada', 'Fecha llegada'], ['estado_llegada', 'Estado llegada'],
    ['fecha_publicacion', 'Fecha publicación'], ['precio_publicado', 'Precio publicado'], ['consultas', 'Consultas'],
    ['fecha_venta', 'Fecha venta'], ['precio_final', 'Precio final'], ['costo_domicilio', 'Costo domicilio'], ['canal', 'Canal'], ['combo', 'Combo'],
    ['utilidad', 'Utilidad'], ['margen', 'Margen'], ['dias_inventario', 'Días inventario'], ['dias_desde_llegada', 'Días desde llegada'],
    ['producto_id', 'Producto web'], ['notas', 'Notas']]));
});
$('#csvGas').addEventListener('click', () => {
  if (!INV.loaded) return;
  download(`gastos-flick-${hoy()}.csv`, csv(INV.gastos, [['fecha', 'Fecha'], ['concepto', 'Concepto'], ['monto', 'Monto'], ['pedido', 'Pedido'], ['notas', 'Notas']]));
});

/* ---------- Gastos ---------- */
function renderGastos() {
  if (!INV.loaded) { $('#gasRows').replaceChildren(...skeletonRows()); $('#gasEmpty').hidden = true; return; }
  const total = INV.gastos.reduce((s, g) => s + g.monto, 0);
  $('#gasSummary').textContent = `${plural2(INV.gastos.length, 'gasto', 'gastos')} · total ${money(total)}`;
  $('#gasEmpty').hidden = INV.gastos.length > 0;
  $('#gasRows').replaceChildren(...INV.gastos.map((g) => h('li', { class: 'row' },
    h('button', { class: 'row-main', type: 'button', 'aria-label': 'Editar gasto ' + g.concepto, onclick: () => openGasto(g) },
      h('span', { class: 'gdate tnum', text: fmtFecha(g.fecha) }),
      h('span', { class: 'row-info' },
        h('span', { class: 'row-name', text: g.concepto }),
        h('span', { class: 'row-meta', text: [g.pedido, g.notas].filter(Boolean).join(' · ') || ' ' }))),
    h('div', { class: 'row-side' }, h('strong', { class: 'tnum gmonto', text: money(g.monto) }), iconBtn('edit', 'Editar gasto', () => openGasto(g))))));
}

function openGasto(g) {
  INV.gasto = g;
  $('#gastoTitle').textContent = g ? 'Editar gasto' : 'Nuevo gasto';
  $('#gFecha').value = g ? g.fecha : hoy();
  $('#gMonto').value = g ? g.monto : '';
  $('#gConcepto').value = g ? g.concepto : '';
  $('#gPedido').value = g ? g.pedido || '' : '';
  $('#gNotas').value = g ? g.notas || '' : '';
  $('#gastoDelete').hidden = !g;
  errBox('gastoError', '');
  $('#gastoDialog').showModal();
  if (!g) $('#gMonto').focus();
}
$('#gastoNew').addEventListener('click', () => openGasto(null));
$('#gastoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  errBox('gastoError', '');
  let row;
  try {
    if (!$('#gFecha').value) throw new Error('Falta la fecha');
    const concepto = textOrNull($('#gConcepto').value);
    if (!concepto) throw new Error('Falta el concepto');
    row = { fecha: $('#gFecha').value, concepto, monto: intOrNull($('#gMonto').value, 'El monto', { min: 1, required: true }),
      pedido: textOrNull($('#gPedido').value), notas: textOrNull($('#gNotas').value) };
  } catch (err) { errBox('gastoError', err.message); return; }
  const btn = $('#gastoOk');
  busy(btn, true);
  try {
    if (INV.gasto) await invUpdate('gastos', INV.gasto.id, row);
    else {
      const { data, error } = await sb.from('gastos').insert(row).select('id');
      if (error) throw error;
      if (!data || data.length !== 1) throw new Error('No se creó (sin permiso)');
    }
    $('#gastoDialog').close();
    toast(INV.gasto ? 'Gasto guardado' : 'Gasto agregado');
    await loadInv(true);
  } catch (err) { errBox('gastoError', 'No se pudo guardar: ' + err.message); }
  finally { busy(btn, false); }
});
$('#gastoDelete').addEventListener('click', async () => {
  const g = INV.gasto; if (!g) return;
  $('#gastoDialog').close();
  if (!await confirmBox('Eliminar gasto', `Se borra "${g.concepto}" (${money(g.monto)}). No se puede deshacer.`, 'Eliminar', { danger: true })) { $('#gastoDialog').showModal(); return; }
  try {
    const { data, error } = await sb.from('gastos').delete().eq('id', g.id).select('id');
    if (error) throw error;
    if (!data || data.length !== 1) throw new Error('No se eliminó');
    toast('Gasto eliminado');
    await loadInv(true);
  } catch (err) { toast('No se pudo eliminar: ' + err.message, 'err'); }
});
