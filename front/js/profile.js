(() => {
    let app = null;
    let currentProfile = null;
    let isEditing = false;

    document.addEventListener('DOMContentLoaded', async () => {
        app = window.ConspectiumApp;
        if (!app) {
            console.error('ConspectiumApp not found');
            showError('Приложение не загружено');
            return;
        }

        // Получаем идентификатор пользователя из URL
        const params = new URLSearchParams(window.location.search);
        const userIdentifier = params.get('user');

        if (!userIdentifier) {
            // Если не указан пользователь, загружаем свой профиль
            try {
                await app.ready();
                const currentUser = app.state.user;
                if (currentUser) {
                    await loadProfile(currentUser.id.toString());
                } else {
                    showError('Не удалось загрузить профиль. Войдите в аккаунт.');
                }
            } catch (err) {
                console.error('Error loading own profile:', err);
                // Если пользователь не авторизован, предлагаем войти
                showError('Для просмотра профиля необходимо войти в аккаунт. <a href="/front/html/welcome_modal.html" style="color: #f5d86e;">Войти</a>');
            }
        } else {
            // Загружаем профиль указанного пользователя (публичный доступ)
            await loadProfile(userIdentifier);
        }

        setupEventListeners();
    });

    async function loadProfile(userIdentifier) {
        try {
            const profile = await app.getProfile(userIdentifier);
            currentProfile = profile;
            
            // Отладочная информация
            console.log('Profile loaded:', {
                userIdentifier,
                profileId: profile.id,
                is_own_profile: profile.is_own_profile,
                currentUser: app.state?.user?.id
            });
            
            renderProfile(profile);
        } catch (err) {
            console.error('Error loading profile:', err);
            showError('Не удалось загрузить профиль');
        }
    }

    function renderProfile(profile) {
        // Обновляем имя
        const nameEl = document.querySelector('.name');
        if (nameEl) {
            nameEl.textContent = profile.display_name || profile.nickname || 'Без имени';
        }

        // Обновляем никнейм
        const titleEl = document.querySelector('.title');
        if (titleEl) {
            titleEl.textContent = `@${profile.nickname}`;
        }

        // Обновляем описание
        const descEl = document.querySelector('.desc');
        if (descEl) {
            descEl.textContent = profile.description || 'Нет описания';
        }

        // Обновляем количество подписчиков и подписок
        const followersEl = document.querySelector('.follow-info h2:first-child span');
        if (followersEl) {
            followersEl.textContent = profile.followers_count || 0;
        }

        const followingEl = document.querySelector('.follow-info h2:last-child span');
        if (followingEl) {
            followingEl.textContent = profile.following_count || 0;
        }

        // Обновляем кнопку подписки
        const followBtn = document.querySelector('.follow-btn button');
        if (followBtn && !profile.is_own_profile) {
            if (profile.is_following) {
                followBtn.textContent = 'Отписаться';
                followBtn.classList.add('following');
            } else {
                followBtn.textContent = 'Подписаться';
                followBtn.classList.remove('following');
            }
            followBtn.style.display = 'block';
        } else if (followBtn && profile.is_own_profile) {
            followBtn.style.display = 'none';
        }

        // Обновляем меню (показываем только для своего профиля)
        const menuOpener = document.getElementById('menuOpener');
        if (menuOpener) {
            // Проверяем, является ли это профилем текущего пользователя
            // Если is_own_profile не установлен, проверяем по ID
            let shouldShow = profile.is_own_profile;
            
            if (!shouldShow && app.state?.user) {
                // Дополнительная проверка: сравниваем ID профиля с ID текущего пользователя
                shouldShow = profile.id === app.state.user.id;
            }
            
            console.log('Menu visibility check:', {
                is_own_profile: profile.is_own_profile,
                profileId: profile.id,
                currentUserId: app.state?.user?.id,
                shouldShow
            });
            
            if (shouldShow) {
                menuOpener.style.display = 'block';
            } else {
                menuOpener.style.display = 'none';
            }
        }

        // Обновляем аватар (если есть)
        const bannerEl = document.querySelector('.banner');
        if (bannerEl) {
            const svg = bannerEl.querySelector('svg');
            const existingImg = bannerEl.querySelector('img');
            
            if (profile.avatar_url) {
                // Если есть существующее изображение, обновляем его
                if (existingImg) {
                    existingImg.src = profile.avatar_url;
                    existingImg.alt = profile.display_name || profile.nickname;
                } else if (svg) {
                    // Сохраняем оригинальный SVG для восстановления при ошибке
                    const originalSvg = svg.cloneNode(true);
                    
                    // Создаем элемент изображения для аватара
                    const avatarImg = document.createElement('img');
                    avatarImg.src = profile.avatar_url;
                    avatarImg.alt = profile.display_name || profile.nickname;
                    avatarImg.className = 'profile-avatar';
                    avatarImg.onerror = () => {
                        // Если аватар не загрузился, восстанавливаем SVG
                        if (avatarImg.parentNode) {
                            avatarImg.parentNode.replaceChild(originalSvg, avatarImg);
                        }
                    };
                    // Заменяем SVG на аватар
                    if (svg.parentNode) {
                        svg.parentNode.replaceChild(avatarImg, svg);
                    }
                }
            } else if (existingImg) {
                // Если нет аватара, но есть изображение, восстанавливаем SVG
                // Создаем новый SVG из HTML (если он не сохранен)
                const svgPath = `
                    <svg viewBox="0 0 100 100">
                        <path d="m38.977 59.074c0 2.75-4.125 2.75-4.125 0s4.125-2.75 4.125 0"></path>
                        <path d="m60.477 59.074c0 2.75-4.125 2.75-4.125 0s4.125-2.75 4.125 0"></path>
                        <path d="m48.203 69.309c1.7344 0 3.1484-1.4141 3.1484-3.1484 0-0.27734-0.22266-0.5-0.5-0.5-0.27734 0-0.5 0.22266-0.5 0.5 0 1.1836-0.96484 2.1484-2.1484 2.1484s-2.1484-0.96484-2.1484-2.1484c0-0.27734-0.22266-0.5-0.5-0.5-0.27734 0-0.5 0.22266-0.5 0.5 0 1.7344 1.4141 3.1484 3.1484 3.1484z"></path>
                        <path d="m35.492 24.371c0.42187-0.35156 0.48047-0.98438 0.125-1.4062-0.35156-0.42188-0.98438-0.48438-1.4062-0.125-5.1602 4.3047-16.422 17.078-9.5312 42.562 0.21484 0.79688 0.85547 1.4062 1.6641 1.582 0.15625 0.035156 0.31641 0.050781 0.47266 0.050781 0.62891 0 1.2344-0.27344 1.6445-0.76562 0.82812-0.98828 2.0039-1.5391 2.793-1.8203 0.56641 1.6055 1.4766 3.3594 2.9727 4.9414 2.2852 2.4219 5.4336 3.9453 9.3867 4.5547-3.6055 4.5-3.8047 10.219-3.8086 10.484-0.011719 0.55078 0.42187 1.0078 0.97656 1.0234h0.023438c0.53906 0 0.98437-0.42969 1-0.97266 0-0.054688 0.17187-4.8711 2.9805-8.7773 0.63281 1.2852 1.7266 2.5 3.4141 2.5 1.7109 0 2.7578-1.2695 3.3398-2.6172 2.8867 3.9258 3.0586 8.8359 3.0586 8.8906 0.015625 0.54297 0.46094 0.97266 1 0.97266h0.023438c0.55078-0.015625 0.98828-0.47266 0.97656-1.0234-0.007812-0.26953-0.20703-6.0938-3.9141-10.613 7.0781-1.3086 10.406-5.4219 11.969-8.9766 1.0508 0.98828 2.75 2.1992 4.793 2.1992 0.078126 0 0.15625 0 0.23828-0.003906 0.47266-0.023438 1.5781-0.074219 3.4219-4.4219 1.1172-2.6406 2.1406-6.0117 2.8711-9.4922 4.8281-22.945-4.7852-30.457-9.1445-32.621-12.316-6.1172-22.195-3.6055-28.312-0.42188-0.48828 0.25391-0.67969 0.85938-0.42578 1.3477s0.85938 0.67969 1.3477 0.42578c5.7031-2.9688 14.934-5.3047 26.5 0.4375 7.1875 3.5703 9 11.586 9.2539 17.684 0.49609 11.93-4.2617 23.91-5.7344 25.062h-0.015626c-1.832 0-3.4102-1.5742-4.0352-2.2852 0.28906-0.99609 0.44531-1.8672 0.52734-2.5117 0.62891 0.16797 1.2812 0.27344 1.9727 0.27344 0.55469 0 1-0.44922 1-1 0-0.55078-0.44531-1-1-1-7.3203 0-10.703-13.941-10.734-14.082-0.097656-0.40625-0.4375-0.71094-0.85156-0.76172-0.43359-0.050781-0.82031 0.16406-1.0117 0.53906-1.8984 3.7188-1.4297 6.7539-0.67969 8.668-6.2383-2.2852-8.9766-8.6914-9.0078-8.7617-0.17969-0.43359-0.62891-0.68359-1.1016-0.60156-0.46094 0.082032-0.80469 0.47266-0.82422 0.94141-0.14062 3.3359 0.67188 5.75 1.5 7.3164-8.3125-2.4297-10.105-11.457-10.184-11.875-0.097656-0.51562-0.57422-0.86328-1.0898-0.8125-0.51953 0.054687-0.90625 0.50391-0.89062 1.0234 0.41406 13.465-1.8516 17.766-3.2383 19.133-0.66406 0.65625-1.1992 0.67188-1.2383 0.67188-0.53906-0.050781-1.0156 0.31641-1.0938 0.85156-0.078125 0.54688 0.29688 1.0547 0.84375 1.1328 0.03125 0.003906 0.11328 0.015625 0.23828 0.015625 0.36719 0 1.1016-0.09375 1.9414-0.66406 0.050781 0.38672 0.125 0.81641 0.21875 1.2656-1.0273 0.35156-2.6211 1.0781-3.7812 2.4648-0.015625 0.019532-0.054687 0.066406-0.15625 0.046875-0.039062-0.007812-0.13281-0.039062-0.16406-0.15234-2.1875-8.1094-5.7148-28.309 8.8867-40.496zm12.711 51.828c-1.0039 0-1.5898-1.207-1.8672-2.0117 0.48047 0.023438 0.95703 0.050781 1.4531 0.050781 0.74219 0 1.4453-0.035156 2.1289-0.082031-0.24219 0.83594-0.76172 2.043-1.7148 2.043zm-13.148-30.664c1.9531 3.6211 5.6367 7.9102 12.305 8.6992 0.43359 0.046875 0.83984-0.18359 1.0234-0.57422 0.18359-0.39062 0.089844-0.85938-0.22656-1.1523-0.074219-0.070312-1.2734-1.2227-1.9688-3.6367 2 2.6094 5.3359 5.6836 10.305 6.5664 0.42187 0.070312 0.83594-0.125 1.0469-0.49219 0.21094-0.36719 0.16406-0.82812-0.11719-1.1484-0.023437-0.027344-1.9414-2.2969-1.2891-5.8906 1.2227 3.5508 3.7461 9.2227 7.8945 11.551-0.03125 0.55859-0.14844 1.668-0.55078 3.0156-0.085937 0.13672-0.125 0.28516-0.13672 0.44531-1.3008 3.8906-5.0039 9.3281-15.547 9.3281-5.375 0-9.4414-1.418-12.086-4.2109-3.5664-3.7656-3.332-8.8477-3.332-8.8984v-0.011719c1.5898-2.7227 2.5-7.3203 2.6797-13.59z"></path>
                    </svg>
                `;
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = svgPath;
                const newSvg = tempDiv.firstElementChild;
                if (existingImg.parentNode && newSvg) {
                    existingImg.parentNode.replaceChild(newSvg, existingImg);
                }
            }
        }
    }

    function setupEventListeners() {
        // Меню
        const menuOpener = document.getElementById('menuOpener');
        const dropdownMenu = document.getElementById('dropdownMenu');
        
        if (menuOpener && dropdownMenu) {
            menuOpener.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdownMenu.classList.toggle('active');
            });
            
            // Закрываем меню при клике вне его
            document.addEventListener('click', (e) => {
                // Проверяем, что клик был не на меню и не на кнопке открытия меню
                if (!dropdownMenu.contains(e.target) && !menuOpener.contains(e.target)) {
                    dropdownMenu.classList.remove('active');
                }
            });
            
            dropdownMenu.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            // Обработчики пунктов меню
            const menuLinks = dropdownMenu.querySelectorAll('a');
            console.log('Setting up menu links handlers', menuLinks.length);
            menuLinks.forEach(link => {
                console.log('Adding handler to link:', link.textContent.trim());
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const linkText = link.textContent.trim();
                    console.log('Menu link clicked:', linkText);
                    
                    // Закрываем меню
                    dropdownMenu.classList.remove('active');
                    
                    if (linkText === 'Редактировать') {
                        console.log('Calling toggleEditMode');
                        toggleEditMode();
                    } else if (linkText === 'Поделиться') {
                        console.log('Calling shareProfile');
                        shareProfile();
                    }
                });
            });
        }

        // Кнопка подписки
        const followBtn = document.querySelector('.follow-btn button');
        if (followBtn) {
            followBtn.addEventListener('click', async () => {
                if (!currentProfile || currentProfile.is_own_profile) return;
                
                try {
                    await app.ready();
                    if (currentProfile.is_following) {
                        await app.unfollowUser(currentProfile.id);
                        currentProfile.is_following = false;
                        currentProfile.followers_count = Math.max(0, currentProfile.followers_count - 1);
                    } else {
                        await app.followUser(currentProfile.id);
                        currentProfile.is_following = true;
                        currentProfile.followers_count = (currentProfile.followers_count || 0) + 1;
                    }
                    renderProfile(currentProfile);
                    if (app.notify) {
                        app.notify(
                            currentProfile.is_following ? 'Вы подписались на пользователя' : 'Вы отписались от пользователя',
                            'success'
                        );
                    }
                } catch (err) {
                    console.error('Error following/unfollowing user:', err);
                    if (app.notify) {
                        app.notify('Не удалось изменить подписку', 'error');
                    }
                }
            });
        }
    }

    function toggleEditMode() {
        console.log('toggleEditMode called', {
            currentProfile: !!currentProfile,
            is_own_profile: currentProfile?.is_own_profile,
            profileId: currentProfile?.id,
            currentUserId: app.state?.user?.id
        });
        
        if (!currentProfile) {
            console.error('No current profile');
            if (app.notify) {
                app.notify('Профиль не загружен', 'error');
            }
            return;
        }
        
        // Проверяем, является ли это профилем текущего пользователя
        let isOwn = currentProfile.is_own_profile;
        if (!isOwn && app.state?.user) {
            isOwn = currentProfile.id === app.state.user.id;
        }
        
        if (!isOwn) {
            console.error('Not own profile');
            if (app.notify) {
                app.notify('Нельзя редактировать чужой профиль', 'error');
            }
            return;
        }
        
        isEditing = !isEditing;
        
        if (isEditing) {
            showEditModal();
        } else {
            hideEditModal();
        }
    }

    function showEditModal() {
        console.log('showEditModal called');
        
        // Проверяем, не открыто ли уже модальное окно
        const existingModal = document.getElementById('profileEditModal');
        if (existingModal) {
            console.log('Modal already exists, removing it first');
            existingModal.remove();
        }
        
        // Создаем модальное окно для редактирования
        const modal = document.createElement('div');
        modal.className = 'profile-edit-modal';
        modal.id = 'profileEditModal';
        
        // Экранируем HTML для безопасной вставки
        const escapeHtml = (text) => {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };
        
        const displayName = escapeHtml(currentProfile.display_name || '');
        const description = escapeHtml(currentProfile.description || '');
        const avatarUrl = currentProfile.avatar_url || '';
        
        modal.innerHTML = `
            <div class="profile-edit-modal-content" onclick="event.stopPropagation()">
                <h2>Редактировать профиль</h2>
                <div class="profile-edit-form">
                    <div class="profile-edit-avatar-section">
                        <label>
                            <span>Фото профиля</span>
                            <div class="avatar-edit-container">
                                <div class="avatar-preview" id="avatarPreview">
                                    ${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="Аватар">` : '<div class="avatar-placeholder"><i class="fas fa-user"></i></div>'}
                                </div>
                                <div class="avatar-edit-buttons">
                                    <input type="file" id="avatarFileInput" accept="image/jpeg,image/jpg,image/png,image/webp,image/gif" style="display: none;">
                                    <button type="button" class="btn-upload-avatar" id="uploadAvatarBtn">
                                        <i class="fas fa-upload"></i> Загрузить фото
                                    </button>
                                    ${avatarUrl ? `<button type="button" class="btn-remove-avatar" id="removeAvatarBtn">
                                        <i class="fas fa-trash"></i> Удалить
                                    </button>` : ''}
                                </div>
                            </div>
                        </label>
                    </div>
                    <label>
                        <span>Отображаемое имя</span>
                        <input type="text" id="editDisplayName" value="${displayName}" placeholder="Введите имя">
                    </label>
                    <label>
                        <span>Описание</span>
                        <textarea id="editDescription" rows="3" placeholder="Расскажите о себе..." maxlength="500">${description}</textarea>
                    </label>
                    <div class="profile-edit-buttons">
                        <button class="btn-cancel" id="cancelEditBtn">Отмена</button>
                        <button class="btn-save" id="saveEditBtn">Сохранить</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        console.log('Modal added to DOM', modal);
        
        // Убеждаемся, что модальное окно видно
        // Принудительно устанавливаем стили для видимости
        modal.style.display = 'flex';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';
        
        setTimeout(() => {
            const addedModal = document.getElementById('profileEditModal');
            if (addedModal) {
                console.log('Modal exists in DOM, checking visibility', {
                    display: window.getComputedStyle(addedModal).display,
                    visibility: window.getComputedStyle(addedModal).visibility,
                    opacity: window.getComputedStyle(addedModal).opacity,
                    zIndex: window.getComputedStyle(addedModal).zIndex
                });
            } else {
                console.error('Modal not found in DOM after adding!');
            }
        }, 50);
        
        // Добавляем обработчики для кнопок
        const cancelBtn = document.getElementById('cancelEditBtn');
        const saveBtn = document.getElementById('saveEditBtn');
        const uploadBtn = document.getElementById('uploadAvatarBtn');
        const fileInput = document.getElementById('avatarFileInput');
        const removeBtn = document.getElementById('removeAvatarBtn');
        
        if (cancelBtn) {
            console.log('Adding click handler to cancel button');
            cancelBtn.addEventListener('click', (e) => {
                console.log('Cancel button clicked');
                e.preventDefault();
                e.stopPropagation();
                cancelEdit();
            });
        } else {
            console.error('Cancel button not found!');
        }
        
        if (saveBtn) {
            console.log('Adding click handler to save button');
            saveBtn.addEventListener('click', (e) => {
                console.log('Save button clicked');
                e.preventDefault();
                e.stopPropagation();
                saveEdit();
            });
        } else {
            console.error('Save button not found!');
        }
        
        // Обработчик загрузки фото
        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', () => {
                fileInput.click();
            });
            
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                // Проверяем размер файла (макс 5 МБ)
                if (file.size > 5 * 1024 * 1024) {
                    if (app.notify) {
                        app.notify('Файл слишком большой. Максимальный размер: 5 МБ', 'error');
                    }
                    return;
                }
                
                // Проверяем тип файла
                const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
                if (!allowedTypes.includes(file.type)) {
                    if (app.notify) {
                        app.notify('Неподдерживаемый тип файла. Используйте JPEG, PNG, WebP или GIF', 'error');
                    }
                    return;
                }
                
                try {
                    await app.ready();
                    if (app.showLoading) app.showLoading('Загружаем фото...');
                    
                    const updatedUser = await app.uploadAvatar(file);
                    
                    // Обновляем превью
                    const preview = document.getElementById('avatarPreview');
                    if (preview && updatedUser.avatar_url) {
                        preview.innerHTML = `<img src="${updatedUser.avatar_url}" alt="Аватар">`;
                    }
                    
                    // Обновляем текущий профиль
                    currentProfile.avatar_url = updatedUser.avatar_url;
                    
                    // Показываем кнопку удаления, если её нет
                    const existingRemoveBtn = document.getElementById('removeAvatarBtn');
                    if (!existingRemoveBtn) {
                        const buttonsContainer = document.querySelector('.avatar-edit-buttons');
                        if (buttonsContainer) {
                            const newRemoveBtn = document.createElement('button');
                            newRemoveBtn.type = 'button';
                            newRemoveBtn.className = 'btn-remove-avatar';
                            newRemoveBtn.id = 'removeAvatarBtn';
                            newRemoveBtn.innerHTML = '<i class="fas fa-trash"></i> Удалить';
                            newRemoveBtn.addEventListener('click', handleRemoveAvatar);
                            buttonsContainer.appendChild(newRemoveBtn);
                        }
                    }
                    
                    // Обновляем отображение аватара в профиле (без полного рендера, чтобы не скрыть меню)
                    const bannerEl = document.querySelector('.banner');
                    if (bannerEl) {
                        const existingImg = bannerEl.querySelector('img');
                        if (existingImg) {
                            existingImg.src = updatedUser.avatar_url;
                        } else {
                            const svg = bannerEl.querySelector('svg');
                            if (svg) {
                                const avatarImg = document.createElement('img');
                                avatarImg.src = updatedUser.avatar_url;
                                avatarImg.alt = currentProfile.display_name || currentProfile.nickname;
                                avatarImg.className = 'profile-avatar';
                                svg.parentNode.replaceChild(avatarImg, svg);
                            }
                        }
                    }
                    
                    if (app.hideLoading) app.hideLoading();
                    if (app.notify) {
                        app.notify('Фото успешно загружено', 'success');
                    }
                } catch (err) {
                    console.error('Error uploading avatar:', err);
                    if (app.hideLoading) app.hideLoading();
                    let errorMessage = 'Не удалось загрузить фото';
                    if (err.message) {
                        if (err.message.includes('413') || err.message.includes('too large')) {
                            errorMessage = 'Файл слишком большой. Максимальный размер: 5 МБ';
                        } else {
                            errorMessage = err.message;
                        }
                    }
                    if (app.notify) {
                        app.notify(errorMessage, 'error');
                    }
                } finally {
                    e.target.value = ''; // Сбрасываем значение input
                }
            });
        }
        
        // Обработчик удаления фото
        if (removeBtn) {
            removeBtn.addEventListener('click', handleRemoveAvatar);
        }
        
        // Закрываем модальное окно при клике вне его
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                cancelEdit();
            }
        });
        
        // Закрываем модальное окно по ESC
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                cancelEdit();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // Фокусируемся на первом поле
        const displayNameInput = document.getElementById('editDisplayName');
        if (displayNameInput) {
            setTimeout(() => displayNameInput.focus(), 100);
        }
    }
    
    async function handleRemoveAvatar() {
        if (!currentProfile || !currentProfile.is_own_profile) return;
        
        try {
            await app.ready();
            if (app.showLoading) app.showLoading('Удаляем фото...');
            
            // Обновляем профиль, очищая avatar_url
            const updatedProfile = await app.updateUserProfile(currentProfile.id, {
                avatar_url: null,
                avatar_id: null,
            });
            
            // Обновляем превью
            const preview = document.getElementById('avatarPreview');
            if (preview) {
                preview.innerHTML = '<div class="avatar-placeholder"><i class="fas fa-user"></i></div>';
            }
            
            // Удаляем кнопку удаления
            const removeBtn = document.getElementById('removeAvatarBtn');
            if (removeBtn) {
                removeBtn.remove();
            }
            
            // Обновляем текущий профиль
            currentProfile.avatar_url = null;
            currentProfile.avatar_id = null;
            
            // Обновляем отображение аватара в профиле (без полного рендера, чтобы не скрыть меню)
            const bannerEl = document.querySelector('.banner');
            if (bannerEl) {
                const existingImg = bannerEl.querySelector('img');
                if (existingImg) {
                    // Восстанавливаем SVG
                    const svgPath = `
                        <svg viewBox="0 0 100 100">
                            <path d="m38.977 59.074c0 2.75-4.125 2.75-4.125 0s4.125-2.75 4.125 0"></path>
                            <path d="m60.477 59.074c0 2.75-4.125 2.75-4.125 0s4.125-2.75 4.125 0"></path>
                            <path d="m48.203 69.309c1.7344 0 3.1484-1.4141 3.1484-3.1484 0-0.27734-0.22266-0.5-0.5-0.5-0.27734 0-0.5 0.22266-0.5 0.5 0 1.1836-0.96484 2.1484-2.1484 2.1484s-2.1484-0.96484-2.1484-2.1484c0-0.27734-0.22266-0.5-0.5-0.5-0.27734 0-0.5 0.22266-0.5 0.5 0 1.7344 1.4141 3.1484 3.1484 3.1484z"></path>
                            <path d="m35.492 24.371c0.42187-0.35156 0.48047-0.98438 0.125-1.4062-0.35156-0.42188-0.98438-0.48438-1.4062-0.125-5.1602 4.3047-16.422 17.078-9.5312 42.562 0.21484 0.79688 0.85547 1.4062 1.6641 1.582 0.15625 0.035156 0.31641 0.050781 0.47266 0.050781 0.62891 0 1.2344-0.27344 1.6445-0.76562 0.82812-0.98828 2.0039-1.5391 2.793-1.8203 0.56641 1.6055 1.4766 3.3594 2.9727 4.9414 2.2852 2.4219 5.4336 3.9453 9.3867 4.5547-3.6055 4.5-3.8047 10.219-3.8086 10.484-0.011719 0.55078 0.42187 1.0078 0.97656 1.0234h0.023438c0.53906 0 0.98437-0.42969 1-0.97266 0-0.054688 0.17187-4.8711 2.9805-8.7773 0.63281 1.2852 1.7266 2.5 3.4141 2.5 1.7109 0 2.7578-1.2695 3.3398-2.6172 2.8867 3.9258 3.0586 8.8359 3.0586 8.8906 0.015625 0.54297 0.46094 0.97266 1 0.97266h0.023438c0.55078-0.015625 0.98828-0.47266 0.97656-1.0234-0.007812-0.26953-0.20703-6.0938-3.9141-10.613 7.0781-1.3086 10.406-5.4219 11.969-8.9766 1.0508 0.98828 2.75 2.1992 4.793 2.1992 0.078126 0 0.15625 0 0.23828-0.003906 0.47266-0.023438 1.5781-0.074219 3.4219-4.4219 1.1172-2.6406 2.1406-6.0117 2.8711-9.4922 4.8281-22.945-4.7852-30.457-9.1445-32.621-12.316-6.1172-22.195-3.6055-28.312-0.42188-0.48828 0.25391-0.67969 0.85938-0.42578 1.3477s0.85938 0.67969 1.3477 0.42578c5.7031-2.9688 14.934-5.3047 26.5 0.4375 7.1875 3.5703 9 11.586 9.2539 17.684 0.49609 11.93-4.2617 23.91-5.7344 25.062h-0.015626c-1.832 0-3.4102-1.5742-4.0352-2.2852 0.28906-0.99609 0.44531-1.8672 0.52734-2.5117 0.62891 0.16797 1.2812 0.27344 1.9727 0.27344 0.55469 0 1-0.44922 1-1 0-0.55078-0.44531-1-1-1-7.3203 0-10.703-13.941-10.734-14.082-0.097656-0.40625-0.4375-0.71094-0.85156-0.76172-0.43359-0.050781-0.82031 0.16406-1.0117 0.53906-1.8984 3.7188-1.4297 6.7539-0.67969 8.668-6.2383-2.2852-8.9766-8.6914-9.0078-8.7617-0.17969-0.43359-0.62891-0.68359-1.1016-0.60156-0.46094 0.082032-0.80469 0.47266-0.82422 0.94141-0.14062 3.3359 0.67188 5.75 1.5 7.3164-8.3125-2.4297-10.105-11.457-10.184-11.875-0.097656-0.51562-0.57422-0.86328-1.0898-0.8125-0.51953 0.054687-0.90625 0.50391-0.89062 1.0234 0.41406 13.465-1.8516 17.766-3.2383 19.133-0.66406 0.65625-1.1992 0.67188-1.2383 0.67188-0.53906-0.050781-1.0156 0.31641-1.0938 0.85156-0.078125 0.54688 0.29688 1.0547 0.84375 1.1328 0.03125 0.003906 0.11328 0.015625 0.23828 0.015625 0.36719 0 1.1016-0.09375 1.9414-0.66406 0.050781 0.38672 0.125 0.81641 0.21875 1.2656-1.0273 0.35156-2.6211 1.0781-3.7812 2.4648-0.015625 0.019532-0.054687 0.066406-0.15625 0.046875-0.039062-0.007812-0.13281-0.039062-0.16406-0.15234-2.1875-8.1094-5.7148-28.309 8.8867-40.496zm12.711 51.828c-1.0039 0-1.5898-1.207-1.8672-2.0117 0.48047 0.023438 0.95703 0.050781 1.4531 0.050781 0.74219 0 1.4453-0.035156 2.1289-0.082031-0.24219 0.83594-0.76172 2.043-1.7148 2.043zm-13.148-30.664c1.9531 3.6211 5.6367 7.9102 12.305 8.6992 0.43359 0.046875 0.83984-0.18359 1.0234-0.57422 0.18359-0.39062 0.089844-0.85938-0.22656-1.1523-0.074219-0.070312-1.2734-1.2227-1.9688-3.6367 2 2.6094 5.3359 5.6836 10.305 6.5664 0.42187 0.070312 0.83594-0.125 1.0469-0.49219 0.21094-0.36719 0.16406-0.82812-0.11719-1.1484-0.023437-0.027344-1.9414-2.2969-1.2891-5.8906 1.2227 3.5508 3.7461 9.2227 7.8945 11.551-0.03125 0.55859-0.14844 1.668-0.55078 3.0156-0.085937 0.13672-0.125 0.28516-0.13672 0.44531-1.3008 3.8906-5.0039 9.3281-15.547 9.3281-5.375 0-9.4414-1.418-12.086-4.2109-3.5664-3.7656-3.332-8.8477-3.332-8.8984v-0.011719c1.5898-2.7227 2.5-7.3203 2.6797-13.59z"></path>
                        </svg>
                    `;
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = svgPath;
                    const newSvg = tempDiv.firstElementChild;
                    if (newSvg && existingImg.parentNode) {
                        existingImg.parentNode.replaceChild(newSvg, existingImg);
                    }
                }
            }
            
            if (app.hideLoading) app.hideLoading();
            if (app.notify) {
                app.notify('Фото удалено', 'success');
            }
        } catch (err) {
            console.error('Error removing avatar:', err);
            if (app.hideLoading) app.hideLoading();
            if (app.notify) {
                app.notify('Не удалось удалить фото', 'error');
            }
        }
    }

    function hideEditModal() {
        const modal = document.getElementById('profileEditModal');
        if (modal) {
            modal.remove();
        }
    }

    async function saveEdit() {
        console.log('saveEdit called', {
            currentProfile: !!currentProfile,
            is_own_profile: currentProfile?.is_own_profile,
            profileId: currentProfile?.id,
            currentUserId: app.state?.user?.id
        });
        
        if (!currentProfile) {
            console.error('No current profile in saveEdit');
            if (app.notify) {
                app.notify('Профиль не загружен', 'error');
            }
            return;
        }
        
        // Проверяем, является ли это профилем текущего пользователя
        let isOwn = currentProfile.is_own_profile;
        if (!isOwn && app.state?.user) {
            isOwn = currentProfile.id === app.state.user.id;
        }
        
        if (!isOwn) {
            console.error('Not own profile in saveEdit');
            if (app.notify) {
                app.notify('Нельзя редактировать чужой профиль', 'error');
            }
            return;
        }
        
        const displayName = document.getElementById('editDisplayName')?.value || '';
        const description = document.getElementById('editDescription')?.value || '';
        
        console.log('Saving profile with data:', {
            displayName,
            description,
            avatar_url: currentProfile.avatar_url
        });
        
        try {
            await app.ready();
            if (app.showLoading) app.showLoading('Сохраняем изменения...');
            
            // Формируем payload для обновления
            const payload = {
                display_name: displayName,
                description: description,
            };
            
            // Если аватар был загружен, он уже обновлен через uploadAvatar
            // Просто сохраняем остальные данные
            console.log('Calling updateUserProfile with payload:', payload);
            const updatedProfile = await app.updateUserProfile(currentProfile.id, payload);
            console.log('Profile updated successfully:', updatedProfile);
            
            // Обновляем текущий профиль (сохраняем avatar_url, если он был загружен)
            if (currentProfile.avatar_url) {
                updatedProfile.avatar_url = currentProfile.avatar_url;
            }
            
            currentProfile = updatedProfile;
            renderProfile(updatedProfile);
            hideEditModal();
            isEditing = false;
            
            if (app.hideLoading) app.hideLoading();
            if (app.notify) {
                app.notify('Профиль обновлен', 'success');
            }
        } catch (err) {
            console.error('Error updating profile:', err);
            if (app.hideLoading) app.hideLoading();
            let errorMessage = 'Не удалось обновить профиль';
            if (err.message) {
                errorMessage = err.message;
            }
            if (app.notify) {
                app.notify(errorMessage, 'error');
            }
        }
    }

    function cancelEdit() {
        hideEditModal();
        isEditing = false;
    }

    function shareProfile() {
        if (!currentProfile) return;
        
        const userIdentifier = currentProfile.nickname || currentProfile.id.toString();
        app.shareProfile(userIdentifier);
    }

    function showError(message) {
        const card = document.querySelector('.card');
        if (card) {
            card.innerHTML = `<div class="error-message">${message}</div>`;
        }
    }

    // Функция для кнопки назад
    function goBack() {
        window.history.back();
    }
    window.goBack = goBack;
})();


