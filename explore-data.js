(function (global, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else global.BeadyoExploreData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const menus = Object.freeze([
        { index: 7, route: 'home', label: 'HOME', description: '방송 상태, 가까운 일정과 새 콘텐츠를 한눈에' },
        { index: 0, route: 'calendar', label: 'CALENDAR', description: '날짜별 방송 일정, 방송정보와 다시보기' },
        { index: 1, route: 'schedule', label: 'SCHEDULE', hidden: true, description: '외부 Google 스프레드시트로 보는 월별 편성표' },
        { index: 2, route: 'songbook', label: 'SONGBOOK', description: '신청 가능한 노래를 검색하고 즐겨찾기에 저장' },
        { index: 3, route: 'live', label: 'LIVE RECORD', description: '방송에서 부른 곡, 부른 날짜와 등록된 클립' },
        { index: 4, route: 'music', label: 'MUSIC', description: '오리지널·커버·라이브 영상과 음악 시리즈' },
        { index: 5, route: 'content', label: 'CONTENT', description: '기획 방송의 출연자, 상세 기록과 다시보기' },
        { index: 6, route: 'games', label: 'GAME', description: '기존 팬 게임을 골라 즐기는 공간' },
    ]);
    function safeUrl(value) {
        try {
            const url = new URL(String(value || '').trim());
            return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
        } catch { return ''; }
    }
    function mediaKey(value) {
        const safe = safeUrl(value);
        if (!safe) return '';
        const url = new URL(safe);
        const host = url.hostname.toLowerCase();
        let id = '';
        if (host === 'youtu.be') id = url.pathname.split('/')[1];
        else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
            id = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)(?:\/|$)/)?.[1];
        } else if (['vod.sooplive.com', 'vod.sooplive.co.kr', 'vod.afreecatv.com'].includes(host)) {
            const vodId = url.pathname.match(/^\/player\/(\d+)(?:\/|$)/)?.[1];
            return vodId ? `soop:${vodId}` : '';
        }
        return /^[\w-]{11}$/.test(id || '') ? `youtube:${id}` : '';
    }
    function validDate(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '';
        const date = new Date(`${value}T00:00:00Z`);
        return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : '';
    }
    function songsForClip(value, songs) {
        const key = mediaKey(value);
        return key ? (songs || []).filter(song => mediaKey(song.clip_url) === key) : [];
    }
    function songMedia(song) {
        return new Set([song?.clip_url, song?.mr_url].map(mediaKey).filter(Boolean));
    }
    function musicForSong(song, music) {
        const keys = songMedia(song);
        return (music || []).filter(row => keys.has(mediaKey(row.youtube_url)));
    }
    function liveForSong(song, live) {
        const key = mediaKey(song?.clip_url);
        return key ? (live || []).filter(row => mediaKey(row.clip_url) === key) : [];
    }
    function contentForMedia(urls, content) {
        const keys = new Set((urls || []).map(mediaKey).filter(Boolean));
        return (content || []).filter(row => (row.replays || []).some(replay =>
            replay.status === '정상' && keys.has(mediaKey(replay.url))));
    }
    return Object.freeze({ menus, safeUrl, mediaKey, validDate, songsForClip, musicForSong, liveForSong, contentForMedia });
});
