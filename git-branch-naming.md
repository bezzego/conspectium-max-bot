# Git Branch Naming Guide

Единые правила именования веток для проекта.  
Цель — сделать историю коммитов и работу в Git предсказуемой и удобной для всей команды.

---

## Общая структура

**Формат:**
```
<тип>/<контекст>-<краткое-описание>
```

**Примеры:**
```
feature/user-auth
fix/payment-timeout
refactor/graphql-repo
test/mock-actor-service
docs/api-schema
```

---

## Типы веток

| Тип | Назначение | Пример |
|------|-------------|--------|
| `feature/` | Новая функциональность | `feature/add-tree-charging` |
| `fix/` | Исправление ошибки | `fix/request-handler-bug` |
| `hotfix/` | Срочная правка продакшена | `hotfix/crash-on-login` |
| `refactor/` | Улучшение кода без изменения логики | `refactor/leat-repo-builder` |
| `test/` | Тесты и тестовые заглушки | `test/integration-arbitrage` |
| `chore/` | Рутинные задачи (CI, зависимости, конфиги) | `chore/update-poetry-lock` |
| `docs/` | Документация, README, wiki | `docs/setup-guide` |
| `release/` | Подготовка к релизу | `release/1.33.0-alpha` |
| `experiment/` | Временные или исследовательские ветки | `experiment/new-cache-layer` |

---

## Основной Git Flow

```
main (или master) — стабильная версия (production)
develop — интеграционная ветка (staging)
feature/* — создаются от develop, мержатся в develop
release/* — создаются от develop, мержатся в main и develop
hotfix/* — создаются от main, мержатся в main и develop
```

---

## Для командных проектов

Если в проекте несколько модулей или разработчиков, используем префиксы:

**По модулю:**
```
feature/api/auth-endpoints
fix/frontend/navbar-bug
feature/rust/graphql-cache
```

**По автору (при необходимости):**
```
feature/egor/new-tree-handler
fix/egor/alembic-error
```

---

## Правила хорошего тона

1. **Маленькие буквы, дефисы и слэши.**
   ```
   Правильно: feature/add-payments  
   Неправильно: Feature/Add Payments
   ```

2. **Коротко и по сути.**
   ```
   Правильно: fix/role-check  
   Неправильно: fix/fix-problem-with-user-role-validation-in-admin-panel
   ```

3. **Номера задач (если используется трекер).**
   ```
   feature/LEAT-1046-user-roles  
   fix/RQ-212-wrong-trial-expiration
   ```

4. **Не создавайте ветки от веток.**
   Только от `develop` или `main`.

5. **После merge ветку нужно удалять.**

---

## Пример структуры проекта

```
main
develop
feature/actor-service-async-tests
feature/graphql-mutation-attachments
fix/leat-repo-cache
refactor/data-service-builder
test/mock-arbitrage-repo
release/1.33.0-beta
```

---

## Рекомендации по коммитам

Для коммитов рекомендуется использовать стиль **Conventional Commits**, чтобы имена веток и сообщения совпадали по смыслу:

```
feat: add subscription payment
fix: wrong role permissions
refactor: optimize cache layer
test: increase coverage for repo
```

---

Автор гайдлайна: команда разработки LEAT / Request-Bot / AB.MONEY  
Ответственный: Егор Безбородов
