'use strict';
/* Vitrina de teclados (/vitrina/).
   Layout and images come from productos.json -> "vitrina"; price, name and agotado
   come from the product itself (Supabase first, productos.json as fallback), same as
   the catalog. A few helpers are copied from ../app.js on purpose: no bundler, and
   loading all of app.js here would also start the home page intro. */

const ROOT = document.documentElement.dataset.root || '../';
const SUPABASE_URL = 'https://nisegpuyvfujzrcjlhtw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ULilyHHntqtHTcrihvy_Pw_8ylQBEC_';  // public (publishable) key
const SUPABASE_TIMEOUT_MS = 4000;
const SUPABASE_FIELDS = 'id,nombre,marca,categoria,agotado,gancho,precio,precio_regular';

const ZOOM = {
  fill: 0.82,        // keyboard box takes up to this share of the stage when zoomed
  fadeDelayMs: 500,  // close-up starts arriving while the wall fades (wall fade: 500-1000 ms)
  closeMs: 1100,     // matches the wall's return transition in vitrina.css
  bootDarkMs: 450,   // everything stays off this long, then the neon sign buzzes on
  lampsAfterMs: 900, // lamps start flickering this long after the sign
  bootStepMs: 220,   // delay between one lamp and the next
};

const $ = (sel, root = document) => root.querySelector(sel);
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ESC[c]);
const hasValue = (v) => v !== null && v !== undefined && String(v).trim() !== '';
const isInt = (v) => Number.isInteger(v);
const money = (n) => '$' + new Intl.NumberFormat('es-CO').format(n);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isPhone = () => matchMedia('(max-width: 699px)').matches;
const WA_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.3.4-.4.4c-.1.2-.3.3-.1.6.2.3.7 1.2 1.5 1.9 1 .9 1.8 1.2 2.1 1.3.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.4z"/></svg>';

let DATA = null;
let SPOTS = [];          // [{ e, p, state, el }]
let openIdx = -1;
let opener = null;

/* ---------- data (same rules as app.js) ---------- */
async function loadData() {
  const [data, remote] = await Promise.all([
    fetch(ROOT + 'productos.json').then((res) => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }),
    loadRemoteProductos().catch((err) => {
      console.warn('Supabase no disponible, usando productos.json:', err.message);
      return null;
    })
  ]);
  if (remote) data.productos = remote;
  return data;
}

async function loadRemoteProductos() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SUPABASE_TIMEOUT_MS);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/productos?select=${SUPABASE_FIELDS}&order=orden`, {
      headers: { apikey: SUPABASE_KEY },
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) throw new Error('respuesta vacia o inesperada');
    return rows;
  } catch (err) {
    throw ctrl.signal.aborted ? new Error('timeout de ' + SUPABASE_TIMEOUT_MS + ' ms') : err;
  } finally {
    clearTimeout(timer);
  }
}

const byId = (id) => (DATA.productos || []).find((p) => p.id === id);

function whatsappUrl(p) {
  const template = (p.agotado && hasValue(DATA.sitio.mensaje_whatsapp_agotado))
    ? DATA.sitio.mensaje_whatsapp_agotado
    : DATA.sitio.mensaje_whatsapp;
  return `https://wa.me/${DATA.sitio.whatsapp}?text=${encodeURIComponent(template.replace('{producto}', p.nombre))}`;
}

// Same rules as priceHTML() in app.js: nothing when prices are off, sold out or not an integer.
function priceHTML(p) {
  if (DATA.sitio.mostrar_precios !== true || p.agotado || !isInt(p.precio)) return '';
  if (isInt(p.precio_regular) && p.precio_regular > p.precio) {
    const label = hasValue(DATA.sitio.promo_etiqueta) ? `<span class="price-label">${esc(DATA.sitio.promo_etiqueta)}</span>` : '';
    return `<div class="price price-promo"><p class="price-reg"><span class="price-label">Precio regular</span><s>${money(p.precio_regular)}</s></p><p class="price-now">${label}<strong class="price-val">${money(p.precio)}</strong></p></div>`;
  }
  return `<div class="price"><p class="price-now"><strong class="price-val">${money(p.precio)}</strong></p></div>`;
}
const shortPrice = (p) => (DATA.sitio.mostrar_precios === true && !p.agotado && isInt(p.precio) ? money(p.precio) : '');

const srcset = (base, widths) => widths.map((w) => `${ROOT}${base}-${w}.webp ${w}w`).join(', ');
const realPhotosUrl = (p) => `${ROOT}#producto=${encodeURIComponent(p.id)}`;

/* ---------- wall ---------- */
function renderWall() {
  const V = DATA.vitrina;
  const wall = $('#vtWall');
  wall.sizes = '(max-width: 1600px) 100vw, 1600px';
  wall.srcset = srcset(V.muro.src, V.muro.anchos);
  wall.src = `${ROOT}${V.muro.src}-${V.muro.anchos[1] || V.muro.anchos[0]}.webp`;

  const hRatio = V.muro.alto / V.muro.ancho;   // stage height in units of its width (cqw = 1% of width)
  SPOTS = V.espacios.map((e) => {
    const p = e.producto ? byId(e.producto) : null;
    const state = !p ? 'empty' : p.agotado ? 'off' : 'on';
    return { e, p, state };
  });

  $('#vtSpots').innerHTML = SPOTS.map(({ e, p, state }, i) => {
    const [x, y, w, h] = e.caja;
    const [lx, ly, lw] = e.lampara;
    // cone runs from the bar down to ~80% of the keyboard's height, in cqw
    const coneH = Math.max(4, (y + h * 0.8 - ly) * hRatio);
    const vars = `--x:${x}%;--y:${y}%;--w:${w}%;--h:${h}%;--lx:${lx}%;--ly:${ly}%;--lw:${lw}%;--cone-h:${coneH.toFixed(2)}cqw`;
    if (!p) {
      return `<div class="vt-spot" data-state="empty" style="${vars}"><span class="vt-tag">Próximamente</span></div>`;
    }
    const tag = state === 'off'
      ? `<b>${esc(p.nombre)}</b><span class="vt-tag-out">Agotado</span>`
      : `<b>${esc(p.nombre)}</b>${shortPrice(p) ? `<span class="vt-tag-price">${shortPrice(p)}</span>` : ''}`;
    const label = `${p.nombre}${state === 'off' ? ', agotado' : ''}. Ver de cerca`;
    return `<div class="vt-spot" data-state="${state}" data-i="${i}" style="${vars}">
        ${state === 'off' ? '<div class="vt-dim"></div>' : ''}<div class="vt-tint"></div><div class="vt-pool"></div>
        <div class="vt-lamp"></div>
        <button class="vt-slot" type="button" data-i="${i}" aria-label="${esc(label)}"></button>
        <span class="vt-tag" aria-hidden="true">${tag}</span>
      </div>`;
  }).join('');
  SPOTS.forEach((s, i) => { s.el = $(`.vt-spot[data-i="${i}"]`); });

  const spots = $('#vtSpots');
  const hot = (el, on) => {
    const spot = el && el.closest('.vt-spot[data-i]');
    if (!spot) return;
    spot.classList.toggle('is-hot', on);
    if (on) preload(+spot.dataset.i);
  };
  spots.addEventListener('pointerover', (e) => hot(e.target, true));
  spots.addEventListener('pointerout', (e) => {
    const to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.vt-spot[data-i]');
    const from = e.target.closest('.vt-spot[data-i]');
    if (from && from !== to) from.classList.remove('is-hot');
  });
  spots.addEventListener('focusin', (e) => hot(e.target, true));
  spots.addEventListener('focusout', (e) => hot(e.target, false));
  spots.addEventListener('click', (e) => {
    const b = e.target.closest('.vt-slot');
    if (b) open(+b.dataset.i, b);
  });
}

const preloaded = new Set();
function preload(i) {
  const s = SPOTS[i];
  if (!s || !s.e.cerca || preloaded.has(i) || isPhone()) return;
  preloaded.add(i);
  // decode ahead of the click so the zoom never waits on a 2000 px image
  const img = new Image();
  img.decoding = 'async';
  img.sizes = '(max-width: 1600px) 100vw, 1600px';
  img.srcset = srcset(s.e.cerca, DATA.vitrina.cerca.anchos);
  img.decode().catch(() => {});
}

/* ---------- zoom in / out ---------- */
function zoomTransform(i) {
  const stage = $('#vtStage');
  const W = stage.clientWidth;
  const H = stage.clientHeight;
  const [x, y, w, h] = SPOTS[i].e.caja;
  const bx = (x / 100) * W, by = (y / 100) * H, bw = (w / 100) * W, bh = (h / 100) * H;
  const s = Math.min((W * ZOOM.fill) / bw, (H * ZOOM.fill) / bh);
  const tx = W / 2 - (bx + bw / 2) * s;
  const ty = H / 2 - (by + bh / 2) * s;
  return `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${s.toFixed(4)})`;
}

function panelHTML(p) {
  return `
    <div class="vt-panel-id">
      <p class="brand">${esc(p.marca || '')}</p>
      <h2 class="vt-panel-name" id="vtPanelName">${esc(p.nombre)}${p.agotado ? ' <span class="agotado-tag">Agotado</span>' : ''}</h2>
      ${hasValue(p.gancho) ? `<p class="lead">${esc(p.gancho)}</p>` : ''}
    </div>
    ${priceHTML(p)}
    <div class="vt-panel-actions">
      <a class="vt-real" href="${esc(realPhotosUrl(p))}">Ver fotos reales</a>
      <a class="btn btn-wa" href="${esc(whatsappUrl(p))}" target="_blank" rel="noopener">${WA_ICON}${p.agotado ? 'Preguntar si vuelve' : 'Pedir por WhatsApp'}</a>
    </div>
    <p class="vt-panel-note">Imagen demo hecha con IA: puede tener pequeñas diferencias.</p>`;
}

function open(i, from) {
  const s = SPOTS[i];
  if (!s || !s.p) return;
  if (isPhone()) {   // phones: no zoom, jump to the card
    const card = document.getElementById('vt-card-' + s.p.id);
    if (card) card.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    return;
  }
  openIdx = i;
  opener = from || document.activeElement;
  const stage = $('#vtStage');
  const img = $('#vtCloseImg');
  img.sizes = '(max-width: 1600px) 100vw, 1600px';
  img.srcset = srcset(s.e.cerca, DATA.vitrina.cerca.anchos);
  img.src = `${ROOT}${s.e.cerca}-${DATA.vitrina.cerca.anchos[0]}.webp`;
  img.alt = `${s.p.nombre} de cerca (imagen demo hecha con IA)`;
  img.decoding = 'async';
  const decoded = img.decode().catch(() => {});
  $('#vtPanel').innerHTML = panelHTML(s.p);

  // bring the whole stage on screen first (the frame is sized to fit under the header)
  const top = stage.getBoundingClientRect().top;
  const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 65;
  if (top < headerH || stage.getBoundingClientRect().bottom > innerHeight) {
    scrollTo({ top: scrollY + top - headerH - 16, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
  stage.classList.add('is-zoomed');
  $('#vtWorld').style.transform = reducedMotion() ? '' : zoomTransform(i);
  $('#vtWorld').setAttribute('aria-hidden', 'true');
  const close = $('#vtClose');
  close.setAttribute('aria-hidden', 'false');
  Promise.all([decoded, wait(reducedMotion() ? 0 : ZOOM.fadeDelayMs)]).then(() => {
    if (openIdx !== i) return;
    stage.classList.add('is-open');
    $('#vtX').focus({ preventScroll: true });
  });
}

function closeUp() {
  if (openIdx < 0) return;
  openIdx = -1;
  const stage = $('#vtStage');
  stage.classList.remove('is-open');
  $('#vtWorld').style.transform = '';
  $('#vtWorld').removeAttribute('aria-hidden');
  $('#vtClose').setAttribute('aria-hidden', 'true');
  setTimeout(() => { if (openIdx < 0) stage.classList.remove('is-zoomed'); }, reducedMotion() ? 0 : ZOOM.closeMs);
  if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  opener = null;
}

function setupCloseUp() {
  $('#vtX').addEventListener('click', closeUp);
  $('#vtCloseImg').addEventListener('click', closeUp);   // click outside the panel
  document.addEventListener('keydown', (e) => {
    if (openIdx < 0) return;
    if (e.key === 'Escape') { closeUp(); return; }
    if (e.key !== 'Tab') return;
    const f = [$('#vtX'), ...$('#vtPanel').querySelectorAll('a[href]')];
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  window.addEventListener('resize', () => {
    if (openIdx < 0) return;
    if (isPhone()) { closeUp(); return; }
    const w = $('#vtWorld');
    w.style.transition = 'none';
    w.style.transform = reducedMotion() ? '' : zoomTransform(openIdx);
    requestAnimationFrame(() => { w.style.transition = ''; });
  }, { passive: true });
}

/* ---------- phone list ---------- */
function renderList() {
  const V = DATA.vitrina;
  $('#vtList').innerHTML = SPOTS.filter((s) => s.p && s.e.cerca).map(({ e, p }) => `
    <li class="vt-card${p.agotado ? ' is-off' : ''}" id="vt-card-${esc(p.id)}">
      <div class="vt-card-media">
        <img srcset="${srcset(e.cerca, V.cerca.anchos)}" sizes="100vw" src="${ROOT}${e.cerca}-${V.cerca.anchos[0]}.webp" alt="${esc(p.nombre)} (imagen demo hecha con IA)" width="${V.cerca.ancho}" height="${V.cerca.alto}" loading="lazy" decoding="async">
      </div>
      <div class="vt-card-body">
        <p class="brand">${esc(p.marca || '')}</p>
        <h2 class="vt-card-name">${esc(p.nombre)}${p.agotado ? ' <span class="agotado-tag">Agotado</span>' : ''}</h2>
        ${priceHTML(p)}
        <a class="btn btn-wa" href="${esc(whatsappUrl(p))}" target="_blank" rel="noopener">${WA_ICON}${p.agotado ? 'Preguntar si vuelve' : 'Pedir por WhatsApp'}</a>
        <a class="vt-real" href="${esc(realPhotosUrl(p))}">Ver fotos reales</a>
      </div>
    </li>`).join('');
}

/* ---------- lights-on intro ---------- */

async function lightsOn() {
  const stage = $('#vtStage');
  try { await $('#vtWall').decode(); } catch (e) { /* show the lamps anyway */ }
  if (reducedMotion()) { stage.classList.remove('is-booting'); return; }
  let k = 0;
  SPOTS.forEach((s) => {
    if (s.state !== 'on' || !s.el) return;
    s.el.style.setProperty('--boot-d', ((ZOOM.lampsAfterMs + k * ZOOM.bootStepMs + Math.random() * 120) / 1000).toFixed(2) + 's');
    k++;
  });
  await wait(ZOOM.bootDarkMs);
  stage.classList.add('is-lighting');
  stage.classList.remove('is-booting');
  setTimeout(() => stage.classList.remove('is-lighting'), ZOOM.lampsAfterMs + 1500 + k * ZOOM.bootStepMs + 300);
}

/* ---------- boot ---------- */
function renderAviso() {
  const aviso = DATA.vitrina.aviso || '';
  // "Vitrina demo · resto" -> bold lead; the catalog mention becomes a link
  const [lead, ...rest] = aviso.split(' · ');
  const body = esc(rest.join(' · ') || '').replace(/catálogo/, `<a href="${ROOT}#catalogo">catálogo</a>`);
  $('#vtAviso').innerHTML = rest.length ? `<strong>${esc(lead)}</strong> · ${body}` : esc(aviso);
}

async function init() {
  setupCloseUp();
  try {
    DATA = await loadData();
    if (!DATA.vitrina || !Array.isArray(DATA.vitrina.espacios)) throw new Error('productos.json no trae "vitrina"');
    renderAviso();
    renderWall();
    renderList();
    lightsOn();
  } catch (err) {
    console.error(err);
    $('#vtStage').classList.remove('is-booting');
    const el = $('#vtError');
    el.hidden = false;
    el.textContent = 'No se pudo cargar la vitrina. Recarga la página o mira el catálogo.';
  }
}

init();
