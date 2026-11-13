-- =============================================================================
-- Nova Aurora Store Test Lab - Seed Idempotente para Supabase SQL Editor
-- Execute após rodar supabase/schema.sql
-- =============================================================================

BEGIN;

-- 1. Usuários (3 contas obrigatórias do laboratório + clientes fictícios)
-- Senhas padrão:
--   admin@testlab.com.br   -> Admin@123
--   caixa@testlab.com.br   -> Caixa@123
--   usuario@testlab.com.br -> Usuario@123
INSERT INTO public.users (
  name, email, password_hash, role, cpf, phone, birth_date,
  cep, address, number, complement, neighborhood, city, state, status
) VALUES
  (
    'Jackson Mendes',
    'admin@testlab.com.br',
    '$2b$10$z9iqHiE3BS0xRKqVYeOUtO6vlv/.fSdU/Hve8ptfLFh0bYZhiXS/i',
    'admin',
    '100.799.819-92',
    '(11) 90000-0101',
    '1992-05-14',
    '01310-100',
    'Av. Paulista (Lab)',
    '1000',
    NULL,
    'Bela Vista',
    'São Paulo',
    'SP',
    'ativo'
  ),
  (
    'Mariana Duarte',
    'caixa@testlab.com.br',
    '$2b$10$L5voYdE/PDnQL6VN2sOH3uV6q9EY2DngyKsT8hUsrILu.GB08Nnce',
    'caixa',
    '100.807.738-00',
    '(11) 90000-0102',
    '1995-08-22',
    '01310-200',
    'Rua Augusta (Lab)',
    '450',
    NULL,
    'Consolação',
    'São Paulo',
    'SP',
    'ativo'
  ),
  (
    'Lucas Ferreira',
    'usuario@testlab.com.br',
    '$2b$10$wtyyQhEtWhiRogBmSUGZ7ubSvg4gmml74ZKWAoiLCXhWs/zxXUXVi',
    'cliente',
    '100.815.657-47',
    '(11) 90000-0103',
    '1994-11-03',
    '04538-132',
    'Rua Funchal (Fictícia)',
    '210',
    'Apto 42',
    'Vila Olímpia',
    'São Paulo',
    'SP',
    'ativo'
  ),
  (
    'Beatriz Almeida',
    'beatriz.almeida@exemplo.test',
    '$2b$10$wtyyQhEtWhiRogBmSUGZ7ubSvg4gmml74ZKWAoiLCXhWs/zxXUXVi',
    'cliente',
    '100.823.576-84',
    '(21) 90000-0104',
    '1990-02-19',
    '22041-001',
    'Av. Atlântica (Fictícia)',
    '880',
    NULL,
    'Copacabana',
    'Rio de Janeiro',
    'RJ',
    'ativo'
  ),
  (
    'Rafael Nogueira',
    'rafael.nogueira@exemplo.test',
    '$2b$10$wtyyQhEtWhiRogBmSUGZ7ubSvg4gmml74ZKWAoiLCXhWs/zxXUXVi',
    'cliente',
    '100.831.495-11',
    '(31) 90000-0105',
    '1988-07-09',
    '30130-010',
    'Av. Afonso Pena (Fictícia)',
    '1500',
    NULL,
    'Centro',
    'Belo Horizonte',
    'MG',
    'ativo'
  ),
  (
    'Camila Azevedo',
    'camila.azevedo@exemplo.test',
    '$2b$10$wtyyQhEtWhiRogBmSUGZ7ubSvg4gmml74ZKWAoiLCXhWs/zxXUXVi',
    'cliente',
    '100.839.414-95',
    '(41) 90000-0106',
    '1997-12-01',
    '80420-090',
    'Rua Bispo Dom José (Fictícia)',
    '320',
    NULL,
    'Batel',
    'Curitiba',
    'PR',
    'inativo'
  )
ON CONFLICT (email) DO NOTHING;

-- 2. Endereços salvos para Lucas Ferreira
INSERT INTO public.addresses (user_id, label, cep, street, number, complement, neighborhood, city, state, is_default)
SELECT u.id, v.label, v.cep, v.street, v.number, v.complement, v.neighborhood, v.city, v.state, v.is_default
FROM public.users u
CROSS JOIN (
  VALUES
    ('Residência Principal', '04538-132', 'Rua Funchal (Fictícia)', '210', 'Apto 42', 'Vila Olímpia', 'São Paulo', 'SP', TRUE),
    ('Escritório Centro', '01001-000', 'Praça da Sé (Fictícia)', '100', 'Sala 805', 'Sé', 'São Paulo', 'SP', FALSE)
) AS v(label, cep, street, number, complement, neighborhood, city, state, is_default)
WHERE u.email = 'usuario@testlab.com.br'
  AND NOT EXISTS (
    SELECT 1 FROM public.addresses a WHERE a.user_id = u.id AND a.label = v.label
  );

-- 3. Categorias
INSERT INTO public.categories (name, slug, description, status) VALUES
  ('Áudio & Acústica', 'audio-acustica', 'Fones studio, caixas acústicas e equipamentos de som.', 'ativo'),
  ('Periféricos & Setup', 'perifericos-setup', 'Teclados mecânicos, ergonomia e acessórios de mesa.', 'ativo'),
  ('Iluminação & Casa', 'iluminacao-casa', 'Luminárias arquitetônicas e utensílios de design.', 'ativo'),
  ('Acessórios & Viagem', 'acessorios-viagem', 'Mochilas impermeáveis e organizadores urbanos.', 'ativo'),
  ('Vestíveis & Saúde', 'vestiveis-saude', 'Relógios inteligentes e dispositivos de monitoramento.', 'ativo')
ON CONFLICT (slug) DO NOTHING;

-- 4. Produtos
INSERT INTO public.products (code, name, description, category_id, supplier, price_cents, stock, min_stock, image_url, status)
VALUES
  ('AUR-101', 'Fone Studio Aurora ANC Pro', 'Fone over-ear sem fio com cancelamento ativo de ruído híbrido, acabamento em alumínio escovado e autonomia de 45 horas.', (SELECT id FROM public.categories WHERE slug = 'audio-acustica'), 'Aurora Acoustics Lab', 129900, 24, 5, '/src/assets/images/prod_headphones_1794559983453.jpg', 'ativo'),
  ('AUR-102', 'Teclado Mecânico Aurora K75 Indigo', 'Teclado mecânico compacto 75% wireless tri-mode com keycaps PBT duplo-shot em índigo profundo e switches táteis silenciosos.', (SELECT id FROM public.categories WHERE slug = 'perifericos-setup'), 'KeyCraft Brasil Fictícia', 74900, 16, 5, '/src/assets/images/prod_keyboard_1794559984255.jpg', 'ativo'),
  ('AUR-103', 'Luminária Arquitetônica Brass Duo', 'Luminária articulada de mesa em alumínio anodizado preto fosco e latão escovado com ajuste de temperatura de cor.', (SELECT id FROM public.categories WHERE slug = 'iluminacao-casa'), 'Lumen Forma Studio', 58900, 4, 5, '/src/assets/images/prod_lamp_1794559984201.jpg', 'ativo'),
  ('AUR-104', 'Mochila Urbana Commuter 22L', 'Mochila estruturada em nylon balístico impermeável com compartimento acolchoado para notebook de até 16 polegadas.', (SELECT id FROM public.categories WHERE slug = 'acessorios-viagem'), 'Norte Gear Lab', 45900, 19, 5, '/src/assets/images/prod_backpack_1794559985752.jpg', 'ativo'),
  ('AUR-105', 'Smartwatch Titânio Aurora S4', 'Relógio inteligente com caixa em titânio escovado, vidro safira, GPS de dupla frequência e pulseira em nylon trançado.', (SELECT id FROM public.categories WHERE slug = 'vestiveis-saude'), 'Horizonte Wearables', 189900, 3, 5, '/src/assets/images/prod_watch_1794559985676.jpg', 'ativo'),
  ('AUR-106', 'Chaleira Bico de Ganso Precision 900ml', 'Chaleira elétrica com controle PID de temperatura grau a grau e acabamento preto fosco para cafés filtrados.', (SELECT id FROM public.categories WHERE slug = 'iluminacao-casa'), 'Barista Home Lab', 64900, 0, 5, '/src/assets/images/prod_kettle_1794559986475.jpg', 'ativo'),
  ('AUR-107', 'Caixa Acústica Portátil Aura One', 'Speaker Bluetooth 360° em alumínio usinado e tecido acústico chumbo com bateria de 18 horas e certificação IP67.', (SELECT id FROM public.categories WHERE slug = 'audio-acustica'), 'Aurora Acoustics Lab', 89900, 12, 5, '/src/assets/images/prod_speaker_1794559986397.jpg', 'ativo'),
  ('AUR-108', 'Monitor de Mesa LED Studio Bar', 'Barra de luz assimétrica para monitor que elimina reflexos na tela e ilumina toda a estação de trabalho.', (SELECT id FROM public.categories WHERE slug = 'perifericos-setup'), 'Lumen Forma Studio', 32900, 30, 5, '/src/assets/images/prod_lamp_1794559984201.jpg', 'ativo'),
  ('AUR-109', 'Fone Monitor Reference Cabo P2', 'Fone de referência com drivers planares para estúdio e edição de áudio profissional (edição limitada esgotada).', (SELECT id FROM public.categories WHERE slug = 'audio-acustica'), 'Aurora Acoustics Lab', 149900, 0, 3, '/src/assets/images/prod_headphones_1794559983453.jpg', 'ativo'),
  ('AUR-110', 'Kit Organizador Tech Travel Pouch', 'Estojo rígido compacto para cabos, carregadores GaN, SSDs e adaptadores de viagem.', (SELECT id FROM public.categories WHERE slug = 'acessorios-viagem'), 'Norte Gear Lab', 18900, 42, 8, '/src/assets/images/prod_backpack_1794559985752.jpg', 'ativo')
ON CONFLICT (code) DO NOTHING;

-- 5. Cupons
INSERT INTO public.coupons (code, type, value, expires_at, usage_limit, used_count, status) VALUES
  ('AURORA10', 'percentual', 10, NOW() + INTERVAL '30 days', 100, 12, 'ativo'),
  ('BEMVINDO50', 'fixo', 5000, NOW() + INTERVAL '30 days', 50, 4, 'ativo'),
  ('EXPIRADO20', 'percentual', 20, NOW() - INTERVAL '30 days', 100, 8, 'ativo'),
  ('ESGOTADO15', 'percentual', 15, NOW() + INTERVAL '30 days', 5, 5, 'ativo')
ON CONFLICT (code) DO NOTHING;

-- 6. Caixa PDV histórico e movimentação
INSERT INTO public.cash_registers (operator_id, status, initial_amount_cents, closing_amount_cents, opened_at, closed_at, notes)
SELECT u.id, 'fechado', 30000, 119900, NOW() - INTERVAL '26 hours', NOW() - INTERVAL '18 hours', 'Turno anterior encerrado sem divergências.'
FROM public.users u
WHERE u.email = 'caixa@testlab.com.br'
  AND NOT EXISTS (SELECT 1 FROM public.cash_registers);

INSERT INTO public.cash_movements (register_id, operator_id, type, amount_cents, reason)
SELECT cr.id, cr.operator_id, 'suprimento', 10000, 'Reforço de troco em cédulas'
FROM public.cash_registers cr
WHERE NOT EXISTS (SELECT 1 FROM public.cash_movements);

-- 7. Pedidos de exemplo (Online + PDV)
INSERT INTO public.orders (
  order_number, channel, customer_id, operator_id, register_id, customer_name, customer_cpf,
  status, subtotal_cents, discount_cents, shipping_cents, total_cents, coupon_code,
  payment_method, shipping_address, delivered_at, created_at
) VALUES
  (
    'NA-2026-1001', 'online',
    (SELECT id FROM public.users WHERE email = 'usuario@testlab.com.br'), NULL, NULL,
    'Lucas Ferreira', '100.815.657-47',
    'Entregue', 129900, 0, 2500, 132400, NULL,
    'PIX', '{"cep":"04538-132","street":"Rua Funchal (Fictícia)","number":"210","city":"São Paulo","state":"SP"}',
    NOW() - INTERVAL '2 days', NOW() - INTERVAL '4 days'
  ),
  (
    'NA-2026-1002', 'online',
    (SELECT id FROM public.users WHERE email = 'usuario@testlab.com.br'), NULL, NULL,
    'Lucas Ferreira', '100.815.657-47',
    'Pendente', 74900, 7490, 2200, 69610, 'AURORA10',
    'Boleto', '{"cep":"04538-132","street":"Rua Funchal (Fictícia)","number":"210","city":"São Paulo","state":"SP"}',
    NULL, NOW() - INTERVAL '1 day'
  ),
  (
    'NA-2026-1003', 'online',
    (SELECT id FROM public.users WHERE email = 'beatriz.almeida@exemplo.test'), NULL, NULL,
    'Beatriz Almeida', '100.823.576-84',
    'Enviado', 45900, 0, 2900, 48800, NULL,
    'Cartão de Crédito', '{"cep":"22041-001","street":"Av. Atlântica (Fictícia)","number":"880","city":"Rio de Janeiro","state":"RJ"}',
    NULL, NOW() - INTERVAL '2 days'
  ),
  (
    'NA-2026-1004', 'pdv',
    NULL, (SELECT id FROM public.users WHERE email = 'caixa@testlab.com.br'), (SELECT id FROM public.cash_registers ORDER BY id LIMIT 1),
    'Consumidor Balcão', '101.662.990-73',
    'Entregue', 89900, 0, 0, 89900, NULL,
    'Cartão de Débito', NULL,
    NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'
  ),
  (
    'NA-2026-1005', 'online',
    (SELECT id FROM public.users WHERE email = 'usuario@testlab.com.br'), NULL, NULL,
    'Lucas Ferreira', '100.815.657-47',
    'Entregue', 18900, 0, 1800, 20700, NULL,
    'PIX', NULL,
    NOW() - INTERVAL '15 days', NOW() - INTERVAL '18 days'
  )
ON CONFLICT (order_number) DO NOTHING;

-- 8. Itens dos pedidos
INSERT INTO public.order_items (order_id, product_id, product_code, product_name, quantity, unit_price_cents, total_cents)
SELECT o.id, p.id, p.code, p.name, 1, p.price_cents, p.price_cents
FROM (
  VALUES
    ('NA-2026-1001', 'AUR-101'),
    ('NA-2026-1002', 'AUR-102'),
    ('NA-2026-1003', 'AUR-104'),
    ('NA-2026-1004', 'AUR-107'),
    ('NA-2026-1005', 'AUR-110')
) AS m(order_number, code)
JOIN public.orders o ON o.order_number = m.order_number
JOIN public.products p ON p.code = m.code
WHERE NOT EXISTS (
  SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id AND oi.product_id = p.id
);

-- 9. Lançamentos financeiros
INSERT INTO public.financial_entries (type, description, amount_cents, due_date, paid_date, status, order_id)
SELECT v.type, v.description, v.amount_cents, v.due_date, v.paid_date, v.status, v.order_id
FROM (
  VALUES
    ('receber', 'Pedido NA-2026-1001 — PIX Confirmado', 132400, TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD'), TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD'), 'Pago', (SELECT id FROM public.orders WHERE order_number = 'NA-2026-1001')),
    ('receber', 'Pedido NA-2026-1002 — Boleto Aguardando Compensação', 69610, TO_CHAR(CURRENT_DATE + 7, 'YYYY-MM-DD'), NULL, 'Pendente', (SELECT id FROM public.orders WHERE order_number = 'NA-2026-1002')),
    ('pagar', 'Fornecedor Aurora Acoustics Lab — Lote Fones ANC', 450000, TO_CHAR(CURRENT_DATE - 5, 'YYYY-MM-DD'), NULL, 'Atrasado', NULL),
    ('pagar', 'Hospedagem & Infraestrutura Cloud de Testes', 89000, TO_CHAR(CURRENT_DATE + 7, 'YYYY-MM-DD'), NULL, 'Pendente', NULL),
    ('pagar', 'Fornecedor KeyCraft Brasil Fictícia — Teclados K75', 310000, TO_CHAR(CURRENT_DATE - 5, 'YYYY-MM-DD'), TO_CHAR(CURRENT_DATE - 5, 'YYYY-MM-DD'), 'Pago', NULL)
) AS v(type, description, amount_cents, due_date, paid_date, status, order_id)
WHERE NOT EXISTS (
  SELECT 1 FROM public.financial_entries fe WHERE fe.description = v.description
);

-- 10. Avaliações e Favoritos
INSERT INTO public.reviews (product_id, user_id, user_name, rating, comment)
SELECT p.id, u.id, u.name, 5, 'Excelente isolamento acústico e construção em alumínio muito sólida.'
FROM public.products p, public.users u
WHERE p.code = 'AUR-101' AND u.email = 'usuario@testlab.com.br'
  AND NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.product_id = p.id AND r.user_id = u.id);

INSERT INTO public.reviews (product_id, user_id, user_name, rating, comment)
SELECT p.id, u.id, u.name, 5, 'Switches muito confortáveis para digitação prolongada e bateria duradoura.'
FROM public.products p, public.users u
WHERE p.code = 'AUR-102' AND u.email = 'beatriz.almeida@exemplo.test'
  AND NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.product_id = p.id AND r.user_id = u.id);

INSERT INTO public.favorites (user_id, product_id)
SELECT u.id, p.id
FROM public.users u, public.products p
WHERE u.email = 'usuario@testlab.com.br' AND p.code = 'AUR-103'
ON CONFLICT (user_id, product_id) DO NOTHING;

-- 11. Configurações do Laboratório e Auditoria
INSERT INTO public.lab_settings (key, value) VALUES
  ('simulatedDelayMs', '0'),
  ('maxCashierDiscountPercent', '15')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.audit_logs (actor_email, actor_role, action, entity, details)
SELECT 'admin@testlab.com.br', 'admin', 'SEED_DATABASE', 'system', 'Carga inicial de dados fictícios do Nova Aurora Store Test Lab concluída.'
WHERE NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'SEED_DATABASE');

-- 12. Sincronizar sequências SERIAL
SELECT setval(pg_get_serial_sequence('public.users', 'id'), COALESCE((SELECT MAX(id) FROM public.users), 1));
SELECT setval(pg_get_serial_sequence('public.addresses', 'id'), COALESCE((SELECT MAX(id) FROM public.addresses), 1));
SELECT setval(pg_get_serial_sequence('public.categories', 'id'), COALESCE((SELECT MAX(id) FROM public.categories), 1));
SELECT setval(pg_get_serial_sequence('public.products', 'id'), COALESCE((SELECT MAX(id) FROM public.products), 1));
SELECT setval(pg_get_serial_sequence('public.coupons', 'id'), COALESCE((SELECT MAX(id) FROM public.coupons), 1));
SELECT setval(pg_get_serial_sequence('public.cash_registers', 'id'), COALESCE((SELECT MAX(id) FROM public.cash_registers), 1));
SELECT setval(pg_get_serial_sequence('public.cash_movements', 'id'), COALESCE((SELECT MAX(id) FROM public.cash_movements), 1));
SELECT setval(pg_get_serial_sequence('public.orders', 'id'), COALESCE((SELECT MAX(id) FROM public.orders), 1));
SELECT setval(pg_get_serial_sequence('public.order_items', 'id'), COALESCE((SELECT MAX(id) FROM public.order_items), 1));
SELECT setval(pg_get_serial_sequence('public.financial_entries', 'id'), COALESCE((SELECT MAX(id) FROM public.financial_entries), 1));
SELECT setval(pg_get_serial_sequence('public.reviews', 'id'), COALESCE((SELECT MAX(id) FROM public.reviews), 1));
SELECT setval(pg_get_serial_sequence('public.favorites', 'id'), COALESCE((SELECT MAX(id) FROM public.favorites), 1));
SELECT setval(pg_get_serial_sequence('public.audit_logs', 'id'), COALESCE((SELECT MAX(id) FROM public.audit_logs), 1));

COMMIT;
