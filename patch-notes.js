(function () {
    const PATCH_NOTES_URL = 'patch-notes.json';

    let patchNotesCache = null;
    let patchNotesPromise = null;

    function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
        );
    }

    function renderStatus(board, message) {
        if (!board) return;
        board.innerHTML = `<div class="patch-note-day patch-note-status">${esc(message)}</div>`;
    }

    function normalizePatchNotes(data) {
        if (!data || !Array.isArray(data.notes)) {
            throw new Error('patch-notes.json 형식이 올바르지 않습니다.');
        }
        const notes = data.notes
            .filter(note => note && note.date && note.tag && Array.isArray(note.items))
            .map(note => ({
                date: String(note.date),
                tag: String(note.tag),
                items: note.items.filter(Boolean).map(String),
            }))
            .filter(note => note.items.length);

        return {
            rangeLabel: data.rangeLabel || '최근 2개월 주요 변경점',
            updatedAt: data.updatedAt || notes[0]?.date || '',
            notes,
        };
    }

    async function loadPatchNotes() {
        if (patchNotesCache) return patchNotesCache;
        if (!patchNotesPromise) {
            patchNotesPromise = fetch(PATCH_NOTES_URL, { cache: 'no-store' })
                .then(response => {
                    if (!response.ok) throw new Error(`패치노트 로드 실패 (${response.status})`);
                    return response.json();
                })
                .then(normalizePatchNotes);
        }
        patchNotesCache = await patchNotesPromise;
        return patchNotesCache;
    }

    function renderPatchNotesData(data) {
        document.querySelectorAll('[data-patch-notes-meta]').forEach(meta => {
            const basis = data.updatedAt
                ? `기준: ${data.updatedAt} · 자동 데이터 갱신 제외`
                : '자동 데이터 갱신 제외';
            meta.innerHTML = `<span>${esc(data.rangeLabel)}</span><span>${esc(basis)}</span>`;
        });

        document.querySelectorAll('[data-patch-notes-board]').forEach(board => {
            if (!data.notes.length) {
                renderStatus(board, '등록된 패치노트가 없습니다.');
                return;
            }
            board.innerHTML = data.notes.map(note => `
                <article class="patch-note-day">
                    <div class="patch-note-head">
                        <span class="patch-note-date">${esc(note.date)}</span>
                        <span class="patch-note-tag">${esc(note.tag)}</span>
                    </div>
                    <ul class="patch-note-list">
                        ${note.items.map(item => `<li>${esc(item)}</li>`).join('')}
                    </ul>
                </article>
            `).join('');
        });
    }

    async function renderAllPatchNotes() {
        const boards = document.querySelectorAll('[data-patch-notes-board]');
        if (!boards.length) return;
        boards.forEach(board => renderStatus(board, '패치노트를 불러오는 중...'));
        try {
            renderPatchNotesData(await loadPatchNotes());
        } catch (error) {
            console.error('renderPatchNotes:', error);
            boards.forEach(board => renderStatus(board, '패치노트를 불러오지 못했습니다.'));
        }
    }

    window.PatchNotes = {
        load: loadPatchNotes,
        renderAll: renderAllPatchNotes,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderAllPatchNotes, { once: true });
    } else {
        renderAllPatchNotes();
    }
})();
