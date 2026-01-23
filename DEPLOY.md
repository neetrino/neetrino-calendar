# Инструкция по деплою на Vercel

## ⚠️ Важное предупреждение о SQLite

На Vercel файловая система **read-only**, поэтому SQLite будет работать в режиме **in-memory**. Это означает:

- ✅ Приложение будет работать
- ❌ **Данные будут теряться при каждом перезапуске сервера**
- ❌ Не подходит для продакшена с постоянными данными

**Рекомендации:**
- Для продакшена используйте **PostgreSQL** (Vercel Postgres)
- Для тестирования можно использовать SQLite in-memory
- Для постоянного хранения с SQLite рассмотрите внешнее хранилище (Cloudflare R2, AWS S3)

---

## Шаги деплоя

### 1. Подготовка проекта

Убедитесь, что все изменения закоммичены:

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin master
```

### 2. Подключение к Vercel

#### Вариант A: Через веб-интерфейс (рекомендуется)

1. Перейдите на [vercel.com](https://vercel.com)
2. Войдите через GitHub
3. Нажмите "Add New Project"
4. Выберите репозиторий `neetrino-calendar`
5. Vercel автоматически определит Next.js проект

#### Вариант B: Через CLI

```bash
# Установите Vercel CLI (если еще не установлен)
npm i -g vercel

# Войдите в аккаунт
vercel login

# Деплой
vercel
```

### 3. Настройка переменных окружения

В Vercel Dashboard → Settings → Environment Variables добавьте:

#### Обязательные переменные:

- **`AUTH_SECRET`** (обязательно для runtime!)
  - ⚠️ **ВАЖНО:** Эта переменная обязательна для работы приложения, но не требуется на этапе сборки
  - Сгенерируйте секретный ключ:
    ```bash
    openssl rand -base64 32
    ```
  - Или используйте онлайн генератор
  - Минимум 32 символа
  - Добавьте в Vercel Dashboard → Settings → Environment Variables

#### Опциональные переменные:

- **`DATABASE_URL`** 
  - Можно не указывать (будет использоваться in-memory SQLite)
  - Или укажите для внешнего SQLite хранилища
  - Формат: `file::memory:?cache=shared` (in-memory)

- **`RATE_LIMIT_ENABLED`** (опционально)
  - `true` (по умолчанию) или `false`

- **`ENABLE_CSRF_PROTECTION`** (опционально)
  - `true` (по умолчанию) или `false`

### 4. Деплой

После настройки переменных окружения:

1. Перейдите в раздел **Deployments**
2. Нажмите **Redeploy** на последнем деплое
3. Или сделайте новый коммит в `master` ветку - деплой запустится автоматически

### 5. Проверка деплоя

После успешного деплоя:

1. Откройте URL вашего приложения (например: `https://your-app.vercel.app`)
2. Проверьте, что приложение загружается
3. Проверьте логи в Vercel Dashboard → Deployments → [ваш деплой] → Logs

---

## Что было настроено автоматически

✅ **`vercel.json`** - оптимизированная конфигурация для Vercel с Next.js 15  
✅ **`.vercelignore`** - исключение ненужных файлов из деплоя  
✅ **`vercel-build` скрипт** - специальный скрипт сборки для Vercel  
✅ **`postinstall` скрипт** - автоматическая генерация Prisma клиента  
✅ **Автоматическое определение SQLite in-memory** на Vercel  
✅ **Настроены функции API** - максимальное время выполнения 30 секунд  

---

## Решение проблем

### Ошибка: "Prisma Client not generated"

**Решение:** 
- Убедитесь, что `vercel-build` скрипт выполняется (проверьте `vercel.json`)
- Проверьте, что `postinstall` скрипт выполняется
- Проверьте логи сборки в Vercel Dashboard → Deployments → [ваш деплой] → Build Logs

### Ошибка: "DATABASE_URL is required"

**Решение:** 
- Либо добавьте `DATABASE_URL` в переменные окружения Vercel
- Либо убедитесь, что переменная `VERCEL` установлена (устанавливается автоматически)

### Ошибка: "Cannot write to database"

**Решение:** Это нормально для SQLite на Vercel. Используйте in-memory режим или мигрируйте на PostgreSQL.

### Ошибка при сборке

**Решение:**
1. Проверьте логи сборки в Vercel Dashboard → Deployments → [ваш деплой] → Build Logs
2. Убедитесь, что все зависимости установлены
3. Проверьте локально, что сборка работает: `npm run build`
4. Убедитесь, что TypeScript компилируется без ошибок: `npm run build`
5. **Для сборки `AUTH_SECRET` не обязателен** - он нужен только для runtime
6. Убедитесь, что `prisma` находится в `dependencies`, а не в `devDependencies`
7. Проверьте, что `postinstall` скрипт выполняется (должен генерировать Prisma Client)

---

## Миграция на PostgreSQL (рекомендуется для продакшена)

### Шаг 1: Создайте Vercel Postgres

1. В Vercel Dashboard → Storage → Create Database
2. Выберите **Postgres**
3. Создайте базу данных
4. Vercel автоматически добавит переменную `POSTGRES_URL`

### Шаг 2: Обновите Prisma Schema

Измените `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Шаг 3: Обновите переменные окружения

В Vercel Dashboard → Settings → Environment Variables:

- Установите `DATABASE_URL` = значение `POSTGRES_URL` (или используйте `POSTGRES_URL` напрямую)

### Шаг 4: Примените миграции

Обновите скрипт `vercel-build` в `package.json`:

```json
{
  "scripts": {
    "vercel-build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

**Примечание:** Для SQLite (вариант 1) миграции не нужны, так как используется in-memory база.  
Для PostgreSQL миграции применяются автоматически через `prisma migrate deploy`.

Или примените миграции вручную через Vercel CLI или через отдельный endpoint.

---

## Полезные ссылки

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)
- [Prisma with Vercel](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)

---

*Последнее обновление: 23.01.2026*
