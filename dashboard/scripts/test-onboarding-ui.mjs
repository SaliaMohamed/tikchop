import { readFileSync } from "node:fs";
import { chromium, devices } from "playwright";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const env = {};
  const content = readFileSync(".env.local", "utf8");

  for (const line of content.split(/\r?\n/)) {
    if (!line.includes("=")) continue;
    const [rawKey, ...rest] = line.split("=");
    const key = rawKey.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    env[key] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
  }

  return env;
}

function assertOk(condition, message) {
  if (!condition) throw new Error(message);
}

async function cleanup(admin, { phone, email }) {
  const { data: sellers } = await admin
    .from("sellers")
    .select("id")
    .eq("phone_number", phone);
  const sellerIds = (sellers || []).map((seller) => seller.id);

  if (sellerIds.length) {
    const { data: orders } = await admin.from("orders").select("id").in("seller_id", sellerIds);
    const orderIds = (orders || []).map((order) => order.id);
    if (orderIds.length) {
      await admin.from("order_items").delete().in("order_id", orderIds);
      await admin.from("orders").delete().in("id", orderIds);
    }

    await admin.from("products").delete().in("seller_id", sellerIds);
    await admin.from("delivery_zones").delete().in("seller_id", sellerIds);
    await admin.from("delivery_drivers").delete().in("seller_id", sellerIds);
    await admin.from("sellers").delete().in("id", sellerIds);
  }

  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const user = (data?.users || []).find((item) => item.email?.toLowerCase() === email.toLowerCase());
    if (user?.id) {
      await admin.auth.admin.deleteUser(user.id);
      break;
    }
    if ((data?.users || []).length < 200) break;
  }
}

const env = loadEnv();
const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
for (const key of required) assertOk(env[key], `${key} manquant`);

const baseUrl = (process.env.QA_BASE_URL || env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3001").replace(/\/+$/, "");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const suffix = `${Date.now()}`.slice(-8);
const localPhone = `07${suffix}`;
const fullPhone = `+225${localPhone}`;
const aliasEmail = `seller-225${localPhone}@phone.tikchop.local`;
const shopName = `QA Mobile ${suffix}`;
const password = `Tikchop-${suffix}!`;

console.log("Tikchop onboarding UI");
console.log("--------------------");
console.log(`Base URL: ${baseUrl}`);
console.log(`Boutique temporaire: ${shopName}`);

await cleanup(admin, { phone: fullPhone, email: aliasEmail });

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    ...devices["Pixel 7"],
    locale: "fr-FR",
  });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/signup`, { waitUntil: "domcontentloaded" });
  await page.getByText("Ouvrez votre boutique", { exact: true }).waitFor({ state: "visible", timeout: 20000 });
  await page.locator('input[placeholder="07 00 00 00 00"]:visible').fill(localPhone);
  await page.locator('input[placeholder="Ex: Amina Mode"]:visible').fill(shopName);
  await page.locator('input[type="password"]:visible').fill(password);
  await page.getByRole("button", { name: "Je cree ma boutique", exact: true }).click();

  await page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 60000 });
  await page.waitForFunction(
    () => document.body.innerText.includes("Publier un article"),
    null,
    { timeout: 30000 },
  );
  const bodyText = await page.locator("body").innerText({ timeout: 15000 });

  assertOk(!/onboarding/i.test(page.url()), "Apres inscription, l'utilisateur reste sur onboarding.");
  assertOk(bodyText.includes("Tikchop") || bodyText.includes(shopName), "Dashboard vendeur non charge.");
  assertOk(/mettez juste un article/i.test(bodyText), "Dashboard sans message de demarrage simple.");
  assertOk(/publier un article/i.test(bodyText), "Dashboard sans gros bouton de publication simple.");
  assertOk(
    bodyText.includes("Publier un article"),
    "Dashboard de demarrage simplifie non affiche.",
  );
  assertOk(bodyText.includes("Voir la boutique"), "Dashboard sans etape de controle boutique.");
  assertOk(bodyText.includes("Activer WhatsApp"), "Dashboard sans etape WhatsApp apres les articles.");

  await page.goto(`${baseUrl}/add-product`, { waitUntil: "domcontentloaded" });
  await page.getByText("Publier articles", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  const addProductText = await page.locator("body").innerText({ timeout: 15000 });
  assertOk(addProductText.includes("Beaucoup d'articles"), "Topbar mobile d'ajout article sans contexte simple.");
  assertOk(addProductText.includes("Photos"), "Mode photos absent sur mobile.");
  assertOk(addProductText.includes("Un article"), "Mode un article absent sur mobile.");
  assertOk(addProductText.includes("Vocal"), "Mode vocal absent sur mobile.");
  assertOk(/une action a la fois/i.test(addProductText), "Assistant mobile d'ajout lot trop dense ou absent.");
  assertOk(/ouvrir la galerie/i.test(addProductText), "Bouton galerie prioritaire absent sur mobile.");
  assertOk(addProductText.includes("Publier"), "Navigation mobile absente pendant l'ajout d'article.");
  assertOk(addProductText.includes("Plus"), "Navigation mobile sans entree Plus pour reglages.");

  await page.goto(`${baseUrl}/products`, { waitUntil: "domcontentloaded" });
  await page.getByText("Mes articles en ligne", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  const productsText = await page.locator("body").innerText({ timeout: 15000 });
  assertOk(productsText.includes("Ajouter mes premiers articles") || productsText.includes("Aucun article en ligne"), "Gestion articles mobile non guidee.");

  await page.goto(`${baseUrl}/app`, { waitUntil: "domcontentloaded" });
  await page.getByText("A faire maintenant", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  const menuText = await page.locator("body").innerText({ timeout: 15000 });
  assertOk(menuText.includes("Boutique et reglages"), "Topbar mobile Plus sans contexte reglages.");
  assertOk(/aujourd'hui/i.test(menuText), "Menu mobile sans actions du jour.");
  assertOk(/clients\/whatsapp|clients whatsapp|whatsapp/i.test(menuText), "Menu mobile sans acces clients WhatsApp clair.");
  assertOk(/publier/i.test(menuText), "Menu mobile sans action publier.");
  assertOk(/reglages/i.test(menuText), "Menu mobile sans acces aux reglages.");

  await page.goto(`${baseUrl}/payment-settings`, { waitUntil: "domcontentloaded" });
  await page.getByText("Choisissez vos paiements", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  await page.locator("text=Orange Money").first().waitFor({ state: "visible", timeout: 30000 });
  const paymentText = await page.locator("body").innerText({ timeout: 15000 });
  assertOk(paymentText.includes("Orange Money"), "Reglage paiement sans Orange Money.");
  assertOk(paymentText.includes("MTN MoMo"), "Reglage paiement sans MTN MoMo.");
  assertOk(paymentText.includes("Wave"), "Reglage paiement sans Wave.");
  assertOk(paymentText.includes("Djamo"), "Reglage paiement sans Djamo.");
  assertOk(paymentText.includes("+225"), "Reglage paiement sans indicatif ivoirien.");

  await page.goto(`${baseUrl}/delivery-settings`, { waitUntil: "domcontentloaded" });
  await page.getByText("Action suivante", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  const deliveryText = await page.locator("body").innerText({ timeout: 15000 });
  assertOk(deliveryText.includes("Ce que le client peut choisir"), "Livraison mobile sans choix client clair.");
  assertOk(deliveryText.includes("Prix de livraison"), "Livraison mobile sans bloc frais clair.");
  assertOk(deliveryText.includes("Enregistrer livraison"), "Livraison mobile sans action d'enregistrement visible.");

  await page.goto(`${baseUrl}/whatsapp`, { waitUntil: "domcontentloaded" });
  await page.getByText("Connecter WhatsApp vendeur", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  let whatsappText = await page.locator("body").innerText({ timeout: 15000 });
  assertOk(/connexion recommandee/i.test(whatsappText), "WhatsApp mobile sans chemin numero vendeur recommande.");
  assertOk(/numero tikchop/i.test(whatsappText), "WhatsApp mobile sans option numero Tikchop.");
  assertOk(/votre numero whatsapp/i.test(whatsappText), "WhatsApp mobile sans option propre numero.");
  assertOk(/alternative sans qr/i.test(whatsappText), "WhatsApp mobile sans alternative Standard.");
  whatsappText = await page.locator("body").innerText({ timeout: 15000 });
  const whatsappInputValue = await page.locator('input[placeholder="+225 07 00 00 00 00"]:visible').inputValue();
  assertOk(whatsappInputValue.includes("+225"), "WhatsApp avance sans indicatif +225 visible.");
  assertOk(/generer le QR/i.test(whatsappText), "WhatsApp avance sans action QR claire.");
  assertOk(whatsappText.includes("Code"), "WhatsApp avance sans option code WhatsApp.");

  await page.goto(`${baseUrl}/orders`, { waitUntil: "domcontentloaded" });
  await page.getByText("Aucune vente pour le moment", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Voir une commande exemple", { exact: true }).click();
  await page.getByRole("button", { name: "Creer une commande test", exact: true }).click();
  await page.locator("div.fixed").getByText("Prochaine action", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  await page.locator("div.fixed").getByRole("button", { name: "Marquer colis pret", exact: true }).click();
  await page.getByText("Fiche livreur WhatsApp", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  const orderText = await page.locator("body").innerText({ timeout: 15000 });
  assertOk(orderText.includes("Ajouter un livreur") || orderText.includes("Ouvrir WhatsApp sans choisir"), "Fiche livreur non exploitable.");

  await page.goto(`${baseUrl}/messages`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  const messagesText = await page.locator("body").innerText({ timeout: 15000 });
  assertOk(
    /Client demo Tikchop|DEMO_CLIENT|Client WhatsApp|Messages prets|Pas encore de discussion|Boite clients/i.test(messagesText),
    "Messages vendeur sans conversation client exploitable.",
  );
  assertOk(
    messagesText.includes("Prendre la main") || messagesText.includes("Rendre au bot") || messagesText.includes("A lire") || messagesText.includes("Pas encore de discussion"),
    "Messages vendeur sans action claire pour reprendre la main.",
  );

  const { data: seller, error: sellerError } = await admin
    .from("sellers")
    .select("id, slug, phone_number, owner_user_id")
    .eq("phone_number", fullPhone)
    .single();
  assertOk(!sellerError && seller?.id, sellerError?.message || "Boutique test non retrouvee en base.");
  assertOk(Boolean(seller.owner_user_id), "Boutique creee sans owner_user_id.");

  console.log(`OK - creation UI mobile -> dashboard: /${seller.slug}`);
} finally {
  await browser.close();
  await cleanup(admin, { phone: fullPhone, email: aliasEmail });
  console.log("OK - nettoyage compte UI temporaire");
}
