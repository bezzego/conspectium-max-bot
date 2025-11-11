(() => {
    const app = window.ConspectiumApp;
    if (!app) {
        console.error('ConspectiumApp not found');
        return;
    }

    let currentLobby = null;
    let currentView = 'tournaments';
    let refreshInterval = null;

    // Инициализация
    document.addEventListener('DOMContentLoaded', async function() {
        await app.ready();
        initNavigation();
        await loadTournaments();
        setupEventListeners();
        updateFilters();
        initCustomSelects();
        
        // Проверяем, есть ли код приглашения в URL
        const params = new URLSearchParams(window.location.search);
        const inviteCode = params.get('join');
        if (inviteCode) {
            await joinLobbyByInviteCode(inviteCode);
        }
    });

    async function loadTournaments() {
        try {
            // Загружаем только публичные тесты
            const response = await fetch('/api/quizzes/tournament/public');
            if (!response.ok) {
                console.error('Failed to load tournaments');
                return;
            }
            const data = await response.json();
            
            if (data && data.items && data.items.length > 0) {
                renderTournaments(data.items);
            } else {
                document.getElementById('tournamentsGrid').innerHTML = 
                    '<p style="color: white; text-align: center; padding: 40px;">Пока нет доступных турниров</p>';
            }
        } catch (err) {
            console.error('Failed to load tournaments:', err);
        }
    }

    function renderTournaments(quizzes) {
        const grid = document.getElementById('tournamentsGrid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        quizzes.forEach(quiz => {
            const card = document.createElement('div');
            card.className = 'tournament-card fade-in';
            card.onclick = () => createLobbyFromQuiz(quiz);
            
            const questionsCount = quiz.questions?.length || 0;
            const estimatedTime = Math.ceil(questionsCount * 1.5);
            
            card.innerHTML = `
                <div class="tournament-badge">
                    <i class="fas fa-graduation-cap"></i>
                    Публичный тест
                </div>
                <div class="tournament-title">${quiz.title || 'Без названия'}</div>
                <div class="tournament-description">${quiz.description || 'Пройди тест и соревнуйся с другими!'}</div>
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
            
            grid.appendChild(card);
        });
    }

    async function createLobbyFromQuiz(quiz) {
        try {
            app.showLoading('Создаём лобби...');
            const lobby = await app.createTournamentLobby(quiz.id, 8);
            app.hideLoading();
            
            currentLobby = lobby;
            await showLobbyView(lobby);
        } catch (err) {
            console.error(err);
            app.hideLoading();
            app.notify(err.message || 'Не удалось создать лобби', 'error');
        }
    }

    async function joinLobbyByInviteCode(inviteCode) {
        try {
            app.showLoading('Присоединяемся к лобби...');
            const lobby = await app.joinTournamentLobby(inviteCode);
            app.hideLoading();
            
            currentLobby = lobby;
            await showLobbyView(lobby);
            
            // Очищаем URL от параметра
            window.history.replaceState({}, '', window.location.pathname);
        } catch (err) {
            console.error(err);
            app.hideLoading();
            app.notify(err.message || 'Не удалось присоединиться к лобби', 'error');
        }
    }

    async function showLobbyView(lobby) {
        document.getElementById('resultsContainer').style.display = 'none';
        document.querySelector('.tournaments-grid').style.display = 'none';
        document.querySelector('.tournament-filters').style.display = 'none';
        document.querySelector('.title').style.display = 'none';
        document.querySelector('.subtitle').style.display = 'none';
        document.getElementById('lobbyContainer').style.display = 'block';
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
        
        const currentUserId = app.state?.user?.id;
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
        if (!currentLobby) return;
        
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
            app.notify(err.message || 'Не удалось обновить статус', 'error');
        }
    }

    async function startTournament() {
        if (!currentLobby) return;
        
        const isHost = currentLobby.host_id === app.state?.user?.id;
        if (!isHost) {
            app.notify('Только хост может запустить турнир', 'error');
            return;
        }
        
        try {
            app.showLoading('Запускаем турнир...');
            const updatedLobby = await app.startTournamentLobby(currentLobby.id);
            app.hideLoading();
            
            currentLobby = updatedLobby;
            
            // Перенаправляем на тест
            window.location.href = `test.html?quizId=${updatedLobby.quiz_id}&lobbyId=${updatedLobby.id}`;
        } catch (err) {
            console.error(err);
            app.hideLoading();
            app.notify(err.message || 'Не удалось запустить турнир', 'error');
        }
    }

    function showTournamentsView() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
        
        document.getElementById('lobbyContainer').style.display = 'none';
        document.getElementById('resultsContainer').style.display = 'none';
        document.querySelector('.tournaments-grid').style.display = 'grid';
        document.querySelector('.tournament-filters').style.display = 'block';
        document.querySelector('.title').style.display = 'block';
        document.querySelector('.subtitle').style.display = 'block';
        currentView = 'tournaments';
        currentLobby = null;
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

