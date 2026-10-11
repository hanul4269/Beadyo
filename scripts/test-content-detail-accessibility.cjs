const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync(require.resolve('../content.js'), 'utf8');
function between(start, end) {
    return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
}

function focusHarness(layerId = 'detail-layer') {
    const document = { activeElement: null };
    const button = name => ({ name, offsetParent: {}, hidden: false, focus() { document.activeElement = this; } });
    const first = button('close'), middle = button('episode'), last = button('share');
    const modal = { contains: target => [modal, first, middle, last].includes(target) };
    const openLayer = {
        id: layerId, hidden: false,
        querySelectorAll: () => [first, middle, last], querySelector: () => modal,
    };
    const $ = selector => selector === '#' + layerId ? openLayer : { hidden: true };
    let closed = '';
    const handler = new Function('$', 'document', 'closeForm', 'closeDetail',
        between('    function handleKeydown(event)', '    function bindEvents()') + '; return handleKeydown;'
    )($, document, () => { closed = 'form'; }, () => { closed = 'detail'; });
    const press = (active, shiftKey = false, key = 'Tab') => {
        document.activeElement = active;
        let prevented = false;
        handler({ key, shiftKey, preventDefault() { prevented = true; } });
        return { active: document.activeElement, prevented };
    };
    return { first, middle, last, modal, press, closed: () => closed };
}

for (const layer of ['detail-layer', 'form-layer']) {
    test(`${layer} keeps initial forward and reverse Tab focus inside the modal`, () => {
        const h = focusHarness(layer);
        const forward = h.press(h.modal);
        assert.equal(forward.prevented, true);
        assert.equal(forward.active, h.first);
        const reverse = h.press(h.modal, true);
        assert.equal(reverse.prevented, true);
        assert.equal(reverse.active, h.last);
        assert.equal(h.press({ name: 'background card' }).active, h.first);
        assert.equal(h.press({ name: 'background card' }, true).active, h.last);
    });
    test(`${layer} wraps boundary focus while preserving ordinary navigation and Escape`, () => {
        const h = focusHarness(layer);
        assert.equal(h.press(h.first, true).active, h.last);
        assert.equal(h.press(h.last).active, h.first);
        assert.equal(h.press(h.middle).prevented, false);
        assert.equal(h.press(h.middle, true).prevented, false);
        assert.equal(h.press(h.middle, false, 'Escape').prevented, true);
        assert.equal(h.closed(), layer === 'form-layer' ? 'form' : 'detail');
    });
}

test('content date links use only valid activity dates and omit absent or damaged dates', () => {
    const window = {
        BeadyoExploreData: require('../explore-data.js'),
        BeadyoExplore: { localLink: (url, label) => `<a href="${url}">${label}</a>` },
    };
    const markup = new Function('window',
        between('    function dateRelatedMarkup(item)', '    function replayMarkup(replay)') + '; return dateRelatedMarkup;'
    )(window);
    assert.match(markup({ broadcast_date: '2024-02-29' }), /calendar\.html\?date=2024-02-29/);
    for (const value of ['', null, undefined, '날짜 미상', '2026-02-30', '2026-13-01', '2026-10-01T00:00:00Z']) {
        assert.equal(markup({ broadcast_date: value }), '');
    }
    assert.ok(source.includes('${dateRelatedMarkup(item)}'));
});
