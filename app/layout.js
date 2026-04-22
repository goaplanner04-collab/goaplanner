import "./globals.css";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0A0A0F",
};

export const metadata = {
  title: "GoaNow 🔥 — Know what's happening in Goa. Right now.",
  description:
    "Nearby cafes, live party intel, AI-built Goa itineraries. Built for tourists. Only ₹99 for your whole trip.",
  metadataBase: new URL("https://goanow.in"),
  openGraph: {
    title: "GoaNow 🔥",
    description:
      "Nearby cafes, tonight's parties, AI trip planner for Goa. ₹99 unlocks your whole trip.",
    url: "https://goanow.in",
    siteName: "GoaNow",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630
      }
    ],
    locale: "en_IN",
    type: "website"
  },
  icons: {
    icon: "/favicon.ico"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="true"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
