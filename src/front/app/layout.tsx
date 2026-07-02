import type { Metadata } from "next";
import { Cinzel, Outfit, Patrick_Hand } from "next/font/google";
import "./globals.css";
import GameBackground from "./components/GameBackground";
import { ToastProvider } from "./components/Toast";
import ThemeSwitcher from "./components/ThemeSwitcher";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
const patrickHand = Patrick_Hand({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-board-label",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Приховані Лідери",
  description: "Приховані Лідери — настільна стратегічна гра",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className={`${cinzel.variable} ${outfit.variable} ${patrickHand.variable}`}>
      <body className="antialiased min-h-screen font-sans bg-[var(--bg)]">
        <ToastProvider>
          <GameBackground />
          <ThemeSwitcher />
          <div className="relative z-10">{children}</div>
        </ToastProvider>
      </body>
    </html>
  );
}
