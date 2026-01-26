# PROGRESS.md — Calendar + Daily Schedule Module

## Хронология разработки

### 22.01.2026 — Начало проекта

#### 10:00 — План утверждён
- Создан PLAN.md с полным описанием проекта
- План утверждён пользователем

#### 10:05 — Этап 1: Инициализация проекта ✅
- [x] Создан Next.js проект с TypeScript
- [x] Настроен Tailwind CSS
- [x] Установлен и настроен Prisma + SQLite
- [x] Созданы UI компоненты (shadcn-style)
- [x] Создана структура папок
- [x] Настроен ESLint + Prettier

#### 10:20 — Этап 2: База данных ✅
- [x] Написан Prisma schema (SQLite, без enum)
- [x] Создана миграция
- [x] Написан seed script с демо-данными
- [x] Создан Prisma client singleton

#### 10:30 — Этап 3: Аутентификация ✅
- [x] Создан middleware для проверки роли
- [x] Реализована простая сессия (mock admin)
- [x] Helper функции для проверки доступа

#### 10:40 — Этап 4: API для Calendar Items ✅
- [x] Zod схемы валидации
- [x] GET /api/calendar/items (с фильтрами)
- [x] POST /api/calendar/items
- [x] PATCH /api/calendar/items/:id
- [x] DELETE /api/calendar/items/:id
- [x] Логирование всех операций

#### 10:50 — Этап 5: API для Schedule ✅
- [x] Zod схемы валидации
- [x] GET /api/schedule
- [x] POST /api/schedule
- [x] PATCH /api/schedule/:id
- [x] DELETE /api/schedule/:id
- [x] Валидация: endTime > startTime

#### 11:00 — Этап 6-9: UI компоненты ✅
- [x] Toast notifications (sonner)
- [x] Базовые компоненты (Button, Input, Dialog, Select, etc.)
- [x] Интеграция FullCalendar
- [x] Переключатель Month/Week/Day
- [x] Фильтры (статус, поиск)
- [x] Отображение событий с цветовой кодировкой
- [x] Клик на событие — модальное окно
- [x] Формы создания/редактирования события
- [x] Форма добавления/редактирования смены

#### 12:00 — 3 отдельные страницы с календарями ✅
- [x] Навигация между 3 страницами
- [x] **/meetings** — Встречи (календарь с встречами)
- [x] **/deadlines** — Дедлайны (календарь с дедлайнами)
- [x] **/schedule** — График смен (календарь + панель расписания справа)
- [x] Главная страница "/" редиректит на /meetings

---

## Структура страниц

### 1. Встречи (/meetings)
- Календарь с 3 режимами (Месяц/Неделя/День)
- Показывает только встречи (MEETING)
- Фильтр по статусу
- Поиск по названию
- Создание/редактирование/удаление встреч
- Участники с RSVP

### 2. Дедлайны (/deadlines)
- Календарь с 3 режимами (Месяц/Неделя/День)
- Показывает только дедлайны (DEADLINE)
- Фильтр по статусу
- Поиск по названию
- Создание/редактирование/удаление дедлайнов
- Ответственные лица

### 3. График смен (/schedule)
- Календарь с 3 режимами (Месяц/Неделя/День)
- Панель справа с графиком на выбранную дату
- Простой список: Имя + время (09:00–18:00)
- Создание/редактирование/удаление записей

---

## 22.01.2026 — UI/UX Design: Super Admin Page

#### 14:00 — Дизайн страницы User Access Management ✅
- [x] Создан детальный UI/UX дизайн-документ
- [x] Описан layout страницы (two-column: users + permissions)
- [x] Спроектирована таблица прав доступа с Segmented Controls
- [x] Определены состояния View/Edit/None с визуальной иерархией
- [x] Описаны колонки My (свои записи) / Everyone (все записи)
- [x] Спроектирован Action Bar с индикатором unsaved changes
- [x] Добавлены hover/focus/loading/empty states
- [x] Описана responsive адаптация (desktop/tablet/mobile)
- [x] Определена цветовая палитра и типографика
- [x] Создан чеклист для дизайнера (Figma)

**Файл дизайна:** `docs/DESIGN_USER_ACCESS_MANAGEMENT.md`

#### 17:20 — Реализация страницы Super Admin ✅
- [x] Обновлена Prisma Schema — добавлена модель `UserPermission`
- [x] Создана миграция `add_user_permissions`
- [x] Создан API `/api/admin/permissions` (GET, PUT)
- [x] Созданы UI компоненты:
  - `PermissionSegment` — segmented control для View/Edit/None
  - `UserCard` — карточка пользователя
  - `UserListPanel` — панель со списком пользователей
  - `PermissionsTable` — таблица прав доступа
  - `ActionBar` — sticky панель с кнопками Save/Reset
  - `UserAccessPage` — главный компонент страницы
- [x] Создана страница `/admin/permissions`
- [x] Добавлен Tooltip компонент (shadcn/ui)
- [x] Обновлена навигация — добавлена ссылка "Доступ" для админов
- [x] Обновлён seed — добавлены дефолтные права для пользователей

**Страница:** `/admin/permissions` (только для Admin)

---

## Структура страниц (обновлено)

### 4. Super Admin (/admin/permissions) — НОВОЕ
- Управление правами доступа пользователей
- Два scope: My (свои записи) / Everyone (все записи)
- Три уровня доступа: View / Edit / None
- Три модуля: Meetings / Deadlines / Schedule
- Визуальный индикатор несохранённых изменений
- Responsive дизайн (desktop/tablet/mobile)

---

## Команды для запуска

```bash
# Установка
npm install

# База данных
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed

# Запуск
npm run dev
# Открыть http://localhost:3000
```

---

## 26.01.2026 — Исправление ошибок сборки для Vercel

#### 08:20 — Исправлены ошибки TypeScript и Next.js 15 ✅
- [x] Исправлен синтаксис `cookies.delete()` в `/api/auth/logout/route.ts` (Next.js 15 API)
- [x] Добавлены type assertions для `event.type` и `event.status` в `EventForm.tsx`
- [x] Исправлен доступ к `ITEM_TYPE_LABELS` и `STATUS_LABELS` в `EventModal.tsx`
- [x] Исправлен импорт `Role` в `useUsers.ts` (из `types.ts` вместо `@prisma/client`)
- [x] Исправлен доступ к ошибкам Zod в `env.ts` (`error.issues` вместо `error.errors`)
- [x] Удалено несуществующее свойство `req.ip` в `rateLimit.ts`
- [x] Обернут `useSearchParams()` в Suspense boundary в `login/page.tsx`

**Результат:** Сборка проекта проходит успешно (`npm run build` ✅)

#### 08:40 — Исправлена ошибка middleware на Vercel ✅
- [x] Удалены импорты `db` и `logger` из middleware (несовместимы с Edge Runtime)
- [x] Упрощен middleware для работы в Edge Runtime
- [x] Middleware теперь использует только Edge-совместимые API Next.js

**Проблема:** `MIDDLEWARE_INVOCATION_FAILED` на Vercel из-за использования Prisma в Edge Runtime  
**Решение:** Убраны все тяжелые зависимости из middleware, используется только проверка cookies

#### 09:00 — Исправлена ошибка логина на Vercel ✅
- [x] Создан API endpoint `/api/admin/init-db` для инициализации базы данных
- [x] Улучшена обработка ошибок в `/api/auth/login` с детальными сообщениями
- [x] Добавлена проверка подключения к базе данных
- [x] Улучшены сообщения об ошибках на клиенте

**Проблема:** "Login error. Please try later" на Vercel из-за пустой in-memory SQLite базы  
**Решение:** Создан endpoint для инициализации БД, который нужно вызвать один раз после деплоя

**Инструкция:** После деплоя на Vercel вызовите `POST /api/admin/init-db` для создания пользователей

#### 09:15 — Улучшена обработка сетевых ошибок при логине ✅
- [x] Добавлена проверка пустого ответа от сервера
- [x] Улучшена обработка ошибок парсинга JSON
- [x] Добавлены более детальные сообщения об ошибках
- [x] Улучшена обработка ошибок парсинга JSON на сервере

**Проблема:** "Network error. Please check your connection and try again" при логине  
**Решение:** Улучшена обработка ошибок с детальными сообщениями и проверкой ответа сервера

#### 09:30 — Исправлена ошибка 405 (Method Not Allowed) при логине ✅
- [x] Добавлена обработка OPTIONS запросов для CORS
- [x] Использование абсолютного URL для API запросов на клиенте
- [x] Добавлено детальное логирование запросов и ответов
- [x] Улучшена обработка ошибок с информацией о статусе ответа

**Проблема:** "Server error (405). Please try again later" при логине  
**Решение:** Добавлена поддержка CORS и улучшена обработка запросов

#### 09:45 — Исправлена ошибка 405 и 500 на Vercel ✅
- [x] Добавлена явная конфигурация `runtime = "nodejs"` для всех API routes с Prisma
- [x] Улучшена обработка ошибок в `/api/auth/me` с правильными JSON ответами
- [x] Исправлена проблема с пустыми ответами от сервера

**Проблема:** 
- `/api/auth/login` возвращал 405 (Method Not Allowed)
- `/api/auth/me` возвращал 500 (Internal Server Error)
- Пустые ответы от сервера

**Решение:** 
- Явная конфигурация runtime для API routes (Node.js вместо Edge)
- Улучшена обработка ошибок с правильными JSON ответами
- Это необходимо, так как Prisma не работает в Edge Runtime

#### 10:00 — Добавлен runtime для всех API routes ✅
- [x] Добавлен `runtime = "nodejs"` для всех API routes, использующих Prisma
- [x] Обновлены: users, calendar/items, schedule, admin/permissions, calendar/items/[id], schedule/[id]

**Важно:** После этого коммита нужно сделать **Redeploy** на Vercel, чтобы изменения вступили в силу!

#### 10:30 — Исправлена ошибка 405 (Method Not Allowed) на Vercel ✅
- [x] Исправлен путь в `vercel.json`: изменён с `src/app/api/**/*.ts` на `app/api/**/*.ts`
- [x] Обновлён matcher в `middleware.ts`: добавлено исключение для `/api/` routes
- [x] Middleware теперь явно пропускает все API запросы

**Проблема:** 
- `/api/auth/login` возвращал 405 (Method Not Allowed) на Vercel
- Middleware matcher перехватывал API запросы
- Неправильный путь в конфигурации Vercel

**Решение:** 
- Исправлен путь в `vercel.json` (убрана папка `src/`)
- Добавлено исключение `api/` в matcher middleware
- Теперь все API routes обрабатываются напрямую Next.js, минуя middleware

**Важно:** После этого коммита нужно сделать **Redeploy** на Vercel, чтобы изменения вступили в силу!

---

*Последнее обновление: 26.01.2026 10:30*
