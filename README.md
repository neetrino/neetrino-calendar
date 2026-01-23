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
- **Prisma** + SQLite (легко мигрировать на PostgreSQL)
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

### Важно: SQLite на Vercel

⚠️ **Внимание**: На Vercel файловая система read-only, поэтому SQLite будет работать в режиме in-memory. Данные будут теряться при каждом перезапуске сервера.

**Рекомендации:**
- Для продакшена лучше использовать PostgreSQL (Vercel Postgres)
- Для тестирования можно использовать SQLite in-memory
- Для постоянного хранения данных с SQLite рассмотрите внешнее хранилище (Cloudflare R2, AWS S3)

### Шаги деплоя:

1. **Подключите проект к Vercel:**
   ```bash
   # Через Vercel CLI
   vercel
   
   # Или через веб-интерфейс: https://vercel.com
   ```

2. **Настройте переменные окружения в Vercel Dashboard:**
   - `DATABASE_URL` - можно не указывать (будет использоваться in-memory SQLite)
   - `AUTH_SECRET` - **обязательно!** Сгенерируйте секретный ключ:
     ```bash
     openssl rand -base64 32
     ```

3. **Деплой:**
   - При пуше в `master` ветку автоматически запустится деплой
   - Или запустите вручную через Vercel Dashboard

### Структура для деплоя:

- ✅ `vercel.json` - конфигурация Vercel
- ✅ `postinstall` скрипт - автоматическая генерация Prisma клиента
- ✅ Автоматическое определение SQLite in-memory на Vercel

## Миграция на PostgreSQL

1. Измените в `.env`:
```
DATABASE_URL="postgresql://user:password@localhost:5432/calendar"
```

2. Измените в `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

3. Пересоздайте миграции:
```bash
npx prisma migrate dev --name init
```

## Лицензия

MIT
