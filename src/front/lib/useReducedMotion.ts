"use client";

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Чи просив користувач системно менше руху.
 *
 * Початкове значення завжди `false`, а не результат `matchMedia`, і читається
 * воно тільки в ефекті. На сервері `window` немає, і будь-яка спроба вгадати
 * відповідь під час рендера дала б різну розмітку на сервері й клієнті — рівно
 * той клас помилок гідратації, який у цьому проєкті вже траплявся з темою.
 * Ціна — один зайвий кадр із рухом у того, хто просив без руху; за цим кадром
 * жодна анімація вже не запуститься.
 *
 * CSS свою частину роботи робить сам (блок `prefers-reduced-motion` у
 * globals.css). Цей хук потрібен для другої частини: політ карти має не
 * прискоритися до нуля, а взагалі не початися.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(QUERY);
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
