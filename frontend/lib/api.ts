/**
 * API Client for making HTTP requests
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
}

/**
 * Custom API error class
 */
export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Base fetch function with error handling
 */
async function baseFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;

  // Build URL with query params
  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  // Default headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Get auth token from storage if available
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: 'include',
    });

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      if (!response.ok) {
        throw new ApiError('Request failed', response.status);
      }
      return {} as T;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(
        data.message || 'Request failed',
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Network error', 0, error);
  }
}

/**
 * API methods
 */
export const api = {
  get: <T>(endpoint: string, options?: FetchOptions) =>
    baseFetch<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: FetchOptions) =>
    baseFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown, options?: FetchOptions) =>
    baseFetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: unknown, options?: FetchOptions) =>
    baseFetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, options?: FetchOptions) =>
    baseFetch<T>(endpoint, { ...options, method: 'DELETE' }),
};

/**
 * Auth API endpoints
 */
export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<{ user: unknown; token: string }>>('/auth/login', { email, password }),

  register: (email: string, password: string, name: string) =>
    api.post<ApiResponse<{ user: unknown; token: string }>>('/auth/register', { email, password, name }),

  logout: () => api.post<void>('/auth/logout'),

  me: () => api.get<ApiResponse<unknown>>('/auth/me'),

  forgotPassword: (email: string) =>
    api.post<ApiResponse<void>>('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post<ApiResponse<void>>('/auth/reset-password', { token, password }),
};

/**
 * Workspaces API endpoints
 */
export const workspacesApi = {
  list: () => api.get<ApiResponse<unknown[]>>('/workspaces'),

  get: (id: string) => api.get<ApiResponse<unknown>>(`/workspaces/${id}`),

  create: (name: string) =>
    api.post<ApiResponse<unknown>>('/workspaces', { name }),

  update: (id: string, data: { name?: string }) =>
    api.patch<ApiResponse<unknown>>(`/workspaces/${id}`, data),

  delete: (id: string) => api.delete<void>(`/workspaces/${id}`),
};

/**
 * Teams API endpoints
 */
export const teamsApi = {
  getMembers: (workspaceId: string) =>
    api.get<ApiResponse<unknown[]>>(`/workspaces/${workspaceId}/members`),

  inviteMember: (workspaceId: string, email: string, role: string) =>
    api.post<ApiResponse<unknown>>(`/workspaces/${workspaceId}/invites`, { email, role }),

  removeMember: (workspaceId: string, memberId: string) =>
    api.delete<void>(`/workspaces/${workspaceId}/members/${memberId}`),

  updateMemberRole: (workspaceId: string, memberId: string, role: string) =>
    api.patch<ApiResponse<unknown>>(`/workspaces/${workspaceId}/members/${memberId}`, { role }),
};

/**
 * Billing API endpoints
 */
export const billingApi = {
  getSubscription: () => api.get<ApiResponse<unknown>>('/billing/subscription'),

  createCheckoutSession: (priceId: string) =>
    api.post<ApiResponse<{ url: string }>>('/billing/checkout', { priceId }),

  createPortalSession: () =>
    api.post<ApiResponse<{ url: string }>>('/billing/portal'),

  getInvoices: () => api.get<ApiResponse<unknown[]>>('/billing/invoices'),
};

