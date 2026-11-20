// ==UserScript==
// @name         Gemini Model Lab ⚗️
// @namespace    gemini-model-lab
// @version      1.3.1
// @description  Выбор модели в Gemini через химическую лабораторию. Перегрел колбу — взрыв: текст из поля ввода копируется, вкладка закрывается.
// @match        https://gemini.google.com/*
// @run-at       document-idle
// @noframes
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        window.close
// ==/UserScript==

(() => {
  'use strict';

  /* ───────────────────────── данные ───────────────────────── */

  const SYM = ('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr ' +
    'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu ' +
    'Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr ' +
    'Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og').split(' ');

  const NAMES = ('Hydrogen Helium Lithium Beryllium Boron Carbon Nitrogen Oxygen Fluorine Neon Sodium Magnesium ' +
    'Aluminium Silicon Phosphorus Sulfur Chlorine Argon Potassium Calcium Scandium Titanium Vanadium Chromium Manganese ' +
    'Iron Cobalt Nickel Copper Zinc Gallium Germanium Arsenic Selenium Bromine Krypton Rubidium Strontium Yttrium ' +
    'Zirconium Niobium Molybdenum Technetium Ruthenium Rhodium Palladium Silver Cadmium Indium Tin Antimony Tellurium ' +
    'Iodine Xenon Caesium Barium Lanthanum Cerium Praseodymium Neodymium Promethium Samarium Europium Gadolinium ' +
    'Terbium Dysprosium Holmium Erbium Thulium Ytterbium Lutetium Hafnium Tantalum Tungsten Rhenium Osmium Iridium ' +
    'Platinum Gold Mercury Thallium Lead Bismuth Polonium Astatine Radon Francium Radium Actinium Thorium Protactinium ' +
    'Uranium Neptunium Plutonium Americium Curium Berkelium Californium Einsteinium Fermium Mendelevium Nobelium ' +
    'Lawrencium Rutherfordium Dubnium Seaborgium Bohrium Hassium Meitnerium Darmstadtium Roentgenium Copernicium ' +
    'Nihonium Flerovium Moscovium Livermorium Tennessine Oganesson').split(' ');
  const ALIASES = { aluminum: 13, cesium: 55, sulphur: 16 };
  const zByName = w => {
    const k = String(w || '').toLowerCase().replace(/[^a-z]/g, '');
    return ALIASES[k] || (NAMES.findIndex(n => n.toLowerCase() === k) + 1);
  };

  // Модели Gemini названы элементами. Список читается из настоящего меню и кешируется;
  // это значения по умолчанию, пока меню ещё ни разу не открывалось.
  const DEFAULT_MODELS = [
    { z: 1,  name: 'Hydrogen', label: 'Повседневные дела' },
    { z: 10, name: 'Neon',     label: 'Глубокий анализ' },
    { z: 6,  name: 'Carbon',   label: 'Код и сложные задачи', locked: true },
  ];
  const MAX_SLOTS = 6;
  const HEAT = [{ n: 'Low', v: 1 }, { n: 'Medium', v: 2 }, { n: 'High', v: 3 }];

  const isRadioactive = z => z === 43 || z === 61 || z >= 84;

  function gridPos(z) { // [row, col]
    if (z === 1) return [1, 1];
    if (z === 2) return [1, 18];
    if (z <= 4) return [2, z - 2];
    if (z <= 10) return [2, z + 8];
    if (z <= 12) return [3, z - 10];
    if (z <= 18) return [3, z];
    if (z <= 36) return [4, z - 18];
    if (z <= 54) return [5, z - 36];
    if (z <= 56) return [6, z - 54];
    if (z <= 71) return [9, z - 54];
    if (z <= 86) return [6, z - 68];
    if (z <= 88) return [7, z - 86];
    if (z <= 103) return [10, z - 86];
    return [7, z - 100];
  }

  // Категории элементов. Радиоактивные перекрывают всё остальное.
  const CATS = {
    hydrogen:   { n: 'Водород',             c: '#3b82f6' },
    alkali:     { n: 'Щелочные металлы',    c: '#ef4444' },
    alkearth:   { n: 'Щёлочноземельные',    c: '#f97316' },
    transition: { n: 'Переходные металлы',  c: '#94a3b8' },
    post:       { n: 'Постпереходные',      c: '#c08457' },
    metalloid:  { n: 'Полуметаллы',         c: '#14b8a6' },
    nonmetal:   { n: 'Неметаллы',           c: '#22d3ee' },
    halogen:    { n: 'Галогены',            c: '#f472b6' },
    noble:      { n: 'Благородные газы',    c: '#a855f7' },
    lanthanide: { n: 'Лантаноиды',          c: '#22c55e' },
    radio:      { n: 'Радиоактивные ☢',     c: '#facc15' },
  };
  const inList = (z, list) => list.includes(z);
  function category(z) {
    if (z === 43 || z === 61 || z >= 84) return 'radio';
    if (z === 1) return 'hydrogen';
    if (inList(z, [2, 10, 18, 36, 54])) return 'noble';
    if (inList(z, [3, 11, 19, 37, 55])) return 'alkali';
    if (inList(z, [4, 12, 20, 38, 56])) return 'alkearth';
    if (inList(z, [9, 17, 35, 53])) return 'halogen';
    if (inList(z, [6, 7, 8, 15, 16, 34])) return 'nonmetal';
    if (inList(z, [5, 14, 32, 33, 51, 52])) return 'metalloid';
    if (inList(z, [13, 31, 49, 50, 81, 82, 83])) return 'post';
    if (z >= 57 && z <= 71) return 'lanthanide';
    return 'transition';
  }
  const elColor = z => CATS[category(z)].c;

  /* ───────────────────────── утилиты ───────────────────────── */

  // Gemini включает Trusted Types, поэтому никакого innerHTML — только createElement
  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k != null) el.append(k);
    return el;
  }
  function svg(tag, attrs = {}, ...kids) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    for (const k of kids) el.append(k);
    return el;
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(fn, timeout = 1500, step = 40) {
    const t0 = performance.now();
    while (performance.now() - t0 < timeout) {
      const r = fn();
      if (r) return r;
      await sleep(step);
    }
    return null;
  }
  function hexToRgb(c) {
    const tmp = h('span', { style: `color:${c};display:none` });
    document.body.append(tmp);
    const m = getComputedStyle(tmp).color.match(/\d+(\.\d+)?/g).map(Number);
    tmp.remove();
    return m.slice(0, 3);
  }
  function mixColors(list) {
    if (!list.length) return 'transparent';
    const rgbs = list.map(hexToRgb);
    const avg = [0, 1, 2].map(i => Math.round(rgbs.reduce((a, c) => a + c[i], 0) / rgbs.length));
    return `rgb(${avg.join(',')})`;
  }

  /* ───────────────────────── связь с настоящим Gemini ───────────────────────── */

  function getInput() {
    return document.querySelector(
      'rich-textarea .ql-editor, div.ql-editor[contenteditable="true"], [contenteditable="true"][role="textbox"], main textarea'
    );
  }
  function getInputText() {
    const el = getInput();
    if (!el) return '';
    return ('value' in el && el.tagName === 'TEXTAREA' ? el.value : el.innerText).replace(/\n$/, '');
  }

  function findRealPicker() {
    const selectors = [
      '[data-test-id="bard-mode-menu-button"]',
      'bard-mode-switcher button',
      'button[aria-label*="mode picker" i]',
      'button[aria-label*="model" i][aria-haspopup]',
      'button[aria-label*="модел" i][aria-haspopup]',
      'button[aria-label*="режим" i][aria-haspopup]',
    ];
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el && !el.closest('#gml-chip, #gml-panel')) return el;
    }
    // запасной вариант: короткая кнопка с меню рядом с полем ввода
    const input = getInput();
    let box = input;
    for (let i = 0; i < 8 && box; i++) box = box.parentElement;
    if (box) {
      const cand = [...box.querySelectorAll('button[aria-haspopup]')].find(b => {
        const t = (b.innerText || '').trim();
        return t && t.length < 30 && !b.closest('#gml-chip') &&
          !/tool|инструмент|upload|загруз|добав|add|\+/i.test(t + (b.getAttribute('aria-label') || ''));
      });
      if (cand) return cand;
    }
    return null;
  }

  const OV = ''; // меню живёт в <div popover class="cdk-overlay-popover">, а не в .cdk-overlay-container
  const txt = (root, sel) => (root.querySelector(sel)?.innerText || '').trim();

  // Пункты моделей: <gem-menu-item role="menuitemradio" data-test-id="bard-mode-option-…">
  //   .label = «Глубокий анализ», .sublabel = «4 Neon». Ultra-апселл: data-mode-id="upsell_…"
  function modelItems() {
    return [...document.querySelectorAll(OV + '[data-test-id^="bard-mode-option-"]')].map(el => {
      const id = el.getAttribute('data-mode-id') || el.getAttribute('data-test-id');
      const label = txt(el, '.label'), sub = txt(el, '.sublabel');
      const word = (sub + ' ' + label).split(/\s+/).find(w => zByName(w));
      return {
        el, id, label, sub, z: word ? zByName(word) : 0, name: word || label,
        locked: /upsell/i.test(id) || el.getAttribute('aria-disabled') === 'true',
      };
    });
  }
  // Подменю «Уровень рассуждений»: Низкий / Средний / Высокий (radio без data-mode-id)
  const thinkingItems = () =>
    [...document.querySelectorAll(OV + 'gem-menu-item[role="menuitemradio"]:not([data-mode-id])')];

  const menuOpen = () => !!document.querySelector(OV + '[data-test-id^="bard-mode-option-"]');
  async function openRealMenu() {
    if (menuOpen()) return true;
    const real = findRealPicker();
    if (!real) return false;
    (real.querySelector('button') || real).click();
    return !!await waitFor(menuOpen, 1500);
  }
  async function closeRealMenu() {
    const esc = el => el && el.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
    for (let i = 0; i < 4 && (menuOpen() || thinkingItems().length); i++) {
      if (i < 2) {
        document.querySelectorAll('gem-menu[role="menu"]').forEach(esc);
        esc(document.activeElement); esc(document);
      } else {
        const bd = document.querySelector('.cdk-overlay-backdrop');
        if (bd) bd.click();
        else { const real = findRealPicker(); real && (real.querySelector('button') || real).click(); } // повторный клик закрывает
      }
      await sleep(150);
    }
  }

  function saveModels(list) {
    const clean = list.filter(m => m.z).map(({ z, name, label, locked }) => ({ z, name, label, locked }));
    if (clean.length) GM_setValue('gml_models', clean);
    return clean;
  }
  const knownModels = () => GM_getValue('gml_models', DEFAULT_MODELS);

  // Узнать текущую модель из aria-label кнопки: «Выбор режима, сейчас используется Gemini Neon»
  function readCurrentModel() {
    const real = findRealPicker();
    const aria = real && ((real.querySelector('button') || real).getAttribute('aria-label') || '');
    const word = aria && aria.split(/\s+/).reverse().find(w => zByName(w));
    if (word) return { z: zByName(word), name: NAMES[zByName(word) - 1] };
    if (/авто|auto/i.test(aria || '')) return { z: 0, name: 'Авто' };
    return null;
  }

  // Выбрать модель по номеру элемента и уровень рассуждений по нагреву
  async function applyToGemini(z, heat) {
    document.documentElement.classList.add('gml-silent');
    try {
      if (!await openRealMenu()) return { ok: false, why: 'нет меню' };
      const models = modelItems();
      saveModels(models);
      const m = models.find(x => x.z === z);
      if (!m) { await closeRealMenu(); return { ok: false, why: 'нет такой модели' }; }
      if (m.locked) { await closeRealMenu(); return { ok: false, why: 'locked', model: m }; }
      m.el.click();
      await sleep(250);

      let thinking = null;
      if (await openRealMenu()) {
        let th = thinkingItems();
        if (!th.length) {
          const ex = document.querySelector(OV + 'gem-menu-item[value="thinking_level"]');
          if (ex) { ex.click(); th = await waitFor(() => { const t = thinkingItems(); return t.length ? t : null; }, 800) || []; }
        }
        if (th.length) {
          const t = th[Math.min(th.length - 1, heat - 1)];
          thinking = txt(t, '.label') || t.innerText.trim().split('\n')[0];
          t.click();
          await sleep(150);
        }
        await closeRealMenu();
      }
      return { ok: true, model: m, thinking };
    } finally {
      setTimeout(() => document.documentElement.classList.remove('gml-silent'), 300);
    }
  }

  /* ───────────────────────── стили ───────────────────────── */

  GM_addStyle(`
  html.gml-silent .cdk-overlay-container, html.gml-silent .cdk-overlay-popover,
  html.gml-silent [data-test-id="bard-mode-popover-menu"], html.gml-silent gem-menu[role="menu"] {
    opacity: 0 !important; }
  .gml-real-hidden { position: absolute !important; width: 1px !important; height: 1px !important;
    overflow: hidden !important; opacity: 0 !important; pointer-events: none !important; }

  #gml-chip { all: unset; box-sizing: border-box; display: inline-flex; align-items: center; gap: 6px;
    height: 34px; padding: 0 12px; border-radius: 17px; cursor: pointer; font: 500 14px/1 'Google Sans', system-ui, sans-serif;
    color: #e3e3e3; background: rgba(255,255,255,.06); transition: background .15s; user-select: none; white-space: nowrap; }
  #gml-chip:hover { background: rgba(255,255,255,.12); }
  #gml-chip .gml-dot { width: 8px; height: 8px; border-radius: 50%; }
  #gml-chip .gml-caret { transition: transform .2s; font-size: 10px; opacity: .8; }
  #gml-chip.open .gml-caret { transform: rotate(180deg); }
  #gml-chip.gml-floating { position: fixed; right: 18px; bottom: 18px; z-index: 2147483000; background: #1f2023;
    box-shadow: 0 4px 18px rgba(0,0,0,.4); }

  #gml-panel { position: fixed; z-index: 2147483001; width: 470px; max-width: calc(100vw - 16px); box-sizing: border-box;
    padding: 12px 14px 14px; border-radius: 18px; background: #1e1f22; color: #e3e3e3;
    box-shadow: 0 12px 40px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.06);
    font: 12px/1.2 'Google Sans', system-ui, sans-serif; transform-origin: top center;
    animation: gml-pop .22s cubic-bezier(.2,.9,.3,1.2); user-select: none; }
  #gml-panel.up { transform-origin: bottom center; }
  @keyframes gml-pop { from { opacity: 0; transform: scale(.94) translateY(-6px); } }
  .gml-head { display: flex; align-items: center; gap: 6px; font-weight: 500; font-size: 13px; margin-bottom: 8px; }
  .gml-head .gml-star { color: #8ab4f8; }
  .gml-x { all: unset; margin-left: auto; cursor: pointer; width: 24px; height: 24px; border-radius: 50%;
    display: grid; place-items: center; color: #aaa; font-size: 14px; }
  .gml-x:hover { background: rgba(255,255,255,.08); color: #fff; }

  .gml-table { display: grid; grid-template-columns: repeat(18, 1fr); grid-template-rows: repeat(7, 1fr) 6px repeat(2, 1fr);
    gap: 2px; position: relative; }
  .gml-tile { aspect-ratio: 1; border-radius: 3px; background: color-mix(in srgb, var(--c) 16%, #26272b);
    color: color-mix(in srgb, var(--c) 55%, #ddd); display: grid; place-items: center;
    font-size: 8.5px; font-weight: 500; cursor: grab; position: relative; transition: transform .1s, background .1s;
    border: 1px solid transparent; box-sizing: border-box; touch-action: none; }
  .gml-tile:hover { background: color-mix(in srgb, var(--c) 35%, #2a2b2f); transform: scale(1.25); z-index: 2; color: #fff; }
  .gml-tile.radio { box-shadow: inset 0 0 4px color-mix(in srgb, var(--c) 45%, transparent); }
  .gml-table.focus .gml-tile[data-z]:not(.hl) { opacity: .18; }
  .gml-legend { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 8px; font-size: 10.5px; color: #aaa; }
  .gml-legend span { display: inline-flex; align-items: center; gap: 4px; cursor: default; }
  .gml-legend span:hover { color: #fff; }
  .gml-legend i { width: 9px; height: 9px; border-radius: 2px; background: var(--c); }
  .gml-tile.model::after { content: ''; position: absolute; top: 1px; right: 1px; width: 4px; height: 4px;
    border-radius: 50%; background: #fff; box-shadow: 0 0 4px #fff; }
  .gml-tile.model.locked::after { content: '🔒'; width: auto; height: auto; background: none; box-shadow: none;
    font-size: 5px; top: 0; right: 0; }
  .gml-tile.ph { cursor: default; font-size: 5px; color: #666; background: #232427; }
  .gml-tile.ph:hover { transform: none; background: #232427; }
  .gml-tile.used { border-color: var(--c); color: #fff; background: color-mix(in srgb, var(--c) 28%, #2a2b2f); }
  .gml-tile.current { border-color: var(--c); background: color-mix(in srgb, var(--c) 35%, #2a2b2f); color: #fff; }
  .gml-title { grid-row: 2 / 4; grid-column: 3 / 13; display: flex; flex-direction: column; justify-content: center;
    padding-left: 10px; pointer-events: none; }
  .gml-title b { font-size: 22px; font-weight: 400; color: #f1f1f1; letter-spacing: -.2px; }
  .gml-title span { font-size: 11px; color: #9aa0a6; margin-top: 3px; }

  .gml-lab { display: grid; grid-template-columns: 92px 1fr; gap: 10px; margin-top: 12px; align-items: end; }
  .gml-flaskwrap { position: relative; height: 96px; }
  .gml-flaskwrap svg { width: 92px; height: 96px; overflow: visible; }
  .gml-liquid { transition: y .45s cubic-bezier(.3,1.4,.5,1), height .45s cubic-bezier(.3,1.4,.5,1), fill .9s; }
  .gml-bubble { opacity: 0; }
  .gml-brewing .gml-bubble { animation: gml-bub 1s infinite ease-in; }
  @keyframes gml-bub { 0% { opacity: 0; transform: translateY(0) scale(.6); } 20% { opacity: .9; }
    100% { opacity: 0; transform: translateY(-34px) scale(1.15); } }
  .gml-brewing svg { animation: gml-wobble .25s infinite; }
  .gml-heat3.gml-brewing svg { animation-duration: .12s; }
  @keyframes gml-wobble { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-1.5deg); } 75% { transform: rotate(1.5deg); } }
  .gml-steam { position: absolute; left: 50%; top: -6px; width: 16px; height: 16px; margin-left: -8px; border-radius: 50%;
    background: rgba(240,240,255,.85); filter: blur(4px); opacity: 0; pointer-events: none; }
  .gml-brewing.gml-heat2 .gml-steam, .gml-brewing.gml-heat3 .gml-steam { animation: gml-steam 1.1s infinite ease-out; }
  @keyframes gml-steam { 0% { opacity: .9; transform: translate(0,0) scale(.6); }
    100% { opacity: 0; transform: translate(var(--dx), -70px) scale(2.4); } }
  .gml-critical svg { animation: gml-wobble .06s infinite !important; filter: drop-shadow(0 0 18px var(--glow)) brightness(1.4); }

  .gml-slots { display: flex; gap: 6px; margin-bottom: 10px; }
  .gml-slot { width: 28px; height: 28px; border-radius: 6px; border: 1px dashed #3e4045; box-sizing: border-box;
    display: grid; place-items: center; font-size: 11px; font-weight: 500; transition: transform .15s; }
  .gml-slot.filled { border: 1px solid var(--c); background: color-mix(in srgb, var(--c) 25%, #222); color: #fff;
    cursor: pointer; animation: gml-drop .3s cubic-bezier(.2,1.6,.4,1); }
  .gml-slot.filled:hover { transform: scale(1.1); }
  @keyframes gml-drop { from { transform: scale(.3) translateY(-10px); } }
  .gml-lab.drag-over .gml-slot:not(.filled) { border-color: #8ab4f8; }
  .gml-lab.drag-over .gml-flaskwrap svg { filter: drop-shadow(0 0 8px #8ab4f8); }

  .gml-row { display: flex; align-items: center; gap: 6px; }
  .gml-row .gml-lbl { color: #9aa0a6; margin-right: 2px; }
  .gml-heat { all: unset; padding: 5px 9px; border-radius: 12px; cursor: pointer; color: #bbb; font-size: 11.5px; }
  .gml-heat:hover { background: rgba(255,255,255,.06); }
  .gml-heat.on { background: #3b4a6b; color: #fff; }
  .gml-heat.on.h3 { background: #8a2b35; }
  .gml-brew { all: unset; margin-left: auto; min-width: 84px; text-align: center; padding: 8px 14px; border-radius: 16px;
    background: #a8c7fa; color: #062e6f; font-weight: 600; cursor: pointer; font-size: 12.5px; transition: filter .15s, background .3s; }
  .gml-brew:hover { filter: brightness(1.08); }
  .gml-brew.hot { background: #f6a5ad; color: #5c0b14; }
  .gml-brew[disabled] { opacity: .75; cursor: progress; }
  .gml-shake { animation: gml-no .3s; }
  @keyframes gml-no { 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
  .gml-hint { color: #80868b; font-size: 10.5px; margin-top: 8px; min-height: 13px; }

  .gml-ghost { position: fixed; z-index: 2147483005; pointer-events: none; width: 26px; height: 26px; border-radius: 5px;
    display: grid; place-items: center; font: 600 11px 'Google Sans', system-ui; color: #fff;
    background: color-mix(in srgb, var(--c) 45%, #222); border: 1px solid var(--c); box-shadow: 0 6px 16px rgba(0,0,0,.5);
    transform: translate(-50%,-50%) rotate(-8deg) scale(1.15); }

  .gml-toast { position: fixed; z-index: 2147483002; display: flex; align-items: center; gap: 10px; padding: 8px 14px 8px 8px;
    border-radius: 12px; background: #2a2b2f; color: #eee; box-shadow: 0 8px 26px rgba(0,0,0,.5);
    font: 500 13px 'Google Sans', system-ui; animation: gml-toast 2.4s forwards; pointer-events: none; }
  .gml-toast .sym { width: 34px; height: 34px; border-radius: 7px; display: grid; place-items: center; font-size: 17px;
    background: color-mix(in srgb, var(--c) 40%, #222); border: 1px solid var(--c); }
  .gml-toast small { display: block; color: #9aa0a6; font-size: 11px; margin-top: 2px; }
  @keyframes gml-toast { 0% { opacity: 0; transform: translateY(8px) scale(.9); } 12%,80% { opacity: 1; transform: none; }
    100% { opacity: 0; transform: translateY(-6px); } }

  /* ── взрыв ── */
  .gml-flash { position: fixed; inset: 0; z-index: 2147483006; background: #f3ead8; pointer-events: none;
    animation: gml-flash 1.1s forwards; }
  @keyframes gml-flash { 0% { opacity: 0; } 8% { opacity: 1; } 100% { opacity: 0; } }
  .gml-debris { position: fixed; z-index: 2147483007; pointer-events: none; will-change: transform; }
  .gml-smoke { position: fixed; z-index: 2147483004; border-radius: 50%; pointer-events: none;
    background: radial-gradient(circle, rgba(70,70,75,.95), rgba(45,45,50,0) 70%); filter: blur(10px);
    animation: gml-smoke 3s forwards ease-out; }
  @keyframes gml-smoke { 0% { opacity: 0; transform: scale(.2); } 15% { opacity: 1; } 100% { opacity: .85; transform: scale(1.6); } }
  .gml-quake { animation: gml-quake .5s; }
  @keyframes gml-quake { 10%,50%,90% { transform: translate(-8px,4px); } 30%,70% { transform: translate(8px,-5px); } }
  .gml-final { position: fixed; left: 50%; top: 45%; transform: translate(-50%,-50%); z-index: 2147483008;
    padding: 14px 20px; border-radius: 14px; background: #1e1f22; color: #eee; font: 500 14px 'Google Sans', system-ui;
    box-shadow: 0 10px 40px rgba(0,0,0,.6); text-align: center; }
  `);

  /* ───────────────────────── состояние ───────────────────────── */

  const state = {
    cur: GM_getValue('gml_cur', { z: 1, name: 'Hydrogen' }),
    slots: [],
    heat: 1,
    brewing: false,
    open: false,
  };

  let chip, panel, ui = {};

  /* ───────────────────────── чип выбора ───────────────────────── */

  const curColor = () => state.cur.z ? elColor(state.cur.z) : '#8ab4f8';
  function subText() {
    const m = knownModels().find(x => x.z === state.cur.z);
    return [state.cur.name, m && m.label, GM_getValue('gml_thinking', '')].filter(Boolean).join(' · ');
  }
  function syncCurrent() {
    const r = readCurrentModel();
    if (r && (r.z !== state.cur.z || r.name !== state.cur.name)) {
      state.cur = r;
      GM_setValue('gml_cur', r);
      return true;
    }
    return false;
  }

  function buildChip() {
    syncCurrent();
    const b = h('button', { id: 'gml-chip', type: 'button', title: 'Model lab' },
      h('span', { class: 'gml-dot', style: `background:${curColor()}` }),
      h('span', { class: 'gml-name' }, state.cur.name),
      h('span', { class: 'gml-caret' }, '▾'));
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); togglePanel(); });
    return b;
  }
  function refreshChip() {
    if (!chip) return;
    chip.querySelector('.gml-dot').style.background = curColor();
    chip.querySelector('.gml-name').textContent = state.cur.name;
    if (ui.sub) ui.sub.textContent = subText();
  }

  function mountChip() {
    const real = findRealPicker();
    if (chip && chip.isConnected) {
      if (real && !real.classList.contains('gml-real-hidden')) real.classList.add('gml-real-hidden');
      if (!state.brewing && syncCurrent()) refreshChip();
      if (!real || !chip.classList.contains('gml-floating')) return;
      chip.remove(); // нашли настоящую кнопку — переезжаем к ней из плавающего режима
    }
    chip = buildChip();
    if (real) {
      real.insertAdjacentElement('beforebegin', chip);
      real.classList.add('gml-real-hidden');
    } else {
      chip.classList.add('gml-floating');
      document.body.append(chip);
    }
  }

  /* ───────────────────────── панель ───────────────────────── */

  function buildPanel() {
    const table = h('div', { class: 'gml-table' });
    table.append(h('div', { class: 'gml-title' },
      h('b', {}, 'Gemini'), ui.sub = h('span', {}, subText())));
    const models = knownModels();
    for (let z = 1; z <= 118; z++) {
      const [r, c] = gridPos(z);
      const cat = category(z);
      const mdl = models.find(m => m.z === z);
      const t = h('div', {
        class: 'gml-tile ' + cat + (mdl ? ' model' : '') + (mdl && mdl.locked ? ' locked' : ''),
        'data-z': z, 'data-cat': cat,
        title: `${z} · ${SYM[z - 1]} · ${CATS[cat].n}` + (mdl ? `\nМодель Gemini: ${mdl.label}${mdl.locked ? ' (нужна подписка)' : ''}` : ''),
        style: `grid-row:${r};grid-column:${c};--c:${elColor(z)}`,
      }, SYM[z - 1]);
      t.addEventListener('pointerdown', onTileDown);
      table.append(t);
    }
    table.append(h('div', { class: 'gml-tile ph', style: 'grid-row:6;grid-column:3' }, '57–71'));
    table.append(h('div', { class: 'gml-tile ph', style: 'grid-row:7;grid-column:3' }, '89–103'));

    // колба
    const clipId = 'gml-clip-' + Math.random().toString(36).slice(2);
    const flaskPath = 'M36 6 H56 V34 L82 84 Q85 92 76 92 H16 Q7 92 10 84 L36 34 Z';
    ui.liquid = svg('rect', { class: 'gml-liquid', x: 0, y: 92, width: 92, height: 0, fill: 'transparent' });
    const bubbles = svg('g', {});
    for (let i = 0; i < 9; i++) {
      const bc = svg('circle', {
        class: 'gml-bubble', cx: 22 + Math.random() * 48, cy: 80 + Math.random() * 8, r: 1.5 + Math.random() * 2.5,
        fill: 'rgba(255,255,255,.75)',
      });
      bc.style.animationDelay = (Math.random()).toFixed(2) + 's';
      bc.style.transformBox = 'fill-box';
      bubbles.append(bc);
    }
    const s = svg('svg', { viewBox: '0 0 92 96' },
      svg('defs', {}, svg('clipPath', { id: clipId }, svg('path', { d: flaskPath }))),
      svg('g', { 'clip-path': `url(#${clipId})` }, ui.liquid, bubbles),
      svg('path', { d: flaskPath, fill: 'rgba(255,255,255,.04)', stroke: '#9aa0a6', 'stroke-width': 2.2, 'stroke-linejoin': 'round' }),
      svg('rect', { x: 32, y: 3, width: 28, height: 5, rx: 2, fill: '#9aa0a6' }));
    ui.flask = h('div', { class: 'gml-flaskwrap' }, s);
    for (let i = 0; i < 5; i++) {
      const st = h('div', { class: 'gml-steam' });
      st.style.animationDelay = (i * 0.22) + 's';
      st.style.setProperty('--dx', ((Math.random() - .5) * 40).toFixed(0) + 'px');
      ui.flask.append(st);
    }

    ui.slots = h('div', { class: 'gml-slots' });
    ui.heatBtns = HEAT.map((x, i) => {
      const b = h('button', { class: 'gml-heat' + (i === 2 ? ' h3' : ''), type: 'button' }, x.n);
      b.addEventListener('click', () => { if (!state.brewing) { state.heat = x.v; renderLab(); } });
      return b;
    });
    ui.brew = h('button', { class: 'gml-brew', type: 'button' }, 'Brew');
    ui.brew.addEventListener('click', brew);
    const legend = h('div', { class: 'gml-legend' }, Object.entries(CATS).map(([k, v]) => {
      const it = h('span', { style: `--c:${v.c}` }, h('i'), v.n);
      it.addEventListener('mouseenter', () => {
        table.classList.add('focus');
        table.querySelectorAll(`.gml-tile[data-cat="${k}"]`).forEach(t => t.classList.add('hl'));
      });
      it.addEventListener('mouseleave', () => {
        table.classList.remove('focus');
        table.querySelectorAll('.gml-tile.hl').forEach(t => t.classList.remove('hl'));
      });
      return it;
    }));
    ui.legend = legend;
    ui.hint = h('div', { class: 'gml-hint' }, 'Сумма атомных номеров = что синтезируется. Белая точка — модели Gemini. Heat = уровень рассуждений');

    ui.lab = h('div', { class: 'gml-lab' }, ui.flask,
      h('div', {}, ui.slots, h('div', { class: 'gml-row' }, h('span', { class: 'gml-lbl' }, 'Heat'), ...ui.heatBtns, ui.brew)));

    const x = h('button', { class: 'gml-x', type: 'button', title: 'Закрыть' }, '✕');
    x.addEventListener('click', closePanel);

    const p = h('div', { id: 'gml-panel' },
      h('div', { class: 'gml-head' }, h('span', { class: 'gml-star' }, '✦'), 'Model lab', x),
      table, legend, ui.lab, ui.hint);
    p.addEventListener('pointerdown', e => e.stopPropagation());
    ui.table = table;
    return p;
  }

  function renderLab() {
    if (!panel) return;
    // плитки
    const used = new Set(state.slots);
    const cur = state.cur.z;
    ui.table.querySelectorAll('.gml-tile[data-z]').forEach(t => {
      const z = +t.dataset.z;
      t.classList.toggle('used', used.has(z));
      t.classList.toggle('current', z === cur && !used.has(z));
    });
    // слоты
    ui.slots.replaceChildren(...Array.from({ length: MAX_SLOTS }, (_, i) => {
      const z = state.slots[i];
      if (!z) return h('div', { class: 'gml-slot' });
      const sl = h('div', { class: 'gml-slot filled', style: `--c:${elColor(z)}`, title: 'Убрать' }, SYM[z - 1]);
      sl.addEventListener('click', () => { if (!state.brewing) { state.slots.splice(i, 1); renderLab(); } });
      return sl;
    }));
    // жидкость
    if (!state.brewing) {
      const lvl = state.slots.length / MAX_SLOTS;
      const hgt = lvl * 50;
      ui.liquid.setAttribute('y', 92 - hgt);
      ui.liquid.setAttribute('height', hgt);
      ui.liquid.setAttribute('fill', mixColors(state.slots.map(elColor)));
    }
    // нагрев
    ui.heatBtns.forEach((b, i) => b.classList.toggle('on', HEAT[i].v === state.heat));
    ui.brew.classList.toggle('hot', state.heat === 3);
    ui.flask.className = 'gml-flaskwrap gml-heat' + state.heat + (state.brewing ? ' gml-brewing' : '');
  }

  function positionPanel() {
    if (!panel || !chip) return;
    const r = chip.getBoundingClientRect();
    const pw = panel.offsetWidth, ph = panel.offsetHeight;
    const below = window.innerHeight - r.bottom, above = r.top;
    let top;
    if (below >= ph + 12 || below >= above) { top = r.bottom + 10; panel.classList.remove('up'); }
    else { top = r.top - ph - 10; panel.classList.add('up'); }
    top = Math.max(8, Math.min(top, window.innerHeight - ph - 8));
    let left = r.right - pw;
    left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
    panel.style.top = top + 'px';
    panel.style.left = left + 'px';
  }

  function openPanel() {
    if (state.open) return;
    state.open = true;
    panel = buildPanel();
    document.body.append(panel);
    renderLab();
    positionPanel();
    chip.classList.add('open');
  }
  function closePanel() {
    if (!state.open || state.brewing) return;
    state.open = false;
    panel?.remove();
    panel = null;
    chip?.classList.remove('open');
  }
  function togglePanel() { state.open ? closePanel() : openPanel(); }

  document.addEventListener('pointerdown', e => {
    if (state.open && !e.target.closest('#gml-panel, #gml-chip')) closePanel();
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });
  window.addEventListener('resize', positionPanel);
  window.addEventListener('scroll', positionPanel, true);

  /* ───────────────────────── перетаскивание ───────────────────────── */

  function addElement(z) {
    if (state.brewing) return;
    if (state.slots.length >= MAX_SLOTS) {
      ui.slots.classList.remove('gml-shake'); void ui.slots.offsetWidth; ui.slots.classList.add('gml-shake');
      return;
    }
    state.slots.push(z);
    renderLab();
  }

  function onTileDown(e) {
    if (state.brewing || e.button !== 0) return;
    const z = +e.currentTarget.dataset.z;
    const sx = e.clientX, sy = e.clientY;
    let ghost = null;
    const move = ev => {
      if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 4) {
        ghost = h('div', { class: 'gml-ghost', style: `--c:${elColor(z)}` }, SYM[z - 1]);
        document.body.append(ghost);
      }
      if (ghost) {
        ghost.style.left = ev.clientX + 'px';
        ghost.style.top = ev.clientY + 'px';
        ui.lab.classList.toggle('drag-over', overLab(ev));
      }
    };
    const up = ev => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      ui.lab?.classList.remove('drag-over');
      if (!ghost) { addElement(z); return; }
      if (overLab(ev)) { ghost.remove(); addElement(z); }
      else {
        ghost.animate([{ opacity: 1 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(.3)' }], 180)
          .onfinish = () => ghost.remove();
      }
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }
  function overLab(ev) {
    const r = ui.lab.getBoundingClientRect();
    return ev.clientX >= r.left - 8 && ev.clientX <= r.right + 8 && ev.clientY >= r.top - 14 && ev.clientY <= r.bottom + 8;
  }

  /* ───────────────────────── реакция ───────────────────────── */

  // Синтез: атомные номера складываются, получается элемент Z = сумма.
  // Модель выбирается та, чей элемент ближе всего к результату. Нагрев = уровень рассуждений.
  function react(items, heat) {
    const sum = items.reduce((a, z) => a + z, 0);
    const hot = items.filter(isRadioactive).length;
    const pool = knownModels().filter(m => m.z);
    const free = pool.filter(m => !m.locked);
    const near = list => list.slice().sort((a, b) => Math.abs(a.z - sum) - Math.abs(b.z - sum) || a.z - b.z)[0];
    const exact = pool.find(m => m.z === sum);
    // Все элементы одинаковые, а сумма — не модель: берём модель самого этого элемента (6×Ne → Neon)
    const same = items.every(z => z === items[0]) ? pool.find(m => m.z === items[0]) : null;
    if (!exact && same) return same.locked ? { sum, locked: same, same: true } : { sum, model: same, same: true };
    if (heat === 3 && (sum > 118 || hot >= 2)) return { boom: true, sum };
    if (sum > 118) return { fizzle: true, sum };
    if (exact && exact.locked) return { sum, locked: exact };
    return { sum, model: near(free) || near(pool) };
  }

  const HEAT_RU = ['', 'Низкий', 'Средний', 'Высокий'];

  async function brew() {
    if (state.brewing) return;
    if (!state.slots.length) {
      ui.flask.classList.remove('gml-shake'); void ui.flask.offsetWidth; ui.flask.classList.add('gml-shake');
      ui.hint.textContent = 'Колба пустая — сначала добавь элементы';
      return;
    }
    const res = react(state.slots, state.heat);
    state.brewing = true;
    ui.brew.textContent = 'Brewing…';
    ui.brew.disabled = true;
    ui.hint.textContent = 'Идёт синтез…';
    renderLab();

    const dur = 1200 + state.heat * 450;
    await sleep(dur * 0.55);
    if (res.boom) {
      ui.liquid.setAttribute('fill', '#c6f24a');
      ui.flask.style.setProperty('--glow', '#c6f24a');
      ui.flask.classList.add('gml-critical');
    } else if (res.model) ui.liquid.setAttribute('fill', elColor(res.model.z));
    else ui.liquid.setAttribute('fill', '#555');
    await sleep(dur * 0.45);

    if (res.boom) return explode();

    const product = res.same ? `чистый ${NAMES[res.model ? res.model.z - 1 : res.locked.z - 1]} ×${state.slots.length}`
      : res.sum <= 118 ? `${SYM[res.sum - 1]} (${NAMES[res.sum - 1]}, ${res.sum})` : `ядро ${res.sum}`;
    if (res.fizzle) {
      ui.hint.textContent = `Σ = ${res.sum}: такого элемента нет, ядро тут же развалилось. Без сильного нагрева не синтезировать…`;
    } else if (res.locked) {
      ui.hint.textContent = res.same
        ? `Чистый ${NAMES[res.locked.z - 1]} — это модель «${res.locked.label}», но она закрыта (нужна подписка) 🔒`
        : `Получился ${product} — это модель «${res.locked.label}», но она закрыта (нужна подписка) 🔒`;
    } else {
      const m = res.model;
      const r = await applyToGemini(m.z, state.heat);
      if (r.ok) {
        state.cur = { z: m.z, name: NAMES[m.z - 1] };
        GM_setValue('gml_cur', state.cur);
        GM_setValue('gml_thinking', r.thinking || '');
      } else if (r.why === 'нет меню') {
        // меню не нашлось — хотя бы покажем результат
        state.cur = { z: m.z, name: NAMES[m.z - 1] };
        GM_setValue('gml_cur', state.cur);
      }
      refreshChip();
      showToast(m, r.thinking || HEAT_RU[state.heat]);
      const hit = res.same ? '' : m.z === res.sum ? ' Точное попадание! 🎯' : ` → ближайшая модель ${m.name}`;
      ui.hint.textContent = r.ok
        ? `Синтез: ${product}.${hit} Рассуждения: ${r.thinking || '—'}`
        : r.why === 'нет меню'
          ? `Синтез: ${product}.${hit} (настоящее меню моделей не найдено)`
          : `Синтез: ${product}, но выбрать модель не вышло (${r.why})`;
    }

    // слить колбу
    state.slots = [];
    state.brewing = false;
    ui.brew.textContent = 'Brew';
    ui.brew.disabled = false;
    await sleep(500);
    renderLab();
  }

  function showToast(m, sub) {
    const c = elColor(m.z);
    const r = chip.getBoundingClientRect();
    const t = h('div', { class: 'gml-toast', style: `--c:${c}` },
      h('div', { class: 'sym' }, SYM[m.z - 1]),
      h('div', {}, `Gemini · ${NAMES[m.z - 1]}`, h('small', {}, [m.label, sub].filter(Boolean).join(' · '))));
    document.body.append(t);
    const w = t.offsetWidth;
    t.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8)) + 'px';
    t.style.top = Math.max(8, r.top - t.offsetHeight - 10) + 'px';
    setTimeout(() => t.remove(), 2500);
  }

  /* ───────────────────────── ВЗРЫВ ───────────────────────── */

  async function explode() {
    // 1. спасаем текст пользователя — сразу, до всякой анимации
    const text = getInputText();
    try { GM_setClipboard(text, 'text'); } catch (_) {}
    try { await navigator.clipboard.writeText(text); } catch (_) {}
    GM_setValue('gml_last_boom', { text, at: Date.now() });

    await sleep(500);

    // 2. вспышка + тряска
    const flash = h('div', { class: 'gml-flash' });
    document.body.append(flash);
    document.documentElement.classList.add('gml-quake');

    // 3. осколки: все плитки и кнопки разлетаются
    const fr = ui.flask.getBoundingClientRect();
    const cx = fr.left + fr.width / 2, cy = fr.top + fr.height / 2;
    const parts = [...panel.querySelectorAll('.gml-tile, .gml-slot.filled, .gml-heat, .gml-brew, .gml-title b')];
    const debris = parts.map(el => {
      const r = el.getBoundingClientRect();
      const d = el.cloneNode(true);
      d.classList.add('gml-debris');
      Object.assign(d.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', margin: 0 });
      const ang = Math.atan2(r.top + r.height / 2 - cy, r.left + r.width / 2 - cx) + (Math.random() - .5) * .8;
      const sp = 9 + Math.random() * 22;
      return { d, x: 0, y: 0, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 10 - Math.random() * 8,
        rot: 0, vr: (Math.random() - .5) * 40, s: 1 + Math.random() * 1.4 };
    });
    debris.forEach(o => document.body.append(o.d));
    if (chip) chip.style.visibility = 'hidden';
    panel.remove(); panel = null;

    // 4. дым
    for (let i = 0; i < 16; i++) {
      const size = 160 + Math.random() * 260;
      const sm = h('div', { class: 'gml-smoke' });
      Object.assign(sm.style, {
        width: size + 'px', height: size + 'px',
        left: (cx + (Math.random() - .5) * innerWidth * .9 - size / 2) + 'px',
        top: (cy + (Math.random() - .7) * innerHeight * .8 - size / 2) + 'px',
        animationDelay: (Math.random() * .4) + 's',
      });
      document.body.append(sm);
    }

    // 5. физика осколков
    const t0 = performance.now();
    await new Promise(done => {
      const step = now => {
        for (const o of debris) {
          o.vy += 1.1; o.vx *= .99;
          o.x += o.vx; o.y += o.vy; o.rot += o.vr;
          o.d.style.transform = `translate(${o.x}px,${o.y}px) rotate(${o.rot}deg) scale(${o.s})`;
        }
        if (now - t0 < 2200) requestAnimationFrame(step); else done();
      };
      requestAnimationFrame(step);
    });

    // 6. закрыть вкладку
    try { window.close(); } catch (_) {}
    await sleep(500);

    // если браузер не дал закрыть — убираем последствия и сообщаем
    document.querySelectorAll('.gml-debris, .gml-smoke, .gml-flash').forEach(n => n.remove());
    document.documentElement.classList.remove('gml-quake');
    state.brewing = false; state.open = false; state.slots = [];
    if (chip) { chip.style.visibility = ''; chip.classList.remove('open'); refreshChip(); }
    const note = h('div', { class: 'gml-final' },
      '💥 Бабах! Текст из поля ввода скопирован в буфер.', h('br'),
      h('small', { style: 'color:#9aa0a6' }, 'Браузер не разрешил закрыть вкладку.'));
    document.body.append(note);
    setTimeout(() => note.remove(), 3500);
  }

  /* ───────────────────────── запуск ───────────────────────── */

  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; mountChip(); });
  }).observe(document.body, { childList: true, subtree: true });
  mountChip();
})();
