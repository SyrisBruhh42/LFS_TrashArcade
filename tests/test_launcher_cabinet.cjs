'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const backup = fs.readFileSync(path.join(root, 'launcher_backup.js'), 'utf8');
const scriptMatch = html.match(/<script>\s*(\(function \(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/);
assert.ok(scriptMatch, 'cabinet inline script must be present');

function createHarness() {
  const storageValues = new Map([
    ['arcade_game_085_085-scrap-heist-retrieval_v1', JSON.stringify({ highScore: 1450, totalGamesPlayed: 4 })]
  ]);
  const cachedUrls = new Set();
  const nodes = new Map();
  let drawCalls = 0;
  let aegisReturned = false;

  const ctx2d = {
    createLinearGradient: () => ({ addColorStop() {} }),
    fillRect() { drawCalls++; },
    strokeRect() { drawCalls++; },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() { drawCalls++; },
    fill() { drawCalls++; },
    arc() {},
    closePath() {}
  };

  function makeNode(id) {
    const classes = new Set();
    const attrs = new Map([['data-handed', 'right']]);
    const handlers = new Map();
    return {
      id,
      value: '',
      textContent: '',
      innerHTML: '',
      href: '',
      hidden: false,
      disabled: false,
      width: 640,
      height: 320,
      isConnected: true,
      children: [],
      handlers,
      style: { setProperty() {} },
      classList: {
        add: c => classes.add(c),
        remove: c => classes.delete(c),
        contains: c => classes.has(c)
      },
      setAttribute(k, v) { attrs.set(k, String(v)); },
      getAttribute(k) { return attrs.get(k) || null; },
      addEventListener(type, fn) { handlers.set(type, fn); },
      appendChild(child) { this.children.push(child); return child; },
      getContext() { return ctx2d; },
      focus() {},
      select() {},
      scrollIntoView() {},
      querySelectorAll() { return []; }
    };
  }

  const documentElement = makeNode('html');
  const document = {
    hidden: false,
    activeElement: null,
    documentElement,
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, makeNode(id));
      return nodes.get(id);
    },
    createElement(tag) {
      return makeNode(tag + '-' + Math.random().toString(36).slice(2, 7));
    },
    querySelectorAll() { return []; }
  };

  const localStorage = {
    get length() { return storageValues.size; },
    key: i => [...storageValues.keys()][i] ?? null,
    getItem: k => (storageValues.has(k) ? storageValues.get(k) : null),
    setItem: (k, v) => storageValues.set(k, String(v)),
    removeItem: k => storageValues.delete(k)
  };

  const caches = {
    async open() {
      return {
        async put(url) { cachedUrls.add(url); },
        async delete(url) { cachedUrls.delete(url); return true; }
      };
    }
  };

  const fetch = async url => ({
    ok: true,
    async text() { return '<!doctype html><script defer src="game.js"></script><link rel="stylesheet" href="style.css">'; },
    clone() { return this; },
    async arrayBuffer() { return new ArrayBuffer(12000); }
  });

  const registry = [
    {
      id: '084',
      slug: '084-echo-forge-fusion',
      title: 'Volcanic Forge World Stealth/Line-of-Sight Heist 084',
      genre: 'Stealth/Line-of-Sight Heist',
      coreMechanic: 'Echo/Ghost Self-Cooperation',
      setting: 'Volcanic Forge World',
      description: 'Stealth echo heist preview',
      controls: 'WASD / Touch',
      accentColor: '#ff6b4a',
      phase: '7',
      path: './games/084-echo-forge-fusion/index.html'
    },
    {
      id: '085',
      slug: '085-scrap-heist-retrieval',
      title: 'Junkyard Robot Scrapheap Stealth/Line-of-Sight Heist 085',
      genre: 'Stealth/Line-of-Sight Heist',
      coreMechanic: 'Limited Ammo Must Be Physically Retrieved',
      setting: 'Junkyard Robot Scrapheap',
      description: 'Scrap heist retrieval preview',
      controls: 'WASD / Touch + Dash',
      accentColor: '#00f0ff',
      phase: '4',
      path: './games/085-scrap-heist-retrieval/index.html'
    }
  ];

  const context = {
    document,
    localStorage,
    caches,
    fetch,
    ArrayBuffer,
    performance: { now: () => 2400 },
    navigator: {},
    history: { length: 2, back() {} },
    AegisBridge: { returnToDeck() { aegisReturned = true; } },
    ARCADE_REGISTRY: registry,
    atob,
    btoa,
    escape,
    unescape,
    addEventListener() {}
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(backup, context);
  vm.runInContext(scriptMatch[1], context);

  return {
    context,
    document,
    storageValues,
    cachedUrls,
    get drawCalls() { return drawCalls; },
    get aegisReturned() { return aegisReturned; },
    el: id => document.getElementById(id)
  };
}

test('cabinet renders animated demo preview without installing the library by default', () => {
  const h = createHarness();
  assert.ok(h.drawCalls > 0, 'cabinet demo canvas must render procedural attract-mode preview frames');
  assert.equal(h.el('cabinet-game-title').textContent, 'Junkyard Robot Scrapheap Stealth/Line-of-Sight Heist 085');
  assert.match(h.el('cabinet-install-badge').textContent, /Preview Only \(Not Installed\)/);
  assert.equal(h.el('stat-installed-games').textContent, '0 Installed');
  assert.equal(h.el('cabinet-install-btn').hidden, false);
  assert.equal(h.el('cabinet-uninstall-btn').hidden, true);
});

test('on-demand per-game install caches module offline and uninstall preserves save data', async () => {
  const h = createHarness();
  const game = h.context.ARCADE_REGISTRY[1];
  assert.equal(h.context.ArcadeInstaller.isInstalled(game), false);

  await h.el('cabinet-install-btn').handlers.get('click')();
  assert.equal(h.context.ArcadeInstaller.isInstalled(game), true);
  assert.ok(h.cachedUrls.has('./games/085-scrap-heist-retrieval/game.js'));
  assert.equal(h.el('stat-installed-games').textContent, '1 Installed');
  assert.equal(h.el('cabinet-install-btn').hidden, true);
  assert.equal(h.el('cabinet-uninstall-btn').hidden, false);
  assert.equal(h.el('cabinet-launch-btn').textContent, 'Launch Installed Game');

  // Uninstall removes module cache while keeping arcade_game_* save intact
  await h.el('cabinet-uninstall-btn').handlers.get('click')();
  assert.equal(h.context.ArcadeInstaller.isInstalled(game), false);
  assert.equal(h.el('stat-installed-games').textContent, '0 Installed');
  assert.ok(h.storageValues.has('arcade_game_085_085-scrap-heist-retrieval_v1'), 'player save must survive module uninstall');
});

test('handedness toggle, reduced-motion comfort sync, and Aegis deck return bridge work', () => {
  const h = createHarness();
  assert.equal(h.document.documentElement.getAttribute('data-handed'), 'right');
  h.el('handedness-btn').handlers.get('click')();
  assert.equal(h.document.documentElement.getAttribute('data-handed'), 'left');
  assert.equal(h.el('handedness-btn').textContent, 'Hand: Left');

  h.el('motion-toggle-btn').handlers.get('click')();
  assert.equal(h.storageValues.get('aegis_comfort_reduced_motion'), 'true');
  assert.equal(h.el('motion-toggle-btn').getAttribute('aria-pressed'), 'true');

  h.el('back-to-aegis-btn').handlers.get('click')();
  assert.equal(h.aegisReturned, true);
});
