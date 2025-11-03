(() => {
    let latestConspectId = null;

    document.addEventListener('DOMContentLoaded', async () => {
        if (!document.body.classList.contains('page-conspect-create')) {
            return;
        }

        const app = window.ConspectiumApp;
        if (!app) return;

        try {
            await app.ready();
            await loadLatestConspect(app);
        } catch (err) {
            console.error(err);
        }

        const createQuizBtn = document.getElementById('createQuizFromLatest');
        if (createQuizBtn) {
            createQuizBtn.addEventListener('click', async () => {
                if (!latestConspectId) {
                    app.notify('Сначала создай конспект', 'info');
                    return;
                }
                try {
                    app.showLoading('Создаём тест...');
                    const quizId = await app.createQuizFromConspect(Number(latestConspectId));
                    app.hideLoading();
                    app.notify('Тест готов!', 'success');
                    window.location.href = `test.html?quizId=${quizId}`;
                } catch (err) {
                    console.error(err);
                    app.hideLoading();
                    app.notify(err.message || 'Не удалось создать тест', 'error');
                }
            });
        }
    });

    document.addEventListener('conspect:details', (event) => {
        const conspect = event.detail?.conspect;
        if (!conspect) {
            return;
        }
        latestConspectId = conspect.id;
    });

    async function loadLatestConspect(app) {
        try {
            const data = await app.authFetch('/conspects');
            if (!data.items.length) {
                return;
            }
            const latest = data.items[0];
            latestConspectId = latest.id;
            document.dispatchEvent(new CustomEvent('conspect:load', { detail: { conspectId: latest.id } }));
        } catch (err) {
            console.error(err);
        }
    }
})();