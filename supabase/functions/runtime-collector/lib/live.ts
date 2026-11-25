// Port of .github/scripts/check_live.py: SOOP station → {live, title, updated}.
// Any request or validation failure throws, so nothing is saved.
import { type FetchFn, CollectionError, isPlainObject, readJson, utcSeconds } from './http.ts';

export const STATION_URL = 'https://chapi.sooplive.co.kr/api/beadyo97/station';
const STATION_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
  Origin: 'https://www.sooplive.co.kr',
  Referer: 'https://www.sooplive.co.kr/',
};

export interface LivePayload {
  live: boolean;
  title: string;
  updated: string;
}

export function parseStation(data: unknown): { live: boolean; title: string } {
  if (!isPlainObject(data) || !isPlainObject(data.station) || data.station.user_id !== 'beadyo97' || !('broad' in data)) {
    throw new CollectionError('Invalid station response');
  }
  const broad = data.broad;
  if (broad === null) return { live: false, title: '' };
  if (!isPlainObject(broad) || !/^[1-9]\d*$/.test(String(broad.broad_no)) || typeof broad.broad_no === 'boolean' ||
      typeof broad.broad_title !== 'string') {
    throw new CollectionError('Invalid broadcast response');
  }
  return { live: true, title: broad.broad_title.trim() };
}

export async function collectLive(fetchFn: FetchFn, now: Date = new Date()): Promise<LivePayload> {
  const data = await readJson(fetchFn, STATION_URL, { headers: STATION_HEADERS, timeoutMs: 10_000 });
  return { ...parseStation(data), updated: utcSeconds(now) };
}
