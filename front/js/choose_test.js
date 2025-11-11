(() => {
    let activeItem = null;
    let selectedConspectId = null;

    const app = () => window.ConspectiumApp;

    document.addEventListener('DOMContentLoaded', () => {
        if (!document.body.classList.contains('page-choose-test')) {
            return;
        }

        const container = document.getElementById('chooseConspectList');
        if (!container) return;

        container.addEventListener('click', (event) => {
            const item = event.target.closest('.conspect-item');
            if (!item) return;
            event.stopPropagation();
            toggleSelection(item);
        });

        document.addEventListener('click', () => {
            clearSelection();
        });

        container.addEventListener('scroll', () => clearSelection());

        const params = new URLSearchParams(window.location.search);
        const preselectId = params.get('conspectId');
        if (preselectId) {
            selectedConspectId = parseInt(preselectId, 10);
        }
    });

    document.addEventListener('conspects:selectable-updated', (event) => {
        if (!document.body.classList.contains('page-choose-test')) {
            return;
        }

        const { items } = event.detail || {};
        if (!items || !items.length) return;

        const params = new URLSearchParams(window.location.search);
        const preselectId = params.get('conspectId');
        if (preselectId) {
            const container = document.getElementById('chooseConspectList');
            const target = container?.querySelector(`.conspect-item[data-conspect-id="${preselectId}"]`);
            if (target) {
                toggleSelection(target, { skipToggle: true });
                showButtons(target);
                selectedConspectId = parseInt(preselectId, 10);
            }
        }
    });

    function toggleSelection(item, options = {}) {
        if (activeItem === item && !options.skipToggle) {
            clearSelection();
            return;
        }

        clearSelection();
        activeItem = item;
        item.classList.add('active');
        selectedConspectId = parseInt(item.dataset.conspectId || '0', 10) || null;
        showButtons(item);
    }

function showButtons(item) {
    if (!item) return;

    const existing = item.querySelector('.item-buttons');
    if (existing) {
        existing.remove();
    }

    const buttons = document.createElement('div');
    buttons.className = 'item-buttons';
    buttons.innerHTML = `
        <button class="action-btn liquid-glass open-conspect-btn">
            <span>Открыть</span>
        </button>
        <button class="action-btn liquid-glass create-test-btn">
            <span>Создать тест</span>
        </button>
    `;

    const styles = `
        .item-buttons {
            display: flex;
            gap: 10px;
            width: 100%;
            justify-content: space-between;
        }
        
        .action-btn.liquid-glass {
            position: relative;
            background: linear-gradient(
                135deg,
                rgba(255, 255, 255, 0.15) 0%,
                rgba(255, 255, 255, 0.08) 50%,
                rgba(255, 255, 255, 0.15) 100%
            );
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: #fff;
            font-family: 'Manrope', sans-serif;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            padding: 12px 16px;
            transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            box-shadow: 
                0 4px 20px rgba(0, 0, 0, 0.15),
                inset 0 1px 0 rgba(255, 255, 255, 0.25),
                inset 0 -1px 0 rgba(0, 0, 0, 0.1);
            overflow: hidden;
            border: none;
            flex: 1;
            min-height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            white-space: nowrap;
            min-width: 0;
        }
        
        /* Левая кнопка - Открыть */
        .open-conspect-btn {
            margin-right: auto;
        }
        
        /* Правая кнопка - Создать тест */
        .create-test-btn {
            margin-left: auto;
        }
        
        .action-btn.liquid-glass::before {
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
            border-radius: 12px;
            opacity: 0.6;
            pointer-events: none;
        }
        
        .action-btn.liquid-glass::after {
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
                rgba(255, 255, 255, 0.15),
                rgba(255, 255, 255, 0.08)
            );
            border-radius: 13px;
            z-index: -1;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
        }
        
        .action-btn.liquid-glass:hover::after {
            opacity: 1;
        }
        
        .action-btn.liquid-glass span {
            position: relative;
            z-index: 2;
            text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
            transition: all 0.3s ease;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .action-btn.liquid-glass:hover {
            transform: translateY(-2px) scale(1.02);
            background: linear-gradient(
                135deg,
                rgba(255, 255, 255, 0.2) 0%,
                rgba(255, 255, 255, 0.12) 50%,
                rgba(255, 255, 255, 0.2) 100%
            );
            border: 1px solid rgba(255, 255, 255, 0.25);
            box-shadow: 
                0 8px 25px rgba(0, 0, 0, 0.2),
                inset 0 1px 0 rgba(255, 255, 255, 0.3),
                inset 0 -1px 0 rgba(0, 0, 0, 0.08);
        }
        
        .action-btn.liquid-glass:hover span {
            text-shadow: 
                0 1px 4px rgba(0, 0, 0, 0.4),
                0 0 12px rgba(255, 255, 255, 0.3);
        }
        
        /* Адаптивность для мобильных */
        @media (max-width: 480px) {
            .item-buttons {
                gap: 8px;
            }
            
            .action-btn.liquid-glass {
                padding: 10px 12px;
                font-size: 13px;
                min-height: 40px;
            }
            
            .action-btn.liquid-glass span {
                font-size: 12px;
            }
        }

        @media (max-width: 360px) {
            .action-btn.liquid-glass {
                padding: 8px 10px;
                font-size: 12px;
                min-height: 38px;
            }
            
            .action-btn.liquid-glass span {
                font-size: 11px;
            }
        }
    `;

    if (!document.getElementById('liquid-glass-buttons-styles')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'liquid-glass-buttons-styles';
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }

    item.appendChild(buttons);

    const openBtn = buttons.querySelector('.open-conspect-btn');
    const createBtn = buttons.querySelector('.create-test-btn');

    if (openBtn) {
        openBtn.addEventListener('click', async (event) => {
            event.stopPropagation();
            if (!selectedConspectId) return;
            
            try {
                const appInstance = app();
                appInstance.showLoading('Загружаем конспект...');
                const conspect = await appInstance.authFetch(`/conspects/${selectedConspectId}`);
                appInstance.hideLoading();
                
                showConspectModalInChoose(conspect);
            } catch (err) {
                console.error(err);
                const appInstance = app();
                appInstance.hideLoading();
                appInstance.notify('Не удалось загрузить конспект', 'error');
            }
        });
    }

        if (createBtn) {
            createBtn.addEventListener('click', async (event) => {
                event.stopPropagation();
                if (!selectedConspectId) return;
                
                // Ждем инициализации слайдера, если он еще не готов
                const waitForSlider = () => {
                    return new Promise((resolve) => {
                        if (window.testSettingsModal) {
                            resolve(window.testSettingsModal);
                        } else {
                            // Ждем до 2 секунд
                            let attempts = 0;
                            const checkInterval = setInterval(() => {
                                attempts++;
                                if (window.testSettingsModal) {
                                    clearInterval(checkInterval);
                                    resolve(window.testSettingsModal);
                                } else if (attempts > 40) { // 2 секунды (40 * 50ms)
                                    clearInterval(checkInterval);
                                    resolve(null);
                                }
                            }, 50);
                        }
                    });
                };
                
                const modal = await waitForSlider();
                
                if (modal) {
                    // Показываем слайдер для выбора количества вопросов
                    modal.setOnCreateCallback((testData) => {
                        const questionsCount = testData.questionsCount || 5;
                        createQuiz(selectedConspectId, questionsCount);
                    });
                    modal.show();
                } else {
                    // Если слайдер не загружен, используем значение по умолчанию
                    await createQuiz(selectedConspectId, 5);
                }
            });
        }

        requestAnimationFrame(() => {
            buttons.style.opacity = '1';
        });
    }

    function clearSelection() {
        if (activeItem) {
            activeItem.classList.remove('active');
            const buttons = activeItem.querySelector('.item-buttons');
            if (buttons) {
                buttons.remove();
            }
        }
        activeItem = null;
    }

async function createQuiz(conspectId, questionsCount = 5) {
    const appInstance = app();
    
    showWizardAnimation();
    
    const startTime = Date.now();
    const totalAnimationTime = 6000; 
    
    try {
        const quizId = await appInstance.createQuizFromConspect(conspectId, questionsCount);
        
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(totalAnimationTime - elapsedTime, 0);
        
        await new Promise(resolve => setTimeout(resolve, remainingTime));

        hideWizardAnimation();
        
        appInstance.notify('Тест готов!', 'success');
        window.location.href = `test.html?quizId=${quizId}`;
        
    } catch (err) {
        console.error(err);

        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(totalAnimationTime - elapsedTime, 0);

        await new Promise(resolve => setTimeout(resolve, remainingTime));

        hideWizardAnimation();
        appInstance.notify(err.message || 'Не удалось создать тест', 'error');
    }
}

function showWizardAnimation() {
    if (window.wizardElements && window.wizardElements.overlay) return;

    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.style.opacity = '0';
    loadingOverlay.style.transition = 'opacity 0.25s ease';
    loadingOverlay.style.zIndex = '20000';
    loadingOverlay.style.pointerEvents = 'auto';
    
    loadingOverlay.innerHTML = `
        <div class="loading-content">
            <div class="loader">
                <div style="--i: 1"></div>
                <div style="--i: 2"></div>
                <div style="--i: 3"></div>
                <div style="--i: 4"></div>
            </div>
            
            <div class="loading-text">Нейросеть создает тест..</div>
            
            <div class="noise"></div>
        </div>
        <div class="hackflow-signature" style="opacity: 0;">by HackFlow</div>
    `;
    
    document.body.appendChild(loadingOverlay);

    try {
        window._prevBodyOverflow = document.body.style.overflow;
    } catch (e) {
        window._prevBodyOverflow = '';
    }
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            loadingOverlay.style.opacity = '1';
        });
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
    
    window.wizardElements = {
        overlay: loadingOverlay
    };
}

function hideWizardAnimation() {
    const elements = window.wizardElements;
    
    if (!elements) return;
    
    if (elements.signature) {
        elements.signature.style.opacity = '0';
        elements.signature.style.transition = 'opacity 0.3s ease';
        
        setTimeout(() => {
            if (elements.signature.parentNode) {
                elements.signature.parentNode.removeChild(elements.signature);
            }
        }, 300);
    }
    
    if (elements.overlay) {
        elements.overlay.style.opacity = '0';
        elements.overlay.style.transition = 'opacity 0.5s ease';
        
        setTimeout(() => {
            if (elements.overlay.parentNode) {
                elements.overlay.parentNode.removeChild(elements.overlay);
            }
        }, 500);
    }
    
    try {
        if (window._prevBodyOverflow !== undefined) {
            document.body.style.overflow = window._prevBodyOverflow || '';
            window._prevBodyOverflow = undefined;
        } else {
            document.body.style.overflow = '';
        }
    } catch (e) {
        // ignore
    }

    window.wizardElements = null;
    }

    const signatureStyles = `
    .hackflow-signature {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        font-family: 'Manrope', Arial, sans-serif;
        font-size: 14px;
        color: #888888;
        z-index: 10001;
        pointer-events: none;
        user-select: none;
        opacity: 0;
        transition: opacity 0.5s ease;
        text-align: center;
        width: 100%;
    }

    /* Для темного фона анимации */
    .loading-overlay ~ .hackflow-signature {
        color: #cccccc;
    }

    /* Адаптивность для мобильных */
    @media (max-width: 768px) {
        .hackflow-signature {
            font-size: 12px;
            bottom: 15px;
        }
    }
    `;

    const signatureStyleSheet = document.createElement('style');
    signatureStyleSheet.textContent = signatureStyles;
    document.head.appendChild(signatureStyleSheet);
})();

function showConspectModalInChoose(conspect) {
    const existingModal = document.querySelector('.conspect-modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }

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
    
    if (!document.getElementById('choose-modal-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'choose-modal-styles';
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

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'conspect-modal-overlay';

    modalOverlay.innerHTML = `
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

    document.body.appendChild(modalOverlay);
    
    setTimeout(() => {
        modalOverlay.classList.add('visible');
    }, 10);

    const closeButton = modalOverlay.querySelector('.close-btn');
    const copyButton = modalOverlay.querySelector('.meta-copy-btn');

    closeButton.addEventListener('click', () => {
        modalOverlay.classList.remove('visible');
        setTimeout(() => {
            modalOverlay.remove();
        }, 300);
    });

    copyButton.addEventListener('click', () => {
        const keyPointsText = conspect.keywords ? conspect.keywords.map(point => `• ${point}`).join('\n') : '';
        const textToCopy = `
${conspect.title || 'Без названия'}

${conspect.summary || 'Описание отсутствует.'}

${keyPointsText ? 'Ключевые идеи:\n' + keyPointsText : ''}
        `.trim();

        navigator.clipboard.writeText(textToCopy).then(() => {
            if (window.ConspectiumApp) {
                window.ConspectiumApp.notify('Конспект скопирован в буфер обмена', 'success');
            }
            
            copyButton.innerHTML = '<i class="fas fa-check"></i>';
            copyButton.style.color = '#b9b9b5ff;';
            
            setTimeout(() => {
                copyButton.innerHTML = '<i class="fas fa-copy"></i>';
                copyButton.style.color = '';
            }, 2000);
        }).catch(err => {
            console.error('Ошибка копирования:', err);
            if (window.ConspectiumApp) {
                window.ConspectiumApp.notify('Не удалось скопировать конспект', 'error');
            }
        });
    });

    modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay) {
            modalOverlay.classList.remove('visible');
            setTimeout(() => {
                modalOverlay.remove();
            }, 300);
        }
    });

    const escHandler = (event) => {
        if (event.key === 'Escape') {
            modalOverlay.classList.remove('visible');
            setTimeout(() => {
                modalOverlay.remove();
                document.removeEventListener('keydown', escHandler);
            }, 300);
        }
    };
    document.addEventListener('keydown', escHandler);
}