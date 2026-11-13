-- =============================================================================
-- Nova Aurora Store Test Lab - Supabase PostgreSQL Schema & RLS
-- =============================================================================

-- 1. Tabelas principais
CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  uid TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'cliente' CHECK (role IN ('admin', 'caixa', 'cliente')),
  cpf TEXT UNIQUE,
  phone TEXT,
  birth_date TEXT,
  cep TEXT,
  address TEXT,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.addresses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  cep TEXT NOT NULL,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  complement TEXT,
  neighborhood TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category_id INTEGER REFERENCES public.categories(id) ON DELETE SET NULL,
  supplier TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock INTEGER NOT NULL DEFAULT 5 CHECK (min_stock >= 0),
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.coupons (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('percentual', 'fixo')),
  value INTEGER NOT NULL CHECK (value > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  usage_limit INTEGER NOT NULL DEFAULT 100 CHECK (usage_limit >= 1),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cash_registers (
  id SERIAL PRIMARY KEY,
  operator_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado')),
  initial_amount_cents INTEGER NOT NULL CHECK (initial_amount_cents >= 0),
  closing_amount_cents INTEGER CHECK (closing_amount_cents >= 0),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS public.cash_movements (
  id SERIAL PRIMARY KEY,
  register_id INTEGER NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  operator_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('sangria', 'suprimento')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id SERIAL PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL CHECK (channel IN ('online', 'pdv')),
  customer_id INTEGER REFERENCES public.users(id) ON DELETE RESTRICT,
  operator_id INTEGER REFERENCES public.users(id) ON DELETE RESTRICT,
  register_id INTEGER REFERENCES public.cash_registers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_cpf TEXT,
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Pago', 'Enviado', 'Entregue', 'Cancelado')),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  shipping_cents INTEGER NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  coupon_code TEXT,
  payment_method TEXT NOT NULL,
  payment_details TEXT,
  shipping_address TEXT,
  cancellation_reason TEXT,
  authorized_by TEXT,
  return_status TEXT NOT NULL DEFAULT 'Nenhum' CHECK (return_status IN ('Nenhum', 'Solicitado', 'Aprovado', 'Recusado')),
  return_reason TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0)
);

CREATE TABLE IF NOT EXISTS public.cart_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.favorites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.financial_entries (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('pagar', 'receber')),
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  due_date TEXT NOT NULL,
  paid_date TEXT,
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Pago', 'Atrasado')),
  order_id INTEGER REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attachments (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  file_data TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id SERIAL PRIMARY KEY,
  actor_email TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lab_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_users_role_status ON public.users(role, status);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON public.addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category_status ON public.products(category_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_registers_operator_status ON public.cash_registers(operator_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_movements_register_id ON public.cash_movements(register_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_operator_id ON public.orders(operator_id);
CREATE INDEX IF NOT EXISTS idx_orders_register_id ON public.orders(register_id);
CREATE INDEX IF NOT EXISTS idx_orders_channel_status_created ON public.orders(channel, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON public.cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_type_status_due ON public.financial_entries(type, status, due_date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 3. Funções auxiliares RLS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE uid = auth.uid()::text AND status = 'ativo' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_app_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE uid = auth.uid()::text AND status = 'ativo' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_app_user_role() = 'admin', FALSE);
$$;

CREATE OR REPLACE FUNCTION public.is_cashier_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_app_user_role() IN ('admin', 'caixa'), FALSE);
$$;

-- 4. Sincronização automática auth.users -> public.users
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
BEGIN
  v_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    SPLIT_PART(NEW.email, '@', 1)
  );

  INSERT INTO public.users (uid, name, email, role, avatar_url, status)
  VALUES (
    NEW.id::text,
    v_name,
    LOWER(NEW.email),
    'cliente',
    NEW.raw_user_meta_data ->> 'avatar_url',
    'ativo'
  )
  ON CONFLICT (email) DO UPDATE
    SET uid = EXCLUDED.uid,
        avatar_url = COALESCE(public.users.avatar_url, EXCLUDED.avatar_url);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- 5. Ativar RLS em todas as tabelas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_settings ENABLE ROW LEVEL SECURITY;

-- 6. Policies por perfil
DROP POLICY IF EXISTS users_select_own_or_admin ON public.users;
CREATE POLICY users_select_own_or_admin ON public.users
  FOR SELECT TO authenticated
  USING (id = public.current_app_user_id() OR public.is_admin());

DROP POLICY IF EXISTS users_insert_admin ON public.users;
CREATE POLICY users_insert_admin ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS users_update_own_or_admin ON public.users;
CREATE POLICY users_update_own_or_admin ON public.users
  FOR UPDATE TO authenticated
  USING (id = public.current_app_user_id() OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (
      id = public.current_app_user_id()
      AND role = public.current_app_user_role()
      AND status = 'ativo'
    )
  );

DROP POLICY IF EXISTS users_delete_admin ON public.users;
CREATE POLICY users_delete_admin ON public.users
  FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS addresses_own_or_admin ON public.addresses;
CREATE POLICY addresses_own_or_admin ON public.addresses
  FOR ALL TO authenticated
  USING (user_id = public.current_app_user_id() OR public.is_admin())
  WITH CHECK (user_id = public.current_app_user_id() OR public.is_admin());

DROP POLICY IF EXISTS categories_public_select ON public.categories;
CREATE POLICY categories_public_select ON public.categories
  FOR SELECT TO anon, authenticated
  USING (status = 'ativo' OR public.is_admin());

DROP POLICY IF EXISTS categories_admin_write ON public.categories;
CREATE POLICY categories_admin_write ON public.categories
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS products_public_select ON public.products;
CREATE POLICY products_public_select ON public.products
  FOR SELECT TO anon, authenticated
  USING (status = 'ativo' OR public.is_admin() OR public.is_cashier_or_admin());

DROP POLICY IF EXISTS products_admin_write ON public.products;
CREATE POLICY products_admin_write ON public.products
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS coupons_admin_all ON public.coupons;
CREATE POLICY coupons_admin_all ON public.coupons
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS cash_registers_pdv_select ON public.cash_registers;
CREATE POLICY cash_registers_pdv_select ON public.cash_registers
  FOR SELECT TO authenticated
  USING (public.is_admin() OR (public.is_cashier_or_admin() AND operator_id = public.current_app_user_id()));

DROP POLICY IF EXISTS cash_registers_pdv_insert ON public.cash_registers;
CREATE POLICY cash_registers_pdv_insert ON public.cash_registers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR (public.is_cashier_or_admin() AND operator_id = public.current_app_user_id()));

DROP POLICY IF EXISTS cash_registers_pdv_update ON public.cash_registers;
CREATE POLICY cash_registers_pdv_update ON public.cash_registers
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR (public.is_cashier_or_admin() AND operator_id = public.current_app_user_id()))
  WITH CHECK (public.is_admin() OR (public.is_cashier_or_admin() AND operator_id = public.current_app_user_id()));

DROP POLICY IF EXISTS cash_movements_pdv_select ON public.cash_movements;
CREATE POLICY cash_movements_pdv_select ON public.cash_movements
  FOR SELECT TO authenticated
  USING (public.is_admin() OR (public.is_cashier_or_admin() AND operator_id = public.current_app_user_id()));

DROP POLICY IF EXISTS cash_movements_pdv_insert ON public.cash_movements;
CREATE POLICY cash_movements_pdv_insert ON public.cash_movements
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR (public.is_cashier_or_admin() AND operator_id = public.current_app_user_id()));

DROP POLICY IF EXISTS orders_select_scoped ON public.orders;
CREATE POLICY orders_select_scoped ON public.orders
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR customer_id = public.current_app_user_id()
    OR (public.is_cashier_or_admin() AND channel = 'pdv' AND operator_id = public.current_app_user_id())
  );

DROP POLICY IF EXISTS orders_insert_scoped ON public.orders;
CREATE POLICY orders_insert_scoped ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (channel = 'online' AND customer_id = public.current_app_user_id())
    OR (public.is_cashier_or_admin() AND channel = 'pdv' AND operator_id = public.current_app_user_id())
  );

DROP POLICY IF EXISTS orders_update_scoped ON public.orders;
CREATE POLICY orders_update_scoped ON public.orders
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (customer_id = public.current_app_user_id())
    OR (public.is_cashier_or_admin() AND channel = 'pdv' AND operator_id = public.current_app_user_id())
  )
  WITH CHECK (
    public.is_admin()
    OR (customer_id = public.current_app_user_id())
    OR (public.is_cashier_or_admin() AND channel = 'pdv' AND operator_id = public.current_app_user_id())
  );

DROP POLICY IF EXISTS order_items_select_scoped ON public.order_items;
CREATE POLICY order_items_select_scoped ON public.order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          public.is_admin()
          OR o.customer_id = public.current_app_user_id()
          OR (public.is_cashier_or_admin() AND o.channel = 'pdv' AND o.operator_id = public.current_app_user_id())
        )
    )
  );

DROP POLICY IF EXISTS order_items_insert_scoped ON public.order_items;
CREATE POLICY order_items_insert_scoped ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          public.is_admin()
          OR (o.channel = 'online' AND o.customer_id = public.current_app_user_id())
          OR (public.is_cashier_or_admin() AND o.channel = 'pdv' AND o.operator_id = public.current_app_user_id())
        )
    )
  );

DROP POLICY IF EXISTS cart_items_own ON public.cart_items;
CREATE POLICY cart_items_own ON public.cart_items
  FOR ALL TO authenticated
  USING (user_id = public.current_app_user_id() OR public.is_admin())
  WITH CHECK (user_id = public.current_app_user_id() OR public.is_admin());

DROP POLICY IF EXISTS favorites_own ON public.favorites;
CREATE POLICY favorites_own ON public.favorites
  FOR ALL TO authenticated
  USING (user_id = public.current_app_user_id() OR public.is_admin())
  WITH CHECK (user_id = public.current_app_user_id() OR public.is_admin());

DROP POLICY IF EXISTS reviews_public_select ON public.reviews;
CREATE POLICY reviews_public_select ON public.reviews
  FOR SELECT TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS reviews_insert_verified_buyer ON public.reviews;
CREATE POLICY reviews_insert_verified_buyer ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = public.current_app_user_id()
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id
      WHERE o.customer_id = public.current_app_user_id()
        AND o.status <> 'Cancelado'
        AND oi.product_id = reviews.product_id
    )
  );

DROP POLICY IF EXISTS reviews_delete_own_or_admin ON public.reviews;
CREATE POLICY reviews_delete_own_or_admin ON public.reviews
  FOR DELETE TO authenticated
  USING (user_id = public.current_app_user_id() OR public.is_admin());

DROP POLICY IF EXISTS financial_admin_all ON public.financial_entries;
CREATE POLICY financial_admin_all ON public.financial_entries
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS financial_pdv_insert ON public.financial_entries;
CREATE POLICY financial_pdv_insert ON public.financial_entries
  FOR INSERT TO authenticated
  WITH CHECK (public.is_cashier_or_admin());

DROP POLICY IF EXISTS attachments_admin_all ON public.attachments;
CREATE POLICY attachments_admin_all ON public.attachments
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS audit_logs_admin_select ON public.audit_logs;
CREATE POLICY audit_logs_admin_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS audit_logs_authenticated_insert ON public.audit_logs;
CREATE POLICY audit_logs_authenticated_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_email IS NOT NULL AND actor_role = public.current_app_user_role());

DROP POLICY IF EXISTS lab_settings_admin_all ON public.lab_settings;
CREATE POLICY lab_settings_admin_all ON public.lab_settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
