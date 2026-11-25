// BEADYO 서비스 워커: 개발요청 웹 푸시 알림 전용.
// fetch 핸들러가 없으므로 페이지 로딩·캐시에는 관여하지 않는다.
const DEFAULT_URL = '/development-requests.html';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
    const title = typeof data.title === 'string' && data.title ? data.title : '새 개발요청';
    const url = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : DEFAULT_URL;
    event.waitUntil(self.registration.showNotification(title, {
        body: typeof data.body === 'string' ? data.body : '개발요청란에 새 글이 올라왔어요.',
        tag: typeof data.tag === 'string' ? data.tag : undefined,
        icon: '/pwa-icon-192.png',
        badge: '/pwa-icon-192.png',
        data: { url },
    }));
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const target = new URL(event.notification.data?.url || DEFAULT_URL, self.location.origin).href;
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of windows) {
            if (client.url === target && 'focus' in client) return client.focus();
        }
        for (const client of windows) {
            if ('navigate' in client && 'focus' in client) {
                try {
                    await client.navigate(target);
                    return client.focus();
                } catch { /* 제어하지 않는 창은 이동할 수 없음 → 새 창 */ }
            }
        }
        return self.clients.openWindow(target);
    })());
});
