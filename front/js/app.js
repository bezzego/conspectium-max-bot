(() => {
    const API_BASE = '/api';
    const TOKEN_KEY = 'conspectium_token';
    const USER_KEY = 'conspectium_user';

    const state = {
        token: localStorage.getItem(TOKEN_KEY) || null,
        user: null,
    };

    function clearAuthState() {
        state.token = null;
        state.user = null;
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }

    if (localStorage.getItem(USER_KEY)) {
        try {
            state.user = JSON.parse(localStorage.getItem(USER_KEY));
        } catch (err) {
            console.warn('Failed to parse cached user', err);
            localStorage.removeItem(USER_KEY);
        }
    }

    async function devLogin() {
        const response = await fetch(`${API_BASE}/auth/dev-login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username: 'Demo User' }),
        });

        if (!response.ok) {
            throw new Error('Dev-login failed');
        }

        const data = await response.json();
        state.token = data.token.access_token;
        state.user = data.user;
        localStorage.setItem(TOKEN_KEY, state.token);
        localStorage.setItem(USER_KEY, JSON.stringify(state.user));
    }

    async function fetchCurrentUser() {
        const response = await authFetch('/auth/me', { _internalCall: true });
        if (response) {
            state.user = response;
            localStorage.setItem(USER_KEY, JSON.stringify(response));
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

    async function createConspectFromAudio(audioSourceId, title) {
        const payload = {
            audio_source_id: audioSourceId,
            title: title || null,
        };
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

    async function createConspectFromText(text, title) {
        const payload = {
            initial_summary: text,
            title: title || null,
        };
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
        notify,
        state,
    };
})();
