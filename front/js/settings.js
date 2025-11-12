// Данные аватарок
const ALL_AVATARS = [
    { id: 'm1', type: 'male', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Mason&radius=50&backgroundColor=d1d4f9' },
    { id: 'm2', type: 'male', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Kingston&radius=50&backgroundColor=b6e3f4' },
    { id: 'm3', type: 'female', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Avery&radius=50&backgroundColor=b6e3f4' },
    { id: 'robot', type: 'robot', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Oliver&radius=50&backgroundColor=b6e3f4' },
    { id: 'f1', type: 'female', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Vivian&radius=50&backgroundColor=ffdfbf' },
    { id: 'f2', type: 'male', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Jocelyn&radius=50&backgroundColor=ffd5dc,c0aede' },
    { id: 'f3', type: 'female', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Valentina&skinColor=ecad80&backgroundColor=ffdfbf' },
    { id: 'm4', type: 'male', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Charlie&radius=50&backgroundColor=d1d4f9' },
    { id: 'f4', type: 'female', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Zoe&radius=50&backgroundColor=ffd5dc' }
];

const APP_USER_STORAGE_KEY = 'conspectium_user';

class SettingsManager {
    constructor() {
        this.currentAvatar = 'robot';
        this.userName = '';
        this.userGender = null;
        this.customAvatarUrl = null;
        this.userDescription = '';
        this.app = window.ConspectiumApp || null;
        this.saveTimer = null;
        this.saveButton = null;

        this.init();
    }

    async init() {
        if (!this.app) {
            console.warn('ConspectiumApp недоступно');
            return;
        }
        try {
            await this.app.ready();
        } catch (error) {
            console.error('Ошибка авторизации', error);
        }
        await this.loadUserData();
        this.setupEventListeners();
        this.renderCurrentAvatar();
    }

    async loadUserData() {
        try {
            let user = this.app?.state.user;
            if (!user) {
                user = await this.app.authFetch('/auth/me');
            }
            if (user) {
                this.applyUser(user);
                this.persistToLocalStorage();
                this.updateUI();
                return;
            }
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
        }
        this.loadFromStorageFallback();
        this.updateUI();
    }

    applyUser(user) {
        this.userName = user.display_name || user.first_name || '';
        this.userGender = user.gender || null;
        this.customAvatarUrl = user.avatar_url || null;
        this.userDescription = user.description || '';
        
        // Если есть загруженный аватар с устройства, устанавливаем currentAvatar в 'custom'
        // Иначе используем avatar_id из пользователя
        if (this.customAvatarUrl && this.customAvatarUrl.startsWith('/api/auth/avatar/')) {
            this.currentAvatar = 'custom';
        } else {
            this.currentAvatar = user.avatar_id || 'robot';
        }
    }

    loadFromStorageFallback() {
        try {
            const userData = localStorage.getItem('userData');
            if (userData) {
                const data = JSON.parse(userData);
                this.currentAvatar = data.avatar?.id || 'robot';
                this.userName = data.name || '';
                this.userGender = data.gender || null;
                this.customAvatarUrl = data.avatar?.url || null;
            }
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
        }
    }

    resolveAvatar() {
        // Если есть загруженный аватар с устройства, приоритет у него
        if (this.customAvatarUrl && this.customAvatarUrl.startsWith('/api/auth/avatar/')) {
            return { id: 'custom', type: 'custom', url: this.customAvatarUrl };
        }
        // Иначе проверяем, есть ли аватар в списке
        const fromList = ALL_AVATARS.find((avatar) => avatar.id === this.currentAvatar);
        if (fromList) {
            return fromList;
        }
        // Если есть customAvatarUrl (но не загруженный), используем его
        if (this.customAvatarUrl) {
            return { id: this.currentAvatar || 'custom', type: 'custom', url: this.customAvatarUrl };
        }
        return ALL_AVATARS.find((avatar) => avatar.id === 'robot') || ALL_AVATARS[0];
    }

    persistToLocalStorage() {
        try {
            const avatar = this.resolveAvatar();
            const payload = {
                name: this.userName,
                gender: this.userGender,
                avatar,
                timestamp: new Date().toISOString(),
            };
            localStorage.setItem('userData', JSON.stringify(payload));
        } catch (error) {
            console.error('Ошибка сохранения данных:', error);
        }
    }

    updateUI() {
        this.renderCurrentAvatar();

        const nameInput = document.getElementById('userNameInput');
        if (nameInput) {
            nameInput.value = this.userName;
        }

        const descriptionInput = document.getElementById('userDescriptionInput');
        if (descriptionInput) {
            descriptionInput.value = this.userDescription || '';
        }

        document.querySelectorAll('.gender-btn-settings').forEach((btn) => btn.classList.remove('selected'));
        if (this.userGender) {
            const radioId = `gender${this.userGender.charAt(0).toUpperCase() + this.userGender.slice(1)}Settings`;
            const radio = document.getElementById(radioId);
            if (radio) {
                radio.checked = true;
                const label = document.querySelector(`label[for="${radioId}"]`);
                label?.classList.add('selected');
            }
        }
    }

    renderCurrentAvatar() {
        const img = document.getElementById('currentAvatarImg');
        if (!img) return;
        
        // Если аватар загружен с устройства (customAvatarUrl начинается с /api/auth/avatar/)
        if (this.customAvatarUrl && this.customAvatarUrl.startsWith('/api/auth/avatar/')) {
            img.src = this.customAvatarUrl;
            return;
        }
        
        // Иначе используем аватар из коллекции
        const currentAvatar = this.resolveAvatar();
        if (currentAvatar) {
            img.src = currentAvatar.url;
        } else {
            // Fallback на дефолтный аватар
            const defaultAvatar = ALL_AVATARS.find(a => a.id === 'robot');
            if (defaultAvatar) {
                img.src = defaultAvatar.url;
            }
        }
    }

    setupEventListeners() {
        const changeAvatarBtn = document.getElementById('changeAvatarBtn');
        changeAvatarBtn?.addEventListener('click', () => this.showAvatarModal());

        const uploadAvatarBtn = document.getElementById('uploadAvatarBtn');
        const avatarUploadInput = document.getElementById('avatarUploadInput');
        if (uploadAvatarBtn && avatarUploadInput) {
            uploadAvatarBtn.addEventListener('click', () => {
                avatarUploadInput.click();
            });
            avatarUploadInput.addEventListener('change', async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                
                // Проверяем тип файла
                const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
                if (!allowedTypes.includes(file.type)) {
                    this.app?.notify('Неподдерживаемый тип файла. Разрешенные форматы: JPEG, PNG, WebP, GIF', 'error');
                    return;
                }
                
                // Проверяем размер файла (5 МБ)
                if (file.size > 5 * 1024 * 1024) {
                    this.app?.notify('Файл слишком большой. Максимальный размер: 5 МБ', 'error');
                    return;
                }
                
                try {
                    this.app?.showLoading('Загружаем аватар...');
                    const user = await this.app.uploadAvatar(file);
                    // Обновляем состояние из ответа сервера
                    this.applyUser(user);
                    // Убеждаемся, что customAvatarUrl правильно установлен
                    if (user.avatar_url) {
                        this.customAvatarUrl = user.avatar_url;
                        // Если аватар загружен с устройства, не устанавливаем avatar_id из списка
                        if (user.avatar_url.startsWith('/api/auth/avatar/')) {
                            this.currentAvatar = 'custom';
                        }
                    }
                    this.renderCurrentAvatar();
                    this.persistToLocalStorage();
                    this.app?.hideLoading();
                    this.app?.notify('Аватар успешно загружен', 'success');
                } catch (error) {
                    console.error('Ошибка загрузки аватара:', error);
                    this.app?.hideLoading();
                    
                    // Обработка ошибки 413 (Request Entity Too Large)
                    let errorMessage = error.message || 'Не удалось загрузить аватар';
                    
                    // Проверяем, не является ли это ошибкой 413 от nginx
                    if (errorMessage.includes('413') || errorMessage.includes('Request Entity Too Large') || errorMessage.includes('too large')) {
                        errorMessage = 'Файл слишком большой. Максимальный размер: 5 МБ. Если файл меньше 5 МБ, обратитесь к администратору - возможно, требуется настройка сервера.';
                    } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
                        errorMessage = 'Ошибка сети при загрузке аватара. Проверьте подключение к интернету.';
                    }
                    
                    this.app?.notify(errorMessage, 'error');
                } finally {
                    e.target.value = ''; // Сбрасываем значение input
                }
            });
        }

        this.saveButton = document.getElementById('saveProfileBtn');
        if (this.saveButton) {
            this.saveButton.addEventListener('click', async () => {
                this.saveButton.disabled = true;
                try {
                    await this.saveUserData({ notify: true, showLoading: true });
                } finally {
                    this.saveButton.disabled = false;
                }
            });
        }

        // Обработчик кнопки выхода
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                const confirmed = window.confirm('Вы уверены, что хотите выйти из аккаунта?');
                if (confirmed) {
                    if (this.app && this.app.logout) {
                        this.app.logout();
                    } else {
                        // Если app недоступен, очищаем вручную
                        localStorage.removeItem('conspectium_token');
                        localStorage.removeItem('conspectium_user');
                        window.location.href = '/front/html/welcome_modal.html';
                    }
                }
            });
        }
        
        const nameInput = document.getElementById('userNameInput');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.userName = e.target.value;
                this.scheduleSave();
            });
        }

        const descriptionInput = document.getElementById('userDescriptionInput');
        if (descriptionInput) {
            descriptionInput.addEventListener('input', (e) => {
                this.userDescription = e.target.value;
                this.scheduleSave();
            });
        }

        document.querySelectorAll('input[name="genderSettings"]').forEach((radio) => {
            radio.addEventListener('change', (e) => {
                this.userGender = e.target.value;
                document.querySelectorAll('.gender-btn-settings').forEach((btn) => btn.classList.remove('selected'));
                e.target.nextElementSibling?.classList.add('selected');
                this.scheduleSave(true);
            });
        });

        const avatarBlock = document.getElementById('currentAvatar');
        avatarBlock?.addEventListener('click', () => this.showAvatarModal());
        
        // Обработчик изменения пароля
        const changePasswordBtn = document.getElementById('changePasswordBtn');
        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', async () => {
                await this.handleChangePassword();
            });
        }
    }
    
    async handleChangePassword() {
        const oldPasswordInput = document.getElementById('oldPasswordInput');
        const newPasswordInput = document.getElementById('newPasswordInput');
        const confirmPasswordInput = document.getElementById('confirmPasswordInput');
        const changePasswordBtn = document.getElementById('changePasswordBtn');
        
        if (!oldPasswordInput || !newPasswordInput || !confirmPasswordInput || !changePasswordBtn) return;
        
        const oldPassword = oldPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        // Валидация на фронте
        let hasErrors = false;
        
        // Очистка предыдущих ошибок
        ['oldPasswordError', 'newPasswordError', 'confirmPasswordError'].forEach(id => {
            const errorEl = document.getElementById(id);
            if (errorEl) {
                errorEl.textContent = '';
                errorEl.style.display = 'none';
            }
        });
        
        if (!oldPassword) {
            this.showPasswordError('oldPasswordError', 'Введите текущий пароль');
            hasErrors = true;
        }
        
        if (!newPassword) {
            this.showPasswordError('newPasswordError', 'Введите новый пароль');
            hasErrors = true;
        } else if (newPassword.length < 6) {
            this.showPasswordError('newPasswordError', 'Пароль должен содержать минимум 6 символов');
            hasErrors = true;
        }
        
        if (!confirmPassword) {
            this.showPasswordError('confirmPasswordError', 'Подтвердите новый пароль');
            hasErrors = true;
        } else if (newPassword !== confirmPassword) {
            this.showPasswordError('confirmPasswordError', 'Пароли не совпадают');
            hasErrors = true;
        }
        
        if (hasErrors) return;
        
        if (!this.app) {
            alert('Приложение не загружено');
            return;
        }
        
        try {
            changePasswordBtn.disabled = true;
            this.app.showLoading('Изменяем пароль...');
            
            await this.app.changePassword(oldPassword, newPassword, confirmPassword);
            
            // Очистка полей
            oldPasswordInput.value = '';
            newPasswordInput.value = '';
            confirmPasswordInput.value = '';
            
            this.app.hideLoading();
            this.app.notify('Пароль успешно изменен', 'success');
        } catch (error) {
            console.error('Ошибка изменения пароля:', error);
            this.app.hideLoading();
            const errorMessage = error.message || 'Не удалось изменить пароль';
            
            if (errorMessage.includes('текущий пароль') || errorMessage.includes('Неверный')) {
                this.showPasswordError('oldPasswordError', errorMessage);
            } else if (errorMessage.includes('совпадают')) {
                this.showPasswordError('confirmPasswordError', errorMessage);
            } else {
                this.app.notify(errorMessage, 'error');
            }
        } finally {
            changePasswordBtn.disabled = false;
        }
    }
    
    showPasswordError(errorId, message) {
        const errorEl = document.getElementById(errorId);
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }

    showAvatarModal() {
        const modal = document.getElementById('avatarModal');
        if (!modal) return;
        modal.classList.add('visible');
        this.setupAvatarCarousel();
    }

    hideAvatarModal() {
        const modal = document.getElementById('avatarModal');
        if (!modal) return;
        modal.classList.remove('visible');
    }

    initAvatarCarousel() {
        this.setupAvatarCarousel();
    }

    setupAvatarCarousel() {
        const avatarSection = document.querySelector('.avatar-section');
        const confirmBtn = document.getElementById('confirmAvatarBtn');
        if (!avatarSection || !confirmBtn) return;

        let selectedAvatarId = this.currentAvatar;

        const createAvatarGrid = () => {
            avatarSection.innerHTML = `
                <div class="avatar-grid" id="avatarGridSettings"></div>
            `;

            const avatarGrid = document.getElementById('avatarGridSettings');

            ALL_AVATARS.forEach((avatar, index) => {
                const avatarItem = document.createElement('div');
                avatarItem.className = `avatar-grid-item ${avatar.id === selectedAvatarId ? 'selected' : ''}`;
                avatarItem.innerHTML = `
                    <img src="${avatar.url}" alt="Аватар ${index + 1}" loading="lazy">
                `;

                avatarItem.addEventListener('click', () => {
                    document.querySelectorAll('.avatar-grid-item').forEach((item) => item.classList.remove('selected'));
                    avatarItem.classList.add('selected');
                    selectedAvatarId = avatar.id;
                });

                avatarGrid.appendChild(avatarItem);
            });
        };

        const onConfirm = () => {
            this.currentAvatar = selectedAvatarId;
            const avatarData = ALL_AVATARS.find((item) => item.id === selectedAvatarId);
            this.customAvatarUrl = avatarData?.url || this.customAvatarUrl;
            this.renderCurrentAvatar();
            this.saveUserData({ notify: true });
            this.hideAvatarModal();
        };

        confirmBtn.onclick = onConfirm;

        const modal = document.getElementById('avatarModal');
        if (modal) {
            modal.onclick = (e) => {
                if (e.target === modal) {
                    this.hideAvatarModal();
                }
            };
        }

        createAvatarGrid();
    }

    async persistProfile(payload) {
        if (!this.app) return null;
        if (typeof this.app.updateProfile === 'function') {
            return this.app.updateProfile(payload);
        }
        const user = await this.app.authFetch('/auth/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (this.app.state) {
            this.app.state.user = user;
        }
        try {
            localStorage.setItem(APP_USER_STORAGE_KEY, JSON.stringify(user));
        } catch (error) {
            console.warn('Не удалось обновить кэш профиля', error);
        }
        return user;
    }

    scheduleSave(immediate = false) {
        if (!this.app) return;
        if (immediate) {
            clearTimeout(this.saveTimer);
            this.saveUserData().catch((error) => console.error(error));
            return;
        }
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            this.saveUserData().catch((error) => console.error(error));
        }, 600);
    }

    async saveUserData(options = {}) {
        if (!this.app) return;
        const { notify = false, showLoading = false } = options;
        
        // Определяем, есть ли загруженный аватар с устройства
        const hasUploadedAvatar = this.customAvatarUrl && this.customAvatarUrl.startsWith('/api/auth/avatar/');
        
        let avatarUrl = null;
        let avatarId = null;
        
        if (hasUploadedAvatar) {
            // Если есть загруженный аватар с устройства, используем его
            avatarUrl = this.customAvatarUrl;
            avatarId = null; // Очищаем avatar_id, так как используется загруженный аватар
        } else {
            // Иначе используем аватар из коллекции
            const avatar = this.resolveAvatar();
            avatarUrl = avatar?.url || null;
            avatarId = avatar?.id || null;
        }
        
        const payload = {
            display_name: this.userName.trim() || null,
            gender: this.userGender,
            avatar_id: avatarId,
            avatar_url: avatarUrl,
            description: this.userDescription?.trim() || null,
        };

        try {
            if (showLoading) {
                this.app.showLoading('Сохраняем профиль...');
            }
            const updatedUser = await this.persistProfile(payload);
            
            // Обновляем состояние из ответа сервера
            if (updatedUser) {
                this.applyUser(updatedUser);
                // Убеждаемся, что customAvatarUrl сохранен правильно
                if (updatedUser.avatar_url && updatedUser.avatar_url.startsWith('/api/auth/avatar/')) {
                    this.customAvatarUrl = updatedUser.avatar_url;
                    this.currentAvatar = 'custom';
                }
            } else {
                // Если сервер не вернул обновленного пользователя, обновляем локально
                if (hasUploadedAvatar) {
                    this.customAvatarUrl = avatarUrl;
                    this.currentAvatar = 'custom';
                }
            }
            this.persistToLocalStorage();
            this.renderCurrentAvatar(); // Обновляем отображение аватара
            if (notify) {
                this.app.notify('Профиль сохранён', 'success');
            }
        } catch (error) {
            console.error('Ошибка сохранения данных:', error);
            this.app.notify(error.message || 'Не удалось сохранить данные', 'error');
        } finally {
            if (showLoading) {
                this.app.hideLoading();
            }
        }
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {    
    // Инициализируем менеджер настроек
    window.settingsManager = new SettingsManager();
});

// Liquid Toggles с GSAP
gsap.registerPlugin(Draggable);

const config = {
  theme: 'dark',
  complete: 0,
  active: false,
  deviation: 2,
  alpha: 16,
  bounce: true,
  hue: 144,
  delta: true,
  bubble: true,
  mapped: false,
  debug: false,
};

const update = () => {
  gsap.set('#goo feGaussianBlur', {
    attr: {
      stdDeviation: config.deviation,
    },
  });
  gsap.set('#goo feColorMatrix', {
    attr: {
      values: `
        1 0 0 0 0
        0 1 0 0 0
        0 0 1 0 0
        0 0 0 ${config.alpha} -10
      `,
    },
  });
  document.documentElement.dataset.theme = config.theme;
  document.documentElement.dataset.mapped = config.mapped;
  document.documentElement.dataset.delta = config.delta;
  document.documentElement.dataset.debug = config.debug;
  document.documentElement.dataset.bounce = config.bounce;
};

update();

const toggles = document.querySelectorAll('.liquid-toggle');

toggles.forEach((toggle) => {
  const setting = toggle.dataset.setting;
  const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
  const isPressed = settings.hasOwnProperty(setting) ? settings[setting] : true;
  toggle.setAttribute('aria-pressed', isPressed);
  gsap.set(toggle, { '--complete': isPressed ? 100 : 0 });

  const toggleState = async () => {
    toggle.dataset.pressed = true;
    if (config.bubble) toggle.dataset.active = true;
    await Promise.allSettled(
      !config.bounce ? toggle.getAnimations({ subtree: true }).map((a) => a.finished) : []
    );
    const pressed = toggle.matches('[aria-pressed=true]');
    gsap.timeline({
      onComplete: () => {
        gsap.delayedCall(0.05, () => {
          toggle.dataset.active = false;
          toggle.dataset.pressed = false;
          toggle.setAttribute('aria-pressed', !pressed);
          const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
          settings[setting] = toggle.matches('[aria-pressed=true]');
          localStorage.setItem('appSettings', JSON.stringify(settings));
        });
      },
    }).to(toggle, {
      '--complete': pressed ? 0 : 100,
      duration: 0.12,
      delay: config.bounce && config.bubble ? 0.18 : 0,
    });
  };

  const proxy = document.createElement('div');
  Draggable.create(proxy, {
    allowContextMenu: true,
    handle: toggle,
    onDragStart: function () {
      const toggleBounds = toggle.getBoundingClientRect();
      const pressed = toggle.matches('[aria-pressed=true]');
      const bounds = pressed ? toggleBounds.left - this.pointerX : toggleBounds.left + toggleBounds.width - this.pointerX;
      this.dragBounds = bounds;
      toggle.dataset.active = true;
    },
    onDrag: function () {
      const pressed = toggle.matches('[aria-pressed=true]');
      const dragged = this.x - this.startX;
      const complete = gsap.utils.clamp(0, 100, pressed ? gsap.utils.mapRange(this.dragBounds, 0, 0, 100, dragged) : gsap.utils.mapRange(0, this.dragBounds, 0, 100, dragged));
      this.complete = complete;
      gsap.set(toggle, { '--complete': complete, '--delta': Math.min(Math.abs(this.deltaX), 12) });
    },
    onDragEnd: function () {
      gsap.fromTo(toggle, { '--complete': this.complete }, {
        '--complete': this.complete >= 50 ? 100 : 0,
        duration: 0.15,
        onComplete: () => {
          gsap.delayedCall(0.05, () => {
            toggle.dataset.active = false;
            toggle.setAttribute('aria-pressed', this.complete >= 50);
            const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
            settings[setting] = toggle.matches('[aria-pressed=true]');
            localStorage.setItem('appSettings', JSON.stringify(settings));
          });
        },
      });
    },
    onPress: function () {
      this.__pressTime = Date.now();
      if ('ontouchstart' in window && navigator.maxTouchPoints > 0) toggle.dataset.active = true;
    },
    onRelease: function () {
      this.__releaseTime = Date.now();
      gsap.set(toggle, { '--delta': 0 });
      if ('ontouchstart' in window && navigator.maxTouchPoints > 0 && ((this.startX !== undefined && this.endX !== undefined && Math.abs(this.endX - this.startX) < 4) || this.endX === undefined)) toggle.dataset.active = false;
      if (this.__releaseTime - this.__pressTime <= 150) {
        toggleState();
      }
    },
  });

  toggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      toggleState();
    }
    if (e.key === ' ') {
      e.preventDefault();
    }
  });

  toggle.addEventListener('keyup', (e) => {
    if (e.key === ' ') {
      toggleState();
    }
  });
});
