const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness(initial = null, blocked = false) {
    const events = {}, writes = [];
    const document = { documentElement: { dataset: {}, style: {} } };
    const localStorage = {
        getItem: () => { if (blocked) throw Error('Storage blocked'); return initial; },
        setItem: (key, value) => { if (blocked) throw Error('Storage blocked'); writes.push({ key, value }); },
    };
    const parent = {};
    const window = { parent, addEventListener: (name, handler) => { events[name] = handler; } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../site-theme.js'), 'utf8'), { document, localStorage, window, location: { origin: 'http://localhost:3000' }, Object });
    return { root: document.documentElement, events, writes, parent, localStorage };
}

test('standalone pages apply the saved theme before rendering and fall back safely without storage', () => {
    const dark = harness('dark');
    assert.equal(dark.root.dataset.theme, 'dark');
    assert.equal(dark.root.style.colorScheme, 'dark');
    for (const h of [harness(), harness('invalid'), harness('dark', true)]) {
        assert.equal(h.root.dataset.theme, 'light');
        assert.equal(h.root.style.colorScheme, 'light');
    }
});

test('theme changes in other tabs synchronize while unrelated storage stays untouched', () => {
    const h = harness('dark');
    h.events.storage({ key: 'unrelated', newValue: 'light' });
    assert.equal(h.root.dataset.theme, 'dark');
    h.events.storage({ key: 'beadyo:theme', newValue: 'light', storageArea: h.localStorage });
    assert.equal(h.root.dataset.theme, 'light');
    h.events.storage({ key: 'beadyo:theme', newValue: 'dark', storageArea: {} });
    assert.equal(h.root.dataset.theme, 'light');
    h.events.storage({ key: 'beadyo:theme', newValue: 'dark' });
    assert.equal(h.root.dataset.theme, 'dark');
    h.events.storage({ key: null, newValue: null });
    assert.equal(h.root.dataset.theme, 'light');
});

test('only the same-origin parent can synchronize and persist an embedded page theme', () => {
    const h = harness();
    const message = { source: h.parent, origin: 'http://localhost:3000', data: { type: 'beadyo-theme-sync', theme: 'dark' } };
    h.events.message({ ...message, origin: 'https://example.com' });
    h.events.message({ ...message, source: {} });
    assert.equal(h.root.dataset.theme, 'light');
    assert.equal(h.writes.length, 0);
    h.events.message(message);
    assert.equal(h.root.dataset.theme, 'dark');
    assert.deepEqual(h.writes, [{ key: 'beadyo:theme', value: 'dark' }]);
});

test('guide and dance review load the theme before their styles and have scoped dark palettes', () => {
    const tokens = fs.readFileSync(require.resolve('../tokens.css'), 'utf8');
    for (const page of ['guide', 'dance-archive']) {
        const source = fs.readFileSync(require.resolve('../' + page + '.html'), 'utf8');
        const theme = source.search(/src="site-theme\.js\?v=[^"]+"/);
        const style = source.indexOf('href="tokens.css');
        assert.ok(theme > 0 && theme < style);
        const selector = `html[data-page="${page}"][data-theme="dark"] {`;
        const start = tokens.indexOf(selector);
        assert.ok(start >= 0);
        const block = tokens.slice(start, tokens.indexOf('}', start));
        assert.match(block, /--surface: #192119;/);
        assert.match(block, /--bg: #11170f;/);
    }
    const guide = fs.readFileSync(require.resolve('../guide.html'), 'utf8');
    assert.match(guide, /href="heading-font\.css\?v=[^"]+"/);
    assert.match(guide, /h1 \{\s*font-family: var\(--heading-font\);/);
});
