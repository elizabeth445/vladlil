import type { Metadata } from "next";
import DevelopmentTools from "@/components/DevelopmentTools";
import "@fontsource-variable/shantell-sans";
import "@fontsource-variable/onest";
import "./globals.css";
export const metadata: Metadata = {
  title: "Владислав та Лілія — наше маленьке велике свято",
  description:
    "Дві маленькі історії. Одне велике свято. Запрошуємо на другий день народження Владислава та Лілії, 15 листопада 2026, ресторан FRANCO.",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk">
      <body>
        {children}
        <DevelopmentTools />
      </body>
    </html>
  );
}
