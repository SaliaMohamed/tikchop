import { useState } from "react";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";

import { Panel, PrimaryButton } from "@/components/cards";
import { Screen } from "@/components/screen";
import { useOverview } from "@/components/use-overview";
import { createQuickProduct, uploadProductPhoto } from "@/lib/tikchop-api";
import { colors, radii } from "@/theme/colors";

export default function PublishScreen() {
  const router = useRouter();
  const { overview, loading, refresh } = useOverview();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [description, setDescription] = useState("");
  const [localImageUri, setLocalImageUri] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const sellerId = overview?.seller.id || "";
  const canPublish = Boolean(name.trim().length > 1 && Number(price || 0) >= 0 && stock.trim() && !busy);

  async function pickAndUploadPhoto() {
    if (!sellerId || overview?.source !== "supabase") {
      setNotice("Connectez une vraie boutique avant d'envoyer une photo.");
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setNotice("Autorisez l'acces aux photos pour publier un article.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      mediaTypes: "images",
      quality: 0.82,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    const uri = result.assets[0].uri;
    setLocalImageUri(uri);
    setBusy("image");
    setNotice("");
    try {
      const uploaded = await uploadProductPhoto(uri);
      setImageUrl(uploaded.url);
      setNotice("Photo prete. Ajoutez le prix et publiez.");
    } catch (error) {
      setImageUrl("");
      setNotice(error instanceof Error ? error.message : "Photo non envoyee.");
    } finally {
      setBusy("");
    }
  }

  async function handleCreate() {
    if (!sellerId || overview?.source !== "supabase") {
      setNotice("Connectez une vraie boutique avant de publier.");
      return;
    }
    if (!canPublish) {
      setNotice("Ajoutez au minimum le nom, le prix et le stock.");
      return;
    }

    setBusy("publish");
    setNotice("");
    try {
      await createQuickProduct(sellerId, {
        name,
        price: Number(price || 0),
        stock_quantity: Number(stock || 0),
        description: description.trim() || "Ajoute depuis Tikchop mobile.",
        image_url: imageUrl,
      });
      setName("");
      setPrice("");
      setStock("1");
      setDescription("");
      setLocalImageUri("");
      setImageUrl("");
      await refresh();
      router.push("/products");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Article non publie.");
    } finally {
      setBusy("");
    }
  }

  return (
    <Screen title="Publier" subtitle="Une photo, un nom, un prix. Tikchop vend ensuite sur WhatsApp." refreshing={loading} onRefresh={refresh}>
      <Panel>
        <View style={{ gap: 6 }}>
          <Text selectable style={{ color: colors.ink, fontSize: 28, fontWeight: "800", lineHeight: 33 }}>
            Publier un produit
          </Text>
          <Text selectable style={{ color: colors.inkSoft, fontSize: 17, fontWeight: "400", lineHeight: 25 }}>
            Rendez votre article visible dans votre boutique et pret pour les reponses automatiques.
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <Text selectable style={labelStyle}>Image du produit</Text>
          <Pressable onPress={pickAndUploadPhoto} style={imagePickerStyle}>
            {localImageUri || imageUrl ? (
              <Image contentFit="cover" source={{ uri: localImageUri || imageUrl }} style={{ height: 124, width: 124 }} />
            ) : (
              <View style={{ alignItems: "center", backgroundColor: colors.softGreen, borderRadius: 24, height: 124, justifyContent: "center", width: 124 }}>
                <Text style={{ color: colors.primary, fontSize: 34, fontWeight: "700" }}>+</Text>
              </View>
            )}
            <Text selectable style={{ color: colors.blue, flex: 1, fontSize: 16, fontWeight: "500", lineHeight: 23 }}>
              {busy === "image" ? "Envoi de la photo..." : "Ajoutez la photo principale. Une image claire vend mieux sur WhatsApp."}
            </Text>
          </Pressable>
        </View>

        <View style={{ gap: 12 }}>
          <Text selectable style={labelStyle}>Nom du produit *</Text>
          <TextInput onChangeText={setName} placeholder="Nom du produit" placeholderTextColor="#C8C8CC" style={inputStyle} value={name} />
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 12 }}>
            <Text selectable style={labelStyle}>Prix *</Text>
            <TextInput keyboardType="numeric" onChangeText={setPrice} placeholder="15000" placeholderTextColor="#C8C8CC" style={inputStyle} value={price} />
          </View>
          <View style={{ flex: 1, gap: 12 }}>
            <Text selectable style={labelStyle}>Stock *</Text>
            <TextInput keyboardType="numeric" onChangeText={setStock} placeholder="1" placeholderTextColor="#C8C8CC" style={inputStyle} value={stock} />
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <Text selectable style={labelStyle}>Details du produit</Text>
          <TextInput
            multiline
            onChangeText={setDescription}
            placeholder="Couleur, taille, matiere, conditions de livraison..."
            placeholderTextColor="#C8C8CC"
            style={[inputStyle, { minHeight: 132, paddingTop: 18, textAlignVertical: "top" }]}
            value={description}
          />
          <Text selectable style={{ color: colors.blue, fontSize: 15, fontWeight: "500", lineHeight: 22 }}>
            Tikchop utilisera ces details pour mieux repondre aux clientes sur WhatsApp.
          </Text>
        </View>

        {notice ? (
          <Text selectable style={{ color: colors.primaryDark, fontSize: 15, fontWeight: "700", lineHeight: 22 }}>
            {notice}
          </Text>
        ) : null}

        <PrimaryButton disabled={!canPublish || busy === "image"} label={busy === "publish" ? "Publication..." : "Publier le produit"} onPress={handleCreate} />
      </Panel>
    </Screen>
  );
}

const labelStyle = {
  color: colors.ink,
  fontSize: 20,
  fontWeight: "500" as const,
};

const inputStyle = {
  backgroundColor: colors.field,
  borderRadius: radii.lg,
  color: colors.ink,
  fontSize: 19,
  fontWeight: "500" as const,
  minHeight: 76,
  paddingHorizontal: 24,
};

const imagePickerStyle = {
  alignItems: "center" as const,
  backgroundColor: colors.card,
  borderColor: colors.line,
  borderCurve: "continuous" as const,
  borderRadius: radii.lg,
  borderWidth: 1,
  flexDirection: "row" as const,
  gap: 16,
  minHeight: 154,
  padding: 16,
};
