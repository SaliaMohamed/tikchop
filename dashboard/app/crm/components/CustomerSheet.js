"use client";

import { CheckCircle2, Clock3, MessageCircle, Phone, ShoppingBag, Star, X } from "lucide-react";
import { buildWhatsappHref, getCustomerResponseTemplates } from "../../../lib/customer-response-playbook";
import {
  cleanPhone,
  formatDate,
  formatPrice,
  getCustomerName,
  getItemCount,
  getItemsLabel,
  getOrderRef,
  getOrderTotal,
  statusLabels,
} from "../../../lib/crm-utils";
import { CustomerResponseRail } from "./CustomerResponseRail";

function getRecommendation(customer) {
  if (customer.lastOrder?.status === "PENDING") {
    return {
      icon: <Clock3 size={20} />,
      title: "Confirmer ce client",
      body: "Le client a commence l'achat. Envoie un message court pour verifier adresse et paiement.",
    };
  }

  if (customer.lastOrder?.status === "PREPARED") {
    return {
      icon: <ShoppingBag size={20} />,
      title: "Finir la livraison",
      body: "Le paquet semble pret. Confirme le passage du livreur et ferme la commande apres reception.",
    };
  }

  if (customer.isLoyal) {
    return {
      icon: <Star size={20} />,
      title: "Bon client",
      body: "Il a deja achete plusieurs fois. Envoyez les nouveautes en priorite avec un message personnel.",
    };
  }

  return {
    icon: <CheckCircle2 size={20} />,
    title: "Garder le contact",
    body: "Une relance simple avec 2 ou 3 nouveaux articles peut ramener ce client vers la boutique.",
  };
}

export function CustomerSheet({ customer, sellerName, onClose }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const responseTemplates = getCustomerResponseTemplates(customer, { sellerName, origin });
  const bestResponse = responseTemplates[0] || null;
  const followUrl = buildWhatsappHref(customer.phone, bestResponse?.text);
  const lastOrder = customer.lastOrder;
  const total = customer.totalSpent > 0 ? customer.totalSpent : customer.totalEstimated;
  const recommendation = getRecommendation(customer);

  return (
    <div className="fixed inset-0 z-[260] flex items-end bg-black/40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur-sm md:items-center">
      <div className="mx-auto max-h-[92vh] w-full max-w-[480px] overflow-hidden rounded-[28px] bg-[#fbf6ee] shadow-2xl ring-1 ring-white/20">
        <div className="relative overflow-hidden bg-[#2b2219] p-5 text-white">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-[#f0954c]" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#f0954c]/80">Fiche client</p>
              <h2 className="mt-1 truncate font-display text-2xl font-black leading-8 text-white">{getCustomerName(customer)}</h2>
              <p className="mt-0.5 text-xs font-bold leading-5 text-white/55">{customer.zone || customer.address || "Adresse a confirmer"}</p>
            </div>
            <button onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white" aria-label="Fermer">
              <X size={17} />
            </button>
          </div>
          <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-[18px] bg-white/6 p-3 ring-1 ring-white/10">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.1em] text-white/50">Total client</p>
              <p className="mt-0.5 font-display text-lg font-black text-[#f0954c]">{formatPrice(total)}</p>
            </div>
            <div className="rounded-[18px] bg-white/6 p-3 ring-1 ring-white/10">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.1em] text-white/50">Commandes</p>
              <p className="mt-0.5 font-display text-lg font-black text-white">{customer.orderCount}</p>
            </div>
          </div>
        </div>

        <div className="no-scrollbar max-h-[58vh] space-y-4 overflow-y-auto p-4">
          <div className="rounded-[22px] bg-white p-3 ring-1 ring-[#2b2219]/8">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fbf6ee] text-[#c2572b] ring-1 ring-[#2b2219]/5">
                {recommendation.icon}
              </span>
              <div>
                <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#c2572b]">Action</p>
                <p className="mt-0.5 font-display text-base font-black leading-5 text-[#2b2219]">{recommendation.title}</p>
                <p className="mt-0.5 text-xs font-bold leading-4 text-[#2b2219]/60">{recommendation.body}</p>
              </div>
            </div>
          </div>

          <CustomerResponseRail templates={responseTemplates} phoneNumber={customer.phone} />

          <section>
            <div className="flex items-center gap-2 border-b border-[#2b2219]/8 pb-2">
              <ShoppingBag size={14} className="text-[#c2572b]" />
              <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#c2572b]">Derniere Commande</p>
            </div>
            <div className="mt-3 rounded-[22px] bg-white p-4 ring-1 ring-[#2b2219]/8">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg font-black text-[#2b2219]">#{getOrderRef(lastOrder)}</p>
                  <p className="mt-0.5 truncate text-xs font-bold text-[#2b2219]/60">{getItemsLabel(lastOrder)}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#fbf6ee] px-2.5 py-1 text-[0.65rem] font-black uppercase text-[#c2572b] ring-1 ring-[#2b2219]/10">
                  {statusLabels[lastOrder?.status] || lastOrder?.status || "Statut"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-[16px] bg-[#fbf6ee] p-2.5 ring-1 ring-[#2b2219]/5">
                  <p className="text-[0.62rem] font-black uppercase text-[#2b2219]/50">Total</p>
                  <p className="mt-0.5 font-display text-base font-black text-[#c2572b]">{formatPrice(getOrderTotal(lastOrder))}</p>
                </div>
                <div className="rounded-[16px] bg-[#fbf6ee] p-2.5 ring-1 ring-[#2b2219]/5">
                  <p className="text-[0.62rem] font-black uppercase text-[#2b2219]/50">Articles</p>
                  <p className="mt-0.5 font-display text-base font-black text-[#2b2219]">{getItemCount(lastOrder)}</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 border-b border-[#2b2219]/8 pb-2">
              <Clock3 size={14} className="text-[#c2572b]" />
              <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#c2572b]">Historique</p>
            </div>
            <div className="mt-3 space-y-2">
              {customer.orders.map((order) => (
                <div key={order.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-[18px] bg-white p-3 ring-1 ring-[#2b2219]/8">
                  <div className="min-w-0">
                    <p className="font-display text-sm font-black text-[#2b2219]">#{getOrderRef(order)}</p>
                    <p className="mt-0.5 truncate text-[0.65rem] font-bold text-[#2b2219]/50">{formatDate(order.created_at)} - {getItemsLabel(order)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-sm font-black text-[#c2572b]">{formatPrice(getOrderTotal(order))}</p>
                    <p className="mt-0.5 text-[0.62rem] font-black text-[#2b2219]/40">{statusLabels[order.status] || order.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-2 border-t border-[#2b2219]/8 bg-[#fbf6ee] p-3">
          <a
            href={followUrl || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[20px] text-sm font-black active:scale-[0.99] ${
              followUrl
                ? "bg-[#c2572b] text-white shadow-sm"
                : "pointer-events-none bg-[#2b2219]/5 text-[#2b2219]/30"
            }`}
          >
            <MessageCircle size={18} />
            {bestResponse?.title || "Envoyer une relance WhatsApp"}
          </a>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={customer.phone ? `tel:${cleanPhone(customer.phone)}` : undefined}
              className={`flex min-h-[46px] items-center justify-center gap-2 rounded-[18px] text-xs font-black ${
                customer.phone ? "bg-white text-[#2b2219] ring-1 ring-[#2b2219]/10 shadow-sm" : "pointer-events-none bg-[#2b2219]/5 text-[#2b2219]/30"
              }`}
            >
              <Phone size={16} />
              Appeler
            </a>
            <button type="button" onClick={onClose} className="flex min-h-[46px] items-center justify-center rounded-[18px] bg-white text-xs font-black text-[#2b2219] ring-1 ring-[#2b2219]/10 shadow-sm">
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}