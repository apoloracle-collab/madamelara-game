// --- INITIALIZE TELEGRAM WEB APP ---
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.ready();
}

// Get Telegram ID. Assign a test ID if opened outside Telegram to prevent errors.
const telegramUserId = tg?.initDataUnsafe?.user?.id || 123456789;

// --- SUPABASE CONFIGURATION ---
// ATTENTION: Paste the Project URL and Publishable Key from your Supabase dashboard here.
const supabaseUrl = 'https://grudcdfhjeyxxeijjwsh.supabase.co';
const supabaseKey = 'sb_publishable_x7hwvc6cS5NkBcnz069Jrg_FUTZxwq6';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// --- GAME CONFIGURATION ---
const laraTasks = [
    { id: 'lara_intro', name: 'First Encounter', maxBar: 50, reward: 5, image: 'lara_resim1.png' },
    { id: 'lara_leather', name: 'Sharp Glances', maxBar: 100, reward: 15, image: 'lara_resim2.png' },
    { id: 'lara_throne', name: 'Queen Throne', maxBar: 200, reward: 40, image: 'lara_resim3.png' }
];

// --- DATABASE STATES ---
let totalCoins = 0;
let activeMultiplier = 1.0; 
let extraTime = 0;          

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

// --- DATABASE FUNCTIONS ---
async function loadUserData() {
    try {
        const { data, error } = await supabaseClient
            .from('slaves')
            .select('total_points, active_multiplier')
            .eq('telegram_id', telegramUserId)
            .single();

        if (error) throw error;

        if (data) {
            totalCoins = data.total_points || 0;
            activeMultiplier = data.active_multiplier || 1.0;
        }
    } catch (err) {
        console.error("Error loading data from Supabase:", err.message);
        // If no record exists (first time playing), keep default values.
    } finally {
        // Enable the Start button once data loading is complete.
        startBtn.innerText = "Obey Madame Lara (Start)";
        startBtn.disabled = false;
        updateHeaderStats();
    }
}

async function saveCoinsToDatabase() {
    try {
        claimBtn.innerText = "Saving...";
        claimBtn.disabled = true;

        const { error } = await supabaseClient
            .from('slaves')
            .update({ total_points: totalCoins })
            .eq('telegram_id', telegramUserId);

        if (error) throw error;
    } catch (err) {
        console.error("Error saving coins:", err.message);
    } finally {
        claimBtn.innerText = "Claim & Continue";
        claimBtn.disabled = false;
        startGame(); // Start a new game once saving is complete.
    }
}

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
    
    currentTask = laraTasks[Math.floor(Math.random() * laraTasks.length)];
    
    laraImage.src = currentTask.image;
    taskName.innerText = currentTask.name;
    timerDisplay.innerText = `${timeLeft}s`;
    
    lobbyScreen.classList.remove('active');
    gameScreen.classList.add('active');
    rewardModal.classList.add('hidden');
    
    updateProgressBar();
    
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.innerText = `${timeLeft}s`;
        
        if (timeLeft <= 0) {
            endGame(false);
        }
    }, 1000);
}

// --- UPDATE PROGRESS BAR PROGRESS ---
function updateProgressBar() {
    const percentage = (currentBar / currentTask.maxBar) * 100;
    progressBar.style.width = `${Math.min(percentage, 100)}%`;
    progressText.innerText = `${Math.floor(currentBar)} / ${currentTask.maxBar}`;
}

// --- CLICK HANDLE ---
laraTargetContainer.addEventListener('click', () => {
    if (!isGameActive || !currentTask) return;
    
    const hitPower = 1 * activeMultiplier;
    currentBar += hitPower;
    
    updateProgressBar();
    
    if (currentBar >= currentTask.maxBar) {
        endGame(true);
    }
});

// --- END GAME LOOP MECHANIC ---
function endGame(isSuccess) {
    isGameActive = false;
    clearInterval(timerInterval);
    
    if (isSuccess) {
        rewardDesc.innerText = `You have successfully completed "${currentTask.name}" and pleased Madame Lara.`;
        rewardPoints.innerText = `+${currentTask.reward} Diamonds`;
        rewardModal.classList.remove('hidden');
    } else {
        alert("Time is up! You failed to please Madame Lara.");
        initLobby();
    }
}

// --- CLAIM BUTTON TRIGGER EVENT ---
claimBtn.addEventListener('click', () => {
    if (!currentTask) return;
    totalCoins += currentTask.reward;
    updateHeaderStats();
    
    // Save the updated coins to Supabase.
    saveCoinsToDatabase(); 
});

// --- BUTTON INTERACTION TRIGGERS ---
startBtn.addEventListener('click', startGame);

// --- STARTUP APP BOOT ---
initLobby();
loadUserData(); // Fetch the latest score from the database on startup.