import { notFound } from "next/navigation";
import { CardGallery } from "./CardGallery";

/**
 * Dev-галерея арту карток.
 *
 * `notFound()` у серверному компоненті прибирає маршрут із прод-збірки надійніше,
 * ніж клієнтська перевірка env.
 */
export default function DevCardsPage({
  searchParams,
}: {
  searchParams?: { tab?: string; size?: string };
}) {
  if (process.env.NODE_ENV === "production") notFound();
  // Початковий стан із query, щоб потрібну вкладку й розмір можна було зняти
  // прямо з SSR-розмітки — растеризатор ходить сюди без браузера.
  return <CardGallery initialTab={searchParams?.tab} initialSize={searchParams?.size} />;
}
