import { Text, View } from "react-native";

import { ActionLink, OrderCard, Panel, PrimaryButton, StatCard } from "@/components/cards";
import { Screen } from "@/components/screen";
import { useOverview } from "@/components/use-overview";
import { formatCfa } from "@/lib/format";
import { colors } from "@/theme/colors";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const router = useRouter();
  const { overview, loading, refresh } = useOverview();
  const seller = overview?.seller;
  const stats = overview?.stats;
  const activeWork = (stats?.pendingOrders || 0) + (stats?.paidOrders || 0) + (stats?.preparedOrders || 0);
  const connected = Boolean(stats?.whatsappConnected);

  return (
    <Screen
      title="Accueil"
      subtitle={seller ? `${seller.name} vend avec Tikchop` : "Votre assistant de vente WhatsApp"}
      refreshing={loading}
      onRefresh={refresh}
    >
      {overview?.warning && !/mode demo|aucune boutique/i.test(overview.warning) ? (
        <Panel tone="blue">
          <Text selectable style={{ color: colors.blue, fontSize: 15, fontWeight: "700", lineHeight: 22 }}>
            {overview.warning}
          </Text>
        </Panel>
      ) : null}

      <Panel tone="green">
        <Text selectable style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "800", textTransform: "uppercase" }}>
          WhatsApp vendeur
        </Text>
        <Text selectable style={{ color: colors.ink, fontSize: 31, fontWeight: "800", lineHeight: 37 }}>
          {connected ? "Tikchop repond aux clients." : "Connectez WhatsApp."}
        </Text>
        <Text selectable style={{ color: colors.inkSoft, fontSize: 17, fontWeight: "400", lineHeight: 25 }}>
          {connected
            ? "L'assistant conseille, prend les commandes et vous laisse reprendre la main quand il faut."
            : "Sans WhatsApp connecte, Tikchop ne peut pas vendre a votre place."}
        </Text>
        <PrimaryButton label={connected ? "Voir les commandes" : "Connecter WhatsApp"} onPress={() => router.push(connected ? "/orders" : "/whatsapp")} />
      </Panel>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <StatCard label="Ventes" value={stats ? formatCfa(stats.revenueToday) : "..."} tone="green" />
        <StatCard label="Actions" value={activeWork} />
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <StatCard label="Produits" value={stats?.products ?? "..."} />
        <StatCard label="Commandes" value={stats?.orders ?? "..."} tone="blue" />
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <ActionLink href="/publish" title="Publier" detail="Photo, prix, stock" />
        <ActionLink href="/products" title="Produits" detail="Verifier le catalogue" />
      </View>

      {overview?.orders.length ? (
        <View style={{ gap: 12 }}>
          <Text selectable style={{ color: colors.ink, fontSize: 25, fontWeight: "700" }}>
            Commandes recentes
          </Text>
          {overview.orders.slice(0, 3).map((order) => <OrderCard key={order.id} order={order} />)}
        </View>
      ) : (
        <Panel>
          <Text selectable style={{ color: colors.ink, fontSize: 24, fontWeight: "700" }}>
            Boutique prete a vendre
          </Text>
          <Text selectable style={{ color: colors.inkSoft, fontSize: 17, fontWeight: "400", lineHeight: 25 }}>
            Ajoutez vos articles forts puis laissez Tikchop guider les clients sur WhatsApp.
          </Text>
        </Panel>
      )}
    </Screen>
  );
}
