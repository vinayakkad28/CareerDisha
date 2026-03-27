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

export const metadata: Metadata = {
  title: "CareerNeeti - AI Career Counselling",
  description: "AI-powered career counselling platform for Indian schools",
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
