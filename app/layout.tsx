import type { Metadata } from "next";
import { Geist } from "next/font/google";

import "./globals.css";

export const metadata: Metadata = {
  title: "Keplo",
  description: "Планировщик меню для готовки партиями и списка покупок",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin", "cyrillic"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${geistSans.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
