"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveSeller } from "../app/components/sellerContext";
import {
  assignOrderDriver,
  createDemoOrder,
  getSellerDeliverySettings,
  getSellerOrders,
  markOrderSharedToDriver,
  pauseBotForCustomer,
  resumeBotForCustomer,
  sendSellerManualReply,
  updateOrderStatus,
} from "../app/actions";
import { getSellerAccessToken } from "./seller-auth-client";
import { friendlyError } from "./user-facing-error";
import { getSimpleOrderStatus, getNextOrder, withTimeout } from "./order-utils";

export function useOrders() {
  const seller = useActiveSeller();
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMoreOrders, setLoadingMoreOrders] = useState(false);
  const [hasMoreOrders, setHasMoreOrders] = useState(true);
  const [loadingNote, setLoadingNote] = useState("Chargement des ventes...");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filter, setFilter] = useState("PENDING");
  const [demoBusy, setDemoBusy] = useState(false);
  const [error, setError] = useState("");

  const fetchOrders = useCallback(async function fetchOrders() {
    if (!seller.slug) {
      setOrders([]);
      setDrivers([]);
      setLoading(false);
      setError("Reconnectez-vous pour voir vos ventes.");
      return;
    }

    try {
      setLoading(true);
      setLoadingNote("Chargement des ventes...");
      setError("");
      const slowTimer = setTimeout(() => {
        setLoadingNote("La connexion est lente. On essaie encore quelques secondes...");
      }, 4500);

      try {
        const token = await withTimeout(
          getSellerAccessToken(),
          "Reconnectez-vous pour voir vos ventes.",
          8000,
        );

        const orderData = await withTimeout(
          getSellerOrders(seller.slug, token),
          "Commandes trop longues a charger. Actualisez la page.",
        );

        let deliveryData = { drivers: [] };
        try {
          deliveryData = await withTimeout(
            getSellerDeliverySettings(seller.slug, token),
            "Réglages livraison trop longs à charger.",
            8000,
          );
        } catch (deliveryError) {
          console.warn("Delivery settings skipped:", deliveryError);
        }

        setOrders(orderData || []);
        setHasMoreOrders((orderData || []).length >= 100);
        setDrivers(deliveryData?.drivers || []);
      } finally {
        clearTimeout(slowTimer);
      }
    } catch (err) {
      console.warn("Orders unavailable:", err);
      const sessionExpired = /session vendeur|reconnecte/i.test(String(err?.message || ""));
      setError(sessionExpired
        ? "Reconnectez-vous pour voir vos ventes."
        : friendlyError(err, "Commandes non chargées. Vérifiez la connexion puis actualisez."));
    } finally {
      setLoadingNote("Chargement des ventes...");
      setLoading(false);
    }
  }, [seller.slug]);

  async function loadMoreOrders() {
    if (!seller.slug || loadingMoreOrders || orders.length === 0) return;
    const last = orders[orders.length - 1];
    if (!last?.created_at) {
      setHasMoreOrders(false);
      return;
    }

    try {
      setLoadingMoreOrders(true);
      setError("");
      const token = await getSellerAccessToken();
      const moreData = await withTimeout(
        getSellerOrders(seller.slug, token, { limit: 100, before: last.created_at }),
        "Commandes trop longues a charger. Actualisez la page.",
      );
      if (!moreData || moreData.length === 0) {
        setHasMoreOrders(false);
        return;
      }
      setOrders((current) => {
        const existing = new Set(current.map((order) => order.id));
        return [...current, ...moreData.filter((order) => !existing.has(order.id))];
      });
      setHasMoreOrders(moreData.length >= 100);
    } catch (err) {
      console.warn("More orders unavailable:", err);
      setError(friendlyError(err, "Commandes supplémentaires non chargées. Actualisez puis réessayez."));
    } finally {
      setLoadingMoreOrders(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchOrders();
    }, 0);

    return () => clearTimeout(timeout);
  }, [fetchOrders]);

  async function markStatus(order, status) {
    try {
      const token = await getSellerAccessToken();
      const result = await updateOrderStatus(order.id, status, token);
      await fetchOrders();
      setSelectedOrder((current) => current ? { ...current, ...result, status: result?.status || status } : current);
    } catch (err) {
      setError(friendlyError(err, "Statut non mis a jour. Gardez la commande ouverte puis relancez l'action."));
    }
  }

  async function markPaid(order) {
    await markStatus(order, "PAID");
  }

  async function cancelOrder(order) {
    await markStatus(order, "CANCELLED");
  }

  async function markDriverAssigned(order, driver) {
    try {
      const token = await getSellerAccessToken();
      const result = await assignOrderDriver(order.id, driver.id, token);
      setOrders((current) => current.map((item) => (
        item.id === order.id
          ? { ...item, ...result, delivery_drivers: driver }
          : item
      )));
      setSelectedOrder((current) => current?.id === order.id ? { ...current, ...result, delivery_drivers: driver } : current);
    } catch (err) {
      setError(friendlyError(err, "Partage livreur non fait. Vérifiez le numéro du livreur."));
    }
  }

  async function markSharedToDriver(order) {
    try {
      const token = await getSellerAccessToken();
      const result = await markOrderSharedToDriver(order.id, token);
      setOrders((current) => current.map((item) => (
        item.id === order.id ? { ...item, ...result } : item
      )));
      setSelectedOrder((current) => current?.id === order.id ? { ...current, ...result } : current);
    } catch (err) {
      setError(friendlyError(err, "Commande partagee, mais le statut livraison n'a pas ete mis a jour."));
    }
  }

  function updateOrderHandoff(orderId, handoff) {
    setOrders((current) => current.map((item) => (
      item.id === orderId ? { ...item, handoff } : item
    )));
    setSelectedOrder((current) => current?.id === orderId ? { ...current, handoff } : current);
  }

  async function handlePauseBot(order) {
    try {
      const token = await getSellerAccessToken();
      const result = await pauseBotForCustomer(seller.slug, order.customer_phone, token);
      updateOrderHandoff(order.id, result?.handoff || null);
      return result;
    } catch (err) {
      const message = friendlyError(err, "Pause bot non appliquée. Vérifiez le numéro client.");
      setError(message);
      throw new Error(message);
    }
  }

  async function handleResumeBot(order) {
    try {
      const token = await getSellerAccessToken();
      await resumeBotForCustomer(seller.slug, order.customer_phone, token);
      updateOrderHandoff(order.id, null);
      return { ok: true };
    } catch (err) {
      const message = friendlyError(err, "Bot non réactivé. Réessayez dans quelques secondes.");
      setError(message);
      throw new Error(message);
    }
  }

  async function handleManualReply(order, text) {
    try {
      const token = await getSellerAccessToken();
      const result = await sendSellerManualReply(seller.slug, order.customer_phone, text, token);
      updateOrderHandoff(order.id, result?.handoff || order.handoff || null);
      return result;
    } catch (err) {
      const message = friendlyError(err, "Message client non envoyé. Vérifiez WhatsApp puis réessayez.");
      setError(message);
      throw new Error(message);
    }
  }

  async function handleCreateDemoOrder() {
    try {
      setDemoBusy(true);
      setError("");
      const token = await getSellerAccessToken();
      const demoOrder = await createDemoOrder(seller.slug, token);
      await fetchOrders();
      setFilter("PENDING");
      if (demoOrder?.id) {
        setSelectedOrder(demoOrder);
      }
    } catch (err) {
      console.warn("Demo order create unavailable:", err);
      setError(friendlyError(err, "Commande test non créée. Vérifiez qu'une boutique est bien active."));
    } finally {
      setDemoBusy(false);
    }
  }

  const filteredOrders = useMemo(() => {
    if (filter === "WORK") return orders.filter((order) => ["PENDING", "PAID", "PREPARED", "IN_DELIVERY"].includes(getSimpleOrderStatus(order)));
    if (filter === "DELIVERY") return orders.filter((order) => ["PREPARED", "IN_DELIVERY"].includes(getSimpleOrderStatus(order)));
    if (filter === "ALL") return orders;
    return orders.filter((order) => getSimpleOrderStatus(order) === filter);
  }, [filter, orders]);
  const activeCount = orders.filter((order) => ["PENDING", "PAID"].includes(getSimpleOrderStatus(order))).length;
  const verifyCount = orders.filter((order) => getSimpleOrderStatus(order) === "PENDING").length;
  const prepareCount = orders.filter((order) => getSimpleOrderStatus(order) === "PAID").length;
  const readyCount = orders.filter((order) => getSimpleOrderStatus(order) === "PREPARED").length;
  const deliveryCount = orders.filter((order) => getSimpleOrderStatus(order) === "IN_DELIVERY").length;
  const toFinishCount = readyCount + deliveryCount;
  const doneCount = orders.filter((order) => getSimpleOrderStatus(order) === "DELIVERED").length;
  const nextOrder = getNextOrder(orders);
  const sessionExpired = /reconnectez-vous/i.test(error);
  function getFilterCount(item) {
    if (item === "WORK") return activeCount + toFinishCount;
    if (item === "PENDING") return verifyCount;
    if (item === "PREPARED") return readyCount;
    if (item === "DELIVERY") return readyCount + deliveryCount;
    if (item === "IN_DELIVERY") return deliveryCount;
    if (item === "DELIVERED") return doneCount;
    if (item === "ALL") return orders.length;
    return orders.filter((order) => getSimpleOrderStatus(order) === item).length;
  }

  return {
    orders,
    drivers,
    loading,
    loadingMoreOrders,
    hasMoreOrders,
    loadingNote,
    selectedOrder,
    filter,
    demoBusy,
    error,
    sessionExpired,
    filteredOrders,
    nextOrder,
    activeCount,
    verifyCount,
    prepareCount,
    deliveryCount,
    toFinishCount,
    doneCount,
    getFilterCount,
    setFilter,
    setSelectedOrder,
    fetchOrders,
    loadMoreOrders,
    markPaid,
    markStatus,
    cancelOrder,
    markDriverAssigned,
    markSharedToDriver,
    handlePauseBot,
    handleResumeBot,
    handleManualReply,
    handleCreateDemoOrder,
  };
}