'use strict';

const SUPABASE_URL = 'https://nisegpuyvfujzrcjlhtw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ULilyHHntqtHTcrihvy_Pw_8ylQBEC_';  // public (publishable) key
const BUCKET = 'productos';
const STORAGE_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
const MAX_BYTES = 2 * 1024 * 1024;
const OUT_SIZE = 1600;
// Lightweight copies uploaded next to every photo; the public site reads them (see thumbSrc in app.js).
const THUMB_SIZES = [640, 200];

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (sel, root = document) => root.querySelector(sel);

// All product text goes through textContent via this helper: nothing is ever parsed as HTML.
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
  return el;
}

const SVGNS = 'http://www.w3.org/2000/svg';
function icon(name) {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'ic');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVGNS, 'use');
  use.setAttribute('href', '#i-' + name);
  svg.append(use);
  return svg;
}
const iconBtn = (name, label, onclick, { disabled = false, danger = false } = {}) =>
  h('button', { class: 'icon-btn' + (danger ? ' danger' : ''), type: 'button', 'aria-label': label, title: label, disabled, onclick }, icon(name));

const money = (n) => '$' + new Intl.NumberFormat('es-CO').format(n);
const photoSrc = (u) => (/^https?:/i.test(u) ? u : '../' + u);   // legacy "img/..." paths live at the site root
const storagePath = (u) => (typeof u === 'string' && u.startsWith(STORAGE_PREFIX) ? decodeURIComponent(u.slice(STORAGE_PREFIX.length)) : null);
const variantPaths = (path) => THUMB_SIZES.map((s) => path.replace(/\.jpg$/i, `-${s}.jpg`));

// Same naming as thumbSrc() in app.js; falls back to the full photo if the thumbnail is missing.
function thumbSrc(u, size) {
  if (typeof u !== 'string') return u;
  const local = /^img\/([^/]+)\.jpe?g$/i.exec(u);
  if (local) return `../img/thumb/${local[1]}-${size}.webp`;
  if (u.startsWith(STORAGE_PREFIX) && /\.jpg$/i.test(u)) return u.replace(/\.jpg$/i, `-${size}.jpg`);
  return photoSrc(u);
}
function thumbImg(u, size, alt = '') {
  const full = photoSrc(u);
  const img = h('img', { src: thumbSrc(u, size), alt, loading: 'lazy', decoding: 'async' });
  img.addEventListener('error', () => { if (img.src !== new URL(full, location.href).href) img.src = full; }, { once: true });
  return img;
}

let toastTimer;
function toast(msg, kind = 'ok') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast ' + kind;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, kind === 'err' ? 6000 : 2400);
}

function busy(btn, on) {
  btn.disabled = on;
  btn.classList.toggle('is-busy', on);
  btn.setAttribute('aria-busy', String(on));
}

const state = {
  categorias: [],
  productos: [],
  loaded: false,
  tab: 'activos',
  q: '',
  cat: 'todos',
  sorting: false,
  editing: null,       // product being edited, or null when creating
  form: null,          // working copy while the form is open
  snapshot: ''         // serialized form at open, to detect unsaved changes
};

/* ---------- auth ---------- */
function show(view) {
  $('#loginView').hidden = view !== 'login';
  $('#appView').hidden = view !== 'app';
}

async function isAdmin(uid) {
  const { data, error } = await sb.from('admins').select('user_id').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  return !!data;
}

function loginError(msg) {
  const el = $('#loginError');
  el.textContent = msg || '';
  el.hidden = !msg;
}

async function enter(session) {
  let ok = false;
  try { ok = await isAdmin(session.user.id); } catch (err) { console.warn('admins:', err.message); }
  if (!ok) {
    await sb.auth.signOut();
    show('login');
    loginError('Esta cuenta no tiene permiso de administrador');
    return;
  }
  $('#whoami').textContent = session.user.email || '';
  show('app');
  await bootApp();
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError('');
  const btn = $('#loginBtn');
  busy(btn, true);
  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email: $('#loginEmail').value.trim(),
      password: $('#loginPass').value
    });
    if (error || !data.session) { loginError('Correo o contraseña incorrectos'); return; }
    await enter(data.session);
  } catch (err) {
    loginError('No se pudo iniciar sesión: ' + err.message);
  } finally {
    busy(btn, false);
    $('#loginPass').value = '';
  }
});

$('#logoutBtn').addEventListener('click', async () => {
  if (state.form && isDirty() && !confirm('Tenés cambios sin guardar. ¿Salir igual?')) return;
  await sb.auth.signOut();
  state.productos = [];
  state.loaded = false;
  if (state.form) closeForm(true);
  show('login');
});

/* ---------- data ---------- */
async function bootApp() {
  if (!state.categorias.length) {
    try {
      const res = await fetch('../productos.json');
      state.categorias = (await res.json()).categorias || [];
    } catch (err) { toast('No se pudieron cargar las categorías: ' + err.message, 'err'); }
    $('#fCategoria').replaceChildren(...state.categorias.map((c) => h('option', { value: c.id, text: c.nombre })));
  }
  renderList();          // skeleton while loading
  await loadProductos();
}

async function loadProductos() {
  const { data, error } = await sb.from('productos').select('*').order('orden');
  if (error) { toast('No se pudieron cargar los productos: ' + error.message, 'err'); return; }
  state.productos = data;
  state.loaded = true;
  renderList();
}

// update that detects RLS silently matching zero rows
async function patch(id, fields) {
  const { data, error } = await sb.from('productos').update(fields).eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length !== 1) throw new Error('No se guardó (sin permiso o el producto ya no existe)');
}

/* ---------- list ---------- */
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const catName = (id) => (state.categorias.find((c) => c.id === id) || {}).nombre || id;

const inTab = (p, tab) => tab === 'activos' ? p.activo : tab === 'agotados' ? p.activo && p.agotado : !p.activo;

function visible() {
  const q = state.q.trim().toLowerCase();
  return state.productos.filter((p) =>
    inTab(p, state.tab) &&
    (state.cat === 'todos' || p.categoria === state.cat) &&
    (!q || p.nombre.toLowerCase().includes(q) || p.marca.toLowerCase().includes(q)));
}

function renderCats() {
  const base = state.productos.filter((p) => inTab(p, state.tab));
  const opts = [{ id: 'todos', nombre: 'Todas' }, ...state.categorias];
  $('#catChips').replaceChildren(...opts.map((c) => {
    const n = c.id === 'todos' ? base.length : base.filter((p) => p.categoria === c.id).length;
    return h('button', {
      class: 'cat tnum', type: 'button', 'aria-pressed': String(state.cat === c.id),
      text: state.loaded ? `${c.nombre} ${n}` : c.nombre,
      onclick: () => { state.cat = c.id; renderList(); }
    });
  }));
}

function skeletonRows() {
  return Array.from({ length: 6 }, () => h('li', { class: 'row skel', 'aria-hidden': 'true' },
    h('div', { class: 'row-main' }, h('div', { class: 'row-thumb' }),
      h('div', { class: 'row-info', style: 'flex:1' }, h('span', { class: 'skel-line', style: 'width:45%' }), h('span', { class: 'skel-line', style: 'width:28%;margin-top:8px' })))));
}

function renderList() {
  const all = state.productos;
  const activos = all.filter((p) => p.activo), agotados = activos.filter((p) => p.agotado);
  $('#countActivos').textContent = state.loaded ? activos.length : '';
  $('#countAgotados').textContent = state.loaded ? agotados.length : '';
  $('#countArchivados').textContent = state.loaded ? all.length - activos.length : '';
  $('#summary').textContent = state.loaded
    ? [plural(activos.length - agotados.length, 'disponible'), plural(agotados.length, 'agotado'), plural(all.length - activos.length, 'archivado')].join(' · ')
    : 'Cargando…';
  renderCats();

  // reordering only makes sense on the full active list
  const canSort = state.tab === 'activos' && state.cat === 'todos' && !state.q.trim();
  if (state.sorting && !canSort) setSorting(false, false);
  $('#sortBtn').hidden = state.tab !== 'activos';
  $('#sortHint').hidden = !state.sorting;

  if (!state.loaded) { $('#rows').replaceChildren(...skeletonRows()); $('#emptyMsg').hidden = true; return; }

  const list = visible();
  const filtered = state.q.trim() || state.cat !== 'todos';
  $('#emptyMsg').hidden = list.length > 0;
  $('#clearFilters').hidden = !filtered;
  $('#emptyText').textContent = filtered
    ? 'Ningún producto coincide con la búsqueda o el filtro.'
    : state.tab === 'agotados' ? 'No hay productos agotados.'
    : state.tab === 'archivados' ? 'No hay productos archivados. Al archivar uno, sale de la web y aparece acá.'
    : 'Todavía no hay productos. Creá el primero con “Nuevo producto”.';
  $('#rows').replaceChildren(...list.map((p, i) => rowEl(p, i, list)));
}

function rowEl(p, i, list) {
  const first = p.fotos && p.fotos[0];
  const thumb = h('div', { class: 'row-thumb' }, first ? thumbImg(first, 200) : h('span', { class: 'ph-txt', text: p.placeholder || '' }));
  const meta = [catName(p.categoria), p.precio ? money(p.precio) : 'Sin precio'];
  const main = h('button', { class: 'row-main', type: 'button', 'aria-label': 'Editar ' + p.nombre, onclick: () => openForm(p) },
    thumb,
    h('span', { class: 'row-info' },
      h('span', { class: 'row-name', text: p.nombre }),
      h('span', { class: 'row-meta tnum' },
        p.activo && p.agotado ? [h('span', { class: 'row-state', text: 'Agotado' }), h('span', { class: 'row-state sep', 'aria-hidden': 'true', text: '·' })] : null,
        meta[0], h('span', { class: 'sep', 'aria-hidden': 'true', text: '·' }), meta[1])));

  let side;
  if (!p.activo) {
    side = [
      h('button', { class: 'btn btn-sm btn-ghost', type: 'button', 'aria-label': 'Restaurar ' + p.nombre, title: 'Restaurar', onclick: (e) => setActivo(p, true, e.currentTarget) }, icon('restore'), h('span', { text: 'Restaurar' })),
      h('button', { class: 'btn btn-sm btn-danger-ghost', type: 'button', 'aria-label': 'Eliminar ' + p.nombre, title: 'Eliminar definitivamente', onclick: () => openDelete(p) }, icon('trash'), h('span', { text: 'Eliminar' }))
    ];
  } else if (state.sorting) {
    side = [
      iconBtn('up', 'Subir ' + p.nombre, () => move(list, i, -1), { disabled: i === 0 }),
      iconBtn('down', 'Bajar ' + p.nombre, () => move(list, i, 1), { disabled: i === list.length - 1 })
    ];
  } else {
    const sw = h('input', { type: 'checkbox', checked: !!p.agotado, 'aria-label': 'Agotado: ' + p.nombre });
    const label = h('span', { class: 'stock-label', 'aria-hidden': 'true', text: p.agotado ? 'Agotado' : 'Disponible' });
    sw.addEventListener('change', () => toggleAgotado(p, sw, row, label));
    side = [
      h('label', { class: 'stock', title: 'Marcar como agotado' }, sw, h('span', { class: 'track' }), label),
      h('button', { class: 'btn btn-sm btn-ghost row-edit', type: 'button', tabindex: -1, 'aria-hidden': 'true', onclick: () => openForm(p) }, icon('edit'), h('span', { text: 'Editar' }))
    ];
  }
  const row = h('li', { class: 'row' + (p.agotado && p.activo ? ' is-out' : ''), 'data-id': p.id }, main, h('div', { class: 'row-side' }, side));
  return row;
}

async function toggleAgotado(p, sw, row, label) {
  const next = sw.checked;
  label.textContent = next ? 'Agotado' : 'Disponible';
  row.classList.add('pending');
  try {
    await patch(p.id, { agotado: next });
    p.agotado = next;
    toast(`${p.nombre}: ${next ? 'agotado' : 'disponible'}`);
    renderList();
  } catch (err) {
    sw.checked = !next;
    label.textContent = !next ? 'Agotado' : 'Disponible';
    row.classList.remove('pending');
    toast('No se pudo cambiar: ' + err.message, 'err');
  }
}

async function move(list, i, dir) {
  const a = list[i], b = list[i + dir];
  if (!b) return;
  const [oa, ob] = [a.orden, b.orden];
  try {
    if (oa === ob) throw new Error('Dos productos tienen el mismo orden');
    await patch(a.id, { orden: ob });
    try { await patch(b.id, { orden: oa }); }
    catch (err) { await patch(a.id, { orden: oa }).catch(() => {}); throw err; }
    a.orden = ob; b.orden = oa;
    state.productos.sort((x, y) => x.orden - y.orden);
    renderList();
    const moved = $(`#rows .row[data-id="${CSS.escape(a.id)}"] .icon-btn:${dir < 0 ? 'first-child' : 'last-child'}`);
    if (moved && !moved.disabled) moved.focus();
  } catch (err) { toast('No se pudo reordenar: ' + err.message, 'err'); }
}

async function setActivo(p, activo, btn) {
  if (btn) busy(btn, true);
  try {
    await patch(p.id, { activo });
    p.activo = activo;
    toast(activo ? `${p.nombre} restaurado: vuelve a la web` : `${p.nombre} archivado: ya no se ve en la web`);
    renderList();
    return true;
  } catch (err) {
    toast('No se pudo cambiar: ' + err.message, 'err');
    return false;
  } finally { if (btn) busy(btn, false); }
}

function setSorting(on, render = true) {
  state.sorting = on;
  const b = $('#sortBtn');
  b.setAttribute('aria-pressed', String(on));
  b.querySelector('span').textContent = on ? 'Listo' : 'Ordenar';
  if (on) { state.cat = 'todos'; state.q = ''; $('#search').value = ''; }
  if (render) renderList();
}

$('#search').addEventListener('input', (e) => { state.q = e.target.value; renderList(); });
$('#sortBtn').addEventListener('click', () => setSorting(!state.sorting));
$('#clearFilters').addEventListener('click', () => { state.q = ''; state.cat = 'todos'; $('#search').value = ''; renderList(); });
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
  state.tab = t.dataset.tab;
  document.querySelectorAll('.tab').forEach((x) => x.setAttribute('aria-selected', String(x === t)));
  renderList();
}));
$('#newBtn').addEventListener('click', () => openForm(null));

/* ---------- delete ---------- */
let deleting = null;
function openDelete(p) {
  deleting = p;
  $('#deleteId').textContent = p.id;
  $('#deleteInput').value = '';
  $('#deleteOk').disabled = true;
  $('#deleteError').hidden = true;
  $('#deleteDialog').showModal();
  $('#deleteInput').focus();
}
$('#deleteInput').addEventListener('input', (e) => { $('#deleteOk').disabled = e.target.value.trim() !== deleting.id; });
$('#deleteCancel').addEventListener('click', () => $('#deleteDialog').close());
$('#deleteOk').addEventListener('click', async () => {
  const p = deleting;
  if ($('#deleteInput').value.trim() !== p.id) return;
  busy($('#deleteOk'), true);
  try {
    const { data, error } = await sb.from('productos').delete().eq('id', p.id).select('id');
    if (error) throw error;
    if (!data || data.length !== 1) throw new Error('No se eliminó (sin permiso o ya no existe)');
    state.productos = state.productos.filter((x) => x.id !== p.id);
    const failed = await removeFromStorage(p.fotos || []);
    $('#deleteDialog').close();
    renderList();
    toast(failed ? `Eliminado, pero ${failed} foto(s) siguen en Storage: revisá las políticas` : `${p.nombre} eliminado`, failed ? 'err' : 'ok');
  } catch (err) {
    $('#deleteError').textContent = 'No se pudo eliminar: ' + err.message;
    $('#deleteError').hidden = false;
  } finally {
    busy($('#deleteOk'), false);
    $('#deleteOk').disabled = $('#deleteInput').value.trim() !== (deleting && deleting.id);
  }
});

// Only Storage URLs; legacy "img/..." paths are never touched. Thumbnails go with their photo.
// Returns the number of main photos that could not be removed.
async function removeFromStorage(urls) {
  const mains = urls.map(storagePath).filter(Boolean);
  if (!mains.length) return 0;
  const { data, error } = await sb.storage.from(BUCKET).remove([...mains, ...mains.flatMap(variantPaths)]);
  if (error) { console.warn('storage remove:', error.message); return mains.length; }
  const gone = new Set((data || []).map((o) => o.name));
  return mains.filter((m) => !gone.has(m)).length;
}

/* ---------- form ---------- */
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
let idTouched = false;

const FIELDS = ['fNombre', 'fId', 'fMarca', 'fCategoria', 'fGancho', 'fDescripcion', 'fPlaceholder', 'fNota', 'fPrecio', 'fPrecioReg'];
function serializeForm() {
  if (!state.form) return '';
  return JSON.stringify([
    FIELDS.map((id) => $('#' + id).value), $('#fDestacado').checked, $('#fAgotado').checked,
    state.form.colores, state.form.specs, state.form.fotos.map((f) => f.url || f.preview)
  ]);
}
const isDirty = () => !!state.form && serializeForm() !== state.snapshot;

function openForm(p) {
  state.editing = p;
  idTouched = !!p;
  state.form = {
    colores: p ? [...(p.colores || [])] : [],
    specs: p ? Object.entries(p.specs || {}).map(([k, v]) => ({ k, v: String(v) })) : [],
    // each: {url} already stored, or {blob, thumbs, preview} pending upload
    fotos: p ? (p.fotos || []).map((url) => ({ url })) : [],
    removed: []
  };
  $('#formTitle').textContent = p ? p.nombre : 'Nuevo producto';
  $('#formSub').textContent = p ? `${catName(p.categoria)} · ${!p.activo ? 'Archivado' : p.agotado ? 'Agotado' : 'Disponible'}` : 'Completá los datos y guardá para publicarlo en la web.';
  $('#fNombre').value = p ? p.nombre : '';
  $('#fId').value = p ? p.id : '';
  $('#fId').readOnly = !!p;
  $('#idHint').textContent = p ? 'no se puede cambiar' : 'se genera del nombre';
  $('#fMarca').value = p ? p.marca : '';
  $('#fCategoria').value = p ? p.categoria : (state.cat !== 'todos' ? state.cat : (state.categorias[0] || {}).id);
  $('#fGancho').value = p ? p.gancho : '';
  $('#fDescripcion').value = p ? p.descripcion : '';
  $('#fPlaceholder').value = p ? p.placeholder : '';
  $('#fNota').value = p && p.nota_honesta ? p.nota_honesta : '';
  $('#fPrecio').value = p && p.precio ? p.precio : '';
  $('#fPrecioReg').value = p && p.precio_regular ? p.precio_regular : '';
  $('#fDestacado').checked = p ? !!p.destacado : false;
  $('#fAgotado').checked = p ? !!p.agotado : false;
  $('#archiveBtn').hidden = !(p && p.activo);
  $('#saveBtn').querySelector('span').textContent = p ? 'Guardar cambios' : 'Crear producto';
  $('#formError').hidden = true;
  $('#photoMsg').hidden = true;
  renderChips(); renderSpecs(); renderPhotos(); renderPreview(); renderPriceHelp();
  state.snapshot = serializeForm();
  $('#listView').hidden = true;
  $('#formView').hidden = false;
  document.body.classList.add('form-open');
  window.scrollTo(0, 0);
  if (!p) $('#fNombre').focus({ preventScroll: true });
}

function closeForm(force = false) {
  if (!force && isDirty() && !confirm('Tenés cambios sin guardar. ¿Descartarlos?')) return false;
  for (const f of state.form.fotos) if (f.preview) URL.revokeObjectURL(f.preview);
  const lastId = state.editing && state.editing.id;
  state.form = null;
  state.editing = null;
  $('#formView').hidden = true;
  $('#listView').hidden = false;
  document.body.classList.remove('form-open');
  if (lastId) {
    const row = $(`#rows .row[data-id="${CSS.escape(lastId)}"] .row-main`);
    if (row) { row.scrollIntoView({ block: 'center' }); row.focus({ preventScroll: true }); }
  }
  return true;
}
$('#backBtn').addEventListener('click', () => closeForm());
$('#cancelBtn').addEventListener('click', () => closeForm());
window.addEventListener('beforeunload', (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

$('#archiveBtn').addEventListener('click', async (e) => {
  const p = state.editing;
  if (!p) return;
  if (isDirty() && !confirm('Tenés cambios sin guardar que se van a perder. ¿Archivar igual?')) return;
  if (await setActivo(p, false, e.currentTarget)) closeForm(true);
});

$('#fNombre').addEventListener('input', () => {
  if (!idTouched) $('#fId').value = slug($('#fNombre').value);
  renderPreview();
});
$('#fId').addEventListener('input', () => { idTouched = true; });
['fMarca', 'fCategoria', 'fGancho', 'fPlaceholder', 'fPrecio', 'fPrecioReg', 'fAgotado'].forEach((id) => $('#' + id).addEventListener('input', renderPreview));
$('#fAgotado').addEventListener('change', renderPreview);
['fPrecio', 'fPrecioReg'].forEach((id) => $('#' + id).addEventListener('input', renderPriceHelp));

function renderPriceHelp() {
  for (const [id, out] of [['fPrecio', 'fPrecioFmt'], ['fPrecioReg', 'fPrecioRegFmt']]) {
    const t = $('#' + id).value.trim();
    $('#' + out).textContent = !t ? '' : /^\d+$/.test(t) && +t > 0 ? `Se muestra como ${money(+t)}` : 'Solo números, sin puntos ni signos';
  }
}

// colores
function renderChips() {
  $('#chips').replaceChildren(...state.form.colores.map((c, i) => h('span', { class: 'chip' }, c,
    h('button', { type: 'button', 'aria-label': 'Quitar ' + c, onclick: () => { state.form.colores.splice(i, 1); renderChips(); } }, icon('x')))));
}
function addChip() {
  const v = $('#chipInput').value.trim();
  if (v && !state.form.colores.includes(v)) state.form.colores.push(v);
  $('#chipInput').value = '';
  renderChips();
}
$('#chipAdd').addEventListener('click', addChip);
$('#chipInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addChip(); } });

// specs
function renderSpecs() {
  const rows = state.form.specs;
  $('#specs').replaceChildren(...rows.map((s, i) => h('div', { class: 'spec' },
    h('input', { value: s.k, placeholder: 'Nombre, ej. Peso', 'aria-label': 'Nombre de la especificación ' + (i + 1), oninput: (e) => { s.k = e.target.value; } }),
    h('input', { value: s.v, placeholder: 'Valor, ej. 49 g', 'aria-label': 'Valor de la especificación ' + (i + 1), oninput: (e) => { s.v = e.target.value; } }),
    h('div', { class: 'spec-btns' },
      iconBtn('up', 'Subir fila', () => swap(rows, i, i - 1, renderSpecs), { disabled: i === 0 }),
      iconBtn('down', 'Bajar fila', () => swap(rows, i, i + 1, renderSpecs), { disabled: i === rows.length - 1 }),
      iconBtn('x', 'Quitar fila', () => { rows.splice(i, 1); renderSpecs(); }, { danger: true })))));
}
const swap = (arr, i, j, after) => { [arr[i], arr[j]] = [arr[j], arr[i]]; after(); };
$('#specAdd').addEventListener('click', () => { state.form.specs.push({ k: '', v: '' }); renderSpecs(); $('#specs').lastElementChild.querySelector('input').focus(); });

// fotos
function renderPhotos() {
  const fotos = state.form.fotos;
  const after = () => { renderPhotos(); renderPreview(); };
  const tiles = fotos.map((f, i) => h('li', { class: 'photo' + (i === 0 ? ' is-cover' : '') },
    f.preview ? h('img', { src: f.preview, alt: 'Foto ' + (i + 1) }) : thumbImg(f.url, 200, 'Foto ' + (i + 1)),
    h('span', { class: 'photo-badge', text: i === 0 ? 'Portada' : f.blob ? 'Nueva' : String(i + 1) }),
    h('div', { class: 'photo-tools' },
      iconBtn('left', 'Mover foto a la izquierda', () => swap(fotos, i, i - 1, after), { disabled: i === 0 }),
      iconBtn('x', 'Quitar foto', () => removePhoto(i), { danger: true }),
      iconBtn('right', 'Mover foto a la derecha', () => swap(fotos, i, i + 1, after), { disabled: i === fotos.length - 1 }))));
  const add = h('li', {}, h('button', { class: 'photo-add', type: 'button', onclick: () => $('#photoInput').click() }, icon('upload'), h('span', { text: fotos.length ? 'Agregar foto' : 'Subir foto' })));
  $('#photos').replaceChildren(...tiles, add);
}
function removePhoto(i) {
  const [f] = state.form.fotos.splice(i, 1);
  if (f.preview) URL.revokeObjectURL(f.preview);
  else state.form.removed.push(f.url);
  renderPhotos(); renderPreview();
}
function photoMsg(msg) {
  $('#photoMsg').textContent = msg || '';
  $('#photoMsg').hidden = !msg;
}

// card preview, same structure as the public site's card
function renderPreview() {
  const f = state.form;
  if (!f) return;
  const nombre = $('#fNombre').value.trim() || 'Nombre del producto';
  const agotado = $('#fAgotado').checked;
  const precio = parseInt($('#fPrecio').value, 10);
  const reg = parseInt($('#fPrecioReg').value, 10);
  const first = f.fotos[0];
  const ph = $('#fPlaceholder').value.trim();
  const media = h('div', { class: 'pmedia' + (agotado ? ' is-agotado' : '') },
    h('div', { class: 'pph', 'aria-hidden': 'true' }, ph ? h('span', { class: 'pph-num', text: ph }) : null, h('span', { class: 'pph-name', text: nombre })),
    first ? (first.preview ? h('img', { src: first.preview, alt: '' }) : thumbImg(first.url, 640)) : null,
    agotado ? h('span', { class: 'pribbon', text: 'Agotado' }) : null);
  let price = null;
  if (!agotado && precio > 0) {
    price = reg > precio
      ? h('div', { class: 'pprice' },
          h('p', {}, h('span', { class: 'lbl', text: 'Precio regular' }), h('s', { text: money(reg) })),
          h('p', {}, h('span', { class: 'lbl', text: 'Precio de lanzamiento' }), h('strong', { text: money(precio) })))
      : h('div', { class: 'pprice' }, h('p', {}, h('strong', { text: money(precio) })));
  }
  $('#preview').replaceChildren(h('article', { class: 'pcard' }, media,
    h('div', { class: 'pbody' },
      h('p', { class: 'pbrand', text: $('#fMarca').value.trim() || 'Marca' }),
      h('h3', { class: 'pname', text: nombre }),
      $('#fGancho').value.trim() ? h('p', { class: 'phook', text: $('#fGancho').value.trim() }) : null,
      price)));
}

/* ---------- cropper ---------- */
const crop = { img: null, w: 0, h: 0, view: 340, base: 1, zoom: 1, ox: 0, oy: 0, drag: null };

async function decodeImage(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* fall through to <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('decode'));
      img.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}

$('#photoInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  photoMsg('');
  try {
    crop.img = await decodeImage(file);
  } catch {
    photoMsg('Convertí la foto a JPG: este navegador no puede leer ese formato.');
    return;
  }
  crop.w = crop.img.width; crop.h = crop.img.height;
  const canvas = $('#cropCanvas');
  $('#cropDialog').showModal();
  crop.view = Math.round(canvas.getBoundingClientRect().width) || 340;
  canvas.width = canvas.height = crop.view * (window.devicePixelRatio || 1);
  crop.base = crop.view / Math.min(crop.w, crop.h);
  crop.zoom = 1;
  $('#cropZoom').value = 1;
  crop.ox = (crop.view - crop.w * crop.base) / 2;
  crop.oy = (crop.view - crop.h * crop.base) / 2;
  drawCrop();
});

function clampCrop() {
  const s = crop.base * crop.zoom;
  crop.ox = Math.min(0, Math.max(crop.view - crop.w * s, crop.ox));
  crop.oy = Math.min(0, Math.max(crop.view - crop.h * s, crop.oy));
}
function drawCrop() {
  clampCrop();
  const canvas = $('#cropCanvas'), ctx = canvas.getContext('2d');
  const k = canvas.width / crop.view, s = crop.base * crop.zoom;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(crop.img, crop.ox * k, crop.oy * k, crop.w * s * k, crop.h * s * k);
}
$('#cropZoom').addEventListener('input', (e) => {
  const old = crop.base * crop.zoom;
  const c = crop.view / 2;
  const nz = parseFloat(e.target.value);
  const s = crop.base * nz;
  crop.ox = c - (c - crop.ox) * (s / old);     // zoom around the center of the frame
  crop.oy = c - (c - crop.oy) * (s / old);
  crop.zoom = nz;
  drawCrop();
});
const cc = $('#cropCanvas');
cc.addEventListener('pointerdown', (e) => { cc.setPointerCapture(e.pointerId); crop.drag = { x: e.clientX, y: e.clientY, ox: crop.ox, oy: crop.oy }; });
cc.addEventListener('pointermove', (e) => {
  if (!crop.drag) return;
  crop.ox = crop.drag.ox + (e.clientX - crop.drag.x);
  crop.oy = crop.drag.oy + (e.clientY - crop.drag.y);
  drawCrop();
});
['pointerup', 'pointercancel'].forEach((t) => cc.addEventListener(t, () => { crop.drag = null; }));
$('#cropCancel').addEventListener('click', () => $('#cropDialog').close());

const toJpeg = (canvas, q) => new Promise((r) => canvas.toBlob(r, 'image/jpeg', q));

// Re-encoding through a canvas drops EXIF/GPS. Quality goes down until the file fits in 2 MB.
$('#cropOk').addEventListener('click', async () => {
  const btn = $('#cropOk');
  busy(btn, true);
  try {
    const s = crop.base * crop.zoom;
    const out = document.createElement('canvas');
    out.width = out.height = OUT_SIZE;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, OUT_SIZE, OUT_SIZE);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(crop.img, -crop.ox / s, -crop.oy / s, crop.view / s, crop.view / s, 0, 0, OUT_SIZE, OUT_SIZE);
    let q = 0.85, blob;
    do {
      blob = await toJpeg(out, q);
      q -= 0.07;
    } while (blob && blob.size > MAX_BYTES && q > 0.2);
    if (!blob || blob.size > MAX_BYTES) { photoMsg('No se pudo reducir la foto por debajo de 2 MB.'); $('#cropDialog').close(); return; }
    // small copies for the catalog grid and the thumbnail strips
    const thumbs = {};
    for (const size of THUMB_SIZES) {
      const t = document.createElement('canvas');
      t.width = t.height = size;
      const tc = t.getContext('2d');
      tc.imageSmoothingQuality = 'high';
      tc.drawImage(out, 0, 0, size, size);
      thumbs[size] = await toJpeg(t, 0.8);
    }
    state.form.fotos.push({ blob, thumbs, preview: URL.createObjectURL(blob) });
    $('#cropDialog').close();
    renderPhotos(); renderPreview();
  } finally { busy(btn, false); }
});

/* ---------- save ---------- */
function formError(msg) {
  $('#formError').textContent = msg || '';
  $('#formError').hidden = !msg;
  if (msg) $('#formError').scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function parsePrice(raw, label) {
  const t = raw.trim();
  if (!t) return null;
  if (!/^\d+$/.test(t) || parseInt(t, 10) <= 0) throw new Error(`${label} debe ser un número entero, sin puntos ni signos, o quedar vacío`);
  return parseInt(t, 10);
}

function collect() {
  const req = (id, label) => {
    const v = $('#' + id).value.trim();
    if (!v) { $('#' + id).focus(); throw new Error(`Falta ${label}`); }
    return v;
  };
  const nombre = req('fNombre', 'el nombre');
  const id = state.editing ? state.editing.id : req('fId', 'el id');
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error('El id solo puede tener minúsculas, números y guiones');
  const marca = req('fMarca', 'la marca');
  const gancho = req('fGancho', 'el gancho');
  const descripcion = req('fDescripcion', 'la descripción');
  const placeholder = req('fPlaceholder', 'el placeholder');
  const precio = parsePrice($('#fPrecio').value, 'El precio');
  const precio_regular = parsePrice($('#fPrecioReg').value, 'El precio regular');
  if (precio_regular !== null && (precio === null || precio_regular <= precio)) throw new Error('El precio regular tiene que ser mayor que el precio');
  const specs = {};
  for (const { k, v } of state.form.specs) {
    const key = k.trim(), val = v.trim();
    if (!key && !val) continue;                       // empty rows are discarded
    if (!key || !val) throw new Error('Cada especificación necesita nombre y valor (o dejá la fila vacía)');
    if (key in specs) throw new Error(`La especificación "${key}" está repetida`);
    specs[key] = val;
  }
  return {
    id, nombre, marca, categoria: $('#fCategoria').value, gancho, descripcion, placeholder,
    nota_honesta: $('#fNota').value.trim() || null,
    destacado: $('#fDestacado').checked, agotado: $('#fAgotado').checked,
    colores: state.form.colores, specs, precio, precio_regular
  };
}

async function upload(path, blob) {
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (error) throw new Error('No se pudo subir la foto: ' + error.message);
}

$('#productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  formError('');
  let row;
  try { row = collect(); } catch (err) { formError(err.message); return; }
  const btn = $('#saveBtn');
  busy(btn, true);
  const uploaded = [];
  try {
    if (!state.editing) {
      const { data, error } = await sb.from('productos').select('id').eq('id', row.id).maybeSingle();
      if (error) throw error;
      if (data) throw new Error(`Ya existe un producto con el id "${row.id}"`);
    }
    // upload new photos first; the row only references them once they exist
    const urls = [];
    let n = 0;
    for (const f of state.form.fotos) {
      if (!f.blob) { urls.push(f.url); continue; }
      const path = `${row.id}/${Date.now()}-${n++}.jpg`;
      await upload(path, f.blob);
      uploaded.push(path);
      // thumbnails are a speed-up, not a requirement: the site falls back to the full photo
      const variants = variantPaths(path);
      for (const [i, size] of THUMB_SIZES.entries()) {
        try { await upload(variants[i], f.thumbs[size]); uploaded.push(variants[i]); }
        catch (err) { console.warn('miniatura:', err.message); }
      }
      urls.push(sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
    }
    row.fotos = urls;
    row.tiene_fotos = urls.length > 0;

    if (state.editing) {
      await patch(row.id, row);
    } else {
      row.orden = state.productos.reduce((m, p) => Math.max(m, p.orden), -1) + 1;
      const { data, error } = await sb.from('productos').insert(row).select('id');
      if (error) throw error;
      if (!data || data.length !== 1) throw new Error('No se creó (sin permiso)');
    }
    const failed = await removeFromStorage(state.form.removed);   // replaced/removed photos, only after the row saved
    toast(failed ? 'Guardado, pero no se pudieron borrar fotos viejas de Storage' : (state.editing ? 'Cambios guardados' : 'Producto creado'), failed ? 'err' : 'ok');
    closeForm(true);
    await loadProductos();
  } catch (err) {
    if (uploaded.length) await sb.storage.from(BUCKET).remove(uploaded).catch(() => {});
    formError(err.message);
  } finally {
    busy(btn, false);
  }
});

/* ---------- init ---------- */
(async () => {
  const { data } = await sb.auth.getSession();
  if (data.session) await enter(data.session);
  else show('login');
})();
