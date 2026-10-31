import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "B.A.S Sangha | Dakshin Gobindapur",
  description: "Official app of Dakshin Gobindapur B.A.S Sangha - tournaments, drawing competition, blood donation camp, member join and club gallery. Estd 2021.",
  keywords: ["B.A.S Sangha", "Dakshin Gobindapur", "club", "tournament", "blood donation"],
  icons: {
    icon: "/logo.png",
  },
};

// Mobile browsers paint the toolbar/browser chrome with this color — keeps the
// area below the app dark instead of a white strip while loading.
export const viewport: Viewport = {
  themeColor: "#150404",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      style={{ backgroundColor: "#150404" }}
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
        style={{ backgroundColor: "#150404" }}
      >
        {children}
        <Toaster />
        <SpeedInsights />
      </body>
    </html>
  );
}
