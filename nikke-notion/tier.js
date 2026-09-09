(() => {
    const tierOrder = ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D', 'E', 'F'];
    const burstLabels = ['BURST I', 'BURST II', 'BURST III'];
    const descriptions = {
        story: '캠페인·타워의 25% 이상 전투력 적자 구간을 중심으로 평가하며, 다수전 성능에 보스 대응력을 일부 반영한 분류입니다.',
        bossing: '단일 보스와 소환물을 동반한 보스전에서의 종합 성능을 기준으로 한 분류입니다.',
        pvp: '아레나 전투에서의 버스트 생성, 생존력, 제압 능력과 조합 활용도를 기준으로 한 분류입니다.'
    };

    const state = { mode: 'story', burst: 'all', query: '' };
    const slugOverrides = {
        'Anis: Sparkling Summer': 'sparkling-summer-anis',
        'Anne: Miracle Fairy': 'miracle-fairy-anne',
        'Helm: Aquamarine': 'aqua-marine-helm',
        'Mary: Bay Goddess': 'bay-goddess-mary',
        'Neon: Blue Ocean': 'blue-ocean-neon',
        'Red Hood B1': 'red-hood',
        'Red Hood B2': 'red-hood',
        'Red Hood B3': 'red-hood',
        'Rupee: Winter Shopper': 'winter-shopper-rupee',
        'Snow White: Innocent Days': 'innocent-dayss-snow-white'
    };
    const list = document.getElementById('tier-list');
    const description = document.getElementById('mode-description');
    const resultCount = document.getElementById('result-count');

    function makeElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function filteredNames(names) {
        if (!state.query) return names;
        return names.filter(name => name.toLocaleLowerCase().includes(state.query));
    }

    function characterSlug(name) {
        return slugOverrides[name] || name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    function makeCharacterCard(name) {
        const slug = characterSlug(name);
        const card = makeElement('a', 'character-card');
        card.href = `https://www.prydwen.gg/nikke/characters/${slug}`;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
        card.setAttribute('aria-label', `${name} 캐릭터 정보`);

        const portrait = document.createElement('img');
        portrait.src = `https://cdn.prydwen.gg/images/nikke/characters/${slug}.webp`;
        portrait.alt = name;
        portrait.width = 80;
        portrait.height = 80;
        portrait.loading = 'lazy';
        portrait.decoding = 'async';
        portrait.referrerPolicy = 'no-referrer';
        portrait.addEventListener('error', () => card.classList.add('portrait-missing'));

        card.append(portrait, makeElement('span', 'character-name', name));
        return card;
    }

    function renderHeader(visibleBursts) {
        const header = makeElement('div', 'tier-header');
        header.append(makeElement('div', 'tier-header-spacer'));
        const columns = makeElement('div', 'tier-header-bursts');
        visibleBursts.forEach(index => columns.append(makeElement('span', '', burstLabels[index])));
        header.append(columns);
        return header;
    }

    function render() {
        const data = window.NIKKE_TIER_DATA[state.mode];
        const visibleBursts = state.burst === 'all' ? [0, 1, 2] : [Number(state.burst)];
        let visibleCharacters = 0;
        list.replaceChildren();
        list.classList.toggle('single-burst', visibleBursts.length === 1);
        list.append(renderHeader(visibleBursts));

        tierOrder.forEach(tier => {
            const burstGroups = visibleBursts.map(index => filteredNames(data[tier][index]));
            const rowCount = burstGroups.reduce((total, names) => total + names.length, 0);
            if (!rowCount && state.query) return;
            visibleCharacters += rowCount;

            const row = makeElement('article', `tier-row tier-${tier.toLowerCase()}`);
            row.append(makeElement('div', 'tier-rank', tier));
            const columns = makeElement('div', 'tier-columns');

            burstGroups.forEach((names, groupIndex) => {
                const burstIndex = visibleBursts[groupIndex];
                const section = document.createElement('section');
                section.append(makeElement('span', 'burst-mobile', burstLabels[burstIndex]));
                const characters = makeElement('div', 'character-list');
                if (names.length) {
                    names.forEach(name => characters.append(makeCharacterCard(name)));
                } else {
                    characters.append(makeElement('span', 'empty-burst', '해당 니케 없음'));
                }
                section.append(characters);
                columns.append(section);
            });

            row.append(columns);
            list.append(row);
        });

        if (!visibleCharacters) list.append(makeElement('p', 'tier-empty', '검색 결과가 없습니다.'));
        description.textContent = descriptions[state.mode];
        resultCount.textContent = `${visibleCharacters} CHARACTERS`;
    }

    document.querySelectorAll('.mode-button').forEach(button => {
        button.addEventListener('click', () => {
            state.mode = button.dataset.mode;
            document.querySelectorAll('.mode-button').forEach(item => {
                const active = item === button;
                item.classList.toggle('active', active);
                item.setAttribute('aria-selected', String(active));
            });
            render();
        });
    });

    document.querySelectorAll('.burst-button').forEach(button => {
        button.addEventListener('click', () => {
            state.burst = button.dataset.burst;
            document.querySelectorAll('.burst-button').forEach(item => item.classList.toggle('active', item === button));
            render();
        });
    });

    document.getElementById('tier-search').addEventListener('input', event => {
        state.query = event.target.value.trim().toLocaleLowerCase();
        render();
    });

    render();
})();
