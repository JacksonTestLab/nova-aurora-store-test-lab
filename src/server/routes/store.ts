import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { repo } from '../../db/repo.ts';
import {
  AuthRequest,
  logAudit,
  requireAuth,
  toSafeUser,
} from '../../middleware/auth.ts';
import { getLocalDateYMD } from '../../utils/date.ts';
import {
  isValidCPF,
  maskCEP,
  maskCPF,
  maskPhone,
  sanitizeText,
} from '../../utils/validators.ts';

const router = Router();

// --- PUBLIC STOREFRONT ---
router.get('/categories', async (_req, res) => {
  try {
    const rows = await repo.findWhere(
      'categories',
      { status: 'ativo' },
      { orderBy: 'name' }
    );
    return res.json({ categories: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao carregar categorias.' });
  }
});

router.get('/products', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
    const minPriceCents = req.query.minPriceCents ? Number(req.query.minPriceCents) : null;
    const maxPriceCents = req.query.maxPriceCents ? Number(req.query.maxPriceCents) : null;
    const inStockOnly = req.query.inStockOnly === 'true';
    const sort = String(req.query.sort || 'newest');
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(48, Math.max(1, Number(req.query.limit || 8)));

    const rows = await repo.findWhere('products', { status: 'ativo' });
    const cats = await repo.listAll('categories');
    const catMap = new Map(cats.map((c) => [c.id, c.name]));

    let list = rows.map((p) => ({
      ...p,
      categoryName: p.categoryId ? catMap.get(p.categoryId) || 'Geral' : 'Geral',
    }));

    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }
    if (categoryId) list = list.filter((p) => p.categoryId === categoryId);
    if (minPriceCents !== null && !Number.isNaN(minPriceCents)) {
      list = list.filter((p) => p.priceCents >= minPriceCents);
    }
    if (maxPriceCents !== null && !Number.isNaN(maxPriceCents)) {
      list = list.filter((p) => p.priceCents <= maxPriceCents);
    }
    if (inStockOnly) list = list.filter((p) => p.stock > 0);

    if (sort === 'price_asc') list.sort((a, b) => a.priceCents - b.priceCents);
    else if (sort === 'price_desc') list.sort((a, b) => b.priceCents - a.priceCents);
    else if (sort === 'name_asc') list.sort((a, b) => a.name.localeCompare(b.name));
    else list.sort((a, b) => b.id - a.id);

    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;
    const paginated = list.slice(start, start + limit);

    return res.json({
      products: paginated,
      pagination: { page: safePage, limit, total, totalPages },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao carregar vitrine de produtos.' });
  }
});

router.get('/products/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const prod = await repo.findOneWhere('products', { id });
    if (!prod || prod.status !== 'ativo') {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }
    const cats = await repo.listAll('categories');
    const cat = cats.find((c) => c.id === prod.categoryId);
    const prodReviews = await repo.findWhere(
      'reviews',
      { productId: id },
      { orderBy: 'createdAt', desc: true }
    );

    const avgRating =
      prodReviews.length > 0
        ? prodReviews.reduce((acc, r) => acc + r.rating, 0) / prodReviews.length
        : 0;

    return res.json({
      product: { ...prod, categoryName: cat?.name || 'Geral' },
      reviews: prodReviews,
      avgRating: Number(avgRating.toFixed(1)),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao carregar detalhes do produto.' });
  }
});

// --- AUTHENTICATED STORE ROUTES ---
router.get('/cart', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await repo.findWhere('cart_items', { userId: req.user!.id });
    if (rows.length === 0) return res.json({ items: [], subtotalCents: 0 });

    const prodIds = rows.map((r) => r.productId);
    const prods = await repo.findIn('products', 'id', prodIds);
    const prodMap = new Map(prods.map((p) => [p.id, p]));

    const items = rows
      .map((r) => {
        const p = prodMap.get(r.productId);
        if (!p) return null;
        return {
          id: r.id,
          productId: p.id,
          code: p.code,
          name: p.name,
          imageUrl: p.imageUrl,
          priceCents: p.priceCents,
          stock: p.stock,
          quantity: Math.min(r.quantity, Math.max(1, p.stock)),
        };
      })
      .filter(Boolean);

    const subtotalCents = items.reduce(
      (acc: number, item: any) => acc + item.priceCents * item.quantity,
      0
    );

    return res.json({ items, subtotalCents });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao carregar carrinho.' });
  }
});

router.post('/cart', requireAuth, async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.body?.productId);
    const quantity = Math.max(1, Number(req.body?.quantity || 1));

    const prod = await repo.findOneWhere('products', { id: productId });
    if (!prod || prod.status !== 'ativo') {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }
    if (prod.stock <= 0) {
      return res.status(400).json({ error: 'Produto indisponível no momento (sem estoque).' });
    }

    const existing = await repo.findOneWhere('cart_items', {
      userId: req.user!.id,
      productId,
    });

    const targetQty = (existing ? existing.quantity : 0) + quantity;
    if (targetQty > prod.stock) {
      return res.status(400).json({
        error: `Quantidade solicitada (${targetQty}) excede o estoque disponível (${prod.stock}).`,
      });
    }

    if (existing) {
      await repo.updateWhere(
        'cart_items',
        { id: existing.id },
        { quantity: targetQty, updatedAt: new Date() }
      );
    } else {
      await repo.insertRow('cart_items', {
        userId: req.user!.id,
        productId,
        quantity: targetQty,
      });
    }

    return res.json({ message: 'Produto adicionado ao carrinho.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao adicionar ao carrinho.' });
  }
});

router.patch('/cart/:productId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.productId);
    const quantity = Number(req.body?.quantity);
    if (Number.isNaN(quantity) || quantity < 1) {
      return res.status(400).json({ error: 'A quantidade mínima é 1.' });
    }
    const prod = await repo.findOneWhere('products', { id: productId });
    if (!prod) return res.status(404).json({ error: 'Produto não encontrado.' });
    if (quantity > prod.stock) {
      return res.status(400).json({
        error: `Estoque insuficiente. Máximo disponível: ${prod.stock}.`,
      });
    }

    await repo.updateWhere(
      'cart_items',
      { userId: req.user!.id, productId },
      { quantity, updatedAt: new Date() }
    );

    return res.json({ message: 'Quantidade atualizada.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao atualizar carrinho.' });
  }
});

router.delete('/cart/:productId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.productId);
    await repo.deleteWhere('cart_items', { userId: req.user!.id, productId });
    return res.json({ message: 'Item removido do carrinho.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao remover item.' });
  }
});

router.delete('/cart', requireAuth, async (req: AuthRequest, res) => {
  try {
    await repo.deleteWhere('cart_items', { userId: req.user!.id });
    return res.json({ message: 'Carrinho limpo com sucesso.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao limpar carrinho.' });
  }
});

router.post('/coupons/validate', requireAuth, async (req, res) => {
  try {
    const code = sanitizeText(req.body?.code).toUpperCase();
    const subtotalCents = Number(req.body?.subtotalCents || 0);
    if (!code) return res.status(400).json({ error: 'Informe um código de cupom.' });

    const coupon = await repo.findOneWhere('coupons', { code });
    if (!coupon || coupon.status !== 'ativo') {
      return res.status(404).json({ error: 'Cupom inválido ou inativo.' });
    }
    if (new Date(coupon.expiresAt) < new Date()) {
      return res.status(400).json({ error: `O cupom ${coupon.code} está expirado.` });
    }
    if (coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ error: `O cupom ${coupon.code} atingiu o limite de usos.` });
    }

    const discountCents =
      coupon.type === 'percentual'
        ? Math.round((subtotalCents * coupon.value) / 100)
        : Math.min(subtotalCents, coupon.value);

    return res.json({
      coupon: { code: coupon.code, type: coupon.type, value: coupon.value },
      discountCents,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao validar cupom.' });
  }
});

router.post('/checkout', requireAuth, async (req: AuthRequest, res) => {
  try {
    const shippingAddress = req.body?.shippingAddress;
    const shippingOption = String(req.body?.shippingOption || 'padrao');
    const paymentMethod = String(req.body?.paymentMethod || 'PIX');
    const couponCode = sanitizeText(req.body?.couponCode || '').toUpperCase();

    if (
      !shippingAddress?.cep ||
      !shippingAddress?.street ||
      !shippingAddress?.number ||
      !shippingAddress?.city ||
      !shippingAddress?.state
    ) {
      return res.status(400).json({ error: 'Preencha todos os campos do endereço de entrega.' });
    }

    if (!['PIX', 'Cartão de Crédito', 'Boleto'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Forma de pagamento inválida.' });
    }

    const cartRows = await repo.findWhere('cart_items', { userId: req.user!.id });
    if (cartRows.length === 0) {
      return res.status(400).json({ error: 'Seu carrinho está vazio.' });
    }

    const prodIds = cartRows.map((c) => c.productId);
    const prods = await repo.findIn('products', 'id', prodIds);
    const prodMap = new Map(prods.map((p) => [p.id, p]));

    let subtotalCents = 0;
    const resolved: Array<{ product: any; quantity: number }> = [];

    for (const row of cartRows) {
      const p = prodMap.get(row.productId);
      if (!p || p.status !== 'ativo') {
        return res.status(400).json({ error: 'Um dos produtos do carrinho não está mais disponível.' });
      }
      if (p.stock < row.quantity) {
        return res.status(400).json({
          error: `Estoque insuficiente para "${p.name}". Disponível: ${p.stock}.`,
        });
      }
      subtotalCents += p.priceCents * row.quantity;
      resolved.push({ product: p, quantity: row.quantity });
    }

    let discountCents = 0;
    let appliedCoupon: any = null;
    if (couponCode) {
      const c = await repo.findOneWhere('coupons', { code: couponCode });
      if (!c || c.status !== 'ativo') {
        return res.status(400).json({ error: 'Cupom inválido.' });
      }
      if (new Date(c.expiresAt) < new Date()) {
        return res.status(400).json({ error: 'Cupom expirado.' });
      }
      if (c.usedCount >= c.usageLimit) {
        return res.status(400).json({ error: 'Cupom esgotado.' });
      }
      appliedCoupon = c;
      discountCents =
        c.type === 'percentual'
          ? Math.round((subtotalCents * c.value) / 100)
          : Math.min(subtotalCents, c.value);
    }

    const shippingCents = shippingOption === 'expresso' ? 3900 : subtotalCents >= 100000 ? 0 : 2200;
    const totalCents = Math.max(0, subtotalCents - discountCents + shippingCents);
    const initialStatus = paymentMethod === 'Boleto' ? 'Pendente' : 'Pago';

    // Deduct stock
    for (const r of resolved) {
      await repo.adjustNumericColumn('products', r.product.id, 'stock', -r.quantity);
    }

    if (appliedCoupon) {
      await repo.adjustNumericColumn('coupons', appliedCoupon.id, 'usedCount', 1);
    }

    const orderNumber = `NA-2026-${Date.now().toString().slice(-5)}`;
    const createdOrder = await repo.insertRow('orders', {
      orderNumber,
      channel: 'online',
      customerId: req.user!.id,
      customerName: req.user!.name,
      customerCpf: req.user!.cpf,
      status: initialStatus,
      subtotalCents,
      discountCents,
      shippingCents,
      totalCents,
      couponCode: appliedCoupon?.code || null,
      paymentMethod,
      shippingAddress: JSON.stringify(shippingAddress),
    });

    await repo.insertMany(
      'order_items',
      resolved.map((r) => ({
        orderId: createdOrder.id,
        productId: r.product.id,
        productCode: r.product.code,
        productName: r.product.name,
        quantity: r.quantity,
        unitPriceCents: r.product.priceCents,
        totalCents: r.product.priceCents * r.quantity,
      }))
    );

    const todayStr = getLocalDateYMD(new Date());
    await repo.insertRow('financial_entries', {
      type: 'receber',
      description: `Pedido Online ${orderNumber} — ${paymentMethod}`,
      amountCents: totalCents,
      dueDate: todayStr,
      paidDate: initialStatus === 'Pago' ? todayStr : null,
      status: initialStatus === 'Pago' ? 'Pago' : 'Pendente',
      orderId: createdOrder.id,
    });

    await repo.deleteWhere('cart_items', { userId: req.user!.id });
    await logAudit(req.user, 'ONLINE_CHECKOUT', 'orders', `Pedido ${orderNumber} criado.`);

    return res.status(201).json({ order: createdOrder });
  } catch (err) {
    console.error('Checkout error:', err);
    return res.status(500).json({ error: 'Erro ao finalizar pedido.' });
  }
});

// --- CUSTOMER ORDERS ---
router.get('/orders', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userOrders = await repo.findWhere(
      'orders',
      { customerId: req.user!.id },
      { orderBy: 'createdAt', desc: true }
    );

    const ids = userOrders.map((o) => o.id);
    const items = await repo.findIn('order_items', 'orderId', ids);

    const enriched = userOrders.map((o) => ({
      ...o,
      items: items.filter((i) => i.orderId === o.id),
    }));

    return res.json({ orders: enriched });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao carregar seus pedidos.' });
  }
});

router.post('/orders/:id/cancel', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const order = await repo.findOneWhere('orders', { id, customerId: req.user!.id });

    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
    if (!['Pendente', 'Pago'].includes(order.status)) {
      return res.status(400).json({
        error: `Pedidos com status "${order.status}" não podem ser cancelados pelo cliente.`,
      });
    }

    const items = await repo.findWhere('order_items', { orderId: order.id });
    for (const item of items) {
      await repo.adjustNumericColumn('products', item.productId, 'stock', item.quantity);
    }

    const [updated] = await repo.updateWhere(
      'orders',
      { id },
      {
        status: 'Cancelado',
        cancellationReason: 'Cancelado pelo cliente antes do envio.',
      }
    );

    await logAudit(req.user, 'CUSTOMER_CANCEL_ORDER', 'orders', `Pedido ${order.orderNumber} cancelado pelo cliente.`);
    return res.json({ order: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao cancelar pedido.' });
  }
});

router.post('/orders/:id/return', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const reason = sanitizeText(req.body?.reason || '');
    if (!reason || reason.length < 5) {
      return res.status(400).json({ error: 'Informe o motivo da troca/devolução (mínimo 5 caracteres).' });
    }

    const order = await repo.findOneWhere('orders', { id, customerId: req.user!.id });

    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
    if (order.status !== 'Entregue') {
      return res.status(400).json({ error: 'Apenas pedidos já entregues podem solicitar troca ou devolução.' });
    }
    if (order.returnStatus !== 'Nenhum') {
      return res.status(400).json({ error: 'Já existe uma solicitação de troca/devolução para este pedido.' });
    }

    const deliveredRef = order.deliveredAt ? new Date(order.deliveredAt) : new Date(order.createdAt);
    const diffDays = (Date.now() - deliveredRef.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 7) {
      return res.status(400).json({
        error: 'Prazo de 7 dias corridos após a entrega expirado para solicitação de troca ou devolução.',
      });
    }

    const [updated] = await repo.updateWhere(
      'orders',
      { id },
      { returnStatus: 'Solicitado', returnReason: reason }
    );

    await logAudit(req.user, 'REQUEST_RETURN', 'orders', `Solicitação de devolução para ${order.orderNumber}.`);
    return res.json({ order: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao solicitar devolução.' });
  }
});

// --- FAVORITES ---
router.get('/favorites', requireAuth, async (req: AuthRequest, res) => {
  try {
    const favs = await repo.findWhere('favorites', { userId: req.user!.id });
    if (favs.length === 0) return res.json({ favorites: [] });
    const prods = await repo.findIn(
      'products',
      'id',
      favs.map((f) => f.productId)
    );
    return res.json({ favorites: prods });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar favoritos.' });
  }
});

router.post('/favorites/:productId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.productId);
    const existing = await repo.findOneWhere('favorites', {
      userId: req.user!.id,
      productId,
    });
    if (!existing) {
      await repo.insertRow('favorites', { userId: req.user!.id, productId });
    }
    return res.json({ favorited: true });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao favoritar produto.' });
  }
});

router.delete('/favorites/:productId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.productId);
    await repo.deleteWhere('favorites', { userId: req.user!.id, productId });
    return res.json({ favorited: false });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao remover favorito.' });
  }
});

// --- REVIEWS ---
router.post('/products/:id/reviews', requireAuth, async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.id);
    const rating = Number(req.body?.rating);
    const comment = sanitizeText(req.body?.comment || '');

    if (Number.isNaN(rating) || rating < 1 || rating > 5 || comment.length < 3) {
      return res.status(400).json({ error: 'Informe uma nota de 1 a 5 e um comentário válido.' });
    }

    // Check if customer bought this product
    const userOrders = await repo.findWhere('orders', { customerId: req.user!.id });
    const validOrderIds = userOrders
      .filter((o) => o.status !== 'Cancelado')
      .map((o) => o.id);

    if (validOrderIds.length === 0) {
      return res.status(403).json({ error: 'Apenas clientes que compraram este produto podem avaliá-lo.' });
    }
    const items = await repo.findIn('order_items', 'orderId', validOrderIds);
    if (!items.some((i) => i.productId === productId)) {
      return res.status(403).json({ error: 'Apenas clientes que compraram este produto podem avaliá-lo.' });
    }

    const created = await repo.insertRow('reviews', {
      productId,
      userId: req.user!.id,
      userName: req.user!.name,
      rating: Math.round(rating),
      comment,
    });

    return res.status(201).json({ review: created });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao enviar avaliação.' });
  }
});

// --- MY ACCOUNT & ADDRESSES ---
router.put('/account', requireAuth, async (req: AuthRequest, res) => {
  try {
    const name = sanitizeText(req.body?.name);
    const phone = maskPhone(req.body?.phone || '');
    const birthDate = String(req.body?.birthDate || '');
    const cpfRaw = String(req.body?.cpf || '');

    if (!name || name.length < 3) {
      return res.status(400).json({ error: 'Nome deve ter pelo menos 3 caracteres.' });
    }

    let formattedCpf = req.user!.cpf;
    if (cpfRaw.trim()) {
      if (!isValidCPF(cpfRaw)) {
        return res.status(400).json({ error: 'CPF inválido.' });
      }
      formattedCpf = maskCPF(cpfRaw);
      const all = await repo.listAll('users');
      if (all.some((u) => u.id !== req.user!.id && u.cpf === formattedCpf)) {
        return res.status(409).json({ error: 'CPF já cadastrado por outro usuário.' });
      }
    }

    const [updated] = await repo.updateWhere(
      'users',
      { id: req.user!.id },
      { name, phone, birthDate, cpf: formattedCpf }
    );

    return res.json({ user: toSafeUser(updated) });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao atualizar dados da conta.' });
  }
});

router.post('/account/password', requireAuth, async (req: AuthRequest, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }

    const user = await repo.findOneWhere('users', { id: req.user!.id });
    if (!user?.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return res.status(400).json({ error: 'Senha atual incorreta.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await repo.updateWhere('users', { id: user.id }, { passwordHash });
    return res.json({ message: 'Senha alterada com sucesso.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao alterar senha.' });
  }
});

router.delete('/account', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.user!.role === 'admin' || req.user!.role === 'superadmin') {
      return res.status(400).json({ error: 'Contas de administrador não podem ser auto-excluídas.' });
    }
    await repo.updateWhere(
      'users',
      { id: req.user!.id },
      { status: 'inativo', email: `deleted_${req.user!.id}_${Date.now()}@anon.test` }
    );
    res.clearCookie('na_token', { path: '/' });
    return res.json({ message: 'Conta encerrada com sucesso.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao encerrar conta.' });
  }
});

router.get('/addresses', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await repo.findWhere(
      'addresses',
      { userId: req.user!.id },
      { orderBy: 'isDefault', desc: true }
    );
    return res.json({ addresses: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar endereços.' });
  }
});

router.post('/addresses', requireAuth, async (req: AuthRequest, res) => {
  try {
    const label = sanitizeText(req.body?.label || 'Endereço');
    const cep = maskCEP(req.body?.cep || '');
    const street = sanitizeText(req.body?.street);
    const number = sanitizeText(req.body?.number);
    const complement = sanitizeText(req.body?.complement || '');
    const neighborhood = sanitizeText(req.body?.neighborhood || '');
    const city = sanitizeText(req.body?.city);
    const state = sanitizeText(req.body?.state).toUpperCase().slice(0, 2);
    const isDefault = Boolean(req.body?.isDefault);

    if (!cep || !street || !number || !city || !state) {
      return res.status(400).json({ error: 'Preencha CEP, logradouro, número, cidade e UF.' });
    }

    if (isDefault) {
      await repo.updateWhere('addresses', { userId: req.user!.id }, { isDefault: false });
    }

    const created = await repo.insertRow('addresses', {
      userId: req.user!.id,
      label,
      cep,
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
      isDefault,
    });

    return res.status(201).json({ address: created });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao cadastrar endereço.' });
  }
});

router.delete('/addresses/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await repo.deleteWhere('addresses', { id, userId: req.user!.id });
    return res.json({ message: 'Endereço removido.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao remover endereço.' });
  }
});

export default router;
