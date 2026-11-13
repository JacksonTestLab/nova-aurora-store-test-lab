import React from 'react';
import { Loader2 } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { TopShell } from './components/TopShell';
import { Footer } from './components/Footer';
import { ToastContainer } from './components/ToastContainer';
import { AccessDeniedPage } from './components/AccessDeniedPage';
import { LoginPage } from './pages/LoginPage';
import { AdminPage } from './pages/AdminPage';
import { PdvPage } from './pages/PdvPage';
import { StorePage } from './pages/StorePage';
import { LabGuidePage } from './pages/LabGuidePage';

const AppRouter: React.FC = () => {
  const { user, authLoading, currentPath } = useApp();

  if (authLoading) {
    return (
      <div
        data-testid="loading-spinner"
        className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-indigo-600 dark:text-teal-400"
      >
        <div className="flex items-center gap-2.5 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Carregando Nova Aurora Store Test Lab...</span>
        </div>
      </div>
    );
  }

  // Normalize path
  const cleanPath = currentPath.split('?')[0];

  let areaTitle = 'Autenticação';
  let content: React.ReactNode = <LoginPage />;

  if (cleanPath === '/laboratorio') {
    areaTitle = 'Guia de Cenários QA';
    content = <LabGuidePage />;
  } else if (cleanPath === '/loja' || cleanPath.startsWith('/loja/')) {
    areaTitle = 'Vitrine Online';
    content = <StorePage />;
  } else if (cleanPath === '/admin') {
    areaTitle = 'Administração';
    if (!user) {
      content = <LoginPage />;
    } else if (user.role !== 'admin') {
      content = <AccessDeniedPage requiredRoleLabel="Administrador" />;
    } else {
      content = <AdminPage />;
    }
  } else if (cleanPath === '/pdv') {
    areaTitle = 'Frente de Caixa (PDV)';
    if (!user) {
      content = <LoginPage />;
    } else if (user.role !== 'caixa' && user.role !== 'admin') {
      content = <AccessDeniedPage requiredRoleLabel="Operador de Caixa (PDV)" />;
    } else {
      content = <PdvPage />;
    }
  } else if (cleanPath === '/login') {
    areaTitle = 'Login';
    content = <LoginPage />;
  } else {
    // Root "/"
    if (user?.role === 'admin') {
      areaTitle = 'Administração';
      content = <AdminPage />;
    } else if (user?.role === 'caixa') {
      areaTitle = 'Frente de Caixa (PDV)';
      content = <PdvPage />;
    } else if (user?.role === 'cliente') {
      areaTitle = 'Vitrine Online';
      content = <StorePage />;
    } else {
      areaTitle = 'Login';
      content = <LoginPage />;
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <TopShell areaTitle={areaTitle} />
      {content}
      <Footer />
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}
