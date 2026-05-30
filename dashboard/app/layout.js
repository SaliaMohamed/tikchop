import "./globals.css";
import AppChrome from "./AppChrome";

export const metadata = {
  title: "Tikchop · Vendre mieux sur WhatsApp",
  description: "Créez votre boutique en ligne, recevez des commandes WhatsApp claires et organisez la livraison depuis votre téléphone.",
  applicationName: "Tikchop",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tikchop",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "format-detection": "telephone=no",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#fbf9f4",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
