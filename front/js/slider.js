// // slider.js

// // Функция для применения кастомных стилей к слайдерам
// function initializeCustomSliders() {
//     // Находим все input type="range"
//     const sliders = document.querySelectorAll('input[type="range"]');
    
//     sliders.forEach(slider => {
//         // Пропускаем если уже обработан
//         if (slider.classList.contains('custom-slider-processed')) {
//             return;
//         }
        
//         // Добавляем класс кастомного слайдера
//         slider.classList.add('custom-slider', 'custom-slider-processed');
        
//         // Создаем контейнер если его нет
//         if (!slider.parentNode.classList.contains('slider-container')) {
//             const container = document.createElement('div');
//             container.className = 'slider-container';
            
//             // Создаем label если его нет
//             const label = document.createElement('div');
//             label.className = 'slider-label';
            
//             // Переносим существующий label или создаем новый
//             const existingLabel = slider.previousElementSibling;
//             if (existingLabel && (existingLabel.tagName === 'LABEL' || existingLabel.classList.contains('slider-text'))) {
//                 label.appendChild(existingLabel.cloneNode(true));
//                 existingLabel.remove();
//             } else {
//                 const defaultLabel = document.createElement('span');
//                 defaultLabel.textContent = slider.getAttribute('aria-label') || slider.getAttribute('data-label') || 'Настройка';
//                 label.appendChild(defaultLabel);
//             }
            
//             // Создаем элемент для отображения значения
//             const valueDisplay = document.createElement('span');
//             valueDisplay.className = 'slider-value';
//             const suffix = slider.getAttribute('data-suffix') || '';
//             valueDisplay.textContent = slider.value + suffix;
            
//             label.appendChild(valueDisplay);
//             container.appendChild(label);
            
//             // Заменяем слайдер в DOM
//             slider.parentNode.insertBefore(container, slider);
//             container.appendChild(slider);
//         }
        
//         // Обработчик изменения значения
//         slider.addEventListener('input', function() {
//             const valueDisplay = this.closest('.slider-container').querySelector('.slider-value');
//             const suffix = this.getAttribute('data-suffix') || '';
//             valueDisplay.textContent = this.value + suffix;
//         });
        
//         // Инициализируем начальное значение
//         const valueDisplay = slider.closest('.slider-container').querySelector('.slider-value');
//         const suffix = slider.getAttribute('data-suffix') || '';
//         valueDisplay.textContent = slider.value + suffix;
//     });
// }

// // Функция для создания слайдера программно
// function createCustomSlider(options = {}) {
//     const {
//         min = 0,
//         max = 100,
//         value = 50,
//         step = 1,
//         label = 'Настройка',
//         suffix = '',
//         onInput = null,
//         className = '',
//         id = ''
//     } = options;
    
//     const container = document.createElement('div');
//     container.className = `slider-container ${className}`;
    
//     const labelElement = document.createElement('div');
//     labelElement.className = 'slider-label';
    
//     const labelText = document.createElement('span');
//     labelText.textContent = label;
    
//     const valueDisplay = document.createElement('span');
//     valueDisplay.className = 'slider-value';
//     valueDisplay.textContent = value + suffix;
    
//     labelElement.appendChild(labelText);
//     labelElement.appendChild(valueDisplay);
    
//     const slider = document.createElement('input');
//     slider.type = 'range';
//     slider.className = 'custom-slider';
//     slider.min = min;
//     slider.max = max;
//     slider.value = value;
//     slider.step = step;
//     if (suffix) {
//         slider.setAttribute('data-suffix', suffix);
//     }
//     if (id) {
//         slider.id = id;
//     }
    
//     slider.addEventListener('input', function() {
//         valueDisplay.textContent = this.value + suffix;
//         if (onInput) {
//             onInput(this.value);
//         }
//     });
    
//     container.appendChild(labelElement);
//     container.appendChild(slider);
    
//     return container;
// }

// // Автоматическая инициализация при загрузке DOM
// document.addEventListener('DOMContentLoaded', function() {
//     initializeCustomSliders();
// });

// // Экспорт функций для использования в других скриптах
// if (typeof module !== 'undefined' && module.exports) {
//     module.exports = { initializeCustomSliders, createCustomSlider };
// } else {
//     window.CustomSliders = { initializeCustomSliders, createCustomSlider };
// }