import webpush from "web-push";
import { supabaseAdmin } from "./supabase-admin";

const VAPID_SUBJECT = process.env.VAPID_SUBJECT
  || (process.env.NEXT_PUBLIC_APP_URL && `mailto:no-reply@${new URL(process.env.NEXT_PUBLIC_APP_URL).hostname}`)
  || "mailto:no-reply@tikchop.app";

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;

  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidConfigured = true;
    return true;
  } catch {
    return false;
  }
}

function decodeBase64Url(value) {
  if (!value) return "";
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf8");
}

/**
 * Envoie une notification push a tous les abonnements d'un vendeur.
 * @param {{ ownerUserId?: string, sellerId?: string }} target
 * @param {{ title: string, body: string, url?: string }} payload
 */
export async function sendPushToSeller({ ownerUserId, sellerId }, { title, body, url = "/dashboard" }) {
  if (!supabaseAdmin) return { sent: 0, skipped: true };
  if (!ensureVapid()) return { sent: 0, skipped: "vapid-not-configured" };

  let ownerUserIdResolved = ownerUserId;

  if (!ownerUserIdResolved && sellerId) {
    const { data: seller } = await supabaseAdmin
      .from("sellers")
      .select("owner_user_id")
      .eq("id", sellerId)
      .maybeSingle();
    ownerUserIdResolved = seller?.owner_user_id;
  }

  if (!ownerUserIdResolved) return { sent: 0, skipped: true };

  const { data: subscriptions, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("owner_user_id", ownerUserIdResolved);

  if (error || !subscriptions?.length) return { sent: 0, subscriptions: subscriptions?.length || 0 };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const notification = {
    title,
    body,
    data: { url },
    icon: `${baseUrl}/icon-192.png`,
    badge: `${baseUrl}/icon-192.png`,
  };

  let sent = 0;
  const staleEndpoints = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: decodeBase64Url(sub.p256dh),
              auth: decodeBase64Url(sub.auth),
            },
          },
          JSON.stringify(notification),
        );
        sent += 1;
      } catch (pushError) {
        const statusCode = pushError?.statusCode;
        // Abonnements declares morts par le navigateur (endpoint supprime/expire).
        if (statusCode === 404 || statusCode === 410) {
          staleEndpoints.push(sub.endpoint);
        } else {
          console.error("Push send failed:", pushError?.message || pushError);
        }
      }
    }),
  );

  if (staleEndpoints.length > 0) {
    await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .in("endpoint", staleEndpoints)
      .catch(() => {});
  }

  return { sent, subscriptions: subscriptions.length };
}