(() => {
    'use strict';
    const data = window.NIKKE_GROWTH_GUIDE || { characters: [] };
    const characters = data.characters || data.rows || [];
    const state = { query: '', burst: 'all' };
    const rows = document.getElementById('growth-rows');
    const count = document.getElementById('growth-count');
    const empty = document.getElementById('growth-empty');
    const collator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });
    let heightFrame = 0;

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }
    function normalize(text) {
        return String(text || '').normalize('NFKC').toLocaleLowerCase().replace(/[\s:·ㆍ()（）\-]/g, '');
    }
    function bursts(character) {
        const value = character.burst;
        return [...new Set((Array.isArray(value) ? value.join(' ') : String(value || '')).match(/[123]/g) || [])];
    }
    function lines(value) {
        if (Array.isArray(value)) return value.filter(Boolean).map(String);
        if (value && typeof value === 'object') return Object.entries(value).map(([key, text]) => key + ': ' + text);
        return String(value || '').split(/\n/).filter(Boolean);
    }
    function formatLine(text, label) {
        let result = text.replace(/\s*→\s*/g, ' → ').replace(/:\s*/g, ': ');
        if (label === '오버로드') {
            const optionNames = '우월 코드|공격력|장탄|명중|방어력|차지 속도|차지 피해|크리티컬 확률|크리티컬 피해|크리티컬';
            const counts = new RegExp('(' + optionNames + ')\\s*(최소|최대)?\\s*(\\d+(?:~\\d+)?)(?=\\s|[·+,;(]|$|\\.(?:\\s|$))', 'g');
            result = result.replace(counts, (_match, option, limit, number) => option + ' ' + (limit ? limit + ' ' : '') + number + '줄');
            result = result.replace(new RegExp('(' + optionNames + ')(?=\\d)', 'g'), '$1 ');
            result = result.replace(/\s*·\s*/g, ' · ').replace(/\s*\+\s*/g, ' + ');
        }
        return result;
    }
    function reportHeight() {
        cancelAnimationFrame(heightFrame);
        heightFrame = requestAnimationFrame(() => {
            if (window.parent === window) return;
            window.parent.postMessage({
                type: 'nikke:notion-height',
                path: window.location.pathname,
                height: Math.ceil(document.querySelector('.archive-shell').getBoundingClientRect().bottom)
            }, window.location.origin);
        });
    }
    function renderValue(value, label) {
        const cell = element('td', 'guide-value');
        cell.setAttribute('role', 'cell');
        cell.append(element('span', 'mobile-cell-label', label));
        const copy = element('div', 'guide-copy');
        const values = lines(value).flatMap(text => {
            const budget = label === '스킬작' && text.match(/^(.*?)\s*\(가성비\s*([\d/]+)\)$/);
            return budget ? [budget[1], '가성비: ' + budget[2]] : [text];
        });
        (values.length ? values : ['권장 수치 미제시']).forEach((text, index) => {
            const missing = /^(권장 (?:수치|세팅|옵션) 미제시|자료 미확인|미제시|미확인|—)$/.test(text);
            copy.append(element('p', 'guide-line ' + (missing ? 'guide-missing' : index ? 'guide-secondary' : 'guide-primary'), formatLine(text, label)));
        });
        cell.append(copy);
        return cell;
    }
    function makeRow(character) {
        const row = element('tr');
        row.setAttribute('role', 'row');
        row.dataset.character = character.id;
        const cell = element('th', 'character-cell');
        cell.scope = 'row';
        cell.setAttribute('role', 'rowheader');
        const main = element('div', 'character-main');
        const portrait = element('div', 'character-portrait');
        const img = document.createElement('img');
        img.alt = '';
        img.width = 58;
        img.height = 58;
        img.loading = 'lazy';
        img.decoding = 'async';
        if (character.image) img.src = character.image;
        else portrait.classList.add('missing');
        img.addEventListener('error', () => portrait.classList.add('missing'), { once: true });
        img.addEventListener('load', reportHeight, { once: true });
        portrait.append(img, element('span', 'portrait-fallback', (character.name || 'N').slice(0, 1)));
        const identity = element('div', 'character-identity');
        identity.append(element('h2', 'character-name', character.name));
        const badges = element('div', 'character-badges');
        const burstValues = bursts(character);
        if (burstValues.length) badges.append(element('span', 'character-badge', 'BURST ' + burstValues.map(v => ['','I','II','III'][v]).join(' · ')));
        if (/애장품/.test(character.variant || '')) badges.append(element('span', 'character-badge favorite', character.variant));
        identity.append(badges);
        main.append(portrait, identity);
        cell.append(main);
        const notes = lines(character.notes);
        const sources = (character.references || []).filter(source => {
            try { return ['https:', 'http:'].includes(new URL(source.url).protocol); }
            catch (_) { return false; }
        });
        if (notes.length || sources.length) {
            const details = element('details', 'guide-notes');
            details.append(element('summary', '', '운용·참고'));
            notes.forEach(note => details.append(element('p', '', note)));
            if (sources.length) {
                const references = element('p', 'guide-references');
                references.append(document.createTextNode('참고: '));
                sources.forEach((source, index) => {
                    if (index) references.append(document.createTextNode(' · '));
                    const link = element('a', '', source.label);
                    link.href = source.url;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    if (source.title) link.title = source.title;
                    references.append(link);
                });
                details.append(references);
            }
            details.addEventListener('toggle', reportHeight);
            cell.append(details);
        }
        row.append(cell, renderValue(character.skills, '스킬작'), renderValue(character.overload, '오버로드'));
        return row;
    }
    function render() {
        const query = normalize(state.query);
        const visible = characters.filter(character => {
            const search = normalize([character.name, character.variant, ...(character.aliases || [])].join(' '));
            return (!query || search.includes(query)) && (state.burst === 'all' || bursts(character).includes(state.burst));
        }).sort((a, b) => collator.compare(a.name, b.name) || collator.compare(a.variant || '', b.variant || ''));
        rows.replaceChildren(...visible.map(makeRow));
        count.textContent = visible.length + '명';
        empty.hidden = visible.length > 0;
        reportHeight();
    }
    document.getElementById('growth-search').addEventListener('input', event => {
        state.query = event.target.value;
        render();
    });
    document.querySelectorAll('.burst-filter').forEach(button => button.addEventListener('click', () => {
        state.burst = button.dataset.burst;
        document.querySelectorAll('.burst-filter').forEach(item => {
            const active = item === button;
            item.classList.toggle('active', active);
            item.setAttribute('aria-pressed', String(active));
        });
        render();
    }));
    window.addEventListener('load', reportHeight);
    window.addEventListener('resize', reportHeight);
    new ResizeObserver(reportHeight).observe(document.querySelector('.archive-shell'));
    render();
})();
