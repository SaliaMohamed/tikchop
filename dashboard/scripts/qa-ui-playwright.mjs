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

async function run() {
  console.log("Tikchop UI QA");
  console.log("------------");
  console.log(`Base URL: ${baseUrl}`);

  const browser = await chromium.launch({ headless: true });

  try {
    const mobile = await browser.newContext({
      ...devices["Pixel 7"],
      locale: "fr-FR",
    });
    const mobilePage = await mobile.newPage();

    await mobilePage.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await mobilePage.waitForTimeout(1600);
    const mobileUrl = mobilePage.url();
    const mobileHomeText = await pageText(mobilePage);
    await expect(
      /\/onboarding/.test(mobileUrl),
      "mobile / redirige vers onboarding",
      mobileUrl,
    );
    await expect(
      !mobileHomeText.includes("Votre boutique en ligne, prête pour vos clients WhatsApp."),
      "landing mobile supprimee de /",
    );

    await mobilePage.goto(`${baseUrl}/onboarding?new=1`, { waitUntil: "domcontentloaded" });
    await mobilePage.getByRole("button", { name: "Creer ma boutique Tikchop" }).click();
    const onboardingText = await pageText(mobilePage);
    await expect(onboardingText.includes("Acces vendeur"), "creation affiche acces vendeur");
    await expect(onboardingText.includes("Numero WhatsApp"), "creation affiche WhatsApp");
    await expect(onboardingText.includes("Google"), "creation affiche Google");
    await expect(!onboardingText.includes("Connexion par email"), "creation sans texte email long");

    await mobilePage.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await mobilePage.waitForTimeout(700);
    const loginText = await pageText(mobilePage);
    await expect(loginText.includes("Se connecter"), "login affiche titre");
    await expect(loginText.includes("Google"), "login affiche Google");
    await expect(loginText.includes("Email"), "login affiche Email");
    await expect(!loginText.includes("Etape 1/2"), "login sans etape onboarding");
    await mobile.close();

    const desktop = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      locale: "fr-FR",
    });
    const desktopPage = await desktop.newPage();
    await desktopPage.goto(`${baseUrl}/?info=1`, { waitUntil: "domcontentloaded" });
    const desktopText = await pageText(desktopPage);
    await expect(desktopText.includes("assistant WhatsApp"), "desktop garde la page de presentation");
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
