(() => {
    const API_BASE = '/api';
    const TOKEN_KEY = 'conspectium_token';
    const USER_KEY = 'conspectium_user';
    const DEV_PROFILE_KEY = 'conspectium_dev_profile';
    const DEV_PROFILE_IDS_KEY = 'conspectium_dev_ids';

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
        setUser(null);
        localStorage.removeItem(TOKEN_KEY);
    }

    if (localStorage.getItem(USER_KEY)) {
        try {
            state.user = JSON.parse(localStorage.getItem(USER_KEY));
        } catch (err) {
            console.warn('Failed to parse cached user', err);
            localStorage.removeItem(USER_KEY);
        }
    }

    function allocateDevTelegramId() {
        let usedIds = [];
        const raw = localStorage.getItem(DEV_PROFILE_IDS_KEY);
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    usedIds = parsed.filter((value) => Number.isInteger(value));
                }
            } catch (err) {
                console.warn('Failed to parse dev id pool', err);
            }
        }
        const usedSet = new Set(usedIds);

        let candidate = null;
        for (let attempt = 0; attempt < 50; attempt += 1) {
            const randomId = Math.floor(1000000 + Math.random() * 9000000);
            if (!usedSet.has(randomId)) {
                candidate = randomId;
                break;
            }
        }

        if (candidate === null) {
            candidate = Math.floor(1000000 + Math.random() * 9000000);
            usedIds = [];
        }

        usedIds.push(candidate);
        try {
            localStorage.setItem(DEV_PROFILE_IDS_KEY, JSON.stringify(usedIds));
        } catch (err) {
            console.warn('Failed to persist dev id pool', err);
        }

        return candidate;
    }

    function getDevProfile() {
        const cached = localStorage.getItem(DEV_PROFILE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed?.username && parsed?.telegram_id) {
                    return parsed;
                }
            } catch (err) {
                console.warn('Failed to parse dev profile', err);
                localStorage.removeItem(DEV_PROFILE_KEY);
            }
        }

        const randomSuffix = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2))
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(-6)
            .toUpperCase();
        const profile = {
            username: `Demo User ${randomSuffix}`,
            telegram_id: allocateDevTelegramId(),
        };
        localStorage.setItem(DEV_PROFILE_KEY, JSON.stringify(profile));
        return profile;
    }

    async function devLogin() {
        const profile = getDevProfile();
        const response = await fetch(`${API_BASE}/auth/dev-login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(profile),
        });

        if (!response.ok) {
            throw new Error('Dev-login failed');
        }

        const data = await response.json();
        state.token = data.token.access_token;
        state.user = data.user;
        localStorage.setItem(TOKEN_KEY, state.token);
        setUser(state.user);
    }

    async function fetchCurrentUser() {
        const response = await authFetch('/auth/me', { _internalCall: true });
        if (response) {
            setUser(response);
        }
    }

    async function ensureAuth() {
        if (!state.token) {
            await devLogin();
        }

        if (!state.user) {
            try {
                await fetchCurrentUser();
            } catch (err) {
                console.error('Failed to fetch current user, retrying dev login', err);
                clearAuthState();
                await devLogin();
            }
        }

        return state;
    }

    async function authFetch(path, options = {}) {
        const { _internalCall, ...requestOptions } = options;
        await ensureAuth();

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
        while (noTimeout || Date.now() - started < timeoutMs) {
            const data = await authFetch(`/jobs/${jobId}`);
            if (data.status === 'completed') {
                return data;
            }
            if (data.status === 'failed') {
                throw new Error(data.error || 'Задача завершилась с ошибкой');
            }
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
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

    async function createQuizFromConspect(conspectId) {
        const job = await authFetch('/quizzes/from-conspect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conspect_id: conspectId }),
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
        ['display_name', 'gender', 'avatar_id', 'avatar_url'].forEach((key) => {
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

    const readyPromise = ensureAuth();

    window.ConspectiumApp = {
        ready: () => readyPromise,
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
        deleteQuiz,
        generateConspectVariant,
        downloadAudioSource,
        notify,
        state,
    };
})();