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
    const VARIANT_LABELS = {
        compressed: 'Сжатый конспект',
        full: 'Полный конспект',
    };

    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function renderMarkdown(markdown) {
        if (!markdown) {
            return '<p>Описание отсутствует.</p>';
        }
        const lines = markdown.split(/\r?\n/);
        const htmlParts = [];
        let inUnordered = false;
        let inOrdered = false;

        const closeLists = () => {
            if (inUnordered) {
                htmlParts.push('</ul>');
                inUnordered = false;
            }
            if (inOrdered) {
                htmlParts.push('</ol>');
                inOrdered = false;
            }
        };

        const applyInline = (value) =>
            escapeHtml(value)
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code>$1</code>');

        lines.forEach((originalLine) => {
            const line = originalLine.trim();
            if (!line) {
                closeLists();
                htmlParts.push('<br>');
                return;
            }

            if (/^#{1,6}\s+/.test(line)) {
                closeLists();
                const level = line.match(/^#{1,6}/)[0].length;
                const content = applyInline(line.replace(/^#{1,6}\s+/, ''));
                htmlParts.push(`<h${level}>${content}</h${level}>`);
                return;
            }

            if (/^[-*+]\s+/.test(line)) {
                if (!inUnordered) {
                    closeLists();
                    htmlParts.push('<ul>');
                    inUnordered = true;
                }
                const content = applyInline(line.replace(/^[-*+]\s+/, ''));
                htmlParts.push(`<li>${content}</li>`);
                return;
            }

            if (/^\d+\.\s+/.test(line)) {
                if (!inOrdered) {
                    closeLists();
                    htmlParts.push('<ol>');
                    inOrdered = true;
                }
                const content = applyInline(line.replace(/^\d+\.\s+/, ''));
                htmlParts.push(`<li>${content}</li>`);
                return;
            }

            if (/^>\s?/.test(line)) {
                closeLists();
                const content = applyInline(line.replace(/^>\s?/, ''));
                htmlParts.push(`<blockquote>${content}</blockquote>`);
                return;
            }

            closeLists();
            htmlParts.push(`<p>${applyInline(line)}</p>`);
        });

        closeLists();
        return htmlParts.join('\n');
    }

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
                app.showLoading('Создаём конспект... Это может занять несколько минут для длинных аудио.');
                const conspect = await app.createConspectFromAudio(audio.id, file.name);
                app.hideLoading();
                app.notify('Конспект готов!', 'success');
                refreshConspectData(app, conspect.id);
                showConspectModal(conspect, { initialVariant: 'compressed' });
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
                    app.showLoading('Создаём конспект... Это может занять пару минут.');
                    const conspect = await app.createConspectFromText(textInput.value.trim(), titleInput.value.trim());
                    app.hideLoading();
                    app.notify('Конспект готов!', 'success');
                    await loadConspectDetails(app, conspect.id);
                    showConspectModal(conspect, { initialVariant: 'compressed' });
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
            const summaryNode = container.querySelector('.conspect-summary');
            if (summaryNode) {
                const preferredMarkdown = conspect.compressed_markdown || conspect.full_markdown;
                summaryNode.innerHTML = renderMarkdown(preferredMarkdown || conspect.summary || '');
            }

            const keypointsContainer = container.querySelector('.conspect-keypoints');
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
                window.location.href = 'test_constructor.html';
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


function showConspectModal(conspect, options = {}) {
    closeConspectModal();

    const modalStyles = `
        /* Liquid Glass стили для модального окна - минимальные блики */
.conspect-modal-overlay {
    position: fixed; 
    top: 0; 
    left: 0; 
    width: 100%; 
    height: 100%;
    background: rgba(0,0,0,0.7); 
    display: flex; 
    align-items: center;
    justify-content: center; 
    z-index: 10000; 
    opacity: 0;
    transition: opacity 0.3s ease; 
    padding: 20px;
    backdrop-filter: blur(3px);
}
.conspect-modal-overlay.visible { 
    opacity: 1; 
}

.conspect-modal {
    background: linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.18) 0%,
        rgba(255, 255, 255, 0.1) 50%,
        rgba(255, 255, 255, 0.18) 100%
    );
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    width: 100%;
    max-width: 600px; 
    max-height: 80vh; 
    display: flex;
    flex-direction: column; 
    overflow: hidden; 
    transform: translateY(20px);
    transition: transform 0.3s ease; 
    box-shadow: 
        0 15px 30px rgba(0,0,0,0.25),
        0 6px 20px rgba(0, 0, 0, 0.12),
        inset 0 1px 0 rgba(255, 255, 255, 0.25),
        inset 0 -1px 0 rgba(0, 0, 0, 0.05);
    position: relative;
}

/* Минимальные блики в модальном окне */
.conspect-modal::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
        135deg,
        transparent 0%,
        rgba(255, 255, 255, 0.08) 25%,
        transparent 60%
    );
    border-radius: 20px;
    opacity: 0.4;
    pointer-events: none;
}

/* Слабый эффект градиентной рамки */
.conspect-modal::after {
    content: '';
    position: absolute;
    top: -1px;
    left: -1px;
    right: -1px;
    bottom: -1px;
    background: linear-gradient(
        45deg,
        rgba(255, 255, 255, 0.15),
        rgba(255, 255, 255, 0.08),
        rgba(255, 255, 255, 0.15)
    );
    border-radius: 21px;
    z-index: -1;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
}

.conspect-modal:hover::after {
    opacity: 0.3;
}

.conspect-modal-overlay.visible .conspect-modal { 
    transform: translateY(0); 
}

.modal-header {
    background: linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.2) 0%,
        rgba(255, 255, 255, 0.12) 50%,
        rgba(255, 255, 255, 0.2) 100%
    );
    backdrop-filter: blur(8px);
    padding: 20px 30px 15px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
    position: relative;
}

.modal-header-content {
    padding-right: 50px;
}

.modal-header h2 {
    color: #fff;
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 8px 0;
    line-height: 1.3;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

.modal-meta-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
    flex-wrap: wrap;
}

.modal-meta {
    color: rgba(255, 255, 255, 0.8);
    font-size: 15px;
    font-weight: 500;
    margin: 0;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.meta-copy-btn {
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    transition: all 0.2s ease;
    font-size: 13px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.meta-copy-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
    transform: scale(1.05);
}

.meta-copy-btn.copied {
    background: rgba(76, 175, 80, 0.25);
    color: #fff;
}

.conspect-badge {
    display: inline-block;
    background: linear-gradient(
        135deg,
        rgba(245, 216, 110, 0.7) 0%,
        rgba(240, 213, 124, 0.8) 100%
    );
    color: #1f1f1f;
    padding: 4px 12px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    text-shadow: 0 1px 1px rgba(255, 255, 255, 0.5);
    box-shadow: 0 2px 8px rgba(245, 216, 110, 0.2);
}

.modal-actions {
    position: absolute;
    top: 15px;
    right: 15px;
    display: flex;
    gap: 8px;
}

.modal-btn {
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 15px;
    color: #fff;
}

.modal-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: scale(1.05);
}

.modal-btn.close-btn:hover {
    transform: rotate(90deg) scale(1.05);
}

.modal-body {
    padding: 20px 30px;
    overflow-y: auto;
    flex: 1;
    background: transparent;
    
    /* Стилизация скроллбара для Webkit браузеров */
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
}

/* Для Webkit браузеров (Chrome, Safari, Edge) */
.modal-body::-webkit-scrollbar {
    width: 6px;
}

.modal-body::-webkit-scrollbar-track {
    background: transparent;
    border-radius: 3px;
}

.modal-body::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
    transition: background 0.3s ease;
}

.modal-body::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.5);
}

/* Для Firefox */
.modal-body {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
}

/* Адаптивность для мобильных - можно оставить скроллбар тонким */
@media (max-width: 768px) {
    .modal-body { 
        padding: 15px 20px; 
    }
    
    .modal-body::-webkit-scrollbar {
        width: 4px;
    }
}

@media (max-width: 480px) {
    .modal-body { 
        padding: 12px 15px; 
    }
}

.modal-summary {
    color: #fff;
    font-size: 15px;
    line-height: 1.5;
    margin-bottom: 20px;
    font-weight: 500;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.modal-body h3 {
    color: #fff;
    font-weight: 700;
    margin-bottom: 12px;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

.modal-keypoints {
    list-style: none;
    padding: 0;
    margin: 0;
}

.modal-keypoints li {
    color: #fff;
    font-size: 15px;
    line-height: 1.5;
    margin-bottom: 8px;
    padding-left: 16px;
    position: relative;
    font-weight: 500;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.modal-keypoints li::before {
    content: '•';
    color: #f5d86e;
    position: absolute;
    left: 0;
    font-weight: 700;
}

.modal-variant-toggle {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 18px;
}

.variant-btn {
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #fff;
    border-radius: 999px;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.variant-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
}

.variant-btn.active {
    background: linear-gradient(
        135deg,
        rgba(245, 216, 110, 0.7) 0%,
        rgba(240, 213, 124, 0.8) 100%
    );
    color: #1f1f1f;
    border-color: rgba(245, 216, 110, 0.4);
    box-shadow: 0 2px 10px rgba(245, 216, 110, 0.2);
    text-shadow: 0 1px 1px rgba(255, 255, 255, 0.5);
}

.markdown-viewer {
    color: #fff;
    font-size: 15px;
    line-height: 1.55;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.markdown-viewer h1,
.markdown-viewer h2,
.markdown-viewer h3 {
    font-weight: 700;
    margin: 20px 0 12px;
    line-height: 1.25;
    color: #fff;
}

.markdown-viewer h1 { 
    font-size: 22px; 
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.4);
}
.markdown-viewer h2 { 
    font-size: 19px; 
    text-shadow: 0 1px 5px rgba(0, 0, 0, 0.4);
}
.markdown-viewer h3 { 
    font-size: 17px; 
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

.markdown-viewer p {
    margin: 0 0 12px;
}

.markdown-viewer ul,
.markdown-viewer ol {
    padding-left: 22px;
    margin: 0 0 16px;
}

.markdown-viewer li {
    margin-bottom: 6px;
}

.markdown-viewer blockquote {
    border-left: 2px solid #f5d86e;
    padding-left: 12px;
    margin: 12px 0;
    color: rgba(255, 255, 255, 0.9);
    font-style: italic;
    background: rgba(255, 255, 255, 0.04);
    padding: 8px 12px;
    border-radius: 0 6px 6px 0;
}

.markdown-viewer code {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.9em;
    border: 1px solid rgba(255, 255, 255, 0.08);
}

/* Убраны liquid reflections */

@media (max-width: 768px) {
    .conspect-modal-overlay { 
        padding: 15px; 
    }
    .modal-header { 
        padding: 15px 20px 12px; 
    }
    .modal-body { 
        padding: 15px 20px; 
    }
    .modal-actions { 
        top: 12px; 
        right: 12px; 
    }
    .modal-header-content { 
        padding-right: 45px; 
    }
}

@media (max-width: 480px) {
    .conspect-modal-overlay { 
        padding: 10px; 
    }
    .modal-header { 
        padding: 12px 15px 10px; 
    }
    .modal-body { 
        padding: 12px 15px; 
    }
    .modal-header h2 { 
        font-size: 16px; 
    }
    .modal-meta { 
        font-size: 14px; 
    }
    .modal-summary { 
        font-size: 15px; 
    }
    .variant-btn {
        padding: 6px 12px;
        font-size: 13px;
    }
}
    `;

    const existingStyles = document.getElementById('modal-styles');
    if (existingStyles) {
        existingStyles.textContent = modalStyles;
    } else {
        const styleEl = document.createElement('style');
        styleEl.id = 'modal-styles';
        styleEl.textContent = modalStyles;
        document.head.appendChild(styleEl);
    }

    const createdAtSource = conspect.generated_at || conspect.updated_at || conspect.created_at;
    const createdAt = createdAtSource ? new Date(createdAtSource).toLocaleString('ru-RU') : '';

    const variantData = {};
    if (conspect.compressed_markdown) {
        variantData.compressed = {
            markdown: conspect.compressed_markdown,
            label: VARIANT_LABELS.compressed,
        };
    }
    if (conspect.full_markdown) {
        variantData.full = {
            markdown: conspect.full_markdown,
            label: VARIANT_LABELS.full,
        };
    }
    const variantKeys = Object.keys(variantData);
    let defaultVariant = options.initialVariant && variantData[options.initialVariant]
        ? options.initialVariant
        : null;
    if (!defaultVariant && variantData.compressed) {
        defaultVariant = 'compressed';
    }
    if (!defaultVariant && variantData.full) {
        defaultVariant = 'full';
    }
    if (!defaultVariant) {
        defaultVariant = 'summary';
    }

    const keyPoints = (conspect.keywords || []).map((point) => `<li>${escapeHtml(point)}</li>`).join('');
    const isOffline = conspect.model_used === 'offline-fallback';

    conspectModalOverlay = document.createElement('div');
    conspectModalOverlay.className = 'conspect-modal-overlay';

    const variantButtonsMarkup = variantKeys
        .map((key) => `<button class="variant-btn" data-variant="${key}">${escapeHtml(variantData[key].label)}</button>`)
        .join('');

    conspectModalOverlay.innerHTML = `
        <div class="conspect-modal">
            <div class="modal-header">
                <div class="modal-header-content">
                    <h2>${escapeHtml(conspect.title || 'Без названия')}</h2>
                    <div class="modal-meta-row">
                        ${createdAt ? `<p class="modal-meta">Создан: ${escapeHtml(createdAt)}</p>` : ''}
                        <button class="meta-copy-btn" title="Копировать конспект">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                    ${isOffline ? '<div class="conspect-badge">Офлайн черновик</div>' : ''}
                </div>
                <div class="modal-actions">
                    <button class="modal-btn close-btn" aria-label="Закрыть">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="modal-body">
                ${variantKeys.length ? `
                    <div class="modal-variant-toggle">
                        ${variantButtonsMarkup}
                    </div>
                ` : ''}
                <div class="modal-summary markdown-viewer"></div>
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

    const summaryContainer = conspectModalOverlay.querySelector('.modal-summary');
    const variantButtons = Array.from(conspectModalOverlay.querySelectorAll('.variant-btn'));
    const copyButton = conspectModalOverlay.querySelector('.meta-copy-btn');
    const originalCopyHtml = copyButton ? copyButton.innerHTML : '';
    let currentVariantKey = defaultVariant;
    let currentVariantMarkdown =
        variantData[currentVariantKey]?.markdown || (currentVariantKey === 'summary' ? conspect.summary : '');

    const updateVariant = (key) => {
        currentVariantKey = key;
        currentVariantMarkdown = variantData[key]?.markdown || (key === 'summary' ? conspect.summary : '');
        variantButtons.forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.variant === key);
        });
        if (!summaryContainer) {
            return;
        }
        if (variantData[key] && variantData[key].markdown) {
            summaryContainer.innerHTML = renderMarkdown(variantData[key].markdown);
        } else if (key === 'summary') {
            summaryContainer.innerHTML = renderMarkdown(conspect.summary || '');
        } else {
            summaryContainer.innerHTML = '<p>Конспект пока отсутствует.</p>';
        }
    };

    if (variantButtons.length) {
        variantButtons.forEach((button) => {
            button.addEventListener('click', () => {
                updateVariant(button.dataset.variant);
            });
        });
    }

    updateVariant(defaultVariant);

    const closeButton = conspectModalOverlay.querySelector('.close-btn');
    if (closeButton) {
        closeButton.addEventListener('click', closeConspectModal);
    }

    if (copyButton) {
        copyButton.addEventListener('click', () => {
            copyConspectToClipboard(conspect, currentVariantKey, currentVariantMarkdown)
                .then(() => {
                    if (window.ConspectiumApp) {
                        window.ConspectiumApp.notify('Конспект скопирован в буфер обмена', 'success');
                    }
                    copyButton.innerHTML = '<i class="fas fa-check"></i>';
                    copyButton.classList.add('copied');
                    setTimeout(() => {
                        copyButton.innerHTML = originalCopyHtml;
                        copyButton.classList.remove('copied');
                    }, 2000);
                })
                .catch((err) => {
                    console.error('Ошибка копирования: ', err);
                    if (window.ConspectiumApp) {
                        window.ConspectiumApp.notify('Не удалось скопировать конспект', 'error');
                    }
                });
        });
    }

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

function copyConspectToClipboard(conspect, variantKey, markdown) {
    const lines = [];
    lines.push(conspect.title || 'Без названия');
    const content = markdown || conspect.summary || '';
    if (content) {
        lines.push('', content);
    }
    if (Array.isArray(conspect.keywords) && conspect.keywords.length) {
        lines.push('', 'Ключевые идеи:');
        conspect.keywords.forEach((point) => {
            lines.push(`• ${point}`);
        });
    }
    return navigator.clipboard.writeText(lines.join('\n').trim());
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

// Делаем функцию глобально доступной для choose_test.js
