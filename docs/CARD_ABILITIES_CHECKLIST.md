# Перевірка механізмів і здібностей карт (бекенд + фронтенд)

## Джерела

- **Карти:** `src/back/data/cards.json` (72 герої, формат: markers + ability)
- **Бекенд:** `domain/abilities.py`, `domain/conditions.py`, `domain/marker_resolver.py`, `command_handlers.py`
- **Фронтенд:** `lib/abilityTargets.ts`, `app/room/[roomId]/PlayCardTargetModal.tsx`

---

## 1. Дії абиліті (action)

| Action | Бекенд | Фронт (модал цілей) | Примітка |
|--------|--------|----------------------|----------|
| **Kill** | ✅ | ✅ Гравець + карта | |
| **Bury** | ✅ | ✅ Гравець + карта | |
| **Guess_Kill** | ✅ (як Kill) | ✅ Гравець + карта | Реалізовано як Kill з face_down |
| **Flip** | ✅ | ✅ Гравець + прихована за індексом | |
| **Look** | ✅ (return []) | ✅ Гравець + прихована | Бекенд не змінює стан; підглядання можна показати в UI |
| **Flip_Or_Look** | ✅ (return []) | ✅ як Flip/Look | |
| **Swap** | ✅ | ✅ Гравець + карта або слот таверни | hand↔Party_face_down: два CardMoved (обмін) |
| **Swap_Hand** | ✅ | ✅ Без модалу | Один супротивник |
| **Draw** | ✅ | ✅ source_choice / tavern_slot | Джерела: Harbor, Tavern, Graveyard, other_hand |
| **Place** | ✅ | ✅ Без модалу (або карта з руки) | |
| **Move_Markers** | ✅ | ✅ move_markers_option | options: ["+1 leading", "-1 behind", ...] |
| **Condition** | ✅ (умова в command_handlers) | ✅ Без модалу | Умова перевіряється перед маркерами; маркери та абиліті — тільки при true |
| **Calculation** | ✅ (X рахується в marker_resolver) | ✅ Вибір гравця для X (3+ гравці) | target_* x_source: при 2 гравцях target_player_id підставляється автоматично |
| **Kill_Random** | ✅ | ✅ Гравець (3+) | Бекенд сам обирає карту |
| **Kill_Dual** | ✅ | ✅ Без модалу | self + other face_down |
| **PlayExtra** | ✅ (фаза не змінюється) | — | Додатковий хід: не додається TurnPhaseChanged |
| **Perform, Perform_Top, Perform_Self, Bury_Perform** | ✅ | ✅ / Без модалу | Виконання абиліті іншої карти (один рівень); Bury_Perform: CardMoved таверна→цвинтар + execute |
| **Draw_All_Tavern** | ✅ | ✅ Без модалу | Забирає всі 3 карти з таверни |
| **Reveal_Harbor** | ✅ (return []) | — | У відповіді команди: `reveal_harbor` — card_ids з гавані (count з ability) |

---

## 2. Умови (conditions)

Усі умови з карт реалізовані в `domain/conditions.py`:

| Умова | Бекенд |
|-------|--------|
| no_red_in_tavern | ✅ |
| no_undead | ✅ |
| green_behind_red | ✅ |
| red_behind_green | ✅ |
| has_red_party | ✅ |
| has_blue_black_party | ✅ |
| has_face_down_undead | ✅ |
| has_face_down_green | ✅ |

Умова перевіряється в `command_handlers.handle_play_card` перед викликом `execute_ability`.

---

## 3. Логіка маркерів (markers.logic)

| Logic | Бекенд (marker_resolver) | Фронт (вибір) |
|-------|--------------------------|----------------|
| **AND** | ✅ | — |
| **OR** (green_alt / red_alt) | ✅ | ✅ Основний / Альтернатива |
| **OR_NEG** | ✅ | ✅ Плюс / Мінус |
| **OR_NEG_DECIDE_LEFT** | ✅ left/right | ✅ Ліворуч / Праворуч |
| **AND_OR** | ✅ or + marker_choice_side | ✅ Червоний / Зелений |
| **LEADING_MARKER** | ✅ (0,0; ефект у Move_Markers) | — |

---

## 4. Джерела X (x_source для маркерів "X" / "-X")

Усі реалізовані в `marker_resolver.compute_x`:

| x_source | Бекенд | Фронт (target_player_id при 3+ гравцях) |
|----------|--------|----------------------------------------|
| graveyard_count | ✅ | — |
| tavern_not_red | ✅ | — |
| tavern_not_green | ✅ | — |
| target_party_markers | ✅ | ✅ Вибір гравця |
| target_face_up_green | ✅ | ✅ Вибір гравця |
| target_face_up_blue | ✅ | ✅ Вибір гравця |
| target_face_down_count | ✅ | ✅ Вибір гравця |

---

## 5. Що не реалізовано / обмежено

- *(Реалізовано)* **PlayExtra** — фаза не змінюється на DRAW, той самий гравець грає ще одну карту.
- *(Реалізовано)* **Perform, Perform_Top, Perform_Self, Bury_Perform** — виконання абиліті іншої карти (один рівень глибини).
- *(Реалізовано)* **Reveal_Harbor** — у відповіді POST команди є `reveal_harbor` (список card_ids з гавані).
- *(Реалізовано)* **Look / Flip_Or_Look** — бекенд не змінює стан; у відповіді команди додано поле `peek_card` (card_id або об’єкт карти).

---

## 6. Підсумок

- Усі основні дії (Kill, Bury, Guess_Kill, Flip, Swap, Swap_Hand, Draw, Place, Move_Markers, Kill_Random, Kill_Dual, Draw_All_Tavern) реалізовані на бекенді та мають потрібний UX на фронті (модал цілей де потрібно).
- Умови та логіка маркерів (включно з OR_NEG_DECIDE_LEFT) покриті.
- Calculation з X та target_* на фронті потребує вибору гравця при 3+ гравцях — реалізовано.
- PlayExtra, Perform-родина, Reveal_Harbor та peek_card для Look/Flip_Or_Look реалізовані.
