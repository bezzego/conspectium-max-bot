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
    let variantChoiceStylesInjected = false;
    let uploadHandlersAttached = false;
    const VARIANT_LABELS = {
        full: 'Фактический конспект',
        brief: 'Краткий конспект',
        compressed: 'Сжатый конспект',
    };
    const VARIANT_ORDER = ['full', 'brief', 'compressed'];

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

    function getPreferredMarkdown(conspect) {
        return (
            conspect.brief_markdown ||
            conspect.compressed_markdown ||
            conspect.full_markdown ||
            ''
        );
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const app = window.ConspectiumApp;
        if (!app) {
            console.error('ConspectiumApp not found');
            return;
        }

        setupUploadHandlers(app);

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

   function ensureVariantChoiceStyles() {
    if (variantChoiceStylesInjected) {
        return;
    }
    const style = document.createElement('style');
    style.id = 'variant-choice-styles';
    style.textContent = `
.variant-choice-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 12000;
    padding: 20px;
    backdrop-filter: blur(10px);
}
.variant-choice-modal {
    width: 100%;
    max-width: 440px;
    background: linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.15) 0%,
        rgba(255, 255, 255, 0.08) 50%,
        rgba(255, 255, 255, 0.15) 100%
    );
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    padding: 28px;
    color: #fff;
    box-shadow: 
        0 20px 60px rgba(0,0,0,0.35),
        inset 0 1px 0 rgba(255, 255, 255, 0.25),
        inset 0 -1px 0 rgba(0, 0, 0, 0.1);
    position: relative;
    overflow: hidden;
}
.variant-choice-modal::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
        135deg,
        transparent 0%,
        rgba(255, 255, 255, 0.1) 30%,
        transparent 70%
    );
    border-radius: 24px;
    opacity: 0.6;
    pointer-events: none;
}
.variant-choice-modal h3 {
    margin: 0 0 8px 0;
    font-size: 22px;
    font-weight: 700;
    text-align: center;
    text-shadow: 0 2px 8px rgba(0,0,0,0.4);
}
.variant-choice-subtitle {
    margin: 0 0 20px 0;
    color: rgba(255,255,255,0.75);
    font-size: 15px;
    text-align: center;
    text-shadow: 0 1px 4px rgba(0,0,0,0.3);
}
.variant-choice-options {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 8px;
}
.variant-choice-option {
    background: linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.1) 0%,
        rgba(255, 255, 255, 0.05) 50%,
        rgba(255, 255, 255, 0.1) 100%
    );
    backdrop-filter: blur(15px);
    -webkit-backdrop-filter: blur(15px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    padding: 18px;
    display: flex;
    gap: 14px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    position: relative;
    overflow: hidden;
}
.variant-choice-option::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
        135deg,
        transparent 0%,
        rgba(255, 255, 255, 0.08) 30%,
        transparent 70%
    );
    border-radius: 16px;
    opacity: 0.5;
}
.variant-choice-option:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.25);
    box-shadow: 
        0 8px 24px rgba(0,0,0,0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
}
.variant-choice-option.active {
    border-color: rgba(245, 216, 110, 0.6);
    background: linear-gradient(
        135deg,
        rgba(245, 216, 110, 0.15) 0%,
        rgba(245, 216, 110, 0.08) 50%,
        rgba(245, 216, 110, 0.15) 100%
    );
    box-shadow: 
        0 8px 24px rgba(245, 216, 110, 0.15),
        inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
.variant-choice-option input {
    margin-top: 3px;
    transform: scale(1.2);
    accent-color: #f5d86e;
    cursor: pointer;
}
.variant-choice-option label {
    cursor: pointer;
    flex: 1;
    margin: 0;
}
.variant-choice-option-title {
    font-weight: 600;
    font-size: 16px;
    margin-bottom: 6px;
    text-shadow: 0 2px 4px rgba(0,0,0,0.3);
    cursor: pointer;
}
.variant-choice-option-desc {
    font-size: 14px;
    color: rgba(255,255,255,0.8);
    line-height: 1.4;
    text-shadow: 0 1px 2px rgba(0,0,0,0.2);
    cursor: pointer;
}
.variant-choice-actions {
    margin-top: 24px;
    display: flex;
    gap: 14px;
}
.variant-choice-btn {
    flex: 1;
    border: none;
    border-radius: 16px;
    padding: 16px 20px;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    position: relative;
    overflow: hidden;
    backdrop-filter: blur(15px);
    -webkit-backdrop-filter: blur(15px);
}
.variant-choice-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
        135deg,
        transparent 0%,
        rgba(255, 255, 255, 0.1) 30%,
        transparent 70%
    );
    border-radius: 16px;
    opacity: 0.6;
}
.variant-choice-btn.cancel {
    background: linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.1) 0%,
        rgba(255, 255, 255, 0.05) 50%,
        rgba(255, 255, 255, 0.1) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #fff;
    box-shadow: 
        inset 0 1px 0 rgba(255, 255, 255, 0.2),
        inset 0 -1px 0 rgba(0, 0, 0, 0.1);
}
.variant-choice-btn.cancel:hover {
    background: linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.15) 0%,
        rgba(255, 255, 255, 0.08) 50%,
        rgba(255, 255, 255, 0.15) 100%
    );
    border-color: rgba(255, 255, 255, 0.25);
    transform: translateY(-2px);
    box-shadow: 
        0 6px 20px rgba(0,0,0,0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
.variant-choice-btn.primary {
    background: linear-gradient(
        135deg,
        rgba(243, 194, 17, 0.5) 0%,
        rgba(240, 193, 25, 0.4) 50%,
        rgba(243, 196, 24, 0.5) 100%
    );
    border: 1px solid rgba(245, 216, 110, 0.4);
    color: #fff;
    text-shadow: 0 1px 2px rgba(0,0,0,0.3);
    box-shadow: 
        0 4px 16px rgba(245, 216, 110, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.3),
        inset 0 -1px 0 rgba(179, 152, 46, 0.2);
}
.variant-choice-btn.primary:hover:not(:disabled) {
    background: linear-gradient(
        135deg,
        rgba(245, 213, 99, 0.6) 0%,
        rgba(248, 213, 87, 0.5) 50%,
        rgba(245, 212, 92, 0.6) 100%
    );
    border-color: rgba(245, 216, 110, 0.6);
    transform: translateY(-2px);
    box-shadow: 
        0 8px 24px rgba(245, 216, 110, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
.variant-choice-btn.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none;
}
    `;
    document.head.appendChild(style);
    variantChoiceStylesInjected = true;
}

function showVariantChoiceModal({ title } = {}) {
    ensureVariantChoiceStyles();
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'variant-choice-overlay';
        const optionsMarkup = VARIANT_ORDER.map((key) => {
            const descriptions = {
                full: 'Максимально подробный конспект со всеми деталями.',
                brief: 'Сбалансированный обзор основных идей.',
                compressed: 'Самая сжатая выжимка фактов.',
            };
            return `
                <label class="variant-choice-option" data-variant="${key}">
                    <input type="radio" name="variantChoice" value="${key}">
                    <div>
                        <div class="variant-choice-option-title">${VARIANT_LABELS[key]}</div>
                        <div class="variant-choice-option-desc">${descriptions[key]}</div>
                    </div>
                </label>
            `;
        }).join('');

        overlay.innerHTML = `
            <div class="variant-choice-modal">
                <h3>Выбери формат конспекта</h3>
                ${title ? `<p class="variant-choice-subtitle">${escapeHtml(title)}</p>` : ''}
                <div class="variant-choice-options">
                    ${optionsMarkup}
                </div>
                <div class="variant-choice-actions">
                    <button type="button" class="variant-choice-btn cancel">Отмена</button>
                    <button type="button" class="variant-choice-btn primary" disabled>Продолжить</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const optionNodes = Array.from(overlay.querySelectorAll('.variant-choice-option'));
        const radios = overlay.querySelectorAll('input[name="variantChoice"]');
        const cancelBtn = overlay.querySelector('.variant-choice-btn.cancel');
        const confirmBtn = overlay.querySelector('.variant-choice-btn.primary');
        let selectedValue = null;

        const cleanup = () => {
            overlay.remove();
        };

        const selectOption = (value, element) => {
            selectedValue = value;
            confirmBtn.disabled = !selectedValue;
            optionNodes.forEach((node) => node.classList.remove('active'));
            element.classList.add('active');
            
            // Гарантируем, что радио-кнопка выбрана
            const radio = element.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
            }
        };

        // Автовыбор опции по умолчанию
        const defaultOption = optionNodes.find((node) => node.dataset.variant === 'brief') || optionNodes[0];
        if (defaultOption) {
            selectOption(defaultOption.dataset.variant, defaultOption);
        }

        // Обработчики для выбора опции
        optionNodes.forEach((option) => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                selectOption(option.dataset.variant, option);
            });

            // Также обрабатываем клики по дочерним элементам
            const title = option.querySelector('.variant-choice-option-title');
            const desc = option.querySelector('.variant-choice-option-desc');
            if (title) {
                title.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    selectOption(option.dataset.variant, option);
                });
            }
            if (desc) {
                desc.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    selectOption(option.dataset.variant, option);
                });
            }
        });

        cancelBtn.addEventListener('click', () => {
            cleanup();
            resolve(null);
        });

        confirmBtn.addEventListener('click', () => {
            if (!selectedValue) {
                return;
            }
            cleanup();
            resolve(selectedValue);
        });

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                cleanup();
                resolve(null);
            }
        });

    });
}

   function setupUploadHandlers(app) {
    if (uploadHandlersAttached) {
        return;
    }
    const inputs = Array.from(document.querySelectorAll('#audioUploadInput'));
    const triggers = Array.from(document.querySelectorAll('#uploadAudioButton'));
    if (!inputs.length) {
        return;
    }
    uploadHandlersAttached = true;

    const targetInput = inputs[0];
    const state = {
        pendingVariant: null,
        skipNextClick: false,
    };

    const requestVariant = async (title) => {
        const variant = await showVariantChoiceModal({ title });
        state.pendingVariant = variant || null;
        return variant;
    };

    const openFilePicker = () => {
        state.skipNextClick = true;
        targetInput.click();
    };

    const handleTriggerClick = async (event) => {
        event.preventDefault();
        const title =
            event.currentTarget?.dataset?.variantPrompt || 'Выбрать можно только один';
        const variant = await requestVariant(title);
        if (!variant) {
            return;
        }
        openFilePicker();
    };

    triggers.forEach((trigger) => {
        trigger.addEventListener('click', handleTriggerClick);
    });

    targetInput.addEventListener(
        'click',
        async (event) => {
            if (state.skipNextClick) {
                state.skipNextClick = false;
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            const variant = await requestVariant('Выбрать можно только один');
            if (!variant) {
                return;
            }
            openFilePicker();
        },
        true,
    );

    targetInput.addEventListener('change', async () => {
        if (!targetInput.files || !targetInput.files.length) {
            return;
        }
        const file = targetInput.files[0];
        let loader = null;
        try {
            let variant = state.pendingVariant;
            if (!variant) {
                variant = await requestVariant(file.name);
            }
            if (!variant) {
                targetInput.value = '';
                return;
            }
            state.pendingVariant = null;
            
            // Показываем красивый лоадер вместо app.showLoading
            showConspectLoadingAnimation('Загружаем аудио...', 'Это может занять несколько минут для длинных аудио.');
            
            const audio = await app.uploadAudio(file);
            
            // Обновляем лоадер для создания конспекта
            hideAudioUploadLoader();
            showConspectLoadingAnimation('Создаём конспект...', 'Это может занять несколько минут для длинных аудио.');
            
            const conspect = await app.createConspectFromAudio(audio.id, file.name, {
                variants: [variant],
            });
            
            hideAudioUploadLoader();
            app.notify('Конспект готов!', 'success');
            refreshConspectData(app, conspect.id);
            showConspectModal(conspect, { initialVariant: variant });
        } catch (err) {
            console.error(err);
            hideAudioUploadLoader();
            app.notify(err.message || 'Не удалось обработать аудио', 'error');
        } finally {
            targetInput.value = '';
            state.pendingVariant = null;
        }
    });
}

function showAudioUploadLoader(message = 'Загружаем...', subMessage = '') {
    const loaderHtml = `
        <div class="audio-upload-loader-overlay">
            <div class="audio-upload-loader">
                <div class="loader-circle">
                    <div class="spinner"></div>
                    <div class="pulse"></div>
                </div>
                <div class="loader-content">
                    <h3>${escapeHtml(message)}</h3>
                    ${subMessage ? `<p>${escapeHtml(subMessage)}</p>` : ''}
                </div>
                <div class="liquid-reflection"></div>
            </div>
        </div>
        <style>
            .audio-upload-loader-overlay {
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

            .audio-upload-loader {
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

            .audio-upload-loader::before {
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
    
    // Блокируем скролл
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    window.audioUploadLoader = loaderContainer;
}

function hideAudioUploadLoader() {
    if (window.audioUploadLoader) {
        // Разблокируем скролл
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        
        window.audioUploadLoader.remove();
        window.audioUploadLoader = null;
    }
}



function showConspectLoadingAnimation(message = 'Нейросеть создает конспект...') {
    if (window.conspectLoadingAnimation) return;

    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(70, 70, 70, 0.85);
        backdrop-filter: blur(20px);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        overflow: hidden !important;
    `;
    
    loadingOverlay.innerHTML = `
        <div class="loading-content">
            <div class="loader">
                <div style="--i: 1"></div>
                <div style="--i: 2"></div>
                <div style="--i: 3"></div>
                <div style="--i: 4"></div>
            </div>
            
            <div class="loading-text">${escapeHtml(message)}</div>
            
            <div class="noise"></div>
        </div>
        <div class="hackflow-signature" style="opacity: 0;">by HackFlow</div>
        
        <style>
            .loading-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                position: relative;
                background: linear-gradient(135deg, 
                    rgba(100, 100, 100, 0.9) 0%, 
                    rgba(80, 80, 80, 0.95) 50%, 
                    rgba(100, 100, 100, 0.9) 100%);
                backdrop-filter: blur(15px);
                border: 1px solid rgba(255, 255, 255, 0.25);
                border-radius: 25px;
                padding: 50px 30px;
                box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3),
                            inset 0 1px 0 rgba(255, 255, 255, 0.15),
                            inset 0 -1px 0 rgba(0, 0, 0, 0.2);
                width: 320px;
                height: 320px;
                margin-bottom: 60px;
                overflow: hidden;
            }

            .loading-content::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, 
                    transparent 0%, 
                    rgba(255, 255, 255, 0.12) 50%,
                    transparent 100%);
                opacity: 0.5;
                pointer-events: none;
                border-radius: 25px;
            }

            .loader {
              position: relative;
              display: flex;
              justify-content: center;
              align-items: center;
              margin-bottom: 20px;
              margin-top: 10px;
            }

            .loader::before {
              content: "";
              backdrop-filter: blur(8px);
              position: absolute;
              width: 140px;
              height: 55px;
              z-index: 20;
              border-radius: 0 0 10px 10px;
              border: 1px solid rgba(255, 255, 255, 0.3);
              border-top: none;
              box-shadow: 0 15px 25px rgba(0, 0, 0, 0.25);
              animation: anim2 2s infinite;
            }

            .loader div {
              background: rgb(240, 240, 240);
              border-radius: 50%;
              width: 25px;
              height: 25px;
              z-index: -1;
              animation: anim 2s infinite linear;
              animation-delay: calc(-0.3s * var(--i));
              transform: translateY(5px);
              margin: 0.2em;
              box-shadow: 0 0 15px rgba(255, 255, 255, 0.5);
            }

            .loading-text {
                margin-top: 15px;
                color: white;
                font-size: 16px;
                font-family: 'Manrope', sans-serif;
                text-align: center;
                text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
                font-weight: 600;
                position: relative;
                z-index: 2;
            }

            .hackflow-signature {
                position: fixed;
                bottom: 15px;
                left: 50%;
                transform: translateX(-50%);
                color: rgba(255, 255, 255, 0.9);
                font-family: 'Manrope', Arial, sans-serif;
                font-size: 14px;
                text-align: center;
                user-select: none;
                z-index: 10001;
                opacity: 0;
                transition: opacity 0.5s ease;
                text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
            }

            @keyframes anim {
              0%,
              100% {
                transform: translateY(5px);
              }
              50% {
                transform: translateY(-65px);
              }
            }

            @keyframes anim2 {
              0%,
              100% {
                transform: rotate(-10deg);
              }
              50% {
                transform: rotate(10deg);
              }
            }

            .noise {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAMAAAAp4XiDAAAAUVBMVEWFhYWDg4N3d3dtbW17e3t1dXWBgYGHh4d5eXlzc3OLi4ubm5uVlZWPj4+NjY19fX2JiYl/f39ra2uRkZGZmZlpaWmXl5dvb29xcXGTk5NnZ2c8TV1mAAAAG3RSTlNAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAvEOwtAAAFVklEQVR4XpWWB67c2BUFb3g557T/hRo9/WUMZHlgr4Bg8Z4qQgQJlHI4A8SzFVrapvmTF9O7dmYRFZ60YiBhJRCgh1FYhiLAmdvX0CzTOpNE77ME0Zty/nWWzchDtiqrmQDeuv3owQ5ta2eN0FY0InkqDD73lT9c9lEzwUNqgFHs9VQce3TVClFCQrSTfOiYkVJQBmpbq2L6iZavPnAPcoU0dSw0SUTqz/GtrGuXfbyyBniKykOWQWGqwwMA7QiYAxi+IlPdqo+hYHnUt5ZPfnsHJyNiDtnpJyayNBkF6cWoYGAMY92U2hXHF/C1M8uP/ZtYdiuj26UdAdQQSXQErwSOMzt/XWRWAz5GuSBIkwG1H3fabJ2OsUOUhGC6tK4EMtJO0ttC6IBD3kM0ve0tJwMdSfjZo+EEISaeTr9P3wYrGjXqyC1krcKdhMpxEnt5JetoulscpyzhXN5FRpuPHvbeQaKxFAEB6EN+cYN6xD7RYGpXpNndMmZgM5Dcs3YSNFDHUo2LGfZuukSWyUYirJAdYbF3MfqEKmjM+I2EfhA94iG3L7uKrR+GdWD73ydlIB+6hgref1QTlmgmbM3/LeX5GI1Ux1RWpgxpLuZ2+I+IjzZ8xqE4kilvQdkUdfhzI5QDWy+kw5Wgg2pGpeEVeCCA7b85BO3F9DzxB3cdqvBzWcmzbyMiqhzuYqtHRVG2y4x+KOlnyqva8AoWWpuBoYRxzXrfKuILl6SfiWCbjxoZJUaCBj1CjH7GIaDbc9kqBY3W/Rgjda1iqQcOJu2WW+76pZC9QG7M00dffe9hNnseupFL53r8F7YHSwJWUKP2q+k7RdsxyOB11n0xtOvnW4irMMFNV4H0uqwS5ExsmP9AxbDTc9JwgneAT5vTiUSm1E7BSflSt3bfa1tv8Di3R8n3Af7MNWzs49hmauE2wP+ttrq+AsWpFG2awvsuOqbipWHgtuvuaAE+A1Z/7gC9hesnr+7wqCwG8c5yAg3AL1fm8T9AZtp/bbJGwl1pNrE7RuOX7PeMRUERVaPpEs+yqeoSmuOlokqw49pgomjLeh7icHNlG19yjs6XXOEdYm5xH2YxpV2tc0Ro2jJfxC50ApuxGob7lMsxfTbeUv07TyYxpeLucEH1gNd4IKH2LAg5TdVhlCafZvskfncCfx8pOhJzd76bJWeYFnFciwcYfubRc12Ip/ppIhA1/mSZ/RxjFDrJC5xifFjJpY2Xl5zXdguFqYyTR1zSp1Y9p+tktDYYSNflcxI0iyO4TPBdlRcpeqjK/piF5bklq77VSEaA+z8qmJTFzIWiitbnzR794USKBUaT0NTEsVjZqLaFVqJoPN9ODG70IPbfBHKK+/q/AWR0tNzYHRULOa4MP+W/HfGadZUbfw177G7j/OGbIs8TahLyynl4X4RinF793Mz+BU0saXtUHrVBFT/DnA3ctNPoGbs4hRIjTok8i+algT1lTHi4SxFvONKNrgQFAq2/gFnWMXgwffgYMJpiKYkmW3tTg3ZQ9Jq+f8XN+A5eeUKHWvJWJ2sgJ1Sop+wwhqFVijqWaJhwtD8MNlSBeWNNWTa5Z5kPZw5+LbVT99wqTdx29lMUH4OIG/D86ruKEauBjvH5xy6um/Sfj7ei6UUVk4AIl3MyD4MSSTOFgSwsH/QJWaQ5as7ZcmgBZkzjjU1UrQ74ci1gWBCSGHtuV1H2mhSnO3Wp/3fEV5a+4wz//6qy8JxjZsmxxy5+4w9CDNJY09T072iKG0EnOS0arEYgXqYnXcYHwjTtUNAcMelOd4xpkoqiTYICWFq0JSiPfPDQdnt+4/wuqcXY47QILbgAAAABJRU5ErkJggg==);
                opacity: 0.02;
                pointer-events: none;
                border-radius: 25px;
            }

            /* Адаптивность */
            @media (max-width: 768px) {
                .loading-content {
                    width: 280px;
                    height: 280px;
                    padding: 30px 25px;
                    margin-bottom: 50px;
                }
                
                .loader {
                    margin-top: 8px;
                }
                
                .loader::before {
                    width: 120px;
                    height: 45px;
                }
                
                .loader div {
                    width: 20px;
                    height: 20px;
                }
                
                .loading-text {
                    font-size: 15px;
                    margin-top: 12px;
                }
                
                .hackflow-signature {
                    font-size: 13px;
                }
                
                @keyframes anim {
                    0%,
                    100% {
                        transform: translateY(5px);
                    }
                    50% {
                        transform: translateY(-55px);
                    }
                }
            }

            @media (max-width: 480px) {
                .loading-content {
                    width: 250px;
                    height: 250px;
                    padding: 45px 20px;
                    margin-bottom: 45px;
                }
                
                .loader {
                    margin-top: 5px;
                }
                
                .loader::before {
                    width: 100px;
                    height: 40px;
                }
                
                .loader div {
                    width: 18px;
                    height: 18px;
                    margin: 0.15em;
                }
                
                .loading-text {
                    font-size: 14px;
                    margin-top: 10px;
                }
                
                .hackflow-signature {
                    font-size: 12px;
                }
                
                @keyframes anim {
                    0%,
                    100% {
                        transform: translateY(5px);
                    }
                    50% {
                        transform: translateY(-45px);
                    }
                }
            }
        </style>
    `;

    // Блокируем скролл
    const scrollY = window.scrollY;
    document.body.style.cssText = `
        overflow: hidden !important;
        position: fixed;
        top: -${scrollY}px;
        left: 0;
        right: 0;
        height: 100vh;
    `;
    document.documentElement.style.overflow = 'hidden !important';
    
    document.body.appendChild(loadingOverlay);

    // Сохраняем позицию скролла
    window._scrollY = scrollY;

    requestAnimationFrame(() => {
        loadingOverlay.style.opacity = '1';
    });

    // Появление подписи через 0.5 секунды
    setTimeout(() => {
        const signature = loadingOverlay.querySelector('.hackflow-signature');
        if (signature) {
            signature.style.opacity = '1';
            signature.style.transition = 'opacity 0.5s ease';
        }
    }, 500);

    // Исчезновение подписи за 1 секунду до конца (через 5 секунд от начала)
    setTimeout(() => {
        const signature = loadingOverlay.querySelector('.hackflow-signature');
        if (signature) {
            signature.style.opacity = '0';
            signature.style.transition = 'opacity 0.5s ease';
        }
    }, 5000);
    
    window.conspectLoadingAnimation = {
        overlay: loadingOverlay
    };
}

function hideConspectLoadingAnimation() {
    const elements = window.conspectLoadingAnimation;
    
    if (!elements) return;
    
    // Восстанавливаем скролл
    document.body.style.cssText = '';
    document.documentElement.style.overflow = '';
    
    // Восстанавливаем позицию скролла
    if (window._scrollY !== undefined) {
        window.scrollTo(0, window._scrollY);
        window._scrollY = undefined;
    }
    
    if (elements.overlay) {
        elements.overlay.style.opacity = '0';
        setTimeout(() => {
            if (elements.overlay.parentNode) {
                elements.overlay.parentNode.removeChild(elements.overlay);
            }
        }, 500);
    }

    window.conspectLoadingAnimation = null;
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
        // Загружаем медали
        try {
            const medals = await app.getMyMedals();
            displayMedals(medals);
        } catch (err) {
            console.error('Failed to load medals:', err);
        }
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

    // Устанавливаем стили для текста загрузки
    container.style.cssText = `
        color: #fff;
        text-align: center;
        padding: 40px 20px;
        font-size: 16px;
        font-weight: 500;
    `;
    
    container.textContent = 'Загружаем конспекты...';
    
    try {
        const data = await app.authFetch('/conspects');
        // Убираем стили загрузки перед рендером конспектов
        container.style.cssText = '';
        renderConspectList(container, data.items.slice(0, 10));
        attachConspectDetailsHandlers(app, container);
    } catch (err) {
        console.error(err);
        container.style.cssText = `
            color: #ffffffff;
            text-align: center;
            padding: 40px 20px;
            font-size: 16px;
            font-weight: 500;
        `;
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

    function displayMedals(medals) {
        const display = document.getElementById('medalsDisplay');
        if (!display) return;
        
        if (medals.total_medals === 0) {
            display.style.display = 'none';
            return;
        }
        
        display.style.display = 'block';
        document.getElementById('goldCount').textContent = medals.gold_count || 0;
        document.getElementById('silverCount').textContent = medals.silver_count || 0;
        document.getElementById('bronzeCount').textContent = medals.bronze_count || 0;
        document.getElementById('totalMedals').textContent = medals.total_medals || 0;
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
                const variant = await showVariantChoiceModal({
                    title: titleInput?.value.trim() || 'Новый конспект',
                });
                if (!variant) {
                    return;
                }
                
                // Показываем новую анимацию вместо стандартного loading
                showConspectCreateAnimation();
                
                const conspect = await app.createConspectFromText(
                    textInput.value.trim(),
                    titleInput.value.trim(),
                    { variants: [variant] },
                );
                
                // Скрываем анимацию
                hideConspectCreateAnimation();
                
                app.notify('Конспект готов!', 'success');
                await loadConspectDetails(app, conspect.id);
                showConspectModal(conspect, { initialVariant: variant });
                textInput.value = '';
                titleInput.value = '';
            } catch (err) {
                console.error(err);
                // Скрываем анимацию в случае ошибки
                hideConspectCreateAnimation();
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
            window.copyToClipboard(shareUrl).then((success) => {
                if (success) {
                    app.notify('Ссылка скопирована в буфер обмена', 'success');
                } else {
                    prompt('Скопируйте ссылку:', shareUrl);
                }
            });
        });
    }
}

function showConspectCreateAnimation() {
    if (window.conspectCreateAnimation) return;

    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(70, 70, 70, 0.85);
        backdrop-filter: blur(20px);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        overflow: hidden; /* Добавляем это */
    `;
    
    loadingOverlay.innerHTML = `
        <div class="loading-content">
            <div class="loader">
                <div style="--i: 1"></div>
                <div style="--i: 2"></div>
                <div style="--i: 3"></div>
                <div style="--i: 4"></div>
            </div>
            
            <div class="loading-text">Нейросеть создает конспект..</div>
            
            <div class="noise"></div>
        </div>
        <div class="hackflow-signature" style="opacity: 0;">by HackFlow</div>
    `;
    
    // БЛОКИРУЕМ СКРОЛЛ ПЕРЕД ДОБАВЛЕНИЕМ В DOM
    const scrollY = window.scrollY;
    document.body.style.cssText = `
        overflow: hidden !important;
        position: fixed;
        top: -${scrollY}px;
        left: 0;
        right: 0;
        height: 100vh;
    `;
    
    document.documentElement.style.overflow = 'hidden !important';
    
    document.body.appendChild(loadingOverlay);

    // Сохраняем позицию скролла
    window._scrollY = scrollY;

    requestAnimationFrame(() => {
        loadingOverlay.style.opacity = '1';
    });

    // Появление подписи через 0.5 секунды
    setTimeout(() => {
        const signature = loadingOverlay.querySelector('.hackflow-signature');
        if (signature) {
            signature.style.opacity = '1';
            signature.style.transition = 'opacity 0.5s ease';
        }
    }, 500);

    // Исчезновение подписи за 1 секунду до конца (через 5 секунд от начала)
    setTimeout(() => {
        const signature = loadingOverlay.querySelector('.hackflow-signature');
        if (signature) {
            signature.style.opacity = '0';
            signature.style.transition = 'opacity 0.5s ease';
        }
    }, 5000);
    
    window.conspectCreateAnimation = {
        overlay: loadingOverlay
    };
}

function hideConspectCreateAnimation() {
    const elements = window.conspectCreateAnimation;
    
    if (!elements) return;
    
    // ВОССТАНАВЛИВАЕМ СКРОЛЛ ДО УДАЛЕНИЯ ОВЕРЛЕЯ
    document.body.style.cssText = '';
    document.documentElement.style.overflow = '';
    
    // Восстанавливаем позицию скролла
    if (window._scrollY !== undefined) {
        window.scrollTo(0, window._scrollY);
        window._scrollY = undefined;
    }
    
    if (elements.overlay) {
        elements.overlay.style.opacity = '0';
        setTimeout(() => {
            if (elements.overlay.parentNode) {
                elements.overlay.parentNode.removeChild(elements.overlay);
            }
        }, 500);
    }

    window.conspectCreateAnimation = null;
}

async function loadConspectDetails(app, conspectId) {
    showConspectLoadingAnimation('Загружаем конспект...');
    
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
            const preferredMarkdown = getPreferredMarkdown(conspect);
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
    } finally {
        hideConspectLoadingAnimation();
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
            shareBtn.addEventListener('click', async () => {
                const app = window.ConspectiumApp;
                if (!app) return;
                
                // Показываем модальное окно для выбора теста
                try {
                    await app.ready();
                    const quizzes = await app.authFetch('/quizzes');
                    if (!quizzes.items || quizzes.items.length === 0) {
                        app.notify('У тебя пока нет тестов для шаринга', 'info');
                        return;
                    }
                    showQuizShareModal(app, quizzes.items);
                } catch (err) {
                    console.error(err);
                    app.notify('Не удалось загрузить список тестов', 'error');
                }
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

        // Блокируем скролл фона
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

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

.modal-meta-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
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

.variant-btn.variant-btn--add {
    border-style: dashed;
    opacity: 0.8;
}

.variant-btn.variant-btn--add:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.25);
    opacity: 1;
}

.meta-copy-btn + .meta-copy-btn {
    margin-left: 8px;
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

.public-conspect-actions {
    display: flex;
    gap: 12px;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.15);
}

.public-conspect-actions .accent-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    font-size: 15px;
    font-weight: 600;
    border-radius: 12px;
    transition: all 0.3s ease;
}

.public-conspect-actions .accent-btn.secondary {
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #fff;
}

.public-conspect-actions .accent-btn.secondary:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.25);
}

@media (max-width: 480px) {
    .public-conspect-actions {
        flex-direction: column;
        gap: 10px;
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

    let activeConspect = conspect;
    const variantState = {
        full: conspect.full_markdown,
        brief: conspect.brief_markdown,
        compressed: conspect.compressed_markdown,
    };

    const determineDefaultVariant = (initialKey) => {
        if (initialKey && (variantState[initialKey] || initialKey === 'summary')) {
            return initialKey;
        }
        if (variantState.brief) return 'brief';
        if (variantState.compressed) return 'compressed';
        if (variantState.full) return 'full';
        return 'summary';
    };

    const keyPoints = (conspect.keywords || []).map((point) => `<li>${escapeHtml(point)}</li>`).join('');
    const isOffline = conspect.model_used === 'offline-fallback';

    conspectModalOverlay = document.createElement('div');
    conspectModalOverlay.className = 'conspect-modal-overlay';

    conspectModalOverlay.innerHTML = `
        <div class="conspect-modal">
            <div class="modal-header">
                <div class="modal-header-content">
                    <h2>${escapeHtml(conspect.title || 'Без названия')}</h2>
                    <div class="modal-meta-row">
                        ${createdAt ? `<p class="modal-meta">Создан: ${escapeHtml(createdAt)}</p>` : ''}
                        <div class="modal-meta-buttons">
                            <button class="meta-copy-btn copy-btn" title="Копировать конспект">
                                <i class="fas fa-copy"></i>
                            </button>
                            ${
                                !options.isPublic && conspect.id
                                    ? `<button class="meta-copy-btn share-btn" data-conspect-id="${conspect.id}" title="Поделиться конспектом"><i class="fas fa-share"></i></button>`
                                    : ''
                            }
                            ${
                                conspect.audio_source_id
                                    ? `<button class="meta-copy-btn download-btn" data-audio-id="${conspect.audio_source_id}" title="Скачать аудио"><i class="fas fa-download"></i></button>`
                                    : ''
                            }
                        </div>
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
                <div class="modal-variant-toggle"></div>
                <div class="modal-summary markdown-viewer"></div>
                ${keyPoints ? `
                    <h3>Ключевые идеи</h3>
                    <ul class="modal-keypoints">${keyPoints}</ul>
                ` : ''}
                ${options.isPublic ? `
                    <div class="public-conspect-actions">
                        <button class="accent-btn save-conspect-btn" id="saveConspectBtn">
                            <i class="fas fa-save"></i>
                            <span>Сохранить</span>
                        </button>
                        <button class="accent-btn secondary exit-conspect-btn" id="exitConspectBtn">
                            <i class="fas fa-sign-out-alt"></i>
                            <span>Выйти</span>
                        </button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    document.body.appendChild(conspectModalOverlay);
    requestAnimationFrame(() => {
        conspectModalOverlay.classList.add('visible');
    });

    const summaryContainer = conspectModalOverlay.querySelector('.modal-summary');
    const variantToggle = conspectModalOverlay.querySelector('.modal-variant-toggle');
    const copyButton = conspectModalOverlay.querySelector('.meta-copy-btn.copy-btn');
    const shareButton = conspectModalOverlay.querySelector('.meta-copy-btn.share-btn');
    const downloadButton = conspectModalOverlay.querySelector('.meta-copy-btn.download-btn');
    const originalCopyHtml = copyButton ? copyButton.innerHTML : '';
    const originalShareHtml = shareButton ? shareButton.innerHTML : '';
    let currentVariantKey = determineDefaultVariant(options.initialVariant);
    // Убеждаемся, что markdown правильно извлекается
    let currentVariantMarkdown = '';
    if (currentVariantKey === 'summary') {
        currentVariantMarkdown = activeConspect.summary || '';
    } else {
        currentVariantMarkdown = variantState[currentVariantKey] || '';
    }
    let variantButtons = [];

    const updateVariantButtonsState = () => {
        variantButtons.forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.variant === currentVariantKey);
        });
    };

    const updateVariant = (key) => {
        currentVariantKey = key;
        if (key === 'summary') {
            currentVariantMarkdown = activeConspect.summary || '';
            if (summaryContainer) {
                summaryContainer.innerHTML = renderMarkdown(currentVariantMarkdown);
            }
        } else if (variantState[key]) {
            currentVariantMarkdown = variantState[key];
            if (summaryContainer) {
                summaryContainer.innerHTML = renderMarkdown(variantState[key]);
            }
        } else if (summaryContainer) {
            currentVariantMarkdown = '';
            summaryContainer.innerHTML = '<p>Этот вариант пока не создан.</p>';
        }
        updateVariantButtonsState();
    };

    const appInstance = window.ConspectiumApp;

    const requestVariantGeneration = async (variantKey) => {
        if (!appInstance) return;
        try {
            appInstance.showLoading('Готовим новый вариант...');
            const updated = await appInstance.generateConspectVariant(activeConspect.id, variantKey);
            appInstance.hideLoading();
            activeConspect = updated;
            variantState.full = updated.full_markdown;
            variantState.brief = updated.brief_markdown;
            variantState.compressed = updated.compressed_markdown;
            renderVariantButtons();
            updateVariant(variantKey);
        } catch (error) {
            console.error(error);
            appInstance.hideLoading();
            appInstance.notify(error.message || 'Не удалось создать вариант', 'error');
        }
    };

    const renderVariantButtons = () => {
        if (!variantToggle) return;
        variantToggle.innerHTML = '';
        VARIANT_ORDER.forEach((key) => {
            const button = document.createElement('button');
            button.className = 'variant-btn';
            button.dataset.variant = key;
            if (variantState[key]) {
                button.textContent = VARIANT_LABELS[key];
                button.addEventListener('click', () => updateVariant(key));
            } else {
                button.textContent = `${VARIANT_LABELS[key]} +`;
                button.classList.add('variant-btn--add');
                button.addEventListener('click', () => requestVariantGeneration(key));
            }
            variantToggle.appendChild(button);
        });
        variantButtons = Array.from(variantToggle.querySelectorAll('.variant-btn:not(.variant-btn--add)'));
        updateVariantButtonsState();
    };

    renderVariantButtons();
    updateVariant(currentVariantKey);

    const closeButton = conspectModalOverlay.querySelector('.close-btn');
    if (closeButton) {
        closeButton.addEventListener('click', closeConspectModal);
    }

    if (downloadButton && appInstance) {
        downloadButton.addEventListener('click', async () => {
            try {
                appInstance.showLoading('Готовим аудио...');
                await appInstance.downloadAudioSource(Number(downloadButton.dataset.audioId));
                appInstance.hideLoading();
            } catch (error) {
                console.error(error);
                appInstance.hideLoading();
                appInstance.notify(error.message || 'Не удалось скачать аудио', 'error');
            }
        });
    }

    if (copyButton) {
        copyButton.addEventListener('click', () => {
            copyConspectToClipboard(activeConspect, currentVariantKey, currentVariantMarkdown)
                .then(() => {
                    appInstance?.notify('Конспект скопирован в буфер обмена', 'success');
                    copyButton.innerHTML = '<i class="fas fa-check"></i>';
                    copyButton.classList.add('copied');
                    setTimeout(() => {
                        copyButton.innerHTML = originalCopyHtml;
                        copyButton.classList.remove('copied');
                    }, 2000);
                })
                .catch((err) => {
                    console.error('Ошибка копирования: ', err);
                    appInstance?.notify('Не удалось скопировать конспект', 'error');
                });
        });
    }

    if (shareButton && appInstance) {
        shareButton.addEventListener('click', async () => {
            try {
                const conspectId = Number(shareButton.dataset.conspectId);
                if (!conspectId) {
                    appInstance.notify('Не удалось определить конспект', 'error');
                    return;
                }
                
                appInstance.showLoading('Генерируем ссылку...');
                const shareToken = await appInstance.getShareToken('conspect', conspectId);
                const shareUrl = `${window.location.origin}/front/html/conspect_shared.html?token=${shareToken}`;
                const success = await window.copyToClipboard(shareUrl);
                appInstance.hideLoading();
                if (success) {
                    appInstance.notify('Ссылка скопирована в буфер обмена!', 'success');
                } else {
                    prompt('Скопируйте ссылку:', shareUrl);
                }
                
                shareButton.innerHTML = '<i class="fas fa-check"></i>';
                shareButton.classList.add('copied');
                setTimeout(() => {
                    shareButton.innerHTML = originalShareHtml;
                    shareButton.classList.remove('copied');
                }, 2000);
            } catch (err) {
                console.error(err);
                appInstance.hideLoading();
                appInstance.notify(err.message || 'Не удалось создать ссылку', 'error');
            }
        });
    }

    // Обработчики для публичных конспектов
    if (options.isPublic && options.shareToken) {
        const saveBtn = conspectModalOverlay.querySelector('#saveConspectBtn');
        const exitBtn = conspectModalOverlay.querySelector('#exitConspectBtn');
        const shareToken = options.shareToken;

        if (saveBtn && appInstance) {
            saveBtn.addEventListener('click', async () => {
                try {
                    saveBtn.disabled = true;
                    appInstance.showLoading('Сохраняем конспект...');
                    const savedConspect = await appInstance.saveSharedConspect(shareToken);
                    appInstance.hideLoading();
                    appInstance.notify('Конспект успешно сохранен!', 'success');
                    // Обновляем конспект, чтобы он стал "своим"
                    activeConspect = savedConspect;
                    // Можно закрыть модальное окно или обновить его
                    setTimeout(() => {
                        closeConspectModal();
                        window.location.href = '/front/html/main.html';
                    }, 1500);
                } catch (err) {
                    console.error(err);
                    appInstance.hideLoading();
                    saveBtn.disabled = false;
                    const errorMessage = err.message || 'Не удалось сохранить конспект';
                    if (errorMessage.includes('уже') || errorMessage.includes('существует')) {
                        appInstance.notify('Конспект уже сохранен в вашем списке', 'info');
                    } else {
                        appInstance.notify(errorMessage, 'error');
                    }
                }
            });
        }

        if (exitBtn) {
            exitBtn.addEventListener('click', () => {
                closeConspectModal();
                window.location.href = '/front/html/main.html';
            });
        }
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

async function copyConspectToClipboard(conspect, variantKey, markdown) {
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
    return window.copyToClipboard(lines.join('\n').trim());
}



function closeConspectModal() {
        // Разблокируем скролл фона
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';

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

function showQuizShareModal(app, quizzes) {
    const existingModal = document.querySelector('.quiz-share-modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'quiz-share-modal-overlay';
    modalOverlay.innerHTML = `
        <div class="quiz-share-modal">
            <div class="modal-header">
                <h2>Выбери тест для шаринга</h2>
                <button class="close-btn" onclick="this.closest('.quiz-share-modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="quiz-list" id="shareQuizList"></div>
            </div>
        </div>
    `;

    const quizList = modalOverlay.querySelector('#shareQuizList');
    quizzes.forEach(quiz => {
        const item = document.createElement('div');
        item.className = 'quiz-share-item';
        item.innerHTML = `
            <div class="quiz-title">${quiz.title || 'Без названия'}</div>
            <button class="share-btn" data-quiz-id="${quiz.id}">
                <i class="fas fa-share"></i>
            </button>
        `;
        const shareBtn = item.querySelector('.share-btn');
        shareBtn.addEventListener('click', async () => {
            try {
                app.showLoading('Генерируем ссылку...');
                const shareToken = await app.getShareToken('quiz', quiz.id);
                const shareUrl = `${window.location.origin}/front/html/quiz_shared.html?token=${shareToken}`;
                const success = await window.copyToClipboard(shareUrl);
                app.hideLoading();
                if (success) {
                    app.notify('Ссылка скопирована в буфер обмена!', 'success');
                } else {
                    prompt('Скопируйте ссылку:', shareUrl);
                }
                modalOverlay.remove();
            } catch (err) {
                console.error(err);
                app.hideLoading();
                app.notify(err.message || 'Не удалось создать ссылку', 'error');
            }
        });
        quizList.appendChild(item);
    });

    document.body.appendChild(modalOverlay);
    setTimeout(() => modalOverlay.classList.add('visible'), 10);
}

function showNotification(message, type = 'info') {
    const containerClass = 'app-toast-container';
    let container = document.querySelector(`.${containerClass}`);
    if (!container) {
        container = document.createElement('div');
        container.className = containerClass;
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `app-toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('visible');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => {
            toast.remove();
            if (!container.children.length) {
                container.remove();
            }
        }, 300);
    }, 4000);
}

