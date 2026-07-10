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
let currentEnergy = 5;
let maxEnergy = 5;

const laraTasks = [
    { id: 'lara_intro', name: 'First Encounter', maxBar: 50, reward: 5, timeLimit: 15, images: ['lara_50_1.png', 'lara_50_2.png', 'lara_50_3.png'] },
    { id: 'lara_leather', name: 'Sharp Glances', maxBar: 100, reward: 15, timeLimit: 25, images: ['lara_100_1.png', 'lara_100_2.png', 'lara_100_3.png'] },
    { id: 'lara_throne', name: 'Queen Throne', maxBar: 200, reward: 40, timeLimit: 40, images: ['lara_200_1.png', 'lara_200_2.png', 'lara_200_3.png'] }
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
            .select('total_points, active_multiplier, energy, max_energy')
            .eq('telegram_id', telegramUserId)
            .single();

        if (error) throw error;

        if (data) {
            totalCoins = data.total_points || 0;
            activeMultiplier = data.active_multiplier || 1.0;
            currentEnergy = data.energy !== null ? data.energy : 5;
            maxEnergy = data.max_energy || 5;
            
            document.getElementById('energy-display').innerText = `${currentEnergy}/${maxEnergy}`;
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

async function saveEnergyToDatabase() {
    if (!telegramUserId) return;
    await supabaseClient.from('slaves').update({ energy: currentEnergy }).eq('telegram_id', telegramUserId);
}

// --- START GAME MECHANIC ---
function startGame() {
    // 1. Enerji Kontrolü
    if (currentEnergy <= 0) {
        document.getElementById('energy-modal').classList.remove('hidden');
        return; // Enerji yoksa oyunu durdur ve uyarı ver
    }

    // 2. Enerjiyi düşür, ekrana yaz ve veritabanına kaydet
    currentEnergy--;
    document.getElementById('energy-display').innerText = `${currentEnergy}/${maxEnergy}`;
    saveEnergyToDatabase();

    // 3. Görevi Seç
    currentTask = laraTasks[Math.floor(Math.random() * laraTasks.length)];
    
    // 4. Süreyi göreve göre dinamik ayarla (Artık 45 saniye sabit değil)
    timeLeft = currentTask.timeLimit + extraTime;
    currentBar = 0;
    isGameActive = true;

    // 5. Görsel Havuzundan Rastgele Seçim
    const randomImgIndex = Math.floor(Math.random() * currentTask.images.length);
    laraImage.src = 'assets/' + currentTask.images[randomImgIndex];

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
    
    // 1. Add and save points
    totalCoins += currentTask.reward;
    updateHeaderStats();
    saveCoinsToDatabase();

    // 2. FORCE CLOSE the success modal
    rewardModal.classList.add('hidden');

    // 3. Energy Check and Redirection
    if (currentEnergy <= 0) {
        initLobby(); // Return to lobby in the background
        document.getElementById('energy-modal').classList.remove('hidden'); // Show ad modal cleanly
    } else {
        initLobby(); // Return to lobby if energy is available
    }
});

// --- BUTTON INTERACTION TRIGGERS ---
startBtn.addEventListener('click', startGame);

// --- STARTUP APP BOOT ---
initLobby();
loadUserData(); // Fetch the latest score from the database on startup.
document.getElementById('close-energy-modal').addEventListener('click', () => {
    document.getElementById('energy-modal').classList.add('hidden');
});
// --- WATCH AD BUTTON (DUMMY SIMULATION) ---
const watchAdBtn = document.getElementById('watch-ad-btn'); 

if(watchAdBtn) {
    watchAdBtn.addEventListener('click', () => {
        // Butonun yazısını değiştir ve tıklanmasını geçici olarak kilitle
        const originalText = watchAdBtn.innerText;
        watchAdBtn.innerText = "Loading Ad... (3s)";
        watchAdBtn.style.opacity = "0.7";
        watchAdBtn.style.pointerEvents = "none"; 

        // 3 saniye sonra olacaklar (Reklam bitti simülasyonu)
        setTimeout(() => {
            // 1. Enerjiyi 5/5 yap
            currentEnergy = maxEnergy;
            updateHeaderStats();
            
            // 2. Butonu eski haline getir
            watchAdBtn.innerText = originalText;
            watchAdBtn.style.opacity = "1";
            watchAdBtn.style.pointerEvents = "auto";
            
            // 3. Uyarı ekranını kapat ve oyuna (lobiye) dön
            document.getElementById('energy-modal').classList.add('hidden');
            initLobby();
            
        }, 3000); // 3000 milisaniye = 3 saniye
    });
}