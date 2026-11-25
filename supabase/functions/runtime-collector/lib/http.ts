// Network helpers shared by the collectors. No cookies, no credentials for
// third-party hosts, no redirects, bounded time and size.

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export class CollectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CollectionError';
  }
}

export const MAX_BYTES = 2_000_000;
export const DEFAULT_TIMEOUT_MS = 15_000;

export interface ReadOptions {
  headers?: Record<string, string>;
  method?: string;
  body?: string;
  expectType?: string;
  timeoutMs?: number;
  maxBytes?: number;
  okStatuses?: number[];
}

export function mediaType(value: string | null): string {
  return (value || '').split(';')[0].trim().toLowerCase();
}

// Reads a response body as text. Any redirect, unexpected status, wrong
// content type, oversized body or timeout is an error.
export async function readText(fetchFn: FetchFn, url: string, options: ReadOptions = {}): Promise<{ status: number; text: string }> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? MAX_BYTES;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body,
      redirect: 'manual',
      credentials: 'omit',
      signal: controller.signal,
    });
    const allowed = options.okStatuses || [200];
    if (!allowed.includes(response.status)) {
      await response.body?.cancel().catch(() => {});
      throw new CollectionError(`Unexpected HTTP ${response.status}`);
    }
    if (options.expectType && mediaType(response.headers.get('content-type')) !== options.expectType) {
      await response.body?.cancel().catch(() => {});
      throw new CollectionError('Unexpected content type');
    }
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) {
      await response.body?.cancel().catch(() => {});
      throw new CollectionError('Response is too large');
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) throw new CollectionError('Response is too large');
    return { status: response.status, text: new TextDecoder('utf-8', { fatal: true }).decode(buffer) };
  } finally {
    clearTimeout(timer);
  }
}

export async function readJson(fetchFn: FetchFn, url: string, options: ReadOptions = {}): Promise<unknown> {
  const { text } = await readText(fetchFn, url, options);
  try {
    return JSON.parse(text);
  } catch {
    throw new CollectionError('Invalid JSON response');
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Matches Python's `%Y-%m-%dT%H:%M:%SZ` used by the original scripts.
export function utcSeconds(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
