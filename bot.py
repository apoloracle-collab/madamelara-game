import os
import time
import telebot
from telebot import types
from dotenv import load_dotenv
from database import get_or_create_slave

# ==========================================================================
# 1. ENVIRONMENT LOAD & BOT INITIALIZATION
# ==========================================================================
load_dotenv()

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
if not TOKEN:
    raise ValueError("CRITICAL ERROR: Missing TELEGRAM_BOT_TOKEN in .env file.")

bot = telebot.TeleBot(TOKEN)

# ==========================================================================
# 2. COMMAND HANDLERS
# ==========================================================================
@bot.message_handler(commands=['start'])
def send_welcome(message):
    telegram_id = message.from_user.id
    username = message.from_user.username
    
    # Sync user with database
    slave_data = get_or_create_slave(telegram_id, username)
    
    # Welcome message formulation
    welcome_text = (
        "👑 **Welcome to Madame Lara's World!** 👑\n\n"
        "This is the exclusive domain where Madame Lara rewards her most loyal followers. "
        "Step inside and begin uncovering the hidden treasures.\n\n"
        "⛓️ **What Awaits You Inside?**\n"
        "• **Unlock Secret Treasures:** Collect points with every single tap and gain exclusive access to Madame Lara's private content and special rewards!\n"
        "• **Rise Through The Ranks:** Leave everyone else behind, climb the global leaderboard, and prove your ultimate devotion.\n\n"
        "Click the button below to enter, explore the hidden secrets, and start earning your rewards right now!"
    )
    
    # ==========================================================================
    # 3. CACHE-BUSTING WEB APP URL GENERATION
    # ==========================================================================
    markup = types.InlineKeyboardMarkup()
    
    # DYNAMIC CACHE BUSTER: Generates a unique timestamp to force Telegram 
    # to fetch the latest HTML/JS files from the server, entirely bypassing the cache.
    cache_buster = int(time.time())
    web_app_url = f"https://apoloracle-collab.github.io/madamelara-game/?v={cache_buster}"
    
    web_app_info = types.WebAppInfo(url=web_app_url)
    
    # Button definitions
    btn_enter = types.InlineKeyboardButton("🔗 Enter (Discover Secrets)", web_app=web_app_info)
    
    # NOTE: Don't forget to change "your_channel_username" to your actual channel when ready!
    btn_join = types.InlineKeyboardButton("📢 Join Channel", url="https://t.me/your_channel_username")
    
    markup.row(btn_enter)
    markup.row(btn_join)
    
    # Send payload to user
    bot.send_message(message.chat.id, welcome_text, parse_mode="Markdown", reply_markup=markup)

# ==========================================================================
# 4. BOT EXECUTION LOOP
# ==========================================================================
print("Madame Lara's Telegram Bot engine is initialized and actively listening to slaves...")
bot.infinity_polling()