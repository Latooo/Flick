'use strict';

const $ = (sel, root = document) => root.querySelector(sel);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ESC[c]);

const ICONS = {
  instagram: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.4 2.6 2.1 4.3 5 4.6"/></svg>',
  camion: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6h11v10H2z"/><path d="M13 9h4l4 4v3h-8z"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/></svg>',
  efectivo: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 10v.01M18 14v.01"/></svg>',
  escudo: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
  warn: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3L2 20h20z"/><path d="M12 10v5M12 17.5v.01"/></svg>',
  wa: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.3.4-.4.4c-.1.2-.3.3-.1.6.2.3.7 1.2 1.5 1.9 1 .9 1.8 1.2 2.1 1.3.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.4z"/></svg>'
};

let DATA = null;
let activeCat = 'todos';

/* ---------- data ---------- */
async function loadData() {
  const res = await fetch('productos.json');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

const byId = (id) => DATA.productos.find((p) => p.id === id);
const hasValue = (v) => v !== null && v !== undefined && String(v).trim() !== '';

function whatsappUrl(producto) {
  const msg = DATA.sitio.mensaje_whatsapp.replace('{producto}', producto.nombre);
  return `https://wa.me/${DATA.sitio.whatsapp}?text=${encodeURIComponent(msg)}`;
}

/* ---------- top of page ---------- */
function renderAnnounce(sitio) {
  if (hasValue(sitio.anuncio)) $('#announce').textContent = sitio.anuncio;
}

function renderNav(categorias) {
  $('#mainNav').innerHTML = categorias
    .map((c) => `<a href="#catalogo" data-cat="${esc(c.id)}">${esc(c.nombre)}</a>`)
    .join('');
}

function renderSocials(sitio) {
  const links = [
    ['instagram', sitio.instagram, 'Instagram'],
    ['tiktok', sitio.tiktok, 'TikTok']
  ].filter(([, url]) => hasValue(url));
  $('#socials').innerHTML = links
    .map(([k, url, label]) => `<li><a href="${esc(url)}" target="_blank" rel="noopener" aria-label="${label}">${ICONS[k]}</a></li>`)
    .join('');
}

function renderBadges(badges) {
  $('#badges').innerHTML = (badges || [])
    .map((b) => `<li class="badge-item">${ICONS[b.icono] || ''}<div><p class="badge-title">${esc(b.titulo)}</p>${hasValue(b.sub) ? `<p class="badge-sub">${esc(b.sub)}</p>` : ''}</div></li>`)
    .join('');
}

function renderMarquee(items) {
  if (!items || !items.length) { $('#marquee').hidden = true; return; }
  const seq = items.map((t) => `<li>${esc(t)}</li>`).join('');
  // duplicated track for a seamless loop; the copy is hidden from assistive tech
  $('#marqueeTrack').innerHTML = `<ul class="marquee-set">${seq}</ul><ul class="marquee-set" aria-hidden="true">${seq}</ul>`;
}

const money = (n) => '$' + new Intl.NumberFormat('es-CO').format(n);

function renderDelivery(e) {
  if (!e) { $('#entrega').hidden = true; return; }
  const zone = (z, n) => z ? `
    <li class="dcard">
      <p class="dcard-eyebrow">Zona ${n}</p>
      <h3 class="dcard-title">${esc(z.nombre)}</h3>
      <p class="dcard-big">Envío gratis desde <span class="mono">${money(z.gratis_desde)}</span></p>
      <p class="dcard-note">Por debajo de ese valor, el envío cuesta <span class="mono">${money(z.costo)}</span>.</p>
    </li>` : '';
  const pickup = hasValue(e.recogida) ? `
    <li class="dcard">
      <p class="dcard-eyebrow">Recogida</p>
      <h3 class="dcard-title">Recogida</h3>
      <p class="dcard-note">${esc(e.recogida)}.</p>
    </li>` : '';
  const warranty = e.garantia_meses ? `
    <li class="dcard dcard-warranty">
      <p class="dcard-eyebrow">Garantía</p>
      <p class="dcard-big"><span class="mono dcard-num">${esc(e.garantia_meses)}</span> ${e.garantia_meses === 1 ? 'mes' : 'meses'}</p>
      <p class="dcard-note">Respaldo directo con nosotros en cada producto.</p>
    </li>` : '';
  $('#deliveryGrid').innerHTML = zone(e.zona_1, 1) + zone(e.zona_2, 2) + pickup + warranty;
}

function renderFooter(sitio) {
  $('#footBrand').textContent = sitio.marca.toUpperCase();
  $('#footCity').textContent = sitio.ciudad;
  const n = String(sitio.whatsapp);
  const pretty = n.length === 12 ? `+${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5, 8)} ${n.slice(8)}` : `+${n}`;
  const wa = $('#footWa');
  wa.href = `https://wa.me/${n}`;
  wa.textContent = pretty;
  $('#footCats').innerHTML = DATA.categorias.map((c) => `<li><a href="#catalogo" data-cat="${esc(c.id)}">${esc(c.nombre)}</a></li>`).join('');
  $('#footSocials').innerHTML = $('#socials').innerHTML;
  $('#floatWa').href = `https://wa.me/${n}`;
}

function setupNavToggle() {
  const btn = $('#navToggle');
  const nav = $('#mainNav');
  const set = (open) => {
    nav.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  };
  btn.addEventListener('click', () => set(!nav.classList.contains('is-open')));
  nav.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    if (a.dataset.cat) setCategory(a.dataset.cat);
    set(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
}

/* ---------- media with placeholder ---------- */
// Placeholder always sits underneath; the <img> hides itself if the file is missing.
// "49 g" -> number + unit spans; "60×30", "75%", "XL" stay whole
function phValueHTML(v) {
  const m = /^(\d+(?:[.,]\d+)?)\s+([^\d\s].*)$/.exec(String(v).trim());
  return m
    ? `<span class="ph-num">${esc(m[1])}<span class="ph-unit">${esc(m[2])}</span></span>`
    : `<span class="ph-num">${esc(v)}</span>`;
}

function mediaHTML(p, src, { small = false, eager = false } = {}) {
  const num = hasValue(p.placeholder) ? phValueHTML(p.placeholder) : '';
  // no <img> unless the product has photos in img/ (tiene_fotos) — avoids 404s
  const img = p.tiene_fotos === true && hasValue(src)
    ? `<img src="${esc(src)}" alt="${esc(p.nombre)}"${eager ? '' : ' loading="lazy"'}>`
    : '';
  return `<div class="ph${small ? ' ph-sm' : ''}" aria-hidden="true">${num}<span class="ph-name">${esc(p.nombre)}</span></div>${img}`;
}

// Error events don't bubble, so listen in capture phase on a container.
function watchImages(root) {
  root.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG') e.target.hidden = true;
  }, true);
  root.querySelectorAll('img').forEach((img) => {
    if (img.complete && img.naturalWidth === 0) img.hidden = true;
  });
}

/* ---------- catalog ---------- */
function renderFilters() {
  const opts = [{ id: 'todos', nombre: 'Todos' }, ...DATA.categorias];
  $('#filters').innerHTML = opts
    .map((c) => `<button type="button" class="filter" data-cat="${esc(c.id)}" aria-pressed="${c.id === activeCat}">${esc(c.nombre)}</button>`)
    .join('');
}

function renderGrid() {
  const list = DATA.productos.filter((p) => activeCat === 'todos' || p.categoria === activeCat);
  const grid = $('#grid');
  grid.innerHTML = list
    .map((p) => `
      <article class="card" tabindex="0" role="button" data-id="${esc(p.id)}" aria-haspopup="dialog">
        <div class="media">${mediaHTML(p, (p.fotos || [])[0])}</div>
        <div class="card-body">
          <p class="brand">${esc(p.marca)}</p>
          <h3 class="card-name">${esc(p.nombre)}</h3>
          ${hasValue(p.gancho) ? `<p class="card-hook">${esc(p.gancho)}</p>` : ''}
        </div>
      </article>`)
    .join('');
  watchImages(grid);
}

function setCategory(id) {
  activeCat = id;
  document.querySelectorAll('#filters .filter').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === id)));
  renderGrid();
}

function setupCatalog() {
  renderFilters();
  renderGrid();
  $('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('.filter');
    if (b) setCategory(b.dataset.cat);
  });
  $('#footCats').addEventListener('click', (e) => {
    const a = e.target.closest('a[data-cat]');
    if (a) setCategory(a.dataset.cat);
  });
  const grid = $('#grid');
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (card) openModal(card.dataset.id, card);
  });
  grid.addEventListener('keydown', (e) => {
    const card = e.target.closest('.card');
    if (card && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openModal(card.dataset.id, card);
    }
  });
}

/* ---------- modal ---------- */
const modal = () => $('#modal');
let lastFocus = null;

function modalHTML(p) {
  const fotos = p.fotos || [];
  const specs = Object.entries(p.specs || {}).filter(([, v]) => hasValue(v));
  const colores = (p.colores || []).filter(hasValue);

  const thumbs = p.tiene_fotos === true && fotos.length > 1
    ? `<div class="thumbs">${fotos.map((f, i) => `<button type="button" class="thumb" data-src="${esc(f)}" aria-label="Ver foto ${i + 1}" aria-current="${i === 0}"><div class="ph ph-sm" aria-hidden="true"><span class="ph-num">${i + 1}</span></div><img src="${esc(f)}" alt="" loading="lazy"></button>`).join('')}</div>`
    : '';

  return `
    <div class="gallery">
      <div class="media" id="mainMedia">${mediaHTML(p, fotos[0], { eager: true })}</div>
      ${thumbs}
    </div>
    <div class="info">
      <p class="brand">${esc(p.marca)}</p>
      <h2 class="modal-name" id="modalTitle">${esc(p.nombre)}</h2>
      ${hasValue(p.gancho) ? `<p class="lead">${esc(p.gancho)}</p>` : ''}
      ${hasValue(p.descripcion) ? `<p class="desc">${esc(p.descripcion)}</p>` : ''}
      ${specs.length ? `<table class="specs"><caption class="sr-only" style="position:absolute;left:-9999px">Especificaciones</caption><tbody>${specs.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>` : ''}
      ${hasValue(p.nota_honesta) ? `<div class="honest" role="note">${ICONS.warn}<div><p class="honest-title">Tenlo en cuenta</p><p>${esc(p.nota_honesta)}</p></div></div>` : ''}
      ${colores.length ? `<div class="chips"><span class="chips-label">Colores</span>${colores.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>` : ''}
      <a class="btn btn-wa" href="${esc(whatsappUrl(p))}" target="_blank" rel="noopener">${ICONS.wa}Pedir por WhatsApp</a>
    </div>`;
}

function openModal(id, opener) {
  const p = byId(id);
  if (!p) return;
  lastFocus = opener || document.activeElement;
  const body = $('#modalBody');
  body.innerHTML = modalHTML(p);
  watchImages(body);

  // thumbnails swap the main image (placeholder stays underneath)
  body.querySelectorAll('.thumb').forEach((t) => t.addEventListener('click', () => {
    const main = $('#mainMedia');
    let img = $('img', main);
    if (!img) {
      img = document.createElement('img');
      img.alt = p.nombre;
      main.appendChild(img);
    }
    img.hidden = false;
    img.src = t.dataset.src;
    body.querySelectorAll('.thumb').forEach((x) => x.setAttribute('aria-current', String(x === t)));
  }));

  $('#page').inert = true;
  document.body.classList.add('modal-open');
  modal().hidden = false;
  $('#modalPanel').scrollTop = 0;
  $('#modalPanel').focus();
}

function closeModal() {
  if (modal().hidden) return;
  modal().hidden = true;
  $('#page').inert = false;
  document.body.classList.remove('modal-open');
  $('#modalBody').innerHTML = '';
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  lastFocus = null;
}

function setupModal() {
  modal().addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (modal().hidden) return;
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key !== 'Tab') return;
    // focus trap
    const f = [...modal().querySelectorAll('a[href], button:not([disabled])')].filter((el) => !el.hidden && el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    const panel = $('#modalPanel');
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

/* ---------- crosshair cursor ---------- */
// Only for a real mouse. Nothing is created or hidden otherwise, and the system
// cursor is only removed (via an injected rule) after the crosshair exists.
function setupCrosshair() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const xh = document.createElement('div');
  xh.className = 'xh';
  xh.setAttribute('aria-hidden', 'true');
  xh.innerHTML = '<div class="xh-in"><i class="xh-t"></i><i class="xh-b"></i><i class="xh-l"></i><i class="xh-r"></i></div>';
  document.body.appendChild(xh);

  const style = document.createElement('style');
  style.textContent = 'html.xh-on, html.xh-on * { cursor: none !important; }';
  document.head.appendChild(style);

  const INTERACTIVE = 'a, button, [role="button"], .card, .filter, .thumb';

  // Colours that swallow an orange (or teal) crosshair: orange and WhatsApp-green fills/borders/text.
  const probe = document.createElement('i');
  document.body.appendChild(probe);
  const resolve = (v) => { probe.style.color = v; return getComputedStyle(probe).color; };
  const CLASH_FILL = new Set([resolve('var(--hot)'), resolve('var(--whatsapp)')]);
  const HOT = resolve('var(--hot)');
  probe.remove();

  const clashes = (el) => {
    const own = getComputedStyle(el);
    if (own.color === HOT) return true;                                   // orange text (FLICK, note title)
    if (['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(own['border' + s + 'Width']) > 0 && own['border' + s + 'Color'] === HOT)) return true;
    for (let n = el; n && n !== document.body; n = n.parentElement) {  // orange/green fill on the element or an ancestor
      if (CLASH_FILL.has(getComputedStyle(n).backgroundColor)) return true;
    }
    return false;
  };
  let x = 0, y = 0, queued = false, seen = false;

  const paint = () => {
    queued = false;
    xh.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };
  const move = (e) => {
    x = e.clientX; y = e.clientY;
    if (!seen) { seen = true; xh.classList.add('is-visible'); document.documentElement.classList.add('xh-on'); }
    if (!queued) { queued = true; requestAnimationFrame(paint); }
  };
  document.addEventListener('mousemove', move, { passive: true });
  document.addEventListener('mouseover', (e) => {
    const t = e.target;
    xh.classList.toggle('is-aim', !!(t.closest && t.closest(INTERACTIVE)));
    xh.classList.toggle('is-teal', t.nodeType === 1 && clashes(t));
  });
  document.addEventListener('mousedown', () => xh.classList.add('is-down'));
  document.addEventListener('mouseup', () => xh.classList.remove('is-down'));
  document.documentElement.addEventListener('mouseleave', () => xh.classList.remove('is-visible'));
  document.documentElement.addEventListener('mouseenter', () => { if (seen) xh.classList.add('is-visible'); });
}

/* ---------- boot ---------- */
function showError() {
  const el = $('#loadError');
  el.hidden = false;
  el.textContent = window.location.protocol === 'file:'
    ? 'No se pudo cargar productos.json. Esta página no funciona abriendo el archivo directamente (file://): sírvela por HTTP, por ejemplo con "npx serve" o "python -m http.server" dentro de esta carpeta.'
    : 'No se pudo cargar el catálogo. Recarga la página o escríbenos por WhatsApp.';
}

async function init() {
  setupNavToggle();
  setupModal();
  setupCrosshair();
  try {
    DATA = await loadData();
    renderAnnounce(DATA.sitio);
    renderNav(DATA.categorias);
    renderSocials(DATA.sitio);
    renderBadges(DATA.sitio.badges);
    renderMarquee(DATA.sitio.marquee);
    renderDelivery(DATA.sitio.entrega);
    renderFooter(DATA.sitio);
    setupCatalog();
  } catch (err) {
    console.error(err);
    showError();
  }
}

init();
