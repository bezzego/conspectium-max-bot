(() => {
    let currentLobby = null;
    let currentView = 'tournaments';
    let refreshInterval = null;
    let app = null;

    // Инициализация
    document.addEventListener('DOMContentLoaded', async function() {
        // Получаем app сразу (он должен быть доступен, так как app.js загружается первым)
        app = window.ConspectiumApp;
        
        // Загружаем турниры сразу (не требует авторизации)
        // Это не блокируется ожиданием app.js
        await loadTournaments();
        
        // Инициализируем навигацию и другие элементы
        initNavigation();
        setupEventListeners();
        updateFilters();
        initCustomSelects();
        
        // Проверяем, есть ли код приглашения в URL
        const params = new URLSearchParams(window.location.search);
        const inviteCode = params.get('join');
        if (inviteCode && app) {
            // Для присоединения к лобби нужна авторизация
            try {
                await app.ready();
                await joinLobbyByInviteCode(inviteCode);
            } catch (err) {
                console.error('Ошибка при присоединении к лобби:', err);
                if (app && app.notify) {
                    app.notify('Для присоединения к лобби необходимо войти в аккаунт', 'error');
                }
            }
        }
    });

    async function loadTournaments() {
        try {
            const grid = document.getElementById('tournamentsGrid');
            if (!grid) {
                console.error('Tournaments grid not found');
                return;
            }
            
            // Показываем состояние загрузки
            grid.innerHTML = '<p style="color: white; text-align: center; padding: 40px;">Загружаем турниры...</p>';
            
            // Загружаем только публичные тесты (этот endpoint не требует авторизации)
            const response = await fetch('/api/quizzes/tournament/public');
            if (!response.ok) {
                console.error('Failed to load tournaments:', response.status, response.statusText);
                grid.innerHTML = '<p style="color: white; text-align: center; padding: 40px;">Не удалось загрузить турниры</p>';
                return;
            }
            
            const data = await response.json();
            console.log('Loaded tournaments:', data);
            
            if (data && data.items && data.items.length > 0) {
                console.log('Rendering', data.items.length, 'tournaments');
                renderTournaments(data.items);
            } else {
                grid.innerHTML = 
                    '<p style="color: white; text-align: center; padding: 40px;">Пока нет доступных турниров</p>';
            }
        } catch (err) {
            console.error('Failed to load tournaments:', err);
            const grid = document.getElementById('tournamentsGrid');
            if (grid) {
                grid.innerHTML = '<p style="color: white; text-align: center; padding: 40px;">Ошибка при загрузке турниров</p>';
            }
        }
    }

    function renderTournaments(quizzes) {
        console.log('renderTournaments called with', quizzes.length, 'quizzes');
        const grid = document.getElementById('tournamentsGrid');
        if (!grid) {
            console.error('tournamentsGrid element not found!');
            return;
        }
        
        console.log('Clearing grid and rendering', quizzes.length, 'tournaments');
        grid.innerHTML = '';
        
        if (quizzes.length === 0) {
            console.log('No quizzes to render');
            grid.innerHTML = '<p style="color: white; text-align: center; padding: 40px;">Пока нет доступных турниров</p>';
            return;
        }
        
        quizzes.forEach((quiz, index) => {
            console.log(`Rendering quiz ${index + 1}:`, quiz.title, 'by', quiz.user_nickname);
            const card = document.createElement('div');
            card.className = 'tournament-card fade-in';
            card.onclick = () => createLobbyFromQuiz(quiz);
            
            const questionsCount = quiz.questions_count || quiz.questions?.length || 0;
            const estimatedTime = Math.ceil(questionsCount * 1.5);
            
            // Форматируем дату публикации
            const publishDate = new Date(quiz.created_at);
            const formattedDate = publishDate.toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            // Получаем никнейм пользователя
            const userNickname = quiz.user_nickname || 'Неизвестный пользователь';
            const userAvatarUrl = quiz.user_avatar_url || '';
            
            // Формируем HTML для аватара
            let avatarHtml = '';
            if (userAvatarUrl) {
                // Если аватар загружен с устройства, используем его URL
                if (userAvatarUrl.startsWith('/api/auth/avatar/')) {
                    avatarHtml = `<img src="${userAvatarUrl}" alt="${userNickname}" class="tournament-author-avatar" onerror="this.style.display='none'">`;
                } else {
                    // Если это URL из коллекции, используем его
                    avatarHtml = `<img src="${userAvatarUrl}" alt="${userNickname}" class="tournament-author-avatar" onerror="this.style.display='none'">`;
                }
            }
            
            // Создаем иконку пользователя для перехода на профиль
            const userId = quiz.user_id || quiz.userId;
            
            card.innerHTML = `
                <div class="tournament-badge">
                    <i class="fas fa-graduation-cap"></i>
                    Публичный тест
                </div>
                ${userId ? `<div class="tournament-user-icon"><i class="fas fa-user"></i></div>` : ''}
                <div class="tournament-title">${quiz.title || 'Без названия'}</div>
                <div class="tournament-description">${quiz.description || 'Пройди тест и соревнуйся с другими!'}</div>
                <div class="tournament-author">
                    ${avatarHtml}
                    <div class="tournament-author-info">
                        <span class="tournament-author-name">${userNickname}</span>
                        <span class="tournament-publish-date">${formattedDate}</span>
                    </div>
                </div>
                <div class="tournament-meta">
                    <span class="tournament-difficulty difficulty-medium">Средний</span>
                </div>
                <div class="tournament-stats">
                    <div class="stat">
                        <i class="fas fa-question-circle"></i>
                        <span>${questionsCount} вопросов</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-clock"></i>
                        <span>~${estimatedTime} мин</span>
                    </div>
                </div>
            `;
            
            // Добавляем обработчики событий для перехода на профиль
            if (userId) {
                const userIcon = card.querySelector('.tournament-user-icon');
                if (userIcon) {
                    userIcon.addEventListener('click', (e) => {
                        e.stopPropagation();
                        window.location.href = `/front/html/profile.html?user=${encodeURIComponent(userId)}`;
                    });
                    userIcon.style.cursor = 'pointer';
                }
            }
            
            const authorElement = card.querySelector('.tournament-author');
            if (authorElement && userId) {
                authorElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.location.href = `/front/html/profile.html?user=${encodeURIComponent(userId)}`;
                });
                authorElement.style.cursor = 'pointer';
            }
            
            grid.appendChild(card);
        });
        
        console.log('Successfully rendered', quizzes.length, 'tournaments in the grid');
    }

    async function createLobbyFromQuiz(quiz) {
        if (!app) {
            alert('Для создания лобби необходимо войти в аккаунт');
            window.location.href = '/front/html/welcome_modal.html';
            return;
        }
        
        // Проверяем авторизацию перед созданием лобби
        try {
            await app.ready();
        } catch (err) {
            if (app.notify) {
                app.notify('Для создания лобби необходимо войти в аккаунт', 'error');
            } else {
                alert('Для создания лобби необходимо войти в аккаунт');
            }
            return;
        }
        
        try {
            if (app.showLoading) app.showLoading('Создаём лобби...');
            const lobby = await app.createTournamentLobby(quiz.id, 8);
            if (app.hideLoading) app.hideLoading();
            
            currentLobby = lobby;
            await showLobbyView(lobby);
        } catch (err) {
            console.error(err);
            if (app.hideLoading) app.hideLoading();
            if (app.notify) {
                app.notify(err.message || 'Не удалось создать лобби', 'error');
            } else {
                alert(err.message || 'Не удалось создать лобби');
            }
        }
    }

    async function joinLobbyByInviteCode(inviteCode) {
        if (!app) {
            alert('Для присоединения к лобби необходимо войти в аккаунт');
            window.location.href = '/front/html/welcome_modal.html';
            return;
        }
        
        try {
            if (app.showLoading) app.showLoading('Присоединяемся к лобби...');
            const lobby = await app.joinTournamentLobby(inviteCode);
            if (app.hideLoading) app.hideLoading();
            
            currentLobby = lobby;
            await showLobbyView(lobby);
            
            // Очищаем URL от параметра
            window.history.replaceState({}, '', window.location.pathname);
        } catch (err) {
            console.error(err);
            if (app.hideLoading) app.hideLoading();
            if (app.notify) {
                app.notify(err.message || 'Не удалось присоединиться к лобби', 'error');
            } else {
                alert(err.message || 'Не удалось присоединиться к лобби');
            }
        }
    }

    async function showLobbyView(lobby) {
        const resultsContainer = document.getElementById('resultsContainer');
        const tournamentsGrid = document.getElementById('tournamentsGrid');
        const filters = document.querySelector('.tournament-filters');
        const title = document.querySelector('.title');
        const subtitle = document.querySelector('.subtitle');
        const lobbyContainer = document.getElementById('lobbyContainer');
        
        if (resultsContainer) resultsContainer.style.display = 'none';
        if (tournamentsGrid) tournamentsGrid.style.display = 'none';
        if (filters) filters.style.display = 'none';
        if (title) title.style.display = 'none';
        if (subtitle) subtitle.style.display = 'none';
        if (lobbyContainer) lobbyContainer.style.display = 'block';
        
        currentView = 'lobby';
        
        updateLobbyInfo(lobby);
        await updateParticipants(lobby);
        
        // Начинаем периодическое обновление
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
        refreshInterval = setInterval(async () => {
            if (currentLobby) {
                try {
                    const updatedLobby = await app.getTournamentLobby(currentLobby.id);
                    currentLobby = updatedLobby;
                    updateLobbyInfo(updatedLobby);
                    await updateParticipants(updatedLobby);
                } catch (err) {
                    console.error('Failed to refresh lobby:', err);
                }
            }
        }, 3000); // Обновляем каждые 3 секунды
    }

    function updateLobbyInfo(lobby) {
        document.getElementById('lobbyTitle').textContent = `Лобби: ${lobby.quiz_title || 'Турнир'}`;
        document.getElementById('lobbyCode').textContent = lobby.invite_code;
    }

    async function updateParticipants(lobby) {
        const grid = document.getElementById('participantsGrid');
        const countElement = document.getElementById('participantsCount');
        
        if (!grid || !countElement) return;
        
        grid.innerHTML = '';
        
        const currentUserId = app?.state?.user?.id;
        const isHost = lobby.host_id === currentUserId;
        
        lobby.participants.forEach(participant => {
            const participantEl = document.createElement('div');
            participantEl.className = 'participant';
            
            const avatar = participant.user_avatar_url 
                ? `<img src="${participant.user_avatar_url}" alt="${participant.user_display_name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`
                : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 24px; background: linear-gradient(135deg, rgba(243, 194, 17, 0.3), rgba(240, 193, 25, 0.2)); border-radius: 50%;">${(participant.user_display_name || 'U')[0].toUpperCase()}</div>`;
            
            participantEl.innerHTML = `
                <div class="participant-avatar ${participant.is_ready ? 'ready' : ''} ${participant.is_host ? 'host' : ''}">
                    ${avatar}
                    ${participant.is_host ? '<div class="host-badge">👑</div>' : ''}
                </div>
                <div class="participant-name">${participant.user_display_name || 'Участник'}</div>
                <div class="participant-status ${participant.is_ready ? 'status-ready' : 'status-not-ready'}">
                    ${participant.is_ready ? 'Готов' : 'Не готов'}
                </div>
            `;
            
            grid.appendChild(participantEl);
        });
        
        // Добавляем кнопку приглашения
        const inviteBtn = document.createElement('div');
        inviteBtn.className = 'add-participant';
        inviteBtn.onclick = () => generateInviteLink(lobby.invite_code);
        inviteBtn.innerHTML = `
            <div class="add-icon">
                <i class="fas fa-plus"></i>
            </div>
            <div class="participant-name">Пригласить</div>
        `;
        grid.appendChild(inviteBtn);
        
        countElement.textContent = `${lobby.participants_count}/${lobby.max_participants}`;
        updateStartButton(lobby, isHost);
    }

    function updateStartButton(lobby, isHost) {
        const startBtn = document.getElementById('startBtn');
        const readyBtn = document.getElementById('readyBtn');
        
        if (!startBtn || !readyBtn) return;
        
        const allReady = lobby.participants.every(p => p.is_ready);
        const minParticipants = lobby.participants_count >= 2;
        
        if (isHost) {
            startBtn.disabled = !(allReady && minParticipants && lobby.status === 'waiting');
        } else {
            startBtn.style.display = 'none';
        }
    }

    function generateInviteLink(inviteCode) {
        const link = `${window.location.origin}${window.location.pathname}?join=${inviteCode}`;
        navigator.clipboard.writeText(link).then(() => {
            showNotification('Ссылка-приглашение скопирована!');
        });
    }

    function copyLobbyCode() {
        if (currentLobby) {
            navigator.clipboard.writeText(currentLobby.invite_code);
            showNotification('Код лобби скопирован!');
        }
    }

    async function toggleReady() {
        if (!currentLobby || !app) return;
        
        try {
            const currentUser = currentLobby.participants.find(p => p.user_id === app.state?.user?.id);
            const newReadyStatus = !currentUser?.is_ready;
            
            await app.updateTournamentParticipantStatus(currentLobby.id, newReadyStatus);
            
            // Обновляем локальное состояние
            if (currentUser) {
                currentUser.is_ready = newReadyStatus;
            }
            await updateParticipants(currentLobby);
        } catch (err) {
            console.error(err);
            if (app.notify) {
                app.notify(err.message || 'Не удалось обновить статус', 'error');
            } else {
                alert(err.message || 'Не удалось обновить статус');
            }
        }
    }

    async function startTournament() {
        if (!currentLobby || !app) return;
        
        const isHost = currentLobby.host_id === app.state?.user?.id;
        if (!isHost) {
            if (app.notify) {
                app.notify('Только хост может запустить турнир', 'error');
            } else {
                alert('Только хост может запустить турнир');
            }
            return;
        }
        
        try {
            if (app.showLoading) app.showLoading('Запускаем турнир...');
            const updatedLobby = await app.startTournamentLobby(currentLobby.id);
            if (app.hideLoading) app.hideLoading();
            
            currentLobby = updatedLobby;
            
            // Перенаправляем на тест
            window.location.href = `test.html?quizId=${updatedLobby.quiz_id}&lobbyId=${updatedLobby.id}`;
        } catch (err) {
            console.error(err);
            if (app.hideLoading) app.hideLoading();
            if (app.notify) {
                app.notify(err.message || 'Не удалось запустить турнир', 'error');
            } else {
                alert(err.message || 'Не удалось запустить турнир');
            }
        }
    }

    function showTournamentsView() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
        
        const lobbyContainer = document.getElementById('lobbyContainer');
        const resultsContainer = document.getElementById('resultsContainer');
        const tournamentsGrid = document.getElementById('tournamentsGrid');
        const filters = document.querySelector('.tournament-filters');
        const title = document.querySelector('.title');
        const subtitle = document.querySelector('.subtitle');
        
        if (lobbyContainer) lobbyContainer.style.display = 'none';
        if (resultsContainer) resultsContainer.style.display = 'none';
        if (tournamentsGrid) tournamentsGrid.style.display = 'grid';
        if (filters) filters.style.display = 'block';
        if (title) title.style.display = 'block';
        if (subtitle) subtitle.style.display = 'block';
        
        currentView = 'tournaments';
        currentLobby = null;
        
        // Перезагружаем список турниров при возврате к виду турниров
        loadTournaments();
    }

    function showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            font-family: 'Manrope', sans-serif;
            font-weight: 500;
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.15) 100%);
            backdrop-filter: blur(15px);
            border: 1px solid rgba(255,255,255,0.2);
            color: white;
            padding: 15px 30px;
            border-radius: 12px;
            z-index: 10000;
            text-align: center;
            white-space: nowrap;
            box-shadow: 0 8px 25px rgba(0,0,0,0.2);
            opacity: 0;
            animation: centerFadeIn 0.3s ease forwards;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 2700);
    }

    function initNavigation() {
        const backBtn = document.getElementById('backBtn');
        if (!backBtn) return;
        
        backBtn.addEventListener('click', function() {
            handleBackNavigation();
        });
    }

    function handleBackNavigation() {
        switch(currentView) {
            case 'results':
                if (currentLobby) {
                    showLobbyView(currentLobby);
                } else {
                    showTournamentsView();
                }
                break;
            case 'lobby':
                showTournamentsView();
                break;
            case 'tournaments':
            default:
                if (document.referrer && document.referrer.includes(window.location.hostname)) {
                    window.history.back();
                } else {
                    window.location.href = '/front/html/main.html';
                }
                break;
        }
    }

    function updateFilters() {
        // Фильтры пока не используются, так как показываем только публичные тесты
    }

    function initCustomSelects() {
        // Инициализация кастомных селектов, если нужно
    }

    function setupEventListeners() {
        const readyBtn = document.getElementById('readyBtn');
        const startBtn = document.getElementById('startBtn');
        
        if (readyBtn) {
            readyBtn.addEventListener('click', toggleReady);
        }
        
        if (startBtn) {
            startBtn.addEventListener('click', startTournament);
        }
        
        // Кнопка копирования кода
        const copyBtn = document.querySelector('.copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', copyLobbyCode);
        }
    }

    // Экспортируем функции для использования в HTML
    window.copyLobbyCode = copyLobbyCode;
    window.generateInviteLink = generateInviteLink;
    window.toggleReady = toggleReady;
    window.startTournament = startTournament;
})();

