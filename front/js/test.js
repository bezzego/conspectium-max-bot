(() => {
    const quizState = {
        id: null,
        questions: [],
        results: [],
    };
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

        // Сначала добавляем все элементы в вопрос
        questionItem.appendChild(questionText);
        questionItem.appendChild(answersContainer);
        const feedback = document.createElement('div');
        feedback.className = 'answer-feedback';
        questionItem.appendChild(feedback);

        container.appendChild(questionItem);
    });

    setupAccordionBehaviour();
}

// И в обработчике закрытия через крестик:
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('question-text__close')) {
        e.stopPropagation();
        if (expanded) {
            expanded.classList.remove('expanded');
            expanded = null;
            document.body.style.overflow = '';
            document.body.classList.remove('question-expanded'); // Убираем класс
            toggleNav(false);
            document.removeEventListener('keydown', handleKeyDown);
        }
    }
});

function setupAccordionBehaviour() {
    let expanded = null;
    
    // Создаем кнопку закрытия и навигационные стрелки
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-expanded';
    closeBtn.innerHTML = '✕';
    closeBtn.addEventListener('click', () => {
        if (expanded) {
            expanded.classList.remove('expanded');
            expanded = null;
            // Снимаем блокировку скролла
            document.body.style.overflow = '';
            // Убираем класс, который говорит CSS спрятать шапку/заголовок
            document.body.classList.remove('question-expanded');
            // Скрываем навигацию
            toggleNav(false);
            // Удаляем обработчик клавиатуры
            document.removeEventListener('keydown', handleKeyDown);
        }
    });

    const prevBtn = document.createElement('button');
    prevBtn.className = 'nav-arrow prev';
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevBtn.addEventListener('click', (e) => { e.stopPropagation(); navigate(-1); });

    const nextBtn = document.createElement('button');
    nextBtn.className = 'nav-arrow next';
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.addEventListener('click', (e) => { e.stopPropagation(); navigate(1); });

    const questionsContainer = document.querySelector('.questions-container');
    if (questionsContainer) {
        questionsContainer.appendChild(closeBtn);
        // append arrows to body so they are outside container scroll
        document.body.appendChild(prevBtn);
        document.body.appendChild(nextBtn);
    }

    // Функция навигации
    function navigate(delta) {
        const items = Array.from(document.querySelectorAll('.question-item'));
        if (!expanded) return;
        const idx = items.indexOf(expanded);
        if (idx === -1) return;
        const targetIndex = idx + delta;
        if (targetIndex < 0 || targetIndex >= items.length) return;

        // switch expanded
        expanded.classList.remove('expanded');
        const target = items[targetIndex];
        target.classList.add('expanded');
        expanded = target;

        // keep body overflow hidden
        document.body.style.overflow = 'hidden';

        // update nav visibility with smooth transitions
        updateNavButtons(targetIndex, items.length);

        // ensure the new expanded question content is visible
        setTimeout(() => { ensureVisible(expanded); }, 120);
    }

    // Функция обновления состояния стрелочек с плавной анимацией
    function updateNavButtons(currentIndex, totalItems) {
        // Плавно скрываем/показываем стрелочки в зависимости от позиции
        if (currentIndex === 0) {
            // Первый вопрос - скрываем левую стрелку
            prevBtn.classList.remove('show');
            prevBtn.classList.add('hidden');
            nextBtn.classList.remove('hidden');
            nextBtn.classList.add('show');
        } else if (currentIndex === totalItems - 1) {
            // Последний вопрос - скрываем правую стрелку
            prevBtn.classList.remove('hidden');
            prevBtn.classList.add('show');
            nextBtn.classList.remove('show');
            nextBtn.classList.add('hidden');
        } else {
            // Средние вопросы - показываем обе стрелочки
            prevBtn.classList.remove('hidden');
            prevBtn.classList.add('show');
            nextBtn.classList.remove('hidden');
            nextBtn.classList.add('show');
        }
    }

    // Функция показа/скрытия навигации
    function toggleNav(show) {
        if (show) {
            // Показываем кнопку закрытия с задержкой
            setTimeout(() => {
                closeBtn.classList.add('show');
            }, 100);
            
            // Обновляем состояние стрелочек
            const items = Array.from(document.querySelectorAll('.question-item'));
            const idx = items.indexOf(expanded);
            if (idx !== -1) {
                updateNavButtons(idx, items.length);
            }
        } else {
            // Плавно скрываем все элементы навигации
            closeBtn.classList.remove('show');
            prevBtn.classList.remove('show');
            prevBtn.classList.add('hidden');
            nextBtn.classList.remove('show');
            nextBtn.classList.add('hidden');
        }
    }

    // Обработчик клавиатуры
    function handleKeyDown(e) {
        if (!expanded) return;
        
        switch(e.key) {
            case 'Escape':
                closeBtn.click();
                break;
            case 'ArrowLeft':
                if (!prevBtn.classList.contains('hidden')) {
                    navigate(-1);
                }
                break;
            case 'ArrowRight':
                if (!nextBtn.classList.contains('hidden')) {
                    navigate(1);
                }
                break;
        }
    }

    document.querySelectorAll('.question-item').forEach((question) => {
        // Создаем контейнер для контента
        const questionContent = document.createElement('div');
        questionContent.className = 'question-content';
        
        // Перемещаем существующий контент в новый контейнер
        while (question.firstChild) {
            questionContent.appendChild(question.firstChild);
        }
        question.appendChild(questionContent);

        question.addEventListener('click', (event) => {
            if (event.target.closest('.answer-option') || event.target.closest('.close-expanded') || event.target.closest('.nav-arrow') || event.target.closest('.question-text__close')) {
                return;
            }

            if (question.classList.contains('expanded')) {
                // Закрытие вопроса
                question.classList.remove('expanded');
                expanded = null;
                document.body.style.overflow = '';
                document.body.classList.remove('question-expanded'); // Убираем класс
                toggleNav(false);
                document.removeEventListener('keydown', handleKeyDown);
                return;
            }

            // Закрываем предыдущий открытый вопрос
            if (expanded && expanded !== question) {
                expanded.classList.remove('expanded');
            }

               // Открываем новый вопрос
            question.classList.add('expanded');
            expanded = question;
            document.body.style.overflow = 'hidden';
            document.body.classList.add('question-expanded'); // Добавляем класс

            // show nav and set visibility depending on position
            const items = Array.from(document.querySelectorAll('.question-item'));
            const idx = items.indexOf(question);
            updateNavButtons(idx, items.length);
            toggleNav(true);

            // Добавляем обработчик клавиатуры
            document.addEventListener('keydown', handleKeyDown);

            // Прокручиваем к верху (на всякий случай)
            window.scrollTo(0, 0);
        });
    });

    // Закрытие по ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && expanded) {
            expanded.classList.remove('expanded');
            expanded = null;
            document.body.style.overflow = '';
            // Убираем признак раскрытого вопроса на body
            document.body.classList.remove('question-expanded');
            // Also hide navigation/arrows when closing with ESC
            toggleNav(false);
            document.removeEventListener('keydown', handleKeyDown);
        }
    });
}

    // Скролл так, чтобы элемент полностью помещался в видимой области
    function ensureVisible(el) {
        if (!el) return;

        const topBar = document.querySelector('.top-bar');
        const primaryBtn = document.querySelector('.primary-btn');

        const topOffset = topBar ? (topBar.getBoundingClientRect().bottom + 8) : 8;
        const bottomPadding = primaryBtn ? (primaryBtn.offsetHeight + 24) : 100;

        // Найдём ближайший скроллируемый предок (например .questions-container) — если он есть,
        // будем скроллить его, иначе fallback на window
        function getScrollParent(node) {
            while (node && node !== document.body) {
                const style = window.getComputedStyle(node);
                const overflowY = style.overflowY;
                if (overflowY === 'auto' || overflowY === 'scroll') return node;
                node = node.parentElement;
            }
            return window;
        }

        const scrollParent = getScrollParent(el.parentElement);

        if (scrollParent === window) {
            const rect = el.getBoundingClientRect();
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

            if (rect.top < topOffset) {
                const target = window.pageYOffset + rect.top - topOffset;
                window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
                return;
            }

            if (rect.bottom > (viewportHeight - bottomPadding)) {
                const delta = rect.bottom - (viewportHeight - bottomPadding);
                window.scrollBy({ top: delta + 12, behavior: 'smooth' });
            }
        } else {
            // Скроллим внутренний контейнер так, чтобы элемент полностью поместился
            const parent = scrollParent;
            const parentRect = parent.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();

            // top/bottom позиции элемента внутри контейнера
            const offsetTop = elRect.top - parentRect.top + parent.scrollTop;
            const offsetBottom = offsetTop + elRect.height;

            const visibleTop = parent.scrollTop;
            const visibleBottom = parent.scrollTop + parent.clientHeight - (primaryBtn && parent.contains(primaryBtn) ? (primaryBtn.offsetHeight + 16) : 0);

            // Если верх элемента выше видимой области контейнера — прокрутить вверх
            if (offsetTop < visibleTop + 8) {
                parent.scrollTo({ top: Math.max(0, offsetTop - 8), behavior: 'smooth' });
                return;
            }

            // Если низ элемента ниже видимой области контейнера — прокрутить вниз
            if (offsetBottom > visibleBottom - 8) {
                const target = offsetBottom - parent.clientHeight + 8;
                parent.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
            }
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
            Результат: ${summaryText}${formattedDate ? `<span class="result-date">${formattedDate}</span>` : ''}
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
            container.appendChild(createHistoryItem(result, index));
        });
    }

    function createHistoryItem(result, index) {
        const item = document.createElement('div');
        item.className = 'history-item';
        if (index === 0) {
            item.classList.add('history-item--latest');
        }

        const badge = document.createElement('span');
        badge.className = 'history-index';
        badge.textContent = `#${index + 1}`;

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
        const date = value instanceof Date ? value : new Date(value);
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
