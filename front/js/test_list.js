(() => {
    const state = {
        tests: [],
        editingId: null,
    };

    document.addEventListener('DOMContentLoaded', async () => {
        if (!document.body.classList.contains('page-test-list')) {
            return;
        }

        const app = window.ConspectiumApp;
        if (!app) return;

        try {
            await app.ready();
            await loadTests(app);
        } catch (err) {
            console.error(err);
            app.notify('Не удалось загрузить список тестов', 'error');
        }

        const createBtn = document.getElementById('createNewTestBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                window.location.href = 'test_create.html';
            });
        }
    });

    async function loadTests(app) {
        const container = document.getElementById('testList');
        if (!container) return;

        container.innerHTML = '<p class="loading-state">Загружаем тесты…</p>';

        try {
            const data = await app.authFetch('/quizzes');
            state.tests = Array.isArray(data?.items) ? data.items : [];
            renderTests();
        } catch (err) {
            console.error(err);
            container.innerHTML = '<p class="empty-state">Не удалось загрузить тесты. Попробуй обновить страницу.</p>';
        }
    }

    function renderTests() {
        const container = document.getElementById('testList');
        if (!container) {
            return;
        }

        if (!state.tests.length) {
            container.innerHTML = '<p class="empty-state">Пока нет сохранённых тестов. Создай первый, и он появится здесь.</p>';
            return;
        }

        container.innerHTML = '';
        state.tests.forEach((quiz) => {
            container.appendChild(createTestItem(quiz));
        });
    }

    function createTestItem(quiz) {
        const item = document.createElement('div');
        item.className = 'test-item';
        item.dataset.quizId = String(quiz.id);

        item.appendChild(buildHeader(quiz));

        if (quiz.description) {
            const description = document.createElement('div');
            description.className = 'test-description';
            description.textContent = quiz.description;
            item.appendChild(description);
        }

        item.appendChild(buildResultSummary(quiz));
        item.appendChild(buildActions(quiz));
        item.appendChild(buildRenameForm(quiz));
        return item;
    }

    function buildHeader(quiz) {
        const header = document.createElement('div');
        header.className = 'test-header';

        const title = document.createElement('div');
        title.className = 'test-title';
        title.textContent = quiz.title || 'Новый тест';

        const meta = document.createElement('div');
        meta.className = 'test-meta';
        const updatedAt = quiz.updated_at || quiz.created_at;
        const date = updatedAt ? new Date(updatedAt) : null;
        const updatedNode = document.createElement('span');
        updatedNode.className = 'test-updated';
        updatedNode.textContent = date ? `Обновлён ${formatDate(date)}` : 'Дата неизвестна';
        meta.appendChild(updatedNode);

        if (quiz.latest_result) {
            const scoreNode = document.createElement('span');
            scoreNode.className = 'test-score';
            const { scoreText, breakdown } = buildScoreText(quiz.latest_result);
            scoreNode.innerHTML = `<i class="fas fa-chart-line"></i>${scoreText}`;
            if (breakdown) {
                scoreNode.dataset.breakdown = breakdown;
                scoreNode.title = breakdown;
            }
            const createdAt = quiz.latest_result.created_at ? new Date(quiz.latest_result.created_at) : null;
            if (createdAt) {
                scoreNode.title = `${breakdown ? `${breakdown} • ` : ''}${formatDate(createdAt)}`;
            }
            meta.appendChild(scoreNode);
        }

        header.appendChild(title);
        header.appendChild(meta);
        return header;
    }

    function buildResultSummary(quiz) {
        const wrapper = document.createElement('div');
        wrapper.className = 'test-result';

        if (!quiz.latest_result) {
            wrapper.classList.add('test-result--empty');
            wrapper.textContent = 'Пока нет результатов — пройди тест, чтобы увидеть прогресс.';
            return wrapper;
        }

        const { scoreText, breakdown } = buildScoreText(quiz.latest_result);
        const createdAt = quiz.latest_result.created_at ? new Date(quiz.latest_result.created_at) : null;

        const label = document.createElement('span');
        label.className = 'test-result__label';
        label.textContent = 'Последняя попытка:';

        const score = document.createElement('span');
        score.className = 'test-result__score';
        score.textContent = scoreText;

        const extra = document.createElement('span');
        extra.className = 'test-result__details';
        const parts = [];
        if (breakdown) {
            parts.push(breakdown);
        }
        if (createdAt) {
            parts.push(formatDate(createdAt));
        }
        extra.textContent = parts.join(' • ');

        wrapper.appendChild(label);
        wrapper.appendChild(score);
        if (parts.length) {
            wrapper.appendChild(extra);
        }
        return wrapper;
    }

    function buildActions(quiz) {
        const actions = document.createElement('div');
        actions.className = 'test-actions';

        const launchBtn = document.createElement('button');
        launchBtn.className = 'action-btn launch';
        launchBtn.type = 'button';
        launchBtn.textContent = 'Пройти тест';
        launchBtn.addEventListener('click', () => {
            window.location.href = `test.html?quizId=${quiz.id}`;
        });

        const renameBtn = document.createElement('button');
        renameBtn.className = 'action-btn rename';
        renameBtn.type = 'button';
        renameBtn.textContent = 'Переименовать';
        renameBtn.addEventListener('click', () => toggleRenameForm(quiz.id));

        actions.appendChild(launchBtn);
        actions.appendChild(renameBtn);
        return actions;
    }

    function buildRenameForm(quiz) {
        const wrapper = document.createElement('div');
        wrapper.className = 'rename-form';
        wrapper.dataset.quizId = String(quiz.id);

        const label = document.createElement('label');
        label.setAttribute('for', `rename-input-${quiz.id}`);
        label.textContent = 'Новое название';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = `rename-input-${quiz.id}`;
        input.maxLength = 255;
        input.value = quiz.title || 'Новый тест';

        const actions = document.createElement('div');
        actions.className = 'rename-actions';

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'save-btn';
        saveBtn.textContent = 'Сохранить';
        saveBtn.addEventListener('click', () => submitRename(quiz.id));

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'cancel-btn';
        cancelBtn.textContent = 'Отмена';
        cancelBtn.addEventListener('click', () => closeRenameForm());

        actions.appendChild(saveBtn);
        actions.appendChild(cancelBtn);

        wrapper.appendChild(label);
        wrapper.appendChild(input);
        wrapper.appendChild(actions);
        return wrapper;
    }

    function toggleRenameForm(quizId) {
        if (state.editingId === quizId) {
            closeRenameForm();
            return;
        }

        closeRenameForm();
        state.editingId = quizId;

        const form = document.querySelector(`.rename-form[data-quiz-id="${quizId}"]`);
        if (form) {
            form.classList.add('visible');
            const input = form.querySelector('input');
            if (input) {
                input.focus();
                input.select();
            }
        }
    }

    function closeRenameForm() {
        const active = document.querySelector('.rename-form.visible');
        if (active) {
            active.classList.remove('visible');
        }
        state.editingId = null;
    }

    async function submitRename(quizId) {
        const form = document.querySelector(`.rename-form[data-quiz-id="${quizId}"]`);
        const app = window.ConspectiumApp;
        if (!form || !app) return;

        const input = form.querySelector('input');
        if (!input) return;

        const newTitle = input.value.trim();
        if (!newTitle) {
            app.notify('Название не может быть пустым', 'error');
            input.focus();
            return;
        }

        app.showLoading('Сохраняем новое название...');
        try {
        const updated = await app.authFetch(`/quizzes/${quizId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle }),
        });

            const index = state.tests.findIndex((quiz) => quiz.id === quizId);
            if (index !== -1) {
                state.tests[index] = { ...state.tests[index], ...updated };
            }

            closeRenameForm();
            renderTests();
            app.notify('Название обновлено', 'success');
        } catch (err) {
            console.error(err);
            app.notify(err.message || 'Не удалось сохранить название', 'error');
        } finally {
            app.hideLoading();
        }
    }

    function formatDate(date) {
        return date.toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function buildScoreText(result) {
        const scoreValue = typeof result.score === 'number' ? Math.round(result.score) : null;
        const total = typeof result.total_questions === 'number' ? result.total_questions : null;
        let correct = null;
        if (scoreValue !== null && total) {
            correct = Math.round((scoreValue / 100) * total);
        }
        const scoreText = scoreValue !== null ? `${scoreValue}%` : '—';
        const breakdown = correct !== null && total
            ? `${correct}/${total} правильных`
            : null;
        return { scoreText, breakdown };
    }
})();
