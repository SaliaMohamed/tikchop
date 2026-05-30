import { ReactNode } from "react";
import { Link } from "expo-router";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { colors } from "@/theme/colors";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export function Screen({ title, subtitle, children, refreshing, onRefresh }: Props) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} /> : undefined}
      style={{ flex: 1, backgroundColor: colors.page }}
      contentContainerStyle={{ padding: 24, paddingBottom: 40, gap: 20 }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: 18, justifyContent: "space-between" }}>
        <View style={{ alignItems: "center", backgroundColor: colors.card, borderRadius: 999, gap: 5, height: 52, justifyContent: "center", width: 52 }}>
          <View style={{ backgroundColor: colors.ink, borderRadius: 999, height: 2, width: 21 }} />
          <View style={{ backgroundColor: colors.ink, borderRadius: 999, height: 2, width: 15 }} />
          <View style={{ backgroundColor: colors.ink, borderRadius: 999, height: 2, width: 21 }} />
        </View>
        <View style={{ flex: 1 }}>
          <Text selectable style={{ color: colors.ink, fontSize: 39, fontWeight: "500", letterSpacing: 0, lineHeight: 44 }}>
            {title}
          </Text>
        </View>
        <Link href="/account" asChild>
          <Pressable style={{ alignItems: "center", backgroundColor: colors.softGreen, borderColor: "#D4ECDD", borderRadius: 999, borderWidth: 1, height: 50, justifyContent: "center", width: 50 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 15, fontWeight: "800" }}>TC</Text>
          </Pressable>
        </Link>
      </View>
      {subtitle ? (
        <Text selectable style={{ color: colors.inkSoft, fontSize: 18, fontWeight: "400", lineHeight: 26 }}>
          {subtitle}
        </Text>
      ) : null}
      {children}
    </ScrollView>
  );
}
