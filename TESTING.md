# TESTING.md

**Дата создания:** 23.01.2026  
**Проект:** Calendar App Security Testing  
**Цель:** Инструкции по ручному и автоматическому тестированию security исправлений

---

## РУЧНОЕ ТЕСТИРОВАНИЕ

### 1. Security Headers

#### Тест 1.1: Проверка Headers в Browser DevTools
1. Открыть приложение в браузере
2. Открыть DevTools → Network
3. Перезагрузить страницу
4. Выбрать любой запрос → Headers → Response Headers
5. **Ожидаемый результат:**
   - `Content-Security-Policy` присутствует
   - `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy` присутствует
   - `Strict-Transport-Security` присутствует (только в production)

**Инструменты:**
- Browser DevTools
- Online checker: https://securityheaders.com

---

### 2. Rate Limiting

#### Тест 2.1: Rate Limit на Login Endpoint
1. Открыть Postman/curl/браузер
2. Отправить 10 POST запросов на `/api/auth/login` с разными email за 1 минуту
3. **Ожидаемый результат:**
   - Первые 5 запросов возвращают 200 или 404 (в зависимости от валидности email)
   - Запросы 6-10 возвращают `429 Too Many Requests`
   - В ответе есть заголовок `Retry-After`

**Команда для теста:**
```bash
# Отправить 10 запросов подряд
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com"}' \
    -w "\nStatus: %{http_code}\n"
  sleep 0.5
done
```

#### Тест 2.2: Rate Limit на API Endpoints
1. Отправить 150 GET запросов на `/api/calendar/items` за 1 минуту
2. **Ожидаемый результат:**
   - Первые 100 запросов проходят
   - Запросы 101-150 возвращают 429

---

### 3. Email Enumeration Protection

#### Тест 3.1: Timing Attack Protection
1. Замерить время ответа для существующего email:
   ```bash
   time curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@example.com"}'
   ```

2. Замерить время ответа для несуществующего email:
   ```bash
   time curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"nonexistent@example.com"}'
   ```

3. **Ожидаемый результат:**
   - Время ответа должно быть одинаковым (±50ms)
   - Формат ответа должен быть идентичным

#### Тест 3.2: Response Format Unification
1. Отправить запрос с существующим email
2. Отправить запрос с несуществующим email
3. **Ожидаемый результат:**
   - Оба ответа имеют одинаковый формат
   - Оба возвращают 200 OK (не 404 для несуществующего)
   - Сообщения об ошибке одинаковые

---

### 4. CSRF Protection

#### Тест 4.1: POST без CSRF Token
1. Отправить POST запрос на `/api/calendar/items` без CSRF token:
   ```bash
   curl -X POST http://localhost:3000/api/calendar/items \
     -H "Content-Type: application/json" \
     -H "Cookie: calendar_auth_user_id=test-id" \
     -d '{"type":"MEETING","title":"Test"}'
   ```

2. **Ожидаемый результат:**
   - Возвращает `403 Forbidden`
   - Сообщение об ошибке: "CSRF token required" или аналогичное

#### Тест 4.2: POST с валидным CSRF Token
1. Получить CSRF token (через GET запрос или специальный endpoint)
2. Отправить POST с токеном:
   ```bash
   curl -X POST http://localhost:3000/api/calendar/items \
     -H "Content-Type: application/json" \
     -H "Cookie: calendar_auth_user_id=test-id" \
     -H "X-CSRF-Token: <token>" \
     -d '{"type":"MEETING","title":"Test"}'
   ```

3. **Ожидаемый результат:**
   - Запрос проходит (если пользователь авторизован и админ)

#### Тест 4.3: GET запросы не требуют CSRF Token
1. Отправить GET запрос без CSRF token
2. **Ожидаемый результат:**
   - Запрос проходит (GET не требует CSRF)

---

### 5. IDOR Protection (Authorization)

#### Тест 5.1: Доступ к чужим Calendar Items
1. Войти как пользователь A (создать calendar item)
2. Войти как пользователь B (другой сессией)
3. Попытаться получить calendar item пользователя A:
   ```bash
   curl http://localhost:3000/api/calendar/items \
     -H "Cookie: calendar_auth_user_id=user-b-id"
   ```

4. **Ожидаемый результат:**
   - Пользователь B не видит items пользователя A (или видит только если он участник)
   - Если попытаться получить по ID — возвращает 403 или 404

#### Тест 5.2: Изменение чужого Calendar Item
1. Войти как пользователь A (создать item с ID `item-123`)
2. Войти как пользователь B
3. Попытаться изменить item пользователя A:
   ```bash
   curl -X PATCH http://localhost:3000/api/calendar/items/item-123 \
     -H "Content-Type: application/json" \
     -H "Cookie: calendar_auth_user_id=user-b-id" \
     -d '{"title":"Hacked"}'
   ```

4. **Ожидаемый результат:**
   - Возвращает `403 Forbidden`
   - Item не изменен

#### Тест 5.3: Удаление чужого Calendar Item
1. Аналогично тесту 5.2, но DELETE запрос
2. **Ожидаемый результат:**
   - Возвращает 403
   - Item не удален

#### Тест 5.4: Проверка UserPermission
1. Создать пользователя с `UserPermission` (myLevel=VIEW, allLevel=NONE)
2. Попытаться получить все calendar items
3. **Ожидаемый результат:**
   - Пользователь видит только свои items (myLevel=VIEW)
   - Не видит чужие items (allLevel=NONE)

---

### 6. Error Handling

#### Тест 6.1: Stack Trace не утекает в Production
1. Вызвать ошибку в API (например, передать невалидные данные)
2. **Ожидаемый результат:**
   - В ответе нет `stack` поля
   - В ответе нет путей к файлам
   - Сообщение об ошибке generic: "Internal server error" или "Failed to process request"

#### Тест 6.2: Логи содержат детали, но ответ — нет
1. Вызвать ошибку
2. Проверить server logs
3. Проверить response
4. **Ожидаемый результат:**
   - Server logs содержат полный stack trace
   - Response содержит только generic ошибку

---

### 7. Environment Variables Validation

#### Тест 7.1: Приложение не запускается без обязательных env
1. Удалить `AUTH_SECRET` из `.env`
2. Попытаться запустить приложение: `npm run dev`
3. **Ожидаемый результат:**
   - Приложение не запускается
   - Выводится понятная ошибка: "AUTH_SECRET is required"

#### Тест 7.2: Валидация формата env
1. Установить `AUTH_SECRET=""` (пустая строка)
2. Попытаться запустить
3. **Ожидаемый результат:**
   - Приложение не запускается
   - Ошибка: "AUTH_SECRET must be at least 32 characters"

---

### 8. Cookie Security

#### Тест 8.1: Проверка Cookie Attributes
1. Войти в приложение
2. Открыть DevTools → Application → Cookies
3. Найти cookie `calendar_auth_user_id`
4. **Ожидаемый результат:**
   - `HttpOnly: true`
   - `Secure: true` (в production)
   - `SameSite: Strict`
   - `Path: /` (или явно установлен)

---

### 9. Admin Routes Protection

#### Тест 9.1: Не-админ не может получить доступ к админке
1. Войти как USER (не ADMIN)
2. Попытаться зайти на `/admin/permissions`
3. **Ожидаемый результат:**
   - Редирект на другую страницу (например, `/meetings`)
   - Или 403 Forbidden

#### Тест 9.2: API Admin Routes защищены
1. Войти как USER
2. Попытаться получить доступ к `/api/admin/permissions`:
   ```bash
   curl http://localhost:3000/api/admin/permissions \
     -H "Cookie: calendar_auth_user_id=user-id"
   ```

3. **Ожидаемый результат:**
   - Возвращает 403 Forbidden

---

### 10. Pagination Limits

#### Тест 10.1: Max Limit на GET запросах
1. Отправить GET запрос с `limit=10000`:
   ```bash
   curl "http://localhost:3000/api/calendar/items?limit=10000" \
     -H "Cookie: calendar_auth_user_id=test-id"
   ```

2. **Ожидаемый результат:**
   - Возвращает 400 Bad Request
   - Сообщение: "Limit cannot exceed 1000"

---

## АВТОМАТИЧЕСКОЕ ТЕСТИРОВАНИЕ

### Unit Tests (если добавим)

#### Тест: Rate Limiter
```typescript
describe('rateLimit', () => {
  it('should block after max requests', async () => {
    const limiter = createRateLimiter({ max: 5, window: 60000 });
    const ip = '127.0.0.1';
    
    // Первые 5 запросов проходят
    for (let i = 0; i < 5; i++) {
      expect(await limiter.check(ip)).toBe(true);
    }
    
    // 6-й запрос блокируется
    expect(await limiter.check(ip)).toBe(false);
  });
});
```

#### Тест: CSRF Token Validation
```typescript
describe('csrf', () => {
  it('should reject invalid token', () => {
    expect(validateCSRFToken('invalid-token', 'session-id')).toBe(false);
  });
  
  it('should accept valid token', () => {
    const token = generateCSRFToken('session-id');
    expect(validateCSRFToken(token, 'session-id')).toBe(true);
  });
});
```

#### Тест: Authorization
```typescript
describe('authorize', () => {
  it('should deny access to other user resource', async () => {
    const userA = { id: 'user-a', role: 'USER' };
    const item = { id: 'item-1', createdById: 'user-b' };
    
    await expect(
      requireOwner(userA, item)
    ).rejects.toThrow('Forbidden');
  });
});
```

---

## ИНСТРУМЕНТЫ ДЛЯ ТЕСТИРОВАНИЯ

### Browser DevTools
- Network tab — проверка headers, rate limiting
- Application tab — проверка cookies
- Console — проверка ошибок

### curl / httpie
- Для тестирования API endpoints
- Проверка rate limiting
- Проверка CSRF protection

### Postman / Insomnia
- Для сложных сценариев
- Сохранение запросов для повторного использования

### Online Tools
- https://securityheaders.com — проверка security headers
- https://observatory.mozilla.org — общий security scan

---

## ЧЕКЛИСТ ПЕРЕД ПРОДАКШЕНОМ

- [ ] Все security headers установлены и работают
- [ ] Rate limiting работает на всех endpoints
- [ ] Email enumeration защищен (одинаковое время ответа)
- [ ] CSRF protection работает
- [ ] IDOR protection работает (пользователь не может получить доступ к чужим данным)
- [ ] Error handling не утечет stack traces
- [ ] Env validation работает
- [ ] Cookie security настроена правильно
- [ ] Admin routes защищены
- [ ] Pagination limits установлены
- [ ] Все тесты из этого документа пройдены
- [ ] Нет breaking changes для существующего функционала

---

## ЗАМЕТКИ

- Тестирование должно проводиться в dev окружении перед продакшеном
- После каждого исправления запускать соответствующие тесты
- Документировать любые найденные проблемы
- Обновлять этот документ при добавлении новых тестов
