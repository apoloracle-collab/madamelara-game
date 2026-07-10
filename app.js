// ==========================================================================
// 1. TELEGRAM WEB APP INITIALIZATION
// ==========================================================================
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.ready();
}

// Global user identifier fallback for localized development test beds
const telegramUserId = tg?.initDataUnsafe?.user?.id || 123456789;

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
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const startBtn = document.getElementById('start-btn');
const bonusNotice = document.getElementById('bonus-notice');
const rewardModal = document.getElementById('reward-modal');
const rewardPoints = document.getElementById('reward-points');
const rewardDesc = document.getElementById('reward-desc');
const claimBtn = document.getElementById('claim-btn');
const laraTargetContainer = document.getElementById('lara-target-container');
const energyDisplay = document.getElementById('energy-display');
const energyModal = document.getElementById('energy-modal');
const watchAdBtn = document.getElementById('watch-ad-btn');
const closeEnergyModalBtn = document.getElementById('close-energy-modal');

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
            
            if (energyDisplay) {
                energyDisplay.innerText = `${currentEnergy}/${maxEnergy}`;
            }
        }
    } catch (err) {
        console.error("Error fetching remote data from Supabase instance:", err.message);
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
        if (claimBtn) {
            claimBtn.innerText = "Saving Data...";
            claimBtn.disabled = true;
        }

        const { error } = await supabaseClient
            .from('slaves')
            .update({ total_points: totalCoins })
            .eq('telegram_id', telegramUserId);

        if (error) throw error;
    } catch (err) {
        console.error("Critical trace on saving transactional coin balances:", err.message);
    } finally {
        if (claimBtn) {
            claimBtn.innerText = "Claim & Continue";
            claimBtn.disabled = false;
        }
        // FIXED: Redirects smoothly back to layout updates rather than auto-starting a session loop
        initLobby();
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
        console.error("Error executing safe energy serialization update script:", err.message);
    }
}

// ==========================================================================
// 6. DASHBOARD DESIGN AND HEADER RENDER LOOKUPS
// ==========================================================================
function updateHeaderStats() {
    if (scoreDisplay) scoreDisplay.innerText = Math.floor(totalCoins);
    if (multiplierDisplay) multiplierDisplay.innerText = `x${activeMultiplier.toFixed(2)}`;
}

function initLobby() {
    updateHeaderStats();
    if (lobbyScreen) lobbyScreen.classList.add('active');
    if (gameScreen) gameScreen.classList.remove('active');
    
    if (bonusNotice) {
        if (extraTime > 0) {
            bonusNotice.innerText = `Duration: 45s (+${extraTime}s Shop Bonus Active)`;
        } else {
            bonusNotice.innerText = `Duration: 45s`;
        }
    }
}

// ==========================================================================
// 7. CORE GAME LOOPS AND TRANSACTION TRIGGERS
// ==========================================================================
function startGame() {
    if (currentEnergy <= 0) {
        if (energyModal) energyModal.classList.remove('hidden');
        return; 
    }

    currentEnergy--;
    if (energyDisplay) {
        energyDisplay.innerText = `${currentEnergy}/${maxEnergy}`;
    }
    saveEnergyToDatabase();

    currentTask = laraTasks[Math.floor(Math.random() * laraTasks.length)];
    timeLeft = currentTask.timeLimit + extraTime;
    currentBar = 0;
    isGameActive = true;

    const randomImgIndex = Math.floor(Math.random() * currentTask.images.length);
    if (laraImage) laraImage.src = 'assets/' + currentTask.images[randomImgIndex];

    if (taskName) taskName.innerText = currentTask.name;
    if (timerDisplay) timerDisplay.innerText = `${timeLeft}s`;

    if (lobbyScreen) lobbyScreen.classList.remove('active');
    if (gameScreen) gameScreen.classList.add('active');
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
            endGame(true);
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
        initLobby();
    }
}

// ==========================================================================
// 8. INTERACTIVE CLICK CAPTURING SUBSYSTEMS
// ==========================================================================
if (claimBtn) {
    claimBtn.addEventListener('click', () => {
        if (!currentTask) return;
        
        totalCoins += currentTask.reward;
        updateHeaderStats();
        
        if (rewardModal) rewardModal.classList.add('hidden');
        
        // Triggers database synchronization and falls back securely to lobby layout updates
        saveCoinsToDatabase();

        if (currentEnergy <= 0 && energyModal) {
            energyModal.classList.remove('hidden'); 
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
// 9. NATIVE ADSGRAM NETWORK INTEGRATION WIREFRAME
// ==========================================================================
if (watchAdBtn) {
    watchAdBtn.addEventListener('click', () => {
        // Intercept action cleanly if SDK script isn't loaded completely
        if (!window.Adsgram) {
            alert("Ad network is currently loading. Please try again in a few seconds.");
            console.error("Adsgram SDK is not defined on the window object reference.");
            return;
        }

        const originalText = watchAdBtn.innerText;
        watchAdBtn.innerText = "Loading Ad...";
        watchAdBtn.style.opacity = "0.7";
        watchAdBtn.style.pointerEvents = "none";

        // FIXED: Re-mapped to official, active Production Block ID safely
        const AdController = window.Adsgram.init({ blockId: "37912" });

        AdController.show()
            .then(async (result) => {
                currentEnergy = maxEnergy;
                if (energyDisplay) {
                    energyDisplay.innerText = `${currentEnergy}/${maxEnergy}`;
                }
                updateHeaderStats();
                
                await saveEnergyToDatabase();

                watchAdBtn.innerText = originalText;
                watchAdBtn.style.opacity = "1";
                watchAdBtn.style.pointerEvents = "auto";

                if (energyModal) energyModal.classList.add('hidden');
                initLobby();
                
                console.log("Ad successfully watched. Reward granted:", result);
            })
            .catch((result) => {
                watchAdBtn.innerText = originalText;
                watchAdBtn.style.opacity = "1";
                watchAdBtn.style.pointerEvents = "auto";
                
                alert("Ad reward could not be claimed. Please watch the video until the end.");
                console.log("Ad interaction failed or rejected:", result);
            });
    });
}

// ==========================================================================
// 10. SYSTEM APPLICATION INGEST BOOTSTRAP
// ==========================================================================
initLobby();
loadUserData();