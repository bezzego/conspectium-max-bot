(() => {
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
            titleEl.textContent = quiz.title || 'Без названия';
            if (descriptionEl) {
                descriptionEl.textContent = quiz.description || '';
            }

            renderQuestions(quiz.questions || []);

            submitBtn.addEventListener('click', async () => {
                await submitQuiz(app, quizId, quiz.questions || []);
            });
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
            if (event.target.closest('.answer-option') || event.target.closest('.close-expanded') || event.target.closest('.nav-arrow')) {
                return;
            }

            if (question.classList.contains('expanded')) {
                // Закрытие вопроса
                question.classList.remove('expanded');
                expanded = null;
                document.body.style.overflow = ''; // Возвращаем скролл
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
            document.body.style.overflow = 'hidden'; // Блокируем скролл body

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

   async function submitQuiz(app, quizId, questions) {
    const answers = [];
    const missing = [];

    questions.forEach((question) => {
        const checked = document.querySelector(`input[name="question-${question.id}"]:checked`);
        if (checked) {
            answers.push(Number(checked.value));
        } else {
            missing.push(question.id);
        }
    });

    if (!answers.length) {
        app.notify('Выбери ответы к вопросам', 'info');
        return;
    }

    try {
        app.showLoading('Считаем результат...');
        
        // Имитируем задержку в 4 секунды перед показом результата
        const [result] = await Promise.all([
            app.authFetch(`/quizzes/${quizId}/results`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answers }),
            }),
            new Promise(resolve => setTimeout(resolve, 4000)) // Задержка 4 секунды
        ]);
        
        app.hideLoading();

        // Скрываем кнопку "Завершить тест"
        const submitBtn = document.getElementById('submitQuizBtn');
        if (submitBtn) {
            submitBtn.style.display = 'none';
        }

        // Показываем блок с результатами
        const resultEl = document.getElementById('quizResult');
        if (resultEl) {
            const score = result.score ?? 0;
            const totalQuestions = result.total_questions ?? questions.length;
            const correctAnswers = Math.round((score / 100) * totalQuestions);
            
            resultEl.innerHTML = `
                <i class="fas fa-chart-bar"></i>
                Результат: ${correctAnswers}/${totalQuestions} (${score}%)
            `;
            resultEl.classList.add('show');
            resultEl.classList.remove('hidden');
        }

        displayAnswerFeedback(questions);

        // Показываем уведомление о результате
        app.notify(`Тест завершен! Результат: ${result.score ?? 0}%`, 'success');

    } catch (err) {
        console.error(err);
        app.hideLoading();
        app.notify(err.message || 'Не удалось сохранить результат', 'error');
    }
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

            if (selectedAnswerId !== null && correctAnswer && selectedAnswerId !== correctAnswer.id) {
                const selectedOption = item.querySelector(`.answer-option[data-answer-id="${selectedAnswerId}"]`);
                if (selectedOption) {
                    selectedOption.classList.add('answer-option--wrong');
                }
            }

            const feedback = item.querySelector('.answer-feedback');
            if (feedback && correctAnswer) {
                const isCorrect = selectedAnswerId !== null && !!correctAnswer && selectedAnswerId === correctAnswer.id;
                const labelText = isCorrect ? 'Отлично! Правильный ответ:' : 'Правильный ответ:';
                feedback.innerHTML = `<span class="answer-feedback__label">${labelText}</span> <span class="answer-feedback__text">${escapeHtml(correctAnswer.text)}</span>`;
                feedback.classList.remove('answer-feedback--success', 'answer-feedback--error');
                feedback.classList.add('answer-feedback--visible');
                feedback.classList.add(isCorrect ? 'answer-feedback--success' : 'answer-feedback--error');
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