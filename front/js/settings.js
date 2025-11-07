// Данные аватарок
const ALL_AVATARS = [
    { id: 'm1', type: 'male', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Mason&radius=50&backgroundColor=d1d4f9' },
    { id: 'm2', type: 'male', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Kingston&radius=50&backgroundColor=b6e3f4' },
    { id: 'm3', type: 'male', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Avery&radius=50&backgroundColor=b6e3f4' },
    { id: 'robot', type: 'robot', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Oliver&radius=50&backgroundColor=b6e3f4' },
    { id: 'f1', type: 'female', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Vivian&radius=50&backgroundColor=ffdfbf' },
    { id: 'f2', type: 'female', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Jocelyn&radius=50&backgroundColor=ffd5dc,c0aede' },
    { id: 'f3', type: 'female', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Vivian&radius=50&backgroundColor=ffdfbf' },
    { id: 'm4', type: 'male', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Charlie&radius=50&backgroundColor=d1d4f9' },
    { id: 'f4', type: 'female', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Zoe&radius=50&backgroundColor=ffd5dc' }
];

class SettingsManager {
    constructor() {
        this.currentAvatar = 'robot';
        this.userName = '';
        this.userGender = null;
        
        this.init();
    }

    init() {
        this.loadUserData();
        this.setupEventListeners();
        this.renderCurrentAvatar();
    }

    loadUserData() {
        try {
            const userData = localStorage.getItem('userData');
            if (userData) {
                const data = JSON.parse(userData);
                this.currentAvatar = data.avatar?.id || 'robot';
                this.userName = data.name || '';
                this.userGender = data.gender || null;
            }
            this.updateUI();
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
        }
    }

    updateUI() {
        // Обновляем аватар
        this.renderCurrentAvatar();
        
        // Обновляем имя
        document.getElementById('userNameInput').value = this.userName;
        
        // Обновляем пол
        if (this.userGender) {
            const radioId = `gender${this.userGender.charAt(0).toUpperCase() + this.userGender.slice(1)}Settings`;
            document.getElementById(radioId).checked = true;
            document.querySelector(`label[for="${radioId}"]`).classList.add('selected');
        }
    }

    renderCurrentAvatar() {
        const currentAvatar = ALL_AVATARS.find(avatar => avatar.id === this.currentAvatar) || ALL_AVATARS[3];
        document.getElementById('currentAvatarImg').src = currentAvatar.url;
    }

    setupEventListeners() {
        // Кнопка смены аватара
        document.getElementById('changeAvatarBtn').addEventListener('click', () => {
            this.showAvatarModal();
        });

        // Ввод имени
        document.getElementById('userNameInput').addEventListener('input', (e) => {
            this.userName = e.target.value.trim();
            this.saveUserData();
        });

        // Выбор пола
        document.querySelectorAll('input[name="genderSettings"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.userGender = e.target.value;
                document.querySelectorAll('.gender-btn-settings').forEach(btn => {
                    btn.classList.remove('selected');
                });
                e.target.nextElementSibling.classList.add('selected');
                this.saveUserData();
            });
        });

        // Текущий аватар (клик для открытия модалки)
        document.getElementById('currentAvatar').addEventListener('click', () => {
            this.showAvatarModal();
        });
    }

    showAvatarModal() {
        const modal = document.getElementById('avatarModal');
        modal.classList.add('visible');
        this.initAvatarCarousel();
    }

    hideAvatarModal() {
        const modal = document.getElementById('avatarModal');
        modal.classList.remove('visible');
    }

    initAvatarCarousel() {
        this.setupAvatarCarousel();
    }

    setupAvatarCarousel() {
        const avatarSection = document.querySelector('.avatar-section');
        const confirmBtn = document.getElementById('confirmAvatarBtn');
        
        let selectedAvatarId = this.currentAvatar;

        // Создаем сетку аватарок
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
                    // Убираем выделение у всех аватарок
                    document.querySelectorAll('.avatar-grid-item').forEach(item => {
                        item.classList.remove('selected');
                    });
                    
                    // Добавляем выделение выбранной аватарке
                    avatarItem.classList.add('selected');
                    selectedAvatarId = avatar.id;
                });
                
                avatarGrid.appendChild(avatarItem);
            });
        };

        // Кнопка подтверждения
        confirmBtn.addEventListener('click', () => {
            this.currentAvatar = selectedAvatarId;
            this.renderCurrentAvatar();
            this.saveUserData();
            this.hideAvatarModal();
        });

        // Закрытие модалки по клику на фон
        document.getElementById('avatarModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('avatarModal')) {
                this.hideAvatarModal();
            }
        });

        createAvatarGrid();
    }

    saveUserData() {
        const userData = {
            name: this.userName,
            gender: this.userGender,
            avatar: ALL_AVATARS.find(avatar => avatar.id === this.currentAvatar),
            timestamp: new Date().toISOString()
        };
        
        try {
            localStorage.setItem('userData', JSON.stringify(userData));
        } catch (error) {
            console.error('Ошибка сохранения данных:', error);
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