import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AccessDeniedPage: React.FC<{ requiredRoleLabel?: string }> = ({
  requiredRoleLabel = 'autorizado',
}) => {
  const { user, navigate } = useApp();

  const homePath =
    user?.role === 'admin' || user?.role === 'superadmin'
      ? '/admin'
      : user?.role === 'caixa'
      ? '/pdv'
      : user?.role === 'cliente'
      ? '/loja'
      : '/login';

  return (
    <div
      data-testid="access-denied"
      className="flex-1 flex items-center justify-center px-4 py-16"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-5">
        <div className="mx-auto w-14 h-14 rounded-full bg-red-50 dark:bg-red-950/60 flex items-center justify-center text-red-600 dark:text-red-400">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-mono font-semibold text-red-600 dark:text-red-400">
            Erro 403
          </p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Acesso negado
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Esta área é restrita ao perfil <strong>{requiredRoleLabel}</strong>. Seu perfil atual não possui permissão para acessar esta rota.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(homePath)}
            data-testid="access-denied-home-button"
            className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para minha área
          </button>
        </div>
      </div>
    </div>
  );
};
