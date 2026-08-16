import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Eye,
  Package,
  Pencil,
  Power,
  ReceiptText,
  Search,
  ShieldCheck,
  Store,
  UsersRound,
  WifiOff,
} from "lucide-react";
import { aynidInspiredRoadmap, getAynidRoadmapProgress, getRoadmapStatusLabel } from "../../lib/aynid-roadmap";
import {
  adminBulkSetSellerProducts,
  adminSetSellerAssistantMode,
  adminToggleProductVisibility,
  adminUpdateOrderStatus,
  adminUpdateProductCommercials,
  adminUpdateSellerProfile,
  adminUpdateSellerWhatsAppStatus,
  getAdminDashboardData,
} from "./actions";

export const dynamic = "force-dynamic";

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} F`;
}

function formatDate(value) {
  if (!value) return "Date inconnue";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return date.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function joinedSeller(row) {
  return Array.isArray(row?.sellers) ? row.sellers[0] : row?.sellers;
}

function sellerNameFromJoin(row) {
  return joinedSeller(row)?.name || row?.seller_id || "Boutique";
}

function sellerSlugFromJoin(row) {
  return joinedSeller(row)?.slug || "";
}

function getStatusTone(status) {
  const normalized = String(status || "").toUpperCase();
  if (["PAID", "PREPARED", "DELIVERED", "READY", "ASSIGNED"].includes(normalized)) return "bg-emerald-100 text-emerald-800";
  if (["CANCELLED", "ERROR"].includes(normalized)) return "bg-rose-100 text-rose-800";
  return "bg-amber-100 text-amber-800";
}

export default async function AdminPage({ searchParams }) {
  const params = await searchParams;
  const filters = {
    search: params?.q || "",
    sellerStatus: params?.seller || "all",
    orderStatus: params?.order || "all",
    productStatus: params?.product || "all",
  };
  const data = await getAdminDashboardData(filters);

  if (data.auth !== "ok") {
    return <AdminAccessState data={data} />;
  }

  const stats = data.stats || {};
  const roadmapProgress = getAynidRoadmapProgress();

  return (
    <section className="min-h-screen bg-[#EDF8F0] px-3 py-4 text-[#0C271C] md:px-7 md:py-7">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="grid gap-4 rounded-[30px] bg-[#0F2B20] p-5 text-white shadow-sm lg:grid-cols-[1fr_auto] lg:items-end lg:p-7">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
              <ShieldCheck size={16} />
              Admin Tikchop
            </p>
            <h1 className="mt-3 font-display text-3xl font-black md:text-5xl">Centre de controle</h1>
            <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-white/66">
              Tu vois ce qui bloque, tu corriges vite, tu controles les boutiques sans entrer dans chaque compte vendeur.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[420px]">
            <MiniSignal label="Admin" value={data.email} />
            <MiniSignal label="Messages 7j" value={stats.messages7d || 0} />
          </div>
        </header>

        <AdminFilters filters={data.filters || filters} />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatCard icon={<Store size={20} />} label="Boutiques" value={stats.sellers} detail={`${stats.connectedSellers || 0} WhatsApp OK`} />
          <StatCard icon={<WifiOff size={20} />} label="A corriger" value={stats.disconnectedSellers} detail="WhatsApp non connecté" danger={stats.disconnectedSellers > 0} />
          <StatCard icon={<Package size={20} />} label="Articles" value={stats.products} detail={`${stats.lowStockProducts || 0} stock faible`} />
          <StatCard icon={<ReceiptText size={20} />} label="Commandes" value={stats.orders} detail={`${stats.pendingOrders || 0} a traiter`} danger={stats.pendingOrders > 0} />
          <StatCard icon={<CreditCard size={20} />} label="CA recent" value={formatMoney(stats.revenueSample)} detail={`${stats.payoutMissing || 0} paiement a configurer`} />
        </div>

        <RoadmapPanel progress={roadmapProgress} items={aynidInspiredRoadmap} />

        <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <CommandCenter attention={data.attention} />
          <AdminPanel title="Commandes a piloter" icon={<ReceiptText size={19} />} action="Statut, paiement, livraison et adresse depuis une seule fiche">
            <div className="space-y-3">
              {(data.recentOrders || []).map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
              {data.recentOrders?.length === 0 && <EmptyLine text="Aucune commande selon les filtres." />}
            </div>
          </AdminPanel>
        </div>

        <AdminPanel title="Vendeurs" icon={<UsersRound size={19} />} action="Modifier compte, activer assistant, publier/masquer toute la boutique">
          <div className="grid gap-3 xl:grid-cols-2">
            {(data.recentSellers || []).map((seller) => (
              <SellerCard key={seller.id} seller={seller} />
            ))}
          </div>
          {data.recentSellers?.length === 0 && <EmptyLine text="Aucune boutique selon les filtres." />}
        </AdminPanel>

        <AdminPanel title="Articles" icon={<Package size={19} />} action="Changer prix, stock et visibilite sans passer par le vendeur">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(data.recentProducts || []).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          {data.recentProducts?.length === 0 && <EmptyLine text="Aucun article selon les filtres." />}
        </AdminPanel>
      </div>
    </section>
  );
}

function RoadmapPanel({ progress, items }) {
  const visibleItems = items.slice(0, 8);
  return (
    <section className="rounded-[30px] bg-white p-4 shadow-sm ring-1 ring-black/5 md:p-5">
      <div className="grid gap-4 lg:grid-cols-[260px_1fr] lg:items-center">
        <div className="rounded-[26px] bg-[#0F2B20] p-5 text-white">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">Plan Aynid vers Tikchop</p>
          <p className="mt-3 font-display text-5xl font-black">{progress}%</p>
          <p className="mt-2 text-sm font-bold leading-5 text-white/62">Progression globale des fonctionnalites utiles adaptees a Tikchop.</p>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {visibleItems.map((item) => (
            <article key={item.id} className="rounded-2xl bg-[#F5FBF8] p-3 ring-1 ring-black/5">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-black text-[#0C271C]">{item.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-[0.62rem] font-black ${
                  item.status === "done" ? "bg-emerald-100 text-emerald-800" : item.status === "in_progress" ? "bg-amber-100 text-amber-800" : "bg-white text-[#4C6B5E]"
                }`}>
                  {getRoadmapStatusLabel(item.status)}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${item.percent}%` }} />
              </div>
              <p className="mt-2 text-[0.68rem] font-black text-[#4C6B5E]">{item.percent}%</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AdminAccessState({ data }) {
  const isConfig = data.auth === "not_configured";
  const isDenied = data.auth === "denied";
  return (
    <section className="flex min-h-screen items-center justify-center bg-[#EDF8F0] px-4 py-10">
      <div className="w-full max-w-xl rounded-[30px] bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
          <AlertTriangle size={26} />
        </div>
        <h1 className="mt-5 font-display text-3xl font-black text-[#0C271C]">Acces admin non disponible</h1>
        <p className="mt-3 text-sm font-bold leading-6 text-[#547064]">
          {isConfig
            ? "Ajoute ton email de connexion dans TIKCHOP_ADMIN_EMAILS sur Vercel ou dans .env.local, puis reconnecte-toi."
            : isDenied
              ? `Le compte ${data.email} n'est pas autorise comme admin Tikchop.`
              : data.message || "Connecte-toi avec un compte admin pour ouvrir cet espace."}
        </p>
        <div className="mt-5 rounded-2xl bg-[#F3FAF6] p-4 font-mono text-xs font-bold text-[#0C271C]">
          TIKCHOP_ADMIN_EMAILS=tonemail@example.com
        </div>
        <Link href="/onboarding?mode=signin&method=email" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#0F2B20] px-5 text-sm font-black text-white no-underline">
          Se connecter
        </Link>
      </div>
    </section>
  );
}

function AdminFilters({ filters }) {
  return (
    <form action="/admin" className="grid gap-2 rounded-[26px] bg-white p-3 shadow-sm ring-1 ring-black/5 lg:grid-cols-[1fr_auto_auto_auto_auto]">
      <label className="flex min-h-12 items-center gap-2 rounded-2xl bg-[#EDF8F0] px-3">
        <Search size={17} className="text-[#4C6B5E]" />
        <input name="q" defaultValue={filters.search || ""} placeholder="Chercher boutique, client, commande..." className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-[#6F8277]" />
      </label>
      <FilterSelect name="seller" defaultValue={filters.sellerStatus || "all"} options={[
        ["all", "Tous vendeurs"],
        ["connected", "WhatsApp OK"],
        ["attention", "WhatsApp a corriger"],
        ["payment", "Paiement manquant"],
      ]} />
      <FilterSelect name="order" defaultValue={String(filters.orderStatus || "all").toLowerCase()} options={[
        ["all", "Toutes commandes"],
        ["pending", "A traiter"],
        ["paid", "Payees"],
        ["prepared", "Preparees"],
        ["delivered", "Livrees"],
        ["cancelled", "Annulees"],
      ]} />
      <FilterSelect name="product" defaultValue={filters.productStatus || "all"} options={[
        ["all", "Tous articles"],
        ["visible", "Visibles"],
        ["hidden", "Masques"],
        ["low_stock", "Stock faible"],
        ["out", "Rupture"],
      ]} />
      <button className="min-h-12 rounded-2xl bg-[#0F2B20] px-5 text-sm font-black text-white">Filtrer</button>
    </form>
  );
}

function FilterSelect({ name, defaultValue, options }) {
  return (
    <select name={name} defaultValue={defaultValue} className="min-h-12 rounded-2xl bg-[#EDF8F0] px-3 text-sm font-black text-[#0C271C] outline-none">
      {options.map(([value, label]) => (
        <option key={value} value={value}>{label}</option>
      ))}
    </select>
  );
}

function MiniSignal({ label, value }) {
  return (
    <div className="rounded-3xl bg-white/10 p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-white/48">{label}</p>
      <p className="mt-1 truncate text-sm font-black">{value}</p>
    </div>
  );
}

function StatCard({ icon, label, value, detail, danger = false }) {
  return (
    <article className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${danger ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{icon}</span>
        <span className="text-xs font-black uppercase tracking-[0.12em] text-[#6F8277]">{label}</span>
      </div>
      <p className="mt-4 font-display text-3xl font-black">{value}</p>
      <p className="mt-1 text-xs font-bold text-[#4C6B5E]">{detail}</p>
    </article>
  );
}

function CommandCenter({ attention = {} }) {
  return (
    <AdminPanel title="Priorites" icon={<AlertTriangle size={19} />} action="Ce que tu dois traiter en premier">
      <div className="grid gap-3">
        <PriorityBlock title="WhatsApp déconnecté" rows={attention.disconnectedSellers} empty="Aucun WhatsApp critique.">
          {(seller) => (
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate font-black">{seller.name || seller.slug}</span>
              <Link href={`/${seller.slug || ""}`} className="text-xs font-black text-emerald-700 no-underline">Voir</Link>
            </div>
          )}
        </PriorityBlock>
        <PriorityBlock title="Commandes a traiter" rows={attention.pendingOrders} empty="Aucune commande en attente.">
          {(order) => (
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate font-black">{order.order_ref || order.id?.slice(0, 8)} · {formatMoney(Number(order.total_amount || 0) + Number(order.delivery_fee || 0))}</span>
              <span className="text-xs font-black text-[#4C6B5E]">{sellerNameFromJoin(order)}</span>
            </div>
          )}
        </PriorityBlock>
        <PriorityBlock title="Stock faible" rows={attention.lowStockProducts} empty="Aucun stock faible.">
          {(product) => (
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate font-black">{product.name}</span>
              <span className="text-xs font-black text-amber-700">stock {product.stock_quantity ?? 0}</span>
            </div>
          )}
        </PriorityBlock>
      </div>
    </AdminPanel>
  );
}

function PriorityBlock({ title, rows = [], empty, children }) {
  return (
    <div className="rounded-[22px] bg-[#F5FBF8] p-4 ring-1 ring-black/5">
      <h3 className="text-sm font-black text-[#0C271C]">{title}</h3>
      <div className="mt-3 space-y-2 text-sm text-[#14362A]">
        {rows.length ? rows.map((row) => <div key={row.id} className="rounded-2xl bg-white px-3 py-2">{children(row)}</div>) : <p className="text-xs font-bold text-[#4C6B5E]">{empty}</p>}
      </div>
    </div>
  );
}

function AdminPanel({ title, icon, action, children }) {
  return (
    <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-black/5 md:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-black text-[#0C271C]">
            {icon}
            {title}
          </h2>
          <p className="mt-1 text-xs font-bold text-[#4C6B5E]">{action}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function SellerCard({ seller }) {
  const status = String(seller.whatsapp_status || "unknown").toLowerCase();
  const connected = ["connected", "open", "standard_active"].includes(status);
  const paymentReady = Boolean(seller.paystack_subaccount_code || ["paystack_ready", "direct_ready"].includes(String(seller.payout_status || "").toLowerCase()));

  return (
    <article className="rounded-[24px] bg-[#F5FBF8] p-4 ring-1 ring-black/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-black">{seller.name || "Boutique sans nom"}</h3>
          <p className="mt-1 truncate text-xs font-bold text-[#4C6B5E]">{seller.owner_email || seller.phone_number || "Proprietaire non renseigne"} · /{seller.slug}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={connected ? "green" : "amber"}>{connected ? "WhatsApp OK" : status || "WhatsApp ?"}</Badge>
          <Badge tone={paymentReady ? "green" : "amber"}>{paymentReady ? "Paiement OK" : "Paiement manquant"}</Badge>
        </div>
      </div>

      <details className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-black/5">
        <summary className="cursor-pointer text-sm font-black text-[#0C271C]">Modifier le vendeur</summary>
        <form action={adminUpdateSellerProfile} className="mt-3 grid gap-2 sm:grid-cols-3">
          <input type="hidden" name="seller_id" value={seller.id} />
          <AdminInput name="name" defaultValue={seller.name || ""} placeholder="Nom boutique" />
          <AdminInput name="phone_number" defaultValue={seller.phone_number || ""} placeholder="Telephone" />
          <AdminInput name="owner_email" defaultValue={seller.owner_email || ""} placeholder="Email proprietaire" />
          <button className="min-h-11 rounded-2xl bg-[#0F2B20] px-4 text-xs font-black text-white sm:col-span-3">
            Enregistrer
          </button>
        </form>
      </details>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {seller.slug && (
          <Link href={`/${seller.slug}`} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-2xl bg-white px-3 text-xs font-black text-[#0C271C] no-underline ring-1 ring-black/10">
            <Eye size={14} />
            Voir boutique
          </Link>
        )}
        <form action={adminUpdateSellerWhatsAppStatus} className="flex min-h-11 overflow-hidden rounded-2xl bg-white ring-1 ring-black/10">
          <input type="hidden" name="seller_id" value={seller.id} />
          <select name="whatsapp_status" defaultValue={status || "disconnected"} className="min-w-0 flex-1 bg-white px-3 text-xs font-black outline-none">
            <option value="connected">Connecté</option>
            <option value="standard_active">Assistant standard</option>
            <option value="pairing">Appairage</option>
            <option value="pending">En attente</option>
            <option value="disconnected">Déconnecté</option>
            <option value="error">Erreur</option>
          </select>
          <button className="bg-[#0F2B20] px-3 text-xs font-black text-white">OK</button>
        </form>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <SellerAction sellerId={seller.id} action={adminSetSellerAssistantMode} name="mode" value="standard" icon={<Power size={14} />} label="Assistant standard" />
        <SellerAction sellerId={seller.id} action={adminBulkSetSellerProducts} name="is_active" value="true" icon={<Package size={14} />} label="Tout publier" />
        <SellerAction sellerId={seller.id} action={adminBulkSetSellerProducts} name="is_active" value="false" icon={<Package size={14} />} label="Tout masquer" danger />
      </div>
    </article>
  );
}

function SellerAction({ sellerId, action, name, value, icon, label, danger = false }) {
  return (
    <form action={action}>
      <input type="hidden" name="seller_id" value={sellerId} />
      <input type="hidden" name={name} value={value} />
      <button className={`flex min-h-10 w-full items-center justify-center gap-1 rounded-2xl px-3 text-xs font-black ${danger ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-800"}`}>
        {icon}
        {label}
      </button>
    </form>
  );
}

function OrderRow({ order }) {
  const total = Number(order.total_amount || 0) + Number(order.delivery_fee || 0);
  return (
    <article className="rounded-[24px] bg-[#F5FBF8] p-4 ring-1 ring-black/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black">{order.order_ref || order.id?.slice(0, 8)?.toUpperCase()} · {sellerNameFromJoin(order)}</p>
          <p className="mt-1 truncate text-xs font-bold text-[#4C6B5E]">{order.customer_name || order.customer_phone || "Client"} · {formatDate(order.created_at)}</p>
          <p className="mt-1 truncate text-xs font-bold text-[#4C6B5E]">{order.delivery_zone || "Zone non renseignee"}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-black text-emerald-700">{formatMoney(total)}</p>
          <div className="mt-1 flex flex-wrap justify-end gap-1">
            <Badge>{order.payment_method || "paiement ?"}</Badge>
            <Badge tone={String(order.status).toUpperCase() === "PENDING" ? "amber" : "green"}>{order.status || "PENDING"}</Badge>
          </div>
        </div>
      </div>
      <form action={adminUpdateOrderStatus} className="mt-3 grid gap-2 md:grid-cols-2">
        <input type="hidden" name="order_id" value={order.id} />
        <FilterSelect name="status" defaultValue={String(order.status || "PENDING").toLowerCase()} options={[
          ["pending", "Commande a traiter"],
          ["paid", "Commande payee"],
          ["prepared", "Commande preparee"],
          ["delivered", "Commande livrée"],
          ["cancelled", "Commande annulee"],
        ]} />
        <FilterSelect name="delivery_status" defaultValue={String(order.delivery_status || "PENDING").toLowerCase()} options={[
          ["pending", "Livraison attente"],
          ["assigned", "Livreur assigné"],
          ["ready", "Colis pret"],
          ["delivered", "Livraison faite"],
          ["cancelled", "Livraison annulee"],
        ]} />
        <FilterSelect name="payment_method" defaultValue={String(order.payment_method || "cash").toLowerCase()} options={[
          ["cash", "Cash"],
          ["wave", "Wave"],
          ["orange_money", "Orange Money"],
          ["mtn_money", "MTN Money"],
          ["moov_money", "Moov Money"],
          ["paystack", "Paystack"],
          ["card", "Carte"],
        ]} />
        <AdminInput name="delivery_zone" defaultValue={order.delivery_zone || ""} placeholder="Zone livraison" />
        <AdminInput name="delivery_address" defaultValue={order.delivery_address || ""} placeholder="Adresse livraison" className="md:col-span-2" />
        <button className="min-h-11 rounded-2xl bg-[#0F2B20] px-4 text-xs font-black text-white md:col-span-2">
          Mettre a jour la commande
        </button>
      </form>
    </article>
  );
}

function ProductCard({ product }) {
  const isActive = product.is_active !== false;
  const slug = sellerSlugFromJoin(product);
  return (
    <article className="rounded-[24px] bg-[#F5FBF8] p-4 ring-1 ring-black/5">
      <div className="flex gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={product.name || "Article"} className="h-full w-full object-cover" />
          ) : (
            <Package size={22} className="text-[#6F8277]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-black">{product.name || "Article"}</h3>
          <p className="mt-1 text-xs font-bold text-[#4C6B5E]">{sellerNameFromJoin(product)}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Badge tone={isActive ? "green" : "gray"}>{isActive ? "Visible" : "Masque"}</Badge>
            <Badge tone={Number(product.stock_quantity || 0) <= 2 ? "amber" : "gray"}>stock {product.stock_quantity ?? 0}</Badge>
          </div>
        </div>
      </div>

      <form action={adminUpdateProductCommercials} className="mt-3 grid grid-cols-2 gap-2">
        <input type="hidden" name="product_id" value={product.id} />
        <AdminInput name="price" type="number" defaultValue={Number(product.price || 0)} placeholder="Prix" />
        <AdminInput name="stock_quantity" type="number" defaultValue={Number(product.stock_quantity || 0)} placeholder="Stock" />
        <select name="is_active" defaultValue={String(isActive)} className="min-h-11 rounded-2xl bg-white px-3 text-xs font-black outline-none ring-1 ring-black/10">
          <option value="true">Visible</option>
          <option value="false">Masque</option>
        </select>
        <button className="min-h-11 rounded-2xl bg-[#0F2B20] px-3 text-xs font-black text-white">
          <Pencil className="mr-1 inline" size={13} />
          Modifier
        </button>
      </form>

      <div className="mt-2 flex flex-wrap gap-2">
        {slug && (
          <Link href={`/${slug}?product=${product.id}`} className="inline-flex min-h-10 items-center gap-1 rounded-2xl bg-white px-3 text-xs font-black text-[#0C271C] no-underline ring-1 ring-black/10">
            <ExternalLink size={14} />
            Voir
          </Link>
        )}
        <form action={adminToggleProductVisibility}>
          <input type="hidden" name="product_id" value={product.id} />
          <input type="hidden" name="is_active" value={String(!isActive)} />
          <button className={`min-h-10 rounded-2xl px-3 text-xs font-black ${isActive ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-800"}`}>
            {isActive ? "Masquer" : "Publier"}
          </button>
        </form>
      </div>
    </article>
  );
}

function AdminInput({ className = "", ...props }) {
  return (
    <input {...props} className={`min-h-11 rounded-2xl bg-white px-3 text-xs font-black outline-none ring-1 ring-black/10 placeholder:text-[#6F8277] ${className}`} />
  );
}

function Badge({ tone = "gray", children }) {
  const tones = {
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    rose: "bg-rose-100 text-rose-800",
    gray: "bg-white text-[#4C6B5E]",
  };
  return <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-black ${tones[tone] || getStatusTone(children)}`}>{children}</span>;
}

function EmptyLine({ text }) {
  return (
    <div className="rounded-2xl bg-[#F5FBF8] p-4 text-sm font-bold text-[#4C6B5E]">
      <CheckCircle2 className="mb-2 text-emerald-700" size={20} />
      {text}
    </div>
  );
}
