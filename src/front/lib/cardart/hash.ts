/**
 * Єдине джерело варіативності в рушії арту.
 *
 * FNV-1a: чиста функція рядок → число, однакова на сервері й на клієнті.
 * `Math.random()` тут неприпустимий — у цьому проєкті вже був баг гідратації
 * саме через випадкові числа в ініціалізаторі стану.
 */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Детермінований вибір із набору за ключем арту. */
export function pick<T>(key: string, options: readonly T[]): T {
  return options[fnv1a(key) % options.length];
}
