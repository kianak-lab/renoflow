import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
  try {
    const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (fromEnv) {
      const normalized = fromEnv.includes("://") ? fromEnv : `https://${fromEnv}`;
      return new URL(normalized);
    }
    if (process.env.VERCEL_URL) {
      return new URL(`https://${process.env.VERCEL_URL}`);
    }
    return fallback();
  } catch {
    if (process.env.VERCEL_URL) {
      try {
        return new URL(`https://${process.env.VERCEL_URL}`);
      } catch {
        /* fall through */
      }
    }
    return fallback();
  }
}

export const metadata: Metadata = {
  metadataBase: metadataBase(),
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
