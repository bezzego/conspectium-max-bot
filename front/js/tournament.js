  // Расширенные данные турниров
        const tournaments = [
            {
                id: 1,
                title: "Математика для начинающих",
                subject: "math",
                description: "Основные понятия алгебры и геометрии для новичков",
                questions: 15,
                time: 20,
                participants: 124,
                difficulty: "easy",
                rating: 4.8,
                tags: ["алгебра", "геометрия", "начальный"]
            },
            {
                id: 2,
                title: "История Древнего мира",
                subject: "history", 
                description: "Цивилизации Древнего Египта, Греции и Рима",
                questions: 20,
                time: 25,
                participants: 89,
                difficulty: "medium",
                rating: 4.6,
                tags: ["древний мир", "цивилизации", "археология"]
            },
            {
                id: 3,
                title: "Квантовая физика",
                subject: "physics",
                description: "Основы квантовой механики и теория относительности",
                questions: 18,
                time: 30,
                participants: 67,
                difficulty: "hard",
                rating: 4.9,
                tags: ["кванты", "относительность", "физика"]
            },
            {
                id: 4,
                title: "Органическая химия",
                subject: "chemistry",
                description: "Углеводороды, спирты, карбоновые кислоты и их свойства",
                questions: 25,
                time: 35,
                participants: 45,
                difficulty: "hard",
                rating: 4.7,
                tags: ["органическая", "реакции", "соединения"]
            },
            {
                id: 5,
                title: "Анатомия человека",
                subject: "biology",
                description: "Строение и функции органов человеческого тела",
                questions: 20,
                time: 25,
                participants: 156,
                difficulty: "medium",
                rating: 4.5,
                tags: ["анатомия", "медицина", "организм"]
            },
            {
                id: 6,
                title: "Страны и столицы мира",
                subject: "geography",
                description: "Географические знания о странах и их столицах",
                questions: 30,
                time: 20,
                participants: 203,
                difficulty: "easy",
                rating: 4.4,
                tags: ["география", "столицы", "страны"]
            }
        ];

        // Данные участников
        let participants = [
            {
                id: 1,
                name: "Ты",
                avatar: "👑",
                gender: "Не указан",
                isReady: false,
                isHost: true
            }
        ];

        // Расширенный функционал
        let currentTournament = null;
        let isReady = false;
        let lobbyCode = generateLobbyCode();
        let currentView = 'tournaments';

        // Инициализация
        document.addEventListener('DOMContentLoaded', function() {
            initNavigation();
            renderTournaments();
            setupEventListeners();
            updateFilters();
            initCustomSelects();
        });

        // Инициализация навигации
        function initNavigation() {
            const backBtn = document.getElementById('backBtn');
            
            function resetButtonStates() {
                backBtn.blur();
                setTimeout(() => {
                    backBtn.style.transform = 'scale(1)';
                    backBtn.style.opacity = '1';
                }, 50);
            }
            
            backBtn.addEventListener('click', function(e) {
                resetButtonStates();
                handleBackNavigation();
            });
            
            backBtn.addEventListener('mouseup', resetButtonStates);
            backBtn.addEventListener('touchend', resetButtonStates);
        }

        // Обработка навигации назад
        function handleBackNavigation() {
            switch(currentView) {
                case 'results':
                    showLobbyView();
                    break;
                    
                case 'lobby':
                    showTournamentsView();
                    break;
                    
                case 'tournaments':
                default:
                    if (document.referrer && document.referrer.includes(window.location.hostname)) {
                        window.history.back();
                    } else {
                        window.location.href = '/front/html/main.html';
                    }
                    break;
            }
        }

        // Функции для управления представлениями
        function showTournamentsView() {
            document.getElementById('lobbyContainer').style.display = 'none';
            document.getElementById('resultsContainer').style.display = 'none';
            document.querySelector('.tournaments-grid').style.display = 'grid';
            document.querySelector('.tournament-filters').style.display = 'block';
            document.querySelector('.title').style.display = 'block';
            document.querySelector('.subtitle').style.display = 'block';
            currentView = 'tournaments';
            resetTournamentState();
        }

        function showLobbyView() {
            document.getElementById('resultsContainer').style.display = 'none';
            document.querySelector('.tournaments-grid').style.display = 'none';
            document.querySelector('.tournament-filters').style.display = 'none';
            document.querySelector('.title').style.display = 'none';
            document.querySelector('.subtitle').style.display = 'none';
            document.getElementById('lobbyContainer').style.display = 'block';
            currentView = 'lobby';
        }

        function showResultsView() {
            document.getElementById('lobbyContainer').style.display = 'none';
            document.querySelector('.tournaments-grid').style.display = 'none';
            document.querySelector('.tournament-filters').style.display = 'none';
            document.querySelector('.title').style.display = 'none';
            document.querySelector('.subtitle').style.display = 'none';
            document.getElementById('resultsContainer').style.display = 'block';
            currentView = 'results';
        }

        // Сброс состояния турнира
        function resetTournamentState() {
            currentTournament = null;
            participants = participants.filter(p => p.isHost);
            isReady = false;
            updateReadyButton();
        }

        function renderTournaments() {
            const grid = document.getElementById('tournamentsGrid');
            grid.innerHTML = '';

            const filteredTournaments = filterTournaments();

            if (filteredTournaments.length === 0) {
                grid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: rgba(255,255,255,0.7);">
                        <i class="fas fa-search" style="font-size: 48px; margin-bottom: 15px;"></i>
                        <div>Турниры по выбранным фильтрам не найдены</div>
                    </div>
                `;
                return;
            }

            filteredTournaments.forEach(tournament => {
                const card = document.createElement('div');
                card.className = 'tournament-card fade-in';
                card.onclick = () => joinTournament(tournament);
                
                const difficultyClass = `difficulty-${tournament.difficulty}`;
                const subjectNames = {
                    'math': 'Математика',
                    'history': 'История', 
                    'physics': 'Физика',
                    'chemistry': 'Химия',
                    'biology': 'Биология',
                    'geography': 'География',
                    'literature': 'Литература',
                    'programming': 'Программирование'
                };
                
                card.innerHTML = `
                    <div class="tournament-badge">
                        <i class="fas fa-graduation-cap"></i>
                        ${subjectNames[tournament.subject]}
                    </div>
                    <div class="tournament-title">${tournament.title}</div>
                    <div class="tournament-description">${tournament.description}</div>
                    <div class="tournament-meta">
                        <span class="tournament-difficulty ${difficultyClass}">
                            ${getDifficultyText(tournament.difficulty)}
                        </span>
                        <div class="stat">
                            <i class="fas fa-star" style="color: #FFD700;"></i>
                            <span>${tournament.rating}</span>
                        </div>
                    </div>
                    <div class="tournament-stats">
                        <div class="stat">
                            <i class="fas fa-question-circle"></i>
                            <span>${tournament.questions} вопросов</span>
                        </div>
                        <div class="stat">
                            <i class="fas fa-clock"></i>
                            <span>${tournament.time} мин</span>
                        </div>
                        <div class="stat">
                            <i class="fas fa-users"></i>
                            <span>${tournament.participants}</span>
                        </div>
                    </div>
                `;
                
                grid.appendChild(card);
            });
        }

        function filterTournaments() {
            const subjectFilter = document.getElementById('subjectFilter').value;
            const difficultyFilter = document.getElementById('difficultyFilter').value;
            const timeFilter = document.getElementById('timeFilter').value;
            const searchFilter = document.getElementById('searchFilter').value.toLowerCase();

            return tournaments.filter(tournament => {
                if (subjectFilter !== 'all' && tournament.subject !== subjectFilter) {
                    return false;
                }
                
                if (difficultyFilter !== 'all' && tournament.difficulty !== difficultyFilter) {
                    return false;
                }
                
                if (timeFilter !== 'all') {
                    if (timeFilter === 'short' && tournament.time > 15) return false;
                    if (timeFilter === 'medium' && (tournament.time <= 15 || tournament.time > 30)) return false;
                    if (timeFilter === 'long' && tournament.time <= 30) return false;
                }
                
                if (searchFilter && !tournament.title.toLowerCase().includes(searchFilter) && 
                    !tournament.description.toLowerCase().includes(searchFilter)) {
                    return false;
                }
                
                return true;
            });
        }

        function getDifficultyText(difficulty) {
            const difficulties = {
                'easy': 'Легкий',
                'medium': 'Средний', 
                'hard': 'Сложный'
            };
            return difficulties[difficulty] || difficulty;
        }

        function updateFilters() {
            document.querySelectorAll('.hidden-select, .search-input').forEach(element => {
                element.addEventListener('change', renderTournaments);
                element.addEventListener('input', renderTournaments);
            });
        }

        function setupEventListeners() {
            // Дополнительные слушатели событий
        }

        function joinTournament(tournament) {
            currentTournament = tournament;
            document.getElementById('lobbyTitle').textContent = `Лобби: ${tournament.title}`;
            document.getElementById('lobbyCode').textContent = lobbyCode;
            showLobbyView();
            updateParticipants();
        }

        function generateLobbyCode() {
            return 'TOUR#' + Math.random().toString(36).substr(2, 6).toUpperCase();
        }

        function copyLobbyCode() {
            navigator.clipboard.writeText(lobbyCode);
            showNotification('Код лобби скопирован!');
        }

        function generateInviteLink() {
            const link = `${window.location.origin}${window.location.pathname}?join=${lobbyCode}`;
            navigator.clipboard.writeText(link);
            showNotification('Ссылка-приглашение скопирована!');
        }

            function showNotification(message) {
            const notification = document.createElement('div');
            notification.style.cssText = `
                font-family: 'Manrope', sans-serif;
                font-weight: 500;
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.15) 100%);
                backdrop-filter: blur(15px);
                border: 1px solid rgba(255,255,255,0.2);
                color: white;
                padding: 15px 30px;
                border-radius: 12px;
                z-index: 10000;
                text-align: center;
                white-space: nowrap;
                box-shadow: 0 8px 25px rgba(0,0,0,0.2);
                opacity: 0;
                animation: centerFadeIn 0.3s ease forwards;
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => {
                    notification.remove();
                }, 300);
            }, 2700);
        }

        function updateParticipants() {
            const grid = document.getElementById('participantsGrid');
            const countElement = document.getElementById('participantsCount');
            
            const inviteBtn = grid.querySelector('.add-participant');
            grid.innerHTML = '';
            
            participants.forEach(participant => {
                const participantEl = document.createElement('div');
                participantEl.className = 'participant';
                
                participantEl.innerHTML = `
                    <div class="participant-avatar ${participant.isReady ? 'ready' : ''} ${participant.isHost ? 'host' : ''}">
                        ${participant.avatar}
                    </div>
                    <div class="participant-name">${participant.name}</div>
                    <div class="participant-status ${participant.isReady ? 'status-ready' : 'status-not-ready'}">
                        ${participant.isReady ? 'Готов' : 'Не готов'}
                    </div>
                `;
                
                grid.appendChild(participantEl);
            });
            
            grid.appendChild(inviteBtn);
            countElement.textContent = participants.length;
            updateStartButton();
        }

        function addParticipant(name, avatar, gender) {
            participants.push({
                id: participants.length + 1,
                name: name,
                avatar: avatar,
                gender: gender,
                isReady: false,
                isHost: false
            });
            updateParticipants();
        }

        function toggleReady() {
            isReady = !isReady;
            const user = participants.find(p => p.isHost);
            if (user) user.isReady = isReady;
            updateReadyButton();
            updateParticipants();
        }

        function updateReadyButton() {
            const btn = document.getElementById('readyBtn');
            if (isReady) {
                btn.textContent = 'Не готов';
                btn.classList.add('ready');
            } else {
                btn.textContent = 'Готов';
                btn.classList.remove('ready');
            }
        }

        function updateStartButton() {
            const btn = document.getElementById('startBtn');
            const allReady = participants.length > 1 && participants.every(p => p.isReady);
            btn.disabled = !allReady;
            
            if (allReady) {
                btn.classList.add('pulse');
            } else {
                btn.classList.remove('pulse');
            }
        }

        function startTournament() {
            simulateTournament();
        }

        function simulateTournament() {
            const results = participants.map(participant => ({
                name: participant.name,
                avatar: participant.avatar,
                correctAnswers: Math.floor(Math.random() * currentTournament.questions) + 1,
                time: Math.floor(Math.random() * (currentTournament.time * 60 - 60)) + 60,
                isHost: participant.isHost
            }));

            results.sort((a, b) => {
                if (b.correctAnswers === a.correctAnswers) {
                    return a.time - b.time;
                }
                return b.correctAnswers - a.correctAnswers;
            });

            showResults(results);
        }

        // Обновленная функция showResults
        function showResults(results) {
            const table = document.getElementById('resultsTable');
            const compactGrid = document.getElementById('compactResultsGrid');
            const title = document.getElementById('resultsTitle');
            const totalParticipants = document.getElementById('totalParticipants');
            const averageScore = document.getElementById('averageScore');
            const bestTime = document.getElementById('bestTime');
            
            table.innerHTML = '';
            compactGrid.innerHTML = '';
            
            title.textContent = `Результаты: ${currentTournament.title}`;
            totalParticipants.textContent = results.length;
            
            const totalCorrect = results.reduce((sum, result) => sum + result.correctAnswers, 0);
            const avgScore = Math.round((totalCorrect / (results.length * currentTournament.questions)) * 100);
            const fastestTime = Math.min(...results.map(r => r.time));
            
            averageScore.textContent = `${avgScore}%`;
            bestTime.textContent = formatTime(fastestTime);

            results.forEach((result, index) => {
                const accuracy = Math.round((result.correctAnswers / currentTournament.questions) * 100);
                let scoreClass = 'score-poor';
                if (accuracy >= 80) scoreClass = 'score-excellent';
                else if (accuracy >= 60) scoreClass = 'score-good';
                else if (accuracy >= 40) scoreClass = 'score-average';

                // Добавляем в таблицу (для десктопа)
                const row = document.createElement('tr');
                let medal = '';
                if (index === 0) medal = '<span class="medal gold">🥇</span>';
                else if (index === 1) medal = '<span class="medal silver">🥈</span>';
                else if (index === 2) medal = '<span class="medal bronze">🥉</span>';

                row.innerHTML = `
                    <td>${medal} ${index + 1}</td>
                    <td>
                        <div class="player-info">
                            <div class="player-avatar">${result.avatar}</div>
                            <div class="player-name">
                                ${result.name} ${result.isHost ? '👑' : ''}
                            </div>
                        </div>
                    </td>
                    <td class="${scoreClass}">
                        ${result.correctAnswers}/${currentTournament.questions}
                    </td>
                    <td>${formatTime(result.time)}</td>
                    <td class="${scoreClass}">${accuracy}%</td>
                `;
                table.appendChild(row);


            const resultItem = document.createElement('div');
            resultItem.className = `results-item fade-in ${index < 3 ? 'top-3 place-' + (index + 1) : ''}`;
            resultItem.onclick = () => toggleResultDetails(resultItem);

            let medalIcon = '';
            if (index === 0) medalIcon = '<div class="medal-icon gold">🥇</div>';
            else if (index === 1) medalIcon = '<div class="medal-icon silver">🥈</div>';
            else if (index === 2) medalIcon = '<div class="medal-icon bronze">🥉</div>';

            // Убираем дублирование места - для мест после 3-го не показываем число в badge
            const placeBadgeContent = index < 3 ? 
                `${medalIcon}<span>${index + 1}</span>` : 
                `<div class="place-badge regular-place">${index + 1}</div>`;

            resultItem.innerHTML = `
                <div class="results-header-compact">
                    <div class="place-badge">
                        ${placeBadgeContent}
                    </div>
                    <div class="score-main ${scoreClass}">
                        ${result.correctAnswers}/${currentTournament.questions}
                    </div>
                </div>
                <div class="player-info-compact">
                    <div class="player-avatar-compact">${result.avatar}</div>
                    <div class="player-details">
                        <div class="player-name-compact">
                            ${result.name}
                            ${result.isHost ? '<span class="player-host-badge">👑</span>' : ''}
                        </div>
                    </div>
                </div>
                <div class="results-details">
                    <div class="details-grid">
                        <div class="detail-item">
                            <div class="detail-label">Результат</div>
                            <div class="detail-value ${scoreClass}">${result.correctAnswers}/${currentTournament.questions}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Время</div>
                            <div class="detail-value">${formatTime(result.time)}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Точность</div>
                            <div class="detail-value ${scoreClass}">${accuracy}%</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Место</div>
                            <div class="detail-value">${index + 1}</div>
                        </div>
                    </div>
                </div>
            `;
                
                compactGrid.appendChild(resultItem);
            });

            showResultsView();
        }

        // Функция переключения детальной информации
        function toggleResultDetails(resultItem) {
            const details = resultItem.querySelector('.results-details');
            const isVisible = details.style.display === 'block';
            
            document.querySelectorAll('.results-details').forEach(detail => {
                if (detail !== details) {
                    detail.style.display = 'none';
                    detail.parentElement.style.background = '';
                }
            });
            
            if (isVisible) {
                details.style.display = 'none';
                resultItem.style.background = '';
            } else {
                details.style.display = 'block';
                resultItem.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.15) 100%)';
            }
        }

        function formatTime(seconds) {
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }

        function shareResults() {
            const results = Array.from(document.querySelectorAll('#resultsTable tr')).map(row => {
                const cells = row.cells;
                return {
                    place: cells[0].textContent.trim(),
                    name: cells[1].querySelector('.player-name').textContent.trim(),
                    score: cells[2].textContent.trim(),
                    time: cells[3].textContent.trim()
                };
            }).slice(1);

            const text = `🎯 Результаты турнира "${currentTournament.title}":\n\n` +
                results.map((r, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '▫️';
                    return `${medal} ${r.place}. ${r.name} - ${r.score} - ${r.time}`;
                }).join('\n');
            
            navigator.clipboard.writeText(text);
            showNotification('Результаты скопированы!');
        }

        function createNewTournament() {
            showTournamentsView();
            showNotification('Создание нового турнира...');
        }

        function showTournamentStats() {
            const isCompactView = window.innerWidth <= 768;
            
            if (isCompactView) {
                showNotification('Нажмите на участника для просмотра детальной статистики');
            } else {
                showNotification('Вся статистика отображается в таблице');
            }
        }

        // Кастомные селекты
        function initCustomSelects() {
            const selects = document.querySelectorAll('.liquid-select');
            const overlay = document.getElementById('selectOverlay');
            
            selects.forEach(select => {
                const trigger = select.querySelector('.select-trigger');
                const dropdown = select.querySelector('.select-dropdown');
                const options = dropdown.querySelectorAll('.select-option');
                const hiddenSelect = select.querySelector('.hidden-select');
                const selectedText = select.querySelector('.selected-text');
                
                trigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isOpen = select.classList.contains('open');
                    
                    document.querySelectorAll('.liquid-select.open').forEach(s => {
                        if (s !== select) s.classList.remove('open');
                    });
                    
                    select.classList.toggle('open', !isOpen);
                    
                    if (!isOpen) {
                        checkDropdownPosition(select, dropdown);
                        document.body.style.overflow = 'hidden';
                    } else {
                        dropdown.classList.remove('fixed-position');
                        document.body.style.overflow = '';
                    }
                });
                
                options.forEach(option => {
                    option.addEventListener('click', () => {
                        const value = option.getAttribute('data-value');
                        const text = option.textContent;
                        
                        selectedText.textContent = text;
                        hiddenSelect.value = value;
                        
                        options.forEach(opt => opt.classList.remove('selected'));
                        option.classList.add('selected');
                        
                        select.classList.remove('open');
                        dropdown.classList.remove('fixed-position');
                        document.body.style.overflow = '';
                        
                        hiddenSelect.dispatchEvent(new Event('change'));
                    });
                });
                
                overlay.addEventListener('click', () => {
                    select.classList.remove('open');
                    dropdown.classList.remove('fixed-position');
                    document.body.style.overflow = '';
                });
                
                dropdown.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
                
                const initialValue = hiddenSelect.value;
                const initialOption = dropdown.querySelector(`[data-value="${initialValue}"]`);
                if (initialOption) {
                    initialOption.classList.add('selected');
                    selectedText.textContent = initialOption.textContent;
                }
            });
            
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    document.querySelectorAll('.liquid-select.open').forEach(select => {
                        select.classList.remove('open');
                        select.querySelector('.select-dropdown').classList.remove('fixed-position');
                        document.body.style.overflow = '';
                    });
                }
            });
        }

        function checkDropdownPosition(select, dropdown) {
            if (window.innerWidth > 768) return;
            
            const triggerRect = select.getBoundingClientRect();
            const dropdownHeight = 300;
            const spaceBelow = window.innerHeight - triggerRect.bottom;
            
            if (spaceBelow < dropdownHeight) {
                dropdown.classList.add('fixed-position');
                dropdown.style.left = '20px';
                dropdown.style.right = '20px';
                dropdown.style.bottom = '20px';
            } else {
                dropdown.classList.remove('fixed-position');
                dropdown.style.left = '';
                dropdown.style.right = '';
                dropdown.style.bottom = '';
            }
        }

        // Закрытие выпадающих списков при клике вне их
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.liquid-select')) {
                document.querySelectorAll('.liquid-select.open').forEach(select => {
                    select.classList.remove('open');
                    select.querySelector('.select-dropdown').classList.remove('fixed-position');
                    document.body.style.overflow = '';
                });
            }
        });

        // Обработчик изменения размера окна
        window.addEventListener('resize', () => {
            document.querySelectorAll('.liquid-select.open').forEach(select => {
                const dropdown = select.querySelector('.select-dropdown');
                checkDropdownPosition(select, dropdown);
            });
        });

        // Симуляция добавления участников для демонстрации
        setTimeout(() => {
            addParticipant("Анна", "👩", "Женский");
            addParticipant("Максим", "👨", "Мужской");
            addParticipant("София", "👧", "Женский");
            addParticipant("Алексей", "👨‍💼", "Мужской");
        }, 1000);

        // Автоматическая готовность участников для демонстрации
        setTimeout(() => {
            participants.forEach(p => {
                if (!p.isHost) p.isReady = true;
            });
            updateParticipants();
        }, 3000);