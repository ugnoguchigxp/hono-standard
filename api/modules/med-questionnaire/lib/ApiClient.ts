import { logger } from '@api/lib/logger';

export interface ApiClientConfig {
  baseURL?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  params?: Record<string, string | number | boolean | undefined>;
  responseType?: 'json' | 'text' | 'stream';
  validateStatus?: (status: number) => boolean;
}

export class ApiClientError extends Error {
  status?: number;
  statusText?: string;
  data?: any;
  code?: string;

  constructor(
    message: string,
    options: { status?: number; statusText?: string; data?: any; code?: string }
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = options.status;
    this.statusText = options.statusText;
    this.data = options.data;
    this.code = options.code;
  }
}

export class ApiClient {
  private baseURL: string;
  private headers: Record<string, string>;
  private timeout: number;
  private retries: number;
  private retryDelay: number;
  public interceptors = {
    request: {
      use: (onSuccess: (config: any) => any, onError?: (error: any) => any) => {
        this.requestInterceptors.push({ onSuccess, onError });
      },
    },
    response: {
      use: (onSuccess: (response: any) => any, onError?: (error: any) => any) => {
        this.responseInterceptors.push({ onSuccess, onError });
      },
    },
  };

  private requestInterceptors: Array<{
    onSuccess: (config: any) => any;
    onError?: (error: any) => any;
  }> = [];
  private responseInterceptors: Array<{
    onSuccess: (response: any) => any;
    onError?: (error: any) => any;
  }> = [];

  constructor(config: ApiClientConfig = {}) {
    this.baseURL = (config.baseURL || '').replace(/\/$/, '');
    this.headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...config.headers,
    };
    this.timeout = config.timeout || 30000;
    this.retries = config.retries || 0;
    this.retryDelay = config.retryDelay || 1000;
  }

  public setHeaders(headers: Record<string, string>) {
    this.headers = { ...this.headers, ...headers };
  }

  private async request<T>(
    method: string,
    url: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<{ data: T; status: number; statusText: string; headers: Headers }> {
    let config = {
      method,
      url,
      data,
      headers: { ...this.headers, ...options.headers },
      params: options.params,
      timeout: options.timeout || this.timeout,
      responseType: options.responseType || 'json',
      validateStatus: options.validateStatus,
    };

    // Request Interceptors
    for (const interceptor of this.requestInterceptors) {
      try {
        config = await interceptor.onSuccess(config);
      } catch (error) {
        if (interceptor.onError) {
          return interceptor.onError(error);
        }
        throw error;
      }
    }

    const fullUrl = this.buildUrl(config.url, config.params);
    let lastError: any;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      try {
        const fetchOptions: RequestInit = {
          method: config.method,
          headers: config.headers,
          body: config.data
            ? config.data instanceof URLSearchParams || config.data instanceof FormData
              ? config.data
              : JSON.stringify(config.data)
            : undefined,
          signal: controller.signal,
        };

        const response = await fetch(fullUrl, fetchOptions);
        clearTimeout(timeoutId);

        let responseData: any;
        if (config.responseType === 'stream') {
          responseData = response.body;
        } else if (config.responseType === 'text') {
          responseData = await response.text();
        } else {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            try {
              responseData = await response.json();
            } catch (_e) {
              responseData = await response.text();
            }
          } else {
            responseData = await response.text();
          }
        }

        let result = {
          data: responseData as T,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          config,
        };

        // Response Interceptors
        for (const interceptor of this.responseInterceptors) {
          try {
            result = await interceptor.onSuccess(result);
          } catch (error) {
            if (interceptor.onError) {
              return interceptor.onError(error);
            }
            throw error;
          }
        }

        const isValid = config.validateStatus
          ? config.validateStatus(response.status)
          : response.ok;
        if (!isValid) {
          throw new ApiClientError(`HTTP ${response.status}: ${response.statusText}`, {
            status: response.status,
            statusText: response.statusText,
            data: responseData,
          });
        }

        return result;
      } catch (error: any) {
        clearTimeout(timeoutId);
        lastError = error;

        if (error.name === 'AbortError') {
          lastError = new ApiClientError('Request timeout', { code: 'ETIMEDOUT' });
        }

        // Response Interceptors Error Handling
        for (const interceptor of this.responseInterceptors) {
          if (interceptor.onError) {
            try {
              await interceptor.onError(lastError);
            } catch (e) {
              lastError = e;
            }
          }
        }

        if (attempt < this.retries && this.isRetryable(error)) {
          logger.warn(
            { error: error.message },
            `Retrying request (${attempt + 1}/${this.retries}): ${method} ${fullUrl}`
          );
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay * (attempt + 1)));
          continue;
        }
        break;
      }
    }

    throw lastError;
  }

  private buildUrl(url: string, params?: Record<string, any>): string {
    const baseUrl = url.startsWith('http') ? '' : this.baseURL;
    const separator = baseUrl && !url.startsWith('/') ? '/' : '';
    let fullUrl = `${baseUrl}${separator}${url}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const qs = searchParams.toString();
      if (qs) {
        fullUrl += (fullUrl.includes('?') ? '&' : '?') + qs;
      }
    }
    return fullUrl;
  }

  private isRetryable(error: any): boolean {
    if (error instanceof ApiClientError) {
      return (error.status && error.status >= 500) || error.code === 'ETIMEDOUT';
    }
    return true;
  }

  public get<T>(url: string, options?: RequestOptions) {
    return this.request<T>('GET', url, undefined, options);
  }

  public post<T>(url: string, data?: any, options?: RequestOptions) {
    return this.request<T>('POST', url, data, options);
  }

  public put<T>(url: string, data?: any, options?: RequestOptions) {
    return this.request<T>('PUT', url, data, options);
  }

  public patch<T>(url: string, data?: any, options?: RequestOptions) {
    return this.request<T>('PATCH', url, data, options);
  }

  public delete<T>(url: string, options?: RequestOptions) {
    return this.request<T>('DELETE', url, undefined, options);
  }
}
