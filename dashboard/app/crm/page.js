"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { getSellerOrders } from "../actions";
import { useActiveSeller } from "../components/sellerContext";
import { getSellerAccessToken } from "../../lib/seller-auth-client";
import { friendlyError } from "../../lib/user-facing-error";
import {
  segmentLabels,
  daysSince,
  getItemsLabel,
  getOrderRef,
  buildCustomers,
  getSegmentCount,
} from "../../lib/crm-utils";
import { CrmHero, StatTile } from "./components/CrmHero";
import { CustomerCard } from "./components/CustomerCard";
import { CustomerSheet } from "./components/CustomerSheet";
import { EmptyCrm } from "./components/EmptyCrm";

export default function CrmPage() {
  const seller = useActiveSeller();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("ALL");
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const fetchCrm = useCallback(async function fetchCrm() {
    if (!seller.slug) return;

    try {
      setLoading(true);
      setError("");
      const token = await getSellerAccessToken();
      const orderData = await getSellerOrders(seller.slug, token);
      setOrders(orderData || []);
    } catch (err) {
      console.error("CRM fetch error:", err);
      setError(friendlyError(err, "Les clients ne se chargent pas. Verifiez la connexion puis actualisez."));
    } finally {
      setLoading(false);
    }
  }, [seller.slug]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchCrm();
    }, 0);

    return () => clearTimeout(timeout);
  }, [fetchCrm]);

  const customers = useMemo(() => buildCustomers(orders), [orders]);

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesSegment = segment === "ALL"
        || (segment === "FOLLOW_UP" && customer.shouldFollowUp)
        || (segment === "LOYAL" && customer.isLoyal)
        || (segment === "NEW" && customer.orderCount === 1);

      if (!matchesSegment) return false;
      if (!normalizedQuery) return true;

      const searchable = [
        customer.phone,
        customer.zone,
        customer.address,
        getItemsLabel(customer.lastOrder),
        getOrderRef(customer.lastOrder),
      ].join(" ").toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [customers, query, segment]);

  const stats = useMemo(() => {
    const followUpCount = customers.filter((customer) => customer.shouldFollowUp).length;
    const loyalCount = customers.filter((customer) => customer.isLoyal).length;
    const activeCount = customers.filter((customer) => daysSince(customer.lastOrder?.created_at) <= 30).length;
    const estimatedSales = customers.reduce((total, customer) => total + customer.totalSpent, 0);

    return {
      followUpCount,
      loyalCount,
      activeCount,
      estimatedSales,
    };
  }, [customers]);

  return (
    <div className="app-shell pb-[calc(7rem+env(safe-area-inset-bottom,0px))]">
      <header className={`mobile-top ${selectedCustomer ? "hidden md:block" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="quiet-label text-[#c2572b]">Carnet vendeur</p>
            <h1 className="mt-1 font-display text-3xl font-black leading-10 text-[#2b2219]">Clients</h1>
          </div>
          <button onClick={fetchCrm} className="app-icon-button bg-[#2b2219] text-white" aria-label="Actualiser les clients">
            <RefreshCw size={19} strokeWidth={2.5} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <CrmHero stats={stats} totalCustomers={customers.length} />

        <div className="mt-4 grid grid-cols-3 gap-px bg-[#2b2219]/8 overflow-hidden rounded-[20px] ring-1 ring-[#2b2219]/10">
          <StatTile label="A relancer" value={stats.followUpCount} tone="dark" />
          <StatTile label="Bons clients" value={stats.loyalCount} tone="green" />
          <StatTile label="Actifs" value={stats.activeCount} />
        </div>

        <div className="mt-4 overflow-hidden rounded-[20px] bg-[#fbf6ee] ring-1 ring-[#2b2219]/10">
          <label className="flex min-h-[48px] items-center gap-2 px-3">
            <Search size={17} className="shrink-0 text-[#c2572b]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#2b2219] outline-none placeholder:text-[#2b2219]/40"
              placeholder="Rechercher un client..."
            />
          </label>
        </div>

        <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {["ALL", "FOLLOW_UP", "LOYAL", "NEW"].map((item) => {
            const active = segment === item;
            return (
              <button
                key={item}
                onClick={() => setSegment(item)}
                className={`flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-black transition-colors ${
                  active
                    ? "bg-[#2b2219] text-white"
                    : "bg-white text-[#2b2219] ring-1 ring-[#2b2219]/10"
                }`}
              >
                {segmentLabels[item]}
                <span className={`rounded-full px-1.5 py-0.5 text-[0.58rem] font-black ${
                  active ? "bg-white/15 text-white" : "bg-[#c2572b]/10 text-[#c2572b]"
                }`}>
                  {getSegmentCount(customers, item)}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {error && (
        <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          {error}
          <p className="mt-2 text-xs">La liste se remettra a jour des que les commandes seront rechargees.</p>
        </div>
      )}

      <section className="mt-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#c2572b] border-t-transparent" />
            <p className="mt-4 font-black text-[#2b2219]/40">Chargement...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <EmptyCrm query={query} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredCustomers.map((customer) => (
              <CustomerCard
                key={customer.key}
                customer={customer}
                sellerName={seller.name}
                onOpen={() => setSelectedCustomer(customer)}
              />
            ))}
          </div>
        )}
      </section>

      {selectedCustomer && (
        <CustomerSheet
          customer={selectedCustomer}
          sellerName={seller.name}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
}
