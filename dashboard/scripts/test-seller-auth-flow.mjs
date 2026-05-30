import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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

async function createSellerFixture(admin, anon, suffix, index) {
  const password = `Tikchop-${suffix}-${index}!`;
  const email = `qa-auth-${suffix}-${index}@tikchop.local`;
  const phone = `+2250709${suffix.slice(-4)}${index}`;
  const slug = `qa-auth-${suffix}-${index}`;

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: `QA Auth ${index}`,
      signup_method: "EMAIL",
    },
  });
  assertOk(!authError && authData?.user?.id, authError?.message || "Utilisateur non cree");

  const userId = authData.user.id;
  const { data: sessionData, error: signInError } = await anon.auth.signInWithPassword({ email, password });
  assertOk(!signInError && sessionData?.session?.access_token, signInError?.message || "Connexion impossible");

  const { data: seller, error: sellerError } = await admin
    .from("sellers")
    .insert({
      name: `QA Auth ${index}`,
      slug,
      phone_number: phone,
      owner_user_id: userId,
      owner_email: email,
      delivery_enabled: true,
      pickup_enabled: true,
      fixed_delivery_fee: 0,
      delivery_payment_timing: "AT_RECEPTION",
      auto_share_to_driver: false,
    })
    .select("id, slug, owner_user_id")
    .single();
  assertOk(!sellerError && seller?.id, sellerError?.message || "Boutique non creee");

  const { data: product, error: productError } = await admin
    .from("products")
    .insert({
      seller_id: seller.id,
      name: `Article QA ${index}`,
      description: "Produit de test isolation vendeur",
      price: 1000 + index,
      stock_quantity: 2,
    })
    .select("id")
    .single();
  assertOk(!productError && product?.id, productError?.message || "Produit non cree");

  return {
    email,
    password,
    userId,
    seller,
    product,
    accessToken: sessionData.session.access_token,
  };
}

async function cleanup(admin, fixtures) {
  for (const fixture of fixtures) {
    if (!fixture?.seller?.id) continue;
    await admin.from("products").delete().eq("seller_id", fixture.seller.id);
    await admin.from("delivery_zones").delete().eq("seller_id", fixture.seller.id);
    await admin.from("delivery_drivers").delete().eq("seller_id", fixture.seller.id);
    await admin.from("orders").delete().eq("seller_id", fixture.seller.id);
    await admin.from("sellers").delete().eq("id", fixture.seller.id);
  }

  for (const fixture of fixtures) {
    if (fixture?.userId) {
      await admin.auth.admin.deleteUser(fixture.userId);
    }
  }
}

const env = loadEnv();
const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
for (const key of required) assertOk(env[key], `${key} manquant`);

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const suffix = `${Date.now()}`.slice(-8);
const fixtures = [];

try {
  fixtures.push(await createSellerFixture(admin, anon, suffix, 1));
  fixtures.push(await createSellerFixture(admin, anon, suffix, 2));

  const userOne = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${fixtures[0].accessToken}` } },
    auth: { persistSession: false },
  });

  const { data: visibleSellers, error: sellersError } = await userOne
    .from("sellers")
    .select("id, slug, owner_user_id")
    .order("created_at", { ascending: false });
  assertOk(!sellersError, sellersError?.message || "Lecture vendeurs impossible");

  const visibleIds = new Set((visibleSellers || []).map((seller) => seller.id));
  assertOk(visibleIds.has(fixtures[0].seller.id), "Le vendeur ne voit pas sa boutique");
  assertOk(!visibleIds.has(fixtures[1].seller.id), "Le vendeur voit la boutique d'un autre compte");
  assertOk((visibleSellers || []).length === 1, `Isolation incomplète: ${visibleSellers?.length || 0} boutiques visibles`);

  console.log("OK - inscription auth + isolation vendeur validees avec un nouvel utilisateur.");
} finally {
  await cleanup(admin, fixtures);
}
