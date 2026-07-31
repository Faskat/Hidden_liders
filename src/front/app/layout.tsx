import type { Metadata } from "next";
import { Philosopher, Manrope, Caveat, Oswald } from "next/font/google";
import "./globals.css";
import GameBackground from "./components/GameBackground";
import { ToastProvider } from "./components/Toast";
import ThemeSwitcher from "./components/ThemeSwitcher";

/**
 * Шрифти.
 *
 * КОЖЕН мусить мати підмножину `cyrillic`. Тут раніше стояли Cinzel, Outfit і
 * Patrick Hand — усі три лише латинські, тож увесь український текст у грі
 * мовчки падав на системний запасний шрифт. Саме тому підписи на картах
 * виглядали чужими: вони й були намальовані не тим шрифтом, який задумувався.
 *
 * Заміни підібрані по ролі, а не за схожістю накреслення:
 *   Philosopher — антиквений заголовковий, за настроєм близький до Cinzel;
 *   Manrope     — геометричний гротеск замість Outfit;
 *   Caveat      — рукописний замість Patrick Hand, для написів на полі;
 *   Oswald      — вузький гротеск для назв карт: на плитці 100×140 стиснена
 *                 літера — це не стиль, а зайві два-три символи в рядку.
 */
const philosopher = Philosopher({
  weight: ["400", "700"],
  subsets: ["latin", "cyrillic"],
  variable: "--font-display",
  display: "swap",
});
const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
  display: "swap",
});
const caveat = Caveat({
  subsets: ["latin", "cyrillic"],
  variable: "--font-board-label",
  display: "swap",
});
const oswald = Oswald({
  subsets: ["latin", "cyrillic"],
  variable: "--font-card",
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
    <html
      lang="uk"
      className={`${philosopher.variable} ${manrope.variable} ${caveat.variable} ${oswald.variable}`}
    >
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
