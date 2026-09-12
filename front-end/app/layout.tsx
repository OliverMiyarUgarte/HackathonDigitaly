import type { Metadata } from "next";
import { IBM_Plex_Sans, Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { SessionProvider } from "@/lib/auth";
import { themeScript } from "@/lib/theme";

const inter = Inter({
  subsets: ["latin"],
  weight: ["100", "400", "500"],
  variable: "--font-inter",
  display: "swap",
});

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Digitaly Teleatendimento",
  description: "Teleatendimento Digitaly. Inteligência em Produção.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      data-theme="dark"
      suppressHydrationWarning
      className={`${inter.variable} ${plex.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript() }} />
      </head>
      <body>
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
