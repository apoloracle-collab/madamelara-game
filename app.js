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
let unlockedBadgesList = []; // Rozet takibi için

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
            .select('total_points, active_multiplier, energy, max_energy, unlocked_badges')
            .eq('telegram_id', telegramUserId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
            totalCoins = data.total_points || 0;
            activeMultiplier = data.active_multiplier || 1.0;
            currentEnergy = data.energy !== null ? data.energy : 5;
            maxEnergy = data.max_energy || 5;
            unlockedBadgesList = data.unlocked_badges || [];
            
            updateEnergyUI();
            renderBadges();
            
            if(maxEnergy > 5) {
                if(slaveStatusText) slaveStatusText.innerHTML = "👑 VIP FOLLOWER";
                if(slaveStatusText) slaveStatusText.style.color = "#d4af37";
            }
        } else {
            // Yeni kullanıcı kaydı
            await supabaseClient.from('slaves').insert({
                telegram_id: telegramUserId,
                username: telegramUsername,
                total_points: 0,
                energy: 5,
                max_energy: 5,
                unlocked_badges: ['chain'] // İlk giriş rozeti
            });
            unlockedBadgesList = ['chain'];
            renderBadges();
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
            .update({ total_points: totalCoins, unlocked_badges: unlockedBadgesList })
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
// 6. CREATORS & LOCKED GALLERY LOGIC (YILDIZLAR VE İÇERİK PAZARI)
// ==========================================================================
async function loadCreators() {
    const creatorsGrid = document.getElementById('creators-grid');
    if (!creatorsGrid) return;

    try {
        const { data: creators, error } = await supabaseClient.from('creators').select('*');
        if (error) throw error;

        creatorsGrid.innerHTML = '';
        if (!creators || creators.length === 0) {
            creatorsGrid.innerHTML = '<p style="color:#aaa; text-align:center;">Henüz içerik üreticisi eklenmedi.</p>';
            return;
        }

        creators.forEach(creator => {
            const card = document.createElement('div');
            card.className = 'creator-card';
            card.innerHTML = `
                <img src="${creator.avatar_url || 'assets/default_avatar.png'}" alt="${creator.name}" class="creator-avatar">
                <h3>${creator.name}</h3>
                <p>${creator.bio || 'İçerik Üreticisi'}</p>
            `;
            card.onclick = () => loadCreatorGallery(creator.id, creator.name);
            creatorsGrid.appendChild(card);
        });
    } catch (err) {
        console.error("Creators fetch error:", err.message);
    }
}

async function loadCreatorGallery(creatorId, creatorName) {
    const galleryContainer = document.getElementById('gallery-container');
    if (!galleryContainer) return;

    try {
        const { data: contents, error } = await supabaseClient
            .from('contents')
            .select('*')
            .eq('creator_id', creatorId);

        if (error) throw error;

        // Kullanıcının açtığı kilitleri çek
        const { data: purchases } = await supabaseClient
            .from('purchases')
            .select('content_id')
            .eq('user_id', telegramUserId);

        const purchasedIds = purchases ? purchases.map(p => p.content_id) : [];

        galleryContainer.innerHTML = `<h2 style="color:#d4af37;">${creatorName} Galerisi</h2><div class="gallery-grid"></div>`;
        const grid = galleryContainer.querySelector('.gallery-grid');

        contents.forEach(item => {
            const isUnlocked = purchasedIds.includes(item.id);
            const card = document.createElement('div');
            card.className = `gallery-card ${isUnlocked ? 'unlocked' : 'locked'}`;

            const displayUrl = isUnlocked ? item.full_url : item.preview_url;

            card.innerHTML = `
                <div class="image-wrapper">
                    <img src="${displayUrl}" style="${isUnlocked ? '' : 'filter: blur(8px);'}" />
                    ${!isUnlocked ? `<div class="lock-overlay">🔒 ${item.cost} ${item.unlock_type === 'STARS' ? '⭐️' : '💎'}</div>` : ''}
                </div>
                <h4>${item.title}</h4>
            `;

            if (!isUnlocked) {
                card.onclick = () => unlockContent(item.id, item.cost, item.unlock_type);
            } else {
                card.onclick = () => alert("Görsel zaten açık!");
            }

            grid.appendChild(card);
        });
    } catch (err) {
        console.error("Gallery fetch error:", err.message);
    }
}

async function unlockContent(contentId, cost, unlockType) {
    if (unlockType === 'POINTS') {
        if (totalCoins < cost) {
            alert("Yetersiz Elmas Bakiyesi! Görev yaparak elmas kazanın.");
            return;
        }

        if (confirm(`${cost} Elmas karşılığında bu görselin kilidini açmak istiyor musunuz?`)) {
            totalCoins -= cost;
            updateHeaderStats();

            await supabaseClient.from('purchases').insert({
                user_id: telegramUserId,
                content_id: contentId,
                payment_type: 'POINTS'
            });

            await saveCoinsToDatabase();
            alert("Kilit Başarıyla Açıldı!");
            loadCreators(); // Galeriyi yenile
        }
    } else if (unlockType === 'STARS') {
        tg.openTelegramLink(`https://t.me/madamelara_bot?start=buy_content_${contentId}`);
    }
}

// ==========================================================================
// 7. UI UPDATES & NAVIGATION
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
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (targetScreen) targetScreen.classList.add('active');
    
    updateHeaderStats();
    updateEnergyUI();

    if (targetScreen === marketScreen) {
        loadCreators();
    }
}

// Navigation Event Listeners
if (navMarketBtn) navMarketBtn.addEventListener('click', () => showScreen(marketScreen));
if (navProfileBtn) navProfileBtn.addEventListener('click', () => showScreen(profileScreen));
if (backFromMarket) backFromMarket.addEventListener('click', () => showScreen(lobbyScreen));
if (backFromProfile) backFromProfile.addEventListener('click', () => showScreen(lobbyScreen));

// ==========================================================================
// 8. TIME-BASED ENERGY REGENERATION (4 HOURS LOGIC)
// ==========================================================================
function triggerEnergyWaitState() {
    if (energyModal) energyModal.classList.remove('hidden');
    if (energyTimerInterval) clearInterval(energyTimerInterval);
    
    let targetTime = localStorage.getItem('energyTargetTime');
    if (!targetTime) {
        targetTime = Date.now() + (14400 * 1000);
        localStorage.setItem('energyTargetTime', targetTime);
    }

    energyTimerInterval = setInterval(() => {
        const now = Date.now();
        const remainingMs = targetTime - now;

        if (remainingMs <= 0) {
            clearInterval(energyTimerInterval);
            currentEnergy = maxEnergy;
            updateEnergyUI();
            saveEnergyToDatabase();
            localStorage.removeItem('energyTargetTime');
            if (energyModal) energyModal.classList.add('hidden');
            return;
        }
        
        const totalSeconds = Math.floor(remainingMs / 1000);
        const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        
        if (energyCountdown) energyCountdown.innerText = `${h}:${m}:${s}`;
    }, 1000);
}

// ==========================================================================
// 9. CORE GAME LOOPS AND TRANSACTION TRIGGERS
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
            endGame(true);
        }
    });
}

function endGame(isSuccess) {
    isGameActive = false;
    clearInterval(timerInterval);
    
    if (isSuccess) {
        // Gece Kuşu Rozet Kontrolü (22:00 - 05:00)
        const currentHour = new Date().getHours();
        if ((currentHour >= 22 || currentHour <= 5) && !unlockedBadgesList.includes('moon')) {
            unlockedBadgesList.push('moon');
            alert("🌙 Rozet Kazandın: Midnight Watcher!");
        }

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
// 10. INTERACTIVE CLICK CAPTURING SUBSYSTEMS
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
// 11. TELEGRAM STARS (XTR) INVOICE TRIGGERS
// ==========================================================================
if (buyEnergy5Btn) {
    buyEnergy5Btn.addEventListener('click', () => {
        tg.openTelegramLink("https://t.me/madamelara_bot?start=buy_energy_5");
    });
}

if (buyEnergy10Btn) {
    buyEnergy10Btn.addEventListener('click', () => {
        tg.openTelegramLink("https://t.me/madamelara_bot?start=buy_energy_10");
    });
}

// ==========================================================================
// 12. BADGE SYSTEM (ORIJINAL RESIM DESTEKLI)
// ==========================================================================
const badgesConfig = [
    { id: 'chain', name: 'Chain of Obedience', req: 'Initial entry' },
    { id: 'whisper', name: 'Whispering Slave', req: 'Tap 25,000 times' },
    { id: 'diamond', name: 'Diamond Devotee', req: 'Collect 5,000 Diamonds' },
    { id: 'flame', name: 'Eternal Flame', req: 'Complete 50 perfect tasks' },
    { id: 'throne', name: 'Throne Seeker', req: 'Purchase 3 items from Market' },
    { id: 'tome', name: 'Mystic Tome', req: 'Complete 100 tasks' },
    { id: 'key', name: 'Key of Secrets', req: 'Make your first purchase with Stars' },
    { id: 'moon', name: 'Midnight Watcher', req: 'Visit mostly between 22:00-05:00' },
    { id: 'cat', name: 'Shadow Familiar', req: 'Achieve 50 "Perfect" scores' },
    { id: 'crown', name: 'Royal Decree', req: 'Collect all other badges' }
];

function renderBadges() {
    const grid = document.getElementById('badges-grid');
    if (!grid) return;
    grid.innerHTML = ''; 

    badgesConfig.forEach(b => {
        const isUnlocked = unlockedBadgesList.includes(b.id);
        const state = isUnlocked ? 'active' : 'locked';
        const imgPath = `assets/badge_${b.id}_${state}.png`;
        
        const div = document.createElement('div');
        div.className = `badge-item ${isUnlocked ? 'unlocked' : 'locked'}`;
        
        div.innerHTML = `
            <div class="badge-img-box">
                <img src="${imgPath}" alt="${b.name}" class="badge-img">
            </div>
            <div class="badge-title">${b.name}</div>
        `;
        
        div.onclick = () => alert(`🎖️ ${b.name}\n\nStatus: ${isUnlocked ? 'UNLOCKED ✅' : 'LOCKED 🔒'}\nRequirement: ${b.req}`);
        
        grid.appendChild(div);
    });
}

// ==========================================================================
// 13. SYSTEM BOOTSTRAP
// ==========================================================================
showScreen(lobbyScreen);
loadUserData();