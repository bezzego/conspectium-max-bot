// Улучшенная функция для добавления мягких переносов
function addWordBreaksImproved() {
    console.log('Запуск улучшенной функции переносов...');
    
    const textElements = document.querySelectorAll('.item-content');
    console.log('Найдено элементов:', textElements.length);
    
    textElements.forEach((element, index) => {
        const originalText = element.textContent;
        
        // Добавляем мягкие переносы во все слова от 5 символов
        const textWithBreaks = originalText.replace(/([а-яёa-z]{5,})/gi, function(match) {
            return addSmartHyphens(match);
        });
        
        element.innerHTML = textWithBreaks;
        console.log(`Элемент ${index + 1} обработан`);
    });
    
    console.log('Все элементы обработаны');
}

// Умное добавление переносов
function addSmartHyphens(word) {
    if (word.length < 5) return word;
    
    const vowels = 'аеёиоуыэюяaeiouy';
    const consonants = 'бвгджзйклмнпрстфхцчшщbcdfghjklmnpqrstvwxz';
    
    let result = '';
    let currentPosition = 0;
    
    while (currentPosition < word.length) {
        const remainingLength = word.length - currentPosition;
        
        // Если осталось меньше 5 символов - не переносим
        if (remainingLength < 5) {
            result += word.substring(currentPosition);
            break;
        }
        
        // Ищем место для переноса (после 3-7 символов)
        let breakPosition = Math.min(
            Math.max(3, Math.floor(word.length / 2)), 
            7
        );
        
        // Пытаемся найти хорошее место для переноса
        let foundGoodBreak = false;
        
        // Ищем после гласной или перед согласной
        for (let offset = 0; offset <= 2; offset++) {
            const testPosition = Math.min(currentPosition + breakPosition + offset, word.length - 2);
            
            if (testPosition >= word.length - 1) continue;
            
            const currentChar = word[testPosition].toLowerCase();
            const nextChar = word[testPosition + 1].toLowerCase();
            
            // Хорошее место для переноса: после гласной или перед согласной
            if (vowels.includes(currentChar) || consonants.includes(nextChar)) {
                breakPosition = testPosition - currentPosition;
                foundGoodBreak = true;
                break;
            }
        }
        
        // Если не нашли хорошее место, используем стандартное
        if (!foundGoodBreak) {
            breakPosition = Math.min(5, remainingLength - 2);
        }
        
        // Добавляем часть слова с переносом
        if (currentPosition > 0) {
            result += '&shy;';
        }
        
        result += word.substring(currentPosition, currentPosition + breakPosition);
        currentPosition += breakPosition;
    }
    
    return result;
}

// Простая версия - перенос каждые 4-6 символов
function addSimpleWordBreaksUniversal() {
    console.log('Запуск универсальной версии переносов...');
    
    const textElements = document.querySelectorAll('.item-content');
    
    textElements.forEach((element, index) => {
        const originalText = element.textContent;
        
        // Добавляем мягкие переносы во все слова от 5 символов
        const textWithBreaks = originalText.replace(/([а-яёa-z0-9]{5,})/gi, function(match) {
            if (match.length < 5) return match;
            
            let result = '';
            const chunkSize = match.length <= 8 ? 4 : 5; // Динамический размер чанка
            
            for (let i = 0; i < match.length; i += chunkSize) {
                if (i > 0) result += '&shy;';
                // Случайный размер чанка для естественности
                const currentChunkSize = Math.min(
                    chunkSize + Math.floor(Math.random() * 2), 
                    match.length - i
                );
                result += match.substring(i, i + currentChunkSize);
            }
            
            return result;
        });
        
        element.innerHTML = textWithBreaks;
    });
}

// Агрессивная версия - гарантированные переносы
function addAggressiveWordBreaks() {
    console.log('Запуск агрессивной версии переносов...');
    
    const textElements = document.querySelectorAll('.item-content');
    
    textElements.forEach(element => {
        const originalText = element.textContent;
        
        // Разбиваем текст на слова и обрабатываем каждое слово отдельно
        const words = originalText.split(/(\s+)/);
        const processedWords = words.map(word => {
            // Обрабатываем только слова длиной 5+ символов
            if (word.length >= 5 && /[а-яёa-z]/i.test(word)) {
                let result = '';
                let pos = 0;
                
                while (pos < word.length) {
                    const remaining = word.length - pos;
                    
                    if (remaining <= 6) {
                        // Если осталось мало символов - добавляем без переноса
                        result += word.substring(pos);
                        break;
                    } else {
                        // Добавляем 3-5 символов с переносом
                        const chunkSize = Math.min(4 + Math.floor(Math.random() * 2), remaining - 2);
                        if (pos > 0) result += '&shy;';
                        result += word.substring(pos, pos + chunkSize);
                        pos += chunkSize;
                    }
                }
                
                return result;
            }
            
            return word;
        });
        
        element.innerHTML = processedWords.join('');
    });
}

// Проверяем, нужны ли переносы
function checkLongWordsUniversal() {
    const textElements = document.querySelectorAll('.item-content');
    let hasLongWords = false;
    
    textElements.forEach(element => {
        const words = element.textContent.split(/\s+/);
        const longWords = words.filter(word => word.length >= 5);
        
        if (longWords.length > 0) {
            console.log('Слова для переноса найдены:', longWords);
            hasLongWords = true;
        }
    });
    
    return hasLongWords;
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, запускаем улучшенный скрипт переносов...');
    
    // Даем небольшую задержку для полной загрузки
    setTimeout(() => {
        console.log('Проверяем слова для переноса...');
        
        if (checkLongWordsUniversal()) {
            console.log('Найдены слова для переноса, применяем улучшенные переносы...');
            
            // Сначала пробуем умную версию
            addWordBreaksImproved();
            
            // Проверяем результат и если нужно, применяем агрессивную версию
            setTimeout(() => {
                const stillLongWords = checkLongWordsUniversal();
                if (stillLongWords) {
                    console.log('Переносы не сработали, применяем агрессивную версию');
                    addAggressiveWordBreaks();
                }
            }, 100);
        } else {
            console.log('Слова для переноса не найдены');
        }
    }, 100);
});

// Добавляем CSS для поддержки переносов
const breakStyles = `
.item-content {
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
    -webkit-hyphens: auto;
    -moz-hyphens: auto;
    -ms-hyphens: auto;
}

/* Принудительные переносы для старых браузеров */
@supports not (hyphens: auto) {
    .item-content {
        word-break: break-word;
    }
}
`;

// Добавляем стили в документ
const breakStyleSheet = document.createElement('style');
breakStyleSheet.textContent = breakStyles;
document.head.appendChild(breakStyleSheet);