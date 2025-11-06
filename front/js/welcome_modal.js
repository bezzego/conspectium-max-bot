// Карусель аватарок
class AvatarCarousel {
    constructor() {
        this.container = document.querySelector('.avatar-carousel-container');
        this.track = document.querySelector('.avatar-track');
        this.dotsContainer = document.querySelector('.avatar-dots');
        this.avatars = [
            { id: 1, type: 'male', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Mason&radius=50&backgroundColor=d1d4f9' },
            { id: 2, type: 'male', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Kingston&radius=50&backgroundColor=b6e3f4' },
            { id: 3, type: 'male', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Avery&radius=50&backgroundColor=b6e3f4' },
            { id: 4, type: 'robot', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Oliver&radius=50&backgroundColor=b6e3f4' },
            { id: 5, type: 'female', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Vivian&radius=50&backgroundColor=ffdfbf' },
            { id: 6, type: 'female', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Jocelyn&radius=50&backgroundColor=ffd5dc,c0aede' },
            { id: 7, type: 'female', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Vivian&radius=50&backgroundColor=ffdfbf' }
        ];
        this.currentIndex = 3;
        this.isDragging = false;
        this.startX = 0;
        this.currentTranslate = 0;
        this.prevTranslate = 0;
        this.animationId = null;
        this.velocity = 0;
        this.lastX = 0;
        this.lastTime = 0;
        
        this.init();
    }

    init() {
        this.renderAvatars();
        this.createDots();
        this.setupEventListeners();
        this.updatePositions();
        this.animate();
    }

    renderAvatars() {
        this.track.innerHTML = '';
        
        this.avatars.forEach((avatar, index) => {
            const avatarEl = document.createElement('div');
            avatarEl.className = 'avatar-item';
            avatarEl.innerHTML = `<img src="${avatar.url}" alt="Аватар ${index + 1}" loading="lazy">`;
            avatarEl.dataset.index = index;
            
            avatarEl.addEventListener('click', (e) => {
                if (!this.isDragging) {
                    this.snapToIndex(index);
                }
            });
            
            this.track.appendChild(avatarEl);
        });
    }

    createDots() {
        this.dotsContainer.innerHTML = '';
        
        this.avatars.forEach((_, index) => {
            const dot = document.createElement('div');
            dot.className = `avatar-dot ${index === this.currentIndex ? 'active' : ''}`;
            dot.dataset.index = index;
            
            dot.addEventListener('click', () => {
                this.snapToIndex(index);
            });
            
            this.dotsContainer.appendChild(dot);
        });
    }

    setupEventListeners() {
        // Мышь
        this.container.addEventListener('mousedown', this.dragStart.bind(this));
        document.addEventListener('mousemove', this.drag.bind(this));
        document.addEventListener('mouseup', this.dragEnd.bind(this));
        
        // Тач
        this.container.addEventListener('touchstart', this.dragStart.bind(this));
        document.addEventListener('touchmove', this.drag.bind(this));
        document.addEventListener('touchend', this.dragEnd.bind(this));
        
        // Предотвращаем контекстное меню
        this.container.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    dragStart(e) {
        if (e.type === 'touchstart') {
            this.startX = e.touches[0].clientX;
        } else {
            this.startX = e.clientX;
        }
        
        this.isDragging = true;
        this.container.style.cursor = 'grabbing';
        this.track.style.transition = 'none';
        
        this.lastX = this.startX;
        this.lastTime = Date.now();
        this.velocity = 0;
        
        cancelAnimationFrame(this.animationId);
    }

    drag(e) {
        if (!this.isDragging) return;
        
        let currentX;
        if (e.type === 'touchmove') {
            currentX = e.touches[0].clientX;
        } else {
            currentX = e.clientX;
        }
        
        const currentTime = Date.now();
        const deltaTime = currentTime - this.lastTime;
        
        if (deltaTime > 0) {
            const deltaX = currentX - this.lastX;
            this.velocity = deltaX / deltaTime;
            this.lastX = currentX;
            this.lastTime = currentTime;
        }
        
        const diff = currentX - this.startX;
        this.currentTranslate = this.prevTranslate + diff;
        
        this.updatePositions();
    }

    dragEnd() {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        this.container.style.cursor = 'grab';
        this.track.style.transition = 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)';
        
        // Добавляем инерцию
        const inertia = this.velocity * 80;
        this.currentTranslate += inertia;
        
        // Находим ближайший индекс для snap
        const itemWidth = 140;
        const targetIndex = Math.round(-this.currentTranslate / itemWidth);
        const clampedIndex = Math.max(0, Math.min(this.avatars.length - 1, targetIndex));
        
        this.snapToIndex(clampedIndex);
    }

    snapToIndex(index) {
        this.currentIndex = index;
        this.currentTranslate = -index * 140;
        this.prevTranslate = this.currentTranslate;
        this.velocity = 0;
        
        this.updatePositions();
        this.updateDots();
        this.onChange?.(this.avatars[index]);
    }

    updatePositions() {
        const avatars = this.track.querySelectorAll('.avatar-item');
        
        avatars.forEach((avatar, index) => {
            const position = (index - this.currentIndex) * 140 + this.currentTranslate;
            const distance = Math.abs(position);
            
            // Убираем все классы
            avatar.classList.remove('active', 'adjacent', 'far', 'hidden');
            
            // Добавляем классы в зависимости от расстояния
            if (distance < 70) {
                avatar.classList.add('active');
            } else if (distance < 180) {
                avatar.classList.add('adjacent');
            } else if (distance < 280) {
                avatar.classList.add('far');
            } else {
                avatar.classList.add('hidden');
            }
            
            // Позиционируем
            avatar.style.transform = `translateX(${position}px) translateY(-50%)`;
        });
        
        this.track.style.transform = `translateX(${this.currentTranslate}px)`;
    }

    updateDots() {
        const dots = document.querySelectorAll('.avatar-dot');
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === this.currentIndex);
        });
    }

    animate() {
        if (!this.isDragging && Math.abs(this.velocity) > 0.01) {
            // Плавное замедление
            this.currentTranslate += this.velocity * 15;
            this.velocity *= 0.85;
            
            this.updatePositions();
        }
        
        this.animationId = requestAnimationFrame(this.animate.bind(this));
    }

    onChange(callback) {
        this.onChange = callback;
    }
}

// Модальное окно
class WelcomeModal {
    constructor() {
        this.modal = document.getElementById('welcome-modal');
        this.carousel = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initCarousel();
    }

    initCarousel() {
        this.carousel = new AvatarCarousel();
        this.carousel.onChange(() => {
            this.validateForm();
        });
    }

    setupEventListeners() {
        const usernameInput = document.getElementById('username-input');
        const genderInputs = document.querySelectorAll('input[name="gender"]');
        const confirmBtn = document.getElementById('confirm-btn');

        usernameInput.addEventListener('input', () => {
            this.validateForm();
        });

        genderInputs.forEach(radio => {
            radio.addEventListener('change', () => {
                this.validateForm();
            });
        });

        confirmBtn.addEventListener('click', () => {
            this.saveUserData();
        });
    }

    validateForm() {
        const username = document.getElementById('username-input').value.trim();
        const genderSelected = document.querySelector('input[name="gender"]:checked');
        const confirmBtn = document.getElementById('confirm-btn');

        const isValid = username && genderSelected;
        confirmBtn.disabled = !isValid;
        
        return isValid;
    }

    saveUserData() {
        if (!this.validateForm()) {
            alert('Пожалуйста, заполните все поля');
            return;
        }

        const userData = {
            username: document.getElementById('username-input').value.trim(),
            gender: document.querySelector('input[name="gender"]:checked').value,
            avatar: this.carousel.avatars[this.carousel.currentIndex],
            firstVisit: false,
            timestamp: new Date().toISOString()
        };

        try {
            localStorage.setItem('userData', JSON.stringify(userData));
            
            // Редирект на главную страницу после сохранения
            window.location.href = '/front/html/main.html';
            
        } catch (error) {
            console.error('Ошибка сохранения данных:', error);
            alert('Ошибка сохранения данных');
        }
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    window.welcomeModal = new WelcomeModal();
    console.log('Модальное окно инициализировано и видимо');
});