#!/usr/bin/env node
/**
 * MAX Bot для Conspectium
 * Улучшенный бот с поддержкой Markdown и расширенным функционалом
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Bot, Keyboard } = require('@maxhub/max-bot-api');
const { callback: callbackButton } = Keyboard.button;

const BOT_TOKEN = process.env.MAX_BOT_TOKEN;

if (!BOT_TOKEN) {
    console.error('❌ Ошибка: MAX_BOT_TOKEN не установлен');
    process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

// Красиво отформатированная инструкция с Markdown
const INSTRUCTION_TEXT = `*📚 ИНСТРУКЦИЯ ПО РАБОТЕ С САЙТОМ КОНСПЕКТИУМ*

*🎯 ГЛАВНАЯ СТРАНИЦА*
• При первом посещении появится окно регистрации
• Заполните: Email, Nickname, Password
• После регистрации вы автоматически войдете в систему
• На главной странице видны ваши последние конспекты
• Для создания нового конспекта нажмите "Создай конспект" или загрузите аудио

*📝 СОЗДАНИЕ КОНСПЕКТА*
Есть 3 способа создать конспект:

*1️⃣ Из аудиофайла* 🎵
   • Поддерживаются: MP3, M4A, WAV, OGG, WebM, AAC
   • Нажмите "Загрузить аудио" или перетащите файл
   • Выберите вариант:
     📄 *Полный* — детальный конспект
     📋 *Краткий* — основные тезисы
     🎯 *Профиль* — специализированный формат
   • Дождитесь обработки (несколько минут для длинных аудио)

*2️⃣ Запись с микрофона* 🎤
   • Нажмите "Записать аудио прямо на сайте"
   • Разрешите доступ к микрофону
   • Начните и остановите запись
   • Выберите вариант конспекта

*3️⃣ Из текста* ✍️
   • Вставьте или введите текст
   • Выберите вариант конспекта
   • Нажмите "Создать конспект"
   • Конспект создается мгновенно

*📚 РАБОТА С КОНСПЕКТАМИ*
• Просмотр всех конспектов: раздел "Мои конспекты"
• Поиск по названию
• Просмотр конспекта в модальном окне
• Поделиться конспектом: кнопка "Поделиться" → скопировать ссылку
• Открыть чужой конспект: "Скинули ссылку?" → вставить ссылку → "Открыть"

*✅ СОЗДАНИЕ ТЕСТОВ*
1. Выберите конспект для создания теста
2. Нажмите "Настроить тест"
3. Выберите количество вопросов (1-20) ползунком
4. Нажмите "Создать тест"
5. Дождитесь генерации (1-2 минуты)
6. Тест автоматически откроется

*🎮 ПРОХОЖДЕНИЕ ТЕСТОВ*
• Выберите тест из списка или откройте по ссылке
• Читайте вопросы и выбирайте ответы
• После каждого вопроса нажмите "Далее"
• В конце увидите результаты:
  - Количество правильных ответов
  - Процент выполнения
  - Медаль (при 100%)

*🏆 ТУРНИРЫ*
• Участие в турнирах по тестам
• Получение медалей за достижения
• Просмотр статистики участия

*⚙️ НАСТРОЙКИ*
• Редактирование профиля (имя, пол, дата рождения)
• Изменение пароля
• Выход из аккаунта

*💡 ПОЛЕЗНЫЕ СОВЕТЫ*
• Чем больше вопросов в тесте, тем дольше генерация
• Конспекты можно сохранять и делиться ссылками
• За прохождение теста на 100% вы получаете медаль
• Все ваши данные изолированы и доступны только вам`;

// Функция получения информации о пользователе
function getUserInfo(ctx) {
    const user = ctx.message?.sender || ctx.sender || ctx.callback?.sender || ctx.update?.sender;
    const userId = user?.user_id || user?.id || 'unknown';
    const userName = user?.name || user?.first_name || user?.username || 'Пользователь';
    return { userId, userName };
}

// Функция отправки сообщения с Markdown
async function sendMessage(ctx, text, keyboard = null) {
    try {
        const options = {
            parse_mode: 'Markdown'
        };
        
        if (keyboard) {
            options.attachments = [keyboard];
        }
        
        await ctx.reply(text, options);
        return true;
    } catch (error) {
        console.error('❌ Ошибка отправки сообщения:', error.message);
        // Fallback: отправка без Markdown
        try {
            const fallbackOptions = keyboard ? { attachments: [keyboard] } : {};
            await ctx.reply(text.replace(/\*/g, ''), fallbackOptions);
            return true;
        } catch (fallbackError) {
            console.error('❌ Ошибка fallback отправки:', fallbackError.message);
            return false;
        }
    }
}

// Защита от дублирования сообщений
const messageCooldown = new Map(); // userId -> timestamp
const COOLDOWN_TIME = 20000; // 20 секунд

function checkCooldown(userId) {
    const now = Date.now();
    const lastSent = messageCooldown.get(userId);
    
    if (lastSent && (now - lastSent) < COOLDOWN_TIME) {
        return false;
    }
    
    messageCooldown.set(userId, now);
    return true;
}

// Очистка старых записей
setInterval(() => {
    const now = Date.now();
    for (const [userId, timestamp] of messageCooldown.entries()) {
        if (now - timestamp > COOLDOWN_TIME * 10) {
            messageCooldown.delete(userId);
        }
    }
}, 60000); // Каждую минуту

// Обработчик события bot_started
bot.on('bot_started', async (ctx) => {
    const { userName } = getUserInfo(ctx);
    const message = `👋 *Привет, ${userName}!*\n\nДобро пожаловать в *Конспектиум*! 🎓\n\nВыберите действие:`;
    const keyboard = Keyboard.inlineKeyboard([
        [callbackButton('📖 Инструкция', 'show_instruction')],
        [callbackButton('🎮 Развлечения', 'fun')],
        [callbackButton('🌐 Открыть сайт', 'open_site')]
    ]);
    
    await sendMessage(ctx, message, keyboard);
    console.log(`✅ Приветствие отправлено пользователю ${userName}`);
});

// Обработчик команды /start
bot.command('start', async (ctx) => {
    const { userName } = getUserInfo(ctx);
    const message = `👋 *Привет, ${userName}!*\n\nДобро пожаловать в *Конспектиум*! 🎓\n\nВыберите действие:`;
    const keyboard = Keyboard.inlineKeyboard([
        [callbackButton('📖 Инструкция', 'show_instruction')],
        [callbackButton('🎮 Развлечения', 'fun')],
        [callbackButton('🌐 Открыть сайт', 'open_site')]
    ]);
    
    await sendMessage(ctx, message, keyboard);
});

// Обработчик callback кнопок
bot.on('message_callback', async (ctx) => {
    const callbackData = ctx.callback?.payload || ctx.callback?.data;
    const { userId, userName } = getUserInfo(ctx);
    
    // Отвечаем на callback сразу
    try {
        if (ctx.answerCallbackQuery) {
            await ctx.answerCallbackQuery();
        }
    } catch (e) {
        console.warn('⚠️ Не удалось ответить на callback:', e.message);
    }
    
    // Проверка cooldown
    if (!checkCooldown(userId)) {
        console.log(`🚫 Сообщение для ${userName} заблокировано (cooldown)`);
        return;
    }
    
    switch (callbackData) {
        case 'show_instruction':
            await sendMessage(ctx, INSTRUCTION_TEXT);
            // Показываем кнопку возврата
            const backKeyboard = Keyboard.inlineKeyboard([
                [callbackButton('🏠 Главное меню', 'main_menu')]
            ]);
            await sendMessage(ctx, '_Выберите действие:_', backKeyboard);
            console.log(`✅ Инструкция отправлена пользователю ${userName}`);
            break;
            
        case 'fun':
            await sendFunMenu(ctx);
            break;
            
        case 'main_menu':
            await sendMainMenu(ctx);
            break;
            
        case 'open_site':
            const siteUrl = process.env.SITE_URL || 'https://conspectium.ru';
            await sendMessage(ctx, `🌐 *Открыть сайт Конспектиум*\n\nПерейдите по ссылке: ${siteUrl}\n\nИли используйте кнопку ниже:`, 
                Keyboard.inlineKeyboard([
                    [callbackButton('🔗 Открыть в браузере', 'open_browser')],
                    [callbackButton('🏠 Главное меню', 'main_menu')]
                ])
            );
            break;
            
        case 'random_number':
            const randomNum = Math.floor(Math.random() * 100) + 1;
            await sendMessage(ctx, `🎲 *Случайное число*\n\nВаше число: *${randomNum}*`, 
                Keyboard.inlineKeyboard([
                    [callbackButton('🎲 Еще раз', 'random_number')],
                    [callbackButton('🏠 Главное меню', 'main_menu')]
                ])
            );
            break;
            
        case 'joke':
            const jokes = [
                'Почему программисты не любят природу? Там слишком много багов! 🐛',
                'Что говорит один бит другому? Мы встретимся на байте! 💾',
                'Почему конспект не может найти друзей? Потому что он слишком структурированный! 📚',
                'Что сказал тест конспекту? Ты меня проверяешь? ✅',
                'Почему студент любит конспекты? Потому что они делают учебу легче! 🎓'
            ];
            const joke = jokes[Math.floor(Math.random() * jokes.length)];
            await sendMessage(ctx, `😂 *Шутка дня*\n\n${joke}`, 
                Keyboard.inlineKeyboard([
                    [callbackButton('😂 Еще шутку', 'joke')],
                    [callbackButton('🏠 Главное меню', 'main_menu')]
                ])
            );
            break;
            
        case 'color':
            const colors = ['🔴 Красный', '🟠 Оранжевый', '🟡 Желтый', '🟢 Зеленый', '🔵 Синий', '🟣 Фиолетовый', '⚫ Черный', '⚪ Белый'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            await sendMessage(ctx, `🌈 *Цвет дня*\n\nВаш цвет: *${color}*`, 
                Keyboard.inlineKeyboard([
                    [callbackButton('🌈 Другой цвет', 'color')],
                    [callbackButton('🏠 Главное меню', 'main_menu')]
                ])
            );
            break;
            
        case 'fact':
            const facts = [
                '📚 Конспекты помогают запомнить до 80% информации!',
                '🎯 Регулярное повторение материала увеличивает запоминание в 3 раза!',
                '🏆 Тесты улучшают понимание материала на 40%!',
                '💡 Активное обучение (тесты, вопросы) эффективнее пассивного чтения!',
                '📖 Конспектирование развивает навыки структурирования информации!'
            ];
            const fact = facts[Math.floor(Math.random() * facts.length)];
            await sendMessage(ctx, `📅 *Факт дня*\n\n${fact}`, 
                Keyboard.inlineKeyboard([
                    [callbackButton('📅 Другой факт', 'fact')],
                    [callbackButton('🏠 Главное меню', 'main_menu')]
                ])
            );
            break;
            
        default:
            console.log(`⚠️ Неизвестный callback: ${callbackData}`);
            break;
    }
});

// Функция отправки меню развлечений
async function sendFunMenu(ctx) {
    const message = `🎮 *Развлечения*\n\nВыбери игру:`;
    const keyboard = Keyboard.inlineKeyboard([
        [callbackButton('🎲 Случайное число', 'random_number')],
        [callbackButton('😂 Шутка дня', 'joke')],
        [callbackButton('🌈 Цвет дня', 'color')],
        [callbackButton('📅 Факт дня', 'fact')],
        [callbackButton('🏠 Главное меню', 'main_menu')]
    ]);
    await sendMessage(ctx, message, keyboard);
}

// Функция отправки главного меню
async function sendMainMenu(ctx) {
    const message = `🏠 *Главное меню*\n\nВыберите действие:`;
    const keyboard = Keyboard.inlineKeyboard([
        [callbackButton('📖 Инструкция', 'show_instruction')],
        [callbackButton('🎮 Развлечения', 'fun')],
        [callbackButton('🌐 Открыть сайт', 'open_site')]
    ]);
    await sendMessage(ctx, message, keyboard);
}

// Обработчик обычных сообщений
bot.on('message', async (ctx) => {
    const text = ctx.message?.text || ctx.message?.body || '';
    const { userName } = getUserInfo(ctx);
    
    if (text.toLowerCase().includes('привет') || text.toLowerCase().includes('hello')) {
        await sendMainMenu(ctx);
    } else if (text.toLowerCase().includes('инструкция') || text.toLowerCase().includes('помощь')) {
        await sendMessage(ctx, INSTRUCTION_TEXT);
        await sendMainMenu(ctx);
    } else if (text.toLowerCase().includes('меню')) {
        await sendMainMenu(ctx);
    } else {
        const message = `Не понял ваше сообщение. Используйте кнопки меню или команду /start`;
        await sendMessage(ctx, message, Keyboard.inlineKeyboard([
            [callbackButton('🏠 Главное меню', 'main_menu')]
        ]));
    }
});

// Обработка ошибок
bot.on('error', (error) => {
    console.error('❌ Ошибка бота:', error);
});

// Запуск бота
console.log('🚀 Запуск MAX бота...');
bot.start()
    .then(() => {
        console.log('✅ Бот успешно запущен и готов к работе!');
        console.log('📝 Поддержка Markdown: включена');
        console.log('🎮 Функции: инструкция, развлечения, меню');
    })
    .catch((error) => {
        console.error('❌ Критическая ошибка запуска:', error);
        process.exit(1);
    });
