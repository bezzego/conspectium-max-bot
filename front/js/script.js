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

    // Обработчик для кнопки загрузки
    document.querySelector(".upload-btn").addEventListener("click", function(e) {
        e.preventDefault();
        alert("Загрузка аудио пока в разработке 🚀");
    });


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