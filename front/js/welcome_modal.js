    // Данные аватарок (из старого welcome_modal.js)
    const ALL_AVATARS = [
      { id: 'm1', type: 'male', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Mason&radius=50&backgroundColor=d1d4f9' },
      { id: 'm2', type: 'male', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Oliver&radius=50&backgroundColor=b6e3f4' },
      { id: 'm3', type: 'male', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Jocelyn&backgroundColor=d1d4f9,b6e3f4' },
      { id: 'robot', type: 'robot', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Jessica&skinColor=f2d3b1&backgroundColor=c0aede' },
      { id: 'f1', type: 'female', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Vivian&radius=50&backgroundColor=ffdfbf' },
      { id: 'f2', type: 'female', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Avery&backgroundColor=ffdfbf' },
      { id: 'f3', type: 'female', url: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Jude&hair=long06&hairColor=0e0e0e,3eac2c,562306,592454,6a4e35,85c2c6,ab2a18,ac6511,afafaf,b9a05f,cb6820,dba3be,e5d7a3&backgroundColor=ffdfbf' }
    ];

    document.addEventListener('DOMContentLoaded', function() {
      // Элементы страниц
      const page1 = document.getElementById('page1');
      const page2 = document.getElementById('page2');
      const page3 = document.getElementById('page3');
      const loginPage = document.getElementById('loginPage');
      const pages = [page1, page2, page3, loginPage];
      
      // Кнопки навигации
      const next1 = document.getElementById('next1');
      const next2 = document.getElementById('next2');
      const registerBtn = document.getElementById('registerBtn');
      const loginBtn = document.getElementById('loginBtn');
      
      // Элементы прогресс-бара
      const step1 = document.getElementById('step1');
      const step2 = document.getElementById('step2');
      const step3 = document.getElementById('step3');
      const steps = [step1, step2, step3];
      
      // Элементы форм
      const emailInput = document.getElementById('email-input');
      const nicknameInput = document.getElementById('nickname-input');
      const usernameInput = document.getElementById('username-input');
      const passwordInput = document.getElementById('password-input');
      const loginInput = document.getElementById('login-input');
      const loginPasswordInput = document.getElementById('login-password-input');
      const switchToLoginBtn = document.getElementById('switchToLoginBtn');
      const switchToRegisterBtn = document.getElementById('switchToRegisterBtn');
      const genderBtns = document.querySelectorAll('.gender-btn');
      
      // Элементы карусели аватарок
      const avatarTrack = document.getElementById('avatarTrack');
      const dotsWrap = document.getElementById('dots');

      // Состояние (из старого welcome_modal.js)
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

      // Текущая страница
      let currentPage = 1;

      // Функции из старого welcome_modal.js
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

      function snapToIndex(index) {
        currentIndex = Math.max(0, Math.min(avatars.length - 1, index));
        currentTranslate = 0;
        prevTranslate = 0;
        
        const items = Array.from(avatarTrack.children);
        items.forEach(item => {
          item.style.transition = 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)';
        });
        
        updatePositions();
        validateRegisterForm();
        
        setTimeout(() => {
          items.forEach(item => {
            item.style.transition = '';
          });
        }, 500);
      }

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

      function isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email.trim());
      }

      function isValidNickname(nickname) {
        const trimmed = nickname.trim();
        if (trimmed.length < 3 || trimmed.length > 50) return false;
        const re = /^[a-zA-Z0-9_]+$/;
        return re.test(trimmed);
      }

      function isValidPassword(password) {
        return password.length >= 6;
      }

      function showError(inputId, errorId, message) {
        const errorEl = document.getElementById(errorId);
        if (errorEl) {
          errorEl.textContent = message;
          errorEl.style.display = 'block';
        }
        const inputEl = document.getElementById(inputId);
        if (inputEl) {
          inputEl.style.borderColor = 'rgba(220, 53, 69, 0.5)';
        }
      }

      function hideError(inputId, errorId) {
        const errorEl = document.getElementById(errorId);
        if (errorEl) {
          errorEl.textContent = '';
          errorEl.style.display = 'none';
        }
        const inputEl = document.getElementById(inputId);
        if (inputEl) {
          inputEl.style.borderColor = '';
        }
      }

      function validateRegisterForm() {
        const email = emailInput.value.trim();
        const nickname = nicknameInput.value.trim();
        const password = passwordInput.value;
        const genderOK = Boolean(selectedGender);
        
        let isValid = true;
        
        // Валидация email
        if (!email) {
          showError('email-input', 'email-error', 'Email обязателен');
          isValid = false;
        } else if (!isValidEmail(email)) {
          showError('email-input', 'email-error', 'Неверный формат email');
          isValid = false;
        } else {
          hideError('email-input', 'email-error');
        }
        
        // Валидация nickname
        if (!nickname) {
          showError('nickname-input', 'nickname-error', 'Никнейм обязателен');
          isValid = false;
        } else if (!isValidNickname(nickname)) {
          showError('nickname-input', 'nickname-error', 'Никнейм может содержать только буквы, цифры и подчеркивание (3-50 символов)');
          isValid = false;
        } else {
          hideError('nickname-input', 'nickname-error');
        }
        
        // Валидация пароля
        if (!password) {
          showError('password-input', 'password-error', 'Пароль обязателен');
          isValid = false;
        } else if (!isValidPassword(password)) {
          showError('password-input', 'password-error', 'Пароль должен содержать минимум 6 символов');
          isValid = false;
        } else {
          hideError('password-input', 'password-error');
        }
        
        registerBtn.disabled = !(isValid && genderOK);
        return isValid && genderOK;
      }

      function validateLoginForm() {
        const login = loginInput.value.trim();
        const password = loginPasswordInput.value;
        
        let isValid = true;
        
        if (!login) {
          showError('login-input', 'login-error', 'Введите email или никнейм');
          isValid = false;
        } else {
          hideError('login-input', 'login-error');
        }
        
        if (!password) {
          showError('login-password-input', 'login-password-error', 'Введите пароль');
          isValid = false;
        } else {
          hideError('login-password-input', 'login-password-error');
        }
        
        return isValid;
      }

      async function persistProfile(app, payload) {
        if (app && typeof app.registerUser === 'function') {
          return app.registerUser(payload);
        }

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

      function redirectToMain() {
        const wrapper = document.querySelector('.wrapper');
        if (wrapper) {
          wrapper.style.opacity = '0';
          wrapper.style.transition = 'opacity 0.35s ease';
        }
        setTimeout(() => {
          window.location.href = '/front/html/main.html';
        }, 350);
      }

      // Функция переключения страниц
      function switchPage(targetPage) {
        // Скрываем все страницы
        pages.forEach(page => {
          page.classList.add('hidden');
        });

        // Показываем целевую страницу
        setTimeout(() => {
          pages[targetPage - 1].classList.remove('hidden');
        }, 50);

        // Обновление прогресс-бара (только для регистрации)
        if (targetPage <= 3) {
          steps.forEach((step, index) => {
            step.classList.remove('active');
            if (index + 1 <= targetPage) {
              step.classList.add('completed');
            } else {
              step.classList.remove('completed');
            }
          });
          steps[targetPage - 1].classList.add('active');
        }

        currentPage = targetPage;
      }

      function switchToLogin() {
        switchPage(4); // loginPage
      }

      function switchToRegister() {
        switchPage(1); // page1
      }

      // Инициализация карусели аватарок
      function initAvatarCarousel() {
        if (!avatarTrack) return;
        
        renderAvatars();
        
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

      // Настройка обработчиков событий
      function setupEventListeners() {
        // Валидация полей регистрации
        emailInput.addEventListener('input', validatePage1);
        nicknameInput.addEventListener('input', validatePage1);
        usernameInput.addEventListener('input', validatePage1);
        passwordInput.addEventListener('input', validatePage2);
        
        // Валидация полей входа
        loginInput.addEventListener('input', validateLoginForm);
        loginPasswordInput.addEventListener('input', validateLoginForm);
        
        // Выбор пола
        genderBtns.forEach(btn => {
          btn.addEventListener('click', function() {
            genderBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedGender = this.getAttribute('data-gender');
            applyFilter();
            validateRegisterForm();
          });
        });
        
        // Переключение между формами
        switchToLoginBtn.addEventListener('click', switchToLogin);
        switchToRegisterBtn.addEventListener('click', switchToRegister);
        
        // Навигация по страницам
        next1.addEventListener('click', function() {
          if (validatePage1()) {
            switchPage(2);
          }
        });

        next2.addEventListener('click', function() {
          if (validatePage2()) {
            switchPage(3);
          }
        });

        // Обработка кликов по прогресс-бару
        steps.forEach((step, index) => {
          step.addEventListener('click', function() {
            const targetPage = parseInt(this.getAttribute('data-page'));
            if (targetPage !== currentPage) {
              switchPage(targetPage);
            }
          });
        });

        // Регистрация
        registerBtn.addEventListener('click', async () => {
          if (!validateRegisterForm()) return;

          const email = emailInput.value.trim();
          const nickname = nicknameInput.value.trim();
          const password = passwordInput.value;
          const displayName = usernameInput.value.trim() || null;
          const avatar = avatars[currentIndex];

          const app = window.ConspectiumApp;
          if (app) {
            try {
              app.showLoading('Регистрируем...');
              await app.registerUser({
                email: email,
                nickname: nickname,
                password: password,
                display_name: displayName,
                gender: selectedGender,
                avatar_id: avatar?.id,
                avatar_url: avatar?.url,
              });
              app.hideLoading();
              redirectToMain();
            } catch (error) {
              console.error('[registration] Registration failed', error);
              app.hideLoading();
              const errorMessage = error.message || 'Не удалось зарегистрироваться';
              if (errorMessage.includes('email')) {
                showError('email-input', 'email-error', errorMessage);
              } else if (errorMessage.includes('никнейм')) {
                showError('nickname-input', 'nickname-error', errorMessage);
              } else {
                alert(errorMessage);
              }
            }
          } else {
            try {
              const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: email,
                  nickname: nickname,
                  password: password,
                  display_name: displayName,
                  gender: selectedGender,
                  avatar_id: avatar?.id,
                  avatar_url: avatar?.url,
                }),
              });

              if (!response.ok) {
                const text = await response.text();
                throw new Error(text || 'Не удалось зарегистрироваться');
              }

              const data = await response.json();
              localStorage.setItem('conspectium_token', data.token.access_token);
              localStorage.setItem('conspectium_user', JSON.stringify(data.user));
              redirectToMain();
            } catch (err) {
              console.error('[registration] Registration failed', err);
              alert('Не удалось зарегистрироваться: ' + (err?.message || err));
            }
          }
        });

        // Вход
        loginBtn.addEventListener('click', async () => {
          if (!validateLoginForm()) return;

          const login = loginInput.value.trim();
          const password = loginPasswordInput.value;

          const app = window.ConspectiumApp;
          if (app) {
            try {
              app.showLoading('Входим...');
              await app.loginUser(login, password);
              app.hideLoading();
              redirectToMain();
            } catch (error) {
              console.error('[registration] Login failed', error);
              app.hideLoading();
              const errorMessage = error.message || 'Неверный email/никнейм или пароль';
              showError('login-input', 'login-error', errorMessage);
              showError('login-password-input', 'login-password-error', '');
            }
          } else {
            try {
              const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  login: login,
                  password: password,
                }),
              });

              if (!response.ok) {
                const text = await response.text();
                throw new Error(text || 'Неверный email/никнейм или пароль');
              }

              const data = await response.json();
              localStorage.setItem('conspectium_token', data.token.access_token);
              localStorage.setItem('conspectium_user', JSON.stringify(data.user));
              redirectToMain();
            } catch (err) {
              console.error('[registration] Login failed', err);
              showError('login-input', 'login-error', 'Неверный email/никнейм или пароль');
            }
          }
        });
      }

      // Валидация отдельных страниц
      function validatePage1() {
        const email = emailInput.value.trim();
        const nickname = nicknameInput.value.trim();
        
        let isValid = true;
        
        if (!email) {
          showError('email-input', 'email-error', 'Email обязателен');
          isValid = false;
        } else if (!isValidEmail(email)) {
          showError('email-input', 'email-error', 'Неверный формат email');
          isValid = false;
        } else {
          hideError('email-input', 'email-error');
        }
        
        if (!nickname) {
          showError('nickname-input', 'nickname-error', 'Никнейм обязателен');
          isValid = false;
        } else if (!isValidNickname(nickname)) {
          showError('nickname-input', 'nickname-error', 'Никнейм может содержать только буквы, цифры и подчеркивание (3-50 символов)');
          isValid = false;
        } else {
          hideError('nickname-input', 'nickname-error');
        }
        
        return isValid;
      }

      function validatePage2() {
        const password = passwordInput.value;
        
        let isValid = true;
        
        if (!password) {
          showError('password-input', 'password-error', 'Пароль обязателен');
          isValid = false;
        } else if (!isValidPassword(password)) {
          showError('password-input', 'password-error', 'Пароль должен содержать минимум 6 символов');
          isValid = false;
        } else {
          hideError('password-input', 'password-error');
        }
        
        return isValid;
      }

      // Инициализация
      function init() {
        initAvatarCarousel();
        setupEventListeners();
        validatePage1();
      }

      init();
    });