import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { repo } from '../../db/repo.ts';
import { ensureSuperAdminAccount } from '../../db/seed.ts';
import { isSuperAdminRecord, logAudit } from '../../middleware/auth.ts';
import { formatBackupFilename } from '../../utils/date.ts';

export const BACKUP_SCHEMA_VERSION = '1.0.0';
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024; // 10 MB
const BACKUP_HISTORY_KEY = 'backupHistory';
const INTERNAL_SETTINGS_KEYS = new Set([BACKUP_HISTORY_KEY, 'latestSafetyBackup']);

export interface BackupMetadata {
  appName: string;
  schemaVersion: string;
  generatedAt: string;
  generatedBy: string;
  counts: Record<string, number>;
  integrityHash: string;
}

export interface BackupDataPayload {
  users: any[];
  addresses: any[];
  categories: any[];
  products: any[];
  coupons: any[];
  cash_registers: any[];
  cash_movements: any[];
  orders: any[];
  order_items: any[];
  cart_items: any[];
  favorites: any[];
  reviews: any[];
  financial_entries: any[];
  attachments: any[];
  lab_settings: any[];
}

export interface BackupFilePayload {
  metadata: BackupMetadata;
  data: BackupDataPayload;
}

export interface BackupHistoryEntry {
  id: string;
  filename: string;
  createdAt: string;
  sizeBytes: number;
  generatedBy: string;
  kind: 'manual' | 'safety';
  counts: Record<string, number>;
  integrityHash: string;
}

function stableSortValue(val: any): any {
  if (Array.isArray(val)) return val.map(stableSortValue);
  if (val && typeof val === 'object' && !(val instanceof Date)) {
    const sorted: Record<string, any> = {};
    for (const key of Object.keys(val).sort()) {
      if (val[key] !== undefined) {
        sorted[key] = stableSortValue(val[key]);
      }
    }
    return sorted;
  }
  return val;
}

export function computeIntegrityHash(data: BackupDataPayload): string {
  const canonical = JSON.stringify(stableSortValue(data));
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export async function getBackupHistory(): Promise<BackupHistoryEntry[]> {
  try {
    const row = await repo.findOneWhere('lab_settings', { key: BACKUP_HISTORY_KEY });
    if (!row?.value) return [];
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function appendBackupHistory(entry: BackupHistoryEntry): Promise<BackupHistoryEntry[]> {
  const current = await getBackupHistory();
  const next = [entry, ...current].slice(0, 20);
  await repo.upsertRow(
    'lab_settings',
    {
      key: BACKUP_HISTORY_KEY,
      value: JSON.stringify(next),
      updatedAt: new Date(),
    },
    'key'
  );
  return next;
}

export async function generateBackupPayload(
  actor: { email: string; role: string } | undefined,
  kind: 'manual' | 'safety' = 'manual'
): Promise<{
  filename: string;
  payload: BackupFilePayload;
  jsonString: string;
  historyEntry: BackupHistoryEntry;
}> {
  const [
    rawUsers,
    addresses,
    categories,
    products,
    coupons,
    cash_registers,
    cash_movements,
    orders,
    order_items,
    cart_items,
    favorites,
    reviews,
    financial_entries,
    attachments,
    rawSettings,
  ] = await Promise.all([
    repo.listAll('users', { orderBy: 'id' }),
    repo.listAll('addresses', { orderBy: 'id' }),
    repo.listAll('categories', { orderBy: 'id' }),
    repo.listAll('products', { orderBy: 'id' }),
    repo.listAll('coupons', { orderBy: 'id' }),
    repo.listAll('cash_registers', { orderBy: 'id' }),
    repo.listAll('cash_movements', { orderBy: 'id' }),
    repo.listAll('orders', { orderBy: 'id' }),
    repo.listAll('order_items', { orderBy: 'id' }),
    repo.listAll('cart_items', { orderBy: 'id' }),
    repo.listAll('favorites', { orderBy: 'id' }),
    repo.listAll('reviews', { orderBy: 'id' }),
    repo.listAll('financial_entries', { orderBy: 'id' }),
    repo.listAll('attachments', { orderBy: 'id' }),
    repo.listAll('lab_settings'),
  ]);

  // Super Admin must remain invisible and NEVER appear in exported backups
  const superIds = new Set(rawUsers.filter((u) => isSuperAdminRecord(u)).map((u) => u.id));
  const users = rawUsers.filter((u) => !superIds.has(u.id));
  const lab_settings = rawSettings.filter((s) => !INTERNAL_SETTINGS_KEYS.has(s.key));

  const data: BackupDataPayload = {
    users,
    addresses: addresses.filter((a) => !superIds.has(a.userId)),
    categories,
    products,
    coupons,
    cash_registers: cash_registers.filter((r) => !superIds.has(r.operatorId)),
    cash_movements: cash_movements.filter((m) => !superIds.has(m.operatorId)),
    orders: orders.filter(
      (o) => !superIds.has(o.customerId) && !superIds.has(o.operatorId)
    ),
    order_items,
    cart_items: cart_items.filter((c) => !superIds.has(c.userId)),
    favorites: favorites.filter((f) => !superIds.has(f.userId)),
    reviews: reviews.filter((r) => !superIds.has(r.userId)),
    financial_entries,
    attachments,
    lab_settings,
  };

  const counts: Record<string, number> = {
    users: data.users.length,
    categories: data.categories.length,
    products: data.products.length,
    coupons: data.coupons.length,
    orders: data.orders.length,
    order_items: data.order_items.length,
    financial_entries: data.financial_entries.length,
    attachments: data.attachments.length,
  };

  const now = new Date();
  const generatedBy = isSuperAdminRecord(actor) ? 'Super Admin' : actor?.email || 'Super Admin';
  const integrityHash = computeIntegrityHash(data);

  const payload: BackupFilePayload = {
    metadata: {
      appName: 'Nova Aurora Store',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      generatedAt: now.toISOString(),
      generatedBy,
      counts,
      integrityHash,
    },
    data,
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const filename = formatBackupFilename(now);
  const historyEntry: BackupHistoryEntry = {
    id: `${now.getTime()}-${integrityHash.slice(0, 8)}`,
    filename: kind === 'safety' ? `safety-${filename}` : filename,
    createdAt: now.toISOString(),
    sizeBytes: Buffer.byteLength(jsonString, 'utf8'),
    generatedBy,
    kind,
    counts,
    integrityHash,
  };

  await appendBackupHistory(historyEntry);

  if (kind === 'safety') {
    await repo.upsertRow(
      'lab_settings',
      {
        key: 'latestSafetyBackup',
        value: jsonString.length <= 2_000_000 ? jsonString : JSON.stringify({ metadata: payload.metadata }),
        updatedAt: now,
      },
      'key'
    );
  }

  return { filename, payload, jsonString, historyEntry };
}

export function validateBackupObject(
  rawPayload: any,
  rawByteLength?: number
): { valid: true; payload: BackupFilePayload } | { valid: false; error: string } {
  if (rawByteLength && rawByteLength > MAX_BACKUP_BYTES) {
    return { valid: false, error: 'Arquivo de backup excede o limite máximo de 10 MB.' };
  }
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    return { valid: false, error: 'Estrutura JSON de backup inválida.' };
  }
  const { metadata, data } = rawPayload;
  if (!metadata || typeof metadata !== 'object' || !data || typeof data !== 'object') {
    return {
      valid: false,
      error: 'Backup inválido: objetos obrigatórios "metadata" e "data" não encontrados.',
    };
  }
  if (metadata.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    return {
      valid: false,
      error: `Versão de schema incompatível (${metadata.schemaVersion || 'ausente'}). Esperada: ${BACKUP_SCHEMA_VERSION}.`,
    };
  }

  const requiredArrays: Array<keyof BackupDataPayload> = [
    'users',
    'categories',
    'products',
    'orders',
    'order_items',
    'coupons',
    'financial_entries',
  ];
  for (const key of requiredArrays) {
    if (!Array.isArray(data[key])) {
      return {
        valid: false,
        error: `Backup inválido: coleção obrigatória "${key}" ausente ou malformada.`,
      };
    }
  }

  if (!metadata.integrityHash || typeof metadata.integrityHash !== 'string') {
    return { valid: false, error: 'Backup inválido: hash de integridade SHA-256 ausente.' };
  }

  const expectedHash = computeIntegrityHash(data as BackupDataPayload);
  if (metadata.integrityHash !== expectedHash) {
    return {
      valid: false,
      error: 'Arquivo de backup corrompido ou adulterado: hash de integridade SHA-256 inválido.',
    };
  }

  return { valid: true, payload: rawPayload as BackupFilePayload };
}

async function applyDatasetWithRemappedIds(
  data: BackupDataPayload,
  preservedUsersByEmail: Map<string, any>
) {
  const defaultHash = await bcrypt.hash('Cliente@123', 10);

  // Clear dependent tables in FK order
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
  await repo.deleteAll('attachments');

  const keepIds = Array.from(preservedUsersByEmail.values()).map((u) => u.id);
  await repo.deleteAllExcept('users', keepIds);

  // 1. Users (ignore any superadmin entries if present; update preserved accounts in-place)
  const userIdMap = new Map<number, number>();
  for (const u of data.users || []) {
    if (isSuperAdminRecord(u)) continue;
    const email = String(u.email || '').trim().toLowerCase();
    if (!email) continue;
    const preserved = preservedUsersByEmail.get(email);
    const payload = {
      uid: u.uid ?? null,
      name: u.name || email.split('@')[0],
      email,
      passwordHash: u.passwordHash || defaultHash,
      role: ['admin', 'caixa', 'cliente'].includes(u.role) ? u.role : 'cliente',
      cpf: u.cpf ?? null,
      phone: u.phone ?? null,
      birthDate: u.birthDate ?? null,
      cep: u.cep ?? null,
      address: u.address ?? null,
      number: u.number ?? null,
      complement: u.complement ?? null,
      neighborhood: u.neighborhood ?? null,
      city: u.city ?? null,
      state: u.state ?? null,
      avatarUrl: u.avatarUrl ?? null,
      status: u.status === 'inativo' ? 'inativo' : 'ativo',
      failedLoginAttempts: 0,
      lockedUntil: null,
    };

    if (preserved) {
      const [updated] = await repo.updateWhere('users', { id: preserved.id }, payload);
      if (typeof u.id === 'number') userIdMap.set(u.id, (updated || preserved).id);
    } else {
      const inserted = await repo.insertRow('users', payload);
      if (typeof u.id === 'number') userIdMap.set(u.id, inserted.id);
    }
  }

  // 2. Addresses
  for (const a of data.addresses || []) {
    const newUserId = userIdMap.get(a.userId);
    if (!newUserId) continue;
    await repo.insertRow('addresses', {
      userId: newUserId,
      label: a.label,
      cep: a.cep,
      street: a.street,
      number: a.number,
      complement: a.complement ?? null,
      neighborhood: a.neighborhood ?? null,
      city: a.city,
      state: a.state,
      isDefault: Boolean(a.isDefault),
    });
  }

  // 3. Categories
  const categoryIdMap = new Map<number, number>();
  for (const c of data.categories || []) {
    const inserted = await repo.insertRow('categories', {
      name: c.name,
      slug: c.slug,
      description: c.description ?? null,
      status: c.status || 'ativo',
    });
    if (typeof c.id === 'number') categoryIdMap.set(c.id, inserted.id);
  }

  // 4. Products (imageUrl preserved as URL; never base64)
  const productIdMap = new Map<number, number>();
  for (const p of data.products || []) {
    const imgUrl =
      typeof p.imageUrl === 'string' && !p.imageUrl.startsWith('data:image/')
        ? p.imageUrl
        : null;
    const inserted = await repo.insertRow('products', {
      code: p.code,
      name: p.name,
      description: p.description,
      categoryId: p.categoryId ? categoryIdMap.get(p.categoryId) ?? null : null,
      supplier: p.supplier,
      priceCents: Number(p.priceCents),
      stock: Number(p.stock ?? 0),
      minStock: Number(p.minStock ?? 5),
      imageUrl: imgUrl,
      status: p.status || 'ativo',
    });
    if (typeof p.id === 'number') productIdMap.set(p.id, inserted.id);
  }

  // 5. Coupons
  for (const cp of data.coupons || []) {
    await repo.insertRow('coupons', {
      code: cp.code,
      type: cp.type,
      value: Number(cp.value),
      expiresAt: cp.expiresAt ? new Date(cp.expiresAt) : new Date(),
      usageLimit: Number(cp.usageLimit ?? 100),
      usedCount: Number(cp.usedCount ?? 0),
      status: cp.status || 'ativo',
    });
  }

  // 6. Cash registers & movements
  const registerIdMap = new Map<number, number>();
  for (const reg of data.cash_registers || []) {
    const opId = userIdMap.get(reg.operatorId);
    if (!opId) continue;
    const inserted = await repo.insertRow('cash_registers', {
      operatorId: opId,
      status: reg.status || 'fechado',
      initialAmountCents: Number(reg.initialAmountCents ?? 0),
      closingAmountCents: reg.closingAmountCents ?? null,
      openedAt: reg.openedAt ? new Date(reg.openedAt) : new Date(),
      closedAt: reg.closedAt ? new Date(reg.closedAt) : null,
      notes: reg.notes ?? null,
    });
    if (typeof reg.id === 'number') registerIdMap.set(reg.id, inserted.id);
  }

  for (const mov of data.cash_movements || []) {
    const regId = registerIdMap.get(mov.registerId);
    const opId = userIdMap.get(mov.operatorId);
    if (!regId || !opId) continue;
    await repo.insertRow('cash_movements', {
      registerId: regId,
      operatorId: opId,
      type: mov.type,
      amountCents: Number(mov.amountCents),
      reason: mov.reason,
    });
  }

  // 7. Orders & order_items
  const orderIdMap = new Map<number, number>();
  for (const o of data.orders || []) {
    const inserted = await repo.insertRow('orders', {
      orderNumber: o.orderNumber,
      channel: o.channel,
      customerId: o.customerId ? userIdMap.get(o.customerId) ?? null : null,
      operatorId: o.operatorId ? userIdMap.get(o.operatorId) ?? null : null,
      registerId: o.registerId ? registerIdMap.get(o.registerId) ?? null : null,
      customerName: o.customerName ?? null,
      customerCpf: o.customerCpf ?? null,
      status: o.status || 'Pendente',
      subtotalCents: Number(o.subtotalCents ?? 0),
      discountCents: Number(o.discountCents ?? 0),
      shippingCents: Number(o.shippingCents ?? 0),
      totalCents: Number(o.totalCents ?? 0),
      couponCode: o.couponCode ?? null,
      paymentMethod: o.paymentMethod,
      paymentDetails: o.paymentDetails ?? null,
      shippingAddress: o.shippingAddress ?? null,
      cancellationReason: o.cancellationReason ?? null,
      authorizedBy: o.authorizedBy ?? null,
      returnStatus: o.returnStatus || 'Nenhum',
      returnReason: o.returnReason ?? null,
      deliveredAt: o.deliveredAt ? new Date(o.deliveredAt) : null,
      createdAt: o.createdAt ? new Date(o.createdAt) : new Date(),
    });
    if (typeof o.id === 'number') orderIdMap.set(o.id, inserted.id);
  }

  for (const oi of data.order_items || []) {
    const orderId = orderIdMap.get(oi.orderId);
    const productId = productIdMap.get(oi.productId);
    if (!orderId || !productId) continue;
    await repo.insertRow('order_items', {
      orderId,
      productId,
      productCode: oi.productCode,
      productName: oi.productName,
      quantity: Number(oi.quantity),
      unitPriceCents: Number(oi.unitPriceCents),
      totalCents: Number(oi.totalCents),
    });
  }

  // 8. Cart items, Favorites, Reviews
  for (const c of data.cart_items || []) {
    const userId = userIdMap.get(c.userId);
    const productId = productIdMap.get(c.productId);
    if (!userId || !productId) continue;
    await repo.insertRow('cart_items', {
      userId,
      productId,
      quantity: Number(c.quantity ?? 1),
    });
  }

  for (const f of data.favorites || []) {
    const userId = userIdMap.get(f.userId);
    const productId = productIdMap.get(f.productId);
    if (!userId || !productId) continue;
    await repo.insertRow('favorites', { userId, productId });
  }

  for (const r of data.reviews || []) {
    const userId = userIdMap.get(r.userId);
    const productId = productIdMap.get(r.productId);
    if (!userId || !productId) continue;
    await repo.insertRow('reviews', {
      productId,
      userId,
      userName: r.userName,
      rating: Number(r.rating),
      comment: r.comment,
    });
  }

  // 9. Financial entries
  for (const f of data.financial_entries || []) {
    await repo.insertRow('financial_entries', {
      type: f.type,
      description: f.description,
      amountCents: Number(f.amountCents),
      dueDate: f.dueDate,
      paidDate: f.paidDate ?? null,
      status: f.status || 'Pendente',
      orderId: f.orderId ? orderIdMap.get(f.orderId) ?? null : null,
    });
  }

  // 10. Attachments
  for (const att of data.attachments || []) {
    await repo.insertRow('attachments', {
      filename: att.filename,
      originalName: att.originalName,
      mimeType: att.mimeType,
      sizeBytes: Number(att.sizeBytes),
      fileData: att.fileData,
      uploadedBy: att.uploadedBy,
    });
  }

  // 11. Lab settings (never overwrite backup history)
  for (const s of data.lab_settings || []) {
    if (!s?.key || INTERNAL_SETTINGS_KEYS.has(s.key)) continue;
    await repo.upsertRow(
      'lab_settings',
      { key: s.key, value: String(s.value ?? ''), updatedAt: new Date() },
      'key'
    );
  }
}

export async function restoreBackupPayload(
  payload: BackupFilePayload,
  actor: { id?: number; email: string; role: string }
) {
  // Step 1: Generate an automatic pre-restore safety backup
  const safety = await generateBackupPayload(actor, 'safety');

  const allCurrentUsers = await repo.listAll('users');
  const preservedUsersByEmail = new Map<string, any>();
  for (const u of allCurrentUsers) {
    if (isSuperAdminRecord(u) || (actor.id && u.id === actor.id)) {
      preservedUsersByEmail.set(String(u.email || '').toLowerCase(), u);
    }
  }

  // Snapshot before restore for compensating rollback in Supabase REST mode
  const rollbackData = safety.payload.data;

  try {
    await repo.runInTransaction(async () => {
      await applyDatasetWithRemappedIds(payload.data, preservedUsersByEmail);
      await ensureSuperAdminAccount();
    });

    await logAudit(
      actor,
      'RESTORE_BACKUP',
      'system',
      `Backup restaurado (gerado em ${payload.metadata.generatedAt}, hash ${payload.metadata.integrityHash.slice(0, 12)}). Backup de segurança: ${safety.historyEntry.filename}.`
    );

    return {
      restored: true,
      safetyBackup: safety.historyEntry,
      counts: payload.metadata.counts,
    };
  } catch (err) {
    // Compensating rollback in Supabase REST mode
    try {
      await applyDatasetWithRemappedIds(rollbackData, preservedUsersByEmail);
      await ensureSuperAdminAccount();
    } catch (rbErr) {
      console.error('Rollback after failed backup restore also errored:', rbErr);
    }
    throw err;
  }
}
