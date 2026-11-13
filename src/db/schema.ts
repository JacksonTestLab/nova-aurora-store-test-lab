import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').unique(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  role: text('role').notNull().default('cliente'), // 'admin' | 'caixa' | 'cliente'
  cpf: text('cpf').unique(),
  phone: text('phone'),
  birthDate: text('birth_date'),
  cep: text('cep'),
  address: text('address'),
  number: text('number'),
  complement: text('complement'),
  neighborhood: text('neighborhood'),
  city: text('city'),
  state: text('state'),
  avatarUrl: text('avatar_url'),
  status: text('status').notNull().default('ativo'), // 'ativo' | 'inativo'
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const addresses = pgTable('addresses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  label: text('label').notNull(),
  cep: text('cep').notNull(),
  street: text('street').notNull(),
  number: text('number').notNull(),
  complement: text('complement'),
  neighborhood: text('neighborhood'),
  city: text('city').notNull(),
  state: text('state').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  status: text('status').notNull().default('ativo'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  categoryId: integer('category_id').references(() => categories.id),
  supplier: text('supplier').notNull(),
  priceCents: integer('price_cents').notNull(),
  stock: integer('stock').notNull().default(0),
  minStock: integer('min_stock').notNull().default(5),
  imageUrl: text('image_url'),
  status: text('status').notNull().default('ativo'), // 'ativo' | 'inativo'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  type: text('type').notNull(), // 'percentual' | 'fixo'
  value: integer('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usageLimit: integer('usage_limit').notNull().default(100),
  usedCount: integer('used_count').notNull().default(0),
  status: text('status').notNull().default('ativo'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const cashRegisters = pgTable('cash_registers', {
  id: serial('id').primaryKey(),
  operatorId: integer('operator_id')
    .references(() => users.id)
    .notNull(),
  status: text('status').notNull().default('aberto'), // 'aberto' | 'fechado'
  initialAmountCents: integer('initial_amount_cents').notNull(),
  closingAmountCents: integer('closing_amount_cents'),
  openedAt: timestamp('opened_at').defaultNow().notNull(),
  closedAt: timestamp('closed_at'),
  notes: text('notes'),
});

export const cashMovements = pgTable('cash_movements', {
  id: serial('id').primaryKey(),
  registerId: integer('register_id')
    .references(() => cashRegisters.id, { onDelete: 'cascade' })
    .notNull(),
  operatorId: integer('operator_id')
    .references(() => users.id)
    .notNull(),
  type: text('type').notNull(), // 'sangria' | 'suprimento'
  amountCents: integer('amount_cents').notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  channel: text('channel').notNull(), // 'online' | 'pdv'
  customerId: integer('customer_id').references(() => users.id),
  operatorId: integer('operator_id').references(() => users.id),
  registerId: integer('register_id').references(() => cashRegisters.id),
  customerName: text('customer_name'),
  customerCpf: text('customer_cpf'),
  status: text('status').notNull().default('Pendente'), // 'Pendente' | 'Pago' | 'Enviado' | 'Entregue' | 'Cancelado'
  subtotalCents: integer('subtotal_cents').notNull(),
  discountCents: integer('discount_cents').notNull().default(0),
  shippingCents: integer('shipping_cents').notNull().default(0),
  totalCents: integer('total_cents').notNull(),
  couponCode: text('coupon_code'),
  paymentMethod: text('payment_method').notNull(),
  paymentDetails: text('payment_details'),
  shippingAddress: text('shipping_address'),
  cancellationReason: text('cancellation_reason'),
  authorizedBy: text('authorized_by'),
  returnStatus: text('return_status').notNull().default('Nenhum'), // 'Nenhum' | 'Solicitado' | 'Aprovado' | 'Recusado'
  returnReason: text('return_reason'),
  deliveredAt: timestamp('delivered_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  productCode: text('product_code').notNull(),
  productName: text('product_name').notNull(),
  quantity: integer('quantity').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
  totalCents: integer('total_cents').notNull(),
});

export const cartItems = pgTable('cart_items', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  quantity: integer('quantity').notNull().default(1),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const favorites = pgTable('favorites', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  userName: text('user_name').notNull(),
  rating: integer('rating').notNull(),
  comment: text('comment').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const financialEntries = pgTable('financial_entries', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(), // 'pagar' | 'receber'
  description: text('description').notNull(),
  amountCents: integer('amount_cents').notNull(),
  dueDate: text('due_date').notNull(), // YYYY-MM-DD
  paidDate: text('paid_date'), // YYYY-MM-DD
  status: text('status').notNull().default('Pendente'), // 'Pendente' | 'Pago' | 'Atrasado'
  orderId: integer('order_id').references(() => orders.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const attachments = pgTable('attachments', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  fileData: text('file_data').notNull(),
  uploadedBy: text('uploaded_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorEmail: text('actor_email').notNull(),
  actorRole: text('actor_role').notNull(),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  details: text('details').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const labSettings = pgTable('lab_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  addresses: many(addresses),
  orders: many(orders),
  cartItems: many(cartItems),
  favorites: many(favorites),
  reviews: many(reviews),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  reviews: many(reviews),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(users, {
    fields: [orders.customerId],
    references: [users.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));
