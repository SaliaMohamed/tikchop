"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search, X } from "lucide-react";
import { useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { withClientTimeout } from "../../lib/seller-products-client";
import { friendlyError } from "../../lib/user-facing-error";
import { getSellerOrders } from "../actions";
import { buildCustomers, getSegmentCount, segmentLabels } from "../../lib/crm-utils";
import { CrmHero } from "./components/CrmHero";
import { CustomerCard } from "./components/CustomerCard";
import { CustomerSheet } from "./components/CustomerSheet";
import { EmptyCrm } from "./components/EmptyCrm";

export default function CrmPage() {
  const seller = useActiveSeller();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [segment, setSegment] = useState("ALL");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  const customers = useMemo(() => buildCustomers(orders), [orders]);

  const stats = useMemo(
    () => ({
      estimatedSales: customers.reduce(
        (sum, customer) => sum + (customer.totalSpent > 0 ? customer.totalSpent : customer.totalEstimated),
        0,
      ),
    }),
    [customers],
  );

  const shown = useMemo(() => {
    const value = query.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesSegment =
        segment === "ALL" ||
        (segment === "FOLLOW_UP" && customer.shouldFollowUp) ||
        (segment === "LOYAL" && customer.isLoyal) ||
        (segment === "NEW" && customer.orderCount === 1);
      const haystack = [customer.phone, customer.zone, customer.address].filter(Boolean).join(" ").toLowerCase();
      return matchesSegment && (!value || haystack.includes(value));
    });
  }, [customers, segment, query]);

  async function fetchCustomers() {
    if (!seller.slug) {
      return { orders: [], error: "Aucune boutique active. Reconnectez-vous pour voir vos clients." };
    }

    try {
      const token = await getSellerAccessToken();
      const data = await withClientTimeout(
        getSellerOrders(seller.slug, token, { limit: 200 }),
        "Carnet client trop long à charger.",
      );
      return { orders: data || [], error: "" };
    } catch (err) {
      const sessionExpired = /session vendeur|reconnecte/i.test(String(err?.message || ""));
      return {
        orders: [],
        error: sessionExpired
          ? "Session vendeur expirée. Reconnectez-vous pour voir vos clients."
          : friendlyError(err, "Clients non chargés. Vérifiez la connexion puis réessayez."),
      };
    }
  }

  async function loadCustomers() {
    setLoading(true);
    setError("");
    const result = await fetchCustomers();
    setOrders(result.orders);
    setError(result.error);
    setLoading(false);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      const result = await fetchCustomers();
      if (!alive) return;
      setOrders(result.orders);
      setError(result.error);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seller.slug]);

  return (
    <div className="app-shell mx-auto max-w-[560px] px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-4 md:pt-8">
      {/* Header Replit : eyebrow kicker + titre */}
      <header className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.66rem] font-black uppercase tracking-[0.16em] text-[#059669]">Relation client</p>
          <h1 className="mt-1.5 font-display text-3xl font-black text-[#0F2B20] leading-none">Clients</h1>
          <p className="mt-2 text-xs font-semibold text-[#54685E]/60">
            {loading ? "Chargement du carnet..." : `${customers.length} client${customers.length > 1 ? "s" : ""} dans votre carnet`}
          </p>
        </div>
        <button
          type="button"
          onClick={loadCustomers}
          aria-label="Actualiser"
          title="Actualiser"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#0F2B20] ring-1 ring-[#0F2B20]/8 transition active:scale-95"
        >
          <RefreshCw size={17} strokeWidth={1.6} className={loading ? "animate-spin text-[#059669]" : ""} />
        </button>
      </header>

      {/* Hero : carnet client + ventes estimées */}
      {!loading && !error && <CrmHero stats={stats} totalCustomers={customers.length} />}

      {/* Filtres par segment */}
      {customers.length > 0 && (
        <nav className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1">
          {Object.entries(segmentLabels).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSegment(key)}
              className={`flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-black transition ${
                segment === key ? "bg-[#0F2B20] text-white" : "bg-white text-[#54685E] ring-1 ring-[#0F2B20]/8"
              }`}
            >
              {label}
              <span className={`text-[10px] font-black ${segment === key ? "text-[#34D399]" : "text-[#059669]"}`}>
                {getSegmentCount(customers, key)}
              </span>
            </button>
          ))}
        </nav>
      )}

      {/* Recherche */}
      {customers.length > 0 && (
        <div className="mt-4 flex min-h-[50px] items-center gap-3 rounded-[20px] bg-[#0F2B20]/5 px-4">
          <Search className="shrink-0 text-[#54685E]/60" size={16} strokeWidth={1.5} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Chercher par numéro, commune..."
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#0F2B20] outline-none placeholder:text-[#54685E]/50"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0F2B20]/10 text-[#0F2B20]"
              aria-label="Effacer"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-[22px] bg-[#fdf3d6] p-3 text-xs font-black text-[#7a5425] ring-1 ring-[#f4ce60]/45">
          <p>{error}</p>
          <button
            type="button"
            onClick={loadCustomers}
            className="mt-3 inline-flex min-h-[38px] items-center justify-center rounded-full bg-white px-4 text-xs font-black text-[#7a5425] ring-1 ring-[#f4ce60]/60"
          >
            Réessayer
          </button>
        </div>
      )}

      <main className="mt-5">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-[150px] w-full rounded-[24px]" style={{ animationDelay: `${i * 0.06}s` }} />
            ))}
          </div>
        ) : error ? null : customers.length === 0 ? (
          <EmptyCrm query={query} />
        ) : shown.length === 0 ? (
          <EmptyCrm query={query} />
        ) : (
          <div className="space-y-3">
            {shown.map((customer) => (
              <CustomerCard
                key={customer.key}
                customer={customer}
                sellerName={seller.name}
                onOpen={() => setSelected(customer)}
              />
            ))}
          </div>
        )}
      </main>

      {selected && (
        <CustomerSheet customer={selected} sellerName={seller.name} onClose={() => setSelected(null)} />
      )}

      {/* Footer fantôme pour l'accessibilité visuelle */}
      {!loading && !error && customers.length > 0 && (
        <p className="mt-4 text-center text-xs font-bold text-[#0F2B20]/40">
          {shown.length} client{shown.length > 1 ? "s" : ""} affiché{shown.length > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}