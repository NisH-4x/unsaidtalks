import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/auth.store';
import { CurrentUser } from '../types/user';

export interface SessionResponse {
  accessToken: string;
  user: CurrentUser;
}

export const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) config.headers.set('Authorization', `Bearer ${accessToken}`);
  return config;
});

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Exchanges the refresh cookie for a new access token. Concurrent callers share one
 * request, because the server rotates the cookie and a second parallel refresh would
 * present an already-used token.
 */
export function refreshSession(): Promise<string | null> {
  refreshInFlight ??= axios
    .post<SessionResponse>('/api/auth/refresh', undefined, { withCredentials: true })
    .then(({ data }) => {
      useAuthStore.getState().setSession(data.accessToken, data.user);
      return data.accessToken;
    })
    .catch(() => {
      useAuthStore.getState().clearSession();
      return null;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

const retriedRequests = new WeakSet<AxiosRequestConfig>();

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const request = error.config;
  const isAuthEndpoint = request?.url?.startsWith('/auth/');

  if (
    error.response?.status !== 401 ||
    !request ||
    isAuthEndpoint ||
    retriedRequests.has(request)
  ) {
    throw error;
  }

  retriedRequests.add(request);
  const accessToken = await refreshSession();
  if (!accessToken) throw error;
  return api(request);
});
