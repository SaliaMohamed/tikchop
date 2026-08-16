import Link from "next/link";
import {
  Check,
  Download,
  Home,
  MoreVertical,
  Share,
  Smartphone,
} from "lucide-react";
import PwaInstallPrompt from "../components/PwaInstallPrompt";
import BrandLogo from "../components/BrandLogo";

export const metadata = {
  title: "Installer la PWA Tikchop",
  description: "Installer Tikchop sur mobile depuis Chrome ou Safari.",
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
];

const benefits = [
  "Tikchop reste sur l'écran d'accueil",
  "Les vendeuses ouvrent commandes et articles plus vite",
  "Fonctionne déjà sur Android, iPhone et ordinateur",
];

export default function InstallPage() {
  return (
    <main className="install-page">
      <section className="install-hero">
        <div className="install-copy">
          <BrandLogo href="/" subtitle="App vendeur" className="mb-5" />
          <p className="install-eyebrow">PWA mobile</p>
          <h1>Installez Tikchop comme une vraie app.</h1>
          <p>
            Ajoutez Tikchop sur l&apos;ecran d&apos;accueil. Les articles, commandes, WhatsApp et livraisons restent
            accessibles en un geste.
          </p>
          <div className="install-actions">
            <a href="#installer" className="install-primary">
              Installer maintenant
              <Download size={18} />
            </a>
            <Link href="/signup" className="install-secondary">
              Creer ma boutique
            </Link>
          </div>
        </div>

        <div className="install-visual" aria-hidden="true">
          <div className="install-phone">
            <div className="install-island" />
            <div className="install-app-card">
              <span className="install-logo-mini tk-logo-mark" aria-hidden="true" />
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
          <h2>Plus simple pour vendre tous les jours.</h2>
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
            Sur Android, Chrome peut afficher un bouton installer. Sur iPhone, utilisez Safari puis Partager.
          </p>
        </div>
        <PwaInstallPrompt variant="page" />
      </section>
    </main>
  );
}
