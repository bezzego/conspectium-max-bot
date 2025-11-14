#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo "🚀 Настройка Docker окружения для Conspectium"
echo "=========================================="

# Проверяем наличие .env файла
if [ ! -f .env ]; then
    echo "📝 Файл .env не найден. Создаю из шаблона .env.example..."
    
    if [ ! -f .env.example ]; then
        echo "❌ Ошибка: файл .env.example не найден!"
        exit 1
    fi
    
    # Копируем шаблон
    cp .env.example .env
    echo "✅ Файл .env создан из шаблона"
    
    # Генерируем JWT_SECRET_KEY если он пустой
    if grep -q "^JWT_SECRET_KEY=$" .env || grep -q "^JWT_SECRET_KEY=\s*$" .env; then
        echo "🔐 Генерирую JWT_SECRET_KEY..."
        
        # Генерируем случайный ключ
        if command -v openssl &> /dev/null; then
            JWT_KEY=$(openssl rand -hex 32)
        elif command -v python3 &> /dev/null; then
            JWT_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
        else
            echo "⚠️  Предупреждение: не удалось сгенерировать JWT_SECRET_KEY автоматически"
            echo "   Пожалуйста, установите его вручную в файле .env"
            JWT_KEY=""
        fi
        
        if [ -n "$JWT_KEY" ]; then
            # Заменяем пустой JWT_SECRET_KEY на сгенерированный
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS
                sed -i '' "s/^JWT_SECRET_KEY=$/JWT_SECRET_KEY=$JWT_KEY/" .env
                sed -i '' "s/^SECRET_KEY=$/SECRET_KEY=$JWT_KEY/" .env
            else
                # Linux
                sed -i "s/^JWT_SECRET_KEY=$/JWT_SECRET_KEY=$JWT_KEY/" .env
                sed -i "s/^SECRET_KEY=$/SECRET_KEY=$JWT_KEY/" .env
            fi
            echo "✅ JWT_SECRET_KEY сгенерирован и установлен"
        fi
    fi
    
    echo ""
    echo "⚠️  ВАЖНО: Отредактируйте файл .env и укажите:"
    echo "   - GOOGLE_API_KEY (обязательно)"
    echo "   - GOOGLE_API_KEY_TEXT (обязательно)"
    echo "   - MAX_BOT_TOKEN (обязательно для работы бота)"
    echo ""
    echo "📝 Файл .env создан. Продолжаем..."
else
    echo "✅ Файл .env уже существует"
fi

# Проверяем обязательные переменные
echo ""
echo "🔍 Проверяю обязательные переменные..."

MISSING_VARS=()

if ! grep -q "^GOOGLE_API_KEY=.*[^=]$" .env 2>/dev/null || grep -q "^GOOGLE_API_KEY=your_gemini" .env 2>/dev/null; then
    MISSING_VARS+=("GOOGLE_API_KEY")
fi

if ! grep -q "^GOOGLE_API_KEY_TEXT=.*[^=]$" .env 2>/dev/null || grep -q "^GOOGLE_API_KEY_TEXT=your_gemini" .env 2>/dev/null; then
    MISSING_VARS+=("GOOGLE_API_KEY_TEXT")
fi

if ! grep -q "^MAX_BOT_TOKEN=.*[^=]$" .env 2>/dev/null || grep -q "^MAX_BOT_TOKEN=your_max_bot" .env 2>/dev/null; then
    MISSING_VARS+=("MAX_BOT_TOKEN")
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo "⚠️  Предупреждение: следующие переменные не установлены или имеют значения по умолчанию:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "   Приложение может работать некорректно без этих переменных."
    echo "   Отредактируйте файл .env перед запуском Docker."
else
    echo "✅ Все обязательные переменные установлены"
fi

echo ""
echo "=========================================="
echo "✅ Настройка завершена!"
echo "=========================================="
echo ""
echo "Теперь вы можете запустить Docker:"
echo "  docker-compose up -d"
echo ""

