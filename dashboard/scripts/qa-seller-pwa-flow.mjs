import { readFileSync } from "node:fs";
import { chromium, devices } from "playwright";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const env = {};
  const content = readFileSync(".env.local", "utf8");

  for (const line of content.split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    env[key] = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
  }

  return env;
}

function assertOk(condition, message) {
  if (!condition) throw new Error(message);
}

function getSupabaseStorageKey(url) {
  const host = new URL(url).host;
  const ref = host.split(".")[0];
  return `sb-${ref}-auth-token`;
}

async function pageText(page) {
  return page.locator("body").innerText({ timeout: 12000 }).catch(() => "");
}

async function createSellerFixture(admin, anon, suffix) {
  const email = `qa-pwa-${suffix}@tikchop.local`;
  const password = `Tikchop-${suffix}!`;
  const slug = `qa-pwa-${suffix}`;
  const phone = `+2250700${suffix.slice(0, 6)}`;

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: "QA PWA Tikchop",
      signup_method: "QA_PWA",
    },
  });
  assertOk(!authError && authData?.user?.id, authError?.message || "Utilisateur vendeur non cree");

  const { data: sessionData, error: signInError } = await anon.auth.signInWithPassword({ email, password });
  assertOk(!signInError && sessionData?.session?.access_token, signInError?.message || "Connexion vendeur impossible");

  const { data: seller, error: sellerError } = await admin
    .from("sellers")
    .insert({
      name: "QA PWA Boutique",
      slug,
      phone_number: phone,
      owner_user_id: authData.user.id,
      owner_email: email,
      delivery_enabled: true,
      pickup_enabled: true,
      fixed_delivery_fee: 1000,
      delivery_payment_timing: "AT_RECEPTION",
      whatsapp_provider: "evolution",
      whatsapp_status: "disconnected",
      payout_status: "not_configured",
    })
    .select("id, name, slug, phone_number")
    .single();
  assertOk(!sellerError && seller?.id, sellerError?.message || "Boutique vendeur non creee");

  const { data: product, error: productError } = await admin
    .from("products")
    .insert({
      seller_id: seller.id,
      name: "Sac QA PWA",
      description: "Article temporaire pour test parcours PWA.",
      price: 12000,
      stock_quantity: 3,
      image_url: "/landing/raffia-bags.jpg",
      product_keywords: "sac, test, pwa",
      is_active: true,
    })
    .select("id")
    .single();
  assertOk(!productError && product?.id, productError?.message || "Article vendeur non cree");

  return {
    email,
    password,
    userId: authData.user.id,
    seller,
    product,
    session: sessionData.session,
  };
}

async function cleanup(admin, fixture) {
  if (!fixture) return;
  if (fixture.seller?.id) {
    const orderIds = (await admin.from("orders").select("id").eq("seller_id", fixture.seller.id)).data?.map((order) => order.id) || [];
    if (orderIds.length) {
      await admin.from("order_items").delete().in("order_id", orderIds);
    }
    await admin.from("orders").delete().eq("seller_id", fixture.seller.id);
    await admin.from("products").delete().eq("seller_id", fixture.seller.id);
    await admin.from("delivery_zones").delete().eq("seller_id", fixture.seller.id);
    await admin.from("delivery_drivers").delete().eq("seller_id", fixture.seller.id);
    await admin.from("sellers").delete().eq("id", fixture.seller.id);
  }
  if (fixture.userId) {
    await admin.auth.admin.deleteUser(fixture.userId);
  }
}

const env = loadEnv();
const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
for (const key of required) assertOk(env[key], `${key} manquant`);

const baseUrl = (process.env.QA_BASE_URL || "http://127.0.0.1:3001").replace(/\/+$/, "");
const authStorageKey = getSupabaseStorageKey(env.NEXT_PUBLIC_SUPABASE_URL);
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const suffix = `${Date.now()}`.slice(-8);
let fixture = null;
let browser = null;

console.log("Tikchop seller PWA QA");
console.log("---------------------");
console.log(`Base URL: ${baseUrl}`);

try {
  fixture = await createSellerFixture(admin, anon, suffix);
  console.log(`OK - fixture vendeur temporaire: /${fixture.seller.slug}`);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices["Pixel 7"],
    locale: "fr-FR",
  });

  const page = await context.newPage();
  const browserIssues = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      browserIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    browserIssues.push(`pageerror: ${error.message}`);
  });
  page.on("requestfailed", (request) => {
    browserIssues.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText || ""}`);
  });

  await page.goto(`${baseUrl}/onboarding?mode=signin&method=email`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  const emailInput = page.locator('input[autocomplete="email"], input[inputmode="email"]').first();
  if (!(await emailInput.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: /email/i }).first().click().catch(() => {});
  }
  await emailInput.fill(fixture.email);
  await page.locator('input[type="password"], input[autocomplete="current-password"]').first().fill(fixture.password);
  await page.getByRole("button", { name: "Je me connecte" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 25000 });
  await page.evaluate((seller) => {
    window.localStorage.setItem("tikchop:activeSeller", JSON.stringify(seller));
    window.localStorage.setItem("tikchop:onboardingComplete", "1");
    window.localStorage.removeItem("tikchop-install-dismissed");
  }, fixture.seller);
  await page.evaluate(({ authKey, session, seller }) => {
    window.localStorage.setItem(authKey, JSON.stringify(session));
    window.localStorage.setItem("tikchop:activeSeller", JSON.stringify(seller));
    window.localStorage.setItem("tikchop:onboardingComplete", "1");
    window.localStorage.removeItem("tikchop-install-dismissed");
  }, { authKey: authStorageKey, session: fixture.session, seller: fixture.seller });

  await page.goto(`${baseUrl}/dashboard?created=1`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  let text = await pageText(page);
  assertOk(page.url().includes("/dashboard"), `dashboard non atteint: ${page.url()}`);
  assertOk(text.includes("Partagez la boutique pour tester.") || text.includes("Partager"), "dashboard ne pousse pas vers partage");
  assertOk(text.includes("Installer Tikchop"), "prompt PWA vendeur absent sur mobile");
  console.log("OK - dashboard vendeur mobile connecte");

  await page.goto(`${baseUrl}/add-product`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.body.innerText.includes("Chargement de la boutique"), null, { timeout: 18000 }).catch(() => {});
  text = await pageText(page);
  assertOk(
    text.includes("Ajoutez vos photos.") || text.includes("Ouvrir la galerie"),
    `ajout produit mobile non lisible: ${page.url()} | ${text.slice(0, 220).replace(/\s+/g, " ")} | ${browserIssues.slice(-4).join(" || ")}`,
  );
  assertOk(!text.includes("Vocal\nOption"), "mode vocal encore trop visible dans le choix principal mobile");
  console.log("OK - ajout article mobile simplifie");

  await page.goto(`${baseUrl}/products`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.body.innerText.includes("Chargement..."), null, { timeout: 18000 }).catch(() => {});
  text = await pageText(page);
  assertOk(
    text.includes("Sac QA PWA"),
    `catalogue vendeur ne montre pas l'article temporaire: ${page.url()} | ${text.slice(0, 260).replace(/\s+/g, " ")} | ${browserIssues.slice(-4).join(" || ")}`,
  );
  assertOk(text.includes("Partager boutique et articles") || text.includes("Partager"), "catalogue ne propose pas le partage");
  console.log("OK - catalogue vendeur");

  await page.goto(`${baseUrl}/social-sharing`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.body.innerText.includes("Chargement des articles..."), null, { timeout: 18000 }).catch(() => {});
  await page.waitForFunction(() => document.body.innerText.includes("Sac QA PWA"), null, { timeout: 18000 }).catch(() => {});
  text = await pageText(page);
  const lowerSharingText = text.toLowerCase();
  assertOk(
    lowerSharingText.includes("partager et vendre"),
    `page partage non chargee: ${page.url()} | ${text.slice(0, 260).replace(/\s+/g, " ")} | ${browserIssues.slice(-4).join(" || ")}`,
  );
  assertOk(
    text.includes("Sac QA PWA"),
    `page partage ne liste pas l'article: ${page.url()} | ${text.slice(0, 260).replace(/\s+/g, " ")} | ${browserIssues.slice(-4).join(" || ")}`,
  );
  assertOk(
    text.includes(`/${fixture.seller.slug}`),
    `page partage sans lien boutique: ${page.url()} | ${text.slice(0, 260).replace(/\s+/g, " ")} | ${browserIssues.slice(-4).join(" || ")}`,
  );
  console.log("OK - centre de partage");

  await page.goto(`${baseUrl}/${fixture.seller.slug}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  text = await pageText(page);
  assertOk(text.includes("QA PWA Boutique") || text.includes("Sac QA PWA"), "boutique publique vendeur non chargee");
  console.log("OK - boutique publique");

  const manifestResponse = await page.request.get(`${baseUrl}/manifest.json`);
  assertOk(manifestResponse.ok(), "manifest PWA inaccessible");
  const manifest = await manifestResponse.json();
  assertOk((manifest.shortcuts || []).some((shortcut) => shortcut.url === "/social-sharing"), "raccourci PWA partage absent");
  console.log("OK - manifest PWA avec raccourci partage");
} finally {
  if (browser) await browser.close();
  await cleanup(admin, fixture);
  console.log("OK - nettoyage fixture PWA");
}

console.log("\nParcours vendeur PWA connecte valide.");
