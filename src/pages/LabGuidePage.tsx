import React, { useState } from 'react';
import { BookOpen, ExternalLink, Search, CheckSquare } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface Scenario {
  module: string;
  type: 'Positivo' | 'Negativo' | 'Validação';
  title: string;
  steps: string;
  expected: string;
}

const SCENARIOS: Scenario[] = [
  {
    module: 'Autenticação & RBAC',
    type: 'Positivo',
    title: 'Login por perfil e redirecionamento',
    steps: 'Usar fill-admin-button, fill-cashier-button ou fill-customer-button e clicar em login-button.',
    expected: 'Redireciona para /admin, /pdv ou /loja com saudação personalizada no cabeçalho.',
  },
  {
    module: 'Autenticação & RBAC',
    type: 'Negativo',
    title: 'Bloqueio após 5 tentativas inválidas',
    steps: 'Enviar senha incorreta 5 vezes seguidas para o mesmo e-mail válido.',
    expected: 'Retorna HTTP 423 e exibe mensagem informando o tempo restante de bloqueio.',
  },
  {
    module: 'Autenticação & RBAC',
    type: 'Negativo',
    title: 'Acesso indevido de rota (403)',
    steps: 'Logado como Cliente, navegar diretamente para /admin ou /pdv.',
    expected: 'Exibe tela Acesso Negado com data-testid="access-denied".',
  },
  {
    module: 'Admin',
    type: 'Negativo',
    title: 'Bloqueio de CPF duplicado / inválido e preço negativo',
    steps: 'Tentar cadastrar cliente com CPF inválido ou já existente, ou produto com preço negativo.',
    expected: 'API e formulário exibem erro claro em português junto ao campo.',
  },
  {
    module: 'Admin',
    type: 'Negativo',
    title: 'Upload inválido e pagamento financeiro duplicado',
    steps: 'Enviar arquivo .exe/.txt ou maior que 2MB em Anexos; tentar pagar conta já marcada como Pago.',
    expected: 'Upload rejeitado com mensagem explicativa; botão de pagar bloqueado.',
  },
  {
    module: 'Admin',
    type: 'Positivo',
    title: 'Restaurar dados de demonstração',
    steps: 'Acessar Admin -> Laboratório -> Restaurar dados de demonstração e confirmar no modal.',
    expected: 'Banco PostgreSQL retorna ao estado inicial de seed sem resíduos de testes anteriores.',
  },
  {
    module: 'PDV',
    type: 'Negativo',
    title: 'Venda com caixa fechado ou desconto acima do limite',
    steps: 'Tentar finalizar venda sem abrir o caixa; aplicar desconto > 15% sem senha do Administrador.',
    expected: 'Operação bloqueada até abrir o caixa ou validar a senha do supervisor (Admin@123).',
  },
  {
    module: 'PDV',
    type: 'Positivo',
    title: 'Venda presencial com pagamento dividido e troco',
    steps: 'Abrir caixa, bipar código AUR-101, dividir pagamento (PIX + Dinheiro) e finalizar (F10).',
    expected: 'Baixa estoque, calcula troco e exibe comprovante imprimível (pdv-receipt-modal).',
  },
  {
    module: 'Loja',
    type: 'Positivo',
    title: 'Fluxo completo de compra online com cupom AURORA10',
    steps: 'Adicionar item disponível ao carrinho, aplicar AURORA10, avançar nas 4 etapas do checkout e confirmar.',
    expected: 'Pedido criado em Meus Pedidos, estoque reduzido e cupom contabilizado.',
  },
  {
    module: 'Loja',
    type: 'Negativo',
    title: 'Cupom expirado/esgotado e produto sem estoque',
    steps: 'Aplicar EXPIRADO20 ou ESGOTADO15 no carrinho; abrir produto AUR-106 (estoque 0).',
    expected: 'Botão de adicionar fica desabilitado ("Indisponível") e cupom exibe motivo da recusa.',
  },
  {
    module: 'Loja',
    type: 'Validação',
    title: 'Prazo de 7 dias para troca/devolução',
    steps: 'Solicitar devolução no pedido entregue há 2 dias (sucesso) vs. entregue há 15 dias (erro).',
    expected: 'Sistema aceita dentro do prazo e bloqueia fora do prazo de 7 dias.',
  },
];

export const LabGuidePage: React.FC = () => {
  const { navigate } = useApp();
  const [filterModule, setFilterModule] = useState('Todos');
  const [search, setSearch] = useState('');

  const modules = ['Todos', 'Autenticação & RBAC', 'Admin', 'PDV', 'Loja'];
  const filtered = SCENARIOS.filter((s) => {
    if (filterModule !== 'Todos' && s.module !== filterModule) return false;
    if (
      search &&
      !s.title.toLowerCase().includes(search.toLowerCase()) &&
      !s.steps.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <BookOpen className="w-7 h-7 text-indigo-600 dark:text-teal-400" />
            <span>Guia de Cenários de Teste (QA Lab)</span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Roteiro prático para Selenium WebDriver (Java 17 + JUnit 5 + POM), Cucumber/BDD, Playwright, Cypress e Postman.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="/api-docs"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="lab-open-swagger-link"
            className="min-h-[42px] px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <span>Abrir Swagger / OpenAPI</span>
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            type="button"
            onClick={() => navigate('/login')}
            data-testid="lab-go-login-button"
            className="min-h-[42px] px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold"
          >
            Ir para Login
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
          {modules.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setFilterModule(m)}
              data-testid={`lab-filter-${m}`}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterModule === m
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="lab-search-input"
            placeholder="Filtrar cenários..."
            className="w-full min-h-[40px] pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
          />
        </div>
      </div>

      {/* Scenario Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((s, idx) => (
          <article
            key={idx}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2.5"
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-indigo-600 dark:text-teal-400">
                {s.module}
              </span>
              <span
                className={`font-semibold ${
                  s.type === 'Positivo'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : s.type === 'Negativo'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {s.type}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-start gap-2">
              <CheckSquare className="w-4 h-4 mt-1 text-slate-400 shrink-0" />
              <span>{s.title}</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              <strong>Passos:</strong> {s.steps}
            </p>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              <strong>Resultado esperado:</strong> {s.expected}
            </p>
          </article>
        ))}
      </div>
    </main>
  );
};
