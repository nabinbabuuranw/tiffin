// Thin JSON client. Errors carry the API's closed code (for example "date_locked") for the message table.
export class ApiError extends Error {
  status: number;
  code: string;
  extra: Record<string, any>;
  constructor(status: number, code: string, extra: Record<string, any> = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 20000);
  try {
    const init: RequestInit = { method, credentials: 'same-origin', signal: ctrl.signal, headers: {} };
    if (body !== undefined) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify(body);
    }
    const res = await fetch(path, init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data.error || 'request_failed', data);
    return data as T;
  } catch (e: any) {
    if (e instanceof ApiError) throw e;
    if (e?.name === 'AbortError') throw new ApiError(0, 'timeout');
    throw new ApiError(0, 'network');
  } finally {
    window.clearTimeout(timer);
  }
}

export const get = <T = any>(p: string) => api<T>('GET', p);
export const post = <T = any>(p: string, b?: unknown) => api<T>('POST', p, b ?? {});
export const put = <T = any>(p: string, b?: unknown) => api<T>('PUT', p, b ?? {});
export const patch = <T = any>(p: string, b?: unknown) => api<T>('PATCH', p, b ?? {});
export const del = <T = any>(p: string, b?: unknown) => api<T>('DELETE', p, b ?? {});
