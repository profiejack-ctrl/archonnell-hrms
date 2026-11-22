/**
 * Low-level HTTP client for Archon Nell Core HRMS.
 *
 * - Decoupled from legacy PHP scripts and rewires directly to the Central Backend Gateway.
 * - All queries and mutations route through Central API Gateway (/api/v1/hrms/bridge).
 * - Carries Universal JWT Bearer token from localStorage for seamless cross-subdomain SSO.
 * - Supports CSRF token compatibility and inactivity timeout tracking.
 */

/** Primary backend plus an optional fallback (for example, local then cloud). */
export const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined) || 'https://api.archonnellincorporated.com/api/v1/hrms';
const API_FALLBACK_BASE: string = (import.meta.env.VITE_API_FALLBACK_URL as string | undefined) || '';
// HRMS auth actions (state/login/verify/logout/me) are implemented by the
// HRMS compatibility bridge, not the central REST /auth routes.
const hrmsBridgeBase = (url: string) => url.replace(/\/api\/v1\/auth\/?$/, '/api/v1/hrms');
export const AUTH_BASE: string = hrmsBridgeBase((import.meta.env.VITE_AUTH_URL as string | undefined) || API_BASE);
const AUTH_FALLBACK_BASE: string = hrmsBridgeBase((import.meta.env.VITE_AUTH_FALLBACK_URL as string | undefined) || API_FALLBACK_BASE);
export const GATEWAY_BASE: string = (import.meta.env.VITE_GATEWAY_URL as string | undefined) || 'https://api.archonnellincorporated.com';

/** URL of a backend file or stored upload (e.g. "uploads/announcements/x.jpg"). */
export function backendUrl(path: string): string {
    if (/^(https?:|data:|blob:)/i.test(path)) return path;
    return `${GATEWAY_BASE}/${path.replace(/^\/+/, '')}`;
}

let csrfToken = 'archon_central_csrf_token';
export function setCsrfToken(token: string): void { csrfToken = token || 'archon_central_csrf_token'; }
export function getCsrfToken(): string { return csrfToken; }

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void { onUnauthorized = handler; }

export class ApiError extends Error {
    status: number;
    data: Record<string, unknown>;
    constructor(message: string, status: number, data: Record<string, unknown> = {}) {
        super(message);
        this.status = status;
        this.data = data;
    }
}

export type Fields = Record<string, string | number | boolean | null | undefined | Array<string | number>>;

function toBody(fields: Fields): URLSearchParams {
    const body = new URLSearchParams();
    Object.entries(fields).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (Array.isArray(value)) value.forEach(v => body.append(`${key}[]`, String(v)));
        else body.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
    });
    return body;
}

async function parse<T>(response: Response, notify401: boolean): Promise<T> {
    if (response.status === 401 && notify401 && onUnauthorized) onUnauthorized();
    const text = await response.text();
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(text);
    } catch {
        throw new ApiError(`Server returned invalid response (${response.status} ${response.statusText || 'Error'})`, response.status);
    }
    if (!response.ok || (data.success !== undefined && !data.success)) {
        throw new ApiError(String(data.message || (data.error as { message?: string })?.message || 'Request failed'), response.status, data);
    }
    return data as T;
}

/** Retry a second backend only when the primary is unavailable or returns a server error.
 * Authentication and validation errors are returned directly, so invalid credentials
 * never cause an unexpected login attempt against another environment.
 */
async function requestWithFallback<T>(primaryUrl: string, fallbackUrl: string, init: RequestInit, notify401: boolean): Promise<T> {
    let response: Response;
    try {
        response = await fetch(primaryUrl, init);
    } catch (error) {
        if (!fallbackUrl || fallbackUrl === primaryUrl) throw error;
        response = await fetch(fallbackUrl, init);
        return parse<T>(response, notify401);
    }

    if (fallbackUrl && fallbackUrl !== primaryUrl && response.status >= 500) {
        // Release the primary response body before trying the fallback.
        await response.body?.cancel();
        response = await fetch(fallbackUrl, init);
    }
    return parse<T>(response, notify401);
}

export interface GetOptions { passive?: boolean; notify401?: boolean }

/** GET request routed through Central HRMS Bridge */
export async function httpGet<T>(file: string, action: string, params: Record<string, string | number> = {}, opts: GetOptions = {}): Promise<T> {
    const qs = new URLSearchParams({ action, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
    const token = localStorage.getItem('archon_token') || '';

    const base = file === 'auth-api.php' ? AUTH_BASE : API_BASE;
    const fallbackBase = file === 'auth-api.php' ? AUTH_FALLBACK_BASE : API_FALLBACK_BASE;
    const suffix = `/bridge?${qs.toString()}`;
    return requestWithFallback(`${base}${suffix}`, fallbackBase ? `${fallbackBase}${suffix}` : '', {
        headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(opts.passive ? { 'X-Session-Passive': '1' } : {})
        },
        credentials: 'include',
        cache: 'no-store',
    }, opts.notify401 ?? true);
}

/** POST request routed through Central HRMS Bridge */
export async function httpPost<T>(file: string, action: string, fields: Fields = {}, opts: { notify401?: boolean } = {}): Promise<T> {
    const token = localStorage.getItem('archon_token') || '';

    const bodyFields = { action, csrf_token: csrfToken, ...fields };
    const requestBody = () => toBody(bodyFields);
    const base = file === 'auth-api.php' ? AUTH_BASE : API_BASE;
    const fallbackBase = file === 'auth-api.php' ? AUTH_FALLBACK_BASE : API_FALLBACK_BASE;
    const suffix = '/bridge';
    return requestWithFallback(`${base}${suffix}`, fallbackBase ? `${fallbackBase}${suffix}` : '', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRF-Token': csrfToken,
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: requestBody(),
    }, opts.notify401 ?? true);
}

/** multipart/form-data upload routed through Central Gateway */
export async function httpUpload<T>(_file: string, fields: Record<string, string | Blob>): Promise<T> {
    const token = localStorage.getItem('archon_token') || '';

    const makeFormData = () => {
        const fd = new FormData();
        fd.append('csrf_token', csrfToken);
        Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
        return fd;
    };
    const suffix = '/bridge';
    return requestWithFallback(`${API_BASE}${suffix}`, API_FALLBACK_BASE ? `${API_FALLBACK_BASE}${suffix}` : '', {
        method: 'POST',
        body: makeFormData(),
        headers: {
            'X-CSRF-Token': csrfToken,
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        credentials: 'include',
    }, true);
}

/** Shortcuts for the main HRMS API */
export const api = {
    get: <T>(action: string, params: Record<string, string | number> = {}, opts: GetOptions = {}) => httpGet<T>('api.php', action, params, opts),
    post: <T>(action: string, fields: Fields = {}) => httpPost<T>('api.php', action, fields),
};
