import type { AppType } from '@api/app';
import { hc } from 'hono/client';

let isRefreshing = false;
let refreshSubscribers: {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}[] = [];

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach(({ resolve }) => {
    resolve(token);
  });
  refreshSubscribers = [];
};

const onRefreshFailed = (error: Error) => {
  refreshSubscribers.forEach(({ reject }) => {
    reject(error);
  });
  refreshSubscribers = [];
};

const addRefreshSubscriber = (subscriber: {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}) => {
  refreshSubscribers.push(subscriber);
};

const clearAuthState = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
};

const redirectToLoginIfNeeded = () => {
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
};

const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const newInit: RequestInit = {
    ...init,
    headers: {
      ...init?.headers,
    },
  };

  const headers = newInit.headers as Record<string, string>;

  // 1. Attach tokens
  const accessToken = localStorage.getItem('access_token');
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  // 2. Make original request
  let response = await fetch(input, newInit);

  // 3. Handle 401 Unauthorized via Token Refresh
  const urlString = input.toString();
  if (
    response.status === 401 &&
    !urlString.includes('/auth/refresh') &&
    !urlString.includes('/auth/login')
  ) {
    if (!isRefreshing) {
      isRefreshing = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshRes.ok) {
            const data = (await refreshRes.json()) as {
              accessToken: string;
              refreshToken: string;
              user: { id: string; email: string };
            };
            localStorage.setItem('access_token', data.accessToken);
            localStorage.setItem('refresh_token', data.refreshToken);
            localStorage.setItem('user', JSON.stringify(data.user));
            onRefreshed(data.accessToken);

            headers.Authorization = `Bearer ${data.accessToken}`;
            response = await fetch(input, newInit);
          } else {
            const error = new Error('Failed to refresh token');
            clearAuthState();
            onRefreshFailed(error);
            redirectToLoginIfNeeded();
          }
        } catch (error) {
          clearAuthState();
          onRefreshFailed(error instanceof Error ? error : new Error('Failed to refresh token'));
          redirectToLoginIfNeeded();
        } finally {
          isRefreshing = false;
        }
      } else {
        const error = new Error('No refresh token available');
        clearAuthState();
        onRefreshFailed(error);
        redirectToLoginIfNeeded();
        isRefreshing = false;
      }
    } else {
      // Wait until the current refresh is done, then retry
      return new Promise((resolve, reject) => {
        addRefreshSubscriber({
          resolve: (newToken) => {
            headers.Authorization = `Bearer ${newToken}`;
            resolve(fetch(input, newInit));
          },
          reject,
        });
      });
    }
  }

  // 5. Optionally handle globally 429 Too Many Requests (Rate limit)
  if (response.status === 429) {
    // console.warn('Rate limit exceeded');
    // You could present a global toast here if configured
  }

  return response;
};

export const client = hc<AppType>('/api', {
  fetch: customFetch,
});
