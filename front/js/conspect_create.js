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
                
                // Ждем инициализации слайдера, если он еще не готов
                const waitForSlider = () => {
                    return new Promise((resolve) => {
                        if (window.testSettingsModal) {
                            resolve(window.testSettingsModal);
                        } else {
                            // Ждем до 2 секунд
                            let attempts = 0;
                            const checkInterval = setInterval(() => {
                                attempts++;
                                if (window.testSettingsModal) {
                                    clearInterval(checkInterval);
                                    resolve(window.testSettingsModal);
                                } else if (attempts > 40) { // 2 секунды (40 * 50ms)
                                    clearInterval(checkInterval);
                                    resolve(null);
                                }
                            }, 50);
                        }
                    });
                };
                
                const modal = await waitForSlider();
                
                if (modal) {
                    // Показываем слайдер для выбора количества вопросов
                    modal.setOnCreateCallback(async (testData) => {
                        const questionsCount = testData.questionsCount || 5;
                        try {
                            app.showLoading('Создаём тест...');
                            const quizId = await app.createQuizFromConspect(Number(latestConspectId), questionsCount);
                            app.hideLoading();
                            app.notify('Тест готов!', 'success');
                            window.location.href = `test.html?quizId=${quizId}`;
                        } catch (err) {
                            console.error(err);
                            app.hideLoading();
                            app.notify(err.message || 'Не удалось создать тест', 'error');
                        }
                    });
                    modal.show();
                } else {
                    // Если слайдер не загружен, используем значение по умолчанию
                    try {
                        app.showLoading('Создаём тест...');
                        const quizId = await app.createQuizFromConspect(Number(latestConspectId), 5);
                        app.hideLoading();
                        app.notify('Тест готов!', 'success');
                        window.location.href = `test.html?quizId=${quizId}`;
                    } catch (err) {
                        console.error(err);
                        app.hideLoading();
                        app.notify(err.message || 'Не удалось создать тест', 'error');
                    }
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

    const shareBtn = document.getElementById('shareConspectBtn');
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            if (!latestConspectId) {
                app.notify('Сначала создай конспект', 'info');
                return;
            }
            try {
                app.showLoading('Генерируем ссылку...');
                const shareToken = await app.getShareToken('conspect', latestConspectId);
                const shareUrl = `${window.location.origin}/front/html/conspect_shared.html?token=${shareToken}`;
                await navigator.clipboard.writeText(shareUrl);
                app.hideLoading();
                app.notify('Ссылка скопирована в буфер обмена!', 'success');
            } catch (err) {
                console.error(err);
                app.hideLoading();
                app.notify(err.message || 'Не удалось создать ссылку', 'error');
            }
        });
    }

    const recordBtn = document.getElementById('recordAudioButton');
    if (recordBtn && window.AudioRecorder) {
        const recorder = new window.AudioRecorder();
        let isRecording = false;

        if (!recorder.isSupported()) {
            recordBtn.style.display = 'none';
        } else {
            recordBtn.addEventListener('click', async () => {
                if (!isRecording) {
                    try {
                        await recorder.startRecording();
                        isRecording = true;
                        recordBtn.innerHTML = '<i class="fas fa-stop"></i><span>Остановить запись</span>';
                        recordBtn.classList.add('recording');
                        app.notify('Запись начата', 'info');
                    } catch (err) {
                        console.error(err);
                        app.notify(err.message || 'Не удалось начать запись', 'error');
                    }
                } else {
                    try {
                        app.showLoading('Останавливаем запись...');
                        const audioBlob = await recorder.stopRecording();
                        isRecording = false;
                        recordBtn.innerHTML = '<i class="fas fa-microphone"></i><span>Записать аудио</span>';
                        recordBtn.classList.remove('recording');
                        
                        // Конвертируем blob в File
                        const fileName = `recording_${Date.now()}.webm`;
                        const audioFile = new File([audioBlob], fileName, { type: 'audio/webm' });
                        
                        // Используем существующую логику загрузки
                        const variant = await showVariantChoiceModal({ title: 'Запись с микрофона' });
                        if (!variant) {
                            app.hideLoading();
                            return;
                        }
                        
                        app.hideLoading();
                        showConspectLoadingAnimation('Загружаем аудио...');
                        
                        const audio = await app.uploadAudio(audioFile);
                        hideAudioUploadLoader();
                        showConspectLoadingAnimation('Создаём конспект...');
                        
                        const conspect = await app.createConspectFromAudio(audio.id, fileName, {
                            variants: [variant],
                        });
                        
                        hideAudioUploadLoader();
                        app.notify('Конспект готов!', 'success');
                        await loadLatestConspect(app);
                        showConspectModal(conspect, { initialVariant: variant });
                    } catch (err) {
                        console.error(err);
                        isRecording = false;
                        recordBtn.innerHTML = '<i class="fas fa-microphone"></i><span>Записать аудио</span>';
                        recordBtn.classList.remove('recording');
                        app.hideLoading();
                        app.notify(err.message || 'Не удалось обработать запись', 'error');
                    }
                }
            });
        }
    }

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