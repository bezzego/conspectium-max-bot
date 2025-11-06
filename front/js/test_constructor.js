(() => {
    const MIN_ANSWERS = 2;
    const DEFAULT_ANSWERS = 4;
    const MAX_ANSWERS = 8;
    const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    let questionCounter = 0;

    document.addEventListener('DOMContentLoaded', async () => {
        if (!document.body.classList.contains('page-test-constructor')) {
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

        const questionsContainer = document.getElementById('constructorQuestions');
        const addQuestionBtn = document.getElementById('addQuestionBtn');
        const saveQuizBtn = document.getElementById('saveQuizBtn');

        addQuestion({ focus: true });

        addQuestionBtn.addEventListener('click', () => addQuestion({ focus: true }));
        saveQuizBtn.addEventListener('click', () => handleSave(app));

        questionsContainer.addEventListener('click', (event) => {
            const removeQuestionBtn = event.target.closest('.question-remove-btn');
            if (removeQuestionBtn) {
                const card = removeQuestionBtn.closest('.question-card');
                removeQuestion(card, app);
                return;
            }

            const removeAnswerBtn = event.target.closest('.remove-answer-btn');
            if (removeAnswerBtn) {
                const row = removeAnswerBtn.closest('.answer-row');
                const questionCard = removeAnswerBtn.closest('.question-card');
                removeAnswer(questionCard, row, app);
                return;
            }

            const addAnswerBtn = event.target.closest('.add-answer-btn');
            if (addAnswerBtn) {
                const questionCard = addAnswerBtn.closest('.question-card');
                addAnswer(questionCard, { focus: true }, app);
                return;
            }

            const marker = event.target.closest('.answer-row__marker');
            if (marker) {
                const row = marker.closest('.answer-row');
                const radio = row.querySelector('.answer-correct-input');
                radio.checked = true;
                setCorrectAnswer(row);
            }
        });

        questionsContainer.addEventListener('change', (event) => {
            if (event.target.classList.contains('answer-correct-input')) {
                const row = event.target.closest('.answer-row');
                setCorrectAnswer(row);
            }
        });

        document.addEventListener('input', (event) => {
            const target = event.target;
            if (target.classList.contains('input-error')) {
                target.classList.remove('input-error');
            }
            if (target.closest('.question-card')?.classList.contains('input-error')) {
                target.closest('.question-card').classList.remove('input-error');
            }
        });
    });

    function addQuestion(options = {}) {
        const questionsContainer = document.getElementById('constructorQuestions');
        const questionId = `question-${++questionCounter}`;
        const card = document.createElement('article');
        card.className = 'question-card';
        card.dataset.questionId = questionId;
        card.innerHTML = `
            <div class="question-card__header">
                <span class="question-card__index">1</span>
                <div class="question-card__actions">
                    <button type="button" class="icon-btn question-remove-btn" title="Удалить вопрос">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="question-card__body">
                <div class="field-group">
                    <label>Текст вопроса</label>
                    <textarea class="constructor-textarea question-title" rows="2" placeholder="Например: Какой процесс происходит в митохондриях?"></textarea>
                </div>
                <div class="field-group">
                    <label>Пояснение после ответа (необязательно)</label>
                    <textarea class="constructor-textarea question-explanation" rows="2" placeholder="Это увидят участники после ответа. Можно подсказать, почему ответ правильный."></textarea>
                </div>
                <div class="answers-block">
                    <div class="answers-header">
                        <span class="answers-title">Варианты ответов</span>
                        <button type="button" class="ghost-btn add-answer-btn">
                            <i class="fas fa-plus"></i>
                            Ответ
                        </button>
                    </div>
                    <div class="answers-list"></div>
                </div>
            </div>
        `;

        const answersList = card.querySelector('.answers-list');
        for (let i = 0; i < DEFAULT_ANSWERS; i += 1) {
            answersList.appendChild(createAnswerRow(questionId));
        }
        const firstRadio = card.querySelector('.answer-correct-input');
        if (firstRadio) {
            firstRadio.checked = true;
            setCorrectAnswer(firstRadio.closest('.answer-row'));
        }

        questionsContainer.appendChild(card);
        updateQuestionNumbers();
        updateAnswerMarkers(card);

        if (options.focus) {
            const titleInput = card.querySelector('.question-title');
            setTimeout(() => titleInput?.focus(), 0);
        }
    }

    function removeQuestion(card, app) {
        const cards = document.querySelectorAll('.question-card');
        if (cards.length <= 1) {
            app.notify('В тесте должен быть хотя бы один вопрос', 'info');
            return;
        }
        card.remove();
        updateQuestionNumbers();
    }

    function addAnswer(questionCard, options = {}, app) {
        const answersList = questionCard.querySelector('.answers-list');
        if (answersList.children.length >= MAX_ANSWERS) {
            app.notify(`Можно добавить не более ${MAX_ANSWERS} ответов`, 'info');
            return;
        }
        const row = createAnswerRow(questionCard.dataset.questionId);
        answersList.appendChild(row);
        updateAnswerMarkers(questionCard);
        if (options.focus) {
            const input = row.querySelector('.answer-text');
            setTimeout(() => input?.focus(), 0);
        }
    }

    function removeAnswer(questionCard, row, app) {
        const answersList = questionCard.querySelector('.answers-list');
        if (answersList.children.length <= MIN_ANSWERS) {
            app.notify('Нужно оставить минимум два варианта ответа', 'info');
            return;
        }
        const wasCorrect = row.classList.contains('correct');
        row.remove();
        updateAnswerMarkers(questionCard);
        if (wasCorrect) {
            const firstRow = answersList.querySelector('.answer-row');
            if (firstRow) {
                const radio = firstRow.querySelector('.answer-correct-input');
                radio.checked = true;
                setCorrectAnswer(firstRow);
            }
        }
    }

    function createAnswerRow(questionId) {
        const row = document.createElement('div');
        row.className = 'answer-row';
        row.innerHTML = `
            <label class="answer-row__marker" title="Отметить как правильный ответ">
                <input type="radio" class="answer-correct-input" name="${questionId}-correct" />
                <span>A</span>
            </label>
            <input type="text" class="answer-text" placeholder="Вариант ответа" />
            <button type="button" class="icon-btn remove-answer-btn" title="Удалить ответ">
                <i class="fas fa-times"></i>
            </button>
        `;
        return row;
    }

    function setCorrectAnswer(row) {
        if (!row) return;
        const questionCard = row.closest('.question-card');
        questionCard.querySelectorAll('.answer-row').forEach((item) => {
            item.classList.remove('correct');
        });
        row.classList.add('correct');
        questionCard.classList.remove('input-error');
    }

    function updateQuestionNumbers() {
        const cards = document.querySelectorAll('.question-card');
        cards.forEach((card, index) => {
            const indexNode = card.querySelector('.question-card__index');
            if (indexNode) {
                indexNode.textContent = index + 1;
            }
        });
        const label = document.getElementById('questionsCountLabel');
        if (label) {
            label.textContent = formatQuestionCount(cards.length);
        }
    }

    function updateAnswerMarkers(questionCard) {
        const rows = questionCard.querySelectorAll('.answer-row');
        rows.forEach((row, index) => {
            const marker = row.querySelector('.answer-row__marker span');
            if (marker) {
                marker.textContent = LETTERS[index] || String(index + 1);
            }
        });
    }

    function handleSave(app) {
        const payload = collectQuizData(app);
        if (!payload) {
            return;
        }
        app.showLoading('Сохраняем тест...');
        app
            .createManualQuiz(payload)
            .then((quiz) => {
                app.hideLoading();
                app.notify('Тест сохранён!', 'success');
                if (quiz?.id) {
                    window.location.href = `test.html?quizId=${quiz.id}`;
                }
            })
            .catch((err) => {
                console.error(err);
                app.hideLoading();
                app.notify(err.message || 'Не удалось сохранить тест', 'error');
            });
    }

    function collectQuizData(app) {
        const quizTitleInput = document.getElementById('quizTitleInput');
        const quizDescriptionInput = document.getElementById('quizDescriptionInput');
        const quizInstructionsInput = document.getElementById('quizInstructionsInput');
        const cards = Array.from(document.querySelectorAll('.question-card'));

        clearValidation();

        const title = quizTitleInput.value.trim();
        const description = quizDescriptionInput.value.trim();
        const instructions = quizInstructionsInput.value.trim();
        let hasErrors = false;
        const messages = new Set();

        if (!title) {
            quizTitleInput.classList.add('input-error');
            hasErrors = true;
            messages.add('Добавь название теста');
        }

        const questions = cards.map((card, index) => {
            const titleInput = card.querySelector('.question-title');
            const explanationInput = card.querySelector('.question-explanation');
            const answerRows = Array.from(card.querySelectorAll('.answer-row'));
            const questionTitle = titleInput.value.trim();
            const questionExplanation = explanationInput.value.trim();

            if (!questionTitle) {
                titleInput.classList.add('input-error');
                card.classList.add('input-error');
                hasErrors = true;
                messages.add(`Заполни текст в вопросе №${index + 1}`);
            }

            if (answerRows.length < MIN_ANSWERS) {
                card.classList.add('input-error');
                hasErrors = true;
                messages.add(`Добавь минимум два ответа в вопросе №${index + 1}`);
            }

            let correctMarked = false;
            const answers = answerRows.map((row) => {
                const input = row.querySelector('.answer-text');
                const text = input.value.trim();
                const isCorrect = row.querySelector('.answer-correct-input').checked;
                if (!text) {
                    input.classList.add('input-error');
                    card.classList.add('input-error');
                    hasErrors = true;
                    messages.add(`Заполни варианты ответа в вопросе №${index + 1}`);
                }
                if (isCorrect) {
                    correctMarked = true;
                }
                return { text, is_correct: isCorrect };
            });

            if (!correctMarked) {
                card.classList.add('input-error');
                hasErrors = true;
                messages.add(`Отметь правильный ответ в вопросе №${index + 1}`);
            }

            return {
                title: questionTitle,
                explanation: questionExplanation ? questionExplanation : null,
                answers,
            };
        });

        if (hasErrors) {
            messages.forEach((message) => app.notify(message, 'error'));
            app.notify('Проверь выделенные поля и попробуй снова', 'error');
            return null;
        }

        return {
            title,
            description: description || null,
            instructions: instructions || null,
            questions,
        };
    }

    function clearValidation() {
        document.querySelectorAll('.input-error').forEach((node) => node.classList.remove('input-error'));
    }

    function formatQuestionCount(count) {
        const mod10 = count % 10;
        const mod100 = count % 100;
        let suffix = 'вопросов';
        if (mod10 === 1 && mod100 !== 11) {
            suffix = 'вопрос';
        } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
            suffix = 'вопроса';
        }
        return `${count} ${suffix}`;
    }
})();
