import React, { useEffect, useState } from 'react';
import {
  Eye,
  EyeOff,
  Copy,
  Check,
  Loader2,
  ShieldCheck,
  Store,
  KeyRound,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isValidCPF, isValidEmail, maskCPF } from '../utils/validators';

interface LabCredential {
  id: string;
  label: string;
  role: string;
  email: string;
  password: string;
  buttonLabel: string;
  testId: string;
}

const LAB_ACCOUNTS: LabCredential[] = [
  {
    id: 'admin',
    label: 'Administrador',
    role: 'Gestão completa',
    email: 'admin@testlab.com.br',
    password: 'Admin@123',
    buttonLabel: 'Preencher credenciais (Admin)',
    testId: 'fill-admin-button',
  },
  {
    id: 'caixa',
    label: 'Operador de Caixa (PDV)',
    role: 'Venda no balcão',
    email: 'caixa@testlab.com.br',
    password: 'Caixa@123',
    buttonLabel: 'Preencher credenciais (Caixa)',
    testId: 'fill-cashier-button',
  },
  {
    id: 'cliente',
    label: 'Cliente',
    role: 'Vitrine online',
    email: 'usuario@testlab.com.br',
    password: 'Usuario@123',
    buttonLabel: 'Preencher credenciais (Cliente)',
    testId: 'fill-customer-button',
  },
];

export const LoginPage: React.FC = () => {
  const { config, login, loginWithGoogle, register, apiFetch, navigate, addToast } = useApp();
  const [tab, setTab] = useState<'login' | 'register' | 'recover'>('login');

  useEffect(() => {
    document.title = 'Nova Aurora Store';
  }, []);

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCpf, setRegCpf] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);

  // Recover state
  const [recEmail, setRecEmail] = useState('');

  const copyText = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      addToast('info', `Copiado: ${value}`);
    }
  };

  const fillCredentials = (acc: LabCredential) => {
    setTab('login');
    setEmail(acc.email);
    setPassword(acc.password);
    setFieldErrors({});
    setFormError('');
    setFormSuccess(`Credenciais de ${acc.label} preenchidas. Clique em Entrar.`);
  };

  const redirectByRole = (role: string) => {
    if (role === 'admin' || role === 'superadmin') navigate('/admin');
    else if (role === 'caixa') navigate('/pdv');
    else navigate('/loja');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    const errs: Record<string, string> = {};

    if (!email.trim()) errs.email = 'O e-mail é obrigatório.';
    else if (!isValidEmail(email)) errs.email = 'Formato de e-mail inválido.';
    if (!password) errs.password = 'A senha é obrigatória.';

    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      const loggedUser = await login(email.trim(), password);
      addToast('success', `Bem-vindo, ${loggedUser.name}!`);
      redirectByRole(loggedUser.role);
    } catch (err: any) {
      setFormError(err.message || 'Não foi possível autenticar.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setFormError('');
    setSubmitting(true);
    try {
      const loggedUser = await loginWithGoogle();
      addToast('success', `Autenticado como ${loggedUser.name}!`);
      redirectByRole(loggedUser.role);
    } catch (err: any) {
      setFormError(err.message || 'Falha ao autenticar com o Google.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    const errs: Record<string, string> = {};

    if (regName.trim().length < 3) errs.regName = 'Informe o nome completo (mín. 3 letras).';
    if (!isValidEmail(regEmail)) errs.regEmail = 'Informe um e-mail válido.';
    if (!isValidCPF(regCpf)) errs.regCpf = 'CPF inválido.';
    if (regPassword.length < 6) errs.regPassword = 'Senha deve ter no mínimo 6 caracteres.';
    if (regPassword !== regConfirm) errs.regConfirm = 'As senhas não coincidem.';

    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      const created = await register({
        name: regName.trim(),
        email: regEmail.trim(),
        cpf: regCpf,
        password: regPassword,
        confirmPassword: regConfirm,
      });
      addToast('success', 'Conta criada com sucesso!');
      redirectByRole(created.role);
    } catch (err: any) {
      setFormError(err.message || 'Erro ao cadastrar.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    if (!isValidEmail(recEmail)) {
      setFieldErrors({ recEmail: 'Informe um e-mail válido.' });
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const data = await apiFetch<{ message: string }>('/api/auth/recover-password', {
        method: 'POST',
        body: JSON.stringify({ email: recEmail.trim() }),
      });
      setFormSuccess(data.message);
    } catch (err: any) {
      setFormError(err.message || 'Erro ao solicitar recuperação.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column: Auth Card */}
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-teal-400 mb-1">
                Plataforma de Testes QA
              </p>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Nova Aurora Store
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Acesse com seu perfil ou crie uma conta para explorar a plataforma.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/loja')}
              data-testid="visit-public-store-button"
              className="min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
            >
              <Store className="w-4 h-4 text-indigo-600 dark:text-teal-400" />
              <span>Ver Vitrine Pública</span>
            </button>
          </div>

          {/* Auth Mode Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setFieldErrors({});
                setFormError('');
                setFormSuccess('');
              }}
              data-testid="login-tab-button"
              className={`flex-1 min-h-[40px] px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors ${
                tab === 'login'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setFieldErrors({});
                setFormError('');
                setFormSuccess('');
              }}
              data-testid="register-tab-button"
              className={`flex-1 min-h-[40px] px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors ${
                tab === 'register'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Criar Conta
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('recover');
                setFieldErrors({});
                setFormError('');
                setFormSuccess('');
              }}
              data-testid="recover-tab-button"
              className={`flex-1 min-h-[40px] px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors ${
                tab === 'recover'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Recuperar Senha
            </button>
          </div>

          {/* Feedback Banners */}
          {formError && (
            <div
              role="alert"
              data-testid="error-message"
              className="mb-5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div
              role="status"
              data-testid="success-message"
              className="mb-5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{formSuccess}</span>
            </div>
          )}

          {tab === 'login' && (
            <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
              <div>
                <label
                  htmlFor="email-input"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  E-mail <span className="text-red-500">*</span>
                </label>
                <input
                  id="email-input"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="email-input"
                  placeholder="exemplo@testlab.com.br"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm"
                />
                {fieldErrors.email && (
                  <p data-testid="email-error" className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password-input"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Senha <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="password-input"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="password-input"
                    placeholder="Digite sua senha"
                    className="w-full min-h-[44px] pl-3.5 pr-11 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    data-testid="toggle-password-visibility"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p data-testid="password-error" className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <button
                id="login-button"
                type="submit"
                disabled={submitting}
                data-testid="login-button"
                className="w-full min-h-[46px] px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                {submitting && (
                  <Loader2 data-testid="loading-spinner" className="w-4 h-4 animate-spin" />
                )}
                <span>{submitting ? 'Entrando...' : 'Entrar'}</span>
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-white dark:bg-slate-900 text-slate-500">
                    ou acesse com conta Google
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={submitting}
                data-testid="google-login-button"
                className="w-full min-h-[44px] px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors"
              >
                <span>Entrar com Google (Cliente)</span>
              </button>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleRegisterSubmit} noValidate className="space-y-4">
              <div>
                <label htmlFor="reg-name" className="block text-sm font-medium mb-1">
                  Nome completo <span className="text-red-500">*</span>
                </label>
                <input
                  id="reg-name"
                  name="name"
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  data-testid="register-name-input"
                  placeholder="Ex.: Mariana Silva"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
                {fieldErrors.regName && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.regName}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-email" className="block text-sm font-medium mb-1">
                    E-mail <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reg-email"
                    name="email"
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    data-testid="register-email-input"
                    placeholder="cliente@exemplo.test"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                  {fieldErrors.regEmail && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.regEmail}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="reg-cpf" className="block text-sm font-medium mb-1">
                    CPF (fictício válido) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reg-cpf"
                    name="cpf"
                    type="text"
                    value={regCpf}
                    onChange={(e) => setRegCpf(maskCPF(e.target.value))}
                    data-testid="register-cpf-input"
                    placeholder="000.000.000-00"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                  />
                  {fieldErrors.regCpf && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.regCpf}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-pass" className="block text-sm font-medium mb-1">
                    Senha <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="reg-pass"
                      name="password"
                      type={showRegPass ? 'text' : 'password'}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      data-testid="register-password-input"
                      placeholder="Mínimo 6 caracteres"
                      className="w-full min-h-[44px] pl-3.5 pr-10 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPass((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500"
                    >
                      {showRegPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.regPassword && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.regPassword}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="reg-confirm" className="block text-sm font-medium mb-1">
                    Confirmar senha <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reg-confirm"
                    name="confirmPassword"
                    type={showRegPass ? 'text' : 'password'}
                    value={regConfirm}
                    onChange={(e) => setRegConfirm(e.target.value)}
                    data-testid="register-confirm-password-input"
                    placeholder="Repita a senha"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                  {fieldErrors.regConfirm && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.regConfirm}</p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                data-testid="register-submit-button"
                className="w-full min-h-[46px] px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                {submitting && <Loader2 data-testid="loading-spinner" className="w-4 h-4 animate-spin" />}
                <span>Cadastrar e Entrar</span>
              </button>
            </form>
          )}

          {tab === 'recover' && (
            <form onSubmit={handleRecoverSubmit} noValidate className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Informe o e-mail cadastrado para simular o fluxo de recuperação de senha na plataforma de testes.
              </p>
              <div>
                <label htmlFor="rec-email" className="block text-sm font-medium mb-1">
                  E-mail cadastrado <span className="text-red-500">*</span>
                </label>
                <input
                  id="rec-email"
                  name="recoverEmail"
                  type="email"
                  value={recEmail}
                  onChange={(e) => setRecEmail(e.target.value)}
                  data-testid="recover-email-input"
                  placeholder="usuario@testlab.com.br"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
                {fieldErrors.recEmail && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.recEmail}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={submitting}
                data-testid="recover-submit-button"
                className="w-full min-h-[46px] px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                <KeyRound className="w-4 h-4" />
                <span>Enviar instruções de recuperação</span>
              </button>
            </form>
          )}
        </section>

        {/* Right column: Lab Accounts Panel (only shown when LAB_MODE=true) */}
        {config.labMode && (
          <aside
            data-testid="lab-accounts-panel"
            className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Contas para Testes
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Clique em <strong className="font-semibold text-slate-700 dark:text-slate-300">Preencher credenciais</strong> para inserir automaticamente o E-mail e a Senha do perfil selecionado.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {LAB_ACCOUNTS.map((acc) => (
                <div
                  key={acc.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {acc.label}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {acc.role}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="truncate text-slate-700 dark:text-slate-300">
                        {acc.email}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyText(acc.email, `${acc.id}-email`)}
                        data-testid={`copy-${acc.id}-email`}
                        aria-label={`Copiar e-mail de ${acc.label}`}
                        className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-teal-400 shrink-0"
                      >
                        {copiedKey === `${acc.id}-email` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="truncate text-slate-700 dark:text-slate-300">
                        {acc.password}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyText(acc.password, `${acc.id}-pass`)}
                        data-testid={`copy-${acc.id}-password`}
                        aria-label={`Copiar senha de ${acc.label}`}
                        className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-teal-400 shrink-0"
                      >
                        {copiedKey === `${acc.id}-pass` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => fillCredentials(acc)}
                    data-testid={acc.testId}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-teal-500 text-slate-800 dark:text-slate-100 transition-colors"
                  >
                    {acc.buttonLabel}
                  </button>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </main>
  );
};
