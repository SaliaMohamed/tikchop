import { useMemo, useState, type ReactNode } from "react";
import { Link, Route, Router, Switch, useLocation } from "wouter";
import {
  ArrowDownRight,
  ArrowRight,
  BarChart3,
  Bell,
  Box,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Grid2X2,
  Headphones,
  Home,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Trash2,
  Truck,
  Upload,
  UserRound,
  UsersRound,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { Toaster, toast } from "sonner";

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  image: string;
  tag?: string;
};

type Order = {
  id: string;
  customer: string;
  phone: string;
  item: string;
  amount: number;
  status: "Nouveau" | "Confirmée" | "En livraison" | "Livrée";
  time: string;
  location: string;
};

type NavItem = readonly [string, string, typeof LayoutDashboard];

const productsSeed: Product[] = [
  { id: 1, name: "Pagne wax premium", category: "Tissus", price: 15000, stock: 18, image: "/landing/fabric-display.jpg", tag: "Top vente" },
  { id: 2, name: "Tissus boutique", category: "Tissus", price: 12000, stock: 9, image: "/landing/wax-shop.jpg", tag: "Adjamé" },
  { id: 3, name: "Sacs raphia", category: "Accessoires", price: 10000, stock: 23, image: "/landing/raffia-bags.jpg", tag: "Nouveau" },
  { id: 4, name: "Sac africain", category: "Accessoires", price: 18000, stock: 5, image: "/landing/african-handbag.jpg", tag: "Cocody" },
  { id: 5, name: "Beurre de karité", category: "Beauté", price: 4500, stock: 31, image: "/landing/shea-butter.jpg", tag: "Beauté" },
];

const ordersSeed: Order[] = [
  { id: "TK-2048", customer: "Aminata Koné", phone: "07 08 21 44 90", item: "Pagne wax premium · x2", amount: 31000, status: "Nouveau", time: "Il y a 8 min", location: "Cocody" },
  { id: "TK-2047", customer: "Mariam Yao", phone: "05 65 14 09 12", item: "Sac africain", amount: 19000, status: "Confirmée", time: "Il y a 36 min", location: "Marcory" },
  { id: "TK-2046", customer: "Fatou Traoré", phone: "01 72 54 18 03", item: "Sacs raphia", amount: 11500, status: "En livraison", time: "Hier, 16:40", location: "Yopougon" },
  { id: "TK-2045", customer: "Nadia Bamba", phone: "07 89 33 02 11", item: "Beurre de karité · x3", amount: 14500, status: "Livrée", time: "Hier, 14:12", location: "Koumassi" },
];

const money = (value: number) => `${value.toLocaleString("fr-FR")} F`;

function Logo({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className={`brand ${compact ? "brand-compact" : ""}`}><span className="brand-mark"><Sparkles size={16} /></span><span>Tikchop</span></Link>;
}

function IconButton({ label, children, onClick }: { label: string; children: ReactNode; onClick?: () => void }) {
  return <button className="icon-button" aria-label={label} onClick={onClick}>{children}</button>;
}

function App() {
  return (
    <Router base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/account/update-password" component={UpdatePassword} />
        <Route path="/payment/callback" component={PaymentCallback} />
        <Route path="/receipt" component={Receipt} />
        <Route path="/dashboard" component={SellerApp} />
        <Route path="/orders" component={SellerApp} />
        <Route path="/products" component={SellerApp} />
        <Route path="/crm" component={SellerApp} />
        <Route path="/whatsapp" component={SellerApp} />
        <Route path="/delivery-settings" component={SellerApp} />
        <Route path="/add-product" component={SellerApp} />
        <Route path="/:slug" component={Storefront} />
      </Switch>
      <Toaster position="top-right" richColors />
    </Router>
  );
}

function Landing() {
  const features = [
    ["01", "Réponses WhatsApp rapides", "Prix, stock, livraison et paiement partent sans laisser un client attendre.", MessageCircle],
    ["02", "Commandes bien rangées", "Chaque conversation devient une commande claire, prête à préparer.", ClipboardList],
    ["03", "Livraison locale simple", "Cocody, Marcory, Yopougon ou Abobo : vos zones restent toujours sous contrôle.", Truck],
  ] as const;
  return <div className="landing">
    <header className="landing-nav page-width">
      <Logo />
      <nav className="landing-links"><a href="#solution">La solution</a><a href="#how">Comment ça marche</a><a href="#proof">Pour les vendeurs</a></nav>
      <div className="landing-actions"><Link href="/onboarding" className="link-button">Se connecter</Link><Link href="/onboarding" className="button button-dark">Lancer l’essai <ArrowRight size={16} /></Link></div>
      <IconButton label="Ouvrir le menu"><Menu size={20} /></IconButton>
    </header>
    <main>
      <section className="hero page-width">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> Commerce WhatsApp pour boutiques d’Abidjan</div>
          <h1>Vendez mieux.<br /><em>Répondez vite.</em></h1>
          <p className="hero-lead">Tikchop transforme vos messages clients en commandes propres, avec le paiement local, la livraison et le suivi vendeur au même endroit.</p>
          <div className="hero-cta"><Link href="/onboarding" className="button button-primary button-large">Créer ma boutique gratuitement <ArrowRight size={18} /></Link><a className="text-link" href="#how">Découvrir Tikchop <ChevronRight size={16} /></a></div>
          <div className="hero-note"><span className="avatar-stack"><span>AK</span><span>MY</span><span>FT</span></span><strong>+120 vendeurs</strong> font déjà confiance à Tikchop</div>
        </div>
        <div className="hero-visual">
          <div className="hero-glow" />
          <div className="phone-shell"><div className="phone-notch" /><div className="phone-screen"><div className="phone-top"><span>09:41</span><span>•••</span></div><div className="phone-brand"><span className="brand-mark small"><Sparkles size={11} /></span><b>Tikchop</b><span className="online-dot" /></div><div className="chat-title"><div className="person-avatar">A</div><div><b>Awa Boutique</b><small>en ligne maintenant</small></div><MoreHorizontal size={18} /></div><div className="chat-bubbles"><span className="bubble bubble-in">Bonjour, le pagne est encore disponible ?</span><span className="bubble bubble-out">Bonjour Awa ! Oui, il reste 18 pièces. Je vous le réserve ?</span><span className="bubble bubble-in">Oui, pour Cocody Riviera.</span><div className="order-mini"><div className="mini-product"><img src="/landing/fabric-display.jpg" /><div><b>Pagne wax premium</b><small>2 × 15 000 F</small></div></div><div className="mini-total"><span>Total</span><strong>31 000 F</strong></div><button>Confirmer la commande</button></div></div><div className="chat-input">Écrire un message <Send size={15} /></div></div></div>
          <div className="float-card float-card-top"><span className="float-icon orange"><WalletCards size={16} /></span><div><small>Ventes du jour</small><b>+ 184 500 F</b></div><ArrowDownRight size={15} className="trend" /></div>
          <div className="float-card float-card-bottom"><span className="float-icon green"><Check size={16} /></span><div><small>Commande confirmée</small><b>#TK-2048 · 31 000 F</b></div></div>
        </div>
      </section>
      <section className="proof-strip page-width" id="proof"><div><strong>7 jours</strong><span>essai offert</span></div><div><strong>11 000 F</strong><span>offre 1 boutique</span></div><div><strong>instantanée</strong><span>réponse client</span></div><div className="proof-local"><MapPin size={17} /><span>Pensé pour le commerce local</span></div></section>
      <section className="feature-section page-width" id="solution"><div className="section-kicker">LA SOLUTION TIKCHOP</div><h2>Tout ce qu’il faut pour<br /><span>ne plus perdre une vente.</span></h2><p className="section-intro">Votre boutique reste petite. Votre façon de la gérer peut devenir beaucoup plus grande.</p><div className="feature-grid">{features.map(([number, title, text, Icon]) => <article className="feature-card" key={title}><span className="feature-number">{number}</span><div className="feature-icon"><Icon size={22} /></div><h3>{title}</h3><p>{text}</p><a href="#how">En savoir plus <ArrowRight size={14} /></a></article>)}</div></section>
      <section className="how-section" id="how"><div className="page-width how-inner"><div className="how-copy"><div className="section-kicker">EN QUELQUES MINUTES</div><h2>Votre boutique,<br /><span>en mouvement.</span></h2><p>Pas besoin d’être expert. Tikchop vous accompagne de votre premier produit à votre première livraison.</p><Link href="/onboarding" className="button button-dark">Commencer maintenant <ArrowRight size={16} /></Link></div><div className="steps"><div className="step active"><span>01</span><div><b>Créez votre boutique</b><p>Ajoutez votre nom, vos produits et vos zones de livraison.</p></div><CheckCircle2 size={22} /></div><div className="step"><span>02</span><div><b>Connectez WhatsApp</b><p>Répondez à vos clients depuis un espace pensé pour vous.</p></div><CheckCircle2 size={22} /></div><div className="step"><span>03</span><div><b>Suivez vos ventes</b><p>Du message reçu à la commande livrée, sans rien oublier.</p></div><CheckCircle2 size={22} /></div></div></div></section>
      <section className="local-section page-width"><div className="local-card"><div className="local-copy"><div className="section-kicker">FAIT POUR ABIDJAN</div><h2>Votre réalité<br />est notre point de départ.</h2><p>Pagne, beauté, accessoires ou nourriture : Tikchop comprend le rythme, les habitudes et les moyens de paiement de vos clients.</p><div className="signal-list">{["Wave, Orange Money, MTN Money", "Paiement à la livraison", "Catalogue avec vraies photos", "Relance des clients hésitants"].map((item) => <span key={item}><Check size={14} />{item}</span>)}</div></div><div className="local-image"><img src="/landing/fatim-jeune-friperie.jpg" /><div className="image-caption"><span className="caption-dot" /> Une boutique qui vous ressemble</div></div></div></section>
    </main>
    <footer className="landing-footer page-width"><Logo compact /><span>© 2026 Tikchop. Le commerce, en mieux.</span><div><a href="#solution">La solution</a><Link href="/onboarding">Créer ma boutique</Link></div></footer>
  </div>;
}

function SellerApp() {
  const [products, setProducts] = useState(productsSeed);
  const [orders, setOrders] = useState(ordersSeed);
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const active = location.split("?")[0];
  const nav: readonly NavItem[] = [
    ["/dashboard", "Vue d’ensemble", LayoutDashboard],
    ["/orders", "Commandes", ClipboardList],
    ["/products", "Articles", Package],
    ["/crm", "Clients", UsersRound],
  ] as const;
  const secondary: readonly NavItem[] = [[ "/whatsapp", "Assistant WhatsApp", MessageCircle ], ["/delivery-settings", "Livraison", Truck]];
  const content = <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? "open" : ""}`}><div className="sidebar-top"><Logo /><IconButton label="Fermer le menu" onClick={() => setMobileOpen(false)}><X size={18} /></IconButton></div><div className="store-switcher"><span className="store-avatar">AB</span><div><small>BOUTIQUE ACTIVE</small><b>Awa Boutique</b></div><ChevronDown size={15} /></div><nav className="side-nav"><span className="side-label">ESPACE VENDEUR</span>{nav.map(([href, label, Icon]) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={active === href ? "active" : ""}><Icon size={18} /><span>{label}</span>{href === "/orders" && <i>4</i>}</Link>)}<span className="side-label side-label-spaced">OUTILS</span>{secondary.map(([href, label, Icon]) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={active === href ? "active" : ""}><Icon size={18} /><span>{label}</span>{href === "/whatsapp" && <span className="nav-live" />}</Link>)}</nav><div className="sidebar-bottom"><Link href="/add-product" className="publish-link"><Plus size={16} /> Publier un article</Link><div className="sidebar-help"><CircleHelp size={17} /><div><b>Besoin d’aide ?</b><small>On est là pour vous</small></div></div><Link href="/onboarding" className="user-row"><span className="user-avatar">AK</span><span><b>Awa Koné</b><small>Mon compte</small></span><MoreHorizontal size={17} /></Link></div></aside>
    <div className="main-wrap"><header className="app-header"><button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><div className="breadcrumb"><span>Mon espace</span><ChevronRight size={14} /><b>{pageName(active)}</b></div><div className="header-actions"><div className="header-search"><Search size={16} /><input placeholder="Rechercher..." /></div><IconButton label="Notifications"><Bell size={19} /><span className="notification-dot" /></IconButton><Link href="/:slug" className="header-store"><Store size={16} /> Voir ma boutique <ExternalLink size={13} /></Link></div></header><main className="app-content">{active === "/dashboard" && <Dashboard orders={orders} />}{active === "/orders" && <Orders orders={orders} setOrders={setOrders} />}{active === "/products" && <Products products={products} setProducts={setProducts} />}{active === "/crm" && <CRM orders={orders} />}{active === "/whatsapp" && <WhatsApp />}{active === "/delivery-settings" && <Delivery />}{active === "/add-product" && <AddProduct onAdd={(product) => { setProducts((old) => [product, ...old]); setLocation("/products"); toast.success("Article ajouté au catalogue"); }} />}</main></div>
    <nav className="mobile-nav">{nav.slice(0, 4).map(([href, label, Icon]) => <Link key={href} href={href} className={active === href ? "active" : ""}><Icon size={19} /><span>{label === "Vue d’ensemble" ? "Accueil" : label}</span></Link>)}<Link href="/add-product" className="mobile-publish"><Plus size={22} /></Link></nav>
  </div>;
  return content;
}

function pageName(path: string) { return ({ "/dashboard": "Vue d’ensemble", "/orders": "Commandes", "/products": "Articles", "/crm": "Clients", "/whatsapp": "Assistant WhatsApp", "/delivery-settings": "Livraison", "/add-product": "Publier un article" } as Record<string, string>)[path] || "Vue d’ensemble"; }

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-header"><div><div className="section-kicker">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function Dashboard({ orders }: { orders: Order[] }) {
  return <><PageHeader eyebrow="MARDI 08 AOÛT 2026" title="Bonjour Awa" description="Voici ce qui se passe dans votre boutique aujourd’hui." action={<Link href="/add-product" className="button button-primary"><Plus size={17} /> Ajouter un article</Link>} /><div className="welcome-banner"><div><span className="banner-icon"><Zap size={18} /></span><div><b>Votre boutique est en forme</b><p>4 nouvelles commandes vous attendent. Continuez comme ça.</p></div></div><Link href="/orders">Voir les commandes <ArrowRight size={15} /></Link></div><div className="stats-grid"><StatCard label="Ventes du jour" value="184 500 F" delta="+18,4%" icon={WalletCards} color="orange" /><StatCard label="Commandes" value="24" delta="+6 cette semaine" icon={ClipboardList} color="green" /><StatCard label="Articles actifs" value="18" delta="3 presque épuisés" icon={Package} color="blue" /><StatCard label="Clients suivis" value="126" delta="+12 ce mois" icon={UsersRound} color="purple" /></div><div className="dashboard-grid"><section className="panel orders-panel"><div className="panel-head"><div><h2>Commandes récentes</h2><p>Les dernières demandes de vos clients</p></div><Link href="/orders" className="panel-link">Tout voir <ArrowRight size={14} /></Link></div><div className="order-list">{orders.slice(0, 4).map((order) => <OrderRow key={order.id} order={order} />)}</div></section><section className="panel insight-panel"><div className="panel-head"><div><h2>À ne pas manquer</h2><p>Une petite action, un grand impact</p></div><Lightbulb size={20} className="insight-bulb" /></div><div className="insight-body"><div className="insight-graphic"><div className="insight-ring"><span>72%</span></div></div><b>Vos clients répondent mieux<br />quand vous relancez sous 1h</b><p>3 clients attendent une réponse aujourd’hui.</p><Link href="/crm" className="button button-soft">Voir les clients <ArrowRight size={14} /></Link></div></section></div><section className="panel activity-panel"><div className="panel-head"><div><h2>Performance de la semaine</h2><p>Vos ventes sur les 7 derniers jours</p></div><button className="select-button">Cette semaine <ChevronDown size={14} /></button></div><div className="chart-area"><div className="chart-y"><span>200k</span><span>150k</span><span>100k</span><span>50k</span><span>0</span></div><div className="chart"><div className="chart-grid" /><svg viewBox="0 0 700 180" preserveAspectRatio="none"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#1a9b6c" stopOpacity=".26" /><stop offset="100%" stopColor="#1a9b6c" stopOpacity="0" /></linearGradient></defs><path d="M0 150 C55 132 62 110 115 118 S172 143 220 102 S278 80 325 100 S390 94 430 61 S490 81 535 48 S605 67 700 18 V180 H0Z" fill="url(#chartFill)" /><path d="M0 150 C55 132 62 110 115 118 S172 143 220 102 S278 80 325 100 S390 94 430 61 S490 81 535 48 S605 67 700 18" fill="none" stroke="#16845e" strokeWidth="3" /></svg><div className="chart-labels"><span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span><span>Ven</span><span>Sam</span><span>Dim</span></div></div></div></section></>;
}

function StatCard({ label, value, delta, icon: Icon, color }: { label: string; value: string; delta: string; icon: typeof WalletCards; color: string }) {
  return <div className="stat-card"><div className={`stat-icon ${color}`}><Icon size={19} /></div><span>{label}</span><strong>{value}</strong><small className={delta.startsWith("+") ? "positive" : ""}>{delta.startsWith("+") && <ArrowDownRight size={13} />}{delta}</small></div>;
}

function OrderRow({ order }: { order: Order }) {
  return <div className="order-row"><span className="order-avatar">{order.customer.split(" ").map((x) => x[0]).join("").slice(0, 2)}</span><div className="order-person"><b>{order.customer}</b><small>{order.item}</small></div><div className="order-meta"><small>{order.time}</small><b>{money(order.amount)}</b></div><Status status={order.status} /></div>;
}

function Status({ status }: { status: Order["status"] }) {
  return <span className={`status status-${status.toLowerCase().replace(" ", "-")}`}><span />{status}</span>;
}

function Orders({ orders, setOrders }: { orders: Order[]; setOrders: (orders: Order[]) => void }) {
  const [filter, setFilter] = useState("Toutes");
  const [query, setQuery] = useState("");
  const filters = ["Toutes", "Nouveau", "Confirmée", "En livraison", "Livrée"];
  const shown = orders.filter((order) => (filter === "Toutes" || order.status === filter) && `${order.customer} ${order.id} ${order.item}`.toLowerCase().includes(query.toLowerCase()));
  return <><PageHeader eyebrow="VOTRE ACTIVITÉ" title="Commandes" description="Retrouvez, confirmez et suivez toutes vos commandes." action={<button className="button button-primary" onClick={() => toast.info("La création de commande arrive depuis WhatsApp")}><Plus size={17} /> Nouvelle commande</button>} /><div className="order-summary-row"><div><b>24</b><span>commandes ce mois</span></div><div><b>184 500 F</b><span>chiffre d’affaires aujourd’hui</span></div><div><b>92%</b><span>taux de confirmation</span></div></div><section className="panel table-panel"><div className="table-toolbar"><div className="filter-tabs">{filters.map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}{item === "Nouveau" && <i>4</i>}</button>)}</div><div className="table-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher une commande..." /></div></div><div className="table-wrap"><table><thead><tr><th>CLIENT</th><th>ARTICLE</th><th>DATE</th><th>MONTANT</th><th>STATUT</th><th /></tr></thead><tbody>{shown.map((order) => <tr key={order.id}><td><div className="table-customer"><span className="order-avatar">{order.customer.slice(0, 2).toUpperCase()}</span><div><b>{order.customer}</b><small>{order.id} · {order.location}</small></div></div></td><td>{order.item}</td><td>{order.time}</td><td><b>{money(order.amount)}</b></td><td><Status status={order.status} /></td><td><button className="row-menu" onClick={() => { setOrders(orders.map((item) => item.id === order.id ? { ...item, status: "Confirmée" } : item)); toast.success("Commande mise à jour"); }}><MoreHorizontal size={18} /></button></td></tr>)}</tbody></table>{shown.length === 0 && <EmptyState title="Aucune commande trouvée" text="Essayez un autre filtre ou une autre recherche." />}</div></section></>;
}

function Products({ products, setProducts }: { products: Product[]; setProducts: (items: Product[]) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tous");
  const categories = ["Tous", ...Array.from(new Set(products.map((p) => p.category)))];
  const shown = products.filter((p) => (category === "Tous" || p.category === category) && p.name.toLowerCase().includes(query.toLowerCase()));
  return <><PageHeader eyebrow="VOTRE CATALOGUE" title="Articles" description={`${products.length} articles dans votre boutique.`} action={<Link href="/add-product" className="button button-primary"><Plus size={17} /> Ajouter un article</Link>} /><div className="catalog-toolbar"><div className="filter-tabs">{categories.map((item) => <button className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div><div className="table-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un article..." /></div></div><div className="product-grid">{shown.map((product) => <article className="product-card" key={product.id}><div className="product-image"><img src={product.image} alt={product.name} />{product.tag && <span>{product.tag}</span>}<button className="product-more"><MoreHorizontal size={17} /></button></div><div className="product-info"><div><small>{product.category}</small><h3>{product.name}</h3></div><button className="edit-product" onClick={() => toast.info("Vous pouvez modifier cet article depuis son menu")}><Pencil size={15} /></button><strong>{money(product.price)}</strong><div className="stock-line"><span className={product.stock < 8 ? "low" : ""}><span className="stock-dot" />{product.stock} en stock</span><button onClick={() => { setProducts(products.filter((item) => item.id !== product.id)); toast.success("Article retiré du catalogue"); }} aria-label={`Supprimer ${product.name}`}><Trash2 size={15} /></button></div></div></article>)}</div></>;
}

function AddProduct({ onAdd }: { onAdd: (product: Product) => void }) {
  const [name, setName] = useState(""); const [price, setPrice] = useState(""); const [category, setCategory] = useState("Tissus"); const [image, setImage] = useState("/landing/fabric-display.jpg");
  const handlePublish = () => {
    if (!name || !price) {
      toast.error("Ajoutez un nom et un prix");
      return;
    }
    onAdd({ id: Date.now(), name, category, price: Number(price.replace(/\D/g, "")), stock: 10, image, tag: "Nouveau" });
  };
  return <><PageHeader eyebrow="NOUVEL ARTICLE" title="Publier un article" description="Ajoutez un produit clair et prêt à être partagé à vos clients." action={<Link href="/products" className="button button-ghost">Annuler</Link>} /><div className="form-layout"><section className="panel form-panel"><div className="form-section"><div className="form-section-head"><span>01</span><div><h2>Informations principales</h2><p>Les détails que vos clients verront en premier.</p></div></div><label>Nom de l’article<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Ensemble wax fleuri" /></label><div className="form-row"><label>Catégorie<select value={category} onChange={(e) => setCategory(e.target.value)}><option>Tissus</option><option>Accessoires</option><option>Beauté</option></select></label><label>Prix de vente<input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" placeholder="15 000 F" /></label></div></div><div className="form-section"><div className="form-section-head"><span>02</span><div><h2>Photo de l’article</h2><p>Une vraie photo aide vos clients à se décider.</p></div></div><div className="upload-zone"><img src={image} alt="Aperçu" /><div><Upload size={21} /><b>Déposer une photo ici</b><small>ou choisissez une image dans vos fichiers</small><button className="button button-soft" onClick={() => setImage(image === "/landing/fabric-display.jpg" ? "/landing/african-handbag.jpg" : "/landing/fabric-display.jpg")}>Choisir une image</button></div></div></div><div className="form-footer"><span><ShieldIcon /> Votre catalogue est privé jusqu’à publication.</span><button className="button button-primary" onClick={handlePublish}>Publier l’article <ArrowRight size={16} /></button></div></section><aside className="preview-panel"><div className="preview-label">APERÇU CLIENT</div><div className="store-preview"><div className="store-preview-top"><span className="store-logo">AB</span><div><b>Awa Boutique</b><small><span className="online-dot" /> Ouvert maintenant</small></div></div><img src={image} alt="" /><div className="store-preview-copy"><small>{category}</small><h3>{name || "Nom de votre article"}</h3><strong>{price ? money(Number(price.replace(/\D/g, ""))) : "15 000 F"}</strong><button>Commander sur WhatsApp</button></div></div></aside></div></>;
}

function ShieldIcon() { return <span className="shield-icon"><Check size={11} /></span>; }

function CRM({ orders }: { orders: Order[] }) {
  const customers = Array.from(new Map(orders.map((o) => [o.customer, o])).values());
  const [selected, setSelected] = useState(customers[0]?.customer);
  const customer = customers.find((x) => x.customer === selected) || customers[0];
  return <><PageHeader eyebrow="RELATION CLIENT" title="Clients" description="Gardez le lien avec les personnes qui font vivre votre boutique." action={<button className="button button-primary" onClick={() => toast.success("Lien de partage copié")}><Send size={16} /> Inviter un client</button>} /><div className="crm-stats"><div><UsersRound size={18} /><b>126</b><span>clients au total</span></div><div><MessageCircle size={18} /><b>38</b><span>à relancer aujourd’hui</span></div><div><BarChart3 size={18} /><b>72%</b><span>répondent aux relances</span></div></div><div className="crm-layout"><section className="panel customer-list"><div className="panel-head"><div><h2>Vos clients</h2><p>Les plus récents en premier</p></div><IconButton label="Rechercher"><Search size={17} /></IconButton></div>{customers.map((item) => <button key={item.customer} onClick={() => setSelected(item.customer)} className={`customer-row ${selected === item.customer ? "selected" : ""}`}><span className="order-avatar">{item.customer.slice(0, 2).toUpperCase()}</span><span><b>{item.customer}</b><small>{item.item}</small></span><span className="customer-value">{money(item.amount)}</span></button>)}</section><section className="panel customer-detail"><div className="customer-detail-head"><span className="large-avatar">{customer?.customer.slice(0, 2).toUpperCase()}</span><div><h2>{customer?.customer}</h2><p><PhoneIcon /> {customer?.phone} · {customer?.location}</p></div><button className="button button-soft"><MessageCircle size={15} /> WhatsApp</button></div><div className="detail-note"><Lightbulb size={17} /><p><b>Bonne occasion de relancer</b><br />Ce client a commandé récemment. Envoyez-lui vos nouveautés cette semaine.</p></div><div className="timeline"><div><span><ShoppingBag size={15} /></span><p><b>A commandé {customer?.item}</b><small>{customer?.time}</small></p></div><div><span><MessageCircle size={15} /></span><p><b>A échangé avec votre assistant</b><small>Il y a 2 jours</small></p></div><div><span><UserRound size={15} /></span><p><b>A rejoint votre carnet client</b><small>Il y a 1 semaine</small></p></div></div></section></div></>;
}

function PhoneIcon() { return <span className="inline-icon">☎</span>; }

function WhatsApp() {
  const [connected, setConnected] = useState(true);
  const [copied, setCopied] = useState(false);
  return <><PageHeader eyebrow="ASSISTANT DE VENTE" title="WhatsApp" description="Votre assistant répond quand vous êtes occupée, sans perdre votre ton." action={<span className={`connection-pill ${connected ? "connected" : ""}`}><span /> {connected ? "Connecté" : "Déconnecté"}</span>} /><div className="whatsapp-hero"><div className="wa-copy"><span className="wa-badge"><MessageCircle size={16} /> ASSISTANT TIKCHOP</span><h2>Vos clients n’aiment pas attendre.<br /><em>Votre assistant non plus.</em></h2><p>Il répond aux questions courantes, partage vos produits et vous prévient quand une commande est prête à confirmer.</p><button className="button button-dark" onClick={() => { setConnected(!connected); toast.success(connected ? "Assistant mis en pause" : "Assistant reconnecté"); }}>{connected ? <><Zap size={16} /> Mettre en pause</> : <><RefreshCw size={16} /> Reconnecter</>}</button></div><div className="wa-preview"><div className="wa-preview-head"><span className="person-avatar">AB</span><div><b>Awa Boutique</b><small>Assistant Tikchop</small></div><span className="online-dot" /></div><div className="wa-message in">Bonjour, vous avez encore le sac africain ?<small>10:42</small></div><div className="wa-message out">Bonjour ! Oui, il est disponible à 18 000 F. Voici les détails :<div className="wa-product"><img src="/landing/african-handbag.jpg" /><b>Sac africain</b><strong>18 000 F</strong></div><small>10:42 ✓✓</small></div><div className="wa-input">Message automatique activé <Send size={15} /></div></div></div><section className="panel connect-panel"><div className="connect-icon"><SmartphoneIcon /></div><div><h2>Votre numéro WhatsApp Business</h2><p>+225 07 08 21 44 90 <span className="verified"><Check size={11} /> Vérifié</span></p></div><button className="button button-ghost" onClick={() => { navigator.clipboard?.writeText("+225 07 08 21 44 90"); setCopied(true); toast.success("Numéro copié"); }}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copié" : "Copier"}</button></section></>;
}

function SmartphoneIcon() { return <span className="smartphone-icon"><span /></span>; }

function Delivery() {
  const [zones, setZones] = useState(["Cocody", "Marcory", "Yopougon", "Koumassi"]);
  return <><PageHeader eyebrow="LOGISTIQUE LOCALE" title="Livraison" description="Définissez vos zones et donnez une promesse claire à chaque client." action={<button className="button button-primary" onClick={() => { setZones([...zones, "Abobo"]); toast.success("Zone Abobo ajoutée"); }}><Plus size={17} /> Ajouter une zone</button>} /><div className="delivery-layout"><section className="panel zones-panel"><div className="panel-head"><div><h2>Vos zones de livraison</h2><p>Les tarifs sont affichés automatiquement dans vos conversations.</p></div><Truck size={20} className="panel-accent" /></div>{zones.map((zone, i) => <div className="zone-row" key={zone}><span className="zone-number">0{i + 1}</span><div className="zone-map"><MapPin size={16} /></div><div><b>{zone}</b><small>Livraison standard · 24h</small></div><strong>{i === 0 ? "1 000 F" : i === 1 ? "1 500 F" : "2 000 F"}</strong><IconButton label={`Modifier ${zone}`}><Pencil size={15} /></IconButton><IconButton label={`Supprimer ${zone}`} onClick={() => setZones(zones.filter((x) => x !== zone))}><Trash2 size={15} /></IconButton></div>)}</section><aside className="panel delivery-tip"><span className="tip-icon"><Lightbulb size={19} /></span><h3>Le saviez-vous ?</h3><p>Les commandes avec un tarif de livraison clair sont confirmées <b>2× plus vite</b> par les clients.</p><div className="tip-progress"><span style={{ width: "72%" }} /></div><small>Votre clarté est à 72%</small></aside></div><section className="panel payment-settings"><div><div className="section-kicker">PAIEMENTS</div><h2>Modes acceptés</h2><p>Vos clients peuvent choisir ce qui leur convient.</p></div><div className="payment-options"><span className="payment-option active"><Check size={14} /> Wave</span><span className="payment-option active"><Check size={14} /> Orange Money</span><span className="payment-option active"><Check size={14} /> À la livraison</span><span className="payment-option"><Plus size={14} /> Ajouter</span></div></section></>;
}

function Onboarding() {
  const [step, setStep] = useState(0); const [name, setName] = useState(""); const [store, setStore] = useState(""); const steps = ["Votre compte", "Votre boutique", "Votre premier article"];
  if (step === 3) return <div className="onboarding-page"><div className="onboarding-success"><span className="success-check"><Check size={26} /></span><div className="section-kicker">BIENVENUE CHEZ TIKCHOP</div><h1>Votre boutique est<br /><em>prête à vendre.</em></h1><p>Tout est en place, {name || "Awa"}. Il ne reste plus qu’à partager votre premier article.</p><Link href="/dashboard" className="button button-primary button-large">Découvrir mon espace <ArrowRight size={17} /></Link><div className="success-image"><img src="/landing/onboarding-seller-phone.jpg" alt="" /></div></div></div>;
  return <div className="onboarding-page"><div className="onboarding-side"><Logo /><div className="onboarding-side-copy"><span className="eyebrow light"><span className="eyebrow-dot" /> Votre commerce, en mouvement</span><h2>Les belles histoires commencent par une <em>première commande.</em></h2><p>Tikchop vous aide à la recevoir plus vite.</p></div><div className="onboarding-side-foot">“Simple, local, efficace.”<small>— L’équipe Tikchop, Abidjan</small></div></div><div className="onboarding-main"><div className="onboarding-top"><span>Déjà un compte ? <a href="/onboarding">Se connecter</a></span><span>Étape {step + 1} sur 3</span></div><div className="progress"><span style={{ width: `${((step + 1) / 3) * 100}%` }} /></div><div className="onboarding-form"><div className="section-kicker">COMMENÇONS ENSEMBLE</div><h1>{steps[step]}</h1><p>{step === 0 ? "Créez votre espace vendeur en quelques secondes." : step === 1 ? "Donnez un nom à la boutique que vos clients vont retenir." : "Ajoutez un article pour voir votre boutique prendre vie."}</p>{step === 0 && <><label>Votre prénom et nom<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Awa Koné" /></label><label>Votre numéro WhatsApp<input placeholder="+225 07 00 00 00 00" /></label><label>Un mot de passe<input type="password" placeholder="Au moins 6 caractères" /></label></>}{step === 1 && <><label>Nom de votre boutique<input value={store} onChange={(e) => setStore(e.target.value)} placeholder="Ex : Awa Boutique" /></label><label>Votre commune<select><option>Cocody</option><option>Marcory</option><option>Yopougon</option><option>Abobo</option></select></label><div className="onboarding-choice"><span>Que vendez-vous ?</span><div><button className="selected">Mode & accessoires</button><button>Beauté</button><button>Alimentation</button></div></div></>}{step === 2 && <><div className="first-product"><img src="/landing/fabric-display.jpg" /><div><b>Pagne wax premium</b><small>Un exemple pour démarrer</small></div><CheckCircle2 size={20} /></div><p className="form-hint">Vous pourrez ajouter, modifier ou supprimer vos articles à tout moment.</p></>}<button className="button button-primary button-large full-button" onClick={() => setStep(step + 1)}>{step === 2 ? "Créer ma boutique" : "Continuer"} <ArrowRight size={17} /></button><small className="secure-note"><ShieldIcon /> Vos informations restent privées et sécurisées.</small></div></div></div>;
}

function Storefront({ params }: { params: { slug: string } }) {
  const [cart, setCart] = useState<Product[]>([]); const [open, setOpen] = useState(false);
  const add = (product: Product) => { setCart([...cart, product]); toast.success(`${product.name} ajouté au panier`); };
  return <div className="storefront"><header className="store-header"><Logo /><div className="store-header-right"><span className="store-open"><span /> Ouvert aujourd’hui</span><button className="cart-button" onClick={() => setOpen(true)}><ShoppingBag size={18} /> Panier {cart.length > 0 && <b>{cart.length}</b>}</button></div></header><section className="store-hero"><div className="store-hero-copy"><span className="eyebrow"><span className="eyebrow-dot" /> Boutique vérifiée par Tikchop</span><h1>Awa Boutique</h1><p>Des pièces choisies avec soin, livrées partout à Abidjan.</p><div className="store-meta"><span><MapPin size={15} /> Cocody, Abidjan</span><span><Truck size={15} /> Livraison dès 1 000 F</span></div></div><div className="store-hero-image"><img src="/landing/wax-shop.jpg" alt="" /><span className="store-initials">AB</span></div></section><main className="store-main"><div className="store-main-head"><div><div className="section-kicker">LA SÉLECTION D’AWA</div><h2>Nos articles</h2></div><div className="store-filters"><button className="active">Tout voir</button><button>Tissus</button><button>Accessoires</button></div></div><div className="store-product-grid">{productsSeed.map((product) => <article className="store-product" key={product.id}><div className="store-product-image"><img src={product.image} alt={product.name} />{product.tag && <span>{product.tag}</span>}<button onClick={() => add(product)} aria-label={`Ajouter ${product.name}`}><Plus size={18} /></button></div><small>{product.category}</small><h3>{product.name}</h3><strong>{money(product.price)}</strong></article>)}</div></main>{open && <div className="cart-drawer-backdrop" onClick={() => setOpen(false)}><aside className="cart-drawer" onClick={(e) => e.stopPropagation()}><div className="drawer-head"><div><div className="section-kicker">VOTRE SÉLECTION</div><h2>Panier <span>{cart.length}</span></h2></div><IconButton label="Fermer" onClick={() => setOpen(false)}><X size={19} /></IconButton></div>{cart.length === 0 ? <EmptyState title="Votre panier est vide" text="Ajoutez un article pour commencer." /> : <><div className="drawer-items">{cart.map((item, i) => <div className="drawer-item" key={`${item.id}-${i}`}><img src={item.image} /><div><b>{item.name}</b><small>{money(item.price)}</small></div><button onClick={() => setCart(cart.filter((_, index) => index !== i))}><Trash2 size={15} /></button></div>)}</div><div className="drawer-total"><span>Total estimé</span><strong>{money(cart.reduce((sum, item) => sum + item.price, 0))}</strong></div><button className="button button-primary full-button" onClick={() => { setOpen(false); toast.success("Votre demande a été envoyée sur WhatsApp"); }}>Commander sur WhatsApp <Send size={15} /></button></>}</aside></div>}</div>;
}

function EmptyState({ title, text }: { title: string; text: string }) { return <div className="empty-state"><span><Package size={22} /></span><h3>{title}</h3><p>{text}</p></div>; }
function UpdatePassword() { const [saved, setSaved] = useState(false); return <div className="simple-page"><Logo /><section className="simple-card">{saved ? <><CheckCircle2 size={42} className="success-color" /><h1>Mot de passe mis à jour</h1><p>Vous pouvez maintenant vous reconnecter avec votre nouveau mot de passe.</p><Link href="/onboarding" className="button button-primary full-button">Retour à la connexion</Link></> : <><KeyIcon /><div className="section-kicker">SÉCURITÉ DU COMPTE</div><h1>Choisir un nouveau mot de passe</h1><p>Utilisez un mot de passe que vous n’utilisez pas ailleurs.</p><label>Nouveau mot de passe<input type="password" placeholder="••••••••" /></label><label>Confirmer le mot de passe<input type="password" placeholder="••••••••" /></label><button className="button button-primary full-button" onClick={() => setSaved(true)}>Enregistrer <Check size={16} /></button></>}</section></div>; }
function KeyIcon() { return <span className="simple-icon"><Settings2 size={22} /></span>; }
function PaymentCallback() { return <div className="simple-page"><Logo /><section className="simple-card"><CheckCircle2 size={44} className="success-color" /><div className="section-kicker">PAIEMENT REÇU</div><h1>Merci pour votre commande.</h1><p>Votre paiement a bien été enregistré. La boutique prépare votre colis.</p><Link href="/receipt" className="button button-primary full-button">Voir mon reçu <ArrowRight size={16} /></Link><Link href="/" className="text-link centered">Retour à l’accueil</Link></section></div>; }
function Receipt() { return <div className="receipt-page"><header className="receipt-top"><Logo /><button className="button button-ghost" onClick={() => toast.success("Téléchargement du reçu préparé")}><Download size={16} /> Télécharger</button></header><section className="receipt-card"><div className="receipt-status"><span><Check size={18} /></span><div><b>Paiement confirmé</b><small>8 août 2026 · 14:32</small></div></div><div className="receipt-title"><div className="section-kicker">REÇU DE COMMANDE</div><h1>#TK-2048</h1><p>Merci Aminata, votre commande est entre de bonnes mains.</p></div><div className="receipt-shop"><span className="store-logo">AB</span><div><b>Awa Boutique</b><small>Cocody, Abidjan · +225 07 08 21 44 90</small></div></div><div className="receipt-items"><div><span>Pagne wax premium × 2</span><b>30 000 F</b></div><div><span>Livraison · Cocody</span><b>1 000 F</b></div><div className="receipt-total"><span>Total payé</span><strong>31 000 F</strong></div></div><div className="receipt-progress"><span className="done"><Check size={14} /></span><i /><span className="current"><PackageCheck size={14} /></span><i /><span><Truck size={14} /></span><div><small>Commande confirmée</small><small>Préparation</small><small>Livraison</small></div></div><Link href="/" className="text-link centered"><Home size={15} /> Retour à l’accueil</Link></section></div>; }

export default App;