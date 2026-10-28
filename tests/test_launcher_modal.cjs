'use strict';
// Exercise the actual launcher event handlers. Layout/browser accessibility is
// checked separately; this fixture covers recovery ownership and input state.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.LAUNCHER_HTML || path.join(root, 'index.html'), 'utf8');
const backup = fs.readFileSync(process.env.LAUNCHER_BACKUP || path.join(root, 'launcher_backup.js'), 'utf8');
const start = html.indexOf('      // Global Save Backup Modal');
const end = html.indexOf('      renderGenreTags();', start);
assert.ok(start >= 0 && end > start, 'production modal handler block must be present');
const modalSource = html.slice(start, end);
const a = 'arcade_game_001_save', b = 'arcade_game_002_save';
const encode = value => btoa(unescape(encodeURIComponent(JSON.stringify(value))));
const decode = value => JSON.parse(decodeURIComponent(escape(atob(value))));

function harness(initial = {[a]: 'ORIGINAL', [b]: 'PRIOR'}, clipboard) {
  const values = new Map(Object.entries(initial));
  const nodes = new Map(), windowHandlers = new Map();
  const background = [{inert: false}, {inert: false}, {inert: false}];
  let writes = 0, fail = () => false;
  const document = {activeElement: null, getElementById: element, querySelectorAll: () => background};
  function element(id) {
    if (nodes.has(id)) return nodes.get(id);
    const tag = html.match(new RegExp('<[^>]+id="' + id + '"[^>]*>'))?.[0];
    assert.ok(tag, 'actual markup must contain ' + id);
    const classes = new Set();
    const node = {id, value: '', textContent: '', disabled: false, hidden: /\bhidden\b/.test(tag), isConnected: true,
      handlers: new Map(), classList: {add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name)},
      addEventListener(type, handler) { this.handlers.set(type, handler); },
      focus() { document.activeElement = this; }, select() { this.selected = true; },
      querySelectorAll() {
        const markup = html.slice(html.indexOf('<div class="modal-backdrop"'), html.indexOf('<footer>'));
        return [...markup.matchAll(/<(?:textarea|button)\b[^>]*\bid="([^"]+)"/g)].map(match => element(match[1]));
      }};
    nodes.set(id, node);
    return node;
  }
  const storage = {get length() {return values.size;}, key: i => [...values.keys()][i] ?? null,
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem(key, value) {if (fail(++writes, key)) throw Error('storage unavailable'); values.set(key, value);},
    removeItem(key) {if (fail(++writes, key)) throw Error('storage unavailable'); values.delete(key);}};
  const context = {document, localStorage: storage, navigator: clipboard ? {clipboard} : {},
    atob, btoa, escape, unescape, renderGames() {},
    addEventListener(type, handler) {windowHandlers.set(type, handler);}};
  context.window = context;
  vm.createContext(context);
  vm.runInContext(backup, context, {filename: 'launcher_backup.js'});
  vm.runInContext(modalSource, context, {filename: 'index.html modal handlers'});
  function event(extra = {}) {
    return {prevented: false, preventDefault() {this.prevented = true;}, ...extra};
  }
  return {element, values, background, document, get writes() {return writes;}, setFailure(fn) {fail = fn;},
    click(id) {return element(id).handlers.get('click')();},
    import(value) {element('backup-textarea').value = encode(value); this.click('import-bundle-btn');},
    unload() {const e = event(); windowHandlers.get('beforeunload')?.(e); return e;},
    key(key, shiftKey = false) {const e = event({key, shiftKey}); element('backup-modal').handlers.get('keydown')(e); return e;},
    status() {return element('backup-status').textContent;},
    recovery() {this.click('recovery-bundle-btn'); return decode(element('backup-textarea').value);}};
}

test('incomplete restore blocks repeated import/export without discarding original recovery bytes', () => {
  const h = harness();
  h.setFailure(n => n >= 2);
  h.import({[a]: 'IMPORTED', [b]: 'NEXT'});
  assert.equal(h.values.get(a), 'IMPORTED', 'fixture must actually leave partial changed storage');
  assert.equal(h.element('import-bundle-btn').disabled, true);
  assert.equal(h.element('export-bundle-btn').disabled, true);
  const count = h.writes;
  h.import({[a]: 'SECOND', [b]: 'OTHER'}); // Also exercises the handler guard against queued actions.
  h.click('export-bundle-btn');
  assert.equal(h.writes, count, 'blocked actions cannot touch storage');
  assert.deepEqual(h.recovery(), {[a]: 'ORIGINAL', [b]: 'PRIOR'});
  assert.match(h.status(), /Recovery is incomplete/);
});

test('closing and reopening preserves original recovery instead of exporting partially changed saves', () => {
  const h = harness();
  h.element('backup-modal-btn').focus();
  h.click('backup-modal-btn');
  h.setFailure(n => n >= 2);
  h.import({[a]: 'IMPORTED', [b]: 'NEXT'});
  h.click('close-modal-btn');
  assert.equal(h.document.activeElement, h.element('backup-modal-btn'));
  h.click('backup-modal-btn');
  assert.deepEqual(decode(h.element('backup-textarea').value), {[a]: 'ORIGINAL', [b]: 'PRIOR'});
  assert.equal(h.element('import-bundle-btn').disabled, true);
  assert.ok(h.background.every(node => node.inert));
});

test('repeated recovery failure retains earliest bytes; verified recovery re-enables import', () => {
  const h = harness();
  h.setFailure(n => n >= 2);
  h.import({[a]: 'IMPORTED', [b]: 'NEXT'});
  for (let attempt = 0; attempt < 2; attempt++) {
    h.click('retry-recovery-btn');
    assert.deepEqual(h.recovery(), {[a]: 'ORIGINAL', [b]: 'PRIOR'});
    assert.equal(h.element('import-bundle-btn').disabled, true);
    assert.equal(h.unload().prevented, true);
  }
  h.setFailure(() => false);
  h.click('retry-recovery-btn');
  assert.deepEqual(Object.fromEntries(h.values), {[a]: 'ORIGINAL', [b]: 'PRIOR'});
  assert.equal(h.element('import-bundle-btn').disabled, false);
  assert.equal(h.element('export-bundle-btn').disabled, false);
  assert.equal(h.element('recovery-bundle-btn').hidden, true);
  assert.equal(h.element('retry-recovery-btn').hidden, true);
  assert.equal(h.unload().prevented, false);
  assert.match(h.status(), /restored and verified/);
  h.import({[a]: 'NEXT VALID SAVE'});
  assert.equal(h.values.get(a), 'NEXT VALID SAVE');
});

test('recovery removes originally absent keys and warns before unload only while unresolved', () => {
  const h = harness({[b]: 'PRIOR'});
  assert.equal(h.unload().prevented, false);
  h.setFailure(n => n >= 2);
  h.import({[a]: 'CREATED', [b]: 'NEXT'});
  assert.equal(h.values.get(a), 'CREATED', 'fixture leaves a newly created key after failed rollback');
  assert.equal(h.unload().prevented, true);
  h.setFailure(() => false);
  h.click('retry-recovery-btn');
  assert.equal(h.values.has(a), false);
  assert.equal(h.values.get(b), 'PRIOR');
  assert.equal(h.unload().prevented, false);
});

test('modal wraps keyboard focus and Escape restores the opener and background', () => {
  const h = harness();
  const opener = h.element('backup-modal-btn');
  opener.focus(); h.click('backup-modal-btn');
  assert.equal(h.document.activeElement, h.element('backup-textarea'));
  assert.equal(h.key('Tab', true).prevented, true);
  assert.equal(h.document.activeElement, h.element('close-modal-btn'));
  assert.equal(h.key('Tab').prevented, true);
  assert.equal(h.document.activeElement, h.element('backup-textarea'));
  assert.equal(h.key('Escape').prevented, true);
  assert.equal(h.element('backup-modal').classList.contains('open'), false);
  assert.equal(h.document.activeElement, opener);
  assert.ok(h.background.every(node => !node.inert));
});

test('late clipboard success cannot replace an incomplete-recovery warning', async () => {
  let resolve;
  const h = harness(undefined, {writeText: () => new Promise(done => {resolve = done;})});
  const copying = h.click('export-bundle-btn');
  h.setFailure(n => n >= 2);
  h.import({[a]: 'IMPORTED', [b]: 'NEXT'});
  h.recovery();
  resolve(); await copying;
  assert.match(h.status(), /Recovery is incomplete/);
  assert.deepEqual(decode(h.element('backup-textarea').value), {[a]: 'ORIGINAL', [b]: 'PRIOR'});
});

test('valid multibyte saves round-trip through actual export and import budgets', async () => {
  const original = {[a]: '雪'.repeat(1200000), [b]: '雪'.repeat(1200000)};
  const source = harness(original);
  await source.click('export-bundle-btn');
  assert.match(source.status(), /Exported 2 game save/);
  const encoded = source.element('backup-textarea').value;
  assert.ok(encoded.length > 8000000, 'regression exceeds the former inconsistent import limit');
  const target = harness({});
  target.element('backup-textarea').value = encoded;
  target.click('import-bundle-btn');
  assert.match(target.status(), /Successfully restored and verified 2/);
  assert.deepEqual(Object.fromEntries(target.values), original);
});
