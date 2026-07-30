# Деплой Hidden Liders на Railway

Проект деплоится как **два сервиса из одного репозитория**: бэкенд (FastAPI) и
фронтенд (Next.js). Конфиги сборки уже лежат в `src/back/railway.json` и
`src/front/railway.json` — Railway подхватит их сам, останется только указать
Root Directory и переменные.

## 1. Бэкенд (FastAPI)

1. Railway → New Service → GitHub Repo → `Faskat/Hidden_liders`.
2. Settings → **Root Directory: `src/back`**.
3. Variables:

   | Переменная     | Значение                                             |
   |----------------|------------------------------------------------------|
   | `CORS_ORIGINS` | URL фронтенда, напр. `https://hidden-liders.up.railway.app` (до первого деплоя фронта можно оставить `*`) |
   | `LOG_LEVEL`    | `INFO` (опционально)                                 |

   `PORT` Railway задаёт сам — `run.py` его читает. `DATABASE_URL` по умолчанию
   SQLite `./data/events.db`.
4. Settings → Networking → **Generate Domain**. Запомни URL — он нужен фронту.
5. Проверка: `https://<back-домен>/health` должен вернуть ok.

### Сохранение партий между деплоями (опционально)

По умолчанию SQLite живёт в контейнере и обнуляется при каждом деплое.
Если нужно сохранять историю:

1. Service → **Add Volume**, Mount path: `/data`
   (именно `/data`, НЕ `/app/data` — иначе volume закроет собой `data/cards.json`).
2. Variables → `DATABASE_URL=sqlite:////data/events.db` (4 слэша — абсолютный путь).

Для комнат-однодневок можно ничего не монтировать.

## 2. Фронтенд (Next.js)

1. Тот же репозиторий → ещё один New Service.
2. Settings → **Root Directory: `src/front`**.
3. Variables (**до первого билда** — переменная вшивается при сборке):

   | Переменная            | Значение                              |
   |-----------------------|---------------------------------------|
   | `NEXT_PUBLIC_API_URL` | URL бэкенда, напр. `https://<back-домен>` (без слэша в конце) |

4. Settings → Networking → **Generate Domain** — это публичный адрес игры.
5. Вернись в бэкенд и поставь `CORS_ORIGINS=https://<front-домен>`.

Если поменял `NEXT_PUBLIC_API_URL` — нужен **redeploy фронта** (переменная
читается при `next build`, не в рантайме).

## 3. Чек-лист после деплоя

- [ ] `/health` бэкенда отвечает
- [ ] Открывается главная фронта, создаётся комната
- [ ] Второй игрок заходит по коду комнаты с другого устройства
- [ ] В `faskat-hq` (хаб) вписать URL фронта в `UPLINK_CONF.hidden_liders.pub`

## Локальный запуск (как раньше)

- бэк: `start-backend.bat` (порт 8000)
- фронт: `start-frontend.bat` (порт 3000, `NEXT_PUBLIC_API_URL` из `.env.local`)
