import Link from "next/link";
import {
  Check,
  Download,
  Home,
  MonitorDown,
  MoreVertical,
  PackageCheck,
  Share,
  Smartphone,
  Zap,
} from "lucide-react";
import PwaInstallPrompt from "../components/PwaInstallPrompt";

export const metadata = {
  title: "Installer Tikchop sur mobile",
  description: "Guide simple pour installer Tikchop comme une application mobile depuis le navigateur.",
};

const steps = [
  {
    title: "Android",
    subtitle: "Chrome",
    icon: Smartphone,
    steps: ["Ouvrez Tikchop dans Chrome", "Appuyez sur Installer ou sur le menu", "Retrouvez Tikchop sur l'ecran d'accueil"],
    tone: "green",
  },
  {
    title: "iPhone",
    subtitle: "Safari",
    icon: Share,
    steps: ["Ouvrez Tikchop dans Safari", "Touchez le bouton Partager", "Choisissez Ajouter a l'ecran d'accueil"],
    tone: "gold",
  },
  {
    title: "Ordinateur",
    subtitle: "Chrome ou Edge",
    icon: MonitorDown,
    steps: ["Ouvrez Tikchop dans le navigateur", "Cliquez sur l'icone Installer", "Lancez Tikchop comme une app"],
    tone: "blue",
  },
];

const benefits = [
  "Ouvrir Tikchop depuis l'ecran d'accueil",
  "Ajouter des articles plus vite",
  "Voir les commandes sans chercher le lien",
  "Garder l'espace vendeur separe du site public",
];

export default function InstallPage() {
  return (
    <main className="install-page">
      <section className="install-hero">
        <div className="install-copy">
          <p className="install-eyebrow">Installation mobile</p>
          <h1>Tikchop s&apos;installe comme une vraie app, sans Play Store.</h1>
          <p>
            Pour les vendeuses, le plus simple est d&apos;avoir Tikchop directement sur l&apos;ecran du telephone:
            photos, commandes, WhatsApp et boutique restent a portee de main.
          </p>
          <div className="install-actions">
            <a href="#installer" className="install-primary">
              Installer maintenant
              <Download size={18} />
            </a>
            <Link href="/onboarding" className="install-secondary">
              Creer ma boutique
            </Link>
          </div>
        </div>

        <div className="install-visual" aria-hidden="true">
          <div className="install-phone">
            <div className="install-island" />
            <div className="install-app-card">
              <span className="install-logo-mini">T</span>
              <strong>Tikchop</strong>
              <small>Assistant vendeur</small>
            </div>
            <div className="install-browser-bar">
              <span>tikchop.app</span>
              <MoreVertical size={17} />
            </div>
            <div className="install-share-sheet">
              <div>
                <Share size={18} />
                <span>Partager</span>
              </div>
              <div>
                <Home size={18} />
                <span>Ecran d&apos;accueil</span>
              </div>
              <div>
                <Download size={18} />
                <span>Installer</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="install-explain">
        <div>
          <p className="install-eyebrow">Pourquoi l&apos;installer ?</p>
          <h2>La vendeuse ne doit pas chercher Tikchop. Tikchop doit etre dans sa poche.</h2>
        </div>
        <div className="install-benefits">
          {benefits.map((item) => (
            <span key={item}>
              <Check size={16} />
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="fatim-after">
        <div>
          <p className="install-eyebrow">Apres installation</p>
          <h2>Le parcours reste simple: photos, validation, commandes.</h2>
        </div>
        <div className="fatim-after-grid">
          <article className="fatim-result-card">
            <Zap size={22} />
            <strong>Un raccourci clair sur le telephone</strong>
            <p>
              La vendeuse appuie sur Tikchop, ajoute les photos des articles, met les prix, puis laisse l&apos;assistant
              repondre et organiser les commandes.
            </p>
          </article>
          <article className="fatim-whatsapp-card" aria-label="Simulation Tikchop">
            <div className="fatim-chat-head">
              <span>TC</span>
              <div>
                <strong>Tikchop</strong>
                <small>Vente WhatsApp</small>
              </div>
            </div>
            <div className="fatim-chat client">Le sac raphia est encore disponible ?</div>
            <div className="fatim-chat bot">Oui. Prix 10 000 F. Paiement Wave possible. Livraison a Cocody aujourd&apos;hui.</div>
            <div className="fatim-order">
              <PackageCheck size={18} />
              <span>Commande prete: sac raphia, Cocody, paiement Wave</span>
            </div>
          </article>
        </div>
      </section>

      <section className="install-steps" aria-label="Methodes d'installation">
        {steps.map((item) => {
          const Icon = item.icon;
          return (
            <article className={`install-step-card tone-${item.tone}`} key={item.title}>
              <div className="install-step-illustration" aria-hidden="true">
                <Icon size={28} />
                <div className="install-mini-screen">
                  <span />
                  <strong>Tikchop</strong>
                  <small>Ajouter a l&apos;ecran</small>
                </div>
              </div>
              <p>{item.subtitle}</p>
              <h3>{item.title}</h3>
              <ol>
                {item.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </article>
          );
        })}
      </section>

      <section className="install-action-panel" id="installer">
        <div>
          <p className="install-eyebrow">Action</p>
          <h2>Installer Tikchop sur cet appareil.</h2>
          <p>
            Si le bouton automatique n&apos;apparait pas, ouvrez cette page avec Chrome sur Android ou Safari sur iPhone,
            puis utilisez le menu du navigateur.
          </p>
        </div>
        <PwaInstallPrompt variant="page" />
      </section>
    </main>
  );
}
