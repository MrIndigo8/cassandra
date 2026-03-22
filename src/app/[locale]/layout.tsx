import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";

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

import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export default async function RootLayout({
  children,
  params: { locale }
}: Readonly<{
  children: React.ReactNode;
  params: { locale: string };
}>) {
  const messages = await getMessages();

  return (
    <html lang={locale} className="dark">
      <body className={`${inter.variable} font-sans`}>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <AuthProvider>{children}</AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
