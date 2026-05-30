import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AuthProvider } from "@/components/auth-context";
import { colors } from "@/theme/colors";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.page },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.page },
          headerTitleStyle: { color: colors.ink, fontWeight: "900" },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
