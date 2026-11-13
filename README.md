# Nova Aurora Store Test Lab

E-commerce completo de laboratório para prática de testes manuais e automatizados (**Selenium WebDriver + Java 17 + JUnit 5 + POM**, **Cucumber/BDD**, **Playwright**, **Cypress** e **Postman**).

> **Aviso de Segurança do Laboratório:** Todos os dados exibidos e cadastrados no seed são **fictícios** (CPFs gerados matematicamente, e-mails de laboratório e telefones de exemplo). Como as credenciais abaixo são públicas, execute o ambiente apenas em rede interna, VPN ou localmente via Docker.

---

## Execução Local com Docker Compose (1 comando)

Cada integrante da equipe pode subir sua própria instância isolada com PostgreSQL, API REST e Front-end:

```bash
docker compose up -d --build
```

Acesse:
- Aplicação Web: `http://localhost:3000`
- Documentação Swagger / OpenAPI (para importar no Postman): `http://localhost:3000/api-docs`
- JSON OpenAPI bruto: `http://localhost:3000/api-docs.json`

---

## Perfis e Credenciais Padrão (`LAB_MODE=true`)

| Perfil | E-mail | Senha | Rota Inicial |
|---|---|---|---|
| **Administrador** | `admin@testlab.com.br` | `Admin@123` | `/admin` |
| **Operador de Caixa (PDV)** | `caixa@testlab.com.br` | `Caixa@123` | `/pdv` |
| **Cliente (Loja)** | `usuario@testlab.com.br` | `Usuario@123` | `/loja` |

---

## Rotas Principais

- `/login` — Tela de autenticação, cadastro, recuperação de senha e painel "Contas de laboratório"
- `/admin` — Dashboard, Usuários, Clientes, Produtos, Categorias, Cupons, Pedidos, Financeiro, Anexos e Laboratório
- `/pdv` — Frente de Caixa (abertura, suprimento/sangria, busca/código de barras, desconto com senha de supervisor, pagamento dividido, cupom e fechamento)
- `/loja` — Vitrine com filtros, paginação, detalhe do produto, carrinho lateral, checkout em etapas, meus pedidos, trocas/devoluções, favoritos e minha conta
- `/laboratorio` — Guia interativo de cenários de teste por módulo para estudo de QA

---

## Como Restaurar os Dados Iniciais

1. Acesse com o perfil **Administrador** (`admin@testlab.com.br` / `Admin@123`).
2. Navegue até **Admin → Laboratório**.
3. Clique em **"Restaurar dados de demonstração"** (`data-testid="reset-demo-button"`) e confirme no modal.
4. Ou via API (Postman): `POST /api/admin/reset-demo` com Bearer Token de Administrador.

---

## Principais `data-testid` para Automação (Selenium / Playwright / Cypress)

Ative o **Modo QA** no cabeçalho (`data-testid="qa-mode-toggle"`) para visualizar ao vivo o `data-testid` de cada componente interativo na tela.

- Autenticação: `email-input`, `password-input`, `login-button`, `fill-admin-button`, `fill-cashier-button`, `fill-customer-button`, `register-tab-button`, `logout-button`
- Feedback e Estados: `success-message`, `error-message`, `loading-spinner`, `access-denied`, `theme-toggle`, `qa-mode-toggle`
- Admin: `save-button`, `customers-table`, `products-table`, `orders-table`, `financial-table`, `reset-demo-button`, `delay-select`
- PDV: `pdv-search-input`, `pdv-open-register-button`, `pdv-close-register-button`, `pdv-discount-input`, `pdv-finish-sale-button`, `pdv-receipt-modal`
- Loja: `store-search-input`, `add-to-cart-button`, `cart-drawer-button`, `cart-total`, `coupon-input`, `apply-coupon-button`, `checkout-button`, `confirm-order-button`

---

Desenvolvido por **Jackson Mendes | Analista de QA**  
GitHub: https://github.com/JacksonTestLab  
LinkedIn: https://www.linkedin.com/in/jackson-mendes-a4731a2b3/
