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

  // Normalize path
  const cleanPath = currentPath.split('?')[0];

  let areaTitle = 'Autenticação';
  let pageDocTitle = 'Nova Aurora Store';
  let content: React.ReactNode = <LoginPage />;

  if (cleanPath === '/laboratorio') {
    areaTitle = 'Guia de Cenários QA';
    pageDocTitle = 'Guia de Cenários QA | Nova Aurora Store';
    content = <LabGuidePage />;
  } else if (cleanPath === '/loja' || cleanPath.startsWith('/loja/')) {
    areaTitle = 'Vitrine Online';
    pageDocTitle = 'Vitrine | Nova Aurora Store';
    content = <StorePage />;
  } else if (cleanPath === '/admin') {
    areaTitle = 'Administração';
    if (!user) {
      pageDocTitle = 'Nova Aurora Store';
      content = <LoginPage />;
    } else if (user.role !== 'admin' && user.role !== 'superadmin') {
      pageDocTitle = 'Acesso Negado | Nova Aurora Store';
      content = <AccessDeniedPage requiredRoleLabel="Administrador" />;
    } else {
      pageDocTitle = 'Dashboard | Nova Aurora Store';
      content = <AdminPage />;
    }
  } else if (cleanPath === '/pdv') {
    areaTitle = 'Frente de Caixa (PDV)';
    if (!user) {
      pageDocTitle = 'Nova Aurora Store';
      content = <LoginPage />;
    } else if (user.role !== 'caixa' && user.role !== 'admin' && user.role !== 'superadmin') {
      pageDocTitle = 'Acesso Negado | Nova Aurora Store';
      content = <AccessDeniedPage requiredRoleLabel="Operador de Caixa (PDV)" />;
    } else {
      pageDocTitle = 'PDV | Nova Aurora Store';
      content = <PdvPage />;
    }
  } else if (cleanPath === '/login') {
    areaTitle = 'Login';
    pageDocTitle = 'Nova Aurora Store';
    content = <LoginPage />;
  } else {
    // Root "/"
    if (user?.role === 'admin' || user?.role === 'superadmin') {
      areaTitle = 'Administração';
      pageDocTitle = 'Dashboard | Nova Aurora Store';
      content = <AdminPage />;
    } else if (user?.role === 'caixa') {
      areaTitle = 'Frente de Caixa (PDV)';
      pageDocTitle = 'PDV | Nova Aurora Store';
      content = <PdvPage />;
    } else if (user?.role === 'cliente') {
      areaTitle = 'Vitrine Online';
      pageDocTitle = 'Vitrine | Nova Aurora Store';
      content = <StorePage />;
    } else {
      areaTitle = 'Login';
      pageDocTitle = 'Nova Aurora Store';
      content = <LoginPage />;
    }
  }

  React.useEffect(() => {
    document.title = authLoading ? 'Nova Aurora Store' : pageDocTitle;
  }, [authLoading, pageDocTitle]);

  if (authLoading) {
    return (
      <div
        data-testid="loading-spinner"
        className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-indigo-600 dark:text-teal-400"
      >
        <div className="flex items-center gap-2.5 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Carregando Nova Aurora Store...</span>
        </div>
      </div>
    );
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
