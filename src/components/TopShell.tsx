import React, { useState, useRef, useEffect } from 'react';
import {
  Sun,
  Moon,
  Bug,
  LogOut,
  User as UserIcon,
  ChevronDown,
  BookOpen,
  Store,
  LayoutDashboard,
  MonitorSmartphone,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super Admin',
  admin: 'Administrador',
  caixa: 'Caixa',
  cliente: 'Cliente',
};

interface TopShellProps {
  areaTitle?: string;
  rightSlot?: React.ReactNode;
}

export const TopShell: React.FC<TopShellProps> = ({ areaTitle, rightSlot }) => {
  const {
    user,
    config,
    theme,
    qaMode,
    hoveredTestId,
    toggleTheme,
    toggleQaMode,
    logout,
    navigate,
    currentPath,
  } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const initials = user?.name
    ? user.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0].toUpperCase())
        .join('')
    : 'NA';

  const handleAccountClick = () => {
    setMenuOpen(false);
    if (user?.role === 'cliente') {
      navigate('/loja?tab=conta');
    } else if (user?.role === 'admin' || user?.role === 'superadmin') {
      navigate('/admin?tab=usuarios');
    } else {
      navigate('/laboratorio');
    }
  };

  return (
    <div className="no-print sticky top-0 z-40">
      {/* Discreet fixed top lab bar */}
      <div
        data-testid="lab-environment-banner"
        className="bg-slate-900 text-slate-200 dark:bg-slate-950 border-b border-slate-800 px-4 py-1 text-[11px] flex flex-wrap items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-teal-400">
            Ambiente de Testes QA · Dados fictícios
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span className="font-mono text-slate-400">v{config.version}</span>
          {qaMode && (
            <>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span className="font-mono text-amber-300">
                Modo QA ativo{hoveredTestId ? ` (${hoveredTestId})` : ' — passe o mouse nos elementos'}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/laboratorio')}
            data-testid="top-lab-guide-button"
            className="inline-flex items-center gap-1 hover:text-white transition-colors"
          >
            <BookOpen className="w-3 h-3" />
            <span>Cenários QA</span>
          </button>
          {(user?.role === 'admin' || user?.role === 'superadmin') && currentPath !== '/admin' && (
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="inline-flex items-center gap-1 hover:text-white transition-colors"
            >
              <LayoutDashboard className="w-3 h-3" />
              <span>Admin</span>
            </button>
          )}
          {(user?.role === 'caixa' || user?.role === 'admin' || user?.role === 'superadmin') &&
            currentPath !== '/pdv' && (
              <button
                type="button"
                onClick={() => navigate('/pdv')}
                className="inline-flex items-center gap-1 hover:text-white transition-colors"
              >
                <MonitorSmartphone className="w-3 h-3" />
                <span>PDV</span>
              </button>
            )}
          {currentPath !== '/loja' && (
            <button
              type="button"
              onClick={() => navigate('/loja')}
              data-testid="top-store-link"
              className="inline-flex items-center gap-1 hover:text-white transition-colors"
            >
              <Store className="w-3 h-3" />
              <span>Loja</span>
            </button>
          )}
        </div>
      </div>

      {/* Main header */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Wordmark */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() =>
                navigate(
                  user?.role === 'admin' || user?.role === 'superadmin'
                    ? '/admin'
                    : user?.role === 'caixa'
                    ? '/pdv'
                    : '/loja'
                )
              }
              data-testid="brand-logo-button"
              className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 flex items-center gap-2"
            >
              <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white inline-flex items-center justify-center text-xs font-bold">
                NA
              </span>
              <span>Nova Aurora Store</span>
            </button>
            {areaTitle && (
              <span className="hidden md:inline-block text-xs text-slate-500 dark:text-slate-400 truncate">
                / {areaTitle}
              </span>
            )}
          </div>

          {/* Zone 2: Dynamic greeting */}
          {user && (
            <p
              data-testid="header-greeting"
              className="hidden lg:block text-xs sm:text-sm text-slate-600 dark:text-slate-300 truncate max-w-md"
            >
              Olá, <strong className="font-semibold text-slate-900 dark:text-white">{user.name}</strong>! Seja bem-vindo à Nova Aurora Store.
            </p>
          )}

          {/* Zone 3: Controls + User Profile */}
          <div className="flex items-center gap-2 shrink-0">
            {rightSlot}

            <button
              type="button"
              onClick={toggleQaMode}
              data-testid="qa-mode-toggle"
              aria-pressed={qaMode}
              title="Ativar ou desativar o Modo QA (mostra data-testid)"
              className={`min-h-[40px] px-2.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 border transition-colors whitespace-nowrap ${
                qaMode
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Bug className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Modo QA</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              data-testid="theme-toggle"
              aria-label="Alternar tema claro e escuro"
              className="min-h-[40px] min-w-[40px] px-2.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden xl:inline">Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-600" />
                  <span className="hidden xl:inline">Escuro</span>
                </>
              )}
            </button>

            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  data-testid="user-menu-button"
                  className="min-h-[40px] pl-1.5 pr-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      data-testid="user-avatar-initials"
                      className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold inline-flex items-center justify-center shrink-0"
                    >
                      {initials}
                    </span>
                  )}
                  <div className="hidden sm:flex flex-col items-start text-left leading-tight">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white max-w-[120px] truncate">
                      {user.name}
                    </span>
                    <span
                      data-testid="user-role-badge"
                      className="text-[11px] font-medium text-indigo-600 dark:text-teal-400"
                    >
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {menuOpen && (
                  <div
                    data-testid="user-dropdown-menu"
                    className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg py-1.5 z-50"
                  >
                    <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {user.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {user.email} · {ROLE_LABELS[user.role] || user.role}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAccountClick}
                      data-testid="my-account-menu-button"
                      className="w-full px-3.5 py-2.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                    >
                      <UserIcon className="w-4 h-4 text-slate-400" />
                      <span>Minha Conta</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        logout();
                      }}
                      data-testid="logout-button"
                      className="w-full px-3.5 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sair</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/login')}
                data-testid="header-login-button"
                className="min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors whitespace-nowrap"
              >
                Entrar
              </button>
            )}
          </div>
        </div>
      </header>
    </div>
  );
};
