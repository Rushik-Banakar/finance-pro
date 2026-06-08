import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add bearer token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor to handle token refresh automatically on 401 expiration
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401) {
      const detail = error.response.data?.detail;
      
      // 1. If token is expired, attempt automatic silent refresh
      if (detail === 'Session expired. Please login.' && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const expiredToken = localStorage.getItem('token');
          if (expiredToken) {
            const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
              headers: {
                Authorization: `Bearer ${expiredToken}`
              }
            });
            
            const newToken = res.data.access_token;
            localStorage.setItem('token', newToken);
            
            // Re-apply Authorization header in standard axios default options
            axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            
            // Retry the original request
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest);
          }
        } catch (refreshErr) {
          // If refresh fails, purge local storage, cache redirect, and navigate to login
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('settings');
          delete axios.defaults.headers.common['Authorization'];
          
          if (window.location.pathname !== '/login') {
            sessionStorage.setItem('redirect_to', window.location.pathname);
          }
          window.location.href = '/login';
          return Promise.reject(refreshErr);
        }
      }
      
      // 2. If token is missing, invalid, or malformed, redirect immediately to login
      if (detail === 'Authentication missing.' || detail === 'Invalid token.' || detail === 'Invalid token structure.') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('settings');
        delete axios.defaults.headers.common['Authorization'];
        
        if (window.location.pathname !== '/login') {
          sessionStorage.setItem('redirect_to', window.location.pathname);
        }
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Authentication endpoints
export const authApi = {
  signup: async (userIn: any) => {
    const res = await api.post('/auth/signup', userIn);
    return res.data;
  },
  login: async (loginData: any) => {
    const res = await api.post('/auth/login', loginData);
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  getSettings: async () => {
    const res = await api.get('/auth/settings');
    return res.data;
  },
  verifyPin: async (pin: string) => {
    const res = await api.post('/auth/verify-pin', { pin });
    return res.data;
  },
  updatePin: async (isPinEnabled: boolean, pin?: string) => {
    const res = await api.post('/auth/update-pin', { is_pin_enabled: isPinEnabled, pin });
    return res.data;
  },
};

// Accounts endpoints
export const accountsApi = {
  getAccounts: async (includeArchived = false) => {
    const res = await api.get(`/accounts?include_archived=${includeArchived}`);
    return res.data;
  },
  createAccount: async (accountIn: any) => {
    const res = await api.post('/accounts', accountIn);
    return res.data;
  },
  updateAccount: async (id: number, accountIn: any) => {
    const res = await api.put(`/accounts/${id}`, accountIn);
    return res.data;
  },
  deleteAccount: async (id: number) => {
    const res = await api.delete(`/accounts/${id}`);
    return res.data;
  },
};

// Categories endpoints
export const categoriesApi = {
  getCategories: async () => {
    const res = await api.get('/categories');
    return res.data;
  },
  createCategory: async (categoryIn: any) => {
    const res = await api.post('/categories', categoryIn);
    return res.data;
  },
  updateCategory: async (id: number, categoryIn: any) => {
    const res = await api.put(`/categories/${id}`, categoryIn);
    return res.data;
  },
  getDependencies: async (id: number) => {
    const res = await api.get(`/categories/${id}/dependencies`);
    return res.data;
  },
  splitCategory: async (id: number, splitPayload: any) => {
    const res = await api.post(`/categories/${id}/split`, splitPayload);
    return res.data;
  },
  deleteCategory: async (id: number, deleteTransactions?: boolean, newCategoryId?: number) => {
    const params: any = {};
    if (deleteTransactions !== undefined) params.delete_transactions = deleteTransactions;
    if (newCategoryId !== undefined) params.new_category_id = newCategoryId;
    const res = await api.delete(`/categories/${id}`, { params });
    return res.data;
  },
};

// Transactions & Transfers endpoints
export const transactionsApi = {
  getTransactions: async (filters: {
    accountIds?: number[];
    categoryId?: number;
    type?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    limit?: number;
  } = {}) => {
    const params = new URLSearchParams();
    
    if (filters.accountIds && filters.accountIds.length > 0) {
      filters.accountIds.forEach(id => params.append('account_ids', id.toString()));
    }
    if (filters.categoryId) params.append('category_id', filters.categoryId.toString());
    if (filters.type) params.append('type', filters.type);
    if (filters.startDate) params.append('start_date', filters.startDate);
    if (filters.endDate) params.append('end_date', filters.endDate);
    if (filters.search) params.append('search', filters.search);
    if (filters.limit) params.append('limit', filters.limit.toString());

    const res = await api.get(`/transactions?${params.toString()}`);
    return res.data;
  },
  createTransaction: async (txIn: any) => {
    const res = await api.post('/transactions', txIn);
    return res.data;
  },
  updateTransaction: async (id: number, txIn: any) => {
    const res = await api.put(`/transactions/${id}`, txIn);
    return res.data;
  },
  deleteTransaction: async (id: number) => {
    const res = await api.delete(`/transactions/${id}`);
    return res.data;
  },
  bulkDeleteTransactions: async (payload: { ids?: number[]; all?: boolean }) => {
    const res = await api.post('/transactions/bulk-delete', payload);
    return res.data;
  },
  createTransfer: async (trIn: any) => {
    const res = await api.post('/transactions/transfers', trIn);
    return res.data;
  },
  getTransfers: async (limit = 50) => {
    const res = await api.get(`/transactions/transfers?limit=${limit}`);
    return res.data;
  },
};

export const analyticsApi = {
  getKpis: async () => {
    const res = await api.get('/analytics/kpis');
    return res.data;
  },
  getMl: async () => {
    const res = await api.get('/analytics/ml');
    return res.data;
  },
};

// Settings endpoints
export const settingsApi = {
  updateSettings: async (settingsUpdate: any) => {
    const res = await api.put('/settings', settingsUpdate);
    return res.data;
  },
};

// Support & Ticketing endpoints
export const supportApi = {
  getTickets: async () => {
    const res = await api.get('/support/tickets');
    return res.data;
  },
  createTicket: async (ticketIn: any) => {
    const res = await api.post('/support/tickets', ticketIn);
    return res.data;
  },
  getNotifications: async () => {
    const res = await api.get('/support/notifications');
    return res.data;
  },
  readNotification: async (id: number) => {
    const res = await api.put(`/support/notifications/${id}/read`);
    return res.data;
  },
  getSnapshots: async () => {
    const res = await api.get('/support/snapshots');
    return res.data;
  },
};

// Coach / Personal Financial Advisor endpoints
export const coachApi = {
  getInsights: async () => {
    const res = await api.get('/coach/insights');
    return res.data;
  },
  sendMessage: async (message: string, history?: { role: string; content: string }[]) => {
    const res = await api.post('/coach/chat', { message, history });
    return res.data;
  },
};

export default api;

