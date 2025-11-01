// Функция для создания кастомного алерта
function showCustomAlert(message) {
    // Создаем overlay для алерта
    const alertOverlay = document.createElement('div');
    alertOverlay.className = 'alert-overlay';
    
    // Создаем алерт
    const alertBox = document.createElement('div');
    alertBox.className = 'custom-alert';
    
    alertBox.innerHTML = `
        <div class="alert-content">
            <div class="alert-icon">
                <i class="fas fa-exclamation-circle"></i>
            </div>
            <div class="alert-message">${message}</div>
            <button class="alert-ok-btn" id="alertOkBtn">OK</button>
        </div>
    `;
    
    // Добавляем в DOM
    alertOverlay.appendChild(alertBox);
    document.body.appendChild(alertOverlay);
    
    // Анимация подпрыгивания иконки
    const alertIcon = alertBox.querySelector('.alert-icon');
    let bounceInterval;

    function startBounceAnimation() {
        // Первое подпрыгивание сразу
        alertIcon.style.animation = 'bounce 0.8s ease';
        
        // Затем каждые 3 секунды
        bounceInterval = setInterval(() => {
            alertIcon.style.animation = 'none';
            // Небольшая задержка для сброса анимации
            setTimeout(() => {
                alertIcon.style.animation = 'bounce 0.8s ease';
            }, 10);
        }, 3000);
    }
    
    function stopBounceAnimation() {
        clearInterval(bounceInterval);
        alertIcon.style.animation = '';
    }
    
    // Запускаем анимацию после появления алерта
    setTimeout(startBounceAnimation, 300);
    
    // Функция закрытия алерта
    function closeAlert() {
        stopBounceAnimation();
        document.body.removeChild(alertOverlay);
    }
    
    // Закрытие по клику на кнопку
    const okBtn = document.getElementById('alertOkBtn');
    okBtn.addEventListener('click', closeAlert);
    
    // Закрытие по клику на overlay
    alertOverlay.addEventListener('click', function(e) {
        if (e.target === alertOverlay) {
            closeAlert();
        }
    });
    
    // Закрытие по Escape
    document.addEventListener('keydown', function alertKeyHandler(e) {
        if (e.key === 'Escape') {
            closeAlert();
            document.removeEventListener('keydown', alertKeyHandler);
        }
    });
}

// Функция для создания popup окна
function createTestPopup() {
    // Создаем overlay (фон)
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    
    // Создаем popup окно
    const popup = document.createElement('div');
    popup.className = 'test-popup';
    
    // Содержимое popup
    popup.innerHTML = `
        <div class="popup-content">
            <div class="popup-header">
                <h3>Хочешь загрузить тест?</h3>
                <p>Добавьте ссылку в отведённое поле</p>
                
                <div class="input-container">
                    <input type="text" 
                        class="url-input" 
                        placeholder="https://api.konspektium.bot/export/quiz/"
                        id="testUrlInput">
                </div>
            </div>
            
            <button class="go-to-test-btn" id="goToTestBtn">
                Перейти к тесту!
            </button>
        </div>
    `;
            
    // Добавляем в DOM
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    
    // Функции для закрытия
    function closePopup() {
        document.body.removeChild(overlay);
    }
    
    // Закрытие по клику на overlay
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closePopup();
        }
    });
    
    // Закрытие по клику на кнопку
    const goToTestBtn = document.getElementById('goToTestBtn');
    goToTestBtn.addEventListener('click', function() {
        const url = document.getElementById('testUrlInput').value.trim();
        if (url) {
            // Здесь можно добавить логику перехода по ссылке
            console.log('Переход по ссылке:', url);
            closePopup();
        } else {
            showCustomAlert('Пожалуйста, введите ссылку');
        }
    });
    
    // Закрытие по нажатию Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closePopup();
        }
    });
}

// Добавляем стили для popup
const popupStyles = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap');

/* Стили для кастомного алерта */
.alert-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2000;
    animation: fadeIn 0.3s ease;
    font-family: 'Manrope', sans-serif;
}

.custom-alert {
    width: 320px;
    background: #333;
    border-radius: 25px;
    padding: 25px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    animation: slideUp 0.3s ease;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.alert-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;
    width: 100%;
}

.alert-icon {
    font-size: 48px;
    color: #f5d86e;
}

.alert-message {
    color: #fff;
    font-size: 16px;
    font-weight: 500;
    text-align: center;
    line-height: 1.4;
}

.alert-ok-btn {
    width: 120px;
    height: 45px;
    background: #f5d86e;
    border: none;
    border-radius: 25px;
    color: #000;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    font-family: 'Manrope', sans-serif;
}

.alert-ok-btn:hover {
    background: #f8e085;
    transform: translateY(-2px);
}

/* Самый плавный вариант подпрыгивания */
@keyframes bounce {
    0% {
        transform: translateY(0) scale(1);
        animation-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }
    15% {
        transform: translateY(-25px) scale(1.05);
        animation-timing-function: cubic-bezier(0.55, 0.085, 0.68, 0.53);
    }
    30% {
        transform: translateY(-5px) scale(1.02);
        animation-timing-function: cubic-bezier(0.55, 0.085, 0.68, 0.53);
    }
    45% {
        transform: translateY(-18px) scale(1.03);
        animation-timing-function: cubic-bezier(0.55, 0.085, 0.68, 0.53);
    }
    60% {
        transform: translateY(-2px) scale(1.01);
        animation-timing-function: cubic-bezier(0.55, 0.085, 0.68, 0.53);
    }
    75% {
        transform: translateY(-10px) scale(1.02);
        animation-timing-function: cubic-bezier(0.55, 0.085, 0.68, 0.53);
    }
    90% {
        transform: translateY(-1px) scale(1.005);
        animation-timing-function: cubic-bezier(0.55, 0.085, 0.68, 0.53);
    }
    100% {
        transform: translateY(0) scale(1);
        animation-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }
}
.popup-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    animation: fadeIn 0.3s ease;
    font-family: 'Manrope', sans-serif;
}

.test-popup {
    width: 400px;
    background: #333;
    border-radius: 30px;
    padding: 15px;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease;
    font-family: 'Manrope', sans-serif;
}

.popup-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
    font-family: 'Manrope', sans-serif;
}

.popup-header {
    width: 370px;
    height: 175px;
    background: #D0D0D0;
    border-radius: 30px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    text-align: center;
    padding: 18px;
    box-sizing: border-box;
    font-family: 'Manrope', sans-serif;
}

.popup-header h3 {
    color: #000;
    font-size: 23px;
    font-weight: 700;
    margin-bottom: 5px;
    font-family: 'Manrope', sans-serif;
}

.popup-header p {
    color: #000;
    font-size: 15px;
    font-weight: 500;
    font-family: 'Manrope', sans-serif;
    margin-bottom: 12px;
}

.input-container {
    display: flex;
    justify-content: center;
    width: 100%;
}

.url-input {
    width: 334px;
    height: 60px;
    background: #333;
    border: 2px solid #D0D0D0;
    border-radius: 30px;
    padding: 0 18px;
    color: #fff;
    font-size: 15px;
    font-family: 'Manrope', sans-serif;
    outline: none;
    box-sizing: border-box;
}

.url-input::placeholder {
    color: #888;
    font-size: 13px;
}

.url-input:focus {
    border-color: #f5d86e;
}

.go-to-test-btn {
    width: 370px;
    height: 60px;
    background: #f5d86e;
    border: none;
    border-radius: 25px;
    color: #000;
    font-size: 17px;
    font-weight: 700;
    font-family: 'Manrope', sans-serif;
    cursor: pointer;
    transition: all 0.3s ease;
}

.go-to-test-btn:hover {
    background: #f8e085;
    transform: translateY(-2px);
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes slideUp {
    from { 
        opacity: 0;
        transform: translateY(20px);
    }
    to { 
        opacity: 1;
        transform: translateY(0);
    }
}
`;

// Добавляем стили в документ
const styleSheet = document.createElement('style');
styleSheet.textContent = popupStyles;
document.head.appendChild(styleSheet);

// Назначаем обработчик на кнопку "Скинули ссылку?"
document.addEventListener('DOMContentLoaded', function() {
    // Ищем карточку по тексту ссылки и классу
    const linkCards = document.querySelectorAll('.action-card');
    
    linkCards.forEach(card => {
        const span = card.querySelector('span');
        if (span && span.textContent.includes('Скинули ссылку?')) {
            card.addEventListener('click', function(e) {
                e.preventDefault();
                createTestPopup();
            });
        }
    });
});