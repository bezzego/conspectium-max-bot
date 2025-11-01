    // // Плавные переходы между страницами
    // document.addEventListener('DOMContentLoaded', function() {
    //     // Добавляем обработчики для всех ссылок
    //     document.querySelectorAll('a').forEach(link => {
    //         link.addEventListener('click', function(e) {
    //             // Проверяем, что это внутренняя ссылка
    //             if (this.href && this.href.includes('.html')) {
    //                 e.preventDefault();
    //                 const href = this.href;
                    
    //                 // Анимация исчезновения
    //                 document.body.style.animation = 'fadeOut 0.2s ease-out forwards';
                    
    //                 // Переход после анимации
    //                 setTimeout(() => {
    //                     window.location.href = href;
    //                 }, 200);
    //             }
    //         });
    //     });
    // });

    // Добавляем CSS для анимации исчезновения
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    // Функция для возврата назад
    function goBack() {
        if (document.referrer && document.referrer.includes(window.location.hostname)) {
            window.history.back();
        } else {
            // Если пришли извне или напрямую - переходим на главную
            window.location.href = 'main.html';
        }
    }


// Скролл горизонтальных карточек колесиком мыши
document.addEventListener('DOMContentLoaded', function() {
    const scrollContainer = document.querySelector('.actions-scroll');
    
    if (scrollContainer) {
        scrollContainer.addEventListener('wheel', function(e) {
            e.preventDefault();
            this.scrollLeft += e.deltaY;
        });
    }
});

// Обработчик для кнопки создания теста по конспекту
document.addEventListener('DOMContentLoaded', function() {
    const createFromConspectBtn = document.getElementById('createFromConspectBtn');
    
    if (createFromConspectBtn) {
        createFromConspectBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'choose_test.html';
        });
    }
});


document.addEventListener('DOMContentLoaded', function() {
    // Создаем скрытый input для загрузки аудио
    const audioInput = document.createElement('input');
    audioInput.type = 'file';
    audioInput.accept = 'audio/*';
    audioInput.style.display = 'none';
    audioInput.id = 'audio-upload-input';
    
    // Добавляем input в body
    document.body.appendChild(audioInput);
    
    // Находим обе кнопки загрузки аудио
    const uploadBtn = document.querySelector('.upload-btn');
    const actionCard = document.querySelector('.action-card');
    
    // Функция для привязки функционала к кнопке
    function setupAudioUpload(button) {
        if (button) {
            // Убираем стандартное поведение ссылки
            button.addEventListener('click', function(e) {
                e.preventDefault();
                audioInput.click();
            });
        }
    }
    
    // Привязываем функционал к обеим кнопкам
    setupAudioUpload(uploadBtn);
    setupAudioUpload(actionCard);
    
    // Обработчик выбора файла
    audioInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            handleAudioFile(file);
        }
    });
    
    // Функция обработки выбранного аудиофайла
    function handleAudioFile(file) {
        console.log('Выбран аудиофайл:', file.name, file.type, file.size);
        
        // Проверяем, что это аудиофайл
        if (!file.type.startsWith('audio/')) {
            alert('Пожалуйста, выберите аудиофайл!');
            return;
        }
        
        // Проверяем размер файла (максимум 50MB)
        const maxSize = 50 * 1024 * 1024; // 50MB в байтах
        if (file.size > maxSize) {
            alert('Файл слишком большой! Максимальный размер: 50MB');
            return;
        }
        
        // Показываем уведомление о загрузке
        showUploadNotification(file);
        
        // Здесь можно добавить обработку файла
        processAudioFile(file);
    }
    
    // Функция показа уведомления о загрузке
    function showUploadNotification(file) {
        // Создаем уведомление
        const notification = document.createElement('div');
        notification.className = 'upload-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-check-circle"></i>
                <span>Аудио загружено: ${file.name}</span>
                <button class="close-notification">&times;</button>
            </div>
        `;
        
        // Добавляем стили для уведомления
        const notificationStyles = `
        .upload-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        }
        
        .notification-content {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .notification-content i {
            font-size: 18px;
        }
        
        .close-notification {
            background: none;
            border: none;
            color: white;
            font-size: 18px;
            cursor: pointer;
            margin-left: 10px;
        }
        
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        `;
        
        // Добавляем стили если их еще нет
        if (!document.querySelector('#upload-notification-styles')) {
            const styleElement = document.createElement('style');
            styleElement.id = 'upload-notification-styles';
            styleElement.textContent = notificationStyles;
            document.head.appendChild(styleElement);
        }
        
        document.body.appendChild(notification);
        
        // Обработчик закрытия уведомления
        const closeBtn = notification.querySelector('.close-notification');
        closeBtn.addEventListener('click', function() {
            notification.remove();
        });
        
        // Автоматическое закрытие через 5 секунд
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }
    
    // Функция обработки аудиофайла
    function processAudioFile(file) {
        console.log('Обрабатываем аудиофайл...');
        
        // Здесь можно добавить логику создания конспекта из аудио
        // Например: преобразование речи в текст, анализ, создание конспекта
        
        // Показываем индикатор загрузки
        showProcessingIndicator();
        
        // Имитация обработки (замените на реальную логику)
        setTimeout(() => {
            hideProcessingIndicator();
            showResultNotification();
        }, 3000);
    }
    
    // Функция показа индикатора обработки
    function showProcessingIndicator() {
        const processingIndicator = document.createElement('div');
        processingIndicator.className = 'processing-indicator';
        processingIndicator.innerHTML = `
            <div class="processing-content">
                <div class="spinner"></div>
                <span>Создаем конспект из аудио...</span>
            </div>
        `;
        
        // Стили для индикатора обработки
        const processingStyles = `
        .processing-indicator {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 255, 255, 0.95);
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            z-index: 10001;
            backdrop-filter: blur(10px);
        }
        
        .processing-content {
            display: flex;
            align-items: center;
            gap: 15px;
            font-family: 'Manrope', sans-serif;
            color: #333;
        }
        
        .spinner {
            width: 24px;
            height: 24px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        `;
        
        if (!document.querySelector('#processing-styles')) {
            const styleElement = document.createElement('style');
            styleElement.id = 'processing-styles';
            styleElement.textContent = processingStyles;
            document.head.appendChild(styleElement);
        }
        
        document.body.appendChild(processingIndicator);
        
        // Сохраняем ссылку для удаления
        window.processingIndicator = processingIndicator;
    }
    
    function hideProcessingIndicator() {
        if (window.processingIndicator && window.processingIndicator.parentNode) {
            window.processingIndicator.parentNode.removeChild(window.processingIndicator);
        }
    }
    
    function showResultNotification() {
        const resultNotification = document.createElement('div');
        resultNotification.className = 'result-notification';
        resultNotification.innerHTML = `
            <div class="result-content">
                <i class="fas fa-file-alt"></i>
                <div>
                    <strong>Конспект создан!</strong>
                    <p>Аудио успешно преобразовано в текстовый конспект</p>
                </div>
                <button class="close-result">&times;</button>
            </div>
        `;
        
        const resultStyles = `
        .result-notification {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #2196F3;
            color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideDown 0.3s ease;
            min-width: 300px;
        }
        
        .result-content {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .result-content i {
            font-size: 24px;
        }
        
        .result-content div {
            flex: 1;
        }
        
        .result-content strong {
            display: block;
            margin-bottom: 5px;
        }
        
        .result-content p {
            margin: 0;
            opacity: 0.9;
            font-size: 14px;
        }
        
        .close-result {
            background: none;
            border: none;
            color: white;
            font-size: 18px;
            cursor: pointer;
        }
        
        @keyframes slideDown {
            from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
            to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        `;
        
        if (!document.querySelector('#result-styles')) {
            const styleElement = document.createElement('style');
            styleElement.id = 'result-styles';
            styleElement.textContent = resultStyles;
            document.head.appendChild(styleElement);
        }
        
        document.body.appendChild(resultNotification);
        
        const closeBtn = resultNotification.querySelector('.close-result');
        closeBtn.addEventListener('click', function() {
            resultNotification.remove();
        });
        
        setTimeout(() => {
            if (resultNotification.parentNode) {
                resultNotification.remove();
            }
        }, 5000);
    }
});

// Также добавляем поддержку drag & drop
document.addEventListener('DOMContentLoaded', function() {
    document.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        document.body.classList.add('drag-over');
    });
    
    document.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!e.relatedTarget || e.relatedTarget.nodeName === 'HTML') {
            document.body.classList.remove('drag-over');
        }
    });
    
    document.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        document.body.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const audioFile = Array.from(files).find(file => file.type.startsWith('audio/'));
            if (audioFile) {
                handleAudioFile(audioFile);
            }
        }
    });
    
    const dragDropStyles = `
    .drag-over {
        outline: 2px dashed #667eea;
        outline-offset: -10px;
        background-color: rgba(102, 126, 234, 0.1);
    }
    
    .drag-over .action-card {
        transform: scale(1.05);
        transition: transform 0.2s ease;
    }
    `;
    
    const styleElement = document.createElement('style');
    styleElement.textContent = dragDropStyles;
    document.head.appendChild(styleElement);
});

// Глобальная функция для drag & drop
function handleAudioFile(file) {
    console.log('Выбран аудиофайл:', file.name, file.type, file.size);
    
    if (!file.type.startsWith('audio/')) {
        alert('Пожалуйста, выберите аудиофайл!');
        return;
    }
    
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
        alert('Файл слишком большой! Максимальный размер: 50MB');
        return;
    }
    
    showUploadNotification(file);
    processAudioFile(file);
}