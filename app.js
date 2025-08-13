// Contenido completo para app.js
const App = {
    state: {
        currentTab: 'planner',
        plannerView: 'week',
        editingDate: null,
        workouts: [],
        movements: [],
        personalRecords: [],
        bodyWeightLog: [],
        charts: {},
        planner: {
            month: new Date().getMonth(),
            year: new Date().getFullYear(),
            weekStartDate: null
        },
        flatpickr: null,
        userId: null,
        userEmail: null,
        isAppInitialized: false,
        dataListener: null
    },

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            document.getElementById('btn-register').addEventListener('click', () => this.handleRegister());
            document.getElementById('btn-login').addEventListener('click', () => this.handleLogin());
            document.getElementById('nav-btn-logout').addEventListener('click', () => this.handleLogout());
            this.initFirebase();
        });
    },

    initFirebase() {
        auth.onAuthStateChanged(user => {
            if (user) {
                this.state.userId = user.uid;
                this.state.userEmail = user.email;
                document.getElementById('auth-view').classList.add('hidden');
                document.getElementById('user-view').classList.remove('hidden');
                document.getElementById('nav-user-email').textContent = this.state.userEmail;
                document.getElementById('nav-user-status').classList.remove('hidden');
                this.loadData();
            } else {
                this.state.userId = null;
                this.state.userEmail = null;
                document.getElementById('auth-view').classList.remove('hidden');
                document.getElementById('user-view').classList.add('hidden');
                document.getElementById('nav-user-status').classList.add('hidden');
                if (this.state.dataListener) {
                    const userRef = database.ref('users/' + this.state.userId + '/FITtrainDataLogic');
                    userRef.off('value', this.state.dataListener);
                    this.state.dataListener = null;
                }
                this.state.workouts = [];
                this.state.movements = [];
                this.state.personalRecords = [];
                this.state.bodyWeightLog = [];
                this.destroyCharts();
                this.state.isAppInitialized = false; 
            }
        });
    },
    
    handleRegister() {
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const errorElement = document.getElementById('auth-error');
        if (password.length < 6) {
            errorElement.textContent = 'La contraseña debe tener al menos 6 caracteres.';
            return;
        }
        errorElement.textContent = '';
        auth.createUserWithEmailAndPassword(email, password)
            .catch(error => {
                if (error.code == 'auth/email-already-in-use') {
                    errorElement.textContent = 'Este correo ya está en uso.';
                } else if (error.code == 'auth/invalid-email') {
                     errorElement.textContent = 'El formato del correo no es válido.';
                } else {
                    errorElement.textContent = 'Ocurrió un error al registrar.';
                }
            });
    },

    handleLogin() {
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const errorElement = document.getElementById('auth-error');
        errorElement.textContent = '';
        auth.signInWithEmailAndPassword(email, password)
            .catch(error => {
                errorElement.textContent = 'Correo o contraseña incorrectos.';
            });
    },

    handleLogout() {
        auth.signOut();
    },

    loadData() {
        if (!this.state.userId || this.state.dataListener) return;
        const userRef = database.ref('users/' + this.state.userId + '/FITtrainDataLogic');
        this.state.dataListener = userRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                this.state.workouts = data.workouts || [];
                this.state.movements = data.movements || [];
                this.state.bodyWeightLog = data.bodyWeightLog || [];
            } else {
                this.state.movements = this.seedMovements();
                this.state.workouts = [];
                this.state.bodyWeightLog = [];
            }
            this.calculateAllPRs();
            if (!this.state.isAppInitialized) {
                this.initTabs();
                this.setPlannerWeek(new Date());
                this.showTab(this.state.currentTab, true);
                this.state.isAppInitialized = true;
            } else {
                this.rerenderCurrentTab();
            }
        }, error => {
            console.error("Error al leer de la base de datos:", error);
        });
    },

    saveData() {
        if (!this.state.userId) return;
        const oldPRs = JSON.parse(JSON.stringify(this.state.personalRecords));
        const dataToSave = {
            workouts: this.state.workouts,
            movements: this.state.movements,
            bodyWeightLog: this.state.bodyWeightLog
        };
        const userRef = database.ref('users/' + this.state.userId + '/FITtrainDataLogic');
        userRef.set(dataToSave);
        this.calculateAllPRs();
        this.checkNewPRs(oldPRs, this.state.personalRecords);
        this.rerenderCurrentTab();
    },

    seedMovements() {
        const d = [ { id: 1, name: 'Back Squat', category: 'weightlifting' }, { id: 2, name: 'Deadlift', category: 'weightlifting' }, { id: 3, name: 'Bench Press', category: 'weightlifting' }, { id: 4, name: 'Snatch', category: 'weightlifting' }, { id: 5, name: 'Clean & Jerk', category: 'weightlifting' }, { id: 10, name: 'Pull-up', category: 'gymnastics' }, { id: 11, name: 'Toes-to-bar', category: 'gymnastics' }, { id: 12, name: 'Muscle-up', category: 'gymnastics' }, { id: 20, name: 'Rowing (cal)', category: 'cardio' }, { id: 21, name: 'Double Unders', category: 'cardio' }, { id: 22, name: 'Burpees', category: 'cardio' } ];
        return d;
    },

    initTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => this.showTab(btn.dataset.tab)));
    },
    showTab(tabName, isInitialLoad = false) {
        if (!isInitialLoad && this.state.currentTab === tabName) return;
        this.state.currentTab = tabName;
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
        document.getElementById(`${tabName}-panel`).classList.add('active');
        this.renderTabContent(tabName);
    },
    rerenderCurrentTab() {
         this.renderTabContent(this.state.currentTab);
    },
    renderTabContent(tabName) {
        this.destroyCharts();
        switch (tabName) {
            case 'planner': this.renderPlanner(); break;
            case 'history': this.renderHistory(); break;
            case 'rms': this.renderPRs(); break;
            case 'progress': this.renderProgressAnalysis(); break;
            case 'stats': this.renderStats(); break;
            case 'movements': this.renderMovements(); break;
        }
    },

    renderPlanner() {
        const plannerPanel = document.getElementById('planner-panel');
        if(!plannerPanel.dataset.initialized) {
             document.getElementById('view-week').addEventListener('click', () => this.setPlannerView('week'));
             document.getElementById('view-month').addEventListener('click', () => this.setPlannerView('month'));
             plannerPanel.dataset.initialized = true;
        }
        this.setPlannerView(this.state.plannerView);
    },
    setPlannerView(view) {
        this.state.plannerView = view;
        const isWeekView = this.state.plannerView === 'week';
        document.getElementById('weekly-view').classList.toggle('hidden', !isWeekView);
        document.getElementById('monthly-view').classList.toggle('hidden', isWeekView);
        document.getElementById('view-week').classList.toggle('bg-red-600', isWeekView); document.getElementById('view-week').classList.toggle('text-white', isWeekView);
        document.getElementById('view-month').classList.toggle('bg-red-600', !isWeekView); document.getElementById('view-month').classList.toggle('text-white', !isWeekView);
        if (isWeekView) { this.renderWeeklyView(); } else { this.renderMonthlyView(); }
    },
    renderWeeklyView() {
        const container = document.getElementById('weekly-view');
        const startOfWeek = this.state.planner.weekStartDate;
        const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6);
        let headerHTML = `<div class="flex justify-between items-center p-4 border-b bg-gray-50"><button onclick="App.navigateWeek(-1)" class="p-2 rounded-full hover:bg-gray-200"><i class="fas fa-chevron-left"></i></button><h2 class="text-lg font-bold text-gray-800">${this.formatDate(startOfWeek, true)} - ${this.formatDate(endOfWeek, true)}</h2><button onclick="App.navigateWeek(1)" class="p-2 rounded-full hover:bg-gray-200"><i class="fas fa-chevron-right"></i></button></div><div class="grid grid-cols-7 bg-gray-100 border-b">${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => `<div class="py-3 text-center font-medium text-gray-700">${day}</div>`).join('')}</div>`;
        let daysHTML = '<div class="grid grid-cols-7">';
        for(let i=0; i<7; i++) {
            const dayDate = new Date(startOfWeek); dayDate.setDate(startOfWeek.getDate() + i);
            const dateStr = this.formatDate(dayDate);
            const dayWorkouts = this.state.workouts.filter(w => w.date === dateStr);
            daysHTML += `<div class="border-r border-b p-2 space-y-2 min-h-[250px]"><div class="flex justify-between items-center font-medium mb-2"><span class="${this.isToday(dayDate) ? 'text-red-600 font-bold' : ''}">${dayDate.getDate()}</span><button onclick="App.editDay('${dateStr}')" class="text-gray-400 hover:text-red-600 text-xs"><i class="fas fa-pencil-alt"></i></button></div>${dayWorkouts.map(w => this.createWorkoutCard(w, 'week')).join('')}</div>`;
        }
        daysHTML += '</div>';
        container.innerHTML = headerHTML + daysHTML;
    },
    renderMonthlyView() {
        const container = document.getElementById('monthly-view');
        const { year, month } = this.state.planner;
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        let headerHTML = `<div class="flex justify-between items-center p-4 border-b"><button onclick="App.navigateMonth(-1)" class="p-2 rounded-full hover:bg-gray-100"><i class="fas fa-chevron-left"></i></button><h2 class="text-xl font-bold text-gray-800">${monthNames[month]} ${year}</h2><button onclick="App.navigateMonth(1)" class="p-2 rounded-full hover:bg-gray-100"><i class="fas fa-chevron-right"></i></button></div><div class="grid grid-cols-7 bg-gray-100 border-b">${['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map(day => `<div class="py-3 text-center font-medium text-gray-700 text-sm">${day}</div>`).join('')}</div>`;
        const daysInMonth = lastDayOfMonth.getDate(); const startingDay = (firstDayOfMonth.getDay() + 6) % 7;
        let daysHTML = '<div class="grid grid-cols-7">';
        for (let i = 0; i < startingDay; i++) { daysHTML += `<div class="h-24 border-r border-b bg-gray-50"></div>`; }
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const dayWorkouts = this.state.workouts.filter(w => w.date === this.formatDate(currentDate));
            daysHTML += `<div class="h-24 border-r border-b p-1 calendar-day ${this.isToday(currentDate) ? 'selected' : ''}"><div class="text-right font-medium">${day}</div><div class="mt-1 flex flex-wrap gap-1">${dayWorkouts.map(w => this.createWorkoutCard(w, 'month')).join('')}</div></div>`;
        }
        const totalCells = startingDay + daysInMonth; const remainingCells = (7 - (totalCells % 7)) % 7;
        for (let i = 0; i < remainingCells; i++) { daysHTML += `<div class="h-24 border-r border-b bg-gray-50"></div>`; }
        daysHTML += '</div>';
        container.innerHTML = headerHTML + daysHTML;
    },
    createWorkoutCard(workout, viewType) {
        let title = '', details = '', headerClass = '', label = '';
        if (workout.wodType === 'Warm-up') { title = 'Warm-up'; details = workout.description; headerClass = 'warmup-header'; label = 'WU'; }
        else if (workout.wodType === 'Cooldown') { title = 'Cooldown'; details = workout.description; headerClass = 'cooldown-header'; label = 'CD'; }
        else if (workout.type === 'conditioning') { title = workout.wodType !== 'Custom' ? workout.wodType : 'WOD'; details = workout.description; if(workout.structure && workout.structure.length > 0) { details += (details ? '<br><br>':'') + workout.structure.map(m => ` • ${m.reps} ${this.getMovementName(m.id)} ${m.weight ? `@${m.weight}kg`:''}`).join('<br>'); } headerClass = 'wod-header'; label = 'WOD'; }
        else { title = 'Weightlifting'; details = `<b>${this.getMovementName(workout.mainMovement)}</b><br>${workout.series.map(s => `${s.reps} x ${s.weight}kg`).join('<br>')}`; headerClass = 'weightlifting-header'; label = 'WL'; }
        if (viewType === 'month') return `<span class="month-tag ${headerClass}">${label}</span>`;
        return `<div class="rounded-lg shadow overflow-hidden"><div class="p-2 font-bold text-sm ${headerClass} flex justify-between items-center"><span>${title}</span><button onclick="App.deleteWorkout(${workout.id})" class="text-inherit opacity-60 hover:opacity-100 text-xs"><i class="fas fa-trash-alt"></i></button></div><div class="p-2 text-xs bg-white whitespace-pre-wrap">${details}</div></div>`;
    },
    setPlannerWeek(date) { const d = new Date(date); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); this.state.planner.weekStartDate = new Date(d.setDate(diff)); },
    navigateWeek(direction) { const newDate = new Date(this.state.planner.weekStartDate); newDate.setDate(newDate.getDate() + (7 * direction)); this.setPlannerWeek(newDate); this.renderWeeklyView(); },
    navigateMonth(direction) { this.state.planner.month += direction; if (this.state.planner.month > 11) { this.state.planner.month = 0; this.state.planner.year++; } if (this.state.planner.month < 0) { this.state.planner.month = 11; this.state.planner.year--; } this.renderMonthlyView(); },

    renderHistory() {
        const panel = document.getElementById('history-panel');
        panel.querySelector('#historySearch').addEventListener('input', () => this.renderHistory());
        panel.querySelectorAll('.history-filter').forEach(btn => btn.addEventListener('click', e => {
            panel.querySelectorAll('.history-filter').forEach(f => f.classList.remove('bg-red-600', 'text-white'));
            e.target.classList.add('bg-red-600', 'text-white'); this.renderHistory();
        }));
        const container = panel.querySelector('#historyList'); const searchTerm = panel.querySelector('#historySearch').value.toLowerCase(); const filterType = panel.querySelector('.history-filter.bg-red-600').dataset.type; let workouts = this.state.workouts.sort((a,b) => this.parseDate(b.date) - this.parseDate(a.date)); if(filterType !== 'all') { workouts = workouts.filter(w => w.type === filterType); } if(searchTerm) { workouts = workouts.filter(w => { if (w.type === 'weightlifting') { return this.getMovementName(w.mainMovement).toLowerCase().includes(searchTerm); } if (w.type === 'conditioning' && (w.description || w.structure)) { return (w.description || '').toLowerCase().includes(searchTerm) || w.structure.some(m => this.getMovementName(m.id).toLowerCase().includes(searchTerm)); } return false; }); }
        container.innerHTML = workouts.length > 0 ? workouts.map(w => this.createHistoryCard(w)).join('') : `<p class="text-gray-500 text-center py-8">No se encontraron entrenamientos.</p>`;
    },
    createHistoryCard(workout) { let title, details, bgColor; if (workout.wodType === 'Warm-up') { bgColor = 'border-yellow-400 bg-yellow-50'; title = 'Warm-up'; details = workout.description; } else if (workout.wodType === 'Cooldown') { bgColor = 'border-blue-400 bg-blue-50'; title = 'Cooldown'; details = workout.description; } else if (workout.type === 'conditioning') { bgColor = 'border-pink-500 bg-pink-50'; title = workout.wodType !== 'Custom' ? workout.wodType : 'WOD'; details = workout.description; } else { bgColor = 'border-green-500 bg-green-50'; title = this.getMovementName(workout.mainMovement); details = workout.series.map(s => `${s.reps}x${s.weight}kg`).join(', '); } return `<div class="p-4 rounded-lg border-l-4 ${bgColor}"><div class="flex justify-between items-center"><h4 class="font-bold truncate pr-4">${title}</h4><span class="text-sm flex-shrink-0">${workout.date}</span></div><p class="text-sm my-2 truncate">${details}</p>${workout.rpe ? `<div class="flex justify-between items-center"><span class="text-xs font-semibold px-2 py-1 rounded-full bg-gray-200">RPE: ${workout.rpe}/10</span></div>`: ''}</div>`; },
    renderPRs() { const container = document.getElementById('rmsList'); container.innerHTML = ''; if(this.state.personalRecords.length === 0) { container.innerHTML = `<p class="text-gray-500 text-center py-8">No hay RMs. Registra un 1-repetition max.</p>`; return; } const prsByCategory = this.state.personalRecords.reduce((acc, pr) => { const movement = this.state.movements.find(m => m.id === pr.movementId); if(movement) { if(!acc[movement.category]) acc[movement.category] = []; acc[movement.category].push({ ...pr, movementName: movement.name }); } return acc; }, {}); Object.keys(prsByCategory).sort().forEach(category => { container.innerHTML += `<h3 class="text-lg font-semibold mb-3">${category.charAt(0).toUpperCase() + category.slice(1)}</h3><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">${prsByCategory[category].map(pr => `<div class="bg-white p-4 rounded-lg border shadow-sm"><h4 class="font-semibold text-gray-800">${pr.movementName}</h4><div class="mt-2"><div class="text-3xl font-bold text-gray-900">${pr.weight} kg</div><div class="text-xs text-gray-500 mt-1"><i class="fas fa-calendar-alt mr-1"></i> ${pr.date}</div></div></div>`).join('')}</div>`; }); },

    renderProgressAnalysis() {
        const container = document.getElementById('progress-content');
        if (this.state.workouts.length < 1 && this.state.bodyWeightLog.length < 1) { 
            container.innerHTML = `<div class="col-span-full text-center p-8 bg-gray-50 rounded-lg"><i class="fas fa-rocket text-4xl text-gray-300 mb-4"></i><h3 class="text-xl font-semibold text-gray-700">Aún no hay datos para el análisis</h3><p class="text-gray-500 mt-2">Registra tu primer entrenamiento o peso corporal para empezar.</p></div>`; 
            return; 
        }
        
        container.innerHTML = `
            <div class="p-4 rounded-lg border bg-white">
                <h3 class="font-semibold text-center mb-4">Consistencia y Rachas de Entrenamiento</h3>
                <div class="flex justify-around mb-4 text-center">
                    <div>
                        <div id="current-streak" class="text-2xl font-bold text-red-600">0</div>
                        <div class="text-sm text-gray-500">Racha Actual</div>
                    </div>
                    <div>
                        <div id="longest-streak" class="text-2xl font-bold text-gray-800">0</div>
                        <div class="text-sm text-gray-500">Mejor Racha</div>
                    </div>
                </div>
                <div class="heatmap-scroll-wrapper">
                    <div id="consistency-heatmap" class="heatmap-container"></div>
                </div>
                <div class="flex justify-center items-center mt-2 text-xs text-gray-500 gap-x-2">
                    <span>Poco</span>
                    <div class="w-3 h-3 rounded-sm" style="background-color: #fee2e2;"></div>
                    <div class="w-3 h-3 rounded-sm" style="background-color: #fca5a5;"></div>
                    <div class="w-3 h-3 rounded-sm" style="background-color: #ef4444;"></div>
                    <div class="w-3 h-3 rounded-sm" style="background-color: #b91c1c;"></div>
                    <span>Mucho</span>
                </div>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div class="p-4 rounded-lg border bg-white"><h3 class="font-semibold text-center mb-2">Distribución de Grupos Musculares (por Categoría)</h3><div class="relative h-80"><canvas id="categoryDistributionChart"></canvas></div></div>
                <div class="p-4 rounded-lg border bg-white"><h3 class="font-semibold text-center mb-2">Volumen Total (kg) Mensual</h3><div class="relative h-80"><canvas id="progressMonthlyVolumeChart"></canvas></div></div>
            </div>
            <div class="p-4 rounded-lg border bg-white">
                <h3 class="font-semibold mb-4 text-center">Progresión de Movimiento de Fuerza</h3>
                <div class="flex justify-center mb-4">
                    <select id="progress-movement-selector" class="p-2 border rounded-lg"></select>
                </div>
                <div class="relative h-96">
                    <div id="movementProgressionChartContainer">
                        <canvas id="movementProgressionChart"></canvas>
                    </div>
                    <div id="movementProgressionChart-nodata" class="hidden h-full flex items-center justify-center text-gray-500">No hay datos suficientes para este movimiento.</div>
                </div>
            </div>

            <div class="p-4 rounded-lg border bg-white">
                <h3 class="font-semibold mb-4 text-center">Registro Peso Corporal</h3>
                <div class="flex flex-col sm:flex-row justify-center items-center gap-2 mb-4">
                    <div>
                        <label for="bodyweight-date-picker" class="sr-only">Fecha</label>
                        <input type="text" id="bodyweight-date-picker" placeholder="Seleccionar fecha" class="p-2 border rounded-lg">
                    </div>
                    <div>
                        <label for="bodyweight-input" class="sr-only">Peso (kg)</label>
                        <input type="number" id="bodyweight-input" step="0.1" placeholder="Peso (kg)" class="p-2 border rounded-lg w-32">
                    </div>
                    <button id="btn-save-bodyweight" class="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition w-full sm:w-auto">Guardar Peso</button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div class="relative h-80">
                        <canvas id="bodyWeightChart"></canvas>
                        <div id="bodyWeightChart-nodata" class="hidden h-full flex items-center justify-center text-gray-500">No hay suficientes datos para mostrar el gráfico.</div>
                    </div>
                    <div>
                        <h4 class="font-semibold text-center text-gray-700 mb-2">Últimos 5 Registros</h4>
                        <div id="bodyWeightTable" class="text-sm"></div>
                    </div>
                </div>
            </div>
        `;
        
        this.renderCategoryDistributionChart();
        this.renderProgressMonthlyVolumeChart();
        this.renderConsistencyHeatmapAndStreaks();
        
        this.populateProgressMovementSelector();
        this.renderMovementProgressionChart();
        document.getElementById('progress-movement-selector').addEventListener('change', () => this.renderMovementProgressionChart());
        
        this.initBodyWeightForm();
        this.renderBodyWeightChart();
        this.renderBodyWeightTable();
    },

    initBodyWeightForm() {
        flatpickr("#bodyweight-date-picker", { 
            locale: 'es', 
            dateFormat: 'd/m/Y',
            defaultDate: new Date()
        });
        document.getElementById('btn-save-bodyweight').addEventListener('click', () => this.handleSaveBodyWeight());
    },

    handleSaveBodyWeight() {
        const dateInput = document.getElementById('bodyweight-date-picker');
        const weightInput = document.getElementById('bodyweight-input');
        
        const date = dateInput.value;
        const weight = parseFloat(weightInput.value);

        if (!date || !weight || weight <= 0) {
            this.showToast('Por favor, introduce una fecha y un peso válidos.', 'error');
            return;
        }

        this.state.bodyWeightLog.push({ date: date, weight: weight });
        
        weightInput.value = '';
        
        this.saveData();
        this.showToast('Peso corporal guardado con éxito.', 'success');
    },

    renderBodyWeightChart() {
        const canvasId = 'bodyWeightChart';
        const chartEl = document.getElementById(canvasId);
        const noDataEl = document.getElementById('bodyWeightChart-nodata');
        if (!chartEl || !noDataEl) return;
        
        if (this.state.charts[canvasId]) this.state.charts[canvasId].destroy();

        const sortedLog = [...this.state.bodyWeightLog].sort((a, b) => this.parseDate(a.date) - this.parseDate(b.date));

        if (sortedLog.length < 2) {
            chartEl.classList.add('hidden');
            noDataEl.classList.remove('hidden');
            return;
        }
        
        chartEl.classList.remove('hidden');
        noDataEl.classList.add('hidden');

        this.state.charts[canvasId] = new Chart(chartEl.getContext('2d'), {
            type: 'line',
            data: {
                labels: sortedLog.map(p => p.date),
                datasets: [{
                    label: 'Peso Corporal (kg)',
                    data: sortedLog.map(p => p.weight),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.2
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                scales: { 
                    y: { 
                        beginAtZero: false, 
                        title: { display: true, text: 'Peso (kg)' } 
                    } 
                },
                plugins: { legend: { display: false } }
            }
        });
    },

    renderBodyWeightTable() {
        const container = document.getElementById('bodyWeightTable');
        if (!container) return;

        const sortedLog = [...this.state.bodyWeightLog].sort((a, b) => this.parseDate(b.date) - this.parseDate(a.date));
        const last5 = sortedLog.slice(0, 5);

        if (last5.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500">No hay registros.</p>`;
            return;
        }

        let tableHTML = `<table class="w-full text-left">
            <thead>
                <tr class="border-b">
                    <th class="font-semibold p-2">Fecha</th>
                    <th class="font-semibold p-2 text-right">Peso</th>
                </tr>
            </thead>
            <tbody>`;
        
        last5.forEach(log => {
            tableHTML += `<tr class="border-b border-gray-100">
                <td class="p-2">${log.date}</td>
                <td class="p-2 text-right font-medium">${log.weight.toFixed(1)} kg</td>
            </tr>`;
        });

        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;
    },

    renderCategoryDistributionChart() {
        const canvasId = 'categoryDistributionChart';
        const chartEl = document.getElementById(canvasId);
        if (!chartEl) return;

        const repCounts = { weightlifting: 0, gymnastics: 0, cardio: 0 };
        this.state.workouts.forEach(w => {
            if (w.type === 'weightlifting' && w.series) {
                repCounts.weightlifting += w.series.reduce((sum, s) => sum + s.reps, 0);
            } else if (w.type === 'conditioning' && w.structure) {
                w.structure.forEach(m => {
                    const cat = this.getMovementCategory(m.id);
                    if (cat && repCounts.hasOwnProperty(cat)) {
                        repCounts[cat] += m.reps;
                    }
                });
            }
        });

        this.state.charts[canvasId] = new Chart(chartEl.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Weightlifting', 'Gymnastics', 'Cardio'],
                datasets: [{
                    label: 'Total de Reps',
                    data: [repCounts.weightlifting, repCounts.gymnastics, repCounts.cardio],
                    backgroundColor: ['#68d391', '#76e4f7', '#f687b3'],
                    borderColor: '#ffffff',
                    borderWidth: 2
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }
        });
    },

    renderProgressMonthlyVolumeChart() {
         const canvasId = 'progressMonthlyVolumeChart';
         const chartEl = document.getElementById(canvasId);
         if (!chartEl) return;

         const monthlyVolume = {};
         this.state.workouts.filter(w => w.type === 'weightlifting' && w.series).forEach(w => {
            const date = this.parseDate(w.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const volume = w.series.reduce((total, s) => total + (s.reps * s.weight), 0);
            monthlyVolume[monthKey] = (monthlyVolume[monthKey] || 0) + volume;
         });

         const sortedKeys = Object.keys(monthlyVolume).sort();
         if (sortedKeys.length === 0) {
             chartEl.parentNode.innerHTML = '<p class="text-center text-gray-500 pt-16">No hay datos de volumen para mostrar.</p>';
             return;
         }
         const labels = sortedKeys.map(key => new Date(key + '-02').toLocaleString('es-ES', { month: 'short', year: '2-digit' }));
         const data = sortedKeys.map(key => monthlyVolume[key]);

         this.state.charts[canvasId] = new Chart(chartEl.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Volumen (kg)',
                    data: data,
                    backgroundColor: '#4ade80'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
         });
    },

    renderConsistencyHeatmapAndStreaks() {
        const container = document.getElementById('consistency-heatmap');
        if(!container) return;

        const workoutDates = new Set(this.state.workouts.map(w => this.formatDate(this.parseDate(w.date), false, '-')));

        let longestStreak = 0;
        let currentStreak = 0;
        if(workoutDates.size > 0) {
            const sortedDates = [...workoutDates].map(d => new Date(d)).sort((a,b) => a - b);

            let runningStreak = 0;
            if(sortedDates.length > 0){
                runningStreak = 1;
                longestStreak = 1;
            }

            for(let i = 1; i < sortedDates.length; i++) {
                const diff = (sortedDates[i] - sortedDates[i-1]) / (1000 * 60 * 60 * 24);
                if(diff === 1) {
                    runningStreak++;
                } else {
                    if (runningStreak > longestStreak) longestStreak = runningStreak;
                    runningStreak = 1;
                }
            }
            if (runningStreak > longestStreak) longestStreak = runningStreak;

            const today = new Date(); today.setHours(0,0,0,0);
            const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

            const lastWorkoutDate = sortedDates[sortedDates.length-1];
            
            if(lastWorkoutDate && (lastWorkoutDate.getTime() === today.getTime() || lastWorkoutDate.getTime() === yesterday.getTime())) {
               let tempStreak = 1;
               for (let i = sortedDates.length - 2; i >= 0; i--) {
                   const diff = (sortedDates[i+1] - sortedDates[i]) / (1000 * 60 * 60 * 24);
                   if (diff === 1) {
                       tempStreak++;
                   } else {
                       break;
                   }
               }
               currentStreak = tempStreak;
            } else {
               currentStreak = 0;
            }
        }

        document.getElementById('current-streak').textContent = currentStreak;
        document.getElementById('longest-streak').textContent = longestStreak;

        const year = new Date().getFullYear();
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31);
        const workoutCounts = this.state.workouts.reduce((acc, workout) => {
            const d = this.parseDate(workout.date);
            if (d.getFullYear() === year) {
                const dateString = this.formatDate(d, false, '-');
                acc[dateString] = (acc[dateString] || 0) + 1;
            }
            return acc;
        }, {});

        let daysHtml = '';
        const dayOffset = (startDate.getDay() + 6) % 7;
        for (let i = 0; i < dayOffset; i++) daysHtml += `<div class="heatmap-day bg-transparent"></div>`;

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateString = this.formatDate(d, false, '-');
            const count = workoutCounts[dateString] || 0;
            let level = 0;
            if (count > 0) level = 1; if (count >= 2) level = 2; if (count >= 3) level = 3; if (count >= 4) level = 4;
            const tooltipText = count > 0 ? `${count} entreno(s)` : `Sin entreno`;
            daysHtml += `<div class="heatmap-day" data-level="${level}"><span class="heatmap-tooltip">${this.formatDate(d)}: ${tooltipText}</span></div>`;
        }

        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const weekdays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

        container.innerHTML = `
            <div class="flex">
                <div class="heatmap-weekdays">${weekdays.map(d => `<div class="h-4 flex items-center">${d}</div>`).join('')}</div>
                <div class="w-full">
                    <div class="heatmap-months">${monthNames.map(m => `<div class="heatmap-month">${m}</div>`).join('')}</div>
                    <div class="heatmap">${daysHtml}</div>
                </div>
            </div>`;
    },

    populateProgressMovementSelector() {
        const selector = document.getElementById('progress-movement-selector');
        if(!selector) return;
        const wlMovements = this.state.movements.filter(m => m.category === 'weightlifting');
        selector.innerHTML = wlMovements.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    },

    renderMovementProgressionChart() {
        const canvasId = 'movementProgressionChart';
        const container = document.getElementById('movementProgressionChartContainer');
        const noDataEl = document.getElementById('movementProgressionChart-nodata');
        if (!container || !noDataEl) return;

        if (this.state.charts[canvasId]) this.state.charts[canvasId].destroy();

        const movementId = parseInt(document.getElementById('progress-movement-selector').value);
        const dataPoints = this.state.workouts
            .filter(w => w.type === 'weightlifting' && w.mainMovement === movementId && w.series)
            .map(w => ({
                date: this.parseDate(w.date),
                weight: Math.max(...w.series.map(s => s.weight))
            }))
            .sort((a,b) => a.date - b.date);

        if (dataPoints.length < 2) {
            container.classList.add('hidden');
            noDataEl.classList.remove('hidden');
            return;
        }

        container.classList.remove('hidden');
        noDataEl.classList.add('hidden');

        this.state.charts[canvasId] = new Chart(document.getElementById(canvasId).getContext('2d'), {
            type: 'line',
            data: {
                labels: dataPoints.map(p => this.formatDate(p.date)),
                datasets: [{
                    label: 'Peso Máx. en Sesión (kg)',
                    data: dataPoints.map(p => p.weight),
                    borderColor: '#b91c1c',
                    backgroundColor: 'rgba(185, 28, 28, 0.1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: false, title: { display: true, text: 'Peso (kg)' } } } }
        });
    },


    renderStats() {
        const container = document.getElementById('stats-content');
        if(this.state.workouts.length < 3) { container.innerHTML = `<div class="col-span-full text-center p-8 bg-gray-50 rounded-lg"><i class="fas fa-chart-line text-4xl text-gray-300 mb-4"></i><h3 class="text-xl font-semibold text-gray-700">No hay suficientes datos</h3><p class="text-gray-500 mt-2">Registra más entrenamientos para ver tus estadísticas.</p></div>`; return; }
        container.innerHTML = `
            <div class="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div class="p-4 rounded-lg border bg-white"><h3 class="font-semibold text-center mb-2">Top 10 - Mes Anterior</h3><div class="relative h-96"><canvas id="topMovementsLastMonthChart"></canvas></div></div>
                <div class="p-4 rounded-lg border bg-white"><h3 class="font-semibold text-center mb-2">Top 10 - Mes Actual</h3><div class="relative h-96"><canvas id="topMovementsCurrentMonthChart"></canvas></div></div>
            </div>
            <div class="p-4 rounded-lg border bg-white"><h3 class="font-semibold text-center mb-2">Evolución del RPE Promedio</h3><div class="relative h-80"><canvas id="rpeEvolutionChart"></canvas></div></div>
            <div class="p-4 rounded-lg border bg-white"><h3 class="font-semibold text-center mb-2">Volumen Total (kg) Semanal</h3><div class="relative h-80"><canvas id="statsWeeklyWeightVolumeChart"></canvas></div></div>
            <div class="p-4 mt-8 relative rounded-lg border bg-white lg:col-span-2">
                <h3 class="font-semibold text-center mb-2">Volumen por Categoría (Reps) Semanal</h3>
                <div class="relative h-96"><canvas id="weeklyCategoryVolumeChart"></canvas></div>
            </div>
            <div class="p-4 rounded-lg border bg-white"><h3 class="font-semibold text-center mb-2">Distribución de WODs</h3><div class="relative h-80"><canvas id="wodTypeDistributionChart"></canvas></div></div>`;
        this.renderTopMovementsCharts();
        this.renderRpeEvolutionChart();
        this.renderWeeklyWeightVolumeChart('statsWeeklyWeightVolumeChart');
        this.renderWeeklyCategoryVolumeChart();
        this.renderWodTypeDistributionChart();
    },
    
    renderMovements() {
        const panel = document.getElementById('movements-panel');
        panel.querySelector('#btnAddNewMovement').onclick = () => this.showMovementModal();
        const container = panel.querySelector('#movementsList');
        container.innerHTML = '';
        this.state.movements.sort((a,b) => a.name.localeCompare(b.name)).forEach(movement => {
            const pr = this.state.personalRecords.find(p => p.movementId === movement.id);
            const card = document.createElement('div');
            card.className = 'bg-white border rounded-lg p-4 shadow-sm flex flex-col transition-all hover:shadow-md hover:-translate-y-1';
            
            let chartsHTML = `<div class="flex-grow mt-4 pt-4 border-t">
                                    <h4 class="text-xs text-center font-bold text-gray-500 mb-1">Evolución de Fuerza (RM)</h4>
                                    <div class="min-h-[100px] relative"><canvas id="mini-chart-${movement.id}"></canvas></div>
                                </div>`;

            if (movement.category === 'weightlifting') {
                chartsHTML += `<div class="flex-grow mt-4 pt-4 border-t">
                                    <h4 class="text-xs text-center font-bold text-gray-500 mb-1">Volumen en WODs (Semanal)</h4>
                                    <div class="grid grid-cols-3 gap-2 text-center my-2">
                                            <div class="bg-gray-100 p-2 rounded-lg">
                                                <div class="text-xs text-gray-500">Sem. Anterior</div>
                                                <div id="wod-volume-previous-${movement.id}" class="font-bold text-lg text-gray-800">-</div>
                                            </div>
                                            <div class="bg-green-100 text-green-800 p-2 rounded-lg">
                                                <div class="text-xs font-semibold">Récord Semanal</div>
                                                <div id="wod-volume-record-${movement.id}" class="font-bold text-lg">-</div>
                                            </div>
                                            <div class="bg-gray-100 p-2 rounded-lg">
                                                <div class="text-xs text-gray-500">Sem. Actual</div>
                                                <div id="wod-volume-current-${movement.id}" class="font-bold text-lg text-gray-800">-</div>
                                            </div>
                                    </div>
                                    <div class="min-h-[100px] relative"><canvas id="wod-volume-chart-${movement.id}"></canvas></div>
                                </div>`;
            }

            card.innerHTML = `<div class="flex justify-between items-start"><div class="flex-grow"><h3 class="font-semibold text-lg text-gray-800">${movement.name}</h3><span class="inline-block px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-700 mt-1">${movement.category}</span></div><div class="flex gap-1"><button class="movement-edit p-2 text-gray-400 hover:text-green-500" data-id="${movement.id}"><i class="fas fa-edit"></i></button><button class="movement-delete p-2 text-gray-400 hover:text-red-500" data-id="${movement.id}"><i class="fas fa-trash"></i></button></div></div><div class="mt-3 text-sm text-gray-600"><span>RM Actual:</span><span class="font-medium float-right">${pr ? pr.weight + ' kg' : 'N/A'}</span></div>${chartsHTML}`; 
            
            container.appendChild(card);
            this.renderMovementChart(movement);
            
            if (movement.category === 'weightlifting') {
                this.renderWodVolumeChart(movement);
            }
        });
        container.addEventListener('click', e => {
            const editBtn = e.target.closest('.movement-edit'); const deleteBtn = e.target.closest('.movement-delete');
            if (editBtn) this.showMovementModal(parseInt(editBtn.dataset.id));
            if (deleteBtn) this.deleteMovement(parseInt(deleteBtn.dataset.id));
        });
    },

    renderMovementChart(movement) {
        const chartCtx = document.getElementById(`mini-chart-${movement.id}`).getContext('2d'); 
        let chartConfig = null;
        if (movement.category === 'weightlifting') {
            const dataPoints = this.state.workouts.filter(w => w.type === 'weightlifting' && w.mainMovement === movement.id).map(w => ({ date: this.parseDate(w.date), weight: Math.max(...w.series.map(s => s.weight)) })).sort((a,b) => a.date - b.date);
            if(dataPoints.length > 1) { 
                chartConfig = { type: 'line', data: { labels: dataPoints.map(p => this.formatDate(p.date)), datasets: [{ label: 'Peso Máx (kg)', data: dataPoints.map(p => p.weight), borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', tension: 0.2, fill: true }] } }; 
            }
        } else if (movement.category === 'cardio' || movement.category === 'gymnastics') {
            const now = new Date();
            const currentMonthReps = this.calculateMonthlyReps(movement.id, now.getFullYear(), now.getMonth());
            const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const prevMonthReps = this.calculateMonthlyReps(movement.id, prevMonthDate.getFullYear(), prevMonthDate.getMonth());
            chartConfig = {
                type: 'bar',
                data: {
                    labels: [`Mes Anterior (${prevMonthReps} reps)`, `Mes Actual (${currentMonthReps} reps)`],
                    datasets: [{
                        label: 'Volumen de Reps',
                        data: [prevMonthReps, currentMonthReps],
                        backgroundColor: ['#d1d5db', '#ef4444'],
                        borderColor: ['#9ca3af', '#b91c1c'],
                        borderWidth: 1
                    }]
                },
                options: {
                    indexAxis: 'y',
                    scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false } } },
                    plugins: { legend: { display: false } }
                }
            };
        }
        if(chartConfig) { 
            if (!chartConfig.options) {
                chartConfig.options = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false, beginAtZero: true } } }; 
            }
            this.state.charts[`mini-${movement.id}`] = new Chart(chartCtx, chartConfig); 
        } else { 
            chartCtx.canvas.parentNode.innerHTML = '<p class="text-xs text-gray-400 text-center pt-8">No hay datos de fuerza.</p>'; 
        }
    },

    renderWodVolumeChart(movement) {
        const canvasId = `wod-volume-chart-${movement.id}`;
        const chartEl = document.getElementById(canvasId);
        const currentEl = document.getElementById(`wod-volume-current-${movement.id}`);
        const recordEl = document.getElementById(`wod-volume-record-${movement.id}`);
        const previousEl = document.getElementById(`wod-volume-previous-${movement.id}`);

        if (!chartEl || !currentEl || !recordEl || !previousEl) return;
        
        const weeklyWodVolume = {};

        this.state.workouts
            .filter(w => w.type === 'conditioning' && w.structure)
            .forEach(w => {
                const weekStartDate = this.getStartOfWeek(this.parseDate(w.date));
                const weekKey = this.formatDate(weekStartDate);

                w.structure.forEach(m => {
                    if (m.id === movement.id && m.weight && parseFloat(m.weight) > 0) {
                        const volume = (parseInt(m.reps) || 0) * (parseFloat(m.weight) || 0);
                        if (volume > 0) {
                            if (!weeklyWodVolume[weekKey]) weeklyWodVolume[weekKey] = 0;
                            weeklyWodVolume[weekKey] += volume;
                        }
                    }
                });
            });

        const sortedKeys = Object.keys(weeklyWodVolume).sort((a,b) => this.parseDate(a) - this.parseDate(b));

        if (sortedKeys.length === 0) {
            chartEl.parentNode.innerHTML = '<p class="text-xs text-gray-400 text-center pt-8">Sin datos de volumen en WODs.</p>';
            currentEl.textContent = '0 kg';
            recordEl.textContent = '0 kg';
            previousEl.textContent = '0 kg';
            return;
        }

        const data = sortedKeys.map(key => weeklyWodVolume[key]);
        const recordVolume = Math.max(...data);
        
        const currentWeekKey = this.formatDate(this.getStartOfWeek(new Date()));
        const previousWeekDate = new Date();
        previousWeekDate.setDate(previousWeekDate.getDate() - 7);
        const previousWeekKey = this.formatDate(this.getStartOfWeek(previousWeekDate));

        const currentWeekVolume = weeklyWodVolume[currentWeekKey] || 0;
        const previousWeekVolume = weeklyWodVolume[previousWeekKey] || 0;

        currentEl.textContent = `${Math.round(currentWeekVolume)} kg`;
        recordEl.textContent = `${Math.round(recordVolume)} kg`;
        previousEl.textContent = `${Math.round(previousWeekVolume)} kg`;
        
        if (this.state.charts[canvasId]) this.state.charts[canvasId].destroy();

        this.state.charts[canvasId] = new Chart(chartEl.getContext('2d'), {
            type: 'bar',
            data: {
                labels: sortedKeys.map(key => `Sem. ${key}`),
                datasets: [{
                    label: 'Volumen Total (kg)',
                    data: data,
                    backgroundColor: '#60a5fa'
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } }, 
                scales: { 
                    x: { display: false }, 
                    y: { display: false, beginAtZero: true } 
                } 
            }
        });
    },
    
    calculateMonthlyReps(movementId, year, month) {
        return this.state.workouts
            .filter(w => {
                const d = this.parseDate(w.date);
                return d.getFullYear() === year && d.getMonth() === month && w.type === 'conditioning' && w.structure;
            })
            .reduce((totalReps, w) => {
                const movementReps = w.structure
                    .filter(m => m.id === movementId)
                    .reduce((sum, m) => sum + (parseInt(m.reps, 10) || 0), 0);
                return totalReps + movementReps;
            }, 0);
    },
    renderWodTypeDistributionChart() {
        const chartEl = document.getElementById('wodTypeDistributionChart');
        if (!chartEl) return;
        const wodTypes = this.state.workouts.filter(w => w.type === 'conditioning' && w.wodType && w.wodType !== 'Warm-up' && w.wodType !== 'Cooldown').map(w => w.wodType);
        if (wodTypes.length === 0) {
            chartEl.parentNode.innerHTML = '<p class="text-center text-gray-500 pt-16">No hay datos de WODs para mostrar.</p>';
            return;
        }
        const typeCounts = wodTypes.reduce((acc, type) => { acc[type] = (acc[type] || 0) + 1; return acc; }, {});
        this.state.charts.wodDistribution = new Chart(chartEl.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(typeCounts),
                datasets: [{
                    label: 'Distribución de WODs',
                    data: Object.values(typeCounts),
                    backgroundColor: ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6'],
                    borderColor: '#ffffff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) { label += ': '; }
                                if (context.parsed !== null) {
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = total > 0 ? (context.raw / total * 100).toFixed(1) + '%' : '0%';
                                    label += `${context.raw} (${percentage})`;
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    },
    showAddWorkoutModal(dateStr = null) { this.state.editingDate = dateStr; const modal = document.getElementById('add-workout-modal'); const host = document.getElementById('modal-content-host'); host.innerHTML = `<div class="p-6 border-b"><div class="flex justify-between items-center mb-4"><h2 class="text-xl font-bold text-gray-800">${this.state.editingDate ? 'Modificar' : 'Registrar'} Sesión</h2><button onclick="App.hideAddWorkoutModal()" class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button></div><div><label class="block text-sm font-medium text-gray-700 mb-1">Fecha</label><input type="text" id="workout-date-picker" class="w-full p-2 border rounded-lg"></div></div><div class="p-6 flex-grow overflow-y-auto"><div class="flex items-center space-x-2 p-1 bg-gray-200 rounded-lg mb-4"><button class="modal-tab-btn flex-1" data-tab="warmup" style="background-color: #f6e05e; color: #975a16;">Warm Up</button><button class="modal-tab-btn flex-1" data-tab="weightlifting" style="background-color: #68d391; color: #1f4b2a;">Weightlifting</button><button class="modal-tab-btn flex-1" data-tab="wod" style="background-color: #f687b3; color: #831843;">WOD</button><button class="modal-tab-btn flex-1" data-tab="cooldown" style="background-color: #76e4f7; color: #1a4e8a;">Cooldown</button></div><div id="warmup-tab-panel" class="modal-tab-panel space-y-4"><h3 class="font-bold text-lg text-yellow-700">Calentamiento</h3><textarea id="warmup-text" class="w-full p-2 rounded border border-gray-300" rows="8" placeholder="Escribe tu rutina de calentamiento..."></textarea></div><div id="weightlifting-tab-panel" class="modal-tab-panel space-y-4"></div><div id="wod-tab-panel" class="modal-tab-panel space-y-4"></div><div id="cooldown-tab-panel" class="modal-tab-panel space-y-4"><h3 class="font-bold text-lg text-blue-700">Enfriamiento</h3><textarea id="cooldown-text" class="w-full p-2 rounded border border-gray-300" rows="8" placeholder="Escribe tu rutina de enfriamiento..."></textarea></div></div><div class="p-6 border-t bg-gray-50 rounded-b-lg"><button id="save-session-btn" class="w-full py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-all"><i class="fas fa-save mr-2"></i>Guardar Sesión</button></div>`; this.injectFormsIntoModal(); this.initModalEventListeners(dateStr); modal.classList.remove('hidden'); },
    hideAddWorkoutModal() { document.getElementById('add-workout-modal').classList.add('hidden'); if(this.state.flatpickr) { this.state.flatpickr.destroy(); this.state.flatpickr = null; } this.state.editingDate = null; },
    injectFormsIntoModal() { const wlContainer = document.getElementById('weightlifting-tab-panel'); wlContainer.innerHTML = `<h3 class="font-bold text-lg text-green-700">Levantamiento de Peso</h3><div><label class="block text-sm font-medium text-gray-700 mb-1">Movimiento</label><select id="wlMainMovement" class="w-full px-4 py-2 border rounded-lg"></select></div><div><label class="block text-sm font-medium text-gray-700 mb-1">Nº de Series</label><input type="number" id="wlRounds" value="3" class="w-full px-4 py-2 border rounded-lg"></div><div id="wlSeriesContainer" class="space-y-3"></div><div id="estimatedRM" class="p-3 bg-blue-100 text-blue-800 rounded-lg text-center font-semibold hidden"></div><div><label class="block text-sm font-medium text-gray-700 mb-1">RPE</label><div class="rpe-emojis flex justify-around bg-gray-100 p-2 rounded-lg">${[...Array(10)].map((_,i) => `<span class="rpe-emoji" data-rpe="${i+1}">${['😊','🙂','😐','😕','😓','😫','😖','😣','😩','🤯'][i]}</span>`).join('')}</div><input type="hidden" id="wlRpe" value="5"></div>`; const wodContainer = document.getElementById('wod-tab-panel'); wodContainer.innerHTML = `<h3 class="font-bold text-lg text-pink-700">WOD</h3><div><label class="block text-sm font-medium text-gray-700 mb-1">Tipo</label><select id="condType" class="w-full p-2 border rounded-lg"><option value="AMRAP">AMRAP</option><option value="For Time">For Time</option><option value="EMOM">EMOM</option><option value="Tabata">Tábata</option><option value="Custom">Otro</option></select></div><div><label class="block text-sm font-medium text-gray-700 mb-1">Descripción</label><textarea id="condDescription" rows="3" class="w-full p-2 border rounded-lg" placeholder="Ej: 5 Rondas de..."></textarea></div><div class="p-3 border rounded-lg bg-gray-50"><label class="block text-sm font-medium text-gray-700 mb-2">Movimientos (opcional)</label><div id="added-movements-list" class="space-y-2 mb-3"></div><div class="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end"><select id="new-mov-id" class="w-full p-2 border rounded-lg text-sm sm:col-span-2"></select><input type="number" id="new-mov-reps" placeholder="Reps" class="w-full p-2 border rounded-lg text-sm"><input type="text" id="new-mov-weight" placeholder="Peso (kg)" class="w-full p-2 border rounded-lg text-sm"><button type="button" id="add-movement-btn" class="sm:col-span-2 w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">Añadir</button></div></div><div><label class="block text-sm font-medium text-gray-700 mb-1">Resultado</label><input type="text" id="condResult" class="w-full p-2 border rounded-lg" placeholder="Ej: 12:45 o 150 reps"></div><div><label class="block text-sm font-medium text-gray-700 mb-1">RPE</label><div class="rpe-emojis flex justify-around bg-gray-100 p-2 rounded-lg">${[...Array(10)].map((_,i) => `<span class="rpe-emoji" data-rpe="${i+1}">${['😊','🙂','😐','😕','😓','😫','😖','😣','😩','🤯'][i]}</span>`).join('')}</div><input type="hidden" id="condRpe" value="5"></div>`; },
    initModalEventListeners(dateStr) { const modal = document.getElementById('add-workout-modal'); if(!modal) return; this.state.flatpickr = flatpickr("#workout-date-picker", { locale: 'es', dateFormat: 'd/m/Y', defaultDate: dateStr ? this.parseDate(dateStr) : new Date() }); modal.querySelector('#save-session-btn').addEventListener('click', () => this.saveSession()); const tabs = modal.querySelectorAll('.modal-tab-btn'); const panels = modal.querySelectorAll('.modal-tab-panel'); tabs.forEach(tab => tab.addEventListener('click', () => { tabs.forEach(t => t.classList.remove('active')); panels.forEach(p => p.classList.remove('active')); tab.classList.add('active'); modal.querySelector(`#${tab.dataset.tab}-tab-panel`).classList.add('active'); })); tabs[0].click(); const wlForm = modal.querySelector('#weightlifting-tab-panel'); if(wlForm) { wlForm.querySelector('#wlRounds')?.addEventListener('change', () => this.renderWeightliftingSeries()); wlForm.querySelector('#wlSeriesContainer')?.addEventListener('input', () => this.calculate1RMEstimate()); this.initFormSelects(); this.renderWeightliftingSeries(); } const wodForm = modal.querySelector('#wod-tab-panel'); if(wodForm) { wodForm.querySelector('#add-movement-btn')?.addEventListener('click', () => this.addMovementToWod()); wodForm.querySelector('#added-movements-list')?.addEventListener('click', e => { if (e.target.closest('.remove-movement-btn')) e.target.closest('.added-movement-item').remove(); }); this.initFormSelects(); } modal.querySelectorAll('.rpe-emojis').forEach(c => c.addEventListener('click', e => { if (e.target.classList.contains('rpe-emoji')) { const rpe = e.target.dataset.rpe; const panel = e.target.closest('.modal-tab-panel'); if(panel.querySelector('input[type="hidden"]')) { panel.querySelector('input[type="hidden"]').value = rpe; panel.querySelectorAll('.rpe-emoji').forEach(emo => emo.classList.remove('rpe-selected')); e.target.classList.add('rpe-selected'); } } })); if(this.state.editingDate) { const dayWorkouts = this.state.workouts.filter(w => w.date === this.state.editingDate); dayWorkouts.forEach(w => { if(w.wodType === 'Warm-up') modal.querySelector('#warmup-text').value = w.description; if(w.wodType === 'Cooldown') modal.querySelector('#cooldown-text').value = w.description; if(w.type === 'weightlifting') this.populateWeightliftingForm(w); if(w.type === 'conditioning' && w.wodType !== 'Warm-up' && w.wodType !== 'Cooldown') this.populateWodForm(w); }); } },
    populateWeightliftingForm(workout) { const modal = document.getElementById('add-workout-modal'); modal.querySelector('#wlMainMovement').value = workout.mainMovement; modal.querySelector('#wlRounds').value = workout.series.length; this.renderWeightliftingSeries(); workout.series.forEach((s, index) => { const seriesItem = modal.querySelectorAll('#wlSeriesContainer .series-item')[index]; if(seriesItem) { seriesItem.querySelector('.series-reps').value = s.reps; seriesItem.querySelector('.series-weight').value = s.weight; } }); modal.querySelector('#wlRpe').value = workout.rpe; const rpeEmoji = modal.querySelector(`#weightlifting-tab-panel .rpe-emoji[data-rpe="${workout.rpe}"]`); if(rpeEmoji) rpeEmoji.classList.add('rpe-selected'); },
    populateWodForm(workout) { const modal = document.getElementById('add-workout-modal'); modal.querySelector('#condType').value = workout.wodType; modal.querySelector('#condDescription').value = workout.description; modal.querySelector('#condResult').value = workout.result; const list = modal.querySelector('#added-movements-list'); list.innerHTML = ''; if (workout.structure) { workout.structure.forEach(mov => { this.addMovementToWod(mov, true); }); } modal.querySelector('#condRpe').value = workout.rpe; const rpeEmoji = modal.querySelector(`#wod-tab-panel .rpe-emoji[data-rpe="${workout.rpe}"]`); if(rpeEmoji) rpeEmoji.classList.add('rpe-selected'); },
    saveSession() { const modal = document.getElementById('add-workout-modal'); if(!modal) return; const date = modal.querySelector('#workout-date-picker').value; let workoutsAdded = 0; if (this.state.editingDate) { this.state.workouts = this.state.workouts.filter(w => w.date !== this.state.editingDate); } const warmupText = modal.querySelector('#warmup-text').value; if (warmupText.trim()) { this.state.workouts.push({ id: Date.now() + 1, type: 'conditioning', wodType: 'Warm-up', description: warmupText, structure: [], result: 'Completado', rpe: 3, date }); workoutsAdded++; } const wlSeries = []; modal.querySelectorAll('#wlSeriesContainer .series-item').forEach(item => { const reps = item.querySelector('.series-reps').value; const weight = item.querySelector('.series-weight').value; if(reps && weight) wlSeries.push({reps:parseInt(reps), weight:parseFloat(weight)}); }); if (wlSeries.length > 0) { const wlMovement = modal.querySelector('#wlMainMovement').value; this.state.workouts.push({ id: Date.now() + 2, type: 'weightlifting', mainMovement: parseInt(wlMovement), series: wlSeries, rpe: parseInt(modal.querySelector('#wlRpe').value), date }); workoutsAdded++; } const wodResult = modal.querySelector('#condResult').value; if (wodResult && wodResult.trim()) { const structure = []; modal.querySelectorAll('#added-movements-list .added-movement-item').forEach(item => { structure.push({ id: parseInt(item.dataset.id), reps: parseInt(item.dataset.reps), weight: item.dataset.weight || '' }); }); this.state.workouts.push({ id: Date.now() + 3, type: 'conditioning', wodType: modal.querySelector('#condType').value, description: modal.querySelector('#condDescription').value, structure, result: wodResult, rpe: parseInt(modal.querySelector('#condRpe').value), date }); workoutsAdded++; } const cooldownText = modal.querySelector('#cooldown-text').value; if (cooldownText.trim()) { this.state.workouts.push({ id: Date.now() + 4, type: 'conditioning', wodType: 'Cooldown', description: cooldownText, structure: [], result: 'Completado', rpe: 2, date }); workoutsAdded++; } if (workoutsAdded > 0) { this.saveData(); this.showToast(`¡Sesión del ${date} guardada!`, 'success'); this.hideAddWorkoutModal(); } else if (this.state.editingDate) { this.saveData(); this.showToast(`Entrenamientos del ${date} eliminados.`, 'info'); this.hideAddWorkoutModal(); } else { this.showToast('No se ha introducido ningún dato para guardar.', 'error'); } },
    editDay(dateStr) { this.state.editingDate = dateStr; this.showAddWorkoutModal(dateStr); },
    deleteWorkout(workoutId) { if (confirm('¿Estás seguro de que quieres eliminar este bloque de entrenamiento?')) { this.state.workouts = this.state.workouts.filter(w => w.id !== workoutId); this.saveData(); this.showToast('Bloque eliminado.', 'info'); } },
    parseDate(dateString) { if(!dateString) return new Date(); const [day, month, year] = dateString.split('/'); return new Date(year, month - 1, day); },
    formatDate(dateObj, short=false, separator='/') {
        if(!dateObj || isNaN(dateObj.getTime())) return '';
        if(short) return dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        if (separator === '-') return [year, month, day].join(separator);
        return [day, month, year].join(separator);
    },
    isToday(date) { return new Date().toDateString() === date.toDateString(); },
    addMovementToWod(mov = null, fromEdit = false) {
        const modal = document.getElementById('add-workout-modal');
        const container = modal.querySelector('#added-movements-list');
        let id, name, reps, weight;
        if(mov) { id = mov.id; name = this.getMovementName(mov.id); reps = mov.reps; weight = mov.weight; }
        else { id = modal.querySelector('#new-mov-id').value; name = modal.querySelector('#new-mov-id').options[modal.querySelector('#new-mov-id').selectedIndex].text; reps = modal.querySelector('#new-mov-reps').value; weight = modal.querySelector('#new-mov-weight').value; }
        if (!reps) { this.showToast('Las repeticiones son obligatorias.', 'error'); return; }
        const item = document.createElement('div');
        item.className = 'added-movement-item flex justify-between items-center bg-white p-2 rounded border text-sm';
        item.dataset.id = id; item.dataset.reps = reps; item.dataset.weight = weight || '';
        item.innerHTML = `<span><strong>${reps}</strong> ${name} ${weight ? `@ ${weight}kg` : ''}</span><button type="button" class="remove-movement-btn text-red-500 hover:text-red-700 text-lg">&times;</button>`;
        container.appendChild(item);
        if(!fromEdit) {
            modal.querySelector('#new-mov-id').selectedIndex = 0;
            modal.querySelector('#new-mov-reps').value = '';
            modal.querySelector('#new-mov-weight').value = '';
        }
    },
    renderWeightliftingSeries() { const modal = document.getElementById('add-workout-modal'); const container = modal.querySelector('#wlSeriesContainer'); if (!container) return; const count = modal.querySelector('#wlRounds').value; container.innerHTML = ''; for(let i=1;i<=count;i++) container.innerHTML += `<div class="series-item p-3 bg-gray-50 rounded-lg border"><div class="flex items-center space-x-3"><span class="w-16">Serie ${i}</span><input type="number" min="1" placeholder="Reps" class="px-3 py-1 border rounded w-full series-reps"><span class="mx-1">x</span><input type="number" step="0.25" min="0" placeholder="Peso (kg)" class="px-3 py-1 border rounded w-full series-weight"></div></div>`; },
    calculate1RMEstimate() { const modal = document.getElementById('add-workout-modal'); const estimates = []; modal.querySelectorAll('#wlSeriesContainer .series-item').forEach(item => { const reps = parseInt(item.querySelector('.series-reps').value); const weight = parseFloat(item.querySelector('.series-weight').value); if (reps > 0 && reps <= 10 && weight > 0) estimates.push(weight / (1.0278 - (0.0278 * reps))); }); const maxEstimate = Math.max(0, ...estimates); const rmDiv = modal.querySelector('#estimatedRM'); if (rmDiv) { rmDiv.textContent = `1RM Estimado: ${maxEstimate.toFixed(1)} kg`; rmDiv.classList.toggle('hidden', maxEstimate <= 0); } },
    calculateAllPRs() { const prs = {}; this.state.workouts.filter(w => w.type === 'weightlifting' && w.series).forEach(w => w.series.forEach(s => { if (s.reps === 1 && (!prs[w.mainMovement] || s.weight > prs[w.mainMovement].weight)) { prs[w.mainMovement] = { movementId: w.mainMovement, weight: s.weight, date: w.date }; } })); this.state.personalRecords = Object.values(prs); },
    checkNewPRs(oldPRs, newPRs) { newPRs.forEach(newPr => { const oldPr = oldPRs.find(p => p.movementId === newPr.movementId); if (!oldPr || newPr.weight > oldPr.weight) { this.showRMAnimation(this.getMovementName(newPr.movementId), newPr.weight); } }); },
    getMovementOptions() { return this.state.movements.sort((a,b) => a.name.localeCompare(b.name)).map(m=>`<option value="${m.id}">${m.name}</option>`).join(''); },
    initFormSelects() { const modal = document.getElementById('add-workout-modal'); if(!modal) return; const wlSelect = modal.querySelector('#wlMainMovement'); if (wlSelect) wlSelect.innerHTML = this.getMovementOptions(); const wodSelect = modal.querySelector('#new-mov-id'); if (wodSelect) wodSelect.innerHTML = this.getMovementOptions(); },
    getMovementCategory(id) { const mov = this.state.movements.find(m => m.id === parseInt(id)); return mov ? mov.category : null; },
    getMovementName(id) { const mov = this.state.movements.find(m => m.id === parseInt(id)); return mov ? mov.name : 'Movimiento eliminado'; },
    showMovementModal(id=null) {
        const isEditing = id !== null;
        const movement = isEditing ? this.state.movements.find(m => m.id === id) : {};
        const modalContainer = document.getElementById('add-workout-modal');
        const host = document.getElementById('modal-content-host');
        host.innerHTML = `<div class="p-6 border-b"><div class="flex justify-between items-center"><h3 class="text-lg font-semibold">${isEditing?'Editar':'Añadir'} Movimiento</h3><button onclick="App.hideAddWorkoutModal()" class="text-2xl">&times;</button></div></div><form id="movementForm" class="p-6 flex-grow"><div class="mb-4"><label class="block mb-2">Nombre</label><input type="text" id="movementName" class="w-full p-2 border rounded" value="${movement.name||''}" required></div><div class="mb-4"><label class="block mb-2">Categoría</label><select id="movementCategory" class="w-full p-2 border rounded"><option value="weightlifting">Weightlifting</option><option value="gymnastics">Gymnastics</option><option value="cardio">Cardio</option></select></div><div class="flex justify-end gap-3 pt-6 border-t"><button type="button" onclick="App.hideAddWorkoutModal()" class="px-4 py-2 bg-gray-200 rounded">Cancelar</button><button type="submit" class="px-4 py-2 bg-red-600 text-white rounded">Guardar</button></div></form></div>`;
        modalContainer.classList.remove('hidden');

        const modal = modalContainer.querySelector('#modal-content-host');
        modal.querySelector('#movementCategory').value = movement.category || 'weightlifting';
        modal.querySelector('#movementForm').addEventListener('submit', e => {
            e.preventDefault();
            const name = modal.querySelector('#movementName').value.trim();
            const category = modal.querySelector('#movementCategory').value;
            if(!name) { this.showToast('El nombre es obligatorio', 'error'); return; }
            if(isEditing) {
                const index = this.state.movements.findIndex(m=>m.id===id);
                this.state.movements[index] = {...this.state.movements[index], name, category};
            } else {
                this.state.movements.push({ id: Date.now(), name, category });
            }
            this.saveData();
            this.showToast(`Movimiento ${isEditing?'actualizado':'guardado'}`, 'success');
            this.hideAddWorkoutModal();
        });
    },
    deleteMovement(id) { if(confirm('¿Seguro que quieres eliminar este movimiento? Se borrará de los entrenamientos guardados.')) { this.state.movements = this.state.movements.filter(m => m.id !== id); this.saveData(); this.showToast('Movimiento eliminado', 'info'); } },
    showToast(message, type='info', iconClass = null) { const toast = document.createElement('div'); const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle'}; const icon = iconClass || `fas ${icons[type]}`; toast.className = `toast toast-${type}`; toast.innerHTML = `<i class="${icon}"></i><span>${message}</span>`; document.getElementById('toast-container').appendChild(toast); setTimeout(() => toast.classList.add('show'), 10); setTimeout(() => { toast.classList.remove('show'); toast.addEventListener('transitionend', () => toast.remove()); }, 4000); },
    showRMAnimation(movementName, weight) { const celebrationEl = document.getElementById('rm-celebration'); if(!celebrationEl) return; celebrationEl.innerHTML = `<div class="rm-card"><i class="fas fa-trophy rm-trophy"></i><h2 class="text-3xl font-bold mt-4">¡NUEVO RM!</h2><p class="text-xl mt-2">${movementName}</p><p class="text-5xl font-bold text-yellow-300 mt-1">${weight} kg</p></div>`; celebrationEl.classList.add('show'); setTimeout(() => celebrationEl.classList.remove('show'), 3500); },
    destroyCharts() { Object.values(this.state.charts).forEach(chart => {if(chart && typeof chart.destroy === 'function') chart.destroy()}); this.state.charts = {}; },
    renderTopMovementsCharts() { this.renderTopMovementsForMonth(0, 'topMovementsCurrentMonthChart'); this.renderTopMovementsForMonth(1, 'topMovementsLastMonthChart'); },
    renderTopMovementsForMonth(monthOffset, canvasId) { const chartEl = document.getElementById(canvasId); if (!chartEl) return; const now = new Date(); const targetMonth = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1); const targetYear = targetMonth.getFullYear(); const targetMonthNum = targetMonth.getMonth(); const workoutsForMonth = this.state.workouts.filter(w => { const d = this.parseDate(w.date); return d.getFullYear() === targetYear && d.getMonth() === targetMonthNum; }); if (workoutsForMonth.length === 0) { const label = monthOffset === 0 ? 'actual' : 'anterior'; chartEl.parentNode.innerHTML = `<p class="text-center text-gray-500 pt-16">No hay datos para el mes ${label}.</p>`; return; } const movementReps = {}; workoutsForMonth.forEach(w => { if (w.type === 'weightlifting') { const totalReps = w.series.reduce((sum, s) => sum + s.reps, 0); movementReps[w.mainMovement] = (movementReps[w.mainMovement] || 0) + totalReps; } else if (w.type === 'conditioning' && w.structure) { w.structure.forEach(m => { movementReps[m.id] = (movementReps[m.id] || 0) + m.reps; }); } }); const sortedMovements = Object.entries(movementReps).sort(([,a],[,b]) => b - a).slice(0, 10); this.state.charts[canvasId] = new Chart(chartEl.getContext('2d'), { type: 'bar', data: { labels: sortedMovements.map(([id]) => this.getMovementName(id)), datasets: [{ label: 'Total Reps', data: sortedMovements.map(([,reps]) => reps), backgroundColor: '#ef4444' }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } }); },
    renderRpeEvolutionChart() { const chartEl = document.getElementById('rpeEvolutionChart'); if (!chartEl) return; const monthlyRPE = {}; this.state.workouts.forEach(w => { const date = this.parseDate(w.date); const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; if (!monthlyRPE[monthKey]) monthlyRPE[monthKey] = { total: 0, count: 0 }; if (w.rpe) { monthlyRPE[monthKey].total += w.rpe; monthlyRPE[monthKey].count++; } }); const sortedKeys = Object.keys(monthlyRPE).sort(); this.state.charts.rpeEvolution = new Chart(chartEl.getContext('2d'), { type: 'line', data: { labels: sortedKeys.map(key => new Date(key + '-02').toLocaleString('es-ES', { month: 'short', year: '2-digit' })), datasets: [{ label: 'RPE Promedio', data: sortedKeys.map(key => monthlyRPE[key].count > 0 ? (monthlyRPE[key].total / monthlyRPE[key].count).toFixed(1) : 0), borderColor: '#f97316', tension: 0.3, fill: false }] }, options: { scales: { y: { beginAtZero: false, max: 10 } } } }); },
    getStartOfWeek(date) { const d = new Date(date); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); return new Date(d.setDate(diff)); },
    renderWeeklyCategoryVolumeChart() { const chartEl = document.getElementById('weeklyCategoryVolumeChart'); if (!chartEl) return; const weeklyData = {}; const today = new Date(); for(let i = 7; i >= 0; i--) { const d = this.getStartOfWeek(new Date(new Date().setDate(new Date().getDate() - (i*7)))); weeklyData[this.formatDate(d)] = { weightlifting: 0, gymnastics: 0, cardio: 0 }; } this.state.workouts.forEach(w => { const weekKey = this.formatDate(this.getStartOfWeek(this.parseDate(w.date))); if (weeklyData.hasOwnProperty(weekKey)) { if (w.type === 'weightlifting' && w.series) { const cat = this.getMovementCategory(w.mainMovement); if(cat && weeklyData[weekKey].hasOwnProperty(cat)) { weeklyData[weekKey][cat] += w.series.reduce((s,c) => s+c.reps,0); } } else if (w.type === 'conditioning' && w.structure) { w.structure.forEach(m => { const cat = this.getMovementCategory(m.id); if(cat && weeklyData[weekKey].hasOwnProperty(cat)) { weeklyData[weekKey][cat] += m.reps; } }); } } }); const labels = Object.keys(weeklyData); this.state.charts.weeklyVolume = new Chart(chartEl.getContext('2d'), { type: 'bar', data: { labels, datasets: [ { label: 'Weightlifting', data: labels.map(k => weeklyData[k].weightlifting), backgroundColor: '#68d391' }, { label: 'Gymnastics', data: labels.map(k => weeklyData[k].gymnastics), backgroundColor: '#76e4f7' }, { label: 'Cardio', data: labels.map(k => weeklyData[k].cardio), backgroundColor: '#f687b3' } ] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } } }); },
    renderWeeklyWeightVolumeChart(canvasId) {
        const chartEl = document.getElementById(canvasId); if (!chartEl) return;
        const weeklyVolume = {};
        for(let i = 7; i >= 0; i--) { const d = this.getStartOfWeek(new Date(new Date().setDate(new Date().getDate() - (i*7)))); weeklyVolume[this.formatDate(d)] = 0; }
        this.state.workouts.filter(w => w.type === 'weightlifting' && w.series).forEach(w => { const weekKey = this.formatDate(this.getStartOfWeek(this.parseDate(w.date))); if (weeklyVolume.hasOwnProperty(weekKey)) { weeklyVolume[weekKey] += w.series.reduce((total, s) => total + (s.reps * s.weight), 0); } });
        const labels = Object.keys(weeklyVolume);
        this.state.charts[canvasId] = new Chart(chartEl.getContext('2d'), { type: 'bar', data: { labels, datasets: [{ label: 'Volumen (kg)', data: labels.map(k => weeklyVolume[k]), backgroundColor: '#4ade80'}] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.raw.toFixed(0)} kg` } } } } });
    },
};
App.init();

    </script>
</body>
</html>