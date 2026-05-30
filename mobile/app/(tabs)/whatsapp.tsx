import { Text, View } from "react-native";

import { Panel, StatCard } from "@/components/cards";
import { Screen } from "@/components/screen";
import { useOverview } from "@/components/use-overview";
import { colors } from "@/theme/colors";

export default function WhatsappScreen() {
  const { overview, loading, refresh } = useOverview();
  const seller = overview?.seller;
  const connected = Boolean(overview?.stats.whatsappConnected);

  return (
    <Screen title="WhatsApp" subtitle="Le statut de connexion doit etre visible en premier." refreshing={loading} onRefresh={refresh}>
      <Panel tone={connected ? "green" : "light"}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 14 }}>
          <View style={{ alignItems: "center", backgroundColor: connected ? colors.primary : colors.field, borderRadius: 999, height: 64, justifyContent: "center", width: 64 }}>
            <Text style={{ color: connected ? "white" : colors.muted, fontSize: 28, fontWeight: "800" }}>WA</Text>
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <Text selectable style={{ color: colors.ink, fontSize: 28, fontWeight: "800", lineHeight: 32 }}>
              {connected ? "Connecte" : "A connecter"}
            </Text>
            <Text selectable style={{ color: colors.inkSoft, fontSize: 16, fontWeight: "400", lineHeight: 23 }}>
              {connected ? "Tikchop peut repondre, conseiller et prendre les commandes." : "Connectez le WhatsApp vendeur pour activer la vente automatique."}
            </Text>
          </View>
          <View style={{ backgroundColor: connected ? colors.primary : colors.muted, borderRadius: 999, height: 18, width: 18 }} />
        </View>
      </Panel>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <StatCard label="Statut" value={connected ? "Actif" : "Off"} tone={connected ? "green" : "dark"} />
        <StatCard label="Instance" value={seller?.evolution_instance || "..."} tone="blue" />
      </View>

      <Panel>
        <Text selectable style={{ color: colors.ink, fontSize: 24, fontWeight: "700" }}>
          Ce que Tikchop fait
        </Text>
        <Text selectable style={{ color: colors.inkSoft, fontSize: 17, fontWeight: "400", lineHeight: 26 }}>
          Il presente vos articles, repond aux questions, confirme le paiement, prepare la commande et vous laisse reprendre une conversation client depuis Commandes.
        </Text>
      </Panel>

      <Panel tone="blue">
        <Text selectable style={{ color: colors.blue, fontSize: 17, fontWeight: "700", lineHeight: 25 }}>
          La connexion QR/code reste geree depuis la version web pour le moment. Ici, le vendeur voit surtout si son assistant est pret a vendre.
        </Text>
      </Panel>
    </Screen>
  );
}
