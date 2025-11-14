#!/usr/bin/env node
/**
 * MAX Bot для Conspectium
 * Продвинутый бот с персонализацией, статистикой, викторинами и геймификацией
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Bot, Keyboard } = require('@maxhub/max-bot-api');
const { callback: callbackButton } = Keyboard.button;

const BOT_TOKEN = process.env.MAX_BOT_TOKEN;
const API_BASE = process.env.API_BASE_URL || 'http://localhost:8000/api';

if (!BOT_TOKEN) {
    console.error('❌ Ошибка: MAX_BOT_TOKEN не установлен');
    process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

// Хранилище данных пользователей (в реальном приложении - база данных)
const userData = new Map(); // userId -> { name, streak, lastVisit, achievements, quizScore }

// Функция получения времени суток для персонализации
function getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { greeting: 'Доброе утро', emoji: '🌅' };
    if (hour >= 12 && hour < 17) return { greeting: 'Добрый день', emoji: '☀️' };
    if (hour >= 17 && hour < 22) return { greeting: 'Добрый вечер', emoji: '🌆' };
    return { greeting: 'Доброй ночи', emoji: '🌙' };
}

// Функция получения информации о пользователе с расширенными данными
function getUserInfo(ctx) {
    // Пробуем разные варианты получения пользователя из контекста
    const user = ctx.message?.sender || 
                 ctx.sender || 
                 ctx.callback?.sender || 
                 ctx.update?.sender || 
                 ctx.callbackQuery?.sender ||
                 ctx.message?.from ||
                 ctx.from;
    
    // Пробуем разные варианты получения userId
    const userId = user?.user_id || 
                   user?.id || 
                   user?.userId ||
                   ctx.message?.from?.id ||
                   ctx.from?.id ||
                   String(user?.user_id || user?.id || 'unknown');
    
    // Приоритет: first_name > display_name > name > username
    // Избегаем использования user?.name, так как это может быть имя бота
    const userName = user?.first_name || 
                     user?.display_name ||
                     user?.username || 
                     (user?.name && user?.name !== 'Conspectium Bot' && user?.name !== 'MAX Bot' ? user.name : null) ||
                     'Пользователь';
    
    // Логируем для отладки (только если userId unknown или имя не найдено)
    if (userId === 'unknown' || !userId || userName === 'Пользователь') {
        console.warn('⚠️ Проблема с получением данных пользователя:', {
            userId: userId,
            userName: userName,
            hasMessage: !!ctx.message,
            hasSender: !!ctx.sender,
            hasCallback: !!ctx.callback,
            userKeys: user ? Object.keys(user) : 'no user',
            userData: user ? {
                first_name: user.first_name,
                display_name: user.display_name,
                username: user.username,
                name: user.name
            } : 'no user'
        });
    }
    
    // Инициализация данных пользователя, если его еще нет
    if (!userData.has(userId)) {
        userData.set(userId, {
            userId: userId, // Сохраняем userId в данных пользователя
            name: userName,
            streak: 0,
            lastVisit: null,
            achievements: [],
            quizScore: 0,
            totalQuizzes: 0,
            perfectScores: 0,
            dailyTasks: [],
            level: 1,
            experience: 0
        });
    }
    
    const userInfo = userData.get(userId);
    
    // Обновляем userId на случай, если он изменился
    if (userInfo.userId !== userId) {
        userInfo.userId = userId;
    }
    
    // Обновляем имя только если:
    // 1. Новое имя валидное (не бот, не дефолтное)
    // 2. Текущее сохраненное имя - дефолтное или пустое
    const isValidName = userName !== 'Пользователь' && 
                       !userName.includes('Bot') && 
                       !userName.includes('бот') &&
                       !userName.includes('Conspectium') &&
                       userName.trim().length > 0;
    
    if (isValidName) {
        // Если сохраненное имя дефолтное или пустое, обновляем
        if (!userInfo.name || 
            userInfo.name === 'Пользователь' || 
            userInfo.name.includes('Bot') || 
            userInfo.name.includes('бот')) {
            userInfo.name = userName;
        }
        // Если новое имя отличается от сохраненного, но оба валидные - обновляем
        // (пользователь мог изменить имя в профиле)
        else if (userInfo.name !== userName) {
            userInfo.name = userName;
        }
    }
    
    // ВСЕГДА используем сохраненное имя из userInfo для консистентности
    // Это гарантирует, что один и тот же пользователь будет называться одинаково
    const finalUserName = (userInfo.name && 
                          userInfo.name !== 'Пользователь' && 
                          !userInfo.name.includes('Bot') && 
                          !userInfo.name.includes('бот'))
                          ? userInfo.name
                          : (isValidName ? userName : 'Пользователь');
    
    // Проверяем streak (посещения подряд)
    const now = new Date();
    const lastVisit = userInfo.lastVisit;
    if (lastVisit) {
        const daysDiff = Math.floor((now - new Date(lastVisit)) / (1000 * 60 * 60 * 24));
        if (daysDiff === 1) {
            userInfo.streak++;
        } else if (daysDiff > 1) {
            userInfo.streak = 1; // Сброс streak
        }
    } else {
        userInfo.streak = 1;
    }
    userInfo.lastVisit = now.toISOString();
    
    return { userId, userName: finalUserName, userInfo };
}

// Функция отправки сообщения с Markdown для MAX
async function sendMessage(ctx, text, keyboard = null) {
    try {
        const options = {};
        
        if (text.includes('**') || text.includes('__') || text.includes('*') || text.includes('_') || text.includes('`') || text.includes('[')) {
            options.format = 'markdown';
        }
        
        if (keyboard) {
            options.attachments = [keyboard];
        }
        
        await ctx.reply(text, options);
        return true;
    } catch (error) {
        console.error('❌ Ошибка отправки сообщения:', error.message);
        try {
            const fallbackText = text
                .replace(/\*\*/g, '')
                .replace(/\*/g, '')
                .replace(/__/g, '')
                .replace(/_/g, '')
                .replace(/`/g, '')
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
            
            const fallbackOptions = keyboard ? { attachments: [keyboard] } : {};
            await ctx.reply(fallbackText, fallbackOptions);
            return true;
        } catch (fallbackError) {
            console.error('❌ Ошибка fallback отправки:', fallbackError.message);
            return false;
        }
    }
}

// Защита от дублирования для текстовых сообщений
const textMessageCooldown = new Map();
const TEXT_COOLDOWN_TIME = 3000;

function checkTextCooldown(userId) {
    const now = Date.now();
    const lastSent = textMessageCooldown.get(userId);
    
    if (lastSent && (now - lastSent) < TEXT_COOLDOWN_TIME) {
        return false;
    }
    
    textMessageCooldown.set(userId, now);
    return true;
}

// Очистка старых записей
setInterval(() => {
    const now = Date.now();
    for (const [userId, timestamp] of textMessageCooldown.entries()) {
        if (now - timestamp > TEXT_COOLDOWN_TIME * 10) {
            textMessageCooldown.delete(userId);
        }
    }
}, 60000);

// Викторина - вопросы и ответы
const quizQuestions = [
    {
        question: 'Какой процент информации запоминается при конспектировании?',
        options: ['50%', '80%', '30%', '100%'],
        correct: 1,
        explanation: 'Конспектирование помогает запомнить до 80% информации! 📚'
    },
    {
        question: 'Сколько раз нужно повторить материал для лучшего запоминания?',
        options: ['1 раз', '3 раза', '5 раз', '10 раз'],
        correct: 1,
        explanation: 'Регулярное повторение 3 раза значительно улучшает запоминание! 🎯'
    },
    {
        question: 'Что эффективнее для обучения?',
        options: ['Пассивное чтение', 'Активное тестирование', 'Просмотр видео', 'Все одинаково'],
        correct: 1,
        explanation: 'Активное обучение (тесты, вопросы) эффективнее пассивного чтения на 40%! 💡'
    },
    {
        question: 'Какой формат конспекта самый детальный?',
        options: ['Краткий', 'Полный', 'Профиль', 'Все одинаковые'],
        correct: 1,
        explanation: 'Полный конспект содержит максимально детальную информацию! 📄'
    },
    {
        question: 'За что можно получить медаль в Конспектиуме?',
        options: ['За регистрацию', 'За 100% прохождение теста', 'За создание конспекта', 'За все вышеперечисленное'],
        correct: 1,
        explanation: 'Медаль получают за прохождение теста на 100%! 🏆'
    }
];

// Хранилище активных викторин
const activeQuizzes = new Map(); // userId -> { currentQuestion: 0, score: 0, answers: [] }

// Ежедневные задания
const dailyTasks = [
    { id: 'create_conspect', name: 'Создать конспект', emoji: '📝', xp: 50 },
    { id: 'pass_test', name: 'Пройти тест', emoji: '✅', xp: 30 },
    { id: 'perfect_score', name: 'Набрать 100% в тесте', emoji: '🏆', xp: 100 },
    { id: 'visit_daily', name: 'Зайти в бота', emoji: '📅', xp: 10 },
    { id: 'share_conspect', name: 'Поделиться конспектом', emoji: '🔗', xp: 20 }
];

// Мотивационные сообщения
const motivationalMessages = [
    'Ты на правильном пути! Продолжай в том же духе! 💪',
    'Каждый день — это новая возможность стать лучше! 🌟',
    'Твои усилия не проходят даром! Продолжай учиться! 📚',
    'Ты делаешь отличную работу! Не останавливайся! 🚀',
    'Знания — это сила! Ты становишься сильнее с каждым днем! ⚡',
    'Твоя мотивация вдохновляет! Продолжай в том же духе! 🔥',
    'Каждый конспект — это шаг к успеху! Иди вперед! 🎯',
    'Ты создаешь свое будущее прямо сейчас! Не сдавайся! 💎'
];

// Персональные советы по обучению
const learningTips = [
    '💡 **Совет:** Повторяй материал через 24 часа, затем через неделю — это улучшит запоминание!',
    '📖 **Совет:** Делай конспекты своими словами — так информация лучше усваивается!',
    '🎯 **Совет:** Проходи тесты регулярно — это помогает закрепить знания!',
    '⏰ **Совет:** Занимайся по 25-30 минут с перерывами — метод Помодоро работает!',
    '🧠 **Совет:** Объясняй материал вслух — это активирует разные участки мозга!',
    '📝 **Совет:** Используй разные форматы конспектов для разных предметов!',
    '🎮 **Совет:** Участвуй в турнирах — соревнование мотивирует учиться лучше!',
    '🏆 **Совет:** Отслеживай свои достижения — видеть прогресс очень мотивирует!'
];

// Инструкция
const INSTRUCTION_TEXT = `**📚 ИНСТРУКЦИЯ ПО РАБОТЕ С САЙТОМ КОНСПЕКТИУМ**

**🎯 ГЛАВНАЯ СТРАНИЦА**
• При первом посещении появится окно регистрации
• Заполните: Email, Nickname, Password
• После регистрации вы автоматически войдете в систему
• На главной странице видны ваши последние конспекты
• Для создания нового конспекта нажмите "Создай конспект" или загрузите аудио

**📝 СОЗДАНИЕ КОНСПЕКТА**
Есть 3 способа создать конспект:

**1️⃣ Из аудиофайла** 🎵
   • Поддерживаются: MP3, M4A, WAV, OGG, WebM, AAC
   • Нажмите "Загрузить аудио" или перетащите файл
   • Выберите вариант:
     📄 **Полный** — детальный конспект
     📋 **Краткий** — основные тезисы
     🎯 **Профиль** — специализированный формат
   • Дождитесь обработки (несколько минут для длинных аудио)

**2️⃣ Запись с микрофона** 🎤
   • Нажмите "Записать аудио прямо на сайте"
   • Разрешите доступ к микрофону
   • Начните и остановите запись
   • Выберите вариант конспекта

**3️⃣ Из текста** ✍️
   • Вставьте или введите текст
   • Выберите вариант конспекта
   • Нажмите "Создать конспект"
   • Конспект создается мгновенно

**📚 РАБОТА С КОНСПЕКТАМИ**
• Просмотр всех конспектов: раздел "Мои конспекты"
• Поиск по названию
• Просмотр конспекта в модальном окне
• Поделиться конспектом: кнопка "Поделиться" → скопировать ссылку
• Открыть чужой конспект: "Скинули ссылку?" → вставить ссылку → "Открыть"

**✅ СОЗДАНИЕ ТЕСТОВ**
1. Выберите конспект для создания теста
2. Нажмите "Настроить тест"
3. Выберите количество вопросов (1-20) ползунком
4. Нажмите "Создать тест"
5. Дождитесь генерации (1-2 минуты)
6. Тест автоматически откроется

**🎮 ПРОХОЖДЕНИЕ ТЕСТОВ**
• Выберите тест из списка или откройте по ссылке
• Читайте вопросы и выбирайте ответы
• После каждого вопроса нажмите "Далее"
• В конце увидите результаты:
  - Количество правильных ответов
  - Процент выполнения
  - Медаль (при 100%)

**🏆 ТУРНИРЫ**
• Участие в турнирах по тестам
• Получение медалей за достижения
• Просмотр статистики участия

**⚙️ НАСТРОЙКИ**
• Редактирование профиля (имя, пол, дата рождения)
• Изменение пароля
• Выход из аккаунта

**💡 ПОЛЕЗНЫЕ СОВЕТЫ**
• Чем больше вопросов в тесте, тем дольше генерация
• Конспекты можно сохранять и делиться ссылками
• За прохождение теста на 100% вы получаете медаль
• Все ваши данные изолированы и доступны только вам`;

// Персонализированное приветствие (компактное)
function getPersonalizedGreeting(userName, userInfo) {
    const timeOfDay = getTimeOfDay();
    const streak = userInfo.streak;
    
    let greeting = `${timeOfDay.emoji} ${timeOfDay.greeting}, **${userName}**! `;
    
    if (streak > 1) {
        greeting += `🔥 Серия: **${streak} дней**\n\n`;
    } else {
        greeting += `🎓\n\n`;
    }
    
    return greeting;
}

// Функция расчета уровня и опыта
function calculateLevel(experience) {
    const level = Math.floor(experience / 100) + 1;
    const currentLevelXP = experience % 100;
    const nextLevelXP = 100;
    return { level, currentLevelXP, nextLevelXP, experience };
}

// Функция добавления опыта
function addExperience(userInfo, amount) {
    userInfo.experience += amount;
    const { level, currentLevelXP, nextLevelXP } = calculateLevel(userInfo.experience);
    const oldLevel = userInfo.level;
    userInfo.level = level;
    
    if (level > oldLevel) {
        return { leveledUp: true, newLevel: level };
    }
    return { leveledUp: false, currentLevelXP, nextLevelXP };
}

// Обработчик события bot_started
bot.on('bot_started', async (ctx) => {
    const { userId, userName, userInfo } = getUserInfo(ctx);
    await sendMainMenu(ctx, userName, userInfo);
    console.log(`✅ Персонализированное приветствие отправлено пользователю ${userName} (${userId})`);
});

// Обработчик команды /start
bot.command('start', async (ctx) => {
    const { userName, userInfo } = getUserInfo(ctx);
    await sendMainMenu(ctx, userName, userInfo);
});

// Обработчик callback кнопок
bot.on('message_callback', async (ctx) => {
    const callbackData = ctx.callback?.payload || 
                        ctx.callback?.data || 
                        ctx.callbackQuery?.data ||
                        ctx.update?.callback_query?.data;
    
    const { userId, userName, userInfo } = getUserInfo(ctx);
    
    console.log(`🔔 Callback получен: ${callbackData} от пользователя ${userName} (${userId})`);
    
    // Отвечаем на callback сразу
    try {
        if (ctx.answerCallbackQuery) {
                await ctx.answerCallbackQuery();
        } else if (ctx.callbackQuery) {
            await bot.api.answerCallbackQuery(ctx.callbackQuery.id || ctx.callback?.query_id);
        }
    } catch (e) {
        console.warn('⚠️ Не удалось ответить на callback:', e.message);
    }
    
    // Обрабатываем callback
    switch (callbackData) {
        case 'show_instruction':
            const backKeyboard = Keyboard.inlineKeyboard([
                [callbackButton('🏠 Главное меню', 'main_menu')]
            ]);
            await sendMessage(ctx, INSTRUCTION_TEXT, backKeyboard);
            break;
            
        case 'my_stats':
            await showUserStats(ctx, userInfo, userName);
            break;
            
        case 'fun':
            await sendFunMenu(ctx);
            break;
            
        case 'main_menu':
            await sendMainMenu(ctx, userName, userInfo);
            break;
            
        case 'start_quiz':
            await startQuiz(ctx, userInfo, userId);
            break;
            
        case 'daily_tasks':
            await showDailyTasks(ctx, userInfo);
            break;
            
        case 'learning_tips':
            await showLearningTips(ctx);
            break;
            
        case 'show_my_id':
            await showMyId(ctx, userId, userInfo);
            break;
            
        case 'random_number':
            const randomNum = Math.floor(Math.random() * 100) + 1;
            await sendMessage(ctx, `🎲 **Случайное число**\n\nВаше число: **${randomNum}**`, 
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
                'Почему студент любит конспекты? Потому что они делают учебу легче! 🎓',
                'Как конспект общается с тестом? Через API! 🔌',
                'Почему конспект никогда не опаздывает? Потому что он всегда структурирован! ⏰'
            ];
            const joke = jokes[Math.floor(Math.random() * jokes.length)];
            await sendMessage(ctx, `😂 **Шутка дня**\n\n${joke}`, 
                Keyboard.inlineKeyboard([
                    [callbackButton('😂 Еще шутку', 'joke')],
                    [callbackButton('🏠 Главное меню', 'main_menu')]
                ])
            );
            break;
            
        case 'color':
            const colors = ['🔴 Красный', '🟠 Оранжевый', '🟡 Желтый', '🟢 Зеленый', '🔵 Синий', '🟣 Фиолетовый', '⚫ Черный', '⚪ Белый', '🟤 Коричневый', '🟡 Золотой'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            await sendMessage(ctx, `🌈 **Цвет дня**\n\nВаш цвет: **${color}**\n\nЭтот цвет символизирует энергию и вдохновение! ✨`, 
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
                '📖 Конспектирование развивает навыки структурирования информации!',
                '🧠 Мозг лучше запоминает информацию, когда она структурирована!',
                '⏰ Оптимальное время для повторения — через 24 часа после изучения!',
                '🎮 Геймификация обучения повышает мотивацию на 60%!'
            ];
            const fact = facts[Math.floor(Math.random() * facts.length)];
            await sendMessage(ctx, `📅 **Факт дня**\n\n${fact}`, 
                Keyboard.inlineKeyboard([
                    [callbackButton('📅 Другой факт', 'fact')],
                    [callbackButton('🏠 Главное меню', 'main_menu')]
                ])
            );
            break;
            
        case 'motivation':
            const motivation = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
            await sendMessage(ctx, `💪 **Мотивация**\n\n${motivation}`, 
                Keyboard.inlineKeyboard([
                    [callbackButton('💪 Еще мотивации', 'motivation')],
                    [callbackButton('🏠 Главное меню', 'main_menu')]
                ])
            );
            break;
            
        default:
            // Обработка ответов викторины
            if (callbackData.startsWith('quiz_')) {
                await handleQuizAnswer(ctx, callbackData, userInfo, userId);
            } else {
                console.log(`⚠️ Неизвестный callback: ${callbackData}`);
                await sendMainMenu(ctx, userName, userInfo);
            }
            break;
    }
});

// Функция показа статистики пользователя
async function showUserStats(ctx, userInfo, userName) {
    const { level, currentLevelXP, nextLevelXP, experience } = calculateLevel(userInfo.experience);
    const progressPercent = Math.floor((currentLevelXP / nextLevelXP) * 100);
    const progressBar = '█'.repeat(Math.floor(progressPercent / 10)) + '░'.repeat(10 - Math.floor(progressPercent / 10));
    
    let stats = `📊 **Статистика ${userName}**\n\n`;
    stats += `🎖️ Уровень: **${level}** | ⭐ Опыт: ${currentLevelXP}/${nextLevelXP} (${progressPercent}%)\n`;
    stats += `📈 ${progressBar}\n\n`;
    stats += `🔥 Серия: ${userInfo.streak} ${userInfo.streak === 1 ? 'день' : 'дней'}\n`;
    stats += `🧠 Викторин: ${userInfo.totalQuizzes}\n`;
    stats += `🏆 Идеальных: ${userInfo.perfectScores}\n`;
    stats += `📝 Лучший результат: ${userInfo.quizScore}%\n`;
    
    if (userInfo.achievements.length > 0) {
        stats += `\n🏅 **Достижения:**\n`;
        userInfo.achievements.forEach(ach => {
            stats += `${ach.emoji} ${ach.name}\n`;
        });
    }
    
    // Краткое мотивационное сообщение
    if (userInfo.streak >= 7) {
        stats += `\n🔥 Отличная серия из ${userInfo.streak} дней!`;
    } else if (userInfo.streak >= 3) {
        stats += `\n💪 Хорошая серия!`;
    }
    
    const keyboard = Keyboard.inlineKeyboard([
        [callbackButton('🔄 Обновить', 'my_stats')],
        [callbackButton('🏠 Главное меню', 'main_menu')]
    ]);
    
    await sendMessage(ctx, stats, keyboard);
}

// Функция запуска викторины
async function startQuiz(ctx, userInfo, userId) {
    activeQuizzes.set(userId, {
        currentQuestion: 0,
        score: 0,
        answers: []
    });
    
    await showQuizQuestion(ctx, 0, userInfo, userId);
}

// Функция показа вопроса викторины
async function showQuizQuestion(ctx, questionIndex, userInfo, userId, previousResult = null) {
    const quiz = activeQuizzes.get(userId);
    if (!quiz || questionIndex >= quizQuestions.length) {
        await finishQuiz(ctx, userInfo, userId);
        return;
    }
    
    const question = quizQuestions[questionIndex];
    let message = `🧠 **Викторина: Вопрос ${questionIndex + 1}/${quizQuestions.length}**\n`;
    
    // Показываем результат предыдущего ответа, если есть
    if (previousResult) {
        message += `\n${previousResult}\n`;
    }
    
    message += `\n**${question.question}**\n\n`;
    
    const buttons = question.options.map((option, index) => 
        callbackButton(`${index + 1}. ${option}`, `quiz_answer_${questionIndex}_${index}`)
    );
    
    const keyboard = Keyboard.inlineKeyboard([
        [buttons[0], buttons[1]],
        [buttons[2], buttons[3]],
        [callbackButton('❌ Отменить', 'cancel_quiz')]
    ]);
    
    await sendMessage(ctx, message, keyboard);
}

// Обработка ответа на вопрос викторины
async function handleQuizAnswer(ctx, callbackData, userInfo, userId) {
    if (callbackData === 'cancel_quiz') {
        activeQuizzes.delete(userId);
        await sendMessage(ctx, '❌ Викторина отменена', 
            Keyboard.inlineKeyboard([
                [callbackButton('🏠 Главное меню', 'main_menu')]
            ])
        );
        return;
    }
    
    const match = callbackData.match(/quiz_answer_(\d+)_(\d+)/);
    if (!match) return;
    
    const questionIndex = parseInt(match[1]);
    const answerIndex = parseInt(match[2]);
    const quiz = activeQuizzes.get(userId);
    
    if (!quiz || quiz.currentQuestion !== questionIndex) {
        return;
    }
    
    const question = quizQuestions[questionIndex];
    const isCorrect = answerIndex === question.correct;
    
    if (isCorrect) {
        quiz.score++;
    }
    
    quiz.answers.push({ questionIndex, answerIndex, isCorrect });
    quiz.currentQuestion++;
    
    // Формируем краткий результат для следующего вопроса
    let previousResult = isCorrect ? 
        `✅ **Правильно!** ${question.explanation}` :
        `❌ **Неправильно.** Правильно: **${question.options[question.correct]}**\n${question.explanation}`;
    
    // Показываем следующий вопрос сразу с результатом предыдущего
    if (quiz.currentQuestion < quizQuestions.length) {
        // Небольшая задержка для лучшего UX
        setTimeout(() => {
            showQuizQuestion(ctx, quiz.currentQuestion, userInfo, userId, previousResult);
        }, 800);
    } else {
        // Если это был последний вопрос, показываем финальный результат
        await finishQuiz(ctx, userInfo, userId);
    }
}

// Завершение викторины
async function finishQuiz(ctx, userInfo, userId) {
    const quiz = activeQuizzes.get(userId);
    if (!quiz) return;
    
    const scorePercent = Math.floor((quiz.score / quizQuestions.length) * 100);
    const totalQuestions = quizQuestions.length;
    
    userInfo.totalQuizzes++;
    if (scorePercent > userInfo.quizScore) {
        userInfo.quizScore = scorePercent;
    }
    if (scorePercent === 100) {
        userInfo.perfectScores++;
        // Добавляем достижение
        if (!userInfo.achievements.find(a => a.id === 'perfect_quiz')) {
            userInfo.achievements.push({ id: 'perfect_quiz', name: 'Идеальная викторина', emoji: '🏆' });
        }
    }
    
    // Добавляем опыт
    const xpGained = Math.floor(scorePercent / 10) * 5 + 10; // 10-60 XP в зависимости от результата
    const levelUp = addExperience(userInfo, xpGained);
    
    let message = `🎉 **Викторина завершена!**\n\n`;
    message += `📊 **Результат:** ${quiz.score}/${totalQuestions} (${scorePercent}%)\n`;
    message += `⭐ **Опыт:** +${xpGained} XP\n\n`;
    
    if (scorePercent === 100) {
        message += `🏆 **ИДЕАЛЬНЫЙ РЕЗУЛЬТАТ!** Все ответы правильные!\n\n`;
    } else if (scorePercent >= 80) {
        message += `🌟 Отличный результат!\n\n`;
    } else if (scorePercent >= 60) {
        message += `👍 Хороший результат! Продолжай учиться!\n\n`;
    } else {
        message += `💪 Не сдавайся! Попробуй снова!\n\n`;
    }
    
    if (levelUp.leveledUp) {
        message += `🎊 **ПОВЫШЕНИЕ УРОВНЯ!** Уровень **${levelUp.newLevel}**! 🎉\n\n`;
    }
    
    const keyboard = Keyboard.inlineKeyboard([
        [callbackButton('🔄 Еще раз', 'start_quiz')],
        [callbackButton('📊 Статистика', 'my_stats')],
        [callbackButton('🏠 Главное меню', 'main_menu')]
    ]);
    
    await sendMessage(ctx, message, keyboard);
    activeQuizzes.delete(userId);
}

// Показ ежедневных заданий
async function showDailyTasks(ctx, userInfo) {
    let message = `📅 **Ежедневные задания**\n\n`;
    
    dailyTasks.forEach((task, index) => {
        const completed = userInfo.dailyTasks?.includes(task.id) || false;
        const status = completed ? '✅' : '⏳';
        message += `${status} ${task.emoji} ${task.name} — ${task.xp} XP\n`;
    });
    
    message += `\n💡 Выполняй на сайте для получения опыта\n`;
    message += `🔥 Серия: ${userInfo.streak} ${userInfo.streak === 1 ? 'день' : 'дней'}`;
    
    const keyboard = Keyboard.inlineKeyboard([
        [callbackButton('🔄 Обновить', 'daily_tasks')],
        [callbackButton('🏠 Главное меню', 'main_menu')]
    ]);
    
    await sendMessage(ctx, message, keyboard);
}

// Показ советов по обучению
async function showLearningTips(ctx) {
    const tip = learningTips[Math.floor(Math.random() * learningTips.length)];
    const message = `💡 **Совет по обучению**\n\n${tip}\n\n`;
    
    const keyboard = Keyboard.inlineKeyboard([
        [callbackButton('💡 Другой совет', 'learning_tips')],
        [callbackButton('🏠 Главное меню', 'main_menu')]
    ]);
    
    await sendMessage(ctx, message, keyboard);
}

// Функция отправки меню развлечений
async function sendFunMenu(ctx) {
    const message = `🎮 **Развлечения**\n\nВыбери игру:`;
    const keyboard = Keyboard.inlineKeyboard([
        [callbackButton('🎲 Случайное число', 'random_number')],
        [callbackButton('😂 Шутка дня', 'joke')],
        [callbackButton('🌈 Цвет дня', 'color')],
        [callbackButton('📅 Факт дня', 'fact')],
        [callbackButton('💪 Мотивация', 'motivation')],
        [callbackButton('🏠 Главное меню', 'main_menu')]
    ]);
    await sendMessage(ctx, message, keyboard);
}

// Функция отправки главного меню
async function sendMainMenu(ctx, userName, userInfo) {
    const greeting = getPersonalizedGreeting(userName, userInfo);
    const message = `${greeting}Выберите действие:`;
    const keyboard = Keyboard.inlineKeyboard([
        [callbackButton('📊 Моя статистика', 'my_stats')],
        [callbackButton('📖 Инструкция', 'show_instruction')],
        [callbackButton('🎮 Развлечения', 'fun')],
        [callbackButton('🧠 Викторина', 'start_quiz')],
        [callbackButton('📅 Ежедневные задания', 'daily_tasks')],
        [callbackButton('💡 Советы по обучению', 'learning_tips')],
        [callbackButton('🆔 Узнать мой ID', 'show_my_id')]
    ]);
    await sendMessage(ctx, message, keyboard);
}

// Функция показа ID пользователя
async function showMyId(ctx, userId, userInfo) {
    // Используем сохраненное имя из userInfo для консистентности
    const displayName = (userInfo.name && 
                        userInfo.name !== 'Пользователь' && 
                        !userInfo.name.includes('Bot') && 
                        !userInfo.name.includes('бот'))
                        ? userInfo.name
                        : 'Пользователь';
    
    const message = `🆔 **Ваш ID**\n\n` +
                   `**ID:** \`${userId}\`\n` +
                   `**Имя:** ${displayName}\n\n` +
                   `💡 Этот ID уникален для вас и используется для сохранения вашей статистики и достижений.`;
    
    const keyboard = Keyboard.inlineKeyboard([
        [callbackButton('🔄 Обновить', 'show_my_id')],
        [callbackButton('🏠 Главное меню', 'main_menu')]
    ]);
    
    await sendMessage(ctx, message, keyboard);
}

// Обработчик обычных текстовых сообщений
bot.on('message', async (ctx) => {
    const text = ctx.message?.text || ctx.message?.body || ctx.message?.body?.text || '';
    const { userId, userName, userInfo } = getUserInfo(ctx);
    
    if (!checkTextCooldown(userId)) {
        return;
    }
    
    if (!text || text.trim().length === 0) {
        return;
    }
    
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('привет') || lowerText.includes('hello') || lowerText.includes('start')) {
        await sendMainMenu(ctx, userName, userInfo);
    } else if (lowerText.includes('статистика') || lowerText.includes('стата') || lowerText.includes('stats')) {
        await showUserStats(ctx, userInfo, userName);
    } else if (lowerText.includes('викторина') || lowerText.includes('квиз') || lowerText.includes('quiz')) {
        await startQuiz(ctx, userInfo, userId);
    } else if (lowerText.includes('задания') || lowerText.includes('tasks')) {
        await showDailyTasks(ctx, userInfo);
    } else if (lowerText.includes('совет') || lowerText.includes('tip')) {
        await showLearningTips(ctx);
    } else if (lowerText.includes('инструкция') || lowerText.includes('помощь') || lowerText.includes('help')) {
        const backKeyboard = Keyboard.inlineKeyboard([
            [callbackButton('🏠 Главное меню', 'main_menu')]
        ]);
        await sendMessage(ctx, INSTRUCTION_TEXT, backKeyboard);
    } else if (lowerText.includes('меню') || lowerText.includes('menu')) {
        await sendMainMenu(ctx, userName, userInfo);
    } else {
        const message = `Не понял ваше сообщение, ${userName}. Используйте кнопки меню или команду /start`;
        await sendMessage(ctx, message, Keyboard.inlineKeyboard([
            [callbackButton('🏠 Главное меню', 'main_menu')]
        ]));
    }
});

// Обработка ошибок
bot.on('error', (error) => {
    console.error('❌ Ошибка бота:', error);
});

bot.catch((error, ctx) => {
    console.error('❌ Необработанная ошибка:', error);
    if (ctx && ctx.reply) {
        ctx.reply('Произошла ошибка. Попробуйте позже или используйте /start').catch(() => {});
    }
});

// Запуск бота
console.log('🚀 Запуск MAX бота...');
bot.start()
    .then(() => {
        console.log('✅ Бот успешно запущен и готов к работе!');
        console.log('📝 Поддержка Markdown: включена');
        console.log('🎮 Функции: статистика, викторины, ежедневные задания, советы');
        console.log('⚡ Персонализация: включена');
        console.log('🏆 Геймификация: система уровней и достижений');
    })
    .catch((error) => {
        console.error('❌ Критическая ошибка запуска:', error);
        process.exit(1);
    });
