/**
 * Українські назви карт.
 *
 * ВАЖЛИВО: це лише відображення. Рушій арту й далі ключується англійською
 * назвою з каталогу бекенда (`lib/cardart/types.ts`) — саме тому переклад тут
 * нічого не ламає. Якщо колись перекласти назви на бекенді, відваляться всі 79
 * рецептів одразу.
 */

export const CARD_NAME_UA: Record<string, string> = {
  "Shaky Sharpshooter": "Тремтливий Стрілець",
  "Depressed Druid": "Похмурий Друїд",
  "Cave Keeper": "Хранитель Печери",
  "Dreamy Hermit": "Мрійливий Самітник",
  "Long-eared Loner": "Довговухий Одинак",
  "Saber Tooth Troll": "Шаблезубий Троль",
  "Intimidating Tribesman": "Грізний Горянин",
  "Spirited Shaman": "Завзятий Шаман",
  "Grumpy Guard": "Буркотливий Вартовий",
  "Righteous Battle Maid": "Праведна Войовниця",
  "Hangry Barbarian": "Голодний Варвар",
  "Joyless Chief": "Невеселий Вождь",
  "Familiar Handler": "Приборкувач Фамільярів",
  "Curious Troll": "Цікавий Троль",
  "Furious Pigman": "Лютий Свинолюд",
  "Bored Goblin": "Знуджений Гоблін",
  "Curious Cat Lover": "Цікава Котолюбка",
  "Warty Witch": "Бородавчаста Відьма",
  "Short-sighted Soldier": "Короткозорий Солдат",
  "Doubtful Priest": "Сумнівний Жрець",
  "Underestimated Squire": "Недооцінений Джура",
  "Flailing Knight": "Незграбний Лицар",
  "Underpaid Mercenary": "Недоплачений Найманець",
  "Heart Bending Bard": "Бард-Серцеїд",
  "Modest Monsterslayer": "Скромний Змієборець",
  "Ace Fighter": "Найкращий Боєць",
  "Battle Connoisseur": "Знавець Битв",
  "Canned Cavalier": "Консервований Кавалерист",
  "Whiskered Viking": "Вусатий Вікінг",
  "Almost-evil Scholar": "Майже Злий Вчений",
  "Well-aged Warrior": "Бувалий Воїн",
  "Androgynous Assassin": "Загадковий Убивця",
  "Groggy Preacher": "Осоловілий Проповідник",
  "Queer Quartermaster": "Дивний Інтендант",
  "Angry Priestess": "Гнівна Жриця",
  "Resilient Rearguard": "Витривалий Ар'єргард",
  "Bony Target Practice": "Кістяна Мішень",
  "Unconfident Executioner": "Невпевнений Кат",
  "Ghastly Granny": "Моторошна Бабця",
  "Apish Honorguard": "Мавпяча Варта",
  "Half-headed Wizard": "Півголовий Чаклун",
  "Nightmarish Northman": "Жахливий Північанин",
  "Half-eaten Bull": "Недоїдений Бик",
  "Gorgeous Gorgon": "Прекрасна Горгона",
  "Raven Whisperer": "Воронячий Шептун",
  "Insidious Impaler": "Підступний Протинач",
  "Well Instructed Mummy": "Вишколена Мумія",
  "Will-bending Witch": "Владна Відьма",
  "Resurrected Ram": "Воскреслий Баран",
  "Mummy Mystic": "Мумія-Містик",
  "Notorious Necromancer": "Сумнозвісний Некромант",
  "Sun-shy Skeleton": "Сонцебоязкий Скелет",
  "Wrapped Warrior": "Сповитий Воїн",
  "Sluggish Slimemonster": "Млявий Слизень",
  "Pessimistic Whaleman": "Песимістичний Китобій",
  "Tentacled Oracle": "Щупальцевий Оракул",
  "Drowned Deserter": "Потонулий Дезертир",
  "Deep Sea Squire": "Глибинний Джура",
  "Vegetarian Sharkguard": "Акула-Вегетаріанець",
  "Double Shielded Turtle": "Двощита Черепаха",
  "Leery Lizard": "Підозріла Ящірка",
  "Furious Frog": "Люта Жаба",
  "Apathetic Waterpriest": "Байдужий Водний Жрець",
  "Hopeful Salamander": "Надійна Саламандра",
  "Fearsome Fishman": "Страхітливий Риболюд",
  "Triple Sword Lizard": "Тримечна Ящірка",
  "Saltwater Sage": "Солоноводний Мудрець",
  // «Рибовартовий» одним словом ширший за плитку 80×112 і ламався посеред
  // слова — звідси коротша форма.
  "Minor Fishguard": "Юний Рибовартий",
  "Clamped Krill Guard": "Панцирний Вартовий",
  "Aimless Eel": "Безцільний Вугор",
  "Bludgeoning Blowfish": "Забійна Риба-Куля",
  "Voodoo Witch": "Відьма Вуду",
  "Pavyr": "Павір",
  "Myrad": "Мірад",
  "Lemron": "Лемрон",
  "Cyra": "Сайра",
  "Xiadul": "Ксіадул",
  "Enned": "Еннед",
  "Deceased Emperor": "Проклятий Імператор",
};

/** Назва для показу. Невідома карта лишається як є. */
export function displayName(englishName: string | undefined): string {
  if (!englishName) return "";
  return CARD_NAME_UA[englishName] ?? englishName;
}
