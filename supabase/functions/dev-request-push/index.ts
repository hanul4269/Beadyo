// dev-request-push: development_requests INSERT 트리거(pg_net) → 이 함수 → 웹 푸시.
//
// Deploy with JWT verification OFF (verify_jwt = false). The trigger only
// sends a request id; each request is pushed at most once (push log primary
// key) and only within 10 minutes of creation, so public calls cannot spam.
// `{"test": true}` requires the caller's own login token and owner status.
//
// Function secrets (set in the Dashboard, never committed):
//   VAPID_PUBLIC_KEY   same value as PUSH_PUBLIC_KEY in development-requests.html
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT      e.g. https://beadyo.com
//   DISCORD_WEBHOOK_URL  optional; same alert (with a 200-char preview) to a Discord channel
// Injected by Supabase: SUPABASE_URL, SUPABASE_SECRET_KEYS / SUPABASE_SERVICE_ROLE_KEY,
// SUPABASE_PUBLISHABLE_KEYS / SUPABASE_ANON_KEY.
import webpush from 'npm:web-push@3.6.7';
import { handle, isDiscordWebhook, type DiscordFn, type PushPayload, type Subscription } from './lib/handler.ts';
import { createStore } from './lib/store.ts';

function pickKey(jsonEnv: string, legacyEnv: string): string {
  const keys = Deno.env.get(jsonEnv);
  if (keys) {
    try {
      const parsed = JSON.parse(keys);
      const value = parsed?.default ?? Object.values(parsed ?? {})[0];
      if (typeof value === 'string' && value) return value;
    } catch { /* fall back to the legacy variable */ }
  }
  return Deno.env.get(legacyEnv) || '';
}

const vapid = {
  subject: Deno.env.get('VAPID_SUBJECT') || 'https://beadyo.com',
  publicKey: Deno.env.get('VAPID_PUBLIC_KEY') || '',
  privateKey: Deno.env.get('VAPID_PRIVATE_KEY') || '',
};

async function send(subscription: Subscription, payload: PushPayload): Promise<number> {
  if (!vapid.publicKey || !vapid.privateKey) throw new Error('VAPID keys are not configured');
  const details = webpush.generateRequestDetails(
    { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_secret } },
    JSON.stringify(payload),
    { vapidDetails: vapid, TTL: 24 * 60 * 60, urgency: 'high' },
  );
  const response = await fetch(details.endpoint, {
    method: details.method,
    headers: details.headers as Record<string, string>,
    body: details.body ? new Uint8Array(details.body) : undefined,
  });
  await response.body?.cancel();
  return response.status;
}

const discordWebhook = (Deno.env.get('DISCORD_WEBHOOK_URL') || '').trim();
if (discordWebhook && !isDiscordWebhook(discordWebhook)) console.log('DISCORD_WEBHOOK_URL is not a Discord webhook URL; Discord is off');

const discord: DiscordFn | undefined = discordWebhook && isDiscordWebhook(discordWebhook)
  ? async message => {
    const response = await fetch(discordWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    await response.body?.cancel();
    return response.status;
  }
  : undefined;

Deno.serve(request => handle(request, {
  discord,
  store: () => createStore(
    fetch,
    Deno.env.get('SUPABASE_URL') || '',
    pickKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'),
    pickKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'),
  ),
  send,
  log: message => console.log(message),
  allowedOrigins: ['https://beadyo.com', 'https://www.beadyo.com', 'http://localhost:3000'],
}));
