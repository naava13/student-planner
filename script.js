// --- DOM ELEMENTS & CONSTANTS ---
// Auth & Navigation
const loginPage = document.getElementById('loginPage');
const signupPage = document.getElementById('signupPage');
const appView = document.getElementById('appView');
const sections = document.querySelectorAll('.section');
const navLinks = document.querySelectorAll('.sidebar-nav a');

// Task Management
const allTasksList = document.getElementById('allTasksList');
const newTaskInput = document.getElementById('newTaskInput');
const filterButtons = document.querySelectorAll('.filter-btn');
const openTaskModalBtn = document.getElementById('openTaskModalBtn');

// Dashboard Elements
const tasksTodayCountDisplay = document.getElementById('tasksTodayCount');
const totalTasksCountDisplay = document.getElementById('totalTasksCount');
const timerStatusDisplay = document.getElementById('timerStatusDisplay');
const upcomingTasksList = document.getElementById('upcomingTasksList');
const monthlyGoalsList = document.getElementById('monthlyGoalsList');
const completedTasksCountDisplay = document.getElementById('completedTasksCount');
const focusSessionsCountDisplay = document.getElementById('focusSessionsCount');
const monthlyGoalsProgressDisplay = document.getElementById('monthlyGoalsProgress');

// Timer
const timerDisplay = document.getElementById('timerDisplay');
const timerProgressCircle = document.querySelector('.timer-circle .progress');
const startTimerBtn = document.getElementById('startTimerBtn');
const pauseTimerBtn = document.getElementById('pauseTimerBtn');
const resetTimerBtn = document.getElementById('resetTimerBtn');
const totalTime = 25 * 60; // 25 minutes in seconds

// Task Modal
const taskModal = document.getElementById('taskModal');
const taskForm = document.getElementById('taskForm');
const taskNameInput = document.getElementById('taskName');
const taskFrequencySelect = document.getElementById('taskFrequency');
const oneTimeFields = document.getElementById('oneTimeFields');
const taskDateInput = document.getElementById('taskDate');
const taskTimeSelect = document.getElementById('taskTime');
const monthlyScheduleOptions = document.getElementById('monthlyScheduleOptions');
const monthlyTimeSelect = document.getElementById('monthlyTime');
const monthlyDayCheckboxes = document.querySelectorAll('#monthlyScheduleOptions input[type="checkbox"]');
const closeBtn = document.querySelector('.close-btn');
const taskCategorySelect = document.getElementById('taskCategory');

// Pop-up & Calendar
const taskDetailsPopup = document.getElementById('task-details-popup');
const popupDate = document.getElementById('popup-date');
const popupTaskList = document.getElementById('popup-task-list');
const closePopupBtn = document.querySelector('.close-popup-btn');
const addTaskToDayBtn = document.getElementById('addTaskToDayBtn');
const daysContainer = document.getElementById('calendarDays');
const monthAndYearDisplay = document.getElementById('monthAndYear');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');

// Insights Chart
const categoryChartCanvas = document.getElementById('categoryChart');
let categoryChart;


// --- APP STATE ---
let appState = {
    activeView: 'login',
    activeSection: 'dashboard',
    timerInterval: null,
    timerSeconds: totalTime,
    tasks: [], // one-time tasks
    monthlyGoals: [], // monthly recurring tasks
    focusSessions: 0,
    completedTasks: 0,
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    notificationTimeouts: [], // Store timeout IDs for cleanup
};


// --- NOTIFICATIONS ---
let notificationPermissionRequested = false;

async function requestNotificationPermission() {
    if (!notificationPermissionRequested && 'Notification' in window && Notification.permission === 'default') {
        notificationPermissionRequested = true;
        try {
            await Notification.requestPermission();
        } catch (error) {
            console.warn('Failed to request notification permission:', error);
        }
    }
}

function showNotification(title, body, icon = null) {
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            const notification = new Notification(title, { 
                body,
                icon: icon || '/favicon.ico',
                badge: '/favicon.ico'
            });
            
            // Auto-close notification after 5 seconds
            setTimeout(() => notification.close(), 5000);
            
            return notification;
        } catch (error) {
            console.warn('Failed to show notification:', error);
        }
    }
}

function clearNotificationTimeouts() {
    appState.notificationTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    appState.notificationTimeouts = [];
}

function scheduleTaskNotification(task) {
    if (!task || task.completed) return;

    try {
        if (task.frequency === 'one-time' && task.date && task.time) {
            const dueDateTime = new Date(`${task.date}T${task.time}`);
            const reminderTime = dueDateTime.getTime() - 60 * 60 * 1000; // 1 hour before
            const now = Date.now();
            
            if (reminderTime > now && dueDateTime > now) {
                const delay = reminderTime - now;
                const timeoutId = setTimeout(() => {
                    showNotification(
                        "Task Reminder", 
                        `${task.name} is due in 1 hour!`
                    );
                }, delay);
                appState.notificationTimeouts.push(timeoutId);
            }
        }
        
        // For monthly tasks, check daily if today matches
        if (task.frequency === 'monthly' && task.days && task.days.length > 0 && task.time) {
            const checkDailyTimeoutId = setTimeout(() => {
                checkMonthlyTaskReminders(task);
            }, getMillisecondsUntilMidnight());
            appState.notificationTimeouts.push(checkDailyTimeoutId);
        }
    } catch (error) {
        console.warn('Failed to schedule notification for task:', task.name, error);
    }
}

function checkMonthlyTaskReminders(task) {
    const now = new Date();
    const todayDay = now.toLocaleString('en-US', { weekday: 'short' });
    
    if (task.days.includes(todayDay) && task.time) {
        const [hours, minutes] = task.time.split(':').map(Number);
        const reminderTime = new Date();
        reminderTime.setHours(hours - 1, minutes, 0, 0);
        
        if (reminderTime > now) {
            const delay = reminderTime.getTime() - now.getTime();
            const timeoutId = setTimeout(() => {
                showNotification(
                    "Monthly Task Reminder", 
                    `${task.name} starts in 1 hour!`
                );
            }, delay);
            appState.notificationTimeouts.push(timeoutId);
        }
    }
    
    // Schedule next daily check
    const nextCheckTimeoutId = setTimeout(() => {
        checkMonthlyTaskReminders(task);
    }, getMillisecondsUntilMidnight());
    appState.notificationTimeouts.push(nextCheckTimeoutId);
}

function getMillisecondsUntilMidnight() {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    return midnight.getTime() - now.getTime();
}

function scheduleAllTaskNotifications() {
    clearNotificationTimeouts();
    [...appState.tasks, ...appState.monthlyGoals].forEach(task => {
        scheduleTaskNotification(task);
    });
}


// --- PERSISTENCE ---
function saveState() {
    // Don't save timeout IDs as they can't be restored
    const stateToSave = { ...appState };
    delete stateToSave.notificationTimeouts;
    localStorage.setItem('studentPlannerState', JSON.stringify(stateToSave));
}

function loadState() {
    try {
        const savedState = localStorage.getItem('studentPlannerState');
        if (savedState) {
            const parsed = JSON.parse(savedState);
            appState = { ...appState, ...parsed };
            appState.notificationTimeouts = []; // Reset timeouts
        }
    } catch (error) {
        console.error('Failed to load state from localStorage:', error);
    }
}


// --- VIEW MANAGEMENT ---
function switchView(viewName) {
    loginPage.classList.add('hidden');
    signupPage.classList.add('hidden');
    appView.classList.add('hidden');

    switch (viewName) {
        case 'login':
            loginPage.classList.remove('hidden');
            break;
        case 'signup':
            signupPage.classList.remove('hidden');
            break;
        case 'app':
            appView.classList.remove('hidden');
            break;
    }
    appState.activeView = viewName;
    saveState();
}

function switchSection(sectionId) {
    sections.forEach((section) => section.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');
    appState.activeSection = sectionId;

    navLinks.forEach((link) => {
        if (link.dataset.section === sectionId) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    if (sectionId === 'dashboard') {
        updateDashboard();
    } else if (sectionId === 'planner') {
        renderMonthlyCalendar();
    } else if (sectionId === 'insights') {
        renderCategoryChart();
    }
}


// --- TASK MANAGEMENT ---
function renderTasks(filter = 'all') {
    const allTasks = [...appState.tasks, ...appState.monthlyGoals];
    allTasksList.innerHTML = '';

    const filteredTasks = allTasks.filter(task => {
        if (filter === 'one-time') return task.frequency === 'one-time';
        if (filter === 'monthly') return task.frequency === 'monthly';
        if (filter === 'scheduled') return task.date || task.days;
        return true;
    });

    if (filteredTasks.length === 0) {
        allTasksList.innerHTML = `<li class="empty-state">No ${filter} tasks found.</li>`;
        return;
    }

    filteredTasks.forEach((task, index) => {
        const li = document.createElement('li');
        li.classList.add('task-item');
        if (task.completed) li.classList.add('task-completed');

        let taskDetails = '';
        if (task.frequency === 'one-time') {
            taskDetails = `${task.date} at ${task.time}`;
        } else if (task.frequency === 'monthly') {
            const days = task.days && task.days.length > 0 ? task.days.join(', ') : 'No specific day';
            const time = task.time ? ` at ${task.time}` : '';
            taskDetails = `Monthly: ${days}${time}`;
        }

        const categoryHtml = task.category ? `<span class="task-category ${task.category}">${task.category}</span>` : '';

        li.innerHTML = `
            <div class="task-info">
                <div class="task-name">${task.name} ${categoryHtml}</div>
                <div class="task-details">${taskDetails}</div>
            </div>
            <div class="task-actions">
                <button class="complete-btn" data-task-type="${task.frequency}" data-index="${index}">${task.completed ? 'Un-do' : 'Complete'}</button>
                <button class="delete-btn" data-task-type="${task.frequency}" data-index="${index}">Delete</button>
            </div>
        `;
        allTasksList.appendChild(li);
    });

    updateDashboard();
    saveState();
}

function showTaskModal(date = null) {
    taskForm.reset();
    monthlyDayCheckboxes.forEach(cb => cb.checked = false);

    if (date) {
        taskFrequencySelect.value = 'one-time';
        oneTimeFields.style.display = 'block';
        monthlyScheduleOptions.style.display = 'none';
        taskDateInput.value = date;
    } else {
        taskFrequencySelect.value = 'one-time';
        oneTimeFields.style.display = 'block';
        monthlyScheduleOptions.style.display = 'none';
    }
    taskModal.classList.remove('hidden');
}

function closeTaskModal() {
    taskModal.classList.add('hidden');
    taskForm.reset();
    monthlyDayCheckboxes.forEach(cb => cb.checked = false);
}

function addTask(task) {
    if (task.frequency === 'one-time') {
        appState.tasks.push(task);
    } else if (task.frequency === 'monthly') {
        appState.monthlyGoals.push(task);
    }
    
    // Schedule notification for the new task
    scheduleTaskNotification(task);
    
    renderTasks();
    renderMonthlyCalendar();
    saveState();
}

function deleteTask(taskType, index) {
    if (taskType === 'one-time') {
        appState.tasks.splice(index, 1);
    } else if (taskType === 'monthly') {
        appState.monthlyGoals.splice(index, 1);
    }
    
    // Reschedule all notifications after deletion
    scheduleAllTaskNotifications();
    
    renderTasks();
    renderMonthlyCalendar();
    saveState();
}

function toggleTaskCompletion(taskType, index) {
    let taskArray = taskType === 'one-time' ? appState.tasks : appState.monthlyGoals;
    if (taskArray[index]) {
        const isCompleted = taskArray[index].completed;
        taskArray[index].completed = !isCompleted;
        if (!isCompleted) {
            appState.completedTasks++;
            // Show completion notification
            showNotification(
                "Task Completed! 🎉", 
                `Great job completing: ${taskArray[index].name}`
            );
        } else {
            appState.completedTasks--;
        }
    }
    
    // Reschedule notifications
    scheduleAllTaskNotifications();
    
    renderTasks();
    renderMonthlyCalendar();
    saveState();
}


// --- CALENDAR FUNCTIONS ---
function renderMonthlyCalendar() {
    const today = new Date();
    const firstDayOfMonth = new Date(appState.currentYear, appState.currentMonth, 1);
    const daysInMonth = new Date(appState.currentYear, appState.currentMonth + 1, 0).getDate();
    const firstDayOfWeek = firstDayOfMonth.getDay();

    daysContainer.innerHTML = '';
    monthAndYearDisplay.textContent = new Date(appState.currentYear, appState.currentMonth).toLocaleString('en-US', { month: 'long', year: 'numeric' });

    for (let i = 0; i < firstDayOfWeek; i++) {
        const emptyDiv = document.createElement('div');
        daysContainer.appendChild(emptyDiv);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateString = `${appState.currentYear}-${String(appState.currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('calendar-day');

        if (today.getFullYear() === appState.currentYear && today.getMonth() === appState.currentMonth && today.getDate() === day) {
            dayDiv.classList.add('active-day');
        }

        const tasksForDay = appState.tasks.filter(task => task.date === dateString);

        let indicatorHtml = '';
        if (tasksForDay.length > 0) {
            const colors = {
                'study': '#007bff',
                'personal': '#28a745',
                'health': '#ffc107',
            };
            const taskIndicators = tasksForDay.map(task => {
                const color = colors[task.category] || '#7d6aff';
                return `<div class="task-indicator" style="background-color: ${color}"></div>`;
            }).join('');
            indicatorHtml = `<div class="day-task-indicators">${taskIndicators}</div>`;
        }

        dayDiv.innerHTML = `<span class="calendar-day-number">${day}</span>${indicatorHtml}`;
        daysContainer.appendChild(dayDiv);

        dayDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            showTaskDetailsPopup(dateString, tasksForDay, e);
        });
    }
}


// --- POP-UP FUNCTIONS ---
function showTaskDetailsPopup(dateString, tasks, e) {
    popupDate.textContent = `Tasks for ${dateString}`;
    popupTaskList.innerHTML = '';

    if (tasks.length > 0) {
        tasks.forEach(task => {
            const li = document.createElement('li');
            li.textContent = task.name;
            popupTaskList.appendChild(li);
        });
    } else {
        popupTaskList.innerHTML = '<li>No tasks scheduled.</li>';
    }

    const dayRect = e.target.closest('.calendar-day').getBoundingClientRect();
    taskDetailsPopup.style.left = `${dayRect.left + window.scrollX}px`;
    taskDetailsPopup.style.top = `${dayRect.bottom + window.scrollY}px`;
    taskDetailsPopup.classList.remove('hidden');

    addTaskToDayBtn.dataset.date = dateString;
}

function hideTaskDetailsPopup() {
    taskDetailsPopup.classList.add('hidden');
}


// --- TIMER FUNCTIONS ---
function updateTimerDisplay() {
    const minutes = Math.floor(appState.timerSeconds / 60);
    const seconds = appState.timerSeconds % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    timerDisplay.textContent = timeString;
    timerStatusDisplay.textContent = timeString;

    const circumference = 2 * Math.PI * 45;
    const progress = appState.timerSeconds / totalTime;
    const offset = circumference - progress * circumference;
    timerProgressCircle.style.strokeDasharray = circumference;
    timerProgressCircle.style.strokeDashoffset = offset;
}

function startTimer() {
    if (appState.timerInterval) return;
    
    // Request notification permission when timer starts
    requestNotificationPermission();
    
    appState.timerInterval = setInterval(() => {
        if (appState.timerSeconds > 0) {
            appState.timerSeconds--;
            updateTimerDisplay();
        } else {
            clearInterval(appState.timerInterval);
            appState.timerInterval = null;
            
            // Show both alert and notification
            alert('Time is up! Take a break.');
            showNotification(
                "Pomodoro Complete! 🍅", 
                "Great focus session! Time for a well-deserved break."
            );
            
            appState.focusSessions++;
            resetTimer();
            saveState();
        }
    }, 1000);
}

function pauseTimer() {
    clearInterval(appState.timerInterval);
    appState.timerInterval = null;
}

function resetTimer() {
    pauseTimer();
    appState.timerSeconds = totalTime;
    updateTimerDisplay();
    saveState();
}


// --- DASHBOARD UPDATES ---
function updateDashboard() {
    const today = new Date();
    const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayDayOfWeek = today.toLocaleString('en-US', { weekday: 'short' });

    const todayTasks = appState.tasks.filter(t => t.date === todayISO);
    const todayMonthlyTasks = appState.monthlyGoals.filter(t => t.days && t.days.includes(todayDayOfWeek));

    tasksTodayCountDisplay.textContent = todayTasks.length + todayMonthlyTasks.length;
    totalTasksCountDisplay.textContent = appState.tasks.length + appState.monthlyGoals.length;
    completedTasksCountDisplay.textContent = appState.completedTasks;
    focusSessionsCountDisplay.textContent = appState.focusSessions;

    upcomingTasksList.innerHTML = '';
    const allUpcoming = [...appState.tasks, ...appState.monthlyGoals];
    if (allUpcoming.length === 0) {
        upcomingTasksList.innerHTML = '<li class="empty-state">No upcoming tasks. Add some!</li>';
    } else {
        allUpcoming.forEach(task => {
            const li = document.createElement('li');
            const categoryHtml = task.category ? `<span class="task-category ${task.category}">${task.category}</span>` : '';
            let taskText = task.name;
            if (task.frequency === 'one-time') {
                taskText += ` - ${task.date} at ${task.time}`;
            } else if (task.frequency === 'monthly' && task.days) {
                taskText += ` - Monthly on ${task.days.join(', ')}`;
            }
            li.innerHTML = `${taskText} ${categoryHtml}`;
            upcomingTasksList.appendChild(li);
        });
    }

    monthlyGoalsList.innerHTML = '';
    if (appState.monthlyGoals.length === 0) {
        monthlyGoalsList.innerHTML = '<li class="empty-state">No monthly goals set.</li>';
    } else {
        appState.monthlyGoals.forEach(goal => {
            const li = document.createElement('li');
            const categoryHtml = goal.category ? `<span class="task-category ${goal.category}">${goal.category}</span>` : '';
            li.innerHTML = `${goal.name} ${categoryHtml}`;
            monthlyGoalsList.appendChild(li);
        });
    }
}


// --- INSIGHTS CHART ---
function renderCategoryChart() {
    const completedTasks = appState.tasks.filter(t => t.completed);
    const categoryCounts = {};
    const categories = ['study', 'personal', 'health'];
    const colors = ['#007bff', '#28a745', '#ffc107'];

    categories.forEach(cat => categoryCounts[cat] = 0);

    completedTasks.forEach(task => {
        if (task.category && categoryCounts.hasOwnProperty(task.category)) {
            categoryCounts[task.category]++;
        }
    });

    const data = {
        labels: categories.map(cat => cat.charAt(0).toUpperCase() + cat.slice(1)),
        datasets: [{
            label: 'Completed Tasks',
            data: Object.values(categoryCounts),
            backgroundColor: colors,
            borderColor: colors,
            borderWidth: 1
        }]
    };

    const config = {
        type: 'bar',
        data: data,
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    };

    if (categoryChart) {
        categoryChart.destroy();
    }
    categoryChart = new Chart(categoryChartCanvas, config);
}


// --- EVENT LISTENERS ---
document.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (action === 'showLogin') {
        e.preventDefault();
        switchView('login');
    } else if (action === 'showSignup') {
        e.preventDefault();
        switchView('signup');
    }
});

document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    switchView('app');
    switchSection('dashboard');
    // Request notification permission on login
    requestNotificationPermission();
});

document.getElementById('signupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    switchView('app');
    switchSection('dashboard');
    // Request notification permission on signup
    requestNotificationPermission();
});

document.getElementById('demoBtn').addEventListener('click', () => {
    switchView('app');
    switchSection('dashboard');
    // Request notification permission in demo mode
    requestNotificationPermission();
});

navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const sectionId = e.target.dataset.section;
        switchSection(sectionId);
    });
});

// Task modal related events
openTaskModalBtn.addEventListener('click', () => showTaskModal());
closeBtn.addEventListener('click', closeTaskModal);

window.addEventListener('click', (e) => {
    if (e.target === taskModal) {
        closeTaskModal();
    }
});

taskFrequencySelect.addEventListener('change', (e) => {
    if (e.target.value === 'monthly') {
        oneTimeFields.style.display = 'none';
        monthlyScheduleOptions.style.display = 'block';
    } else {
        oneTimeFields.style.display = 'block';
        monthlyScheduleOptions.style.display = 'none';
    }
});

taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const frequency = taskFrequencySelect.value;
    let task = {
        name: taskNameInput.value,
        frequency: frequency,
        completed: false,
        category: taskCategorySelect.value,
    };

    if (frequency === 'one-time') {
        task.date = taskDateInput.value;
        task.time = taskTimeSelect.value;
    } else if (frequency === 'monthly') {
        task.days = Array.from(monthlyDayCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        task.time = monthlyTimeSelect.value;
    }

    addTask(task);
    taskForm.reset();
    closeTaskModal();
});

allTasksList.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    const taskType = button.dataset.taskType;
    const index = parseInt(button.dataset.index);

    if (button.classList.contains('delete-btn')) {
        deleteTask(taskType, index);
    } else if (button.classList.contains('complete-btn')) {
        toggleTaskCompletion(taskType, index);
    }
});

filterButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        filterButtons.forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        renderTasks(e.target.dataset.filter);
    });
});

// Calendar navigation events
prevMonthBtn.addEventListener('click', () => {
    appState.currentMonth--;
    if (appState.currentMonth < 0) {
        appState.currentMonth = 11;
        appState.currentYear--;
    }
    renderMonthlyCalendar();
    saveState();
});

nextMonthBtn.addEventListener('click', () => {
    appState.currentMonth++;
    if (appState.currentMonth > 11) {
        appState.currentMonth = 0;
        appState.currentYear++;
    }
    renderMonthlyCalendar();
    saveState();
});

// Focus Timer events
startTimerBtn.addEventListener('click', startTimer);
pauseTimerBtn.addEventListener('click', pauseTimer);
resetTimerBtn.addEventListener('click', resetTimer);

// Close pop-up on button click
closePopupBtn.addEventListener('click', hideTaskDetailsPopup);

// Close pop-up when clicking anywhere else on the page
document.addEventListener('click', (e) => {
    if (!taskDetailsPopup.contains(e.target) && !e.target.closest('.calendar-day')) {
        hideTaskDetailsPopup();
    }
});

// Add task to the specific date from the pop-up
addTaskToDayBtn.addEventListener('click', () => {
    const date = addTaskToDayBtn.dataset.date;
    hideTaskDetailsPopup();
    showTaskModal(date);
});

// Logout functionality
const logoutBtn = document.getElementById('logoutBtn');
logoutBtn.addEventListener('click', () => {
    // Clear notification timeouts
    clearNotificationTimeouts();
    
    // Clear app state (or reset to initial)
    appState = {
        activeView: 'login',
        activeSection: 'dashboard',
        timerInterval: null,
        timerSeconds: totalTime,
        tasks: [],
        monthlyGoals: [],
        focusSessions: 0,
        completedTasks: 0,
        currentMonth: new Date().getMonth(),
        currentYear: new Date().getFullYear(),
        notificationTimeouts: [],
    };

    // Save cleared state
    saveState();

    // Switch to login view
    switchView('login');
});


// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    renderMonthlyCalendar();
    updateTimerDisplay();
    updateDashboard();
    renderTasks();
    switchView(appState.activeView);
    switchSection(appState.activeSection);
    
    // Schedule notifications for all existing tasks
    scheduleAllTaskNotifications();
});
