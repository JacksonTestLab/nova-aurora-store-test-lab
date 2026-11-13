export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Nova Aurora Store · API QA',
    version: '1.0.0',
    description:
      'API REST da Plataforma de Testes QA para testes manuais e automatizados (Postman, Selenium, Playwright e Cypress). Todos os dados são fictícios.',
  },
  servers: [{ url: '/', description: 'Servidor Local / Ambiente Atual' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  paths: {
    '/api/config': {
      get: {
        tags: ['Sistema'],
        summary: 'Obter configurações do laboratório',
        responses: { '200': { description: 'Configurações do ambiente' } },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Autenticação'],
        summary: 'Realizar login com e-mail e senha',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'admin@testlab.com.br' },
                  password: { type: 'string', example: 'Admin@123' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Autenticado com sucesso' },
          '401': { description: 'Credenciais inválidas' },
          '423': { description: 'Conta bloqueada temporariamente após 5 tentativas' },
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Autenticação'],
        summary: 'Cadastrar novo cliente',
        responses: { '201': { description: 'Cliente cadastrado' }, '400': { description: 'Erro de validação' } },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Autenticação'],
        security: [{ bearerAuth: [] }],
        summary: 'Dados do usuário autenticado',
        responses: { '200': { description: 'Perfil atual' }, '401': { description: 'Não autenticado' } },
      },
    },
    '/api/store/products': {
      get: {
        tags: ['Loja (Vitrine)'],
        summary: 'Listar produtos com filtros, ordenação e paginação',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'categoryId', in: 'query', schema: { type: 'integer' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['price_asc', 'price_desc', 'name_asc', 'newest'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 9 } },
        ],
        responses: { '200': { description: 'Lista paginada de produtos' } },
      },
    },
    '/api/store/cart': {
      get: { tags: ['Loja (Carrinho)'], security: [{ bearerAuth: [] }], summary: 'Listar carrinho do usuário', responses: { '200': { description: 'Itens' } } },
      post: { tags: ['Loja (Carrinho)'], security: [{ bearerAuth: [] }], summary: 'Adicionar item ao carrinho', responses: { '200': { description: 'Atualizado' } } },
    },
    '/api/store/coupons/validate': {
      post: { tags: ['Loja (Checkout)'], security: [{ bearerAuth: [] }], summary: 'Validar cupom de desconto', responses: { '200': { description: 'Cupom válido' }, '400': { description: 'Cupom expirado/esgotado/inválido' } } },
    },
    '/api/store/checkout': {
      post: { tags: ['Loja (Checkout)'], security: [{ bearerAuth: [] }], summary: 'Finalizar compra online', responses: { '201': { description: 'Pedido criado' } } },
    },
    '/api/store/orders': {
      get: { tags: ['Loja (Pedidos)'], security: [{ bearerAuth: [] }], summary: 'Listar meus pedidos', responses: { '200': { description: 'Pedidos do cliente' } } },
    },
    '/api/pdv/register/current': {
      get: { tags: ['PDV (Caixa)'], security: [{ bearerAuth: [] }], summary: 'Status do caixa atual', responses: { '200': { description: 'Dados do turno' } } },
    },
    '/api/pdv/register/open': {
      post: { tags: ['PDV (Caixa)'], security: [{ bearerAuth: [] }], summary: 'Abrir caixa', responses: { '201': { description: 'Caixa aberto' } } },
    },
    '/api/pdv/sales': {
      post: { tags: ['PDV (Vendas)'], security: [{ bearerAuth: [] }], summary: 'Registrar venda presencial no balcão', responses: { '201': { description: 'Venda finalizada' } } },
    },
    '/api/admin/dashboard': {
      get: { tags: ['Admin'], security: [{ bearerAuth: [] }], summary: 'Indicadores do dashboard administrativo', responses: { '200': { description: 'KPIs' }, '403': { description: 'Acesso negado' } } },
    },
    '/api/admin/customers': {
      get: { tags: ['Admin (Clientes)'], security: [{ bearerAuth: [] }], summary: 'Listar clientes', responses: { '200': { description: 'Lista de clientes' } } },
      post: { tags: ['Admin (Clientes)'], security: [{ bearerAuth: [] }], summary: 'Criar cliente', responses: { '201': { description: 'Criado' } } },
    },
    '/api/admin/products': {
      get: { tags: ['Admin (Produtos)'], security: [{ bearerAuth: [] }], summary: 'Listar produtos', responses: { '200': { description: 'Produtos' } } },
      post: { tags: ['Admin (Produtos)'], security: [{ bearerAuth: [] }], summary: 'Criar produto', responses: { '201': { description: 'Criado' } } },
    },
    '/api/admin/orders': {
      get: { tags: ['Admin (Pedidos)'], security: [{ bearerAuth: [] }], summary: 'Listar todos os pedidos', responses: { '200': { description: 'Pedidos' } } },
    },
    '/api/admin/financial': {
      get: { tags: ['Admin (Financeiro)'], security: [{ bearerAuth: [] }], summary: 'Contas a pagar e receber', responses: { '200': { description: 'Lançamentos' } } },
    },
    '/api/admin/reset-demo': {
      post: { tags: ['Admin (Laboratório)'], security: [{ bearerAuth: [] }], summary: 'Restaurar dados iniciais de demonstração', responses: { '200': { description: 'Banco restaurado' } } },
    },
  },
};
