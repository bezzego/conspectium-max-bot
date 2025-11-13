(() => {
    let app = null;
    let currentProfile = null;
    let isEditing = false;
    let selectedBannerFile = null;
    let selectedAvatarFile = null;
    let bannerImage = null;
    let cropArea = null;
    let isDragging = false;
    let startX, startY;
    let startCropX, startCropY;
    let zoomLevel = 1;

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
                showError('Для просмотра профиля необходимо войти в аккаунт. <a href="/front/html/welcome_modal.html" style="color: #f5d86e;">Войти</a>');
            }
        } else {
            // Загружаем профиль указанного пользователя
            await loadProfile(userIdentifier);
        }

        setupEventListeners();
    });

    async function loadProfile(userIdentifier) {
        try {
            const profile = await app.getProfile(userIdentifier);
            currentProfile = profile;
            renderProfile(profile);
        } catch (err) {
            console.error('Error loading profile:', err);
            showError('Не удалось загрузить профиль');
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
    
    // Блокируем скролл основного контента
    document.body.classList.add('modal-open');
    
    // Проверяем, не открыто ли уже модальное окно
    const existingModal = document.getElementById('profileEditModal');
    if (existingModal) {
        console.log('Modal already exists, removing it first');
        existingModal.remove();
        document.body.classList.remove('modal-open');
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
                                    Загрузить фото
                                </button>
                                ${avatarUrl ? `<button type="button" class="btn-remove-avatar" id="removeAvatarBtn">
                                    <i class="fas fa-trash"></i>
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
                    <textarea id="editDescription" rows="4" placeholder="Расскажите о себе..." maxlength="500">${description}</textarea>
                    <div class="description-hint">
                        Поддерживается: **жирный**, *курсив*, ++подчеркнутый++, ~~зачеркнутый~~<br>
                        %%код%%, списки, ссылки [текст](URL)
                    </div>
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
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    
    // Прокручиваем к верху модального окна
    setTimeout(() => {
        modal.scrollTop = 0;
    }, 100);
    
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
    }
    
    if (saveBtn) {
        console.log('Adding click handler to save button');
        saveBtn.addEventListener('click', (e) => {
            console.log('Save button clicked');
            e.preventDefault();
            e.stopPropagation();
            saveEdit();
        });
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
                
                // Обновляем отображение аватара в профиле
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
                e.target.value = '';
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
                    <svg viewBox="0 0 100 100" width="8rem" height="8rem" style="transform: translateY(50%); background-color: white; box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.3); border-radius: 50%; border: 4px solid white;">
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
    document.body.classList.remove('modal-open');
}

function cancelEdit() {
    hideEditModal();
    isEditing = false;
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
            if (profile.description) {
                descEl.innerHTML = formatProfileDescription(profile.description);
                descEl.classList.add('desc-formatted');
                setTimeout(() => {
                    setupCodeCopyHandlers();
                }, 100);
            } else {
                descEl.textContent = 'Нет описания';
                descEl.classList.remove('desc-formatted');
            }
        }

        // Обновляем баннер
        const bannerEl = document.querySelector('.card .banner');
        if (bannerEl) {
            if (profile.banner_url) {
                bannerEl.style.backgroundImage = `url('${profile.banner_url}')`;
            } else {
                bannerEl.style.backgroundImage = "url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1350&q=80')";
            }
        }

        // Обновляем аватар
        updateAvatar(profile);

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
            let shouldShow = profile.is_own_profile;
            if (!shouldShow && app.state?.user) {
                shouldShow = profile.id === app.state.user.id;
            }
            menuOpener.style.display = shouldShow ? 'block' : 'none';
        }

        // Добавляем иконку редактирования баннера для своего профиля
        setupBannerEditIcon(profile);
    }

    function updateAvatar(profile) {
        const bannerContainer = document.querySelector('.banner');
        if (!bannerContainer) return;

        // Удаляем существующие аватары
        const existingAvatar = bannerContainer.querySelector('img.profile-avatar');
        const existingSvg = bannerContainer.querySelector('svg');
        
        if (existingAvatar) existingAvatar.remove();
        if (existingSvg) existingSvg.remove();

        if (profile.avatar_url) {
            // Создаем элемент изображения для аватара
            const avatarImg = document.createElement('img');
            avatarImg.src = profile.avatar_url;
            avatarImg.alt = profile.display_name || profile.nickname;
            avatarImg.className = 'profile-avatar';
            avatarImg.onerror = () => {
                // Если аватар не загрузился, показываем SVG
                avatarImg.remove();
                createDefaultAvatar();
            };
            bannerContainer.appendChild(avatarImg);
        } else {
            createDefaultAvatar();
        }

        function createDefaultAvatar() {
            const svgPath = `
                <svg viewBox="0 0 100 100" width="8rem" height="8rem" style="transform: translateY(50%); background-color: white; box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.3); border-radius: 50%; border: 4px solid white;">
                    <path d="m38.977 59.074c0 2.75-4.125 2.75-4.125 0s4.125-2.75 4.125 0"></path>
                    <path d="m60.477 59.074c0 2.75-4.125 2.75-4.125 0s4.125-2.75 4.125 0"></path>
                    <path d="m48.203 69.309c1.7344 0 3.1484-1.4141 3.1484-3.1484 0-0.27734-0.22266-0.5-0.5-0.5-0.27734 0-0.5 0.22266-0.5 0.5 0 1.1836-0.96484 2.1484-2.1484 2.1484s-2.1484-0.96484-2.1484-2.1484c0-0.27734-0.22266-0.5-0.5-0.5-0.27734 0-0.5 0.22266-0.5 0.5 0 1.7344 1.4141 3.1484 3.1484 3.1484z"></path>
                    <path d="m35.492 24.371c0.42187-0.35156 0.48047-0.98438 0.125-1.4062-0.35156-0.42188-0.98438-0.48438-1.4062-0.125-5.1602 4.3047-16.422 17.078-9.5312 42.562 0.21484 0.79688 0.85547 1.4062 1.6641 1.582 0.15625 0.035156 0.31641 0.050781 0.47266 0.050781 0.62891 0 1.2344-0.27344 1.6445-0.76562 0.82812-0.98828 2.0039-1.5391 2.793-1.8203 0.56641 1.6055 1.4766 3.3594 2.9727 4.9414 2.2852 2.4219 5.4336 3.9453 9.3867 4.5547-3.6055 4.5-3.8047 10.219-3.8086 10.484-0.011719 0.55078 0.42187 1.0078 0.97656 1.0234h0.023438c0.53906 0 0.98437-0.42969 1-0.97266 0-0.054688 0.17187-4.8711 2.9805-8.7773 0.63281 1.2852 1.7266 2.5 3.4141 2.5 1.7109 0 2.7578-1.2695 3.3398-2.6172 2.8867 3.9258 3.0586 8.8359 3.0586 8.8906 0.015625 0.54297 0.46094 0.97266 1 0.97266h0.023438c0.55078-0.015625 0.98828-0.47266 0.97656-1.0234-0.007812-0.26953-0.20703-6.0938-3.9141-10.613 7.0781-1.3086 10.406-5.4219 11.969-8.9766 1.0508 0.98828 2.75 2.1992 4.793 2.1992 0.078126 0 0.15625 0 0.23828-0.003906 0.47266-0.023438 1.5781-0.074219 3.4219-4.4219 1.1172-2.6406 2.1406-6.0117 2.8711-9.4922 4.8281-22.945-4.7852-30.457-9.1445-32.621-12.316-6.1172-22.195-3.6055-28.312-0.42188-0.48828 0.25391-0.67969 0.85938-0.42578 1.3477s0.85938 0.67969 1.3477 0.42578c5.7031-2.9688 14.934-5.3047 26.5 0.4375 7.1875 3.5703 9 11.586 9.2539 17.684 0.49609 11.93-4.2617 23.91-5.7344 25.062h-0.015626c-1.832 0-3.4102-1.5742-4.0352-2.2852 0.28906-0.99609 0.44531-1.8672 0.52734-2.5117 0.62891 0.16797 1.2812 0.27344 1.9727 0.27344 0.55469 0 1-0.44922 1-1 0-0.55078-0.44531-1-1-1-7.3203 0-10.703-13.941-10.734-14.082-0.097656-0.40625-0.4375-0.71094-0.85156-0.76172-0.43359-0.050781-0.82031 0.16406-1.0117 0.53906-1.8984 3.7188-1.4297 6.7539-0.67969 8.668-6.2383-2.2852-8.9766-8.6914-9.0078-8.7617-0.17969-0.43359-0.62891-0.68359-1.1016-0.60156-0.46094 0.082032-0.80469 0.47266-0.82422 0.94141-0.14062 3.3359 0.67188 5.75 1.5 7.3164-8.3125-2.4297-10.105-11.457-10.184-11.875-0.097656-0.51562-0.57422-0.86328-1.0898-0.8125-0.51953 0.054687-0.90625 0.50391-0.89062 1.0234 0.41406 13.465-1.8516 17.766-3.2383 19.133-0.66406 0.65625-1.1992 0.67188-1.2383 0.67188-0.53906-0.050781-1.0156 0.31641-1.0938 0.85156-0.078125 0.54688 0.29688 1.0547 0.84375 1.1328 0.03125 0.003906 0.11328 0.015625 0.23828 0.015625 0.36719 0 1.1016-0.09375 1.9414-0.66406 0.050781 0.38672 0.125 0.81641 0.21875 1.2656-1.0273 0.35156-2.6211 1.0781-3.7812 2.4648-0.015625 0.019532-0.054687 0.066406-0.15625 0.046875-0.039062-0.007812-0.13281-0.039062-0.16406-0.15234-2.1875-8.1094-5.7148-28.309 8.8867-40.496zm12.711 51.828c-1.0039 0-1.5898-1.207-1.8672-2.0117 0.48047 0.023438 0.95703 0.050781 1.4531 0.050781 0.74219 0 1.4453-0.035156 2.1289-0.082031-0.24219 0.83594-0.76172 2.043-1.7148 2.043zm-13.148-30.664c1.9531 3.6211 5.6367 7.9102 12.305 8.6992 0.43359 0.046875 0.83984-0.18359 1.0234-0.57422 0.18359-0.39062 0.089844-0.85938-0.22656-1.1523-0.074219-0.070312-1.2734-1.2227-1.9688-3.6367 2 2.6094 5.3359 5.6836 10.305 6.5664 0.42187 0.070312 0.83594-0.125 1.0469-0.49219 0.21094-0.36719 0.16406-0.82812-0.11719-1.1484-0.023437-0.027344-1.9414-2.2969-1.2891-5.8906 1.2227 3.5508 3.7461 9.2227 7.8945 11.551-0.03125 0.55859-0.14844 1.668-0.55078 3.0156-0.085937 0.13672-0.125 0.28516-0.13672 0.44531-1.3008 3.8906-5.0039 9.3281-15.547 9.3281-5.375 0-9.4414-1.418-12.086-4.2109-3.5664-3.7656-3.332-8.8477-3.332-8.8984v-0.011719c1.5898-2.7227 2.5-7.3203 2.6797-13.59z"></path>
                </svg>
            `;
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = svgPath;
            const newSvg = tempDiv.firstElementChild;
            if (newSvg) {
                bannerContainer.appendChild(newSvg);
            }
        }
    }

    function setupBannerEditIcon(profile) {
        const bannerEl = document.querySelector('.card .banner');
        if (!bannerEl) return;

        // Удаляем существующую иконку
        const existingIcon = bannerEl.querySelector('.banner-edit-icon');
        if (existingIcon) {
            existingIcon.remove();
        }

        // Проверяем, является ли это профилем текущего пользователя
        let isOwn = profile.is_own_profile;
        if (!isOwn && app.state?.user) {
            isOwn = profile.id === app.state.user.id;
        }

        if (isOwn) {
            const editIcon = document.createElement('div');
            editIcon.className = 'banner-edit-icon';
            editIcon.innerHTML = '<i class="fas fa-camera"></i>';
            editIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleBannerEdit();
            });
            bannerEl.appendChild(editIcon);
        }
    }

    function formatProfileDescription(text) {
        if (!text) return '';
        
        const escapeHtml = (str) => {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };
        
        let formattedText = escapeHtml(text);
        formattedText = formattedText.replace(/\n/g, '<br>');
        
        // Markdown-like formatting
        formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formattedText = formattedText.replace(/__(.*?)__/g, '<strong>$1</strong>');
        formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
        formattedText = formattedText.replace(/_(.*?)_/g, '<em>$1</em>');
        formattedText = formattedText.replace(/\+\+(.*?)\+\+/g, '<u>$1</u>');
        formattedText = formattedText.replace(/~~(.*?)~~/g, '<del>$1</del>');
        formattedText = formattedText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        formattedText = formattedText.replace(/%%([^%]+)%%/g, function(match, codeContent) {
            const cleanCode = codeContent.replace(/&amp;/g, '&')
                                    .replace(/&lt;/g, '<')
                                    .replace(/&gt;/g, '>')
                                    .replace(/&quot;/g, '"')
                                    .replace(/&#39;/g, "'");
            return '<code class="copyable-code" data-code="' + escapeHtml(cleanCode) + '">' + codeContent + '<span class="copy-tooltip">Нажми чтобы скопировать</span></code>';
        });
        
        return formattedText;
    }

    function setupCodeCopyHandlers() {
        const codeElements = document.querySelectorAll('.copyable-code');
        codeElements.forEach(codeElement => {
            codeElement.addEventListener('click', function(e) {
                e.stopPropagation();
                const codeToCopy = this.getAttribute('data-code');
                
                navigator.clipboard.writeText(codeToCopy).then(() => {
                    const originalTooltip = this.querySelector('.copy-tooltip').textContent;
                    this.querySelector('.copy-tooltip').textContent = 'Скопировано!';
                    this.classList.add('copied');
                    
                    setTimeout(() => {
                        this.querySelector('.copy-tooltip').textContent = originalTooltip;
                        this.classList.remove('copied');
                    }, 2000);
                }).catch(err => {
                    console.error('Ошибка копирования:', err);
                    const textArea = document.createElement('textarea');
                    textArea.value = codeToCopy;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    
                    this.querySelector('.copy-tooltip').textContent = 'Скопировано!';
                    this.classList.add('copied');
                    
                    setTimeout(() => {
                        this.querySelector('.copy-tooltip').textContent = 'Нажми чтобы скопировать';
                        this.classList.remove('copied');
                    }, 2000);
                });
            });
            codeElement.style.cursor = 'pointer';
        });
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
            
            document.addEventListener('click', (e) => {
                if (!dropdownMenu.contains(e.target) && !menuOpener.contains(e.target)) {
                    dropdownMenu.classList.remove('active');
                }
            });
            
            dropdownMenu.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            const menuLinks = dropdownMenu.querySelectorAll('a');
            menuLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const linkText = link.textContent.trim();
                    dropdownMenu.classList.remove('active');
                    
                    if (linkText === 'Редактировать') {
                        toggleEditMode();
                    } else if (linkText === 'Поделиться') {
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


    function toggleBannerEdit() {
        if (!currentProfile) {
            return;
        }
        
        let isOwn = currentProfile.is_own_profile;
        if (!isOwn && app.state?.user) {
            isOwn = currentProfile.id === app.state.user.id;
        }
        
        if (!isOwn) {
            if (app.notify) {
                app.notify('Нельзя редактировать чужой профиль', 'error');
            }
            return;
        }
        
        showBannerEditModal();
    }

function showBannerEditModal() {
    document.body.classList.add('modal-open');
    
    const existingModal = document.getElementById('bannerEditModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.className = 'banner-edit-modal';
    modal.id = 'bannerEditModal';
    
    const currentBannerUrl = currentProfile.banner_url || '';
    
   modal.innerHTML = `
    <div class="banner-edit-modal-content" onclick="event.stopPropagation()">
        <h2 class="banner-edit-modal-content-title">Редактировать баннер</h2>
        
        <div class="banner-crop-container" id="bannerCropContainer">
            ${!currentBannerUrl && !selectedBannerFile ? 
                `<div class="banner-upload-placeholder">
                    <div class="placeholder-content">
                        <i class="fas fa-cloud-upload-alt"></i>
                        <h3>Загрузите изображение</h3>
                        <p>Перетащите файл сюда или нажмите кнопку ниже</p>
                        <small>Поддерживаемые форматы: JPG, PNG, WebP, GIF</small>
                    </div>
                </div>` : ''}
        </div>
        
        <div class="banner-crop-controls" id="bannerCropControls" style="display: none;">
            <div class="zoom-slider">
                <input type="range" id="zoomSlider" min="0.1" max="3" step="0.1" value="1">
            </div>
            <div class="zoom-value" id="zoomValue">100%</div>
        </div>
        
        <div class="banner-controls">
            <input type="file" id="bannerFileInput" accept="image/jpeg,image/jpg,image/png,image/webp,image/gif" style="display: none;">
            <button type="button" class="banner-control-btn btn-upload-banner" id="uploadBannerBtn">
                Загрузить фото
            </button>
            ${currentBannerUrl ? `
            <button type="button" class="banner-control-btn btn-remove-banner" id="removeBannerBtn">
                <i class="fas fa-trash"></i> Удалить баннер
            </button>
            ` : ''}
        </div>
        
        <div class="banner-edit-buttons">
            <button class="btn-cancel" id="cancelBannerEditBtn">Отмена</button>
            <button class="btn-save" id="saveBannerBtn" ${!selectedBannerFile && !currentBannerUrl ? 'disabled' : ''}>Сохранить</button>
        </div>
    </div>
`;
    
    document.body.appendChild(modal);
        
        // Инициализируем редактор если есть изображение
        if (currentBannerUrl) {
            initBannerEditor(currentBannerUrl);
        }
        
        // Обработчики
        const cancelBtn = document.getElementById('cancelBannerEditBtn');
        const saveBtn = document.getElementById('saveBannerBtn');
        const uploadBtn = document.getElementById('uploadBannerBtn');
        const fileInput = document.getElementById('bannerFileInput');
        const removeBtn = document.getElementById('removeBannerBtn');
        const zoomSlider = document.getElementById('zoomSlider');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                hideBannerEditModal();
            });
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                saveBanner();
            });
        }
        
        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', () => {
                fileInput.click();
            });
            
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            console.log('File selected:', file.name, file.size, file.type);
            
            if (file.size > 10 * 1024 * 1024) {
                if (app.notify) {
                    app.notify('Файл слишком большой. Максимальный размер: 10 МБ', 'error');
                }
                return;
            }
            
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
            if (!allowedTypes.includes(file.type)) {
                if (app.notify) {
                    app.notify('Неподдерживаемый тип файла. Используйте JPEG, PNG, WebP или GIF', 'error');
                }
                return;
            }
            
            selectedBannerFile = file;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                console.log('File loaded successfully');
                initBannerEditor(e.target.result);
                
                const saveBtn = document.getElementById('saveBannerBtn');
                if (saveBtn) {
                    saveBtn.disabled = false;
                }
            };
            
            reader.onerror = function(error) {
                console.error('Error reading file:', error);
                if (app.notify) {
                    app.notify('Ошибка чтения файла', 'error');
                }
            };
            
            reader.readAsDataURL(file);
        });
        }
        
        if (removeBtn) {
            removeBtn.addEventListener('click', handleRemoveBanner);
        }
        
        if (zoomSlider) {
            zoomSlider.addEventListener('input', (e) => {
                zoomLevel = parseFloat(e.target.value);
                updateZoom();
            });
        }
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideBannerEditModal();
            }
        });
        
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                hideBannerEditModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    function initBannerEditor(imageUrl) {
        const container = document.getElementById('bannerCropContainer');
        const controls = document.getElementById('bannerCropControls');
        
        if (!container) return;
        
        // Очищаем контейнер
        container.innerHTML = '';
        controls.style.display = 'flex';
        
        // Создаем изображение
        bannerImage = new Image();
        bannerImage.src = imageUrl;
        bannerImage.className = 'banner-crop-image';
        bannerImage.onload = function() {
            // Устанавливаем начальный размер
            const containerWidth = container.offsetWidth;
            const containerHeight = container.offsetHeight;
            
            const aspectRatio = bannerImage.width / bannerImage.height;
            let displayWidth = containerWidth;
            let displayHeight = containerWidth / aspectRatio;
            
            if (displayHeight < containerHeight) {
                displayHeight = containerHeight;
                displayWidth = containerHeight * aspectRatio;
            }
            
            bannerImage.style.width = displayWidth + 'px';
            bannerImage.style.height = displayHeight + 'px';
            
            // Центрируем изображение
            bannerImage.style.left = ((containerWidth - displayWidth) / 2) + 'px';
            bannerImage.style.top = ((containerHeight - displayHeight) / 2) + 'px';
            
            container.appendChild(bannerImage);
            
            // Создаем область обрезки
            createCropArea(containerWidth, containerHeight);
            
            // Инициализируем перетаскивание
            initDragAndDrop();
        };
        
        container.appendChild(bannerImage);
    }

    function createCropArea(containerWidth, containerHeight) {
        const container = document.getElementById('bannerCropContainer');
        if (!container) return;
        
        // Удаляем существующую область обрезки
        if (cropArea) {
            cropArea.remove();
        }
        
        // Создаем область обрезки (соотношение 4:1 как у баннера)
        const cropWidth = containerWidth * 0.8;
        const cropHeight = cropWidth / 4;
        
        cropArea = document.createElement('div');
        cropArea.className = 'banner-crop-area';
        cropArea.style.width = cropWidth + 'px';
        cropArea.style.height = cropHeight + 'px';
        cropArea.style.left = ((containerWidth - cropWidth) / 2) + 'px';
        cropArea.style.top = ((containerHeight - cropHeight) / 2) + 'px';
        
        // Добавляем ручки для изменения размера
        const handles = ['nw', 'ne', 'sw', 'se'];
        handles.forEach(handle => {
            const handleEl = document.createElement('div');
            handleEl.className = `crop-handle ${handle}`;
            cropArea.appendChild(handleEl);
        });
        
        container.appendChild(cropArea);
    }

    function initDragAndDrop() {
        if (!cropArea || !bannerImage) return;
        
        cropArea.addEventListener('mousedown', startDrag);
        cropArea.addEventListener('touchstart', startDrag);
        
        function startDrag(e) {
            e.preventDefault();
            isDragging = true;
            
            const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
            
            startX = clientX;
            startY = clientY;
            startCropX = parseInt(cropArea.style.left);
            startCropY = parseInt(cropArea.style.top);
            
            document.addEventListener('mousemove', drag);
            document.addEventListener('touchmove', drag);
            document.addEventListener('mouseup', stopDrag);
            document.addEventListener('touchend', stopDrag);
        }
        
        function drag(e) {
            if (!isDragging) return;
            
            const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
            
            const deltaX = clientX - startX;
            const deltaY = clientY - startY;
            
            const container = document.getElementById('bannerCropContainer');
            const maxX = container.offsetWidth - cropArea.offsetWidth;
            const maxY = container.offsetHeight - cropArea.offsetHeight;
            
            const newLeft = Math.max(0, Math.min(maxX, startCropX + deltaX));
            const newTop = Math.max(0, Math.min(maxY, startCropY + deltaY));
            
            cropArea.style.left = newLeft + 'px';
            cropArea.style.top = newTop + 'px';
        }
        
        function stopDrag() {
            isDragging = false;
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('touchmove', drag);
            document.removeEventListener('mouseup', stopDrag);
            document.removeEventListener('touchend', stopDrag);
        }
    }

    function updateZoom() {
        if (!bannerImage) return;
        
        const zoomValue = document.getElementById('zoomValue');
        if (zoomValue) {
            zoomValue.textContent = Math.round(zoomLevel * 100) + '%';
        }
        
        // Применяем масштаб к изображению
        const originalWidth = bannerImage.naturalWidth;
        const originalHeight = bannerImage.naturalHeight;
        
        const container = document.getElementById('bannerCropContainer');
        const containerWidth = container.offsetWidth;
        const containerHeight = container.offsetHeight;
        
        const aspectRatio = originalWidth / originalHeight;
        let displayWidth = containerWidth * zoomLevel;
        let displayHeight = (containerWidth * zoomLevel) / aspectRatio;
        
        if (displayHeight < containerHeight * zoomLevel) {
            displayHeight = containerHeight * zoomLevel;
            displayWidth = containerHeight * zoomLevel * aspectRatio;
        }
        
        bannerImage.style.width = displayWidth + 'px';
        bannerImage.style.height = displayHeight + 'px';
        
        // Центрируем изображение
        bannerImage.style.left = ((containerWidth - displayWidth) / 2) + 'px';
        bannerImage.style.top = ((containerHeight - displayHeight) / 2) + 'px';
    }

    async function handleRemoveBanner() {
        if (!currentProfile || !currentProfile.is_own_profile) return;
        
        try {
            await app.ready();
            if (app.showLoading) app.showLoading('Удаляем баннер...');
            
            const updatedProfile = await app.updateUserProfile(currentProfile.id, {
                banner_url: null,
                banner_id: null,
            });
            
            currentProfile.banner_url = null;
            currentProfile.banner_id = null;
            
            const bannerEl = document.querySelector('.card .banner');
            if (bannerEl) {
                bannerEl.style.backgroundImage = "url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1350&q=80')";
            }
            
            // Закрываем модальное окно
            hideBannerEditModal();
            
            if (app.hideLoading) app.hideLoading();
            if (app.notify) {
                app.notify('Баннер удален', 'success');
            }
        } catch (err) {
            console.error('Error removing banner:', err);
            if (app.hideLoading) app.hideLoading();
            if (app.notify) {
                app.notify('Не удалось удалить баннер', 'error');
            }
        }
    }

   async function saveBanner() {
    if (!currentProfile || !currentProfile.is_own_profile) return;
    
    try {
        await app.ready();
        
        if (selectedBannerFile) {
            if (app.showLoading) app.showLoading('Сохраняем баннер...');
            
            console.log('Uploading banner file:', selectedBannerFile);
            
            // Создаем FormData для отправки файла
            const formData = new FormData();
            formData.append('banner', selectedBannerFile);
            
            // Если есть область обрезки, добавляем координаты
            if (cropArea) {
                const cropData = {
                    x: parseInt(cropArea.style.left),
                    y: parseInt(cropArea.style.top),
                    width: parseInt(cropArea.style.width),
                    height: parseInt(cropArea.style.height)
                };
                formData.append('crop_data', JSON.stringify(cropData));
            }
            
            let updatedUser;
            
            // Проверяем, есть ли метод uploadBanner в app
            if (typeof app.uploadBanner === 'function') {
                updatedUser = await app.uploadBanner(selectedBannerFile);
            } else {
                // Fallback: используем прямой fetch
                console.log('Using fallback banner upload');
                updatedUser = await uploadBannerDirectly(formData);
            }
            
            if (updatedUser && updatedUser.banner_url) {
                currentProfile.banner_url = updatedUser.banner_url;
                
                const bannerEl = document.querySelector('.card .banner');
                if (bannerEl) {
                    bannerEl.style.backgroundImage = `url('${updatedUser.banner_url}')`;
                }
                
                if (app.hideLoading) app.hideLoading();
                if (app.notify) {
                    app.notify('Баннер успешно обновлен', 'success');
                }
            } else {
                throw new Error('Не удалось получить URL баннера');
            }
        } else if (currentProfile.banner_url) {
            // Если файл не выбран, но баннер уже есть, просто закрываем модальное окно
            hideBannerEditModal();
            return;
        } else {
            // Если файл не выбран и баннера нет, показываем ошибку
            if (app.notify) {
                app.notify('Выберите изображение для баннера', 'error');
            }
            return;
        }
        
        hideBannerEditModal();
        selectedBannerFile = null;
        
    } catch (err) {
        console.error('Error saving banner:', err);
        if (app.hideLoading) app.hideLoading();
        let errorMessage = 'Не удалось сохранить баннер';
        
        if (err.message) {
            if (err.message.includes('413') || err.message.includes('too large')) {
                errorMessage = 'Файл слишком большой. Максимальный размер: 10 МБ';
            } else if (err.message.includes('401') || err.message.includes('Unauthorized')) {
                errorMessage = 'Необходимо авторизоваться';
            } else if (err.message.includes('500')) {
                errorMessage = 'Ошибка сервера. Попробуйте позже';
            } else {
                errorMessage = err.message;
            }
        }
        
        if (app.notify) {
            app.notify(errorMessage, 'error');
        }
    }
}

// Функция для прямой загрузки баннера (fallback)
async function uploadBannerDirectly(formData) {
    try {
        const response = await fetch('/api/user/banner', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${app.state.token}`,
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success) {
            return result.data;
        } else {
            throw new Error(result.error || 'Failed to upload banner');
        }
    } catch (error) {
        console.error('Error in direct banner upload:', error);
        throw error;
    }
}

    function hideBannerEditModal() {
        const modal = document.getElementById('bannerEditModal');
        if (modal) {
            modal.remove();
        }
        document.body.classList.remove('modal-open');
        selectedBannerFile = null;
        bannerImage = null;
        cropArea = null;
        zoomLevel = 1;
    }

    // ... остальные функции (shareProfile, showError, escapeHtml, goBack) ...

    function shareProfile() {
        if (!currentProfile) return;
        
        const userIdentifier = currentProfile.nickname || currentProfile.id.toString();
        if (app.shareProfile) {
            app.shareProfile(userIdentifier);
        } else {
            // Fallback: копируем ссылку в буфер обмена
            const profileUrl = `${window.location.origin}${window.location.pathname}?user=${userIdentifier}`;
            navigator.clipboard.writeText(profileUrl).then(() => {
                if (app.notify) {
                    app.notify('Ссылка на профиль скопирована в буфер обмена', 'success');
                }
            });
        }
    }

    function showError(message) {
        const card = document.querySelector('.card');
        if (card) {
            card.innerHTML = `<div class="error-message">${message}</div>`;
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function goBack() {
        window.history.back();
    }
    window.goBack = goBack;
})();