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
            const app = window.ConspectiumApp;
            if (!app) {
                console.error('ConspectiumApp не загружен');
                return;
            }
            
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

    // Инициализация кнопки записи аудио
    function initAudioRecorder() {
        const recordBtn = document.getElementById('recordAudioButton');
        if (!recordBtn) {
            console.warn('Кнопка записи аудио не найдена');
            return;
        }

        // Получаем app из window
        const app = window.ConspectiumApp;
        if (!app) {
            console.warn('ConspectiumApp не загружен');
            return;
        }

        // Ждем загрузки AudioRecorder
        const waitForAudioRecorder = () => {
            return new Promise((resolve) => {
                if (window.AudioRecorder) {
                    resolve(window.AudioRecorder);
                } else {
                    let attempts = 0;
                    const checkInterval = setInterval(() => {
                        attempts++;
                        if (window.AudioRecorder) {
                            clearInterval(checkInterval);
                            resolve(window.AudioRecorder);
                        } else if (attempts > 100) { // 5 секунд (100 * 50ms)
                            clearInterval(checkInterval);
                            resolve(null);
                        }
                    }, 50);
                }
            });
        };

        waitForAudioRecorder().then(async (AudioRecorderClass) => {
            if (!AudioRecorderClass) {
                console.warn('AudioRecorder не загружен');
                recordBtn.style.display = 'none';
                return;
            }

            // Ждем готовности app
            try {
                await app.ready();
            } catch (err) {
                console.error('Ошибка при инициализации app:', err);
            }

            const recorder = new AudioRecorderClass();
            let isRecording = false;

            if (!recorder.isSupported()) {
                console.warn('Запись аудио не поддерживается в этом браузере');
                recordBtn.style.display = 'none';
                return;
            }

            recordBtn.addEventListener('click', async () => {
                if (!isRecording) {
                    try {
                        await recorder.startRecording();
                        isRecording = true;
                        recordBtn.innerHTML = '<i class="fas fa-stop"></i><span>Остановить запись</span>';
                        recordBtn.classList.add('recording');
                        app.notify('Запись начата', 'info');
                    } catch (err) {
                        console.error('Ошибка при начале записи:', err);
                        app.notify(err.message || 'Не удалось начать запись', 'error');
                    }
                } else {
                    try {
                        app.showLoading('Останавливаем запись...');
                        const audioBlob = await recorder.stopRecording();
                        isRecording = false;
                        recordBtn.innerHTML = '<i class="fas fa-microphone"></i><span>Записать аудио</span>';
                        recordBtn.classList.remove('recording');
                        
                        // Конвертируем blob в File с правильным расширением
                        const blobType = audioBlob.type || 'audio/webm';
                        let extension = 'webm';
                        if (blobType.includes('mp4') || blobType.includes('m4a')) {
                            extension = 'm4a';
                        } else if (blobType.includes('ogg')) {
                            extension = 'ogg';
                        } else if (blobType.includes('wav')) {
                            extension = 'wav';
                        }
                        const fileName = `recording_${Date.now()}.${extension}`;
                        const audioFile = new File([audioBlob], fileName, { type: blobType });
                        
                        app.hideLoading();
                        
                        // Используем существующую логику загрузки
                        if (typeof showVariantChoiceModal === 'function') {
                            const variant = await showVariantChoiceModal({ title: 'Запись с микрофона' });
                            if (!variant) {
                                return;
                            }
                            
                            if (typeof showConspectLoadingAnimation === 'function') {
                                showConspectLoadingAnimation('Загружаем аудио...');
                            }
                            
                            const audio = await app.uploadAudio(audioFile);
                            
                            if (typeof hideAudioUploadLoader === 'function') {
                                hideAudioUploadLoader();
                            }
                            
                            if (typeof showConspectLoadingAnimation === 'function') {
                                showConspectLoadingAnimation('Создаём конспект...');
                            }
                            
                            const conspect = await app.createConspectFromAudio(audio.id, fileName, {
                                variants: [variant],
                            });
                            
                            if (typeof hideAudioUploadLoader === 'function') {
                                hideAudioUploadLoader();
                            }
                            
                            app.notify('Конспект готов!', 'success');
                            await loadLatestConspect(app);
                            
                            if (typeof showConspectModal === 'function') {
                                showConspectModal(conspect, { initialVariant: variant });
                            }
                        } else {
                            // Если функция не доступна, просто загружаем без выбора варианта
                            app.showLoading('Загружаем аудио...');
                            const audio = await app.uploadAudio(audioFile);
                            app.hideLoading();
                            app.showLoading('Создаём конспект...');
                            const conspect = await app.createConspectFromAudio(audio.id, fileName);
                            app.hideLoading();
                            app.notify('Конспект готов!', 'success');
                            await loadLatestConspect(app);
                        }
                    } catch (err) {
                        console.error('Ошибка при обработке записи:', err);
                        isRecording = false;
                        recordBtn.innerHTML = '<i class="fas fa-microphone"></i><span>Записать аудио</span>';
                        recordBtn.classList.remove('recording');
                        app.hideLoading();
                        app.notify(err.message || 'Не удалось обработать запись', 'error');
                    }
                }
            });
        });
    }

    // Инициализируем кнопку записи после загрузки DOM
    // Используем DOMContentLoaded для гарантии, что все элементы загружены
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (document.body.classList.contains('page-conspect-create')) {
                initAudioRecorder();
            }
        });
    } else {
        // DOM уже загружен
        if (document.body.classList.contains('page-conspect-create')) {
            initAudioRecorder();
        }
    }

    async function loadLatestConspect(app) {
        if (!app) {
            app = window.ConspectiumApp;
        }
        if (!app) {
            console.warn('ConspectiumApp не доступен');
            return;
        }
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