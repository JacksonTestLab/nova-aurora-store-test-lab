import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { supabase } from '../lib/supabase';

export interface UserProfile {
  id: number;
  uid: string | null;
  name: string;
  email: string;
  role: 'admin' | 'caixa' | 'cliente';
  cpf: string | null;
  phone: string | null;
  birthDate: string | null;
  cep: string | null;
  address: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  avatarUrl: string | null;
  status: string;
}

export interface LabConfig {
  appName: string;
  version: string;
  labMode: boolean;
  simulatedDelayMs: number;
  maxCashierDiscountPercent: number;
  databaseMode?: string;
  supabase?: {
    configured: boolean;
    url: string | null;
    hasServiceRole: boolean;
    hasDatabaseUrl: boolean;
  };
}

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppContextType {
  user: UserProfile | null;
  token: string | null;
  authLoading: boolean;
  config: LabConfig;
  theme: 'light' | 'dark';
  qaMode: boolean;
  hoveredTestId: string | null;
  toasts: ToastItem[];
  currentPath: string;
  navigate: (path: string) => void;
  toggleTheme: () => void;
  toggleQaMode: () => void;
  addToast: (type: 'success' | 'error' | 'info', message: string) => void;
  removeToast: (id: string) => void;
  apiFetch: <T = any>(url: string, options?: RequestInit) => Promise<T>;
  login: (email: string, password: string) => Promise<UserProfile>;
  loginWithGoogle: () => Promise<UserProfile>;
  loginWithSupabase: (email: string, password: string) => Promise<UserProfile>;
  register: (payload: Record<string, string>) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshConfig: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_CONFIG: LabConfig = {
  appName: 'Nova Aurora Store Test Lab',
  version: '1.4.0',
  labMode: true,
  simulatedDelayMs: 0,
  maxCashierDiscountPercent: 15,
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('na_token');
    } catch {
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [config, setConfig] = useState<LabConfig>(DEFAULT_CONFIG);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('na_theme');
      return saved === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [qaMode, setQaMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('na_qa_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [hoveredTestId, setHoveredTestId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string>(
    () => window.location.pathname || '/'
  );

  // Sync theme on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      localStorage.setItem('na_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Sync QA Mode on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (qaMode) root.setAttribute('data-qa-mode', 'true');
    else root.removeAttribute('data-qa-mode');
    try {
      localStorage.setItem('na_qa_mode', String(qaMode));
    } catch {
      // ignore
    }
  }, [qaMode]);

  // Track hovered data-testid when QA Mode is enabled
  useEffect(() => {
    if (!qaMode) {
      setHoveredTestId(null);
      return;
    }
    const handleMouseOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest('[data-testid]');
      setHoveredTestId(target ? target.getAttribute('data-testid') : null);
    };
    document.addEventListener('mouseover', handleMouseOver);
    return () => document.removeEventListener('mouseover', handleMouseOver);
  }, [qaMode]);

  // Listen to browser history popstate
  useEffect(() => {
    const onPop = () => setCurrentPath(window.location.pathname || '/');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: 'success' | 'error' | 'info', message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    []
  );

  const apiFetch = useCallback(
    async <T = any,>(url: string, options: RequestInit = {}): Promise<T> => {
      const headers = new Headers(options.headers || {});
      if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      const activeToken = token || (() => {
        try {
          return sessionStorage.getItem('na_token');
        } catch {
          return null;
        }
      })();
      if (activeToken && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${activeToken}`);
      }

      const res = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });

      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await res.json()
        : null;

      if (!res.ok) {
        const msg = data?.error || `Erro na requisição (${res.status})`;
        const err: any = new Error(msg);
        err.status = res.status;
        err.data = data;
        throw err;
      }

      return data as T;
    },
    [token]
  );

  const refreshConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch {
      // keep default
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: UserProfile }>('/api/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    refreshConfig();
    refreshUser();
  }, [refreshConfig, refreshUser]);

  const login = async (email: string, password: string): Promise<UserProfile> => {
    const data = await apiFetch<{ user: UserProfile; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    try {
      sessionStorage.setItem('na_token', data.token);
    } catch {
      // ignore
    }
    setUser(data.user);
    return data.user;
  };

  const loginWithGoogle = async (): Promise<UserProfile> => {
    const result = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await result.user.getIdToken();
    const data = await apiFetch<{ user: UserProfile; token: string }>('/api/auth/firebase', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    setToken(data.token);
    try {
      sessionStorage.setItem('na_token', data.token);
    } catch {
      // ignore
    }
    setUser(data.user);
    return data.user;
  };

  const loginWithSupabase = async (email: string, password: string): Promise<UserProfile> => {
    if (!supabase) {
      throw new Error('Cliente Supabase não configurado no ambiente.');
    }
    const { data: sbData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !sbData.session?.access_token) {
      throw new Error(error?.message || 'Falha ao autenticar via Supabase.');
    }
    const data = await apiFetch<{ user: UserProfile; token: string }>('/api/auth/supabase', {
      method: 'POST',
      body: JSON.stringify({ accessToken: sbData.session.access_token }),
    });
    setToken(data.token);
    try {
      sessionStorage.setItem('na_token', data.token);
    } catch {
      // ignore
    }
    setUser(data.user);
    return data.user;
  };

  const register = async (payload: Record<string, string>): Promise<UserProfile> => {
    const data = await apiFetch<{ user: UserProfile; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setToken(data.token);
    try {
      sessionStorage.setItem('na_token', data.token);
    } catch {
      // ignore
    }
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
    }
    setUser(null);
    setToken(null);
    try {
      sessionStorage.removeItem('na_token');
    } catch {
      // ignore
    }
    navigate('/login');
  };

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  const toggleQaMode = () => setQaMode((q) => !q);

  return (
    <AppContext.Provider
      value={{
        user,
        token,
        authLoading,
        config,
        theme,
        qaMode,
        hoveredTestId,
        toasts,
        currentPath,
        navigate,
        toggleTheme,
        toggleQaMode,
        addToast,
        removeToast,
        apiFetch,
        login,
        loginWithGoogle,
        loginWithSupabase,
        register,
        logout,
        refreshUser,
        refreshConfig,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp deve ser usado dentro de AppProvider');
  return ctx;
}
