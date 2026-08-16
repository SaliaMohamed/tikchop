import { chromium, devices } from "playwright";

const baseUrl = (process.env.QA_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3001").replace(/\/+$/, "");
const shopSlug = process.env.QA_SHOP_SLUG || "";

const checks = [];

function ok(name, detail = "") {
  checks.push({ ok: true, name, detail });
  console.log(`OK - ${name}${detail ? `: ${detail}` : ""}`);
}

function fail(name, detail = "") {
  checks.push({ ok: false, name, detail });
  console.log(`ECHEC - ${name}${detail ? `: ${detail}` : ""}`);
}

async function expect(condition, name, detail = "") {
  if (condition) ok(name, detail);
  else fail(name, detail);
}

async function pageText(page) {
  return page.locator("body").innerText({ timeout: 10000 }).catch(() => "");
}

async function goto(page, path) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
}

async function run() {
  console.log("Tikchop UI QA");
  console.log("------------");
  console.log(`Base URL: ${baseUrl}`);

  const browser = await chromium.launch({ headless: true });

  try {
    // Routes publiques sans session => onboarding (auth unique)
    const mobile = await browser.newContext({
      ...devices["Pixel 7"],
      locale: "fr-FR",
    });
    const mobilePage = await mobile.newPage();

    // 1. / : landing -> onboarding connexion
    await goto(mobilePage, "/");
    const homeUrl = mobilePage.url();
    await expect(
      homeUrl.includes("/onboarding") && homeUrl.includes("mode=signin"),
      "mobile / redirige vers l'onboarding de connexion",
      homeUrl,
    );

    // 2. /login -> onboarding connexion
    await goto(mobilePage, "/login");
    const loginUrl = mobilePage.url();
    await expect(
      loginUrl.includes("/onboarding") && loginUrl.includes("mode=signin"),
      "login redirige vers l'onboarding de connexion",
      loginUrl,
    );

    // 3. onboardoing connexion affiche le formulaire
    const loginText = await pageText(mobilePage);
    await expect(loginText.includes("Bon retour"), "connexion affiche 'Bon retour'");
    await expect(loginText.includes("+225"), "connexion affiche l'indicatif ivoirien");
    await expect(loginText.includes("MOT DE PASSE"), "connexion affiche mot de passe");
    await expect(loginText.includes("Se connecter"), "connexion affiche 'Se connecter'");
    await expect(!loginText.includes("Consultation de cours"), "connexion sans contenu etranger");

    // 4. /signup -> onboarding creation
    await goto(mobilePage, "/signup");
    const signupUrl = mobilePage.url();
    await expect(
      signupUrl.includes("/onboarding") && signupUrl.includes("new=1"),
      "signup redirige vers l'onboarding de creation",
      signupUrl,
    );

    // 5. onboarding creation affiche le parcours vendeur
    const signupText = await pageText(mobilePage);
    await expect(signupText.includes("Vendez sur WhatsApp"), "creation affiche l'accroche vendeur");
    await expect(signupText.includes("Créez votre compte vendeur"), "creation affiche l'etape compte");
    await expect(signupText.includes("Créer ma boutique"), "creation affiche 'Creer ma boutique'");
    await expect(signupText.includes("J'ai déjà un compte"), "creation donne acces a la connexion");
    await mobile.close();

    // 6. Desktop: /app sans session -> onboarding connexion
    const desktop = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      locale: "fr-FR",
    });
    const desktopPage = await desktop.newPage();
    await goto(desktopPage, "/app");
    await expect(
      /\/onboarding\?mode=signin/.test(desktopPage.url()),
      "app sans session va vers l'onboarding de connexion",
      desktopPage.url(),
    );
    await desktop.close();

    if (shopSlug) {
      const shop = await browser.newPage();
      await shop.goto(`${baseUrl}/${shopSlug}`, { waitUntil: "domcontentloaded" });
      const shopText = await pageText(shop);
      await expect(shopText.length > 100, "boutique publique chargee", `/${shopSlug}`);
      await shop.close();
    } else {
      console.log("INFO - QA_SHOP_SLUG non fourni, test boutique publique ignore.");
    }
  } finally {
    await browser.close();
  }

  const failed = checks.filter((check) => !check.ok);
  console.log("\nResume UI");
  console.log("---------");
  console.log(`${checks.length - failed.length}/${checks.length} checks OK`);

  if (failed.length) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});