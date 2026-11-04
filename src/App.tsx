import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  ChefHat,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Table2,
  Utensils,
  Users,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { parsePriceToCents } from "./lib/money";
import { requireSupabaseAuth, restoreAppSession, sessionFromUser, signOutSupabaseSession, type AppSession } from "./lib/auth";
import { withoutLegacyUsers } from "./lib/legacy-storage";
import { mapMembershipRestaurants } from "./lib/restaurant-memberships";
import { isScopedStorageOwnerReady, readScopedStorage, writeScopedStorage } from "./lib/scoped-storage";
import { awaitForSession } from "./lib/session-fence";

type NavItem = { label: string; icon: typeof LayoutDashboard };
type AuthMode = "signin" | "signup";
type Session = AppSession;

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "waiter" | "kitchen";
  createdAt: string;
};

type Employee = {
  id: string;
  restaurantId: string;
  name: string;
  role: "owner" | "admin" | "waiter" | "kitchen";
  email: string;
};

type Category = {
  id: string;
  restaurantId: string;
  name: string;
  sort_order: number;
};

type Product = {
  id: string;
  restaurantId: string;
  categoryId: string | null;
  name: string;
  description: string;
  priceCents: number;
  status: "active" | "inactive" | "unavailable";
};

type DiningTable = {
  id: string;
  restaurantId: string;
  name: string;
  capacity: number;
  active: boolean;
};

type OrderItem = {
  id: string;
  productId: string;
  productName: string;
  priceCents: number;
  quantity: number;
};

type Order = {
  id: string;
  restaurantId: string;
  tableId: string | null;
  customerName: string;
  status: "pending" | "preparing" | "ready" | "delivered" | "cancelled";
  items: OrderItem[];
  createdAt: string;
};

type AppData = {
  restaurants: Restaurant[];
  employees: Employee[];
  categories: Category[];
  products: Product[];
  tables: DiningTable[];
  orders: Order[];
};

const LEGACY_STORAGE_KEY = "mesaflow-demo-v1";
const SESSION_KEY = "mesaflow-session-v1";

const navigation: NavItem[] = [
  { label: "Visão geral", icon: LayoutDashboard },
  { label: "Pedidos", icon: ClipboardList },
  { label: "Cardápio", icon: Utensils },
  { label: "Mesas e comandas", icon: Table2 },
  { label: "Funcionários", icon: Users },
  { label: "Cozinha", icon: ChefHat },
  { label: "Configurações", icon: Settings },
];

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "restaurante";
}

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `id-${Math.random().toString(36).slice(2, 11)}`;
}

function createDefaultAppData(): AppData {
  return {
    restaurants: [],
    employees: [],
    categories: [],
    products: [],
    tables: [],
    orders: [],
  };
}

function readAppData(userId: string | null): AppData {
  if (typeof window === "undefined") {
    return createDefaultAppData();
  }

  try {
    let source = readScopedStorage<Partial<AppData> & { users?: unknown } | null>(
      window.localStorage,
      userId,
      null,
    );

    if (!source && userId === null) {
      const legacyValue = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyValue) {
        source = withoutLegacyUsers(JSON.parse(legacyValue) as Partial<AppData> & { users?: unknown });
        window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(source));
      }
    }

    const parsed = withoutLegacyUsers(source ?? {});
    return {
      ...createDefaultAppData(),
      ...parsed,
      restaurants: parsed.restaurants ?? [],
      employees: parsed.employees ?? [],
      categories: parsed.categories ?? [],
      products: parsed.products ?? [],
      tables: parsed.tables ?? [],
      orders: parsed.orders ?? [],
    };
  } catch {
    return createDefaultAppData();
  }
}

export default function App() {
  const [active, setActive] = useState("Visão geral");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [userName, setUserName] = useState("Cliente");
  const [session, setSession] = useState<Session | null>(null);
  const sessionUserIdRef = useRef<string | null>(null);
  const [appDataReady, setAppDataReady] = useState(true);
  const updateSession = (nextSession: Session | null) => {
    const nextUserId = nextSession?.userId ?? null;
    if (sessionUserIdRef.current !== nextUserId) setAppDataReady(false);
    sessionUserIdRef.current = nextUserId;
    setSession(nextSession);
  };
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);
  const [restaurantLoadError, setRestaurantLoadError] = useState<string | null>(null);
  const [restaurantLoadAttempt, setRestaurantLoadAttempt] = useState(0);
  const [appData, setAppData] = useState<AppData>(() => readAppData(null));
  const [appDataOwnerId, setAppDataOwnerId] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [restaurantForm, setRestaurantForm] = useState({ name: "", slug: "" });
  const [authForm, setAuthForm] = useState({ fullName: "", email: "", password: "" });
  const [categoryForm, setCategoryForm] = useState({ name: "", sortOrder: "0" });
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    priceCents: "",
    categoryId: "",
    status: "active",
  });
  const [employeeForm, setEmployeeForm] = useState({
    name: "",
    email: "",
    role: "waiter",
  });
  const [tableForm, setTableForm] = useState({ name: "", capacity: "2" });
  const [orderForm, setOrderForm] = useState({
    tableId: "",
    customerName: "",
    productId: "",
    quantity: "1",
  });
  const [orderDraft, setOrderDraft] = useState<OrderItem[]>([]);

  const restaurantCategories = useMemo(
    () => appData.categories.filter((category) => category.restaurantId === restaurant?.id),
    [appData.categories, restaurant],
  );

  const restaurantProducts = useMemo(
    () => appData.products.filter((product) => product.restaurantId === restaurant?.id),
    [appData.products, restaurant],
  );

  const restaurantEmployees = useMemo(
    () => appData.employees.filter((employee) => employee.restaurantId === restaurant?.id),
    [appData.employees, restaurant],
  );

  const restaurantTables = useMemo(
    () => appData.tables.filter((table) => table.restaurantId === restaurant?.id),
    [appData.tables, restaurant],
  );

  const restaurantOrders = useMemo(
    () => appData.orders.filter((order) => order.restaurantId === restaurant?.id),
    [appData.orders, restaurant],
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value / 100);

  const dashboard = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const todaysOrders = restaurantOrders.filter((order) => {
      const createdAt = new Date(order.createdAt);
      return createdAt >= todayStart;
    });

    const totalOrders = todaysOrders.length;
    const pending = todaysOrders.filter((order) => order.status === "pending").length;
    const preparing = todaysOrders.filter((order) => order.status === "preparing").length;
    const ready = todaysOrders.filter((order) => order.status === "ready").length;
    const completed = todaysOrders.filter((order) => order.status === "delivered").length;
    const revenue = todaysOrders.reduce(
      (sum, order) =>
        sum +
        order.items.reduce((itemTotal, item) => itemTotal + item.priceCents * item.quantity, 0),
      0,
    );

    const occupiedTables = restaurantTables.filter((table) => table.active).length;
    const availableTables = Math.max(restaurantTables.length - occupiedTables, 0);
    const averageTicket = totalOrders > 0 ? Math.round(revenue / totalOrders) : 0;

    return {
      totalOrders,
      pending,
      preparing,
      ready,
      completed,
      occupiedTables,
      availableTables,
      revenue,
      averageTicket,
    };
  }, [restaurantOrders, restaurantTables]);

  const statsCards = [
    {
      label: "Pedidos hoje",
      value: String(dashboard.totalOrders),
      note: dashboard.totalOrders === 0 ? "Nenhum pedido registrado" : "Pedidos recebidos hoje",
      icon: ClipboardList,
    },
    {
      label: "Em preparo",
      value: String(dashboard.preparing),
      note: dashboard.preparing === 0 ? "Aguardando movimentação" : "Pedidos em produção",
      icon: Clock3,
    },
    {
      label: "Mesas ocupadas",
      value: String(dashboard.occupiedTables),
      note: dashboard.occupiedTables === 0 ? "Nenhuma mesa ocupada" : "Mesas em uso",
      icon: Table2,
    },
    {
      label: "Vendas hoje",
      value: formatCurrency(dashboard.revenue),
      note: dashboard.revenue === 0 ? "Sem vendas registradas" : `Ticket médio: ${formatCurrency(dashboard.averageTicket)}`,
      icon: CircleDollarSign,
    },
  ];

  useEffect(() => {
    const ownerId = session?.userId ?? null;
    if (appDataOwnerId === ownerId) {
      if (!appDataReady) setAppDataReady(true);
      return;
    }

    setAppData(readAppData(ownerId));
    setAppDataOwnerId(ownerId);
    setAppDataReady(true);
  }, [session?.userId, appDataOwnerId, appDataReady]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const ownerId = session?.userId ?? null;
    if (!isScopedStorageOwnerReady(appDataReady, appDataOwnerId, ownerId)) return;
    writeScopedStorage(window.localStorage, ownerId, appData);
  }, [appData, appDataOwnerId, appDataReady, session?.userId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SESSION_KEY);
    }

    const authClient = supabase;
    if (!authClient) {
      updateSession(null);
      return;
    }

    let active = true;
    void restoreAppSession(
      () => authClient.auth.getSession(),
      () => {
        if (active) setError("Não foi possível restaurar a sessão do Supabase.");
      },
    ).then((restoredSession) => {
      if (active) updateSession(restoredSession);
    });

    const { data: { subscription } } = authClient.auth.onAuthStateChange((_event, authSession) => {
      if (active) updateSession(sessionFromUser(authSession?.user ?? null));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setRestaurant(null);
      setUserName("Cliente");
      setLoadingRestaurants(false);
      setRestaurantLoadError(null);
      return;
    }

    setRestaurant(null);
    setUserName(session.fullName || "Cliente");
    setError(null);
    setRestaurantLoadError(null);
    const authClient = supabase;
    if (!authClient) {
      setLoadingRestaurants(false);
      return;
    }

    let active = true;
    setLoadingRestaurants(true);
    const loadMemberships = async () => {
      const { data, error: membershipsError } = await authClient
        .from("memberships")
        .select("restaurant_id, role, created_at, restaurants!inner(id, name, slug, created_at)")
        .eq("user_id", session.userId)
        .eq("active", true);

      if (membershipsError) throw membershipsError;
      const memberships = mapMembershipRestaurants(data ?? []);
      if (!active) return;

      setAppData((current) => ({ ...current, restaurants: memberships }));
      setRestaurant(memberships[0] ?? null);
      setLoadingRestaurants(false);
      setRestaurantLoadError(null);
    };

    void loadMemberships().catch((membershipsError: any) => {
      if (!active) return;
      const message = membershipsError?.message ?? "Não foi possível carregar seus restaurantes.";
      setRestaurantLoadError(message);
      setLoadingRestaurants(false);
    });

    return () => {
      active = false;
    };
  }, [session?.userId, session?.fullName, restaurantLoadAttempt]);

  useEffect(() => {
    if (!restaurant) {
      setOrderDraft([]);
      setOrderForm((current) => ({ ...current, tableId: "", customerName: "" }));
    }
  }, [restaurant]);

  const handleAuthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const auth = requireSupabaseAuth(supabase);
      if (authMode === "signup") {
        const { data, error: signUpError } = await auth.auth.signUp({
          email: authForm.email,
          password: authForm.password,
          options: { data: { full_name: authForm.fullName } },
        });

        if (signUpError) throw signUpError;

        if (data.user && !data.session) {
          setNotice("Conta criada. Confirme o e-mail para entrar.");
          setAuthMode("signin");
        } else {
          updateSession(sessionFromUser(data.user));
          setNotice("Conta criada com sucesso.");
        }
      } else {
        const { data, error: signInError } = await auth.auth.signInWithPassword({
          email: authForm.email,
          password: authForm.password,
        });

        if (signInError) throw signInError;

        updateSession(sessionFromUser(data.user));
        setNotice("Login realizado com sucesso.");
      }
    } catch (submitError: any) {
      setError(submitError?.message ?? "Não foi possível completar a operação.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRestaurant = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!session) {
      setError("Faça login antes de criar um restaurante.");
      return;
    }

    const requestUserId = session.userId;
    const baseName = restaurantForm.name.trim();
    const generatedSlug = slugify(restaurantForm.slug || baseName);

    if (!baseName) {
      setError("Informe o nome do restaurante.");
      return;
    }

    setLoading(true);

    try {
      const authClient = requireSupabaseAuth(supabase);
      const { isCurrent, value: { data: restaurantId, error: rpcError } } = await awaitForSession(
        requestUserId,
        () => sessionUserIdRef.current,
        () => authClient.rpc("create_restaurant_owner", {
          p_name: baseName,
          p_slug: generatedSlug,
          p_full_name: session.fullName,
        }),
      );

      if (!isCurrent) return;

      if (rpcError) throw rpcError;
      if (!restaurantId) throw new Error("O banco não retornou o restaurante criado.");

      const newRestaurant: Restaurant = {
        id: restaurantId,
        name: baseName,
        slug: generatedSlug,
        role: "owner",
        createdAt: new Date().toISOString(),
      };

      setAppData((current) => ({
        ...current,
        restaurants: [newRestaurant, ...current.restaurants.filter((item) => item.id !== restaurantId)],
      }));
      setRestaurant(newRestaurant);

      setRestaurantForm({ name: "", slug: "" });
      setNotice("Restaurante criado com sucesso.");
      setActive("Visão geral");
    } catch (restaurantError: any) {
      if (sessionUserIdRef.current !== requestUserId) return;
      setError(restaurantError?.message ?? "Não foi possível criar o restaurante.");
    } finally {
      if (sessionUserIdRef.current === requestUserId) setLoading(false);
    }
  };

  const handleCreateCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!restaurant) {
      setError("Crie ou selecione um restaurante antes de cadastrar categorias.");
      return;
    }

    const categoryName = categoryForm.name.trim();
    if (!categoryName) {
      setError("Informe o nome da categoria.");
      return;
    }

    setLoading(true);

    try {
      const newCategory: Category = {
        id: makeId(),
        restaurantId: restaurant.id,
        name: categoryName,
        sort_order: Number(categoryForm.sortOrder || 0),
      };

      setAppData((current) => ({
        ...current,
        categories: [newCategory, ...current.categories],
      }));

      setCategoryForm({ name: "", sortOrder: "0" });
      setNotice("Categoria cadastrada com sucesso.");
    } catch (categoryError: any) {
      setError(categoryError?.message ?? "Não foi possível criar a categoria.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!restaurant) {
      setError("Crie ou selecione um restaurante antes de cadastrar produtos.");
      return;
    }

    const productName = productForm.name.trim();
    const priceCents = parsePriceToCents(productForm.priceCents);

    if (!productName) {
      setError("Informe o nome do produto.");
      return;
    }

    if (priceCents === null) {
      setError("Informe um preço válido maior que zero, com até duas casas decimais.");
      return;
    }

    setLoading(true);

    try {
      const newProduct: Product = {
        id: makeId(),
        restaurantId: restaurant.id,
        categoryId: productForm.categoryId || null,
        name: productName,
        description: productForm.description.trim(),
        priceCents,
        status: productForm.status as Product["status"],
      };

      setAppData((current) => ({
        ...current,
        products: [newProduct, ...current.products],
      }));

      setProductForm({
        name: "",
        description: "",
        priceCents: "",
        categoryId: restaurantCategories[0]?.id ?? "",
        status: "active",
      });
      setNotice("Produto cadastrado com sucesso.");
    } catch (productError: any) {
      setError(productError?.message ?? "Não foi possível cadastrar o produto.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmployee = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!restaurant) {
      setError("Crie ou selecione um restaurante antes de cadastrar funcionários.");
      return;
    }

    const employeeName = employeeForm.name.trim();
    if (!employeeName || !employeeForm.email.trim()) {
      setError("Informe nome e e-mail do funcionário.");
      return;
    }

    setLoading(true);

    try {
      const newEmployee: Employee = {
        id: makeId(),
        restaurantId: restaurant.id,
        name: employeeName,
        email: employeeForm.email.trim(),
        role: employeeForm.role as Employee["role"],
      };

      setAppData((current) => ({
        ...current,
        employees: [newEmployee, ...current.employees],
      }));

      setEmployeeForm({ name: "", email: "", role: "waiter" });
      setNotice("Funcionário cadastrado com sucesso.");
    } catch (employeeError: any) {
      setError(employeeError?.message ?? "Não foi possível cadastrar o funcionário.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTable = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!restaurant) {
      setError("Crie ou selecione um restaurante antes de cadastrar mesas.");
      return;
    }

    const tableName = tableForm.name.trim();
    const capacity = Number(tableForm.capacity || 2);

    if (!tableName) {
      setError("Informe o nome da mesa.");
      return;
    }

    setLoading(true);

    try {
      const newTable: DiningTable = {
        id: makeId(),
        restaurantId: restaurant.id,
        name: tableName,
        capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : 2,
        active: true,
      };

      setAppData((current) => ({
        ...current,
        tables: [newTable, ...current.tables],
      }));

      setTableForm({ name: "", capacity: "2" });
      setNotice("Mesa cadastrada com sucesso.");
    } catch (tableError: any) {
      setError(tableError?.message ?? "Não foi possível cadastrar a mesa.");
    } finally {
      setLoading(false);
    }
  };

  const addDraftItem = () => {
    const product = restaurantProducts.find((item) => item.id === orderForm.productId);
    if (!product) {
      setError("Selecione um produto para adicionar ao pedido.");
      return;
    }

    const quantity = Number(orderForm.quantity || 1);
    const nextItem: OrderItem = {
      id: makeId(),
      productId: product.id,
      productName: product.name,
      priceCents: product.priceCents,
      quantity: quantity > 0 ? quantity : 1,
    };

    setOrderDraft((current) => [...current, nextItem]);
    setOrderForm((current) => ({ ...current, productId: "", quantity: "1" }));
    setNotice("Produto adicionado ao pedido.");
  };

  const handleCreateOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!restaurant) {
      setError("Crie ou selecione um restaurante antes de registrar pedidos.");
      return;
    }

    if (orderDraft.length === 0) {
      setError("Adicione pelo menos um produto ao pedido.");
      return;
    }

    setLoading(true);

    try {
      const newOrder: Order = {
        id: makeId(),
        restaurantId: restaurant.id,
        tableId: orderForm.tableId || null,
        customerName: orderForm.customerName.trim() || "Cliente",
        status: "pending",
        items: orderDraft,
        createdAt: new Date().toISOString(),
      };

      setAppData((current) => ({
        ...current,
        orders: [newOrder, ...current.orders],
      }));

      setOrderForm((current) => ({ ...current, tableId: "", customerName: "", productId: "", quantity: "1" }));
      setOrderDraft([]);
      setActive("Pedidos");
      setNotice("Pedido registrado com sucesso e enviado para a cozinha.");
    } catch (orderError: any) {
      setError(orderError?.message ?? "Não foi possível registrar o pedido.");
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = (orderId: string, nextStatus: Order["status"]) => {
    setAppData((current) => ({
      ...current,
      orders: current.orders.map((order) =>
        order.id === orderId ? { ...order, status: nextStatus } : order,
      ),
    }));
  };

  const handleSignOut = async () => {
    try {
      const authClient = supabase;
      if (isSupabaseConfigured && authClient) {
        await signOutSupabaseSession(() => authClient.auth.signOut());
      }
    } catch (signOutError: any) {
      setError(signOutError?.message ?? "Não foi possível encerrar a sessão.");
      return;
    }

    updateSession(null);
    setRestaurant(null);
    setLoading(false);
    setNotice("Sessão encerrada.");
  };

  const dashboardTitle = restaurant ? restaurant.name : "Configuração inicial";

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Utensils size={21} /></div>
          <div><strong>MesaFlow</strong><span>GESTÃO DE RESTAURANTES</span></div>
        </div>

        <div className="workspace">
          <div className="workspace-avatar">{restaurant ? restaurant.name[0].toUpperCase() : "M"}</div>
          <div className="workspace-copy">
            <strong>{restaurant ? restaurant.name : "MesaFlow"}</strong>
            <span>{restaurant ? `@${restaurant.slug}` : "Ambiente de administração"}</span>
          </div>
          <ChevronDown size={16} />
        </div>

        <div className="nav-label">MENU PRINCIPAL</div>
        <nav>
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${active === label ? "active" : ""}`}
              onClick={() => {
                setActive(label);
                setSidebarOpen(false);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><ChefHat size={18} /></div>
            <strong>{restaurant ? "Operação ativa" : "Vamos começar?"}</strong>
            <p>
              {restaurant
                ? "Seu restaurante já está conectado ao painel MesaFlow."
                : "Cadastre seu restaurante e configure a primeira conta administrativa."}
            </p>
          </div>

          <div className="profile">
            <div className="profile-avatar">{userName?.slice(0, 2).toUpperCase() || "AD"}</div>
            <div>
              <strong>{userName}</strong>
              <span>{restaurant ? `${restaurant.role}` : "Perfil da plataforma"}</span>
            </div>
            {session ? (
              <button className="icon-button" onClick={handleSignOut} aria-label="Sair">
                <LogOut size={17} />
              </button>
            ) : (
              <Settings size={17} />
            )}
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Abrir menu">
            <Menu />
          </button>

          <div className="breadcrumb">
            Restaurante <span>/</span> <strong>{active}</strong>
          </div>

          <div className="top-actions">
            <div className="status"><span /> {session ? "Sistema conectado" : "Sistema em desenvolvimento"}</div>
            <button className="icon-button" aria-label="Notificações"><Bell size={19} /></button>
            <div className="top-avatar">{userName?.slice(0, 2).toUpperCase() || "AD"}</div>
          </div>
        </header>

        <div className="page">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">PAINEL ADMINISTRATIVO</div>
              <h1>{active === "Visão geral" ? dashboardTitle : active}</h1>
              <p>
                {session
                  ? "Acompanhe a operação do restaurante em tempo real."
                  : "Entre no sistema para criar seu restaurante e começar a operação."}
              </p>
            </div>
            <button className="date-button"><Clock3 size={16} /> Hoje <ChevronDown size={15} /></button>
          </div>

          {!isSupabaseConfigured && (
            <div className="setup-notice">
              <div className="notice-icon">i</div>
              <div>
                <strong>Modo local ativo</strong>
                <p>O app está funcionando em modo local, sem conexão direta com Supabase. Os cadastros ficam salvos no navegador.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="setup-notice" style={{ background: "#fff0f0", borderColor: "#f8c8c8" }}>
              <div className="notice-icon" style={{ background: "#f7d5d5", color: "#8b2d2d" }}>!</div>
              <div>
                <strong>Erro</strong>
                <p>{error}</p>
              </div>
            </div>
          )}

          {notice && (
            <div className="setup-notice" style={{ background: "#effaf3", borderColor: "#cfead8" }}>
              <div className="notice-icon" style={{ background: "#d7f0df", color: "#276b49" }}>✓</div>
              <div>
                <strong>Sucesso</strong>
                <p>{notice}</p>
              </div>
            </div>
          )}

          {!session ? (
            <section className="content-grid" style={{ marginTop: 20 }}>
              <article className="panel" style={{ padding: 24 }}>
                <div className="panel-heading" style={{ marginBottom: 18 }}>
                  <div>
                    <h2>{authMode === "signin" ? "Entrar no MesaFlow" : "Criar conta"}</h2>
                    <p>{authMode === "signin" ? "Acesso ao painel administrativo" : "Primeira etapa para abrir o restaurante"}</p>
                  </div>
                  <button type="button" className="text-button" onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}>
                    {authMode === "signin" ? "Criar conta" : "Já tenho conta"}
                  </button>
                </div>

                <form onSubmit={handleAuthSubmit} className="stacked-form">
                  {authMode === "signup" && (
                    <label>
                      <span>Nome completo</span>
                      <input
                        value={authForm.fullName}
                        onChange={(event) => setAuthForm((current) => ({ ...current, fullName: event.target.value }))}
                        placeholder="Seu nome"
                      />
                    </label>
                  )}

                  <label>
                    <span>E-mail</span>
                    <input
                      type="email"
                      value={authForm.email}
                      onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
                      placeholder="admin@empresa.com"
                    />
                  </label>

                  <label>
                    <span>Senha</span>
                    <input
                      type="password"
                      value={authForm.password}
                      onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                      placeholder="••••••••"
                    />
                  </label>

                  <button className="primary-button" type="submit" disabled={loading}>
                    {loading ? "Processando..." : authMode === "signin" ? "Entrar" : "Criar conta"}
                  </button>
                </form>
              </article>

              <article className="panel" style={{ padding: 24 }}>
                <div className="panel-heading" style={{ marginBottom: 18 }}>
                  <div>
                    <h2>Primeiros passos</h2>
                    <p>Configuração inicial do restaurante</p>
                  </div>
                </div>

                <ul className="feature-list">
                  <li>Crie sua conta de administrador</li>
                  <li>Cadastre o restaurante no sistema</li>
                  <li>Defina mesas, produtos e funcionários</li>
                  <li>Comece a receber pedidos em poucos minutos</li>
                </ul>
              </article>
            </section>
          ) : null}

          {session && loadingRestaurants && (
            <div className="setup-notice" role="status" style={{ marginTop: 20 }}>
              <span className="notice-icon">…</span>
              <div><strong>Carregando restaurantes</strong><p>Verificando suas associações de acesso.</p></div>
            </div>
          )}

          {session && restaurantLoadError && !loadingRestaurants && (
            <section className="panel" role="alert" style={{ marginTop: 20 }}>
              <div className="panel-heading">
                <div>
                  <h2>Não foi possível consultar seus restaurantes</h2>
                  <p>{restaurantLoadError}</p>
                </div>
              </div>
              <button
                type="button"
                className="secondary-button"
                style={{ marginTop: 16 }}
                onClick={() => setRestaurantLoadAttempt((attempt) => attempt + 1)}
              >
                Tentar novamente
              </button>
            </section>
          )}

          {session && !restaurant && !loadingRestaurants && !restaurantLoadError && (
            <section className="content-grid" style={{ marginTop: 20 }}>
              <article className="panel" style={{ padding: 24 }}>
                <div className="panel-heading" style={{ marginBottom: 18 }}>
                  <div>
                    <h2>Cadastrar restaurante</h2>
                    <p>Finalize a criação do primeiro estabelecimento</p>
                  </div>
                </div>

                <form onSubmit={handleCreateRestaurant} className="stacked-form">
                  <label>
                    <span>Nome do restaurante</span>
                    <input
                      value={restaurantForm.name}
                      onChange={(event) => setRestaurantForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Ex: Sabor da Casa"
                    />
                  </label>

                  <label>
                    <span>Slug</span>
                    <input
                      value={restaurantForm.slug}
                      onChange={(event) => setRestaurantForm((current) => ({ ...current, slug: event.target.value }))}
                      placeholder="sabor-da-casa"
                    />
                  </label>

                  <button className="primary-button" type="submit" disabled={loading}>
                    {loading ? "Criando..." : "Criar restaurante"}
                  </button>
                </form>
              </article>

              <article className="panel" style={{ padding: 24 }}>
                <div className="panel-heading" style={{ marginBottom: 18 }}>
                  <div>
                    <h2>Resumo do acesso</h2>
                    <p>Você está autenticado e pronto para começar</p>
                  </div>
                </div>

                <ul className="feature-list">
                  <li>Usuário autenticado: {session.email}</li>
                  <li>Perfil: proprietário ao concluir o cadastro</li>
                  <li>Próximo passo: criar o restaurante</li>
                </ul>
              </article>
            </section>
          )}

          {session && restaurant && (
            <>
              <section className="stats-grid" style={{ marginTop: 18 }}>
                {statsCards.map(({ label, value, note, icon: Icon }) => (
                  <article className="stat-card" key={label}>
                    <div className="stat-top"><span>{label}</span><div className="stat-icon"><Icon size={19} /></div></div>
                    <strong className="stat-value">{value}</strong>
                    <span className="stat-note">{note}</span>
                  </article>
                ))}
              </section>

              {active === "Visão geral" && (
                <section className="content-grid" style={{ marginTop: 18 }}>
                  <article className="panel" style={{ padding: 24 }}>
                    <div className="panel-heading">
                      <div>
                        <h2>{restaurant.name}</h2>
                        <p>Restaurante ativo e conectado</p>
                      </div>
                    </div>

                    <div className="detail-box">
                      <div>
                        <span>Slug</span>
                        <strong>@{restaurant.slug}</strong>
                      </div>
                      <div>
                        <span>Perfil</span>
                        <strong>{restaurant.role}</strong>
                      </div>
                      <div>
                        <span>Status</span>
                        <strong>Ativo</strong>
                      </div>
                    </div>
                  </article>

                  <article className="panel" style={{ padding: 24 }}>
                    <div className="panel-heading">
                      <div>
                        <h2>Próximos passos</h2>
                        <p>Continue a operação do restaurante</p>
                      </div>
                    </div>

                    <div className="quick-panel-list">
                      <button className="quick-link" onClick={() => setActive("Funcionários")}>
                        <span className="quick-icon"><Users size={18} /></span>
                        <span><strong>Cadastrar funcionários</strong><small>Gerencie equipe e acessos</small></span>
                        <ArrowUpRight size={16} />
                      </button>
                      <button className="quick-link" onClick={() => setActive("Cardápio")}>
                        <span className="quick-icon"><Utensils size={18} /></span>
                        <span><strong>Produtos e categorias</strong><small>Organize o cardápio</small></span>
                        <ArrowUpRight size={16} />
                      </button>
                      <button className="quick-link" onClick={() => setActive("Mesas e comandas")}>
                        <span className="quick-icon"><Table2 size={18} /></span>
                        <span><strong>Mesas e comandas</strong><small>Controle o salão</small></span>
                        <ArrowUpRight size={16} />
                      </button>
                    </div>
                  </article>
                </section>
              )}

              {active === "Cardápio" && (
                <section className="content-grid" style={{ marginTop: 18 }}>
                  <article className="panel" style={{ padding: 24 }}>
                    <div className="panel-heading" style={{ marginBottom: 18 }}>
                      <div>
                        <h2>Cadastrar categoria</h2>
                        <p>Organize o menu do restaurante</p>
                      </div>
                    </div>

                    <form onSubmit={handleCreateCategory} className="stacked-form">
                      <label>
                        <span>Nome da categoria</span>
                        <input
                          value={categoryForm.name}
                          onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
                          placeholder="Ex: Bebidas"
                        />
                      </label>

                      <label>
                        <span>Ordem de exibição</span>
                        <input
                          type="number"
                          value={categoryForm.sortOrder}
                          onChange={(event) => setCategoryForm((current) => ({ ...current, sortOrder: event.target.value }))}
                          placeholder="0"
                        />
                      </label>

                      <button className="primary-button" type="submit" disabled={loading}>
                        {loading ? "Salvando..." : "Salvar categoria"}
                      </button>
                    </form>
                  </article>

                  <article className="panel" style={{ padding: 24 }}>
                    <div className="panel-heading" style={{ marginBottom: 18 }}>
                      <div>
                        <h2>Produtos</h2>
                        <p>Itens do cardápio atual</p>
                      </div>
                    </div>

                    <form onSubmit={handleCreateProduct} className="stacked-form">
                      <label>
                        <span>Nome do produto</span>
                        <input
                          value={productForm.name}
                          onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))}
                          placeholder="Ex: X-Burger"
                        />
                      </label>

                      <label>
                        <span>Descrição</span>
                        <input
                          value={productForm.description}
                          onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))}
                          placeholder="Descrição do prato"
                        />
                      </label>

                      <label>
                        <span>Preço</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={productForm.priceCents}
                          onChange={(event) => setProductForm((current) => ({ ...current, priceCents: event.target.value }))}
                          placeholder="49.90"
                        />
                      </label>

                      <label>
                        <span>Categoria</span>
                        <select
                          value={productForm.categoryId}
                          onChange={(event) => setProductForm((current) => ({ ...current, categoryId: event.target.value }))}
                        >
                          <option value="">Sem categoria</option>
                          {restaurantCategories.map((category) => (
                            <option key={category.id} value={category.id}>{category.name}</option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span>Status</span>
                        <select
                          value={productForm.status}
                          onChange={(event) => setProductForm((current) => ({ ...current, status: event.target.value }))}
                        >
                          <option value="active">Ativo</option>
                          <option value="inactive">Inativo</option>
                          <option value="unavailable">Indisponível</option>
                        </select>
                      </label>

                      <button className="primary-button" type="submit" disabled={loading}>
                        {loading ? "Salvando..." : "Salvar produto"}
                      </button>
                    </form>
                  </article>
                </section>
              )}

              {active === "Funcionários" && (
                <section className="content-grid" style={{ marginTop: 18 }}>
                  <article className="panel" style={{ padding: 24 }}>
                    <div className="panel-heading" style={{ marginBottom: 18 }}>
                      <div>
                        <h2>Cadastrar funcionário</h2>
                        <p>Gerencie a equipe do restaurante</p>
                      </div>
                    </div>

                    <form onSubmit={handleCreateEmployee} className="stacked-form">
                      <label>
                        <span>Nome</span>
                        <input
                          value={employeeForm.name}
                          onChange={(event) => setEmployeeForm((current) => ({ ...current, name: event.target.value }))}
                          placeholder="Ex: João Silva"
                        />
                      </label>

                      <label>
                        <span>E-mail</span>
                        <input
                          type="email"
                          value={employeeForm.email}
                          onChange={(event) => setEmployeeForm((current) => ({ ...current, email: event.target.value }))}
                          placeholder="funcionario@empresa.com"
                        />
                      </label>

                      <label>
                        <span>Perfil</span>
                        <select
                          value={employeeForm.role}
                          onChange={(event) => setEmployeeForm((current) => ({ ...current, role: event.target.value }))}
                        >
                          <option value="waiter">Garçom</option>
                          <option value="kitchen">Cozinha</option>
                          <option value="admin">Administrador</option>
                          <option value="owner">Proprietário</option>
                        </select>
                      </label>

                      <button className="primary-button" type="submit" disabled={loading}>
                        {loading ? "Salvando..." : "Salvar funcionário"}
                      </button>
                    </form>
                  </article>

                  <article className="panel" style={{ padding: 24 }}>
                    <div className="panel-heading" style={{ marginBottom: 18 }}>
                      <div>
                        <h2>Equipe</h2>
                        <p>Pessoas ativas no restaurante</p>
                      </div>
                    </div>

                    <div className="list-stack">
                      {restaurantEmployees.length === 0 ? (
                        <div className="empty-inline"><span>Nenhum funcionário cadastrado.</span></div>
                      ) : (
                        restaurantEmployees.map((employee) => (
                          <div className="list-item" key={employee.id}>
                            <strong>{employee.name}</strong>
                            <span>{employee.role} · {employee.email}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </article>
                </section>
              )}

              {active === "Mesas e comandas" && (
                <section className="content-grid" style={{ marginTop: 18 }}>
                  <article className="panel" style={{ padding: 24 }}>
                    <div className="panel-heading" style={{ marginBottom: 18 }}>
                      <div>
                        <h2>Cadastrar mesa</h2>
                        <p>Controle as mesas do salão</p>
                      </div>
                    </div>

                    <form onSubmit={handleCreateTable} className="stacked-form">
                      <label>
                        <span>Nome da mesa</span>
                        <input
                          value={tableForm.name}
                          onChange={(event) => setTableForm((current) => ({ ...current, name: event.target.value }))}
                          placeholder="Mesa 01"
                        />
                      </label>

                      <label>
                        <span>Capacidade</span>
                        <input
                          type="number"
                          min="1"
                          value={tableForm.capacity}
                          onChange={(event) => setTableForm((current) => ({ ...current, capacity: event.target.value }))}
                          placeholder="2"
                        />
                      </label>

                      <button className="primary-button" type="submit" disabled={loading}>
                        {loading ? "Salvando..." : "Salvar mesa"}
                      </button>
                    </form>
                  </article>

                  <article className="panel" style={{ padding: 24 }}>
                    <div className="panel-heading" style={{ marginBottom: 18 }}>
                      <div>
                        <h2>Mesas</h2>
                        <p>Disponibilidade atual</p>
                      </div>
                    </div>

                    <div className="list-stack">
                      {restaurantTables.length === 0 ? (
                        <div className="empty-inline"><span>Nenhuma mesa cadastrada.</span></div>
                      ) : (
                        restaurantTables.map((table) => (
                          <div className="list-item" key={table.id}>
                            <strong>{table.name}</strong>
                            <span>{table.capacity} lugares · {table.active ? "Ativa" : "Inativa"}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </article>
                </section>
              )}

              {active === "Pedidos" && (
                <section className="content-grid" style={{ marginTop: 18 }}>
                  <article className="panel" style={{ padding: 24 }}>
                    <div className="panel-heading" style={{ marginBottom: 18 }}>
                      <div>
                        <h2>Novo pedido</h2>
                        <p>Registre um pedido do salão</p>
                      </div>
                    </div>

                    <form onSubmit={handleCreateOrder} className="stacked-form">
                      <label>
                        <span>Cliente</span>
                        <input
                          value={orderForm.customerName}
                          onChange={(event) => setOrderForm((current) => ({ ...current, customerName: event.target.value }))}
                          placeholder="Nome do cliente"
                        />
                      </label>

                      <label>
                        <span>Mesa</span>
                        <select
                          value={orderForm.tableId}
                          onChange={(event) => setOrderForm((current) => ({ ...current, tableId: event.target.value }))}
                        >
                          <option value="">Sem mesa</option>
                          {restaurantTables.map((table) => (
                            <option key={table.id} value={table.id}>{table.name}</option>
                          ))}
                        </select>
                      </label>

                      <div className="inline-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 10 }}>
                        <label>
                          <span>Produto</span>
                          <select
                            value={orderForm.productId}
                            onChange={(event) => setOrderForm((current) => ({ ...current, productId: event.target.value }))}
                          >
                            <option value="">Selecione</option>
                            {restaurantProducts.map((product) => (
                              <option key={product.id} value={product.id}>{product.name}</option>
                            ))}
                          </select>
                        </label>

                        <label>
                          <span>Qtd.</span>
                          <input
                            type="number"
                            min="1"
                            value={orderForm.quantity}
                            onChange={(event) => setOrderForm((current) => ({ ...current, quantity: event.target.value }))}
                          />
                        </label>
                      </div>

                      <button type="button" className="secondary-button" onClick={addDraftItem}>
                        Adicionar item
                      </button>

                      <div className="list-stack" style={{ marginTop: 8 }}>
                        {orderDraft.length === 0 ? (
                          <div className="empty-inline"><span>Nenhum item no pedido.</span></div>
                        ) : (
                          orderDraft.map((item) => (
                            <div className="list-item" key={item.id}>
                              <strong>{item.productName}</strong>
                              <span>{item.quantity}x · {formatCurrency(item.priceCents * item.quantity)}</span>
                            </div>
                          ))
                        )}
                      </div>

                      <button className="primary-button" type="submit" disabled={loading}>
                        {loading ? "Registrando..." : "Registrar pedido"}
                      </button>
                    </form>
                  </article>

                  <article className="panel" style={{ padding: 24 }}>
                    <div className="panel-heading" style={{ marginBottom: 18 }}>
                      <div>
                        <h2>Pedidos recentes</h2>
                        <p>Histórico do restaurante</p>
                      </div>
                    </div>

                    <div className="list-stack">
                      {restaurantOrders.length === 0 ? (
                        <div className="empty-inline"><span>Nenhum pedido registrado.</span></div>
                      ) : (
                        restaurantOrders.slice(0, 6).map((order) => (
                          <div className="list-item" key={order.id}>
                            <strong>{order.customerName}</strong>
                            <span>{order.status} · {order.items.reduce((sum, item) => sum + item.quantity, 0)} itens</span>
                          </div>
                        ))
                      )}
                    </div>
                  </article>
                </section>
              )}

              {active === "Cozinha" && (
                <section className="panel" style={{ marginTop: 18, padding: 24 }}>
                  <div className="panel-heading" style={{ marginBottom: 18 }}>
                    <div>
                      <h2>Central da cozinha</h2>
                      <p>Acompanhe pedidos em execução</p>
                    </div>
                  </div>

                  <div className="list-stack">
                    {restaurantOrders.length === 0 ? (
                      <div className="empty-inline"><span>Nenhum pedido em andamento.</span></div>
                    ) : (
                      restaurantOrders.map((order) => (
                        <div className="kitchen-card" key={order.id}>
                          <div className="kitchen-header">
                            <strong>{order.customerName}</strong>
                            <span className={`status-badge status-${order.status}`}>{order.status}</span>
                          </div>
                          <div className="kitchen-items">
                            {order.items.map((item) => (
                              <span key={item.id}>{item.productName} x{item.quantity}</span>
                            ))}
                          </div>
                          <div className="kitchen-actions">
                            <button onClick={() => updateOrderStatus(order.id, "preparing")}>Preparando</button>
                            <button onClick={() => updateOrderStatus(order.id, "ready")}>Pronto</button>
                            <button onClick={() => updateOrderStatus(order.id, "delivered")}>Entregue</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}

              {active === "Configurações" && (
                <section className="panel" style={{ marginTop: 18, padding: 24 }}>
                  <div className="panel-heading" style={{ marginBottom: 18 }}>
                    <div>
                      <h2>Configurações do restaurante</h2>
                      <p>Dados de operação e manutenção</p>
                    </div>
                  </div>

                  <div className="detail-box">
                    <div>
                      <span>Nome</span>
                      <strong>{restaurant.name}</strong>
                    </div>
                    <div>
                      <span>Slug</span>
                      <strong>@{restaurant.slug}</strong>
                    </div>
                    <div>
                      <span>Usuário</span>
                      <strong>{session.fullName}</strong>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          <footer>© 2026 MesaFlow · Plataforma de gestão para restaurantes</footer>
        </div>
      </main>
    </div>
  );
}