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
        alert('Функция "Создать тест" в разработке 🚀');
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