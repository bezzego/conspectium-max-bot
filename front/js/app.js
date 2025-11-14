// Функция copyToClipboard теперь определена в copy_clipboard.js
// Если она еще не определена, создаем простую заглушку
if (typeof window.copyToClipboard === 'undefined') {
    window.copyToClipboard = async function(text) {
        console.warn('copyToClipboard not initialized, using fallback');
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (err) {
            console.error('Copy failed:', err);
        }
        return false;
    };
}

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

    
    
    async function logout() {
        try {
            clearAuthState();
            // Очищаем все данные
            localStorage.removeItem('conspectium_token');
            localStorage.removeItem('conspectium_user');
            localStorage.removeItem('userData');
            // Перенаправляем на страницу регистрации
            window.location.href = '/front/html/welcome_modal.html';
        } catch (err) {
            console.error('Ошибка при выходе:', err);
            // В любом случае очищаем и перенаправляем
            clearAuthState();
            localStorage.removeItem('conspectium_token');
            localStorage.removeItem('conspectium_user');
            localStorage.removeItem('userData');
            window.location.href = '/front/html/welcome_modal.html';
        }
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

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showLoading(message = 'Загрузка...') {
        if (window.conspectLoadingAnimation) return;

        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(70, 70, 70, 0.85);
            backdrop-filter: blur(20px);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            overflow: hidden !important;
        `;
        
        loadingOverlay.innerHTML = `
            <div class="loading-content">
                <div class="loader">
                    <div style="--i: 1"></div>
                    <div style="--i: 2"></div>
                    <div style="--i: 3"></div>
                    <div style="--i: 4"></div>
                </div>
                
                <div class="loading-text">${escapeHtml(message)}</div>
                
                <div class="noise"></div>
            </div>
            <div class="hackflow-signature" style="opacity: 0;">by HackFlow</div>
            
            <style>
                .loading-content {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    background: linear-gradient(135deg, 
                        rgba(100, 100, 100, 0.9) 0%, 
                        rgba(80, 80, 80, 0.95) 50%, 
                        rgba(100, 100, 100, 0.9) 100%);
                    backdrop-filter: blur(15px);
                    border: 1px solid rgba(255, 255, 255, 0.25);
                    border-radius: 25px;
                    padding: 50px 30px;
                    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3),
                                inset 0 1px 0 rgba(255, 255, 255, 0.15),
                                inset 0 -1px 0 rgba(0, 0, 0, 0.2);
                    width: 320px;
                    height: 320px;
                    margin-bottom: 60px;
                    overflow: hidden;
                }

                .loading-content::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(135deg, 
                        transparent 0%, 
                        rgba(255, 255, 255, 0.12) 50%,
                        transparent 100%);
                    opacity: 0.5;
                    pointer-events: none;
                    border-radius: 25px;
                }

                .loader {
                  position: relative;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  margin-bottom: 20px;
                  margin-top: 10px;
                }

                .loader::before {
                  content: "";
                  backdrop-filter: blur(8px);
                  position: absolute;
                  width: 140px;
                  height: 55px;
                  z-index: 20;
                  border-radius: 0 0 10px 10px;
                  border: 1px solid rgba(255, 255, 255, 0.3);
                  border-top: none;
                  box-shadow: 0 15px 25px rgba(0, 0, 0, 0.25);
                  animation: anim2 2s infinite;
                }

                .loader div {
                  background: rgb(240, 240, 240);
                  border-radius: 50%;
                  width: 25px;
                  height: 25px;
                  z-index: -1;
                  animation: anim 2s infinite linear;
                  animation-delay: calc(-0.3s * var(--i));
                  transform: translateY(5px);
                  margin: 0.2em;
                  box-shadow: 0 0 15px rgba(255, 255, 255, 0.5);
                }

                .loading-text {
                    margin-top: 15px;
                    color: white;
                    font-size: 16px;
                    font-family: 'Manrope', sans-serif;
                    text-align: center;
                    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
                    font-weight: 600;
                    position: relative;
                    z-index: 2;
                }

                .hackflow-signature {
                    position: fixed;
                    bottom: 15px;
                    left: 50%;
                    transform: translateX(-50%);
                    color: rgba(255, 255, 255, 0.9);
                    font-family: 'Manrope', Arial, sans-serif;
                    font-size: 14px;
                    text-align: center;
                    user-select: none;
                    z-index: 10001;
                    opacity: 0;
                    transition: opacity 0.5s ease;
                    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
                }

                @keyframes anim {
                  0%,
                  100% {
                    transform: translateY(5px);
                  }
                  50% {
                    transform: translateY(-65px);
                  }
                }

                @keyframes anim2 {
                  0%,
                  100% {
                    transform: rotate(-10deg);
                  }
                  50% {
                    transform: rotate(10deg);
                  }
                }

                .noise {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-image: url(data:image/png;base64,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);
                    opacity: 0.02;
                    pointer-events: none;
                    border-radius: 25px;
                }

                /* Адаптивность */
                @media (max-width: 768px) {
                    .loading-content {
                        width: 280px;
                        height: 280px;
                        padding: 30px 25px;
                        margin-bottom: 50px;
                    }
                    
                    .loader {
                        margin-top: 8px;
                    }
                    
                    .loader::before {
                        width: 120px;
                        height: 45px;
                    }
                    
                    .loader div {
                        width: 20px;
                        height: 20px;
                    }
                    
                    .loading-text {
                        font-size: 15px;
                        margin-top: 12px;
                    }
                    
                    .hackflow-signature {
                        font-size: 13px;
                    }
                    
                    @keyframes anim {
                        0%,
                        100% {
                            transform: translateY(5px);
                        }
                        50% {
                            transform: translateY(-55px);
                        }
                    }
                }

                @media (max-width: 480px) {
                    .loading-content {
                        width: 250px;
                        height: 250px;
                        padding: 45px 20px;
                        margin-bottom: 45px;
                    }
                    
                    .loader {
                        margin-top: 5px;
                    }
                    
                    .loader::before {
                        width: 100px;
                        height: 40px;
                    }
                    
                    .loader div {
                        width: 18px;
                        height: 18px;
                        margin: 0.15em;
                    }
                    
                    .loading-text {
                        font-size: 14px;
                        margin-top: 10px;
                    }
                    
                    .hackflow-signature {
                        font-size: 12px;
                    }
                    
                    @keyframes anim {
                        0%,
                        100% {
                            transform: translateY(5px);
                        }
                        50% {
                            transform: translateY(-45px);
                        }
                    }
                }
            </style>
        `;

        // Блокируем скролл
        const scrollY = window.scrollY;
        document.body.style.cssText = `
            overflow: hidden !important;
            position: fixed;
            top: -${scrollY}px;
            left: 0;
            right: 0;
            height: 100vh;
        `;
        document.documentElement.style.overflow = 'hidden !important';
        
        document.body.appendChild(loadingOverlay);

        // Сохраняем позицию скролла
        window._scrollY = scrollY;

        requestAnimationFrame(() => {
            loadingOverlay.style.opacity = '1';
        });

        // Появление подписи через 0.5 секунды
        setTimeout(() => {
            const signature = loadingOverlay.querySelector('.hackflow-signature');
            if (signature) {
                signature.style.opacity = '1';
                signature.style.transition = 'opacity 0.5s ease';
            }
        }, 500);

        // Исчезновение подписи за 1 секунду до конца (через 5 секунд от начала)
        setTimeout(() => {
            const signature = loadingOverlay.querySelector('.hackflow-signature');
            if (signature) {
                signature.style.opacity = '0';
                signature.style.transition = 'opacity 0.5s ease';
            }
        }, 5000);
        
        window.conspectLoadingAnimation = {
            overlay: loadingOverlay
        };
    }

    function hideLoading() {
        // Восстанавливаем скролл
        if (window._scrollY !== undefined) {
            document.body.style.cssText = '';
            document.documentElement.style.overflow = '';
            window.scrollTo(0, window._scrollY);
            delete window._scrollY;
        }

        // Удаляем оверлей
        if (window.conspectLoadingAnimation) {
            const { overlay } = window.conspectLoadingAnimation;
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
            delete window.conspectLoadingAnimation;
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
            let errorMessage = 'Не удалось загрузить конспект';
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorData.message || errorMessage;
            } catch (e) {
                // Если не удалось распарсить JSON, используем текст
                const text = await response.text();
                try {
                    const errorData = JSON.parse(text);
                    errorMessage = errorData.detail || errorData.message || errorMessage;
                } catch (e2) {
                    errorMessage = text || response.statusText || errorMessage;
                }
            }
            throw new Error(errorMessage);
        }
        return response.json();
    }

    async function getSharedQuiz(shareToken) {
        // Публичный endpoint, не требует авторизации
        const response = await fetch(`${API_BASE}/quizzes/share/${shareToken}`);
        if (!response.ok) {
            let errorMessage = 'Не удалось загрузить тест';
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorData.message || errorMessage;
            } catch (e) {
                // Если не удалось распарсить JSON, используем текст
                const text = await response.text();
                try {
                    const errorData = JSON.parse(text);
                    errorMessage = errorData.detail || errorData.message || errorMessage;
                } catch (e2) {
                    errorMessage = text || response.statusText || errorMessage;
                }
            }
            throw new Error(errorMessage);
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
        // Публичный endpoint, но передаем токен если есть, чтобы сервер мог определить is_own_profile
        const headers = {};
        if (state.token) {
            headers['Authorization'] = `Bearer ${state.token}`;
        }
        
        const response = await fetch(`${API_BASE}/profile/${encodeURIComponent(userIdentifier)}`, {
            headers: headers
        });
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

    async function shareProfile(userIdentifier) {
        // Формируем ссылку на профиль
        const profileUrl = `${window.location.origin}/front/html/profile.html?user=${encodeURIComponent(userIdentifier)}`;
        
        // Копируем в буфер обмена (используем глобальную функцию)
        const success = await window.copyToClipboard(profileUrl);
        
        if (success) {
            if (window.ConspectiumApp && window.ConspectiumApp.notify) {
                window.ConspectiumApp.notify('Ссылка на профиль скопирована', 'success');
            } else {
                alert('Ссылка на профиль скопирована');
            }
        } else {
            // Если все методы не сработали, показываем ссылку для ручного копирования
            prompt('Скопируйте ссылку на профиль:', profileUrl);
        }
        
        return profileUrl;
    }

        async function uploadBanner(file) {
        await ensureAuth();
        const formData = new FormData();
        formData.append('file', file);
        
        console.log('Uploading banner...', file);
        
        const attempt = async (retry = false) => {
            const response = await fetch(`${API_BASE}/auth/upload-banner`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${state.token}`,
                },
                body: formData,
            });
            
            if (response.status === 401 || response.status === 403) {
                if (retry) {
                    const text = await response.text();
                    throw new Error(text || 'Не удалось загрузить баннер');
                }
                clearAuthState();
                await ensureAuth();
                return attempt(true);
            }
            
            if (!response.ok) {
                // Обработка ошибки 413 (Request Entity Too Large)
                if (response.status === 413) {
                    const text = await response.text();
                    if (text.includes('<html>') || text.includes('Request Entity Too Large')) {
                        throw new Error('Файл слишком большой для загрузки. Максимальный размер: 10 МБ. Если файл меньше 10 МБ, обратитесь к администратору.');
                    }
                    try {
                        const errorData = JSON.parse(text);
                        throw new Error(errorData.detail || errorData.message || 'Файл слишком большой для загрузки. Максимальный размер: 10 МБ.');
                    } catch (e) {
                        throw new Error('Файл слишком большой для загрузки. Максимальный размер: 10 МБ.');
                    }
                }
                
                const text = await response.text();
                let errorMessage = 'Не удалось загрузить баннер';
                try {
                    const errorData = JSON.parse(text);
                    errorMessage = errorData.detail || errorData.message || errorMessage;
                } catch (e) {
                    if (text.includes('413') || text.includes('Request Entity Too Large') || text.includes('too large')) {
                        errorMessage = 'Файл слишком большой для загрузки. Максимальный размер: 10 МБ.';
                    } else if (text && text.length < 500 && !text.includes('<html>')) {
                        errorMessage = text;
                    } else {
                        errorMessage = `Ошибка ${response.status}: Не удалось загрузить баннер`;
                    }
                }
                throw new Error(errorMessage);
            }
            
            const result = await response.json();
            // Обновляем данные пользователя
            if (result && state.user) {
                state.user.banner_url = result.banner_url;
                setUser(state.user);
            }
            return result;
        };
        
        return attempt();
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
        uploadBanner, // ← ДОБАВЬТЕ ЭТУ СТРОКУ
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
        deleteAccount,
        notify,
        state,
        // Profile functions
        getProfile,
        followUser,
        // Utility functions - используем глобальную функцию window.copyToClipboard
        copyToClipboard: window.copyToClipboard,
        unfollowUser,
        updateUserProfile,
        shareProfile,
 
    };

        async function uploadBanner(file) {
        await ensureAuth();
        const formData = new FormData();
        formData.append('file', file);
        
        console.log('Uploading banner...', file);
        
        const attempt = async (retry = false) => {
            const response = await fetch(`${API_BASE}/auth/upload-banner`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${state.token}`,
                },
                body: formData,
            });
            
            if (response.status === 401 || response.status === 403) {
                if (retry) {
                    const text = await response.text();
                    throw new Error(text || 'Не удалось загрузить баннер');
                }
                clearAuthState();
                await ensureAuth();
                return attempt(true);
            }
            
            if (!response.ok) {
                // Обработка ошибки 413 (Request Entity Too Large)
                if (response.status === 413) {
                    const text = await response.text();
                    if (text.includes('<html>') || text.includes('Request Entity Too Large')) {
                        throw new Error('Файл слишком большой для загрузки. Максимальный размер: 10 МБ. Если файл меньше 10 МБ, обратитесь к администратору.');
                    }
                    try {
                        const errorData = JSON.parse(text);
                        throw new Error(errorData.detail || errorData.message || 'Файл слишком большой для загрузки. Максимальный размер: 10 МБ.');
                    } catch (e) {
                        throw new Error('Файл слишком большой для загрузки. Максимальный размер: 10 МБ.');
                    }
                }
                
                const text = await response.text();
                let errorMessage = 'Не удалось загрузить баннер';
                try {
                    const errorData = JSON.parse(text);
                    errorMessage = errorData.detail || errorData.message || errorMessage;
                } catch (e) {
                    if (text.includes('413') || text.includes('Request Entity Too Large') || text.includes('too large')) {
                        errorMessage = 'Файл слишком большой для загрузки. Максимальный размер: 10 МБ.';
                    } else if (text && text.length < 500 && !text.includes('<html>')) {
                        errorMessage = text;
                    } else {
                        errorMessage = `Ошибка ${response.status}: Не удалось загрузить баннер`;
                    }
                }
                throw new Error(errorMessage);
            }
            
            const result = await response.json();
            // Обновляем данные пользователя
            if (result && state.user) {
                state.user.banner_url = result.banner_url;
                setUser(state.user);
            }
            return result;
        };
        
        return attempt();
    }

        async function deleteAccount() {
        await ensureAuth();
        
        const attempt = async (retry = false) => {
            const response = await fetch(`${API_BASE}/auth/me`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${state.token}`,
                    'Content-Type': 'application/json',
                },
            });
            
            if (response.status === 401 || response.status === 403) {
                if (retry) {
                    const text = await response.text();
                    throw new Error(text || 'Не удалось удалить аккаунт');
                }
                clearAuthState();
                await ensureAuth();
                return attempt(true);
            }
            
            if (!response.ok && response.status !== 204) {
                const text = await response.text();
                let errorMessage = 'Не удалось удалить аккаунт';
                try {
                    const errorData = JSON.parse(text);
                    errorMessage = errorData.detail || errorData.message || errorMessage;
                } catch (e) {
                    if (text && text.length < 500 && !text.includes('<html>')) {
                        errorMessage = text;
                    } else {
                        errorMessage = `Ошибка ${response.status}: Не удалось удалить аккаунт`;
                    }
                }
                throw new Error(errorMessage);
            }
            
            // Очищаем все данные и перенаправляем на страницу регистрации
            clearAuthState();
            localStorage.removeItem('conspectium_token');
            localStorage.removeItem('conspectium_user');
            localStorage.removeItem('userData');
            window.location.href = '/front/html/welcome_modal.html';
        };
        
        return attempt();
    }

})();

