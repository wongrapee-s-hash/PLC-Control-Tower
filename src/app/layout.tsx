import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_Thai } from "next/font/google";

import { AuthProvider } from "@/context/auth-context";
import { PlantProvider } from "@/context/plant-context";
import { ThemeProvider } from "@/context/theme-context";
import "./globals.css";

const sans = IBM_Plex_Sans_Thai({
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Production Control Tower",
  description:
    "ระบบบริหารจัดการสายการผลิต ติดตาม OEE เวลาหยุดเครื่อง และกระบวนการซ่อมบำรุง",
};

export const viewport: Viewport = {
  themeColor: "#198387",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={`${sans.variable} ${mono.variable} min-h-screen antialiased`}>
        <ThemeProvider>
          <AuthProvider>
            <PlantProvider>{children}</PlantProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
