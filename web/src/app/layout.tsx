import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { getConfiguredPublicSiteUrl } from "@/lib/public-site-url";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

const ogDescription =
  "Renovation quoting and invoicing for contractors";

function metadataBase(): URL {
  const fallback = () => new URL("http://localhost:3000");
  const canonicalProd = () => new URL("https://www.renoflowapp.com");
  try {
    const fromEnv = getConfiguredPublicSiteUrl();
    if (fromEnv) {
      const normalized = fromEnv.includes("://") ? fromEnv : `https://${fromEnv}`;
      const u = new URL(normalized);
      if (!u.hostname.endsWith(".vercel.app")) {
        return u;
      }
    }
    const vercel = process.env.VERCEL_URL?.trim();
    if (vercel && !vercel.endsWith(".vercel.app")) {
      return new URL(`https://${vercel}`);
    }
    if (process.env.NODE_ENV === "production") {
      return canonicalProd();
    }
    return fallback();
  } catch {
    if (process.env.NODE_ENV === "production") {
      try {
        return canonicalProd();
      } catch {
        /* fall through */
      }
    }
    return fallback();
  }
}

export const metadata: Metadata = {
  metadataBase: metadataBase(),
  manifest: "/manifest.json",
  applicationName: "RenoFlow",
  appleWebApp: {
    capable: true,
    title: "RenoFlow",
    statusBarStyle: "default",
  },
  title: "RenoFlow",
  description: ogDescription,
  openGraph: {
    title: "RenoFlow",
    description: ogDescription,
    type: "website",
    locale: "en_US",
    siteName: "RenoFlow",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RenoFlow — renovation quoting and invoicing for contractors",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RenoFlow",
    description: ogDescription,
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { color: "#8BB48B", media: "(prefers-color-scheme: light)" },
    { color: "#3d5c3d", media: "(prefers-color-scheme: dark)" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
