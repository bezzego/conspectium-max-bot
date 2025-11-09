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

    document.addEventListener('DOMContentLoaded', async () => {
        if (!document.body.classList.contains('page-test')) {
            return;
        }

        const app = window.ConspectiumApp;
        if (!app) return;

        try {
            await app.ready();
        } catch (err) {
            console.error(err);
            app.notify('Не удалось авторизоваться', 'error');
            return;
        }

        const params = new URLSearchParams(window.location.search);
        let quizId = params.get('quizId');

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

        await loadQuiz(app, quizId);
        
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

    async function loadQuiz(app, quizId) {
        const questionsContainer = document.getElementById('quizQuestions');
        const titleEl = document.getElementById('quizTitle');
        const descriptionEl = document.getElementById('quizDescription');
        const submitBtn = document.getElementById('submitQuizBtn');

        if (!questionsContainer || !titleEl || !submitBtn) {
            return;
        }

        questionsContainer.innerHTML = '<p class="loading-state">Загружаем тест…</p>';

        try {
            const quiz = await app.authFetch(`/quizzes/${quizId}`);
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

            if (submitBtn) {
                submitBtn.style.display = '';
                submitBtn.onclick = async () => {
                    await submitQuiz(app, quizId);
                };
            }
        } catch (err) {
            console.error(err);
            showEmptyState('Не удалось загрузить тест. Попробуй создать новый.');
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

        // УБИРАЕМ создание крестика здесь - он будет создаваться только при открытии вопроса

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

    // Принудительно запускаем анимацию
    forceQuestionAnimation(question);

    hideSubmitButton();

    // Показываем навигацию
    showNavigation();

    // Прокручиваем к верху
    window.scrollTo(0, 0);
    
    // Принудительно обновляем высоту preview
    const preview = document.querySelector('.preview');
    if (preview) {
        preview.style.minHeight = 'calc(100vh + 10px)';
    }
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
    
    // Открываем новый вопрос
    const targetQuestion = items[targetIndex];
    targetQuestion.classList.add('expanded');
    expanded = targetQuestion;

    // Добавляем крестик к новому вопросу
    addCloseButtonToQuestion(targetQuestion);

    // Принудительно запускаем анимацию появления
    forceQuestionAnimation(targetQuestion);

    // История остается скрытой (уже скрыта при первом открытии)
    
    // Обновляем навигацию
    showNavigation();
}

function forceQuestionAnimation(question) {
    // Принудительно перезапускаем анимацию
    const questionContent = question.querySelector('.question-content');
    const answersContainer = question.querySelector('.answers-container');
    
    if (questionContent) {
        // Сбрасываем трансформации для перезапуска анимации
        questionContent.style.animation = 'none';
        questionContent.offsetHeight; // Принудительный reflow
        questionContent.style.animation = null;
    }
    
    if (answersContainer) {
        // Сбрасываем стили для контейнера ответов
        answersContainer.style.opacity = '0';
        answersContainer.style.transform = 'translateY(-10px) scale(0.95)';
        
        // Принудительно запускаем анимацию после небольшой задержки
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                answersContainer.style.opacity = '1';
                answersContainer.style.transform = 'translateY(0) scale(1)';
            });
        });
    }
    
    // Также принудительно показываем варианты ответов
    const answerOptions = question.querySelectorAll('.answer-option');
    answerOptions.forEach((option, index) => {
        option.style.opacity = '0';
        option.style.transform = 'translateX(-20px)';
        
        setTimeout(() => {
            option.style.opacity = '1';
            option.style.transform = 'translateX(0)';
        }, 100 + (index * 50)); // Ступенчатая анимация
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

    async function submitQuiz(app, quizId) {
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

        try {
            app.showLoading('Считаем результат...');
            const [result] = await Promise.all([
                app.authFetch(`/quizzes/${quizId}/results`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ answers }),
                }),
                new Promise((resolve) => setTimeout(resolve, 4000)),
            ]);

            app.hideLoading();

            const submitBtn = document.getElementById('submitQuizBtn');
            if (submitBtn) {
                submitBtn.style.display = 'none';
            }

            quizState.results = [
                result,
                ...quizState.results.filter((item) => item.id !== result.id),
            ].slice(0, 20);

            renderLatestResultPanel();
            renderHistory(quizState.results);
            displayAnswerFeedback(questions);

            const scoreValue = typeof result.score === 'number' ? Math.round(result.score) : 0;
            app.notify(`Тест завершён! Результат: ${scoreValue}%`, 'success');
        } catch (err) {
            console.error(err);
            app.hideLoading();
            app.notify(err.message || 'Не удалось сохранить результат', 'error');
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

            const answers = question.answers || [];
            const selectedInput = item.querySelector(`input[name="question-${question.id}"]:checked`);
            const selectedAnswerId = selectedInput ? Number(selectedInput.value) : null;
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
                feedback.innerHTML = `<span class="answer-feedback__label">${labelText}</span> <span class="answer-feedback__text">${escapeHtml(correctAnswer.text)}</span>`;
                feedback.classList.remove('answer-feedback--success', 'answer-feedback--error');
                feedback.classList.add('answer-feedback--visible');
                feedback.classList.add(isCorrectSelection ? 'answer-feedback--success' : 'answer-feedback--error');
            }
        });
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
