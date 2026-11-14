import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  Printer,
  Lock,
  Unlock,
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  CreditCard,
  QrCode,
  Banknote,
  X,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ProductImage } from '../components/ProductImage';
import { formatDateTimeBR } from '../utils/date';
import {
  formatBRL,
  isValidCPF,
  maskCPF,
  onlyDigits,
  parseCurrencyToCents,
} from '../utils/validators';

interface PdvCartItem {
  productId: number;
  code: string;
  name: string;
  priceCents: number;
  stock: number;
  quantity: number;
}

interface PaymentPart {
  method: string;
  amountCents: number;
}

export const PdvPage: React.FC = () => {
  const { apiFetch, addToast, config } = useApp();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);
  const paymentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'PDV | Nova Aurora Store';
  }, []);

  const [registerData, setRegisterData] = useState<any>(null);
  const [loadingReg, setLoadingReg] = useState(true);
  const [initialAmountReais, setInitialAmountReais] = useState('200.00');

  // Search & Cart
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<PdvCartItem[]>([]);

  // Customer & Discount
  const [customerCpf, setCustomerCpf] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [supervisorModalOpen, setSupervisorModalOpen] = useState(false);
  const [supervisorPassword, setSupervisorPassword] = useState('');

  // Payments (split supported)
  const [selectedMethod, setSelectedMethod] = useState('Dinheiro');
  const [partAmountReais, setPartAmountReais] = useState('');
  const [paymentParts, setPaymentParts] = useState<PaymentPart[]>([]);
  const [submittingSale, setSubmittingSale] = useState(false);

  // Modals
  const [movementModal, setMovementModal] = useState<{ open: boolean; type: 'sangria' | 'suprimento' }>({
    open: false,
    type: 'suprimento',
  });
  const [movAmountReais, setMovAmountReais] = useState('');
  const [movReason, setMovReason] = useState('');

  const [closeRegModal, setCloseRegModal] = useState(false);
  const [closingAmountReais, setClosingAmountReais] = useState('');
  const [closingNotes, setClosingNotes] = useState('');

  const [historyModal, setHistoryModal] = useState(false);
  const [cancelSaleModal, setCancelSaleModal] = useState<any | null>(null);
  const [cancelSaleReason, setCancelSaleReason] = useState('');
  const [cancelSaleAdminPass, setCancelSaleAdminPass] = useState('');

  const [removeItemModal, setRemoveItemModal] = useState<PdvCartItem | null>(null);
  const [removeItemReason, setRemoveItemReason] = useState('');

  const [receiptData, setReceiptData] = useState<any | null>(null);

  const loadRegister = useCallback(async () => {
    setLoadingReg(true);
    try {
      const data = await apiFetch('/api/pdv/register/current');
      setRegisterData(data);
    } catch (err: any) {
      addToast('error', err.message || 'Erro ao carregar caixa.');
    } finally {
      setLoadingReg(false);
    }
  }, [apiFetch, addToast]);

  const loadProducts = useCallback(
    async (q = '') => {
      try {
        const data = await apiFetch(`/api/pdv/products/search?q=${encodeURIComponent(q)}`);
        setCatalogProducts(data.products || []);
      } catch {
        // ignore
      }
    },
    [apiFetch]
  );

  useEffect(() => {
    loadRegister();
    loadProducts('');
  }, [loadRegister, loadProducts]);

  // Auto focus search input when register is open
  useEffect(() => {
    if (registerData?.register) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [registerData?.register]);

  // Totals calculation
  const subtotalCents = useMemo(
    () => cart.reduce((acc, item) => acc + item.priceCents * item.quantity, 0),
    [cart]
  );
  const discountPctNum = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const discountCents = Math.round((subtotalCents * discountPctNum) / 100);
  const totalCents = Math.max(0, subtotalCents - discountCents);
  const paidCents = useMemo(
    () => paymentParts.reduce((acc, p) => acc + p.amountCents, 0),
    [paymentParts]
  );
  const remainingCents = Math.max(0, totalCents - paidCents);
  const changeCents = Math.max(0, paidCents - totalCents);

  const addProductToCart = (prod: any) => {
    if (!registerData?.register) {
      addToast('error', 'Caixa fechado! Abra o caixa para iniciar vendas.');
      return;
    }
    if (prod.stock <= 0) {
      addToast('error', `Produto "${prod.name}" está sem estoque.`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === prod.id);
      if (existing) {
        if (existing.quantity + 1 > prod.stock) {
          addToast('error', `Estoque máximo atingido para "${prod.name}" (${prod.stock} un.).`);
          return prev;
        }
        return prev.map((i) =>
          i.productId === prod.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          productId: prod.id,
          code: prod.code,
          name: prod.name,
          priceCents: prod.priceCents,
          stock: prod.stock,
          quantity: 1,
        },
      ];
    });
  };

  const handleBarcodeSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    const exact = catalogProducts.find(
      (p) => p.code.toLowerCase() === q
    );
    if (exact) {
      addProductToCart(exact);
      setSearchQuery('');
      loadProducts('');
    } else if (catalogProducts.length === 1) {
      addProductToCart(catalogProducts[0]);
      setSearchQuery('');
      loadProducts('');
    }
  };

  const updateItemQty = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.productId !== productId) return i;
          const next = i.quantity + delta;
          if (next <= 0) return null;
          if (next > i.stock) {
            addToast('error', `Estoque disponível: ${i.stock}`);
            return i;
          }
          return { ...i, quantity: next };
        })
        .filter(Boolean) as PdvCartItem[]
    );
  };

  const handleAddPaymentPart = () => {
    const cents = partAmountReais.trim()
      ? parseCurrencyToCents(partAmountReais)
      : remainingCents;
    if (Number.isNaN(cents) || cents <= 0) {
      addToast('error', 'Informe um valor de pagamento positivo.');
      return;
    }
    setPaymentParts((prev) => [...prev, { method: selectedMethod, amountCents: cents }]);
    setPartAmountReais('');
  };

  const handleFinalizeSale = useCallback(
    async (overrideSupPassword?: string) => {
      if (!registerData?.register) {
        addToast('error', 'Caixa fechado! Abra o caixa antes de vender.');
        return;
      }
      if (cart.length === 0) {
        addToast('error', 'Adicione ao menos um item na venda.');
        return;
      }
      if (onlyDigits(customerCpf).length > 0 && !isValidCPF(customerCpf)) {
        addToast('error', 'CPF informado na nota é inválido.');
        return;
      }

      // If no split payments added yet, auto-apply full amount with selectedMethod
      const finalParts =
        paymentParts.length > 0
          ? paymentParts
          : [{ method: selectedMethod, amountCents: totalCents }];

      const sumPaid = finalParts.reduce((a, b) => a + b.amountCents, 0);
      if (sumPaid < totalCents) {
        addToast('error', `Falta pagar ${formatBRL(totalCents - sumPaid)}.`);
        return;
      }

      if (
        discountPctNum > config.maxCashierDiscountPercent &&
        !(overrideSupPassword || supervisorPassword)
      ) {
        setSupervisorModalOpen(true);
        return;
      }

      setSubmittingSale(true);
      try {
        const res = await apiFetch('/api/pdv/sales', {
          method: 'POST',
          body: JSON.stringify({
            items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity })),
            customerCpf: customerCpf || null,
            customerName: customerName || null,
            discountPercent: discountPctNum,
            supervisorPassword: overrideSupPassword || supervisorPassword || undefined,
            paymentParts: finalParts,
          }),
        });
        addToast('success', `Venda ${res.order.orderNumber} finalizada!`);
        setReceiptData(res);
        setCart([]);
        setCustomerCpf('');
        setCustomerName('');
        setDiscountPercent('0');
        setSupervisorPassword('');
        setSupervisorModalOpen(false);
        setPaymentParts([]);
        setPartAmountReais('');
        await Promise.all([loadRegister(), loadProducts('')]);
      } catch (err: any) {
        if (err.data?.requiresSupervisor) {
          setSupervisorModalOpen(true);
        }
        addToast('error', err.message);
      } finally {
        setSubmittingSale(false);
      }
    },
    [
      addToast,
      apiFetch,
      cart,
      config.maxCashierDiscountPercent,
      customerCpf,
      customerName,
      discountPctNum,
      loadProducts,
      loadRegister,
      paymentParts,
      registerData?.register,
      selectedMethod,
      supervisorPassword,
      totalCents,
    ]
  );

  // Keyboard shortcuts: F2, F4, F8, F10, Esc
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        discountInputRef.current?.focus();
      } else if (e.key === 'F8') {
        e.preventDefault();
        paymentInputRef.current?.focus();
      } else if (e.key === 'F10') {
        e.preventDefault();
        handleFinalizeSale();
      } else if (e.key === 'Escape') {
        setSupervisorModalOpen(false);
        setHistoryModal(false);
        setCloseRegModal(false);
        setReceiptData(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleFinalizeSale]);

  const handleOpenRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseCurrencyToCents(initialAmountReais);
    if (Number.isNaN(cents) || cents < 0) {
      addToast('error', 'Informe um valor inicial válido.');
      return;
    }
    try {
      await apiFetch('/api/pdv/register/open', {
        method: 'POST',
        body: JSON.stringify({ initialAmountCents: cents }),
      });
      addToast('success', 'Caixa aberto com sucesso! Boas vendas.');
      loadRegister();
    } catch (err: any) {
      addToast('error', err.message);
    }
  };

  const handleMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseCurrencyToCents(movAmountReais);
    if (Number.isNaN(cents) || cents <= 0 || !movReason.trim()) {
      addToast('error', 'Informe valor positivo e motivo.');
      return;
    }
    try {
      await apiFetch('/api/pdv/register/movement', {
        method: 'POST',
        body: JSON.stringify({ type: movementModal.type, amountCents: cents, reason: movReason }),
      });
      addToast('success', `${movementModal.type === 'sangria' ? 'Sangria' : 'Suprimento'} registrado.`);
      setMovementModal({ open: false, type: 'suprimento' });
      setMovAmountReais('');
      setMovReason('');
      loadRegister();
    } catch (err: any) {
      addToast('error', err.message);
    }
  };

  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseCurrencyToCents(closingAmountReais || '0');
    try {
      await apiFetch('/api/pdv/register/close', {
        method: 'POST',
        body: JSON.stringify({ closingAmountCents: cents, notes: closingNotes }),
      });
      addToast('success', 'Caixa fechado com sucesso.');
      setCloseRegModal(false);
      setCart([]);
      setPaymentParts([]);
      loadRegister();
    } catch (err: any) {
      addToast('error', err.message);
    }
  };

  const handleCancelFinalizedSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelSaleModal) return;
    try {
      await apiFetch(`/api/pdv/sales/${cancelSaleModal.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({
          reason: cancelSaleReason,
          adminPassword: cancelSaleAdminPass,
        }),
      });
      addToast('success', `Venda ${cancelSaleModal.orderNumber} cancelada e estoque devolvido.`);
      setCancelSaleModal(null);
      setCancelSaleReason('');
      setCancelSaleAdminPass('');
      loadRegister();
      loadProducts('');
    } catch (err: any) {
      addToast('error', err.message);
    }
  };

  const isRegisterOpen = Boolean(registerData?.register);

  return (
    <main className="flex-1 bg-slate-100 dark:bg-slate-950 p-3 sm:p-5 flex flex-col gap-4 max-w-[1600px] w-full mx-auto">
      {/* Top PDV Bar */}
      <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div
            data-testid="pdv-register-status"
            className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${
              isRegisterOpen
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
            }`}
          >
            {isRegisterOpen ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            <span>{isRegisterOpen ? `Caixa #${registerData.register.id} Aberto` : 'Caixa Fechado'}</span>
          </div>
          <span className="hidden md:inline-block text-xs text-slate-500 dark:text-slate-400 font-mono">
            Atalhos: F2 Buscar · F4 Desconto · F8 Pagamento · F10 Finalizar · Esc Fechar
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isRegisterOpen && (
            <>
              <button
                type="button"
                onClick={() => setMovementModal({ open: true, type: 'suprimento' })}
                data-testid="pdv-suprimento-button"
                className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <ArrowUpCircle className="w-4 h-4 text-emerald-600" />
                <span>Suprimento</span>
              </button>
              <button
                type="button"
                onClick={() => setMovementModal({ open: true, type: 'sangria' })}
                data-testid="pdv-sangria-button"
                className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <ArrowDownCircle className="w-4 h-4 text-amber-600" />
                <span>Sangria</span>
              </button>
              <button
                type="button"
                onClick={() => setHistoryModal(true)}
                data-testid="pdv-history-button"
                className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <History className="w-4 h-4 text-indigo-600 dark:text-teal-400" />
                <span>Turno ({registerData?.sales?.length || 0})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setClosingAmountReais(
                    ((registerData?.summary?.expectedCashCents || 0) / 100).toFixed(2)
                  );
                  setCloseRegModal(true);
                }}
                data-testid="pdv-close-register-button"
                className="min-h-[44px] px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Lock className="w-4 h-4" />
                <span>Fechar Caixa</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Closed Register Blocker */}
      {!loadingReg && !isRegisterOpen && (
        <div
          data-testid="pdv-closed-banner"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 max-w-lg mx-auto w-full my-6 space-y-5 text-center"
        >
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Caixa Fechado
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Informe o fundo de troco inicial para abrir o caixa e liberar as vendas no balcão.
            </p>
          </div>
          <form onSubmit={handleOpenRegister} className="space-y-4 text-left">
            <div>
              <label htmlFor="pdv-initial" className="block text-xs font-semibold mb-1">
                Valor inicial em dinheiro (R$) *
              </label>
              <input
                id="pdv-initial"
                type="number"
                step="0.01"
                min="0"
                value={initialAmountReais}
                onChange={(e) => setInitialAmountReais(e.target.value)}
                data-testid="pdv-initial-amount-input"
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-lg font-mono font-bold"
              />
            </div>
            <button
              type="submit"
              data-testid="pdv-open-register-button"
              className="w-full min-h-[50px] px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base"
            >
              Abrir Caixa Agora
            </button>
          </form>
        </div>
      )}

      {/* Main PDV Grid */}
      {isRegisterOpen && (
        <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
          {/* Left: Product Search + Cart Items */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* Search / Barcode */}
            <form
              onSubmit={handleBarcodeSearchSubmit}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3"
            >
              <label htmlFor="pdv-search-input" className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                Buscar produto por código de barras ou nome (F2)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Barcode className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={searchInputRef}
                    id="pdv-search-input"
                    name="pdvSearch"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      loadProducts(e.target.value);
                    }}
                    data-testid="pdv-search-input"
                    placeholder="Bipe o código (ex: AUR-101) ou digite o nome..."
                    className="w-full min-h-[48px] pl-11 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-base font-medium"
                  />
                </div>
                <button
                  type="submit"
                  data-testid="pdv-search-add-button"
                  className="min-h-[48px] px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm inline-flex items-center gap-1.5"
                >
                  <Search className="w-4 h-4" />
                  <span>Buscar</span>
                </button>
              </div>

              {/* Quick results */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pt-1">
                {catalogProducts.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProductToCart(p)}
                    disabled={p.stock <= 0}
                    data-testid={`pdv-quick-product-${p.code}`}
                    className={`min-h-[56px] p-2.5 rounded-lg border text-left flex items-center justify-between gap-2.5 transition-colors ${
                      p.stock <= 0
                        ? 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 opacity-50 cursor-not-allowed'
                        : 'border-slate-200 dark:border-slate-800 hover:border-indigo-500 bg-slate-50 dark:bg-slate-950'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-md overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0">
                        <ProductImage src={p.imageUrl} alt={p.name} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-mono font-bold text-indigo-600 dark:text-teal-400">
                          {p.code} · Est: {p.stock}
                        </p>
                        <p className="text-xs font-semibold truncate text-slate-900 dark:text-white">
                          {p.name}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold tabular-nums shrink-0">
                      {formatBRL(p.priceCents)}
                    </span>
                  </button>
                ))}
              </div>
            </form>

            {/* Active Cart Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-sm font-bold">Itens da Venda ({cart.length})</h2>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    data-testid="pdv-clear-cart-button"
                    className="text-xs font-semibold text-red-600 hover:underline"
                  >
                    Limpar lista
                  </button>
                )}
              </div>

              <div className="overflow-x-auto flex-1">
                <table data-testid="pdv-items-table" className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 text-xs">
                    <tr>
                      <th className="px-4 py-2.5">Produto</th>
                      <th className="px-4 py-2.5 text-center">Qtd</th>
                      <th className="px-4 py-2.5 text-right">Subtotal</th>
                      <th className="px-4 py-2.5 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {cart.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center text-slate-500">
                          Nenhum item bipado ainda. Selecione um produto acima.
                        </td>
                      </tr>
                    ) : (
                      cart.map((item) => (
                        <tr key={item.productId}>
                          <td className="px-4 py-3">
                            <p className="font-mono text-xs text-slate-500">{item.code}</p>
                            <p className="font-semibold text-slate-900 dark:text-white">{item.name}</p>
                            <p className="text-xs font-mono text-slate-500">
                              Unit: {formatBRL(item.priceCents)}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateItemQty(item.productId, -1)}
                                className="min-h-[40px] min-w-[40px] rounded-lg border border-slate-300 dark:border-slate-700 inline-flex items-center justify-center"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="w-8 text-center font-mono font-bold tabular-nums">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateItemQty(item.productId, 1)}
                                className="min-h-[40px] min-w-[40px] rounded-lg border border-slate-300 dark:border-slate-700 inline-flex items-center justify-center"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">
                            {formatBRL(item.priceCents * item.quantity)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setRemoveItemReason('');
                                setRemoveItemModal(item);
                              }}
                              data-testid={`pdv-remove-item-${item.code}`}
                              className="min-h-[40px] min-w-[40px] rounded-lg hover:bg-red-50 text-red-600 inline-flex items-center justify-center"
                              title="Remover item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right: Customer, Discount, Payment, Total */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-2 border border-slate-800">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums">{formatBRL(subtotalCents)}</span>
              </div>
              {discountCents > 0 && (
                <div className="flex justify-between text-xs text-teal-400">
                  <span>Desconto ({discountPctNum}%)</span>
                  <span className="font-mono tabular-nums">- {formatBRL(discountCents)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-800 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-slate-300">TOTAL A PAGAR</span>
                <span
                  data-testid="pdv-total-display"
                  className="text-3xl sm:text-4xl font-extrabold font-mono tabular-nums text-teal-400"
                >
                  {formatBRL(totalCents)}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pdv-cpf-input" className="block text-xs font-semibold mb-1">
                    CPF na nota (opcional)
                  </label>
                  <input
                    id="pdv-cpf-input"
                    type="text"
                    value={customerCpf}
                    onChange={(e) => setCustomerCpf(maskCPF(e.target.value))}
                    data-testid="pdv-cpf-input"
                    placeholder="000.000.000-00"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="pdv-discount-input" className="block text-xs font-semibold mb-1">
                    Desconto % (máx. {config.maxCashierDiscountPercent}% sem sup.)
                  </label>
                  <input
                    ref={discountInputRef}
                    id="pdv-discount-input"
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    data-testid="pdv-discount-input"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono font-bold"
                  />
                </div>
              </div>

              {/* Payment selector */}
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Forma de Pagamento (F8) — permite pagamento dividido
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'Dinheiro', icon: <Banknote className="w-4 h-4" /> },
                    { id: 'Cartão de Crédito', icon: <CreditCard className="w-4 h-4" /> },
                    { id: 'Cartão de Débito', icon: <CreditCard className="w-4 h-4" /> },
                    { id: 'PIX', icon: <QrCode className="w-4 h-4" /> },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMethod(m.id)}
                      data-testid={`pdv-pay-method-${m.id}`}
                      className={`min-h-[48px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                        selectedMethod === m.id
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {m.icon}
                      <span>{m.id}</span>
                    </button>
                  ))}
                </div>

                {selectedMethod === 'PIX' && totalCents > 0 && (
                  <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 flex items-center gap-3 text-xs">
                    <div className="w-14 h-14 bg-white p-1.5 rounded-lg border border-slate-200 flex items-center justify-center shrink-0">
                      <QrCode className="w-10 h-10 text-slate-900" />
                    </div>
                    <div>
                      <p className="font-bold text-teal-800 dark:text-teal-300">
                        QR Code PIX Simulado
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 font-mono text-[11px] break-all">
                        00020126360014BR.GOV.BCB.PIX0114NOVAAURORALAB52040000
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    ref={paymentInputRef}
                    type="number"
                    step="0.01"
                    value={partAmountReais}
                    onChange={(e) => setPartAmountReais(e.target.value)}
                    data-testid="pdv-payment-amount-input"
                    placeholder={`Valor em R$ (restante: ${(remainingCents / 100).toFixed(2)})`}
                    className="flex-1 min-h-[46px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddPaymentPart}
                    data-testid="pdv-add-payment-part-button"
                    className="min-h-[46px] px-4 rounded-xl border border-indigo-600 text-indigo-600 dark:text-teal-400 dark:border-teal-400 text-xs font-bold"
                  >
                    + Adicionar Parcela
                  </button>
                </div>

                {paymentParts.length > 0 && (
                  <div className="space-y-1.5 text-xs bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    {paymentParts.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span>{p.method}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold">{formatBRL(p.amountCents)}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setPaymentParts((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="text-red-500"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 flex justify-between font-bold">
                      <span>{changeCents > 0 ? 'Troco' : 'Restante'}</span>
                      <span className="font-mono tabular-nums text-emerald-600">
                        {formatBRL(changeCents > 0 ? changeCents : remainingCents)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleFinalizeSale()}
                disabled={submittingSale || cart.length === 0}
                data-testid="pdv-finish-sale-button"
                className="w-full min-h-[54px] px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-extrabold text-base inline-flex items-center justify-center gap-2 transition-colors"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{submittingSale ? 'Finalizando...' : 'Finalizar Venda (F10)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Item Modal (with justification) */}
      {removeItemModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h3 className="font-bold">Remover item — {removeItemModal.name}</h3>
            <div>
              <label className="block text-xs font-medium mb-1">Justificativa de cancelamento *</label>
              <input
                type="text"
                value={removeItemReason}
                onChange={(e) => setRemoveItemReason(e.target.value)}
                data-testid="pdv-remove-item-reason-input"
                placeholder="Ex.: Cliente desistiu do item"
                className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRemoveItemModal(null)}
                className="min-h-[40px] px-4 py-2 rounded-lg border text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!removeItemReason.trim()) {
                    addToast('error', 'Informe uma justificativa.');
                    return;
                  }
                  setCart((prev) => prev.filter((i) => i.productId !== removeItemModal.productId));
                  addToast('info', `Item removido (${removeItemReason}).`);
                  setRemoveItemModal(null);
                }}
                data-testid="pdv-confirm-remove-item-button"
                className="min-h-[40px] px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supervisor Auth Modal for Discount > Max */}
      {supervisorModalOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="font-bold text-slate-900 dark:text-white">
                Autorização de Supervisor
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Desconto de {discountPctNum}% excede o limite de {config.maxCashierDiscountPercent}%. Informe a senha do Administrador para liberar.
            </p>
            <input
              type="password"
              value={supervisorPassword}
              onChange={(e) => setSupervisorPassword(e.target.value)}
              data-testid="pdv-supervisor-password-input"
              placeholder="Senha do Administrador"
              className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSupervisorModalOpen(false)}
                className="min-h-[40px] px-4 py-2 rounded-lg border text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleFinalizeSale(supervisorPassword)}
                data-testid="pdv-supervisor-confirm-button"
                className="min-h-[40px] px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold"
              >
                Autorizar e Finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sangria / Suprimento Modal */}
      {movementModal.open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <form
            onSubmit={handleMovement}
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
          >
            <h3 className="font-bold capitalize">
              Registrar {movementModal.type}
            </h3>
            <div>
              <label className="block text-xs font-medium mb-1">Valor (R$) *</label>
              <input
                type="number"
                step="0.01"
                value={movAmountReais}
                onChange={(e) => setMovAmountReais(e.target.value)}
                data-testid="pdv-movement-amount-input"
                className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Motivo *</label>
              <input
                type="text"
                value={movReason}
                onChange={(e) => setMovReason(e.target.value)}
                data-testid="pdv-movement-reason-input"
                className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMovementModal({ open: false, type: 'suprimento' })}
                className="min-h-[40px] px-4 py-2 rounded-lg border text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                data-testid="pdv-movement-confirm-button"
                className="min-h-[40px] px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold"
              >
                Confirmar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Close Register Modal */}
      {closeRegModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <form
            onSubmit={handleCloseRegister}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
          >
            <h3 className="font-bold text-lg">Fechamento de Caixa</h3>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span>Vendas no turno:</span>
                <span className="font-mono font-bold">
                  {registerData?.summary?.totalSalesCount || 0} ({formatBRL(registerData?.summary?.totalSalesCents || 0)})
                </span>
              </div>
              {Object.entries(registerData?.summary?.byPayment || {}).map(([method, val]) => (
                <div key={method} className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>{method}:</span>
                  <span className="font-mono">{formatBRL(Number(val))}</span>
                </div>
              ))}
              <div className="flex justify-between pt-1.5 border-t border-slate-200 dark:border-slate-800 font-bold">
                <span>Dinheiro esperado em gaveta:</span>
                <span className="font-mono text-emerald-600">
                  {formatBRL(registerData?.summary?.expectedCashCents || 0)}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Valor contado em caixa (R$)</label>
              <input
                type="number"
                step="0.01"
                value={closingAmountReais}
                onChange={(e) => setClosingAmountReais(e.target.value)}
                data-testid="pdv-closing-amount-input"
                className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Observações</label>
              <input
                type="text"
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCloseRegModal(false)}
                className="min-h-[42px] px-4 py-2 rounded-lg border text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                data-testid="pdv-confirm-close-register-button"
                className="min-h-[42px] px-4 py-2 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white text-sm font-semibold"
              >
                Encerrar Caixa
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Turn Sales History Modal */}
      {historyModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Vendas do Turno Atual</h3>
              <button type="button" onClick={() => setHistoryModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="px-3 py-2">Nº Venda</th>
                    <th className="px-3 py-2">Data/Hora</th>
                    <th className="px-3 py-2">Pagamento</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {(registerData?.sales || []).map((s: any) => (
                    <tr key={s.id}>
                      <td className="px-3 py-2.5 font-mono font-bold">{s.orderNumber}</td>
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap">{formatDateTimeBR(s.createdAt)}</td>
                      <td className="px-3 py-2.5">{s.paymentMethod}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold">
                        {formatBRL(s.totalCents)}
                      </td>
                      <td className="px-3 py-2.5">{s.status}</td>
                      <td className="px-3 py-2.5 text-right">
                        {s.status !== 'Cancelado' && (
                          <button
                            type="button"
                            onClick={() => {
                              setCancelSaleReason('');
                              setCancelSaleAdminPass('');
                              setCancelSaleModal(s);
                            }}
                            data-testid={`pdv-cancel-sale-${s.id}`}
                            className="px-2.5 py-1 rounded bg-red-600 text-white font-semibold"
                          >
                            Cancelar Venda
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Finalized Sale Admin Auth Modal */}
      {cancelSaleModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70">
          <form
            onSubmit={handleCancelFinalizedSale}
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
          >
            <h3 className="font-bold">Cancelar Venda {cancelSaleModal.orderNumber}</h3>
            <p className="text-xs text-slate-500">
              Cancelar venda finalizada exige justificativa e autorização do Administrador.
            </p>
            <input
              type="text"
              value={cancelSaleReason}
              onChange={(e) => setCancelSaleReason(e.target.value)}
              data-testid="pdv-cancel-sale-reason"
              placeholder="Justificativa *"
              className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
            <input
              type="password"
              value={cancelSaleAdminPass}
              onChange={(e) => setCancelSaleAdminPass(e.target.value)}
              data-testid="pdv-cancel-sale-admin-password"
              placeholder="Senha do Administrador *"
              className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelSaleModal(null)}
                className="min-h-[40px] px-4 py-2 rounded-lg border text-sm"
              >
                Voltar
              </button>
              <button
                type="submit"
                data-testid="pdv-confirm-cancel-sale-button"
                className="min-h-[40px] px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptData && (
        <div
          data-testid="pdv-receipt-modal"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60"
        >
          <div className="w-full max-w-sm bg-white text-slate-900 rounded-xl border border-slate-300 shadow-2xl p-6 space-y-4 font-mono text-xs">
            <div className="text-center border-b border-dashed border-slate-300 pb-3 space-y-1">
              <p className="font-bold text-sm">NOVA AURORA STORE</p>
              <p>COMPROVANTE NÃO FISCAL DE LABORATÓRIO</p>
              <p>Pedido: {receiptData.order.orderNumber}</p>
              <p>Data/Hora: {formatDateTimeBR(receiptData.order.createdAt)}</p>
              {receiptData.order.customerCpf && <p>CPF: {receiptData.order.customerCpf}</p>}
            </div>

            <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
              {(receiptData.items || []).map((i: any, idx: number) => (
                <div key={idx} className="flex justify-between gap-2">
                  <span className="truncate">
                    {i.quantity}x {i.name}
                  </span>
                  <span className="shrink-0">{formatBRL(i.totalCents)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatBRL(receiptData.order.subtotalCents)}</span>
              </div>
              {receiptData.order.discountCents > 0 && (
                <div className="flex justify-between">
                  <span>Desconto:</span>
                  <span>-{formatBRL(receiptData.order.discountCents)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm pt-1">
                <span>TOTAL:</span>
                <span>{formatBRL(receiptData.order.totalCents)}</span>
              </div>
              <div className="flex justify-between">
                <span>Pagamento:</span>
                <span>{receiptData.order.paymentMethod}</span>
              </div>
              {receiptData.changeCents > 0 && (
                <div className="flex justify-between font-bold">
                  <span>Troco:</span>
                  <span>{formatBRL(receiptData.changeCents)}</span>
                </div>
              )}
            </div>

            <div className="no-print flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                data-testid="pdv-print-receipt-button"
                className="flex-1 min-h-[44px] px-3 py-2 rounded-lg bg-indigo-600 text-white font-sans font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir</span>
              </button>
              <button
                type="button"
                onClick={() => setReceiptData(null)}
                data-testid="pdv-close-receipt-button"
                className="min-h-[44px] px-4 py-2 rounded-lg border border-slate-300 font-sans font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
