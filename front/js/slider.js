(() => {
    class TestSettingsModal {
        constructor() {
            this.modal = null;
            this.valueDisplay = null;
            this.createBtn = null;
            this.slider = null;
            this.progress = null;
            this.thumb = null;
            
            this.isDragging = false;
            this.currentValue = 8;
            this.sliderRect = null;
            this.onCreateCallback = null;
            
            this.init();
        }
        
        init() {
            this.createModal();
            this.bindEvents();
            setTimeout(() => {
                this.initSlider();
            }, 100);
        }
        
        createModal() {
            // Создаем модальное окно, если его еще нет
            if (document.getElementById('testSettingsModal')) {
                this.modal = document.getElementById('testSettingsModal');
                this.valueDisplay = document.getElementById('questionsValue');
                this.createBtn = document.getElementById('createTestBtn');
                this.slider = document.getElementById('slider');
                this.progress = document.getElementById('progress');
                this.thumb = document.getElementById('thumb');
                return;
            }
            
            const modalOverlay = document.createElement('div');
            modalOverlay.className = 'modal-overlay';
            modalOverlay.id = 'testSettingsModal';
            modalOverlay.innerHTML = `
                <div class="modal-container">
                    <h2 class="modal-title">Количество вопросов</h2>
                    <div class="value-display" id="questionsValue">8</div>
                    
                    <div class="slider-container" id="slider">
                        <div class="slider-progress" id="progress"></div>
                        <div class="slider-thumb-glass" id="thumb">
                            <div class="slider-thumb-glass-filter"></div>
                            <div class="slider-thumb-glass-overlay"></div>
                            <div class="slider-thumb-glass-specular"></div>
                        </div>
                    </div>
                    
                    <button class="create-btn" id="createTestBtn">
                        <span class="create-btn-text">Создать тест</span>
                    </button>
                </div>
            `;
            
            document.body.appendChild(modalOverlay);
            this.modal = modalOverlay;
            this.valueDisplay = document.getElementById('questionsValue');
            this.createBtn = document.getElementById('createTestBtn');
            this.slider = document.getElementById('slider');
            this.progress = document.getElementById('progress');
            this.thumb = document.getElementById('thumb');
        }
        
        bindEvents() {
            if (!this.thumb || !this.slider || !this.createBtn) return;
            
            // События слайдера
            this.thumb.addEventListener('mousedown', this.onMouseDown.bind(this));
            this.thumb.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: true });
            
            document.addEventListener('mousemove', this.onMouseMove.bind(this));
            document.addEventListener('mouseup', this.onMouseUp.bind(this));
            document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
            document.addEventListener('touchend', this.onTouchEnd.bind(this));
            
            this.slider.addEventListener('mousedown', this.onSliderClick.bind(this));
            this.slider.addEventListener('touchstart', this.onSliderTouch.bind(this), { passive: true });
            
            // Событие кнопки создания теста
            this.createBtn.addEventListener('click', this.onCreateTest.bind(this));
            
            // Закрытие модального окна при клике вне его
            if (this.modal) {
                this.modal.addEventListener('click', (e) => {
                    if (e.target === this.modal) {
                        this.hide();
                    }
                });
            }
            
            // Закрытие по ESC
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.modal && this.modal.classList.contains('active')) {
                    this.hide();
                }
            });
        }
        
        onMouseDown(e) {
            this.isDragging = true;
            this.updateSliderRect();
            this.onMove(e.clientX);
            if (this.thumb) {
                this.thumb.classList.add('active');
            }
            e.preventDefault();
        }
        
        onTouchStart(e) {
            this.isDragging = true;
            this.updateSliderRect();
            this.onMove(e.touches[0].clientX);
            if (this.thumb) {
                this.thumb.classList.add('active');
            }
        }
        
        onMouseMove(e) {
            if (this.isDragging) {
                this.onMove(e.clientX);
                e.preventDefault();
            }
        }
        
        onTouchMove(e) {
            if (this.isDragging) {
                this.onMove(e.touches[0].clientX);
                e.preventDefault();
            }
        }
        
        onMouseUp() {
            this.isDragging = false;
            if (this.thumb) {
                this.thumb.classList.remove('active');
            }
        }
        
        onTouchEnd() {
            this.isDragging = false;
            if (this.thumb) {
                this.thumb.classList.remove('active');
            }
        }
        
        onSliderClick(e) {
            this.updateSliderRect();
            this.onMove(e.clientX);
        }
        
        onSliderTouch(e) {
            this.updateSliderRect();
            this.onMove(e.touches[0].clientX);
        }
        
        updateSliderRect() {
            if (this.slider) {
                this.sliderRect = this.slider.getBoundingClientRect();
            }
        }
        
        onMove(clientX) {
            if (!this.sliderRect) return;
            const percent = this.getPercentFromClientX(clientX);
            this.updateThumbAndProgress(percent);
        }
        
        getPercentFromClientX(clientX) {
            if (!this.sliderRect) return 0;
            const offsetX = clientX - this.sliderRect.left;
            return Math.max(0, Math.min(100, (offsetX / this.sliderRect.width) * 100));
        }
        
        updateThumbAndProgress(percent) {
            if (!this.sliderRect || !this.thumb || !this.progress) return;
            const px = (percent / 100) * this.sliderRect.width;
            
            this.thumb.style.left = `${px}px`;
            this.progress.style.width = `${percent}%`;
            
            this.updateValue(percent);
        }
        
        updateValue(percent) {
            const newValue = Math.round(1 + (percent / 100) * 19);
            
            if (newValue !== this.currentValue) {
                this.currentValue = newValue;
                if (this.valueDisplay) {
                    this.valueDisplay.textContent = newValue;
                    this.valueDisplay.style.transform = 'scale(1.1)';
                    setTimeout(() => {
                        if (this.valueDisplay) {
                            this.valueDisplay.style.transform = 'scale(1)';
                        }
                    }, 150);
                }
            }
        }
        
        initSlider() {
            const initialPercent = 35;
            this.updateSliderRect();
            
            if (this.sliderRect && this.thumb && this.progress) {
                const initialPx = (initialPercent / 100) * this.sliderRect.width;
                this.thumb.style.left = `${initialPx}px`;
                this.progress.style.width = `${initialPercent}%`;
                this.currentValue = 8;
                if (this.valueDisplay) {
                    this.valueDisplay.textContent = '8';
                }
            }
        }
        
        show() {
            if (this.modal) {
                this.modal.classList.add('active');
                document.body.style.overflow = 'hidden';
                setTimeout(() => {
                    this.updateSliderRect();
                    this.initSlider();
                }, 50);
            }
        }
        
        hide() {
            if (this.modal) {
                this.modal.classList.remove('active');
                document.body.style.overflow = '';
            }
        }
        
        onCreateTest() {
            const testData = {
                questionsCount: this.currentValue,
                timestamp: new Date().toISOString()
            };
            
            this.hide();
            
            if (this.onCreateCallback) {
                this.onCreateCallback(testData);
            }
            
            return testData;
        }
        
        setOnCreateCallback(callback) {
            this.onCreateCallback = callback;
        }
        
        getCurrentValue() {
            return this.currentValue;
        }
    }

    // Создаем глобальную переменную для доступа к модальному окну
    if (typeof window !== 'undefined') {
        window.TestSettingsModal = TestSettingsModal;
        
        // Автоматическая инициализация при загрузке
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                if (!window.testSettingsModal) {
                    window.testSettingsModal = new TestSettingsModal();
                }
            });
        } else {
            if (!window.testSettingsModal) {
                window.testSettingsModal = new TestSettingsModal();
            }
        }
    }
})();
