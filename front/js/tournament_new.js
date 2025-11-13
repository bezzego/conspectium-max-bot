(() => {
    /**
     * Универсальная функция копирования в буфер обмена с fallback для Safari
     * Важно: для Safari нужно, чтобы вызов происходил в контексте пользовательского действия
     */
    async function copyToClipboard(text) {
        // Проверяем, доступен ли Clipboard API
        const hasClipboardAPI = navigator.clipboard && navigator.clipboard.writeText;
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) || /iPad|iPhone|iPod/.test(navigator.userAgent);
        
        // Для Safari лучше сразу использовать fallback метод
        if (isSafari) {
            try {
                // Создаем временный textarea для копирования
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.top = '0';
                textArea.style.left = '0';
                textArea.style.width = '2em';
                textArea.style.height = '2em';
                textArea.style.padding = '0';
                textArea.style.border = 'none';
                textArea.style.outline = 'none';
                textArea.style.boxShadow = 'none';
                textArea.style.background = 'transparent';
                textArea.style.opacity = '0';
                textArea.style.pointerEvents = 'none';
                textArea.setAttribute('readonly', '');
                textArea.setAttribute('aria-hidden', 'true');
                
                document.body.appendChild(textArea);
                
                // Для iOS Safari нужен специальный подход
                if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                    textArea.contentEditable = 'true';
                    textArea.readOnly = false;
                    const range = document.createRange();
                    range.selectNodeContents(textArea);
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                    textArea.setSelectionRange(0, 999999);
                } else {
                    // Для обычного Safari
                    textArea.focus();
                    textArea.select();
                    textArea.setSelectionRange(0, text.length);
                }
                
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                
                if (!successful) {
                    throw new Error('execCommand copy failed');
                }
                
                return true;
            } catch (err) {
                console.warn('Safari fallback failed, trying Clipboard API:', err);
                // Если fallback не сработал, пробуем Clipboard API
            }
        }
        
        // Пробуем современный Clipboard API (для Chrome, Firefox, и если Safari fallback не сработал)
        if (hasClipboardAPI) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (err) {
                console.warn('Clipboard API failed, trying fallback:', err);
                // Если не получилось, пробуем fallback
            }
        }
        
        // Fallback метод для других браузеров
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.top = '-9999px';
            textArea.style.left = '-9999px';
            textArea.style.opacity = '0';
            textArea.style.pointerEvents = 'none';
            textArea.setAttribute('readonly', '');
            textArea.setAttribute('aria-hidden', 'true');
            document.body.appendChild(textArea);
            
            textArea.focus();
            textArea.select();
            textArea.setSelectionRange(0, text.length);
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (!successful) {
                throw new Error('execCommand copy failed');
            }
            
            return true;
        } catch (err) {
            console.error('All copy methods failed:', err);
            return false;
        }
    }
    
    let currentLobby = null;
    let currentView = 'tournaments';
    let refreshInterval = null;
    let app = null;

    // Инициализация
    document.addEventListener('DOMContentLoaded', async function() {
        // Получаем app сразу (он должен быть доступен, так как app.js загружается первым)
        app = window.ConspectiumApp;
        
        try {
            // Загружаем турниры сразу (не требует авторизации)
            // Это не блокируется ожиданием app.js
            await loadTournaments();
        } catch (err) {
            console.error('Error loading tournaments:', err);
            const grid = document.getElementById('tournamentsGrid');
            if (grid) {
                grid.innerHTML = '<p style="color: white; text-align: center; padding: 40px;">Ошибка при загрузке турниров</p>';
            }
        }
        
        try {
            // Инициализируем навигацию и другие элементы
            initNavigation();
            setupEventListeners();
            updateFilters();
            initCustomSelects();
        } catch (err) {
            console.error('Error initializing UI elements:', err);
        }
        
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
            const API_BASE = '/api';
            const url = `${API_BASE}/quizzes/tournament/public`;
            console.log('Fetching tournaments from:', url);
            
            const response = await fetch(url);
            console.log('Response status:', response.status, response.statusText);
            
            if (!response.ok) {
                let errorText = 'Unknown error';
                try {
                    errorText = await response.text();
                    console.error('Error response body:', errorText);
                } catch (e) {
                    console.error('Failed to read error response:', e);
                }
                console.error('Failed to load tournaments:', response.status, response.statusText, errorText);
                grid.innerHTML = `<p style="color: white; text-align: center; padding: 40px;">Не удалось загрузить турниры (${response.status}: ${response.statusText})</p>`;
                return;
            }
            
            const data = await response.json();
            console.log('Loaded tournaments data:', data);
            
            if (data && data.items && Array.isArray(data.items) && data.items.length > 0) {
                console.log('Rendering', data.items.length, 'tournaments');
                renderTournaments(data.items);
            } else {
                console.log('No tournaments found, items:', data?.items);
                grid.innerHTML = 
                    '<p style="color: white; text-align: center; padding: 40px;">Пока нет доступных турниров</p>';
            }
        } catch (err) {
            console.error('Failed to load tournaments - exception:', err);
            const grid = document.getElementById('tournamentsGrid');
            if (grid) {
                grid.innerHTML = `<p style="color: white; text-align: center; padding: 40px;">Ошибка при загрузке турниров: ${err.message || err}</p>`;
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
            if (currentLobby && currentView === 'lobby') {
                try {
                    const updatedLobby = await app.getTournamentLobby(currentLobby.id);
                    
                    // Проверяем, не начался ли турнир
                    if (updatedLobby.status === 'started' && currentLobby.status === 'waiting') {
                        // Турнир начался, перенаправляем на тест
                        if (refreshInterval) {
                            clearInterval(refreshInterval);
                            refreshInterval = null;
                        }
                        window.location.href = `/front/html/test.html?quizId=${updatedLobby.quiz_id}&lobbyId=${updatedLobby.id}`;
                        return;
                    }
                    
                    // Проверяем, не завершился ли турнир
                    if (updatedLobby.status === 'finished' || updatedLobby.status === 'cancelled') {
                        if (refreshInterval) {
                            clearInterval(refreshInterval);
                            refreshInterval = null;
                        }
                        // Можно показать результаты или вернуться к списку турниров
                        showTournamentsView();
                        if (app.notify) {
                            app.notify('Турнир завершен', 'info');
                        }
                        return;
                    }
                    
                    currentLobby = updatedLobby;
                    updateLobbyInfo(updatedLobby);
                    await updateParticipants(updatedLobby);
                } catch (err) {
                    console.error('Failed to refresh lobby:', err);
                    // Если ошибка 403 или 404, возможно, пользователь больше не участник
                    if (err.message && (err.message.includes('403') || err.message.includes('404'))) {
                        if (refreshInterval) {
                            clearInterval(refreshInterval);
                            refreshInterval = null;
                        }
                        showTournamentsView();
                        if (app.notify) {
                            app.notify('Вы больше не являетесь участником этого лобби', 'error');
                        }
                    }
                }
            }
        }, 3000); // Обновляем каждые 3 секунды
    }

    function updateLobbyInfo(lobby) {
        const titleEl = document.getElementById('lobbyTitle');
        const codeEl = document.getElementById('lobbyCode');
        
        if (titleEl) {
            titleEl.textContent = lobby.quiz_title || 'Турнир';
        }
        
        if (codeEl) {
            codeEl.textContent = lobby.invite_code;
        }
        
        // Добавляем информацию о тесте
        let quizInfoEl = document.getElementById('quizInfo');
        if (!quizInfoEl && lobby.quiz_questions_count) {
            const lobbyInfo = document.querySelector('.lobby-info');
            if (lobbyInfo) {
                quizInfoEl = document.createElement('div');
                quizInfoEl.id = 'quizInfo';
                quizInfoEl.className = 'quiz-info';
                lobbyInfo.appendChild(quizInfoEl);
            }
        }
        
        if (quizInfoEl && lobby.quiz_questions_count) {
            quizInfoEl.innerHTML = `
                <div class="quiz-info-item">
                    <i class="fas fa-question-circle"></i>
                    <span>${lobby.quiz_questions_count} вопросов</span>
                </div>
            `;
        }
    }

    async function updateParticipants(lobby) {
        const grid = document.getElementById('participantsGrid');
        const countElement = document.getElementById('participantsCount');
        
        if (!grid || !countElement) return;
        
        grid.innerHTML = '';
        
        const currentUserId = app?.state?.user?.id;
        const isHost = lobby.host_id === currentUserId;
        
        // Сортируем участников: хост первый, затем по готовности, затем по имени
        const sortedParticipants = [...lobby.participants].sort((a, b) => {
            if (a.is_host && !b.is_host) return -1;
            if (!a.is_host && b.is_host) return 1;
            if (a.is_ready && !b.is_ready) return -1;
            if (!a.is_ready && b.is_ready) return 1;
            return (a.user_display_name || '').localeCompare(b.user_display_name || '');
        });
        
        sortedParticipants.forEach(participant => {
            const participantEl = document.createElement('div');
            participantEl.className = 'participant';
            participantEl.dataset.userId = participant.user_id;
            
            const avatar = participant.user_avatar_url 
                ? `<img src="${participant.user_avatar_url}" alt="${participant.user_display_name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
                : '';
            
            const avatarFallback = `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 24px; background: linear-gradient(135deg, rgba(243, 194, 17, 0.3), rgba(240, 193, 25, 0.2)); border-radius: 50%; color: white; font-weight: 600;">${(participant.user_display_name || 'U')[0].toUpperCase()}</div>`;
            
            participantEl.innerHTML = `
                <div class="participant-avatar ${participant.is_ready ? 'ready' : ''} ${participant.is_host ? 'host' : ''}">
                    ${avatar}
                    ${avatarFallback}
                    ${participant.is_host ? '<div class="host-badge">👑</div>' : ''}
                    ${participant.is_ready ? '<div class="ready-badge"><i class="fas fa-check"></i></div>' : ''}
                </div>
                <div class="participant-name">${participant.user_display_name || 'Участник'}</div>
                <div class="participant-status ${participant.is_ready ? 'status-ready' : 'status-not-ready'}">
                    ${participant.is_ready ? '<i class="fas fa-check-circle"></i> Готов' : '<i class="fas fa-clock"></i> Не готов'}
                </div>
            `;
            
            // Добавляем возможность перехода на профиль
            if (participant.user_id && participant.user_id !== currentUserId) {
                participantEl.style.cursor = 'pointer';
                participantEl.addEventListener('click', () => {
                    window.location.href = `/front/html/profile.html?user=${participant.user_id}`;
                });
            }
            
            grid.appendChild(participantEl);
        });
        
        // Добавляем кнопку приглашения только если есть место и лобби в ожидании
        if (lobby.participants_count < lobby.max_participants && lobby.status === 'waiting') {
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
        }
        
        countElement.textContent = `${lobby.participants_count}/${lobby.max_participants}`;
        updateStartButton(lobby, isHost);
        
        // Обновляем прогресс-бар готовности
        updateReadinessProgress(lobby);
    }
    
    function updateReadinessProgress(lobby) {
        const readyCount = lobby.participants.filter(p => p.is_ready).length;
        const totalCount = lobby.participants_count;
        const progress = totalCount > 0 ? (readyCount / totalCount) * 100 : 0;
        
        let progressBar = document.getElementById('readinessProgressBar');
        if (!progressBar) {
            const lobbyControls = document.querySelector('.lobby-controls');
            if (lobbyControls) {
                const progressContainer = document.createElement('div');
                progressContainer.className = 'readiness-progress-container';
                progressContainer.innerHTML = `
                    <div class="readiness-progress-label">
                        <span>Готовность: ${readyCount}/${totalCount}</span>
                    </div>
                    <div class="readiness-progress-bar">
                        <div class="readiness-progress-fill" id="readinessProgressBar" style="width: ${progress}%"></div>
                    </div>
                `;
                lobbyControls.insertBefore(progressContainer, lobbyControls.firstChild);
                progressBar = document.getElementById('readinessProgressBar');
            }
        }
        
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
            const label = document.querySelector('.readiness-progress-label span');
            if (label) {
                label.textContent = `Готовность: ${readyCount}/${totalCount}`;
            }
        }
    }

    function updateStartButton(lobby, isHost) {
        const startBtn = document.getElementById('startBtn');
        const readyBtn = document.getElementById('readyBtn');
        
        if (!startBtn || !readyBtn) return;
        
        const allReady = lobby.participants.length > 0 && lobby.participants.every(p => p.is_ready);
        const minParticipants = lobby.participants_count >= 2;
        const canStart = allReady && minParticipants && lobby.status === 'waiting';
        
        // Обновляем кнопку "Готов" для текущего пользователя
        const currentUser = lobby.participants.find(p => p.user_id === app?.state?.user?.id);
        if (currentUser) {
            if (currentUser.is_ready) {
                readyBtn.classList.add('ready-active');
                readyBtn.innerHTML = '<i class="fas fa-check"></i> Готов';
            } else {
                readyBtn.classList.remove('ready-active');
                readyBtn.innerHTML = 'Готов';
            }
        }
        
        if (isHost) {
            startBtn.style.display = 'block';
            startBtn.disabled = !canStart || lobby.status !== 'waiting';
            if (canStart && lobby.status === 'waiting') {
                startBtn.classList.add('can-start');
                startBtn.innerHTML = '<i class="fas fa-play"></i> Начать турнир';
            } else {
                startBtn.classList.remove('can-start');
                let reason = '';
                if (lobby.status !== 'waiting') {
                    reason = 'Турнир уже начат';
                } else if (!minParticipants) {
                    reason = `Минимум 2 участника (сейчас ${lobby.participants_count})`;
                } else if (!allReady) {
                    const notReadyCount = lobby.participants.filter(p => !p.is_ready).length;
                    reason = `${notReadyCount} участник${notReadyCount === 1 ? '' : notReadyCount < 5 ? 'а' : 'ов'} не готов${notReadyCount === 1 ? '' : 'ы'}`;
                }
                startBtn.innerHTML = reason ? `<i class="fas fa-clock"></i> ${reason}` : '<i class="fas fa-play"></i> Начать турнир';
            }
        } else {
            startBtn.style.display = 'none';
        }
    }

    function generateInviteLink(inviteCode) {
        showInviteModal(inviteCode);
    }
    
    function showInviteModal(inviteCode) {
        // Удаляем существующее модальное окно, если есть
        const existingModal = document.getElementById('inviteModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const inviteLink = `${window.location.origin}${window.location.pathname}?join=${inviteCode}`;
        
        const modal = document.createElement('div');
        modal.id = 'inviteModal';
        modal.className = 'invite-modal-overlay';
        modal.innerHTML = `
            <div class="invite-modal-content" onclick="event.stopPropagation()">
                <div class="invite-modal-header">
                    <h2>Пригласить друзей</h2>
                    <button class="invite-modal-close" onclick="closeInviteModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="invite-modal-body">
                    <div class="invite-code-section">
                        <label>Код приглашения</label>
                        <div class="invite-code-display">
                            <span class="invite-code-text">${inviteCode}</span>
                            <button class="invite-copy-btn" data-copy="${inviteCode}" onclick="copyInviteCode('${inviteCode}')">
                                <i class="far fa-copy"></i>
                            </button>
                        </div>
                    </div>
                    <div class="invite-link-section">
                        <label>Ссылка-приглашение</label>
                        <div class="invite-link-display">
                            <input type="text" class="invite-link-input" value="${inviteLink}" readonly>
                            <button class="invite-copy-btn" onclick="copyInviteLink('${inviteLink}')">
                                <i class="far fa-copy"></i>
                            </button>
                        </div>
                    </div>
                    <div class="invite-share-buttons">
                        <button class="invite-share-btn" onclick="shareInviteLink('${inviteLink}', '${inviteCode}')">
                            <i class="fas fa-share-alt"></i>
                            Поделиться
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Закрытие при клике вне модального окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeInviteModal();
            }
        });
        
        // Закрытие по ESC
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeInviteModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // Анимация появления
        setTimeout(() => {
            modal.classList.add('visible');
        }, 10);
    }
    
    function closeInviteModal() {
        const modal = document.getElementById('inviteModal');
        if (modal) {
            modal.classList.remove('visible');
            setTimeout(() => {
                modal.remove();
            }, 300);
        }
    }
    
    async function copyInviteCode(code) {
        const event = window.event || arguments[0];
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        
        const success = await copyToClipboard(code);
        if (success) {
            showNotification('Код скопирован!');
            const btn = event.target.closest('.invite-copy-btn');
            if (btn) {
                const icon = btn.querySelector('i');
                if (icon) {
                    icon.className = 'fas fa-check';
                    setTimeout(() => {
                        icon.className = 'far fa-copy';
                    }, 2000);
                }
            }
        } else {
            showNotification('Не удалось скопировать код', 'error');
        }
    }
    
    async function copyInviteLink(link) {
        const event = window.event || arguments[0];
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        
        const success = await copyToClipboard(link);
        if (success) {
            showNotification('Ссылка скопирована!');
            const btn = event.target.closest('.invite-copy-btn');
            if (btn) {
                const icon = btn.querySelector('i');
                if (icon) {
                    icon.className = 'fas fa-check';
                    setTimeout(() => {
                        icon.className = 'far fa-copy';
                    }, 2000);
                }
            }
        } else {
            showNotification('Не удалось скопировать ссылку', 'error');
        }
    }
    
    async function shareInviteLink(link, code) {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Присоединяйся к турниру!',
                    text: `Присоединяйся к турниру! Код: ${code}`,
                    url: link,
                });
                showNotification('Приглашение отправлено!');
            } catch (err) {
                if (err.name !== 'AbortError') {
                    copyInviteLink(link);
                }
            }
        } else {
            copyInviteLink(link);
        }
    }

    async function copyLobbyCode() {
        if (currentLobby && currentLobby.invite_code) {
            const success = await copyToClipboard(currentLobby.invite_code);
            if (success) {
                showNotification('Код лобби скопирован!');
            } else {
                showNotification('Не удалось скопировать код', 'error');
            }
        }
    }

    async function toggleReady() {
        if (!currentLobby || !app) return;
        
        const readyBtn = document.getElementById('readyBtn');
        if (readyBtn) {
            readyBtn.disabled = true;
        }
        
        try {
            const currentUser = currentLobby.participants.find(p => p.user_id === app.state?.user?.id);
            if (!currentUser) {
                if (app.notify) {
                    app.notify('Вы не являетесь участником этого лобби', 'error');
                }
                return;
            }
            
            const newReadyStatus = !currentUser.is_ready;
            
            if (app.showLoading) app.showLoading(newReadyStatus ? 'Отмечаем как готов...' : 'Снимаем готовность...');
            
            await app.updateTournamentParticipantStatus(currentLobby.id, newReadyStatus);
            
            // Обновляем локальное состояние
            currentUser.is_ready = newReadyStatus;
            
            // Обновляем кнопку визуально
            if (readyBtn) {
                if (newReadyStatus) {
                    readyBtn.classList.add('ready-active');
                    readyBtn.innerHTML = '<i class="fas fa-check"></i> Готов';
                } else {
                    readyBtn.classList.remove('ready-active');
                    readyBtn.innerHTML = 'Готов';
                }
            }
            
            // Обновляем участников
            await updateParticipants(currentLobby);
            
            if (app.hideLoading) app.hideLoading();
            if (app.notify) {
                app.notify(newReadyStatus ? 'Вы готовы!' : 'Готовность снята', 'success');
            }
        } catch (err) {
            console.error(err);
            if (app.hideLoading) app.hideLoading();
            if (app.notify) {
                app.notify(err.message || 'Не удалось обновить статус', 'error');
            } else {
                alert(err.message || 'Не удалось обновить статус');
            }
        } finally {
            if (readyBtn) {
                readyBtn.disabled = false;
            }
        }
    }

    async function startTournament() {
        if (!currentLobby || !app) return;
        
        const startBtn = document.getElementById('startBtn');
        if (startBtn) {
            startBtn.disabled = true;
        }
        
        const isHost = currentLobby.host_id === app.state?.user?.id;
        if (!isHost) {
            if (app.notify) {
                app.notify('Только хост может запустить турнир', 'error');
            } else {
                alert('Только хост может запустить турнир');
            }
            if (startBtn) {
                startBtn.disabled = false;
            }
            return;
        }
        
        // Дополнительные проверки
        const allReady = currentLobby.participants.length > 0 && currentLobby.participants.every(p => p.is_ready);
        const minParticipants = currentLobby.participants_count >= 2;
        
        if (!minParticipants) {
            if (app.notify) {
                app.notify(`Для начала турнира нужно минимум 2 участника (сейчас ${currentLobby.participants_count})`, 'error');
            }
            if (startBtn) {
                startBtn.disabled = false;
            }
            return;
        }
        
        if (!allReady) {
            const notReady = currentLobby.participants.filter(p => !p.is_ready);
            const notReadyNames = notReady.map(p => p.user_display_name || 'Участник').join(', ');
            if (app.notify) {
                app.notify(`Не все участники готовы: ${notReadyNames}`, 'error');
            }
            if (startBtn) {
                startBtn.disabled = false;
            }
            return;
        }
        
        try {
            if (app.showLoading) app.showLoading('Запускаем турнир...');
            
            // Небольшая задержка для визуальной обратной связи
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const updatedLobby = await app.startTournamentLobby(currentLobby.id);
            
            if (app.hideLoading) app.hideLoading();
            
            currentLobby = updatedLobby;
            
            // Останавливаем обновление лобби
            if (refreshInterval) {
                clearInterval(refreshInterval);
                refreshInterval = null;
            }
            
            // Перенаправляем на тест
            window.location.href = `/front/html/test.html?quizId=${updatedLobby.quiz_id}&lobbyId=${updatedLobby.id}`;
        } catch (err) {
            console.error(err);
            if (app.hideLoading) app.hideLoading();
            if (app.notify) {
                app.notify(err.message || 'Не удалось запустить турнир', 'error');
            } else {
                alert(err.message || 'Не удалось запустить турнир');
            }
            if (startBtn) {
                startBtn.disabled = false;
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

    // Функция выхода из лобби
    async function leaveLobby() {
        if (!currentLobby || !app) return;
        
        const isHost = currentLobby.host_id === app.state?.user?.id;
        
        if (isHost) {
            const confirmed = confirm('Вы являетесь хостом. Если вы выйдете, лобби будет закрыто. Продолжить?');
            if (!confirmed) return;
        } else {
            const confirmed = confirm('Вы уверены, что хотите покинуть лобби?');
            if (!confirmed) return;
        }
        
        // Останавливаем обновление
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
        
        // Возвращаемся к списку турниров
        showTournamentsView();
        
        if (app.notify) {
            app.notify('Вы покинули лобби', 'info');
        }
    }
    
    // Экспортируем функции для использования в HTML
    window.copyLobbyCode = copyLobbyCode;
    window.generateInviteLink = generateInviteLink;
    window.toggleReady = toggleReady;
    window.startTournament = startTournament;
    window.closeInviteModal = closeInviteModal;
    // Экспортируем функции в глобальную область для использования в onclick
    // Важно: для Safari нужно, чтобы копирование происходило синхронно в контексте клика
    window.copyInviteCode = function(code) {
        // Вызываем асинхронно, но в контексте пользовательского действия
        copyInviteCode(code).catch(err => {
            console.error('Failed to copy invite code:', err);
        });
    };
    window.copyInviteLink = function(link) {
        // Вызываем асинхронно, но в контексте пользовательского действия
        copyInviteLink(link).catch(err => {
            console.error('Failed to copy invite link:', err);
        });
    };
    window.shareInviteLink = shareInviteLink;
    window.leaveLobby = leaveLobby;
    window.copyLobbyCode = function() {
        copyLobbyCode().catch(err => {
            console.error('Failed to copy lobby code:', err);
        });
    };
})();

