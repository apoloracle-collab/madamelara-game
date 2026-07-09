// --- INITIALIZE TELEGRAM WEB APP ---
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand(); // Forces the app to open in full screen inside Telegram
}

// --- GAME CONFIGURATION (LARA TASKS & IMAGES) ---
const laraTasks = [
    { id: 'lara_intro', name: 'First Encounter', maxBar: 50, reward: 5, image: 'lara_resim1.png' },
    { id: 'lara_leather', name: 'Sharp Glances', maxBar: 100, reward: 15, image: 'lara_resim2.png' },
    { id: 'lara_throne', name: 'Queen Throne', maxBar: 200, reward: 40, image: 'lara_resim3.png' }
];

// --- DATABASE STATES (To be connected with Supabase/Backend later) ---
let totalCoins = 0;
let activeMultiplier = 1.0; // Default multiplier. Shop items will upgrade this (e.g. 1.20)
let extraTime = 0;          // Default extra time. Shop items will upgrade this (e.g. +30)

// --- GAMEPLAY LIVE STATES ---
let timeLeft = 45;
let isGameActive = false;
let currentTask = null;
let currentBar = 0;
let timerInterval = null;

// --- DOM ELEMENTS ---
const scoreDisplay = document.getElementById('score-display');
const multiplierDisplay = document.getElementById('multiplier-display');
const timerDisplay = document.getElementById('timer-display');
const laraImage = document.getElementById('lara-image');
const taskName = document.getElementById('task-name');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const startBtn = document.getElementById('start-btn');
const bonusNotice = document.getElementById('bonus-notice');
const rewardModal = document.getElementById('reward-modal');
const rewardPoints = document.getElementById('reward-points');
const rewardDesc = document.getElementById('reward-desc');
const claimBtn = document.getElementById('claim-btn');
const laraTargetContainer = document.getElementById('lara-target-container');

// --- SIMULATE SHOP BONUS FOR TESTING ---
// Uncomment the lines below to test your specific shop item power (+%20 multiplier & +30s time)
// activeMultiplier = 1.20;
// extraTime = 30;

// --- UPDATE TOP HEADER STATS ---
function updateHeaderStats() {
    scoreDisplay.innerText = Math.floor(totalCoins);
    multiplierDisplay.innerText = `x${activeMultiplier.toFixed(2)}`;
}

// --- SETUP LOBBY SCREEN VIEW ---
function initLobby() {
    updateHeaderStats();
    lobbyScreen.classList.add('active');
    gameScreen.classList.remove('active');
    
    if (extraTime > 0) {
        bonusNotice.innerText = `Duration: 45s (+${extraTime}s Shop Bonus Active)`;
    } else {
        bonusNotice.innerText = `Duration: 45s`;
    }
}

// --- START GAME MECHANIC ---
function startGame() {
    timeLeft = 45 + extraTime;
    currentBar = 0;
    isGameActive = true;
    
    // Select a random task from the array
    currentTask = laraTasks[Math.floor(Math.random() * laraTasks.length)];
    
    // Set UI elements
    laraImage.src = currentTask.image;
    taskName.innerText = currentTask.name;
    timerDisplay.innerText = `${timeLeft}s`;
    
    // Switch screens
    lobbyScreen.classList.remove('active');
    gameScreen.classList.add('active');
    rewardModal.classList.add('hidden');
    
    updateProgressBar();
    
    // Start countdown game loop
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.innerText = `${timeLeft}s`;
        
        if (timeLeft <= 0) {
            endGame(false); // Game over by timeout
        }
    }, 1000);
}

// --- UPDATE PROGRESS BAR PROGRESS ---
function updateProgressBar() {
    const percentage = (currentBar / currentTask.maxBar) * 100;
    progressBar.style.width = `${Math.min(percentage, 100)}%`;
    progressText.innerText = `${Math.floor(currentBar)} / ${currentTask.maxBar}`;
}

// --- CLICK HANDLE WITH MULTIPLIER ACTION ---
laraTargetContainer.addEventListener('click', () => {
    if (!isGameActive || !currentTask) return;
    
    // Base hit is 1 point * player shop multiplier multiplier (e.g. 1 * 1.20 = 1.2 progress per tap)
    const hitPower = 1 * activeMultiplier;
    currentBar += hitPower;
    
    updateProgressBar();
    
    // Check if task is successfully fully cleared
    if (currentBar >= currentTask.maxBar) {
        endGame(true);
    }
});

// --- END GAME LOOP MECHANIC ---
function endGame(isSuccess) {
    isGameActive = false;
    clearInterval(timerInterval);
    
    if (isSuccess) {
        // Trigger success reward popup windows
        rewardDesc.innerText = `You have successfully completed "${currentTask.name}" and pleased Madame Lara.`;
        rewardPoints.innerText = `+${currentTask.reward} Diamonds`;
        rewardModal.classList.remove('hidden');
    } else {
        // Handle timeout reset back to lobby screen
        alert("Time is up! You failed to please Madame Lara.");
        initLobby();
    }
}

// --- CLAIM BUTTON TRIGGER EVENT ---
claimBtn.addEventListener('click', () => {
    if (!currentTask) return;
    
    // Update local variables (Will be push request to Supabase API later)
    totalCoins += currentTask.reward;
    updateHeaderStats();
    
    // Instantly generate and auto-start next random game task loops
    startGame();
});

// --- BUTTON INTERACTION TRIGGERS ---
startBtn.addEventListener('click', startGame);

// --- STARTUP APP BOOT ---
initLobby();