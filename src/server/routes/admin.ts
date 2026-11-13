import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { repo } from '../../db/repo.ts';
import { seedDatabase } from '../../db/seed.ts';
import {
  AuthRequest,
  logAudit,
  requireAuth,
  requireRole,
  toSafeUser,
} from '../../middleware/auth.ts';
import {
  isValidCPF,
  isValidEmail,
  maskCEP,
  maskCPF,
  maskPhone,
  onlyDigits,
  sanitizeText,
} from '../../utils/validators.ts';

const router = Router();
router.use(requireAuth, requireRole('admin'));

// Multer setup for attachments (max 2MB, PDF/PNG/JPG)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
]);

// --- DASHBOARD ---
router.get('/dashboard', async (req: AuthRequest, res) => {
  try {
    const startDate = req.query.startDate ? String(req.query.startDate) : null;
    const endDate = req.query.endDate ? String(req.query.endDate) : null;

    const allUsers = await repo.listAll('users');
    const allProducts = await repo.listAll('products');
    const allOrders = await repo.listAll('orders', { orderBy: 'createdAt', desc: true });
    const allFinancial = await repo.listAll('financial_entries');

    // Auto-detect overdue financial entries
    const todayStr = new Date().toISOString().slice(0, 10);
    for (const f of allFinancial) {
      if (f.status === 'Pendente' && f.dueDate < todayStr) {
        await repo.updateWhere('financial_entries', { id: f.id }, { status: 'Atrasado' });
        f.status = 'Atrasado';
      }
    }

    const filteredOrders = allOrders.filter((o) => {
      const dateStr = new Date(o.createdAt).toISOString().slice(0, 10);
      if (startDate && dateStr < startDate) return false;
      if (endDate && dateStr > endDate) return false;
      return true;
    });

    const customers = allUsers.filter((u) => u.role === 'cliente');
    const outOfStockCount = allProducts.filter((p) => p.stock <= 0).length;
    const lowStockCount = allProducts.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;

    const nonCancelledOrders = filteredOrders.filter((o) => o.status !== 'Cancelado');
    const revenueCents = nonCancelledOrders.reduce((acc, o) => acc + o.totalCents, 0);
    const onlineOrdersCount = filteredOrders.filter((o) => o.channel === 'online').length;
    const pdvOrdersCount = filteredOrders.filter((o) => o.channel === 'pdv').length;
    const pendingOrdersCount = filteredOrders.filter((o) => o.status === 'Pendente').length;

    const payablePendingCents = allFinancial
      .filter((f) => f.type === 'pagar' && f.status !== 'Pago')
      .reduce((acc, f) => acc + f.amountCents, 0);
    const receivablePendingCents = allFinancial
      .filter((f) => f.type === 'receber' && f.status !== 'Pago')
      .reduce((acc, f) => acc + f.amountCents, 0);
    const overdueCount = allFinancial.filter((f) => f.status === 'Atrasado').length;

    const statusBreakdown = ['Pendente', 'Pago', 'Enviado', 'Entregue', 'Cancelado'].map((st) => ({
      status: st,
      count: filteredOrders.filter((o) => o.status === st).length,
    }));

    // Daily revenue chart data (last 10 days)
    const dayMap = new Map<string, { date: string; online: number; pdv: number }>();
    for (const o of nonCancelledOrders) {
      const d = new Date(o.createdAt).toISOString().slice(0, 10);
      const curr = dayMap.get(d) || { date: d, online: 0, pdv: 0 };
      if (o.channel === 'online') curr.online += o.totalCents;
      else curr.pdv += o.totalCents;
      dayMap.set(d, curr);
    }
    const revenueByDay = Array.from(dayMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-10);

    return res.json({
      kpis: {
        totalCustomers: customers.length,
        totalProducts: allProducts.length,
        outOfStockCount,
        lowStockCount,
        totalOrders: filteredOrders.length,
        onlineOrdersCount,
        pdvOrdersCount,
        pendingOrdersCount,
        revenueCents,
        payablePendingCents,
        receivablePendingCents,
        overdueCount,
      },
      statusBreakdown,
      revenueByDay,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ error: 'Erro ao carregar indicadores do dashboard.' });
  }
});

// --- USERS (INTERNAL & ALL) ---
router.get('/users', async (_req, res) => {
  try {
    const rows = await repo.listAll('users', { orderBy: 'id', desc: true });
    return res.json({ users: rows.map(toSafeUser) });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar usuários.' });
  }
});

router.post('/users', async (req: AuthRequest, res) => {
  try {
    const name = sanitizeText(req.body?.name);
    const email = String(req.body?.email || '').trim().toLowerCase();
    const role = String(req.body?.role || 'caixa');
    const password = String(req.body?.password || '');
    const status = String(req.body?.status || 'ativo');

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'E-mail inválido.' });
    }
    if (!['admin', 'caixa', 'cliente'].includes(role)) {
      return res.status(400).json({ error: 'Perfil inválido.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });
    }

    const dup = await repo.findOneWhere('users', { email });
    if (dup) {
      return res.status(409).json({ error: 'E-mail já cadastrado no sistema.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await repo.insertRow('users', {
      name,
      email,
      role,
      passwordHash,
      status,
    });

    await logAudit(req.user, 'CREATE_USER', 'users', `Usuário ${email} (${role}) criado.`);
    return res.status(201).json({ user: toSafeUser(created) });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao criar usuário.' });
  }
});

router.put('/users/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const name = sanitizeText(req.body?.name);
    const role = String(req.body?.role || '');
    const status = String(req.body?.status || '');

    if (!name || !['admin', 'caixa', 'cliente'].includes(role) || !['ativo', 'inativo'].includes(status)) {
      return res.status(400).json({ error: 'Dados inválidos para atualização de usuário.' });
    }

    const [updated] = await repo.updateWhere('users', { id }, { name, role, status });
    if (!updated) return res.status(404).json({ error: 'Usuário não encontrado.' });

    await logAudit(req.user, 'UPDATE_USER', 'users', `Usuário #${id} atualizado (${role}, ${status}).`);
    return res.json({ user: toSafeUser(updated) });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao atualizar usuário.' });
  }
});

router.patch('/users/:id/reset-password', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const newPassword = String(req.body?.newPassword || '');
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const [updated] = await repo.updateWhere(
      'users',
      { id },
      { passwordHash, failedLoginAttempts: 0, lockedUntil: null }
    );

    if (!updated) return res.status(404).json({ error: 'Usuário não encontrado.' });

    await logAudit(req.user, 'RESET_PASSWORD', 'users', `Senha redefinida para usuário #${id}.`);
    return res.json({ message: 'Senha redefinida com sucesso.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao redefinir senha.' });
  }
});

router.delete('/users/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (req.user?.id === id) {
      return res.status(400).json({ error: 'Você não pode excluir sua própria conta logada.' });
    }
    const linkedCustomerOrder = await repo.findOneWhere('orders', { customerId: id });
    const linkedOperatorOrder = await repo.findOneWhere('orders', { operatorId: id });
    const linkedRegister = await repo.findOneWhere('cash_registers', { operatorId: id });
    if (linkedCustomerOrder || linkedOperatorOrder || linkedRegister) {
      return res.status(400).json({ error: 'Não é possível excluir usuário com registros vinculados. Inative-o.' });
    }

    const [deleted] = await repo.deleteWhere('users', { id });
    if (!deleted) return res.status(404).json({ error: 'Usuário não encontrado.' });
    await logAudit(req.user, 'DELETE_USER', 'users', `Usuário ${deleted.email} removido.`);
    return res.json({ message: 'Usuário excluído com sucesso.' });
  } catch (err) {
    return res.status(400).json({ error: 'Não é possível excluir usuário com registros vinculados. Inative-o.' });
  }
});

// --- CUSTOMERS ---
router.get('/customers', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const statusFilter = String(req.query.status || '');
    const rows = await repo.findWhere(
      'users',
      { role: 'cliente' },
      { orderBy: 'id', desc: true }
    );

    const filtered = rows.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (q) {
        const cpfClean = onlyDigits(c.cpf || '');
        const qClean = onlyDigits(q);
        const matchName = c.name.toLowerCase().includes(q);
        const matchEmail = c.email.toLowerCase().includes(q);
        const matchCpf = (c.cpf || '').toLowerCase().includes(q) || (qClean && cpfClean.includes(qClean));
        if (!matchName && !matchEmail && !matchCpf) return false;
      }
      return true;
    });

    return res.json({ customers: filtered.map(toSafeUser) });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar clientes.' });
  }
});

router.post('/customers', async (req: AuthRequest, res) => {
  try {
    const name = sanitizeText(req.body?.name);
    const email = String(req.body?.email || '').trim().toLowerCase();
    const cpfRaw = String(req.body?.cpf || '');
    const birthDate = String(req.body?.birthDate || '');
    const phone = maskPhone(req.body?.phone || '');
    const cep = maskCEP(req.body?.cep || '');
    const address = sanitizeText(req.body?.address);
    const number = sanitizeText(req.body?.number);
    const city = sanitizeText(req.body?.city);
    const state = sanitizeText(req.body?.state).toUpperCase().slice(0, 2);
    const status = String(req.body?.status || 'ativo');

    if (!name || !email || !cpfRaw) {
      return res.status(400).json({ error: 'Nome, e-mail e CPF são obrigatórios.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'E-mail inválido.' });
    }
    if (!isValidCPF(cpfRaw)) {
      return res.status(400).json({ error: 'CPF inválido.' });
    }

    const cpf = maskCPF(cpfRaw);
    const dupEmail = await repo.findOneWhere('users', { email });
    if (dupEmail) return res.status(409).json({ error: 'Já existe um registro com este e-mail.' });

    const dupCpf = await repo.findOneWhere('users', { cpf });
    if (dupCpf) return res.status(409).json({ error: 'Já existe um cliente cadastrado com este CPF.' });

    const defaultHash = await bcrypt.hash('Cliente@123', 10);
    const created = await repo.insertRow('users', {
      name,
      email,
      cpf,
      birthDate,
      phone,
      cep,
      address,
      number,
      city,
      state,
      status,
      role: 'cliente',
      passwordHash: defaultHash,
    });

    await logAudit(req.user, 'CREATE_CUSTOMER', 'customers', `Cliente ${name} (${cpf}) cadastrado.`);
    return res.status(201).json({ customer: toSafeUser(created) });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao cadastrar cliente.' });
  }
});

router.put('/customers/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const name = sanitizeText(req.body?.name);
    const email = String(req.body?.email || '').trim().toLowerCase();
    const cpfRaw = String(req.body?.cpf || '');
    const birthDate = String(req.body?.birthDate || '');
    const phone = maskPhone(req.body?.phone || '');
    const cep = maskCEP(req.body?.cep || '');
    const address = sanitizeText(req.body?.address);
    const number = sanitizeText(req.body?.number);
    const city = sanitizeText(req.body?.city);
    const state = sanitizeText(req.body?.state).toUpperCase().slice(0, 2);
    const status = String(req.body?.status || 'ativo');

    if (!name || !email || !cpfRaw) {
      return res.status(400).json({ error: 'Nome, e-mail e CPF são obrigatórios.' });
    }
    if (!isValidEmail(email)) return res.status(400).json({ error: 'E-mail inválido.' });
    if (!isValidCPF(cpfRaw)) return res.status(400).json({ error: 'CPF inválido.' });

    const cpf = maskCPF(cpfRaw);
    const allUsers = await repo.listAll('users');
    if (allUsers.some((u) => u.id !== id && u.email === email)) {
      return res.status(409).json({ error: 'Este e-mail já está em uso por outro usuário.' });
    }
    if (allUsers.some((u) => u.id !== id && u.cpf === cpf)) {
      return res.status(409).json({ error: 'Este CPF já está em uso por outro cliente.' });
    }

    const [updated] = await repo.updateWhere(
      'users',
      { id },
      { name, email, cpf, birthDate, phone, cep, address, number, city, state, status }
    );

    if (!updated) return res.status(404).json({ error: 'Cliente não encontrado.' });

    await logAudit(req.user, 'UPDATE_CUSTOMER', 'customers', `Cliente #${id} atualizado.`);
    return res.json({ customer: toSafeUser(updated) });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao atualizar cliente.' });
  }
});

router.delete('/customers/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const linkedOrder = await repo.findOneWhere('orders', { customerId: id });
    if (linkedOrder) {
      return res.status(400).json({ error: 'Cliente possui pedidos vinculados e não pode ser excluído.' });
    }
    const [deleted] = await repo.deleteWhere('users', { id });
    if (!deleted) return res.status(404).json({ error: 'Cliente não encontrado.' });
    await logAudit(req.user, 'DELETE_CUSTOMER', 'customers', `Cliente ${deleted.name} excluído.`);
    return res.json({ message: 'Cliente excluído com sucesso.' });
  } catch (err) {
    return res.status(400).json({ error: 'Cliente possui pedidos vinculados e não pode ser excluído.' });
  }
});

// --- CATEGORIES ---
router.get('/categories', async (_req, res) => {
  try {
    const rows = await repo.listAll('categories', { orderBy: 'name' });
    return res.json({ categories: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar categorias.' });
  }
});

router.post('/categories', async (req: AuthRequest, res) => {
  try {
    const name = sanitizeText(req.body?.name);
    const description = sanitizeText(req.body?.description);
    const status = String(req.body?.status || 'ativo');
    if (!name) return res.status(400).json({ error: 'Nome da categoria é obrigatório.' });
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const dup = await repo.findOneWhere('categories', { name });
    if (dup) return res.status(409).json({ error: 'Categoria já existe.' });

    const created = await repo.insertRow('categories', {
      name,
      slug: slug || `cat-${Date.now()}`,
      description,
      status,
    });
    await logAudit(req.user, 'CREATE_CATEGORY', 'categories', `Categoria ${name} criada.`);
    return res.status(201).json({ category: created });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao criar categoria.' });
  }
});

router.put('/categories/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const name = sanitizeText(req.body?.name);
    const description = sanitizeText(req.body?.description);
    const status = String(req.body?.status || 'ativo');
    if (!name) return res.status(400).json({ error: 'Nome da categoria é obrigatório.' });
    const [updated] = await repo.updateWhere(
      'categories',
      { id },
      { name, description, status }
    );
    if (!updated) return res.status(404).json({ error: 'Categoria não encontrada.' });
    await logAudit(req.user, 'UPDATE_CATEGORY', 'categories', `Categoria #${id} atualizada.`);
    return res.json({ category: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao atualizar categoria.' });
  }
});

router.delete('/categories/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const linkedProduct = await repo.findOneWhere('products', { categoryId: id });
    if (linkedProduct) {
      return res.status(400).json({ error: 'Categoria possui produtos vinculados.' });
    }
    const [deleted] = await repo.deleteWhere('categories', { id });
    if (!deleted) return res.status(404).json({ error: 'Categoria não encontrada.' });
    return res.json({ message: 'Categoria excluída.' });
  } catch (err) {
    return res.status(400).json({ error: 'Categoria possui produtos vinculados.' });
  }
});

// --- PRODUCTS ---
router.get('/products', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
    const sort = String(req.query.sort || 'newest');

    const rows = await repo.listAll('products');
    const cats = await repo.listAll('categories');
    const catMap = new Map(cats.map((c) => [c.id, c.name]));

    let list = rows.map((p) => ({
      ...p,
      categoryName: p.categoryId ? catMap.get(p.categoryId) || 'Sem categoria' : 'Sem categoria',
    }));

    if (q) {
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
      );
    }
    if (categoryId) {
      list = list.filter((p) => p.categoryId === categoryId);
    }
    if (sort === 'price_asc') list.sort((a, b) => a.priceCents - b.priceCents);
    else if (sort === 'price_desc') list.sort((a, b) => b.priceCents - a.priceCents);
    else list.sort((a, b) => b.id - a.id);

    return res.json({ products: list });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar produtos.' });
  }
});

router.post('/products', async (req: AuthRequest, res) => {
  try {
    const code = sanitizeText(req.body?.code).toUpperCase();
    const name = sanitizeText(req.body?.name);
    const description = sanitizeText(req.body?.description);
    const categoryId = req.body?.categoryId ? Number(req.body.categoryId) : null;
    const supplier = sanitizeText(req.body?.supplier);
    const priceCents = Number(req.body?.priceCents);
    const stock = Number(req.body?.stock ?? 0);
    const minStock = Number(req.body?.minStock ?? 5);
    const imageUrl = sanitizeText(req.body?.imageUrl) || '/src/assets/images/prod_headphones_1794559983453.jpg';
    const status = String(req.body?.status || 'ativo');

    if (!code || !name || !description || !supplier) {
      return res.status(400).json({ error: 'Código, nome, descrição e fornecedor são obrigatórios.' });
    }
    if (Number.isNaN(priceCents) || priceCents <= 0) {
      return res.status(400).json({ error: 'O preço do produto deve ser maior que zero (não pode ser negativo).' });
    }
    if (Number.isNaN(stock) || stock < 0) {
      return res.status(400).json({ error: 'O estoque não pode ser negativo.' });
    }

    const dup = await repo.findOneWhere('products', { code });
    if (dup) {
      return res.status(409).json({ error: `Já existe um produto cadastrado com o código ${code}.` });
    }

    const created = await repo.insertRow('products', {
      code,
      name,
      description,
      categoryId,
      supplier,
      priceCents: Math.round(priceCents),
      stock: Math.round(stock),
      minStock: Math.round(minStock),
      imageUrl,
      status,
    });

    await logAudit(req.user, 'CREATE_PRODUCT', 'products', `Produto ${code} - ${name} criado.`);
    return res.status(201).json({ product: created });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao cadastrar produto.' });
  }
});

router.put('/products/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const code = sanitizeText(req.body?.code).toUpperCase();
    const name = sanitizeText(req.body?.name);
    const description = sanitizeText(req.body?.description);
    const categoryId = req.body?.categoryId ? Number(req.body.categoryId) : null;
    const supplier = sanitizeText(req.body?.supplier);
    const priceCents = Number(req.body?.priceCents);
    const stock = Number(req.body?.stock ?? 0);
    const minStock = Number(req.body?.minStock ?? 5);
    const imageUrl = sanitizeText(req.body?.imageUrl);
    const status = String(req.body?.status || 'ativo');

    if (!code || !name || !description || !supplier) {
      return res.status(400).json({ error: 'Campos obrigatórios não preenchidos.' });
    }
    if (Number.isNaN(priceCents) || priceCents <= 0) {
      return res.status(400).json({ error: 'O preço não pode ser negativo ou zero.' });
    }
    if (Number.isNaN(stock) || stock < 0) {
      return res.status(400).json({ error: 'O estoque não pode ser negativo.' });
    }

    const all = await repo.listAll('products');
    if (all.some((p) => p.id !== id && p.code === code)) {
      return res.status(409).json({ error: `Código ${code} já utilizado por outro produto.` });
    }

    const [updated] = await repo.updateWhere(
      'products',
      { id },
      {
        code,
        name,
        description,
        categoryId,
        supplier,
        priceCents: Math.round(priceCents),
        stock: Math.round(stock),
        minStock: Math.round(minStock),
        ...(imageUrl ? { imageUrl } : {}),
        status,
      }
    );

    if (!updated) return res.status(404).json({ error: 'Produto não encontrado.' });

    await logAudit(req.user, 'UPDATE_PRODUCT', 'products', `Produto ${code} atualizado.`);
    return res.json({ product: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao atualizar produto.' });
  }
});

router.delete('/products/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const linkedOrderItem = await repo.findOneWhere('order_items', { productId: id });
    if (linkedOrderItem) {
      return res.status(400).json({ error: 'Produto possui pedidos vinculados. Inative-o em vez de excluir.' });
    }
    const [deleted] = await repo.deleteWhere('products', { id });
    if (!deleted) return res.status(404).json({ error: 'Produto não encontrado.' });
    await logAudit(req.user, 'DELETE_PRODUCT', 'products', `Produto ${deleted.code} removido.`);
    return res.json({ message: 'Produto excluído com sucesso.' });
  } catch (err) {
    return res.status(400).json({ error: 'Produto possui pedidos vinculados. Inative-o em vez de excluir.' });
  }
});

// --- COUPONS ---
router.get('/coupons', async (_req, res) => {
  try {
    const rows = await repo.listAll('coupons', { orderBy: 'id', desc: true });
    return res.json({ coupons: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar cupons.' });
  }
});

router.post('/coupons', async (req: AuthRequest, res) => {
  try {
    const code = sanitizeText(req.body?.code).toUpperCase();
    const type = String(req.body?.type || 'percentual');
    const value = Number(req.body?.value);
    const expiresAtStr = String(req.body?.expiresAt || '');
    const usageLimit = Number(req.body?.usageLimit ?? 100);
    const status = String(req.body?.status || 'ativo');

    if (!code || !expiresAtStr || Number.isNaN(value) || value <= 0) {
      return res.status(400).json({ error: 'Código, valor positivo e validade são obrigatórios.' });
    }
    if (!['percentual', 'fixo'].includes(type)) {
      return res.status(400).json({ error: 'Tipo de cupom inválido.' });
    }
    if (type === 'percentual' && value > 100) {
      return res.status(400).json({ error: 'Cupom percentual não pode exceder 100%.' });
    }

    const dup = await repo.findOneWhere('coupons', { code });
    if (dup) return res.status(409).json({ error: 'Já existe um cupom com este código.' });

    const created = await repo.insertRow('coupons', {
      code,
      type,
      value: Math.round(value),
      expiresAt: new Date(expiresAtStr),
      usageLimit: Math.max(1, Math.round(usageLimit)),
      status,
    });

    await logAudit(req.user, 'CREATE_COUPON', 'coupons', `Cupom ${code} criado.`);
    return res.status(201).json({ coupon: created });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao criar cupom.' });
  }
});

router.put('/coupons/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const status = String(req.body?.status || 'ativo');
    const usageLimit = Number(req.body?.usageLimit ?? 100);
    const expiresAtStr = req.body?.expiresAt ? String(req.body.expiresAt) : null;

    const [updated] = await repo.updateWhere(
      'coupons',
      { id },
      {
        status,
        usageLimit: Math.max(1, Math.round(usageLimit)),
        ...(expiresAtStr ? { expiresAt: new Date(expiresAtStr) } : {}),
      }
    );

    if (!updated) return res.status(404).json({ error: 'Cupom não encontrado.' });
    return res.json({ coupon: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao atualizar cupom.' });
  }
});

router.delete('/coupons/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await repo.deleteWhere('coupons', { id });
    if (!deleted) return res.status(404).json({ error: 'Cupom não encontrado.' });
    return res.json({ message: 'Cupom excluído.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao excluir cupom.' });
  }
});

// --- ORDERS ---
router.get('/orders', async (req, res) => {
  try {
    const status = String(req.query.status || '');
    const channel = String(req.query.channel || '');
    const startDate = req.query.startDate ? String(req.query.startDate) : null;
    const endDate = req.query.endDate ? String(req.query.endDate) : null;

    const allOrders = await repo.listAll('orders', { orderBy: 'createdAt', desc: true });
    const filtered = allOrders.filter((o) => {
      if (status && o.status !== status) return false;
      if (channel && o.channel !== channel) return false;
      const d = new Date(o.createdAt).toISOString().slice(0, 10);
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });

    const ids = filtered.map((o) => o.id);
    const items = await repo.findIn('order_items', 'orderId', ids);

    const enriched = filtered.map((o) => ({
      ...o,
      items: items.filter((i) => i.orderId === o.id),
    }));

    return res.json({ orders: enriched });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar pedidos.' });
  }
});

router.patch('/orders/:id/status', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const newStatus = String(req.body?.status || '');
    const reason = sanitizeText(req.body?.reason || '');
    const adminPassword = String(req.body?.adminPassword || '');

    if (!['Pendente', 'Pago', 'Enviado', 'Entregue', 'Cancelado'].includes(newStatus)) {
      return res.status(400).json({ error: 'Status de pedido inválido.' });
    }

    const order = await repo.findOneWhere('orders', { id });
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });

    if (order.status === 'Cancelado') {
      return res.status(400).json({ error: 'Pedido já está cancelado.' });
    }

    // Cancelling a completed/paid/shipped/delivered order requires admin password + justification
    if (newStatus === 'Cancelado') {
      if (!reason || reason.length < 5) {
        return res.status(400).json({ error: 'Informe uma justificativa de pelo menos 5 caracteres para cancelar o pedido.' });
      }
      if (['Pago', 'Enviado', 'Entregue'].includes(order.status)) {
        const adminRecord = await repo.findOneWhere('users', { id: req.user!.id });
        const ok =
          adminRecord?.passwordHash &&
          (await bcrypt.compare(adminPassword, adminRecord.passwordHash));
        if (!ok) {
          return res.status(403).json({
            error: 'Autorização negada: informe a senha do administrador para cancelar um pedido concluído/pago.',
          });
        }
      }

      // Restore stock
      const items = await repo.findWhere('order_items', { orderId: order.id });
      for (const item of items) {
        await repo.adjustNumericColumn('products', item.productId, 'stock', item.quantity);
      }
    }

    const [updated] = await repo.updateWhere(
      'orders',
      { id },
      {
        status: newStatus,
        ...(newStatus === 'Entregue' ? { deliveredAt: new Date() } : {}),
        ...(newStatus === 'Cancelado'
          ? { cancellationReason: reason, authorizedBy: req.user?.email }
          : {}),
      }
    );

    await logAudit(
      req.user,
      'UPDATE_ORDER_STATUS',
      'orders',
      `Pedido ${order.orderNumber} alterado de ${order.status} para ${newStatus}.`
    );

    return res.json({ order: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao atualizar status do pedido.' });
  }
});

// --- FINANCIAL ---
router.get('/financial', async (req, res) => {
  try {
    const type = String(req.query.type || '');
    const status = String(req.query.status || '');
    const q = String(req.query.q || '').trim().toLowerCase();
    const startDate = req.query.startDate ? String(req.query.startDate) : null;
    const endDate = req.query.endDate ? String(req.query.endDate) : null;

    const all = await repo.listAll('financial_entries', { orderBy: 'id', desc: true });
    const todayStr = new Date().toISOString().slice(0, 10);

    for (const f of all) {
      if (f.status === 'Pendente' && f.dueDate < todayStr) {
        await repo.updateWhere('financial_entries', { id: f.id }, { status: 'Atrasado' });
        f.status = 'Atrasado';
      }
    }

    const filtered = all.filter((f) => {
      if (type && f.type !== type) return false;
      if (status && f.status !== status) return false;
      if (q && !f.description.toLowerCase().includes(q)) return false;
      if (startDate && f.dueDate < startDate) return false;
      if (endDate && f.dueDate > endDate) return false;
      return true;
    });

    return res.json({ entries: filtered });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao carregar contas financeiras.' });
  }
});

router.post('/financial', async (req: AuthRequest, res) => {
  try {
    const type = String(req.body?.type || '');
    const description = sanitizeText(req.body?.description);
    const amountCents = Number(req.body?.amountCents);
    const dueDate = String(req.body?.dueDate || '');

    if (!['pagar', 'receber'].includes(type) || !description || !dueDate || Number.isNaN(amountCents) || amountCents <= 0) {
      return res.status(400).json({ error: 'Tipo, descrição, valor positivo e vencimento são obrigatórios.' });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const initialStatus = dueDate < todayStr ? 'Atrasado' : 'Pendente';

    const created = await repo.insertRow('financial_entries', {
      type,
      description,
      amountCents: Math.round(amountCents),
      dueDate,
      status: initialStatus,
    });

    await logAudit(req.user, 'CREATE_FINANCIAL', 'financial', `Conta (${type}) "${description}" criada.`);
    return res.status(201).json({ entry: created });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao lançar conta.' });
  }
});

router.post('/financial/:id/pay', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const entry = await repo.findOneWhere('financial_entries', { id });

    if (!entry) return res.status(404).json({ error: 'Lançamento não encontrado.' });
    if (entry.status === 'Pago') {
      return res.status(400).json({ error: 'Pagamento duplicado bloqueado: esta conta já foi quitada.' });
    }

    const paidDate = new Date().toISOString().slice(0, 10);
    const [updated] = await repo.updateWhere(
      'financial_entries',
      { id },
      { status: 'Pago', paidDate }
    );

    await logAudit(req.user, 'PAY_FINANCIAL', 'financial', `Conta #${id} marcada como paga.`);
    return res.json({ entry: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao registrar pagamento.' });
  }
});

router.delete('/financial/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await repo.deleteWhere('financial_entries', { id });
    if (!deleted) return res.status(404).json({ error: 'Lançamento não encontrado.' });
    return res.json({ message: 'Lançamento removido.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao excluir lançamento.' });
  }
});

// --- ATTACHMENTS ---
router.get('/attachments', async (_req, res) => {
  try {
    const rows = await repo.listAll('attachments', {
      orderBy: 'id',
      desc: true,
      selectCols: ['id', 'filename', 'originalName', 'mimeType', 'sizeBytes', 'uploadedBy', 'createdAt'],
    });
    return res.json({ attachments: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar anexos.' });
  }
});

router.post('/attachments', (req: AuthRequest, res) => {
  upload.single('file')(req, res, async (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Arquivo excede o tamanho máximo permitido de 2 MB.' });
      }
      return res.status(400).json({ error: 'Falha no upload do arquivo.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Selecione um arquivo PDF, PNG ou JPG para enviar.' });
    }
    if (!ALLOWED_MIMES.has(req.file.mimetype)) {
      return res.status(400).json({
        error: 'Extensão de arquivo inválida. Permitidos apenas PDF, PNG e JPG.',
      });
    }

    try {
      const base64Data = req.file.buffer.toString('base64');
      const createdFull = await repo.insertRow('attachments', {
        filename: `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        fileData: base64Data,
        uploadedBy: req.user?.email || 'admin',
      });

      const created = {
        id: createdFull.id,
        filename: createdFull.filename,
        originalName: createdFull.originalName,
        mimeType: createdFull.mimeType,
        sizeBytes: createdFull.sizeBytes,
        uploadedBy: createdFull.uploadedBy,
        createdAt: createdFull.createdAt,
      };

      await logAudit(req.user, 'UPLOAD_ATTACHMENT', 'attachments', `Arquivo ${req.file.originalname} enviado.`);
      return res.status(201).json({ attachment: created });
    } catch (e) {
      return res.status(500).json({ error: 'Erro ao salvar anexo no banco.' });
    }
  });
});

router.get('/attachments/:id/download', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const file = await repo.findOneWhere('attachments', { id });
    if (!file) return res.status(404).json({ error: 'Anexo não encontrado.' });
    const buffer = Buffer.from(file.fileData, 'base64');
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao baixar anexo.' });
  }
});

router.delete('/attachments/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await repo.deleteWhere('attachments', { id });
    if (!deleted) return res.status(404).json({ error: 'Anexo não encontrado.' });
    await logAudit(req.user, 'DELETE_ATTACHMENT', 'attachments', `Anexo ${deleted.originalName} excluído.`);
    return res.json({ message: 'Anexo excluído com sucesso.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao excluir anexo.' });
  }
});

// --- LAB & AUDIT ---
router.get('/audit-logs', async (_req, res) => {
  try {
    const rows = await repo.listAll('audit_logs', { orderBy: 'id', desc: true, limit: 100 });
    return res.json({ logs: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar logs de auditoria.' });
  }
});

router.put('/lab-settings', async (req: AuthRequest, res) => {
  try {
    const simulatedDelayMs = Math.min(5000, Math.max(0, Number(req.body?.simulatedDelayMs ?? 0)));
    const maxCashierDiscountPercent = Math.min(
      50,
      Math.max(0, Number(req.body?.maxCashierDiscountPercent ?? 15))
    );

    await repo.upsertRow(
      'lab_settings',
      { key: 'simulatedDelayMs', value: String(simulatedDelayMs), updatedAt: new Date() },
      'key'
    );
    await repo.upsertRow(
      'lab_settings',
      {
        key: 'maxCashierDiscountPercent',
        value: String(maxCashierDiscountPercent),
        updatedAt: new Date(),
      },
      'key'
    );

    await logAudit(
      req.user,
      'UPDATE_LAB_SETTINGS',
      'lab',
      `Atraso simulado: ${simulatedDelayMs}ms | Desconto máx. PDV: ${maxCashierDiscountPercent}%`
    );

    return res.json({ simulatedDelayMs, maxCashierDiscountPercent });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao salvar configurações de laboratório.' });
  }
});

router.post('/reset-demo', async (req: AuthRequest, res) => {
  try {
    const result = await seedDatabase(true);
    await logAudit(req.user, 'RESET_DEMO', 'system', 'Dados de demonstração restaurados pelo administrador.');
    return res.json(result);
  } catch (err) {
    console.error('Reset demo error:', err);
    return res.status(500).json({ error: 'Erro ao restaurar dados de demonstração.' });
  }
});

export default router;
