'use strict';

const INTRO = {
  curtainMs:         350,
  brightenMs:        1000,
  logoInMs:          600,
  flickMs:           180,
  revealMs:          300,
  scrimRest:         'rgba(10,10,10,.62)',  // must match --hero-scrim in styles.css
  scrimBright:       'rgba(10,10,10,.25)',
  logoScale:         3,
  flickEasing:       'linear',              // candidates to compare in Fase 3: linear, cubic-bezier(.55,0,.85,.25), cubic-bezier(.34,1.56,.64,1)
  videoTimeoutMs:    1200,                  // budget for video + fonts + data, raced together
  hardCapMs:         4500,
  lateHandoffMs:     1500,   // keep in sync with the <head> rescue timeout in index.html
  scrollTolerancePx: 8,
  landingOffsetY:    0,                     // fine-tune escape hatch, calibrated in Fase 3
  sessionKey:        'flickIntroPlayed',    // must match the literal in index.html's <head> script
};

const LOGO = {
  fallMs:         120,
  fallEase:       'cubic-bezier(.5,0,.75,0)',
  fallDistanceEm: 0.9,
  closeMs:        140,
  closeEase:      'cubic-bezier(.7,0,.2,1)',
  closeDelayMs:   100,
  openMs:         140,
  openEase:       'cubic-bezier(.7,0,.2,1)',
  enterMs:        120,
  enterEase:      'cubic-bezier(.5,0,.75,0)',
  enterDelayMs:   120,
  hysteresisPx:   24,
};

const MARQUEE = {
  speedPxPerSec: 53,   // matches the pace of the old fixed 25s/2-copy loop at its original content width
};

const $ = (sel, root = document) => root.querySelector(sel);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ESC[c]);

const ICONS = {
  instagram: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.4 2.6 2.1 4.3 5 4.6"/></svg>',
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

// Real announce-bar height for .hero's min-height calc — 0 when it's empty
// (.announce:empty{display:none} already makes getBoundingClientRect 0, no extra
// branching needed here) or when its text wraps to a second line at this width.
// Re-measured on width changes only: a taller/shorter viewport with the same width
// can't change how the text wraps.
function setupAnnounceHeight() {
  const announce = document.getElementById('announce');
  if (!announce) return;
  function measure() {
    document.documentElement.style.setProperty('--announce-h', announce.getBoundingClientRect().height + 'px');
  }
  measure();
  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth !== lastWidth) { lastWidth = window.innerWidth; measure(); }
  }, { passive: true });
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

// Rebuilds however many copies are needed to cover the viewport with one extra to
// spare, so the loop never shows a gap at the end of a cycle (a fixed 2 copies +
// translateX(-50%) only works if one copy is already wider than the viewport).
// Re-run on resize and once Bebas Neue is actually loaded: both change how wide a
// single copy renders, same reasons the header logo's --k-travel gets re-measured.
function layoutMarquee() {
  const track = $('#marqueeTrack');
  const firstSet = track ? track.querySelector('.marquee-set') : null;
  if (!firstSet) return;
  const seq = firstSet.innerHTML;
  const copyWidth = firstSet.getBoundingClientRect().width;
  if (!copyWidth) return;
  const copies = Math.ceil(window.innerWidth / copyWidth) + 1;
  const extraCopies = Array.from({ length: Math.max(copies - 1, 0) },
    () => `<ul class="marquee-set" aria-hidden="true">${seq}</ul>`).join('');
  track.innerHTML = `<ul class="marquee-set">${seq}</ul>${extraCopies}`;
  document.documentElement.style.setProperty('--marquee-shift', copyWidth + 'px');
  document.documentElement.style.setProperty('--marquee-duration', (copyWidth / MARQUEE.speedPxPerSec) + 's');
}

function renderMarquee(items) {
  if (!items || !items.length) { $('#marquee').hidden = true; return; }
  const seq = items.map((t) => `<li>${esc(t)}</li>`).join('');
  $('#marqueeTrack').innerHTML = `<ul class="marquee-set">${seq}</ul>`;
  layoutMarquee();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutMarquee);
  window.addEventListener('resize', layoutMarquee, { passive: true });
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

// Only "FLICK" gets the letter-spans/hover treatment — renderFooter is driven by
// sitio.marca, which in principle could be any brand name, and the fall/close
// animation only makes sense for this exact word.
function renderFooterBrand(marcaUpper) {
  const footBrand = $('#footBrand');
  if (marcaUpper !== 'FLICK') {
    footBrand.removeAttribute('aria-label');
    footBrand.textContent = marcaUpper;
    return;
  }
  footBrand.textContent = '';
  footBrand.setAttribute('aria-label', 'Flick');
  const letters = document.createElement('span');
  letters.className = 'logo-letters';
  letters.setAttribute('aria-hidden', 'true');
  const classes = { 1: 'logo-l', 2: 'logo-i', 3: 'logo-c', 4: 'logo-k' };
  'FLICK'.split('').forEach((ch, i) => {
    const span = document.createElement('span');
    if (classes[i]) span.className = classes[i];
    span.textContent = ch;
    letters.appendChild(span);
  });
  footBrand.appendChild(letters);
  setupFooterLogoHover(letters);
}

// Measured separately from the header's --k-travel (own element, own cascade —
// reusing the header's value would be assuming, not measuring), same idea: real
// rendered gap between L and C, re-checked once fonts are actually loaded and on
// resize. No scroll/IntersectionObserver involved here — the trigger is plain
// CSS :hover, this only keeps the travel distance current.
function setupFooterLogoHover(lettersEl) {
  const lSpan = lettersEl.querySelector('.logo-l');
  const cSpan = lettersEl.querySelector('.logo-c');
  if (!lSpan || !cSpan) return;
  function measure() {
    const travel = (cSpan.offsetLeft + cSpan.offsetWidth) - (lSpan.offsetLeft + lSpan.offsetWidth);
    document.documentElement.style.setProperty('--footer-k-travel', travel + 'px');
  }
  measure();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  window.addEventListener('resize', measure, { passive: true });
}

function renderFooter(sitio) {
  renderFooterBrand(sitio.marca.toUpperCase());
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

/* ---------- header logo: FLICK <-> FLK across the hero/header boundary ---------- */
// Pure CSS transitions do the animating; JS only ever toggles .is-flk and keeps
// --k-travel current. That also means prefers-reduced-motion needs no special case
// here — the global `transition: none !important` rule already makes every state
// change instant.
function setupLogoScroll() {
  const logoEl = document.querySelector('.logo');
  const lettersEl = logoEl ? logoEl.querySelector('.logo-letters') : null;
  const hero = document.querySelector('.hero');
  const headerEl = document.getElementById('top');
  const lSpan = lettersEl ? lettersEl.querySelector('.logo-l') : null;
  const cSpan = lettersEl ? lettersEl.querySelector('.logo-c') : null;
  if (!logoEl || !lettersEl || !hero || !headerEl || !lSpan || !cSpan) return;

  const root = document.documentElement;
  root.style.setProperty('--logo-fall-ms', LOGO.fallMs + 'ms');
  root.style.setProperty('--logo-fall-ease', LOGO.fallEase);
  root.style.setProperty('--logo-fall-distance', LOGO.fallDistanceEm + 'em');
  root.style.setProperty('--logo-close-ms', LOGO.closeMs + 'ms');
  root.style.setProperty('--logo-close-ease', LOGO.closeEase);
  root.style.setProperty('--logo-close-delay', LOGO.closeDelayMs + 'ms');
  root.style.setProperty('--logo-open-ms', LOGO.openMs + 'ms');
  root.style.setProperty('--logo-open-ease', LOGO.openEase);
  root.style.setProperty('--logo-enter-ms', LOGO.enterMs + 'ms');
  root.style.setProperty('--logo-enter-ease', LOGO.enterEase);
  root.style.setProperty('--logo-enter-delay', LOGO.enterDelayMs + 'ms');

  // offsetLeft/offsetWidth, not getBoundingClientRect: the K can already be
  // mid-transform when this re-runs (resize, font swap), and a rect would fold
  // that transform into the measurement instead of reading the real layout gap.
  function measureKTravel() {
    const travel = (cSpan.offsetLeft + cSpan.offsetWidth) - (lSpan.offsetLeft + lSpan.offsetWidth);
    logoEl.style.setProperty('--k-travel', travel + 'px');
  }
  measureKTravel();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureKTravel);
  window.addEventListener('resize', measureKTravel, { passive: true });

  function applyState(isFlk, instant) {
    if (instant) lettersEl.classList.add('no-anim');
    logoEl.classList.toggle('is-flk', isFlk);
    if (instant) {
      void lettersEl.offsetHeight; // force reflow before re-enabling transitions
      lettersEl.classList.remove('no-anim');
    }
  }

  const headerHeight = headerEl.getBoundingClientRect().height;
  const half = LOGO.hysteresisPx / 2;

  // No separate "initial state" read via getBoundingClientRect(), no fixed grace
  // period, and no polling scrollY for stability either (both tried first: a
  // #catalogo entry has scroll-behavior:smooth on <html>, so the browser's own
  // scroll-to-anchor can still be actively moving well past any fixed window or
  // even start after a few already-stable polling reads, wrongly declaring
  // "settled" before it begins; a reload's scroll restoration races this script the
  // same way the intro's own <head> scrollY check does). Instead: listen for real
  // `scroll` events and wait for a quiet period after the last one. Any observer
  // update that lands before that quiet period — the real initial one included,
  // however long the browser's own automatic scroll takes to finish — is applied
  // instantly; once scrolling has demonstrably gone idle, updates animate normally.
  let currentIsFlk = false;
  let scrollSettled = false;
  let settleTimer = null;
  const armSettleTimer = () => {
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      scrollSettled = true;
      window.removeEventListener('scroll', armSettleTimer);
    }, 150);
  };
  armSettleTimer(); // covers the case where nothing ever scrolls at all
  window.addEventListener('scroll', armSettleTimer, { passive: true });

  // two observers, not one: a single boundary fires the same way in both scroll
  // directions, which is exactly what hysteresis has to avoid. The close line sits
  // above the open line, so there's a dead band between them where neither fires.
  const closeObserver = new IntersectionObserver((entries) => {
    const entry = entries[entries.length - 1];
    if (!entry.isIntersecting && !currentIsFlk) {
      currentIsFlk = true;
      applyState(true, !scrollSettled);
    }
  }, { rootMargin: `-${headerHeight - half}px 0px 0px 0px`, threshold: 0 });

  const openObserver = new IntersectionObserver((entries) => {
    const entry = entries[entries.length - 1];
    if (entry.isIntersecting && currentIsFlk) {
      currentIsFlk = false;
      applyState(false, !scrollSettled);
    }
  }, { rootMargin: `-${headerHeight + half}px 0px 0px 0px`, threshold: 0 });

  closeObserver.observe(hero);
  openObserver.observe(hero);
}

/* ---------- intro splash ---------- */
// Runs only if index.html's <head> script already decided to (html.intro-lock present).
// Every exit path funnels through finalize(), which is safe to call at any point —
// before the overlay exists, mid-sequence, or after a full run — so a crash anywhere
// in here still leaves the page fully visible and interactive.

function parseRgba(str) {
  const m = /rgba?\(([^)]+)\)/.exec(str);
  const parts = m[1].split(',').map((s) => parseFloat(s));
  return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
}

function tweenScrim(fromStr, toStr, duration, isCancelled) {
  const from = parseRgba(fromStr);
  const to = parseRgba(toStr);
  const root = document.documentElement;
  const start = performance.now();
  return new Promise((resolve) => {
    function tick(now) {
      if (isCancelled()) { resolve(); return; }
      const t = Math.min(1, (now - start) / duration);
      const a = from.a + (to.a - from.a) * t;
      root.style.setProperty('--hero-scrim', `rgba(${from.r},${from.g},${from.b},${a})`);
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
}

// Generic browser/OS scrollbar thickness, not "does this page currently overflow" —
// measuring the latter at intro-start is unreliable: the catalog grid is still empty
// (data hasn't loaded), so the page may not overflow yet even though it will once it does.
function getScrollbarWidth() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:50px;height:50px;overflow:scroll;';
  document.body.appendChild(probe);
  const width = probe.offsetWidth - probe.clientWidth;
  probe.remove();
  return width;
}

function rangeRectForChar(textNode, index) {
  const range = document.createRange();
  range.setStart(textNode, index);
  range.setEnd(textNode, index + 1);
  return range.getBoundingClientRect();
}

function waitReady(video, dataPromise, timeoutMs) {
  const videoReady = !video
    ? Promise.resolve()
    : (video.readyState >= 3 ? Promise.resolve() : new Promise((res) => video.addEventListener('canplay', res, { once: true })));
  const fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  const allReady = Promise.all([videoReady, fontsReady, dataPromise]).then(() => true);
  const timeout = new Promise((res) => setTimeout(() => res(false), timeoutMs));
  return Promise.race([allReady, timeout]);
}

function buildFlkClone(flickEl) {
  const cs = getComputedStyle(flickEl);
  const fontSizePx = parseFloat(cs.fontSize);
  const letterSpacingPx = parseFloat(cs.letterSpacing) || 0;
  const lineHeightPx = parseFloat(cs.lineHeight);
  const ratio = isNaN(lineHeightPx) ? 1 : lineHeightPx / fontSizePx;

  const wrap = document.createElement('div');
  wrap.id = 'introFlk';
  wrap.style.visibility = 'hidden';
  wrap.style.opacity = '0';
  wrap.style.fontFamily = cs.fontFamily;
  wrap.style.fontWeight = cs.fontWeight;
  wrap.style.color = cs.color;
  wrap.style.fontSize = (fontSizePx * INTRO.logoScale) + 'px';
  wrap.style.letterSpacing = (letterSpacingPx * INTRO.logoScale) + 'px';
  wrap.style.lineHeight = String(ratio);

  ['F', 'L', 'K'].forEach((ch) => {
    const span = document.createElement('span');
    span.textContent = ch;
    wrap.appendChild(span);
  });
  return wrap;
}

// Per-letter FLIP: F/L/K move independently (K travels further, past the gap I and C
// will occupy) so the word "flicks" into place rather than sliding as a rigid block.
// Origin is an explicit pixel offset, not a CSS keyword: the span's own box is sized by
// line-height (.88 × font-size), which does not coincide with the Range-measured glyph
// point, so the keyword "left bottom" would anchor the wrong pixel.
async function flipLanding(flkWrap, flickEl, trackAnim) {
  const textNode = flickEl.firstChild;
  const letters = ['F', 'L', 'K'];
  const letterIndex = { F: 0, L: 1, K: 4 };
  const scale = 1 / INTRO.logoScale;
  const spans = [...flkWrap.children];

  const anims = spans.map((span, i) => {
    const idx = letterIndex[letters[i]];
    const spanRect = span.getBoundingClientRect();
    const cloneCharRect = rangeRectForChar(span.firstChild, 0);
    const targetRect = rangeRectForChar(textNode, idx);

    const originX = cloneCharRect.left - spanRect.left;
    const originY = cloneCharRect.bottom - spanRect.top;
    span.style.transformOrigin = `${originX}px ${originY}px`;

    const dx = targetRect.left - cloneCharRect.left;
    const dy = (targetRect.bottom - cloneCharRect.bottom) + INTRO.landingOffsetY;

    return trackAnim(span.animate(
      [{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx}px, ${dy}px) scale(${scale})` }],
      { duration: INTRO.flickMs, easing: INTRO.flickEasing, fill: 'forwards' }
    )).finished;
  });

  await Promise.all(anims);
  flickEl.classList.remove('intro-veil');   // I and C appear here, instantly — no fade
  flkWrap.style.visibility = 'hidden';
}

function revealHeroContent(els, trackAnim) {
  const anims = els.filter(Boolean).map((el) => {
    el.classList.remove('intro-veil');
    return trackAnim(el.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: INTRO.revealMs, easing: 'ease', fill: 'both' }
    )).finished;
  });
  return Promise.all(anims);
}

async function playSequence(ctx) {
  const { curtain, flk, flick, announceEl, headerEl, pill, pre, post, sub, actions,
    marquee, catalog, delivery, footer, waFloat, trackAnim, isCancelled } = ctx;

  const startH = curtain.getBoundingClientRect().height;
  const targetH = announceEl.getBoundingClientRect().height + headerEl.getBoundingClientRect().height;
  const scaleTarget = targetH / startH;

  await trackAnim(curtain.animate(
    [{ transform: 'scaleY(1)' }, { transform: `scaleY(${scaleTarget})` }],
    { duration: INTRO.curtainMs, easing: 'ease-out', fill: 'forwards' }
  )).finished;
  if (isCancelled()) return;

  await tweenScrim(INTRO.scrimRest, INTRO.scrimBright, INTRO.brightenMs, isCancelled);
  if (isCancelled()) return;

  flk.style.visibility = 'visible';
  await trackAnim(flk.animate(
    [{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'scale(1)' }],
    { duration: INTRO.logoInMs, easing: 'ease-out', fill: 'forwards' }
  )).finished;
  if (isCancelled()) return;

  await flipLanding(flk, flick, trackAnim);
  if (isCancelled()) return;

  // curtain stays over announce+header until this beat: the announce bar's real
  // background (--surface, lighter than the curtain's --bg) only gets exposed here,
  // masked by the bigger reveal happening at the same time
  await Promise.all([
    tweenScrim(INTRO.scrimBright, INTRO.scrimRest, INTRO.revealMs, isCancelled),
    revealHeroContent([pill, pre, post, sub, actions, marquee, catalog, delivery, footer, waFloat], trackAnim),
    trackAnim(curtain.animate([{ opacity: 1 }, { opacity: 0 }], { duration: INTRO.revealMs, easing: 'ease', fill: 'forwards' })).finished,
  ]);
}

async function runIntro(dataPromise) {
  const html = document.documentElement;
  let crosshairStarted = false;
  const ensureCrosshair = () => { if (!crosshairStarted) { crosshairStarted = true; setupCrosshair(); } };
  let logoScrollStarted = false;
  const ensureLogoScroll = () => { if (!logoScrollStarted) { logoScrollStarted = true; setupLogoScroll(); } };
  // finalize() is the only place that starts the crosshair and the header-logo
  // scroll behavior (both guarded by their own flag above): if the hard cap fires
  // while something upstream is stuck awaiting (rAF in a backgrounded tab never
  // ticks, for instance), runIntro itself may stay suspended forever, but finalize()
  // still ran synchronously, so neither gets lost with it.
  if (!html.classList.contains('intro-lock')) { ensureCrosshair(); ensureLogoScroll(); return; }

  const handoff = performance.now();
  let cancelled = false;
  let hardCapTimer = null;
  let detachWatchers = () => {};
  const activeAnimations = [];
  const trackAnim = (anim) => { activeAnimations.push(anim); return anim; };
  const isCancelled = () => cancelled;

  function markSeen() {
    try { sessionStorage.setItem(INTRO.sessionKey, '1'); } catch (e) { /* private mode, nothing to persist */ }
  }

  function finalize() {
    if (hardCapTimer) clearTimeout(hardCapTimer);
    detachWatchers();
    activeAnimations.forEach((a) => { try { a.cancel(); } catch (e) {} });
    const overlay = document.getElementById('introOverlay');
    if (overlay) overlay.remove();
    document.querySelectorAll('.intro-veil').forEach((el) => el.classList.remove('intro-veil'));
    html.style.removeProperty('--hero-scrim');
    html.classList.remove('intro-lock');
    html.style.removeProperty('overflow');
    html.style.removeProperty('padding-right');
    document.body.style.removeProperty('overflow');
    const page = document.getElementById('page');
    if (page) page.inert = false;
    const skipLink = document.querySelector('.skip-link');
    if (skipLink) skipLink.inert = false;
    ensureCrosshair();
    ensureLogoScroll();
  }

  try {
    if (handoff > INTRO.lateHandoffMs) { markSeen(); finalize(); return; }
    if (window.scrollY > INTRO.scrollTolerancePx || location.hash) { markSeen(); finalize(); return; }

    const pill = $('.pill');
    const pre = $('.hero-pre');
    const flick = $('.hero-flick');
    const post = $('.hero-post');
    const sub = $('.hero-sub');
    const actions = $('.hero-actions');
    const marquee = document.getElementById('marquee');
    const catalog = document.getElementById('catalogo');
    const delivery = document.getElementById('entrega');
    const footer = $('.site-footer');
    const waFloat = document.getElementById('floatWa');
    const announceEl = document.getElementById('announce');
    const headerEl = document.getElementById('top');
    const video = document.querySelector('.hero-video');

    [pill, pre, flick, post, sub, actions, marquee, catalog, delivery, footer, waFloat].forEach((el) => el && el.classList.add('intro-veil'));

    const page = document.getElementById('page');
    if (page) page.inert = true;
    // .skip-link lives outside #page (deliberately, so it's the very first tab stop) —
    // #page.inert doesn't reach it, so it needs the same treatment on its own
    const skipLink = document.querySelector('.skip-link');
    if (skipLink) skipLink.inert = true;
    // compensate for the scrollbar overflow:hidden removes, so releasing it later
    // doesn't shrink the content width by the scrollbar's own size (measured, not
    // assumed: 0 on touch/overlay-scrollbar systems, ~15-17px on classic desktop ones)
    const scrollbarW = getScrollbarWidth();
    html.style.overflow = 'hidden';
    if (scrollbarW > 0) html.style.paddingRight = scrollbarW + 'px';
    document.body.style.overflow = 'hidden';

    const overlay = document.createElement('div');
    overlay.id = 'introOverlay';
    overlay.setAttribute('aria-hidden', 'true');

    const curtain = document.createElement('div');
    curtain.id = 'introCurtain';
    overlay.appendChild(curtain);

    const flk = buildFlkClone(flick);
    overlay.appendChild(flk);

    document.body.appendChild(overlay);
    requestAnimationFrame(() => html.classList.remove('intro-lock'));

    hardCapTimer = setTimeout(() => { cancelled = true; finalize(); }, INTRO.hardCapMs);

    const startWidth = window.innerWidth;
    const onResize = () => { if (window.innerWidth !== startWidth) cancelled = true; };
    const onScroll = () => { if (Math.abs(window.scrollY) > INTRO.scrollTolerancePx) cancelled = true; };
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    detachWatchers = () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
    };

    const ready = await waitReady(video, dataPromise, INTRO.videoTimeoutMs);
    if (cancelled || !ready) { finalize(); return; }

    await playSequence({ curtain, flk, flick, announceEl, headerEl, pill, pre, post, sub, actions,
      marquee, catalog, delivery, footer, waFloat, trackAnim, isCancelled });
    finalize();
  } catch (err) {
    // cancel() on a tracked animation rejects its .finished with AbortError — expected
    // whenever the hard cap or a resize/scroll cancellation cuts the sequence short.
    if (!(err && err.name === 'AbortError')) console.error(err);
    finalize();
  }
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

  const dataPromise = (async () => {
    try {
      DATA = await loadData();
      renderAnnounce(DATA.sitio);
      setupAnnounceHeight();
      renderNav(DATA.categorias);
      renderSocials(DATA.sitio);
      renderMarquee(DATA.sitio.marquee);
      renderDelivery(DATA.sitio.entrega);
      renderFooter(DATA.sitio);
      setupCatalog();
    } catch (err) {
      console.error(err);
      showError();
    }
  })();

  await runIntro(dataPromise);   // starts the crosshair itself, from finalize() — see there
}

init();
