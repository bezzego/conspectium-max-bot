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
            questionItem.appendChild(questionText);

            const answersContainer = document.createElement('div');
            answersContainer.className = 'answers-container';

            (question.answers || []).forEach((answer) => {
                const label = document.createElement('label');
                label.className = 'answer-option';

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

            if (question.explanation) {
                const info = document.createElement('div');
                info.className = 'answer-explanation';
                info.textContent = question.explanation;
                answersContainer.appendChild(info);
            }

            questionItem.appendChild(answersContainer);
            container.appendChild(questionItem);
        });

        setupAccordionBehaviour();
    }

    function setupAccordionBehaviour() {
        let expanded = null;
        document.querySelectorAll('.question-item').forEach((question) => {
            question.addEventListener('click', (event) => {
                if (event.target.closest('.answer-option')) {
                    return;
                }

                if (question.classList.contains('expanded')) {
                    question.classList.remove('expanded');
                    expanded = null;
                    return;
                }

                if (expanded && expanded !== question) {
                    expanded.classList.remove('expanded');
                }
                question.classList.add('expanded');
                expanded = question;

                setTimeout(() => {
                    question.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 200);
            });
        });
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
                new Promise(resolve => setTimeout(resolve, 6000)) // Задержка 4 секунды
            ]);
            
            app.hideLoading();

            const resultEl = document.getElementById('quizResult');
            if (resultEl) {
                resultEl.classList.remove('hidden');
                resultEl.innerHTML = `
                    <p>Результат: <strong>${result.score ?? 0}%</strong></p>
                    <p>Ответов: ${answers.length} из ${result.total_questions ?? questions.length}</p>
                `;
            }

            const submitBtn = document.getElementById('submitQuizBtn');
            if (submitBtn) {
                submitBtn.classList.add('hidden');
            }
        } catch (err) {
            console.error(err);
            app.hideLoading();
            app.notify(err.message || 'Не удалось сохранить результат', 'error');
        }
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