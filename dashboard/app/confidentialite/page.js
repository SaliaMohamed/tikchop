import LegalPage from "../components/LegalPage";

export const metadata = {
  title: "Confidentialité | Tikchop",
  description: "Politique de confidentialité Tikchop.",
};

export default function ConfidentialitePage() {
  return (
    <LegalPage
      eyebrow="Données personnelles"
      title="Politique de confidentialité"
      intro="Cette page explique les données traitées par Tikchop pour faire fonctionner les boutiques, les commandes, les reçus et les messages de suivi."
      sections={[
        {
          title: "Données collectées",
          body: [
            "Tikchop peut traiter le nom de la boutique, le numéro WhatsApp du vendeur, les articles, les prix, les photos, les commandes, les numéros clients, les adresses de livraison et les informations de paiement nécessaires au suivi.",
            "Les données de paiement sensibles sont traitées par les prestataires de paiement. Tikchop ne doit pas stocker les codes secrets, OTP ou identifiants confidentiels des clients.",
          ],
        },
        {
          title: "Utilisation",
          body: [
            "Les données servent à afficher la boutique, créer les commandes, générer les reçus, organiser la livraison, notifier le vendeur et améliorer le support.",
            "Les informations client ne doivent pas être utilisées pour du spam. Les relances commerciales doivent rester raisonnables et liées à l'activité de la boutique.",
          ],
        },
        {
          title: "Conservation et suppression",
          body: [
            "Les données sont conservées aussi longtemps que nécessaire pour assurer le suivi commercial, la preuve de commande et le support.",
            "Un vendeur ou un client peut demander une correction ou suppression de données en contactant support@tikchop.app, sous réserve des obligations de preuve ou de sécurité applicables.",
          ],
        },
      ]}
    />
  );
}
