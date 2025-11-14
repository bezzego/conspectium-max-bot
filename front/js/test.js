(() => {
    const quizState = {
        id: null,
        questions: [],
        results: [],
    };
    
    let expanded = null;
    let closeBtn = null;
    let prevBtn = null;
    let nextBtn = null;
    let leaderboardRefreshInterval = null;

    // Очистка интервалов при уходе со страницы
    window.addEventListener('beforeunload', () => {
        if (leaderboardRefreshInterval) {
            clearInterval(leaderboardRefreshInterval);
            leaderboardRefreshInterval = null;
        }
    });

    document.addEventListener('DOMContentLoaded', async () => {
        if (!document.body.classList.contains('page-test')) {
            return;
        }

        const app = window.ConspectiumApp;
        if (!app) return;

        const params = new URLSearchParams(window.location.search);
        const shareToken = params.get('shareToken');
        
        // Если это общий тест (через share_token), загружаем его без авторизации
        if (shareToken) {
            try {
                await loadSharedQuiz(app, shareToken);
                // Создаем элементы навигации после загрузки DOM
                createNavigationElements();
            } catch (err) {
                console.error('Ошибка загрузки общего теста:', err);
                const errorMessage = err.message || 'Не удалось загрузить тест. Попробуй создать новый.';
                showEmptyState(errorMessage);
            }
            return;
        }

        // Для обычных тестов требуется авторизация
        try {
            await app.ready();
        } catch (err) {
            console.error(err);
            app.notify('Не удалось авторизоваться', 'error');
            return;
        }

        let quizId = params.get('quizId');
        const lobbyId = params.get('lobbyId');

        if (!quizId) {
            const list = await fetchLatestQuiz(app);
            if (list) {
                quizId = String(list);
                window.history.replaceState({}, '', `${window.location.pathname}?quizId=${quizId}`);
            } else {
                showEmptyState('Тесты ещё не созданы. Сформируй тест из раздела "Создать тест".');
                return;
            }
        }

        await loadQuiz(app, quizId, lobbyId);
        
        // Создаем элементы навигации после загрузки DOM
        createNavigationElements();
    });

    async function fetchLatestQuiz(app) {
        try {
            const data = await app.authFetch('/quizzes');
            if (data.items?.length) {
                return data.items[0].id;
            }
        } catch (err) {
            console.error(err);
        }
        return null;
    }

    async function loadSharedQuiz(app, shareToken) {
        const questionsContainer = document.getElementById('quizQuestions');
        const titleEl = document.getElementById('quizTitle');
        const descriptionEl = document.getElementById('quizDescription');
        const submitBtn = document.getElementById('submitQuizBtn');

        if (!questionsContainer || !titleEl || !submitBtn) {
            return;
        }

        questionsContainer.innerHTML = '<p class="loading-state">Загружаем тест…</p>';

        try {
            // Используем публичный endpoint для общего теста (не требует авторизации)
            const quiz = await app.getSharedQuiz(shareToken);
            quizState.id = quiz.id;
            quizState.questions = Array.isArray(quiz.questions) ? quiz.questions : [];
            quizState.results = Array.isArray(quiz.results) ? quiz.results : [];

            titleEl.textContent = quiz.title || 'Без названия';
            if (descriptionEl) {
                descriptionEl.textContent = quiz.description || '';
            }

            renderQuestions(quizState.questions);
            renderHistory(quizState.results);
            renderLatestResultPanel();

            // Для общего теста кнопка отправки требует авторизации
            if (submitBtn) {
                submitBtn.style.display = '';
                submitBtn.onclick = async () => {
                    // Проверяем авторизацию перед отправкой
                    try {
                        await app.ready();
                        await submitQuiz(app, quiz.id);
                    } catch (err) {
                        console.error('Ошибка авторизации:', err);
                        if (app.notify) {
                            app.notify('Для отправки результатов необходимо войти в аккаунт', 'error');
                        } else {
                            alert('Для отправки результатов необходимо войти в аккаунт');
                        }
                    }
                };
            }
        } catch (err) {
            console.error('Ошибка загрузки общего теста:', err);
            // Извлекаем понятное сообщение об ошибке
            let errorMessage = 'Не удалось загрузить тест. Попробуй создать новый.';
            if (err.message) {
                // Если сообщение уже понятное (не JSON), используем его
                if (!err.message.trim().startsWith('{')) {
                    errorMessage = err.message;
                } else {
                    // Если это JSON, пытаемся извлечь detail
                    try {
                        const parsed = JSON.parse(err.message);
                        errorMessage = parsed.detail || parsed.message || errorMessage;
                    } catch (e) {
                        errorMessage = err.message;
                    }
                }
            }
            showEmptyState(errorMessage);
        }
    }

    async function loadQuiz(app, quizId, lobbyId = null) {
        const questionsContainer = document.getElementById('quizQuestions');
        const titleEl = document.getElementById('quizTitle');
        const descriptionEl = document.getElementById('quizDescription');
        const submitBtn = document.getElementById('submitQuizBtn');

        if (!questionsContainer || !titleEl || !submitBtn) {
            return;
        }

        questionsContainer.innerHTML = '<p class="loading-state">Загружаем тест…</p>';

        try {
            // Если это турнирный тест, используем специальный endpoint
            let quiz;
            if (lobbyId) {
                try {
                    quiz = await app.authFetch(`/quizzes/tournament/${quizId}?lobby_id=${lobbyId}`);
                } catch (err) {
                    console.error('Failed to load tournament quiz:', err);
                    // Если не удалось загрузить через турнирный endpoint, пробуем обычный
                    quiz = await app.authFetch(`/quizzes/${quizId}`);
                }
            } else {
                quiz = await app.authFetch(`/quizzes/${quizId}`);
            }
            quizState.id = quiz.id;
            quizState.questions = Array.isArray(quiz.questions) ? quiz.questions : [];
            quizState.results = Array.isArray(quiz.results) ? quiz.results : [];

            titleEl.textContent = quiz.title || 'Без названия';
            if (descriptionEl) {
                descriptionEl.textContent = quiz.description || '';
            }

            renderQuestions(quizState.questions);
            
            // Скрываем историю прохождений для турнирных тестов
            const historySection = document.querySelector('.quiz-history');
            if (lobbyId && historySection) {
                historySection.style.display = 'none';
            } else {
                renderHistory(quizState.results);
                renderLatestResultPanel();
            }

            if (submitBtn) {
                submitBtn.style.display = '';
                submitBtn.onclick = async () => {
                    await submitQuiz(app, quizId, lobbyId);
                };
            }
        } catch (err) {
            console.error('Ошибка загрузки теста:', err);
            // Извлекаем понятное сообщение об ошибке
            let errorMessage = 'Не удалось загрузить тест. Попробуй создать новый.';
            if (err.message) {
                // Если сообщение уже понятное (не JSON), используем его
                if (!err.message.trim().startsWith('{')) {
                    errorMessage = err.message;
                } else {
                    // Если это JSON, пытаемся извлечь detail
                    try {
                        const parsed = JSON.parse(err.message);
                        errorMessage = parsed.detail || parsed.message || errorMessage;
                    } catch (e) {
                        errorMessage = err.message;
                    }
                }
            }
            showEmptyState(errorMessage);
        }
    }

function renderQuestions(questions) {
    const container = document.getElementById('quizQuestions');
    if (!container) return;

    container.innerHTML = '';
    if (!questions.length) {
        container.innerHTML = '<p class="empty-state">В этом тесте пока нет вопросов.</p>';
        return;
    }

    questions.forEach((question, index) => {
        const questionItem = document.createElement('div');
        questionItem.className = 'question-item';
        questionItem.dataset.question = String(question.id);

        const questionText = document.createElement('div');
        questionText.className = 'question-text';
        questionText.textContent = `${index + 1}. ${question.title}`;

        const answersContainer = document.createElement('div');
        answersContainer.className = 'answers-container';

        (question.answers || []).forEach((answer) => {
            const label = document.createElement('label');
            label.className = 'answer-option';
            label.dataset.answerId = String(answer.id);
            label.dataset.questionId = String(question.id);
            label.dataset.correct = answer.is_correct ? 'true' : 'false';

            const input = document.createElement('input');
            input.type = 'radio';
            input.name = `question-${question.id}`;
            input.value = String(answer.id);

            const checkmark = document.createElement('span');
            checkmark.className = 'checkmark';

            const text = document.createElement('span');
            text.className = 'answer-text';
            text.textContent = answer.text;

            label.appendChild(input);
            label.appendChild(checkmark);
            label.appendChild(text);
            answersContainer.appendChild(label);
        });

        // Создаем контейнер для контента
        const questionContent = document.createElement('div');
        questionContent.className = 'question-content';
        
        // Добавляем элементы в контент
        questionContent.appendChild(questionText);
        questionContent.appendChild(answersContainer);
        
        // Создаем блок обратной связи
        const feedback = document.createElement('div');
        feedback.className = 'answer-feedback';
        questionContent.appendChild(feedback);

        // Добавляем контент в вопрос
        questionItem.appendChild(questionContent);
        container.appendChild(questionItem);
    });

    setupQuestionInteractions();
}

function createNavigationElements() {
    // Удаляем старые стрелки если они есть
    const oldArrows = document.querySelectorAll('.nav-arrow');
    oldArrows.forEach(arrow => arrow.remove());

    // Создаем стрелки навигации
    prevBtn = document.createElement('button');
    prevBtn.className = 'nav-arrow prev';
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevBtn.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        navigateQuestions(-1); 
    });

    nextBtn = document.createElement('button');
    nextBtn.className = 'nav-arrow next';
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        navigateQuestions(1); 
    });

    // Добавляем стрелки в контейнер preview
    const previewContainer = document.querySelector('.preview');
    if (previewContainer) {
        previewContainer.appendChild(prevBtn);
        previewContainer.appendChild(nextBtn);
    } else {
        // Fallback - добавляем в body
        document.body.appendChild(prevBtn);
        document.body.appendChild(nextBtn);
    }
}

    function setupQuestionInteractions() {
        document.querySelectorAll('.question-item').forEach((question) => {
            question.addEventListener('click', (event) => {
                // Игнорируем клики по ответам, крестикам и стрелкам
                if (event.target.closest('.answer-option') || 
                    event.target.closest('.nav-arrow') || 
                    event.target.closest('.question-text__close')) {
                    return;
                }

                if (question.classList.contains('expanded')) {
                    closeExpandedQuestion();
                    return;
                }

                openExpandedQuestion(question);
            });
        });

        // Закрытие по ESC
        document.addEventListener('keydown', handleKeyDown);
    }

function openExpandedQuestion(question) {
    // Закрываем предыдущий открытый вопрос
    if (expanded && expanded !== question) {
        closeExpandedQuestion();
    }

    // Открываем новый вопрос
    question.classList.add('expanded');
    expanded = question;
    document.body.classList.add('question-expanded');
    document.body.classList.add('history-hidden');

    // Добавляем крестик
    addCloseButtonToQuestion(question);

    // Для мобильных - принудительная перерисовка
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        setTimeout(() => {
            forceMobileRepaint(question);
            forceQuestionAnimation(question);
        }, 100);
    } else {
        forceQuestionAnimation(question);
    }

    hideSubmitButton();
    showNavigation();
    window.scrollTo(0, 0);
    
}

function closeExpandedQuestion() {
    if (expanded) {
        // Удаляем крестик
        const closeBtn = expanded.querySelector('.question-text__close');
        if (closeBtn) {
            closeBtn.remove();
        }
        
        expanded.classList.remove('expanded');
        expanded = null;
        document.body.classList.remove('question-expanded');
        document.body.classList.remove('history-hidden'); // Убираем класс для показа истории
        
        // Восстанавливаем нормальную высоту preview
        const preview = document.querySelector('.preview');
        if (preview) {
            preview.style.minHeight = '';
        }
        
        // ВАЖНО: Восстанавливаем кнопку завершения теста
        showSubmitButton();
        
        hideNavigation();
    }
}

function hideSubmitButton() {
    const submitBtn = document.getElementById('submitQuizBtn');
    if (submitBtn) {
        submitBtn.style.display = 'none';
        submitBtn.style.opacity = '0';
        submitBtn.style.visibility = 'hidden';
    }
}

function showSubmitButton() {
    const submitBtn = document.getElementById('submitQuizBtn');
    if (submitBtn) {
        submitBtn.style.display = 'flex';
        submitBtn.style.opacity = '1';
        submitBtn.style.visibility = 'visible';
        submitBtn.style.position = 'relative'; // Возвращаем нормальное позиционирование
        submitBtn.style.bottom = 'auto';
        submitBtn.style.left = 'auto';
        submitBtn.style.transform = 'none';
        submitBtn.style.margin = '20px auto'; // Добавляем отступы
        submitBtn.style.maxWidth = '760px';
    }
}

function hideHistory() {
    const historyContainer = document.getElementById('quizHistory');
    const historySection = document.querySelector('.history-section'); // или другой селектор контейнера истории
    
    if (historyContainer) {
        historyContainer.style.display = 'none';
    }
    if (historySection) {
        historySection.style.display = 'none';
    }
    
    // Также скрываем панель с последним результатом если она есть
    const latestResult = document.getElementById('quizResult');
    if (latestResult) {
        latestResult.style.display = 'none';
    }
}

function showHistory() {
    const historyContainer = document.getElementById('quizHistory');
    const historySection = document.querySelector('.history-section'); // или другой селектор контейнера истории
    
    if (historyContainer) {
        historyContainer.style.display = 'block';
    }
    if (historySection) {
        historySection.style.display = 'block';
    }
    
    // Показываем панель с последним результатом если она есть
    const latestResult = document.getElementById('quizResult');
    if (latestResult) {
        latestResult.style.display = 'block';
    }
}

function navigateQuestions(delta) {
    if (!expanded) return;
    
    const items = Array.from(document.querySelectorAll('.question-item'));
    const currentIndex = items.indexOf(expanded);
    if (currentIndex === -1) return;
    
    const targetIndex = currentIndex + delta;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    // Закрываем текущий вопрос
    expanded.classList.remove('expanded');
    
    // Сбрасываем стили текущего вопроса
    expanded.style.transform = '';
    expanded.style.webkitTransform = '';
    
    // Открываем новый вопрос
    const targetQuestion = items[targetIndex];
    targetQuestion.classList.add('expanded');
    expanded = targetQuestion;

    // Добавляем крестик к новому вопросу
    addCloseButtonToQuestion(targetQuestion);

    // Принудительно запускаем анимацию с задержкой для мобильных
    setTimeout(() => {
        forceQuestionAnimation(targetQuestion);
    }, 50);

    // Обновляем навигацию
    showNavigation();
    
    // Дополнительная перерисовка для мобильных
    setTimeout(() => {
        void targetQuestion.offsetWidth;
    }, 100);
}

// Функция для принудительной перерисовки на мобильных устройствах
function forceMobileRepaint(element) {
    if (!element) return;
    
    // Несколько методов для гарантированной перерисовки
    element.style.display = 'none';
    element.offsetHeight; // reflow
    element.style.display = '';
    
    // Дополнительные методы для Webkit
    element.style.webkitTransform = 'translateZ(0)';
    element.style.transform = 'translateZ(0)';
    
    // Принудительный reflow
    void element.offsetWidth;
}

function forceQuestionAnimation(question) {
    // Принудительно активируем GPU-ускорение для всего вопроса
    question.style.transform = 'translateZ(0)';
    question.style.webkitTransform = 'translateZ(0)';
    
    // Принудительно перезапускаем анимацию для контента
    const questionContent = question.querySelector('.question-content');
    if (questionContent) {
        questionContent.style.willChange = 'transform, opacity';
        questionContent.style.transform = 'translateZ(0)';
        questionContent.style.webkitTransform = 'translateZ(0)';
        
        // Сбрасываем и перезапускаем анимацию
        questionContent.style.animation = 'none';
        void questionContent.offsetWidth; // Принудительный reflow
        questionContent.style.animation = 'slideInContent 0.5s ease-out 0.1s both';
    }
    
    // Принудительно показываем контейнер ответов
    const answersContainer = question.querySelector('.answers-container');
    if (answersContainer) {
        answersContainer.style.willChange = 'transform, opacity';
        answersContainer.style.transform = 'translateZ(0) translateY(0) scale(1)';
        answersContainer.style.webkitTransform = 'translateZ(0) translateY(0) scale(1)';
        answersContainer.style.opacity = '1';
        
        // Принудительный reflow для контейнера ответов
        void answersContainer.offsetWidth;
    }
    
    // Принудительно показываем варианты ответов
    const answerOptions = question.querySelectorAll('.answer-option');
    answerOptions.forEach((option, index) => {
        option.style.willChange = 'transform, opacity';
        option.style.transform = 'translateZ(0) translateX(0)';
        option.style.webkitTransform = 'translateZ(0) translateX(0)';
        option.style.opacity = '1';
        
        // Принудительный reflow для каждого варианта
        void option.offsetWidth;
    });
    
    // Дополнительная перерисовка через requestAnimationFrame
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            // Принудительно обновляем стили еще раз
            if (questionContent) {
                questionContent.style.opacity = '1';
            }
            if (answersContainer) {
                answersContainer.style.opacity = '1';
            }
            answerOptions.forEach(option => {
                option.style.opacity = '1';
            });
        });
    });
}

    function addCloseButtonToQuestion(question) {
    const questionText = question.querySelector('.question-text');
    if (questionText && !questionText.querySelector('.question-text__close')) {
        const closeBtn = document.createElement('div');
        closeBtn.className = 'question-text__close';
        closeBtn.innerHTML = '✕';
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeExpandedQuestion();
        });
        questionText.appendChild(closeBtn);
    }
}

  function showNavigation() {
    if (!expanded) return;

    const items = Array.from(document.querySelectorAll('.question-item'));
    const currentIndex = items.indexOf(expanded);
    
    // Показываем стрелки
    prevBtn.style.opacity = '1';
    prevBtn.style.visibility = 'visible';
    nextBtn.style.opacity = '1';
    nextBtn.style.visibility = 'visible';
    
    // В полноэкранном режиме позиционируем стрелки фиксированно
    if (expanded.classList.contains('expanded')) {
        prevBtn.style.position = 'fixed';
        prevBtn.style.bottom = '20px';
        prevBtn.style.left = '20px';
        nextBtn.style.position = 'fixed';
        nextBtn.style.bottom = '20px';
        nextBtn.style.right = '20px';
    } else {
        prevBtn.style.position = 'absolute';
        prevBtn.style.bottom = '20px';
        prevBtn.style.left = '20px';
        nextBtn.style.position = 'absolute';
        nextBtn.style.bottom = '20px';
        nextBtn.style.right = '20px';
    }
    
    // Скрываем левую стрелку на первом вопросе
    if (currentIndex === 0) {
        prevBtn.style.opacity = '0';
        prevBtn.style.visibility = 'hidden';
    }
    
    // Скрываем правую стрелку на последнем вопросе
    if (currentIndex === items.length - 1) {
        nextBtn.style.opacity = '0';
        nextBtn.style.visibility = 'hidden';
    }
}

    function hideNavigation() {
        if (prevBtn) {
            prevBtn.style.opacity = '0';
            prevBtn.style.visibility = 'hidden';
            // Возвращаем обычное позиционирование когда не в полноэкранном режиме
            prevBtn.style.position = 'absolute';
            prevBtn.style.bottom = '20px';
            prevBtn.style.left = '20px';
        }
        if (nextBtn) {
            nextBtn.style.opacity = '0';
            nextBtn.style.visibility = 'hidden';
            nextBtn.style.position = 'absolute';
            nextBtn.style.bottom = '20px';
            nextBtn.style.right = '20px';
        }
    }

    function handleKeyDown(e) {
        if (!expanded) return;
        
        switch(e.key) {
            case 'Escape':
                closeExpandedQuestion();
                break;
            case 'ArrowLeft':
                if (!prevBtn.classList.contains('hidden')) {
                    navigateQuestions(-1);
                }
                break;
            case 'ArrowRight':
                if (!nextBtn.classList.contains('hidden')) {
                    navigateQuestions(1);
                }
                break;
        }
    }

   async function submitQuiz(app, quizId, lobbyId = null) {
    const questions = quizState.questions;
    if (!questions.length) {
        app.notify('В этом тесте пока нет вопросов', 'info');
        return;
    }

    const answers = [];

    questions.forEach((question) => {
        const checked = document.querySelector(`input[name="question-${question.id}"]:checked`);
        if (checked) {
            answers.push(Number(checked.value));
        }
    });

    if (!answers.length) {
        app.notify('Выбери ответы к вопросам', 'info');
        return;
    }

    // Блокируем скролл
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    try {
        // Показываем красивый лоадер
        showQuizResultsLoader();
        
        // Формируем payload для отправки результатов
        const payload = { answers };
        if (lobbyId) {
            payload.lobby_id = parseInt(lobbyId);
        }
        
        const [result] = await Promise.all([
            app.authFetch(`/quizzes/${quizId}/results`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }),
            new Promise((resolve) => setTimeout(resolve, 4000)),
        ]);

        // Скрываем лоадер
        hideQuizResultsLoader();

        const submitBtn = document.getElementById('submitQuizBtn');
        if (submitBtn) {
            submitBtn.style.display = 'none';
        }

        // Если это турнирный тест, показываем турнирную таблицу вместо обычного результата
        if (lobbyId) {
            // Скрываем обычный результат
            const resultEl = document.getElementById('quizResult');
            if (resultEl) {
                resultEl.classList.add('hidden');
            }
            
            // Загружаем и показываем турнирную таблицу
            await showTournamentLeaderboard(app, parseInt(lobbyId));
        } else {
            // Обычный тест - показываем результат как обычно
            quizState.results = [
                result,
                ...quizState.results.filter((item) => item.id !== result.id),
            ].slice(0, 20);

            renderLatestResultPanel();
            renderHistory(quizState.results);
            displayAnswerFeedback(questions);

            const scoreValue = typeof result.score === 'number' ? Math.round(result.score) : 0;
            app.notify(`Тест завершён! Результат: ${scoreValue}%`, 'success');
        }
    } catch (err) {
        console.error(err);
        hideQuizResultsLoader();
        app.notify(err.message || 'Не удалось сохранить результат', 'error');
    } finally {
        // Разблокируем скролл
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
    }
}

function showQuizResultsLoader() {
    const loaderHtml = `
        <div class="quiz-results-loader-overlay">
            <div class="quiz-results-loader">
                <div class="loader-circle">
                    <div class="spinner"></div>
                    <div class="pulse"></div>
                </div>
                <div class="loader-content">
                    <h3>Считаем результат...</h3>
                    <p>Анализируем твои ответы</p>
                </div>
                <div class="liquid-reflection"></div>
            </div>
        </div>
        <style>
            .quiz-results-loader-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(20px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                opacity: 0;
                animation: fadeIn 0.3s ease forwards;
            }

            @keyframes fadeIn {
                to { opacity: 1; }
            }

            .quiz-results-loader {
                background: linear-gradient(
                    135deg,
                    rgba(255, 255, 255, 0.15) 0%,
                    rgba(255, 255, 255, 0.08) 50%,
                    rgba(255, 255, 255, 0.15) 100%
                );
                backdrop-filter: blur(25px);
                -webkit-backdrop-filter: blur(25px);
                border-radius: 24px;
                border: 1px solid rgba(255, 255, 255, 0.18);
                padding: 40px 30px;
                text-align: center;
                color: white;
                max-width: 320px;
                width: 90%;
                position: relative;
                overflow: hidden;
                box-shadow: 
                    0 20px 60px rgba(0, 0, 0, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2),
                    inset 0 -1px 0 rgba(0, 0, 0, 0.1);
            }

            .quiz-results-loader::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(
                    135deg,
                    transparent 0%,
                    rgba(255, 255, 255, 0.1) 50%,
                    transparent 100%
                );
                border-radius: 24px;
                opacity: 0.6;
            }

            .loader-circle {
                position: relative;
                width: 80px;
                height: 80px;
                margin: 0 auto 20px;
            }

            .spinner {
                width: 100%;
                height: 100%;
                border: 3px solid rgba(255, 255, 255, 0.1);
                border-top: 3px solid #f5d86e;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                position: absolute;
                top: 0;
                left: 0;
            }

            .pulse {
                width: 60px;
                height: 60px;
                background: rgba(245, 216, 110, 0.2);
                border-radius: 50%;
                position: absolute;
                top: 10px;
                left: 10px;
                animation: pulse 2s ease-in-out infinite;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            @keyframes pulse {
                0%, 100% { 
                    transform: scale(1);
                    opacity: 0.5;
                }
                50% { 
                    transform: scale(1.1);
                    opacity: 0.8;
                }
            }

            .loader-content h3 {
                margin: 0 0 8px 0;
                font-size: 20px;
                font-weight: 700;
                text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
            }

            .loader-content p {
                margin: 0;
                color: rgba(255, 255, 255, 0.8);
                font-size: 15px;
                text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
            }

            .liquid-reflection {
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: linear-gradient(
                    45deg,
                    transparent 30%,
                    rgba(255, 255, 255, 0.05) 50%,
                    transparent 70%
                );
                animation: reflectionMove 3s linear infinite;
                pointer-events: none;
            }

            @keyframes reflectionMove {
                0% { transform: translateX(-100%) translateY(-100%) rotate(0deg); }
                100% { transform: translateX(100%) translateY(100%) rotate(360deg); }
            }
        </style>
    `;

    const loaderContainer = document.createElement('div');
    loaderContainer.innerHTML = loaderHtml;
    document.body.appendChild(loaderContainer);
    
    window.quizResultsLoader = loaderContainer;
}

function hideQuizResultsLoader() {
    if (window.quizResultsLoader) {
        window.quizResultsLoader.remove();
        window.quizResultsLoader = null;
    }
}

    function renderLatestResultPanel() {
        const resultEl = document.getElementById('quizResult');
        if (!resultEl) return;

        const latest = quizState.results[0];
        if (!latest) {
            resultEl.classList.add('hidden');
            resultEl.classList.remove('show');
            resultEl.innerHTML = '';
            return;
        }

        const stats = calculateResultStats(latest);
        let summaryText = '—';
        if (stats.correct !== null && stats.total !== null) {
            summaryText = `${stats.correct}/${stats.total}`;
            if (stats.score !== null) {
                summaryText += ` (${stats.score}%)`;
            }
        } else if (stats.score !== null) {
            summaryText = `${stats.score}%`;
        }

        const formattedDate = latest.created_at ? formatDateTime(latest.created_at) : '';
        resultEl.innerHTML = `
            <i class="fas fa-chart-bar"></i>
            Последний результат: <br> ${summaryText}${formattedDate ? `<span class="result-date"> <br> ${formattedDate}</span>` : ''}
        `;
        resultEl.classList.add('show');
        resultEl.classList.remove('hidden');
    }

    function renderHistory(results) {
        const container = document.getElementById('quizHistory');
        if (!container) return;

        if (!results.length) {
            container.innerHTML = '<p class="history-empty">Пока нет сохранённых попыток. Пройди тест, чтобы увидеть прогресс.</p>';
            return;
        }

        container.innerHTML = '';
        results.forEach((result, index) => {
            container.appendChild(createHistoryItem(result, index, results.length));
        });
    }

   function createHistoryItem(result, index, total) {
    const item = document.createElement('div');
    item.className = 'history-item';
    if (index === 0) {
        item.classList.add('history-item--latest');
    }

    // ЖЕЛТЫЙ КРУЖОК С НОМЕРОМ
    const badge = document.createElement('span');
    badge.className = 'history-index';
    const attemptNumber = total - index;
    badge.textContent = `#${attemptNumber}`;

    const body = document.createElement('div');
    body.className = 'history-content';

    const stats = calculateResultStats(result);

    const scoreLine = document.createElement('div');
    scoreLine.className = 'history-score';
    const scoreParts = [];
    if (stats.score !== null) {
        scoreParts.push(`${stats.score}%`);
    }
    if (stats.correct !== null && stats.total !== null) {
        scoreParts.push(`${stats.correct}/${stats.total} правильных`);
    }
    scoreLine.textContent = scoreParts.join(' • ') || '—';

    const timeLine = document.createElement('div');
    timeLine.className = 'history-time';
    timeLine.textContent = result.created_at ? formatDateTime(result.created_at) : '';

    body.appendChild(scoreLine);
    body.appendChild(timeLine);

    item.appendChild(badge);
    item.appendChild(body);
    return item;
}

    function calculateResultStats(result) {
        const score = typeof result.score === 'number' ? Math.round(result.score) : null;
        const total = typeof result.total_questions === 'number'
            ? result.total_questions
            : (quizState.questions.length || null);
        const correct = score !== null && total ? Math.round((score / 100) * total) : null;
        return { score, total, correct };
    }

function formatDateTime(value) {
    let date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    
    return date.toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function displayAnswerFeedback(questions) {
        questions.forEach((question) => {
            const item = document.querySelector(`.question-item[data-question="${question.id}"]`);
            if (!item) return;

            const answersContainer = item.querySelector('.answers-container');
            const answers = question.answers || [];
            const selected = document.querySelector(`input[name="question-${question.id}"]:checked`);
            const selectedAnswerId = selected ? Number(selected.value) : null;
            const correctAnswer = answers.find((answer) => answer.is_correct);

            item.classList.remove('question-item--correct', 'question-item--wrong', 'question-item--skipped');
            const answerOptions = Array.from(item.querySelectorAll('.answer-option'));
            answerOptions.forEach((option) => {
                option.classList.add('answer-option--locked');
                const input = option.querySelector('input[type="radio"]');
                if (input) {
                    input.disabled = true;
                }
                option.classList.remove('answer-option--correct', 'answer-option--wrong', 'answer-option--selected');
                const optionAnswerId = Number(option.dataset.answerId);
                if (optionAnswerId === selectedAnswerId) {
                    option.classList.add('answer-option--selected');
                }
                if (option.dataset.correct === 'true') {
                    option.classList.add('answer-option--correct');
                }
            });

            const isCorrectSelection =
                selectedAnswerId !== null && correctAnswer && selectedAnswerId === correctAnswer.id;

            if (selectedAnswerId !== null && correctAnswer && selectedAnswerId !== correctAnswer.id) {
                const selectedOption = item.querySelector(`.answer-option[data-answer-id="${selectedAnswerId}"]`);
                if (selectedOption) {
                    selectedOption.classList.add('answer-option--wrong');
                }
            }

            if (selectedAnswerId === null) {
                item.classList.add('question-item--skipped');
            } else if (isCorrectSelection) {
                item.classList.add('question-item--correct');
            } else if (correctAnswer) {
                item.classList.add('question-item--wrong');
            }

            const feedback = item.querySelector('.answer-feedback');
            if (feedback && correctAnswer) {
                const labelText = isCorrectSelection ? 'Отлично! Правильный ответ:' : 'Правильный ответ:';
                const checkmarkHtml = '<span class="checkmark"></span>';
                feedback.innerHTML = checkmarkHtml + `<span class="answer-feedback__label">${labelText}</span> <span class="answer-feedback__text">${escapeHtml(correctAnswer.text)}</span>`;
                feedback.classList.remove('answer-feedback--success', 'answer-feedback--error');
                feedback.classList.add('answer-feedback--visible');
                feedback.classList.add(isCorrectSelection ? 'answer-feedback--success' : 'answer-feedback--error');
            }

            // Hide all answer options after feedback is shown
            answerOptions.forEach((option) => {
                option.style.display = 'none';
            });
        });
    }

    async function showTournamentLeaderboard(app, lobbyId) {
        // Останавливаем предыдущее обновление, если есть
        if (leaderboardRefreshInterval) {
            clearInterval(leaderboardRefreshInterval);
            leaderboardRefreshInterval = null;
        }
        
        // Скрываем контейнер с вопросами
        const questionsContainer = document.getElementById('quizQuestions');
        if (questionsContainer) {
            questionsContainer.style.display = 'none';
        }
        
        // Создаем или получаем контейнер для турнирной таблицы
        let leaderboardContainer = document.getElementById('tournamentLeaderboard');
        if (!leaderboardContainer) {
            leaderboardContainer = document.createElement('div');
            leaderboardContainer.id = 'tournamentLeaderboard';
            leaderboardContainer.className = 'tournament-leaderboard glass-card';
            
            const main = document.querySelector('main');
            if (main) {
                main.appendChild(leaderboardContainer);
            }
        }
        
        // Функция обновления таблицы
        const updateLeaderboard = async () => {
            try {
                // Загружаем турнирную таблицу
                const leaderboard = await app.authFetch(`/tournament/${lobbyId}/leaderboard`);
                
                // Разделяем участников на завершивших и не завершивших
                const allParticipants = leaderboard.participants || [];
                const finishedParticipants = allParticipants.filter(p => p.finished_at !== null);
                const inProgressParticipants = allParticipants.filter(p => p.finished_at === null);
                
                // Сортируем завершивших по месту (score по убыванию)
                finishedParticipants.sort((a, b) => {
                    // Сначала по score (убывание)
                    if (b.score !== a.score) {
                        return (b.score || 0) - (a.score || 0);
                    }
                    // Если score одинаковый, по времени (возрастание)
                    if (a.time_seconds !== b.time_seconds) {
                        return (a.time_seconds || Infinity) - (b.time_seconds || Infinity);
                    }
                    // Если все одинаково, по дате завершения (возрастание)
                    return new Date(a.finished_at) - new Date(b.finished_at);
                });
                
                // Определяем место каждого завершившего участника
                let currentPlace = 1;
                finishedParticipants.forEach((participant, index) => {
                    if (index > 0) {
                        const prev = finishedParticipants[index - 1];
                        if (prev.score !== participant.score || 
                            prev.time_seconds !== participant.time_seconds) {
                            currentPlace = index + 1;
                        }
                    }
                    participant.place = currentPlace;
                });
                
                const currentUserId = app?.state?.user?.id;
                const totalParticipants = allParticipants.length;
                const finishedCount = finishedParticipants.length;
                const waitingCount = inProgressParticipants.length;
                
                // Формируем HTML таблицы
                let leaderboardHtml = `
                    <div class="leaderboard-header">
                        <div class="leaderboard-header-top">
                            <h2 class="leaderboard-title">🏆 Турнирная таблица</h2>
                            <button class="leaderboard-refresh-btn" id="leaderboardRefreshBtn" title="Обновить таблицу">
                                <i class="fas fa-sync-alt"></i>
                            </button>
                        </div>
                        <div class="leaderboard-stats">
                            <span>Завершили: ${finishedCount}/${totalParticipants}</span>
                        </div>
                    </div>
                    <div class="leaderboard-list">
                `;
                
                // Показываем сообщение "Ждем других игроков" если не все завершили
                if (waitingCount > 0) {
                    leaderboardHtml += `
                        <div class="leaderboard-waiting">
                            <div class="waiting-indicator">
                                <div class="waiting-spinner"></div>
                                <span>⏳ Ждем других игроков (${waitingCount} ${waitingCount === 1 ? 'игрок' : waitingCount < 5 ? 'игрока' : 'игроков'} еще проходят тест)</span>
                            </div>
                        </div>
                    `;
                }
                
                // Показываем завершивших участников
                if (finishedParticipants.length === 0) {
                    leaderboardHtml += `
                        <div class="leaderboard-empty">
                            <p>Пока никто не завершил тест</p>
                        </div>
                    `;
                } else {
                    finishedParticipants.forEach((participant) => {
                        const isCurrentUser = participant.user_id === currentUserId;
                        const medalIcon = participant.place === 1 ? '🥇' : 
                                         participant.place === 2 ? '🥈' : 
                                         participant.place === 3 ? '🥉' : '';
                        const placeText = medalIcon ? `${medalIcon} ${participant.place}` : `${participant.place}`;
                        const score = participant.score !== null ? Math.round(participant.score) : 0;
                        const userName = participant.user_display_name || `Участник ${participant.user_id}`;
                        
                        leaderboardHtml += `
                            <div class="leaderboard-item ${isCurrentUser ? 'leaderboard-item--current' : ''}">
                                <div class="leaderboard-place">${placeText} место</div>
                                <div class="leaderboard-name">${escapeHtml(userName)}</div>
                                <div class="leaderboard-score">${score}%</div>
                            </div>
                        `;
                    });
                }
                
                // Показываем участников, которые еще проходят тест
                if (inProgressParticipants.length > 0) {
                    leaderboardHtml += `
                        <div class="leaderboard-in-progress">
                            <div class="in-progress-header">В процессе:</div>
                    `;
                    inProgressParticipants.forEach((participant) => {
                        const isCurrentUser = participant.user_id === currentUserId;
                        const userName = participant.user_display_name || `Участник ${participant.user_id}`;
                        leaderboardHtml += `
                            <div class="leaderboard-item leaderboard-item--in-progress ${isCurrentUser ? 'leaderboard-item--current' : ''}">
                                <div class="leaderboard-place">⏳</div>
                                <div class="leaderboard-name">${escapeHtml(userName)}</div>
                                <div class="leaderboard-score">—</div>
                            </div>
                        `;
                    });
                    leaderboardHtml += `</div>`;
                }
                
                leaderboardHtml += `
                    </div>
                    <div class="leaderboard-actions">
                        <button class="primary-btn" id="finishTournamentBtn">Завершить</button>
                    </div>
                `;
                
                leaderboardContainer.innerHTML = leaderboardHtml;
                leaderboardContainer.style.display = 'block';
                
                // Обработчик кнопки обновления
                const refreshBtn = document.getElementById('leaderboardRefreshBtn');
                if (refreshBtn) {
                    refreshBtn.onclick = async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Добавляем анимацию вращения
                        refreshBtn.classList.add('refreshing');
                        
                        // Обновляем таблицу
                        await updateLeaderboard();
                        
                        // Убираем анимацию через небольшую задержку
                        setTimeout(() => {
                            refreshBtn.classList.remove('refreshing');
                        }, 500);
                    };
                }
                
                // Обработчик кнопки завершения
                const finishBtn = document.getElementById('finishTournamentBtn');
                if (finishBtn) {
                    finishBtn.onclick = () => {
                        // Останавливаем обновление перед переходом
                        if (leaderboardRefreshInterval) {
                            clearInterval(leaderboardRefreshInterval);
                            leaderboardRefreshInterval = null;
                        }
                        window.location.href = '/front/html/tournament.html';
                    };
                }
                
            } catch (err) {
                console.error('Ошибка загрузки турнирной таблицы:', err);
                // Не показываем ошибку каждый раз, только логируем
                // app.notify(err.message || 'Не удалось загрузить турнирную таблицу', 'error');
            }
        };
        
        // Первое обновление сразу
        await updateLeaderboard();
        
        // Затем периодические обновления каждые 2 секунды
        leaderboardRefreshInterval = setInterval(updateLeaderboard, 2000);
    }
    
    function showEmptyState(message) {
        const empty = document.getElementById('quizEmptyState');
        const container = document.getElementById('quizQuestions');
        const submitBtn = document.getElementById('submitQuizBtn');

        if (empty) {
            empty.classList.remove('hidden');
            empty.textContent = message;
        }
        if (container) {
            container.innerHTML = '';
        }
        if (submitBtn) {
            submitBtn.disabled = true;
        }
    }
})();