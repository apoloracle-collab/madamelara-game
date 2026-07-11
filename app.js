// ==========================================================================
// 1. TELEGRAM WEB APP INITIALIZATION
// ==========================================================================
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.ready();
}

const telegramUserId = tg?.initDataUnsafe?.user?.id || 123456789;
const telegramUsername = tg?.initDataUnsafe?.user?.username || "Slave";

// ==========================================================================
// 2. SUPABASE ECOSYSTEM CONFIGURATION
// ==========================================================================
const supabaseUrl = 'https://grudcdfhjeyxxeijjwsh.supabase.co';
const supabaseKey = 'sb_publishable_x7hwvc6cS5NkBcnz069Jrg_FUTZxwq6';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================================================
// 3. CORE GAME CONFIGURATION & STATES
// ==========================================================================
let currentEnergy = 5;
let maxEnergy = 5;

const laraTasks = [
    { id: 'lara_intro', name: 'First Encounter', maxBar: 50, reward: 5, timeLimit: 15, images: ['lara_50_1.png', 'lara_50_2.png', 'lara_50_3.png'] },
    { id: 'lara_leather', name: 'Sharp Glances', maxBar: 100, reward: 15, timeLimit: 25, images: ['lara_100_1.png', 'lara_100_2.png', 'lara_100_3.png'] },
    { id: 'lara_throne', name: 'Queen Throne', maxBar: 200, reward: 40, timeLimit: 40, images: ['lara_200_1.png', 'lara_200_2.png', 'lara_200_3.png'] }
];

let totalCoins = 0;
let activeMultiplier = 1.0; 
let extraTime = 0;          

let timeLeft = 45;
let isGameActive = false;
let currentTask = null;
let currentBar = 0;
let timerInterval = null;

let energyTimerInterval = null;

// ==========================================================================
// 4. DOM RESOURCE MAPPINGS
// ==========================================================================
const scoreDisplay = document.getElementById('score-display');
const multiplierDisplay = document.getElementById('multiplier-display');
const timerDisplay = document.getElementById('timer-display');
const laraImage = document.getElementById('lara-image');
const taskName = document.getElementById('task-name');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const energyDisplay = document.getElementById('energy-display');
const slaveStatusText = document.getElementById('slave-status-text');

// Screens
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const marketScreen = document.getElementById('market-screen');
const profileScreen = document.getElementById('profile-screen');

// Buttons & Modals
const startBtn = document.getElementById('start-btn');
const bonusNotice = document.getElementById('bonus-notice');
const rewardModal = document.getElementById('reward-modal');
const rewardPoints = document.getElementById('reward-points');
const rewardDesc = document.getElementById('reward-desc');
const claimBtn = document.getElementById('claim-btn');
const laraTargetContainer = document.getElementById('lara-target-container');

// Navigation Buttons
const navMarketBtn = document.getElementById('nav-market-btn');
const navProfileBtn = document.getElementById('nav-profile-btn');
const backFromMarket = document.getElementById('back-from-market');
const backFromProfile = document.getElementById('back-from-profile');

// Energy Modal & Purchase Buttons
const energyModal = document.getElementById('energy-modal');
const energyCountdown = document.getElementById('energy-countdown');
const closeEnergyModalBtn = document.getElementById('close-energy-modal');
const buyEnergy5Btn = document.getElementById('buy-energy-5');
const buyEnergy10Btn = document.getElementById('buy-energy-10');

// ==========================================================================
// 5. SUPABASE CLOUD FILE & INVENTORY SYNC
// ==========================================================================
async function loadUserData() {
    try {
        const { data, error } = await supabaseClient
            .from('slaves')
            .select('total_points, active_multiplier, energy, max_energy')
            .eq('telegram_id', telegramUserId)
            .single();

        if (error) throw error;

        if (data) {
            totalCoins = data.total_points || 0;
            activeMultiplier = data.active_multiplier || 1.0;
            currentEnergy = data.energy !== null ? data.energy : 5;
            maxEnergy = data.max_energy || 5;
            
            updateEnergyUI();
            
            // Update title if VIP status exists
            if(maxEnergy > 5) {
                if(slaveStatusText) slaveStatusText.innerHTML = "👑 VIP FOLLOWER";
                if(slaveStatusText) slaveStatusText.style.color = "#d4af37";
            }
        }
    } catch (err) {
        console.error("Database fetch error:", err.message);
    } finally {
        if (startBtn) {
            startBtn.innerText = "Obey Madame Lara (Start)";
            startBtn.disabled = false;
        }
        updateHeaderStats();
    }
}

async function saveCoinsToDatabase() {
    try {
        if (claimBtn) { claimBtn.innerText = "Saving Data..."; claimBtn.disabled = true; }

        await supabaseClient
            .from('slaves')
            .update({ total_points: totalCoins })
            .eq('telegram_id', telegramUserId);

    } catch (err) {
        console.error("Coin sync error:", err.message);
    } finally {
        if (claimBtn) { claimBtn.innerText = "Claim & Continue"; claimBtn.disabled = false; }
        showScreen(lobbyScreen);
    }
}

async function saveEnergyToDatabase() {
    if (!telegramUserId) return;
    try {
        await supabaseClient
            .from('slaves')
            .update({ energy: currentEnergy })
            .eq('telegram_id', telegramUserId);
    } catch (err) {
        console.error("Energy sync error:", err.message);
    }
}

// ==========================================================================
// 6. UI UPDATES & NAVIGATION
// ==========================================================================
function updateHeaderStats() {
    if (scoreDisplay) scoreDisplay.innerText = Math.floor(totalCoins);
    if (multiplierDisplay) multiplierDisplay.innerText = `x${activeMultiplier.toFixed(2)}`;
}

function updateEnergyUI() {
    if (energyDisplay) {
        energyDisplay.innerText = `${currentEnergy}/${maxEnergy}`;
    }
}

function showScreen(targetScreen) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    // Show target screen
    if (targetScreen) targetScreen.classList.add('active');
    
    updateHeaderStats();
    updateEnergyUI();
}

// Navigation Event Listeners
if (navMarketBtn) navMarketBtn.addEventListener('click', () => showScreen(marketScreen));
if (navProfileBtn) navProfileBtn.addEventListener('click', () => showScreen(profileScreen));
if (backFromMarket) backFromMarket.addEventListener('click', () => showScreen(lobbyScreen));
if (backFromProfile) backFromProfile.addEventListener('click', () => showScreen(lobbyScreen));

// ==========================================================================
// 7. TIME-BASED ENERGY REGENERATION (4 HOURS LOGIC) - FIXED
// ==========================================================================
function triggerEnergyWaitState() {
    if (energyModal) energyModal.classList.remove('hidden');
    
    if (energyTimerInterval) clearInterval(energyTimerInterval);
    
    // Retrieve target time from local storage, or set it to 4 hours from now
    let targetTime = localStorage.getItem('energyTargetTime');
    if (!targetTime) {
        targetTime = Date.now() + (14400 * 1000); // Current time + 4 hours in milliseconds
        localStorage.setItem('energyTargetTime', targetTime);
    }

    // Countdown loop
    energyTimerInterval = setInterval(() => {
        const now = Date.now();
        const remainingMs = targetTime - now;

        // If time is up
        if (remainingMs <= 0) {
            clearInterval(energyTimerInterval);
            currentEnergy = maxEnergy;
            updateEnergyUI();
            saveEnergyToDatabase();
            localStorage.removeItem('energyTargetTime'); // Clear memory
            if (energyModal) energyModal.classList.add('hidden');
            return;
        }
        
        // Convert remaining milliseconds to H:M:S
        const totalSeconds = Math.floor(remainingMs / 1000);
        const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        
        if (energyCountdown) energyCountdown.innerText = `${h}:${m}:${s}`;
    }, 1000);
}

// ==========================================================================
// 8. CORE GAME LOOPS AND TRANSACTION TRIGGERS
// ==========================================================================
function startGame() {
    if (currentEnergy <= 0) {
        triggerEnergyWaitState();
        return; 
    }

    currentEnergy--;
    updateEnergyUI();
    saveEnergyToDatabase();

    currentTask = laraTasks[Math.floor(Math.random() * laraTasks.length)];
    timeLeft = currentTask.timeLimit + extraTime;
    currentBar = 0;
    isGameActive = true;

    const randomImgIndex = Math.floor(Math.random() * currentTask.images.length);
    if (laraImage) laraImage.src = 'assets/' + currentTask.images[randomImgIndex];

    if (taskName) taskName.innerText = currentTask.name;
    if (timerDisplay) timerDisplay.innerText = `${timeLeft}s`;

    showScreen(gameScreen);
    if (rewardModal) rewardModal.classList.add('hidden');

    updateProgressBar();
    
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        if (timerDisplay) timerDisplay.innerText = `${timeLeft}s`;
        
        if (timeLeft <= 0) {
            endGame(false);
        }
    }, 1000);
}

function updateProgressBar() {
    if (!progressBar || !progressText || !currentTask) return;
    const percentage = (currentBar / currentTask.maxBar) * 100;
    progressBar.style.width = `${Math.min(percentage, 100)}%`;
    progressText.innerText = `${Math.floor(currentBar)} / ${currentTask.maxBar}`;
}

if (laraTargetContainer) {
    laraTargetContainer.addEventListener('click', () => {
        if (!isGameActive || !currentTask) return;
        
        const hitPower = 1 * activeMultiplier;
        currentBar += hitPower;
        
        updateProgressBar();
        
        if (currentBar >= currentTask.maxBar) {
            endGame(true); // Golden Fingers (Last 1 Sec) badge logic to be added here
        }
    });
}

function endGame(isSuccess) {
    isGameActive = false;
    clearInterval(timerInterval);
    
    if (isSuccess) {
        if (rewardDesc) rewardDesc.innerText = `You have successfully completed "${currentTask.name}" and pleased Madame Lara.`;
        if (rewardPoints) rewardPoints.innerText = `+${currentTask.reward} Diamonds`;
        if (rewardModal) rewardModal.classList.remove('hidden');
    } else {
        alert("Time is up! You failed to please Madame Lara.");
        showScreen(lobbyScreen);
        
        if (currentEnergy <= 0) {
            triggerEnergyWaitState();
        }
    }
}

// ==========================================================================
// 9. INTERACTIVE CLICK CAPTURING SUBSYSTEMS
// ==========================================================================
if (claimBtn) {
    claimBtn.addEventListener('click', () => {
        if (!currentTask) return;
        
        totalCoins += currentTask.reward;
        updateHeaderStats();
        
        if (rewardModal) rewardModal.classList.add('hidden');
        saveCoinsToDatabase();

        if (currentEnergy <= 0) {
            triggerEnergyWaitState();
        }
    });
}

if (startBtn) {
    startBtn.addEventListener('click', startGame);
}

if (closeEnergyModalBtn) {
    closeEnergyModalBtn.addEventListener('click', () => {
        if (energyModal) energyModal.classList.add('hidden');
    });
}

// ==========================================================================
// 10. TELEGRAM STARS (XTR) INVOICE TRIGGERS (WIRE-UP)
// ==========================================================================
if (buyEnergy5Btn) {
    buyEnergy5Btn.addEventListener('click', () => {
        // Redirect user to the bot and auto-open invoice
        tg.openTelegramLink("https://t.me/madamelara_bot?start=buy_energy_5");
    });
}

if (buyEnergy10Btn) {
    buyEnergy10Btn.addEventListener('click', () => {
        // Redirect user to the bot and auto-open invoice
        tg.openTelegramLink("https://t.me/madamelara_bot?start=buy_energy_10");
    });
}

// ==========================================================================
// 11. SYSTEM APPLICATION INGEST BOOTSTRAP
// ==========================================================================
showScreen(lobbyScreen);
loadUserData();