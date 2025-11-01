(() => {
    let activeItem = null;
    let selectedConspectId = null;

    const app = () => window.ConspectiumApp;

    document.addEventListener('DOMContentLoaded', () => {
        if (!document.body.classList.contains('page-choose-test')) {
            return;
        }

        const container = document.getElementById('chooseConspectList');
        if (!container) return;

        container.addEventListener('click', (event) => {
            const item = event.target.closest('.conspect-item');
            if (!item) return;
            event.stopPropagation();
            toggleSelection(item);
        });

        document.addEventListener('click', () => {
            clearSelection();
        });

        container.addEventListener('scroll', () => clearSelection());

        const params = new URLSearchParams(window.location.search);
        const preselectId = params.get('conspectId');
        if (preselectId) {
            selectedConspectId = parseInt(preselectId, 10);
        }
    });

    document.addEventListener('conspects:selectable-updated', (event) => {
        if (!document.body.classList.contains('page-choose-test')) {
            return;
        }

        const { items } = event.detail || {};
        if (!items || !items.length) return;

        const params = new URLSearchParams(window.location.search);
        const preselectId = params.get('conspectId');
        if (preselectId) {
            const container = document.getElementById('chooseConspectList');
            const target = container?.querySelector(`.conspect-item[data-conspect-id="${preselectId}"]`);
            if (target) {
                toggleSelection(target, { skipToggle: true });
                showButtons(target);
                selectedConspectId = parseInt(preselectId, 10);
            }
        }
    });

    function toggleSelection(item, options = {}) {
        if (activeItem === item && !options.skipToggle) {
            clearSelection();
            return;
        }

        clearSelection();
        activeItem = item;
        item.classList.add('active');
        selectedConspectId = parseInt(item.dataset.conspectId || '0', 10) || null;
        showButtons(item);
    }

    function showButtons(item) {
        if (!item) return;

        const existing = item.querySelector('.item-buttons');
        if (existing) {
            existing.remove();
        }

        const buttons = document.createElement('div');
        buttons.className = 'item-buttons';
        buttons.innerHTML = `
            <button class="action-btn open-conspect-btn">Открыть конспект</button>
            <button class="action-btn create-test-btn">Создать тест</button>
        `;

        item.style.position = 'relative';
        item.appendChild(buttons);

        const openBtn = buttons.querySelector('.open-conspect-btn');
        const createBtn = buttons.querySelector('.create-test-btn');

        if (openBtn) {
            openBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                if (!selectedConspectId) return;
                window.location.href = `/front/html/conspect_list.html#conspect-${selectedConspectId}`;
            });
        }

        if (createBtn) {
            createBtn.addEventListener('click', async (event) => {
                event.stopPropagation();
                if (!selectedConspectId) return;
                await createQuiz(selectedConspectId);
            });
        }

        requestAnimationFrame(() => {
            buttons.style.opacity = '1';
        });
    }

    function clearSelection() {
        if (activeItem) {
            activeItem.classList.remove('active');
            const buttons = activeItem.querySelector('.item-buttons');
            if (buttons) {
                buttons.remove();
            }
        }
        activeItem = null;
    }

    async function createQuiz(conspectId) {
        const appInstance = app();
        try {
            appInstance.showLoading('Нейросеть создаёт тест…');
            const quizId = await appInstance.createQuizFromConspect(conspectId);
            appInstance.hideLoading();
            appInstance.notify('Тест готов!', 'success');
            window.location.href = `test.html?quizId=${quizId}`;
        } catch (err) {
            console.error(err);
            appInstance.hideLoading();
            appInstance.notify(err.message || 'Не удалось создать тест', 'error');
        }
    }
})();
