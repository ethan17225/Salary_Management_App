import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { env } from '@/lib/env';
import type { PaydayState } from '@/types/payday';

const FALLBACK_URLS = Array.from(
  new Set([env.BACKEND_URL, 'http://127.0.0.1:8001', 'http://127.0.0.1:8000'])
);

async function fetchBackend(path: string, init?: RequestInit): Promise<Response> {
  let lastError: unknown;
  const urls = process.env.BACKEND_URL ? [env.BACKEND_URL] : FALLBACK_URLS;

  for (const baseUrl of urls) {
    try {
      const res = await fetch(`${baseUrl}/api/${path}`, {
        ...init,
        cache: 'no-store',
      });
      if (res.status === 404 && !process.env.BACKEND_URL && baseUrl !== urls.at(-1)) {
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not reach the Payday backend');
}

export async function verifySession(): Promise<{ authenticated: true }> {
  await headers();
  return { authenticated: true };
}

export const db = {
  getState: cache(async (): Promise<PaydayState> => {
    const res = await fetchBackend('state');
    if (!res.ok) {
      throw new Error(`Failed to fetch Payday state (${res.status})`);
    }
    return res.json() as Promise<PaydayState>;
  }),

  async request<T = Record<string, unknown>>(
    method: 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const res = await fetchBackend(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      throw new Error(payload.error || `Request failed (${res.status})`);
    }
    return payload;
  },

  async proxy(path: string, req: Request): Promise<Response> {
    return fetchBackend(path, {
      method: req.method,
      headers: req.headers.get('content-type')
        ? { 'content-type': req.headers.get('content-type')! }
        : {},
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text(),
    });
  },
};

