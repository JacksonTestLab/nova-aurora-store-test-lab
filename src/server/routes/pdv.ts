import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { repo } from '../../db/repo.ts';
import {
  AuthRequest,
  logAudit,
  requireAuth,
  requireRole,
} from '../../middleware/auth.ts';
import {
  isValidCPF,
  maskCPF,
  onlyDigits,
  sanitizeText,
} from '../../utils/validators.ts';

const router = Router();
router.use(requireAuth, requireRole('caixa', 'admin'));

async function getActiveRegister(operatorId: number) {
  const rows = await repo.findWhere(
    'cash_registers',
    { operatorId, status: 'aberto' },
    { orderBy: 'openedAt', desc: true, limit: 1 }
  );
  return rows[0] || null;
}

router.get('/register/current', async (req: AuthRequest, res) => {
  try {
    const reg = await getActiveRegister(req.user!.id);
    if (!reg) {
      return res.json({ register: null, movements: [], sales: [], summary: {} });
    }

    const movements = await repo.findWhere(
      'cash_movements',
      { registerId: reg.id },
      { orderBy: 'createdAt', desc: true }
    );

    const sales = await repo.findWhere(
      'orders',
      { registerId: reg.id },
      { orderBy: 'createdAt', desc: true }
    );

    const activeSales = sales.filter((s) => s.status !== 'Cancelado');
    const byPayment: Record<string, number> = {};
    for (const s of activeSales) {
      if (s.paymentDetails) {
        try {
          const parsed = JSON.parse(s.paymentDetails);
          if (Array.isArray(parsed.parts)) {
            for (const p of parsed.parts) {
              byPayment[p.method] = (byPayment[p.method] || 0) + Number(p.amountCents || 0);
            }
            continue;
          }
        } catch {
          // fallback
        }
      }
      byPayment[s.paymentMethod] = (byPayment[s.paymentMethod] || 0) + s.totalCents;
    }

    const totalSuprimentos = movements
      .filter((m) => m.type === 'suprimento')
      .reduce((acc, m) => acc + m.amountCents, 0);
    const totalSangrias = movements
      .filter((m) => m.type === 'sangria')
      .reduce((acc, m) => acc + m.amountCents, 0);

    const totalSalesCents = activeSales.reduce((acc, s) => acc + s.totalCents, 0);
    const cashSalesCents = byPayment['Dinheiro'] || 0;
    const expectedCashCents =
      reg.initialAmountCents + totalSuprimentos - totalSangrias + cashSalesCents;

    return res.json({
      register: reg,
      movements,
      sales,
      summary: {
        totalSalesCount: activeSales.length,
        totalSalesCents,
        totalSuprimentos,
        totalSangrias,
        expectedCashCents,
        byPayment,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao consultar status do caixa.' });
  }
});

router.post('/register/open', async (req: AuthRequest, res) => {
  try {
    const existing = await getActiveRegister(req.user!.id);
    if (existing) {
      return res.status(400).json({ error: 'Já existe um caixa aberto para este operador.' });
    }
    const initialAmountCents = Number(req.body?.initialAmountCents ?? 0);
    if (Number.isNaN(initialAmountCents) || initialAmountCents < 0) {
      return res.status(400).json({ error: 'Valor inicial de abertura inválido.' });
    }

    const created = await repo.insertRow('cash_registers', {
      operatorId: req.user!.id,
      status: 'aberto',
      initialAmountCents: Math.round(initialAmountCents),
    });

    await logAudit(req.user, 'OPEN_REGISTER', 'pdv', `Caixa #${created.id} aberto.`);
    return res.status(201).json({ register: created });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao abrir o caixa.' });
  }
});

router.post('/register/movement', async (req: AuthRequest, res) => {
  try {
    const reg = await getActiveRegister(req.user!.id);
    if (!reg) return res.status(400).json({ error: 'Nenhum caixa aberto no momento.' });

    const type = String(req.body?.type || '');
    const amountCents = Number(req.body?.amountCents);
    const reason = sanitizeText(req.body?.reason);

    if (!['sangria', 'suprimento'].includes(type) || Number.isNaN(amountCents) || amountCents <= 0 || !reason) {
      return res.status(400).json({ error: 'Informe tipo válido, valor positivo e motivo.' });
    }

    const movement = await repo.insertRow('cash_movements', {
      registerId: reg.id,
      operatorId: req.user!.id,
      type,
      amountCents: Math.round(amountCents),
      reason,
    });

    await logAudit(req.user, `PDV_${type.toUpperCase()}`, 'pdv', `${type}: R$ ${(amountCents / 100).toFixed(2)} - ${reason}`);
    return res.status(201).json({ movement });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao registrar movimentação.' });
  }
});

router.post('/register/close', async (req: AuthRequest, res) => {
  try {
    const reg = await getActiveRegister(req.user!.id);
    if (!reg) return res.status(400).json({ error: 'Nenhum caixa aberto para fechar.' });

    const closingAmountCents = Number(req.body?.closingAmountCents ?? 0);
    const notes = sanitizeText(req.body?.notes || '');
    if (Number.isNaN(closingAmountCents) || closingAmountCents < 0) {
      return res.status(400).json({ error: 'Valor de fechamento inválido.' });
    }

    const [closed] = await repo.updateWhere(
      'cash_registers',
      { id: reg.id },
      {
        status: 'fechado',
        closingAmountCents: Math.round(closingAmountCents),
        closedAt: new Date(),
        notes,
      }
    );

    await logAudit(req.user, 'CLOSE_REGISTER', 'pdv', `Caixa #${reg.id} fechado.`);
    return res.json({ register: closed });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao fechar o caixa.' });
  }
});

router.get('/products/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const rows = await repo.findWhere('products', { status: 'ativo' });

    const filtered = q
      ? rows.filter(
          (p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
        )
      : rows;

    return res.json({ products: filtered.slice(0, 30) });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao buscar produtos.' });
  }
});

router.post('/sales', async (req: AuthRequest, res) => {
  try {
    const reg = await getActiveRegister(req.user!.id);
    if (!reg) {
      return res.status(400).json({
        error: 'Caixa fechado! Abra o caixa antes de registrar uma venda.',
      });
    }

    const itemsInput = Array.isArray(req.body?.items) ? req.body.items : [];
    if (itemsInput.length === 0) {
      return res.status(400).json({ error: 'Adicione pelo menos um item à venda.' });
    }

    const customerCpfRaw = String(req.body?.customerCpf || '').trim();
    let formattedCpf: string | null = null;
    if (onlyDigits(customerCpfRaw).length > 0) {
      if (!isValidCPF(customerCpfRaw)) {
        return res.status(400).json({ error: 'CPF informado na nota é inválido.' });
      }
      formattedCpf = maskCPF(customerCpfRaw);
    }

    const discountPercent = Number(req.body?.discountPercent ?? 0);
    if (Number.isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      return res.status(400).json({ error: 'Percentual de desconto inválido.' });
    }

    const maxDiscountSetting = await repo.findOneWhere('lab_settings', {
      key: 'maxCashierDiscountPercent',
    });
    const maxAllowed = Number(maxDiscountSetting?.value || '15');

    let authorizedBy: string | null = null;
    if (discountPercent > maxAllowed) {
      const supPassword = String(req.body?.supervisorPassword || '');
      const admins = await repo.findWhere('users', { role: 'admin' });
      let authorizedAdmin: any = null;
      for (const a of admins) {
        if (a.passwordHash && (await bcrypt.compare(supPassword, a.passwordHash))) {
          authorizedAdmin = a;
          break;
        }
      }
      if (!authorizedAdmin) {
        return res.status(403).json({
          error: `Desconto acima do limite de ${maxAllowed}% exige senha de supervisor (Administrador).`,
          requiresSupervisor: true,
          maxAllowed,
        });
      }
      authorizedBy = authorizedAdmin.email;
    }

    // Validate stock and calculate subtotal
    let subtotalCents = 0;
    const resolvedItems: Array<{
      product: any;
      quantity: number;
      totalCents: number;
    }> = [];

    for (const item of itemsInput) {
      const productId = Number(item.productId);
      const quantity = Number(item.quantity);
      if (!productId || Number.isNaN(quantity) || quantity <= 0) {
        return res.status(400).json({ error: 'Item ou quantidade inválida na venda.' });
      }
      const prod = await repo.findOneWhere('products', { id: productId });
      if (!prod || prod.status !== 'ativo') {
        return res.status(404).json({ error: 'Produto não encontrado ou inativo.' });
      }
      if (prod.stock < quantity) {
        return res.status(400).json({
          error: `Estoque insuficiente para "${prod.name}". Disponível: ${prod.stock}.`,
        });
      }
      const lineTotal = prod.priceCents * quantity;
      subtotalCents += lineTotal;
      resolvedItems.push({ product: prod, quantity, totalCents: lineTotal });
    }

    const discountCents = Math.round((subtotalCents * discountPercent) / 100);
    const totalCents = Math.max(0, subtotalCents - discountCents);

    const paymentParts = Array.isArray(req.body?.paymentParts) ? req.body.paymentParts : [];
    if (paymentParts.length === 0) {
      return res.status(400).json({ error: 'Selecione ao menos uma forma de pagamento.' });
    }

    const totalPaidCents = paymentParts.reduce(
      (acc: number, p: any) => acc + Number(p.amountCents || 0),
      0
    );
    if (totalPaidCents < totalCents) {
      return res.status(400).json({ error: 'Valor pago é menor que o total da venda.' });
    }

    const changeCents = totalPaidCents - totalCents;
    const primaryMethod =
      paymentParts.length > 1 ? 'Misto' : String(paymentParts[0].method || 'Dinheiro');

    // Deduct stock
    for (const r of resolvedItems) {
      await repo.adjustNumericColumn('products', r.product.id, 'stock', -r.quantity);
    }

    const orderNumber = `PDV-${Date.now().toString().slice(-6)}`;
    const createdOrder = await repo.insertRow('orders', {
      orderNumber,
      channel: 'pdv',
      operatorId: req.user!.id,
      registerId: reg.id,
      customerName: sanitizeText(req.body?.customerName) || 'Consumidor Balcão',
      customerCpf: formattedCpf,
      status: 'Entregue',
      subtotalCents,
      discountCents,
      shippingCents: 0,
      totalCents,
      paymentMethod: primaryMethod,
      paymentDetails: JSON.stringify({ parts: paymentParts, totalPaidCents, changeCents }),
      authorizedBy,
      deliveredAt: new Date(),
    });

    await repo.insertMany(
      'order_items',
      resolvedItems.map((r) => ({
        orderId: createdOrder.id,
        productId: r.product.id,
        productCode: r.product.code,
        productName: r.product.name,
        quantity: r.quantity,
        unitPriceCents: r.product.priceCents,
        totalCents: r.totalCents,
      }))
    );

    const todayStr = new Date().toISOString().slice(0, 10);
    await repo.insertRow('financial_entries', {
      type: 'receber',
      description: `Venda PDV ${orderNumber} (${primaryMethod})`,
      amountCents: totalCents,
      dueDate: todayStr,
      paidDate: todayStr,
      status: 'Pago',
      orderId: createdOrder.id,
    });

    await logAudit(req.user, 'PDV_SALE', 'orders', `Venda PDV ${orderNumber} finalizada.`);

    return res.status(201).json({
      order: createdOrder,
      items: resolvedItems.map((r) => ({
        code: r.product.code,
        name: r.product.name,
        quantity: r.quantity,
        unitPriceCents: r.product.priceCents,
        totalCents: r.totalCents,
      })),
      changeCents,
    });
  } catch (err) {
    console.error('PDV sale error:', err);
    return res.status(500).json({ error: 'Erro ao finalizar venda no PDV.' });
  }
});

router.post('/sales/:id/cancel', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const reason = sanitizeText(req.body?.reason || '');
    const adminPassword = String(req.body?.adminPassword || '');

    if (!reason || reason.length < 5) {
      return res.status(400).json({ error: 'Informe uma justificativa de pelo menos 5 caracteres.' });
    }

    const admins = await repo.findWhere('users', { role: 'admin' });
    let authorizedAdmin: any = null;
    for (const a of admins) {
      if (a.passwordHash && (await bcrypt.compare(adminPassword, a.passwordHash))) {
        authorizedAdmin = a;
        break;
      }
    }
    if (!authorizedAdmin) {
      return res.status(403).json({
        error: 'Cancelar venda finalizada exige senha de autorização do Administrador.',
      });
    }

    const order = await repo.findOneWhere('orders', { id });
    if (!order || order.channel !== 'pdv') {
      return res.status(404).json({ error: 'Venda não encontrada.' });
    }
    if (order.status === 'Cancelado') {
      return res.status(400).json({ error: 'Venda já está cancelada.' });
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
        cancellationReason: reason,
        authorizedBy: authorizedAdmin.email,
      }
    );

    await logAudit(req.user, 'PDV_CANCEL_SALE', 'orders', `Venda ${order.orderNumber} cancelada com autorização de ${authorizedAdmin.email}.`);
    return res.json({ order: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao cancelar venda.' });
  }
});

router.get('/sales/today', async (req: AuthRequest, res) => {
  try {
    const allSales = await repo.findWhere(
      'orders',
      { channel: 'pdv', operatorId: req.user!.id },
      { orderBy: 'createdAt', desc: true }
    );

    const todayStr = new Date().toISOString().slice(0, 10);
    const todaySales = allSales.filter(
      (s) => new Date(s.createdAt).toISOString().slice(0, 10) === todayStr
    );

    return res.json({ sales: todaySales });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar vendas do turno.' });
  }
});

export default router;
