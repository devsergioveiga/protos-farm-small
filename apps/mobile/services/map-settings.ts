import * as SecureStore from 'expo-secure-store';

const CACHE_LIMIT_KEY = 'protos_map_cache_limit_mb';
const DEFAULT_CACHE_LIMIT_MB = 200;
const MIN_CACHE_LIMIT_MB = 50;
const MAX_CACHE_LIMIT_MB = 500;

export const CACHE_LIMIT_OPTIONS = [50, 100, 200, 300, 500] as const;

export async function getMapCacheLimitMB(): Promise<number> {
  const stored = await SecureStore.getItemAsync(CACHE_LIMIT_KEY);
  if (!stored) return DEFAULT_CACHE_LIMIT_MB;
  const value = parseInt(stored, 10);
  if (isNaN(value) || value < MIN_CACHE_LIMIT_MB || value > MAX_CACHE_LIMIT_MB) {
    return DEFAULT_CACHE_LIMIT_MB;
  }
  return value;
}

export async function setMapCacheLimitMB(limitMB: number): Promise<void> {
  const clamped = Math.max(MIN_CACHE_LIMIT_MB, Math.min(MAX_CACHE_LIMIT_MB, limitMB));
  await SecureStore.setItemAsync(CACHE_LIMIT_KEY, String(clamped));
}
