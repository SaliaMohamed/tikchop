import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  MessageCircle,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  ShoppingBag,
  Truck,
  Wallet,
  Zap,
} from "lucide-react";
import TikchopLottie from "./components/TikchopLottie";

/* ============================================================
   Static data — rendered once, no client JS needed
   ============================================================ */

const products = [
  { name: "Pagne wax premium", price: "15 000 F", tag: "Top vente", image: "/landing/fabric-display.jpg" },
  { name: "Tissus boutique", price: "12 000 F", tag: "Adjamé", image: "/landing/wax-shop.jpg" },
  { name: "Sacs raphia", price: "10 000 F", tag: "Nouveau", image: "/landing/raffia-bags.jpg" },
  { name: "Sac africain", price: "18 000 F", tag: "Cocody", image: "/landing/african-handbag.jpg" },
  { name: "Beurre de karité", price: "4 500 F", tag: "Beauté", image: "/landing/shea-butter.jpg" },
];

const proof = [
  { label: "pendant le lancement", value: "gratuit" },
  { label: "fait pour le mobile", value: "100%" },
  { label: "commandes plus claires", value: "moins de stress" },
];

const clarityCards = [
  { icon: MessageCircle, title: "Répondre vite, même quand vous êtes occupé", text: "Prix, tailles, disponibilité, livraison et paiement restent clairs, même quand plusieurs messages arrivent en même temps." },
  { icon: ReceiptText, title: "Ne plus perdre les vraies commandes", text: "Chaque client intéressé devient une commande claire avec article, téléphone, commune, montant et statut." },
  { icon: Wallet, title: "Donner les bons moyens de paiement", text: "Wave, Orange Money, MTN Money, Djamo ou paiement à la livraison sont présentés simplement selon vos choix." },
  { icon: Truck, title: "Préparer la livraison sans tout recopier", text: "Les informations utiles sont prêtes à être envoyées au livreur : article, client, téléphone, commune et montant." },
];

const outcomeCards = [
  "Vous répondez plus vite aux clients qui veulent acheter maintenant.",
  "Vous arrêtez de chercher les captures dans la galerie.",
  "Vous voyez mieux quel article est disponible et quelle commande est confirmée.",
  "Vous gardez plus de temps pour les lives, les colis et l'encaissement.",
];

const features = [
  { icon: MessageCircle, title: "Réponses WhatsApp plus rapides", text: "Le client reçoit les informations essentielles sans attendre que vous soyez disponible." },
  { icon: ReceiptText, title: "Commandes faciles à emballer", text: "Produit, commune, téléphone, total et statut sont regroupés au même endroit." },
  { icon: Wallet, title: "Paiements locaux bien expliqués", text: "Vous choisissez les moyens acceptés, Tikchop les présente clairement au client." },
];

const localSignals = [
  "Pagne, sacs, beauté, accessoires",
  "Paiement a la livraison, Wave, Orange Money",
  "Djamo et paiement à la livraison",
  "Relance des clients hésitants",
  "Catalogue avec vraies photos",
  "Commandes prêtes à partager au livreur",
];

const paymentSignals = [
  { icon: Wallet, title: "Paiement direct", text: "Wave, Orange Money, MTN Money, Djamo ou paiement à la livraison sont affichés selon ce que vous acceptez." },
  { icon: MessageCircle, title: "Confirmation plus propre", text: "Le client confirme son choix, sa commune et son numéro avant que la commande parte à l'emballage." },
  { icon: ShieldCheck, title: "Moins d'aller-retour", text: "Vous répétez moins les mêmes consignes et vous gardez votre énergie pour encaisser, emballer et livrer." },
];

const fatimPain = [
  { icon: Clock3, label: "Réponses trop tardives", text: "Le client a déjà acheté ailleurs quand elle revient sur WhatsApp." },
  { icon: Camera, label: "Galerie saturée", text: "Captures de lives, captures de commandes, captures de conversations partout." },
  { icon: ShoppingBag, label: "Même article demandé 8 fois", text: "Sans stock clair, elle doit vérifier à la main qui a confirmé en premier." },
  { icon: MessageCircle, label: "Questions répétées", text: "Prix, taille, livraison, disponibilité : les mêmes réponses reviennent toute la journée." },
];

const tikchopHelp = [
  "Garder les demandes importantes même quand Fatim prépare un live ou des colis.",
  "Transformer les discussions WhatsApp en commandes avec nom, article, commune et paiement.",
  "Réduire les doubles ventes quand un article existe en une seule pièce.",
  "Préparer un message clair pour le livreur, sans tout recopier à la main.",
  "Relancer les clients intéressés pendant qu'ils sont encore chauds.",
];

const automationSteps = [
  { icon: MessageCircle, title: "1. Le client écrit", text: "Il demande le prix, la taille, la disponibilité ou la livraison d'un vêtement vu en live." },
  { icon: PackageCheck, title: "2. Tikchop note la demande", text: "Article, taille, nom, téléphone, commune et moyen de paiement sont regroupés proprement." },
  { icon: Wallet, title: "3. Paiement guidé", text: "Le client reçoit les consignes Wave, Orange Money, MTN Money ou paiement à la livraison, selon la boutique." },
  { icon: Truck, title: "4. Livraison préparée", text: "Vous pouvez partager au livreur un résumé clair : produit, adresse, téléphone, montant et statut." },
];

const boutiqueSetupSteps = [
  { title: "Identité boutique", text: "Nom, logo, WhatsApp, communes de livraison et horaires : la boutique devient claire dès l'ouverture." },
  { title: "Catalogue vêtements", text: "Photos, prix, tailles, stock et description courte pour éviter les mêmes questions toute la journée." },
  { title: "Paiements locaux", text: "Wave, Orange Money, MTN Money, Djamo ou paiement à la livraison selon les habitudes de la boutique." },
  { title: "Livreurs habituels", text: "Numéros WhatsApp, zones et frais par commune pour envoyer vite chaque commande." },
  { title: "Lien de vente", text: "Le lien se partage en bio TikTok, statut WhatsApp ou message privé. Les clients commandent sans attendre." },
  { title: "Suivi simple", text: "Chaque commande reste visible avec son statut : nouvelle, à emballer, en livraison ou finie." },
];

const desktopFlow = [
  { icon: Clock3, label: "Live TikTok", text: "Le client repère un article" },
  { icon: MessageCircle, label: "WhatsApp", text: "Tikchop répond et confirme" },
  { icon: PackageCheck, label: "Commandes", text: "Tout arrive proprement" },
];

const orders = [
  { name: "Sac raphia", zone: "Cocody", status: "Payé Wave", amount: "10 000 F" },
  { name: "Pagne wax", zone: "Yopougon", status: "À livrer", amount: "15 000 F" },
  { name: "Beurre de karité", zone: "Marcory", status: "Confirmé", amount: "4 500 F" },
];

const demoProcess = [
  { icon: MessageCircle, label: "1. Demande", text: "Le client pose sa question sur WhatsApp." },
  { icon: Wallet, label: "2. Paiement", text: "Tikchop confirme le prix et propose Wave, OM ou MTN." },
  { icon: PackageCheck, label: "3. Commande", text: "La commande est créée avec l'article, la zone et le statut." },
  { icon: Truck, label: "4. Livraison", text: "Le livreur reçoit les infos utiles et le client reçoit son reçu." },
];

/* ============================================================
   SEO metadata
   ============================================================ */

export async function generateMetadata() {
  return {
    title: "Tikchop · Vendre mieux sur WhatsApp",
    description: "Créez votre boutique en ligne, recevez des commandes WhatsApp claires et organisez la livraison depuis votre téléphone. Gratuit pendant le lancement.",
    openGraph: {
      title: "Tikchop · Votre boutique en ligne avec un assistant WhatsApp",
      description: "Vous vendez sur TikTok, Instagram ou WhatsApp ? Tikchop vous aide à présenter vos articles, répondre plus vite, recevoir des commandes claires.",
      type: "website",
      locale: "fr_CI",
    },
  };
}

/* ============================================================
   Helpers
   ============================================================ */

const whatsappTrialMessage = "Bonjour, je veux activer Tikchop gratuitement pour ma boutique.";
const whatsappContactNumber = process.env.NEXT_PUBLIC_TIKCHOP_WHATSAPP || "";
const publicContactEmail = process.env.NEXT_PUBLIC_TIKCHOP_CONTACT_EMAIL || "";
const whatsappTrialHref = whatsappContactNumber
  ? `https://wa.me/${whatsappContactNumber}?text=${encodeURIComponent(whatsappTrialMessage)}`
  : `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappTrialMessage)}`;
const trialFallbackHref = publicContactEmail
  ? `mailto:${publicContactEmail}?subject=${encodeURIComponent("Acces gratuit Tikchop")}&body=${encodeURIComponent(whatsappTrialMessage)}`
  : whatsappTrialHref;

function WhatsappTrialButton({ className = "tk-dark-button tk-big-button", label = "Demander l'essai sur WhatsApp", showArrow = true }) {
  const href = !whatsappContactNumber && publicContactEmail ? trialFallbackHref : whatsappTrialHref;
  const mailto = href.startsWith("mailto:");
  return (
    <a href={href} className={`tk-whatsapp-button ${className}`} target={mailto ? undefined : "_blank"} rel={mailto ? undefined : "noreferrer"}>
      <MessageCircle size={18} />
      {label}
      {showArrow ? <ArrowRight size={18} /> : null}
    </a>
  );
}

function ProductPhoto({ product, priority = false }) {
  return (
    <div className="tk-product-photo">
      <Image src={product.image} alt={product.name} width={360} height={280} sizes="(max-width: 760px) 44vw, 220px" priority={priority} />
    </div>
  );
}

/* ============================================================
   Server Component — renders once, fully static HTML
   ============================================================ */

export default function TikchopLanding() {
  return (
    <div className="tk-page">
      {/* ── Navigation ── */}
      <header className="tk-nav">
        <Link href="/site" className="tk-brand" aria-label="Tikchop accueil">
          <span className="tk-logo-mark" aria-hidden="true" />
          Tikchop
        </Link>
        <nav aria-label="Navigation Tikchop" className="hidden md:flex">
          <a href="#demo">Démo</a>
          <a href="#fatim">Cas Fatim</a>
          <a href="#abidjan">Abidjan</a>
          <a href="#acces">Accès</a>
        </nav>
        <div className="tk-nav-actions">
          <Link href="/app" className="tk-light-button hidden md:inline-flex">
            App vendeur
          </Link>
          <WhatsappTrialButton className="tk-dark-button tk-nav-whatsapp" label="Accès gratuit" showArrow={false} />
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="tk-hero">
          <div className="tk-hero-copy">
            <p className="tk-eyebrow">
              <Sparkles size={16} />
              Pour vendeuses et vendeurs WhatsApp
            </p>
            <h1>Votre boutique en ligne, avec un assistant WhatsApp qui vend avec vous.</h1>
            <p className="tk-hero-lead">
              Vous vendez sur TikTok, Instagram ou WhatsApp ? Tikchop vous aide à présenter vos articles, répondre plus vite, recevoir des commandes claires et organiser la livraison sans vous noyer dans les messages.
            </p>
            <div className="tk-hero-actions">
              <WhatsappTrialButton label="Tester avec ma boutique" />
              <a href="#demo" className="tk-light-button hidden md:inline-flex">
                Voir une boutique exemple
              </a>
            </div>
            <div className="tk-win-row">
              {proof.map((item) => (
                <div className="tk-win-card" key={item.label}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
              <div className="tk-win-card tk-win-card-lottie" aria-hidden="true">
                <TikchopLottie name="coin" size={54} />
              </div>
            </div>
          </div>

          {/* Desktop-only decorative stage */}
          <div className="tk-screen-stage tk-float-soft hidden lg:block">
            <DesktopOpsPanel />
            <IphoneShopMockup />
            <FloatingPhotoCards />
            <DesktopFlowPills />
            <div className="tk-live-chip tk-float-slow">
              <span />
              Catalogue réel + assistant WhatsApp + commandes suivies
            </div>
          </div>

          {/* Mobile-only compact mockup */}
          <div className="lg:hidden mt-8">
            <IphoneShopMockup compact />
            <div className="tk-mobile-floating mt-4">
              <BarChart3 size={18} />
              Catalogue réel, commandes suivies
            </div>
          </div>
        </section>

        {/* ── Clarity ── */}
        <section className="tk-clarity-section" id="utilite">
          <div className="tk-clarity-copy tk-reveal">
            <p className="tk-eyebrow">À quoi ça sert ?</p>
            <h2>Vous gardez WhatsApp, mais vous arrêtez de tout gérer dans le désordre.</h2>
            <p>
              Quand les demandes arrivent de TikTok, des statuts, des lives et des messages privés, tout se mélange vite. Tikchop vous aide à répondre, ranger, confirmer le paiement et organiser la livraison.
            </p>
          </div>
          <div className="tk-clarity-grid">
            {clarityCards.map((item) => {
              const Icon = item.icon;
              return (
                <article className="tk-clarity-card tk-reveal" key={item.title}>
                  <Icon size={22} />
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              );
            })}
          </div>
          <div className="tk-outcome-panel">
            <span>Ce que vous gagnez</span>
            <div>
              {outcomeCards.map((item) => (
                <p key={item}>
                  <Check size={16} />
                  {item}
                </p>
              ))}
            </div>
          </div>
        </section>

        {/* ── Demo ── */}
        <section className="tk-product-section" id="demo">
          <div className="tk-section-copy tk-reveal">
            <p className="tk-eyebrow">Démo boutique</p>
            <h2>Une vitrine simple que vos clientes comprennent vite.</h2>
            <p>
              Photos propres, prix visibles, bouton WhatsApp et commande guidée. Le client voit l&apos;article, choisit, puis envoie sa demande sans chercher dans vos anciens statuts.
            </p>
          </div>
          <div>
            {/* Desktop: 3D marquee */}
            <div className="hidden md:block">
              <ProductPhotoMarquee />
            </div>
            <div className="tk-feature-grid">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article className="tk-feature-card tk-reveal" key={feature.title}>
                    <Icon size={24} />
                    <h3>{feature.title}</h3>
                    <p>{feature.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Case Study: Fatim ── */}
        <CaseStudySection />

        {/* ── Abidjan ── */}
        <section className="tk-abidjan-section" id="abidjan">
          <div className="tk-abidjan-panel">
            <p className="tk-eyebrow">Pensé pour vendre localement</p>
            <h2>Les habitudes d&apos;Abidjan, avec des commandes mieux rangées.</h2>
            <div className="tk-local-grid">
              {localSignals.map((signal) => (
                <span key={signal}>
                  <Check size={16} />
                  {signal}
                </span>
              ))}
            </div>
          </div>
          <div className="tk-chat-panel" aria-label="Exemple de conversation WhatsApp">
            <div className="tk-chat-top">
              <span className="tk-chat-top-lottie">
                <TikchopLottie name="chat" size={46} />
              </span>
              <span>Salia Boutique</span>
              <span>En ligne</span>
            </div>
            <div className="tk-chat client">Bonjour, le sac raphia est-il disponible ?</div>
            <div className="tk-chat bot">Oui, il est disponible. Le prix est de 10 000 F. Paiement a la livraison possible selon la zone, ou Wave/Orange Money si vous voulez payer avant. Livraison possible aujourd&apos;hui à Cocody, Marcory ou Yopougon.</div>
            <div className="tk-process-label">
              <Sparkles size={14} />
              Le processus Tikchop
            </div>
            <div className="tk-process-track" aria-label="Processus Tikchop">
              {demoProcess.map((item) => {
                const Icon = item.icon;
                return (
                  <div className="tk-process-step" key={item.label}>
                    <span>
                      <Icon size={15} />
                    </span>
                    <strong>{item.label}</strong>
                    <small>{item.text}</small>
                  </div>
                );
              })}
            </div>
            <div className="tk-order-summary">
              <PackageCheck size={20} />
              <div>
                <strong>Commande prête</strong>
                <span>Sac raphia, Cocody, paiement Wave confirmé, reçu envoyé</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Payment ── */}
        <section className="tk-payment-section">
          <div className="tk-payment-copy">
            <p className="tk-eyebrow">Encaissement local</p>
            <h2>Vous expliquez moins, le client comprend mieux.</h2>
            <p>
              Les moyens de paiement que vous acceptez sont visibles et faciles à choisir. Le client sait quoi faire, et la commande garde le bon montant, la bonne commune et le bon statut.
            </p>
          </div>
          <div className="tk-payment-grid">
            {paymentSignals.map((item) => {
              const Icon = item.icon;
              return (
                <article className="tk-payment-card tk-reveal" key={item.title}>
                  <Icon size={22} />
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── Pricing ── */}
        <section className="tk-pricing-section" id="acces">
          <div>
            <p className="tk-eyebrow">Accès lancement</p>
            <h2>Tikchop est gratuit pour le moment, pendant la phase de lancement.</h2>
          </div>
          <div className="tk-price-card">
            <span className="tk-price-label">Boutique</span>
            <strong>Accès gratuit actuellement</strong>
            <p>Vous pouvez créer votre boutique, ajouter vos articles, recevoir des commandes et tester le parcours avec vos vrais clients pendant la phase de lancement.</p>
            <WhatsappTrialButton label="Demander mon accès gratuit" />
          </div>
          <div className="tk-price-card tk-price-card-dark">
            <span className="tk-price-label">Évolution</span>
            <strong>Modèle freemium à venir</strong>
            <p>Plus tard, certaines options avancées pourront devenir payantes. Pour l&apos;instant, l&apos;objectif est de tester, améliorer et accompagner les premières boutiques.</p>
            <WhatsappTrialButton className="tk-light-button" label="Demander l'accès" />
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="tk-whatsapp-cta">
          <TikchopLottie name="sparkle" size={150} className="tk-cta-lottie" />
          <div>
            <p className="tk-eyebrow">Accès gratuit</p>
            <h2>Testez avec votre vraie boutique, pas avec une démo vide.</h2>
            <p>
              Envoyez simplement la demande. Vous pourrez tester Tikchop avec vos articles, votre numéro WhatsApp et vos habitudes de livraison.
            </p>
          </div>
          <WhatsappTrialButton label="Demander mon accès gratuit" />
        </section>
      </main>
    </div>
  );
}

/* ============================================================
   Sub-components (all server-side, no interactivity)
   ============================================================ */

function CaseStudySection() {
  return (
    <>
      <section className="fatim-section" id="fatim">
        <div className="fatim-photo-card">
          <Image src="/landing/fatim-jeune-friperie.jpg" alt="Fatim, jeune vendeuse de friperie et textiles" width={720} height={540} sizes="(max-width: 760px) 92vw, 42vw" />
          <div className="fatim-photo-overlay">
            <span>Fatim</span>
            <strong>Friperie, lives TikTok, commandes WhatsApp</strong>
          </div>
        </div>

        <div className="fatim-story">
          <p className="install-eyebrow">Exemple vendeur</p>
          <h2>Fatim savait déjà vendre. Le problème, c&apos;était le désordre après le live.</h2>
          <p>
            Fatim vendait des vêtements de friperie. Le soir, elle faisait ses lives TikTok pour montrer les arrivages. La journée, elle devait reprendre les commandes arrivées sur WhatsApp, vérifier les captures, répondre aux tailles, confirmer les prix et retrouver qui avait demandé quoi.
          </p>
          <p>
            Quand elle répondait trop tard, le client n&apos;était plus toujours intéressé. Et quand huit personnes voulaient le même article, il fallait fouiller conversation par conversation. Sa galerie devenait un stock de captures d&apos;écran, mais pas un vrai système de vente.
          </p>

          <div className="fatim-pain-grid">
            {fatimPain.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label}>
                  <Icon size={19} />
                  <strong>{item.label}</strong>
                  <span>{item.text}</span>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="fatim-after">
        <div>
          <p className="install-eyebrow">Après Tikchop</p>
          <h2>Fatim garde son énergie pour vendre, pas pour fouiller WhatsApp.</h2>
        </div>
        <div className="fatim-after-grid">
          <article className="fatim-result-card">
            <Zap size={22} />
            <strong>Avant la fin de la semaine de test</strong>
            <p>
              Le but n&apos;est pas de changer sa façon de vendre. Tikchop enlève surtout les captures perdues, les réponses répétées et les commandes difficiles à suivre.
            </p>
          </article>
          <article className="fatim-whatsapp-card" aria-label="Simulation WhatsApp Tikchop">
            <div className="fatim-chat-head">
              <span>TC</span>
              <div>
                <strong>Tikchop Assistant</strong>
                <small>Réponse automatique</small>
              </div>
            </div>
            <div className="fatim-chat client">Le jean du live est encore disponible ?</div>
            <div className="fatim-chat bot">Oui. Taille 40, 7 500 FCFA. Paiement a la livraison possible, ou Wave/Orange Money si vous preferez payer avant.</div>
            <div className="fatim-order">
              <PackageCheck size={18} />
              <span>Commande enregistrée : jean friperie, Yopougon, paiement Wave confirmé</span>
            </div>
          </article>
        </div>
        <div className="fatim-help-list">
          {tikchopHelp.map((item) => (
            <span key={item}>
              <Check size={16} />
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="fatim-automation-section" id="fatim-automation">
        <div className="fatim-automation-copy">
          <p className="install-eyebrow">Prise en charge automatique</p>
          <h2>La commande ne reste plus bloquée dans WhatsApp.</h2>
          <p>
            Dans une boutique de vêtements, le client peut passer de la question à la commande sans que tout reste bloqué dans une discussion. Vous récupérez les bonnes informations et vous avancez plus vite.
          </p>
        </div>
        <div className="fatim-automation-grid">
          {automationSteps.map((step) => {
            const Icon = step.icon;
            return (
              <article key={step.title}>
                <Icon size={22} />
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            );
          })}
        </div>
        <div className="fatim-delivery-note">
          <TikchopLottie name="truck" size={64} />
          <div>
            <strong>Vos livreurs habituels restent dans votre organisation</strong>
            <p>
              Vous pouvez garder les numéros WhatsApp des livreurs, leurs zones, leurs frais et leurs disponibilités. Quand une commande arrive à Yopougon ou Cocody, Tikchop prépare une fiche claire à envoyer.
            </p>
          </div>
        </div>
      </section>

      <section className="fatim-setup-section" id="fatim-creation">
        <div>
          <p className="install-eyebrow">Création de boutique</p>
          <h2>Lancer une boutique de vêtements sans vous compliquer la vie.</h2>
        </div>
        <div className="fatim-setup-timeline">
          {boutiqueSetupSteps.map((step, index) => (
            <article key={step.title}>
              <span>{index + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function IphoneShopMockup({ compact = false }) {
  return (
    <div className={`tk-iphone ${compact ? "is-compact" : ""}`} aria-label="Mockup iPhone boutique Tikchop">
      <div className="tk-iphone-island" />
      <div className="tk-shop-ui">
        <header className="tk-shop-header">
          <span className="tk-avatar">SA</span>
          <div>
            <strong>Salia Boutique</strong>
            <span>Abidjan, livraison aujourd&apos;hui</span>
          </div>
          <button type="button" aria-label="Contacter sur WhatsApp">
            <MessageCircle size={16} />
          </button>
        </header>

        <div className="tk-shop-tabs" aria-label="Catégories boutique">
          <span>Tous</span>
          <span>Wax</span>
          <span>Sacs</span>
          <span>Beauté</span>
        </div>

        <article className="tk-featured-product">
          <ProductPhoto product={products[0]} priority />
          <div>
            <small>{products[0].tag}</small>
            <strong>{products[0].name}</strong>
            <span>{products[0].price}</span>
          </div>
        </article>

        <div className="tk-shop-grid">
          {products.slice(1, 5).map((product) => (
            <article key={product.name} className="tk-shop-product">
              <ProductPhoto product={product} />
              <small>{product.tag}</small>
              <strong>{product.name}</strong>
              <span>{product.price}</span>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function DesktopOpsPanel() {
  return (
    <aside className="tk-ops-panel tk-reveal" aria-label="Apercu espace vendeur Tikchop">
      <div className="tk-ops-top">
        <div>
          <span>Espace vendeur</span>
          <strong>Commandes du live</strong>
        </div>
        <BarChart3 size={20} />
      </div>
      <div className="tk-ops-metrics">
        <div>
          <strong>24</strong>
          <span>messages</span>
        </div>
        <div>
          <strong>9</strong>
          <span>commandes</span>
        </div>
      </div>
      <div className="tk-ops-orders">
        {orders.map((order) => (
          <div key={`${order.name}-${order.zone}`}>
            <span>{order.name}</span>
            <strong>{order.amount}</strong>
            <small>{order.zone} - {order.status}</small>
          </div>
        ))}
      </div>
    </aside>
  );
}

function FloatingPhotoCards() {
  return (
    <div className="tk-floating-products" aria-hidden="true">
      {products.slice(1).map((product, index) => (
        <div className="tk-float-card tk-float-soft" key={product.name} style={{ animationDelay: `${index * 0.35}s` }}>
          <ProductPhoto product={product} priority />
          <strong>{product.name}</strong>
          <span>{product.price}</span>
        </div>
      ))}
    </div>
  );
}

function DesktopFlowPills() {
  return (
    <div className="tk-flow-pills" aria-label="Flux de vente Tikchop">
      {desktopFlow.map((item, index) => {
        const Icon = item.icon;
        return (
          <div className="tk-flow-pill tk-float-slow" key={item.label} style={{ animationDelay: `${index * 0.35}s` }}>
            <Icon size={18} />
            <div>
              <strong>{item.label}</strong>
              <span>{item.text}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProductPhotoMarquee() {
  const loop = [...products, ...products, ...products];

  return (
    <div className="tk-marquee-3d" aria-label="Défilement 3D des articles populaires">
      <div className="tk-marquee-track">
        {loop.map((product, index) => (
          <article className="tk-marquee-card" key={`${product.name}-${index}`}>
            <ProductPhoto product={product} />
            <strong>{product.name}</strong>
            <span>{product.price}</span>
          </article>
        ))}
      </div>
    </div>
  );
}
