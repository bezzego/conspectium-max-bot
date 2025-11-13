// Глобальная функция копирования в буфер обмена с fallback для Safari
// Этот файл должен загружаться первым, до всех остальных скриптов
(function() {
    'use strict';
    
    // Определяем, является ли браузер Safari
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) || 
                     /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    // Проверяем наличие Clipboard API
    const hasClipboardAPI = navigator.clipboard && navigator.clipboard.writeText;
    
    // Синхронная функция для Safari (должна вызываться напрямую из обработчика клика)
    function copyToClipboardSync(text) {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.top = '0';
            textArea.style.left = '0';
            textArea.style.width = '2em';
            textArea.style.height = '2em';
            textArea.style.padding = '0';
            textArea.style.border = 'none';
            textArea.style.outline = 'none';
            textArea.style.boxShadow = 'none';
            textArea.style.background = 'transparent';
            textArea.style.opacity = '0';
            textArea.style.pointerEvents = 'none';
            textArea.setAttribute('readonly', '');
            textArea.setAttribute('aria-hidden', 'true');
            
            document.body.appendChild(textArea);
            
            if (isIOS) {
                // Для iOS Safari нужен специальный подход
                textArea.contentEditable = 'true';
                textArea.readOnly = false;
                const range = document.createRange();
                range.selectNodeContents(textArea);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                textArea.setSelectionRange(0, 999999);
            } else {
                // Для обычного Safari
                textArea.focus();
                textArea.select();
                textArea.setSelectionRange(0, text.length);
            }
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            return successful;
        } catch (err) {
            console.warn('Safari sync copy failed:', err);
            return false;
        }
    }
    
    // Асинхронная функция (для Chrome, Firefox и т.д.)
    async function copyToClipboardAsync(text) {
        // Сначала пробуем Clipboard API
        if (hasClipboardAPI) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (err) {
                console.warn('Clipboard API failed, trying fallback:', err);
            }
        }
        
        // Fallback для других браузеров
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.top = '-9999px';
            textArea.style.left = '-9999px';
            textArea.style.opacity = '0';
            textArea.style.pointerEvents = 'none';
            textArea.setAttribute('readonly', '');
            textArea.setAttribute('aria-hidden', 'true');
            document.body.appendChild(textArea);
            
            textArea.focus();
            textArea.select();
            textArea.setSelectionRange(0, text.length);
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            return successful;
        } catch (err) {
            console.error('All copy methods failed:', err);
            return false;
        }
    }
    
    // Основная функция - выбирает правильный метод в зависимости от браузера
    window.copyToClipboard = function(text) {
        // Для Safari используем синхронный метод (важно для сохранения контекста клика)
        if (isSafari) {
            const result = copyToClipboardSync(text);
            // Возвращаем Promise для единообразия API
            return Promise.resolve(result);
        } else {
            // Для других браузеров используем асинхронный метод
            return copyToClipboardAsync(text);
        }
    };
    
    // Также создаем синхронную версию для Safari (может быть полезна в onclick)
    window.copyToClipboardSync = copyToClipboardSync;
    
    console.log('copyToClipboard initialized', { isSafari, isIOS, hasClipboardAPI });
})();

