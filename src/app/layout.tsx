import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "PantryPlan",
  description: "Family meal planning with aisle-sorted shopping lists",
  appleWebApp: {
    capable: true,
    title: "PantryPlan",
    statusBarStyle: "default",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1f6f5b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`} style={{
        ["--font-display" as string]: "var(--font-fraunces), Georgia, serif",
        ["--font-body" as string]: "var(--font-manrope), system-ui, sans-serif",
      }}>
        {children}
      </body>
    </html>
  );
}
