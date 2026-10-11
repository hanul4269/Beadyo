/* Read only: the public SOOP board used by the official channel. */
(function (root) {
    'use strict';
    const BOARD_ID = '91491306';
    const boardUrl = `https://www.sooplive.com/station/beadyo97/board/${BOARD_ID}`;
    const apiUrl = `https://api-channel.sooplive.com/v1.1/channel/beadyo97/board?bbsNo=${BOARD_ID}&perPage=20&page=1`;
    function postedTime(value) {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return null;
        const date = new Date(value.replace(' ', 'T') + '+09:00');
        if (!Number.isFinite(date.getTime())) return null;
        const korean = new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
        return korean === value ? date.toISOString() : null;
    }
    function profileUrl(value) {
        try {
            const url = new URL(value);
            return url.protocol === 'https:' && url.hostname.endsWith('.sooplive.com') && !url.username && !url.password ? url.href : '';
        } catch { return ''; }
    }
    function latestNotice(payload, now = Date.now()) {
        if (!payload || !Array.isArray(payload.contents) || !Array.isArray(payload.noticeData) || payload.meta?.currentPage !== 1) {
            throw new Error('Invalid SOOP board response');
        }
        const rows = [...payload.noticeData, ...payload.contents];
        const notices = [];
        const seen = new Set();
        for (const row of rows) {
            if (!row || !/^[1-9]\d*$/.test(String(row.bbsNo)) || typeof row.userId !== 'string' || !Number.isInteger(row.authNo) || typeof row.isGeoblock !== 'boolean') {
                throw new Error('Invalid SOOP post visibility');
            }
            // Never show restricted posts, other boards, or other channel authors.
            if (String(row.bbsNo) !== BOARD_ID || row.userId !== 'beadyo97' || row.authNo !== 101 || row.isGeoblock !== false) continue;
            const id = String(row.titleNo);
            const postedAt = postedTime(row.regDate);
            if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) || typeof row.titleName !== 'string' || !row.titleName.trim() || !postedAt || Date.parse(postedAt) > now) {
                throw new Error('Invalid public SOOP notice');
            }
            if (seen.has(id)) continue;
            seen.add(id);
            notices.push({ id, title: row.titleName.trim(), author: typeof row.userNick === 'string' ? row.userNick : '',
                profile: profileUrl(row.profileImage), postedAt, href: `https://www.sooplive.com/station/beadyo97/post/${id}` });
        }
        // Pinned notices and regular posts are separate arrays; compare actual dates.
        return notices.sort((a, b) => b.postedAt.localeCompare(a.postedAt) || Number(b.id) - Number(a.id)).slice(0, 1);
    }
    async function read(fetchWithTimeout) {
        const response = await fetchWithTimeout(apiUrl, 6000, { credentials: 'omit', cache: 'no-store' });
        if (!response.ok) throw new Error('SOOP board unavailable');
        return latestNotice(await response.json());
    }
    const api = Object.freeze({ boardUrl, latestNotice, read });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.BeadyoHomeSoop = api;
})(typeof window !== 'undefined' ? window : globalThis);
