import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium, devices } from "playwright";

function loadEnv() {
  const env = {};

  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
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

async function createSellerFixture(admin, suffix) {
  const password = `Tikchop-${suffix}!`;
  const email = `qa-bg-${suffix}@tikchop.local`;
  const phone = `+2250708${suffix.slice(-4)}`;
  const slug = `qa-bg-${suffix}`;

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: "QA Fond Propre",
      signup_method: "EMAIL",
    },
  });
  assertOk(!authError && authData?.user?.id, authError?.message || "Utilisateur non cree");

  const { data: seller, error: sellerError } = await admin
    .from("sellers")
    .insert({
      name: "QA Fond Propre",
      slug,
      phone_number: phone,
      owner_user_id: authData.user.id,
      owner_email: email,
      delivery_enabled: true,
      pickup_enabled: true,
      fixed_delivery_fee: 0,
      delivery_payment_timing: "AT_RECEPTION",
      auto_share_to_driver: false,
    })
    .select("id, slug")
    .single();
  assertOk(!sellerError && seller?.id, sellerError?.message || "Boutique non creee");

  return {
    email,
    password,
    userId: authData.user.id,
    seller,
  };
}

async function cleanup(admin, fixture) {
  if (fixture?.seller?.id) {
    await admin.from("products").delete().eq("seller_id", fixture.seller.id);
    await admin.from("delivery_zones").delete().eq("seller_id", fixture.seller.id);
    await admin.from("delivery_drivers").delete().eq("seller_id", fixture.seller.id);
    await admin.from("orders").delete().eq("seller_id", fixture.seller.id);
    await admin.from("sellers").delete().eq("id", fixture.seller.id);
  }

  if (fixture?.userId) {
    await admin.auth.admin.deleteUser(fixture.userId);
  }
}

const env = loadEnv();
const baseUrl = (process.env.QA_BASE_URL || env.NEXT_PUBLIC_APP_URL || "https://dashboard-mu-blue-xduynfs3jo.vercel.app").replace(/\/+$/, "");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const suffix = `${Date.now()}`.slice(-8);
let fixture = null;
let browser = null;

try {
  fixture = await createSellerFixture(admin, suffix);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices["Pixel 7"],
    locale: "fr-FR",
  });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/onboarding?mode=signin&method=email`, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("email@email.com").fill(fixture.email);
  await page.getByPlaceholder("Mot de passe", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Je me connecte" }).click();
  await page.waitForFunction(() => window.location.pathname === "/dashboard", null, { timeout: 30000 }).catch(async (error) => {
    console.log("DEBUG_LOGIN_STILL_URL", page.url());
    console.log("DEBUG_LOGIN_BODY", (await page.locator("body").innerText()).slice(0, 1600));
    throw error;
  });
  await page.evaluate((seller) => {
    window.localStorage.setItem("tikchop:activeSeller", JSON.stringify(seller));
    window.localStorage.setItem("tikchop:onboardingComplete", "1");
  }, {
    id: fixture.seller.id,
    name: "QA Fond Propre",
    slug: fixture.seller.slug,
    phone_number: "+2250708000000",
  });

  await page.goto(`${baseUrl}/add-product`, { waitUntil: "domcontentloaded" });
  const fileInput = page.locator('input[type="file"][multiple]');
  await fileInput.waitFor({ state: "attached", timeout: 30000 });
  const filePath = path.resolve("public", "landing", "african-handbag.jpg");
  await fileInput.setInputFiles(filePath);

  await page.getByText("Photo claire").waitFor({ state: "visible", timeout: 60000 });
  await page.getByRole("button", { name: /Nettoyer toutes les photos/i }).click();
  await page.getByText("Fond propre active").waitFor({ state: "visible", timeout: 90000 });

  const imageUrl = await page.locator("article img").first().getAttribute("src");
  assertOk(imageUrl?.includes("res.cloudinary.com"), "Image finale non Cloudinary");
  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    seller: fixture.seller.slug,
    imageUrl,
  }, null, 2));
} finally {
  if (browser) await browser.close();
  await cleanup(admin, fixture);
}
