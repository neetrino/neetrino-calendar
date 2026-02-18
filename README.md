# Calendar + Daily Schedule Module

Модуль календаря для админ-панели с поддержкой встреч, дедлайнов и графика смен.

## Возможности

- **Календарь** с 3 режимами просмотра: Месяц / Неделя / День
- **Встречи (Meetings)** — события с участниками и RSVP
- **Дедлайны (Deadlines)** — важные даты с ответственными
- **График смен (Schedule)** — простой список "кто когда работает" на день

## Технологии

- **Next.js 14+** (App Router)
- **TypeScript**
- **Prisma** + PostgreSQL (Neon)
- **shadcn/ui** + Tailwind CSS
- **FullCalendar** для календаря
- **TanStack Query** для state management
- **Zod** для валидации

## Быстрый старт

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка базы данных

```bash
# Генерация Prisma клиента
npx prisma generate

# Создание миграции и применение
npx prisma migrate dev --name init

# Заполнение тестовыми данными
npm run db:seed
```

### 3. Запуск dev сервера

```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000)

## Структура проекта

```
src/
├── app/
│   ├── api/
│   │   ├── calendar/items/    # API для событий календаря
│   │   ├── schedule/          # API для графика смен
│   │   └── users/             # API для пользователей
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                    # shadcn компоненты
│   └── providers.tsx          # React Query provider
├── features/
│   ├── calendar/              # Модуль календаря
│   │   ├── components/
│   │   ├── hooks/
│   │   └── types.ts
│   └── schedule/              # Модуль расписания
│       ├── components/
│       ├── hooks/
│       └── types.ts
└── lib/
    ├── db.ts                  # Prisma client
    ├── auth.ts                # Аутентификация
    ├── utils.ts               # Утилиты
    └── validations/           # Zod схемы
```

## API Endpoints

### Calendar Items

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/calendar/items` | Список событий (с фильтрами) |
| POST | `/api/calendar/items` | Создать событие |
| PATCH | `/api/calendar/items/:id` | Обновить событие |
| DELETE | `/api/calendar/items/:id` | Удалить событие |

### Schedule

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schedule?date=YYYY-MM-DD` | Список смен на дату |
| POST | `/api/schedule` | Добавить смену |
| PATCH | `/api/schedule/:id` | Изменить смену |
| DELETE | `/api/schedule/:id` | Удалить смену |

## Полезные команды

```bash
# Разработка
npm run dev         # Запуск dev сервера
npm run build       # Сборка для production
npm run lint        # Проверка линтером

# База данных
npm run db:generate # Генерация Prisma клиента
npm run db:migrate  # Создание миграции
npm run db:seed     # Заполнение тестовыми данными
npm run db:studio   # Открыть Prisma Studio (GUI для БД)
```

## Деплой на Vercel

### База данных

Используется **PostgreSQL (Neon)**. В Vercel обязательно задайте переменные окружения.

### Шаги деплоя

1. **Подключите проект к Vercel** (CLI или https://vercel.com).

2. **Переменные окружения в Vercel Dashboard:**
   - `DATABASE_URL` — **обязательно.** URL Neon, например:
     `postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`
   - `AUTH_SECRET` — **обязательно.** Сгенерируйте: `openssl rand -base64 32`

3. После деплоя один раз вызовите инициализацию БД:  
   `POST /api/admin/init-db` (или откройте `init-db.html` и нажмите кнопку).

### Структура для деплоя

- ✅ `vercel.json` — конфигурация Vercel
- ✅ `postinstall` — генерация Prisma клиента
- ✅ PostgreSQL (Neon) — постоянное хранилище

## Лицензия

MIT
