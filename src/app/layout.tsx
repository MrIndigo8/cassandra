import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/hooks/useUser";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-geist-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Кассандра — Платформа коллективного предосознания",
  description:
    "Записывайте сны и предчувствия. ИИ анализирует совпадения с реальными событиями мира. Исследуйте синхронии Юнга в коллективном масштабе.",
  keywords: [
    "сны",
    "предчувствия",
    "предсказания",
    "синхрония",
    "Юнг",
    "коллективное бессознательное",
    "ноосфера",
  ],
  authors: [{ name: "Кассандра" }],
  openGraph: {
    title: "Кассандра — Платформа коллективного предосознания",
    description:
      "Записывайте сны и предчувствия. ИИ анализирует совпадения с реальными событиями мира.",
    type: "website",
    locale: "ru_RU",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <body className={`${inter.variable} font-sans`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
