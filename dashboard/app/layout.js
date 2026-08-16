import "./globals.css";
import { DM_Sans, Manrope } from "next/font/google";
import AppChrome from "./AppChrome";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const dm = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

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
viewportFit: "cover",
  themeColor: "#059669",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${manrope.variable} ${dm.variable}`}>
      <body>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
