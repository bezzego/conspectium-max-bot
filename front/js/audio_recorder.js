(() => {
    class AudioRecorder {
        constructor() {
            this.mediaRecorder = null;
            this.audioChunks = [];
            this.isRecording = false;
            this.stream = null;
        }

        async startRecording() {
            try {
                // Запрашиваем доступ к микрофону с дополнительными опциями для мобильных устройств
                const constraints = {
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    }
                };
                
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                this.stream = stream;
                
                // Определяем поддерживаемые MIME типы для мобильных устройств
                let mimeType = 'audio/webm';
                if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                    mimeType = 'audio/webm;codecs=opus';
                } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                    mimeType = 'audio/webm';
                } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                    mimeType = 'audio/mp4';
                } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
                    mimeType = 'audio/ogg;codecs=opus';
                }
                
                const options = { mimeType: mimeType };
                // Для мобильных устройств используем более частые события dataavailable
                if (MediaRecorder.isTypeSupported(mimeType)) {
                    options.mimeType = mimeType;
                }
                
                this.mediaRecorder = new MediaRecorder(stream, options);
                this.audioChunks = [];

                this.mediaRecorder.ondataavailable = (event) => {
                    if (event.data && event.data.size > 0) {
                        this.audioChunks.push(event.data);
                    }
                };

                this.mediaRecorder.onstop = () => {
                    if (this.stream) {
                        this.stream.getTracks().forEach(track => track.stop());
                    }
                };

                // Начинаем запись с интервалом для мобильных устройств
                const timeslice = 1000; // 1 секунда
                this.mediaRecorder.start(timeslice);
                this.isRecording = true;
                return true;
            } catch (err) {
                console.error('Error starting recording:', err);
                let errorMessage = 'Не удалось начать запись. ';
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    errorMessage += 'Разрешите доступ к микрофону в настройках браузера.';
                } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                    errorMessage += 'Микрофон не найден.';
                } else if (err.name === 'NotSupportedError') {
                    errorMessage += 'Запись аудио не поддерживается в этом браузере.';
                } else {
                    errorMessage += 'Проверьте разрешения микрофона.';
                }
                throw new Error(errorMessage);
            }
        }

        async stopRecording() {
            return new Promise((resolve, reject) => {
                if (!this.mediaRecorder || !this.isRecording) {
                    reject(new Error('Запись не была начата'));
                    return;
                }

                this.mediaRecorder.onstop = () => {
                    // Определяем MIME тип на основе того, что использовалось при записи
                    let blobType = 'audio/webm';
                    if (this.mediaRecorder.mimeType) {
                        blobType = this.mediaRecorder.mimeType;
                    } else if (this.audioChunks.length > 0 && this.audioChunks[0].type) {
                        blobType = this.audioChunks[0].type;
                    }
                    
                    const audioBlob = new Blob(this.audioChunks, { type: blobType });
                    this.isRecording = false;
                    if (this.stream) {
                        this.stream.getTracks().forEach(track => track.stop());
                    }
                    resolve(audioBlob);
                };

                this.mediaRecorder.stop();
            });
        }

        cancelRecording() {
            if (this.mediaRecorder && this.isRecording) {
                this.mediaRecorder.stop();
                this.isRecording = false;
            }
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }
            this.audioChunks = [];
        }

        isSupported() {
            return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && MediaRecorder);
        }
    }

    window.AudioRecorder = AudioRecorder;
})();

