import { Tabs } from "expo-router";
import { Text, View } from "react-native";

import { colors } from "@/theme/colors";

function TabIcon({ kind, focused }: { kind: "home" | "box" | "list" | "wa"; focused: boolean }) {
  const color = focused ? colors.primary : colors.muted;
  if (kind === "list") {
    return (
      <View style={{ gap: 3 }}>
        <View style={{ backgroundColor: color, borderRadius: 999, height: 2, width: 21 }} />
        <View style={{ backgroundColor: color, borderRadius: 999, height: 2, width: 16 }} />
        <View style={{ backgroundColor: color, borderRadius: 999, height: 2, width: 21 }} />
      </View>
    );
  }
  if (kind === "wa") {
    return (
      <View style={{ alignItems: "center", borderColor: color, borderRadius: 999, borderWidth: 2, height: 24, justifyContent: "center", width: 24 }}>
        <Text style={{ color, fontSize: 8, fontWeight: "800" }}>WA</Text>
      </View>
    );
  }
  return (
    <View
      style={{
        borderColor: color,
        borderCurve: "continuous",
        borderRadius: kind === "home" ? 7 : 5,
        borderWidth: 2,
        height: kind === "home" ? 22 : 23,
        width: kind === "home" ? 24 : 23,
      }}
    />
  );
}

function CenterIcon({ focused }: { focused: boolean }) {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: focused ? colors.primaryDark : colors.primary,
        borderColor: colors.page,
        borderRadius: 999,
        borderWidth: 6,
        height: 66,
        justifyContent: "center",
        marginBottom: 26,
        width: 66,
      }}
    >
      <Text style={{ color: "white", fontSize: 31, fontWeight: "300", lineHeight: 34 }}>+</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: "transparent",
          height: 86,
          paddingBottom: 16,
          paddingTop: 10,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Accueil", tabBarIcon: ({ focused }) => <TabIcon focused={focused} kind="home" /> }} />
      <Tabs.Screen name="products" options={{ title: "Produits", tabBarIcon: ({ focused }) => <TabIcon focused={focused} kind="box" /> }} />
      <Tabs.Screen name="publish" options={{ title: "Publier", tabBarIcon: ({ focused }) => <CenterIcon focused={focused} /> }} />
      <Tabs.Screen name="orders" options={{ title: "Commandes", tabBarIcon: ({ focused }) => <TabIcon focused={focused} kind="list" /> }} />
      <Tabs.Screen name="whatsapp" options={{ title: "WhatsApp", tabBarIcon: ({ focused }) => <TabIcon focused={focused} kind="wa" /> }} />
      <Tabs.Screen name="account" options={{ href: null, title: "Compte" }} />
    </Tabs>
  );
}
