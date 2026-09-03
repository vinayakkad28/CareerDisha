import type { Metadata } from "next";
import { Manrope, Public_Sans } from "next/font/google";
import "./globals.css";
import ClientLayout from "./client-layout";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://careerneeti.in";

const TITLE = "CareerNeeti — Find the right stream before Class 11";
const DESCRIPTION =
  "A free, research-backed career assessment for Indian students. Discover your " +
  "strengths and get a personalised stream and career roadmap — in English and Hindi.";

// Open Graph lives here because every public page is a Client Component, and a
// Client Component cannot export `metadata`. This root layout is the only server
// component in the public tree, so it is the one place that can carry link
// previews for the whole site. Without these, a link shared on WhatsApp — which
// is how this product actually spreads — renders as a bare URL.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "CareerNeeti",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${publicSans.variable}`}>
      <body className="antialiased font-body">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
