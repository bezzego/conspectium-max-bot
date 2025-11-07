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
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2000;
    animation: fadeIn 0.3s ease;
    font-family: 'Manrope', sans-serif;
}

.custom-alert {
    width: 340px;
    background: linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.15) 0%,
        rgba(255, 255, 255, 0.08) 50%,
        rgba(255, 255, 255, 0.15) 100%
    );
    backdrop-filter: blur(25px);
    border-radius: 28px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    padding: 30px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    animation: slideUp 0.3s ease;
    box-shadow: 
        0 25px 50px rgba(0, 0, 0, 0.4),
        0 15px 35px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
    position: relative;
    overflow: hidden;
}

.custom-alert::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
        135deg,
        rgba(245, 216, 110, 0.1) 0%,
        transparent 30%,
        transparent 70%,
        rgba(245, 216, 110, 0.1) 100%
    );
    border-radius: 28px;
    pointer-events: none;
}

.alert-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    width: 100%;
    position: relative;
    z-index: 1;
}

.alert-icon {
    font-size: 52px;
    color: #f5d86e;
    text-shadow: 0 4px 15px rgba(245, 216, 110, 0.4);
}

.alert-message {
    color: #fff;
    font-size: 16px;
    font-weight: 500;
    text-align: center;
    line-height: 1.4;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.alert-ok-btn {
    width: 140px;
    height: 48px;
    background: linear-gradient(
        135deg,
        rgba(245, 216, 110, 0.3) 0%,
        rgba(240, 213, 124, 0.4) 100%
    );
    border: 1px solid rgba(245, 216, 110, 0.5);
    border-radius: 24px;
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    font-family: 'Manrope', sans-serif;
    backdrop-filter: blur(10px);
    position: relative;
    overflow: hidden;
}

.alert-ok-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.2),
        transparent
    );
    transition: left 0.6s ease;
}

.alert-ok-btn:hover::before {
    left: 100%;
}

.alert-ok-btn:hover {
    background: linear-gradient(
        135deg,
        rgba(245, 216, 110, 0.4) 0%,
        rgba(240, 213, 124, 0.5) 100%
    );
    border-color: rgba(245, 216, 110, 0.7);
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(245, 216, 110, 0.3);
}

/* Анимация подпрыгивания иконки */
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

/* Стили для popup окна в стиле liquid glass */
.popup-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(15px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    animation: fadeIn 0.3s ease;
    font-family: 'Manrope', sans-serif;
}

.test-popup {
    width: 420px;
    background: linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.12) 0%,
        rgba(255, 255, 255, 0.06) 50%,
        rgba(255, 255, 255, 0.12) 100%
    );
    backdrop-filter: blur(30px);
    border-radius: 32px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    padding: 25px;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease;
    box-shadow: 
        0 30px 60px rgba(0, 0, 0, 0.5),
        0 20px 45px rgba(0, 0, 0, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
    position: relative;
    overflow: hidden;
}

.test-popup::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
        135deg,
        rgba(245, 216, 110, 0.08) 0%,
        transparent 30%,
        transparent 70%,
        rgba(245, 216, 110, 0.08) 100%
    );
    border-radius: 32px;
    pointer-events: none;
}

.popup-content {
    display: flex;
    flex-direction: column;
    gap: 20px;
    height: 100%;
    position: relative;
    z-index: 1;
}

.popup-header {
    width: 100%;
    background: linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.15) 0%,
        rgba(255, 255, 255, 0.08) 50%,
        rgba(255, 255, 255, 0.15) 100%
    );
    backdrop-filter: blur(20px);
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    text-align: center;
    padding: 25px;
    box-sizing: border-box;
    box-shadow: 
        0 15px 35px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.popup-header h3 {
    color: #fff;
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 8px;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.popup-header p {
    color: rgba(255, 255, 255, 0.8);
    font-size: 15px;
    font-weight: 500;
    margin-bottom: 20px;
    line-height: 1.4;
}

.input-container {
    display: flex;
    justify-content: center;
    width: 100%;
}

.url-input {
    width: 100%;
    height: 56px;
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 28px;
    padding: 0 20px;
    color: #fff;
    font-size: 15px;
    font-family: 'Manrope', sans-serif;
    outline: none;
    box-sizing: border-box;
    transition: all 0.3s ease;
}

.url-input::placeholder {
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
}

.url-input:focus {
    border-color: rgba(245, 216, 110, 0.8);
    background: rgba(255, 255, 255, 0.12);
    box-shadow: 0 0 0 3px rgba(245, 216, 110, 0.2);
}

.go-to-test-btn {
    width: 100%;
    height: 56px;
    background: linear-gradient(
        135deg,
        rgba(245, 216, 110, 0.35) 0%,
        rgba(240, 213, 124, 0.45) 100%
    );
    border: 1px solid rgba(245, 216, 110, 0.6);
    border-radius: 28px;
    color: #fff;
    font-size: 17px;
    font-weight: 700;
    font-family: 'Manrope', sans-serif;
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
    position: relative;
    overflow: hidden;
}

.go-to-test-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.25),
        transparent
    );
    transition: left 0.6s ease;
}

.go-to-test-btn:hover::before {
    left: 100%;
}

.go-to-test-btn:hover {
    background: linear-gradient(
        135deg,
        rgba(245, 216, 110, 0.45) 0%,
        rgba(240, 213, 124, 0.55) 100%
    );
    border-color: rgba(245, 216, 110, 0.8);
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(245, 216, 110, 0.4);
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes slideUp {
    from { 
        opacity: 0;
        transform: translateY(30px);
    }
    to { 
        opacity: 1;
        transform: translateY(0);
    }
}

/* Адаптивность */
@media (max-width: 480px) {
    .custom-alert {
        width: 300px;
        padding: 25px;
        margin: 20px;
    }
    
    .test-popup {
        padding: 20px;
        margin: 20px;
    }
    
    .popup-header {
        padding: 20px;
    }
    
    .popup-header h3 {
        font-size: 22px;
    }
    
    .popup-header p {
        font-size: 14px;
    }
}

@media (max-width: 360px) {
    .custom-alert {
        width: 280px;
        padding: 20px;
    }
    
    .test-popup {
        width: 300px;
        padding: 15px;
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