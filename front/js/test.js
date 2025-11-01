document.addEventListener('DOMContentLoaded', function() {
    let currentlyExpanded = null;
    
    document.querySelectorAll('.question-item').forEach(question => {
        question.addEventListener('click', function(e) {
            // Если кликнули на сам вопрос (не на вариант ответа)
            if (!e.target.closest('.answer-option')) {
                // Если этот вопрос уже открыт - закрываем его
                if (this.classList.contains('expanded')) {
                    closeQuestion(this);
                    currentlyExpanded = null;
                    return;
                }
                
                // Закрываем предыдущий открытый вопрос
                if (currentlyExpanded && currentlyExpanded !== this) {
                    closeQuestion(currentlyExpanded);
                }
                
                // Открываем текущий вопрос
                openQuestion(this);
                currentlyExpanded = this;
                
                // Плавно скроллим к открытому вопросу
                setTimeout(() => {
                    this.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'nearest',
                        inline: 'nearest'
                    });
                }, 400);
            }
        });
    });
    
    function openQuestion(question) {
        question.classList.add('expanded');
        question.style.pointerEvents = 'none';
        
        setTimeout(() => {
            question.style.pointerEvents = 'auto';
        }, 600);
    }
    
    function closeQuestion(question) {
        question.classList.remove('expanded');
        question.style.pointerEvents = 'none';
        
        setTimeout(() => {
            question.style.pointerEvents = 'auto';
        }, 400);
    }
    
    // Обработчики для радиокнопок
    document.querySelectorAll('.answer-option input[type="radio"]').forEach(radio => {
        radio.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    });
});