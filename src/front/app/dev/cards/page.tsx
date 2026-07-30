import { notFound } from "next/navigation";
import { CardGallery } from "./CardGallery";

/**
 * Dev-галерея арту карток.
 *
 * `notFound()` у серверному компоненті прибирає маршрут із прод-збірки надійніше,
 * ніж клієнтська перевірка env.
 */
export default function DevCardsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <CardGallery />;
}
