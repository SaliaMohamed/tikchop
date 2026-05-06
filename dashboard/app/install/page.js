import Link from "next/link";
import {
  Camera,
  Check,
  Clock3,
  Download,
  Home,
  MessageCircle,
  MonitorDown,
  MoreVertical,
  PackageCheck,
  Share,
  ShoppingBag,
  Smartphone,
  Zap,
} from "lucide-react";
import PwaInstallPrompt from "../components/PwaInstallPrompt";

export const metadata = {
  title: "Installer Tikchop sans Play Store ni App Store",
  description: "Guide visuel pour installer Tikchop depuis le navigateur comme une application mobile.",
};

const steps = [
  {
    title: "Android",
    subtitle: "Depuis Chrome",
    icon: Smartphone,
    steps: ["Ouvrir Tikchop dans Chrome", "Appuyer sur Installer ou sur le menu ⋮", "Retrouver Tikchop sur l'écran d'accueil"],
    tone: "green",
  },
  {
    title: "iPhone",
    subtitle: "Depuis Safari",
    icon: Share,
    steps: ["Ouvrir Tikchop dans Safari", "Toucher le bouton Partager", "Choisir Sur l'écran d'accueil"],
    tone: "gold",
  },
  {
    title: "Ordinateur",
    subtitle: "Chrome ou Edge",
    icon: MonitorDown,
    steps: ["Ouvrir Tikchop dans le navigateur", "Cliquer sur l'icône Installer", "Lancer Tikchop comme une app de bureau"],
    tone: "blue",
  },
];

const fatimPain = [
  { icon: Clock3, label: "Réponses trop tardives", text: "Le client a déjà acheté ailleurs quand elle revient sur WhatsApp." },
  { icon: Camera, label: "Galerie saturée", text: "Captures de lives, captures de commandes, captures de conversations partout." },
  { icon: ShoppingBag, label: "Même article demandé 8 fois", text: "Sans stock clair, elle doit vérifier à la main qui a confirmé en premier." },
  { icon: MessageCircle, label: "Questions répétées", text: "Prix, taille, livraison, disponibilité: les mêmes réponses toute la journée." },
];

const tikchopHelp = [
  "Répondre pendant que Fatim dort, livre ou prépare son prochain live.",
  "Transformer les messages WhatsApp en commandes propres avec nom, article, commune et paiement.",
  "Éviter de vendre le même produit à plusieurs personnes quand le stock est limité.",
  "Relancer vite les clients intéressés avant qu'ils changent d'avis.",
];

export default function InstallPage() {
  return (
    <main className="install-page">
      <section className="install-hero">
        <div className="install-copy">
          <p className="install-eyebrow">Installation sans store</p>
          <h1>Tikchop s&apos;installe depuis le navigateur, comme une vraie app.</h1>
          <p>
            En attendant une application native sur Play Store et App Store, Tikchop fonctionne comme une application web installable. Aucun téléchargement compliqué, aucun store obligatoire.
          </p>
          <div className="install-actions">
            <a href="#installer" className="install-primary">
              Installer maintenant
              <Download size={18} />
            </a>
            <Link href="/" className="install-secondary">
              Revenir au site
            </Link>
          </div>
        </div>

        <div className="install-visual" aria-hidden="true">
          <div className="install-phone">
            <div className="install-island" />
            <div className="install-app-card">
              <span className="install-logo-mini">T</span>
              <strong>Tikchop</strong>
              <small>Assistant boutique</small>
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
                <span>Écran d&apos;accueil</span>
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
          <p className="install-eyebrow">Pourquoi cette méthode ?</p>
          <h2>Le plus important n&apos;est pas l&apos;installation. C&apos;est le temps gagné.</h2>
        </div>
        <div className="install-benefits">
          <span><Check size={16} /> Réponses plus rapides aux clients</span>
          <span><Check size={16} /> Commandes mieux organisées</span>
          <span><Check size={16} /> Moins de captures d&apos;écran à trier</span>
          <span><Check size={16} /> Moins de ventes perdues</span>
        </div>
      </section>

      <section className="fatim-section" id="fatim">
        <div className="fatim-photo-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/fatim-jeune-friperie.jpg" alt="Fatim, jeune vendeuse de friperie et textiles" />
          <div className="fatim-photo-overlay">
            <span>Fatim</span>
            <strong>Friperie, lives TikTok, commandes WhatsApp</strong>
          </div>
        </div>

        <div className="fatim-story">
          <p className="install-eyebrow">Cas Fatim</p>
          <h2>Elle savait vendre. Ce qui la fatiguait, c&apos;était tout ce qui venait après.</h2>
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
          <p className="install-eyebrow">Avec Tikchop</p>
          <h2>Elle garde l&apos;énergie pour vendre, Tikchop garde l&apos;ordre dans les commandes.</h2>
        </div>
        <div className="fatim-after-grid">
          <article className="fatim-result-card">
            <Zap size={22} />
            <strong>Avant la fin de la semaine de test</strong>
            <p>
              Le genre de résultat recherché est simple: la vendeuse comprend vite que Tikchop ne remplace pas son talent, il retire le désordre qui l&apos;empêche de vendre plus.
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
            <div className="fatim-chat bot">Oui. Taille 40, 7 500 FCFA. Livraison possible aujourd&apos;hui à Yopougon ou Cocody.</div>
            <div className="fatim-order">
              <PackageCheck size={18} />
              <span>Commande enregistrée: Jean friperie, Yopougon, paiement Wave</span>
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

      <section className="install-steps" aria-label="Méthodes d'installation">
        {steps.map((item) => {
          const Icon = item.icon;
          return (
            <article className={`install-step-card tone-${item.tone}`} key={item.title}>
              <div className="install-step-illustration" aria-hidden="true">
                <Icon size={28} />
                <div className="install-mini-screen">
                  <span />
                  <strong>Tikchop</strong>
                  <small>Ajouter à l&apos;écran</small>
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
          <h2>Installer Tikchop sur l&apos;appareil.</h2>
          <p>
            Si le bouton d&apos;installation n&apos;apparaît pas, ouvrir cette page avec Chrome sur Android, Safari sur iPhone, ou Chrome/Edge sur ordinateur.
          </p>
        </div>
        <PwaInstallPrompt variant="page" />
      </section>
    </main>
  );
}
