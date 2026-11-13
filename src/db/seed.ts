import bcrypt from 'bcryptjs';
import { repo } from './repo.ts';
import { supabaseAdmin } from '../lib/supabase-server.ts';
import { generateValidTestCPF } from '../utils/validators.ts';

async function syncSupabaseAuthLabAccounts() {
  if (!supabaseAdmin) return;
  try {
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 100,
    });
    const existingByEmail = new Map(
      (listData?.users || []).map((u) => [String(u.email || '').toLowerCase(), u])
    );

    const labAccounts = [
      { email: 'admin@testlab.com.br', password: 'Admin@123', name: 'Jackson Mendes' },
      { email: 'caixa@testlab.com.br', password: 'Caixa@123', name: 'Mariana Duarte' },
      { email: 'usuario@testlab.com.br', password: 'Usuario@123', name: 'Lucas Ferreira' },
    ];

    for (const acc of labAccounts) {
      let authUser = existingByEmail.get(acc.email);
      if (!authUser) {
        const { data: created } = await supabaseAdmin.auth.admin.createUser({
          email: acc.email,
          password: acc.password,
          email_confirm: true,
          user_metadata: { name: acc.name },
        });
        authUser = created?.user || undefined;
      }
      if (authUser?.id) {
        await repo.updateWhere('users', { email: acc.email }, { uid: authUser.id });
      }
    }
  } catch (err) {
    console.warn('Supabase Auth lab account sync skipped:', (err as Error).message);
  }
}

export async function seedDatabase(forceReset = false) {
  if (!forceReset) {
    const existingCount = await repo.countRows('users');
    if (existingCount > 0) {
      return { seeded: false, message: 'Banco já populado.' };
    }
  } else {
    // Clean in FK dependency order
    await repo.deleteAll('reviews');
    await repo.deleteAll('favorites');
    await repo.deleteAll('cart_items');
    await repo.deleteAll('financial_entries');
    await repo.deleteAll('order_items');
    await repo.deleteAll('orders');
    await repo.deleteAll('cash_movements');
    await repo.deleteAll('cash_registers');
    await repo.deleteAll('coupons');
    await repo.deleteAll('products');
    await repo.deleteAll('categories');
    await repo.deleteAll('addresses');
    await repo.deleteAll('audit_logs');
    await repo.deleteAll('users');
    await repo.deleteAll('lab_settings');
  }

  const adminPass = await bcrypt.hash('Admin@123', 10);
  const caixaPass = await bcrypt.hash('Caixa@123', 10);
  const clientePass = await bcrypt.hash('Usuario@123', 10);

  // 1. Users (Mandatory 3 lab accounts + extra test customers)
  const insertedUsers = await repo.insertMany('users', [
    {
      name: 'Jackson Mendes',
      email: 'admin@testlab.com.br',
      passwordHash: adminPass,
      role: 'admin',
      cpf: generateValidTestCPF(101),
      phone: '(11) 90000-0101',
      birthDate: '1992-05-14',
      cep: '01310-100',
      address: 'Av. Paulista (Lab)',
      number: '1000',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      status: 'ativo',
    },
    {
      name: 'Mariana Duarte',
      email: 'caixa@testlab.com.br',
      passwordHash: caixaPass,
      role: 'caixa',
      cpf: generateValidTestCPF(102),
      phone: '(11) 90000-0102',
      birthDate: '1995-08-22',
      cep: '01310-200',
      address: 'Rua Augusta (Lab)',
      number: '450',
      neighborhood: 'Consolação',
      city: 'São Paulo',
      state: 'SP',
      status: 'ativo',
    },
    {
      name: 'Lucas Ferreira',
      email: 'usuario@testlab.com.br',
      passwordHash: clientePass,
      role: 'cliente',
      cpf: generateValidTestCPF(103),
      phone: '(11) 90000-0103',
      birthDate: '1994-11-03',
      cep: '04538-132',
      address: 'Rua Funchal (Fictícia)',
      number: '210',
      complement: 'Apto 42',
      neighborhood: 'Vila Olímpia',
      city: 'São Paulo',
      state: 'SP',
      status: 'ativo',
    },
    {
      name: 'Beatriz Almeida',
      email: 'beatriz.almeida@exemplo.test',
      passwordHash: clientePass,
      role: 'cliente',
      cpf: generateValidTestCPF(104),
      phone: '(21) 90000-0104',
      birthDate: '1990-02-19',
      cep: '22041-001',
      address: 'Av. Atlântica (Fictícia)',
      number: '880',
      neighborhood: 'Copacabana',
      city: 'Rio de Janeiro',
      state: 'RJ',
      status: 'ativo',
    },
    {
      name: 'Rafael Nogueira',
      email: 'rafael.nogueira@exemplo.test',
      passwordHash: clientePass,
      role: 'cliente',
      cpf: generateValidTestCPF(105),
      phone: '(31) 90000-0105',
      birthDate: '1988-07-09',
      cep: '30130-010',
      address: 'Av. Afonso Pena (Fictícia)',
      number: '1500',
      neighborhood: 'Centro',
      city: 'Belo Horizonte',
      state: 'MG',
      status: 'ativo',
    },
    {
      name: 'Camila Azevedo',
      email: 'camila.azevedo@exemplo.test',
      passwordHash: clientePass,
      role: 'cliente',
      cpf: generateValidTestCPF(106),
      phone: '(41) 90000-0106',
      birthDate: '1997-12-01',
      cep: '80420-090',
      address: 'Rua Bispo Dom José (Fictícia)',
      number: '320',
      neighborhood: 'Batel',
      city: 'Curitiba',
      state: 'PR',
      status: 'inativo',
    },
  ]);

  const adminUser = insertedUsers[0];
  const caixaUser = insertedUsers[1];
  const customerUser = insertedUsers[2];
  const customer2 = insertedUsers[3];

  // 2. Saved addresses for customer
  await repo.insertMany('addresses', [
    {
      userId: customerUser.id,
      label: 'Residência Principal',
      cep: '04538-132',
      street: 'Rua Funchal (Fictícia)',
      number: '210',
      complement: 'Apto 42',
      neighborhood: 'Vila Olímpia',
      city: 'São Paulo',
      state: 'SP',
      isDefault: true,
    },
    {
      userId: customerUser.id,
      label: 'Escritório Centro',
      cep: '01001-000',
      street: 'Praça da Sé (Fictícia)',
      number: '100',
      complement: 'Sala 805',
      neighborhood: 'Sé',
      city: 'São Paulo',
      state: 'SP',
      isDefault: false,
    },
  ]);

  // 3. Categories
  const insertedCategories = await repo.insertMany('categories', [
    {
      name: 'Áudio & Acústica',
      slug: 'audio-acustica',
      description: 'Fones studio, caixas acústicas e equipamentos de som.',
      status: 'ativo',
    },
    {
      name: 'Periféricos & Setup',
      slug: 'perifericos-setup',
      description: 'Teclados mecânicos, ergonomia e acessórios de mesa.',
      status: 'ativo',
    },
    {
      name: 'Iluminação & Casa',
      slug: 'iluminacao-casa',
      description: 'Luminárias arquitetônicas e utensílios de design.',
      status: 'ativo',
    },
    {
      name: 'Acessórios & Viagem',
      slug: 'acessorios-viagem',
      description: 'Mochilas impermeáveis e organizadores urbanos.',
      status: 'ativo',
    },
    {
      name: 'Vestíveis & Saúde',
      slug: 'vestiveis-saude',
      description: 'Relógios inteligentes e dispositivos de monitoramento.',
      status: 'ativo',
    },
  ]);

  const catAudio = insertedCategories[0];
  const catPerif = insertedCategories[1];
  const catIlum = insertedCategories[2];
  const catAcess = insertedCategories[3];
  const catVest = insertedCategories[4];

  // 4. Products (including stock, low stock <= 5, and 0 stock!)
  const insertedProducts = await repo.insertMany('products', [
    {
      code: 'AUR-101',
      name: 'Fone Studio Aurora ANC Pro',
      description:
        'Fone over-ear sem fio com cancelamento ativo de ruído híbrido, acabamento em alumínio escovado e autonomia de 45 horas.',
      categoryId: catAudio.id,
      supplier: 'Aurora Acoustics Lab',
      priceCents: 129900,
      stock: 24,
      minStock: 5,
      imageUrl: '/src/assets/images/prod_headphones_1794559983453.jpg',
      status: 'ativo',
    },
    {
      code: 'AUR-102',
      name: 'Teclado Mecânico Aurora K75 Indigo',
      description:
        'Teclado mecânico compacto 75% wireless tri-mode com keycaps PBT duplo-shot em índigo profundo e switches táteis silenciosos.',
      categoryId: catPerif.id,
      supplier: 'KeyCraft Brasil Fictícia',
      priceCents: 74900,
      stock: 16,
      minStock: 5,
      imageUrl: '/src/assets/images/prod_keyboard_1794559984255.jpg',
      status: 'ativo',
    },
    {
      code: 'AUR-103',
      name: 'Luminária Arquitetônica Brass Duo',
      description:
        'Luminária articulada de mesa em alumínio anodizado preto fosco e latão escovado com ajuste de temperatura de cor.',
      categoryId: catIlum.id,
      supplier: 'Lumen Forma Studio',
      priceCents: 58900,
      stock: 4,
      minStock: 5,
      imageUrl: '/src/assets/images/prod_lamp_1794559984201.jpg',
      status: 'ativo',
    },
    {
      code: 'AUR-104',
      name: 'Mochila Urbana Commuter 22L',
      description:
        'Mochila estruturada em nylon balístico impermeável com compartimento acolchoado para notebook de até 16 polegadas.',
      categoryId: catAcess.id,
      supplier: 'Norte Gear Lab',
      priceCents: 45900,
      stock: 19,
      minStock: 5,
      imageUrl: '/src/assets/images/prod_backpack_1794559985752.jpg',
      status: 'ativo',
    },
    {
      code: 'AUR-105',
      name: 'Smartwatch Titânio Aurora S4',
      description:
        'Relógio inteligente com caixa em titânio escovado, vidro safira, GPS de dupla frequência e pulseira em nylon trançado.',
      categoryId: catVest.id,
      supplier: 'Horizonte Wearables',
      priceCents: 189900,
      stock: 3,
      minStock: 5,
      imageUrl: '/src/assets/images/prod_watch_1794559985676.jpg',
      status: 'ativo',
    },
    {
      code: 'AUR-106',
      name: 'Chaleira Bico de Ganso Precision 900ml',
      description:
        'Chaleira elétrica com controle PID de temperatura grau a grau e acabamento preto fosco para cafés filtrados.',
      categoryId: catIlum.id,
      supplier: 'Barista Home Lab',
      priceCents: 64900,
      stock: 0,
      minStock: 5,
      imageUrl: '/src/assets/images/prod_kettle_1794559986475.jpg',
      status: 'ativo',
    },
    {
      code: 'AUR-107',
      name: 'Caixa Acústica Portátil Aura One',
      description:
        'Speaker Bluetooth 360° em alumínio usinado e tecido acústico chumbo com bateria de 18 horas e certificação IP67.',
      categoryId: catAudio.id,
      supplier: 'Aurora Acoustics Lab',
      priceCents: 89900,
      stock: 12,
      minStock: 5,
      imageUrl: '/src/assets/images/prod_speaker_1794559986397.jpg',
      status: 'ativo',
    },
    {
      code: 'AUR-108',
      name: 'Monitor de Mesa LED Studio Bar',
      description:
        'Barra de luz assimétrica para monitor que elimina reflexos na tela e ilumina toda a estação de trabalho.',
      categoryId: catPerif.id,
      supplier: 'Lumen Forma Studio',
      priceCents: 32900,
      stock: 30,
      minStock: 5,
      imageUrl: '/src/assets/images/prod_lamp_1794559984201.jpg',
      status: 'ativo',
    },
    {
      code: 'AUR-109',
      name: 'Fone Monitor Reference Cabo P2',
      description:
        'Fone de referência com drivers planares para estúdio e edição de áudio profissional (edição limitada esgotada).',
      categoryId: catAudio.id,
      supplier: 'Aurora Acoustics Lab',
      priceCents: 149900,
      stock: 0,
      minStock: 3,
      imageUrl: '/src/assets/images/prod_headphones_1794559983453.jpg',
      status: 'ativo',
    },
    {
      code: 'AUR-110',
      name: 'Kit Organizador Tech Travel Pouch',
      description:
        'Estojo rígido compacto para cabos, carregadores GaN, SSDs e adaptadores de viagem.',
      categoryId: catAcess.id,
      supplier: 'Norte Gear Lab',
      priceCents: 18900,
      stock: 42,
      minStock: 8,
      imageUrl: '/src/assets/images/prod_backpack_1794559985752.jpg',
      status: 'ativo',
    },
  ]);

  // 5. Coupons (Valid, Expired, Exhausted)
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  await repo.insertMany('coupons', [
    {
      code: 'AURORA10',
      type: 'percentual',
      value: 10,
      expiresAt: nextMonth,
      usageLimit: 100,
      usedCount: 12,
      status: 'ativo',
    },
    {
      code: 'BEMVINDO50',
      type: 'fixo',
      value: 5000,
      expiresAt: nextMonth,
      usageLimit: 50,
      usedCount: 4,
      status: 'ativo',
    },
    {
      code: 'EXPIRADO20',
      type: 'percentual',
      value: 20,
      expiresAt: lastMonth,
      usageLimit: 100,
      usedCount: 8,
      status: 'ativo',
    },
    {
      code: 'ESGOTADO15',
      type: 'percentual',
      value: 15,
      expiresAt: nextMonth,
      usageLimit: 5,
      usedCount: 5,
      status: 'ativo',
    },
  ]);

  // 6. Cash register (one closed previous shift for history)
  const closedRegister = await repo.insertRow('cash_registers', {
    operatorId: caixaUser.id,
    status: 'fechado',
    initialAmountCents: 30000,
    closingAmountCents: 119900,
    openedAt: new Date(now.getTime() - 26 * 60 * 60 * 1000),
    closedAt: new Date(now.getTime() - 18 * 60 * 60 * 1000),
    notes: 'Turno anterior encerrado sem divergências.',
  });

  await repo.insertMany('cash_movements', [
    {
      registerId: closedRegister.id,
      operatorId: caixaUser.id,
      type: 'suprimento',
      amountCents: 10000,
      reason: 'Reforço de troco em cédulas',
    },
  ]);

  // 7. Orders (Online + PDV across all statuses)
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

  const insertedOrders = await repo.insertMany('orders', [
    {
      orderNumber: 'NA-2026-1001',
      channel: 'online',
      customerId: customerUser.id,
      customerName: customerUser.name,
      customerCpf: customerUser.cpf,
      status: 'Entregue',
      subtotalCents: 129900,
      discountCents: 0,
      shippingCents: 2500,
      totalCents: 132400,
      paymentMethod: 'PIX',
      shippingAddress: JSON.stringify({
        cep: '04538-132',
        street: 'Rua Funchal (Fictícia)',
        number: '210',
        city: 'São Paulo',
        state: 'SP',
      }),
      deliveredAt: twoDaysAgo,
      createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
    },
    {
      orderNumber: 'NA-2026-1002',
      channel: 'online',
      customerId: customerUser.id,
      customerName: customerUser.name,
      customerCpf: customerUser.cpf,
      status: 'Pendente',
      subtotalCents: 74900,
      discountCents: 7490,
      shippingCents: 2200,
      totalCents: 69610,
      couponCode: 'AURORA10',
      paymentMethod: 'Boleto',
      shippingAddress: JSON.stringify({
        cep: '04538-132',
        street: 'Rua Funchal (Fictícia)',
        number: '210',
        city: 'São Paulo',
        state: 'SP',
      }),
      createdAt: oneDayAgo,
    },
    {
      orderNumber: 'NA-2026-1003',
      channel: 'online',
      customerId: customer2.id,
      customerName: customer2.name,
      customerCpf: customer2.cpf,
      status: 'Enviado',
      subtotalCents: 45900,
      discountCents: 0,
      shippingCents: 2900,
      totalCents: 48800,
      paymentMethod: 'Cartão de Crédito',
      shippingAddress: JSON.stringify({
        cep: '22041-001',
        street: 'Av. Atlântica (Fictícia)',
        number: '880',
        city: 'Rio de Janeiro',
        state: 'RJ',
      }),
      createdAt: twoDaysAgo,
    },
    {
      orderNumber: 'NA-2026-1004',
      channel: 'pdv',
      operatorId: caixaUser.id,
      registerId: closedRegister.id,
      customerName: 'Consumidor Balcão',
      customerCpf: generateValidTestCPF(210),
      status: 'Entregue',
      subtotalCents: 89900,
      discountCents: 0,
      shippingCents: 0,
      totalCents: 89900,
      paymentMethod: 'Cartão de Débito',
      deliveredAt: oneDayAgo,
      createdAt: oneDayAgo,
    },
    {
      orderNumber: 'NA-2026-1005',
      channel: 'online',
      customerId: customerUser.id,
      customerName: customerUser.name,
      customerCpf: customerUser.cpf,
      status: 'Entregue',
      subtotalCents: 18900,
      discountCents: 0,
      shippingCents: 1800,
      totalCents: 20700,
      paymentMethod: 'PIX',
      deliveredAt: fifteenDaysAgo,
      createdAt: new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000),
    },
  ]);

  await repo.insertMany('order_items', [
    {
      orderId: insertedOrders[0].id,
      productId: insertedProducts[0].id,
      productCode: insertedProducts[0].code,
      productName: insertedProducts[0].name,
      quantity: 1,
      unitPriceCents: insertedProducts[0].priceCents,
      totalCents: insertedProducts[0].priceCents,
    },
    {
      orderId: insertedOrders[1].id,
      productId: insertedProducts[1].id,
      productCode: insertedProducts[1].code,
      productName: insertedProducts[1].name,
      quantity: 1,
      unitPriceCents: insertedProducts[1].priceCents,
      totalCents: insertedProducts[1].priceCents,
    },
    {
      orderId: insertedOrders[2].id,
      productId: insertedProducts[3].id,
      productCode: insertedProducts[3].code,
      productName: insertedProducts[3].name,
      quantity: 1,
      unitPriceCents: insertedProducts[3].priceCents,
      totalCents: insertedProducts[3].priceCents,
    },
    {
      orderId: insertedOrders[3].id,
      productId: insertedProducts[6].id,
      productCode: insertedProducts[6].code,
      productName: insertedProducts[6].name,
      quantity: 1,
      unitPriceCents: insertedProducts[6].priceCents,
      totalCents: insertedProducts[6].priceCents,
    },
    {
      orderId: insertedOrders[4].id,
      productId: insertedProducts[9].id,
      productCode: insertedProducts[9].code,
      productName: insertedProducts[9].name,
      quantity: 1,
      unitPriceCents: insertedProducts[9].priceCents,
      totalCents: insertedProducts[9].priceCents,
    },
  ]);

  // 8. Financial entries
  const formatDate = (d: Date) => d.toISOString().slice(0, 10);
  const pastDue = formatDate(new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000));
  const futureDue = formatDate(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
  const todayStr = formatDate(now);

  await repo.insertMany('financial_entries', [
    {
      type: 'receber',
      description: 'Pedido NA-2026-1001 — PIX Confirmado',
      amountCents: 132400,
      dueDate: todayStr,
      paidDate: todayStr,
      status: 'Pago',
      orderId: insertedOrders[0].id,
    },
    {
      type: 'receber',
      description: 'Pedido NA-2026-1002 — Boleto Aguardando Compensação',
      amountCents: 69610,
      dueDate: futureDue,
      status: 'Pendente',
      orderId: insertedOrders[1].id,
    },
    {
      type: 'pagar',
      description: 'Fornecedor Aurora Acoustics Lab — Lote Fones ANC',
      amountCents: 450000,
      dueDate: pastDue,
      status: 'Atrasado',
    },
    {
      type: 'pagar',
      description: 'Hospedagem & Infraestrutura Cloud de Testes',
      amountCents: 89000,
      dueDate: futureDue,
      status: 'Pendente',
    },
    {
      type: 'pagar',
      description: 'Fornecedor KeyCraft Brasil Fictícia — Teclados K75',
      amountCents: 310000,
      dueDate: pastDue,
      paidDate: pastDue,
      status: 'Pago',
    },
  ]);

  // 9. Reviews & Favorites
  await repo.insertMany('reviews', [
    {
      productId: insertedProducts[0].id,
      userId: customerUser.id,
      userName: customerUser.name,
      rating: 5,
      comment: 'Excelente isolamento acústico e construção em alumínio muito sólida.',
    },
    {
      productId: insertedProducts[1].id,
      userId: customer2.id,
      userName: customer2.name,
      rating: 5,
      comment: 'Switches muito confortáveis para digitação prolongada e bateria duradoura.',
    },
  ]);

  await repo.insertMany('favorites', [
    {
      userId: customerUser.id,
      productId: insertedProducts[2].id,
    },
  ]);

  // 10. Lab settings & audit log
  await repo.upsertRow('lab_settings', { key: 'simulatedDelayMs', value: '0' }, 'key');
  await repo.upsertRow('lab_settings', { key: 'maxCashierDiscountPercent', value: '15' }, 'key');

  await repo.insertRow('audit_logs', {
    actorEmail: adminUser.email,
    actorRole: 'admin',
    action: 'SEED_DATABASE',
    entity: 'system',
    details: 'Carga inicial de dados fictícios do Nova Aurora Store Test Lab concluída.',
  });

  // Sync lab accounts in Supabase Auth so uid & Supabase Auth logins work too
  await syncSupabaseAuthLabAccounts();

  return { seeded: true, message: 'Dados de demonstração restaurados com sucesso.' };
}
