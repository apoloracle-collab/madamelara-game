import datetime
import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from database import get_or_create_user, update_user_interaction

# Completely verified Bot Token and Settings
BOT_TOKEN = "8708674642:AAFYD_ltPqnOch3Fg277sc-Gq-gXQgBjcRc"
bot = telebot.TeleBot(BOT_TOKEN)

# Your Live GitHub Pages Mini App Game URL
MINI_APP_URL = "https://apoloracle-collab.github.io/madamelara-game/?v=2"

# Your Verified Telegram Channel Invite Link
CHANNEL_URL = "https://t.me/+XrzPL2PXnYxkNjk0"

@bot.message_handler(commands=['start'])
def send_welcome(message):
    telegram_id = message.from_user.id
    
    # Get user from database or create if not exists
    user = get_or_create_user(telegram_id)
    
    if not user:
        bot.reply_to(message, "System connection error. Please try again later.")
        return

    # Lockout check
    if user["locked_until"]:
        lock_time = datetime.datetime.fromisoformat(user["locked_until"].replace('Z', '+00:00'))
        now = datetime.datetime.now(datetime.timezone.utc)
        
        if now < lock_time:
            remaining_time = lock_time - now
            hours, remainder = divmod(int(remaining_time.total_seconds()), 3600)
            minutes, _ = divmod(remainder, 60)
            
            lock_message = (
                f"⛓️ THE GATES ARE CLOSED! ⛓️\n\n"
                f"Your energy is completely depleted. Madame Lara is currently resting.\n"
                f"Time remaining until you are accepted back into her presence:\n"
                f"⏳ {hours} hours {minutes} minutes\n\n"
                f"Wait patiently until then."
            )
            bot.send_message(message.chat.id, lock_message)
            return

    # Tamamen Senin İstediğin Yeni Giriş Metni Yapısı
    welcome_message = (
        "👑 *Welcome to Madame Lara's World!* 👑\n\n"
        "This is the exclusive domain where Madame Lara rewards her most loyal followers. "
        "Step inside and begin uncovering the hidden treasures.\n\n"
        "⛓️ *What Awaits You Inside?*\n"
        "• *Unlock Secret Treasures:* Collect points with every single tap and gain exclusive access to Madame Lara's private content and special rewards!\n"
        "• *Rise Through the Ranks:* Leave everyone else behind, climb the global leaderboard, and prove your ultimate devotion.\n\n"
        "Click the button below to enter, explore the hidden secrets, and start earning your rewards right now!"
    )
    
    # Dual Button Layout (Stacked vertically)
    markup = InlineKeyboardMarkup(row_width=1)
    
    # Top Button: Mini App Portal Entry
    app_button = InlineKeyboardButton("🔗 Enter (Discover Secrets)", web_app=WebAppInfo(url=MINI_APP_URL))
    
    # Bottom Button: Real Channel Invite Link
    channel_button = InlineKeyboardButton("📢 Join Channel", url=CHANNEL_URL)
    
    # Add buttons to the interface
    markup.add(app_button, channel_button)
    
    bot.send_message(message.chat.id, welcome_message, parse_mode="Markdown", reply_markup=markup)

print("Madame Lara's Telegram Bot is now listening to the slaves...")
bot.infinity_polling()