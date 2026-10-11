/* Explicit reviewed content IDs only. No title matching at runtime.
   Editor selections are stored in the existing tags array; no schema change. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.BeadyoContentSeries = api;
})(typeof window === 'object' ? window : globalThis, function () {
    'use strict';
    const registry = [{"id": "guquiz", "name": "구퀴즈"}, {"id": "hasuk", "name": "하숙하숙해"}, {"id": "radio2", "name": "떼굴라디오2"}];
    const reviewed = {
    "7d229888-8b90-47b4-a77e-62884257b821": {
        "series_id": "guquiz",
        "episode_number": null
    },
    "45258d67-d619-467f-8329-6ad9d14d645e": {
        "series_id": "guquiz",
        "episode_number": null
    },
    "689abb45-816d-425e-8715-0340859fb3cf": {
        "series_id": "guquiz",
        "episode_number": null
    },
    "db6c075d-6dd5-4c27-b003-1064d1c81491": {
        "series_id": "guquiz",
        "episode_number": null
    },
    "46a08ec8-0bd2-419d-b142-09a24cfb7afd": {
        "series_id": "guquiz",
        "episode_number": null
    },
    "8c4a84a9-ae2d-43ba-92f7-a157e7da58a0": {
        "series_id": "guquiz",
        "episode_number": null
    },
    "0512e673-e075-4078-bf8f-676c99bb3954": {
        "series_id": "guquiz",
        "episode_number": null
    },
    "e7744d3c-595f-4db3-8374-61848733859d": {
        "series_id": "guquiz",
        "episode_number": null
    },
    "26b207ed-83f7-4be5-b07a-adfca8cc9155": {
        "series_id": "guquiz",
        "episode_number": null
    },
    "050cc766-e8a9-4180-ac2d-9c3aab7d55f9": {
        "series_id": "guquiz",
        "episode_number": null
    },
    "e5408a66-de3a-4434-ad2b-52683757154c": {
        "series_id": "radio2",
        "episode_number": null
    },
    "82967ca1-1d5b-4c5c-b4fc-f1171c544670": {
        "series_id": "guquiz",
        "episode_number": null
    },
    "6b7712f3-60f8-4683-8148-9685099e0954": {
        "series_id": "radio2",
        "episode_number": null
    },
    "f852a0cf-ac98-4c3e-878a-9b11d6382cd2": {
        "series_id": "radio2",
        "episode_number": null
    },
    "178c480e-efff-4969-9adc-442a86aa4e95": {
        "series_id": "radio2",
        "episode_number": null
    },
    "73c2917b-e9fd-4a87-a660-4651e29dac69": {
        "series_id": "radio2",
        "episode_number": null
    },
    "240b01d3-c6b1-4aa7-ab7e-0fd8206c1fc2": {
        "series_id": "hasuk",
        "episode_number": 1
    },
    "bdae2fe4-3e5b-4792-a41c-8ffe23f1e8d5": {
        "series_id": "hasuk",
        "episode_number": 2
    },
    "5f18d844-1048-4488-9fb5-be12c60dddf4": {
        "series_id": "hasuk",
        "episode_number": 3
    },
    "67d0da27-44d6-42d7-a2ba-786f7308df94": {
        "series_id": "guquiz",
        "episode_number": null
    }
};
    const seriesPrefix = 'beadyo-series:', episodePrefix = 'beadyo-episode:';
    function isMetadata(tag) { return typeof tag === 'string' && (tag.startsWith(seriesPrefix) || tag.startsWith(episodePrefix)); }
    function normalize(row) {
        const tags = Array.isArray(row.tags) ? row.tags : [];
        const explicit = tags.find(tag => typeof tag === 'string' && tag.startsWith(seriesPrefix));
        const baseline = reviewed[row.id] || {};
        const id = explicit ? explicit.slice(seriesPrefix.length) : baseline.series_id;
        const series_id = registry.some(s => s.id === id) ? id : '';
        const raw = tags.find(tag => typeof tag === 'string' && tag.startsWith(episodePrefix));
        const n = explicit ? (raw ? Number(raw.slice(episodePrefix.length)) : NaN) : baseline.episode_number;
        return { series_id, episode_number: series_id && Number.isInteger(n) && n > 0 && n <= 9999 ? n : null };
    }
    function encode(tags, id, episode) {
        const result = (tags || []).filter(tag => !isMetadata(tag));
        result.push(seriesPrefix + (registry.some(s => s.id === id) ? id : 'none'));
        if (id && Number.isInteger(episode) && episode > 0 && episode <= 9999) result.push(episodePrefix + episode);
        return result;
    }
    function name(id) { return registry.find(s => s.id === id)?.name || ''; }
    function sortEpisodes(rows) {
        return rows.slice().sort((a, b) => {
            const aNumber = a.episode_number, bNumber = b.episode_number;
            if (aNumber != null && bNumber != null && aNumber !== bNumber) return aNumber - bNumber;
            if ((aNumber != null) !== (bNumber != null)) return aNumber != null ? -1 : 1;
            return a.broadcast_date.localeCompare(b.broadcast_date) || a.id.localeCompare(b.id);
        });
    }
    return Object.freeze({ registry, reviewed, normalize, encode, name, sortEpisodes, isMetadata });
});
