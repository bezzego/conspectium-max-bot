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
                showConspectPlaceholder(`Загружаем аудио «${file.name}»...`);
                const audio = await app.uploadAudio(file);
                app.showLoading('Создаём конспект...');
                showConspectPlaceholder('Нейросеть создаёт конспект, это займет немного времени...');
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
                    showConspectPlaceholder('Готовим конспект на основе текста...');
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

        showConspectPlaceholder('Здесь появится сгенерированный конспект.');
        loadLatestConspectForPreview(app);
    }


    async function loadLatestConspectForPreview(app) {
        try {
            const data = await app.authFetch('/conspects');
            if (!data.items?.length) {
                return;
            }
            renderConspectPreview(data.items[0]);
        } catch (err) {
            console.error(err);
        }
    }

    async function loadConspectDetails(app, conspectId) {
        try {

            const conspect = await app.authFetch(`/conspects/${conspectId}`);
            renderConspectPreview(conspect);
        } catch (err) {
            console.error(err);
            showConspectPlaceholder('Не удалось загрузить конспект, попробуйте снова.');
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

    // Стили для модального окна
    const modalStyles = `
        .conspect-modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.7); display: flex; align-items: center; 
            justify-content: center; z-index: 10000; opacity: 0; 
            transition: opacity 0.3s ease; padding: 20px;
        }
        .conspect-modal-overlay.visible { opacity: 1; }
        .conspect-modal {
            background: #dddcdc; border-radius: 20px; width: 100%; 
            max-width: 600px; max-height: 80vh; display: flex; 
            flex-direction: column; overflow: hidden; transform: translateY(20px); 
            transition: transform 0.3s ease; box-shadow: 0 20px 40px rgba(0,0,0,0.3); 
            position: relative;
        }
        .conspect-modal-overlay.visible .conspect-modal { transform: translateY(0); }
        .modal-header {
            background: #ebeaea; padding: 20px 30px 15px; 
            border-bottom: 1px solid #7e7d7d; position: relative;
        }
        .modal-header-content { 
            padding-right: 50px; 
        }
        .modal-header h2 { 
            color: #333; 
            font-size: 18px; 
            font-weight: 700; 
            margin: 0 0 8px 0; 
            line-height: 1.3;
        }
        .modal-meta-row {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
        }
        .modal-meta {
            color: #6c6c70;
            font-size: 15px;
            font-weight: 500;
            margin: 0;
        }
        .meta-copy-btn {
            background: transparent;
            border: none;
            color: #6c6c70;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            transition: all 0.3s ease;
            font-size: 13px;
        }
        .meta-copy-btn:hover {
            color: #b9b9b5ff;
            background: rgba(0,0,0,0.05);
        }
        .conspect-badge {
            display: inline-block;
            background: #f5d86e;
            color: #333;
            padding: 3px 10px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 600;
        }
        .modal-actions {
            position: absolute;
            top: 15px;
            right: 15px;
            display: flex;
            gap: 8px;
        }
        .modal-btn {
            background: transparent;
            border: none;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 15px;
            color: #333;
        }
        .modal-btn:hover {
            background: rgba(0,0,0,0.1);
            transform: scale(1.1);
        }
        .modal-btn.close-btn:hover {
            transform: rotate(90deg) scale(1.1);
        }
        .modal-body {
            padding: 20px 30px;
            overflow-y: auto;
            flex: 1;
        }
        .modal-summary {
            color: #333;
            font-size: 15px;
            line-height: 1.5;
            margin-bottom: 20px;
            font-weight: 500;
        }
        .modal-body h3 {
            color: #333;
            font-weight: 700;
            margin-bottom: 12px;
        }
        .modal-keypoints {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .modal-keypoints li {
            color: #333;
            font-size: 15px;
            line-height: 1.5;
            margin-bottom: 8px;
            padding-left: 16px;
            position: relative;
            font-weight: 500;
        }
        .modal-keypoints li::before {
            content: '•';
            color: #f5d86e;
            font-size: 16px;
            position: absolute;
            left: 0;
            top: 0;
        }
        
        /* Адаптивность */
        @media (max-width: 768px) {
            .conspect-modal-overlay { padding: 15px; }
            .modal-header { padding: 15px 20px 12px; }
            .modal-body { padding: 15px 20px; }
            .modal-actions { top: 12px; right: 12px; }
            .modal-header-content { padding-right: 45px; }
        }
        
        @media (max-width: 480px) {
            .conspect-modal-overlay { padding: 10px; }
            .modal-header { padding: 12px 15px 10px; }
            .modal-body { padding: 12px 15px; }
            .modal-header h2 { font-size: 16px; }
            .modal-meta { font-size: 14px; }
            .modal-summary { font-size: 15px; }
        }
    `;
    
    // Добавляем стили в head если их еще нет
    if (!document.getElementById('modal-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'modal-styles';
        styleEl.textContent = modalStyles;
        document.head.appendChild(styleEl);
    }

    const createdAt = conspect.created_at
        ? new Date(conspect.created_at).toLocaleString('ru-RU')
        : '';

    const keyPoints = (conspect.keywords || []).map((point) => `<li>${point}</li>`).join('');
    const meta = conspect.raw_response && conspect.raw_response.mode === 'offline'
        ? '<div class="conspect-badge">Офлайн черновик</div>'
        : '';

    conspectModalOverlay = document.createElement('div');
    conspectModalOverlay.className = 'conspect-modal-overlay';

    conspectModalOverlay.innerHTML = `
        <div class="conspect-modal">
            <div class="modal-header">
                <div class="modal-header-content">
                    <h2>${conspect.title || 'Без названия'}</h2>
                    ${createdAt ? `
                        <div class="modal-meta-row">
                            <p class="modal-meta">Создан: ${createdAt}</p>
                            <button class="meta-copy-btn" title="Копировать конспект">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    ` : ''}
                    ${meta}
                </div>
                <div class="modal-actions">
                    <button class="modal-btn close-btn" aria-label="Закрыть">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="modal-body">
                <p class="modal-summary">${conspect.summary || 'Описание отсутствует.'}</p>
                ${keyPoints ? `
                    <h3>Ключевые идеи</h3>
                    <ul class="modal-keypoints">${keyPoints}</ul>
                ` : ''}
            </div>
        </div>
    `;

    document.body.appendChild(conspectModalOverlay);
    requestAnimationFrame(() => {
        conspectModalOverlay.classList.add('visible');
    });

    // Обработчик кнопки закрытия
    const closeButton = conspectModalOverlay.querySelector('.close-btn');
    closeButton?.addEventListener('click', closeConspectModal);
    

    const copyButton = conspectModalOverlay.querySelector('.meta-copy-btn');
    copyButton?.addEventListener('click', () => {
        copyConspectToClipboard(conspect);
    });

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

function copyConspectToClipboard(conspect) {
    const keyPoints = conspect.keywords ? conspect.keywords.map(point => `• ${point}`).join('\n') : '';
    
    const textToCopy = `
${conspect.title || 'Без названия'}

${conspect.summary || 'Описание отсутствует.'}

${keyPoints ? 'Ключевые идеи:\n' + keyPoints : ''}
    `.trim();

    navigator.clipboard.writeText(textToCopy).then(() => {
        // Используем window.ConspectiumApp напрямую для избежания ошибок
        if (window.ConspectiumApp) {
            window.ConspectiumApp.notify('Конспект скопирован в буфер обмена', 'success');
        }
        
        // Визуальная обратная связь на кнопке
        const copyBtn = document.querySelector('.meta-copy-btn');
        if (copyBtn) {
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fas fa-check"></i>';
            copyBtn.style.color = '#b9b9b5ff;';
            
            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                copyBtn.style.color = '';
            }, 2000);
        }
    }).catch(err => {
        console.error('Ошибка копирования: ', err);
        // Используем window.ConspectiumApp напрямую для избежания ошибок
        if (window.ConspectiumApp) {
            window.ConspectiumApp.notify('Не удалось скопировать конспект', 'error');
        }
    });
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

    function renderConspectPreview(conspect) {
        const container = document.getElementById('conspectResult');
        const placeholder = document.getElementById('conspectPlaceholder');
        const quizBtn = document.getElementById('createQuizFromLatest');
        const shareBtn = document.getElementById('shareConspectBtn');

        if (!container || !placeholder) {
            return;
        }

        const titleEl = container.querySelector('.conspect-title');
        const summaryEl = container.querySelector('.conspect-summary');
        const keypointsContainer = container.querySelector('.conspect-keypoints');

        if (titleEl) {
            titleEl.textContent = conspect.title || 'Без названия';
        }
        if (summaryEl) {
            summaryEl.textContent = conspect.summary || 'Нет описания';
        }
        if (keypointsContainer) {
            keypointsContainer.innerHTML = '';
            (conspect.keywords || []).forEach((point) => {
                const li = document.createElement('li');
                li.textContent = point;
                keypointsContainer.appendChild(li);
            });
        }

        if (quizBtn) {
            quizBtn.dataset.latestConspectId = conspect.id;
        }
        if (shareBtn) {
            shareBtn.dataset.latestConspectId = conspect.id;
        }

        placeholder.classList.add('hidden');
        container.classList.remove('hidden');

        document.dispatchEvent(new CustomEvent('conspect:details', { detail: { conspect } }));
    }

    function showConspectPlaceholder(message) {
        const placeholder = document.getElementById('conspectPlaceholder');
        const result = document.getElementById('conspectResult');
        if (!placeholder || !result) {
            return;
        }
        placeholder.textContent = message;
        placeholder.classList.remove('hidden');
        result.classList.add('hidden');

        const quizBtn = document.getElementById('createQuizFromLatest');
        const shareBtn = document.getElementById('shareConspectBtn');
        if (quizBtn) {
            delete quizBtn.dataset.latestConspectId;
        }
        if (shareBtn) {
            delete shareBtn.dataset.latestConspectId;
        }
    }
})();

// Делаем функцию глобально доступной для choose_test.js
window.showConspectModal = showConspectModal;
