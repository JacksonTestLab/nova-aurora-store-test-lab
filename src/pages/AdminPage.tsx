import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Package,
  Tags,
  ShoppingBag,
  Wallet,
  Paperclip,
  FlaskConical,
  Menu,
  X,
  Plus,
  Search,
  Edit2,
  Trash2,
  KeyRound,
  RefreshCw,
  Download,
  CheckCircle2,
  ArrowUpDown,
  Loader2,
  AlertCircle,
  Eye,
  Upload,
  HardDriveUpload,
  ShieldAlert,
  FileJson,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ConfirmModal } from '../components/ConfirmModal';
import { PaginationBar } from '../components/PaginationBar';
import { ProductImage } from '../components/ProductImage';
import {
  formatBackupFilename,
  formatDateBR,
  formatDateTimeBR,
  getLocalDateYMD,
} from '../utils/date';
import {
  formatBRL,
  isValidCPF,
  isValidEmail,
  maskCEP,
  maskCPF,
  maskPhone,
  parseCurrencyToCents,
} from '../utils/validators';

type AdminTab =
  | 'dashboard'
  | 'usuarios'
  | 'clientes'
  | 'produtos'
  | 'categorias-cupons'
  | 'pedidos'
  | 'financeiro'
  | 'anexos'
  | 'laboratorio';

const ADMIN_TAB_TITLES: Record<AdminTab, string> = {
  dashboard: 'Dashboard | Nova Aurora Store',
  usuarios: 'Usuários | Nova Aurora Store',
  clientes: 'Clientes | Nova Aurora Store',
  produtos: 'Produtos | Nova Aurora Store',
  'categorias-cupons': 'Categorias & Cupons | Nova Aurora Store',
  pedidos: 'Pedidos | Nova Aurora Store',
  financeiro: 'Financeiro | Nova Aurora Store',
  anexos: 'Anexos | Nova Aurora Store',
  laboratorio: 'Laboratório QA | Nova Aurora Store',
};

export const AdminPage: React.FC = () => {
  const { user, apiFetch, addToast, config, refreshConfig, refreshUser } = useApp();
  const isSuperAdmin = user?.role === 'superadmin';
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab') as AdminTab | null;
    return t || 'dashboard';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Dashboard
  const [dashboard, setDashboard] = useState<any>(null);
  const [dashStart, setDashStart] = useState('');
  const [dashEnd, setDashEnd] = useState('');

  // Lists
  const [usersList, setUsersList] = useState<any[]>([]);
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [couponsList, setCouponsList] = useState<any[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [financialList, setFinancialList] = useState<any[]>([]);
  const [attachmentsList, setAttachmentsList] = useState<any[]>([]);
  const [auditLogsList, setAuditLogsList] = useState<any[]>([]);
  const [backupsList, setBackupsList] = useState<any[]>([]);

  // Lab settings & Backup/Restore state
  const [delayMs, setDelayMs] = useState(String(config.simulatedDelayMs || 0));
  const [maxDiscount, setMaxDiscount] = useState(String(config.maxCashierDiscountPercent || 15));
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [labSuccessMessage, setLabSuccessMessage] = useState('');
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState('');
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restorePendingPayload, setRestorePendingPayload] = useState<any | null>(null);
  const [restoreMetadata, setRestoreMetadata] = useState<any | null>(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  // Filters & Pagination
  const [custSearch, setCustSearch] = useState('');
  const [custStatus, setCustStatus] = useState('');
  const [custPage, setCustPage] = useState(1);
  const [custPageSize, setCustPageSize] = useState(10);

  const [prodSearch, setProdSearch] = useState('');
  const [prodCat, setProdCat] = useState('');
  const [prodSort, setProdSort] = useState('newest');
  const [prodPage, setProdPage] = useState(1);
  const [prodPageSize, setProdPageSize] = useState(10);

  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [orderChannelFilter, setOrderChannelFilter] = useState('');
  const [orderStart, setOrderStart] = useState('');
  const [orderEnd, setOrderEnd] = useState('');

  const [finType, setFinType] = useState('');
  const [finStatus, setFinStatus] = useState('');
  const [finSearch, setFinSearch] = useState('');
  const [finStart, setFinStart] = useState('');
  const [finEnd, setFinEnd] = useState('');

  // Modals state
  const [userModal, setUserModal] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'caixa', password: '', status: 'ativo' });
  const [resetPassModal, setResetPassModal] = useState<{ open: boolean; user: any | null; newPass: string }>({
    open: false,
    user: null,
    newPass: '',
  });

  const [custModal, setCustModal] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [custForm, setCustForm] = useState({
    name: '',
    email: '',
    cpf: '',
    birthDate: '',
    phone: '',
    cep: '',
    address: '',
    number: '',
    city: '',
    state: 'SP',
    status: 'ativo',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [prodModal, setProdModal] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [prodForm, setProdForm] = useState({
    code: '',
    name: '',
    description: '',
    categoryId: '',
    supplier: '',
    priceReais: '',
    stock: '0',
    minStock: '5',
    imageUrl: '',
    status: 'ativo',
  });
  const [prodImageUploading, setProdImageUploading] = useState(false);
  const [prodImageError, setProdImageError] = useState('');
  const [prodImageDragging, setProdImageDragging] = useState(false);
  const prodImageInputRef = useRef<HTMLInputElement>(null);

  const [catModal, setCatModal] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [catForm, setCatForm] = useState({ name: '', description: '', status: 'ativo' });

  const [couponModal, setCouponModal] = useState(false);
  const [couponForm, setCouponForm] = useState({
    code: '',
    type: 'percentual',
    value: '10',
    expiresAt: getLocalDateYMD(new Date(Date.now() + 30 * 86400000)),
    usageLimit: '100',
  });

  const [orderStatusModal, setOrderStatusModal] = useState<{ open: boolean; order: any | null }>({
    open: false,
    order: null,
  });
  const [targetOrderStatus, setTargetOrderStatus] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [adminAuthPassword, setAdminAuthPassword] = useState('');
  const [orderDetailModal, setOrderDetailModal] = useState<any | null>(null);

  const [finModal, setFinModal] = useState(false);
  const [finForm, setFinForm] = useState({
    type: 'pagar',
    description: '',
    amountReais: '',
    dueDate: getLocalDateYMD(new Date()),
  });

  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: number; label: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Attachment upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');

  const fetchTabData = useCallback(
    async (tab: AdminTab) => {
      setLoading(true);
      setLoadError('');
      try {
        if (tab === 'dashboard') {
          const qs = new URLSearchParams();
          if (dashStart) qs.set('startDate', dashStart);
          if (dashEnd) qs.set('endDate', dashEnd);
          const data = await apiFetch(`/api/admin/dashboard?${qs.toString()}`);
          setDashboard(data);
        } else if (tab === 'usuarios') {
          const data = await apiFetch('/api/admin/users');
          setUsersList(data.users);
        } else if (tab === 'clientes') {
          const qs = new URLSearchParams();
          if (custSearch) qs.set('q', custSearch);
          if (custStatus) qs.set('status', custStatus);
          const data = await apiFetch(`/api/admin/customers?${qs.toString()}`);
          setCustomersList(data.customers);
        } else if (tab === 'produtos') {
          const qs = new URLSearchParams();
          if (prodSearch) qs.set('q', prodSearch);
          if (prodCat) qs.set('categoryId', prodCat);
          if (prodSort) qs.set('sort', prodSort);
          const [pData, cData] = await Promise.all([
            apiFetch(`/api/admin/products?${qs.toString()}`),
            apiFetch('/api/admin/categories'),
          ]);
          setProductsList(pData.products);
          setCategoriesList(cData.categories);
        } else if (tab === 'categorias-cupons') {
          const [cData, cpData] = await Promise.all([
            apiFetch('/api/admin/categories'),
            apiFetch('/api/admin/coupons'),
          ]);
          setCategoriesList(cData.categories);
          setCouponsList(cpData.coupons);
        } else if (tab === 'pedidos') {
          const qs = new URLSearchParams();
          if (orderStatusFilter) qs.set('status', orderStatusFilter);
          if (orderChannelFilter) qs.set('channel', orderChannelFilter);
          if (orderStart) qs.set('startDate', orderStart);
          if (orderEnd) qs.set('endDate', orderEnd);
          const data = await apiFetch(`/api/admin/orders?${qs.toString()}`);
          setOrdersList(data.orders);
        } else if (tab === 'financeiro') {
          const qs = new URLSearchParams();
          if (finType) qs.set('type', finType);
          if (finStatus) qs.set('status', finStatus);
          if (finSearch) qs.set('q', finSearch);
          if (finStart) qs.set('startDate', finStart);
          if (finEnd) qs.set('endDate', finEnd);
          const data = await apiFetch(`/api/admin/financial?${qs.toString()}`);
          setFinancialList(data.entries);
        } else if (tab === 'anexos') {
          const data = await apiFetch('/api/admin/attachments');
          setAttachmentsList(data.attachments);
        } else if (tab === 'laboratorio') {
          const [logsData, backupsData] = await Promise.all([
            apiFetch('/api/admin/audit-logs'),
            apiFetch('/api/admin/backups'),
            refreshConfig(),
          ]);
          setAuditLogsList(logsData.logs);
          setBackupsList(backupsData.backups || []);
        }
      } catch (err: any) {
        setLoadError(err.message || 'Falha ao carregar dados.');
      } finally {
        setLoading(false);
      }
    },
    [
      apiFetch,
      custSearch,
      custStatus,
      dashEnd,
      dashStart,
      finEnd,
      finSearch,
      finStart,
      finStatus,
      finType,
      orderChannelFilter,
      orderEnd,
      orderStart,
      orderStatusFilter,
      prodCat,
      prodSearch,
      prodSort,
      refreshConfig,
    ]
  );

  useEffect(() => {
    document.title = ADMIN_TAB_TITLES[activeTab] || 'Dashboard | Nova Aurora Store';
    fetchTabData(activeTab);
  }, [activeTab, fetchTabData]);

  useEffect(() => {
    setDelayMs(String(config.simulatedDelayMs || 0));
    setMaxDiscount(String(config.maxCashierDiscountPercent || 15));
  }, [config]);

  const navItems: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'usuarios', label: 'Usuários', icon: <UserCheck className="w-4 h-4" /> },
    { id: 'clientes', label: 'Clientes', icon: <Users className="w-4 h-4" /> },
    { id: 'produtos', label: 'Produtos', icon: <Package className="w-4 h-4" /> },
    { id: 'categorias-cupons', label: 'Categorias & Cupons', icon: <Tags className="w-4 h-4" /> },
    { id: 'pedidos', label: 'Pedidos', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'financeiro', label: 'Financeiro', icon: <Wallet className="w-4 h-4" /> },
    { id: 'anexos', label: 'Anexos', icon: <Paperclip className="w-4 h-4" /> },
    { id: 'laboratorio', label: 'Laboratório QA', icon: <FlaskConical className="w-4 h-4" /> },
  ];

  // Pagination slices
  const pagedCustomers = useMemo(() => {
    const start = (custPage - 1) * custPageSize;
    return customersList.slice(start, start + custPageSize);
  }, [customersList, custPage, custPageSize]);

  const pagedProducts = useMemo(() => {
    const start = (prodPage - 1) * prodPageSize;
    return productsList.slice(start, start + prodPageSize);
  }, [productsList, prodPage, prodPageSize]);

  // --- HANDLERS ---
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!userForm.name.trim()) errs.name = 'Nome obrigatório.';
    if (!userModal.editing && !isValidEmail(userForm.email)) errs.email = 'E-mail inválido.';
    if (!userModal.editing && userForm.password.length < 6) errs.password = 'Mínimo 6 caracteres.';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      if (userModal.editing) {
        await apiFetch(`/api/admin/users/${userModal.editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: userForm.name,
            role: userForm.role,
            status: userForm.status,
          }),
        });
        addToast('success', 'Usuário atualizado com sucesso.');
      } else {
        await apiFetch('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify(userForm),
        });
        addToast('success', 'Usuário criado com sucesso.');
      }
      setUserModal({ open: false, editing: null });
      fetchTabData('usuarios');
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassModal.user || resetPassModal.newPass.length < 6) {
      addToast('error', 'Informe uma senha com pelo menos 6 caracteres.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/admin/users/${resetPassModal.user.id}/reset-password`, {
        method: 'PATCH',
        body: JSON.stringify({ newPassword: resetPassModal.newPass }),
      });
      addToast('success', 'Senha redefinida com sucesso.');
      setResetPassModal({ open: false, user: null, newPass: '' });
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!custForm.name.trim()) errs.name = 'Nome é obrigatório.';
    if (!isValidEmail(custForm.email)) errs.email = 'E-mail inválido.';
    if (!isValidCPF(custForm.cpf)) errs.cpf = 'CPF inválido.';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      if (custModal.editing) {
        await apiFetch(`/api/admin/customers/${custModal.editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(custForm),
        });
        addToast('success', 'Cliente atualizado com sucesso.');
      } else {
        await apiFetch('/api/admin/customers', {
          method: 'POST',
          body: JSON.stringify(custForm),
        });
        addToast('success', 'Cliente cadastrado com sucesso.');
      }
      setCustModal({ open: false, editing: null });
      fetchTabData('clientes');
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleProductImageFile = async (file: File | null) => {
    setProdImageError('');
    if (!file) return;

    const allowedMimes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const allowedExt = /\.(jpe?g|png|webp)$/i;
    if (!allowedMimes.has(file.type) && !allowedExt.test(file.name)) {
      setProdImageError('Formato inválido. Envie apenas imagens JPG, PNG ou WEBP.');
      return;
    }
    if (file.type && !allowedMimes.has(file.type)) {
      setProdImageError('Formato inválido. Envie apenas imagens JPG, PNG ou WEBP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProdImageError('A imagem excede o tamanho máximo permitido de 2 MB.');
      return;
    }

    setProdImageUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await apiFetch<{ imageUrl: string }>('/api/admin/products/upload-image', {
        method: 'POST',
        body: formData,
      });
      setProdForm((prev) => ({ ...prev, imageUrl: data.imageUrl }));
      addToast('success', 'Foto do produto enviada com sucesso.');
    } catch (err: any) {
      const msg = err.message || 'Erro ao enviar foto do produto.';
      setProdImageError(msg);
      addToast('error', msg);
    } finally {
      setProdImageUploading(false);
      if (prodImageInputRef.current) {
        prodImageInputRef.current.value = '';
      }
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const priceCents = parseCurrencyToCents(prodForm.priceReais);
    const stock = Number(prodForm.stock);

    if (!prodForm.code.trim()) errs.code = 'Código obrigatório.';
    if (!prodForm.name.trim()) errs.name = 'Nome obrigatório.';
    if (!prodForm.description.trim()) errs.description = 'Descrição obrigatória.';
    if (!prodForm.supplier.trim()) errs.supplier = 'Fornecedor obrigatório.';
    if (Number.isNaN(priceCents) || priceCents <= 0) errs.priceReais = 'Preço deve ser maior que zero.';
    if (Number.isNaN(stock) || stock < 0) errs.stock = 'Estoque não pode ser negativo.';

    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const payload = {
        code: prodForm.code,
        name: prodForm.name,
        description: prodForm.description,
        categoryId: prodForm.categoryId ? Number(prodForm.categoryId) : null,
        supplier: prodForm.supplier,
        priceCents,
        stock,
        minStock: Number(prodForm.minStock || 5),
        imageUrl: prodForm.imageUrl ? prodForm.imageUrl : null,
        status: prodForm.status,
      };
      if (prodModal.editing) {
        await apiFetch(`/api/admin/products/${prodModal.editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        addToast('success', 'Produto atualizado com sucesso.');
      } else {
        await apiFetch('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        addToast('success', 'Produto cadastrado com sucesso.');
      }
      setProdModal({ open: false, editing: null });
      fetchTabData('produtos');
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catForm.name.trim()) {
      addToast('error', 'Informe o nome da categoria.');
      return;
    }
    setSaving(true);
    try {
      if (catModal.editing) {
        await apiFetch(`/api/admin/categories/${catModal.editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(catForm),
        });
        addToast('success', 'Categoria atualizada.');
      } else {
        await apiFetch('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify(catForm),
        });
        addToast('success', 'Categoria criada.');
      }
      setCatModal({ open: false, editing: null });
      fetchTabData('categorias-cupons');
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawVal = Number(couponForm.value);
    const val = couponForm.type === 'fixo' ? Math.round(rawVal * 100) : Math.round(rawVal);
    if (!couponForm.code.trim() || Number.isNaN(val) || val <= 0) {
      addToast('error', 'Informe código e valor positivo para o cupom.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/api/admin/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: couponForm.code,
          type: couponForm.type,
          value: val,
          expiresAt: couponForm.expiresAt,
          usageLimit: Number(couponForm.usageLimit || 100),
        }),
      });
      addToast('success', 'Cupom criado com sucesso.');
      setCouponModal(false);
      fetchTabData('categorias-cupons');
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmOrderStatus = async () => {
    if (!orderStatusModal.order) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/orders/${orderStatusModal.order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: targetOrderStatus,
          reason: cancelReason,
          adminPassword: adminAuthPassword,
        }),
      });
      addToast('success', 'Status do pedido atualizado.');
      setOrderStatusModal({ open: false, order: null });
      setCancelReason('');
      setAdminAuthPassword('');
      fetchTabData('pedidos');
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateFinancial = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = parseCurrencyToCents(finForm.amountReais);
    if (!finForm.description.trim() || Number.isNaN(amountCents) || amountCents <= 0) {
      addToast('error', 'Informe descrição e valor positivo.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/api/admin/financial', {
        method: 'POST',
        body: JSON.stringify({
          type: finForm.type,
          description: finForm.description,
          amountCents,
          dueDate: finForm.dueDate,
        }),
      });
      addToast('success', 'Lançamento financeiro criado.');
      setFinModal(false);
      setFinForm({ type: 'pagar', description: '', amountReais: '', dueDate: getLocalDateYMD(new Date()) });
      fetchTabData('financeiro');
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePayFinancial = async (id: number) => {
    try {
      await apiFetch(`/api/admin/financial/${id}/pay`, { method: 'POST' });
      addToast('success', 'Pagamento registrado com sucesso.');
      fetchTabData('financeiro');
    } catch (err: any) {
      addToast('error', err.message);
    }
  };

  const handleUploadAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');
    if (!selectedFile) {
      setUploadError('Selecione um arquivo PDF, PNG ou JPG.');
      return;
    }
    const allowedExt = /\.(pdf|png|jpg|jpeg)$/i;
    if (!allowedExt.test(selectedFile.name)) {
      setUploadError('Extensão inválida. Apenas arquivos PDF, PNG e JPG são aceitos.');
      return;
    }
    if (selectedFile.size > 2 * 1024 * 1024) {
      setUploadError('Arquivo muito grande. O limite máximo é de 2 MB.');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      await apiFetch('/api/admin/attachments', {
        method: 'POST',
        body: formData,
      });
      addToast('success', 'Arquivo enviado com sucesso.');
      setSelectedFile(null);
      const inputEl = document.getElementById('attachment-file-input') as HTMLInputElement | null;
      if (inputEl) inputEl.value = '';
      fetchTabData('anexos');
    } catch (err: any) {
      setUploadError(err.message);
      addToast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const endpointMap: Record<string, string> = {
        user: `/api/admin/users/${deleteTarget.id}`,
        customer: `/api/admin/customers/${deleteTarget.id}`,
        product: `/api/admin/products/${deleteTarget.id}`,
        category: `/api/admin/categories/${deleteTarget.id}`,
        coupon: `/api/admin/coupons/${deleteTarget.id}`,
        financial: `/api/admin/financial/${deleteTarget.id}`,
        attachment: `/api/admin/attachments/${deleteTarget.id}`,
      };
      await apiFetch(endpointMap[deleteTarget.type], { method: 'DELETE' });
      addToast('success', `${deleteTarget.label} excluído(a) com sucesso.`);
      setDeleteTarget(null);
      fetchTabData(activeTab);
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLabSettings = async () => {
    setSaving(true);
    try {
      await apiFetch('/api/admin/lab-settings', {
        method: 'PUT',
        body: JSON.stringify({
          simulatedDelayMs: Number(delayMs),
          maxCashierDiscountPercent: Number(maxDiscount),
        }),
      });
      await refreshConfig();
      addToast('success', 'Configurações do laboratório salvas.');
      fetchTabData('laboratorio');
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDemo = async () => {
    setSaving(true);
    setLabSuccessMessage('');
    try {
      const data = await apiFetch<{ message?: string }>('/api/admin/reset-demo', { method: 'POST' });
      await Promise.all([refreshUser(), refreshConfig()]);
      const successText = data.message || 'Dados de demonstração restaurados ao estado inicial.';
      setLabSuccessMessage(successText);
      addToast('success', successText);
      setResetModalOpen(false);
      fetchTabData('laboratorio');
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportBackup = async () => {
    setBackupError('');
    setLabSuccessMessage('');
    setBackupLoading(true);
    try {
      const data = await apiFetch<{ filename: string; payload: any; historyEntry: any }>(
        '/api/admin/backups/export',
        { method: 'POST' }
      );
      const clientFilename = formatBackupFilename(
        new Date(data.payload?.metadata?.generatedAt || Date.now())
      );
      const jsonBlob = new Blob([JSON.stringify(data.payload, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(jsonBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = clientFilename || data.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      const msg = `Backup gerado e baixado: ${clientFilename || data.filename}`;
      setLabSuccessMessage(msg);
      addToast('success', msg);
      fetchTabData('laboratorio');
    } catch (err: any) {
      const msg = err.message || 'Erro ao gerar backup.';
      setBackupError(msg);
      addToast('error', msg);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleSelectBackupFile = async (file: File | null) => {
    setBackupError('');
    setLabSuccessMessage('');
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      const msg = 'Formato inválido. Selecione um arquivo de backup com extensão .json.';
      setBackupError(msg);
      addToast('error', msg);
      if (backupFileInputRef.current) backupFileInputRef.current.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      const msg = 'Arquivo de backup excede o limite máximo de 10 MB.';
      setBackupError(msg);
      addToast('error', msg);
      if (backupFileInputRef.current) backupFileInputRef.current.value = '';
      return;
    }

    setBackupLoading(true);
    try {
      const rawText = await file.text();
      let parsed: any;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        throw new Error('Arquivo JSON inválido ou malformado.');
      }

      const validation = await apiFetch<{ valid: boolean; metadata: any; counts: any; error?: string }>(
        '/api/admin/backups/validate',
        {
          method: 'POST',
          body: JSON.stringify({ payload: parsed, rawSizeBytes: file.size }),
        }
      );

      setRestorePendingPayload(parsed);
      setRestoreMetadata(validation.metadata);
      setRestoreConfirmText('');
      setRestoreModalOpen(true);
    } catch (err: any) {
      const msg = err.message || 'Arquivo de backup inválido.';
      setBackupError(msg);
      addToast('error', msg);
    } finally {
      setBackupLoading(false);
      if (backupFileInputRef.current) backupFileInputRef.current.value = '';
    }
  };

  const handleConfirmRestoreBackup = async () => {
    if (!restorePendingPayload || restoreConfirmText.trim() !== 'RESTAURAR') return;
    setBackupLoading(true);
    setBackupError('');
    try {
      const res = await apiFetch<{ message?: string }>('/api/admin/backups/restore', {
        method: 'POST',
        body: JSON.stringify({
          confirmationText: restoreConfirmText.trim(),
          payload: restorePendingPayload,
        }),
      });
      await Promise.all([refreshUser(), refreshConfig()]);
      const msg =
        res.message ||
        'Backup restaurado com sucesso. Um backup automático de segurança foi salvo antes da operação.';
      setLabSuccessMessage(msg);
      addToast('success', msg);
      setRestoreModalOpen(false);
      setRestorePendingPayload(null);
      setRestoreMetadata(null);
      setRestoreConfirmText('');
      fetchTabData('laboratorio');
    } catch (err: any) {
      const msg = err.message || 'Erro ao restaurar backup.';
      setBackupError(msg);
      addToast('error', msg);
    } finally {
      setBackupLoading(false);
    }
  };

  return (
    <div className="flex-1 flex bg-slate-50 dark:bg-slate-950 min-w-0">
      {/* Desktop Sidebar */}
      <aside
        data-testid="admin-sidebar"
        className={`hidden lg:flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all shrink-0 ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          {!sidebarCollapsed && (
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Painel Administrativo
            </span>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            data-testid="admin-sidebar-toggle"
            aria-label="Recolher menu lateral"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 p-2.5 space-y-1">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                data-testid={`admin-nav-${item.id}`}
                className={`w-full min-h-[42px] px-3 py-2 rounded-lg flex items-center gap-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Nav Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-2 z-10 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <span className="font-bold text-slate-900 dark:text-white">Menu Admin</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="p-2 rounded-lg text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileNavOpen(false);
                }}
                data-testid={`admin-mobile-nav-${item.id}`}
                className={`min-h-[44px] px-3 py-2.5 rounded-lg flex items-center gap-2.5 text-sm font-medium ${
                  activeTab === item.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto w-full space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              data-testid="admin-mobile-menu-button"
              aria-label="Abrir menu administrativo"
              className="lg:hidden min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {navItems.find((i) => i.id === activeTab)?.label}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => fetchTabData(activeTab)}
            data-testid="admin-refresh-button"
            className="min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>

        {loading && (
          <div
            data-testid="loading-spinner"
            className="flex items-center gap-2 text-sm text-indigo-600 dark:text-teal-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Carregando dados...</span>
          </div>
        )}

        {loadError && (
          <div
            data-testid="admin-load-error"
            className="p-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loadError}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchTabData(activeTab)}
              data-testid="retry-button"
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* 1. DASHBOARD */}
        {activeTab === 'dashboard' && dashboard && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Data inicial
                </label>
                <input
                  type="date"
                  value={dashStart}
                  onChange={(e) => setDashStart(e.target.value)}
                  data-testid="dashboard-start-date"
                  className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Data final
                </label>
                <input
                  type="date"
                  value={dashEnd}
                  onChange={(e) => setDashEnd(e.target.value)}
                  data-testid="dashboard-end-date"
                  className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => fetchTabData('dashboard')}
                data-testid="dashboard-filter-button"
                className="min-h-[40px] px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
              >
                Filtrar período
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                { label: 'Total de Clientes', val: dashboard.kpis.totalCustomers, tid: 'kpi-customers' },
                { label: 'Produtos Cadastrados', val: dashboard.kpis.totalProducts, tid: 'kpi-products' },
                { label: 'Sem Estoque', val: dashboard.kpis.outOfStockCount, tid: 'kpi-out-of-stock', warn: dashboard.kpis.outOfStockCount > 0 },
                { label: 'Pedidos Pendentes', val: dashboard.kpis.pendingOrdersCount, tid: 'kpi-pending-orders' },
                { label: 'Pedidos Totais', val: `${dashboard.kpis.totalOrders} (${dashboard.kpis.onlineOrdersCount} Online / ${dashboard.kpis.pdvOrdersCount} PDV)`, tid: 'kpi-total-orders' },
                { label: 'Faturamento', val: formatBRL(dashboard.kpis.revenueCents), tid: 'kpi-revenue' },
                { label: 'Contas a Receber (Aberto)', val: formatBRL(dashboard.kpis.receivablePendingCents), tid: 'kpi-receivable' },
                { label: 'Contas a Pagar (Aberto)', val: formatBRL(dashboard.kpis.payablePendingCents), tid: 'kpi-payable', warn: dashboard.kpis.overdueCount > 0 },
              ].map((k) => (
                <div
                  key={k.tid}
                  data-testid={k.tid}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5"
                >
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {k.label}
                  </p>
                  <p
                    className={`mt-2 text-2xl font-bold tabular-nums ${
                      k.warn ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {k.val}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Status Breakdown */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Pedidos por Status
                </h2>
                <div className="space-y-3">
                  {dashboard.statusBreakdown.map((item: any) => {
                    const pct = dashboard.kpis.totalOrders
                      ? Math.round((item.count / dashboard.kpis.totalOrders) * 100)
                      : 0;
                    return (
                      <div key={item.status} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {item.status}
                          </span>
                          <span className="font-mono tabular-nums text-slate-500">
                            {item.count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 dark:bg-teal-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Revenue By Day */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Faturamento por Dia (Online vs PDV)
                </h2>
                {dashboard.revenueByDay.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">
                    Nenhum faturamento no período selecionado.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {dashboard.revenueByDay.map((d: any) => (
                      <div key={d.date} className="flex items-center justify-between gap-4 text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="font-mono text-slate-600 dark:text-slate-400">
                          {formatDateBR(d.date)}
                        </span>
                        <div className="flex items-center gap-4 tabular-nums">
                          <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                            Online: {formatBRL(d.online)}
                          </span>
                          <span className="text-teal-600 dark:text-teal-400 font-semibold">
                            PDV: {formatBRL(d.pdv)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. USUARIOS */}
        {activeTab === 'usuarios' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Gerencie contas internas (Administrador, Caixa) e permissões de acesso.
              </p>
              <button
                type="button"
                onClick={() => {
                  setFormErrors({});
                  setUserForm({ name: '', email: '', role: 'caixa', password: '', status: 'ativo' });
                  setUserModal({ open: true, editing: null });
                }}
                data-testid="new-user-button"
                className="min-h-[42px] px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Usuário</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table data-testid="users-table" className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-xs text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nome</th>
                    <th className="px-4 py-3 font-semibold">E-mail</th>
                    <th className="px-4 py-3 font-semibold">Perfil</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right sticky right-0 bg-slate-50 dark:bg-slate-800">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{u.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{u.email}</td>
                      <td className="px-4 py-3 capitalize">{u.role}</td>
                      <td className="px-4 py-3">
                        <span className={u.status === 'ativo' ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>
                          {u.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right sticky right-0 bg-white dark:bg-slate-900">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setFormErrors({});
                              setUserForm({
                                name: u.name,
                                email: u.email,
                                role: u.role,
                                password: '',
                                status: u.status,
                              });
                              setUserModal({ open: true, editing: u });
                            }}
                            data-testid={`edit-user-${u.id}`}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                            title="Editar usuário"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setResetPassModal({ open: true, user: u, newPass: '' })}
                            data-testid={`reset-user-pass-${u.id}`}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-600"
                            title="Redefinir senha"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ type: 'user', id: u.id, label: u.name })}
                            data-testid={`delete-user-${u.id}`}
                            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600"
                            title="Excluir usuário"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. CLIENTES */}
        {activeTab === 'clientes' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={custSearch}
                    onChange={(e) => {
                      setCustSearch(e.target.value);
                      setCustPage(1);
                    }}
                    data-testid="customer-search-input"
                    placeholder="Buscar por nome ou CPF..."
                    className="w-full min-h-[40px] pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
                <select
                  value={custStatus}
                  onChange={(e) => {
                    setCustStatus(e.target.value);
                    setCustPage(1);
                  }}
                  data-testid="customer-status-filter"
                  className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                >
                  <option value="">Todos os status</option>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFormErrors({});
                  setCustForm({
                    name: '',
                    email: '',
                    cpf: '',
                    birthDate: '',
                    phone: '',
                    cep: '',
                    address: '',
                    number: '',
                    city: '',
                    state: 'SP',
                    status: 'ativo',
                  });
                  setCustModal({ open: true, editing: null });
                }}
                data-testid="new-customer-button"
                className="min-h-[42px] px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Cliente</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table data-testid="customers-table" className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-xs text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nome</th>
                    <th className="px-4 py-3 font-semibold">CPF</th>
                    <th className="px-4 py-3 font-semibold">E-mail</th>
                    <th className="px-4 py-3 font-semibold">Cidade/UF</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right sticky right-0 bg-slate-50 dark:bg-slate-800">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {pagedCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                        Nenhum cliente encontrado.
                      </td>
                    </tr>
                  ) : (
                    pagedCustomers.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{c.name}</td>
                        <td className="px-4 py-3 font-mono text-xs">{c.cpf || '—'}</td>
                        <td className="px-4 py-3 text-xs">{c.email}</td>
                        <td className="px-4 py-3 text-xs">
                          {c.city ? `${c.city}/${c.state}` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={c.status === 'ativo' ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>
                            {c.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right sticky right-0 bg-white dark:bg-slate-900">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setFormErrors({});
                                setCustForm({
                                  name: c.name || '',
                                  email: c.email || '',
                                  cpf: c.cpf || '',
                                  birthDate: c.birthDate || '',
                                  phone: c.phone || '',
                                  cep: c.cep || '',
                                  address: c.address || '',
                                  number: c.number || '',
                                  city: c.city || '',
                                  state: c.state || 'SP',
                                  status: c.status || 'ativo',
                                });
                                setCustModal({ open: true, editing: c });
                              }}
                              data-testid={`edit-customer-${c.id}`}
                              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ type: 'customer', id: c.id, label: c.name })}
                              data-testid={`delete-customer-${c.id}`}
                              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <PaginationBar
              page={custPage}
              totalPages={Math.max(1, Math.ceil(customersList.length / custPageSize))}
              totalItems={customersList.length}
              pageSize={custPageSize}
              onPageChange={setCustPage}
              onPageSizeChange={(s) => {
                setCustPageSize(s);
                setCustPage(1);
              }}
              testIdPrefix="customers-pagination"
            />
          </div>
        )}

        {/* 4. PRODUTOS */}
        {activeTab === 'produtos' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={prodSearch}
                    onChange={(e) => {
                      setProdSearch(e.target.value);
                      setProdPage(1);
                    }}
                    data-testid="product-search-input"
                    placeholder="Buscar por nome ou código..."
                    className="w-full min-h-[40px] pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
                <select
                  value={prodCat}
                  onChange={(e) => {
                    setProdCat(e.target.value);
                    setProdPage(1);
                  }}
                  data-testid="product-category-filter"
                  className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                >
                  <option value="">Todas categorias</option>
                  {categoriesList.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setProdSort((s) => (s === 'price_asc' ? 'price_desc' : 'price_asc'))
                  }
                  data-testid="product-sort-price-button"
                  className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>
                    Preço {prodSort === 'price_asc' ? '(Menor)' : prodSort === 'price_desc' ? '(Maior)' : ''}
                  </span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFormErrors({});
                  setProdImageError('');
                  setProdForm({
                    code: '',
                    name: '',
                    description: '',
                    categoryId: categoriesList[0]?.id ? String(categoriesList[0].id) : '',
                    supplier: '',
                    priceReais: '',
                    stock: '10',
                    minStock: '5',
                    imageUrl: '',
                    status: 'ativo',
                  });
                  setProdModal({ open: true, editing: null });
                }}
                data-testid="new-product-button"
                className="min-h-[42px] px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Produto</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table data-testid="products-table" className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-xs text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Foto</th>
                    <th className="px-4 py-3 font-semibold">Código</th>
                    <th className="px-4 py-3 font-semibold">Produto</th>
                    <th className="px-4 py-3 font-semibold">Categoria</th>
                    <th className="px-4 py-3 font-semibold text-right">Preço</th>
                    <th className="px-4 py-3 font-semibold text-right">Estoque</th>
                    <th className="px-4 py-3 font-semibold text-right sticky right-0 bg-slate-50 dark:bg-slate-800">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {pagedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                        Nenhum produto encontrado.
                      </td>
                    </tr>
                  ) : (
                    pagedProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-2.5">
                          <div className="w-11 h-11 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                            <ProductImage src={p.imageUrl} alt={p.name} />
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-semibold">{p.code}</td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{p.name}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{p.categoryName}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">
                          {formatBRL(p.priceCents)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {p.stock <= 0 ? (
                            <span className="text-red-600 dark:text-red-400 font-semibold">
                              0 (Sem estoque)
                            </span>
                          ) : p.stock <= p.minStock ? (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              {p.stock} (Baixo)
                            </span>
                          ) : (
                            <span>{p.stock}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right sticky right-0 bg-white dark:bg-slate-900">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setFormErrors({});
                                setProdImageError('');
                                setProdForm({
                                  code: p.code,
                                  name: p.name,
                                  description: p.description,
                                  categoryId: p.categoryId ? String(p.categoryId) : '',
                                  supplier: p.supplier,
                                  priceReais: (p.priceCents / 100).toFixed(2),
                                  stock: String(p.stock),
                                  minStock: String(p.minStock),
                                  imageUrl: p.imageUrl || '',
                                  status: p.status,
                                });
                                setProdModal({ open: true, editing: p });
                              }}
                              data-testid={`edit-product-${p.id}`}
                              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Editar produto"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ type: 'product', id: p.id, label: p.name })}
                              data-testid={`delete-product-${p.id}`}
                              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600"
                              title="Excluir produto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <PaginationBar
              page={prodPage}
              totalPages={Math.max(1, Math.ceil(productsList.length / prodPageSize))}
              totalItems={productsList.length}
              pageSize={prodPageSize}
              onPageChange={setProdPage}
              onPageSizeChange={(s) => {
                setProdPageSize(s);
                setProdPage(1);
              }}
              testIdPrefix="products-pagination"
            />
          </div>
        )}

        {/* 5. CATEGORIAS & CUPONS */}
        {activeTab === 'categorias-cupons' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Categorias */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-base font-bold">Categorias</h2>
                <button
                  type="button"
                  onClick={() => {
                    setCatForm({ name: '', description: '', status: 'ativo' });
                    setCatModal({ open: true, editing: null });
                  }}
                  data-testid="new-category-button"
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nova Categoria</span>
                </button>
              </div>
              <div className="overflow-x-auto">
                <table data-testid="categories-table" className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 text-xs">
                    <tr>
                      <th className="px-4 py-2.5">Nome</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {categoriesList.map((cat) => (
                      <tr key={cat.id}>
                        <td className="px-4 py-3 font-medium">{cat.name}</td>
                        <td className="px-4 py-3 text-xs capitalize">{cat.status}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setCatForm({
                                name: cat.name,
                                description: cat.description || '',
                                status: cat.status,
                              });
                              setCatModal({ open: true, editing: cat });
                            }}
                            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 mr-1"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ type: 'category', id: cat.id, label: cat.name })}
                            className="p-1.5 rounded hover:bg-red-50 text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cupons */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-base font-bold">Cupons de Desconto</h2>
                <button
                  type="button"
                  onClick={() => setCouponModal(true)}
                  data-testid="new-coupon-button"
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo Cupom</span>
                </button>
              </div>
              <div className="overflow-x-auto">
                <table data-testid="coupons-table" className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 text-xs">
                    <tr>
                      <th className="px-4 py-2.5">Código</th>
                      <th className="px-4 py-2.5">Desconto</th>
                      <th className="px-4 py-2.5">Usos</th>
                      <th className="px-4 py-2.5">Validade</th>
                      <th className="px-4 py-2.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {couponsList.map((cp) => (
                      <tr key={cp.id}>
                        <td className="px-4 py-3 font-mono font-bold text-xs">{cp.code}</td>
                        <td className="px-4 py-3 tabular-nums">
                          {cp.type === 'percentual' ? `${cp.value}%` : formatBRL(cp.value)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs tabular-nums">
                          {cp.usedCount}/{cp.usageLimit}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono">
                          {formatDateBR(cp.expiresAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ type: 'coupon', id: cp.id, label: cp.code })}
                            className="p-1.5 rounded hover:bg-red-50 text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 6. PEDIDOS */}
        {activeTab === 'pedidos' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3">
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                data-testid="orders-status-filter"
                className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              >
                <option value="">Todos os status</option>
                <option value="Pendente">Pendente</option>
                <option value="Pago">Pago</option>
                <option value="Enviado">Enviado</option>
                <option value="Entregue">Entregue</option>
                <option value="Cancelado">Cancelado</option>
              </select>
              <select
                value={orderChannelFilter}
                onChange={(e) => setOrderChannelFilter(e.target.value)}
                data-testid="orders-channel-filter"
                className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              >
                <option value="">Todos os canais</option>
                <option value="online">Online</option>
                <option value="pdv">PDV (Balcão)</option>
              </select>
              <input
                type="date"
                value={orderStart}
                onChange={(e) => setOrderStart(e.target.value)}
                data-testid="orders-start-date"
                className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
              <input
                type="date"
                value={orderEnd}
                onChange={(e) => setOrderEnd(e.target.value)}
                data-testid="orders-end-date"
                className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>

            <div className="overflow-x-auto">
              <table data-testid="orders-table" className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-xs border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Pedido</th>
                    <th className="px-4 py-3 font-semibold">Data/Hora</th>
                    <th className="px-4 py-3 font-semibold">Canal</th>
                    <th className="px-4 py-3 font-semibold">Cliente</th>
                    <th className="px-4 py-3 font-semibold">Pagamento</th>
                    <th className="px-4 py-3 font-semibold text-right">Total</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right sticky right-0 bg-slate-50 dark:bg-slate-800">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {ordersList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                        Nenhum pedido encontrado para os filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    ordersList.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-mono font-semibold text-xs">{o.orderNumber}</td>
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                          {formatDateTimeBR(o.createdAt)}
                        </td>
                        <td className="px-4 py-3 uppercase text-xs font-medium">{o.channel}</td>
                        <td className="px-4 py-3">{o.customerName || 'Consumidor'}</td>
                        <td className="px-4 py-3 text-xs">{o.paymentMethod}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">
                          {formatBRL(o.totalCents)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-semibold ${
                              o.status === 'Entregue' || o.status === 'Pago'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : o.status === 'Cancelado'
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {o.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right sticky right-0 bg-white dark:bg-slate-900">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setOrderDetailModal(o)}
                              data-testid={`view-order-${o.id}`}
                              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Ver detalhes"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {o.status !== 'Cancelado' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setTargetOrderStatus(o.status);
                                  setCancelReason('');
                                  setAdminAuthPassword('');
                                  setOrderStatusModal({ open: true, order: o });
                                }}
                                data-testid={`change-order-status-${o.id}`}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                Alterar Status
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. FINANCEIRO */}
        {activeTab === 'financeiro' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                <input
                  type="text"
                  value={finSearch}
                  onChange={(e) => setFinSearch(e.target.value)}
                  data-testid="financial-search-input"
                  placeholder="Pesquisar descrição..."
                  className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
                <select
                  value={finType}
                  onChange={(e) => setFinType(e.target.value)}
                  data-testid="financial-type-filter"
                  className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                >
                  <option value="">Pagar e Receber</option>
                  <option value="pagar">Contas a Pagar</option>
                  <option value="receber">Contas a Receber</option>
                </select>
                <select
                  value={finStatus}
                  onChange={(e) => setFinStatus(e.target.value)}
                  data-testid="financial-status-filter"
                  className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                >
                  <option value="">Todas situações</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Pago">Pago</option>
                  <option value="Atrasado">Atrasado</option>
                </select>
                <input
                  type="date"
                  value={finStart}
                  onChange={(e) => setFinStart(e.target.value)}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
                <input
                  type="date"
                  value={finEnd}
                  onChange={(e) => setFinEnd(e.target.value)}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>

              <button
                type="button"
                onClick={() => setFinModal(true)}
                data-testid="new-financial-button"
                className="min-h-[42px] px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Conta</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table data-testid="financial-table" className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-xs border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Tipo</th>
                    <th className="px-4 py-3 font-semibold">Descrição</th>
                    <th className="px-4 py-3 font-semibold">Vencimento</th>
                    <th className="px-4 py-3 font-semibold text-right">Valor</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right sticky right-0 bg-slate-50 dark:bg-slate-800">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {financialList.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 capitalize font-medium text-xs">
                        {f.type === 'pagar' ? 'A Pagar' : 'A Receber'}
                      </td>
                      <td className="px-4 py-3">{f.description}</td>
                      <td className="px-4 py-3 font-mono text-xs">{formatDateBR(f.dueDate)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">
                        {formatBRL(f.amountCents)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-semibold ${
                            f.status === 'Pago'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : f.status === 'Atrasado'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {f.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right sticky right-0 bg-white dark:bg-slate-900">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handlePayFinancial(f.id)}
                            disabled={f.status === 'Pago'}
                            data-testid={`pay-financial-${f.id}`}
                            className="min-h-[36px] px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white text-xs font-semibold inline-flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{f.status === 'Pago' ? 'Quitado' : 'Pagar'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ type: 'financial', id: f.id, label: f.description })}
                            className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 8. ANEXOS */}
        {activeTab === 'anexos' && (
          <div className="space-y-6">
            <form
              onSubmit={handleUploadAttachment}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
            >
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Enviar Anexo (PDF, PNG ou JPG até 2 MB)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Arquivos com outras extensões ou acima de 2 MB serão bloqueados com mensagem de validação.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  id="attachment-file-input"
                  type="file"
                  onChange={(e) => {
                    setUploadError('');
                    setSelectedFile(e.target.files?.[0] || null);
                  }}
                  data-testid="attachment-file-input"
                  className="text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-950 dark:file:text-indigo-300"
                />
                <button
                  type="submit"
                  disabled={saving}
                  data-testid="upload-attachment-button"
                  className="min-h-[42px] px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-60"
                >
                  {saving ? 'Enviando...' : 'Enviar Arquivo'}
                </button>
              </div>
              {uploadError && (
                <p data-testid="upload-error-message" className="text-xs font-medium text-red-600 dark:text-red-400">
                  {uploadError}
                </p>
              )}
            </form>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table data-testid="attachments-table" className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 text-xs">
                    <tr>
                      <th className="px-4 py-3">Arquivo</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Tamanho</th>
                      <th className="px-4 py-3">Enviado em</th>
                      <th className="px-4 py-3">Enviado por</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {attachmentsList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                          Nenhum anexo enviado ainda.
                        </td>
                      </tr>
                    ) : (
                      attachmentsList.map((att) => (
                        <tr key={att.id}>
                          <td className="px-4 py-3 font-medium">{att.originalName}</td>
                          <td className="px-4 py-3 font-mono text-xs">{att.mimeType}</td>
                          <td className="px-4 py-3 font-mono text-xs tabular-nums">
                            {(att.sizeBytes / 1024).toFixed(1)} KB
                          </td>
                          <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                            {formatDateTimeBR(att.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-xs">{att.uploadedBy}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <a
                                href={`/api/admin/attachments/${att.id}/download`}
                                data-testid={`download-attachment-${att.id}`}
                                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600"
                                title="Baixar"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteTarget({ type: 'attachment', id: att.id, label: att.originalName })
                                }
                                data-testid={`delete-attachment-${att.id}`}
                                className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 9. LABORATÓRIO QA */}
        {activeTab === 'laboratorio' && (
          <div className="space-y-6">
            {labSuccessMessage && (
              <div
                role="status"
                data-testid="success-message"
                className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{labSuccessMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLabSuccessMessage('')}
                  className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900"
                  aria-label="Fechar mensagem"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Restaurar Dados de Demonstração
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Recria o banco de dados PostgreSQL para o estado inicial de fábrica (3 contas padrão, produtos, pedidos e financeiro) para repetir baterias de testes sem interferências.
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={!isSuperAdmin || saving}
                    onClick={() => setResetModalOpen(true)}
                    title={!isSuperAdmin ? 'Ação disponível apenas para o Super Admin' : undefined}
                    data-testid="reset-demo-button"
                    className="min-h-[44px] px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Restaurar dados de demonstração</span>
                  </button>
                  {!isSuperAdmin && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                      <span>Ação disponível apenas para o Super Admin</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Atrasos Controlados & Regras do PDV
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="delay-select" className="block text-xs font-medium mb-1">
                      Atraso artificial na API (WebDriverWait)
                    </label>
                    <select
                      id="delay-select"
                      value={delayMs}
                      onChange={(e) => setDelayMs(e.target.value)}
                      data-testid="delay-select"
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                    >
                      <option value="0">0 ms (Desativado - padrão)</option>
                      <option value="500">500 ms</option>
                      <option value="1500">1.500 ms (1,5s)</option>
                      <option value="3000">3.000 ms (3,0s)</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="max-discount-input" className="block text-xs font-medium mb-1">
                      Limite de desconto PDV sem supervisor (%)
                    </label>
                    <input
                      id="max-discount-input"
                      type="number"
                      min="0"
                      max="50"
                      value={maxDiscount}
                      onChange={(e) => setMaxDiscount(e.target.value)}
                      data-testid="max-discount-input"
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSaveLabSettings}
                  disabled={saving}
                  data-testid="save-lab-settings-button"
                  className="min-h-[42px] px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                >
                  Salvar Configurações do Laboratório
                </button>
              </div>
            </div>

            {/* Backup & Restore (.json) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1 max-w-2xl">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileJson className="w-5 h-5 text-indigo-600 dark:text-teal-400" />
                    <span>Backup e Restauração do Sistema (.json)</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                    Exporte todas as entidades da loja (usuários, produtos com URL das fotos, categorias, cupons, pedidos, financeiro e anexos) com verificação SHA-256 ou restaure um arquivo .json com backup automático de segurança.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={!isSuperAdmin || backupLoading}
                    onClick={handleExportBackup}
                    title={!isSuperAdmin ? 'Ação disponível apenas para o Super Admin' : undefined}
                    data-testid="backup-create-button"
                    className="min-h-[44px] px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                  >
                    {backupLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>Gerar backup</span>
                  </button>

                  <div className="relative inline-flex">
                    <button
                      type="button"
                      disabled={!isSuperAdmin || backupLoading}
                      onClick={() => backupFileInputRef.current?.click()}
                      title={!isSuperAdmin ? 'Ação disponível apenas para o Super Admin' : undefined}
                      data-testid="backup-restore-button"
                      className="min-h-[44px] px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                    >
                      <HardDriveUpload className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>Restaurar backup</span>
                    </button>
                    <input
                      ref={backupFileInputRef}
                      type="file"
                      accept=".json,application/json"
                      disabled={!isSuperAdmin || backupLoading}
                      onChange={(e) => handleSelectBackupFile(e.target.files?.[0] || null)}
                      data-testid="backup-file-input"
                      title={!isSuperAdmin ? 'Ação disponível apenas para o Super Admin' : 'Selecionar arquivo .json de backup'}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {!isSuperAdmin && (
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>Ação disponível apenas para o Super Admin</span>
                </p>
              )}

              {backupError && (
                <div
                  role="alert"
                  data-testid="backup-error-message"
                  className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{backupError}</span>
                </div>
              )}

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Backups Recentes
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Exibindo no fuso horário do dispositivo
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table data-testid="backups-history-table" className="w-full text-xs text-left">
                    <thead className="bg-slate-50/70 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-2.5">Arquivo</th>
                        <th className="px-4 py-2.5">Data/Hora</th>
                        <th className="px-4 py-2.5">Origem</th>
                        <th className="px-4 py-2.5">Gerado por</th>
                        <th className="px-4 py-2.5 text-right">Tamanho</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {backupsList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                            Nenhum backup registrado ainda.
                          </td>
                        </tr>
                      ) : (
                        backupsList.map((b) => (
                          <tr key={b.id}>
                            <td className="px-4 py-2.5 font-mono font-semibold text-slate-800 dark:text-slate-200">
                              {b.filename}
                            </td>
                            <td className="px-4 py-2.5 font-mono whitespace-nowrap">
                              {formatDateTimeBR(b.createdAt)}
                            </td>
                            <td className="px-4 py-2.5">
                              {b.kind === 'safety' ? 'Segurança (pré-restauração)' : 'Manual'}
                            </td>
                            <td className="px-4 py-2.5 font-mono">{b.generatedBy}</td>
                            <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                              {b.sizeBytes >= 1024 * 1024
                                ? `${(b.sizeBytes / (1024 * 1024)).toFixed(2)} MB`
                                : `${(b.sizeBytes / 1024).toFixed(1)} KB`}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-base font-bold">Log de Auditoria (Últimas 100 ações)</h2>
              </div>
              <div className="overflow-x-auto max-h-96">
                <table data-testid="audit-logs-table" className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5">Data/Hora</th>
                      <th className="px-4 py-2.5">Ator</th>
                      <th className="px-4 py-2.5">Ação</th>
                      <th className="px-4 py-2.5">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {auditLogsList.map((log) => (
                      <tr key={log.id}>
                        <td className="px-4 py-2.5 font-mono whitespace-nowrap">
                          {formatDateTimeBR(log.createdAt)}
                        </td>
                        <td className="px-4 py-2.5 font-mono">{log.actorEmail}</td>
                        <td className="px-4 py-2.5 font-semibold">{log.action}</td>
                        <td className="px-4 py-2.5">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- MODALS --- */}
      {/* User Modal */}
      {userModal.open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <form
            onSubmit={handleSaveUser}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold">{userModal.editing ? 'Editar Usuário' : 'Novo Usuário'}</h3>
              <button type="button" onClick={() => setUserModal({ open: false, editing: null })}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium mb-1">Nome *</label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  data-testid="user-name-input"
                  className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
                {formErrors.name && <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>}
              </div>
              {!userModal.editing && (
                <>
                  <div>
                    <label className="block text-xs font-medium mb-1">E-mail *</label>
                    <input
                      type="email"
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      data-testid="user-email-input"
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                    />
                    {formErrors.email && <p className="text-xs text-red-600 mt-1">{formErrors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Senha inicial *</label>
                    <input
                      type="password"
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      data-testid="user-password-input"
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                    />
                    {formErrors.password && <p className="text-xs text-red-600 mt-1">{formErrors.password}</p>}
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Perfil</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    data-testid="user-role-select"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  >
                    <option value="admin">Administrador</option>
                    <option value="caixa">Caixa (PDV)</option>
                    <option value="cliente">Cliente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Status</label>
                  <select
                    value={userForm.status}
                    onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}
                    data-testid="user-status-select"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setUserModal({ open: false, editing: null })}
                className="min-h-[42px] px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                data-testid="save-button"
                className="min-h-[42px] px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reset User Password Modal */}
      {resetPassModal.open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <form
            onSubmit={handleResetUserPassword}
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl p-5 space-y-4"
          >
            <h3 className="font-bold">Redefinir Senha — {resetPassModal.user?.name}</h3>
            <div>
              <label className="block text-xs font-medium mb-1">Nova senha *</label>
              <input
                type="password"
                value={resetPassModal.newPass}
                onChange={(e) => setResetPassModal({ ...resetPassModal, newPass: e.target.value })}
                data-testid="reset-user-new-password-input"
                className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetPassModal({ open: false, user: null, newPass: '' })}
                className="min-h-[40px] px-4 py-2 rounded-lg border text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                data-testid="confirm-reset-pass-button"
                className="min-h-[40px] px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold"
              >
                Redefinir
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Customer Modal */}
      {custModal.open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <form
            onSubmit={handleSaveCustomer}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold">{custModal.editing ? 'Editar Cliente' : 'Novo Cliente'}</h3>
              <button type="button" onClick={() => setCustModal({ open: false, editing: null })}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium mb-1">Nome completo *</label>
                  <input
                    type="text"
                    value={custForm.name}
                    onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
                    data-testid="customer-name-input"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                  {formErrors.name && <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">CPF *</label>
                  <input
                    type="text"
                    value={custForm.cpf}
                    onChange={(e) => setCustForm({ ...custForm, cpf: maskCPF(e.target.value) })}
                    data-testid="customer-cpf-input"
                    placeholder="000.000.000-00"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                  />
                  {formErrors.cpf && <p className="text-xs text-red-600 mt-1">{formErrors.cpf}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">E-mail *</label>
                  <input
                    type="email"
                    value={custForm.email}
                    onChange={(e) => setCustForm({ ...custForm, email: e.target.value })}
                    data-testid="customer-email-input"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                  {formErrors.email && <p className="text-xs text-red-600 mt-1">{formErrors.email}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Data de nascimento</label>
                  <input
                    type="date"
                    value={custForm.birthDate}
                    onChange={(e) => setCustForm({ ...custForm, birthDate: e.target.value })}
                    data-testid="customer-birthdate-input"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Telefone</label>
                  <input
                    type="text"
                    value={custForm.phone}
                    onChange={(e) => setCustForm({ ...custForm, phone: maskPhone(e.target.value) })}
                    data-testid="customer-phone-input"
                    placeholder="(11) 90000-0000"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">CEP</label>
                  <input
                    type="text"
                    value={custForm.cep}
                    onChange={(e) => setCustForm({ ...custForm, cep: maskCEP(e.target.value) })}
                    data-testid="customer-cep-input"
                    placeholder="00000-000"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Status</label>
                  <select
                    value={custForm.status}
                    onChange={(e) => setCustForm({ ...custForm, status: e.target.value })}
                    data-testid="customer-status-select"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium mb-1">Endereço</label>
                  <input
                    type="text"
                    value={custForm.address}
                    onChange={(e) => setCustForm({ ...custForm, address: e.target.value })}
                    data-testid="customer-address-input"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Número</label>
                  <input
                    type="text"
                    value={custForm.number}
                    onChange={(e) => setCustForm({ ...custForm, number: e.target.value })}
                    data-testid="customer-number-input"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium mb-1">Cidade</label>
                    <input
                      type="text"
                      value={custForm.city}
                      onChange={(e) => setCustForm({ ...custForm, city: e.target.value })}
                      data-testid="customer-city-input"
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">UF</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={custForm.state}
                      onChange={(e) => setCustForm({ ...custForm, state: e.target.value.toUpperCase() })}
                      data-testid="customer-state-input"
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm uppercase"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setCustModal({ open: false, editing: null })}
                className="min-h-[42px] px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                data-testid="save-button"
                className="min-h-[42px] px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Product Modal */}
      {prodModal.open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <form
            onSubmit={handleSaveProduct}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold">{prodModal.editing ? 'Editar Produto' : 'Novo Produto'}</h3>
              <button type="button" onClick={() => setProdModal({ open: false, editing: null })}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Código (SKU) *</label>
                  <input
                    type="text"
                    value={prodForm.code}
                    onChange={(e) => setProdForm({ ...prodForm, code: e.target.value.toUpperCase() })}
                    data-testid="product-code-input"
                    placeholder="AUR-999"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                  />
                  {formErrors.code && <p className="text-xs text-red-600 mt-1">{formErrors.code}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Categoria</label>
                  <select
                    value={prodForm.categoryId}
                    onChange={(e) => setProdForm({ ...prodForm, categoryId: e.target.value })}
                    data-testid="product-category-select"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  >
                    {categoriesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium mb-1">Nome do produto *</label>
                  <input
                    type="text"
                    value={prodForm.name}
                    onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                    data-testid="product-name-input"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                  {formErrors.name && <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium mb-1">Descrição *</label>
                  <textarea
                    rows={2}
                    value={prodForm.description}
                    onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                    data-testid="product-description-input"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                  {formErrors.description && <p className="text-xs text-red-600 mt-1">{formErrors.description}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Fornecedor *</label>
                  <input
                    type="text"
                    value={prodForm.supplier}
                    onChange={(e) => setProdForm({ ...prodForm, supplier: e.target.value })}
                    data-testid="product-supplier-input"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                  {formErrors.supplier && <p className="text-xs text-red-600 mt-1">{formErrors.supplier}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Preço (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={prodForm.priceReais}
                    onChange={(e) => setProdForm({ ...prodForm, priceReais: e.target.value })}
                    data-testid="product-price-input"
                    placeholder="299.90"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                  />
                  {formErrors.priceReais && <p className="text-xs text-red-600 mt-1">{formErrors.priceReais}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Estoque *</label>
                  <input
                    type="number"
                    value={prodForm.stock}
                    onChange={(e) => setProdForm({ ...prodForm, stock: e.target.value })}
                    data-testid="product-stock-input"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                  />
                  {formErrors.stock && <p className="text-xs text-red-600 mt-1">{formErrors.stock}</p>}
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <label htmlFor="product-image-input" className="block text-xs font-medium">
                    Foto do produto
                  </label>

                  {prodForm.imageUrl ? (
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center gap-4">
                      <div
                        data-testid="product-image-preview"
                        className="w-24 h-24 rounded-lg overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0"
                      >
                        <ProductImage
                          src={prodForm.imageUrl}
                          alt={prodForm.name || 'Pré-visualização do produto'}
                        />
                      </div>
                      <div className="flex-1 min-w-[180px] space-y-2">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          Foto selecionada para o produto
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="relative inline-flex">
                            <button
                              type="button"
                              disabled={prodImageUploading}
                              onClick={() => prodImageInputRef.current?.click()}
                              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold inline-flex items-center gap-1.5"
                            >
                              {prodImageUploading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Upload className="w-3.5 h-3.5" />
                              )}
                              <span>{prodImageUploading ? 'Enviando...' : 'Trocar foto'}</span>
                            </button>
                            <input
                              ref={prodImageInputRef}
                              id="product-image-input"
                              type="file"
                              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                              disabled={prodImageUploading}
                              onChange={(e) => handleProductImageFile(e.target.files?.[0] || null)}
                              data-testid="product-image-input"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                          </div>

                          <button
                            type="button"
                            disabled={prodImageUploading}
                            onClick={() => {
                              setProdImageError('');
                              setProdForm((prev) => ({ ...prev, imageUrl: '' }));
                              if (prodImageInputRef.current) prodImageInputRef.current.value = '';
                            }}
                            data-testid="product-image-remove-button"
                            className="min-h-[38px] px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-semibold inline-flex items-center gap-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remover foto</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setProdImageDragging(true);
                      }}
                      onDragLeave={() => setProdImageDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setProdImageDragging(false);
                        const file = e.dataTransfer.files?.[0] || null;
                        handleProductImageFile(file);
                      }}
                      className={`relative rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
                        prodImageDragging
                          ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/30'
                          : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:border-indigo-400'
                      }`}
                    >
                      <input
                        ref={prodImageInputRef}
                        id="product-image-input"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                        disabled={prodImageUploading}
                        onChange={(e) => handleProductImageFile(e.target.files?.[0] || null)}
                        data-testid="product-image-input"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="flex flex-col items-center gap-1.5 pointer-events-none">
                        {prodImageUploading ? (
                          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                        ) : (
                          <Upload className="w-6 h-6 text-indigo-600 dark:text-teal-400" />
                        )}
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {prodImageUploading
                            ? 'Enviando foto para o armazenamento...'
                            : 'Arraste e solte a foto aqui ou clique para escolher'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          JPG, PNG ou WEBP · Máximo 2 MB · Computador, galeria ou câmera (se não enviar, usa imagem padrão)
                        </p>
                      </div>
                    </div>
                  )}

                  {prodImageError && (
                    <p
                      role="alert"
                      data-testid="product-image-error"
                      className="text-xs font-medium text-red-600 dark:text-red-400"
                    >
                      {prodImageError}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setProdModal({ open: false, editing: null })}
                className="min-h-[42px] px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || prodImageUploading}
                data-testid="save-button"
                className="min-h-[42px] px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Salvando...' : prodImageUploading ? 'Enviando foto...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Category Modal */}
      {catModal.open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <form
            onSubmit={handleSaveCategory}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl p-5 space-y-4"
          >
            <h3 className="font-bold">{catModal.editing ? 'Editar Categoria' : 'Nova Categoria'}</h3>
            <div>
              <label className="block text-xs font-medium mb-1">Nome *</label>
              <input
                type="text"
                value={catForm.name}
                onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                data-testid="category-name-input"
                className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Descrição</label>
              <input
                type="text"
                value={catForm.description}
                onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCatModal({ open: false, editing: null })}
                className="min-h-[40px] px-4 py-2 rounded-lg border text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                data-testid="save-button"
                className="min-h-[40px] px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Coupon Modal */}
      {couponModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <form
            onSubmit={handleSaveCoupon}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl p-5 space-y-4"
          >
            <h3 className="font-bold">Novo Cupom de Desconto</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1">Código *</label>
                <input
                  type="text"
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                  data-testid="coupon-code-input"
                  placeholder="PROMO25"
                  className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Tipo</label>
                <select
                  value={couponForm.type}
                  onChange={(e) => setCouponForm({ ...couponForm, type: e.target.value })}
                  data-testid="coupon-type-select"
                  className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                >
                  <option value="percentual">Percentual (%)</option>
                  <option value="fixo">Valor Fixo (R$)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Valor *</label>
                <input
                  type="number"
                  step="0.01"
                  value={couponForm.value}
                  onChange={(e) => setCouponForm({ ...couponForm, value: e.target.value })}
                  data-testid="coupon-value-input"
                  className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Validade *</label>
                <input
                  type="date"
                  value={couponForm.expiresAt}
                  onChange={(e) => setCouponForm({ ...couponForm, expiresAt: e.target.value })}
                  data-testid="coupon-expires-input"
                  className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Limite de usos</label>
                <input
                  type="number"
                  value={couponForm.usageLimit}
                  onChange={(e) => setCouponForm({ ...couponForm, usageLimit: e.target.value })}
                  data-testid="coupon-limit-input"
                  className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCouponModal(false)}
                className="min-h-[40px] px-4 py-2 rounded-lg border text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                data-testid="save-button"
                className="min-h-[40px] px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold"
              >
                Salvar Cupom
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Order Status Change Modal */}
      {orderStatusModal.open && orderStatusModal.order && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl p-5 space-y-4">
            <h3 className="font-bold">
              Alterar Status — {orderStatusModal.order.orderNumber}
            </h3>
            <div>
              <label className="block text-xs font-medium mb-1">Novo Status</label>
              <select
                value={targetOrderStatus}
                onChange={(e) => setTargetOrderStatus(e.target.value)}
                data-testid="order-status-select"
                className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              >
                <option value="Pendente">Pendente</option>
                <option value="Pago">Pago</option>
                <option value="Enviado">Enviado</option>
                <option value="Entregue">Entregue</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </div>

            {targetOrderStatus === 'Cancelado' && (
              <div className="space-y-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900">
                <div>
                  <label className="block text-xs font-medium mb-1">Justificativa *</label>
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    data-testid="order-cancel-reason-input"
                    placeholder="Motivo do cancelamento..."
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
                {['Pago', 'Enviado', 'Entregue'].includes(orderStatusModal.order.status) && (
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Senha do Administrador (autorização obrigatória) *
                    </label>
                    <input
                      type="password"
                      value={adminAuthPassword}
                      onChange={(e) => setAdminAuthPassword(e.target.value)}
                      data-testid="order-cancel-admin-password"
                      placeholder="Admin@123"
                      className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOrderStatusModal({ open: false, order: null })}
                className="min-h-[40px] px-4 py-2 rounded-lg border text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmOrderStatus}
                disabled={saving}
                data-testid="confirm-order-status-button"
                className="min-h-[40px] px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {orderDetailModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold">Pedido {orderDetailModal.orderNumber}</h3>
              <button type="button" onClick={() => setOrderDetailModal(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
              <p><strong>Data/Hora:</strong> {formatDateTimeBR(orderDetailModal.createdAt)}</p>
              <p><strong>Canal:</strong> {orderDetailModal.channel.toUpperCase()}</p>
              <p><strong>Cliente:</strong> {orderDetailModal.customerName} ({orderDetailModal.customerCpf || 'Sem CPF'})</p>
              <p><strong>Status:</strong> {orderDetailModal.status}</p>
              <p><strong>Pagamento:</strong> {orderDetailModal.paymentMethod}</p>
              {orderDetailModal.deliveredAt && (
                <p><strong>Entregue em:</strong> {formatDateTimeBR(orderDetailModal.deliveredAt)}</p>
              )}
              {orderDetailModal.cancellationReason && (
                <p className="text-red-600"><strong>Motivo cancelamento:</strong> {orderDetailModal.cancellationReason}</p>
              )}
              {orderDetailModal.returnStatus !== 'Nenhum' && (
                <p className="text-amber-600"><strong>Devolução:</strong> {orderDetailModal.returnStatus} — {orderDetailModal.returnReason}</p>
              )}
            </div>
            <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2">
              <p className="text-xs font-bold">Itens</p>
              {(orderDetailModal.items || []).map((i: any) => (
                <div key={i.id} className="flex justify-between text-xs">
                  <span>{i.quantity}x {i.productName}</span>
                  <span className="font-mono tabular-nums">{formatBRL(i.totalCents)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-sm pt-2 border-t border-slate-200 dark:border-slate-800">
                <span>Total</span>
                <span className="font-mono tabular-nums">{formatBRL(orderDetailModal.totalCents)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Financial Modal */}
      {finModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <form
            onSubmit={handleCreateFinancial}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl p-5 space-y-4"
          >
            <h3 className="font-bold">Novo Lançamento Financeiro</h3>
            <div>
              <label className="block text-xs font-medium mb-1">Tipo</label>
              <select
                value={finForm.type}
                onChange={(e) => setFinForm({ ...finForm, type: e.target.value })}
                data-testid="financial-type-select"
                className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              >
                <option value="pagar">Conta a Pagar</option>
                <option value="receber">Conta a Receber</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Descrição *</label>
              <input
                type="text"
                value={finForm.description}
                onChange={(e) => setFinForm({ ...finForm, description: e.target.value })}
                data-testid="financial-description-input"
                className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Valor (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={finForm.amountReais}
                  onChange={(e) => setFinForm({ ...finForm, amountReais: e.target.value })}
                  data-testid="financial-amount-input"
                  className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Vencimento *</label>
                <input
                  type="date"
                  value={finForm.dueDate}
                  onChange={(e) => setFinForm({ ...finForm, dueDate: e.target.value })}
                  data-testid="financial-due-input"
                  className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFinModal(false)}
                className="min-h-[40px] px-4 py-2 rounded-lg border text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                data-testid="save-button"
                className="min-h-[40px] px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Confirmar exclusão"
        description={`Tem certeza que deseja excluir "${deleteTarget?.label}"? Esta ação não poderá ser desfeita.`}
        confirmLabel="Excluir"
        danger
        loading={saving}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Reset Demo Confirmation */}
      <ConfirmModal
        open={resetModalOpen}
        title="Restaurar dados de demonstração"
        description="Atenção: todos os registros atuais (usuários extras, clientes, produtos, categorias, cupons, pedidos, caixa e lançamentos financeiros) serão substituídos pelo conjunto inicial de demonstração. Sua sessão ativa será preservada."
        confirmLabel="Restaurar agora"
        danger
        loading={saving}
        testId="reset-demo-confirm-modal"
        onConfirm={handleResetDemo}
        onCancel={() => setResetModalOpen(false)}
      />

      {/* Restore Backup Confirmation Modal */}
      {restoreModalOpen && restoreMetadata && (
        <div
          data-testid="backup-restore-modal"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60"
        >
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <HardDriveUpload className="w-5 h-5 text-amber-600" />
                <span>Confirmar Restauração de Backup</span>
              </h3>
              <button
                type="button"
                disabled={backupLoading}
                onClick={() => {
                  setRestoreModalOpen(false);
                  setRestorePendingPayload(null);
                  setRestoreMetadata(null);
                  setRestoreConfirmText('');
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs sm:text-sm">
              <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs space-y-1">
                <p className="font-bold">Atenção — Operação Destrutiva com Segurança</p>
                <p>
                  Os dados atuais da loja serão substituídos pelos registros deste backup. Antes de aplicar, o sistema gerará automaticamente um backup de segurança do estado atual.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                <p>
                  <strong>Data do backup:</strong> {formatDateTimeBR(restoreMetadata.generatedAt)}
                </p>
                <p>
                  <strong>Gerado por:</strong> {restoreMetadata.generatedBy}
                </p>
                <p>
                  <strong>Versão do esquema:</strong> {restoreMetadata.schemaVersion}
                </p>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-1.5 font-mono">
                  <span>Usuários: {restoreMetadata.counts?.users ?? 0}</span>
                  <span>Produtos: {restoreMetadata.counts?.products ?? 0}</span>
                  <span>Categorias: {restoreMetadata.counts?.categories ?? 0}</span>
                  <span>Cupons: {restoreMetadata.counts?.coupons ?? 0}</span>
                  <span>Pedidos: {restoreMetadata.counts?.orders ?? 0}</span>
                  <span>Financeiro: {restoreMetadata.counts?.financial_entries ?? 0}</span>
                </div>
              </div>

              <div>
                <label htmlFor="backup-confirm-input" className="block text-xs font-semibold mb-1.5">
                  Digite <span className="font-mono text-red-600 dark:text-red-400">RESTAURAR</span> para confirmar:
                </label>
                <input
                  id="backup-confirm-input"
                  type="text"
                  value={restoreConfirmText}
                  onChange={(e) => setRestoreConfirmText(e.target.value)}
                  data-testid="backup-confirm-input"
                  placeholder="RESTAURAR"
                  className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono uppercase"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-900">
              <button
                type="button"
                disabled={backupLoading}
                onClick={() => {
                  setRestoreModalOpen(false);
                  setRestorePendingPayload(null);
                  setRestoreMetadata(null);
                  setRestoreConfirmText('');
                }}
                className="min-h-[42px] px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={restoreConfirmText.trim() !== 'RESTAURAR' || backupLoading}
                onClick={handleConfirmRestoreBackup}
                data-testid="backup-confirm-button"
                className="min-h-[42px] px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-semibold inline-flex items-center gap-2"
              >
                {backupLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{backupLoading ? 'Restaurando...' : 'Confirmar Restauração'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
