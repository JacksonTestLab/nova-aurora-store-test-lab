import React, { useCallback, useEffect, useState } from 'react';
import {
  Search,
  ShoppingCart,
  Heart,
  Package,
  User as UserIcon,
  Star,
  Plus,
  Minus,
  Trash2,
  X,
  CheckCircle2,
  Truck,
  CreditCard,
  QrCode,
  FileText,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ConfirmModal } from '../components/ConfirmModal';
import { ProductImage } from '../components/ProductImage';
import { PaginationBar } from '../components/PaginationBar';
import {
  formatBRL,
  isValidCPF,
  maskCEP,
  maskCPF,
  maskPhone,
} from '../utils/validators';

type StoreTab = 'vitrine' | 'pedidos' | 'favoritos' | 'conta';

export const StorePage: React.FC = () => {
  const { user, apiFetch, addToast, navigate, refreshUser, logout } = useApp();

  const [tab, setTab] = useState<StoreTab>(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get('tab') as StoreTab | null;
    return t || 'vitrine';
  });

  // Banner
  const [showPromoBanner, setShowPromoBanner] = useState(true);

  // Catalog state
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 8, total: 0, totalPages: 1 });
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [catalogError, setCatalogError] = useState('');

  // Catalog Filters
  const [searchQ, setSearchQ] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);

  // Detail modal
  const [detailModal, setDetailModal] = useState<{
    product: any;
    reviews: any[];
    avgRating: number;
  } | null>(null);
  const [detailQty, setDetailQty] = useState(1);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Cart drawer & checkout
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [cartSubtotal, setCartSubtotal] = useState(0);
  const [clearCartModal, setClearCartModal] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountCents: number } | null>(null);

  // Multi-step checkout
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3 | 4>(1);
  const [shipAddr, setShipAddr] = useState({
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: 'SP',
  });
  const [shipOption, setShipOption] = useState<'padrao' | 'expresso'>('padrao');
  const [payMethod, setPayMethod] = useState<'PIX' | 'Cartão de Crédito' | 'Boleto'>('PIX');
  const [cardData, setCardData] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [placingOrder, setPlacingOrder] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<any | null>(null);

  // Favorites, Orders, Account
  const [favoritesList, setFavoritesList] = useState<any[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [returnModalOrder, setReturnModalOrder] = useState<any | null>(null);
  const [returnReason, setReturnReason] = useState('');

  const [addressesList, setAddressesList] = useState<any[]>([]);
  const [accountForm, setAccountForm] = useState({
    name: user?.name || '',
    cpf: user?.cpf || '',
    phone: user?.phone || '',
    birthDate: user?.birthDate || '',
  });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [newAddressForm, setNewAddressForm] = useState({
    label: 'Casa',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: 'SP',
  });
  const [deleteAccountModal, setDeleteAccountModal] = useState(false);

  const loadCatalog = useCallback(async () => {
    setLoadingProducts(true);
    setCatalogError('');
    try {
      const qs = new URLSearchParams();
      if (searchQ) qs.set('q', searchQ);
      if (catFilter) qs.set('categoryId', catFilter);
      if (minPrice) qs.set('minPriceCents', String(Math.round(Number(minPrice) * 100)));
      if (maxPrice) qs.set('maxPriceCents', String(Math.round(Number(maxPrice) * 100)));
      if (inStockOnly) qs.set('inStockOnly', 'true');
      qs.set('sort', sortBy);
      qs.set('page', String(page));
      qs.set('limit', '8');

      const [catRes, prodRes] = await Promise.all([
        apiFetch('/api/store/categories'),
        apiFetch(`/api/store/products?${qs.toString()}`),
      ]);
      setCategories(catRes.categories || []);
      setProducts(prodRes.products || []);
      setPagination(prodRes.pagination || { page: 1, limit: 8, total: 0, totalPages: 1 });
    } catch (err: any) {
      setCatalogError(err.message || 'Erro ao carregar vitrine.');
    } finally {
      setLoadingProducts(false);
    }
  }, [apiFetch, catFilter, inStockOnly, maxPrice, minPrice, page, searchQ, sortBy]);

  const loadCart = useCallback(async () => {
    if (!user) {
      setCartItems([]);
      setCartSubtotal(0);
      return;
    }
    try {
      const data = await apiFetch('/api/store/cart');
      setCartItems(data.items || []);
      setCartSubtotal(data.subtotalCents || 0);
    } catch {
      // ignore
    }
  }, [apiFetch, user]);

  const loadFavorites = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiFetch('/api/store/favorites');
      setFavoritesList(data.favorites || []);
    } catch {
      // ignore
    }
  }, [apiFetch, user]);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiFetch('/api/store/orders');
      setOrdersList(data.orders || []);
    } catch {
      // ignore
    }
  }, [apiFetch, user]);

  const loadAddresses = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiFetch('/api/store/addresses');
      setAddressesList(data.addresses || []);
      if (data.addresses?.length > 0 && !shipAddr.cep) {
        const def = data.addresses[0];
        setShipAddr({
          cep: def.cep,
          street: def.street,
          number: def.number,
          complement: def.complement || '',
          neighborhood: def.neighborhood || '',
          city: def.city,
          state: def.state,
        });
      }
    } catch {
      // ignore
    }
  }, [apiFetch, shipAddr.cep, user]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (user) {
      loadCart();
      loadFavorites();
      loadAddresses();
      setAccountForm({
        name: user.name || '',
        cpf: user.cpf || '',
        phone: user.phone || '',
        birthDate: user.birthDate || '',
      });
    }
  }, [user, loadCart, loadFavorites, loadAddresses]);

  useEffect(() => {
    if (tab === 'pedidos') loadOrders();
    if (tab === 'favoritos') loadFavorites();
    if (tab === 'conta') loadAddresses();
  }, [tab, loadOrders, loadFavorites, loadAddresses]);

  const openProductDetail = async (productId: number) => {
    try {
      const data = await apiFetch(`/api/store/products/${productId}`);
      setDetailQty(1);
      setReviewComment('');
      setReviewRating(5);
      setDetailModal(data);
    } catch (err: any) {
      addToast('error', err.message);
    }
  };

  const handleAddToCart = async (productId: number, quantity = 1) => {
    if (!user) {
      addToast('info', 'Faça login para adicionar produtos ao carrinho.');
      navigate('/login');
      return;
    }
    try {
      await apiFetch('/api/store/cart', {
        method: 'POST',
        body: JSON.stringify({ productId, quantity }),
      });
      await loadCart();
      addToast('success', 'Produto adicionado ao carrinho.');
      setCartOpen(true);
    } catch (err: any) {
      addToast('error', err.message);
    }
  };

  const handleUpdateCartQty = async (productId: number, quantity: number) => {
    if (quantity < 1) {
      await apiFetch(`/api/store/cart/${productId}`, { method: 'DELETE' });
    } else {
      try {
        await apiFetch(`/api/store/cart/${productId}`, {
          method: 'PATCH',
          body: JSON.stringify({ quantity }),
        });
      } catch (err: any) {
        addToast('error', err.message);
      }
    }
    loadCart();
  };

  const handleClearCart = async () => {
    try {
      await apiFetch('/api/store/cart', { method: 'DELETE' });
      setAppliedCoupon(null);
      setCouponInput('');
      setClearCartModal(false);
      await loadCart();
      addToast('success', 'Carrinho limpo.');
    } catch (err: any) {
      addToast('error', err.message);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) {
      addToast('error', 'Digite um código de cupom.');
      return;
    }
    try {
      const data = await apiFetch('/api/store/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({ code: couponInput.trim(), subtotalCents: cartSubtotal }),
      });
      setAppliedCoupon({
        code: data.coupon.code,
        discountCents: data.discountCents,
      });
      addToast('success', `Cupom ${data.coupon.code} aplicado!`);
    } catch (err: any) {
      setAppliedCoupon(null);
      addToast('error', err.message);
    }
  };

  const shippingCents =
    shipOption === 'expresso' ? 3900 : cartSubtotal >= 100000 ? 0 : 2200;
  const discountCents = appliedCoupon?.discountCents || 0;
  const cartFinalTotal = Math.max(0, cartSubtotal - discountCents + shippingCents);

  const handleToggleFavorite = async (productId: number) => {
    if (!user) {
      addToast('info', 'Faça login para salvar favoritos.');
      navigate('/login');
      return;
    }
    const isFav = favoritesList.some((f) => f.id === productId);
    try {
      if (isFav) {
        await apiFetch(`/api/store/favorites/${productId}`, { method: 'DELETE' });
        addToast('info', 'Removido dos favoritos.');
      } else {
        await apiFetch(`/api/store/favorites/${productId}`, { method: 'POST' });
        addToast('success', 'Adicionado aos favoritos.');
      }
      loadFavorites();
    } catch (err: any) {
      addToast('error', err.message);
    }
  };

  const handleConfirmOrder = async () => {
    setPlacingOrder(true);
    try {
      const data = await apiFetch('/api/store/checkout', {
        method: 'POST',
        body: JSON.stringify({
          shippingAddress: shipAddr,
          shippingOption: shipOption,
          paymentMethod: payMethod,
          couponCode: appliedCoupon?.code || '',
        }),
      });
      setConfirmedOrder(data.order);
      setAppliedCoupon(null);
      setCouponInput('');
      await Promise.all([loadCart(), loadCatalog(), loadOrders()]);
      addToast('success', `Pedido ${data.order.orderNumber} realizado com sucesso!`);
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    try {
      await apiFetch(`/api/store/orders/${orderId}/cancel`, { method: 'POST' });
      addToast('success', 'Pedido cancelado e estoque devolvido.');
      await Promise.all([loadOrders(), loadCatalog()]);
    } catch (err: any) {
      addToast('error', err.message);
    }
  };

  const handleRequestReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnModalOrder) return;
    try {
      await apiFetch(`/api/store/orders/${returnModalOrder.id}/return`, {
        method: 'POST',
        body: JSON.stringify({ reason: returnReason }),
      });
      addToast('success', 'Solicitação de troca/devolução registrada!');
      setReturnModalOrder(null);
      setReturnReason('');
      loadOrders();
    } catch (err: any) {
      addToast('error', err.message);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailModal?.product) return;
    try {
      await apiFetch(`/api/store/products/${detailModal.product.id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment }),
      });
      addToast('success', 'Avaliação publicada!');
      openProductDetail(detailModal.product.id);
    } catch (err: any) {
      addToast('error', err.message);
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (accountForm.cpf && !isValidCPF(accountForm.cpf)) {
      addToast('error', 'CPF inválido.');
      return;
    }
    try {
      await apiFetch('/api/store/account', {
        method: 'PUT',
        body: JSON.stringify(accountForm),
      });
      await refreshUser();
      addToast('success', 'Dados pessoais atualizados.');
    } catch (err: any) {
      addToast('error', err.message);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/store/account/password', {
        method: 'POST',
        body: JSON.stringify(passwordForm),
      });
      setPasswordForm({ currentPassword: '', newPassword: '' });
      addToast('success', 'Senha alterada com sucesso.');
    } catch (err: any) {
      addToast('error', err.message);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/store/addresses', {
        method: 'POST',
        body: JSON.stringify({ ...newAddressForm, isDefault: addressesList.length === 0 }),
      });
      setNewAddressForm({
        label: 'Casa',
        cep: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: 'SP',
      });
      loadAddresses();
      addToast('success', 'Endereço salvo.');
    } catch (err: any) {
      addToast('error', err.message);
    }
  };

  const totalCartCount = cartItems.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Slim Dismissible Promo Banner */}
      {showPromoBanner && (
        <div className="bg-indigo-600 text-white text-xs py-2 px-4 flex items-center justify-center gap-3">
          <span>
            Frete grátis acima de R$ 1.000,00 · Cupom de laboratório:{' '}
            <strong className="font-mono">AURORA10</strong> (10% off)
          </span>
          <button
            type="button"
            onClick={() => setShowPromoBanner(false)}
            aria-label="Fechar aviso"
            className="p-0.5 hover:bg-white/20 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Store Sub-Navigation Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <nav className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'vitrine', label: 'Vitrine', icon: <Package className="w-4 h-4" /> },
              ...(user
                ? [
                    { id: 'pedidos', label: 'Meus Pedidos', icon: <FileText className="w-4 h-4" /> },
                    {
                      id: 'favoritos',
                      label: `Favoritos (${favoritesList.length})`,
                      icon: <Heart className="w-4 h-4" />,
                    },
                    { id: 'conta', label: 'Minha Conta', icon: <UserIcon className="w-4 h-4" /> },
                  ]
                : []),
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as StoreTab)}
                data-testid={`store-tab-${item.id}`}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  tab === item.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setCartOpen(true)}
            data-testid="cart-drawer-button"
            className="min-h-[42px] px-4 py-2 rounded-lg bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Carrinho</span>
            <span
              data-testid="cart-badge-count"
              className="px-1.5 py-0.5 rounded bg-teal-500 text-slate-950 font-mono text-xs font-bold tabular-nums"
            >
              {totalCartCount}
            </span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* TAB 1: VITRINE */}
        {tab === 'vitrine' && (
          <>
            {/* Editorial Storefront Hero */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="lg:col-span-6 p-6 sm:p-10 flex flex-col justify-center space-y-5">
                <p className="text-xs font-semibold text-indigo-600 dark:text-teal-400">
                  Coleção 2026 · Estúdio & Escritório
                </p>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight text-balance">
                  Design funcional para foco, áudio e produtividade.
                </h1>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-lg">
                  Explore o catálogo completo do Nova Aurora Store Test Lab para testar busca, filtros, cupons e fluxo completo de checkout.
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <a
                    href="#catalogo-produtos"
                    className="min-h-[46px] px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                  >
                    <span>Explorar Catálogo</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
              <div className="lg:col-span-6 min-h-[240px] lg:min-h-[340px]">
                <ProductImage
                  src="/src/assets/images/hero_nova_aurora_1794559983148.jpg"
                  alt="Estação de trabalho Nova Aurora"
                  className="w-full h-full object-cover"
                />
              </div>
            </section>

            {/* Filter & Search Bar */}
            <section id="catalogo-produtos" className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="lg:col-span-2 relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQ}
                      onChange={(e) => {
                        setSearchQ(e.target.value);
                        setPage(1);
                      }}
                      data-testid="store-search-input"
                      placeholder="Buscar produtos na loja..."
                      className="w-full min-h-[42px] pl-10 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                    />
                  </div>

                  <select
                    value={catFilter}
                    onChange={(e) => {
                      setCatFilter(e.target.value);
                      setPage(1);
                    }}
                    data-testid="store-category-filter"
                    className="min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  >
                    <option value="">Todas categorias</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value);
                      setPage(1);
                    }}
                    data-testid="store-sort-select"
                    className="min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  >
                    <option value="newest">Mais recentes</option>
                    <option value="price_asc">Menor preço</option>
                    <option value="price_desc">Maior preço</option>
                    <option value="name_asc">Nome (A-Z)</option>
                  </select>

                  <label className="min-h-[42px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inStockOnly}
                      onChange={(e) => {
                        setInStockOnly(e.target.checked);
                        setPage(1);
                      }}
                      data-testid="store-instock-checkbox"
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <span>Somente disponíveis</span>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-medium text-slate-500">Faixa de preço (R$):</span>
                  <input
                    type="number"
                    placeholder="Mín"
                    value={minPrice}
                    onChange={(e) => {
                      setMinPrice(e.target.value);
                      setPage(1);
                    }}
                    data-testid="store-min-price-input"
                    className="w-24 min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                  />
                  <span>até</span>
                  <input
                    type="number"
                    placeholder="Máx"
                    value={maxPrice}
                    onChange={(e) => {
                      setMaxPrice(e.target.value);
                      setPage(1);
                    }}
                    data-testid="store-max-price-input"
                    className="w-24 min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                  />
                </div>
              </div>

              {/* Loading / Error / Empty / Grid */}
              {loadingProducts ? (
                <div
                  data-testid="loading-spinner"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
                >
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="h-80 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse"
                    />
                  ))}
                </div>
              ) : catalogError ? (
                <div className="p-6 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 flex items-center justify-between">
                  <span className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {catalogError}
                  </span>
                  <button
                    type="button"
                    onClick={loadCatalog}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold"
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : products.length === 0 ? (
                <div
                  data-testid="store-empty-state"
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-2"
                >
                  <Package className="w-10 h-10 mx-auto text-slate-400" />
                  <h2 className="text-base font-bold">Nenhum produto encontrado</h2>
                  <p className="text-sm text-slate-500">
                    Tente limpar ou ajustar os filtros de busca.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {products.map((prod) => {
                      const isFav = favoritesList.some((f) => f.id === prod.id);
                      const outOfStock = prod.stock <= 0;
                      const lowStock = prod.stock > 0 && prod.stock <= prod.minStock;
                      return (
                        <article
                          key={prod.id}
                          data-testid={`product-card-${prod.code}`}
                          className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col transition-transform hover:-translate-y-0.5"
                        >
                          <div className="aspect-4/3 bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                            <ProductImage src={prod.imageUrl} alt={prod.name} />
                            <button
                              type="button"
                              onClick={() => handleToggleFavorite(prod.id)}
                              data-testid={`favorite-button-${prod.id}`}
                              aria-label="Favoritar"
                              className="absolute top-2.5 right-2.5 w-9 h-9 rounded-full bg-white/90 dark:bg-slate-900/90 flex items-center justify-center shadow-xs hover:scale-105 transition-transform"
                            >
                              <Heart
                                className={`w-4 h-4 ${
                                  isFav ? 'fill-red-500 text-red-500' : 'text-slate-600 dark:text-slate-300'
                                }`}
                              />
                            </button>
                          </div>

                          <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                <span>{prod.categoryName}</span>
                                <span className="font-mono">{prod.code}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => openProductDetail(prod.id)}
                                data-testid={`product-title-${prod.code}`}
                                className="text-left text-base font-semibold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-teal-400 line-clamp-2"
                              >
                                {prod.name}
                              </button>
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                                  {formatBRL(prod.priceCents)}
                                </span>
                                {outOfStock ? (
                                  <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                                    Sem estoque
                                  </span>
                                ) : lowStock ? (
                                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                                    Poucas unidades
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                              <button
                                type="button"
                                onClick={() => openProductDetail(prod.id)}
                                data-testid={`view-product-${prod.id}`}
                                className="min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                Detalhes
                              </button>
                              <button
                                type="button"
                                disabled={outOfStock}
                                onClick={() => handleAddToCart(prod.id, 1)}
                                data-testid={`add-to-cart-button-${prod.id}`}
                                className="flex-1 min-h-[42px] px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold transition-colors"
                              >
                                {outOfStock ? 'Indisponível' : 'Adicionar'}
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                    <PaginationBar
                      page={pagination.page}
                      totalPages={pagination.totalPages}
                      totalItems={pagination.total}
                      pageSize={pagination.limit}
                      onPageChange={setPage}
                      testIdPrefix="store-pagination"
                    />
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {/* TAB 2: MEUS PEDIDOS */}
        {tab === 'pedidos' && (
          <section data-testid="my-orders-section" className="space-y-4">
            <h1 className="text-2xl font-bold">Meus Pedidos</h1>
            {ordersList.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-sm text-slate-500">
                Você ainda não realizou nenhum pedido.
              </div>
            ) : (
              <div className="space-y-4">
                {ordersList.map((o) => {
                  const canCancel = ['Pendente', 'Pago'].includes(o.status);
                  const canReturn = o.status === 'Entregue' && o.returnStatus === 'Nenhum';
                  return (
                    <div
                      key={o.id}
                      data-testid={`customer-order-${o.orderNumber}`}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className="space-y-0.5">
                          <p className="font-mono font-bold text-sm">{o.orderNumber}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(o.createdAt).toLocaleDateString('pt-BR')} · {o.paymentMethod}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-mono font-bold tabular-nums text-base">
                            {formatBRL(o.totalCents)}
                          </span>
                          <span
                            className={`text-xs font-bold ${
                              o.status === 'Entregue' || o.status === 'Pago'
                                ? 'text-emerald-600'
                                : o.status === 'Cancelado'
                                ? 'text-red-600'
                                : 'text-amber-600'
                            }`}
                          >
                            {o.status}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        {(o.items || []).map((i: any) => (
                          <div key={i.id} className="flex justify-between">
                            <span>
                              {i.quantity}x {i.productName}
                            </span>
                            <span className="font-mono tabular-nums">{formatBRL(i.totalCents)}</span>
                          </div>
                        ))}
                      </div>

                      {o.returnStatus !== 'Nenhum' && (
                        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                          Troca/Devolução: {o.returnStatus} ({o.returnReason})
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2 pt-2">
                        {canCancel && (
                          <button
                            type="button"
                            onClick={() => handleCancelOrder(o.id)}
                            data-testid={`cancel-order-button-${o.id}`}
                            className="min-h-[40px] px-4 py-2 rounded-lg border border-red-300 text-red-600 text-xs font-semibold hover:bg-red-50"
                          >
                            Cancelar Pedido
                          </button>
                        )}
                        {canReturn && (
                          <button
                            type="button"
                            onClick={() => {
                              setReturnReason('');
                              setReturnModalOrder(o);
                            }}
                            data-testid={`return-order-button-${o.id}`}
                            className="min-h-[40px] px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Solicitar Troca / Devolução</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 3: FAVORITOS */}
        {tab === 'favoritos' && (
          <section className="space-y-4">
            <h1 className="text-2xl font-bold">Meus Favoritos</h1>
            {favoritesList.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-sm text-slate-500">
                Sua lista de desejos está vazia.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {favoritesList.map((prod) => (
                  <div
                    key={prod.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col"
                  >
                    <div className="aspect-4/3 bg-slate-100 dark:bg-slate-800">
                      <ProductImage src={prod.imageUrl} alt={prod.name} />
                    </div>
                    <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                      <div>
                        <p className="font-semibold text-sm">{prod.name}</p>
                        <p className="font-mono font-bold text-base mt-1">{formatBRL(prod.priceCents)}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={prod.stock <= 0}
                          onClick={() => handleAddToCart(prod.id, 1)}
                          className="flex-1 min-h-[40px] px-3 rounded-lg bg-indigo-600 text-white text-xs font-semibold disabled:opacity-50"
                        >
                          {prod.stock <= 0 ? 'Indisponível' : 'Comprar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleFavorite(prod.id)}
                          className="min-h-[40px] px-3 rounded-lg border text-xs text-red-600"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 4: MINHA CONTA */}
        {tab === 'conta' && user && (
          <section className="space-y-6">
            <h1 className="text-2xl font-bold">Minha Conta</h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Personal Info */}
              <form
                onSubmit={handleSaveAccount}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
              >
                <h2 className="text-base font-bold">Dados Pessoais</h2>
                <div>
                  <label className="block text-xs font-medium mb-1">Nome completo</label>
                  <input
                    type="text"
                    value={accountForm.name}
                    onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                    data-testid="account-name-input"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">CPF</label>
                    <input
                      type="text"
                      value={accountForm.cpf}
                      onChange={(e) => setAccountForm({ ...accountForm, cpf: maskCPF(e.target.value) })}
                      data-testid="account-cpf-input"
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Telefone</label>
                    <input
                      type="text"
                      value={accountForm.phone}
                      onChange={(e) => setAccountForm({ ...accountForm, phone: maskPhone(e.target.value) })}
                      data-testid="account-phone-input"
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  data-testid="account-save-button"
                  className="min-h-[42px] px-5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold"
                >
                  Salvar Dados Pessoais
                </button>
              </form>

              {/* Password + Delete */}
              <div className="space-y-6">
                <form
                  onSubmit={handleChangePassword}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3"
                >
                  <h2 className="text-base font-bold">Alterar Senha</h2>
                  <input
                    type="password"
                    placeholder="Senha atual"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    data-testid="account-current-password"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                  <input
                    type="password"
                    placeholder="Nova senha (mín. 6 caracteres)"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    data-testid="account-new-password"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                  <button
                    type="submit"
                    data-testid="account-change-password-button"
                    className="min-h-[42px] px-5 py-2 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white text-xs font-semibold"
                  >
                    Atualizar Senha
                  </button>
                </form>

                <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/60 rounded-xl p-5 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-red-600">Excluir minha conta</h3>
                    <p className="text-xs text-slate-500">Desativa permanentemente o acesso desta conta.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteAccountModal(true)}
                    data-testid="delete-account-button"
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold shrink-0"
                  >
                    Excluir Conta
                  </button>
                </div>
              </div>
            </div>

            {/* Addresses */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <h2 className="text-base font-bold">Meus Endereços</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {addressesList.map((a) => (
                  <div
                    key={a.id}
                    className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-bold">{a.label}</p>
                      <p className="text-slate-600 dark:text-slate-400">
                        {a.street}, {a.number} · {a.city}/{a.state} · CEP {a.cep}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/store/addresses/${a.id}`, { method: 'DELETE' });
                        loadAddresses();
                      }}
                      className="text-red-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddAddress} className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 pt-2">
                <input
                  type="text"
                  placeholder="Rótulo (Casa)"
                  value={newAddressForm.label}
                  onChange={(e) => setNewAddressForm({ ...newAddressForm, label: e.target.value })}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                />
                <input
                  type="text"
                  placeholder="CEP *"
                  value={newAddressForm.cep}
                  onChange={(e) => setNewAddressForm({ ...newAddressForm, cep: maskCEP(e.target.value) })}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
                <input
                  type="text"
                  placeholder="Rua *"
                  value={newAddressForm.street}
                  onChange={(e) => setNewAddressForm({ ...newAddressForm, street: e.target.value })}
                  className="col-span-2 min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                />
                <input
                  type="text"
                  placeholder="Nº *"
                  value={newAddressForm.number}
                  onChange={(e) => setNewAddressForm({ ...newAddressForm, number: e.target.value })}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                />
                <input
                  type="text"
                  placeholder="Cidade *"
                  value={newAddressForm.city}
                  onChange={(e) => setNewAddressForm({ ...newAddressForm, city: e.target.value })}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                />
                <button
                  type="submit"
                  className="col-span-2 sm:col-span-6 min-h-[40px] px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold w-fit"
                >
                  Adicionar Endereço
                </button>
              </form>
            </div>
          </section>
        )}
      </main>

      {/* PRODUCT DETAIL MODAL */}
      {detailModal && (
        <div
          data-testid="product-detail-modal"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60"
        >
          <div className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-500">
                {detailModal.product.code} · {detailModal.product.categoryName}
              </span>
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                data-testid="close-detail-modal"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="aspect-4/3 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <ProductImage src={detailModal.product.imageUrl} alt={detailModal.product.name} />
                </div>

                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {detailModal.product.name}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1 text-amber-500 font-bold">
                      <Star className="w-4 h-4 fill-amber-400" />
                      {detailModal.avgRating || 'Sem avaliações'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Estoque:{' '}
                      <strong className={detailModal.product.stock > 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {detailModal.product.stock > 0
                          ? `${detailModal.product.stock} unidade(s)`
                          : 'Indisponível'}
                      </strong>
                    </span>
                  </div>
                  <p className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                    {formatBRL(detailModal.product.priceCents)}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {detailModal.product.description}
                  </p>

                  {detailModal.product.stock > 0 && (
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-medium">Qtd:</label>
                      <input
                        type="number"
                        min={1}
                        max={detailModal.product.stock}
                        value={detailQty}
                        onChange={(e) => setDetailQty(Math.max(1, Number(e.target.value)))}
                        data-testid="detail-qty-input"
                        className="w-20 min-h-[42px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-sm"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={detailModal.product.stock <= 0}
                    onClick={() => {
                      handleAddToCart(detailModal.product.id, detailQty);
                      setDetailModal(null);
                    }}
                    data-testid="add-to-cart-button"
                    className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-sm transition-colors"
                  >
                    {detailModal.product.stock <= 0 ? 'Indisponível' : 'Adicionar ao carrinho'}
                  </button>
                </div>
              </div>

              {/* Reviews */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-4">
                <h3 className="text-sm font-bold">Avaliações de Clientes</h3>
                {detailModal.reviews.length === 0 ? (
                  <p className="text-xs text-slate-500">Nenhuma avaliação registrada ainda.</p>
                ) : (
                  <div className="space-y-3">
                    {detailModal.reviews.map((r) => (
                      <div key={r.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                        <div className="flex justify-between font-semibold">
                          <span>{r.userName}</span>
                          <span className="text-amber-500">{'★'.repeat(r.rating)}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">{r.comment}</p>
                      </div>
                    ))}
                  </div>
                )}

                {user && (
                  <form onSubmit={handleSubmitReview} className="space-y-2.5 pt-2">
                    <p className="text-xs font-semibold">Avaliar este produto (requer compra prévia)</p>
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={reviewRating}
                        onChange={(e) => setReviewRating(Number(e.target.value))}
                        data-testid="review-rating-select"
                        className="min-h-[40px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>
                            {n} estrela(s)
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Escreva sua opinião..."
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        data-testid="review-comment-input"
                        className="flex-1 min-w-[180px] min-h-[40px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                      />
                      <button
                        type="submit"
                        data-testid="submit-review-button"
                        className="min-h-[40px] px-4 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white text-xs font-semibold"
                      >
                        Enviar
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SLIDE-OVER CART DRAWER */}
      {cartOpen && (
        <div
          data-testid="cart-drawer"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex justify-end"
        >
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setCartOpen(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col z-10 shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-bold text-base flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-600 dark:text-teal-400" />
                <span>Seu Carrinho ({totalCartCount})</span>
              </h2>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                data-testid="close-cart-drawer-button"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {cartItems.length === 0 ? (
                <div className="text-center py-12 space-y-2 text-sm text-slate-500">
                  <ShoppingCart className="w-10 h-10 mx-auto text-slate-300" />
                  <p>Seu carrinho está vazio.</p>
                </div>
              ) : (
                <>
                  {cartItems.map((item) => (
                    <div
                      key={item.productId}
                      className="flex gap-3 pb-4 border-b border-slate-100 dark:border-slate-800"
                    >
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                        <ProductImage src={item.imageUrl} alt={item.name} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{item.name}</p>
                        <p className="text-xs font-mono text-slate-500">
                          {formatBRL(item.priceCents)} / un.
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateCartQty(item.productId, item.quantity - 1)}
                              className="w-7 h-7 rounded border border-slate-300 dark:border-slate-700 inline-flex items-center justify-center"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center font-mono text-xs font-bold">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateCartQty(item.productId, item.quantity + 1)}
                              className="w-7 h-7 rounded border border-slate-300 dark:border-slate-700 inline-flex items-center justify-center"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUpdateCartQty(item.productId, 0)}
                            className="text-red-500 p-1"
                            aria-label="Remover"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Coupon Box */}
                  <div className="pt-2 space-y-2">
                    <label className="block text-xs font-semibold">Cupom de desconto</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        data-testid="coupon-input"
                        placeholder="Ex: AURORA10"
                        className="flex-1 min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono uppercase"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        data-testid="apply-coupon-button"
                        className="min-h-[40px] px-4 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-xs font-semibold"
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {cartItems.length > 0 && (
              <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 space-y-3">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-mono tabular-nums">{formatBRL(cartSubtotal)}</span>
                  </div>
                  {discountCents > 0 && (
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Desconto ({appliedCoupon?.code})</span>
                      <span className="font-mono tabular-nums">-{formatBRL(discountCents)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Frete estimado</span>
                    <span className="font-mono tabular-nums">
                      {shippingCents === 0 ? 'Grátis' : formatBRL(shippingCents)}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-200 dark:border-slate-800">
                    <span>Total</span>
                    <span data-testid="cart-total" className="font-mono tabular-nums">
                      {formatBRL(cartFinalTotal)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setClearCartModal(true)}
                    data-testid="clear-cart-button"
                    className="min-h-[44px] px-3.5 py-2 rounded-lg border border-red-300 text-red-600 text-xs font-semibold"
                  >
                    Limpar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCartOpen(false);
                      setConfirmedOrder(null);
                      setCheckoutStep(1);
                      setCheckoutOpen(true);
                    }}
                    data-testid="checkout-button"
                    className="flex-1 min-h-[44px] px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
                  >
                    Finalizar Compra
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MULTI-STEP CHECKOUT MODAL */}
      {checkoutOpen && (
        <div
          data-testid="checkout-modal"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60"
        >
          <div className="w-full max-w-2xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-bold text-lg">Checkout da Compra</h2>
              <button type="button" onClick={() => setCheckoutOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {confirmedOrder ? (
              <div className="p-8 text-center space-y-4">
                <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-500" />
                <h3 className="text-xl font-bold">Pedido Confirmado!</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Número do pedido:{' '}
                  <strong data-testid="confirmed-order-number" className="font-mono">
                    {confirmedOrder.orderNumber}
                  </strong>
                </p>
                <p className="text-sm font-mono font-bold">
                  Total: {formatBRL(confirmedOrder.totalCents)} · {confirmedOrder.paymentMethod}
                </p>
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCheckoutOpen(false);
                      setTab('pedidos');
                    }}
                    data-testid="go-to-my-orders-button"
                    className="min-h-[44px] px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold"
                  >
                    Ver Meus Pedidos
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Progress Indicator */}
                <div className="px-6 py-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 grid grid-cols-4 gap-2 text-xs">
                  {[
                    { step: 1, label: '1. Endereço' },
                    { step: 2, label: '2. Frete' },
                    { step: 3, label: '3. Pagamento' },
                    { step: 4, label: '4. Revisão' },
                  ].map((s) => (
                    <div
                      key={s.step}
                      className={`text-center py-1.5 rounded-md font-semibold ${
                        checkoutStep === s.step
                          ? 'bg-indigo-600 text-white'
                          : checkoutStep > s.step
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : 'text-slate-400'
                      }`}
                    >
                      {s.label}
                    </div>
                  ))}
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                  {checkoutStep === 1 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold">Endereço de Entrega</h3>
                      {addressesList.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {addressesList.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() =>
                                setShipAddr({
                                  cep: a.cep,
                                  street: a.street,
                                  number: a.number,
                                  complement: a.complement || '',
                                  neighborhood: a.neighborhood || '',
                                  city: a.city,
                                  state: a.state,
                                })
                              }
                              className="px-3 py-1.5 rounded-lg border text-xs font-medium hover:border-indigo-500"
                            >
                              Usar {a.label} ({a.cep})
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">CEP *</label>
                          <input
                            type="text"
                            value={shipAddr.cep}
                            onChange={(e) => setShipAddr({ ...shipAddr, cep: maskCEP(e.target.value) })}
                            data-testid="checkout-cep-input"
                            placeholder="00000-000"
                            className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Rua / Avenida *</label>
                          <input
                            type="text"
                            value={shipAddr.street}
                            onChange={(e) => setShipAddr({ ...shipAddr, street: e.target.value })}
                            data-testid="checkout-street-input"
                            className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Número *</label>
                          <input
                            type="text"
                            value={shipAddr.number}
                            onChange={(e) => setShipAddr({ ...shipAddr, number: e.target.value })}
                            data-testid="checkout-number-input"
                            className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">
                            <label className="block text-xs font-medium mb-1">Cidade *</label>
                            <input
                              type="text"
                              value={shipAddr.city}
                              onChange={(e) => setShipAddr({ ...shipAddr, city: e.target.value })}
                              data-testid="checkout-city-input"
                              className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">UF *</label>
                            <input
                              type="text"
                              maxLength={2}
                              value={shipAddr.state}
                              onChange={(e) =>
                                setShipAddr({ ...shipAddr, state: e.target.value.toUpperCase() })
                              }
                              data-testid="checkout-state-input"
                              className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm uppercase"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {checkoutStep === 2 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold">Escolha o Frete (simulado)</h3>
                      <label className="flex items-center justify-between p-4 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="ship"
                            checked={shipOption === 'padrao'}
                            onChange={() => setShipOption('padrao')}
                          />
                          <div>
                            <p className="text-sm font-bold flex items-center gap-1.5">
                              <Truck className="w-4 h-4 text-indigo-600" />
                              Entrega Padrão (5 a 7 dias úteis)
                            </p>
                            <p className="text-xs text-slate-500">Grátis em compras acima de R$ 1.000,00</p>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-sm">
                          {cartSubtotal >= 100000 ? 'Grátis' : 'R$ 22,00'}
                        </span>
                      </label>

                      <label className="flex items-center justify-between p-4 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="ship"
                            checked={shipOption === 'expresso'}
                            onChange={() => setShipOption('expresso')}
                          />
                          <div>
                            <p className="text-sm font-bold flex items-center gap-1.5">
                              <Truck className="w-4 h-4 text-teal-600" />
                              Entrega Expressa (1 a 2 dias úteis)
                            </p>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-sm">R$ 39,00</span>
                      </label>
                    </div>
                  )}

                  {checkoutStep === 3 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold">Forma de Pagamento (simulada)</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {(['PIX', 'Cartão de Crédito', 'Boleto'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setPayMethod(m)}
                            data-testid={`checkout-pay-${m}`}
                            className={`min-h-[48px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                              payMethod === m
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            {m === 'PIX' ? (
                              <QrCode className="w-4 h-4" />
                            ) : m === 'Boleto' ? (
                              <FileText className="w-4 h-4" />
                            ) : (
                              <CreditCard className="w-4 h-4" />
                            )}
                            <span>{m}</span>
                          </button>
                        ))}
                      </div>

                      {payMethod === 'PIX' && (
                        <div className="p-4 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-xs space-y-1">
                          <p className="font-bold">Aprovação imediata via PIX de laboratório</p>
                          <p className="font-mono text-slate-500">
                            Chave: pix-lab@novaaurora.test
                          </p>
                        </div>
                      )}

                      {payMethod === 'Cartão de Crédito' && (
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <input
                            type="text"
                            placeholder="Número do cartão (fictício)"
                            value={cardData.number}
                            onChange={(e) => setCardData({ ...cardData, number: e.target.value })}
                            className="col-span-2 min-h-[42px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                          />
                          <input
                            type="text"
                            placeholder="Nome impresso"
                            value={cardData.name}
                            onChange={(e) => setCardData({ ...cardData, name: e.target.value })}
                            className="col-span-2 min-h-[42px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                          />
                          <input
                            type="text"
                            placeholder="MM/AA"
                            value={cardData.expiry}
                            onChange={(e) => setCardData({ ...cardData, expiry: e.target.value })}
                            className="min-h-[42px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                          />
                          <input
                            type="text"
                            placeholder="CVV"
                            value={cardData.cvv}
                            onChange={(e) => setCardData({ ...cardData, cvv: e.target.value })}
                            className="min-h-[42px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                          />
                        </div>
                      )}

                      {payMethod === 'Boleto' && (
                        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs">
                          O pedido ficará com status <strong>Pendente</strong> até compensação simulada pelo Administrador.
                        </div>
                      )}
                    </div>
                  )}

                  {checkoutStep === 4 && (
                    <div className="space-y-4 text-sm">
                      <h3 className="font-bold">Revisão do Pedido</h3>
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                        <p>
                          <strong>Entrega:</strong> {shipAddr.street}, {shipAddr.number} — {shipAddr.city}/{shipAddr.state} ({shipAddr.cep})
                        </p>
                        <p>
                          <strong>Pagamento:</strong> {payMethod}
                        </p>
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
                          {cartItems.map((i) => (
                            <div key={i.productId} className="flex justify-between">
                              <span>
                                {i.quantity}x {i.name}
                              </span>
                              <span className="font-mono">{formatBRL(i.priceCents * i.quantity)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between font-bold text-base">
                          <span>Total a pagar</span>
                          <span className="font-mono">{formatBRL(cartFinalTotal)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                  {checkoutStep > 1 ? (
                    <button
                      type="button"
                      onClick={() => setCheckoutStep((s) => (s - 1) as any)}
                      className="min-h-[42px] px-4 py-2 rounded-lg border text-xs font-semibold inline-flex items-center gap-1"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  {checkoutStep < 4 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          checkoutStep === 1 &&
                          (!shipAddr.cep || !shipAddr.street || !shipAddr.number || !shipAddr.city || !shipAddr.state)
                        ) {
                          addToast('error', 'Preencha todos os campos do endereço.');
                          return;
                        }
                        setCheckoutStep((s) => (s + 1) as any);
                      }}
                      data-testid="checkout-next-step-button"
                      className="min-h-[42px] px-5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold inline-flex items-center gap-1"
                    >
                      <span>Continuar</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={placingOrder}
                      onClick={handleConfirmOrder}
                      data-testid="confirm-order-button"
                      className="min-h-[44px] px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold inline-flex items-center gap-2"
                    >
                      {placingOrder && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>{placingOrder ? 'Processando...' : 'Confirmar Pedido'}</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Return/Exchange Modal */}
      {returnModalOrder && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <form
            onSubmit={handleRequestReturn}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
          >
            <h3 className="font-bold">Troca / Devolução — {returnModalOrder.orderNumber}</h3>
            <p className="text-xs text-slate-500">
              Válido em até 7 dias corridos após a entrega.
            </p>
            <textarea
              rows={3}
              placeholder="Descreva o motivo da solicitação..."
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              data-testid="return-reason-input"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReturnModalOrder(null)}
                className="min-h-[40px] px-4 py-2 rounded-lg border text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                data-testid="confirm-return-button"
                className="min-h-[40px] px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold"
              >
                Enviar Solicitação
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        open={clearCartModal}
        title="Limpar carrinho"
        description="Deseja remover todos os itens do seu carrinho?"
        confirmLabel="Limpar carrinho"
        danger
        onConfirm={handleClearCart}
        onCancel={() => setClearCartModal(false)}
      />

      <ConfirmModal
        open={deleteAccountModal}
        title="Confirmar exclusão de conta"
        description="Tem certeza que deseja encerrar sua conta? Você será desconectado imediatamente."
        confirmLabel="Excluir definitivamente"
        danger
        onConfirm={async () => {
          try {
            await apiFetch('/api/store/account', { method: 'DELETE' });
            setDeleteAccountModal(false);
            addToast('info', 'Conta encerrada.');
            logout();
          } catch (err: any) {
            addToast('error', err.message);
          }
        }}
        onCancel={() => setDeleteAccountModal(false)}
      />
    </div>
  );
};
