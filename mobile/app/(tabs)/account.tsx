import * as Linking from "expo-linking";
import { useState } from "react";
import { Pressable, Share, Text, View } from "react-native";
import { TextInput } from "react-native";

import { CopyButton, Panel, StatCard } from "@/components/cards";
import { Screen } from "@/components/screen";
import { useAuth } from "@/components/use-auth";
import { useOverview } from "@/components/use-overview";
import { supabase } from "@/lib/supabase";
import { colors, radii } from "@/theme/colors";

const webUrl = process.env.EXPO_PUBLIC_TIKCHOP_WEB_URL || "https://tikchop.vercel.app";

export default function AccountScreen() {
  const { overview, loading, refresh } = useOverview();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const seller = overview?.seller;
  const shopUrl = seller?.slug ? `${webUrl}/${seller.slug}` : webUrl;

  async function handleSignIn() {
    setNotice("");
    try {
      await auth.signIn(email, password);
      await refresh();
      setNotice("Connexion reussie.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Connexion impossible.");
    }
  }

  async function handlePasswordReset() {
    const cleanEmail = email.trim().toLowerCase();
    if (!supabase) {
      setNotice("Reset indisponible: Supabase n'est pas configure.");
      return;
    }
    if (!cleanEmail.includes("@")) {
      setNotice("Entre ton email vendeur avant de demander le lien.");
      return;
    }

    setNotice("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${webUrl}/account/update-password`,
      });
      if (error) throw error;
      setNotice("Lien envoye. Ouvre l'email puis choisis ton nouveau mot de passe.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Lien de reset non envoye.");
    }
  }

  async function handleSignOut() {
    await auth.signOut();
    await refresh();
    setNotice("Session fermee.");
  }

  async function shareShop() {
    await Share.share({
      message: `${seller?.name || "Boutique Tikchop"}\n${shopUrl}`,
      url: shopUrl,
      title: seller?.name || "Boutique Tikchop",
    });
  }

  return (
    <Screen title="Compte" subtitle="Profil vendeur, lien boutique et preparation store." refreshing={loading} onRefresh={refresh}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <StatCard label="Boutique" value={seller?.slug ? `/${seller.slug}` : "..."} />
        <StatCard label="Source" value={overview?.source || "..."} tone="blue" />
      </View>

      <Panel>
        <Text selectable style={{ color: colors.ink, fontSize: 19, fontWeight: "900" }}>
          Session vendeur
        </Text>
        {!auth.configured ? (
          <Text selectable style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "800", lineHeight: 21 }}>
            Supabase mobile n'est pas encore configure. Renseignez les variables EXPO_PUBLIC_* pour activer la connexion.
          </Text>
        ) : auth.session ? (
          <View style={{ gap: 10 }}>
            <Text selectable style={{ color: colors.muted, fontSize: 14, fontWeight: "700", lineHeight: 21 }}>
              Connecte: {auth.user?.email || "vendeur Tikchop"}
            </Text>
            {auth.notice ? (
              <Text selectable style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800", lineHeight: 19 }}>
                {auth.notice}
              </Text>
            ) : null}
            <Pressable onPress={handleSignOut} style={buttonStyle(colors.ink)}>
              <Text style={buttonTextStyle}>Se deconnecter</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="Email vendeur"
              placeholderTextColor={colors.muted}
              style={inputStyle}
              value={email}
            />
            <TextInput
              onChangeText={setPassword}
              placeholder="Mot de passe"
              placeholderTextColor={colors.muted}
              secureTextEntry
              style={inputStyle}
              value={password}
            />
            <Pressable disabled={auth.loading} onPress={handleSignIn} style={buttonStyle(colors.primary, auth.loading)}>
              <Text style={buttonTextStyle}>Se connecter</Text>
            </Pressable>
            <Pressable disabled={auth.loading} onPress={handlePasswordReset} style={outlineButtonStyle(auth.loading)}>
              <Text style={outlineButtonTextStyle}>Mot de passe oublie</Text>
            </Pressable>
          </View>
        )}
        {notice ? (
          <Text selectable style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800", lineHeight: 19 }}>
            {notice}
          </Text>
        ) : null}
      </Panel>

      <Panel>
        <Text selectable style={{ color: colors.ink, fontSize: 19, fontWeight: "900" }}>
          {seller?.name || "Boutique Tikchop"}
        </Text>
        <Text selectable style={{ color: colors.muted, fontSize: 14, fontWeight: "600", lineHeight: 21 }}>
          {seller?.phone_number || "Numero WhatsApp a configurer"}
        </Text>
        <Text selectable style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "800", lineHeight: 21 }}>
          {shopUrl}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <CopyButton value={shopUrl} label="Copier le lien" />
          <Pressable
            onPress={shareShop}
            style={{
              alignItems: "center",
              backgroundColor: colors.primary,
              borderCurve: "continuous",
              borderRadius: radii.md,
              minHeight: 46,
              justifyContent: "center",
              paddingHorizontal: 18,
            }}
          >
            <Text style={{ color: "white", fontSize: 14, fontWeight: "900" }}>Partager</Text>
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL(shopUrl)}
            style={{
              alignItems: "center",
              backgroundColor: colors.ink,
              borderCurve: "continuous",
              borderRadius: radii.md,
              minHeight: 46,
              justifyContent: "center",
              paddingHorizontal: 18,
            }}
          >
            <Text style={{ color: "white", fontSize: 14, fontWeight: "900" }}>Ouvrir</Text>
          </Pressable>
        </View>
      </Panel>

      <Panel>
        <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>
          Checklist store
        </Text>
        <Text selectable style={{ color: colors.muted, fontSize: 14, fontWeight: "600", lineHeight: 22 }}>
          Icone finale, splash Tikchop, politique de confidentialite, screenshots, compte Apple, compte Google Play et tests TestFlight.
        </Text>
      </Panel>
    </Screen>
  );
}

function buttonStyle(backgroundColor: string, disabled = false) {
  return {
    alignItems: "center" as const,
    backgroundColor,
    borderRadius: 999,
    minHeight: 48,
    justifyContent: "center" as const,
    opacity: disabled ? 0.6 : 1,
    paddingHorizontal: 18,
  };
}

function outlineButtonStyle(disabled = false) {
  return {
    alignItems: "center" as const,
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: "center" as const,
    opacity: disabled ? 0.6 : 1,
    paddingHorizontal: 18,
  };
}

const buttonTextStyle = {
  color: "white",
  fontSize: 14,
  fontWeight: "900" as const,
};

const outlineButtonTextStyle = {
  color: colors.ink,
  fontSize: 14,
  fontWeight: "900" as const,
};

const inputStyle = {
  backgroundColor: colors.page,
  borderColor: colors.line,
  borderRadius: 16,
  borderWidth: 1,
  color: colors.ink,
  fontSize: 15,
  fontWeight: "800" as const,
  minHeight: 50,
  paddingHorizontal: 14,
};
