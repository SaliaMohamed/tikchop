"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Clock3,
  MessageCircle,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Truck,
  Wallet,
} from "lucide-react";

const products = [
  {
    name: "Pagne wax premium",
    price: "15 000 F",
    tag: "Top vente",
    image: "/landing/fabric-display.jpg",
  },
  {
    name: "Tissus boutique",
    price: "12 000 F",
    tag: "Adjamé",
    image: "/landing/wax-shop.jpg",
  },
  {
    name: "Sacs raphia",
    price: "10 000 F",
    tag: "Nouveau",
    image: "/landing/raffia-bags.jpg",
  },
  {
    name: "Sac africain",
    price: "18 000 F",
    tag: "Cocody",
    image: "/landing/african-handbag.jpg",
  },
  {
    name: "Beurre de karité",
    price: "4 500 F",
    tag: "Beauté",
    image: "/landing/shea-butter.jpg",
  },
];

const proof = [
  { label: "essai offert", value: "7 jours" },
  { label: "offre 1 boutique", value: "11 000 F" },
  { label: "réponse client", value: "instantanée" },
];

const features = [
  {
    icon: MessageCircle,
    title: "Réponses WhatsApp rapides",
    text: "Prix, disponibilité, livraison et paiement sont envoyés sans laisser le client attendre.",
  },
  {
    icon: ReceiptText,
    title: "Commandes bien rangées",
    text: "Chaque commande arrive avec produit, commune, téléphone, total et statut de paiement.",
  },
  {
    icon: Truck,
    title: "Livraison locale plus simple",
    text: "Cocody, Marcory, Yopougon, Abobo ou Koumassi peuvent être préparés comme zones de livraison.",
  },
];

const localSignals = [
  "Pagne, sacs, beauté, accessoires",
  "Wave, Orange Money, MTN Money",
  "Paiement à la livraison",
  "Relance des clients hésitants",
  "Catalogue avec vraies photos",
  "Multi-boutiques sur demande",
];

export default function TikchopLanding() {
  return (
    <div className="tk-page">
      <DesktopLanding />
      <MobileLanding />
    </div>
  );
}

function DesktopLanding() {
  return (
    <div className="tk-desktop">
      <Header />
      <main>
        <section className="tk-hero">
          <div className="tk-hero-copy">
            <p className="tk-eyebrow">
              <Sparkles size={16} />
              Commerce WhatsApp pour boutiques d&apos;Abidjan
            </p>
            <h1>Une boutique qui vend sur WhatsApp, même aux heures chargées.</h1>
            <p className="tk-hero-lead">
              Tikchop transforme les messages clients en commandes propres : catalogue, réponses WhatsApp, paiements locaux, livraison et suivi vendeur dans une seule expérience.
            </p>
            <div className="tk-hero-actions">
              <Link href="/onboarding" className="tk-dark-button tk-big-button">
                Lancer l&apos;essai gratuit
                <ArrowRight size={18} />
              </Link>
              <a href="#demo" className="tk-light-button">
                Voir la démo boutique
              </a>
            </div>
            <div className="tk-win-row">
              {proof.map((item) => (
                <div className="tk-win-card" key={item.label}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <motion.div
            className="tk-screen-stage"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <IphoneShopMockup />
            <FloatingPhotoCards />
            <motion.div className="tk-live-chip" animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
              <span />
              Catalogue réel + assistant WhatsApp + commandes suivies
            </motion.div>
          </motion.div>
        </section>

        <section className="tk-product-section" id="demo">
          <div className="tk-section-copy">
            <p className="tk-eyebrow">Démo boutique</p>
            <h2>Des produits réalistes, pas des dessins.</h2>
            <p>
              La landing page montre une boutique fictive avec des articles proches du marché local : wax, tissus, sacs, beauté et accessoires populaires.
            </p>
          </div>
          <div>
            <ProductPhotoMarquee />
            <div className="tk-feature-grid">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article className="tk-feature-card" key={feature.title}>
                    <Icon size={24} />
                    <h3>{feature.title}</h3>
                    <p>{feature.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="tk-abidjan-section" id="abidjan">
          <div className="tk-abidjan-panel">
            <p className="tk-eyebrow">Pensé pour vendre localement</p>
            <h2>Le message commercial parle à une boutique, pas à un technicien.</h2>
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
              <span>Salia Boutique</span>
              <span>En ligne</span>
            </div>
            <div className="tk-chat client">Bonjour, le sac raphia est disponible ?</div>
            <div className="tk-chat bot">Oui disponible. Prix 10 000 F. Livraison possible aujourd&apos;hui à Cocody, Marcory ou Yopougon.</div>
            <div className="tk-order-summary">
              <PackageCheck size={20} />
              <div>
                <strong>Commande prête</strong>
                <span>Sac raphia, Cocody, paiement Wave</span>
              </div>
            </div>
          </div>
        </section>

        <section className="tk-pricing-section" id="prix">
          <div>
            <p className="tk-eyebrow">Offre simple</p>
            <h2>Une semaine gratuite pour prouver la valeur.</h2>
          </div>
          <div className="tk-price-card">
            <span className="tk-price-label">1 boutique</span>
            <strong>11 000 FCFA</strong>
            <p>Par mois après l&apos;essai. Application boutique + assistant WhatsApp dans la même offre.</p>
            <Link href="/onboarding" className="tk-dark-button tk-big-button">
              Tester Tikchop
              <ChevronRight size={18} />
            </Link>
          </div>
          <div className="tk-price-card tk-price-card-dark">
            <span className="tk-price-label">Plusieurs boutiques</span>
            <strong>Prix pro</strong>
            <p>Pour boutiques avec plusieurs pages, vendeurs, catalogues ou numéros WhatsApp.</p>
            <Link href="/onboarding" className="tk-light-button">
              Créer une boutique
              <ChevronRight size={18} />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function MobileLanding() {
  return (
    <div className="tk-mobile">
      <header className="tk-mobile-top">
        <Link href="/" className="tk-brand" aria-label="Tikchop accueil">
          <span>T</span>
          Tikchop
        </Link>
        <Link href="/onboarding">Essai 7j</Link>
      </header>

      <main>
        <section className="tk-mobile-hero">
          <p className="tk-eyebrow">
            <Sparkles size={15} />
            Boutiques d&apos;Abidjan
          </p>
          <h1>Les messages WhatsApp deviennent des commandes propres.</h1>
          <p>
            Une boutique mobile, un assistant de vente et un tableau de bord pour suivre les clients.
          </p>
          <Link href="/onboarding" className="tk-dark-button tk-big-button">
            Lancer l&apos;essai gratuit
            <ArrowRight size={18} />
          </Link>
        </section>

        <section className="tk-mobile-screen">
          <IphoneShopMockup compact />
          <div className="tk-mobile-floating">
            <BarChart3 size={18} />
            Catalogue réel, commandes suivies
          </div>
        </section>

        <section className="tk-mobile-steps">
          <div>
            <span>1</span>
            <p>Le client demande un prix ou une livraison.</p>
          </div>
          <div>
            <span>2</span>
            <p>Tikchop répond et récupère les informations.</p>
          </div>
          <div>
            <span>3</span>
            <p>La commande apparaît dans le dashboard vendeur.</p>
          </div>
        </section>

        <section className="tk-mobile-local">
          <h2>Une offre adaptée au commerce local.</h2>
          <div>
            <span><Truck size={17} /> Livraison par commune</span>
            <span><Wallet size={17} /> Paiements mobiles</span>
            <span><Clock3 size={17} /> Relances clients</span>
            <span><ShieldCheck size={17} /> Commandes structurées</span>
          </div>
        </section>

        <section className="tk-mobile-price">
          <span>1 boutique</span>
          <strong>11 000 FCFA/mois</strong>
          <p>La première semaine est offerte. Application + assistant WhatsApp.</p>
          <Link href="/onboarding" className="tk-dark-button tk-big-button">
            Tester Tikchop
          </Link>
        </section>
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="tk-nav">
      <Link href="/" className="tk-brand" aria-label="Tikchop accueil">
        <span>T</span>
        Tikchop
      </Link>
      <nav aria-label="Navigation Tikchop">
        <a href="#demo">Démo</a>
        <a href="#abidjan">Abidjan</a>
        <a href="#prix">Prix</a>
      </nav>
      <div className="tk-nav-actions">
        <Link href="/install">Installer</Link>
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/onboarding" className="tk-dark-button">
          Essai gratuit
        </Link>
      </div>
    </header>
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
              <ProductPhoto product={product} priority />
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

function FloatingPhotoCards() {
  return (
    <div className="tk-floating-products" aria-hidden="true">
      {products.slice(1).map((product, index) => (
        <motion.div
          className="tk-float-card"
          key={product.name}
          animate={{ y: [0, -12, 0], rotate: [-2, 2, -2] }}
          transition={{ duration: 4 + index * 0.35, repeat: Infinity, ease: "easeInOut" }}
        >
          <ProductPhoto product={product} priority />
          <strong>{product.name}</strong>
          <span>{product.price}</span>
        </motion.div>
      ))}
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

function ProductPhoto({ product, priority = false }) {
  return (
    <div className="tk-product-photo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={product.image} alt={product.name} loading={priority ? "eager" : "lazy"} />
    </div>
  );
}
