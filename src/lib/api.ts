const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { skipAuth = false, ...fetchOptions } = options;

  const headers: HeadersInit = {
    ...fetchOptions.headers,
  };

  if (!skipAuth) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
  }

  if (!(headers as Record<string, string>)['Content-Type'] && !(options.body instanceof FormData)) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  if (response.status === 401 && !skipAuth) {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          localStorage.setItem('access_token', data.access_token);
          localStorage.setItem('refresh_token', data.refresh_token);
          
          (headers as Record<string, string>)['Authorization'] = `Bearer ${data.access_token}`;
          const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...fetchOptions,
            headers,
          });
          
          if (!retryResponse.ok) {
            const errorData = await retryResponse.json().catch(() => ({}));
            throw new ApiError(errorData.detail || 'Request failed', retryResponse.status, errorData);
          }
          
          return retryResponse.json();
        }
      } catch (e) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    } else {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(errorData.detail || 'Request failed', response.status, errorData);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string, options?: FetchOptions) =>
    fetchApi<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: any, options?: FetchOptions) =>
    fetchApi<T>(endpoint, { ...options, method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }),

  put: <T>(endpoint: string, body?: any, options?: FetchOptions) =>
    fetchApi<T>(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),

  delete: <T>(endpoint: string, options?: FetchOptions) =>
    fetchApi<T>(endpoint, { ...options, method: 'DELETE' }),
};

export interface User {
  id: string;
  email: string;
  name: string | null;
  subscription_tier: 'free' | 'pro' | 'team';
  storage_used: number;
  operations_used: number;
  daily_operations_remaining: number;
  plan_limits: {
    max_file_size_mb: number;
    max_datasets: number;
    max_daily_operations: number;
    advanced_cleaning: boolean;
    quality_reports: boolean;
    api_access: boolean;
    team_workspace: boolean;
  };
  team_id?: string;
  team_role?: string;
  subscription_status?: string;
  subscription_start_date?: string;
  subscription_end_date?: string;
  created_at: string;
}

export interface Dataset {
  id: string;
  user_id: string;
  name: string;
  original_filename: string;
  file_size: number;
  row_count: number;
  column_count: number;
  columns: ColumnInfo[];
  created_at: string;
}

export interface ColumnInfo {
  name: string;
  dtype: string;
  nullable: boolean;
  unique_count: number;
}

export interface DatasetPreview {
  columns: string[];
  rows: any[][];
  total_rows: number;
}

export interface Analysis {
  dataset_id: string;
  quality_score: number;
  completeness_score: number;
  consistency_score: number;
  imbalance_score: number;
  row_count: number;
  column_count: number;
  missing_values: Record<string, number>;
  missing_values_percent: Record<string, number>;
  duplicate_rows: number;
  duplicate_percentage: number;
  outliers: Record<string, number>;
  outliers_percent: Record<string, number>;
  inconsistent_categories: Record<string, string[]>;
  imbalanced_columns: Record<string, Record<string, number>>;
  column_types: Record<string, string>;
  summary_stats: Record<string, Record<string, number | null>>;
  categorical_stats?: Record<string, Record<string, any>>;
}

export interface CleaningSuggestion {
  id: string;
  operation_type: string;
  description: string;
  column: string | null;
  affected_rows: number | null;
  enabled: boolean;
  column_type?: string;
  issue_detected?: string;
  recommendation?: string;
  strategy?: string;
  strategy_options?: string[];
  priority?: number;
}

export interface Token {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface SubscriptionResponse {
  tier: string;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface CreateSubscriptionResponse {
  subscription_id: string;
  customer_id: string;
  order_id: string;
  amount: number;
  currency: string;
}

export interface PlanInfo {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  features: {
    max_file_size_mb: number;
    max_datasets: number;
    max_daily_operations: number;
    advanced_cleaning: boolean;
    quality_reports: boolean;
    api_access: boolean;
    team_workspace: boolean;
  };
}
