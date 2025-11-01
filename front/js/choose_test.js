document.addEventListener('DOMContentLoaded', function() {
    let activeItem = null;
    
    // Обработчик клика на элементы конспекта
    document.querySelectorAll('.item-content').forEach(item => {
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            
            // Если кликнули на уже активный элемент - скрываем кнопки
            if (this === activeItem) {
                hideButtons();
                activeItem = null;
                return;
            }
            
            // Скрываем кнопки на предыдущем активном элементе
            if (activeItem) {
                hideButtons();
            }
            
            // Показываем кнопки на текущем элементе
            showButtons(this);
            activeItem = this;
        });
    });
    
    // Скрываем кнопки при клике вне элементов
    document.addEventListener('click', function() {
        if (activeItem) {
            hideButtons();
            activeItem = null;
        }
    });
    
    // Скрываем кнопки при скролле
    const conspectList = document.querySelector('.conspect-list');
    if (conspectList) {
        conspectList.addEventListener('scroll', function() {
            if (activeItem) {
                hideButtons();
                activeItem = null;
            }
        });
    }
    
    function showButtons(item) {
        // Добавляем класс active родителю
        const itemParent = item.parentNode;
        itemParent.classList.add('active');
        
        // Создаем контейнер для кнопок
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'item-buttons';
        
        // Создаем кнопки
        buttonsContainer.innerHTML = `
            <button class="action-btn open-conspect-btn">Открыть конспект</button>
            <button class="action-btn create-test-btn">Создать тест</button>
        `;
        
        // Позиционируем кнопки абсолютно поверх текста
        itemParent.style.position = 'relative';
        buttonsContainer.style.position = 'absolute';
        buttonsContainer.style.top = '50%';
        buttonsContainer.style.left = '0';
        buttonsContainer.style.right = '0';
        buttonsContainer.style.transform = 'translateY(-50%)';
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.justifyContent = 'space-between';
        buttonsContainer.style.alignItems = 'center';
        buttonsContainer.style.padding = '0 20px';
        buttonsContainer.style.opacity = '0';
        buttonsContainer.style.transition = 'opacity 0.3s ease';
        buttonsContainer.style.zIndex = '10';
        
        // Добавляем контейнер в родительский элемент
        itemParent.appendChild(buttonsContainer);
        
        // Анимация появления
        setTimeout(() => {
            buttonsContainer.style.opacity = '1';
        }, 10);
        
        // Обработчики для кнопок
        const createBtn = buttonsContainer.querySelector('.create-test-btn');
        const openBtn = buttonsContainer.querySelector('.open-conspect-btn');
        
        createBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            
            // Создаем overlay для загрузки
            const loadingOverlay = document.createElement('div');
            loadingOverlay.className = 'loading-overlay';
            
            loadingOverlay.innerHTML = `
                <div class="loading-content">
                    <div class="scene">
                        <div class="objects">
                            <div class="square"></div>
                            <div class="circle"></div>
                            <div class="triangle"></div>
                        </div>
                        <div class="wizard">
                            <div class="body"></div>
                            <div class="right-arm">
                                <div class="right-hand"></div>
                            </div>
                            <div class="left-arm">
                                <div class="left-hand"></div>
                            </div>
                            <div class="head">
                                <div class="beard"></div>
                                <div class="face">
                                    <div class="adds"></div>
                                </div>
                                <div class="hat">
                                    <div class="hat-of-the-hat"></div>
                                    <div class="four-point-star --first"></div>
                                    <div class="four-point-star --second"></div>
                                    <div class="four-point-star --third"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="progress"></div>
                    <div class="loading-text">Нейросеть создает тест..</div>
                    
                    <div class="noise"></div>
                </div>
            `;
            
            // Добавляем overlay на страницу
            document.body.appendChild(loadingOverlay);
            
            // Создаем подпись отдельно
            const signature = document.createElement('div');
            signature.className = 'hackflow-signature';
            signature.textContent = 'by HackFlow';
            signature.style.opacity = '0'; // Начинаем с прозрачной
            document.body.appendChild(signature);
            
            // Показываем анимацию
            setTimeout(() => {
                loadingOverlay.style.opacity = '1';
            }, 10);
            
            // Через 1 секунду показываем подпись
            setTimeout(() => {
                signature.style.opacity = '1';
                signature.style.transition = 'opacity 0.5s ease';
            }, 1000);
            
            // За 1 секунду до конца анимации скрываем подпись
            setTimeout(() => {
                signature.style.opacity = '0';
                signature.style.transition = 'opacity 0.5s ease';
            }, 5000); // 6000 - 1000 = 5000ms
            
            // Через 6 секунд переходим на test.html
            setTimeout(() => {
                // Удаляем подпись
                if (signature.parentNode) {
                    signature.parentNode.removeChild(signature);
                }
                
                // Плавное исчезновение анимации
                loadingOverlay.style.opacity = '0';
                loadingOverlay.style.transition = 'opacity 0.5s ease';
                
                setTimeout(() => {
                    window.location.href = 'test.html';
                }, 500);
            }, 6000);
        });
        
        openBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            alert('Функция "Открыть конспект" в разработке 🚀');
        });
    }
    
    function hideButtons() {
        const buttonsContainer = document.querySelector('.item-buttons');
        const activeItems = document.querySelectorAll('.conspect-item.active');
        
        if (activeItems) {
            activeItems.forEach(item => {
                item.classList.remove('active');
            });
        }
        
        if (buttonsContainer) {
            buttonsContainer.style.opacity = '0';
            
            setTimeout(() => {
                if (buttonsContainer.parentNode) {
                    buttonsContainer.parentNode.removeChild(buttonsContainer);
                }
            }, 300);
        }
    }
});

// Добавляем стили для подписи по центру снизу
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

// Добавляем стили в документ
const signatureStyleSheet = document.createElement('style');
signatureStyleSheet.textContent = signatureStyles;
document.head.appendChild(signatureStyleSheet);