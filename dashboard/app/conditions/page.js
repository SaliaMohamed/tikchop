import LegalPage from "../components/LegalPage";

export const metadata = {
  title: "Conditions d'utilisation | Tikchop",
  description: "Conditions d'utilisation du service Tikchop.",
};

export default function ConditionsPage() {
  return (
    <LegalPage
      eyebrow="Utilisation"
      title="Conditions d'utilisation"
      intro="Ces conditions encadrent l'utilisation de Tikchop par les vendeurs et les clients qui passent commande depuis une boutique publique."
      sections={[
        {
          title: "Acces au service",
          body: [
            "Tikchop peut etre utilise pour tester, publier une boutique, recevoir des commandes et organiser le suivi WhatsApp.",
            "Certaines fonctions avancees, comme la connexion WhatsApp directe, les paiements en ligne ou les notifications livreur, peuvent dependre de prestataires externes et de la configuration du vendeur.",
          ],
        },
        {
          title: "Commandes et paiements",
          body: [
            "Une commande creee dans Tikchop aide a structurer l'achat, mais le vendeur doit confirmer la disponibilite finale, le paiement et la livraison.",
            "Les paiements en ligne doivent etre testes et valides avec les comptes de paiement du vendeur avant une commercialisation large.",
          ],
        },
        {
          title: "Usages interdits",
          body: [
            "Il est interdit d'utiliser Tikchop pour publier des produits illegaux, trompeurs, dangereux ou non autorises.",
            "Il est interdit de collecter des informations sensibles inutiles ou d'envoyer des messages abusifs aux clients.",
          ],
        },
      ]}
    />
  );
}
