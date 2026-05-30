import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";

import { EmptyState, PrimaryButton, ProductCard, StatCard } from "@/components/cards";
import { Screen } from "@/components/screen";
import { useOverview } from "@/components/use-overview";
import { updateProductStock } from "@/lib/tikchop-api";
import { colors, radii } from "@/theme/colors";

const filters = ["Tous", "Publie", "Rupture"] as const;

export default function ProductsScreen() {
  const router = useRouter();
  const { overview, loading, refresh } = useOverview();
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("Tous");
  const products = overview?.products || [];
  const sellerId = overview?.seller.id || "";
  const active = products.filter((product) => Number(product.stock_quantity || 0) > 0).length;

  const visibleProducts = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      const stock = Number(product.stock_quantity || 0);
      const matchesQuery = !cleanQuery || product.name.toLowerCase().includes(cleanQuery) || String(product.category || "").toLowerCase().includes(cleanQuery);
      const matchesFilter = filter === "Tous" || (filter === "Publie" && stock > 0) || (filter === "Rupture" && stock <= 0);
      return matchesQuery && matchesFilter;
    });
  }, [filter, products, query]);

  async function handleStock(productId: string, nextStock: number) {
    if (!sellerId || overview?.source !== "supabase") {
      setNotice("Connectez une vraie boutique pour modifier le stock.");
      return;
    }
    setBusyId(productId);
    setNotice("");
    try {
      await updateProductStock(productId, sellerId, nextStock);
      await refresh();
      setNotice("Stock mis a jour.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Stock non mis a jour.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <Screen title="Produits" refreshing={loading} onRefresh={refresh}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <TextInput
            onChangeText={setQuery}
            placeholder="Rechercher ..."
            placeholderTextColor={colors.muted}
            style={searchStyle}
            value={query}
          />
        </View>
        <Pressable style={filterButtonStyle}>
          <View style={{ backgroundColor: colors.ink, borderRadius: 999, height: 3, width: 22 }} />
          <View style={{ backgroundColor: colors.ink, borderRadius: 999, height: 3, width: 14 }} />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 22 }}>
        {filters.map((item) => {
          const activeFilter = item === filter;
          return (
            <Pressable key={item} onPress={() => setFilter(item)} style={{ borderBottomColor: activeFilter ? colors.primary : "transparent", borderBottomWidth: 3, paddingBottom: 8 }}>
              <Text style={{ color: activeFilter ? colors.primary : colors.inkSoft, fontSize: 17, fontWeight: activeFilter ? "800" : "500" }}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <StatCard label="Produit" value={products.length} />
        <StatCard label="Publie" value={active} tone="green" />
      </View>

      {notice ? (
        <Text selectable style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>
          {notice}
        </Text>
      ) : null}

      {visibleProducts.length ? (
        <View style={{ gap: 16 }}>
          {visibleProducts.map((product) => (
            <ProductCard
              busy={busyId === product.id}
              key={product.id}
              onStockChange={(nextStock) => handleStock(product.id, nextStock)}
              product={product}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          title="Vous n'avez pas encore d'article"
          detail="Ajoutez vos photos et vos prix. Tikchop prepare la boutique pour vendre sur WhatsApp."
          action={<PrimaryButton label="Publier un article" onPress={() => router.push("/publish")} />}
        />
      )}
    </Screen>
  );
}

const searchStyle = {
  backgroundColor: colors.field,
  borderRadius: radii.lg,
  color: colors.ink,
  fontSize: 21,
  fontWeight: "500" as const,
  minHeight: 74,
  paddingHorizontal: 24,
};

const filterButtonStyle = {
  alignItems: "center" as const,
  backgroundColor: colors.field,
  borderRadius: radii.lg,
  gap: 6,
  height: 74,
  justifyContent: "center" as const,
  width: 74,
};
