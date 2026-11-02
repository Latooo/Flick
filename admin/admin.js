'use strict';

const SUPABASE_URL = 'https://nisegpuyvfujzrcjlhtw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ULilyHHntqtHTcrihvy_Pw_8ylQBEC_';  // public (publishable) key
const BUCKET = 'productos';
const STORAGE_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
const MAX_BYTES = 2 * 1024 * 1024;
const OUT_SIZE = 1600;

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

const money = (n) => '$' + new Intl.NumberFormat('es-CO').format(n);
const photoSrc = (u) => (/^https?:/i.test(u) ? u : '../' + u);   // legacy "img/..." paths live at the site root
const storagePath = (u) => (typeof u === 'string' && u.startsWith(STORAGE_PREFIX) ? decodeURIComponent(u.slice(STORAGE_PREFIX.length)) : null);

let toastTimer;
function toast(msg, kind = 'ok') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast ' + kind;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, kind === 'err' ? 6000 : 2200);
}

const state = {
  categorias: [],
  productos: [],
  tab: 'activos',
  q: '',
  cat: 'todos',
  editing: null,       // product being edited, or null when creating
  form: null           // working copy while the form is open
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
  btn.disabled = true;
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
    btn.disabled = false;
    $('#loginPass').value = '';
  }
});

$('#logoutBtn').addEventListener('click', async () => {
  await sb.auth.signOut();
  state.productos = [];
  show('login');
});

/* ---------- data ---------- */
async function bootApp() {
  if (!state.categorias.length) {
    try {
      const res = await fetch('../productos.json');
      state.categorias = (await res.json()).categorias || [];
    } catch (err) { toast('No se pudieron cargar las categorías: ' + err.message, 'err'); }
    const opts = [h('option', { value: 'todos', text: 'Todas las categorías' }), ...state.categorias.map((c) => h('option', { value: c.id, text: c.nombre }))];
    $('#catFilter').replaceChildren(...opts);
    $('#fCategoria').replaceChildren(...state.categorias.map((c) => h('option', { value: c.id, text: c.nombre })));
  }
  await loadProductos();
}

async function loadProductos() {
  const { data, error } = await sb.from('productos').select('*').order('orden');
  if (error) { toast('No se pudieron cargar los productos: ' + error.message, 'err'); return; }
  state.productos = data;
  renderList();
}

// update that detects RLS silently matching zero rows
async function patch(id, fields) {
  const { data, error } = await sb.from('productos').update(fields).eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length !== 1) throw new Error('No se guardó (sin permiso o el producto ya no existe)');
}

/* ---------- list ---------- */
const catName = (id) => (state.categorias.find((c) => c.id === id) || {}).nombre || id;

function visible() {
  const q = state.q.trim().toLowerCase();
  return state.productos.filter((p) =>
    (state.tab === 'activos' ? p.activo : !p.activo) &&
    (state.cat === 'todos' || p.categoria === state.cat) &&
    (!q || p.nombre.toLowerCase().includes(q) || p.marca.toLowerCase().includes(q)));
}

function statusPill(p) {
  if (!p.activo) return h('span', { class: 'pill pill-arch', text: 'Archivado' });
  return p.agotado ? h('span', { class: 'pill pill-out', text: 'Agotado' }) : h('span', { class: 'pill pill-ok', text: 'Disponible' });
}

function renderList() {
  $('#countActivos').textContent = `(${state.productos.filter((p) => p.activo).length})`;
  $('#countArchivados').textContent = `(${state.productos.filter((p) => !p.activo).length})`;
  const list = visible();
  $('#emptyMsg').hidden = list.length > 0;
  $('#rows').replaceChildren(...list.map((p, i) => rowEl(p, i, list)));
}

function rowEl(p, i, list) {
  const thumb = p.fotos && p.fotos[0]
    ? h('img', { class: 'thumb', src: photoSrc(p.fotos[0]), alt: '', loading: 'lazy' })
    : h('div', { class: 'thumb' });
  const price = p.precio ? money(p.precio) : 'Sin precio';
  const sw = h('input', { type: 'checkbox', checked: !!p.agotado, 'aria-label': 'Agotado: ' + p.nombre });
  const row = h('li', { class: 'row', 'data-id': p.id },
    thumb,
    h('div', { class: 'row-info' },
      h('div', { class: 'row-name', text: p.nombre }),
      h('div', { class: 'row-meta' }, h('span', { text: catName(p.categoria) }), h('span', { text: price }), statusPill(p))),
    h('button', { class: 'btn btn-sm', type: 'button', text: 'Editar', onclick: () => openForm(p) }),
    h('div', { class: 'row-actions' },
      p.activo ? h('label', { class: 'switch' }, sw, h('span', { class: 'track' }), h('span', { text: 'Agotado' })) : null,
      h('button', { class: 'btn btn-sm btn-icon', type: 'button', text: '↑', 'aria-label': 'Subir', disabled: i === 0, onclick: () => move(list, i, -1) }),
      h('button', { class: 'btn btn-sm btn-icon', type: 'button', text: '↓', 'aria-label': 'Bajar', disabled: i === list.length - 1, onclick: () => move(list, i, 1) }),
      h('span', { class: 'spacer' }),
      p.activo
        ? h('button', { class: 'btn btn-sm', type: 'button', text: 'Archivar', onclick: () => setActivo(p, false) })
        : [h('button', { class: 'btn btn-sm', type: 'button', text: 'Restaurar', onclick: () => setActivo(p, true) }),
           h('button', { class: 'btn btn-sm btn-danger', type: 'button', text: 'Eliminar', onclick: () => openDelete(p) })]));
  sw.addEventListener('change', () => toggleAgotado(p, sw, row));
  return row;
}

async function toggleAgotado(p, sw, row) {
  const next = sw.checked;
  row.classList.add('pending');
  sw.disabled = true;
  try {
    await patch(p.id, { agotado: next });
    p.agotado = next;
    toast(`${p.nombre}: ${next ? 'agotado' : 'disponible'}`);
    renderList();
  } catch (err) {
    sw.checked = !next;
    row.classList.remove('pending');
    sw.disabled = false;
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
  } catch (err) { toast('No se pudo reordenar: ' + err.message, 'err'); }
}

async function setActivo(p, activo) {
  try {
    await patch(p.id, { activo });
    p.activo = activo;
    toast(activo ? `${p.nombre} restaurado` : `${p.nombre} archivado`);
    renderList();
  } catch (err) { toast('No se pudo cambiar: ' + err.message, 'err'); }
}

$('#search').addEventListener('input', (e) => { state.q = e.target.value; renderList(); });
$('#catFilter').addEventListener('change', (e) => { state.cat = e.target.value; renderList(); });
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
  $('#deleteOk').disabled = true;
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
    $('#deleteOk').disabled = false;
  }
});

// Only Storage URLs; legacy "img/..." paths are never touched. Returns the number of files that could not be removed.
async function removeFromStorage(urls) {
  const paths = urls.map(storagePath).filter(Boolean);
  if (!paths.length) return 0;
  const { data, error } = await sb.storage.from(BUCKET).remove(paths);
  if (error) { console.warn('storage remove:', error.message); return paths.length; }
  return paths.length - (data ? data.length : 0);   // remove() resolves with the rows actually deleted
}

/* ---------- form ---------- */
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
let idTouched = false;

function openForm(p) {
  state.editing = p;
  idTouched = !!p;
  state.form = {
    colores: p ? [...(p.colores || [])] : [],
    specs: p ? Object.entries(p.specs || {}).map(([k, v]) => ({ k, v: String(v) })) : [],
    // each: {url} already stored, or {blob, preview} pending upload
    fotos: p ? (p.fotos || []).map((url) => ({ url })) : [],
    removed: []
  };
  $('#formTitle').textContent = p ? 'Editar producto' : 'Nuevo producto';
  $('#fNombre').value = p ? p.nombre : '';
  $('#fId').value = p ? p.id : '';
  $('#fId').readOnly = !!p;
  $('#idHint').textContent = p ? '(no se puede cambiar)' : '(se genera del nombre; editable)';
  $('#fMarca').value = p ? p.marca : '';
  $('#fCategoria').value = p ? p.categoria : (state.categorias[0] || {}).id;
  $('#fGancho').value = p ? p.gancho : '';
  $('#fDescripcion').value = p ? p.descripcion : '';
  $('#fPlaceholder').value = p ? p.placeholder : '';
  $('#fNota').value = p && p.nota_honesta ? p.nota_honesta : '';
  $('#fPrecio').value = p && p.precio ? p.precio : '';
  $('#fPrecioReg').value = p && p.precio_regular ? p.precio_regular : '';
  $('#fDestacado').checked = p ? !!p.destacado : false;
  $('#fAgotado').checked = p ? !!p.agotado : false;
  $('#formError').hidden = true;
  $('#photoMsg').hidden = true;
  renderChips(); renderSpecs(); renderPhotos(); renderPreview();
  $('#listView').hidden = true;
  $('#formView').hidden = false;
  window.scrollTo(0, 0);
}

function closeForm() {
  for (const f of state.form.fotos) if (f.preview) URL.revokeObjectURL(f.preview);
  state.form = null;
  $('#formView').hidden = true;
  $('#listView').hidden = false;
}
$('#backBtn').addEventListener('click', closeForm);
$('#cancelBtn').addEventListener('click', closeForm);

$('#fNombre').addEventListener('input', () => {
  if (!idTouched) $('#fId').value = slug($('#fNombre').value);
  renderPreview();
});
$('#fId').addEventListener('input', () => { idTouched = true; });
['fMarca', 'fCategoria', 'fGancho', 'fPlaceholder', 'fPrecio', 'fPrecioReg', 'fAgotado'].forEach((id) => $('#' + id).addEventListener('input', renderPreview));
$('#fAgotado').addEventListener('change', renderPreview);

// colores
function renderChips() {
  $('#chips').replaceChildren(...state.form.colores.map((c, i) => h('span', { class: 'chip' }, c,
    h('button', { type: 'button', text: '×', 'aria-label': 'Quitar ' + c, onclick: () => { state.form.colores.splice(i, 1); renderChips(); } }))));
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
    h('input', { value: s.k, placeholder: 'Nombre (ej. Peso)', 'aria-label': 'Nombre de la especificación', oninput: (e) => { s.k = e.target.value; } }),
    h('input', { value: s.v, placeholder: 'Valor (ej. 49 g)', 'aria-label': 'Valor', oninput: (e) => { s.v = e.target.value; } }),
    h('div', { class: 'spec-btns' },
      h('button', { class: 'btn btn-sm btn-icon', type: 'button', text: '↑', 'aria-label': 'Subir fila', disabled: i === 0, onclick: () => swap(rows, i, i - 1, renderSpecs) }),
      h('button', { class: 'btn btn-sm btn-icon', type: 'button', text: '↓', 'aria-label': 'Bajar fila', disabled: i === rows.length - 1, onclick: () => swap(rows, i, i + 1, renderSpecs) }),
      h('button', { class: 'btn btn-sm btn-icon', type: 'button', text: '×', 'aria-label': 'Quitar fila', onclick: () => { rows.splice(i, 1); renderSpecs(); } })))));
}
const swap = (arr, i, j, after) => { [arr[i], arr[j]] = [arr[j], arr[i]]; after(); };
$('#specAdd').addEventListener('click', () => { state.form.specs.push({ k: '', v: '' }); renderSpecs(); $('#specs').lastElementChild.querySelector('input').focus(); });

// fotos
function renderPhotos() {
  const fotos = state.form.fotos;
  $('#photos').replaceChildren(...fotos.map((f, i) => h('li', { class: 'photo' },
    h('img', { src: f.preview || photoSrc(f.url), alt: 'Foto ' + (i + 1) }),
    h('span', { class: 'tag' }, i === 0 ? h('strong', { text: 'Portada' }) : 'Foto ' + (i + 1), f.blob ? ' · nueva' : ''),
    h('div', { class: 'photo-btns' },
      h('button', { class: 'btn btn-sm btn-icon', type: 'button', text: '↑', 'aria-label': 'Subir foto', disabled: i === 0, onclick: () => swap(fotos, i, i - 1, () => { renderPhotos(); renderPreview(); }) }),
      h('button', { class: 'btn btn-sm btn-icon', type: 'button', text: '↓', 'aria-label': 'Bajar foto', disabled: i === fotos.length - 1, onclick: () => swap(fotos, i, i + 1, () => { renderPhotos(); renderPreview(); }) }),
      h('button', { class: 'btn btn-sm btn-icon', type: 'button', text: '×', 'aria-label': 'Quitar foto', onclick: () => removePhoto(i) })))));
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
    first ? h('img', { src: first.preview || photoSrc(first.url), alt: '' }) : null,
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

// Re-encoding through a canvas drops EXIF/GPS. Quality goes down until the file fits in 2 MB.
$('#cropOk').addEventListener('click', async () => {
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
    blob = await new Promise((r) => out.toBlob(r, 'image/jpeg', q));
    q -= 0.07;
  } while (blob && blob.size > MAX_BYTES && q > 0.2);
  if (!blob || blob.size > MAX_BYTES) { photoMsg('No se pudo reducir la foto por debajo de 2 MB.'); $('#cropDialog').close(); return; }
  state.form.fotos.push({ blob, preview: URL.createObjectURL(blob) });
  $('#cropDialog').close();
  renderPhotos(); renderPreview();
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
  if (!/^\d+$/.test(t) || parseInt(t, 10) <= 0) throw new Error(`${label} debe ser un entero positivo o quedar vacío`);
  return parseInt(t, 10);
}

function collect() {
  const req = (id, label) => {
    const v = $('#' + id).value.trim();
    if (!v) throw new Error(`${label} es obligatorio`);
    return v;
  };
  const nombre = req('fNombre', 'El nombre');
  const id = state.editing ? state.editing.id : req('fId', 'El id');
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error('El id solo puede tener minúsculas, números y guiones');
  const marca = req('fMarca', 'La marca');
  const gancho = req('fGancho', 'El gancho');
  const descripcion = req('fDescripcion', 'La descripción');
  const placeholder = req('fPlaceholder', 'El placeholder');
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

$('#productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  formError('');
  let row;
  try { row = collect(); } catch (err) { formError(err.message); return; }
  const btn = $('#saveBtn');
  btn.disabled = true;
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
      const { error } = await sb.storage.from(BUCKET).upload(path, f.blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
      if (error) throw new Error('No se pudo subir la foto: ' + error.message);
      uploaded.push(path);
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
    toast(failed ? 'Guardado, pero no se pudieron borrar fotos viejas de Storage' : 'Producto guardado', failed ? 'err' : 'ok');
    closeForm();
    await loadProductos();
  } catch (err) {
    if (uploaded.length) await sb.storage.from(BUCKET).remove(uploaded).catch(() => {});
    formError(err.message);
  } finally {
    btn.disabled = false;
  }
});

/* ---------- init ---------- */
(async () => {
  const { data } = await sb.auth.getSession();
  if (data.session) await enter(data.session);
  else show('login');
})();
