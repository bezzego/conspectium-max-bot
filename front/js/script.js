function goBack() {
    if (document.referrer && document.referrer.includes(window.location.hostname)) {
        window.history.back();
    } else {
        window.location.href = 'main.html';
    }
}

window.goBack = goBack;

(function () {
    const body = document.body;

    document.addEventListener('DOMContentLoaded', async () => {
        const app = window.ConspectiumApp;
        if (!app) {
            console.error('ConspectiumApp not found');
            return;
        }

        try {
            await app.ready();
        } catch (err) {
            console.error('Auth error', err);
            app.notify('Не удалось авторизоваться', 'error');
            return;
        }

        document.addEventListener('conspect:load', async (event) => {
            const conspectId = event.detail?.conspectId;
            if (!conspectId) return;
            await loadConspectDetails(app, conspectId);
        });

        initHorizontalScroll();
        setupUploadHandlers(app);

        if (body.classList.contains('page-main')) {
            initMainPage(app);
        }
        if (body.classList.contains('page-conspects')) {
            initConspectListPage(app);
        }
        if (body.classList.contains('page-choose-test')) {
            initChooseTestPage(app);
        }
        if (body.classList.contains('page-conspect-create')) {
            initConspectCreatePage(app);
        }
        if (body.classList.contains('page-test-create')) {
            initTestCreatePage();
        }
        if (body.classList.contains('page-test')) {
            // handled in test.js
        }
    });

    function initHorizontalScroll() {
        const scrollContainer = document.querySelector('.actions-scroll');
        if (!scrollContainer) return;
        scrollContainer.addEventListener('wheel', function (event) {
            event.preventDefault();
            this.scrollLeft += event.deltaY;
        });
    }

    function setupUploadHandlers(app) {
        const button = document.getElementById('uploadAudioButton');
        const input = document.getElementById('audioUploadInput');
        if (!button || !input) {
            return;
        }

        button.addEventListener('click', (event) => {
            event.preventDefault();
            input.click();
        });

        input.addEventListener('change', async () => {
            if (!input.files || !input.files.length) {
                return;
            }
            const file = input.files[0];
            try {
                app.showLoading('Загружаем аудио...');
                const audio = await app.uploadAudio(file);
                app.showLoading('Создаём конспект...');
                const conspectId = await app.createConspectFromAudio(audio.id, file.name);
                app.hideLoading();
                app.notify('Конспект готов!', 'success');
                refreshConspectData(app, conspectId);
            } catch (err) {
                console.error(err);
                app.hideLoading();
                app.notify(err.message || 'Не удалось обработать аудио', 'error');
            } finally {
                input.value = '';
            }
        });
    }

    async function refreshConspectData(app, conspectId) {
        if (document.getElementById('mainConspects')) {
            await loadMainConspects(app);
        }

        if (document.getElementById('conspectList')) {
            await loadConspectList(app);
        }

        if (document.body.classList.contains('page-conspect-create')) {
            await loadConspectDetails(app, conspectId);
        }
    }

    // Main page ---------------------------------------------------------
    async function initMainPage(app) {
        await loadMainConspects(app);
        const card = document.getElementById('audioActionCard');
        if (card) {
            card.addEventListener('click', (event) => {
                event.preventDefault();
                const button = document.getElementById('uploadAudioButton');
                if (button) {
                    button.click();
                }
            });
        }
    }

    async function loadMainConspects(app) {
        const container = document.getElementById('mainConspects');
        if (!container) return;

        container.textContent = 'Загружаем конспекты...';
        try {
            const data = await app.authFetch('/conspects');
            renderConspectList(container, data.items.slice(0, 10));
            attachConspectDetailsHandlers(app, container);
        } catch (err) {
            console.error(err);
            container.textContent = 'Не удалось загрузить конспекты.';
        }
    }

    // Conspect list -----------------------------------------------------
    async function initConspectListPage(app) {
        await loadConspectList(app);
    }

    async function loadConspectList(app) {
        const container = document.getElementById('conspectList');
        if (!container) return;

        container.textContent = 'Загружаем конспекты...';
        try {
            const data = await app.authFetch('/conspects');
            renderConspectList(container, data.items);
            attachConspectDetailsHandlers(app, container);
        } catch (err) {
            console.error(err);
            container.textContent = 'Не удалось загрузить конспекты.';
        }
    }

    function renderConspectList(container, items) {
        container.innerHTML = '';
        if (!items.length) {
            container.innerHTML = '<p class="empty-state">Пока нет конспектов. Загрузите аудио или создайте конспект из текста.</p>';
            return;
        }

        items.forEach((conspect, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'conspect-item';
            wrapper.dataset.conspectId = conspect.id;
            if (container.id === 'conspectList') {
                wrapper.id = `conspect-${conspect.id}`;
            }

            const content = document.createElement('div');
            content.className = 'item-content';
            const prefix = `${index + 1}. `;
            const text = conspect.title || (conspect.summary ? conspect.summary.slice(0, 120) + '…' : 'Без названия');
            content.textContent = prefix + text;

            wrapper.appendChild(content);
            container.appendChild(wrapper);
        });

        if (window.addWordBreaksImproved) {
            window.addWordBreaksImproved();
        }

        document.dispatchEvent(new CustomEvent('conspects:updated', {
            detail: { context: container.id || 'conspects', items },
        }));
        return items;
    }

    // Choose test -------------------------------------------------------
    async function initChooseTestPage(app) {
        await loadChooseConspects(app);
    }

    async function loadChooseConspects(app) {
        const container = document.getElementById('chooseConspectList');
        if (!container) return;

        container.textContent = 'Загружаем конспекты...';
        try {
            const data = await app.authFetch('/conspects');
            renderSelectableConspects(container, data.items);
            attachConspectDetailsHandlers(app, container, { showButtons: false });
        } catch (err) {
            console.error(err);
            container.textContent = 'Не удалось загрузить конспекты.';
        }
    }

    function renderSelectableConspects(container, items) {
        container.innerHTML = '';
        if (!items.length) {
            container.innerHTML = '<p class="empty-state">Нет доступных конспектов. Создайте конспект и вернитесь сюда.</p>';
            return;
        }

        items.forEach((conspect) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'conspect-item';
            wrapper.dataset.conspectId = conspect.id;

            const content = document.createElement('div');
            content.className = 'item-content';
            content.textContent = conspect.title || conspect.summary || 'Без названия';
            wrapper.appendChild(content);

            container.appendChild(wrapper);
        });

        if (window.addWordBreaksImproved) {
            window.addWordBreaksImproved();
        }

        document.dispatchEvent(new CustomEvent('conspects:selectable-updated', {
            detail: { context: container.id || 'choose', items },
        }));
    }

    // Conspect create ---------------------------------------------------
    function initConspectCreatePage(app) {
        const textButton = document.getElementById('createFromTextBtn');
        const textInput = document.getElementById('conspectTextInput');
        const titleInput = document.getElementById('conspectTitleInput');
        const createQuizBtn = document.getElementById('createQuizFromLatest');
        const shareBtn = document.getElementById('shareConspectBtn');

        if (textButton && textInput) {
            textButton.addEventListener('click', async () => {
                if (!textInput.value.trim()) {
                    app.notify('Введи текст для конспекта', 'error');
                    return;
                }
                try {
                    app.showLoading('Создаём конспект из текста...');
                    const conspectId = await app.createConspectFromText(textInput.value.trim(), titleInput.value.trim());
                    app.hideLoading();
                    app.notify('Конспект готов!', 'success');
                    await loadConspectDetails(app, conspectId);
                    textInput.value = '';
                    titleInput.value = '';
                } catch (err) {
                    console.error(err);
                    app.hideLoading();
                    app.notify(err.message || 'Не удалось создать конспект', 'error');
                }
            });
        }

        if (createQuizBtn) {
            createQuizBtn.addEventListener('click', () => {
                const latestId = createQuizBtn.dataset.latestConspectId;
                if (!latestId) {
                    app.notify('Сначала создай конспект', 'info');
                    return;
                }
                window.location.href = `choose_test.html?conspectId=${latestId}`;
            });
        }

        if (shareBtn) {
            shareBtn.addEventListener('click', () => {
                const latestId = shareBtn.dataset.latestConspectId;
                if (!latestId) {
                    app.notify('Нет конспекта для отправки ссылки', 'info');
                    return;
                }
                const shareUrl = `${window.location.origin}/front/html/conspect_list.html#conspect-${latestId}`;
                navigator.clipboard.writeText(shareUrl).then(() => {
                    app.notify('Ссылка скопирована в буфер обмена', 'success');
                });
            });
        }
    }

    async function loadConspectDetails(app, conspectId) {
        try {
            const conspect = await app.authFetch(`/conspects/${conspectId}`);
            const container = document.getElementById('conspectResult');
            const placeholder = document.getElementById('conspectPlaceholder');
            const quizBtn = document.getElementById('createQuizFromLatest');
            const shareBtn = document.getElementById('shareConspectBtn');

            if (!container || !placeholder) return;

            placeholder.classList.add('hidden');
            container.classList.remove('hidden');
            container.querySelector('.conspect-title').textContent = conspect.title || 'Без названия';
            container.querySelector('.conspect-summary').textContent = conspect.summary || 'Нет описания';

            const keypointsContainer = container.querySelector('.conspect-keypoints');
            keypointsContainer.innerHTML = '';
            (conspect.keywords || []).forEach((point) => {
                const li = document.createElement('li');
                li.textContent = point;
                keypointsContainer.appendChild(li);
            });

            if (quizBtn) {
                quizBtn.dataset.latestConspectId = conspect.id;
            }
            if (shareBtn) {
                shareBtn.dataset.latestConspectId = conspect.id;
            }

            document.dispatchEvent(new CustomEvent('conspect:details', { detail: { conspect } }));
        } catch (err) {
            console.error(err);
        }
    }

    // Test create -------------------------------------------------------
    function initTestCreatePage() {
        const btn = document.getElementById('createFromConspectBtn');
        if (btn) {
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                window.location.href = 'choose_test.html';
            });
        }

        const constructorBtn = document.getElementById('openManualConstructor');
        if (constructorBtn) {
            constructorBtn.addEventListener('click', () => {
                window.ConspectiumApp.notify('Конструктор появится в следующей версии', 'info');
            });
        }

        const shareBtn = document.getElementById('shareQuizBtn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => {
                window.ConspectiumApp.notify('Скоро добавим возможность делиться тестами!', 'info');
            });
        }
    }

    function attachConspectDetailsHandlers(app, container, options = {}) {
        if (!container) return;
        const items = container.querySelectorAll('.conspect-item');
        items.forEach((item) => {
            if (item.dataset.listenerAttached === 'true') return;
            item.dataset.listenerAttached = 'true';
            item.addEventListener('click', async () => {
                const conspectId = item.dataset.conspectId;
                if (!conspectId) return;
                if (options.showButtons === false && document.body.classList.contains('page-choose-test')) {
                    // choose_test.js handles action buttons
                    return;
                }
                try {
                    app.showLoading('Открываем конспект...');
                    const conspect = await app.authFetch(`/conspects/${conspectId}`);
                    app.hideLoading();
                    showConspectModal(conspect);
                } catch (err) {
                    console.error(err);
                    app.hideLoading();
                    app.notify(err.message || 'Не удалось открыть конспект', 'error');
                }
            });
        });
    }

    let conspectModalOverlay = null;
    let modalEscHandler = null;

    function showConspectModal(conspect) {
        closeConspectModal();

        conspectModalOverlay = document.createElement('div');
        conspectModalOverlay.className = 'conspect-modal-overlay';

        const createdAt = conspect.created_at
            ? new Date(conspect.created_at).toLocaleString('ru-RU')
            : '';

        const keyPoints = (conspect.keywords || []).map((point) => `<li>${point}</li>`).join('');
        const meta = conspect.raw_response && conspect.raw_response.mode === 'offline'
            ? '<span class="conspect-badge">Офлайн черновик</span>'
            : '';

        conspectModalOverlay.innerHTML = `
            <div class="conspect-modal">
                <div class="modal-header">
                    <div>
                        <h2>${conspect.title || 'Без названия'}</h2>
                        ${createdAt ? `<p class="modal-meta">Создан: ${createdAt}</p>` : ''}
                    </div>
                    <button class="modal-close" aria-label="Закрыть">&times;</button>
                </div>
                ${meta}
                <div class="modal-body">
                    <p class="modal-summary">${conspect.summary || 'Описание отсутствует.'}</p>
                    ${keyPoints ? `<h3>Ключевые идеи</h3><ul class="modal-keypoints">${keyPoints}</ul>` : ''}
                </div>
            </div>
        `;

        document.body.appendChild(conspectModalOverlay);
        requestAnimationFrame(() => {
            conspectModalOverlay.classList.add('visible');
        });

        const closeButton = conspectModalOverlay.querySelector('.modal-close');
        closeButton?.addEventListener('click', closeConspectModal);
        conspectModalOverlay.addEventListener('click', (event) => {
            if (event.target === conspectModalOverlay) {
                closeConspectModal();
            }
        });

        modalEscHandler = (event) => {
            if (event.key === 'Escape') {
                closeConspectModal();
            }
        };
        document.addEventListener('keydown', modalEscHandler);
    }

    function closeConspectModal() {
        if (conspectModalOverlay) {
            conspectModalOverlay.classList.remove('visible');
            setTimeout(() => {
                conspectModalOverlay?.remove();
                conspectModalOverlay = null;
            }, 200);
        }
        if (modalEscHandler) {
            document.removeEventListener('keydown', modalEscHandler);
            modalEscHandler = null;
        }
    }

    window.closeConspectModal = closeConspectModal;
})();
