"use client";

import { useState, useSyncExternalStore } from "react";
import { Bell, BellOff } from "lucide-react";
import { getSellerAccessToken } from "../../lib/seller-auth-client";

const SW_URL = "/sw.js";
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function isPushSupported() {
  return (
    typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && typeof Notification !== "undefined"
  );
}

const permissionSubscribe = () => () => {
  // Notification.permission est stable; un event listener n'est pas necessaire.
  // On force un re-render a chaque retour de requestPermission via setState local.
};

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function saveSubscription(subscription) {
  const token = await getSellerAccessToken();
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(subscription),
  });
  if (!response.ok) {
    throw new Error("Enregistrement push échoué.");
  }
}

async function deleteSubscription(subscription) {
  try {
    const token = await getSellerAccessToken();
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(subscription),
    });
  } catch {
    // silencieux : la souscription côté navigateur est déjà supprimée
  }
}

function getPermission() {
  return isPushSupported() ? Notification.permission : "unsupported";
}

export default function PushNotificationsManager() {
  const [, setTick] = useState(0);
  const permission = useSyncExternalStore(permissionSubscribe, getPermission);
  const [busy, setBusy] = useState(false);

  async function enable() {
    if (!isPushSupported()) return;
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setTick((value) => value + 1);
      if (result !== "granted") return;

      const registration = await navigator.serviceWorker.register(SW_URL);
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await saveSubscription(existing);
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await saveSubscription(subscription);
    } catch (error) {
      console.error("Push enable error:", error);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!isPushSupported()) return;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await deleteSubscription(subscription);
        await subscription.unsubscribe();
      }
      setTick((value) => value + 1);
    } catch (error) {
      console.error("Push disable error:", error);
    } finally {
      setBusy(false);
    }
  }

  const supported = isPushSupported();
  const enabled = supported && permission === "granted";

  if (!supported) return null;

  return (
    <div className="flex items-center gap-3 rounded-[22px] bg-white px-4 py-3 ring-1 ring-[#0F2B20]/8 active:scale-[0.99]">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${enabled ? "bg-[#34D399] text-[#0F2B20]" : "bg-[#E8F7EE] text-[#059669]"}`}>
        {enabled ? <Bell size={19} /> : <BellOff size={19} />}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-sm font-black text-[#0F2B20]">Alertes commandes</strong>
        <small className="block text-xs font-bold text-[#4E6E61]">
          {enabled
            ? "Active — nouvelles commandes sur votre téléphone"
            : "Recevez une alerte à chaque nouvelle commande"}
        </small>
      </span>
      <button
        type="button"
        onClick={enabled ? disable : enable}
        disabled={busy}
        className={`flex min-h-[44px] items-center justify-center rounded-2xl px-3 text-xs font-extrabold disabled:opacity-50 ${enabled ? "bg-[#0F2B20] text-[#34D399]" : "bg-[#059669] text-white"}`}
      >
        {busy ? "..." : enabled ? "Couper" : "Activer"}
      </button>
    </div>
  );
}