import { useState } from "react";
import { Linking, Pressable, Share, Text, TextInput, View } from "react-native";

import { EmptyState, OrderCard, orderSummaryText, Panel, PrimaryButton, StatCard } from "@/components/cards";
import { Screen } from "@/components/screen";
import { useOverview } from "@/components/use-overview";
import { pauseBotForCustomer, resumeBotForCustomer, sendManualReply, updateOrderStatus } from "@/lib/tikchop-api";
import { colors } from "@/theme/colors";
import { Order } from "@/types/tikchop";

export default function OrdersScreen() {
  const { overview, loading, refresh } = useOverview();
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [handoffBusyId, setHandoffBusyId] = useState("");
  const [replyByOrder, setReplyByOrder] = useState<Record<string, string>>({});
  const orders = overview?.orders || [];
  const activeOrders = orders.filter((order) => ["PENDING", "PAID", "PREPARED"].includes(order.status)).length;
  const pausedOrders = orders.filter((order) => Boolean(order.handoff)).length;
  const sellerId = overview?.seller.id || "";

  async function handleStatus(orderId: string, status: "PAID" | "PREPARED" | "DELIVERED") {
    if (!sellerId || overview?.source !== "supabase") {
      setNotice("Connectez une vraie boutique Supabase pour modifier les commandes.");
      return;
    }
    setBusyId(orderId);
    setNotice("");
    try {
      await updateOrderStatus(orderId, sellerId, status);
      await refresh();
      setNotice("Commande mise a jour.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Commande non mise a jour.");
    } finally {
      setBusyId("");
    }
  }

  async function shareOrder(order: Order) {
    await Share.share({
      message: orderSummaryText(order, overview?.seller.name || "Tikchop"),
    });
  }

  async function contactCustomer(order: Order) {
    const digits = String(order.customer_phone || "").replace(/\D/g, "");
    if (!digits) {
      setNotice("Numero client indisponible pour cette commande.");
      return;
    }
    const message = encodeURIComponent(`Bonjour, c'est ${overview?.seller.name || "Tikchop"}. Je vous contacte pour votre commande ${order.order_ref || ""}.`);
    await Linking.openURL(`https://wa.me/${digits}?text=${message}`);
  }

  function customerPhone(order: Order) {
    return String(order.customer_phone || "").replace(/\D/g, "");
  }

  function setReply(orderId: string, text: string) {
    setReplyByOrder((current) => ({ ...current, [orderId]: text }));
  }

  async function handlePauseBot(order: Order) {
    const phone = customerPhone(order);
    if (!phone) {
      setNotice("Numero client indisponible pour mettre le bot en pause.");
      return;
    }

    setHandoffBusyId(order.id);
    setNotice("");
    try {
      await pauseBotForCustomer(phone);
      await refresh();
      setNotice("Bot en pause pour ce client. Vous pouvez repondre vous-meme.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Pause bot impossible.");
    } finally {
      setHandoffBusyId("");
    }
  }

  async function handleResumeBot(order: Order) {
    const phone = customerPhone(order);
    if (!phone) {
      setNotice("Numero client indisponible.");
      return;
    }

    setHandoffBusyId(order.id);
    setNotice("");
    try {
      await resumeBotForCustomer(phone);
      await refresh();
      setNotice("Bot reactive pour ce client.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Reactivation bot impossible.");
    } finally {
      setHandoffBusyId("");
    }
  }

  async function handleManualReply(order: Order) {
    const phone = customerPhone(order);
    const text = String(replyByOrder[order.id] || "").trim();
    if (!phone) {
      setNotice("Numero client indisponible pour envoyer le message.");
      return;
    }
    if (!text) {
      setNotice("Ecrivez d'abord le message client.");
      return;
    }

    setHandoffBusyId(order.id);
    setNotice("");
    try {
      await sendManualReply(phone, text);
      setReplyByOrder((current) => ({ ...current, [order.id]: "" }));
      await refresh();
      setNotice("Message envoye. Le bot reste en pause pour ce client.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Message non envoye.");
    } finally {
      setHandoffBusyId("");
    }
  }

  return (
    <Screen title="Commandes" refreshing={loading} onRefresh={refresh}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <StatCard label="Actives" value={activeOrders} tone="green" />
        <StatCard label="Bot pause" value={pausedOrders} tone="blue" />
      </View>

      <Panel tone="green">
        <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>
          File de commande
        </Text>
        <Text selectable style={{ color: colors.muted, fontSize: 14, fontWeight: "600", lineHeight: 21 }}>
          Ici vous validez le paiement, la preparation, la livraison et les conversations reprises a Tikchop.
        </Text>
        {notice ? (
          <Text selectable style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800", lineHeight: 19 }}>
            {notice}
          </Text>
        ) : null}
      </Panel>

      {orders.length ? (
      <View style={{ gap: 12 }}>
        {orders.map((order) => (
          <View key={order.id} style={{ gap: 8 }}>
            <OrderCard
              busy={busyId === order.id}
              onStatusChange={(status) => handleStatus(order.id, status)}
              order={order}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable onPress={() => shareOrder(order)} style={smallActionStyle}>
                <Text style={smallActionText}>Partager</Text>
              </Pressable>
              <Pressable onPress={() => contactCustomer(order)} style={smallActionStyle}>
                <Text style={smallActionText}>WhatsApp client</Text>
              </Pressable>
            </View>
            <ManualReplyBox
              busy={handoffBusyId === order.id}
              onPause={() => handlePauseBot(order)}
              onReply={() => handleManualReply(order)}
              onResume={() => handleResumeBot(order)}
              order={order}
              reply={replyByOrder[order.id] || ""}
              setReply={(text) => setReply(order.id, text)}
            />
          </View>
        ))}
      </View>
      ) : (
        <EmptyState
          title="Aucune commande"
          detail="Quand Tikchop prend une commande sur WhatsApp, elle arrive ici avec paiement et livraison."
          action={<PrimaryButton label="Voir WhatsApp" onPress={() => undefined} disabled />}
        />
      )}
    </Screen>
  );
}

function ManualReplyBox({
  busy,
  onPause,
  onReply,
  onResume,
  order,
  reply,
  setReply,
}: {
  busy: boolean;
  onPause: () => void;
  onReply: () => void;
  onResume: () => void;
  order: Order;
  reply: string;
  setReply: (text: string) => void;
}) {
  const pausedUntil = order.handoff?.paused_until ? new Date(order.handoff.paused_until) : null;
  const pausedLabel = pausedUntil
    ? `Bot en pause jusqu'a ${pausedUntil.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
    : "Le bot peut encore repondre a ce client.";

  return (
    <View style={manualBoxStyle}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: order.handoff ? colors.green : colors.ink, fontSize: 14, fontWeight: "900" }}>
          Reponse vendeur
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", lineHeight: 17 }}>
          {pausedLabel}
        </Text>
      </View>
      <TextInput
        editable={!busy}
        multiline
        onChangeText={setReply}
        placeholder="Ecrire au client depuis l'app..."
        placeholderTextColor="#9A9082"
        style={replyInputStyle}
        value={reply}
      />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable disabled={busy} onPress={order.handoff ? onResume : onPause} style={[manualActionStyle, busy ? disabledActionStyle : null]}>
          <Text style={manualActionText}>{order.handoff ? "Reprendre bot" : "Je reponds"}</Text>
        </Pressable>
        <Pressable disabled={busy || !reply.trim()} onPress={onReply} style={[sendActionStyle, busy || !reply.trim() ? disabledActionStyle : null]}>
          <Text style={sendActionText}>{busy ? "Envoi..." : "Envoyer"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const smallActionStyle = {
  alignItems: "center" as const,
  backgroundColor: colors.card,
  borderColor: colors.line,
  borderRadius: 22,
  borderWidth: 1,
  flex: 1,
  minHeight: 44,
  justifyContent: "center" as const,
};

const smallActionText = {
  color: colors.ink,
  fontSize: 13,
  fontWeight: "900" as const,
};

const manualBoxStyle = {
  backgroundColor: colors.card,
  borderColor: colors.line,
  borderRadius: 26,
  borderWidth: 1,
  gap: 12,
  padding: 14,
};

const replyInputStyle = {
  backgroundColor: colors.field,
  borderColor: colors.line,
  borderRadius: 22,
  borderWidth: 0,
  color: colors.ink,
  fontSize: 14,
  fontWeight: "700" as const,
  minHeight: 74,
  paddingHorizontal: 12,
  paddingVertical: 10,
  textAlignVertical: "top" as const,
};

const manualActionStyle = {
  alignItems: "center" as const,
  backgroundColor: colors.card,
  borderColor: colors.line,
  borderRadius: 999,
  borderWidth: 1,
  flex: 1,
  minHeight: 44,
  justifyContent: "center" as const,
};

const sendActionStyle = {
  ...manualActionStyle,
  backgroundColor: colors.primary,
};

const disabledActionStyle = {
  opacity: 0.55,
};

const manualActionText = {
  color: colors.ink,
  fontSize: 13,
  fontWeight: "900" as const,
};

const sendActionText = {
  color: "white",
  fontSize: 13,
  fontWeight: "900" as const,
};
