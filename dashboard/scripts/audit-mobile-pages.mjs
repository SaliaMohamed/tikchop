import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
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

const env = loadEnv();
const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
for (const key of required) assertOk(env[key], `${key} manquant`);

const baseUrl = (process.env.QA_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const OUT_DIR = "artifacts/mobile-audit";
const authStorageKey = `sb-${new URL(env.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0]}-auth-token`;

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const pages = [
  "/dashboard",
  "/products",
  "/add-product",
  "/orders",
  "/messages",
  "/crm",
  "/plus",
  "/delivery-settings",
  "/payment-settings",
  "/shop-info",
  "/social-sharing",
  "/account",
];

const issues = [];
function report(pagePath, kind, detail) {
  issues.push({ pagePath, kind, detail });
  console.log(`ISSUE [${pagePath}] ${kind}: ${detail}`);
}

async function checkMobileHealth(page, pagePath) {
  const health = await page.evaluate(() => {
    const doc = document.documentElement;
    const vw = doc.clientWidth;
    const bodyScrollWidth = document.body.scrollWidth;
    const overflowers = [];
    document.querySelectorAll("*").forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const right = rect.right;
        if (right > vw + 1) {
          const style = window.getComputedStyle(el);
          if (!["fixed", "absolute"].includes(style.position)) {
            overflowers.push({
              tag: el.tagName.toLowerCase(),
              cls: (el.className && typeof el.className === "string") ? el.className.slice(0, 70) : "",
              right: Math.round(right),
              vw,
              pos: style.position,
            });
          }
        }
      }
    });
    const smallTexts = [];
    document.querySelectorAll("p, span, a, button, li, td, small, label").forEach((el) => {
      const style = window.getComputedStyle(el);
      const px = parseFloat(style.fontSize);
      const text = (el.textContent || "").trim();
      const rect = el.getBoundingClientRect();
      const isActuallyVisible = rect.height > 0 && rect.width > 0 && el.getClientRects().length > 0;
      if (px > 0 && px < 11 && text.length > 6 && isActuallyVisible && style.visibility !== "hidden") {
        smallTexts.push({ tag: el.tagName.toLowerCase(), px, text: text.slice(0, 40), cls: (el.className && typeof el.className === "string") ? el.className.slice(0, 60) : "" });
      }
    });
    const smallTargets = [];
    document.querySelectorAll("a, button, [role=button], input[type=checkbox], input[type=radio], [role=checkbox], [role=radio]").forEach((el) => {
      const cs = window.getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const big = Math.max(r.width, r.height);
      if (big < 44) {
        smallTargets.push({
          tag: el.tagName.toLowerCase(),
          w: Math.round(r.width),
          h: Math.round(r.height),
          text: (el.textContent || "").trim().slice(0, 30) || el.getAttribute("aria-label")?.slice(0, 30) || el.tagName,
          cls: (el.className && typeof el.className === "string") ? el.className.slice(0, 60) : "",
        });
      }
    });
    return {
      vw,
      bodyScrollWidth,
      hasHorizontalOverflow: bodyScrollWidth > vw + 1,
      overflowers: overflowers.slice(0, 6),
      smallTargets: smallTargets.slice(0, 8),
      smallTexts: smallTexts.slice(0, 6),
      smallInputs: Array.from(document.querySelectorAll("input, textarea, select")).filter((el) => {
        const r = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);
        const px = parseFloat(cs.fontSize);
        if (r.width <= 0 || r.height <= 0 || !(px > 0) || px >= 16) return false;
        if (el.readOnly || el.disabled) return false;
        return true;
      }).slice(0, 6).map((el) => {
        const px = parseFloat(window.getComputedStyle(el).fontSize);
        return { tag: el.tagName.toLowerCase(), px, id: el.id || "", ph: (el.placeholder || "").slice(0, 30) };
      }),
      scrollHeight: doc.scrollHeight,
      innerHeight: window.innerHeight,
    };
  });

  if (health.hasHorizontalOverflow) {
    const detail = health.overflowers.length
      ? health.overflowers.map((o) => `<${o.tag}>.${o.cls} right=${o.right}`).join(" | ")
      : `body scrollWidth=${health.bodyScrollWidth} > vw=${health.vw}`;
    report(pagePath, "Débordement horizontal", detail);
  }
  for (const st of health.smallTexts) {
    report(pagePath, `Texte très petit (${st.px}px)`, `<${st.tag}>.${st.cls} "${st.text}"`);
  }
  for (const st of health.smallTargets) {
    report(pagePath, `Cible tactile < 44px`, `<${st.tag}> ${st.w}x${st.h}px "${st.text}" .${st.cls}`);
  }
  for (const si of health.smallInputs) {
    report(pagePath, `Input < 16px (zoom iOS auto)`, `<${si.tag}>#${si.id} px=${si.px} placeholder="${si.ph}"`);
  }
  return health;
}

async function createFixture(admin, anon, suffix) {
  const localPhone = `07${suffix.slice(0, 7)}`;
  const fullPhone = `+225${localPhone.replace(/^0/, "")}`;
  const aliasEmail = `seller-${fullPhone.replace(/\D/g, "")}@phone.tikchop.local`;
  const password = `Tikchop-${suffix}!`;
  const slug = `audit-mob-${suffix}`;

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: aliasEmail,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Audit Mobile", signup_method: "AUDIT_MOBILE" },
  });
  assertOk(!authError && authData?.user?.id, authError?.message || "Utilisateur vendeur non cree");

  const { data: sessionData, error: signInError } = await anon.auth.signInWithPassword({ email: aliasEmail, password });
  assertOk(!signInError && sessionData?.session?.access_token, signInError?.message || "Connexion vendeur impossible");

  const { data: seller, error: sellerError } = await admin.from("sellers").insert({
    name: "Audit Mobile Boutique",
    slug,
    phone_number: fullPhone,
    owner_user_id: authData.user.id,
    owner_email: aliasEmail,
    delivery_enabled: true,
    pickup_enabled: true,
    fixed_delivery_fee: 1000,
    delivery_payment_timing: "AT_RECEPTION",
    whatsapp_provider: "evolution",
    whatsapp_status: "disconnected",
    payout_status: "not_configured",
  }).select("id, name, slug, phone_number").single();
  assertOk(!sellerError && seller?.id, sellerError?.message || "Boutique vendeur non creee");

  const productNames = ["Robe africaine premium", "Sac a main elegant", "Bijoux traditionnels", "Chaussures tendance", "Pagne wax assorti", "Vetement sur mesure"];
  for (const [i, name] of productNames.entries()) {
    const { error: productError } = await admin.from("products").insert({
      seller_id: seller.id,
      name,
      description: `Article de test numero ${i + 1} pour l'audit mobile.`,
      price: 8000 + i * 1500,
      stock_quantity: i % 3 === 0 ? 0 : 2 + i,
      image_url: "/landing/raffia-bags.jpg",
      product_keywords: `audit, ${name.toLowerCase().split(" ").join(",")}`,
      is_active: i % 3 !== 0,
    });
    assertOk(!productError, productError?.message || `Article ${i + 1} non cree`);
  }

  const { data: products, error: productsError } = await admin.from("products").select("id").eq("seller_id", seller.id);
  assertOk(!productsError && products?.length, productsError?.message || "Articles introuvables");

  const { data: order, error: orderError } = await admin.from("orders").insert({
    seller_id: seller.id,
    order_ref: `AUDIT-${suffix.slice(0, 4)}`,
    customer_phone: "+2250700112233",
    total_amount: 15000,
    delivery_fee: 1000,
    status: "PAID",
    delivery_type: "DELIVERY",
    delivery_address: "Abidjan, Cocody",
    delivery_status: "PENDING",
    payment_method: "PAYSTACK",
    paystack_payment_status: "success",
  }).select("id").single();
  assertOk(!orderError && order?.id, orderError?.message || "Commande non creee");

  const zones = await admin.from("delivery_zones").insert([
    { seller_id: seller.id, name: "Cocody", fee: 1000 },
    { seller_id: seller.id, name: "Yopougon", fee: 1500 },
  ]);
  if (zones.error) console.log("INFO - zones livraison non creees:", zones.error.message);

  return { email: aliasEmail, localPhone, password, userId: authData.user.id, seller, order, session: sessionData.session };
}

async function cleanup(admin, fixture) {
  if (!fixture) return;
  if (fixture.seller?.id) {
    const orderRes = await admin.from("orders").select("id").eq("seller_id", fixture.seller.id);
    const orderIds = (orderRes.data || []).map((row) => row.id);
    if (orderIds.length) {
      const res = await admin.from("order_items").delete().in("order_id", orderIds);
      if (res.error) console.log("INFO - cleanup order_items:", res.error.message);
    }
    await admin.from("orders").delete().eq("seller_id", fixture.seller.id);
    await admin.from("products").delete().eq("seller_id", fixture.seller.id);
    await admin.from("delivery_zones").delete().eq("seller_id", fixture.seller.id);
    await admin.from("delivery_drivers").delete().eq("seller_id", fixture.seller.id);
    await admin.from("sellers").delete().eq("id", fixture.seller.id);
  }
  if (fixture.userId) await admin.auth.admin.deleteUser(fixture.userId).catch(() => {});
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Captures: ${OUT_DIR}`);

  const suffix = `${Date.now()}`.slice(-8);
  let fixture = null;
  let browser = null;

  try {
    fixture = await createFixture(admin, anon, suffix);
    console.log(`OK - fixture vendeur temporaire: /${fixture.seller.slug}`);

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ ...devices["Pixel 7"], locale: "fr-FR" });
    const page = await context.newPage();
    const consoleErrors = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

    // Connexion via UI (pose le cookie de session requis par le middleware SSR)
    await page.goto(`${baseUrl}/onboarding?mode=signin&method=email`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    await page.locator("#onb-phone").fill(fixture.localPhone);
    await page.locator("#onb-password").fill(fixture.password);
    await page.locator("#onb-submit-btn").click();
    try {
      await page.waitForFunction(
        () => !window.location.pathname.includes("/onboarding"),
        null, { timeout: 25000 },
      );
    } catch {
      console.log("DEBUG - URL apres clic:", page.url());
      console.log("DEBUG - Texte:", (await page.locator("body").innerText().catch(() => ""))?.slice(0, 300)?.replace(/\s+/g, " "));
      throw new Error("Login n'a pas redirige hors de /onboarding");
    }
    console.log("OK - connecte via UI (landing:", new URL(page.url()).pathname + ")");
    await page.evaluate((seller) => {
      window.localStorage.setItem("tikchop:activeSeller", JSON.stringify(seller));
      window.localStorage.setItem("tikchop:onboardingComplete", "1");
      window.localStorage.removeItem("tikchop-install-dismissed");
      window.localStorage.removeItem("tikchop-pwa-installed");
    }, fixture.seller);
    await page.evaluate((seller) => {
      window.localStorage.setItem("tikchop:activeSeller", JSON.stringify(seller));
      window.localStorage.setItem("tikchop:onboardingComplete", "1");
      window.localStorage.removeItem("tikchop-install-dismissed");
      window.localStorage.removeItem("tikchop-pwa-installed");
    }, fixture.seller);
    console.log("OK - connecte via UI");

    for (const route of pages) {
      const errorsBefore = consoleErrors.length;
      const name = route === "/" ? "home" : route.replace(/^\//, "").replace(/[^a-z0-9]+/g, "-");
      console.log(`\n--- /${route} ---`);
      await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2800);
      // attente que le chargement vendeur se termine
      await page.waitForFunction(
        () => !document.body.innerText.includes("Chargement de la boutique") && !document.body.innerText.includes("Chargement..."),
        null, { timeout: 15000 },
      ).catch(() => {});
      await page.waitForTimeout(800);

      const newErrors = consoleErrors.slice(errorsBefore);
      for (const err of newErrors) report(route, "Console error", err.slice(0, 180));

      await checkMobileHealth(page, route);
      const path = `${OUT_DIR}/${name}.png`;
      await page.screenshot({ path, fullPage: false });
      console.log(`screenshot -> ${path}`);
    }

    // Boutique publique
    const shopRoute = `/${fixture.seller.slug}`;
    const errorsBeforeShop = consoleErrors.length;
    await page.goto(`${baseUrl}${shopRoute}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const newShopErrors = consoleErrors.slice(errorsBeforeShop);
    for (const err of newShopErrors) report(shopRoute, "Console error", err.slice(0, 180));
    await checkMobileHealth(page, shopRoute);
    await page.screenshot({ path: `${OUT_DIR}/boutique-publique.png` });
    console.log(`screenshot -> ${OUT_DIR}/boutique-publique.png`);
  } finally {
    if (browser) await browser.close();
    await cleanup(admin, fixture);
    console.log("\nOK - nettoyage fixture");
  }

  console.log(`\n===== SYNTHESE AUDIT MOBILE =====`);
  if (!issues.length) {
    console.log("Aucun problème détecté.");
  } else {
    const byPage = {};
    for (const issue of issues) {
      (byPage[issue.pagePath] ||= []).push(issue);
    }
    for (const [path, list] of Object.entries(byPage)) {
      console.log(`\n/${path} (${list.length}):`);
      for (const issue of list) console.log(`  - ${issue.kind}: ${issue.detail}`);
    }
  }
  console.log(`Total: ${issues.length} problème(s)`);
}

main().catch((error) => {
  console.error("ERREUR:", error);
  process.exit(1);
});