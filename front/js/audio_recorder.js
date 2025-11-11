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
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.stream = stream;
                this.mediaRecorder = new MediaRecorder(stream);
                this.audioChunks = [];

                this.mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        this.audioChunks.push(event.data);
                    }
                };

                this.mediaRecorder.onstop = () => {
                    if (this.stream) {
                        this.stream.getTracks().forEach(track => track.stop());
                    }
                };

                this.mediaRecorder.start();
                this.isRecording = true;
                return true;
            } catch (err) {
                console.error('Error starting recording:', err);
                throw new Error('Не удалось начать запись. Проверьте разрешения микрофона.');
            }
        }

        async stopRecording() {
            return new Promise((resolve, reject) => {
                if (!this.mediaRecorder || !this.isRecording) {
                    reject(new Error('Запись не была начата'));
                    return;
                }

                this.mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
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

