(function (global) {
    'use strict';

    if (global.BeadyoCommon) return;

    const SUPABASE_URL = 'https://qlmcwobfldgmhwhptkfz.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_jMhCscf87Dtt38Wk_ASKrw_dRtQExSR';
    const OWNER_EMAIL = 'riosniper12@gmail.com';
    const ALLOWED_MESSAGE_ORIGINS = new Set([
        'https://beadyo.com',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ]);

    let supabaseClient = null;

    function getSupabaseClient(options = {}) {
        if (supabaseClient) return supabaseClient;
        if (!global.supabase?.createClient) {
            throw new Error('supabase.min.js must be loaded before beadyo-common.js');
        }
        supabaseClient = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, options);
        return supabaseClient;
    }

    function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        }[character]));
    }

    function safeUrl(value, fallback = '#', allowRelative = false) {
        const raw = String(value ?? '').trim();
        if (!raw) return fallback;
        try {
            const url = allowRelative ? new URL(raw, global.location.href) : new URL(raw);
            return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : fallback;
        } catch {
            return fallback;
        }
    }

    function safeImageUrl(value, fallback = '') {
        return safeUrl(value, fallback);
    }

    async function fetchWithTimeout(url, ms, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ms);
        try {
            return await fetch(url, { ...options, signal: controller.signal });
        } finally {
            clearTimeout(timeoutId);
        }
    }

    function allowedMessageOrigin(origin) {
        return origin === global.location.origin || ALLOWED_MESSAGE_ORIGINS.has(origin);
    }

    const api = Object.freeze({
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        OWNER_EMAIL,
        getSupabaseClient,
        esc,
        safeUrl,
        safeImageUrl,
        fetchWithTimeout,
        allowedMessageOrigin,
    });

    Object.defineProperties(global, {
        BeadyoCommon: { value: api, enumerable: true, configurable: true },
        SUPABASE_URL: { value: SUPABASE_URL, configurable: true },
        SUPABASE_ANON_KEY: { value: SUPABASE_ANON_KEY, configurable: true },
        OWNER_EMAIL: { value: OWNER_EMAIL, configurable: true },
        getBeadyoSupabaseClient: { value: getSupabaseClient, configurable: true },
        esc: { value: esc, configurable: true },
        safeUrl: { value: safeUrl, configurable: true },
        safeImageUrl: { value: safeImageUrl, configurable: true },
        fetchWithTimeout: { value: fetchWithTimeout, configurable: true },
        beadyoAllowedMessageOrigin: { value: allowedMessageOrigin, configurable: true },
    });
})(window);
