// Данные аватарок
const ALL_AVATARS = [
    { id: 'm1', type: 'male', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Mason&radius=50&backgroundColor=d1d4f9' },
    { id: 'm2', type: 'male', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Oliver&radius=50&backgroundColor=b6e3f4' },
    { id: 'm3', type: 'male', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Jocelyn&backgroundColor=d1d4f9,b6e3f4' },
    { id: 'robot', type: 'robot', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Jessica&skinColor=f2d3b1&backgroundColor=c0aede' },
    { id: 'f1', type: 'female', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Vivian&radius=50&backgroundColor=ffdfbf' },
    { id: 'f2', type: 'female', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Avery&backgroundColor=ffdfbf' },
    { id: 'f3', type: 'female', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Jude&hair=long06&hairColor=0e0e0e,3eac2c,562306,592454,6a4e35,85c2c6,ab2a18,ac6511,afafaf,b9a05f,cb6820,dba3be,e5d7a3&backgroundColor=ffdfbf' }
];

// Элементы DOM
const avatarTrack = document.getElementById('avatarTrack');
const dotsWrap = document.getElementById('dots');
const nameInput = document.getElementById('username-input');
const confirmBtn = document.getElementById('confirmBtn');
const genderInputs = document.querySelectorAll('input[name="gender"]');

// Состояние
let avatars = ALL_AVATARS.slice();
let currentIndex = 3; // Робот по центру
let selectedGender = null;
let selectedAvatarId = 'robot';
let isDragging = false;
let startX = 0;
let currentTranslate = 0;
let prevTranslate = 0;
let velocity = 0;
let lastX = 0;
let lastTime = 0;
const ITEM_SPACING = 145;

async function persistProfile(app, payload) {
    // If the main application is present and exposes registerUser, prefer it.
    if (app && typeof app.registerUser === 'function') {
        return app.registerUser(payload);
    }

    // Otherwise, call the public register endpoint directly. This covers the
    // standalone welcome_modal page or cases when the application object is
    // present but its registerUser failed and we want a fallback.
    const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Не удалось зарегистрировать пользователя');
    }

    const data = await response.json();
    try {
        localStorage.setItem('conspectium_token', data.token.access_token);
        localStorage.setItem('conspectium_user', JSON.stringify(data.user));
    } catch (error) {
        console.warn('Не удалось сохранить данные сессии', error);
    }

    return data.user;
}

// Рендер аватарок
function renderAvatars() {
    avatarTrack.innerHTML = '';
    
    avatars.forEach((avatar, index) => {
        const avatarEl = document.createElement('div');
        avatarEl.className = 'avatar-item';
        avatarEl.dataset.index = index;
        avatarEl.dataset.avatarId = avatar.id;
        avatarEl.innerHTML = `<img src="${avatar.url}" alt="Аватар ${index + 1}" loading="lazy">`;
        
        avatarEl.addEventListener('click', () => {
            if (!isDragging) {
                selectedAvatarId = avatar.id;
                snapToIndex(index);
            }
        });
        
        avatarTrack.appendChild(avatarEl);
    });
    
    renderDots();
    updatePositions();
}

// Рендер точек
function renderDots() {
    dotsWrap.innerHTML = '';
    
    avatars.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.className = 'avatar-dot';
        dot.dataset.index = index;
        
        dot.addEventListener('click', () => {
            selectedAvatarId = avatars[index].id;
            snapToIndex(index);
        });
        
        dotsWrap.appendChild(dot);
    });
}

// Обновление позиций
function updatePositions() {
    const items = Array.from(avatarTrack.children);
    
    items.forEach((item, index) => {
        const offsetIndex = index - currentIndex;
        const baseX = offsetIndex * ITEM_SPACING + currentTranslate;
        
        item.style.transform = `translate(-50%, -50%) translateX(${baseX}px)`;
        
        const abs = Math.abs(baseX);
        item.classList.remove('active', 'adjacent', 'far', 'hidden');
        
        if (abs < 50) {
            item.classList.add('active');
        } else if (abs < 140) {
            item.classList.add('adjacent');
        } else if (abs < 280) {
            item.classList.add('far');
        } else {
            item.classList.add('hidden');
        }
    });
    
    // Обновляем точки
    const dots = Array.from(dotsWrap.children);
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentIndex);
    });
}

// Snap к индексу
function snapToIndex(index) {
    currentIndex = Math.max(0, Math.min(avatars.length - 1, index));
    currentTranslate = 0;
    prevTranslate = 0;
    
    const items = Array.from(avatarTrack.children);
    items.forEach(item => {
        item.style.transition = 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)';
    });
    
    updatePositions();
    validateForm();
    
    setTimeout(() => {
        items.forEach(item => {
            item.style.transition = '';
        });
    }, 500);
}

// Drag события
function onDragStart(clientX) {
    isDragging = true;
    startX = clientX;
    lastX = clientX;
    lastTime = performance.now();
    velocity = 0;
    
    const items = Array.from(avatarTrack.children);
    items.forEach(item => {
        item.style.transition = 'none';
    });
}

function onDragMove(clientX) {
    if (!isDragging) return;
    
    const dx = clientX - startX;
    currentTranslate = dx;
    
    const now = performance.now();
    const dt = now - lastTime || 16;
    const dv = (clientX - lastX) / dt;
    velocity = dv;
    lastX = clientX;
    lastTime = now;
    
    updatePositions();
}

function onDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    
    const inertia = velocity * 100;
    const raw = -(currentTranslate + inertia) / ITEM_SPACING;
    let target = Math.round(raw) + currentIndex;
    target = Math.max(0, Math.min(avatars.length - 1, target));
    
    selectedAvatarId = avatars[target].id;
    snapToIndex(target);
}

// Применение фильтра по полу
function applyFilter() {
    if (!selectedGender) {
        avatars = ALL_AVATARS.slice();
        const savedIndex = avatars.findIndex(a => a.id === selectedAvatarId);
        currentIndex = savedIndex !== -1 ? savedIndex : 3;
    } else {
        const sameGender = ALL_AVATARS.filter(a => a.type === selectedGender).slice(0, 3);
        const mid = Math.floor((sameGender.length + 1) / 2);
        const leftCount = Math.floor(sameGender.length / 2);
        const left = sameGender.slice(0, leftCount);
        const right = sameGender.slice(leftCount);
        
        const newAvatars = [];
        newAvatars.push(...left);
        newAvatars.push(ALL_AVATARS.find(a => a.type === 'robot'));
        newAvatars.push(...right);
        avatars = newAvatars;
        
        const savedIndex = avatars.findIndex(a => a.id === selectedAvatarId);
        currentIndex = savedIndex !== -1 ? savedIndex : avatars.findIndex(a => a.type === 'robot');
    }
    
    renderAvatars();
}

// Валидация имени
function isNameValid(name) {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 20) return false;
    const re = /^[A-Za-z\u0400-\u04FF\s\-]+$/u;
    return re.test(trimmed);
}

// Валидация формы
function validateForm() {
    const name = nameInput.value || '';
    const nameOK = isNameValid(name);
    const genderOK = Boolean(selectedGender);
    confirmBtn.disabled = !(nameOK && genderOK);
    return !confirmBtn.disabled;
}

// События
function setupEventListeners() {
    // Drag события для карусели
    avatarTrack.addEventListener('mousedown', (e) => {
        e.preventDefault();
        onDragStart(e.clientX);
    });
    
    document.addEventListener('mousemove', (e) => {
        if (isDragging) onDragMove(e.clientX);
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) onDragEnd();
    });
    
    // Touch события
    avatarTrack.addEventListener('touchstart', (e) => {
        onDragStart(e.touches[0].clientX);
    }, { passive: true });
    
    avatarTrack.addEventListener('touchmove', (e) => {
        onDragMove(e.touches[0].clientX);
    }, { passive: true });
    
    avatarTrack.addEventListener('touchend', () => {
        onDragEnd();
    });
    
    // Ввод имени
    nameInput.addEventListener('input', validateForm);
    
    // Выбор пола
    genderInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            selectedGender = e.target.value;
            applyFilter();
            validateForm();
        });
    });
    
    // Кнопка подтверждения
    confirmBtn.addEventListener('click', async () => {
        console.debug('[welcome_modal] confirm click - validating form');
        const valid = validateForm();
        console.debug('[welcome_modal] form valid:', valid, 'name:', nameInput.value, 'gender:', selectedGender);
        if (!valid) return;

        const userData = {
            name: nameInput.value.trim(),
            gender: selectedGender,
            avatar: avatars[currentIndex],
            timestamp: new Date().toISOString()
        };

        const app = window.ConspectiumApp;
        console.debug('[welcome_modal] ConspectiumApp present:', !!app);
        if (app) {
            try {
                console.debug('[welcome_modal] using app.registerUser');
                app.showLoading('Сохраняем профиль...');
                await persistProfile(app, {
                    display_name: userData.name,
                    gender: userData.gender,
                    avatar_id: userData.avatar?.id,
                    avatar_url: userData.avatar?.url,
                });
                app.hideLoading();
                console.debug('[welcome_modal] persistProfile (via app) completed');
            } catch (error) {
                console.error('[welcome_modal] persistProfile via app failed', error);
                try { app.hideLoading(); } catch (e) {}
                try { app.notify(error.message || 'Не удалось сохранить профиль', 'error'); } catch (e) {}
                // proceed to fallback below to attempt direct registration
            }
        }

        // If app-based registration didn't produce a token, attempt direct
        // registration fallback to ensure we have a session token stored.
        if (!localStorage.getItem('conspectium_token')) {
            console.debug('[welcome_modal] no token found after app.registerUser; trying direct fallback');
            try {
                await persistProfile(null, {
                    display_name: userData.name,
                    gender: userData.gender,
                    avatar_id: userData.avatar?.id,
                    avatar_url: userData.avatar?.url,
                });
                console.debug('[welcome_modal] fallback direct registration succeeded');
            } catch (err) {
                console.error('[welcome_modal] fallback direct registration failed', err);
                // Show an error to the user and stop
                const appNotify = window.ConspectiumApp?.notify;
                if (typeof appNotify === 'function') {
                    try { appNotify('Не удалось зарегистрировать пользователя', 'error'); } catch (e) {}
                } else {
                    alert('Не удалось зарегистрировать пользователя: ' + (err?.message || err));
                }
                return;
            }
        }

        try {
            localStorage.setItem('userData', JSON.stringify(userData));
        } catch (error) {
            console.error('Ошибка сохранения:', error);
        }

        console.debug('[welcome_modal] finished persistProfile; localStorage token:', localStorage.getItem('conspectium_token'));

        // Плавно закрываем модал и затем перенаправляем на основную страницу.
        // Ранее редирект выполнялся только когда welcome_modal запускался как
        // отдельная страница, что приводило к расхождению состояния при
        // встроенном вызове из main.html — в итоге показывался "демо" блок
        // и модал открывался повторно. Чтобы избежать этого, всегда
        // переходим на main.html после успешной регистрации.
        const modal = document.querySelector('.welcome-modal-overlay');
        if (modal) {
            modal.style.opacity = '0';
            modal.style.transition = 'opacity 0.35s ease';
        }

        setTimeout(() => {
            try {
                if (modal && modal.parentNode) modal.remove();
            } catch (e) {
                // ignore
            }
            console.log('Данные сохранены:', userData);
            // Перенаправляем на основную страницу, чтобы приложение
            // корректно инициализировало состояние (token/user из localStorage).
            window.location.href = '/front/html/main.html';
        }, 350);
    });
    
    // Клавиши для навигации
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            selectedAvatarId = avatars[(currentIndex - 1 + avatars.length) % avatars.length].id;
            snapToIndex(currentIndex - 1);
        } else if (e.key === 'ArrowRight') {
            selectedAvatarId = avatars[(currentIndex + 1) % avatars.length].id;
            snapToIndex(currentIndex + 1);
        }
    });
}

// Инициализация
function init() {
    renderAvatars();
    setupEventListeners();
    currentTranslate = 0;
    prevTranslate = 0;
}

// Запуск
document.addEventListener('DOMContentLoaded', init);
