import { ReactNode } from "react";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { compactDate, formatCfa, statusLabel } from "@/lib/format";
import { colors, radii } from "@/theme/colors";
import { Order, Product } from "@/types/tikchop";

export function Panel({ children, tone = "light" }: { children: ReactNode; tone?: "light" | "dark" | "green" | "blue" }) {
  const backgroundColor = tone === "dark" ? colors.dark : tone === "green" ? colors.softGreen : tone === "blue" ? colors.softBlue : colors.card;
  return (
    <View
      style={{
        backgroundColor,
        borderColor: tone === "light" ? colors.line : "transparent",
        borderCurve: "continuous",
        borderRadius: radii.lg,
        borderWidth: 1,
        gap: 16,
        padding: 20,
      }}
    >
      {children}
    </View>
  );
}

export function StatCard({ label, value, tone = "light" }: { label: string; value: string | number; tone?: "light" | "green" | "blue" | "dark" }) {
  const backgroundColor = tone === "green" ? colors.softGreen : tone === "blue" ? colors.softBlue : tone === "dark" ? colors.dark : colors.card;
  const valueColor = tone === "dark" ? "white" : tone === "green" ? colors.primary : colors.ink;
  const labelColor = tone === "dark" ? "#D4D4D8" : colors.muted;
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor,
        borderCurve: "continuous",
        borderRadius: radii.md,
        flex: 1,
        gap: 6,
        minHeight: 76,
        justifyContent: "center",
        paddingHorizontal: 14,
      }}
    >
      <Text selectable style={{ color: valueColor, fontSize: 24, fontVariant: ["tabular-nums"], fontWeight: "800", lineHeight: 29 }}>
        {value}
      </Text>
      <Text selectable style={{ color: labelColor, fontSize: 11, fontWeight: "800", textTransform: "uppercase" }}>
        {label}
      </Text>
    </View>
  );
}

export function ActionLink({ href, title, detail }: { href: string; title: string; detail: string }) {
  return (
    <Link href={href} asChild>
      <Pressable
        style={{
          backgroundColor: colors.card,
          borderCurve: "continuous",
          borderRadius: radii.lg,
          flex: 1,
          gap: 8,
          minHeight: 92,
          padding: 18,
        }}
      >
        <Text style={{ color: colors.ink, fontSize: 19, fontWeight: "700" }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "500", lineHeight: 20 }}>{detail}</Text>
      </Pressable>
    </Link>
  );
}

export function StatusPill({ status }: { status: string }) {
  const normalized = String(status || "").toUpperCase();
  const backgroundColor = normalized === "PAID" || normalized === "DELIVERED" ? colors.softGreen : normalized === "PREPARED" ? colors.softBlue : colors.softOrange;
  const color = normalized === "PAID" || normalized === "DELIVERED" ? colors.green : normalized === "PREPARED" ? colors.blue : colors.primaryDark;
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 }}>
      <Text style={{ color, fontSize: 13, fontWeight: "700" }}>{statusLabel(status)}</Text>
    </View>
  );
}

export function ProductCard({ product, onStockChange, busy = false }: { product: Product; onStockChange?: (nextStock: number) => void; busy?: boolean }) {
  const stock = Number(product.stock_quantity || 0);
  const inStock = stock > 0;
  return (
    <View style={{ backgroundColor: colors.page, borderRadius: radii.md, gap: 12, paddingVertical: 6 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 16 }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.card,
            borderCurve: "continuous",
            borderRadius: 20,
            height: 78,
            justifyContent: "center",
            overflow: "hidden",
            width: 78,
          }}
        >
          {product.image_url ? (
            <Image contentFit="cover" source={{ uri: product.image_url }} style={{ height: 78, width: 78 }} />
          ) : (
            <Text style={{ color: colors.primary, fontSize: 28, fontWeight: "700" }}>{product.name.slice(0, 1).toUpperCase()}</Text>
          )}
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text selectable numberOfLines={1} style={{ color: colors.ink, fontSize: 21, fontWeight: "500" }}>
            {product.name}
          </Text>
          <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: "700" }}>
            {formatCfa(product.price)}
          </Text>
          <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <View style={{ backgroundColor: colors.field, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 }}>
              <Text style={{ color: colors.inkSoft, fontSize: 13, fontWeight: "700" }}>{stock} en stock</Text>
            </View>
            <View style={{ backgroundColor: inStock ? colors.softGreen : colors.dangerSoft, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 }}>
              <Text style={{ color: inStock ? colors.primary : colors.red, fontSize: 13, fontWeight: "700" }}>{inStock ? "Publie" : "Rupture"}</Text>
            </View>
          </View>
        </View>
        <Text style={{ color: colors.ink, fontSize: 28, lineHeight: 30 }}>...</Text>
      </View>
      {onStockChange ? (
        <View style={{ flexDirection: "row", gap: 10, paddingLeft: 94 }}>
          <MiniButton disabled={busy || stock <= 0} label="-1" onPress={() => onStockChange(Math.max(0, stock - 1))} />
          <MiniButton disabled={busy} label="+1" onPress={() => onStockChange(stock + 1)} tone="green" />
        </View>
      ) : null}
    </View>
  );
}

export function OrderCard({ order, onStatusChange, busy = false }: { order: Order; onStatusChange?: (status: "PAID" | "PREPARED" | "DELIVERED") => void; busy?: boolean }) {
  return (
    <Panel>
      <View style={{ alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text selectable style={{ color: colors.ink, fontSize: 21, fontWeight: "700" }}>
            {order.order_ref || "Commande Tikchop"}
          </Text>
          <Text selectable style={{ color: colors.muted, fontSize: 14, fontWeight: "500" }}>
            {order.customer_name || "Client WhatsApp"} - {compactDate(order.created_at)}
          </Text>
          {order.handoff ? (
            <Text selectable style={{ color: colors.primary, fontSize: 13, fontWeight: "800" }}>
              Vendeur en main, bot en pause
            </Text>
          ) : null}
        </View>
        <StatusPill status={order.status} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <Text selectable style={{ color: colors.inkSoft, flex: 1, fontSize: 15, fontWeight: "500" }}>
          {order.delivery_zone || "Livraison a confirmer"}
        </Text>
        <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "800" }}>
          {formatCfa(Number(order.total_amount || 0) + Number(order.delivery_fee || 0))}
        </Text>
      </View>
      {onStatusChange ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <MiniButton disabled={busy || order.status === "PAID"} label="Payee" onPress={() => onStatusChange("PAID")} />
          <MiniButton disabled={busy || order.status === "PREPARED"} label="Prete" onPress={() => onStatusChange("PREPARED")} />
          <MiniButton disabled={busy || order.status === "DELIVERED"} label="Livree" onPress={() => onStatusChange("DELIVERED")} tone="green" />
        </View>
      ) : null}
    </Panel>
  );
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: "center", gap: 18, paddingHorizontal: 12, paddingVertical: 36 }}>
      <View style={{ alignItems: "center", backgroundColor: colors.softGreen, borderRadius: 44, height: 138, justifyContent: "center", width: 138 }}>
        <View style={{ backgroundColor: colors.card, borderColor: colors.primary, borderRadius: 24, borderWidth: 3, height: 76, width: 92 }} />
      </View>
      <Text selectable style={{ color: colors.ink, fontSize: 33, fontWeight: "700", lineHeight: 38, textAlign: "center" }}>
        {title}
      </Text>
      <Text selectable style={{ color: colors.inkSoft, fontSize: 19, fontWeight: "400", lineHeight: 28, textAlign: "center" }}>
        {detail}
      </Text>
      {action}
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        alignItems: "center",
        backgroundColor: disabled ? "#B8CABF" : colors.primary,
        borderRadius: 999,
        minHeight: 64,
        justifyContent: "center",
        paddingHorizontal: 24,
      }}
    >
      <Text style={{ color: "white", fontSize: 20, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

export function orderSummaryText(order: Order, sellerName = "Tikchop") {
  const total = formatCfa(Number(order.total_amount || 0) + Number(order.delivery_fee || 0));
  return `${sellerName} - ${order.order_ref || "Commande Tikchop"}\nClient: ${order.customer_name || "Client WhatsApp"}\nStatut: ${statusLabel(order.status)}\nLivraison: ${order.delivery_zone || "A confirmer"}\nTotal: ${total}`;
}

export function MiniButton({
  label,
  onPress,
  disabled = false,
  tone = "light",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "light" | "green";
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        alignItems: "center",
        backgroundColor: disabled ? colors.field : tone === "green" ? colors.softGreen : colors.card,
        borderRadius: 999,
        minHeight: 42,
        justifyContent: "center",
        opacity: disabled ? 0.62 : 1,
        paddingHorizontal: 17,
      }}
    >
      <Text style={{ color: tone === "green" && !disabled ? colors.primary : colors.ink, fontSize: 14, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

export function CopyButton({ value, label = "Copier" }: { value: string; label?: string }) {
  async function copy() {
    await Clipboard.setStringAsync(value);
    await Haptics.selectionAsync().catch(() => undefined);
  }

  return (
    <Pressable
      onPress={copy}
      style={{
        alignItems: "center",
        backgroundColor: colors.softGreen,
        borderRadius: 999,
        minHeight: 48,
        justifyContent: "center",
        paddingHorizontal: 18,
      }}
    >
      <Text style={{ color: colors.primaryDark, fontSize: 15, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}
