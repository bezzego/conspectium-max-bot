(() => {
    const API_BASE = '/api';
    const TOKEN_KEY = 'conspectium_token';
    const USER_KEY = 'conspectium_user';
    // Dev profile keys removed for web-only flow

    const state = {
        token: localStorage.getItem(TOKEN_KEY) || null,
        user: null,
    };

    function setUser(user) {
        state.user = user;
        if (user) {
            localStorage.setItem(USER_KEY, JSON.stringify(user));
        } else {
            localStorage.removeItem(USER_KEY);
        }
    }

    function clearAuthState() {
        state.token = null;
        state.user = null;
        localStorage.removeItem(TOKEN_KEY);
        try {
            const cachedUser = localStorage.getItem(USER_KEY);
            if (cachedUser) {
                localStorage.removeItem(USER_KEY);
            }
        } catch (e) {
            console.error('Failed to clear user from localStorage', e);
        }
    }
    
    function logout() {
        clearAuthState();
        // Перенаправляем на страницу регистрации
        window.location.href = '/front/html/welcome_modal.html';
    }

    if (localStorage.getItem(USER_KEY)) {
        try {
            state.user = JSON.parse(localStorage.getItem(USER_KEY));
        } catch (err) {
            console.warn('Failed to parse cached user', err);
            localStorage.removeItem(USER_KEY);
        }
    }

    // Dev-login removed — web-only registration via welcome modal is required

    async function fetchCurrentUser() {
        const response = await authFetch('/auth/me', { _internalCall: true });
        if (response) {
            setUser(response);
        }
    }

    async function ensureAuth() {
        // If we have no token and no cached user, redirect to onboarding page
        // so the user can register. In development flows there is still
        // a dev-login available, but for normal web usage we require explicit
        // registration (welcome modal).
        if (!state.token && !state.user) {
            // Navigate to the onboarding modal/page which will call /auth/register
            window.location.href = '/front/html/welcome_modal.html';
            // stop further execution — onboarding takes over
            return state;
        }

        // If we have a token but no cached user, try to fetch user. On failure
        // clear auth state and show onboarding so the user can register.
        if (state.token && !state.user) {
            try {
                await fetchCurrentUser();
            } catch (err) {
                console.error('Failed to fetch current user', err);
                clearAuthState();
                // Redirect to onboarding to register a fresh user
                window.location.href = '/front/html/welcome_modal.html';
                return state;
            }
        }

        return state;
    }

    async function authFetch(path, options = {}) {
        const { _internalCall, ...requestOptions } = options;
        // If this is an internal call used by ensureAuth (e.g. fetching /auth/me),
        // skip calling ensureAuth again to avoid recursion.
        if (!_internalCall) {
            await ensureAuth();
        }

        const headers = options.headers ? { ...options.headers } : {};
        headers['Authorization'] = `Bearer ${state.token}`;

        const performRequest = async (retry = false) => {
            const response = await fetch(`${API_BASE}${path}`, {
                ...requestOptions,
                headers,
            });

            if (response.status === 204) {
                return null;
            }

            if (response.status === 401 || response.status === 403) {
                if (_internalCall) {
                    const text = await response.text();
                    throw new Error(text || response.statusText);
                }
                if (retry) {
                    const text = await response.text();
                    throw new Error(text || response.statusText);
                }
                clearAuthState();
                await ensureAuth();
                headers['Authorization'] = `Bearer ${state.token}`;
                return performRequest(true);
            }

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || response.statusText);
            }

            const raw = await response.text();
            if (!raw) {
                return null;
            }

            try {
                return JSON.parse(raw);
            } catch (err) {
                return raw;
            }
        };

        return performRequest();
    }

    function createElement(tag, classNames = [], text = '') {
        const el = document.createElement(tag);
        if (Array.isArray(classNames)) {
            el.classList.add(...classNames);
        } else if (classNames) {
            el.classList.add(classNames);
        }
        if (text) {
            el.textContent = text;
        }
        return el;
    }

    function showLoading(message = 'Загрузка...') {
        let overlay = document.querySelector('.app-loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'app-loading-overlay';
            overlay.innerHTML = `
                <div class="loader-content">
                    <div class="spinner"></div>
                    <div class="loader-text"></div>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        overlay.querySelector('.loader-text').textContent = message;
        overlay.classList.add('visible');
    }

    function hideLoading() {
        const overlay = document.querySelector('.app-loading-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
        }
    }

    async function pollJob(jobId, { intervalMs = 2000, timeoutMs = 600000 } = {}) {
        const started = Date.now();
        const noTimeout = timeoutMs === null || timeoutMs === undefined;
        let lastStatus = null;
        let consecutiveErrors = 0;
        const maxConsecutiveErrors = 5;
        
        while (noTimeout || Date.now() - started < timeoutMs) {
            try {
                const data = await authFetch(`/jobs/${jobId}`);
                consecutiveErrors = 0; // Сбрасываем счетчик ошибок при успешном запросе
                
                // Проверяем статус задачи
                if (data.status === 'completed') {
                    // Если задача завершена, но конспект еще не готов, проверяем конспект напрямую
                    if (data.conspect_id) {
                        try {
                            const conspect = await authFetch(`/conspects/${data.conspect_id}`);
                            if (conspect.status === 'ready' || conspect.status === 'failed') {
                                return data;
                            }
                            // Если конспект еще обрабатывается, продолжаем опрос
                        } catch (err) {
                            // Если конспект не найден, но задача завершена, возвращаем данные задачи
                            console.warn('Конспект не найден, но задача завершена:', err);
                            return data;
                        }
                    } else {
                        return data;
                    }
                }
                
                if (data.status === 'failed') {
                    throw new Error(data.error || 'Задача завершилась с ошибкой');
                }
                
                // Если статус не изменился, продолжаем опрос
                if (data.status === lastStatus) {
                    // Ничего не делаем, просто продолжаем
                }
                lastStatus = data.status;
                
                await new Promise((resolve) => setTimeout(resolve, intervalMs));
            } catch (err) {
                consecutiveErrors++;
                if (consecutiveErrors >= maxConsecutiveErrors) {
                    throw new Error(`Не удалось получить статус задачи после ${maxConsecutiveErrors} попыток: ${err.message}`);
                }
                // При ошибке ждем немного дольше перед повтором
                await new Promise((resolve) => setTimeout(resolve, intervalMs * 2));
            }
        }
        throw new Error('Превышено время ожидания. Проверь статус задачи в разделе конспектов чуть позже.');
    }

    async function uploadAudio(file) {
        await ensureAuth();
        const formData = new FormData();
        formData.append('file', file);
        const attempt = async (retry = false) => {
            const response = await fetch(`${API_BASE}/audio/upload`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${state.token}`,
                },
                body: formData,
            });
            if (response.status === 401 || response.status === 403) {
                if (retry) {
                    const text = await response.text();
                    throw new Error(text || 'Не удалось загрузить аудио');
                }
                clearAuthState();
                await ensureAuth();
                return attempt(true);
            }
            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || 'Не удалось загрузить аудио');
            }
            return response.json();
        };
        return attempt();
    }

    async function createConspectFromAudio(audioSourceId, title, options = {}) {
        const payload = {
            audio_source_id: audioSourceId,
            title: title || null,
        };
        if (Array.isArray(options.variants) && options.variants.length) {
            payload.variants = options.variants;
        }
        const job = await authFetch('/conspects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const finishedJob = await pollJob(job.id, { intervalMs: 3000, timeoutMs: 30 * 60 * 1000 });
        if (!finishedJob.conspect_id) {
            throw new Error('Не удалось получить идентификатор конспекта');
        }
        return authFetch(`/conspects/${finishedJob.conspect_id}`);
    }

    async function createConspectFromText(text, title, options = {}) {
        const payload = {
            initial_summary: text,
            title: title || null,
        };
        if (Array.isArray(options.variants) && options.variants.length) {
            payload.variants = options.variants;
        }
        const job = await authFetch('/conspects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const finishedJob = await pollJob(job.id, { intervalMs: 3000, timeoutMs: 15 * 60 * 1000 });
        if (!finishedJob.conspect_id) {
            throw new Error('Не удалось получить идентификатор конспекта');
        }
        return authFetch(`/conspects/${finishedJob.conspect_id}`);
    }

    async function createQuizFromConspect(conspectId, questionsCount = 5) {
        const job = await authFetch('/quizzes/from-conspect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                conspect_id: conspectId,
                questions_count: questionsCount
            }),
        });
        const finishedJob = await pollJob(job.id, { timeoutMs: 120000 });
        return finishedJob.quiz_id;
    }

    async function createManualQuiz(payload) {
        if (!payload || !Array.isArray(payload.questions) || !payload.questions.length) {
            throw new Error('Добавь хотя бы один вопрос');
        }
        return authFetch('/quizzes/manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async function deleteQuiz(quizId) {
        if (!quizId) {
            throw new Error('Не указан идентификатор теста');
        }
        await authFetch(`/quizzes/${quizId}`, {
            method: 'DELETE',
        });
    }

    async function updateProfile(payload) {
        const sanitized = {};
        ['display_name', 'gender', 'avatar_id', 'avatar_url', 'description'].forEach((key) => {
            if (payload[key] !== undefined) {
                sanitized[key] = payload[key];
            }
        });
        const user = await authFetch('/auth/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sanitized),
        });
        setUser(user);
        return user;
    }

    async function registerUser(payload) {
        // payload: { email, nickname, password, display_name, gender, avatar_id, avatar_url }
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const text = await response.text();
            let errorMessage = 'Не удалось зарегистрироваться';
            try {
                const errorData = JSON.parse(text);
                errorMessage = errorData.detail || errorMessage;
            } catch {
                errorMessage = text || errorMessage;
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        state.token = data.token.access_token;
        state.user = data.user;
        localStorage.setItem(TOKEN_KEY, state.token);
        setUser(state.user);
        return data.user;
    }

    async function loginUser(login, password) {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                login: login,
                password: password,
            }),
        });

        if (!response.ok) {
            const text = await response.text();
            let errorMessage = 'Неверный email/никнейм или пароль';
            try {
                const errorData = JSON.parse(text);
                errorMessage = errorData.detail || errorMessage;
            } catch {
                errorMessage = text || errorMessage;
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        state.token = data.token.access_token;
        state.user = data.user;
        localStorage.setItem(TOKEN_KEY, state.token);
        setUser(state.user);
        return data.user;
    }

    async function changePassword(oldPassword, newPassword, confirmPassword) {
        return authFetch('/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                old_password: oldPassword,
                new_password: newPassword,
                confirm_password: confirmPassword,
            }),
        });
    }

    async function generateConspectVariant(conspectId, variant) {
        if (!variant) {
            throw new Error('Не выбран тип варианта');
        }
        const job = await authFetch(`/conspects/${conspectId}/variants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ variant }),
        });
        await pollJob(job.id, { intervalMs: 3000, timeoutMs: 15 * 60 * 1000 });
        return authFetch(`/conspects/${conspectId}`);
    }

    function parseFilename(disposition) {
        if (!disposition) return null;
        const match = /filename\*?=(?:UTF-8'')?\"?([^\";]+)/i.exec(disposition);
        if (match && match[1]) {
            try {
                return decodeURIComponent(match[1]);
            } catch {
                return match[1];
            }
        }
        return null;
    }

    async function downloadAudioSource(audioId) {
        await ensureAuth();
        const response = await fetch(`${API_BASE}/audio/${audioId}/download`, {
            headers: {
                Authorization: `Bearer ${state.token}`,
            },
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Не удалось скачать файл');
        }
        const blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') || '';
        const filename = parseFilename(disposition) || `audio-${audioId}.m4a`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function notify(message, type = 'info') {
        const containerClass = 'app-toast-container';
        let container = document.querySelector(`.${containerClass}`);
        if (!container) {
            container = document.createElement('div');
            container.className = containerClass;
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = `app-toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('visible');
        }, 10);
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => {
                toast.remove();
                if (!container.children.length) {
                    container.remove();
                }
            }, 300);
        }, 4000);
    }

    async function getShareToken(type, id) {
        const endpoint = type === 'conspect' ? `/conspects/${id}/share-token` : `/quizzes/${id}/share-token`;
        const response = await authFetch(endpoint, {
            method: 'POST',
        });
        return response.share_token;
    }

    async function publishQuizToTournament(quizId) {
        return authFetch(`/quizzes/${quizId}/publish-tournament`, {
            method: 'POST',
        });
    }

    async function uploadAvatar(file) {
        await ensureAuth();
        const formData = new FormData();
        formData.append('file', file);
        const attempt = async (retry = false) => {
            const response = await fetch(`${API_BASE}/auth/upload-avatar`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${state.token}`,
                },
                body: formData,
            });
            if (response.status === 401 || response.status === 403) {
                if (retry) {
                    const text = await response.text();
                    throw new Error(text || 'Не удалось загрузить аватар');
                }
                clearAuthState();
                await ensureAuth();
                return attempt(true);
            }
            if (!response.ok) {
                // Обработка ошибки 413 (Request Entity Too Large) от nginx
                if (response.status === 413) {
                    const text = await response.text();
                    // Проверяем, является ли ответ HTML (от nginx) или JSON (от FastAPI)
                    if (text.includes('<html>') || text.includes('Request Entity Too Large')) {
                        throw new Error('Файл слишком большой для загрузки. Максимальный размер: 5 МБ. Если файл меньше 5 МБ, обратитесь к администратору - требуется увеличить client_max_body_size в конфигурации nginx.');
                    }
                    // Если это JSON ответ от FastAPI
                    try {
                        const errorData = JSON.parse(text);
                        throw new Error(errorData.detail || errorData.message || 'Файл слишком большой для загрузки. Максимальный размер: 5 МБ.');
                    } catch (e) {
                        throw new Error('Файл слишком большой для загрузки. Максимальный размер: 5 МБ.');
                    }
                }
                
                const text = await response.text();
                // Пытаемся распарсить JSON с описанием ошибки
                let errorMessage = 'Не удалось загрузить аватар';
                try {
                    const errorData = JSON.parse(text);
                    errorMessage = errorData.detail || errorData.message || errorMessage;
                } catch (e) {
                    // Если не удалось распарсить JSON (например, HTML от nginx)
                    // Проверяем, есть ли в тексте информация об ошибке
                    if (text.includes('413') || text.includes('Request Entity Too Large') || text.includes('too large')) {
                        errorMessage = 'Файл слишком большой для загрузки. Максимальный размер: 5 МБ. Если файл меньше 5 МБ, обратитесь к администратору - требуется настройка сервера.';
                    } else if (text && text.length < 500 && !text.includes('<html>')) {
                        // Если текст короткий и не HTML, возможно это просто сообщение об ошибке
                        errorMessage = text;
                    } else {
                        // Если текст длинный (например, HTML страница), используем стандартное сообщение
                        errorMessage = `Ошибка ${response.status}: Не удалось загрузить аватар`;
                    }
                }
                throw new Error(errorMessage);
            }
            const user = await response.json();
            setUser(user);
            return user;
        };
        return attempt();
    }

    async function getSharedConspect(shareToken) {
        // Публичный endpoint, не требует авторизации
        const response = await fetch(`${API_BASE}/conspects/share/${shareToken}`);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || response.statusText);
        }
        return response.json();
    }

    async function getSharedQuiz(shareToken) {
        // Публичный endpoint, не требует авторизации
        const response = await fetch(`${API_BASE}/quizzes/share/${shareToken}`);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || response.statusText);
        }
        return response.json();
    }

    async function saveSharedConspect(shareToken) {
        await ensureAuth();
        return authFetch(`/conspects/share/${shareToken}/save`, {
            method: 'POST',
        });
    }

    async function createTournamentLobby(quizId, maxParticipants = 8) {
        return authFetch('/tournament', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                quiz_id: quizId,
                max_participants: maxParticipants,
            }),
        });
    }

    async function joinTournamentLobby(inviteCode) {
        return authFetch('/tournament/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                invite_code: inviteCode,
            }),
        });
    }

    async function getTournamentLobby(lobbyId) {
        return authFetch(`/tournament/${lobbyId}`);
    }

    async function getTournamentLobbyByInviteCode(inviteCode) {
        // Публичный endpoint
        const response = await fetch(`${API_BASE}/tournament/invite/${inviteCode}`);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || response.statusText);
        }
        return response.json();
    }

    async function updateTournamentParticipantStatus(lobbyId, isReady) {
        return authFetch(`/tournament/${lobbyId}/participants/me`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                is_ready: isReady,
            }),
        });
    }

    async function startTournamentLobby(lobbyId) {
        return authFetch(`/tournament/${lobbyId}/start`, {
            method: 'POST',
        });
    }

    async function getMyMedals() {
        return authFetch('/tournament/medals/me');
    }

    async function listMyMedals(limit = 50, offset = 0) {
        return authFetch(`/tournament/medals/me/list?limit=${limit}&offset=${offset}`);
    }

    // Не вызываем ensureAuth сразу, чтобы не блокировать загрузку страницы
    // ensureAuth будет вызван только при вызове app.ready()
    let readyPromise = null;
    function getReadyPromise() {
        if (!readyPromise) {
            readyPromise = ensureAuth();
        }
        return readyPromise;
    }

    async function getProfile(userIdentifier) {
        // Публичный endpoint, не требует авторизации
        const response = await fetch(`${API_BASE}/profile/${encodeURIComponent(userIdentifier)}`);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || response.statusText);
        }
        return response.json();
    }

    async function followUser(userId) {
        await ensureAuth();
        return authFetch(`/profile/${userId}/follow`, {
            method: 'POST',
        });
    }

    async function unfollowUser(userId) {
        await ensureAuth();
        return authFetch(`/profile/${userId}/follow`, {
            method: 'DELETE',
        });
    }

    async function updateUserProfile(userId, payload) {
        await ensureAuth();
        return authFetch(`/profile/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    function shareProfile(userIdentifier) {
        // Формируем ссылку на профиль
        const profileUrl = `${window.location.origin}/front/html/profile.html?user=${encodeURIComponent(userIdentifier)}`;
        
        // Копируем в буфер обмена
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(profileUrl).then(() => {
                if (window.ConspectiumApp && window.ConspectiumApp.notify) {
                    window.ConspectiumApp.notify('Ссылка на профиль скопирована в буфер обмена', 'success');
                } else {
                    alert('Ссылка на профиль скопирована в буфер обмена');
                }
            }).catch(err => {
                console.error('Failed to copy to clipboard:', err);
                // Fallback: показываем ссылку в alert
                prompt('Скопируйте ссылку на профиль:', profileUrl);
            });
        } else {
            // Fallback для старых браузеров
            prompt('Скопируйте ссылку на профиль:', profileUrl);
        }
        
        return profileUrl;
    }

    window.ConspectiumApp = {
        ready: () => getReadyPromise(),
        authFetch,
        createElement,
        showLoading,
        hideLoading,
        uploadAudio,
        createConspectFromAudio,
        createConspectFromText,
        createQuizFromConspect,
        createManualQuiz,
        updateProfile,
        uploadAvatar,
        registerUser,
        loginUser,
        changePassword,
        deleteQuiz,
        generateConspectVariant,
        downloadAudioSource,
        getShareToken,
        publishQuizToTournament,
        getSharedConspect,
        getSharedQuiz,
        saveSharedConspect,
        createTournamentLobby,
        joinTournamentLobby,
        getTournamentLobby,
        getTournamentLobbyByInviteCode,
        updateTournamentParticipantStatus,
        startTournamentLobby,
        getMyMedals,
        listMyMedals,
        logout,
        notify,
        state,
        // Profile functions
        getProfile,
        followUser,
        unfollowUser,
        updateUserProfile,
        shareProfile,
    };
})();
