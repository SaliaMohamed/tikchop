"use client";

import Image from "next/image";
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

const reveal = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const wins = [
  { label: "reponse instantanee", value: "24h/24" },
  { label: "essai offert", value: "7 jours" },
  { label: "prix boutique", value: "11 000 F" },
];

const desktopCards = [
  {
    icon: MessageCircle,
    title: "Repondre vite",
    text: "Le client demande prix, stock, taille ou livraison. Tikchop donne une reponse claire pendant que le vendeur est occupe.",
  },
  {
    icon: ReceiptText,
    title: "Prendre la commande",
    text: "Nom, telephone, commune, paiement, produit et total sont ranges dans le dashboard.",
  },
  {
    icon: Truck,
    title: "Livrer sans confusion",
    text: "Les commandes restent propres pour preparer, partager au livreur et relancer le client.",
  },
];

const localFeatures = [
  "Communes d'Abidjan",
  "Wave, Orange Money, MTN",
  "Paiement a la livraison",
  "Relance client automatique",
  "Catalogue avec photos",
  "Multi-boutiques sur demande",
];

const mobileSteps = [
  "Le client ecrit sur WhatsApp",
  "Tikchop repond et confirme les infos",
  "La commande arrive dans l'app",
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
      <header className="tk-nav">
        <Link href="/" className="tk-brand" aria-label="Tikchop accueil">
          <span>T</span>
          Tikchop
        </Link>
        <nav aria-label="Navigation Tikchop">
          <a href="#produit">Produit</a>
          <a href="#abidjan">Abidjan</a>
          <a href="#prix">Prix</a>
        </nav>
        <div className="tk-nav-actions">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/onboarding" className="tk-dark-button">
            Essai gratuit
          </Link>
        </div>
      </header>

      <main>
        <section className="tk-hero">
          <motion.div className="tk-hero-copy" initial="hidden" animate="visible" variants={stagger}>
            <motion.p className="tk-eyebrow" variants={reveal}>
              <Sparkles size={16} />
              Pour les vendeurs TikTok, Instagram et WhatsApp a Abidjan
            </motion.p>
            <motion.h1 variants={reveal}>Vends plus vite quand les clients ecrivent.</motion.h1>
            <motion.p className="tk-hero-lead" variants={reveal}>
              Tikchop combine une boutique mobile, un assistant WhatsApp et un dashboard vendeur. En quelques secondes, le client comprend, commande et le vendeur suit tout proprement.
            </motion.p>
            <motion.div className="tk-hero-actions" variants={reveal}>
              <Link href="/onboarding" className="tk-dark-button tk-big-button">
                Tester 7 jours gratuitement
                <ArrowRight size={18} />
              </Link>
              <a href="#produit" className="tk-light-button">
                Voir comment ca marche
              </a>
            </motion.div>
            <motion.div className="tk-win-row" variants={stagger}>
              {wins.map((win) => (
                <motion.div className="tk-win-card" key={win.label} variants={reveal}>
                  <strong>{win.value}</strong>
                  <span>{win.label}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div
            className="tk-screen-stage"
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <div className="tk-screen-card tk-screen-shop">
              <Image src="/tikchop-shop-preview.png" alt="Boutique mobile Tikchop avec produits" width={390} height={844} priority />
            </div>
            <div className="tk-screen-card tk-screen-dashboard">
              <Image src="/tikchop-dashboard-preview.png" alt="Dashboard vendeur Tikchop" width={390} height={844} priority />
            </div>
            <motion.div className="tk-live-chip" animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
              <span />
              Commandes WhatsApp + boutique dans un seul espace
            </motion.div>
          </motion.div>
        </section>

        <section className="tk-product-section" id="produit">
          <div className="tk-section-copy">
            <p className="tk-eyebrow">Ce que le site doit faire comprendre</p>
            <h2>Ce n&apos;est pas juste un chatbot. C&apos;est un vendeur digital.</h2>
            <p>
              Le site explique Tikchop sans long discours : repondre aux clients, prendre les commandes, suivre la livraison et montrer au commercant qu&apos;il perd moins d&apos;opportunites.
            </p>
          </div>
          <div className="tk-feature-grid">
            {desktopCards.map((card) => {
              const Icon = card.icon;
              return (
                <motion.article className="tk-feature-card" key={card.title} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.35 }} variants={reveal}>
                  <Icon size={24} />
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                </motion.article>
              );
            })}
          </div>
        </section>

        <section className="tk-abidjan-section" id="abidjan">
          <div className="tk-abidjan-panel">
            <p className="tk-eyebrow">Reference ivoirienne</p>
            <h2>La demo doit parler comme un business d&apos;Abidjan.</h2>
            <div className="tk-local-grid">
              {localFeatures.map((feature) => (
                <span key={feature}>
                  <Check size={16} />
                  {feature}
                </span>
              ))}
            </div>
          </div>
          <div className="tk-chat-panel" aria-label="Exemple de conversation WhatsApp">
            <div className="tk-chat-top">
              <span>Salia Boutique</span>
              <span>En ligne</span>
            </div>
            <div className="tk-chat client">Bonjour, la robe rouge est disponible ?</div>
            <div className="tk-chat bot">Oui disponible. Prix 15 000 F. Livraison possible a Cocody, Marcory, Yopougon.</div>
            <div className="tk-order-summary">
              <PackageCheck size={20} />
              <div>
                <strong>Commande prete</strong>
                <span>Robe Premium, Cocody, paiement Wave</span>
              </div>
            </div>
          </div>
        </section>

        <section className="tk-pricing-section" id="prix">
          <div>
            <p className="tk-eyebrow">Offre simple</p>
            <h2>Un prix facile a comprendre, une semaine pour convaincre.</h2>
          </div>
          <div className="tk-price-card">
            <span className="tk-price-label">1 boutique</span>
            <strong>11 000 FCFA</strong>
            <p>par mois apres 7 jours gratuits. App + chatbot WhatsApp dans la meme offre.</p>
            <Link href="/onboarding" className="tk-dark-button tk-big-button">
              Demarrer le test
              <ChevronRight size={18} />
            </Link>
          </div>
          <div className="tk-price-card tk-price-card-dark">
            <span className="tk-price-label">Plusieurs boutiques</span>
            <strong>Prix pro</strong>
            <p>Pour agences, vendeurs avec plusieurs pages, plusieurs numeros ou plusieurs catalogues.</p>
            <Link href="/onboarding" className="tk-light-button">
              Creer une boutique
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
            Vendeurs d&apos;Abidjan
          </p>
          <h1>Ton WhatsApp peut vendre meme quand tu es occupe.</h1>
          <p>
            Tikchop repond, confirme les commandes et range tout dans ton application.
          </p>
          <Link href="/onboarding" className="tk-dark-button tk-big-button">
            Commencer gratuitement
            <ArrowRight size={18} />
          </Link>
        </section>

        <section className="tk-mobile-screen">
          <Image src="/tikchop-shop-preview.png" alt="Boutique Tikchop sur mobile" width={390} height={844} priority />
          <div className="tk-mobile-floating">
            <BarChart3 size={18} />
            47 clients traites cette semaine
          </div>
        </section>

        <section className="tk-mobile-steps">
          {mobileSteps.map((step, index) => (
            <div key={step}>
              <span>{index + 1}</span>
              <p>{step}</p>
            </div>
          ))}
        </section>

        <section className="tk-mobile-local">
          <h2>Fait pour vendre ici.</h2>
          <div>
            <span><Truck size={17} /> Communes d&apos;Abidjan</span>
            <span><Wallet size={17} /> Wave et Mobile Money</span>
            <span><Clock3 size={17} /> Relances automatiques</span>
            <span><ShieldCheck size={17} /> Commandes propres</span>
          </div>
        </section>

        <section className="tk-mobile-price">
          <span>1 boutique</span>
          <strong>11 000 FCFA/mois</strong>
          <p>La premiere semaine est offerte. App + chatbot ensemble.</p>
          <Link href="/onboarding" className="tk-dark-button tk-big-button">
            Tester Tikchop
          </Link>
        </section>
      </main>
    </div>
  );
}
